'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { Users, Car, Navigation, DollarSign, Bot, Activity, RefreshCw, CheckCircle, Clock } from 'lucide-react';

interface Stats {
  totalCustomers: number;
  totalDrivers: number;
  activeDrivers: number;
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenue: number;
}

interface RecentBooking {
  id: string;
  pickupAddress: string;
  dropAddress: string;
  estimatedFare: number;
  status: string;
  createdAt: string;
  customer: { name: string; email: string };
  driver?: { user: { name: string } } | null;
}

interface AIActionLog {
  id: string;
  intent: string;
  actionTaken: string;
  status: string;
  createdAt: string;
  user: { name: string; email: string };
}

export default function AdminDashboardPage() {
  const { token } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [aiLogs, setAiLogs] = useState<AIActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      
      const statsRes = await fetch(`${apiUrl}/api/v1/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
        setRecentBookings(statsData.recentBookings || []);
      }

      const logsRes = await fetch(`${apiUrl}/api/v1/admin/ai-action-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const logsData = await logsRes.json();
      if (logsData.success) {
        setAiLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  return (
    <div className="max-w-7xl mx-auto py-6 space-y-8">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center space-x-2">
            <Activity className="w-6 h-6 text-cyan-400" />
            <span>Admin Control Panel</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Real-time stats, AI Humanoid audit logs & fleet management</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-cyan-100 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Total Customers</span>
            <span className="text-2xl font-black text-slate-900">{stats ? stats.totalCustomers : '-'}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Active Fleet Drivers</span>
            <span className="text-2xl font-black text-slate-900">{stats ? `${stats.activeDrivers} / ${stats.totalDrivers}` : '-'}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Ongoing / Total Rides</span>
            <span className="text-2xl font-black text-slate-900">{stats ? `${stats.activeBookings} / ${stats.totalBookings}` : '-'}</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-200 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold block uppercase tracking-wider">Total Gross Revenue</span>
            <span className="text-2xl font-black text-emerald-400">₹{stats ? stats.revenue : 0}</span>
          </div>
        </div>
      </div>

      {/* Grid: AI Action Audit Logs & Recent Rides */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* AI Action Audit Log */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-4">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900">AI Humanoid Audit Logs</h2>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {aiLogs.length > 0 ? (
              aiLogs.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-400 uppercase tracking-wide">{log.intent}</span>
                    <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-700 text-xs font-mono bg-slate-50 p-2 rounded border border-slate-200/80">
                    {log.actionTaken}
                  </p>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                    <span>User: {log.user.name} ({log.user.email})</span>
                    <span className="text-emerald-400 font-bold">{log.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">No AI actions logged yet.</div>
            )}
          </div>
        </div>

        {/* Recent Rides Table */}
        <div className="lg:col-span-6 glass-panel p-6 rounded-3xl border border-slate-200 shadow-xl flex flex-col space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-4">
            <Car className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-slate-900">Recent System Rides</h2>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {recentBookings.length > 0 ? (
              recentBookings.map((ride) => (
                <div key={ride.id} className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{ride.customer.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-cyan-400 font-bold text-[10px]">
                      {ride.status}
                    </span>
                  </div>
                  <div className="text-slate-500 space-y-0.5 text-[11px]">
                    <div className="truncate">📍 Pickup: <span className="text-slate-800">{ride.pickupAddress}</span></div>
                    <div className="truncate">🏁 Drop: <span className="text-slate-800">{ride.dropAddress}</span></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] border-t border-slate-200/60 pt-2">
                    <span className="text-slate-500">Driver: {ride.driver?.user.name || 'Unassigned'}</span>
                    <span className="text-emerald-400 font-bold">₹{ride.estimatedFare}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">No recent rides found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
