import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/layout/Navbar';

export const metadata: Metadata = {
  title: 'RideAI — Intelligent Humanoid Ride Booking System',
  description: 'AI Agent for Ride Booking with natural Telugu & English Human-Humanoid interaction, voice-to-text, fare estimation, and driver tracking.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <p>RideAI — Production AI Humanoid Ride Booking Engine • Supports English & Telugu Voice/Text</p>
        </footer>
      </body>
    </html>
  );
}
