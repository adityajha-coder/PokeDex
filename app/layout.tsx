import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins',
})

export const viewport: Viewport = {
  themeColor: '#FACC15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export const metadata: Metadata = {
  title: 'PokeDex | Complete Pokemon Database',
  description: 'PokeDex - Your ultimate Pokemon database with all generations, type matchup calculator, and evolution tracker. Gotta catch em all!',
  generator: 'v0.app',
  manifest: '/manifest.json',
  keywords: ['pokemon', 'pokedex', 'pwa', 'type matchup', 'evolution', 'pokemon database'],
  authors: [{ name: 'PokeDex' }],
  openGraph: {
    title: 'PokeDex',
    description: 'Complete Pokemon database with all generations',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PokeDex',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${poppins.variable} font-sans antialiased`}>
        {children}
        <Script id="service-worker" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                  console.log('SW registered:', registration);
                })
                .catch((error) => {
                  console.log('SW registration failed:', error);
                });
            }
          `}
        </Script>
        <Analytics />
      </body>
    </html>
  )
}
