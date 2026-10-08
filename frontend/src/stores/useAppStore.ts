import { create } from 'zustand';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'CUSTOMER' | 'DRIVER' | 'ADMIN';
  preferredLanguage: 'en' | 'te';
  driverId?: string | null;
}

export interface BookingDraft {
  pickup?: string;
  destination?: string;
  pickupTime?: string;
  vehicleType?: string;
  estimatedFare?: number;
  distanceKm?: number;
  duration?: number;
  confirmationToken?: string;
  state?: string;
}

export interface AppState {
  language: 'en' | 'te';
  user: UserProfile | null;
  token: string | null;
  activeBookingId: string | null;
  currentBookingDraft: BookingDraft | null;

  setLanguage: (lang: 'en' | 'te') => void;
  setUser: (user: UserProfile | null, token?: string | null) => void;
  setActiveBookingId: (id: string | null) => void;
  setCurrentBookingDraft: (draft: BookingDraft | null) => void;
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: 'en',
  user: {
    id: 'demo-customer-1',
    name: 'Rahul Verma',
    email: 'customer@rideai.com',
    role: 'CUSTOMER',
    preferredLanguage: 'en'
  },
  token: 'demo-jwt-token',
  activeBookingId: null,
  currentBookingDraft: null,

  setLanguage: (lang) => set({ language: lang }),
  setUser: (user, token) => set({ user, token: token !== undefined ? token : 'demo-jwt-token' }),
  setActiveBookingId: (id) => set({ activeBookingId: id }),
  setCurrentBookingDraft: (draft) => set({ currentBookingDraft: draft }),
  logout: () => set({ user: null, token: null, activeBookingId: null, currentBookingDraft: null })
}));
