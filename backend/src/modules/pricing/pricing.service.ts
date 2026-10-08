import { prisma } from '../../prisma/client';
import { VEHICLE_TYPES } from '../../config/constants';

export interface FareCalculationResult {
  vehicleType: string;
  vehicleTypeName: string;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
  currency: string;
}

export async function calculateFareForType(
  vehicleType: string,
  distanceKm: number,
  durationMinutes: number,
  trafficLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' = 'LOW'
): Promise<FareCalculationResult> {
  const typeUpper = vehicleType.toUpperCase();
  const rule = await prisma.pricingRule.findUnique({
    where: { vehicleType: typeUpper }
  });

  const baseFare = rule ? rule.baseFare : (VEHICLE_TYPES as any)[typeUpper]?.baseFare || 50;
  const perKmRate = rule ? rule.perKmRate : (VEHICLE_TYPES as any)[typeUpper]?.perKmRate || 18;
  const perMinuteRate = rule ? rule.perMinuteRate : (VEHICLE_TYPES as any)[typeUpper]?.perMinuteRate || 2;
  const minimumFare = rule ? rule.minimumFare : (VEHICLE_TYPES as any)[typeUpper]?.minFare || 70;

  const distanceFare = distanceKm * perKmRate;
  const timeFare = durationMinutes * perMinuteRate;
  let rawTotal = baseFare + distanceFare + timeFare;

  let surgeMultiplier = 1.0;
  if (trafficLevel === 'MEDIUM') surgeMultiplier = 1.2;
  else if (trafficLevel === 'HIGH') surgeMultiplier = 1.5;
  else if (trafficLevel === 'VERY HIGH') surgeMultiplier = 2.0;

  rawTotal = rawTotal * surgeMultiplier;

  const totalFare = Math.max(Math.round(rawTotal), minimumFare);

  return {
    vehicleType: typeUpper,
    vehicleTypeName: (VEHICLE_TYPES as any)[typeUpper]?.name || typeUpper,
    baseFare,
    distanceFare: Math.round(distanceFare),
    timeFare: Math.round(timeFare),
    totalFare,
    currency: 'INR'
  };
}

export async function calculateFaresAllCategories(
  distanceKm: number,
  durationMinutes: number,
  trafficLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' = 'LOW'
): Promise<FareCalculationResult[]> {
  const types = Object.keys(VEHICLE_TYPES);
  const results: FareCalculationResult[] = [];

  for (const type of types) {
    const fare = await calculateFareForType(type, distanceKm, durationMinutes, trafficLevel);
    results.push(fare);
  }

  return results;
}
