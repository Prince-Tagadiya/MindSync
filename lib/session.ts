import { v4 as uuidv4 } from "uuid";

const SESSION_KEY = "mindsync_session_id";
const NAME_KEY = "mindsync_player_name";
const ROOM_KEY = "mindsync_room_id";

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NAME_KEY, name);
}

export function getSavedRoomId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROOM_KEY);
}

export function setSavedRoomId(roomId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROOM_KEY, roomId);
}

export function clearSavedRoomId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROOM_KEY);
}
