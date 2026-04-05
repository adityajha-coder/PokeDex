'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export const SearchBar = memo(function SearchBar({ onSearch, isLoading, placeholder = 'Search Pokemon by name or ID...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search query - faster for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  // Trigger search when debounced query changes
  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleClear = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    onSearch('');
  }, [onSearch]);

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#1E3A5F]/50">
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Search size={20} />
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-[#FACC15] text-[#1E3A5F] placeholder-[#1E3A5F]/50 font-semibold outline-none ring-4 ring-transparent focus:ring-white/30 transition-all duration-150 shadow-lg"
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-[#1E3A5F]/10 transition-colors text-[#1E3A5F]/50 hover:text-[#1E3A5F]"
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Search Tips */}
      <div className="flex justify-center gap-3 mt-3 text-white/50 text-xs">
        <span>Try: Pikachu</span>
        <span className="text-white/30">|</span>
        <span>Try: #25</span>
        <span className="text-white/30">|</span>
        <span>Try: Electric</span>
      </div>
    </div>
  );
});
