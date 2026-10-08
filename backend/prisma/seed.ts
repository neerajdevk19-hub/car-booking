import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SEED_CUSTOMERS, SEED_DRIVERS, SEED_PRICING_RULES } from '../src/data/seed-dummy-data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing tables
  await prisma.aIActionLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.rideStatusHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.driverLocationHistory.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.savedLocation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pricingRule.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);
  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      name: 'RideAI System Admin',
      email: 'admin@rideai.com',
      phone: '+91 90000 00000',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      preferredLanguage: 'en'
    }
  });
  console.log('✅ Admin created:', admin.email);

  // 2. Create Customers from dummy data
  for (const c of SEED_CUSTOMERS) {
    await prisma.user.create({
      data: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        passwordHash,
        role: 'CUSTOMER',
        preferredLanguage: c.preferredLanguage,
        savedLocations: {
          create: c.savedLocations
        }
      }
    });
  }
  console.log('✅ Customers created');

  // 3. Create Drivers & Vehicles from dummy data
  for (const d of SEED_DRIVERS) {
    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone,
        passwordHash,
        role: 'DRIVER',
        preferredLanguage: 'en'
      }
    });

    const driver = await prisma.driver.create({
      data: {
        userId: user.id,
        licenseNumber: d.license,
        availabilityStatus: 'AVAILABLE',
        verificationStatus: 'VERIFIED',
        currentLatitude: d.lat,
        currentLongitude: d.lng
      }
    });

    await prisma.vehicle.create({
      data: {
        driverId: driver.id,
        registrationNumber: d.vehicle.reg,
        model: d.vehicle.model,
        color: d.vehicle.color,
        vehicleType: d.vehicle.type,
        seatCapacity: d.vehicle.seats,
        status: 'ACTIVE'
      }
    });
  }
  console.log('✅ Drivers & Vehicles created');

  // 4. Create Pricing Rules from dummy data
  for (const p of SEED_PRICING_RULES) {
    await prisma.pricingRule.create({ data: p });
  }
  console.log('✅ Pricing Rules created');

  // 5. Create Sample Past Ride
  const customer1 = await prisma.user.findFirst({ where: { email: 'customer@rideai.com' } });
  const driverObj = await prisma.driver.findFirst({ include: { vehicle: true } });

  if (customer1 && driverObj) {
    await prisma.booking.create({
      data: {
        customerId: customer1.id,
        driverId: driverObj.id,
        vehicleId: driverObj.vehicle?.id,
        pickupAddress: 'Hitec City Cyber Towers, Madhapur, Hyderabad',
        pickupLatitude: 17.4504,
        pickupLongitude: 78.3808,
        dropAddress: 'Secunderabad Junction Railway Station, Secunderabad',
        dropLatitude: 17.4334,
        dropLongitude: 78.5016,
        distanceKm: 16.5,
        estimatedDurationMinutes: 42,
        estimatedFare: 420.0,
        finalFare: 420.0,
        status: 'COMPLETED',
        statusHistory: {
          create: [
            { previousStatus: null, newStatus: 'CONFIRMED', changedBy: 'CUSTOMER' },
            { previousStatus: 'CONFIRMED', newStatus: 'ARRIVED', changedBy: 'DRIVER' },
            { previousStatus: 'ARRIVED', newStatus: 'IN_PROGRESS', changedBy: 'DRIVER' },
            { previousStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', changedBy: 'DRIVER' }
          ]
        }
      }
    });
  }

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
