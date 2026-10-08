import { HYDERABAD_LANDMARKS, HyderabadLandmark } from '../config/constants';

/**
 * Calculate distance between two latitude/longitude points in kilometers using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100; // 2 decimal places
}

/**
 * Estimate travel duration in minutes based on distance and average urban traffic speed
 */
export function estimateDurationMinutes(
  distanceKm: number,
  trafficMultiplier: number = 1.2
): number {
  const avgSpeedKmH = 30 / trafficMultiplier; // ~25-30 km/h city speed
  const hours = distanceKm / avgSpeedKmH;
  const minutes = Math.ceil(hours * 60);
  return Math.max(minutes, 3); // Minimum 3 mins
}

/**
 * Resolve a natural language place string (English or Telugu) to coordinates and standard address
 */
export function resolveLocationQuery(query: string): {
  name: string;
  lat: number;
  lng: number;
  address: string;
} {
  const cleaned = query.trim().toLowerCase();

  // Check landmark aliases
  for (const landmark of HYDERABAD_LANDMARKS) {
    for (const alias of landmark.aliases) {
      if (cleaned.includes(alias) || alias.includes(cleaned)) {
        return {
          name: landmark.name,
          lat: landmark.lat,
          lng: landmark.lng,
          address: landmark.address
        };
      }
    }
  }

  // Fallback: Default to central location (Banjara Hills / Hitec City area) with slight jitter
  const hash = Array.from(query).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const latOffset = ((hash % 50) - 25) * 0.002;
  const lngOffset = (((hash * 7) % 50) - 25) * 0.002;

  return {
    name: query,
    lat: Math.round((17.4150 + latOffset) * 10000) / 10000,
    lng: Math.round((78.4350 + lngOffset) * 10000) / 10000,
    address: `${query}, Hyderabad, Telangana`
  };
}

/**
 * Generate traffic-aware route details & alternate options
 */
export function calculateRouteDetails(
  pickupLat: number,
  pickupLng: number,
  dropLat: number,
  dropLng: number
) {
  const distanceKm = calculateHaversineDistance(pickupLat, pickupLng, dropLat, dropLng);

  // Main route (via Main Express Arterial)
  const durationNormal = estimateDurationMinutes(distanceKm, 1.0);
  const durationTraffic = estimateDurationMinutes(distanceKm, 1.25);

  // Alternate route (via Ring Road / Bypass)
  const altDistanceKm = Math.round(distanceKm * 1.15 * 100) / 100;
  const altDuration = estimateDurationMinutes(altDistanceKm, 1.05);

  return {
    recommendedRoute: {
      name: "Fastest Route via Outer Ring Road / Express Way",
      distanceKm,
      estimatedDurationMinutes: durationTraffic,
      trafficCondition: durationTraffic > durationNormal + 5 ? "Moderate Traffic" : "Clear Traffic",
      savingMinutes: altDuration > durationTraffic ? altDuration - durationTraffic : 0
    },
    alternateRoute: {
      name: "Alternate Route via City Arterial Road",
      distanceKm: altDistanceKm,
      estimatedDurationMinutes: altDuration,
      trafficCondition: "Light Traffic"
    }
  };
}
