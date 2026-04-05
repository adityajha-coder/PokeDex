import { Header } from '@/components/pokemon/header';
import { TypeMatchupTool } from '@/components/pokemon/type-matchup-tool';

export const metadata = {
  title: 'Type Matchup | PokeDex',
  description: 'Calculate Pokemon type strengths and weaknesses. Find out which types are super effective or resistant.',
};

export default function TypeMatchupPage() {
  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      <TypeMatchupTool />
    </main>
  );
}
