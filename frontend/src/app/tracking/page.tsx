'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../stores/useAppStore';
import { InteractiveMap, MapMarker } from '../../components/maps/InteractiveMap';
import { io, Socket } from 'socket.io-client';
import { Car, MapPin, Navigation, Clock, CheckCircle, ShieldAlert } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  currentLatitude: number;
  currentLongitude: number;
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  licensePlate: string;
  color: string;
  type: string;
}

interface BookingDetails {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropLatitude: number;
  dropLongitude: number;
  estimatedFare: number;
  driver?: Driver | null;
  vehicle?: Vehicle | null;
}

export default function TrackingPage() {
  const router = useRouter();
  const { activeBookingId, setActiveBookingId, token } = useAppStore();
  
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [driverLat, setDriverLat] = useState<number | null>(null);
  const [driverLng, setDriverLng] = useState<number | null>(null);

  useEffect(() => {
    if (!activeBookingId) {
      setLoading(false);
      return;
    }

    const fetchBooking = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        let res = activeBookingId
          ? await fetch(`${apiUrl}/api/v1/rides/${activeBookingId}`, {
              headers: { Authorization: `Bearer ${token}` }
            })
          : null;
        
        if (!res || !res.ok) {
          // Fallback: Fetch user's active ride from ride history
          const listRes = await fetch(`${apiUrl}/api/v1/rides`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const listData = await listRes.json();
          if (listData.success && listData.rides && listData.rides.length > 0) {
            const activeRide = listData.rides.find((r: any) =>
              ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_ASSIGNMENT'].includes(r.status)
            );
            if (activeRide) {
              setBooking(activeRide);
              if (activeRide.driver) {
                setDriverLat(activeRide.driver.currentLatitude);
                setDriverLng(activeRide.driver.currentLongitude);
              }
              setActiveBookingId(activeRide.id);
              return;
            }
          }
          setBooking(null);
          return;
        }

        const data = await res.json();
        const rideData = data.ride || data.data;
        if (data.success && rideData) {
          setBooking(rideData);
          if (rideData.driver) {
            setDriverLat(rideData.driver.currentLatitude);
            setDriverLng(rideData.driver.currentLongitude);
          }
        } else {
          setBooking(null);
        }
      } catch (err: any) {
        setBooking(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [activeBookingId, token]);

  useEffect(() => {
    if (!activeBookingId || !booking) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socketInstance = io(apiUrl);
    
    socketInstance.on('connect', () => {
      console.log('Socket connected:', socketInstance.id);
      socketInstance.emit('ride:join', activeBookingId);
    });

    socketInstance.on('ride:status:update', (data: any) => {
      console.log('Received ride status update:', data);
      setBooking((prev) => prev ? { ...prev, status: data.status } : null);
    });

    setSocket(socketInstance);

    // --- CLIENT SIDE SIMULATION (Fallback for missing Socket.io location updates) ---
    const interval = setInterval(() => {
      const targetLat = booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED' ? booking.dropLatitude : booking.pickupLatitude;
      const targetLng = booking.status === 'IN_PROGRESS' || booking.status === 'COMPLETED' ? booking.dropLongitude : booking.pickupLongitude;

      setDriverLat(prevLat => {
        if (prevLat === null) return targetLat - 0.015; // Initial offset
        const diff = targetLat - prevLat;
        if (Math.abs(diff) < 0.0001) return targetLat;
        return prevLat + (diff * 0.05); // Move 5% closer every second
      });
      
      setDriverLng(prevLng => {
        if (prevLng === null) return targetLng - 0.015; // Initial offset
        const diff = targetLng - prevLng;
        if (Math.abs(diff) < 0.0001) return targetLng;
        return prevLng + (diff * 0.05);
      });
    }, 1000);

    return () => {
      socketInstance.disconnect();
      clearInterval(interval);
    };
  }, [activeBookingId, booking?.id, booking?.status, booking?.pickupLatitude, booking?.dropLatitude, booking?.pickupLongitude, booking?.dropLongitude]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!activeBookingId || !booking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <Car className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900">No Active Booking</h2>
        <p className="text-slate-500">You don't have any ongoing rides.</p>
        <button 
          onClick={() => router.push('/assistant')}
          className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors"
        >
          Book a Ride Now
        </button>
      </div>
    );
  }

  const mapMarkers: MapMarker[] = [
    {
      id: 'pickup',
      lat: booking.pickupLatitude,
      lng: booking.pickupLongitude,
      title: 'Pickup',
      subtitle: booking.pickupAddress,
      type: 'pickup'
    },
    {
      id: 'drop',
      lat: booking.dropLatitude,
      lng: booking.dropLongitude,
      title: 'Destination',
      subtitle: booking.dropAddress,
      type: 'drop'
    }
  ];

  if (driverLat !== null && driverLng !== null) {
    mapMarkers.push({
      id: 'driver',
      lat: driverLat,
      lng: driverLng,
      title: booking.driver?.name || 'Driver',
      subtitle: booking.vehicle ? `${booking.vehicle.make} ${booking.vehicle.model}` : 'On the way',
      type: 'driver'
    });
  }

  // Calculate center to show all markers (simplified to average of pickup and drop for now)
  const centerLat = (booking.pickupLatitude + booking.dropLatitude) / 2;
  const centerLng = (booking.pickupLongitude + booking.dropLongitude) / 2;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-amber-500 bg-amber-100 border-amber-500/20';
      case 'CONFIRMED': return 'text-blue-400 bg-blue-100 border-blue-500/20';
      case 'ARRIVED': return 'text-emerald-400 bg-emerald-100 border-emerald-500/20';
      case 'IN_PROGRESS': return 'text-purple-400 bg-purple-100 border-purple-500/20';
      case 'COMPLETED': return 'text-emerald-500 bg-emerald-100 border-emerald-500/20';
      case 'CANCELLED': return 'text-red-500 bg-red-100 border-red-500/20';
      default: return 'text-slate-500 bg-slate-100 border-slate-300';
    }
  };

  // Simulate trafficLevel and surgeMultiplier for UI demo
  let simulatedTrafficLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH' = 'LOW';
  let simulatedSurge = 1.0;
  
  if (booking.estimatedFare > 500) {
    simulatedTrafficLevel = 'VERY HIGH';
    simulatedSurge = 2.0;
  } else if (booking.estimatedFare > 300) {
    simulatedTrafficLevel = 'HIGH';
    simulatedSurge = 1.5;
  } else if (booking.estimatedFare > 200) {
    simulatedTrafficLevel = 'MEDIUM';
    simulatedSurge = 1.2;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 py-4 max-w-6xl mx-auto w-full">
      {/* Left Column: Live Map Tracking */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        <div className="glass-panel p-4 rounded-3xl border border-slate-200 shadow-2xl relative overflow-hidden h-[600px]">
          <div className="absolute top-6 left-6 z-10 glass-panel px-4 py-2 rounded-xl border border-slate-300 flex items-center space-x-2 shadow-lg backdrop-blur-md bg-white/80">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-900 tracking-wider">LIVE GPS TRACKING</span>
          </div>
          <InteractiveMap 
            center={[centerLat, centerLng]} 
            zoom={13} 
            markers={mapMarkers} 
            height="100%"
            trafficLevel={simulatedTrafficLevel}
            surgeMultiplier={simulatedSurge}
          />
        </div>
      </div>

      {/* Right Column: Booking & Driver Details */}
      <div className="lg:col-span-4 flex flex-col space-y-6">
        {/* Status Card */}
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Ride Status</h2>
          <div className={`px-4 py-3 rounded-xl border flex items-center space-x-3 font-bold ${getStatusColor(booking.status)}`}>
            {booking.status === 'COMPLETED' ? <CheckCircle className="w-5 h-5" /> : <Navigation className="w-5 h-5 animate-pulse" />}
            <span className="tracking-wide">{booking.status}</span>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 tracking-wider">PICKUP LOCATION</span>
                <span className="block text-sm text-slate-800 mt-1">{booking.pickupAddress}</span>
              </div>
            </div>
            
            <div className="w-0.5 h-6 bg-slate-100 ml-3"></div>

            <div className="flex items-start space-x-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3 h-3 text-red-500" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 tracking-wider">DROP-OFF LOCATION</span>
                <span className="block text-sm text-slate-800 mt-1">{booking.dropAddress}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Details Card */}
        {booking.driver ? (
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col">
             <h2 className="text-lg font-bold text-slate-900 mb-4">Driver Details</h2>
             <div className="flex items-center space-x-4 mb-5">
               <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-cyan-500 overflow-hidden flex items-center justify-center flex-shrink-0">
                 <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${booking.driver.name}`} alt="Driver Avatar" className="w-full h-full object-cover" />
               </div>
               <div>
                 <h3 className="text-slate-900 font-bold text-lg">{booking.driver.name}</h3>
                 <div className="flex items-center text-slate-500 text-xs mt-1">
                   <span>⭐ 4.8</span>
                   <span className="mx-2">•</span>
                   <span>5,432 Rides</span>
                 </div>
               </div>
             </div>

             {booking.vehicle && (
               <div className="bg-white/80 rounded-xl p-4 border border-slate-200 space-y-3">
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-500 font-bold">VEHICLE</span>
                   <span className="text-sm text-slate-900 font-bold">{booking.vehicle.make} {booking.vehicle.model}</span>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-500 font-bold">LICENSE PLATE</span>
                   <div className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-amber-400 font-mono text-xs font-bold">
                     {booking.vehicle.licensePlate}
                   </div>
                 </div>
                 <div className="flex justify-between items-center">
                   <span className="text-xs text-slate-500 font-bold">COLOR</span>
                   <span className="text-sm text-slate-900 capitalize">{booking.vehicle.color}</span>
                 </div>
               </div>
             )}

             <div className="mt-5 grid grid-cols-2 gap-3">
               <a href={`tel:${booking.driver.phone}`} className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 py-3 rounded-xl transition-colors border border-slate-300">
                 <span className="text-sm font-bold text-slate-900">Call Driver</span>
               </a>
               <button className="flex items-center justify-center space-x-2 bg-cyan-600 hover:bg-cyan-500 py-3 rounded-xl transition-colors shadow-lg shadow-cyan-600/20">
                 <span className="text-sm font-bold text-slate-900">Message</span>
               </button>
             </div>
          </div>
        ) : (
          <div className="glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center justify-center py-10 space-y-4">
             <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 animate-pulse">
                <Clock className="w-8 h-8" />
             </div>
             <h3 className="text-slate-900 font-bold text-center">Assigning a Driver...</h3>
             <p className="text-xs text-slate-500 text-center max-w-[200px]">Searching for the best available driver near your pickup location.</p>
          </div>
        )}

        {/* Security & Support */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-200 shadow-md">
          <div className="flex items-center space-x-3">
            <ShieldAlert className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold text-slate-900">Safe Ride Enabled</span>
          </div>
          <button className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors">
            Share Status
          </button>
        </div>
      </div>
    </div>
  );
}
