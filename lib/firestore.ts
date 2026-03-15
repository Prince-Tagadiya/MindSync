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
    players: [{ id: options.hostId, name: options.hostName, score: 0 }],
    round: 0,
    totalRounds: 10,
    timePerRound: options.timePerRound,
    showPrompt: options.showPrompt,
    preventRepeated: options.preventRepeated,
    usedWords: [],
    currentGuesses: {},
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

  const newPlayer: Player = { id: playerId, name: playerName, score: 0 };
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
    roundHistory: {},
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

  await updateDoc(roomRef, {
    [`currentGuesses.${playerId}`]: normalizedWord,
  });

  return { success: true };
}

// ===== CHECK MATCH (client-side logic) =====
export function checkAllMatch(guesses: Record<string, string>): boolean {
  const words = Object.values(guesses);
  if (words.length === 0) return false;
  return words.every((w) => w === words[0]);
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

  // Collect used words from current round
  const currentWords = Object.values(room.currentGuesses);
  const newUsedWords = [...room.usedWords, ...currentWords];

  // Check if we've exceeded max rounds
  if (room.round >= room.totalRounds) {
    await updateDoc(roomRef, {
      status: "finished",
      usedWords: newUsedWords,
      [`roundHistory.${room.round}`]: room.currentGuesses,
      currentGuesses: {},
    });
    return { success: true };
  }

  const prompt = getRandomPrompt();

  await updateDoc(roomRef, {
    round: room.round + 1,
    currentPrompt: prompt,
    [`roundHistory.${room.round}`]: room.currentGuesses,
    currentGuesses: {},
    usedWords: newUsedWords,
    status: "playing",
  });

  return { success: true };
}

// ===== FINISH GAME (all matched) =====
export async function finishGame(
  roomId: string,
  winnerScores: Player[]
): Promise<void> {
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room = snap.data() as Room;

  await updateDoc(roomRef, {
    status: "finished",
    players: winnerScores,
    [`roundHistory.${room.round}`]: room.currentGuesses,
    currentGuesses: {},
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

  await updateDoc(roomRef, {
    status: "lobby",
    hostId: nextHostId,
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
