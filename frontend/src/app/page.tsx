'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Mic, Car, MapPin, Sparkles, ShieldCheck, ArrowRight, Globe, Zap } from 'lucide-react';
import { HumanoidAvatarCanvas } from '../components/ai/HumanoidAvatarCanvas';
import { useAppStore } from '../stores/useAppStore';
import { LOCALES } from '../lib/locales';

export default function LandingPage() {
  const { language } = useAppStore();
  const t = LOCALES[language];

  return (
    <div className="space-y-16 py-4">
      {/* HERO SECTION */}
      <section className="relative rounded-3xl p-8 sm:p-12 glass-panel overflow-hidden border border-slate-200 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-cyan-100 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-400 text-xs font-semibold tracking-wide">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>Bilingual AI Humanoid Voice Engine (Telugu & English)</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Talk Naturally to your <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">AI Ride Humanoid</span>
            </h1>

            <p className="text-slate-700 text-lg leading-relaxed">
              Experience the next generation of ride booking. Speak or type in <strong className="text-cyan-400">Telugu</strong> or <strong className="text-cyan-400">English</strong> to search cabs, estimate fares, confirm bookings, track drivers live, and manage trips with an intelligent autonomous AI agent.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/assistant"
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-900 font-semibold text-base shadow-lg shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5"
              >
                <Bot className="w-5 h-5" />
                <span>Talk to AI Humanoid</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>


            </div>

            {/* Language badges */}
            <div className="pt-4 flex items-center space-x-4 text-xs text-slate-500">
              <div className="flex items-center space-x-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Native Telugu (te-IN) Support</span>
              </div>
              <span>•</span>
              <div className="flex items-center space-x-1.5">
                <Mic className="w-4 h-4 text-emerald-400" />
                <span>Voice STT & Speech Synthesis</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="w-full max-w-sm rounded-2xl bg-white/90 border border-slate-200 p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
              <HumanoidAvatarCanvas state="idle" width={220} height={220} />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">Interactive AI Avatar</h3>
                <p className="text-xs text-slate-500">
                  Visual states for Listening, Processing, Speaking & Confirming
                </p>
              </div>

              <div className="w-full pt-2">
                <Link
                  href="/assistant"
                  className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 text-sm font-medium transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  <span>Start Voice Interaction</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SAMPLE NATURAL LANGUAGE QUERIES */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Natural Conversational Interaction</h2>
          <p className="text-slate-500 text-sm">No fixed commands required. Speak naturally in Telugu or English.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200 hover:border-cyan-500/50 transition-colors space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              <span>English Workflow</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">EN</span>
            </div>
            <p className="text-slate-800 font-medium text-sm">"Book a cab from my home to Secunderabad station for 6 PM."</p>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <strong className="text-cyan-400">AI Response:</strong> "I found the route. Estimated fare for Go Sedan is ₹320 (~35 mins). Would you like to confirm the booking?"
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200 hover:border-cyan-500/50 transition-colors space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <span>Telugu Workflow</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">TE</span>
            </div>
            <p className="text-slate-800 font-medium text-sm">"నాకు బంజారా హిల్స్ నుండి శంషాబాద్ ఎయిర్‌పోర్ట్‌కు క్యాబ్ కావాలి."</p>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <strong className="text-emerald-400">ఏఐ సమాధానం:</strong> "తప్పకుండా! బంజారా హిల్స్ నుండి శంషాబాద్ ఎయిర్‌పోర్ట్‌కు సెడాన్ ఛార్జీ ~₹650. బుకింగ్‌ను ధృవీకరించాలా?"
            </div>
          </div>
        </div>
      </section>


    </div>
  );
}
