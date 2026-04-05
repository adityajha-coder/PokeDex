'use client';

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { 
  Pokemon, 
  fetchPokemon, 
  fetchPokemonList,
  capitalize,
  typeColors
} from '@/lib/pokemon-api';
import { PokemonCard } from './pokemon-card';
import { PokemonDetail } from './pokemon-detail';
import { SearchBar } from './search-bar';
import { LoadingSpinner, GridSkeleton } from './loading-spinner';
import { ChevronDown, Filter } from 'lucide-react';

const POKEMON_TYPES = Object.keys(typeColors);
const TOTAL_POKEMON = 1025; // All generations
const INITIAL_LOAD = 50;
const BATCH_SIZE = 50;

// Cache for Pokemon data - persists across renders
const pokemonCache = new Map<number, Pokemon>();

// Memoized Pokemon Card wrapper
const MemoizedPokemonCard = memo(PokemonCard);

export const Pokedex = memo(function Pokedex() {
  const [allPokemonBasic, setAllPokemonBasic] = useState<{name: string; id: number}[]>([]);
  const [loadedPokemon, setLoadedPokemon] = useState<Pokemon[]>([]);
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD);
  const [selectedGen, setSelectedGen] = useState<number>(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Generation ranges
  const generations = useMemo(() => [
    { gen: 0, name: 'All', start: 1, end: TOTAL_POKEMON },
    { gen: 1, name: 'Gen 1', start: 1, end: 151 },
    { gen: 2, name: 'Gen 2', start: 152, end: 251 },
    { gen: 3, name: 'Gen 3', start: 252, end: 386 },
    { gen: 4, name: 'Gen 4', start: 387, end: 493 },
    { gen: 5, name: 'Gen 5', start: 494, end: 649 },
    { gen: 6, name: 'Gen 6', start: 650, end: 721 },
    { gen: 7, name: 'Gen 7', start: 722, end: 809 },
    { gen: 8, name: 'Gen 8', start: 810, end: 905 },
    { gen: 9, name: 'Gen 9', start: 906, end: 1025 },
  ], []);

  // Load all Pokemon basic info at once (just names and IDs - very fast)
  useEffect(() => {
    async function loadAllPokemonBasic() {
      try {
        const listData = await fetchPokemonList(TOTAL_POKEMON, 0);
        const basicList = listData.results.map((p, index) => ({
          name: p.name,
          id: index + 1
        }));
        setAllPokemonBasic(basicList);
        
        // Load first batch of full Pokemon data
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
  const loadPokemonBatch = useCallback(async (batch: {name: string; id: number}[]) => {
    const toLoad = batch.filter(p => !pokemonCache.has(p.id));
    
    if (toLoad.length === 0) {
      const cached = batch.map(p => pokemonCache.get(p.id)!).filter(Boolean);
      setLoadedPokemon(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPokemon = cached.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPokemon];
      });
      return;
    }

    // Load in parallel with Promise.allSettled for better error handling
    const results = await Promise.allSettled(
      toLoad.map(p => fetchPokemon(p.id))
    );

    const newPokemon: Pokemon[] = [];
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

  // Intersection Observer for infinite scroll
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
  const handleGenerationChange = useCallback(async (gen: number) => {
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

    return filtered;
  }, [searchQuery, selectedType, loadedPokemon, selectedGen, generations]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
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
      }).catch(() => {});
    }
  }, []);

  // Handle Pokemon card click
  const handlePokemonClick = useCallback((pokemon: Pokemon) => {
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
        <div className="text-center mb-6">
          <h1 
            className="text-4xl md:text-6xl font-extrabold text-[#FACC15] mb-3"
            style={{ textShadow: '3px 3px 0 #1E3A5F' }}
          >
            POKEDEX
          </h1>
          <p className="text-white/70 text-base max-w-xl mx-auto">
            Browse {TOTAL_POKEMON.toLocaleString()} Pokemon across all generations
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <SearchBar 
            onSearch={handleSearch} 
            isLoading={loading}
          />
        </div>

        {/* Generation Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {generations.map(g => (
            <button
              key={g.gen}
              onClick={() => handleGenerationChange(g.gen)}
              disabled={loadingMore}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 disabled:opacity-50 ${
                selectedGen === g.gen 
                  ? 'bg-[#FACC15] text-[#1E3A5F] scale-105' 
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Type Filter */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors font-medium text-sm"
          >
            <Filter size={16} />
            <span>Filter by Type</span>
            <ChevronDown 
              size={16} 
              className={`transition-transform duration-150 ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>

          {showFilters && (
            <div className="flex flex-wrap justify-center gap-2 mt-3 animate-slide-up max-w-4xl mx-auto">
              <button
                onClick={() => setSelectedType('')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  !selectedType 
                    ? 'bg-white text-[#1E3A5F] scale-105' 
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                All
              </button>
              {POKEMON_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => setSelectedType(type === selectedType ? '' : type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all text-white ${
                    selectedType === type ? 'ring-2 ring-white scale-105' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: typeColors[type] }}
                >
                  {capitalize(type)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results Count */}
        {!loading && (
          <p className="text-center text-white/50 mb-4 text-xs">
            {loadingMore && selectedGen > 0 ? (
              <span>Loading {generations.find(g => g.gen === selectedGen)?.name} Pokemon...</span>
            ) : (
              <span>{filteredList.length} Pokemon {selectedType && `(${capitalize(selectedType)})`} {selectedGen > 0 && `• ${generations.find(g => g.gen === selectedGen)?.name}`}</span>
            )}
          </p>
        )}

        {/* Pokemon Grid */}
        {loading ? (
          <GridSkeleton count={12} />
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 opacity-40">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="2"/>
                <line x1="32" y1="32" x2="68" y2="68" stroke="white" strokeWidth="2"/>
                <line x1="68" y1="32" x2="32" y2="68" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
            <h3 className="text-white text-lg font-bold mb-1">No Pokemon Found</h3>
            <p className="text-white/50 text-sm">Try a different search or filter</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredList.map((pokemon) => (
                <MemoizedPokemonCard
                  key={pokemon.id}
                  id={pokemon.id}
                  name={pokemon.name}
                  types={pokemon.types}
                  onClick={() => handlePokemonClick(pokemon)}
                  isSelected={selectedPokemon?.id === pokemon.id}
                />
              ))}
            </div>

            {/* Load More Trigger */}
            {!searchQuery && !selectedType && selectedGen === 0 && visibleCount < TOTAL_POKEMON && (
              <div ref={loadMoreRef} className="text-center mt-8 py-6">
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
          </>
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
