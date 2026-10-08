'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: 'pickup' | 'drop' | 'driver';
  subtitle?: string;
}

interface InteractiveMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  height?: string;
  trafficLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY HIGH';
  surgeMultiplier?: number;
}

// Client-only inner map implementation
const InnerMap = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } = await import('react-leaflet');
    const L = await import('leaflet');

    // Fix default leaflet icons in Next.js
    const createCustomIcon = (type: 'pickup' | 'drop' | 'driver') => {
      let iconColor = '#06b6d4'; // Cyan for pickup
      let emoji = '📍';

      if (type === 'drop') {
        iconColor = '#ef4444'; // Red drop
        emoji = '🏁';
      } else if (type === 'driver') {
        iconColor = '#10b981'; // Green driver
        emoji = '🚕';
      }

      return L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div style="background-color: ${iconColor}; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); border: 2px solid white;">${emoji}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
    };

    function RecenterMap({ center }: { center: [number, number] }) {
      const map = useMap();
      useEffect(() => {
        map.setView(center);
      }, [center, map]);
      return null;
    }

    return function MapComponent({ center = [17.4150, 78.4350], zoom = 12, markers = [], height = '400px', trafficLevel = 'LOW', surgeMultiplier }: InteractiveMapProps) {
      const polylineCoords = markers.map(m => [m.lat, m.lng] as [number, number]);

      let routeColor = '#06b6d4'; // Default cyan
      if (trafficLevel === 'LOW') routeColor = '#10b981'; // Green
      else if (trafficLevel === 'MEDIUM') routeColor = '#f59e0b'; // Amber
      else if (trafficLevel === 'HIGH') routeColor = '#ef4444'; // Red
      else if (trafficLevel === 'VERY HIGH') routeColor = '#9f1239'; // Dark Red

      return (
        <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden border border-slate-300 shadow-xl relative z-0">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMap center={center} />

            {markers.map((m) => (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={createCustomIcon(m.type)}>
                <Popup>
                  <div className="p-1 font-sans text-xs">
                    <strong className="text-slate-900 block text-sm font-bold">{m.title}</strong>
                    {m.subtitle && <span className="text-slate-600 block">{m.subtitle}</span>}
                  </div>
                </Popup>
              </Marker>
            ))}

            {polylineCoords.length > 1 && (
              <Polyline positions={polylineCoords} color={routeColor} weight={5} dashArray="8, 10" />
            )}
          </MapContainer>

          {/* Surge Pricing Badge overlay */}
          {surgeMultiplier && surgeMultiplier > 1.0 && (
            <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-red-500/20 flex flex-col items-end pointer-events-none">
              <div className="flex items-center space-x-2">
                <span className="animate-ping w-2 h-2 rounded-full bg-red-500 block"></span>
                <span className="text-xs font-bold text-red-600 tracking-wider uppercase">High Demand</span>
              </div>
              <span className="text-lg font-black text-slate-900 mt-1">{surgeMultiplier}x Surge</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase mt-1">Traffic Level: {trafficLevel}</span>
            </div>
          )}
        </div>
      );
    }
  },
  { ssr: false }
);

export const InteractiveMap: React.FC<InteractiveMapProps> = (props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ height: props.height || '400px' }} className="w-full rounded-xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-500 text-sm">
        Loading Interactive Map...
      </div>
    );
  }

  return <InnerMap {...props} />;
};
