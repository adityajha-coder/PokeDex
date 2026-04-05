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
  getOfficialArtwork
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
      const list = await fetchPokemonList(151, 0);
      setAllPokemon(list.results.map((p, index) => ({ 
        name: p.name, 
        id: index + 1 
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
          <h1 
            className="text-4xl md:text-6xl font-extrabold text-[#FACC15] mb-4"
            style={{ textShadow: '3px 3px 0 #1E3A5F' }}
          >
            TYPE MATCHUP
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Select a Pokemon to instantly see its strengths and weaknesses against other types!
          </p>
        </div>

        <div className="mb-10 relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#FACC15] text-[#1E3A5F] font-bold text-lg hover:bg-yellow-400 transition-all shadow-lg"
          >
            <Search size={24} />
            {selectedPokemon ? capitalize(selectedPokemon.name) : 'Select a Pokemon'}
          </button>

          {showSearch && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-2 bg-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden z-20 animate-slide-up">
              <div className="relative p-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or ID..."
                  className="w-full px-4 py-3 rounded-xl bg-white/10 text-white placeholder-white/50 outline-none focus:ring-2 focus:ring-[#FACC15]"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((pokemon) => (
                    <button
                      key={pokemon.id}
                      onClick={() => selectPokemon(pokemon.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                    >
                      <Image
                        src={getOfficialArtwork(pokemon.id)}
                        alt={pokemon.name}
                        width={40}
                        height={40}
                        className="rounded-lg bg-white/10"
                      />
                      <span className="text-white font-medium capitalize">
                        {capitalize(pokemon.name)}
                      </span>
                      <span className="text-white/50 text-sm ml-auto">
                        #{pokemon.id.toString().padStart(3, '0')}
                      </span>
                    </button>
                  ))
                ) : searchQuery ? (
                  <p className="text-white/50 text-center py-6">No Pokemon found</p>
                ) : (
                  <div className="p-4">
                    <p className="text-white/50 text-sm mb-3">Popular choices:</p>
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
                          className="px-3 py-1 rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
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
                <circle cx="50" cy="50" r="48" fill="#EF4444" stroke="#1a1a1a" strokeWidth="4"/>
                <rect x="0" y="48" width="100" height="4" fill="#1a1a1a"/>
                <path d="M 0 50 A 48 48 0 0 1 100 50" fill="#EF4444"/>
                <path d="M 0 50 A 48 48 0 0 0 100 50" fill="#fff"/>
                <circle cx="50" cy="50" r="16" fill="#fff" stroke="#1a1a1a" strokeWidth="4"/>
              </svg>
            </div>
          </div>
        )}

        {selectedPokemon && !loading && (
          <div className="animate-bounce-in">
            <div 
              className="rounded-3xl p-6 mb-8 shadow-2xl"
              style={{ backgroundColor: typeColors[selectedPokemon.types[0]?.type.name || 'normal'] }}
            >
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="relative w-48 h-48 animate-float">
                  <Image
                    src={getOfficialArtwork(selectedPokemon.id)}
                    alt={selectedPokemon.name}
                    fill
                    className="object-contain drop-shadow-2xl"
                  />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-white/60 font-bold mb-1">
                    #{selectedPokemon.id.toString().padStart(3, '0')}
                  </p>
                  <h2 className="text-3xl font-bold text-white capitalize mb-3">
                    {capitalize(selectedPokemon.name)}
                  </h2>
                  <div className="flex gap-2 justify-center md:justify-start">
                    {selectedPokemon.types.map(({ type }) => (
                      <span
                        key={type.name}
                        className="px-4 py-2 rounded-full text-sm font-bold bg-white/20 text-white"
                      >
                        {capitalize(type.name)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-red-500/20 rounded-2xl p-6 border border-red-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="text-red-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Weak Against</h3>
                </div>
                {matchups.weaknesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.weaknesses.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-white font-medium text-sm"
                        style={{ backgroundColor: typeColors[type] }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          {multiplier}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60">No weaknesses!</p>
                )}
              </div>

              <div className="bg-green-500/20 rounded-2xl p-6 border border-green-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="text-green-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Resistant To</h3>
                </div>
                {matchups.resistances.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.resistances.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-white font-medium text-sm"
                        style={{ backgroundColor: typeColors[type] }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          {multiplier}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60">No resistances</p>
                )}
              </div>

              {matchups.immunities.length > 0 && (
                <div className="bg-blue-500/20 rounded-2xl p-6 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-4">
                    <Ban className="text-blue-400" size={24} />
                    <h3 className="text-xl font-bold text-white">Immune To</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {matchups.immunities.map(({ type }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-white font-medium text-sm"
                        style={{ backgroundColor: typeColors[type] }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          0x
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-yellow-500/20 rounded-2xl p-6 border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="text-yellow-400" size={24} />
                  <h3 className="text-xl font-bold text-white">Super Effective Against</h3>
                </div>
                {matchups.offensive.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {matchups.offensive.map(({ type, multiplier }) => (
                      <div
                        key={type}
                        className="flex items-center gap-2 px-3 py-2 rounded-full text-white font-medium text-sm"
                        style={{ backgroundColor: typeColors[type] }}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                          {multiplier}x
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/60">No super effective types</p>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedPokemon && !loading && (
          <div className="text-center py-16">
            <div className="w-32 h-32 mx-auto mb-6 opacity-40">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4"/>
                <circle cx="50" cy="50" r="16" fill="none" stroke="white" strokeWidth="2"/>
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
