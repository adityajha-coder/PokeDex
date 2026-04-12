'use client';

import { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import { X, Zap, Shield, Swords, Heart, Activity, Footprints, ChevronRight, ChevronLeft } from 'lucide-react';
import {
  fetchPokemonSpecies,
  fetchEvolutionChain,
  fetchPokemon,
  capitalize,
  formatPokemonId,
  getOfficialArtwork,
  typeColors
} from '@/lib/pokemon-api';

export const PokemonDetail = memo(function PokemonDetail({ pokemon, onClose }) {
  const [species, setSpecies] = useState(null);
  const [evolutionChain, setEvolutionChain] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePokemon, setActivePokemon] = useState(pokemon);
  const [varieties, setVarieties] = useState([]);

  useEffect(() => {
    async function loadSpeciesData() {
      try {
        const speciesData = await fetchPokemonSpecies(pokemon.id);
        setSpecies(speciesData);

        // Fetch varieties (Mega, Gmax, etc.)
        const varietyData = await Promise.all(
          speciesData.varieties
            .filter(v => !v.is_default) // Only non-default varieties
            .map(async (v) => {
              const pokemonData = await fetchPokemon(v.pokemon.name);
              return {
                id: pokemonData.id,
                name: v.pokemon.name,
                data: pokemonData,
                isMega: v.pokemon.name.includes('-mega'),
                isGmax: v.pokemon.name.includes('-gmax'),
                isRegional: v.pokemon.name.includes('-alola') || v.pokemon.name.includes('-galar') || v.pokemon.name.includes('-hisui') || v.pokemon.name.includes('-paldea')
              };
            })
        );
        setVarieties(varietyData);

        const chainData = await fetchEvolutionChain(speciesData.evolution_chain.url);
        const evolutions = [];

        const parseChain = async (node) => {
          const pokemonData = await fetchPokemon(node.species.name);
          evolutions.push({ id: pokemonData.id, name: node.species.name, data: pokemonData });

          for (const evolution of node.evolves_to) {
            await parseChain(evolution);
          }
        };

        await parseChain(chainData.chain);
        setEvolutionChain(evolutions);
      } catch (error) {
        console.error('Failed to load species data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSpeciesData();
  }, [pokemon.id]);

  const primaryType = activePokemon.types[0]?.type.name || 'normal';

  const description = species?.flavor_text_entries
    .find(entry => entry.language.name === 'en')
    ?.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ') || '';

  const category = species?.genera
    .find(g => g.language.name === 'en')
    ?.genus || 'Unknown';

  // Get weakness from type
  const getWeakness = (type) => {
    const weaknesses = {
      electric: ['Ground'],
      fire: ['Water', 'Ground', 'Rock'],
      water: ['Electric', 'Grass'],
      grass: ['Fire', 'Ice', 'Poison', 'Flying', 'Bug'],
      normal: ['Fighting'],
      fighting: ['Flying', 'Psychic', 'Fairy'],
      flying: ['Electric', 'Ice', 'Rock'],
      poison: ['Ground', 'Psychic'],
      ground: ['Water', 'Grass', 'Ice'],
      rock: ['Water', 'Grass', 'Fighting', 'Ground', 'Steel'],
      bug: ['Fire', 'Flying', 'Rock'],
      ghost: ['Ghost', 'Dark'],
      steel: ['Fire', 'Fighting', 'Ground'],
      psychic: ['Bug', 'Ghost', 'Dark'],
      ice: ['Fire', 'Fighting', 'Rock', 'Steel'],
      dragon: ['Ice', 'Dragon', 'Fairy'],
      dark: ['Fighting', 'Bug', 'Fairy'],
      fairy: ['Poison', 'Steel'],
    };
    return weaknesses[type] || ['Unknown'];
  };

  const statIcons = {
    hp: <Heart size={14} />,
    attack: <Swords size={14} />,
    defense: <Shield size={14} />,
    'special-attack': <Zap size={14} />,
    'special-defense': <Activity size={14} />,
    speed: <Footprints size={14} />,
  };

  const statLabels = {
    hp: 'HP',
    attack: 'ATK',
    defense: 'DEF',
    'special-attack': 'SP.ATK',
    'special-defense': 'SP.DEF',
    speed: 'SPEED',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-3xl shadow-2xl animate-bounce-in pokemon-card-yellow"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#1E3A5F]/20 hover:bg-[#1E3A5F]/40 transition-colors text-[#1E3A5F]"
          aria-label="Close details"
        >
          <X size={24} />
        </button>

        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-80 h-80 opacity-5 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="48" fill="#1E3A5F" />
            <rect x="0" y="48" width="100" height="4" fill="#1E3A5F" />
            <circle cx="50" cy="50" r="16" fill="none" stroke="#1E3A5F" strokeWidth="4" />
          </svg>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6 md:p-8">
          <div className="flex flex-col">
            <div className="mb-6">
              <p className="text-[#1E3A5F]/40 text-[10px] font-black tracking-[0.3em] uppercase mb-1">DETAILED ANALYSIS</p>
              <div className="flex items-center gap-4">
                <h2 className="text-5xl md:text-6xl pokemon-logo pt-2 uppercase">
                  {activePokemon.name}
                </h2>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-[#1E3A5F]/50 text-xs font-semibold tracking-widest mb-2">ABOUT</p>
              <div className="flex flex-col items-start gap-2">
                <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20 flex items-center gap-2">
                  <span className="opacity-70">Type:</span> 
                  {activePokemon.types.map(({ type }) => (
                    <span
                      key={type.name}
                      className="px-2 py-0.5 rounded-full text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: typeColors[type.name] }}
                    >
                      {capitalize(type.name)}
                    </span>
                  ))}
                </span>
                <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                  <span className="opacity-70 mr-1">Category:</span>
                  <span className="font-bold">{category}</span>
                </span>
                {evolutionChain.length > 1 && pokemon.id !== evolutionChain[evolutionChain.length - 1].id && (
                  <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                    <span className="opacity-70 mr-1">Evolves to:</span>
                    <span className="font-bold">{capitalize(evolutionChain[evolutionChain.findIndex(e => e.id === pokemon.id) + 1]?.name || '')}</span>
                  </span>
                )}
                <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                  <span className="opacity-70 mr-1">Weakness:</span>
                  <span className="font-bold">{getWeakness(primaryType)[0]}</span>
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[#1E3A5F]/50 text-xs font-semibold tracking-widest">ABILITIES</span>
                  {activePokemon.abilities?.map(({ ability, is_hidden }) => (
                    <span
                      key={ability.name}
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        is_hidden
                          ? 'bg-purple-500/15 text-purple-700 border-purple-500/30'
                          : 'bg-[#1E3A5F]/10 text-[#1E3A5F] border-[#1E3A5F]/20'
                      }`}
                    >
                      {capitalize(ability.name)}
                      {is_hidden && <span className="ml-1 text-[9px] opacity-70">(Hidden)</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <p className="text-[#1E3A5F] text-sm font-bold leading-relaxed max-w-md">
                {loading ? 'Decrypting species data...' : description}
              </p>

              {varieties.length > 0 && (
                <div className="space-y-3 mt-4">
                  <p className="text-[#1E3A5F]/40 text-[10px] font-black tracking-[0.3em] uppercase">Master Forms</p>
                  <div className="flex flex-wrap gap-3">
                    {/* Default Form */}
                    <button
                      onClick={() => setActivePokemon(pokemon)}
                      className={`relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all group ${activePokemon.id === pokemon.id
                        ? 'border-[#1E3A5F] bg-white shadow-lg scale-110'
                        : 'border-[#1E3A5F]/20 bg-white/50 hover:border-[#1E3A5F]'
                        }`}
                    >
                      <Image
                        src={getOfficialArtwork(pokemon.id)}
                        alt="Default"
                        fill
                        className="object-contain p-1"
                      />
                      {activePokemon.id === pokemon.id && (
                        <div className="absolute inset-x-0 bottom-0 bg-[#1E3A5F] text-white text-[8px] font-bold text-center py-0.5">
                          BASE
                        </div>
                      )}
                    </button>

                    {/* Other Varieties */}
                    {varieties.map((variety) => (
                      <button
                        key={variety.id}
                        onClick={() => setActivePokemon(variety.data)}
                        className={`relative w-14 h-14 rounded-2xl overflow-hidden border-2 transition-all group ${activePokemon.id === variety.id
                          ? 'border-[#1E3A5F] bg-white shadow-lg scale-110'
                          : 'border-[#1E3A5F]/20 bg-white/50 hover:border-[#1E3A5F]'
                          }`}
                      >
                        <Image
                          src={getOfficialArtwork(variety.id)}
                          alt={variety.name}
                          fill
                          className="object-contain p-1"
                        />
                        <div className={`absolute inset-x-0 bottom-0 text-white text-[8px] font-bold text-center py-0.5 ${variety.isMega ? 'bg-[#EF4444]' : variety.isGmax ? 'bg-[#A855F7]' : 'bg-[#1E3A5F]'
                          }`}>
                          {variety.isMega ? 'MEGA' : variety.isGmax ? 'GMAX' : 'FORM'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[#1E3A5F]/40 text-[10px] font-black tracking-[0.3em] uppercase">Signature Moves</p>
                <div className="grid grid-cols-2 gap-3">
                  {activePokemon.moves
                    .filter(m => m.version_group_details.some(v => v.move_learn_method.name === 'level-up'))
                    .slice(0, 12)
                    .map(({ move }) => (
                      <div
                        key={move.name}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#1E3A5F]/10 border border-[#1E3A5F]/20 group hover:bg-[#1E3A5F] hover:shadow-md transition-all cursor-default"
                      >
                        <Zap size={14} className="text-[#1E3A5F] group-hover:text-white" />
                        <span className="text-[10px] font-black text-[#1E3A5F] uppercase tracking-wider group-hover:text-white truncate">
                          {capitalize(move.name)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="bg-[#FACC15] rounded-3xl p-6 shadow-md border border-white/20">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[#1E3A5F] font-black uppercase text-xs tracking-widest">Combat Capabilities</h3>
                <Activity size={18} className="text-[#1E3A5F]/40" />
              </div>
              <div className="flex flex-col">
                {activePokemon.stats.map(({ stat, base_stat }) => {
                  const basePokemonStat = pokemon.stats.find(s => s.stat.name === stat.name)?.base_stat || base_stat;
                  
                  // Calculate Level 100 stat using the same formula as Squad Builder
                  const iv = 31;
                  const ev = 0;
                  
                  // Calc for current active form
                  let calc = 0;
                  if (stat.name === 'hp') {
                    if (base_stat === 1) calc = 1;
                    else calc = Math.floor(((2 * base_stat + iv + Math.floor(ev / 4)) * 100) / 100) + 100 + 10;
                  } else {
                    calc = Math.floor((Math.floor(((2 * base_stat + iv + Math.floor(ev / 4)) * 100) / 100) + 5) * 1.0);
                  }

                  // Calc for original base form to find diff
                  let baseCalc = 0;
                  if (stat.name === 'hp') {
                    if (basePokemonStat === 1) baseCalc = 1;
                    else baseCalc = Math.floor(((2 * basePokemonStat + iv + Math.floor(ev / 4)) * 100) / 100) + 100 + 10;
                  } else {
                    baseCalc = Math.floor((Math.floor(((2 * basePokemonStat + iv + Math.floor(ev / 4)) * 100) / 100) + 5) * 1.0);
                  }
                  
                  const diff = calc - baseCalc;

                  return (
                    <div key={stat.name} className="flex items-center justify-between py-3 border-b border-[#1E3A5F]/10 last:border-0">
                      <div className="flex items-center gap-3 text-[#1E3A5F]">
                        {statIcons[stat.name]}
                        <span className="text-xs font-black uppercase tracking-wider">{statLabels[stat.name]}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#1E3A5F] font-black text-sm">{calc}</span>
                        {diff !== 0 && (
                          <span className={`text-[11px] font-black ${diff > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            ({diff > 0 ? '+' : ''}{diff})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center relative">
            <div className="flex gap-4 mb-6">
              <div className="flex flex-col items-center px-4 py-2 bg-[#1E3A5F]/10 rounded-2xl border border-[#1E3A5F]/10">
                <span className="text-[#1E3A5F]/40 text-[10px] font-black uppercase tracking-wider">Height</span>
                <span className="text-[#1E3A5F] font-bold text-sm">{(activePokemon.height / 10).toFixed(1)}m</span>
              </div>
              <div className="flex flex-col items-center px-4 py-2 bg-[#1E3A5F]/10 rounded-2xl border border-[#1E3A5F]/10">
                <span className="text-[#1E3A5F]/40 text-[10px] font-black uppercase tracking-wider">Weight</span>
                <span className="text-[#1E3A5F] font-bold text-sm">{(activePokemon.weight / 10).toFixed(1)}kg</span>
              </div>
            </div>


            {/* Main Pokemon Image */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 animate-float">
              <Image
                src={getOfficialArtwork(activePokemon.id)}
                alt={activePokemon.name}
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* Evolution Navigation Carousel */}
            {(() => {
              if (evolutionChain.length <= 1) return null;
              const currentIndex = evolutionChain.findIndex(e => e.id === activePokemon.id);
              
              if (currentIndex === -1) return null; // Hide if currently viewing a Mega/Gmax
              
              return (
                <div className="flex items-center gap-6 mt-8">
                  <button 
                    onClick={() => setActivePokemon(evolutionChain[currentIndex - 1].data)}
                    disabled={currentIndex === 0}
                    className={`p-2 rounded-full transition-all flex items-center justify-center w-10 h-10 ${
                      currentIndex === 0 
                        ? 'opacity-30 cursor-not-allowed bg-[#1E3A5F]/10' 
                        : 'bg-[#1E3A5F] hover:bg-[#1E3A5F]/80 shadow-lg hover:scale-105 cursor-pointer'
                    }`}
                  >
                    <ChevronLeft size={20} className={currentIndex === 0 ? 'text-[#1E3A5F]' : 'text-white'} />
                  </button>
                  
                  <div className="flex gap-3 items-center">
                    {evolutionChain.slice(0, 3).map((evo) => (
                      <button
                        key={evo.id}
                        onClick={() => setActivePokemon(evo.data)}
                        className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 transition-all hover:border-[#1E3A5F] ${
                          evo.id === activePokemon.id
                            ? 'border-[#1E3A5F] bg-white shadow-lg scale-110 z-10'
                            : 'border-[#1E3A5F]/20 bg-white/50 hover:scale-105'
                        }`}
                      >
                        <Image
                          src={getOfficialArtwork(evo.id)}
                          alt={evo.name}
                          fill
                          className="object-contain p-1"
                        />
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => setActivePokemon(evolutionChain[currentIndex + 1].data)}
                    disabled={currentIndex === evolutionChain.length - 1}
                    className={`p-2 rounded-full transition-all flex items-center justify-center w-10 h-10 ${
                      currentIndex === evolutionChain.length - 1 
                        ? 'opacity-30 cursor-not-allowed bg-[#1E3A5F]/10' 
                        : 'bg-[#1E3A5F] hover:bg-[#1E3A5F]/80 shadow-lg hover:scale-105 cursor-pointer'
                    }`}
                  >
                    <ChevronRight size={20} className={currentIndex === evolutionChain.length - 1 ? 'text-[#1E3A5F]' : 'text-white'} />
                  </button>
                </div>
              );
            })()}

            {/* Page Indicator */}
            <div className="flex items-center gap-2 mt-6 text-[#1E3A5F]/40 text-sm">
              <span className="font-bold text-[#1E3A5F]">{formatPokemonId(activePokemon.id).replace('#', '')}</span>
              <div className="w-12 h-0.5 bg-[#1E3A5F]/20" />
              <span>1025</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
