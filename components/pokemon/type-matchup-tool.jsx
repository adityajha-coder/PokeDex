'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import Image from 'next/image';
import { Swords, Shield, Search, X, Zap, Ban } from 'lucide-react';
import {
  fetchPokemon, fetchPokemonList, typeColors, typeEffectiveness,
  capitalize, getOfficialArtwork, extractIdFromUrl, POKEMON_LIMIT
} from '@/lib/pokemon-api';

export const TypeMatchupTool = memo(function TypeMatchupTool() {
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [allPokemon, setAllPokemon] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    async function loadList() {
      const list = await fetchPokemonList(POKEMON_LIMIT, 0);
      setAllPokemon(list.results.map((p) => ({ name: p.name, id: extractIdFromUrl(p.url) })));
    }
    loadList();
  }, []);

  useEffect(() => {
    if (!searchQuery) { setSearchResults([]); return; }
    const results = allPokemon.filter(p => p.name.includes(searchQuery.toLowerCase()) || p.id.toString() === searchQuery.toLowerCase()).slice(0, 10);
    setSearchResults(results);
  }, [searchQuery, allPokemon]);

  const selectPokemon = useCallback(async (nameOrId) => {
    setLoading(true); setShowSearch(false); setSearchQuery('');
    try {
      const pokemon = await fetchPokemon(nameOrId);
      setSelectedPokemon(pokemon);
    } catch (e) { } finally { setLoading(false); }
  }, []);

  const calculateMatchups = useCallback(() => {
    if (!selectedPokemon) return { weaknesses: [], resistances: [], immunities: [], offensive: [] };
    const types = selectedPokemon.types.map(t => t.type.name);
    const damageMultipliers = {};
    const offensiveMultipliers = {};
    Object.keys(typeColors).forEach(type => { damageMultipliers[type] = 1; offensiveMultipliers[type] = 1; });
    types.forEach(pokemonType => {
      Object.keys(typeColors).forEach(attackingType => {
        const effectiveness = typeEffectiveness[attackingType]?.[pokemonType];
        if (effectiveness !== undefined) damageMultipliers[attackingType] *= effectiveness;
      });
      Object.entries(typeEffectiveness[pokemonType] || {}).forEach(([def, mult]) => {
        offensiveMultipliers[def] = Math.max(offensiveMultipliers[def], mult);
      });
    });
    const weaknesses = [], resistances = [], immunities = [], offensive = [];
    Object.entries(damageMultipliers).forEach(([type, multiplier]) => {
      if (multiplier === 0) immunities.push({ type, multiplier });
      else if (multiplier > 1) weaknesses.push({ type, multiplier });
      else if (multiplier < 1) resistances.push({ type, multiplier });
    });
    Object.entries(offensiveMultipliers).forEach(([type, multiplier]) => { if (multiplier > 1) offensive.push({ type, multiplier }); });
    weaknesses.sort((a, b) => b.multiplier - a.multiplier);
    resistances.sort((a, b) => a.multiplier - b.multiplier);
    offensive.sort((a, b) => b.multiplier - a.multiplier);
    return { weaknesses, resistances, immunities, offensive };
  }, [selectedPokemon]);

  const matchups = calculateMatchups();

  return (
    <div className="min-h-screen pt-24 pb-10 px-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="blob-red -top-10 -left-10" /><div className="blob-yellow top-0 right-0 w-48 h-48" />
      </div>
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-6xl md:text-8xl pokemon-logo mb-6 tracking-widest uppercase">ANALYZER</h1>
          <p className="text-white text-lg font-bold max-w-xl mx-auto uppercase tracking-wider mb-2">Type Synergy & Tactics</p>
          <p className="text-white/60 text-sm">Discover tactical advantages and vulnerabilities for any Pokemon</p>
        </div>
        <div className="mb-10 relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full max-w-md mx-auto flex items-center justify-center gap-4 px-8 py-5 rounded-2xl bg-[#FACC15] border border-black/10 text-[#1E3A5F] font-bold text-lg shadow-xl group"
          >
            <Search className="group-hover:scale-110 transition-transform" size={24} />
            <span className="capitalize">{selectedPokemon ? selectedPokemon.name : 'Target Selection'}</span>
          </button>
          {showSearch && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-full max-w-md mt-4 bg-[#1E3A5F] backdrop-blur-2xl rounded-[2rem] shadow-2xl overflow-hidden z-20 border border-white/10 animate-slide-up">
              <div className="relative p-4 border-b border-white/10">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan database..."
                  className="w-full px-6 py-4 rounded-full bg-black/20 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#FACC15] font-semibold transition-all"
                  autoFocus
                />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-8 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><X size={20} /></button>}
              </div>
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                {searchResults.length > 0 ? searchResults.map((p) => (
                  <button key={p.id} onClick={() => selectPokemon(p.id)} className="w-full flex items-center gap-5 px-6 py-4 hover:bg-black/20 transition-colors text-left group border-b border-white/5 last:border-0">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center p-2 group-hover:scale-110 group-hover:bg-[#FACC15]/20 transition-all duration-300"><Image src={getOfficialArtwork(p.id)} alt={p.name} width={40} height={40} className="object-contain" /></div>
                    <div className="flex flex-col"><span className="text-white font-bold capitalize text-sm tracking-wide">{p.name}</span><span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">DNA-INDEX #{p.id.toString().padStart(3, '0')}</span></div>
                    <Swords className="ml-auto text-white/0 group-hover:text-[#FACC15] transition-all" size={18} />
                  </button>
                )) : searchQuery ? <div className="p-10 text-center space-y-4"><p className="text-white/40 font-bold uppercase tracking-widest text-sm">No Matches Found</p></div> : (
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[{ name: 'Pikachu', id: 25 }, { name: 'Charizard', id: 6 }, { name: 'Mewtwo', id: 150 }, { name: 'Gengar', id: 94 }, { name: 'Lucario', id: 448 }, { name: 'Greninja', id: 658 }].map((p) => (
                        <button
                          key={p.id}
                          onClick={() => selectPokemon(p.id)}
                          className="px-6 py-4 rounded-full bg-white/5 text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#FACC15] hover:text-[#1E3A5F] hover:shadow-[0_10px_30px_rgba(250,204,21,0.2)] transition-all duration-300 border border-white/10 hover:border-[#FACC15] text-center"
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
              <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#EF4444" stroke="#1a1a1a" strokeWidth="4" /><rect x="0" y="48" width="100" height="4" fill="#1a1a1a" /><path d="M 0 50 A 48 48 0 0 1 100 50" fill="#EF4444" /><path d="M 0 50 A 48 48 0 0 0 100 50" fill="#fff" /><circle cx="50" cy="50" r="16" fill="#fff" stroke="#1a1a1a" strokeWidth="4" /></svg>
            </div>
          </div>
        )}
        {selectedPokemon && !loading && (
          <div className="animate-bounce-in">
            <div
              className="rounded-[2.5rem] p-8 mb-10 shadow-2xl relative overflow-hidden group transition-all border-t-8 border-white/20"
              style={{
                backgroundColor: typeColors[selectedPokemon.types[0]?.type.name || 'normal'],
                boxShadow: `0 20px 40px ${typeColors[selectedPokemon.types[0]?.type.name || 'normal']}66`
              }}
            >
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="relative w-48 h-48 animate-float">
                  <div className="absolute inset-0 bg-white/25 rounded-full blur-2xl flex-shrink-0" />
                  <Image src={getOfficialArtwork(selectedPokemon.id)} alt={selectedPokemon.name} fill className="object-contain drop-shadow-2xl" />
                </div>
                <div className="text-center md:text-left space-y-4 max-w-xl">
                  <div>
                    <p className="text-white/60 font-black text-sm tracking-[0.4em] uppercase mb-1">Target #{selectedPokemon.id.toString().padStart(3, '0')}</p>
                    <h2 className="text-5xl md:text-6xl font-black text-white capitalize tracking-tight leading-tight drop-shadow-sm">{selectedPokemon.name}</h2>
                  </div>
                  <div className="flex gap-3 justify-center md:justify-start flex-wrap">{selectedPokemon.types.map(({ type }) => <span key={type.name} className="px-6 py-2 rounded-xl text-xs font-black text-white uppercase tracking-widest shadow-md border border-white/20 bg-white/20 backdrop-blur-md">{type.name}</span>)}</div>
                </div>
              </div>

              {/* Decorative Background Elements */}
              <div className="absolute -right-20 -bottom-20 opacity-15 pointer-events-none group-hover:rotate-12 transition-transform duration-700">
                <svg width="400" height="400" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="4"></circle>
                  <path d="M 0 50 L 100 50" fill="none" stroke="white" strokeWidth="4"></path>
                  <circle cx="50" cy="50" r="16" fill="none" stroke="white" strokeWidth="4"></circle>
                  <circle cx="50" cy="50" r="10" fill="white"></circle>
                </svg>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#FACC15] rounded-[2.5rem] p-8 shadow-2xl border-t-4 border-t-red-500 group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(239,68,68,0.2)]">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><Swords className="text-red-600" size={24} /><h3 className="text-2xl font-black text-[#1E3A5F] uppercase tracking-tight">Weak Against</h3></div></div>
                <p className="text-[#1E3A5F]/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Attacks that deal extra damage</p>
                {matchups.weaknesses.length > 0 ? (
                  <div className="flex flex-wrap gap-2">{matchups.weaknesses.map(({ type, multiplier }) => <div key={type} className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs shadow-md hover:scale-105 transition-transform border border-black/10" style={{ backgroundColor: `${typeColors[type]}` }}><span className="capitalize">{type}</span><span className={`px-2 py-1 rounded-lg ${multiplier >= 4 ? 'bg-red-600' : 'bg-black/20'} font-black`}>{multiplier}x</span></div>)}</div>
                ) : <p className="text-[#1E3A5F]/40 text-sm font-black italic">No tactical vulnerabilities detected</p>}
              </div>
              <div className="bg-[#FACC15] rounded-[2.5rem] p-8 shadow-2xl border-t-4 border-t-emerald-500 group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(16,185,129,0.2)]">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><Shield className="text-emerald-600" size={24} /><h3 className="text-2xl font-black text-[#1E3A5F] uppercase tracking-tight">Resistant To</h3></div></div>
                <p className="text-[#1E3A5F]/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Attacks that deal reduced damage</p>
                {matchups.resistances.length > 0 ? (
                  <div className="flex flex-wrap gap-2">{matchups.resistances.map(({ type, multiplier }) => <div key={type} className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs shadow-md hover:scale-105 transition-transform border border-black/10" style={{ backgroundColor: `${typeColors[type]}` }}><span className="capitalize">{type}</span><span className="bg-black/20 px-2 py-1 rounded-lg font-black">{multiplier}x</span></div>)}</div>
                ) : <p className="text-[#1E3A5F]/40 text-sm font-black italic">Standard defensive profile</p>}
              </div>
              <div className="bg-[#FACC15] rounded-[2.5rem] p-8 shadow-2xl border-t-4 border-t-blue-500 group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(59,130,246,0.2)]">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><Ban className="text-blue-600" size={24} /><h3 className="text-2xl font-black text-[#1E3A5F] uppercase tracking-tight">Immune To</h3></div></div>
                <p className="text-[#1E3A5F]/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Types with zero effect penalty</p>
                {matchups.immunities.length > 0 ? (
                  <div className="flex flex-wrap gap-2">{matchups.immunities.map(({ type }) => <div key={type} className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs shadow-md hover:scale-105 transition-transform border border-black/10" style={{ backgroundColor: `${typeColors[type]}` }}><span className="capitalize">{type}</span><span className="bg-blue-600 px-2 py-1 rounded-lg font-black text-white">0x</span></div>)}</div>
                ) : <p className="text-[#1E3A5F]/40 text-sm font-black italic">Full spectrum vulnerability</p>}
              </div>
              <div className="bg-[#FACC15] rounded-[2.5rem] p-8 shadow-2xl border-t-4 border-t-[#1E3A5F] group hover:-translate-y-1 transition-all hover:shadow-[0_20px_40px_rgba(30,58,95,0.2)]">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-3"><Zap className="text-[#1E3A5F]" size={24} /><h3 className="text-2xl font-black text-[#1E3A5F] uppercase tracking-tight">Offensive Edge</h3></div></div>
                <p className="text-[#1E3A5F]/60 text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Target types you can annihilate</p>
                {matchups.offensive.length > 0 ? (
                  <div className="flex flex-wrap gap-2">{matchups.offensive.map(({ type, multiplier }) => <div key={type} className="flex items-center gap-2 p-1 pl-3 pr-2 rounded-xl text-white font-bold text-xs shadow-md hover:scale-105 transition-transform border border-black/10" style={{ backgroundColor: `${typeColors[type]}` }}><span className="capitalize">{type}</span><span className="bg-black/20 px-2 py-1 rounded-lg font-black">{multiplier}x</span></div>)}</div>
                ) : <p className="text-[#1E3A5F]/40 text-sm font-black italic">Neutral offensive output</p>}
              </div>
            </div>
          </div>
        )}
        {!selectedPokemon && !loading && (
          <div className="text-center py-20 flex flex-col items-center justify-center animate-fade-in">
            <div className="w-28 h-28 mb-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Search className="text-white/20" size={40} strokeWidth={1.5} />
            </div>

            <h3 className="text-white text-xl font-bold mb-3 tracking-wide">
              No Target Selected
            </h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto leading-relaxed">
              Scan the database to analyze tactical advantages and vulnerabilities.
            </p>
          </div>
        )}
      </div>
    </div>
  );
});
