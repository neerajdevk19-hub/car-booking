import { Server } from 'socket.io';
import { prisma } from '../prisma/client';
import { calculateHaversineDistance } from '../utils/geo';

let simulationInterval: NodeJS.Timeout | null = null;

/**
 * Start the Live Driver Simulator loop to move active assigned drivers towards pickup/drop points
 */
export function startDriverSimulator(io: Server) {
  if (simulationInterval) return;

  console.log('🚗 Driver location simulator started (3s interval)');

  simulationInterval = setInterval(async () => {
    try {
      // Find active rides with assigned drivers
      const activeRides = await prisma.booking.findMany({
        where: {
          status: { in: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS'] },
          driverId: { not: null }
        },
        include: { driver: true }
      });

      for (const ride of activeRides) {
        if (!ride.driver) continue;

        let targetLat = ride.pickupLatitude;
        let targetLng = ride.pickupLongitude;

        if (ride.status === 'IN_PROGRESS') {
          targetLat = ride.dropLatitude;
          targetLng = ride.dropLongitude;
        }

        const currentLat = ride.driver.currentLatitude;
        const currentLng = ride.driver.currentLongitude;

        const dist = calculateHaversineDistance(currentLat, currentLng, targetLat, targetLng);

        // If driver has reached target area
        if (dist <= 0.08) {
          if (ride.status === 'CONFIRMED') {
            await prisma.booking.update({ where: { id: ride.id }, data: { status: 'ARRIVED' } });
            io.to(`ride:${ride.id}`).emit('ride:status:update', { bookingId: ride.id, status: 'ARRIVED' });
          }
          continue;
        }

        // Interpolate movement step (moving ~150 meters closer each tick)
        const stepRatio = 0.08;
        const newLat = Math.round((currentLat + (targetLat - currentLat) * stepRatio) * 10000) / 10000;
        const newLng = Math.round((currentLng + (targetLng - currentLng) * stepRatio) * 10000) / 10000;

        // Update DB
        await prisma.driver.update({
          where: { id: ride.driver.id },
          data: {
            currentLatitude: newLat,
            currentLongitude: newLng,
            lastLocationUpdate: new Date()
          }
        });

        // Broadcast to live ride socket room
        io.to(`ride:${ride.id}`).emit('ride:driver:location', {
          bookingId: ride.id,
          driverId: ride.driver.id,
          latitude: newLat,
          longitude: newLng,
          updatedAt: new Date()
        });
      }
    } catch (err) {
      console.error('Error in driver simulator loop:', err);
    }
  }, 3000);
}

export function stopDriverSimulator() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
}
