'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Image from 'next/image';
import { Swords, Shield, Search, X, Zap, Ban } from 'lucide-react';
import {
  Pokemon,
  fetchPokemon,
  fetchPokemonList,
  typeColors,
  typeEffectiveness,
  capitalize,
  getOfficialArtwork,
  extractIdFromUrl,
  POKEMON_LIMIT
} from '@/lib/pokemon-api';

interface TypeRelation {
  type: string;
  multiplier: number;
}

export const TypeMatchupTool = memo(function TypeMatchupTool() {
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; id: number }[]>([]);
  const [allPokemon, setAllPokemon] = useState<{ name: string; id: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    async function loadPokemonList() {
      const list = await fetchPokemonList(POKEMON_LIMIT, 0);
      setAllPokemon(list.results.map((p) => ({
        name: p.name,
        id: extractIdFromUrl(p.url)
      })));
    }
    loadPokemonList();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = allPokemon.filter(p =>
      p.name.includes(query) || p.id.toString() === query
    ).slice(0, 10);

    setSearchResults(results);
  }, [searchQuery, allPokemon]);

  const selectPokemon = useCallback(async (nameOrId: string | number) => {
    setLoading(true);
    setShowSearch(false);
    setSearchQuery('');

    try {
      const pokemon = await fetchPokemon(nameOrId);
      setSelectedPokemon(pokemon);
    } catch (error) {
      console.error('Failed to fetch Pokemon:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateMatchups = useCallback(() => {
    if (!selectedPokemon) return { weaknesses: [], resistances: [], immunities: [], offensive: [] };

    const types = selectedPokemon.types.map(t => t.type.name);
    const damageMultipliers: Record<string, number> = {};
    const offensiveMultipliers: Record<string, number> = {};

    Object.keys(typeColors).forEach(type => {
      damageMultipliers[type] = 1;
      offensiveMultipliers[type] = 1;
    });

    types.forEach(pokemonType => {
      Object.keys(typeColors).forEach(attackingType => {
        const effectiveness = typeEffectiveness[attackingType]?.[pokemonType];
        if (effectiveness !== undefined) {
          damageMultipliers[attackingType] *= effectiveness;
        }
      });

      const offensiveData = typeEffectiveness[pokemonType] || {};
      Object.entries(offensiveData).forEach(([defendingType, multiplier]) => {
        offensiveMultipliers[defendingType] = Math.max(
          offensiveMultipliers[defendingType],
          multiplier
        );
      });
    });

    const weaknesses: TypeRelation[] = [];
    const resistances: TypeRelation[] = [];
    const immunities: TypeRelation[] = [];
    const offensive: TypeRelation[] = [];

    Object.entries(damageMultipliers).forEach(([type, multiplier]) => {
      if (multiplier === 0) {
        immunities.push({ type, multiplier });
      } else if (multiplier > 1) {
        weaknesses.push({ type, multiplier });
      } else if (multiplier < 1) {
        resistances.push({ type, multiplier });
      }
    });

    Object.entries(offensiveMultipliers).forEach(([type, multiplier]) => {
      if (multiplier > 1) {
        offensive.push({ type, multiplier });
      }
    });

    weaknesses.sort((a, b) => b.multiplier - a.multiplier);
    resistances.sort((a, b) => a.multiplier - b.multiplier);
    offensive.sort((a, b) => b.multiplier - a.multiplier);

    return { weaknesses, resistances, immunities, offensive };
  }, [selectedPokemon]);

  const matchups = calculateMatchups();

  return (
    <div className="min-h-screen pt-24 pb-10 px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob-red -top-10 -left-10" />
        <div className="blob-yellow top-0 right-0 w-48 h-48" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl pokemon-logo mb-6 tracking-widest uppercase">
            ANALYZER
          </h1>
          <p className="text-white text-lg font-bold max-w-xl mx-auto uppercase tracking-wider mb-2">
            Type Synergy & Tactics
          </p>
          <p className="text-white/60 text-sm">
            Discover tactical advantages and vulnerabilities for any Pokemon
          </p>
        </div>

        <div className="mb-10 relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-4 px-8 py-5 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 text-white font-black text-xl hover:bg-white/20 transition-all shadow-2xl group"
          >
            <Search className="group-hover:scale-125 transition-transform" size={24} />
            <span className="capitalize">{selectedPokemon ? selectedPokemon.name : 'Target Selection'}</span>
          </button>

          {showSearch && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-4 bg-[#1E3A5F]/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl overflow-hidden z-20 border border-white/10 animate-slide-up">
              <div className="relative p-5 border-b border-white/10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan database..."
                  className="w-full px-6 py-4 rounded-2xl bg-white/5 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-8 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {searchResults.length > 0 ? (
                  searchResults.map((pokemon) => (
                    <button
                      key={pokemon.id}
                      onClick={() => selectPokemon(pokemon.id)}
                      className="w-full flex items-center gap-5 px-6 py-4 hover:bg-white/10 transition-colors text-left group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center p-2 group-hover:bg-white/10 transition-colors">
                        <Image
                          src={getOfficialArtwork(pokemon.id)}
                          alt={pokemon.name}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-black uppercase text-sm tracking-widest">{pokemon.name}</span>
                        <span className="text-white/30 text-xs font-bold">DNA-INDEX #{pokemon.id.toString().padStart(3, '0')}</span>
                      </div>
                      <Swords className="ml-auto text-white/0 group-hover:text-white/20 transition-all" size={18} />
                    </button>
                  ))
                ) : searchQuery ? (
                  <div className="p-10 text-center space-y-4">
                    <p className="text-white/20 font-black uppercase tracking-widest">No Matches Found</p>
                  </div>
                ) : (
                  <div className="p-8">
                    <p className="text-white/30 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Active Files</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Pikachu', id: 25 },
                        { name: 'Charizard', id: 6 },
                        { name: 'Mewtwo', id: 150 },
                        { name: 'Gengar', id: 94 },
                      ].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectPokemon(p.id)}
                          className="px-4 py-2 rounded-xl bg-white/5 text-white text-xs font-black uppercase hover:bg-white/20 transition-colors border border-white/5"
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-16 h-16 animate-spin-slow">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="#EF4444" stroke="#1a1a1a" strokeWidth="4" />
                <rect x="0" y="48" width="100" height="4" fill="#1a1a1a" />
                <path d="M 0 50 A 48 48 0 0 1 100 50" fill="#EF4444" />
                <path d="M 0 50 A 48 48 0 0 0 100 50" fill="#fff" />
                <circle cx="50" cy="50" r="16" fill="#fff" stroke="#1a1a1a" strokeWidth="4" />
              </svg>
            </div>
          </div>
        )}

        {selectedPokemon && !loading && (
          <div className="animate-bounce-in">
            <div
              className="rounded-[2.5rem] p-8 mb-10 shadow-2xl border border-white/20 backdrop-blur-md relative overflow-hidden group"
              style={{ background: `linear-gradient(135deg, ${typeColors[selectedPokemon.types[0]?.type.name || 'normal']}66 0%, #1a1a2e 100%)` }}
            >
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="relative w-48 h-48 animate-float">
                  <div className="absolute inset-0 bg-white/10 rounded-full blur-2xl" />
                  <Image
                    src={getOfficialArtwork(selectedPokemon.id)}
                    alt={selectedPokemon.name}
                    fill
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
                <div className="text-center md:text-left space-y-4">
                  <div>
                    <p className="text-white/40 font-black text-sm tracking-[0.4em] uppercase mb-1">
                      Target #{selectedPokemon.id.toString().padStart(3, '0')}
                    </p>
                    <h2 className="text-5xl md:text-6xl font-black text-white capitalize tracking-tight leading-tight">
                      {selectedPokemon.name}
                    </h2>
                  </div>
                  <div className="flex gap-3 justify-center md:justify-start">
                    {selectedPokemon.types.map(({ type }) => (
                      <span
                        key={type.name}
                        className="px-6 py-2 rounded-xl text-xs font-black text-white uppercase tracking-widest shadow-lg border border-white/20"
                        style={{ backgroundColor: typeColors[type.name] }}
                      >
                        {type.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Weak Against */}
              <div className="bg-red-500/10 backdrop-blur-md rounded-[2.5rem] p-8 border border-red-500/20 group hover:shadow-[0_0_40px_rgba(239,68,68,0.1)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Swords className="text-red-400" size={24} />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Weak Against</h3>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Attacks that deal extra damage</p>
                {matchups.weaknesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.weaknesses.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs border border-white/10 group/pill hover:scale-105 transition-transform"
                        style={{ backgroundColor: `${typeColors[type]}cc` }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className={`px-2 py-1 rounded-lg ${multiplier >= 4 ? 'bg-red-600' : 'bg-black/20'} font-black`}>
                          {multiplier}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/20 text-sm font-black italic">No tactical vulnerabilities detected</p>
                )}
              </div>

              {/* Resistant To */}
              <div className="bg-emerald-500/10 backdrop-blur-md rounded-[2.5rem] p-8 border border-emerald-500/20 group hover:shadow-[0_0_40px_rgba(16,185,129,0.1)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Shield className="text-emerald-400" size={24} />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Resistant To</h3>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Attacks that deal reduced damage</p>
                {matchups.resistances.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.resistances.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs border border-white/10 group/pill hover:scale-105 transition-transform"
                        style={{ backgroundColor: `${typeColors[type]}cc` }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-black/20 px-2 py-1 rounded-lg font-black">{multiplier}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/20 text-sm font-black italic">Standard defensive profile</p>
                )}
              </div>

              {/* Immune To */}
              <div className="bg-blue-500/10 backdrop-blur-md rounded-[2.5rem] p-8 border border-blue-500/20 group hover:shadow-[0_0_40px_rgba(59,130,246,0.1)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Ban className="text-blue-400" size={24} />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Immune To</h3>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Types with zero effect penalty</p>
                {matchups.immunities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.immunities.map(({ type }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs border border-white/10 group/pill hover:scale-105 transition-transform shadow-lg shadow-blue-500/10"
                        style={{ backgroundColor: `${typeColors[type]}cc` }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-blue-600 px-2 py-1 rounded-lg font-black">0x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/20 text-sm font-black italic">Full spectrum vulnerability</p>
                )}
              </div>

              {/* Super Effective Against */}
              <div className="bg-yellow-500/10 backdrop-blur-md rounded-[2.5rem] p-8 border border-yellow-500/20 group hover:shadow-[0_0_40px_rgba(245,158,11,0.1)] transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Zap className="text-yellow-400" size={24} />
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Offensive Edge</h3>
                  </div>
                </div>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Target types you can annihilate</p>
                {matchups.offensive.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.offensive.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs border border-white/10 group/pill hover:scale-105 transition-transform"
                        style={{ backgroundColor: `${typeColors[type]}cc` }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-black/20 px-2 py-1 rounded-lg font-black">{multiplier}x</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/20 text-sm font-black italic">Neutral offensive output</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedPokemon && !loading && (
          <div className="text-center py-16">
            <div className="w-32 h-32 mx-auto mb-6 opacity-40">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4" />
                <circle cx="50" cy="50" r="16" fill="none" stroke="white" strokeWidth="2" />
              </svg>
            </div>
            <p className="text-white/60 text-lg">
              Select a Pokemon above to see its type matchups
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
