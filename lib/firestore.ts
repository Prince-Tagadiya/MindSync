import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { Room, Player } from "./types";
import { getRandomPrompt } from "./prompts";
import { getEnhancedSimilarity } from "./chemistry";

// Generate a random 5-character room code (letters + digits)
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ===== CREATE ROOM =====
export interface CreateRoomOptions {
  hostId: string;
  hostName: string;
  timePerRound: number;
  showPrompt: boolean;
  preventRepeated: boolean;
}

export async function createRoom(options: CreateRoomOptions): Promise<string> {
  const roomId = generateRoomCode();
  const roomRef = doc(db, "rooms", roomId);

  // Check if room already exists (unlikely but possible)
  const existing = await getDoc(roomRef);
  if (existing.exists()) {
    // Recursive retry with a new code
    return createRoom(options);
  }

  const room: Room = {
    status: "lobby",
    hostId: options.hostId,
    players: [{ id: options.hostId, name: options.hostName, score: 0, coins: 0 }],
    round: 0,
    totalRounds: 999, // Essentially infinite
    timePerRound: options.timePerRound,
    showPrompt: options.showPrompt,
    preventRepeated: options.preventRepeated,
    usedWords: [],
    currentGuesses: {},
    currentGuessTimes: {},
    roundHistory: {},
    currentPrompt: "",
    createdAt: Date.now(),
  };

  await setDoc(roomRef, room);
  return roomId;
}

// ===== JOIN ROOM =====
export async function joinRoom(
  roomId: string,
  playerId: string,
  playerName: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    return { success: false, error: "Room not found. Check the code and try again." };
  }

  const room = snap.data() as Room;

  if (room.status !== "lobby") {
    return { success: false, error: "Game already in progress." };
  }

  if (room.players.length >= 8) {
    return { success: false, error: "Room is full (max 8 players)." };
  }

  // Check if player already in room (reconnect case)
  const existing = room.players.find((p) => p.id === playerId);
  if (existing) {
    return { success: true }; // Already joined
  }

  const newPlayer: Player = { id: playerId, name: playerName, score: 0, coins: 0 };
  await updateDoc(roomRef, {
    players: [...room.players, newPlayer],
  });

  return { success: true };
}

// ===== START GAME =====
export async function startGame(roomId: string, hostId: string): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) return { success: false, error: "Room not found." };

  const room = snap.data() as Room;

  if (room.hostId !== hostId) {
    return { success: false, error: "Only the host can start the game." };
  }

  if (room.players.length < 2) {
    return { success: false, error: "Need at least 2 players to start." };
  }

  const prompt = getRandomPrompt();

  await updateDoc(roomRef, {
    status: "playing",
    round: 1,
    currentPrompt: prompt,
    currentGuesses: {},
    currentGuessTimes: {},
    roundHistory: {},
    roundStartedAt: Date.now(),
  });

  return { success: true };
}

// ===== SUBMIT GUESS =====
export async function submitGuess(
  roomId: string,
  playerId: string,
  word: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) return { success: false, error: "Room not found." };

  const room = snap.data() as Room;

  if (room.status !== "playing") {
    return { success: false, error: "Game is not in playing state." };
  }

  // Check if word was already used (if setting enabled)
  const normalizedWord = word.trim().toLowerCase();

  if (room.preventRepeated && room.usedWords.map((w) => w.toLowerCase()).includes(normalizedWord)) {
    return { success: false, error: "Word already used. Try another word." };
  }

  // Check if player already submitted this round
  if (room.currentGuesses[playerId]) {
    return { success: false, error: "You already submitted a word this round." };
  }

  // Store guess and timestamp
  const now = Date.now();
  await updateDoc(roomRef, {
    [`currentGuesses.${playerId}`]: word.trim(),
    [`currentGuessTimes.${playerId}`]: now,
  });

  return { success: true };
}

// ===== CHECK MATCH (client-side logic) =====
export function checkAllMatch(guesses: Record<string, string>): boolean {
  const words = Object.values(guesses);
  if (words.length === 0) return false;
  return words.every((w) => w === words[0]);
}

// Helper to calculate round points
function calculateRoundPoints(players: Player[], guesses: Record<string, string>, guessTimes?: Record<string, number>, roundStartedAt?: number, timeLimit?: number): Player[] {
  const newPlayers = [...players];
  const playerIds = players.map(p => p.id);
  const guessValues = Object.values(guesses).map(w => w.trim().toLowerCase());
  
  // 1. First Blood Bonus (+5)
  if (guessTimes) {
    let firstId = "";
    let minTime = Infinity;
    for (const [id, time] of Object.entries(guessTimes)) {
       if (time < minTime) {
         minTime = time;
         firstId = id;
       }
    }
    if (firstId) {
      const p = newPlayers.find(p => p.id === firstId);
      if (p) p.coins = (p.coins || 0) + 5;
    }
  }

  // 2. Perfect Harmony (+25 each)
  const allUniqueWords = Array.from(new Set(guessValues));
  if (allUniqueWords.length === 1 && playerIds.length > 1) {
    newPlayers.forEach(p => p.coins = (p.coins || 0) + 25);
  }

  // 3. Pairwise Bonuses
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const p1Id = playerIds[i];
      const p2Id = playerIds[j];
      const w1 = guesses[p1Id]?.toLowerCase().trim();
      const w2 = guesses[p2Id]?.toLowerCase().trim();
      const t1 = guessTimes?.[p1Id] || 0;
      const t2 = guessTimes?.[p2Id] || 0;

      if (!w1 || !w2) continue;

      const isExact = w1 === w2;
      const sim = getEnhancedSimilarity(w1, w2);
      
      // ULTRA SYNC (+50) - Same second!
      const isSimultaneous = isExact && Math.floor(t1 / 1000) === Math.floor(t2 / 1000) && t1 !== 0;

      if (isSimultaneous) {
        const p1 = newPlayers.find(p => p.id === p1Id);
        const p2 = newPlayers.find(p => p.id === p2Id);
        if (p1) p1.coins = (p1.coins || 0) + 50;
        if (p2) p2.coins = (p2.coins || 0) + 50;
      } 
      // MIND TWINS (+20) - Regular exact match or >90% spelling
      else if (isExact || sim >= 0.9) {
        const p1 = newPlayers.find(p => p.id === p1Id);
        const p2 = newPlayers.find(p => p.id === p2Id);
        if (p1) p1.coins = (p1.coins || 0) + 20;
        if (p2) p2.coins = (p2.coins || 0) + 20;

        // Last Second Save (+15 bonus)
        if (roundStartedAt && timeLimit) {
           const limitMs = timeLimit * 1000;
           const s1 = t1 - roundStartedAt;
           const s2 = t2 - roundStartedAt;
           // If either submitted within final 5s of the round
           if (s1 > (limitMs - 5000) || s2 > (limitMs - 5000)) {
             if (p1) p1.coins = (p1.coins || 0) + 15;
             if (p2) p2.coins = (p2.coins || 0) + 15;
           }
        }
      } 
      // HIGH SYNC (+10) 
      else if (sim >= 0.7) {
        const p1 = newPlayers.find(p => p.id === p1Id);
        const p2 = newPlayers.find(p => p.id === p2Id);
        if (p1) p1.coins = (p1.coins || 0) + 10;
        if (p2) p2.coins = (p2.coins || 0) + 10;
      }
    }
  }
  return newPlayers;
}

// ===== NEXT ROUND =====
export async function nextRound(
  roomId: string,
  hostId: string
): Promise<{ success: boolean; error?: string }> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) return { success: false, error: "Room not found." };

  const room = snap.data() as Room;

  if (room.hostId !== hostId) {
    return { success: false, error: "Only the host can advance rounds." };
  }

  // Award coins for the round that just ended
  const updatedPlayers = calculateRoundPoints(room.players, room.currentGuesses, room.currentGuessTimes, room.roundStartedAt, room.timePerRound);

  // Determine last sync info for animation
  let syncInfo: any = null;
  const playerIds = room.players.map(p => p.id);
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      const w1 = room.currentGuesses[playerIds[i]]?.toLowerCase();
      const w2 = room.currentGuesses[playerIds[j]]?.toLowerCase();
      const t1 = room.currentGuessTimes?.[playerIds[i]] || 0;
      const t2 = room.currentGuessTimes?.[playerIds[j]] || 0;

      if (w1 && w1 === w2) {
        if (Math.floor(t1/1000) === Math.floor(t2/1000)) {
           syncInfo = { type: 'simultaneous', playerIds: [playerIds[i], playerIds[j]] };
           break;
        } else {
           syncInfo = { type: 'exact', playerIds: [playerIds[i], playerIds[j]] };
        }
      }
    }
    if (syncInfo?.type === 'simultaneous') break;
  }

  // Collect used words from current round
  const currentWords = Object.values(room.currentGuesses);
  const newUsedWords = [...room.usedWords, ...currentWords];

  const prompt = getRandomPrompt();

  await updateDoc(roomRef, {
    round: room.round + 1,
    currentPrompt: prompt,
    [`roundHistory.${room.round}`]: room.currentGuesses,
    currentGuesses: {},
    currentGuessTimes: {},
    usedWords: newUsedWords,
    status: "playing",
    players: updatedPlayers,
    lastRoundSyncInfo: syncInfo,
    roundStartedAt: Date.now(),
  });

  return { success: true };
}

// ===== FINISH GAME =====
export async function finishGame(
  roomId: string,
  players: Player[]
): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as Room;

  const currentGuesses = room.currentGuesses;
  const finalPlayers = calculateRoundPoints(players, currentGuesses, room.currentGuessTimes, room.roundStartedAt, room.timePerRound);

  // Store persistence results
  const results = {
    chemistryScore: 0, // Calculated on results page
    totalRounds: room.round,
    playerCoins: finalPlayers.reduce((acc, p) => ({ ...acc, [p.id]: p.coins }), {}),
    roundHistory: { ...room.roundHistory, [room.round]: currentGuesses },
    timestamp: Date.now(),
  };

  await updateDoc(roomRef, {
    status: "finished",
    players: finalPlayers,
    [`roundHistory.${room.round}`]: currentGuesses,
    currentGuesses: {},
    lastMatchResults: results,
  });
}

// ===== SET ROOM STATUS =====
export async function setRoomStatus(
  roomId: string,
  status: Room["status"]
): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  await updateDoc(roomRef, { status });
}

// ===== REALTIME LISTENER =====
export function listenToRoom(
  roomId: string,
  callback: (room: Room | null) => void
): Unsubscribe {
  const roomRef = doc(db, "rooms", roomId);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Room);
    } else {
      callback(null);
    }
  });
}

// ===== LEAVE ROOM =====
export async function leaveRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const room = snap.data() as Room;
  const updatedPlayers = room.players.filter((p) => p.id !== playerId);

  if (updatedPlayers.length === 0) {
    // Room is empty, could delete it but we'll just leave it
    return;
  }

  // If host leaves, transfer host to next player
  const updates: Partial<Room> & Record<string, unknown> = {
    players: updatedPlayers,
  };

  if (room.hostId === playerId) {
    updates.hostId = updatedPlayers[0].id;
  }

  await updateDoc(roomRef, updates);
}

// ===== PLAY AGAIN (Reset to Lobby) =====
export async function playAgain(roomId: string): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  
  const room = snap.data() as Room;
  
  // Find next host
  const currentIndex = room.players.findIndex(p => p.id === room.hostId);
  const nextHostIndex = room.players.length > 0 ? (currentIndex + 1) % room.players.length : 0;
  const nextHostId = room.players.length > 0 ? room.players[nextHostIndex].id : room.hostId;

  const resetPlayers = room.players.map(p => ({ ...p, score: 0, coins: 0 }));

  await updateDoc(roomRef, {
    status: "lobby",
    hostId: nextHostId,
    players: resetPlayers,
    round: 0,
    usedWords: [],
    currentGuesses: {},
    roundHistory: {},
    currentPrompt: ""
  });
}

// ===== CHANGE HOST (Manual) =====
export async function changeHost(roomId: string, currentHostId: string, newHostId: string): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  
  const room = snap.data() as Room;
  if(room.hostId === currentHostId) {
    await updateDoc(roomRef, { hostId: newHostId });
  }
}

// ===== UPDATE SETTINGS =====
export async function updateRoomSettings(roomId: string, currentHostId: string, updates: Partial<Room>): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  
  const room = snap.data() as Room;
  if(room.hostId === currentHostId) {
    await updateDoc(roomRef, updates);
  }
}
