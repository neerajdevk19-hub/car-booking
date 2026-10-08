import { prisma } from '../../prisma/client';
import { calculateHaversineDistance, estimateDurationMinutes } from '../../utils/geo';
import { getSocketServer } from '../../sockets/socket.server';

export interface DriverCandidate {
  driverId: string;
  driverName: string;
  phone: string;
  vehicleModel: string;
  vehicleReg: string;
  vehicleColor: string;
  vehicleType: string;
  rating: number;
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Find nearby available drivers ranked by distance and pickup ETA
 */
export async function findNearbyAvailableDrivers(
  pickupLat: number,
  pickupLng: number,
  vehicleType?: string,
  maxDistanceKm: number = 25
): Promise<DriverCandidate[]> {
  const drivers = await prisma.driver.findMany({
    where: {
      availabilityStatus: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      ...(vehicleType ? { vehicle: { vehicleType: vehicleType.toUpperCase() } } : {})
    },
    include: {
      user: { select: { name: true, phone: true } },
      vehicle: true
    }
  });

  const candidates: DriverCandidate[] = [];

  for (const d of drivers) {
    if (!d.vehicle) continue;
    const distanceKm = calculateHaversineDistance(
      pickupLat,
      pickupLng,
      d.currentLatitude,
      d.currentLongitude
    );

    if (distanceKm <= maxDistanceKm) {
      const etaMinutes = estimateDurationMinutes(distanceKm, 1.1);
      candidates.push({
        driverId: d.id,
        driverName: d.user.name,
        phone: d.user.phone || '',
        vehicleModel: d.vehicle.model,
        vehicleReg: d.vehicle.registrationNumber,
        vehicleColor: d.vehicle.color,
        vehicleType: d.vehicle.vehicleType,
        rating: 4.8 + (Math.random() * 0.2), // Mock highly rated driver 4.8-5.0
        distanceKm,
        etaMinutes
      });
    }
  }

  // Sort by nearest distance
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  return candidates;
}

/**
 * Assign a ride to the best available driver
 */
export async function assignDriverToBooking(
  bookingId: string,
  preferredVehicleType?: string
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId }
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const candidates = await findNearbyAvailableDrivers(
    booking.pickupLatitude,
    booking.pickupLongitude,
    preferredVehicleType || booking.vehicleId || undefined
  );

  if (candidates.length === 0) {
    // If no driver in exact category, try any vehicle category fallback
    const fallbackCandidates = await findNearbyAvailableDrivers(
      booking.pickupLatitude,
      booking.pickupLongitude
    );
    if (fallbackCandidates.length === 0) {
      return { success: false, reason: 'NO_DRIVERS_AVAILABLE' };
    }
    candidates.push(...fallbackCandidates);
  }

  const selectedDriverCandidate = candidates[0];

  // Assign driver to booking and mark driver status ON_TRIP
  const updatedDriver = await prisma.driver.update({
    where: { id: selectedDriverCandidate.driverId },
    data: { availabilityStatus: 'ON_TRIP' },
    include: { vehicle: true, user: true }
  });

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      driverId: selectedDriverCandidate.driverId,
      vehicleId: updatedDriver.vehicle?.id || null,
      status: 'CONFIRMED'
    },
    include: {
      driver: { include: { user: true } },
      vehicle: true
    }
  });

  // Record status history
  await prisma.rideStatusHistory.create({
    data: {
      bookingId,
      previousStatus: booking.status,
      newStatus: 'CONFIRMED',
      changedBy: 'SYSTEM_ASSIGNMENT'
    }
  });

  // Broadcast WebSocket notification to ride channel and driver channel
  const io = getSocketServer();
  if (io) {
    io.to(`ride:${bookingId}`).emit('ride:assigned', {
      bookingId,
      driver: {
        id: updatedDriver.id,
        name: updatedDriver.user.name,
        phone: updatedDriver.user.phone,
        vehicleModel: updatedDriver.vehicle?.model,
        vehicleReg: updatedDriver.vehicle?.registrationNumber,
        vehicleColor: updatedDriver.vehicle?.color,
        latitude: updatedDriver.currentLatitude,
        longitude: updatedDriver.currentLongitude
      },
      etaMinutes: selectedDriverCandidate.etaMinutes
    });

    io.to(`driver:${updatedDriver.id}`).emit('ride:request', {
      bookingId,
      pickupAddress: booking.pickupAddress,
      dropAddress: booking.dropAddress,
      fare: booking.estimatedFare
    });
  }

  return {
    success: true,
    driver: selectedDriverCandidate,
    booking: updatedBooking
  };
}
