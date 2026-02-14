export type SlotStatus = 'active' | 'rugged' | 'survivor';
export type GameState = 'waiting' | 'running' | 'rugging' | 'finished';

export interface Slot {
  id: number;
  name: string;
  emoji: string;
  color: string;
  status: SlotStatus;
}

// Entry fee in SOL
export const ENTRY_FEE_SOL = 0.1;

export const SLOTS: Slot[] = [
  {
    id: 0,
    name: 'Red',
    emoji: '🔴',
    color: 'from-red-600 to-red-800',
    status: 'active',
  },
  {
    id: 1,
    name: 'Blue',
    emoji: '🔵',
    color: 'from-blue-600 to-blue-800',
    status: 'active',
  },
  {
    id: 2,
    name: 'Green',
    emoji: '🟢',
    color: 'from-green-600 to-green-800',
    status: 'active',
  },
  {
    id: 3,
    name: 'Yellow',
    emoji: '🟡',
    color: 'from-yellow-600 to-yellow-800',
    status: 'active',
  },
  {
    id: 4,
    name: 'Purple',
    emoji: '🟣',
    color: 'from-purple-600 to-purple-800',
    status: 'active',
  },
  {
    id: 5,
    name: 'Orange',
    emoji: '🟠',
    color: 'from-orange-600 to-orange-800',
    status: 'active',
  },
];
