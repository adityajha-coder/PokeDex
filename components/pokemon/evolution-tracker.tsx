'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Image from 'next/image';
import { ArrowRight, Search, X, Sparkles, TrendingUp } from 'lucide-react';
import { 
  Pokemon,
  PokemonSpecies,
  EvolutionChain,
  fetchPokemon,
  fetchPokemonSpecies,
  fetchEvolutionChain,
  fetchPokemonList,
  capitalize,
  getOfficialArtwork,
  typeColors
} from '@/lib/pokemon-api';

interface EvolutionStage {
  pokemon: Pokemon;
  species: PokemonSpecies;
  evolutionDetails: {
    trigger: string;
    minLevel?: number;
    item?: string;
    happiness?: boolean;
    time?: string;
  } | null;
}

interface ParsedEvolution {
  stages: EvolutionStage[];
  branches: ParsedEvolution[];
}

export const EvolutionTracker = memo(function EvolutionTracker() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ name: string; id: number }[]>([]);
  const [allPokemon, setAllPokemon] = useState<{ name: string; id: number }[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [evolutionData, setEvolutionData] = useState<EvolutionStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Load Pokemon list
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

  // Search Pokemon
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

  // Parse evolution chain
  const parseEvolutionChain = useCallback(async (chain: EvolutionChain['chain']): Promise<EvolutionStage[]> => {
    const stages: EvolutionStage[] = [];
    let currentNode = chain;

    while (currentNode) {
      try {
        const pokemon = await fetchPokemon(currentNode.species.name);
        const species = await fetchPokemonSpecies(currentNode.species.name);
        
        const details = currentNode.evolution_details[0];
        const evolutionDetails = details ? {
          trigger: details.trigger?.name || 'unknown',
          minLevel: details.min_level || undefined,
          item: details.item?.name || undefined,
        } : null;

        stages.push({ pokemon, species, evolutionDetails });

        // Move to next evolution (take first branch for simplicity)
        currentNode = currentNode.evolves_to[0];
      } catch (error) {
        console.error('Error parsing evolution chain:', error);
        break;
      }
    }

    return stages;
  }, []);

  // Select Pokemon and load evolution
  const selectPokemon = useCallback(async (nameOrId: string | number) => {
    setLoading(true);
    setShowSearch(false);
    setSearchQuery('');

    try {
      const pokemon = await fetchPokemon(nameOrId);
      setSelectedPokemon(pokemon);

      const species = await fetchPokemonSpecies(nameOrId);
      const evolutionChain = await fetchEvolutionChain(species.evolution_chain.url);
      const stages = await parseEvolutionChain(evolutionChain.chain);
      
      setEvolutionData(stages);
    } catch (error) {
      console.error('Failed to load evolution data:', error);
      setEvolutionData([]);
    } finally {
      setLoading(false);
    }
  }, [parseEvolutionChain]);

  // Calculate stat changes between evolutions
  const getStatChange = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff > 0) return `+${diff}`;
    if (diff < 0) return `${diff}`;
    return '0';
  };

  // Get evolution trigger text
  const getEvolutionTrigger = (details: EvolutionStage['evolutionDetails']) => {
    if (!details) return null;
    
    if (details.minLevel) return `Level ${details.minLevel}`;
    if (details.item) return capitalize(details.item.replace('-', ' '));
    if (details.trigger === 'trade') return 'Trade';
    if (details.trigger === 'use-item') return 'Use Item';
    
    return capitalize(details.trigger.replace('-', ' '));
  };

  return (
    <div className="min-h-screen pt-24 pb-10 px-4">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob-red -top-10 -left-10" />
        <div className="blob-yellow top-0 right-0 w-48 h-48" />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 
            className="text-4xl md:text-6xl font-extrabold text-[#FACC15] mb-4"
            style={{ textShadow: '3px 3px 0 #1E3A5F' }}
          >
            EVOLUTION TRACKER
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto">
            Visualize evolution chains with images and stats. See how Pokemon grow stronger!
          </p>
        </div>

        {/* Pokemon Selector */}
        <div className="mb-10 relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#FACC15] text-[#1E3A5F] font-bold text-lg hover:bg-yellow-400 transition-all shadow-lg"
          >
            <Search size={24} />
            {selectedPokemon ? capitalize(selectedPokemon.name) : 'Select a Pokemon'}
          </button>

          {/* Search Dropdown */}
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
                    <p className="text-white/50 text-sm mb-3">Try these evolution lines:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'Charmander', id: 4 },
                        { name: 'Eevee', id: 133 },
                        { name: 'Magikarp', id: 129 },
                        { name: 'Dratini', id: 147 },
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

        {/* Loading State */}
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

        {/* Evolution Chain Display */}
        {!loading && evolutionData.length > 0 && (
          <div className="animate-bounce-in">
            {/* Evolution Line */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 mb-10">
              {evolutionData.map((stage, index) => (
                <div key={stage.pokemon.id} className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                  {/* Evolution Arrow with Trigger */}
                  {index > 0 && (
                    <div className="flex flex-col items-center gap-2 text-white/60">
                      <ArrowRight className="hidden md:block" size={32} />
                      <div className="md:hidden w-0.5 h-8 bg-white/30" />
                      {getEvolutionTrigger(stage.evolutionDetails) && (
                        <span className="text-xs bg-white/20 px-3 py-1 rounded-full whitespace-nowrap">
                          {getEvolutionTrigger(stage.evolutionDetails)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pokemon Card */}
                  <div 
                    className={`relative rounded-3xl p-6 transition-all hover:scale-105 ${
                      selectedPokemon?.id === stage.pokemon.id ? 'ring-4 ring-white' : ''
                    }`}
                    style={{ 
                      backgroundColor: typeColors[stage.pokemon.types[0]?.type.name || 'normal'],
                      boxShadow: `0 20px 40px ${typeColors[stage.pokemon.types[0]?.type.name || 'normal']}60`
                    }}
                  >
                    {/* Stage Badge */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-[#1E3A5F] text-xs font-bold flex items-center gap-1">
                      <Sparkles size={12} />
                      Stage {index + 1}
                    </div>

                    {/* Pokemon Image */}
                    <div className="relative w-32 h-32 mx-auto animate-float">
                      <Image
                        src={getOfficialArtwork(stage.pokemon.id)}
                        alt={stage.pokemon.name}
                        fill
                        className="object-contain drop-shadow-2xl"
                      />
                    </div>

                    {/* Pokemon Info */}
                    <div className="text-center mt-4">
                      <p className="text-white/60 text-sm font-bold">
                        #{stage.pokemon.id.toString().padStart(3, '0')}
                      </p>
                      <h3 className="text-xl font-bold text-white capitalize">
                        {capitalize(stage.pokemon.name)}
                      </h3>
                      <div className="flex justify-center gap-2 mt-2">
                        {stage.pokemon.types.map(({ type }) => (
                          <span
                            key={type.name}
                            className="px-2 py-1 rounded-full text-xs font-medium bg-white/20 text-white"
                          >
                            {capitalize(type.name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats Comparison */}
            {evolutionData.length > 1 && (
              <div className="bg-white/10 rounded-3xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6">
                  <TrendingUp className="text-[#FACC15]" size={24} />
                  <h3 className="text-xl font-bold text-white">Stats Growth</h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left text-white/60 font-medium pb-4 pr-4">Stat</th>
                        {evolutionData.map((stage) => (
                          <th 
                            key={stage.pokemon.id} 
                            className="text-center text-white font-bold pb-4 px-2"
                          >
                            {capitalize(stage.pokemon.name)}
                          </th>
                        ))}
                        <th className="text-center text-white/60 font-medium pb-4 pl-4">
                          Total Growth
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'].map((statName) => {
                        const firstStat = evolutionData[0]?.pokemon.stats.find(s => s.stat.name === statName)?.base_stat || 0;
                        const lastStat = evolutionData[evolutionData.length - 1]?.pokemon.stats.find(s => s.stat.name === statName)?.base_stat || 0;
                        const totalGrowth = lastStat - firstStat;

                        return (
                          <tr key={statName} className="border-t border-white/10">
                            <td className="py-3 pr-4 text-white/80 text-sm font-medium uppercase">
                              {statName.replace('special-', 'Sp. ')}
                            </td>
                            {evolutionData.map((stage, index) => {
                              const stat = stage.pokemon.stats.find(s => s.stat.name === statName);
                              const prevStat = index > 0 
                                ? evolutionData[index - 1].pokemon.stats.find(s => s.stat.name === statName)?.base_stat 
                                : null;

                              return (
                                <td key={stage.pokemon.id} className="py-3 px-2 text-center">
                                  <div className="flex flex-col items-center">
                                    <span className="text-white font-bold">{stat?.base_stat || 0}</span>
                                    {prevStat !== null && (
                                      <span className={`text-xs ${
                                        (stat?.base_stat || 0) > prevStat 
                                          ? 'text-green-400' 
                                          : (stat?.base_stat || 0) < prevStat 
                                          ? 'text-red-400' 
                                          : 'text-white/40'
                                      }`}>
                                        {getStatChange(stat?.base_stat || 0, prevStat)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className={`py-3 pl-4 text-center font-bold ${
                              totalGrowth > 0 ? 'text-green-400' : totalGrowth < 0 ? 'text-red-400' : 'text-white/40'
                            }`}>
                              {totalGrowth > 0 ? `+${totalGrowth}` : totalGrowth}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="border-t-2 border-white/30">
                        <td className="py-4 pr-4 text-white font-bold">TOTAL</td>
                        {evolutionData.map((stage) => {
                          const total = stage.pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
                          return (
                            <td key={stage.pokemon.id} className="py-4 px-2 text-center">
                              <span className="text-white text-xl font-bold">{total}</span>
                            </td>
                          );
                        })}
                        <td className="py-4 pl-4 text-center">
                          {(() => {
                            const firstTotal = evolutionData[0]?.pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0) || 0;
                            const lastTotal = evolutionData[evolutionData.length - 1]?.pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0) || 0;
                            const diff = lastTotal - firstTotal;
                            return (
                              <span className={`text-xl font-bold ${diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-white/40'}`}>
                                {diff > 0 ? `+${diff}` : diff}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Single Stage Pokemon */}
            {evolutionData.length === 1 && (
              <div className="text-center py-8 bg-white/10 rounded-2xl">
                <p className="text-white/60 text-lg">
                  {capitalize(evolutionData[0].pokemon.name)} does not evolve!
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && evolutionData.length === 0 && !selectedPokemon && (
          <div className="text-center py-16">
            <div className="w-32 h-32 mx-auto mb-6 opacity-40">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 4"/>
                <path d="M30 60 L50 40 L70 60" fill="none" stroke="white" strokeWidth="2"/>
                <circle cx="50" cy="30" r="8" fill="none" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <p className="text-white/60 text-lg">
              Select a Pokemon above to view its evolution chain
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
