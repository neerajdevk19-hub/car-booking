'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bot, Car, MapPin, Clock, ShieldCheck, UserCheck, Languages } from 'lucide-react';
import { useAppStore } from '../../stores/useAppStore';
import { LOCALES } from '../../lib/locales';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { language, setLanguage, user } = useAppStore();
  const t = LOCALES[language].nav;

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'te' : 'en');
  };

  const navItems = [
    { href: '/assistant', label: t.assistant, icon: Bot },
    { href: '/tracking', label: t.tracking, icon: MapPin },
    { href: '/rides', label: t.rides, icon: Clock }
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 border-b border-slate-200 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <Bot className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Ride<span className="text-cyan-400">AI</span></span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                Humanoid OS
              </span>
            </div>
          </Link>

          {/* Nav items */}
          <nav className="hidden md:flex space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Language Switcher & User Profile */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors"
              title="Switch Language (English / Telugu)"
            >
              <Languages className="w-3.5 h-3.5 text-cyan-400" />
              <span>{language === 'en' ? 'తెలుగు' : 'English'}</span>
            </button>

            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-300 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-700 font-medium">{user?.name || 'Rahul Verma'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
