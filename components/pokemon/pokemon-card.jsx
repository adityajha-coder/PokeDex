'use client';

import { memo } from 'react';
import Image from 'next/image';
import { capitalize, formatPokemonId, getOfficialArtwork, typeColors, MEGA_EVOLVABLE_IDS, GMAX_CAPABLE_IDS } from '@/lib/pokemon-api';

export const PokemonCard = memo(function PokemonCard({ id, name, types, onClick, isSelected }) {
  const primaryType = types[0]?.type.name || 'normal';
  const bgColor = typeColors[primaryType] || typeColors.normal;
  const hasMega = MEGA_EVOLVABLE_IDS.has(id);
  const hasGmax = GMAX_CAPABLE_IDS.has(id);

  return (
    <button
      onClick={onClick}
      className={`
        relative group w-full rounded-2xl p-3 transition-all duration-150
        hover:scale-105 hover:-translate-y-0.5 cursor-pointer
        ${isSelected ? 'ring-3 ring-white scale-105' : ''}
      `}
      style={{ 
        backgroundColor: bgColor,
        boxShadow: `0 4px 16px ${bgColor}50`
      }}
    >
      {/* Mega/Gmax Badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
        {hasMega && (
          <span className="px-1.5 py-0.5 rounded-md bg-red-500 text-white text-[8px] font-black leading-none shadow-sm border border-white/20 animate-pulse">
            MEGA
          </span>
        )}
        {hasGmax && (
          <span className="px-1.5 py-0.5 rounded-md bg-purple-500 text-white text-[8px] font-black leading-none shadow-sm border border-white/20">
            GMAX
          </span>
        )}
      </div>

      {/* Pokeball Background Pattern */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl opacity-10 pointer-events-none">
        <svg 
          viewBox="0 0 100 100" 
          className="absolute -right-6 -top-6 w-24 h-24 text-white"
        >
          <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="3"/>
          <path d="M 0 50 A 48 48 0 0 1 100 50" fill="none" stroke="currentColor" strokeWidth="3"/>
          <circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" strokeWidth="3"/>
        </svg>
      </div>

      {/* Pokemon ID */}
      <span className="absolute top-2 right-2 text-white/50 font-bold text-xs">
        {formatPokemonId(id)}
      </span>

      {/* Pokemon Image */}
      <div className="relative w-full aspect-square mb-1">
        <Image
          src={getOfficialArtwork(id)}
          alt={name}
          fill
          className="object-contain drop-shadow-lg"
          sizes="(max-width: 640px) 45vw, (max-width: 768px) 30vw, (max-width: 1024px) 23vw, 15vw"
          loading="lazy"
        />
      </div>

      {/* Pokemon Name */}
      <h3 className="text-white font-bold text-sm text-center mb-1.5 capitalize truncate">
        {capitalize(name)}
      </h3>

      {/* Types */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {types.map(({ type }) => (
          <span
            key={type.name}
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/25 text-white"
          >
            {capitalize(type.name)}
          </span>
        ))}
      </div>
    </button>
  );
});
