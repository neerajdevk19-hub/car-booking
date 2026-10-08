'use client';

import React, { useEffect, useRef } from 'react';

export type AvatarState = 'idle' | 'listening' | 'processing' | 'speaking' | 'awaiting_confirmation' | 'error';

interface HumanoidAvatarCanvasProps {
  state: AvatarState;
  height?: number;
  width?: number;
}

export const HumanoidAvatarCanvas: React.FC<HumanoidAvatarCanvasProps> = ({
  state,
  width = 300,
  height = 300
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let tick = 0;

    const render = () => {
      tick += 0.05;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = width * 0.25;

      // Color scheme according to avatar state
      let mainColor = '#06b6d4'; // Cyan default
      let glowColor = 'rgba(6, 182, 212, 0.4)';

      if (state === 'listening') {
        mainColor = '#10b981'; // Emerald Green
        glowColor = 'rgba(16, 185, 129, 0.5)';
      } else if (state === 'processing') {
        mainColor = '#a855f7'; // Purple
        glowColor = 'rgba(168, 85, 247, 0.5)';
      } else if (state === 'speaking') {
        mainColor = '#3b82f6'; // Electric Blue
        glowColor = 'rgba(59, 130, 246, 0.6)';
      } else if (state === 'awaiting_confirmation') {
        mainColor = '#f59e0b'; // Amber Gold
        glowColor = 'rgba(245, 158, 11, 0.6)';
      } else if (state === 'error') {
        mainColor = '#ef4444'; // Red
        glowColor = 'rgba(239, 68, 68, 0.6)';
      }

      // 1. Draw Outer Pulsing Rings
      const ringCount = state === 'listening' || state === 'speaking' ? 4 : 2;
      for (let i = 0; i < ringCount; i++) {
        const ringRadius = baseRadius + Math.sin(tick + i * 0.8) * 15 + i * 18;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = glowColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 2. Draw Soundwave Frequency Bars (if speaking or listening)
      if (state === 'speaking' || state === 'listening') {
        const barCount = 16;
        for (let i = 0; i < barCount; i++) {
          const angle = (i / barCount) * Math.PI * 2;
          const barLength = Math.abs(Math.sin(tick * 3 + i)) * 30 + 10;
          const x1 = centerX + Math.cos(angle) * (baseRadius + 5);
          const y1 = centerY + Math.sin(angle) * (baseRadius + 5);
          const x2 = centerX + Math.cos(angle) * (baseRadius + 5 + barLength);
          const y2 = centerY + Math.sin(angle) * (baseRadius + 5 + barLength);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // Inner sphere and visor rendering removed in favor of HTML image overlay

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, width, height]);

  const borderColor = state === 'listening' ? '#10b981' : state === 'speaking' ? '#3b82f6' : state === 'processing' ? '#a855f7' : state === 'awaiting_confirmation' ? '#f59e0b' : state === 'error' ? '#ef4444' : '#06b6d4';

  return (
    <div className="relative flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="drop-shadow-2xl transition-all duration-300"
        />
        <img 
          src="/ai-avatar.png" 
          alt="AI Humanoid"
          className="absolute rounded-full object-cover border-4 shadow-xl z-10 transition-all duration-300"
          style={{ 
            width: width * 0.5, 
            height: height * 0.5,
            borderColor,
            boxShadow: `0 0 20px ${borderColor}55`
          }}
          onError={(e) => {
            // Fallback: hide broken image and show SVG bot instead
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const sibling = target.nextSibling as HTMLElement;
            if (sibling) sibling.style.display = 'flex';
          }}
        />
        {/* Fallback SVG bot face (shown only if image fails) */}
        <div
          className="absolute rounded-full border-4 z-10 items-center justify-center bg-gradient-to-b from-slate-100 to-slate-300 transition-all duration-300"
          style={{ 
            width: width * 0.5, 
            height: height * 0.5,
            borderColor,
            boxShadow: `0 0 20px ${borderColor}55`,
            display: 'none'
          }}
        >
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '80%', height: '80%' }}>
            {/* Head */}
            <rect x="25" y="20" width="50" height="55" rx="12" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="2"/>
            {/* Antenna */}
            <line x1="50" y1="20" x2="50" y2="10" stroke="#94a3b8" strokeWidth="2"/>
            <circle cx="50" cy="8" r="3" fill="#06b6d4"/>
            {/* Eyes */}
            <rect x="32" y="35" width="14" height="10" rx="3" fill="#06b6d4" opacity="0.9"/>
            <rect x="54" y="35" width="14" height="10" rx="3" fill="#06b6d4" opacity="0.9"/>
            {/* Eye shine */}
            <circle cx="38" cy="38" r="2" fill="white" opacity="0.7"/>
            <circle cx="60" cy="38" r="2" fill="white" opacity="0.7"/>
            {/* Mouth display */}
            <rect x="35" y="55" width="30" height="8" rx="4" fill="#1e293b"/>
            <rect x="38" y="57" width="5" height="4" rx="1" fill="#06b6d4" opacity="0.8"/>
            <rect x="46" y="57" width="5" height="4" rx="1" fill="#06b6d4" opacity="0.8"/>
            <rect x="54" y="57" width="5" height="4" rx="1" fill="#06b6d4" opacity="0.8"/>
            {/* Ears/headphone cups */}
            <rect x="17" y="35" width="10" height="20" rx="5" fill="#94a3b8"/>
            <rect x="73" y="35" width="10" height="20" rx="5" fill="#94a3b8"/>
            {/* Headphone band */}
            <path d="M22 35 Q50 10 78 35" stroke="#64748b" strokeWidth="4" fill="none" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
      <div className="mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/80 border border-slate-300 text-slate-800">
        Status: <span style={{ color: borderColor }}>{state.replace('_', ' ')}</span>
      </div>
    </div>
  );
};
