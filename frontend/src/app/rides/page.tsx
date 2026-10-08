'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '../../stores/useAppStore';
import { Car, MapPin, Clock, CheckCircle, XCircle, Navigation, RefreshCw, ArrowRight, Bot, Trash2, Ban, AlertTriangle, X } from 'lucide-react';

interface Ride {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  estimatedFare: number;
  finalFare?: number | null;
  distanceKm: number;
  estimatedDurationMinutes: number;
  createdAt: string;
  driver?: {
    user: { name: string };
    vehicle?: { model: string; registrationNumber: string } | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.FC<any>; label: string }> = {
  COMPLETED: { color: 'text-emerald-400 bg-emerald-100 border-emerald-500/30', icon: CheckCircle, label: 'Completed' },
  IN_PROGRESS: { color: 'text-purple-400 bg-purple-100 border-purple-500/30', icon: Navigation, label: 'In Progress' },
  CONFIRMED: { color: 'text-blue-400 bg-blue-100 border-blue-500/30', icon: Clock, label: 'Confirmed' },
  ARRIVED: { color: 'text-cyan-400 bg-cyan-100 border-cyan-500/30', icon: MapPin, label: 'Driver Arrived' },
  PENDING_ASSIGNMENT: { color: 'text-amber-400 bg-amber-100 border-amber-500/30', icon: Clock, label: 'Finding Driver' },
  CANCELLED: { color: 'text-red-400 bg-red-100 border-red-500/30', icon: XCircle, label: 'Cancelled' },
};

export default function RidesPage() {
  const router = useRouter();
  const { token, setActiveBookingId } = useAppStore();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Custom Modal State
  const [activeModal, setActiveModal] = useState<{
    type: 'delete' | 'cancel';
    rideId: string;
    title: string;
    message: string;
  } | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRides = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/api/v1/rides`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRides(data.rides || []);
      }
    } catch (err) {
      console.error('Failed to fetch rides:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, [token]);

  const handleTrack = (ride: Ride) => {
    setActiveBookingId(ride.id);
    router.push('/tracking');
  };

  const handleModify = () => {
    router.push('/assistant');
  };

  const openDeleteModal = (rideId: string) => {
    setActiveModal({
      type: 'delete',
      rideId,
      title: 'Remove Ride History',
      message: 'Are you sure you want to remove this ride from your history? This action cannot be undone.'
    });
  };

  const openCancelModal = (rideId: string) => {
    setActiveModal({
      type: 'cancel',
      rideId,
      title: 'Cancel Ride Booking',
      message: 'Are you sure you want to cancel this active ride? Your driver will be notified immediately.'
    });
  };

  const handleConfirmAction = async () => {
    if (!activeModal) return;
    const { type, rideId } = activeModal;
    setActiveModal(null);
    setActionLoading(rideId);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      if (type === 'cancel') {
        const res = await fetch(`${apiUrl}/api/v1/rides/${rideId}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showToast('Ride booking has been cancelled successfully.');
          await fetchRides();
        } else {
          showToast(data.message || 'Failed to cancel ride');
        }
      } else if (type === 'delete') {
        const res = await fetch(`${apiUrl}/api/v1/rides/${rideId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          showToast('Ride record removed from history.');
          await fetchRides();
        } else {
          showToast(data.message || 'Failed to delete ride');
        }
      }
    } catch (err) {
      console.error('Action error:', err);
      showToast('An unexpected error occurred. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Car className="w-6 h-6 text-cyan-400" />
            <span>My Ride History</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">All your past and current ride bookings</p>
        </div>
        <button
          onClick={fetchRides}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Rides List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : rides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600">
            <Car className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Rides Yet</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Book your first ride by talking to the AI Humanoid Agent.
          </p>
          <button
            onClick={() => router.push('/assistant')}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl transition-colors flex items-center space-x-2"
          >
            <span>Talk to AI Humanoid</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => {
            const statusConf = STATUS_CONFIG[ride.status] || STATUS_CONFIG['COMPLETED'];
            const Icon = statusConf.icon;
            const isActive = ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_ASSIGNMENT'].includes(ride.status);
            const isProcessing = actionLoading === ride.id;

            return (
              <div
                key={ride.id}
                className="glass-panel p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors shadow-md bg-white/80 backdrop-blur-md"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block">BOOKING ID</span>
                    <span className="font-mono text-xs text-slate-700">#{ride.id.slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-bold ${statusConf.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{statusConf.label}</span>
                    </div>
                    <button
                      onClick={() => openDeleteModal(ride.id)}
                      disabled={isProcessing}
                      title="Remove ride history"
                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Route */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-start space-x-2 text-xs">
                    <div className="mt-1 w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{ride.pickupAddress}</span>
                  </div>
                  <div className="ml-1.5 w-0.5 h-4 bg-slate-200" />
                  <div className="flex items-start space-x-2 text-xs">
                    <MapPin className="mt-0.5 w-3 h-3 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700 font-medium">{ride.dropAddress}</span>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3 py-3 border-t border-b border-slate-200 mb-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Distance</span>
                    <span className="block text-xs text-slate-900 font-semibold mt-0.5">{ride.distanceKm} km</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Duration</span>
                    <span className="block text-xs text-slate-900 font-semibold mt-0.5">{ride.estimatedDurationMinutes} min</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Fare</span>
                    <span className="block text-xs text-emerald-600 font-bold mt-0.5">
                      ₹{ride.finalFare ?? ride.estimatedFare}
                    </span>
                  </div>
                </div>

                {/* Driver Info & Actions */}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {ride.driver ? (
                      <>
                        <span className="text-slate-700 font-medium">{ride.driver.user.name}</span>
                        {ride.driver.vehicle && (
                          <span> • {ride.driver.vehicle.model} • <span className="font-mono text-slate-700 font-bold">{ride.driver.vehicle.registrationNumber}</span></span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400 italic">No driver assigned</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {isActive && (
                      <>
                        <button
                          onClick={() => openCancelModal(ride.id)}
                          disabled={isProcessing}
                          className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors shadow-sm"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={handleModify}
                          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-colors"
                        >
                          <Bot className="w-3.5 h-3.5 text-cyan-500" />
                          <span>Manage via AI</span>
                        </button>
                        <button
                          onClick={() => handleTrack(ride)}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-cyan-500/20"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Track Live</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modern Custom Modal Confirmation Popup */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className={`p-3 rounded-2xl ${activeModal.type === 'delete' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                  {activeModal.type === 'delete' ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{activeModal.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Confirmation Required</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Message */}
            <p className="text-sm text-slate-600 leading-relaxed pl-1">
              {activeModal.message}
            </p>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all ${
                  activeModal.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                }`}
              >
                {activeModal.type === 'delete' ? 'Yes, Remove' : 'Yes, Cancel Ride'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
