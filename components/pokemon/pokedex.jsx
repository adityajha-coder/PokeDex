'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  fetchPokemon,
  fetchPokemonList,
  capitalize,
  typeColors,
  POKEMON_LIMIT,
  extractIdFromUrl
} from '@/lib/pokemon-api';
import { PokemonCard } from './pokemon-card';
import { PokemonDetail } from './pokemon-detail';
import { SearchBar } from './search-bar';
import { LoadingSpinner, GridSkeleton } from './loading-spinner';
import { ChevronDown, Filter, Crown } from 'lucide-react';

const LEGENDARY_IDS = new Set([
  144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643,
  644, 645, 646, 647, 648, 649, 716, 717, 718, 719, 720, 721, 772, 773, 785, 786, 787, 788, 789, 790, 791,
  792, 793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 888, 889, 890,
  891, 892, 893, 894, 895, 896, 897, 898, 905, 1001, 1002, 1003, 1004, 1007, 1008, 1010, 1014, 1015, 1016,
  1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025
]);

const POKEMON_TYPES = Object.keys(typeColors);
const TOTAL_POKEMON = POKEMON_LIMIT;
const INITIAL_LOAD = 50;
const BATCH_SIZE = 50;

// Cache avoids refetching across renders
const pokemonCache = new Map();

const MemoizedPokemonCard = memo(PokemonCard);

export const Pokedex = memo(function Pokedex() {
  const [allPokemonBasic, setAllPokemonBasic] = useState([]);
  const [loadedPokemon, setLoadedPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showLegendariesOnly, setShowLegendariesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const [selectedGen, setSelectedGen] = useState(0);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  const generations = useMemo(() => [
    { gen: 0, name: 'All', start: 1, end: TOTAL_POKEMON },
    { gen: 1, name: 'Gen 1 (Kanto)', start: 1, end: 151 },
    { gen: 2, name: 'Gen 2 (Johto)', start: 152, end: 251 },
    { gen: 3, name: 'Gen 3 (Hoenn)', start: 252, end: 386 },
    { gen: 4, name: 'Gen 4 (Sinnoh)', start: 387, end: 493 },
    { gen: 5, name: 'Gen 5 (Unova)', start: 494, end: 649 },
    { gen: 6, name: 'Gen 6 (Kalos)', start: 650, end: 721 },
    { gen: 7, name: 'Gen 7 (Alola)', start: 722, end: 809 },
    { gen: 8, name: 'Gen 8 (Galar)', start: 810, end: 905 },
    { gen: 9, name: 'Gen 9 (Paldea)', start: 906, end: 1025 },
  ], []);

  // Initial load: grab names/IDs fast, then load the first batch
  useEffect(() => {
    async function loadAllPokemonBasic() {
      try {
        const listData = await fetchPokemonList(TOTAL_POKEMON, 0);
        const basicList = listData.results.map((p) => ({
          name: p.name,
          id: extractIdFromUrl(p.url)
        }));
        setAllPokemonBasic(basicList);

        await loadPokemonBatch(basicList.slice(0, INITIAL_LOAD));
      } catch (error) {
        console.error('Failed to load Pokemon:', error);
      } finally {
        setLoading(false);
      }
    }

    loadAllPokemonBasic();
  }, []);

  // Efficient batch loading with caching
  const loadPokemonBatch = useCallback(async (batch) => {
    const toLoad = batch.filter(p => !pokemonCache.has(p.id));

    if (toLoad.length === 0) {
      const cached = batch.map(p => pokemonCache.get(p.id)).filter(Boolean);
      setLoadedPokemon(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPokemon = cached.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPokemon];
      });
      return;
    }

    // Load whatever isn't cached yet
    const results = await Promise.allSettled(
      toLoad.map(p => fetchPokemon(p.id))
    );

    const newPokemon = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        pokemonCache.set(toLoad[index].id, result.value);
        newPokemon.push(result.value);
      }
    });

    setLoadedPokemon(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const uniqueNew = newPokemon.filter(p => !existingIds.has(p.id));
      return [...prev, ...uniqueNew].sort((a, b) => a.id - b.id);
    });
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    if (loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && visibleCount < TOTAL_POKEMON) {
          loadMorePokemon();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, visibleCount]);

  const loadMorePokemon = useCallback(async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    const nextBatch = allPokemonBasic.slice(visibleCount, visibleCount + BATCH_SIZE);
    await loadPokemonBatch(nextBatch);
    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, TOTAL_POKEMON));
    setLoadingMore(false);
  }, [visibleCount, allPokemonBasic, loadingMore, loadPokemonBatch]);

  // Load Pokemon for selected generation
  const handleGenerationChange = useCallback(async (gen) => {
    setSelectedGen(gen);

    if (gen === 0) return; // "All" doesn't need special loading

    const genData = generations.find(g => g.gen === gen);
    if (!genData) return;

    // Check if we have Pokemon for this generation loaded
    const genPokemon = loadedPokemon.filter(p => p.id >= genData.start && p.id <= genData.end);

    // If we don't have enough, load them
    if (genPokemon.length < (genData.end - genData.start + 1)) {
      setLoadingMore(true);
      const genBasic = allPokemonBasic.filter(p => p.id >= genData.start && p.id <= genData.end);
      await loadPokemonBatch(genBasic);
      setLoadingMore(false);
    }
  }, [generations, loadedPokemon, allPokemonBasic, loadPokemonBatch]);

  // Filter Pokemon based on search, type, and generation
  const filteredList = useMemo(() => {
    let filtered = loadedPokemon;

    // Filter by generation
    if (selectedGen > 0) {
      const genData = generations.find(g => g.gen === selectedGen);
      if (genData) {
        filtered = filtered.filter(p => p.id >= genData.start && p.id <= genData.end);
      }
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase().replace('#', '');
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.id.toString() === query ||
        p.id.toString().padStart(3, '0') === query ||
        p.types.some(t => t.type.name.toLowerCase().includes(query))
      );
    }

    if (selectedType) {
      filtered = filtered.filter(p =>
        p.types.some(t => t.type.name === selectedType)
      );
    }

    if (showLegendariesOnly) {
      filtered = filtered.filter(p => LEGENDARY_IDS.has(p.id));
    }

    return filtered;
  }, [searchQuery, selectedType, loadedPokemon, selectedGen, generations, showLegendariesOnly]);

  // Handle search
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);

    // If searching for a specific ID, try to load it
    const id = parseInt(query.replace('#', ''));
    if (!isNaN(id) && id > 0 && id <= TOTAL_POKEMON && !pokemonCache.has(id)) {
      fetchPokemon(id).then(pokemon => {
        pokemonCache.set(id, pokemon);
        setLoadedPokemon(prev => {
          if (prev.find(p => p.id === id)) return prev;
          return [...prev, pokemon].sort((a, b) => a.id - b.id);
        });
      }).catch(() => { });
    }
  }, []);

  // Handle Pokemon card click
  const handlePokemonClick = useCallback((pokemon) => {
    setSelectedPokemon(pokemon);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedPokemon(null);
  }, []);

  return (
    <div className="min-h-screen pt-20 pb-10 px-4 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob-red -top-10 -left-10" />
        <div className="blob-yellow top-0 right-0 w-48 h-48" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl pokemon-logo mb-4 tracking-wider">
            POKEDEX
          </h1>
          <p className="text-white text-lg font-bold max-w-xl mx-auto uppercase tracking-[0.2em]">
            Digital World Encyclopedia
          </p>
          <p className="text-white/70 text-sm mt-1">
            Browse {TOTAL_POKEMON.toLocaleString()} Pokemon across all regions
          </p>
        </div>

        {/* Dashboard Control Panel */}
        <div className="mb-10 p-1 bg-white/10 backdrop-blur-md rounded-[2rem] border border-white/20 shadow-2xl">
          <div className="p-6 md:p-8 space-y-6">
            {/* Search Bar */}
            <SearchBar
              onSearch={handleSearch}
              isLoading={loading}
            />

            {/* Filter Section */}
            <div className="space-y-6">
              {/* Generation Filter */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Select Region</span>
                <div className="flex flex-wrap justify-center gap-2">
                  {generations.map(g => (
                    <button
                      key={g.gen}
                      onClick={() => handleGenerationChange(g.gen)}
                      disabled={loadingMore}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-50 ring-2 ${selectedGen === g.gen
                        ? 'bg-[#FACC15] text-[#1E3A5F] scale-110 shadow-xl ring-[#FACC15] z-10'
                        : 'bg-white/15 text-white hover:bg-white/25 ring-white/20 hover:scale-105'
                        }`}
                    >
                      {g.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-bold text-sm border-2 ${showFilters ? 'bg-white text-[#1E3A5F] border-white shadow-xl scale-105' : 'bg-white/15 text-white hover:bg-white/25 border-white/20 hover:scale-105'
                    }`}
                >
                  <Filter size={18} />
                  <span>FILTER BY TYPE</span>
                  <ChevronDown
                    size={18}
                    className={`transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
                  />
                </button>
                <button
                  onClick={() => setShowLegendariesOnly(!showLegendariesOnly)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl transition-all font-bold text-sm border-2 ${showLegendariesOnly ? 'bg-[#FACC15] text-[#1E3A5F] border-[#FACC15] shadow-xl scale-105' : 'bg-white/15 text-white hover:bg-white/25 border-white/20 hover:scale-105'
                    }`}
                >
                  <Crown size={18} />
                  <span>LEGENDARIES</span>
                </button>
              </div>

              {showFilters && (
                <div className="pt-4 border-t border-white/5 flex flex-wrap justify-center gap-2 animate-slide-up">
                  <button
                    onClick={() => setSelectedType('')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${!selectedType
                      ? 'bg-white text-[#1E3A5F] border-white scale-105 shadow-md'
                      : 'bg-white/20 text-white border-white/10 hover:bg-white/30'
                      }`}
                  >
                    ALL TYPES
                  </button>
                  {POKEMON_TYPES.map(type => (
                    <button
                      key={type}
                      onClick={() => setSelectedType(type === selectedType ? '' : type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all text-white shadow-md border-2 ${selectedType === type ? 'ring-4 ring-white border-white scale-110 z-10' : 'opacity-90 hover:opacity-100 hover:scale-105 border-transparent'
                        }`}
                      style={{ backgroundColor: typeColors[type] }}
                    >
                      {capitalize(type).toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <p className="text-center text-white mb-6 text-sm font-bold tracking-widest uppercase">
            {loadingMore && selectedGen > 0 ? (
              <span className="animate-pulse">Accessing {generations.find(g => g.gen === selectedGen)?.name} data...</span>
            ) : (
              <span className="px-4 py-1.5 bg-black/20 rounded-full">
                {filteredList.length} UNITS FOUND {selectedType && `• ${capitalize(selectedType).toUpperCase()}`} {selectedGen > 0 && `• ${generations.find(g => g.gen === selectedGen)?.name.toUpperCase()}`}
              </span>
            )}
          </p>
        )}

        {/* Pokemon Grid */}
        {loading ? (
          <GridSkeleton count={12} />
        ) : filteredList.length === 0 ? (
          <div className="text-center py-24 relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#FACC15]/5 rounded-full blur-[3rem] -z-10" />

            <div className="relative w-28 h-28 mx-auto mb-8">
              {/* Magic glowing aura */}
              <div className="absolute inset-0 bg-[#FACC15]/30 rounded-full blur-2xl animate-pulse" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-2 bg-blue-500/20 rounded-full blur-xl animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '0.5s' }}></div>

              {/* Animated Pokeball SVG */}
              <div className="w-full h-full relative z-10" style={{ animation: 'spin 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}>
                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
                  {/* Top Red Half */}
                  <path d="M50 5 A 45 45 0 0 1 95 50 L 68 50 A 18 18 0 0 0 32 50 L 5 50 A 45 45 0 0 1 50 5 Z" fill="#EF4444" />
                  {/* Bottom White Half */}
                  <path d="M50 95 A 45 45 0 0 0 95 50 L 68 50 A 18 18 0 0 1 32 50 L 5 50 A 45 45 0 0 0 50 95 Z" fill="#F8FAFC" />
                  {/* Center Rings */}
                  <circle cx="50" cy="50" r="18" fill="white" stroke="#1E3A5F" strokeWidth="5" />
                  <circle cx="50" cy="50" r="8" fill="#F8FAFC" stroke="#1E3A5F" strokeWidth="3" />
                  {/* Glowing center button */}
                  <circle cx="50" cy="50" r="4" fill="#60A5FA" className="animate-pulse" style={{ animationDuration: '1s' }} />
                  {/* Divider Line */}
                  <line x1="4" y1="50" x2="32" y2="50" stroke="#1E3A5F" strokeWidth="6" strokeLinecap="round" />
                  <line x1="68" y1="50" x2="96" y2="50" stroke="#1E3A5F" strokeWidth="6" strokeLinecap="round" />
                  {/* Outer Stroke */}
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#1E3A5F" strokeWidth="6" />
                  {/* Shading/Highlight */}
                  <path d="M 18 28 Q 30 12 50 10 A 40 40 0 0 0 18 28" fill="rgba(255,255,255,0.3)" />
                </svg>
              </div>
            </div>

            <h3 className="text-white text-xl md:text-2xl font-black mb-3 uppercase tracking-[0.2em] animate-pulse">
              Fetching Magic Pokemon
            </h3>
            <p className="text-white/40 text-xs font-black tracking-[0.3em] uppercase">
              {loadingMore ? 'Synchronizing with region...' : 'Scanning the wilderness...'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Legendaries Section */}
            {(() => {
              const legendaries = filteredList.filter(p => LEGENDARY_IDS.has(p.id));
              if (legendaries.length === 0) return null;
              return (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-3 mb-6 px-1">
                    <Crown className="text-[#FACC15]" size={24} />
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                      Legendaries & Mythicals
                    </h2>
                    <div className="h-1 flex-1 bg-gradient-to-r from-[#FACC15]/30 to-transparent rounded-full ml-4" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {legendaries.map((pokemon) => (
                      <MemoizedPokemonCard
                        key={`legendary-${pokemon.id}`}
                        id={pokemon.id}
                        name={pokemon.name}
                        types={pokemon.types}
                        height={pokemon.height}
                        weight={pokemon.weight}
                        onClick={() => handlePokemonClick(pokemon)}
                        isSelected={selectedPokemon?.id === pokemon.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Regular Pokemon Section */}
            {(() => {
              const regular = filteredList.filter(p => !LEGENDARY_IDS.has(p.id));
              if (regular.length === 0) return null;
              return (
                <div className="animate-fade-in">
                  {filteredList.some(p => LEGENDARY_IDS.has(p.id)) && (
                    <div className="flex items-center gap-3 mb-6 px-1 pt-4">
                      <h2 className="text-2xl font-black text-white/40 tracking-tight uppercase">
                        All Pokemon
                      </h2>
                      <div className="h-px flex-1 bg-white/10 rounded-full ml-4" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {regular.map((pokemon) => (
                      <MemoizedPokemonCard
                        key={`regular-${pokemon.id}`}
                        id={pokemon.id}
                        name={pokemon.name}
                        types={pokemon.types}
                        height={pokemon.height}
                        weight={pokemon.weight}
                        onClick={() => handlePokemonClick(pokemon)}
                        isSelected={selectedPokemon?.id === pokemon.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Load More Trigger */}
            {!searchQuery && !selectedType && !showLegendariesOnly && selectedGen === 0 && visibleCount < TOTAL_POKEMON && (
              <div ref={loadMoreRef} className="text-center py-6">
                {loadingMore ? (
                  <LoadingSpinner message="Loading..." />
                ) : (
                  <button
                    onClick={loadMorePokemon}
                    className="px-6 py-3 rounded-full bg-[#FACC15] text-[#1E3A5F] font-bold hover:bg-yellow-400 transition-all duration-150 hover:scale-105"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pokemon Detail Modal */}
      {selectedPokemon && (
        <PokemonDetail
          pokemon={selectedPokemon}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
});
