"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSessionId, getPlayerName, setPlayerName, setSavedRoomId } from "@/lib/session";
import { joinRoom } from "@/lib/firestore";

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getPlayerName();
    if (saved) setName(saved);
      
    const code = searchParams.get("code");
    if (code) setRoomCode(code);
  }, [searchParams]);

  const handleJoin = async () => {
    const trimmedName = name.trim();
    const trimmedCode = roomCode.trim().toUpperCase();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedCode || trimmedCode.length !== 5) {
      setError("Please enter a valid 5-character room code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const sessionId = getSessionId();
      setPlayerName(trimmedName);

      const result = await joinRoom(trimmedCode, sessionId, trimmedName);

      if (!result.success) {
        setError(result.error || "Failed to join room.");
        setLoading(false);
        return;
      }

      setSavedRoomId(trimmedCode);
      router.push(`/lobby/${trimmedCode}`);
    } catch (err) {
      setError("Failed to join room. Try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-scale-in">
      <div className="w-full max-w-md glass-panel p-8 rounded-[2.5rem] shadow-2xl animate-entrance border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e]/20 rounded-full blur-2xl -mr-10 -mt-10"></div>
        <button
          onClick={() => router.push("/")}
          className="text-white/50 hover:text-white mb-6 flex items-center gap-1 transition-colors text-sm font-semibold uppercase tracking-widest relative z-10"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back
        </button>

        <h1 className="text-3xl font-black text-white mb-2 relative z-10">Join a Room</h1>
        <p className="text-slate-400 mb-8 relative z-10 font-medium">Connect your thoughts and jump easily into the action.</p>

        <div className="flex flex-col gap-5 relative z-10">
          <div className="relative group input-glow">
            <input
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 text-lg font-bold text-white outline-none shadow-inner backdrop-blur-md placeholder:text-white/20 focus:border-[#22c55e]/50 focus:ring-4 focus:ring-[#22c55e]/10 transition-all"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={15}
            />
          </div>

          <div className="relative group input-glow">
            <input
              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-4 text-2xl font-black text-center text-[#22c55e] outline-none shadow-inner backdrop-blur-md placeholder:text-white/20 focus:border-[#22c55e]/50 focus:ring-4 focus:ring-[#22c55e]/10 transition-all uppercase tracking-[0.3em]"
              type="text"
              placeholder="SYNC4"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={5}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl flex items-center gap-2 justify-center animate-fade-in-slide-up">
              <span className="material-symbols-outlined text-red-400 text-sm">warning</span>
              <p className="text-red-300 font-bold text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleJoin}
            disabled={loading}
            className="group mt-2 relative overflow-hidden bg-[#22c55e] hover:bg-[#16a34a] text-white font-black text-xl py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 w-full">
              <span className="material-symbols-outlined font-bold group-hover:scale-110 transition-transform">login</span>
              <span>{loading ? "Joining..." : "Join Game"}</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="text-white text-center mt-20 font-bold">Loading...</div>}>
      <JoinForm />
    </Suspense>
  );
}
