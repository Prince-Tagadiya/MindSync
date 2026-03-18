export interface Player {
  id: string;
  name: string;
  score: number;
  coins: number;
}

export interface MatchResults {
  chemistryScore: number;
  totalRounds: number;
  playerCoins: Record<string, number>;
  roundHistory: Record<number, Record<string, string>>;
  timestamp: number;
}

export interface Room {
  status: "lobby" | "playing" | "countdown" | "reveal" | "finished";
  hostId: string;
  players: Player[];
  round: number;
  totalRounds: number;
  timePerRound: number;
  showPrompt: boolean;
  preventRepeated: boolean;
  usedWords: string[];
  usedPrompts: string[];
  currentGuesses: Record<string, string>; // { playerId: word }
  currentGuessTimes: Record<string, number>; // { playerId: timestamp }
  roundHistory: Record<number, Record<string, string>>; // { roundNumber: { playerId: word } }
  currentPrompt: string;
  roundStartedAt?: number;
  createdAt: number;
  lastRoundSyncInfo?: { 
    type: 'exact' | 'close' | 'simultaneous';
    playerIds: string[];
  };
  lastRoundCoinBreakdown?: Record<string, {reason: string, amount: number}[]>;
  lastMatchResults?: MatchResults;
  maxRounds?: number;
  playAgainRequests?: Record<string, 'accept' | 'decline' | 'pending'>;
}
