import { Header } from '@/components/pokemon/header';
import { Pokedex } from '@/components/pokemon/pokedex';

export default function Home() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <Pokedex />
    </main>
  );
}
