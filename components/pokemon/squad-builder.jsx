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
  const hasTank = roles.some(r => r.tank);

  // ============================================
  // COMPREHENSIVE SCORING SYSTEM (out of 100)
  // ============================================
  let score = 0;

  // --- 1. RAW POWER / BST (max 20 points) ---
  // Competitive viable BST is typically 480+. Legendaries sit at 580-720.
  // Score each member individually then average
  const bstScores = statTotals.map(bst => {
    if (bst >= 600) return 20;      // Pseudo-legendary / Legendary tier
    if (bst >= 530) return 17;      // Strong competitive (Garchomp, Gengar)
    if (bst >= 480) return 14;      // Solid competitive (Toxapex, Clefable)
    if (bst >= 420) return 10;      // Viable with niche (Azumarill, Quagsire)
    if (bst >= 350) return 6;       // NFE / weak (Pikachu, Eviolite users)
    return 3;                        // Very weak / unevolved
  });
  score += bstScores.reduce((a, b) => a + b, 0) / squad.length;

  // --- 2. TYPE SYNERGY (max 25 points) ---
  let typeSynergyScore = 25;

  // Penalty for critical weaknesses (3+ members weak to same type)
  typeSynergyScore -= criticalWeaknesses.length * 6;

  // Penalty for shared weaknesses (2+ members)
  const nonCritShared = sharedWeaknesses.filter(w => w.count < 3);
  typeSynergyScore -= nonCritShared.length * 1.5;

  // Bonus for immunities (huge defensive advantage)
  typeSynergyScore += Math.min(6, immunities.length * 2);

  // Bonus for strong resistances
  typeSynergyScore += Math.min(4, strongResistances.length * 0.8);

  // Bonus for type diversity
  if (typeDiversity >= 80) typeSynergyScore += 3;
  else if (typeDiversity >= 60) typeSynergyScore += 2;
  else if (typeDiversity >= 40) typeSynergyScore += 1;
  else typeSynergyScore -= 2; // Penalty for very low diversity

  // Type redundancy penalty
  const typeCountMap = {};
  squad.forEach(p => p.types.forEach(t => { typeCountMap[t.type.name] = (typeCountMap[t.type.name] || 0) + 1; }));
  Object.values(typeCountMap).forEach(count => {
    if (count >= 4) typeSynergyScore -= 4;
    else if (count >= 3) typeSynergyScore -= 2;
  });

  score += Math.max(0, Math.min(25, typeSynergyScore));

  // --- 3. EVOLUTION STAGE (max 15 points) ---
  // Use base_experience as a proxy: fully evolved Pokemon typically have 200+ base exp
  // NFE (Not Fully Evolved) typically have <200
  const evoScores = squad.map(p => {
    const bst = p.stats.reduce((sum, s) => sum + s.base_stat, 0);
    const baseExp = p.base_experience || 0;

    // Mega/Gmax forms have high base exp
    if (baseExp >= 300 || bst >= 600) return 15;   // Legendary/Mega tier
    if (baseExp >= 220 || bst >= 500) return 14;    // Fully evolved strong
    if (baseExp >= 170 || bst >= 450) return 12;    // Fully evolved standard
    if (baseExp >= 140 || bst >= 400) return 9;     // Mid-stage or weak final
    if (baseExp >= 80 || bst >= 300) return 5;      // First evolution
    return 2;                                         // Basic unevolved
  });
  score += evoScores.reduce((a, b) => a + b, 0) / squad.length;

  // --- 4. OFFENSIVE COVERAGE (max 15 points) ---
  // How many of the 18 types can the team hit super-effectively via STAB?
  const coveragePercent = offensiveCoverage;
  if (coveragePercent >= 90) score += 15;
  else if (coveragePercent >= 75) score += 12;
  else if (coveragePercent >= 60) score += 9;
  else if (coveragePercent >= 40) score += 6;
  else score += 3;

  // --- 5. ROLE BALANCE (max 15 points) ---
  let roleScore = 0;

  // Offensive roles (max 6)
  if (hasPhysicalSweeper && hasSpecialSweeper) roleScore += 6;  // Both attack types covered
  else if (hasPhysicalSweeper || hasSpecialSweeper) roleScore += 3;

  // Defensive roles (max 5)
  if (hasPhysicalWall && hasSpecialWall) roleScore += 5;
  else if (hasPhysicalWall || hasSpecialWall || hasTank) roleScore += 3;

  // Speed control (max 4)
  const speedValues = squad.map(p => p.stats.find(s => s.stat.name === 'speed')?.base_stat || 0);
  const hasFast = speedValues.some(s => s >= 100);
  const hasSlow = speedValues.some(s => s <= 50);
  const hasModerate = speedValues.some(s => s >= 70 && s < 100);
  if (hasFast && (hasModerate || hasSlow)) roleScore += 4;   // Good speed tiers
  else if (hasFast) roleScore += 2;
  else roleScore += 0; // No speed control

  score += roleScore;

  // --- 6. TEAM COMPOSITION (max 10 points) ---
  let compScore = 0;

  // Full team bonus
  if (squad.length === 6) compScore += 5;
  else if (squad.length >= 4) compScore += 2;
  else compScore -= 2;

  // Stat spread quality: team should have balanced total stats
  const teamStatSums = { hp: 0, attack: 0, defense: 0, 'special-attack': 0, 'special-defense': 0, speed: 0 };
  squad.forEach(p => p.stats.forEach(s => { teamStatSums[s.stat.name] += s.base_stat; }));
  const statValues = Object.values(teamStatSums);
  const avgStatSum = statValues.reduce((a, b) => a + b, 0) / 6;
  const statVariance = statValues.reduce((sum, v) => sum + Math.pow(v - avgStatSum, 2), 0) / 6;
  const statCV = Math.sqrt(statVariance) / avgStatSum; // Coefficient of variation
  // Lower CV = more balanced. Competitive teams typically have CV < 0.3
  if (statCV < 0.15) compScore += 5;       // Extremely balanced
  else if (statCV < 0.25) compScore += 4;  // Well balanced
  else if (statCV < 0.35) compScore += 2;  // Decent
  else compScore += 0;                      // Lopsided

  score += Math.max(0, compScore);

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Suggestions — prioritized by competitive impact
  const suggestions = [];

  // 1. Critical weakness alerts (most important)
  if (criticalWeaknesses.length > 0) {
    const weakTypes = criticalWeaknesses.map(capitalize).join(', ');
    // Suggest specific types that resist these weaknesses
    const counterSuggestions = {
      ground: 'Flying or Levitate user',
      ice: 'Fire, Steel, or Water type',
      fire: 'Water, Rock, or Dragon type',
      water: 'Water Absorb or Grass type',
      electric: 'Ground type (immune)',
      fairy: 'Steel or Poison type',
      fighting: 'Ghost type (immune) or Psychic type',
      rock: 'Steel or Fighting type',
      dark: 'Fairy or Fighting type',
      psychic: 'Dark type (immune) or Steel type',
      ghost: 'Normal type (immune) or Dark type',
      dragon: 'Fairy type (immune) or Steel type',
      steel: 'Fire or Fighting type',
      poison: 'Steel type (immune) or Ground type',
      flying: 'Electric, Rock, or Steel type',
      bug: 'Fire, Flying, or Rock type',
      grass: 'Fire, Poison, or Flying type',
      normal: 'Ghost type (immune) or Steel type',
    };
    const fixes = criticalWeaknesses.map(t => counterSuggestions[t]).filter(Boolean).slice(0, 2);
    suggestions.push({ 
      icon: 'AlertTriangle', 
      text: `Critical team weakness to ${weakTypes}! ${fixes.length ? `Add a ${fixes.join(' or ')} to patch this.` : 'Add a resist or immunity.'}`
    });
  }

  // 2. Speed tier analysis
  const speedStats = squad.map(p => p.stats.find(s => s.stat.name === 'speed')?.base_stat || 0);
  const fastMons = speedStats.filter(s => s >= 100).length;
  const slowMons = speedStats.filter(s => s < 60).length;
  if (fastMons === 0 && squad.length >= 2) {
    suggestions.push({ icon: 'Zap', text: 'No fast Pokémon (100+ Speed). You risk being outsped by sweepers. Add a Speed threat like Greninja, Dragapult, or Weavile.' });
  } else if (slowMons === squad.length && squad.length >= 3) {
    suggestions.push({ icon: 'Zap', text: 'Entire team is slow (<60 Speed). Consider a Trick Room setter or add faster Pokémon for offensive pressure.' });
  }

  // 3. Physical vs Special balance
  const physAttackers = squad.filter(p => {
    const atk = p.stats.find(s => s.stat.name === 'attack')?.base_stat || 0;
    return atk >= 90;
  }).length;
  const specAttackers = squad.filter(p => {
    const spa = p.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 0;
    return spa >= 90;
  }).length;
  if (physAttackers > 0 && specAttackers === 0 && squad.length >= 3) {
    suggestions.push({ icon: 'Swords', text: 'All attackers are physical. Add a special attacker to break through physical walls like Skarmory or Ferrothorn.' });
  } else if (specAttackers > 0 && physAttackers === 0 && squad.length >= 3) {
    suggestions.push({ icon: 'Swords', text: 'All attackers are special. Add a physical attacker to pressure special walls like Blissey or Chansey.' });
  }

  // 4. Missing defensive roles
  if (!hasPhysicalWall && !hasSpecialWall && squad.length >= 2) {
    suggestions.push({ icon: 'Shield', text: 'No dedicated wall. Add a bulky Pokémon (high HP + Def/SpDef) like Toxapex, Ferrothorn, or Blissey to absorb hits.' });
  } else if (hasPhysicalWall && !hasSpecialWall && squad.length >= 3) {
    suggestions.push({ icon: 'Shield', text: 'No special wall. Your team struggles vs special attackers. Consider Blissey, Chansey, or Assault Vest users.' });
  } else if (!hasPhysicalWall && hasSpecialWall && squad.length >= 3) {
    suggestions.push({ icon: 'Shield', text: 'No physical wall. Physical sweepers will break through. Consider Skarmory, Ferrothorn, or Hippowdon.' });
  }

  // 5. Offensive coverage gaps (specific types)
  if (missingCoverage.length > 0 && missingCoverage.length <= 6) {
    suggestions.push({ icon: 'Zap', text: `Can't hit ${missingCoverage.map(capitalize).join(', ')} super-effectively. Add Pokémon with ${missingCoverage.slice(0,2).map(t => {
      const counters = { normal: 'Fighting', fire: 'Water/Ground', water: 'Electric/Grass', electric: 'Ground', grass: 'Fire/Ice', ice: 'Fire/Fighting', fighting: 'Psychic/Flying', poison: 'Ground/Psychic', ground: 'Water/Grass', flying: 'Electric/Rock', psychic: 'Dark/Ghost', bug: 'Fire/Rock', rock: 'Water/Fighting', ghost: 'Dark/Ghost', dragon: 'Ice/Fairy', dark: 'Fighting/Fairy', steel: 'Fire/Fighting', fairy: 'Steel/Poison' };
      return counters[t] || t;
    }).join(' or ')} coverage.` });
  } else if (missingCoverage.length > 6) {
    suggestions.push({ icon: 'Zap', text: `Missing coverage against ${missingCoverage.length} types. Add Pokémon with diverse STAB typings like Dragon/Fairy, Ground/Ice, or Fire/Fighting.` });
  }

  // 6. Type redundancy check
  const typeCount = {};
  squad.forEach(p => p.types.forEach(t => { typeCount[t.type.name] = (typeCount[t.type.name] || 0) + 1; }));
  const redundantTypes = Object.entries(typeCount).filter(([, count]) => count >= 3).map(([type]) => type);
  if (redundantTypes.length > 0 && squad.length >= 4) {
    suggestions.push({ icon: 'Star', text: `${redundantTypes.map(capitalize).join(', ')} type is overrepresented (${typeCount[redundantTypes[0]]}× members). This stacks shared weaknesses. Diversify your typings.` });
  }

  // 7. Incomplete team reminder
  if (squad.length < 6) {
    suggestions.push({ icon: 'Plus', text: `Fill your remaining ${6 - squad.length} slot(s) to maximize team synergy and score.` });
  }

  // 8. Low diversity warning
  if (typeDiversity < 30 && squad.length >= 4) {
    suggestions.push({ icon: 'Star', text: 'Very low type diversity. Your team shares too many types, making it predictable. Add unique typings like Steel/Fairy, Ghost/Dark, or Poison/Ground.' });
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
  if (score >= 60) return '#F97316'; // Orange (visible on yellow bg)
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
            backgroundColor: '#FACC15',
            backfaceVisibility: 'hidden', 
            transform: 'rotateY(180deg)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}
        >
           {/* Header banner */}
           <div className="h-10 w-full flex items-center justify-center border-b border-[#1E3A5F]/10 relative bg-[#1E3A5F]">
              <span className="relative text-[#FACC15] font-black text-[10px] uppercase tracking-[0.25em]">Combat Stats</span>
           </div>
           
           <div className="flex-1 p-4 flex flex-col justify-center gap-2.5">
             {lv100Stats.map(s => (
               <div key={s.name} className="flex items-center gap-2.5">
                 <span className="text-[#1E3A5F]/50 text-[9px] font-black w-7 text-right uppercase tracking-wider">{STAT_LABELS[s.name]}</span>
                 <div className="flex-1 h-1.5 bg-[#1E3A5F]/10 rounded-full overflow-hidden">
                   <div
                     className="h-full rounded-full transition-all duration-700"
                     style={{
                       width: `${Math.min(100, (s.calc / 500) * 100)}%`,
                       backgroundColor: s.calc >= 300 ? '#22c55e' : s.calc >= 200 ? '#3B82F6' : '#ef4444'
                     }}
                   />
                 </div>
                 <span className="text-[#1E3A5F] font-black text-[11px] w-7">{s.calc}</span>
               </div>
             ))}
             
             <div className="mt-3 pt-3 border-t border-[#1E3A5F]/10 flex justify-between items-center px-1">
                <span className="text-[#1E3A5F]/40 text-[9px] font-black uppercase tracking-widest">Base Stats</span>
                <span className="text-[#1E3A5F] text-[14px] font-black tracking-tighter">{bst}</span>
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

  // Load squad from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('pokefinder_squad');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        if (ids.length > 0) {
          setLoading(true);
          Promise.all(ids.map(id => fetchPokemon(id)))
            .then(data => setSquad(data.filter(Boolean)))
            .finally(() => setLoading(false));
        }
      } catch(e){}
    }
  }, []);

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
      setSquad(prev => {
        const next = [...prev, pokemon];
        localStorage.setItem('pokefinder_squad', JSON.stringify(next.map(p => p.id)));
        return next;
      });
    } catch (e) {
      console.error('Failed to add pokemon:', e);
    }
    setLoading(false);
  }, [squad]);

  const removeFromSquad = useCallback((id) => {
    setSquad(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem('pokefinder_squad', JSON.stringify(next.map(p => p.id)));
      return next;
    });
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
            <div className="bg-[#FACC15] rounded-[2.5rem] p-6 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden border-t-4 border-t-[#0EA5E9] group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(14,165,233,0.15)]">
              <div className="relative w-36 h-36 mb-4 mt-2">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(30,58,95,0.08)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="46" fill="none"
                    stroke={getScoreColor(analysis.score)}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(analysis.score / 100) * 289.026} 289.026`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black leading-none tracking-tighter" style={{ color: getScoreColor(analysis.score) }}>
                    {analysis.score}
                  </span>
                  <span className="text-[#1E3A5F]/30 text-[8px] font-black uppercase tracking-[0.2em] mt-1">/ 100</span>
                </div>
              </div>
              <h3 className="text-[#1E3A5F] text-base font-black mb-1 uppercase tracking-tight">Squad Rating</h3>
              <p className="text-[#1E3A5F]/50 text-[9px] font-bold uppercase tracking-[0.15em] text-center">
                {analysis.score >= 80 ? 'Championship caliber team!' : analysis.score >= 60 ? 'Competitive ready with good balance.' : 'Decent team. Needs refinement.'}
              </p>
            </div>

            {/* 2. Team Stats Card */}
            <div className="bg-[#FACC15] rounded-[2.5rem] p-6 shadow-2xl flex flex-col border-t-4 border-t-emerald-500 group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(16,185,129,0.15)]">
              <h3 className="text-[#1E3A5F] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-5">
                <Trophy size={16} className="text-emerald-600" />
                Team Stats
              </h3>

              <div className="space-y-4 flex-1">
                {[
                  { label: 'Avg. BST', value: analysis.avgBST, max: 720, color: '#22C55E' },
                  { label: 'Offensive Coverage', value: analysis.offensiveCoverage, max: 100, color: '#3B82F6', suffix: '%' },
                  { label: 'Type Diversity', value: analysis.typeDiversity, max: 100, color: '#F59E0B', suffix: '%' },
                ].map((stat, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#1E3A5F]/60 text-[9px] font-bold uppercase tracking-[0.2em]">{stat.label}</span>
                      <span className="text-[#1E3A5F] font-black text-sm">{stat.value}{stat.suffix || ''}</span>
                    </div>
                    <div className="h-1.5 bg-[#1E3A5F]/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(stat.value / stat.max) * 100}%`, backgroundColor: stat.color }} />
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center py-2 border-y border-[#1E3A5F]/10 mt-3">
                  <span className="text-[#1E3A5F]/60 text-[9px] font-bold uppercase tracking-[0.2em]">Squad</span>
                  <span className="text-[#1E3A5F] font-black text-sm">{squad.length}/6</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {analysis.teamTypes.map(type => (
                    <span key={type} className="px-3 py-1 rounded-lg text-[8px] font-black text-white uppercase tracking-widest shadow-sm border border-black/10" style={{ backgroundColor: typeColors[type] || '#A8A878' }}>
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Suggestions Card */}
            <div className="bg-[#FACC15] rounded-[2.5rem] p-6 shadow-2xl flex flex-col h-full border-t-4 border-t-red-500 group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(239,68,68,0.15)]">
              <h3 className="text-[#1E3A5F] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-4">
                <Zap size={16} className="text-red-600" />
                Suggestions
              </h3>
              
              <div className="space-y-2.5 overflow-y-auto flex-1 custom-scrollbar pr-1 h-full max-h-[240px]">
                {analysis.suggestions.length > 0 ? (
                  analysis.suggestions.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/40 border border-[#1E3A5F]/10 shadow-sm transition-transform hover:scale-[1.02]">
                      <div className="w-8 h-8 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] flex items-center justify-center flex-shrink-0">
                        <SuggestionIcon name={s.icon} />
                      </div>
                      <p className="text-[#1E3A5F]/80 text-[10px] font-bold leading-relaxed">{s.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-60">
                    <Star className="text-[#1E3A5F]" size={32} />
                    <p className="text-[#1E3A5F] font-black uppercase tracking-widest text-[10px] mt-3">Perfectly Balanced!</p>
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
