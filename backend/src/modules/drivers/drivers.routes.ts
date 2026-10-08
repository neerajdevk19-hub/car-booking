import { Router, Response } from 'express';
import { prisma } from '../../prisma/client';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { findNearbyAvailableDrivers } from '../assignments/assignment.service';
import { getSocketServer } from '../../sockets/socket.server';

export const driversRouter = Router();

// GET /api/v1/drivers/nearby?lat=...&lng=...&type=...
driversRouter.get('/nearby', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string || '17.4150');
    const lng = parseFloat(req.query.lng as string || '78.4350');
    const vehicleType = req.query.type as string;

    const drivers = await findNearbyAvailableDrivers(lat, lng, vehicleType);
    res.json({ success: true, count: drivers.length, drivers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/drivers/me
driversRouter.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const driver = await prisma.driver.findFirst({
      where: { userId: req.user?.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: true,
        bookings: {
          where: { status: { in: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS'] } },
          include: { customer: { select: { name: true, phone: true } } }
        }
      }
    });

    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver profile not found' });
    }

    res.json({ success: true, driver });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/drivers/availability
driversRouter.patch('/availability', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.body; // AVAILABLE, OFFLINE
    if (!['AVAILABLE', 'OFFLINE'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const driver = await prisma.driver.findFirst({ where: { userId: req.user?.id } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: { availabilityStatus: status }
    });

    res.json({ success: true, driver: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/drivers/location
driversRouter.post('/location', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude required' });
    }

    const driver = await prisma.driver.findFirst({ where: { userId: req.user?.id } });
    if (!driver) {
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }

    const updated = await prisma.driver.update({
      where: { id: driver.id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date()
      }
    });

    // Record history log
    await prisma.driverLocationHistory.create({
      data: {
        driverId: driver.id,
        latitude,
        longitude
      }
    });

    // Broadcast to active booking tracking channels
    const io = getSocketServer();
    if (io) {
      const activeBooking = await prisma.booking.findFirst({
        where: {
          driverId: driver.id,
          status: { in: ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS'] }
        }
      });
      if (activeBooking) {
        io.to(`ride:${activeBooking.id}`).emit('ride:driver:location', {
          bookingId: activeBooking.id,
          latitude,
          longitude,
          updatedAt: new Date()
        });
      }
    }

    res.json({ success: true, driver: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Driver workflow endpoints: ARRIVED, START, COMPLETE
driversRouter.post('/rides/:id/arrive', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'ARRIVED' }
    });

    await prisma.rideStatusHistory.create({
      data: { bookingId, previousStatus: 'CONFIRMED', newStatus: 'ARRIVED', changedBy: 'DRIVER' }
    });

    const io = getSocketServer();
    if (io) io.to(`ride:${bookingId}`).emit('ride:status:update', { bookingId, status: 'ARRIVED' });

    res.json({ success: true, booking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

driversRouter.post('/rides/:id/start', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'IN_PROGRESS' }
    });

    await prisma.rideStatusHistory.create({
      data: { bookingId, previousStatus: 'ARRIVED', newStatus: 'IN_PROGRESS', changedBy: 'DRIVER' }
    });

    const io = getSocketServer();
    if (io) io.to(`ride:${bookingId}`).emit('ride:status:update', { bookingId, status: 'IN_PROGRESS' });

    res.json({ success: true, booking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

driversRouter.post('/rides/:id/complete', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bookingId = req.params.id;
    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'COMPLETED' }
    });

    if (booking.driverId) {
      await prisma.driver.update({
        where: { id: booking.driverId },
        data: { availabilityStatus: 'AVAILABLE' }
      });
    }

    await prisma.rideStatusHistory.create({
      data: { bookingId, previousStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', changedBy: 'DRIVER' }
    });

    const io = getSocketServer();
    if (io) io.to(`ride:${bookingId}`).emit('ride:status:update', { bookingId, status: 'COMPLETED' });

    res.json({ success: true, booking });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
