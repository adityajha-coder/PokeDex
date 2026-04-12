import { Header } from '@/components/pokemon/header';
import { SquadBuilder } from '@/components/pokemon/squad-builder';

export const metadata = {
  title: 'My Squad | PokeDex',
  description: 'Build your dream Pokemon team of 6. Get competitive analysis, type coverage, weaknesses, and suggestions.',
};

export default function SquadPage() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <SquadBuilder />
    </main>
  );
}
