'use client';

import { memo } from 'react';

export const LoadingSpinner = memo(function LoadingSpinner({ message = 'Loading Pokemon...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-4">
      <div className="relative w-12 h-12 animate-pokeball-spin">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="48" fill="#EF4444" stroke="#1a1a1a" strokeWidth="4"/><rect x="0" y="48" width="100" height="4" fill="#1a1a1a"/>
          <path d="M 0 50 A 48 48 0 0 0 100 50" fill="#fff"/><circle cx="50" cy="50" r="14" fill="#fff" stroke="#1a1a1a" strokeWidth="4"/><circle cx="50" cy="50" r="6" fill="#1a1a1a"/>
        </svg>
      </div>
      {message && <p className="text-white/70 text-sm font-medium">{message}</p>}
    </div>
  );
});

export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="rounded-2xl p-3 bg-white/10 animate-pulse">
      <div className="w-full aspect-square rounded-xl bg-white/20 mb-2" />
      <div className="h-4 bg-white/20 rounded-lg mb-2 mx-2" />
      <div className="flex justify-center gap-1.5"><div className="h-5 w-12 bg-white/20 rounded-full" /></div>
    </div>
  );
});

export const GridSkeleton = memo(function GridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  );
});
