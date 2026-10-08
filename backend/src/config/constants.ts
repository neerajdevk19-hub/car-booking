export const PORT = process.env.PORT || 5000;
export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_rideai_jwt_key_2026';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
export const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// Vehicles & Default Pricing (in INR)
export const VEHICLE_TYPES = {
  AUTO: { name: 'Auto Rickshaw', baseFare: 30, perKmRate: 15, perMinuteRate: 1.5, minFare: 40, seats: 3 },
  HATCHBACK: { name: 'Go Mini (Hatchback)', baseFare: 50, perKmRate: 18, perMinuteRate: 2, minFare: 70, seats: 4 },
  SEDAN: { name: 'Go Sedan', baseFare: 80, perKmRate: 22, perMinuteRate: 2.5, minFare: 100, seats: 4 },
  SUV: { name: 'XL SUV', baseFare: 120, perKmRate: 30, perMinuteRate: 3.5, minFare: 150, seats: 6 },
  PREMIUM: { name: 'Executive Premium', baseFare: 180, perKmRate: 40, perMinuteRate: 5, minFare: 250, seats: 4 }
};

import { HYDERABAD_LANDMARKS, HyderabadLandmark } from '../data/landmarks.data';

export { HYDERABAD_LANDMARKS, HyderabadLandmark };
