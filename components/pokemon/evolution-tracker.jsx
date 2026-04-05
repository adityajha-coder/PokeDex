'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import Image from 'next/image';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  fetchPokemon, fetchPokemonSpecies, fetchEvolutionChain, fetchPokemonList,
  capitalize, getOfficialArtwork, typeColors, extractIdFromUrl, POKEMON_LIMIT 
} from '@/lib/pokemon-api';

const typeWeaknesses = {
  normal: ['fighting'], fire: ['water', 'ground', 'rock'], water: ['electric', 'grass'],
  electric: ['ground'], grass: ['fire', 'ice', 'poison', 'flying', 'bug'], ice: ['fire', 'fighting', 'rock', 'steel'],
  fighting: ['flying', 'psychic', 'fairy'], poison: ['ground', 'psychic'], ground: ['water', 'grass', 'ice'],
  flying: ['electric', 'ice', 'rock'], psychic: ['bug', 'ghost', 'dark'], bug: ['fire', 'flying', 'rock'],
  rock: ['water', 'grass', 'fighting', 'ground', 'steel'], ghost: ['ghost', 'dark'], dragon: ['ice', 'dragon', 'fairy'],
  dark: ['fighting', 'bug', 'fairy'], steel: ['fire', 'fighting', 'ground'], fairy: ['poison', 'steel'],
};

export const EvolutionTracker = memo(function EvolutionTracker() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allPokemon, setAllPokemon] = useState([]);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [evolutionData, setEvolutionData] = useState([]);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [landingSearch, setLandingSearch] = useState('');
  const [landingResults, setLandingResults] = useState([]);
  const searchInputRef = useRef(null);
  const landingInputRef = useRef(null);

  useEffect(() => {
    async function loadPokemonList() {
      const list = await fetchPokemonList(POKEMON_LIMIT, 0);
      setAllPokemon(list.results.map((p) => ({ name: p.name, id: extractIdFromUrl(p.url) })));
    }
    loadPokemonList();
  }, []);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const results = allPokemon.filter(p => p.name.includes(searchQuery.toLowerCase()) || p.id.toString() === searchQuery.toLowerCase()).slice(0, 8);
    setSearchResults(results);
  }, [searchQuery, allPokemon]);

  useEffect(() => {
    if (!landingSearch) { setLandingResults([]); return; }
    const results = allPokemon.filter(p => p.name.includes(landingSearch.toLowerCase()) || p.id.toString() === landingSearch.toLowerCase()).slice(0, 6);
    setLandingResults(results);
  }, [landingSearch, allPokemon]);

  useEffect(() => { if (showSearch && searchInputRef.current) searchInputRef.current.focus(); }, [showSearch]);

  const parseEvolutionChain = useCallback(async (chain) => {
    const stages = [];
    let currentNode = chain;
    while (currentNode) {
      try {
        const pokemon = await fetchPokemon(currentNode.species.name);
        const species = await fetchPokemonSpecies(currentNode.species.name);
        const details = currentNode.evolution_details[0];
        stages.push({ 
          pokemon, species, 
          evolutionDetails: details ? { trigger: details.trigger?.name || 'unknown', minLevel: details.min_level || undefined, item: details.item?.name || undefined } : null 
        });
        currentNode = currentNode.evolves_to[0];
      } catch (e) { break; }
    }
    return stages;
  }, []);

  const selectPokemonById = useCallback(async (nameOrId) => {
    setLoading(true); setShowSearch(false); setSearchQuery('');
    try {
      const pokemon = await fetchPokemon(nameOrId);
      setSelectedPokemon(pokemon);
      const species = await fetchPokemonSpecies(nameOrId);
      setSelectedSpecies(species);
      const evolutionChain = await fetchEvolutionChain(species.evolution_chain.url);
      const stages = await parseEvolutionChain(evolutionChain.chain);
      setEvolutionData(stages);
      const idx = stages.findIndex(s => s.pokemon.id === pokemon.id);
      setActiveStageIndex(idx >= 0 ? idx : 0);
    } catch (e) { setEvolutionData([]); } finally { setLoading(false); }
  }, [parseEvolutionChain]);

  const getDescription = (s) => s?.flavor_text_entries.find(e => e.language.name === 'en')?.flavor_text.replace(/[\n\f\r]/g, ' ') || '';
  const getCategory = (s) => s?.genera.find(g => g.language.name === 'en')?.genus.replace(' Pokémon', '') || '';
  const getWeaknesses = (p) => typeWeaknesses[p?.types[0]?.type.name || 'normal'] || [];
  const getEvolvesTo = () => activeStageIndex < evolutionData.length - 1 ? capitalize(evolutionData[activeStageIndex + 1].pokemon.name) : null;

  const goToStage = (index) => {
    if (index >= 0 && index < evolutionData.length) {
      setActiveStageIndex(index);
      const stage = evolutionData[index];
      setSelectedPokemon(stage.pokemon);
      setSelectedSpecies(stage.species);
    }
  };

  const activePokemon = evolutionData[activeStageIndex]?.pokemon || selectedPokemon;
  const activeSpecies = evolutionData[activeStageIndex]?.species || selectedSpecies;
  const primaryColor = typeColors[activePokemon?.types[0]?.type.name || 'electric'] || '#F8D030';

  return (
    <div className="min-h-screen pt-20 pb-6 px-4 md:px-8 relative overflow-hidden">
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm" onClick={() => setShowSearch(false)}>
          <div className="w-full max-w-lg mx-4 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#1E3A5F] rounded-3xl shadow-2xl overflow-hidden border-2 border-[#FACC15]">
              <div className="relative p-4">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-white/50" size={20} />
                <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search Pokemon by name or ID..." className="w-full pl-12 pr-10 py-4 rounded-2xl bg-white/10 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#FACC15] text-lg" />
                <button onClick={() => setShowSearch(false)} className="absolute right-7 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {searchResults.length > 0 ? searchResults.map((p) => (
                  <button key={p.id} onClick={() => selectPokemonById(p.id)} className="w-full flex items-center gap-4 px-6 py-3 hover:bg-white/10 transition-colors text-left">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
                      <Image src={getOfficialArtwork(p.id)} alt={p.name} width={44} height={44} className="object-contain" />
                    </div>
                    <span className="text-white font-semibold capitalize text-lg">{capitalize(p.name)}</span>
                    <span className="text-white/40 text-sm ml-auto font-mono">#{p.id.toString().padStart(3, '0')}</span>
                  </button>
                )) : searchQuery ? <p className="text-white/40 text-center py-8 text-lg">No Pokemon found</p> : (
                  <div className="p-6">
                    <p className="text-white/50 text-sm mb-4 font-medium">Popular evolution lines:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ name: 'Pikachu', id: 25 }, { name: 'Charmander', id: 4 }, { name: 'Eevee', id: 133 }, { name: 'Magikarp', id: 129 }, { name: 'Dratini', id: 147 }, { name: 'Bulbasaur', id: 1 }].map((p) => (
                        <button key={p.id} onClick={() => selectPokemonById(p.id)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-colors">
                          <Image src={getOfficialArtwork(p.id)} alt={p.name} width={28} height={28} className="object-contain" />{p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-20 h-20 animate-pokeball-spin">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#EF4444" stroke="#1a1a1a" strokeWidth="4"/><rect x="0" y="48" width="100" height="4" fill="#1a1a1a"/><path d="M 0 50 A 48 48 0 0 1 100 50" fill="#EF4444"/><path d="M 0 50 A 48 48 0 0 0 100 50" fill="#fff"/>
              <circle cx="50" cy="50" r="16" fill="#fff" stroke="#1a1a1a" strokeWidth="4"/><circle cx="50" cy="50" r="8" fill="#1a1a1a"/>
            </svg>
          </div>
        </div>
      )}

      {!loading && activePokemon && activeSpecies && (
        <div className="max-w-7xl mx-auto relative z-10 animate-bounce-in">
          <div className="relative rounded-[2rem] overflow-hidden shadow-2xl" style={{ background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`, minHeight: '70vh' }}>
            <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: primaryColor }} />
            <div className="absolute -right-20 -bottom-20 w-80 h-80 opacity-5 pointer-events-none text-white">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="0" y="48" width="100" height="4" fill="currentColor"/><circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
              <button onClick={() => setShowSearch(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 backdrop-blur-sm text-white font-semibold hover:bg-white/20 transition-all border border-white/10">
                <Search size={18} /><span className="hidden sm:inline">Search</span>
              </button>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 md:p-10 lg:p-12">
              <div className="hidden lg:flex lg:col-span-1 flex-col justify-between py-8">
                <div className="flex flex-col gap-8">
                  <span className="text-xs font-bold tracking-[0.3em] text-white/20 uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>NAME</span>
                  <span className="text-xs font-bold tracking-[0.3em] text-white/40 uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>ABOUT</span>
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col justify-center gap-5 pt-8 lg:pt-16">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white uppercase tracking-tight leading-none">{activePokemon.name}</h1>
                    <div className="hidden sm:block h-1 w-12 rounded-full" style={{ backgroundColor: primaryColor }} />
                  </div>
                  <p className="text-white/30 font-bold text-lg">#{activePokemon.id.toString().padStart(3, '0')}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {getCategory(activeSpecies) && <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-semibold border border-white/15">Category: {getCategory(activeSpecies)}</span>}
                  {getEvolvesTo() && <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-semibold border border-white/15">Evolves to: {getEvolvesTo()}</span>}
                  {evolutionData.length === 1 && <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-semibold border border-white/15">Does not evolve</span>}
                  {getWeaknesses(activePokemon).length > 0 && <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/10 text-white text-sm font-semibold border border-white/15">Weakness: {capitalize(getWeaknesses(activePokemon)[0])}</span>}
                </div>

                <div className="flex gap-2">
                  {activePokemon.types.map(({ type }) => (
                    <span key={type.name} className="px-4 py-1.5 rounded-full text-white text-xs font-bold uppercase tracking-wider shadow-md" style={{ backgroundColor: typeColors[type.name] || '#888' }}>{type.name}</span>
                  ))}
                </div>

                <p className="text-white text-sm leading-relaxed max-w-sm">{getDescription(activeSpecies)}</p>

                <div className="grid grid-cols-3 gap-3 max-w-xs mt-2">
                  {activePokemon.stats.slice(0, 3).map((s) => (
                    <div key={s.stat.name} className="text-center bg-white/10 rounded-xl p-2">
                      <p className="text-white/40 text-[10px] font-bold uppercase">{s.stat.name === 'special-attack' ? 'Sp.Atk' : s.stat.name === 'special-defense' ? 'Sp.Def' : capitalize(s.stat.name)}</p>
                      <p className="text-white text-lg font-extrabold">{s.base_stat}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col items-center justify-center relative py-6">
                <div className="flex gap-4 my-4">
                  <div className="flex flex-col items-center px-4 py-2 bg-white/10 rounded-2xl border border-white/5">
                    <span className="text-white/40 text-[10px] font-black uppercase tracking-wider">Height</span>
                    <span className="text-white font-bold text-sm">{(activePokemon.height / 10).toFixed(1)}m</span>
                  </div>
                  <div className="flex flex-col items-center px-4 py-2 bg-white/10 rounded-2xl border border-white/5">
                    <span className="text-white/40 text-[10px] font-black uppercase tracking-wider">Weight</span>
                    <span className="text-white font-bold text-sm">{(activePokemon.weight / 10).toFixed(1)}kg</span>
                  </div>
                </div>

                <div className="relative w-56 h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 animate-float">
                  <div className="absolute inset-8 rounded-full blur-3xl opacity-20" style={{ backgroundColor: primaryColor }} />
                  <Image src={getOfficialArtwork(activePokemon.id)} alt={activePokemon.name} fill className="object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)]" priority />
                </div>

                {evolutionData.length > 1 && (
                  <div className="flex items-center gap-6 mt-6">
                    <button onClick={() => goToStage(activeStageIndex - 1)} disabled={activeStageIndex === 0} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={20} className="text-white" /></button>
                    <div className="flex gap-2">{evolutionData.map((_, i) => <button key={i} onClick={() => goToStage(i)} className={`w-2.5 h-2.5 rounded-full transition-all ${i === activeStageIndex ? 'bg-white scale-125' : 'bg-white/25 hover:bg-white/50'}`} />)}</div>
                    <button onClick={() => goToStage(activeStageIndex + 1)} disabled={activeStageIndex === evolutionData.length - 1} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={20} className="text-white" /></button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-3 flex flex-row lg:flex-col items-center lg:items-end justify-center gap-4 py-4 lg:py-8">
                {evolutionData.map((stage, index) => (
                  <button key={stage.pokemon.id} onClick={() => goToStage(index)} className={`group relative rounded-2xl overflow-hidden transition-all duration-300 ${index === activeStageIndex ? 'shadow-xl scale-105' : 'ring-1 ring-white/20 hover:ring-white/40 hover:scale-105 opacity-60 hover:opacity-100'}`} style={{ width: index === activeStageIndex ? '140px' : '110px', boxShadow: index === activeStageIndex ? `0 0 20px ${primaryColor}40` : 'none' }}>
                    <div className="aspect-square flex items-center justify-center p-3 relative" style={{ background: index === activeStageIndex ? `linear-gradient(135deg, ${typeColors[stage.pokemon.types[0]?.type.name] || '#888'}30, transparent)` : 'rgba(255,255,255,0.08)' }}>
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ backgroundColor: index === activeStageIndex ? primaryColor : 'rgba(255,255,255,0.15)' }}>{index + 1}</div>
                      <Image src={getOfficialArtwork(stage.pokemon.id)} alt={stage.pokemon.name} width={index === activeStageIndex ? 100 : 75} height={index === activeStageIndex ? 100 : 75} className="object-contain drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
                    </div>
                    <div className={`text-white text-center py-1.5 px-2 ${index === activeStageIndex ? 'text-xs' : 'text-[10px]'} font-bold capitalize truncate`} style={{ backgroundColor: index === activeStageIndex ? primaryColor + 'cc' : 'rgba(255,255,255,0.1)' }}>{capitalize(stage.pokemon.name)}</div>
                  </button>
                ))}
              </div>
            </div>

            {evolutionData.length > 0 && (
              <div className="relative z-10 px-6 md:px-10 lg:px-12 pb-8">
                <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-2xl p-6 md:p-8 shadow-2xl border border-white/5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-white text-base font-bold flex items-center gap-2"><span className="text-lg">📊</span> Base Stats</h3>
                    {evolutionData.length > 1 && (
                      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
                        {evolutionData.map((stage, i) => (
                          <button key={stage.pokemon.id} onClick={() => goToStage(i)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${i === activeStageIndex ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}>
                            <Image src={getOfficialArtwork(stage.pokemon.id)} alt={stage.pokemon.name} width={20} height={20} className="object-contain" />
                            <span className="hidden sm:inline">{capitalize(stage.pokemon.name)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const config = { hp: { l: 'HP', i: '❤️', c: '#4ade80' }, attack: { l: 'ATK', i: '⚔️', c: '#f87171' }, defense: { l: 'DEF', i: '🛡️', c: '#60a5fa' }, 'special-attack': { l: 'SP.ATK', i: '🔮', c: '#c084fc' }, 'special-defense': { l: 'SP.DEF', i: '🌀', c: '#2dd4bf' }, speed: { l: 'SPD', i: '⚡', c: '#fbbf24' } };
                      return Object.entries(config).map(([name, cfg]) => {
                        const val = activePokemon?.stats.find(s => s.stat.name === name)?.base_stat || 0;
                        const prev = activeStageIndex > 0 ? evolutionData[activeStageIndex - 1]?.pokemon.stats.find(s => s.stat.name === name)?.base_stat : null;
                        const diff = prev !== null ? val - prev : null;
                        return (
                          <div key={name} className="group flex items-center gap-3">
                            <div className="w-20 flex items-center gap-2 shrink-0"><span className="text-sm">{cfg.i}</span><span className="text-white/60 text-xs font-bold tracking-wide">{cfg.l}</span></div>
                            <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden relative group-hover:bg-white/8 transition-colors">
                              <div className="h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden" style={{ width: `${Math.max((val/255)*100, 3)}%`, backgroundColor: cfg.c, boxShadow: `0 0 12px ${cfg.c}40` }}>
                                <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                              </div>
                            </div>
                            <div className="w-10 text-right"><span className="text-white text-sm font-extrabold tabular-nums">{val}</span></div>
                            <div className="w-14 text-right shrink-0">{diff !== null && diff !== 0 ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${diff > 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>{diff > 0 ? `+${diff}` : diff}</span> : diff === 0 ? <span className="text-white/20 text-xs font-bold">—</span> : null}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative w-14 h-14">
                        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 44 44">
                          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                          <circle cx="22" cy="22" r="18" fill="none" stroke={primaryColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(activePokemon.stats.reduce((sum, s) => sum + s.base_stat, 0) / 720) * 113} 113`} className="transition-all duration-700" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center"><span className="text-white text-[11px] font-extrabold">{activePokemon.stats.reduce((sum, s) => sum + s.base_stat, 0)}</span></div>
                      </div>
                      <div>
                        <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest">Base Stat Total</p>
                        <p className="text-white text-lg font-extrabold">{activePokemon.stats.reduce((sum, s) => sum + s.base_stat, 0)} <span className="text-white/20 text-xs font-medium ml-1">/ 1025</span></p>
                      </div>
                    </div>
                    {(() => {
                      const bst = activePokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
                      const r = bst >= 580 ? { l: 'Legendary', c: '#fbbf24', b: 'bg-yellow-500/10' } : bst >= 500 ? { l: 'Excellent', c: '#4ade80', b: 'bg-green-500/10' } : bst >= 400 ? { l: 'Good', c: '#60a5fa', b: 'bg-blue-500/10' } : bst >= 300 ? { l: 'Average', c: '#a78bfa', b: 'bg-purple-500/10' } : { l: 'Basic', c: '#94a3b8', b: 'bg-slate-500/10' };
                      return <div className={`${r.b} border rounded-xl px-4 py-2 flex items-center gap-2`} style={{ borderColor: `${r.c}30` }}><div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.c, boxShadow: `0 0 8px ${r.c}` }} /><span className="text-xs font-bold" style={{ color: r.c }}>{r.l}</span></div>;
                    })()}
                  </div>
                </div>
              </div>
            )}
            <div className="lg:hidden px-6 pb-6"><button onClick={() => setShowSearch(true)} className="w-full py-3 rounded-2xl bg-white/10 text-white font-bold text-sm tracking-wider hover:bg-white/15 transition-colors">SEARCH MORE POKEMON</button></div>
          </div>
        </div>
      )}

      {!loading && !activePokemon && (
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-10 pt-8">
            <h1 className="text-5xl md:text-7xl pokemon-logo mb-6 tracking-widest">EVOLUTION TRACKER</h1>
            <p className="text-white text-lg font-bold max-w-xl mx-auto uppercase tracking-wider">Regional Evolution & Growth Analysis</p>
          </div>
          <div className="max-w-lg mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" size={22} />
              <input ref={landingInputRef} type="text" value={landingSearch} onChange={(e) => setLandingSearch(e.target.value)} placeholder="Search by name or ID..." className="w-full pl-14 pr-12 py-5 rounded-2xl bg-white/10 border border-white/15 text-white text-lg placeholder-white/30 outline-none focus:ring-2 focus:ring-[#FACC15] focus:border-transparent backdrop-blur-sm transition-all" />
              {landingSearch && <button onClick={() => setLandingSearch('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"><X size={20} /></button>}
            </div>
            {landingResults.length > 0 && (
              <div className="mt-2 bg-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden border border-white/10 animate-slide-up">
                {landingResults.map((p) => (
                  <button key={p.id} onClick={() => { setLandingSearch(''); selectPokemonById(p.id); }} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-white/10 transition-colors text-left">
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                      <Image src={getOfficialArtwork(p.id)} alt={p.name} width={40} height={40} className="object-contain" />
                    </div>
                    <div><p className="text-white font-bold capitalize">{p.name}</p><p className="text-white/40 text-xs font-mono">#{p.id.toString().padStart(3, '0')}</p></div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[{ n: 'Starter Lines', i: 1 }, { n: 'Eeveelutions', i: 133 }, { n: 'Pseudo-Legends', i: 147 }, { n: 'Trade Evos', i: 64 }].map((c) => (
              <button key={c.n} onClick={() => selectPokemonById(c.i)} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-white/10 transition-all hover:-translate-y-1 group">
                <div className="w-16 h-16 mx-auto mb-3 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Image src={getOfficialArtwork(c.i)} alt={c.n} width={48} height={48} className="object-contain" /></div>
                <p className="text-white font-bold text-xs uppercase tracking-wider">{c.n}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
