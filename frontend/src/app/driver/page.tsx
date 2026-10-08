'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Car, Navigation, CheckCircle, Clock, MapPin, Power, RefreshCw } from 'lucide-react';

interface ActiveRide {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  estimatedFare: number;
  customer: {
    name: string;
    phone: string;
  };
}

export default function DriverPage() {
  const { user, token } = useAppStore();
  const [isOnline, setIsOnline] = useState(true);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch driver assigned active ride
  const fetchDriverState = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/v1/drivers/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.driver) {
        setIsOnline(data.driver.availabilityStatus === 'AVAILABLE');
        if (data.driver.bookings && data.driver.bookings.length > 0) {
          setActiveRide(data.driver.bookings[0]);
        } else {
          setActiveRide(null);
        }
      }
    } catch (err: any) {
      console.error('Driver fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverState();
  }, [token]);

  const handleToggleOnline = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const newStatus = isOnline ? 'OFFLINE' : 'AVAILABLE';
      const res = await fetch(`${apiUrl}/api/v1/drivers/availability`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setIsOnline(newStatus === 'AVAILABLE');
      }
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const handleRideAction = async (action: 'arrive' | 'start' | 'complete') => {
    if (!activeRide) return;
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/v1/drivers/rides/${activeRide.id}/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Ride successfully updated to ${data.booking.status}`);
        fetchDriverState();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err: any) {
      console.error(`Error performing ${action}:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      {/* Header Profile & Online Toggle */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-100 border-2 border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Car className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Driver Portal</h1>
            <p className="text-xs text-slate-500">Manage incoming ride assignments & trip progress</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDriverState}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-300 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={handleToggleOnline}
            className={`flex items-center space-x-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${
              isOnline
                ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-900 shadow-emerald-500/20'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-300'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isOnline ? 'ONLINE (AVAILABLE)' : 'OFFLINE'}</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-100 border border-emerald-500/30 text-emerald-400 rounded-2xl text-sm text-center font-bold">
          {message}
        </div>
      )}

      {/* Active Assignment Card */}
      {activeRide ? (
        <div className="glass-panel p-6 rounded-3xl border-2 border-cyan-500/50 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] font-bold text-cyan-400 tracking-wider uppercase block">CURRENT ASSIGNED RIDE</span>
              <h2 className="text-lg font-bold text-slate-900 mt-0.5">Booking #{activeRide.id.slice(-6)}</h2>
            </div>
            <span className="px-3 py-1 bg-cyan-100 border border-cyan-500/30 text-cyan-400 text-xs font-bold rounded-lg uppercase">
              {activeRide.status}
            </span>
          </div>

          {/* Locations */}
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 tracking-wider">PICKUP CUSTOMER</span>
                <span className="block text-sm text-slate-900 font-medium mt-0.5">{activeRide.pickupAddress}</span>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="mt-1 w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3 h-3 text-red-500" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-500 tracking-wider">DROP OFF</span>
                <span className="block text-sm text-slate-900 font-medium mt-0.5">{activeRide.dropAddress}</span>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white/90 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Customer Details</span>
              <span className="text-sm font-bold text-slate-900">{activeRide.customer.name}</span>
            </div>
            <a
              href={`tel:${activeRide.customer.phone}`}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-cyan-400 font-bold text-xs rounded-xl border border-slate-300 transition-colors"
            >
              Call {activeRide.customer.phone}
            </a>
          </div>

          {/* Workflow Buttons */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => handleRideAction('arrive')}
              disabled={activeRide.status !== 'CONFIRMED'}
              className="py-3 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-slate-900 font-bold text-xs transition-colors flex items-center justify-center space-x-1"
            >
              <Clock className="w-4 h-4" />
              <span>Mark Arrived</span>
            </button>

            <button
              onClick={() => handleRideAction('start')}
              disabled={activeRide.status !== 'ARRIVED'}
              className="py-3 px-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-slate-900 font-bold text-xs transition-colors flex items-center justify-center space-x-1"
            >
              <Navigation className="w-4 h-4" />
              <span>Start Trip</span>
            </button>

            <button
              onClick={() => handleRideAction('complete')}
              disabled={activeRide.status !== 'IN_PROGRESS'}
              className="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-900 font-bold text-xs transition-colors flex items-center justify-center space-x-1"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Trip</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600">
            <Car className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Active Assignments</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            You are currently online and available to receive nearby ride requests. Sit tight!
          </p>
        </div>
      )}
    </div>
  );
}
