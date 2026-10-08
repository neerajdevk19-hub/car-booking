import { Router, Response } from 'express';
import { prisma } from '../../prisma/client';
import { authenticateJWT, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { resolveLocationQuery, calculateHaversineDistance, estimateDurationMinutes } from '../../utils/geo';
import { calculateFareForType, calculateFaresAllCategories } from '../pricing/pricing.service';
import { assignDriverToBooking, findNearbyAvailableDrivers } from '../assignments/assignment.service';
import { getSocketServer } from '../../sockets/socket.server';

export const bookingsRouter = Router();

// GET /api/v1/rides/availability
bookingsRouter.get('/availability', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const pickup = req.query.pickup as string || 'Banjara Hills';
    const resolved = resolveLocationQuery(pickup);

    const drivers = await findNearbyAvailableDrivers(resolved.lat, resolved.lng);

    res.json({
      success: true,
      pickup: resolved,
      availableCount: drivers.length,
      availableCategories: Array.from(new Set(drivers.map(d => d.vehicleType))),
      drivers: drivers.slice(0, 5)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/rides/estimate
bookingsRouter.post('/estimate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pickupAddress, dropAddress } = req.body;
    if (!pickupAddress || !dropAddress) {
      return res.status(400).json({ success: false, message: 'Pickup and drop-off addresses are required' });
    }

    const resolvedP = resolveLocationQuery(pickupAddress);
    const resolvedD = resolveLocationQuery(dropAddress);

    const distanceKm = calculateHaversineDistance(resolvedP.lat, resolvedP.lng, resolvedD.lat, resolvedD.lng);
    const durationMinutes = estimateDurationMinutes(distanceKm);

    const fares = await calculateFaresAllCategories(distanceKm, durationMinutes);

    res.json({
      success: true,
      pickup: resolvedP,
      drop: resolvedD,
      distanceKm,
      estimatedDurationMinutes: durationMinutes,
      fares
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/rides/prepare (Draft booking summary)
bookingsRouter.post('/prepare', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pickupAddress, dropAddress, vehicleType, scheduledAt } = req.body;

    if (!pickupAddress || !dropAddress) {
      return res.status(400).json({ success: false, message: 'Pickup and drop locations are required' });
    }

    const resolvedP = resolveLocationQuery(pickupAddress);
    const resolvedD = resolveLocationQuery(dropAddress);

    const distanceKm = calculateHaversineDistance(resolvedP.lat, resolvedP.lng, resolvedD.lat, resolvedD.lng);
    const durationMinutes = estimateDurationMinutes(distanceKm);
    const type = (vehicleType || 'SEDAN').toUpperCase();

    const fareInfo = await calculateFareForType(type, distanceKm, durationMinutes);
    const confirmationToken = `CONFIRM_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    res.json({
      success: true,
      draft: {
        customerId: req.user?.id,
        pickupAddress: resolvedP.address,
        pickupLatitude: resolvedP.lat,
        pickupLongitude: resolvedP.lng,
        dropAddress: resolvedD.address,
        dropLatitude: resolvedD.lat,
        dropLongitude: resolvedD.lng,
        vehicleType: type,
        vehicleTypeName: fareInfo.vehicleTypeName,
        distanceKm,
        estimatedDurationMinutes: durationMinutes,
        estimatedFare: fareInfo.totalFare,
        currency: 'INR',
        scheduledAt: scheduledAt || new Date().toISOString(),
        confirmationToken
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/rides/confirm (Create DB record and match driver)
bookingsRouter.post('/confirm', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      pickupAddress,
      pickupLatitude,
      pickupLongitude,
      dropAddress,
      dropLatitude,
      dropLongitude,
      vehicleType,
      scheduledAt,
      confirmationToken
    } = req.body;

    if (!pickupAddress || !dropAddress || !confirmationToken) {
      return res.status(400).json({ success: false, message: 'Missing required booking details or confirmation token' });
    }

    const resolvedP = pickupLatitude && pickupLongitude
      ? { address: pickupAddress, lat: pickupLatitude, lng: pickupLongitude }
      : resolveLocationQuery(pickupAddress);

    const resolvedD = dropLatitude && dropLongitude
      ? { address: dropAddress, lat: dropLatitude, lng: dropLongitude }
      : resolveLocationQuery(dropAddress);

    const distanceKm = calculateHaversineDistance(resolvedP.lat, resolvedP.lng, resolvedD.lat, resolvedD.lng);
    const durationMinutes = estimateDurationMinutes(distanceKm);
    const type = (vehicleType || 'SEDAN').toUpperCase();

    const fareInfo = await calculateFareForType(type, distanceKm, durationMinutes);

    // Persist booking to Database
    const booking = await prisma.booking.create({
      data: {
        customerId: req.user!.id,
        pickupAddress: resolvedP.address,
        pickupLatitude: resolvedP.lat,
        pickupLongitude: resolvedP.lng,
        dropAddress: resolvedD.address,
        dropLatitude: resolvedD.lat,
        dropLongitude: resolvedD.lng,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
        distanceKm,
        estimatedDurationMinutes: durationMinutes,
        estimatedFare: fareInfo.totalFare,
        currency: 'INR',
        status: 'PENDING_ASSIGNMENT',
        confirmationToken,
        statusHistory: {
          create: [{ previousStatus: null, newStatus: 'PENDING_ASSIGNMENT', changedBy: 'CUSTOMER' }]
        }
      }
    });

    // Execute Driver Assignment Engine
    const assignment = await assignDriverToBooking(booking.id, type);

    const refreshedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: {
        driver: { include: { user: true, vehicle: true } },
        vehicle: true
      }
    });

    res.status(201).json({
      success: true,
      booking: refreshedBooking,
      driverAssignment: assignment
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/rides (List user's rides)
bookingsRouter.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rides = await prisma.booking.findMany({
      where: { customerId: req.user?.id },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { include: { user: { select: { name: true, phone: true } }, vehicle: true } }
      }
    });

    res.json({ success: true, count: rides.length, rides });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/rides/:id (Ride details)
bookingsRouter.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        driver: { include: { user: { select: { name: true, phone: true } }, vehicle: true } },
        statusHistory: { orderBy: { timestamp: 'asc' } }
      }
    });

    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride booking not found' });
    }

    res.json({ success: true, ride });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/v1/rides/:id (Modify ride: pickup, drop, time)
bookingsRouter.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pickupAddress, dropAddress, scheduledAt } = req.body;
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: `Cannot modify booking with status ${booking.status}` });
    }

    let pAddress = booking.pickupAddress;
    let pLat = booking.pickupLatitude;
    let pLng = booking.pickupLongitude;

    let dAddress = booking.dropAddress;
    let dLat = booking.dropLatitude;
    let dLng = booking.dropLongitude;

    if (pickupAddress) {
      const resolvedP = resolveLocationQuery(pickupAddress);
      pAddress = resolvedP.address;
      pLat = resolvedP.lat;
      pLng = resolvedP.lng;
    }

    if (dropAddress) {
      const resolvedD = resolveLocationQuery(dropAddress);
      dAddress = resolvedD.address;
      dLat = resolvedD.lat;
      dLng = resolvedD.lng;
    }

    const distanceKm = calculateHaversineDistance(pLat, pLng, dLat, dLng);
    const durationMinutes = estimateDurationMinutes(distanceKm);
    const fareInfo = await calculateFareForType('SEDAN', distanceKm, durationMinutes);

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        pickupAddress: pAddress,
        pickupLatitude: pLat,
        pickupLongitude: pLng,
        dropAddress: dAddress,
        dropLatitude: dLat,
        dropLongitude: dLng,
        distanceKm,
        estimatedDurationMinutes: durationMinutes,
        estimatedFare: fareInfo.totalFare,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {})
      },
      include: { driver: { include: { user: true, vehicle: true } } }
    });

    res.json({ success: true, booking: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/rides/:id/cancel
bookingsRouter.post('/:id/cancel', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED') {
      return res.json({ success: true, message: 'Booking is already cancelled', booking });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' }
    });

    if (booking.driverId) {
      await prisma.driver.update({
        where: { id: booking.driverId },
        data: { availabilityStatus: 'AVAILABLE' }
      });
    }

    await prisma.rideStatusHistory.create({
      data: { bookingId: booking.id, previousStatus: booking.status, newStatus: 'CANCELLED', changedBy: 'CUSTOMER' }
    });

    const io = getSocketServer();
    if (io) {
      io.to(`ride:${booking.id}`).emit('ride:cancelled', { bookingId: booking.id });
    }

    res.json({ success: true, message: 'Ride successfully cancelled', booking: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/rides/:id/rebook
bookingsRouter.post('/:id/rebook', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const oldRide = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!oldRide) {
      return res.status(404).json({ success: false, message: 'Original ride not found' });
    }

    const confirmationToken = `REBOOK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const newBooking = await prisma.booking.create({
      data: {
        customerId: req.user!.id,
        pickupAddress: oldRide.pickupAddress,
        pickupLatitude: oldRide.pickupLatitude,
        pickupLongitude: oldRide.pickupLongitude,
        dropAddress: oldRide.dropAddress,
        dropLatitude: oldRide.dropLatitude,
        dropLongitude: oldRide.dropLongitude,
        distanceKm: oldRide.distanceKm,
        estimatedDurationMinutes: oldRide.estimatedDurationMinutes,
        estimatedFare: oldRide.estimatedFare,
        currency: oldRide.currency,
        status: 'PENDING_ASSIGNMENT',
        confirmationToken,
        statusHistory: {
          create: [{ previousStatus: null, newStatus: 'PENDING_ASSIGNMENT', changedBy: 'CUSTOMER_REBOOK' }]
        }
      }
    });

    await assignDriverToBooking(newBooking.id);

    const refreshed = await prisma.booking.findUnique({
      where: { id: newBooking.id },
      include: { driver: { include: { user: true, vehicle: true } } }
    });

    res.status(201).json({ success: true, booking: refreshed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/rides/:id/status
bookingsRouter.get('/:id/status', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        driver: { include: { user: { select: { name: true, phone: true } }, vehicle: true } }
      }
    });

    if (!ride) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    let distanceToPickupKm = null;
    let etaMinutes = null;

    if (ride.driver) {
      distanceToPickupKm = calculateHaversineDistance(
        ride.driver.currentLatitude,
        ride.driver.currentLongitude,
        ride.pickupLatitude,
        ride.pickupLongitude
      );
      etaMinutes = estimateDurationMinutes(distanceToPickupKm);
    }

    res.json({
      success: true,
      bookingId: ride.id,
      status: ride.status,
      driver: ride.driver ? {
        name: ride.driver.user.name,
        phone: ride.driver.user.phone,
        vehicleModel: ride.driver.vehicle?.model,
        vehicleReg: ride.driver.vehicle?.registrationNumber,
        currentLatitude: ride.driver.currentLatitude,
        currentLongitude: ride.driver.currentLongitude,
        distanceToPickupKm,
        etaMinutes
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/v1/rides/:id (Delete booking record from database)
bookingsRouter.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.driverId && ['CONFIRMED', 'IN_PROGRESS', 'ARRIVED'].includes(booking.status)) {
      await prisma.driver.update({
        where: { id: booking.driverId },
        data: { availabilityStatus: 'AVAILABLE' }
      });
    }

    // Delete status history first to avoid FK constraints
    await prisma.rideStatusHistory.deleteMany({ where: { bookingId: booking.id } });

    // Delete booking record from DB
    await prisma.booking.delete({ where: { id: booking.id } });

    res.json({ success: true, message: 'Ride booking deleted from database' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

