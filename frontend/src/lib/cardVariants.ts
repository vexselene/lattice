export interface CardVariant {
  id: number;
  name: string;
  accent: string;
  darkAccent: string;
  cardClassName: string;
  patternClassName: string;
}

export const CARD_VARIANTS: CardVariant[] = [
  {
    id: 1,
    name: 'Diagonal',
    accent: '#1a1a1a',
    darkAccent: '#cbd5e1',
    cardClassName: 'card-variant-1',
    patternClassName: 'pattern-variant-1',
  },
  {
    id: 2,
    name: 'Stripes',
    accent: '#e94f4f',
    darkAccent: '#f87171',
    cardClassName: 'card-variant-2',
    patternClassName: 'pattern-variant-2',
  },
  {
    id: 3,
    name: 'Chevron',
    accent: '#10b981',
    darkAccent: '#34d399',
    cardClassName: 'card-variant-3',
    patternClassName: 'pattern-variant-3',
  },
  {
    id: 4,
    name: 'Wavy',
    accent: '#4f46e5',
    darkAccent: '#818cf8',
    cardClassName: 'card-variant-4',
    patternClassName: 'pattern-variant-4',
  },
  {
    id: 5,
    name: 'Crosshatch',
    accent: '#f5a623',
    darkAccent: '#fbbf24',
    cardClassName: 'card-variant-5',
    patternClassName: 'pattern-variant-5',
  },
  {
    id: 6,
    name: 'Grid',
    accent: '#f472b6',
    darkAccent: '#f472b6',
    cardClassName: 'card-variant-6',
    patternClassName: 'pattern-variant-6',
  },
  {
    id: 7,
    name: 'Plaid',
    accent: '#8b5cf6',
    darkAccent: '#a78bfa',
    cardClassName: 'card-variant-7',
    patternClassName: 'pattern-variant-7',
  },
  {
    id: 8,
    name: 'Dots+Lines',
    accent: '#f59e0b',
    darkAccent: '#fbbf24',
    cardClassName: 'card-variant-8',
    patternClassName: 'pattern-variant-8',
  },
  {
    id: 9,
    name: 'Dots',
    accent: '#ec4899',
    darkAccent: '#f472b6',
    cardClassName: 'card-variant-9',
    patternClassName: 'pattern-variant-9',
  },
];

export function getCardVariant(index: number): CardVariant {
  return CARD_VARIANTS[index % 9];
}

export function formatCanvasDate(dateStr?: string): { date: string; time: string } {
  if (!dateStr) return { date: '', time: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: dateStr, time: '' };

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}
