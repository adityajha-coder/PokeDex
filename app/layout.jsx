import { Poppins, Luckiest_Guy } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

const pokemonFont = Luckiest_Guy({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pokemon',
})

export const viewport = {
  themeColor: '#FACC15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export const metadata = {
  title: 'POKEDEX DB | Complete Pokemon Database',
  description: 'POKEDEX DB - Your ultimate Pokemon database with all generations, type matchup calculator, and evolution tracker. Gotta catch em all!',
  generator: 'v0.app',
  manifest: '/manifest.json',
  keywords: ['pokemon', 'pokedex', 'pwa', 'type matchup', 'evolution', 'pokemon database'],
  authors: [{ name: 'PokeDex' }],
  openGraph: {
    title: 'POKEDEX DB',
    description: 'Complete Pokemon database with all generations',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'POKEDEX DB',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

import { Toaster } from '@/components/ui/toaster'

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${poppins.variable} ${pokemonFont.variable} font-sans antialiased text-white`}>
        {children}
        <Toaster />
        <Script id="service-worker" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then((registration) => {
                    console.log('SW registered:', registration);
                    registration.onupdatefound = () => {
                      const installingWorker = registration.installing;
                      if (installingWorker) {
                        installingWorker.onstatechange = () => {
                          if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                              console.log('New content available; please refresh.');
                            } else {
                              console.log('Content is cached for offline use.');
                            }
                          }
                        };
                      }
                    };
                  })
                  .catch((error) => {
                    console.log('SW registration failed:', error);
                  });
              });
            }
          `}
        </Script>
        <Analytics />
      </body>
    </html>
  )
}
