'use client';

import { useState, useEffect, memo } from 'react';
import Image from 'next/image';
import { X, Zap, Shield, Swords, Heart, Activity, Footprints, ChevronRight } from 'lucide-react';
import { 
  Pokemon, 
  PokemonSpecies, 
  EvolutionChain,
  fetchPokemonSpecies, 
  fetchEvolutionChain,
  fetchPokemon,
  capitalize, 
  formatPokemonId, 
  getOfficialArtwork,
  typeColors 
} from '@/lib/pokemon-api';

interface PokemonDetailProps {
  pokemon: Pokemon;
  onClose: () => void;
}

interface EvolutionInfo {
  id: number;
  name: string;
}

export const PokemonDetail = memo(function PokemonDetail({ pokemon, onClose }: PokemonDetailProps) {
  const [species, setSpecies] = useState<PokemonSpecies | null>(null);
  const [evolutionChain, setEvolutionChain] = useState<EvolutionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSpeciesData() {
      try {
        const speciesData = await fetchPokemonSpecies(pokemon.id);
        setSpecies(speciesData);

        const chainData = await fetchEvolutionChain(speciesData.evolution_chain.url);
        const evolutions: EvolutionInfo[] = [];
        
        const parseChain = async (node: EvolutionChain['chain']) => {
          const pokemonData = await fetchPokemon(node.species.name);
          evolutions.push({ id: pokemonData.id, name: node.species.name });
          
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

  const primaryType = pokemon.types[0]?.type.name || 'normal';
  
  const description = species?.flavor_text_entries
    .find(entry => entry.language.name === 'en')
    ?.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ') || '';
  
  const category = species?.genera
    .find(g => g.language.name === 'en')
    ?.genus || 'Unknown';

  // Get weakness from type
  const getWeakness = (type: string) => {
    const weaknesses: Record<string, string[]> = {
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

  const statIcons: Record<string, React.ReactNode> = {
    hp: <Heart size={14} />,
    attack: <Swords size={14} />,
    defense: <Shield size={14} />,
    'special-attack': <Zap size={14} />,
    'special-defense': <Activity size={14} />,
    speed: <Footprints size={14} />,
  };

  const statLabels: Record<string, string> = {
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
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-[#1E3A5F]/20 hover:bg-[#1E3A5F]/40 transition-colors text-[#1E3A5F]"
          aria-label="Close details"
        >
          <X size={24} />
        </button>

        {/* Background Pokeball watermark */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-80 h-80 opacity-5 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="48" fill="#1E3A5F"/>
            <rect x="0" y="48" width="100" height="4" fill="#1E3A5F"/>
            <circle cx="50" cy="50" r="16" fill="none" stroke="#1E3A5F" strokeWidth="4"/>
          </svg>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6 md:p-8">
          {/* Left Column - Info */}
          <div className="flex flex-col">
            {/* Name Section */}
            <div className="mb-6">
              <p className="text-[#1E3A5F]/40 text-[10px] font-black tracking-[0.3em] uppercase mb-1">DETAILED ANALYSIS</p>
              <div className="flex items-center gap-4">
                <h2 className="text-5xl md:text-6xl pokemon-logo pt-2 uppercase">
                  {pokemon.name}
                </h2>
              </div>
            </div>

            {/* Info Pills */}
            <div className="mb-4">
              <p className="text-[#1E3A5F]/50 text-xs font-semibold tracking-widest mb-2">ABOUT</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                  Category: {category}
                </span>
                {evolutionChain.length > 1 && pokemon.id !== evolutionChain[evolutionChain.length - 1].id && (
                  <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                    Evolves to: {capitalize(evolutionChain[evolutionChain.findIndex(e => e.id === pokemon.id) + 1]?.name || '')}
                  </span>
                )}
                <span className="px-4 py-1.5 rounded-full bg-[#1E3A5F]/10 text-[#1E3A5F] text-sm font-medium border border-[#1E3A5F]/20">
                  Weakness: {getWeakness(primaryType)[0]}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-4 mb-6">
              <p className="text-[#1E3A5F] text-sm font-bold leading-relaxed max-w-md">
                {loading ? 'Decrypting species data...' : description}
              </p>

              {/* Moves Section */}
              <div className="space-y-3">
                <p className="text-[#1E3A5F]/40 text-[10px] font-black tracking-[0.3em] uppercase">Signature Moves</p>
                <div className="grid grid-cols-2 gap-2">
                  {pokemon.moves.slice(0, 6).map(({ move }) => (
                    <div 
                      key={move.name}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#1E3A5F]/10 border border-[#1E3A5F]/20 group hover:bg-[#1E3A5F] transition-all"
                    >
                      <Zap size={14} className="text-[#1E3A5F] group-hover:text-white" />
                      <span className="text-[10px] font-black text-[#1E3A5F] uppercase tracking-wider group-hover:text-white">
                        {capitalize(move.name)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-[#1E3A5F]/5 backdrop-blur-sm rounded-3xl p-6 border border-[#1E3A5F]/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#1E3A5F] font-black uppercase text-xs tracking-widest">Combat Capabilities</h3>
                <Activity size={16} className="text-[#1E3A5F]/30" />
              </div>
              <div className="grid grid-cols-1 gap-3">
                {pokemon.stats.map(({ stat, base_stat }) => (
                  <div key={stat.name} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#1E3A5F]">
                        {statIcons[stat.name]}
                        <span className="text-[10px] font-black uppercase tracking-wider">{statLabels[stat.name]}</span>
                      </div>
                      <span className="text-[#1E3A5F] font-black text-xs">{base_stat}</span>
                    </div>
                    <div className="flex-1 bg-[#1E3A5F]/10 rounded-full h-2.5 overflow-hidden border border-[#1E3A5F]/5">
                      <div 
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ 
                          width: `${Math.min(100, (base_stat / 150) * 100)}%`,
                          backgroundColor: base_stat > 110 ? '#22c55e' : base_stat > 70 ? '#2563eb' : '#ef4444'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>


          </div>

          {/* Right Column - Image & Evolution */}
          <div className="flex flex-col items-center justify-center relative">
            {/* Height & Weight indicators */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-start gap-1 text-[#1E3A5F]/60 text-xs">
              <span>Height: {(pokemon.height / 10).toFixed(1)}m</span>
            </div>
            <div className="absolute bottom-20 right-0 text-[#1E3A5F]/60 text-xs">
              Weight: {(pokemon.weight / 10).toFixed(1)}kg
            </div>

            {/* Main Pokemon Image */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 animate-float">
              <Image
                src={getOfficialArtwork(pokemon.id)}
                alt={pokemon.name}
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>

            {/* Evolution Chain Thumbnails */}
            {evolutionChain.length > 0 && (
              <div className="flex gap-3 mt-4">
                {evolutionChain.slice(0, 3).map((evo) => (
                  <div 
                    key={evo.id} 
                    className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      evo.id === pokemon.id 
                        ? 'border-[#1E3A5F] bg-white shadow-lg scale-110' 
                        : 'border-[#1E3A5F]/20 bg-white/50'
                    }`}
                  >
                    <Image
                      src={getOfficialArtwork(evo.id)}
                      alt={evo.name}
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Page Indicator */}
            <div className="flex items-center gap-2 mt-6 text-[#1E3A5F]/40 text-sm">
              <span className="font-bold text-[#1E3A5F]">{formatPokemonId(pokemon.id).replace('#', '')}</span>
              <div className="w-12 h-0.5 bg-[#1E3A5F]/20" />
              <span>151</span>
            </div>
          </div>
        </div>

        {/* Types Bar */}
        <div className="flex justify-center gap-3 pb-6">
          {pokemon.types.map(({ type }) => (
            <span
              key={type.name}
              className="px-5 py-2 rounded-full text-sm font-bold text-white shadow-lg"
              style={{ backgroundColor: typeColors[type.name] }}
            >
              {capitalize(type.name)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
