export interface Player {
  id: string;
  name: string;
  score: number;
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
  currentGuesses: Record<string, string>; // { playerId: word }
  roundHistory: Record<number, Record<string, string>>; // { roundNumber: { playerId: word } }
  currentPrompt: string;
  createdAt: number;
}
