"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionId } from "@/lib/session";
import {
  listenToRoom,
  submitGuess,
  nextRound,
  setRoomStatus,
  checkAllMatch,
  updateRoomSettings,
  finishGame,
} from "@/lib/firestore";
import { Room } from "@/lib/types";
import { SoundEffects } from "@/lib/sounds";

const ROUND_TIME = 30;
const COUNTDOWN_TIME = 3;

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [guess, setGuess] = useState("");
  const [guessError, setGuessError] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [countdown, setCountdown] = useState(COUNTDOWN_TIME);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);

  const isHost = room?.hostId === sessionId;
  const hasSubmitted = room?.currentGuesses[sessionId] !== undefined;

  useEffect(() => {
    if (!roomId || !sessionId) return;

    const unsub = listenToRoom(roomId, (data) => {
      setLoading(false);
      setRoom(data);

      if (!data) {
        router.push("/");
        return;
      }
      if (data.status === "finished") {
        router.push(`/result/${roomId}`);
      }
      if (data.status === "reveal" && countdown > 0) {
        setRoomStatus(roomId, "reveal");
        setLocalCountdown();
      }
    });
    return () => unsub();
  }, [roomId, sessionId, router]);

  const playersSubmitted = room?.players.filter((p) => room.currentGuesses[p.id]).length || 0;
  const isMatch = room?.status === "reveal" ? checkAllMatch(room.currentGuesses) : false;

  useEffect(() => {
    if (room?.status === "playing" && !hasSubmitted) {
      if (!timerRef.current) {
        setTimeLeft(ROUND_TIME);
        timerRef.current = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timerRef.current as NodeJS.Timeout);
              handleTimeout();
              return 0;
            }
            if (prev <= 6) SoundEffects.playTick();
            return prev - 1;
          });
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Auto-advance to countdown if everyone submitted (host only)
    if (isHost && room?.status === "playing") {
      const allSubmitted = room.players.every((p) => room.currentGuesses[p.id]);
      if (allSubmitted) {
        if (checkAllMatch(room.currentGuesses)) {
          // Skip countdown if it's a perfect match!
          setRoomStatus(roomId, "reveal");
          setCountdown(0);
        } else {
          setRoomStatus(roomId, "countdown");
        }
      }
    }
  }, [room?.status, hasSubmitted, room?.currentGuesses, isHost]);

  useEffect(() => {
    if (room?.status === "countdown") {
      setLocalCountdown();
      // Safety transition for host: if still on countdown after 4s, force reveal
      if (isHost) {
        const timer = setTimeout(() => {
          if (room?.status === "countdown") {
            setRoomStatus(roomId, "reveal");
            setCountdown(0);
          }
        }, 4500);
        return () => clearTimeout(timer);
      }
    } else if (room?.status === "reveal") {
       setCountdown(0); // Ensure results show immediately
       if (countdownRef.current) {
         clearInterval(countdownRef.current);
         countdownRef.current = null;
       }
    } else {
       if (countdownRef.current) {
         clearInterval(countdownRef.current);
         countdownRef.current = null;
       }
    }
    return () => {
      if (countdownRef.current) {
         clearInterval(countdownRef.current);
         countdownRef.current = null;
      }
    };
  }, [room?.status, isHost, roomId]);

  // Text to speech effect on reveal
  useEffect(() => {
    if (room?.status === "reveal" && (countdown === 0 || isMatch) && room.currentGuesses && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      window.speechSynthesis.cancel();
      
      const voices = window.speechSynthesis.getVoices();
      SoundEffects.playShout();
      if (isMatch) {
        SoundEffects.playSuccess();
      }
      
      room.players.forEach((p, index) => {
        const word = room.currentGuesses[p.id];
        if (word && word !== "-") {
          const utterance = new SpeechSynthesisUtterance(word);
          utterance.pitch = 0.8 + (index * 0.15); 
          utterance.rate = 1.1; // Slightly faster for more 'shout-like' energy
          utterance.voice = voices[index % voices.length] || voices[0];
          window.speechSynthesis.speak(utterance);
        }
      });
    }
    
    if (room?.status === "playing") {
      hasSpokenRef.current = false;
    }
  }, [room?.status, countdown, isMatch, room?.players?.length]);

  const setLocalCountdown = () => {
    if (countdownRef.current) return;
    
    setCountdown(COUNTDOWN_TIME);
    SoundEffects.playTick();
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          countdownRef.current = null;
          if (isHost && room?.status === "countdown") {
            setRoomStatus(roomId, "reveal");
          }
          return 0;
        }
        SoundEffects.playTick();
        return prev - 1;
      });
    }, 1000);
    countdownRef.current = interval;
  };

  const handleTimeout = async () => {
    if (!hasSubmitted && room?.status === "playing") {
      await submitGuess(roomId, sessionId, "-"); 
      setGuessError("Time's up!");
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = guess.trim().toLowerCase();
    
    if (!trimmed) {
      setGuessError("Type a word first.");
      return;
    }
    if (trimmed.length < 2) {
      setGuessError("Word too short.");
      return;
    }
    if (room?.usedWords.includes(trimmed)) {
      setGuessError("Word already used this game!");
      return;
    }

    setGuessError("");
    const result = await submitGuess(roomId, sessionId, trimmed);
    if (!result.success) {
      setGuessError(result.error || "Failed to submit.");
      SoundEffects.playError();
    } else {
      SoundEffects.playSubmit();
    }
  };

  const handleNextRound = async () => {
    SoundEffects.playClick();
    if (room) {
      if (room.round >= 5 || isMatch) {
         // Re-calculate match for scoring if needed
         await finishGame(roomId, room.players);
      } else {
         await nextRound(roomId, sessionId);
      }
    }
    setGuess("");
    setGuessError("");
    hasSpokenRef.current = false;
    setTimeLeft(room?.timePerRound || ROUND_TIME);
    setCountdown(COUNTDOWN_TIME);
    countdownRef.current = null;
  };

  if (loading || !room) {
    return <div className="text-white text-center mt-20 font-bold">Loading Game...</div>;
  }

  return (
    <main className="flex-1 flex flex-col w-full h-full relative z-10 transition-all duration-300">
      {/* Dynamic Backgrounds matching layout.tsx but with distinct colored flares depending on state */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a0f1d] via-[#101935] to-[#1e1b4b] opacity-100 transition-opacity duration-500"></div>
      <div className="absolute bg-[#ec5b13] w-96 h-96 rounded-full top-20 -left-20 animate-float opacity-30 blur-[80px] z-0 pointer-events-none"></div>
      <div className="absolute bg-blue-600 w-[600px] h-[600px] rounded-full bottom-20 -right-20 animate-float opacity-30 blur-[80px] z-0 pointer-events-none" style={{ animationDelay: "-2s" }}></div>
      <div className="absolute bg-purple-600 w-80 h-80 rounded-full top-1/2 left-1/4 animate-slow-bounce opacity-30 blur-[80px] z-0 pointer-events-none" style={{ animationDelay: "-1s" }}></div>

      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0f1d]/60 backdrop-blur-2xl px-4 md:px-12 py-4 md:py-5 sticky top-0 z-50 w-full shrink-0">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-[#ec5b13] p-1.5 md:p-2 rounded-xl text-white shadow-lg shadow-[#ec5b13]/20 cursor-pointer">
            <span className="material-symbols-outlined block text-sm md:text-base">psychology</span>
          </div>
          <h2 className="text-sm md:text-xl font-black tracking-tight text-white uppercase italic">MindSync</h2>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 bg-white/5 px-3 py-1.5 md:px-5 md:py-2.5 rounded-[1.25rem] border border-white/10 shadow-sm overflow-hidden">
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="material-symbols-outlined text-[#ec5b13] text-[14px] md:text-sm font-bold">hourglass_top</span>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400">RND <span className="text-white">{room.round}</span>/5</span>
          </div>
          <div className="w-px h-3 md:h-4 bg-white/10"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="material-symbols-outlined text-yellow-400 text-[14px] md:text-sm font-bold">timer</span>
            <span className={`text-[10px] md:text-xs font-bold font-mono ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-[#ec5b13]'}`}>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-px h-3 md:h-4 bg-white/10 hidden sm:block"></div>
          <div className="hidden sm:flex items-center gap-1.5 md:gap-2">
            <span className="material-symbols-outlined text-emerald-400 text-[14px] md:text-sm font-bold">group</span>
            <span className="text-[10px] md:text-xs font-bold text-slate-300 whitespace-nowrap">RDY: <span className="text-[#ec5b13]">{playersSubmitted}/{room.players.length}</span></span>
          </div>
          {isHost && (
            <div className="flex items-center gap-2 border-l border-white/10 ml-2 pl-2">
              <button 
                onClick={() => { SoundEffects.playClick(); setShowSettingsModal(true); }}
                className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-300"
              >
                <span className="material-symbols-outlined text-[16px] md:text-sm">settings</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-hidden w-full relative z-10">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-12 overflow-y-auto">
          <div className="w-full max-w-2xl space-y-12 animate-fade-in-up stagger-1">
            
            {/* Common Prompt Header */}
            {room.status === "playing" && (
              <div className="text-center space-y-3">
                {room.showPrompt !== false ? (
                  <>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white glow-text leading-tight">
                      Think of a <span className="text-[#ec5b13]">Connection</span>
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl font-medium">
                      Current word: <span className="font-bold text-[#ec5b13] px-2">{room.currentPrompt}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white glow-text leading-tight">
                      Synchronize!
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl font-medium">
                      Type the word you think matches the theme.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Sub-Views based on State */}
            {room.status === "playing" && !hasSubmitted && (
              <form onSubmit={handleSubmit} className="animate-entrance w-full space-y-6 md:space-y-10">
                <div className="bg-white/5 backdrop-blur-3xl p-6 md:p-12 md:pb-16 rounded-[2.5rem] md:rounded-[3.5rem] border border-white/10 shadow-2xl relative group transition-all hover:bg-white/[0.08] min-h-[350px] flex flex-col justify-center">
                  <div className="absolute -top-4 left-6 md:left-12 bg-[#ec5b13] px-6 py-2 rounded-full text-[10px] md:text-xs font-black tracking-[0.2em] uppercase shadow-lg shadow-[#ec5b13]/40 z-20 animate-pulse border border-white/20">Your Word</div>
                  
                  <div className="space-y-10">
                    <div className="relative group/input mt-4">
                      <input
                        autoFocus
                        value={guess}
                        onChange={(e) => {
                          setGuess(e.target.value);
                          setGuessError("");
                        }}
                        autoComplete="off"
                        placeholder="Sync your mind..."
                        className="w-full bg-black/40 border-2 border-white/10 rounded-2xl md:rounded-[2.5rem] h-24 md:h-36 py-4 md:py-6 px-4 md:px-10 text-3xl md:text-6xl font-black text-center text-white placeholder:text-slate-800 outline-none focus:border-[#ec5b13] focus:ring-[15px] focus:ring-[#ec5b13]/25 transition-all duration-500 shadow-inner group-hover/input:border-white/20 capitalize tracking-wider leading-relaxed"
                        maxLength={20}
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 right-4 md:right-8 opacity-0 group-focus-within/input:opacity-100 transition-opacity duration-300 pointer-events-none">
                         <div className="w-2 h-2 rounded-full bg-[#ec5b13] animate-ping"></div>
                      </div>
                    </div>

                    {guessError && (
                      <div className="animate-shake flex items-center justify-center gap-2 text-red-400 font-bold bg-red-400/10 py-3 rounded-2xl border border-red-400/20 text-sm md:text-base">
                         <span className="material-symbols-outlined text-sm">warning</span>
                         {guessError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!guess.trim()}
                      className="w-full bg-[#ec5b13] hover:bg-[#ec5b13]/90 disabled:opacity-30 disabled:grayscale disabled:hover:scale-100 text-white font-black py-5 md:py-8 rounded-2xl md:rounded-[2.5rem] text-xl md:text-4xl shadow-[0_15px_40px_-10px_rgba(236,91,19,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4 group uppercase tracking-tight"
                    >
                      <span>Sync Words</span>
                      <span className="material-symbols-outlined font-black group-hover:translate-x-2 transition-transform text-2xl md:text-4xl">send</span>
                    </button>
                    
                    {/* Player Status Avatars inside card for better feedback */}
                    <div className="flex items-center justify-center gap-3 pt-6 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mr-2">Waiting:</p>
                      <div className="flex -space-x-3">
                        {room.players.map((p, idx) => {
                          const playerGuessed = !!room.currentGuesses[p.id];
                          return (
                            <div key={p.id} className={`w-8 h-8 rounded-full border-2 border-[#0a0f1d] flex items-center justify-center text-[10px] font-black transition-all ${playerGuessed ? 'bg-[#ec5b13] text-white' : 'bg-slate-800 text-slate-500 opacity-50'}`} style={{ zIndex: 10 - idx }}>
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {room.status === "playing" && hasSubmitted && (
              <div className="flex-col flex items-center gap-8 animate-fade-in-up mt-10">
                <div className="flex items-center justify-center gap-3 text-emerald-400 font-bold text-2xl mb-2">
                  <span className="material-symbols-outlined text-4xl">check_circle</span> Word Submitted!
                </div>
                
                {/* Player Status Avatars */}
                <div className="flex flex-col items-center gap-4 animate-fade-in-up stagger-2 mt-4">
                  <div className="flex gap-4 p-5 bg-white/5 backdrop-blur-md rounded-[2rem] border border-white/10 shadow-xl flex-wrap justify-center">
                    {room.players.map((p, index) => {
                      const playerGuessed = !!room.currentGuesses[p.id];
                      return (
                        <div key={p.id} className={`relative group ${!playerGuessed ? 'grayscale opacity-30' : ''}`} title={p.name}>
                          <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center overflow-hidden ${playerGuessed ? 'border-[#ec5b13] bg-[#ec5b13]/20 shadow-[0_0_20px_rgba(236,91,19,0.4)] animate-pulse-glow' : 'border-white/20 bg-white/5'}`} style={{ animationDelay: `${index * 0.2}s` }}>
                            <span className="text-white font-black text-xl">{p.name.charAt(0)}</span>
                          </div>
                          {playerGuessed && (
                            <div className="absolute -top-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-[#0a0f1d] flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-white font-bold">check</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm font-bold text-slate-500 tracking-wider uppercase">Waiting for others to sync...</p>
                </div>
              </div>
            )}

            {(room.status === "countdown" || (room.status === "reveal" && countdown > 0 && !isMatch)) && (
              <div className="flex flex-col items-center justify-center animate-scale-in mt-12">
                <p className="text-[#ec5b13] font-bold text-xl uppercase tracking-widest mb-4">Revealing in</p>
                <div className="text-9xl font-black text-white glow-text shadow-xl">{countdown || 1}</div>
                {isHost && (
                  <button 
                    onClick={() => {
                      setRoomStatus(roomId, "reveal");
                      setCountdown(0);
                    }}
                    className="mt-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] hover:text-[#ec5b13] transition-colors"
                  >
                    Skip Countdown &raquo;
                  </button>
                )}
              </div>
            )}

            {room.status === "reveal" && (countdown === 0 || isMatch) && (
              <div className="flex flex-col items-center w-full max-w-2xl px-2 sm:px-6 space-y-8 mt-4 animate-scale-in">
                <div className="text-center space-y-2">
                  <h2 className={`text-4xl md:text-5xl font-black uppercase italic tracking-tighter ${isMatch ? 'text-emerald-400 glow-text' : 'text-blue-200'}`}>
                    {isMatch ? "ABSOLUTE SYNC!" : "REVEALED"}
                  </h2>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Chemistry Score</span>
                    <div className={`px-4 py-1 rounded-full text-xl font-black ${isMatch ? 'bg-emerald-400/20 text-emerald-400' : 'bg-blue-400/20 text-blue-400'} border border-current/20 shadow-lg`}>
                       {isMatch ? "100%" : `${Math.floor((Object.values(room.currentGuesses).filter(w => w === Object.values(room.currentGuesses)[0]).length / room.players.length) * 100)}%`}
                    </div>
                  </div>
                </div>

                {/* Result Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {room.players.map((p, index) => {
                    const word = room.currentGuesses[p.id] || "No Guess";
                    
                    return (
                      <div 
                        key={p.id} 
                        className={`flex items-center p-4 bg-slate-800/80 backdrop-blur-md border ${isMatch ? 'border-yellow-400 font-bold shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-white/10'} rounded-2xl animate-entrance`}
                        style={{ animationFillMode: 'both' }}
                      >
                        <div className={`w-14 h-14 rounded-full border-2 ${isMatch ? 'border-yellow-400 text-yellow-400' : 'border-purple-500 text-purple-400'} flex items-center justify-center font-bold text-xl shrink-0 bg-[#1e293b]`}>
                          {p.name.charAt(0)}
                        </div>
                        <div className="ml-4 overflow-hidden">
                          <p className="text-sm text-slate-400 font-bold uppercase tracking-wider truncate">{p.name}</p>
                          <p className={`text-2xl font-black ${isMatch ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]' : 'text-purple-400'} truncate capitalize`}>
                            {word}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Footer */}
                {isHost && (
                  <div 
                    className="pt-8 w-full flex justify-center animate-entrance" 
                    style={{ animationDelay: '0.6s', animationFillMode: 'both' }}
                  >
                    <button 
                      onClick={handleNextRound} 
                      className={`${isMatch ? 'bg-yellow-400 hover:bg-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(250,204,21,0.6)]' : 'bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white shadow-[0_0_30px_rgba(236,91,19,0.6)]'} font-black py-5 px-16 rounded-[2rem] text-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3`}
                    >
                      <span className="material-symbols-outlined font-bold">{isMatch || room.round >= 5 ? 'emoji_events' : 'forward'}</span>
                      <span>{room.round >= 5 || isMatch ? "FINISH GAME" : "NEXT ROUND"}</span>
                    </button>
                  </div>
                )}
                {!isHost && (
                  <div 
                    className="text-center text-slate-400 mt-8 italic font-medium animate-entrance" 
                    style={{ animationDelay: '1.2s', animationFillMode: 'both' }}
                  >
                    Waiting for host to continue...
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Sidebar / Guess History */}
        <aside className="w-full lg:w-[400px] xl:w-[450px] bg-[#0a101f]/80 lg:bg-white/[0.03] backdrop-blur-3xl border-t lg:border-t-0 lg:border-l border-white/10 p-5 md:p-8 flex flex-col gap-6 animate-fade-in-up shrink-0 overflow-y-auto max-h-[50vh] lg:max-h-none shadow-2xl">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ec5b13]/20 text-[#ec5b13] flex items-center justify-center shadow-lg shadow-[#ec5b13]/10">
                <span className="material-symbols-outlined">history</span>
              </div>
              <div className="flex flex-col">
                <h3 className="font-black text-xl tracking-tight text-white uppercase italic leading-none">History</h3>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Live Sync Feed</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#ec5b13]/15 text-[#ec5b13] shadow-sm animate-pulse">
               <span className="w-1.5 h-1.5 rounded-full bg-[#ec5b13]"></span>
               <span className="text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap">Online</span>
            </div>
          </div>

          <div className="flex-1 space-y-12 pr-1 custom-scrollbar overflow-y-auto overflow-x-hidden">
            {/* Show History of Rounds */}
            {Object.keys(room.roundHistory || {}).sort((a, b) => Number(b) - Number(a)).map((roundNum) => {
              const guesses = room.roundHistory[Number(roundNum)];
              if (!guesses) return null;
              const isMatch = checkAllMatch(guesses);
              
              return (
                <div key={roundNum} className="space-y-4 animate-entrance">
                  <div className="flex items-center gap-4">
                     <p className={`text-[10px] font-black tracking-widest uppercase flex-shrink-0 ${isMatch ? 'text-emerald-400' : 'text-slate-500'}`}>Round {roundNum} {isMatch ? '• PERFECT SYNC' : '• MISMATCH'}</p>
                     <div className={`h-px flex-1 ${isMatch ? 'bg-emerald-400/20' : 'bg-white/10'}`}></div>
                  </div>
                  
                  <div className="flex flex-col gap-2.5">
                    {room.players.map((p) => {
                      const word = guesses[p.id];
                      if (!word) return null;
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group/hist">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-400 border border-white/5 uppercase">
                              {p.name.charAt(0)}
                            </div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-tight group-hover/hist:text-slate-200 transition-colors uppercase">{p.name}</span>
                          </div>
                          <span className={`text-[13px] font-black uppercase tracking-tight ${isMatch ? 'text-emerald-400' : 'text-[#ec5b13]'}`}>{word}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Current Round Card Stack */}
            <div className="space-y-4 animate-entrance">
              <div className="flex items-center gap-4">
                 <p className="text-[10px] font-black tracking-widest text-[#ec5b13] uppercase flex-shrink-0">Active Round {room.round}</p>
                 <div className="h-px bg-[#ec5b13]/20 flex-1"></div>
              </div>
              
              <div className="flex flex-col gap-4">
                {room.players.map((p) => {
                  const playerGuessed = !!room.currentGuesses[p.id];
                  const isMe = p.id === sessionId;
                  const displayWord = (room.status === "reveal" && countdown === 0) || (isMe && playerGuessed) ? room.currentGuesses[p.id] : null;

                  return (
                    <div key={p.id} className={`group relative flex items-center p-4 rounded-3xl transition-all duration-500 border overflow-hidden ${playerGuessed ? 'bg-[#ec5b13]/10 border-[#ec5b13]/30 shadow-lg shadow-[#ec5b13]/5' : 'bg-white/[0.03] border-white/5 backdrop-blur-lg'}`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${playerGuessed ? 'bg-[#ec5b13]' : 'bg-slate-700'}`}></div>
                      
                      <div className={`relative shrink-0 w-14 h-14 rounded-[1.25rem] border-2 ${playerGuessed ? 'border-[#ec5b13] shadow-[0_0_20px_rgba(236,91,19,0.3)]' : 'border-white/10'} flex items-center justify-center font-black bg-[#0a0f1e] overflow-hidden transition-all duration-300 group-hover:scale-105`}>
                        <span className={`text-xl ${playerGuessed ? 'text-white' : 'text-slate-600'}`}>{p.name.charAt(0).toUpperCase()}</span>
                      </div>

                      <div className="ml-5 flex-1 overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[120px]">
                            {p.name} {isMe && <span className="text-[#ec5b13] ml-1">(You)</span>}
                          </p>
                          {playerGuessed ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                               <span className="material-symbols-outlined text-[14px]">verified</span>
                               <span className="text-[9px] font-black uppercase tracking-tighter">Ready</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ec5b13] animate-ping"></span>
                              <span className="text-[9px] font-black text-[#ec5b13] uppercase">Thinking...</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          {displayWord ? (
                            <div className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3 animate-slide-in-right">
                               <span className="truncate">{displayWord}</span>
                            </div>
                          ) : (
                            <div className={`h-6 flex items-center gap-1 ${playerGuessed ? 'text-white/30' : 'text-white/10'}`}>
                               {[1,2,3,4,5,6].map(i => <div key={i} className="w-4 h-1.5 rounded-full bg-current"></div>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-white/5 shrink-0 flex items-center justify-between">
            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">MindSync Alpha v8.2</p>
            <div className="flex gap-4">
               <span className="material-symbols-outlined text-sm text-slate-600 cursor-pointer hover:text-white transition-colors">info</span>
               <span className="material-symbols-outlined text-sm text-slate-600 cursor-pointer hover:text-white transition-colors">notifications</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Settings Modal (Host Only) */}
      {showSettingsModal && isHost && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="relative w-full max-w-md bg-[#0f172a]/95 glass-panel rounded-3xl shadow-2xl border border-white/10 p-8 flex flex-col gap-6">
            <div className="flex justify-between items-center mb-2">
               <h2 className="text-2xl font-black text-white flex items-center gap-2">
                 <span className="material-symbols-outlined text-[#ec5b13]">tune</span> Room Settings
               </h2>
               <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white transition-colors">
                 <span className="material-symbols-outlined">close</span>
               </button>
            </div>
            
            <div className="flex flex-col gap-6">
              <label className="flex items-center justify-between bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-[#1e293b] transition-all">
                <div>
                  <p className="text-white font-bold text-sm">Timer Speed</p>
                  <p className="text-slate-400 text-xs mt-1">Seconds per round</p>
                </div>
                <select 
                  className="bg-black/20 border border-white/10 text-white rounded-xl px-4 py-2 font-black outline-none"
                  value={room?.timePerRound || 30}
                  onChange={(e) => updateRoomSettings(roomId, sessionId, { timePerRound: Number(e.target.value) })}
                >
                  <option value={15}>15s (Blitz)</option>
                  <option value={30}>30s (Normal)</option>
                  <option value={60}>60s (Slow)</option>
                </select>
              </label>
              <label className="flex items-center justify-between bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-[#1e293b] transition-all">
                <div>
                  <p className="text-white font-bold text-sm">Show Prompts</p>
                  <p className="text-slate-400 text-xs mt-1">Toggle hints on / off</p>
                </div>
                <button 
                  onClick={() => { SoundEffects.playClick(); updateRoomSettings(roomId, sessionId, { showPrompt: !room?.showPrompt }); }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${room?.showPrompt !== false ? 'bg-[#ec5b13]' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${room?.showPrompt !== false ? 'left-7' : 'left-1'}`} />
                </button>
              </label>

              <label className="flex items-center justify-between bg-[#1e293b]/50 border border-white/5 rounded-2xl p-4 cursor-pointer hover:bg-[#1e293b] transition-all">
                <div>
                  <p className="text-white font-bold text-sm">Prevent Duplicates</p>
                  <p className="text-slate-400 text-xs mt-1">Stop repeated words</p>
                </div>
                <button 
                  onClick={() => { SoundEffects.playClick(); updateRoomSettings(roomId, sessionId, { preventRepeated: !room?.preventRepeated }); }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${room?.preventRepeated ? 'bg-[#ec5b13]' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${room?.preventRepeated ? 'left-7' : 'left-1'}`} />
                </button>
              </label>
              
              <button 
                onClick={() => setShowSettingsModal(false)}
                className="w-full py-4 mt-2 bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white font-black rounded-2xl transition-all shadow-lg"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
