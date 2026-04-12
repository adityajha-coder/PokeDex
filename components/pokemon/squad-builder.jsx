'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  fetchPokemon,
  fetchPokemonList,
  capitalize,
  typeColors,
  typeEffectiveness,
  getOfficialArtwork,
  formatPokemonId,
  extractIdFromUrl,
  POKEMON_LIMIT
} from '@/lib/pokemon-api';
import { Search, X, Plus, Trash2, Shield, Swords, Zap, AlertTriangle, Star, ChevronRight, Trophy } from 'lucide-react';

// Pokemon stat labels
const STAT_LABELS = { hp: 'HP', attack: 'ATK', defense: 'DEF', 'special-attack': 'SPA', 'special-defense': 'SPD', speed: 'SPE' };

// Calculate actual stat at Level 100 using the official game formula
// Formula: https://bulbapedia.bulbagarden.net/wiki/Stat#Generation_III_onward
// Assumes 31 IVs, 0 EVs, neutral nature (standard competitive baseline)
function calcStat(baseStat, statName, level = 100) {
  const iv = 31;
  const ev = 0;
  if (statName === 'hp') {
    // Shedinja special case
    if (baseStat === 1) return 1;
    return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
  }
  // Other stats: floor(floor(((2*Base + IV + floor(EV/4)) * Level) / 100 + 5) * Nature)
  return Math.floor((Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5) * 1.0);
}

// All 18 types for defensive calculations
const ALL_TYPES = Object.keys(typeColors);

// Defensive type chart: what multiplier does an attack of type X deal to a defender of type Y?
function getDefensiveMultiplier(attackType, defenderType) {
  const eff = typeEffectiveness[attackType];
  if (!eff) return 1;
  return eff[defenderType] !== undefined ? eff[defenderType] : 1;
}

// Get defensive multipliers for a dual-typed Pokemon
function getDualTypeDefense(types) {
  const result = {};
  ALL_TYPES.forEach(atkType => {
    let multiplier = 1;
    types.forEach(defType => {
      multiplier *= getDefensiveMultiplier(atkType, defType);
    });
    result[atkType] = multiplier;
  });
  return result;
}

// Analyze the squad
function analyzeSquad(squad) {
  if (squad.length === 0) return null;

  const teamTypes = new Set();
  squad.forEach(p => p.types.forEach(t => teamTypes.add(t.type.name)));

  // Team-wide defensive weaknesses (types that hit at least one member for 2x+)
  const teamWeaknesses = {};
  const teamResistances = {};
  const teamImmunities = {};
  const uncoveredOffensively = new Set(ALL_TYPES);

  squad.forEach(pokemon => {
    const defTypes = pokemon.types.map(t => t.type.name);
    const defense = getDualTypeDefense(defTypes);

    ALL_TYPES.forEach(atkType => {
      if (defense[atkType] >= 2) {
        teamWeaknesses[atkType] = (teamWeaknesses[atkType] || 0) + 1;
      }
      if (defense[atkType] > 0 && defense[atkType] < 1) {
        teamResistances[atkType] = (teamResistances[atkType] || 0) + 1;
      }
      if (defense[atkType] === 0) {
        teamImmunities[atkType] = (teamImmunities[atkType] || 0) + 1;
      }
    });

    // Offensive coverage: what types can this pokemon's STAB hit super effectively?
    defTypes.forEach(stab => {
      const eff = typeEffectiveness[stab];
      if (eff) {
        Object.entries(eff).forEach(([target, mult]) => {
          if (mult >= 2) uncoveredOffensively.delete(target);
        });
      }
    });
  });

  // Critical weaknesses: types with 3+ weak members and no immune/resist coverage
  const criticalWeaknesses = Object.entries(teamWeaknesses)
    .filter(([type, count]) => count >= 3 && !teamImmunities[type])
    .map(([type]) => type);

  // Shared weaknesses: types with 2+ weak members
  const sharedWeaknesses = Object.entries(teamWeaknesses)
    .filter(([type, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // Strong resistances: types resisted by 3+ members
  const strongResistances = Object.entries(teamResistances)
    .filter(([type, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count }));

  // Immunities on team
  const immunities = Object.entries(teamImmunities).map(([type]) => type);

  // Type coverage: what % of types can be hit super effectively by STAB
  const offensiveCoverage = ((ALL_TYPES.length - uncoveredOffensively.size) / ALL_TYPES.length) * 100;
  const missingCoverage = Array.from(uncoveredOffensively);

  // Base stat totals
  const statTotals = squad.map(p => p.stats.reduce((sum, s) => sum + s.base_stat, 0));
  const avgBST = statTotals.reduce((a, b) => a + b, 0) / squad.length;

  // Type diversity (unique types / 2*members)
  const typeDiversity = teamTypes.size / (squad.length * 2) * 100;

  // Roles: identify if team has walls, sweepers, and pivots
  const roles = squad.map(p => {
    const stats = {};
    p.stats.forEach(s => { stats[s.stat.name] = s.base_stat; });
    const isPhysicalSweeper = stats['attack'] >= 100 && stats['speed'] >= 90;
    const isSpecialSweeper = stats['special-attack'] >= 100 && stats['speed'] >= 90;
    const isPhysicalWall = stats['defense'] >= 100 && stats['hp'] >= 80;
    const isSpecialWall = stats['special-defense'] >= 100 && stats['hp'] >= 80;
    const isTank = stats['hp'] >= 100 && (stats['defense'] >= 80 || stats['special-defense'] >= 80);
    return {
      name: p.name,
      physSweeper: isPhysicalSweeper,
      specSweeper: isSpecialSweeper,
      physWall: isPhysicalWall,
      specWall: isSpecialWall,
      tank: isTank,
    };
  });

  const hasPhysicalSweeper = roles.some(r => r.physSweeper);
  const hasSpecialSweeper = roles.some(r => r.specSweeper);
  const hasPhysicalWall = roles.some(r => r.physWall);
  const hasSpecialWall = roles.some(r => r.specWall);

  // Score calculation (out of 100)
  let score = 50; // base

  // BST bonus (max +15)
  if (avgBST >= 600) score += 15;
  else if (avgBST >= 540) score += 12;
  else if (avgBST >= 480) score += 8;
  else if (avgBST >= 420) score += 4;

  // Offensive coverage bonus (max +20)
  score += (offensiveCoverage / 100) * 20;

  // Type diversity bonus (max +10)
  score += Math.min(10, (typeDiversity / 100) * 15);

  // Weakness penalties
  score -= criticalWeaknesses.length * 5;
  score -= sharedWeaknesses.length * 2;

  // Immunity bonus
  score += immunities.length * 3;

  // Role balance bonus (max +10)
  if (hasPhysicalSweeper) score += 2.5;
  if (hasSpecialSweeper) score += 2.5;
  if (hasPhysicalWall) score += 2.5;
  if (hasSpecialWall) score += 2.5;

  // Full team bonus
  if (squad.length === 6) score += 5;
  else score -= (6 - squad.length) * 3;

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Suggestions
  const suggestions = [];
  if (!hasPhysicalSweeper && !hasSpecialSweeper) {
    suggestions.push({ icon: 'Swords', text: 'Add a fast sweeper (high Attack/Sp.Atk + Speed) for offensive pressure.' });
  }
  if (!hasPhysicalWall && !hasSpecialWall) {
    suggestions.push({ icon: 'Shield', text: 'Add a defensive wall (high HP + Defense or Sp.Def) to absorb hits.' });
  }
  if (criticalWeaknesses.length > 0) {
    suggestions.push({ icon: 'AlertTriangle', text: `Critical weakness to ${criticalWeaknesses.map(capitalize).join(', ')}. Add a resist or immunity.` });
  }
  if (missingCoverage.length > 4) {
    suggestions.push({ icon: 'Zap', text: `Missing super-effective coverage against ${missingCoverage.slice(0, 3).map(capitalize).join(', ')} and more.` });
  }
  if (squad.length < 6) {
    suggestions.push({ icon: 'Plus', text: `Fill your remaining ${6 - squad.length} slot(s) to maximize team synergy.` });
  }
  if (typeDiversity < 40 && squad.length >= 3) {
    suggestions.push({ icon: 'Star', text: 'Low type diversity. Consider adding Pokemon with unique typings.' });
  }

  return {
    score,
    sharedWeaknesses,
    strongResistances,
    immunities,
    criticalWeaknesses,
    offensiveCoverage: Math.round(offensiveCoverage),
    missingCoverage,
    avgBST: Math.round(avgBST),
    typeDiversity: Math.round(typeDiversity),
    suggestions,
    roles,
    teamTypes: Array.from(teamTypes),
  };
}

// Score ring color
function getScoreColor(score) {
  if (score >= 95) return '#0EA5E9'; // Sky Blue
  if (score >= 80) return '#22C55E'; // Green
  if (score >= 60) return '#FACC15'; // Yellow
  return '#EF4444'; // Red
}

function SquadCard({ pokemon, removeFromSquad }) {
  const [isFlipped, setIsFlipped] = useState(false);

  const primaryType = pokemon.types[0]?.type.name || 'normal';
  const bgColor = typeColors[primaryType];
  const bst = pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
  const lv100Stats = pokemon.stats.map(s => ({
    name: s.stat.name,
    base: s.base_stat,
    calc: calcStat(s.base_stat, s.stat.name === 'hp' ? 'hp' : 'other'),
  }));

  const handleFlip = (e) => {
    // Prevent flip if clicking the trash button
    if (e.target.closest('.remove-btn')) return;
    setIsFlipped(!isFlipped);
  };

  return (
    <div 
      className="relative group w-full aspect-[3/5] cursor-pointer animate-fade-in" 
      style={{ perspective: '1000px' }} 
      onClick={handleFlip}
    >
      <div 
        className="w-full h-full relative transition-transform duration-700 pointer-events-none" 
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* FRONT FACE */}
        <div 
          className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden pointer-events-auto flex flex-col"
          style={{ 
            backgroundColor: bgColor, 
            backfaceVisibility: 'hidden',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset' 
          }}
        >
          {/* Top gradient shine */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30 pointer-events-none" />

          {/* Remove Button */}
          <button
            onClick={(e) => { e.stopPropagation(); removeFromSquad(pokemon.id); }}
            className="remove-btn absolute top-3 right-3 z-20 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white/60 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-white/10"
          >
            <Trash2 size={12} />
          </button>

          <div className="flex justify-between items-center px-4 pt-4 relative z-10">
            <span className="text-white/60 text-[11px] font-black tracking-wide">{formatPokemonId(pokemon.id)}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-black/25 backdrop-blur-sm text-white/90 text-[9px] font-black tracking-wider border border-white/10">Lv.100</span>
          </div>

          <div className="relative w-full flex-1 flex items-center justify-center p-3">
             <div className="relative w-full h-full scale-[1.1]">
               <Image src={getOfficialArtwork(pokemon.id)} alt={pokemon.name} fill className="object-contain drop-shadow-[0_15px_25px_rgba(0,0,0,0.4)] pointer-events-none" sizes="(max-width: 640px) 45vw, 15vw" />
             </div>
          </div>

          <div className="relative z-10 bg-black/20 backdrop-blur-md px-3 pb-5 pt-4 flex flex-col items-center justify-center gap-2 border-t border-white/10">
            <h3 className="text-white font-black text-base text-center capitalize truncate w-full drop-shadow-md">{capitalize(pokemon.name)}</h3>
            <div className="flex justify-center gap-1.5 flex-wrap">
              {pokemon.types.map(({ type }) => (
                <span key={type.name} className="px-3 py-1 rounded-full text-[9px] font-black bg-white/20 backdrop-blur-sm text-white uppercase tracking-wider border border-white/10 shadow-sm" style={{ backgroundColor: typeColors[type.name] }}>
                  {type.name}
                </span>
              ))}
            </div>
            <div className="text-white/40 text-[8px] font-black mt-2 tracking-[0.2em] uppercase flex items-center gap-1">
               Tap for Stats
            </div>
          </div>
        </div>

        {/* BACK FACE (Stats) */}
        <div 
          className="absolute inset-0 w-full h-full rounded-3xl overflow-hidden pointer-events-auto flex flex-col"
          style={{ 
            backgroundColor: '#0F172A', // Dark Slate matching theme
            backfaceVisibility: 'hidden', 
            transform: 'rotateY(180deg)',
            boxShadow: `0 15px 40px rgba(0,0,0,0.5), 0 0 0 2px ${bgColor}50 inset`
          }}
        >
           {/* Header banner */}
           <div className="h-12 w-full flex items-center justify-center border-b border-white/10 relative" style={{ backgroundColor: bgColor }}>
              <div className="absolute inset-0 bg-black/20" />
              <span className="relative text-white font-black text-[11px] uppercase tracking-[0.2em] drop-shadow-md">Combat Stats</span>
           </div>
           
           <div className="flex-1 p-4 flex flex-col justify-center gap-3 bg-gradient-to-b from-[#1E3A5F] to-[#0f172a]">
             {lv100Stats.map(s => (
               <div key={s.name} className="flex items-center gap-3">
                 <span className="text-white/50 text-[10px] font-black w-8 text-right uppercase tracking-wider">{STAT_LABELS[s.name]}</span>
                 <div className="flex-1 h-2 bg-black/50 rounded-full overflow-hidden shadow-inner ring-1 ring-white/5">
                   <div
                     className="h-full rounded-full transition-all duration-700 relative"
                     style={{
                       width: `${Math.min(100, (s.calc / 500) * 100)}%`,
                       backgroundColor: s.calc >= 300 ? '#22c55e' : s.calc >= 200 ? '#FACC15' : '#ef4444'
                     }}
                   >
                     <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent" />
                   </div>
                 </div>
                 <span className="text-white font-black text-[11px] w-8">{s.calc}</span>
               </div>
             ))}
             
             <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center px-1">
                <span className="text-white/40 text-[10px] font-black uppercase tracking-widest">Base Stats</span>
                <span className="text-[#FACC15] text-[14px] font-black tracking-tighter drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">{bst}</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

export function SquadBuilder() {
  const [squad, setSquad] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allPokemon, setAllPokemon] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load pokemon list
  useEffect(() => {
    fetchPokemonList(POKEMON_LIMIT, 0).then(data => {
      setAllPokemon(data.results.map(p => ({ name: p.name, id: extractIdFromUrl(p.url) })));
    });
  }, []);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase().replace('#', '');
    return allPokemon
      .filter(p => p.name.includes(q) || p.id.toString() === q || p.id.toString().padStart(3, '0') === q)
      .slice(0, 8);
  }, [searchQuery, allPokemon]);

  const addToSquad = useCallback(async (id) => {
    if (squad.length >= 6) return;
    if (squad.find(p => p.id === id)) return;
    setLoading(true);
    setShowSearch(false);
    setSearchQuery('');
    try {
      const pokemon = await fetchPokemon(id);
      setSquad(prev => [...prev, pokemon]);
    } catch (e) {
      console.error('Failed to add pokemon:', e);
    }
    setLoading(false);
  }, [squad]);

  const removeFromSquad = useCallback((id) => {
    setSquad(prev => prev.filter(p => p.id !== id));
  }, []);

  const analysis = useMemo(() => analyzeSquad(squad), [squad]);

  const SuggestionIcon = ({ name }) => {
    const icons = { Swords, Shield, AlertTriangle, Zap, Plus, Star };
    const Icon = icons[name] || Star;
    return <Icon size={16} />;
  };

  return (
    <div className="min-h-screen pt-20 pb-10 px-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#2563eb] via-[#1E3A5F] to-[#0f172a]" />
      <div className="fixed inset-0 -z-10 opacity-5">
        <div className="absolute top-20 left-10 w-96 h-96 bg-[#FACC15] rounded-full blur-[150px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-[150px]" />
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-black text-[#FACC15] tracking-tight mb-3 drop-shadow-lg">
            MY SQUAD
          </h1>
          <p className="text-white/60 text-sm">Build your dream team of 6 · All Level 100 · Rated by competitive viability</p>
        </div>

        {/* Squad Grid - 6 Slots */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-10">
          {Array.from({ length: 6 }).map((_, idx) => {
            const pokemon = squad[idx];
            
            if (pokemon) {
              return <SquadCard key={pokemon.id} pokemon={pokemon} removeFromSquad={removeFromSquad} />;
            }

            // Empty slot
            return (
              <button
                key={`empty-${idx}`}
                onClick={() => squad.length < 6 && setShowSearch(true)}
                disabled={loading}
                className="rounded-3xl border-2 border-dashed border-white/10 bg-white/[.03] flex flex-col items-center justify-center aspect-[3/5] hover:border-[#FACC15]/40 hover:bg-[#FACC15]/[.03] transition-all duration-300 group backdrop-blur-sm"
              >
                <div className="w-14 h-14 rounded-full bg-white/[.04] border border-white/[.06] flex items-center justify-center mb-3 group-hover:bg-[#FACC15]/10 group-hover:border-[#FACC15]/20 transition-all duration-300">
                  <Plus className="text-white/15 group-hover:text-[#FACC15]/60 transition-colors" size={26} strokeWidth={1.5} />
                </div>
                <span className="text-white/15 text-[9px] font-black uppercase tracking-[0.2em] group-hover:text-[#FACC15]/40 transition-colors">
                  Slot {idx + 1}
                </span>
              </button>
            );
          })}
        </div>

        {/* Add Pokemon Search */}
        {squad.length < 6 && (
          <div className="flex justify-center mb-10 relative">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#FACC15] text-[#1E3A5F] font-bold text-base shadow-xl border border-black/10"
            >
              <Plus size={20} />
              <span>Add Pokemon ({squad.length}/6)</span>
            </button>

            {showSearch && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-4 bg-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden z-30 border border-white/10 animate-slide-up">
                <div className="relative p-4 border-b border-white/10">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Pokemon..."
                    className="w-full px-6 py-4 rounded-xl bg-[#FACC15] text-[#1E3A5F] placeholder-[#1E3A5F]/40 outline-none focus:ring-2 focus:ring-white/30 font-semibold transition-all"
                    autoFocus
                  />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-8 top-1/2 -translate-y-1/2 text-[#1E3A5F]/40 hover:text-[#1E3A5F]"><X size={20} /></button>}
                </div>
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {searchResults.length > 0 ? searchResults.map((p) => {
                    const alreadyAdded = squad.find(s => s.id === p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => !alreadyAdded && addToSquad(p.id)}
                        disabled={alreadyAdded}
                        className={`w-full flex items-center gap-4 px-6 py-4 text-left group border-b border-white/5 last:border-0 transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center p-1">
                          <Image src={getOfficialArtwork(p.id)} alt={p.name} width={32} height={32} className="object-contain" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-white font-bold capitalize text-sm">{p.name}</span>
                          <span className="text-white/30 text-[10px] font-bold">#{p.id.toString().padStart(3, '0')}</span>
                        </div>
                        {alreadyAdded && <span className="ml-auto text-white/30 text-[10px] font-bold uppercase">In Squad</span>}
                      </button>
                    );
                  }) : searchQuery ? (
                    <div className="p-10 text-center">
                      <p className="text-white/30 font-bold text-sm">No Pokemon found</p>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="grid grid-cols-2 gap-3">
                        {[{ name: 'Pikachu', id: 25 }, { name: 'Charizard', id: 6 }, { name: 'Garchomp', id: 445 }, { name: 'Lucario', id: 448 }, { name: 'Gengar', id: 94 }, { name: 'Togekiss', id: 468 }].map((p) => (
                          <button
                            key={p.id}
                            onClick={() => addToSquad(p.id)}
                            disabled={squad.find(s => s.id === p.id)}
                            className="px-4 py-3 rounded-xl bg-white/5 text-white text-xs font-bold hover:bg-[#FACC15] hover:text-[#1E3A5F] transition-all duration-300 border border-white/10 hover:border-[#FACC15] text-center disabled:opacity-30 capitalize"
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
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-10 h-10 border-4 border-[#FACC15]/30 border-t-[#FACC15] rounded-full animate-spin" />
          </div>
        )}

        {/* Analysis Section matching the screenshot */}
        {analysis && squad.length >= 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in mt-12 mb-10">
            
            {/* 1. Squad Rating Card */}
            <div className="bg-[#2B61FA] rounded-[32px] p-8 flex flex-col items-center justify-center border-2 border-[#3F7CFF]/30 shadow-2xl relative overflow-hidden">
              <div className="relative w-48 h-48 mb-8 mt-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="46" fill="none"
                    stroke={getScoreColor(analysis.score)}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${(analysis.score / 100) * 289.026} 289.026`}
                    className="transition-all duration-1000 ease-out"
                    style={{ filter: `drop-shadow(0 0 10px ${getScoreColor(analysis.score)}80)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[3.5rem] font-black leading-none tracking-tighter" style={{ color: getScoreColor(analysis.score) }}>
                    {analysis.score}
                  </span>
                  <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em] mt-1">/ 100</span>
                </div>
              </div>
              <h3 className="text-white text-xl font-black mb-2">Squad Rating</h3>
              <p className="text-white/50 text-sm text-center">
                {analysis.score >= 80 ? 'Championship caliber team!' : analysis.score >= 60 ? 'Competitive ready with good balance.' : 'Decent team. Needs refinement.'}
              </p>
            </div>

            {/* 2. Team Stats Card */}
            <div className="bg-[#2B61FA] rounded-[32px] p-8 border-2 border-[#3F7CFF]/30 shadow-2xl flex flex-col">
              <h3 className="text-white font-black text-lg flex items-center gap-3 mb-8">
                <Trophy size={20} className="text-[#FFD600]" />
                Team Stats
              </h3>

              <div className="space-y-6 flex-1">
                {[
                  { label: 'Avg. BST', value: analysis.avgBST, max: 720, color: '#FFD600' },
                  { label: 'Offensive Coverage', value: analysis.offensiveCoverage, max: 100, color: '#FF7A00', suffix: '%' },
                  { label: 'Type Diversity', value: analysis.typeDiversity, max: 100, color: '#FFD600', suffix: '%' },
                ].map((stat, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-sm font-bold">{stat.label}</span>
                      <span className="text-white font-black text-base">{stat.value}{stat.suffix || ''}</span>
                    </div>
                    <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(stat.value / stat.max) * 100}%`, backgroundColor: stat.color }} />
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center py-2 border-y border-white/10 mt-6">
                  <span className="text-white/80 text-sm font-bold">Squad</span>
                  <span className="text-white font-black text-base">{squad.length}/6</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {analysis.teamTypes.map(type => (
                    <span key={type} className="px-4 py-1.5 rounded-full text-[9px] font-black text-white uppercase tracking-widest bg-[#FFD600] text-[#1E3A5F] border-none shadow-md">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Suggestions Card */}
            <div className="bg-[#2B61FA] rounded-[32px] p-8 border-2 border-[#3F7CFF]/30 shadow-2xl flex flex-col h-full">
              <h3 className="text-white font-black text-lg flex items-center gap-3 mb-6">
                <Zap size={20} className="text-white" />
                Suggestions
              </h3>
              
              <div className="space-y-4 overflow-y-auto flex-1 custom-scrollbar pr-2 h-full max-h-[300px]">
                {analysis.suggestions.length > 0 ? (
                  analysis.suggestions.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[#3B70FF] border border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
                      <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center flex-shrink-0">
                        <SuggestionIcon name={s.icon} />
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed font-medium">{s.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-60">
                    <Star className="text-[#FFD600] mb-4" size={40} />
                    <p className="text-white font-bold text-center text-lg">Perfectly Balanced!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {squad.length === 0 && !loading && (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                <Swords className="text-white/15" size={28} strokeWidth={1} />
              </div>
            </div>
            <h3 className="text-white text-lg font-bold mb-2">Your Squad is Empty</h3>
            <p className="text-white/30 text-xs max-w-sm mx-auto">
              Add up to 6 Pokemon to build your dream team. Each will be rated at Level 100 with competitive analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
