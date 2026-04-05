'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 bg-[#2563EB]/95 backdrop-blur-md border-b border-white/10">
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" prefetch={true} className="flex items-center gap-3 group">
          <Image
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"
            alt="Pikachu"
            width={44}
            height={44}
            className="drop-shadow-lg group-hover:scale-110 transition-transform duration-200"
            priority
          />
          <span className="text-2xl pokemon-logo">
            POKEDEX
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1 bg-white/10 rounded-full p-1">
          <NavLink href="/" active={pathname === '/'}>Pokedex</NavLink>
          <NavLink href="/type-matchup" active={pathname === '/type-matchup'}>Type Matchup</NavLink>
          <NavLink href="/evolution" active={pathname === '/evolution'}>Evolution</NavLink>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="md:hidden p-2 rounded-xl bg-[#FACC15] text-[#1E3A5F] hover:bg-yellow-400 transition-colors"
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#1E3A5F] border-t border-[#FACC15]/20 animate-slide-up shadow-2xl">
          <div className="flex flex-col p-4 gap-2">
            <MobileNavLink href="/" onClick={closeMenu} active={pathname === '/'}>
              Pokedex
            </MobileNavLink>
            <MobileNavLink href="/type-matchup" onClick={closeMenu} active={pathname === '/type-matchup'}>
              Type Matchup
            </MobileNavLink>
            <MobileNavLink href="/evolution" onClick={closeMenu} active={pathname === '/evolution'}>
              Evolution
            </MobileNavLink>
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children, active }) {
  return (
    <Link
      href={href}
      prefetch={true}
      className={`px-5 py-2 rounded-full font-semibold transition-all duration-150 text-sm ${active
        ? 'bg-[#FACC15] text-[#1E3A5F]'
        : 'text-white hover:bg-[#FACC15] hover:text-[#1E3A5F]'
        }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  children,
  onClick,
  active
}) {
  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onClick}
      className={`px-4 py-3 rounded-xl font-semibold transition-all duration-150 text-center ${active
        ? 'bg-[#FACC15] text-[#1E3A5F]'
        : 'text-white hover:bg-[#FACC15] hover:text-[#1E3A5F]'
        }`}
    >
      {children}
    </Link>
  );
}
