import { Header } from '@/components/pokemon/header';
import { EvolutionTracker } from '@/components/pokemon/evolution-tracker';

export const metadata = {
  title: 'Evolution Tracker | PokeDex',
  description: 'Visualize Pokemon evolution chains with images and stats. Track how Pokemon evolve.',
};

export default function EvolutionPage() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <EvolutionTracker />
    </main>
  );
}
