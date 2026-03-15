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
    }
  }, [room?.status]);

  // Text to speech effect on reveal
  useEffect(() => {
    if (room?.status === "reveal" && countdown === 0 && room.currentGuesses && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      window.speechSynthesis.cancel();
      
      const speak = () => {
        const voices = window.speechSynthesis.getVoices();
        SoundEffects.playShout(); // Trigger the atmospheric group shout sound
        if (checkAllMatch(room.currentGuesses)) {
          SoundEffects.playSuccess();
        }
        
        room.players.forEach((p, index) => {
          const word = room.currentGuesses[p.id];
          if (word && word !== "-") {
            setTimeout(() => {
              const utterance = new SpeechSynthesisUtterance(word);
              utterance.pitch = 0.5 + (index * 0.3) % 1.5;
              utterance.rate = 1.0 + (Math.random() * 0.2 - 0.1);
              utterance.voice = voices[(index * 7) % voices.length] || voices[0];
              window.speechSynthesis.speak(utterance);
            }, index * 40 + (Math.random() * 30));
          }
        });
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = speak;
      } else {
        speak();
      }
    }
    if (room?.status === "playing") {
      hasSpokenRef.current = false;
    }
  }, [room?.status, countdown]);

  const setLocalCountdown = () => {
    if (!countdownRef.current) {
      setCountdown(COUNTDOWN_TIME);
      SoundEffects.playTick(); // Play initial tick
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current as NodeJS.Timeout);
            if (isHost && room?.status === "countdown") {
              setRoomStatus(roomId, "reveal");
            }
            return 0;
          }
          SoundEffects.playTick();
          return prev - 1;
        });
      }, 1000);
    }
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

  const playersSubmitted = room.players.filter((p) => room.currentGuesses[p.id]).length;
  const isMatch = room.status === "reveal" ? checkAllMatch(room.currentGuesses) : false;

  return (
    <main className="flex-1 flex flex-col w-full h-full relative z-10 transition-all duration-300">
      {/* Dynamic Backgrounds matching layout.tsx but with distinct colored flares depending on state */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[#0a0f1d] via-[#101935] to-[#1e1b4b] opacity-100 transition-opacity duration-500"></div>
      <div className="absolute bg-[#ec5b13] w-96 h-96 rounded-full top-20 -left-20 animate-float opacity-30 blur-[80px] z-0 pointer-events-none"></div>
      <div className="absolute bg-blue-600 w-[600px] h-[600px] rounded-full bottom-20 -right-20 animate-float opacity-30 blur-[80px] z-0 pointer-events-none" style={{ animationDelay: "-2s" }}></div>
      <div className="absolute bg-purple-600 w-80 h-80 rounded-full top-1/2 left-1/4 animate-slow-bounce opacity-30 blur-[80px] z-0 pointer-events-none" style={{ animationDelay: "-1s" }}></div>

      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-white/5 bg-[#0a0f1d]/40 backdrop-blur-xl px-4 md:px-12 py-4 sticky top-0 z-50 w-full shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-[#ec5b13] p-2 rounded-xl text-white shadow-lg shadow-[#ec5b13]/20 cursor-pointer">
            <span className="material-symbols-outlined block">psychology</span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white hidden sm:block">MindSync</h2>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 bg-white/5 px-4 sm:px-5 py-2.5 rounded-2xl border border-white/10 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ec5b13] text-sm font-bold">rebase_edit</span>
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">Round <span className="text-white">{room.round}</span>/5</span>
          </div>
          <div className="w-px h-4 bg-white/10"></div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ec5b13] text-sm font-bold">timer</span>
            <span className={`text-xs font-bold font-mono ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-[#ec5b13]'}`}>
              00:{timeLeft.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="w-px h-4 bg-white/10 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ec5b13] text-sm font-bold">groups</span>
            <span className="text-xs font-bold text-slate-300">Ready: <span className="text-[#ec5b13]">{playersSubmitted}/{room.players.length}</span></span>
          </div>
          {isHost && (
            <>
              <div className="w-px h-4 bg-white/10 hidden md:block"></div>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-slate-300"
              >
                <span className="material-symbols-outlined text-sm">settings</span>
              </button>
            </>
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
              <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full animate-entrance">
                <div className="relative group input-glow transition-all duration-500">
                  <label className="block text-left text-slate-400 text-xs font-black uppercase tracking-widest mb-3 ml-2">Your Word</label>
                  <div className="relative">
                    <input
                      className="w-full bg-white/5 border-2 border-white/10 rounded-[2rem] px-6 md:px-10 py-8 md:py-10 text-2xl md:text-4xl font-black text-center outline-none shadow-2xl backdrop-blur-md placeholder:text-white/10 text-white focus:border-[#ec5b13]/40 focus:ring-8 focus:ring-[#ec5b13]/5 transition-all"
                      placeholder="Enter your word..."
                      type="text"
                      autoComplete="off"
                      value={guess}
                      onChange={(e) => {
                        setGuess(e.target.value);
                        setGuessError("");
                      }}
                      autoFocus
                    />
                    <div className="absolute -inset-1 bg-gradient-to-r from-[#ec5b13]/30 to-blue-500/30 rounded-[2.1rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                </div>

                {guessError && (
                  <div className="bg-red-500/10 border border-red-500/20 py-4 px-6 rounded-2xl flex items-center gap-3 justify-center shadow-lg animate-fade-in-slide-up">
                    <span className="material-symbols-outlined text-red-400">warning</span>
                    <p className="text-red-300 font-bold text-sm tracking-wide">{guessError}</p>
                  </div>
                )}

                <div className="flex flex-col items-center gap-6 mt-4">
                  <button type="submit" className="group relative flex items-center justify-center gap-4 bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white font-black py-5 md:py-6 px-10 md:px-16 rounded-2xl text-xl md:text-2xl shadow-2xl shadow-[#ec5b13]/30 transition-all transform hover:scale-105 active:scale-95 overflow-hidden w-full md:w-auto">
                    <span>Submit Word</span>
                    <span className="material-symbols-outlined text-3xl transition-transform group-hover:translate-x-2">send</span>
                    <div className="absolute inset-0 bg-white/20 animate-pulse-glow rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100"></div>
                  </button>
                  
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

            {(room.status === "countdown" || (room.status === "reveal" && countdown > 0)) && (
              <div className="flex flex-col items-center justify-center animate-scale-in mt-12">
                <p className="text-[#ec5b13] font-bold text-xl uppercase tracking-widest mb-4">Revealing in</p>
                <div className="text-9xl font-black text-white glow-text shadow-xl">{countdown || 1}</div>
              </div>
            )}

            {room.status === "reveal" && countdown === 0 && (
              <div className="flex flex-col items-center w-full max-w-2xl px-2 sm:px-6 space-y-6 mt-4">
                <h2 className="text-3xl font-bold mb-2 text-center tracking-tight text-blue-200 animate-fade-in-up">
                  {isMatch ? "Absolute Sync!" : "The Reveal"}
                </h2>

                {/* Result Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {room.players.map((p, index) => {
                    const word = room.currentGuesses[p.id] || "No Guess";
                    
                    return (
                      <div 
                        key={p.id} 
                        className={`flex items-center p-4 bg-slate-800/80 backdrop-blur-md border ${isMatch ? 'border-yellow-400 font-bold shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 'border-white/10'} rounded-2xl animate-entrance`}
                        style={{ animationDelay: `${0.1 + (index * 0.15)}s`, animationFillMode: 'both' }}
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

        {/* Sidebar */}
        <aside className="w-full lg:w-[380px] xl:w-[420px] bg-white/5 backdrop-blur-2xl border-l border-white/10 p-6 md:p-8 flex flex-col gap-6 animate-fade-in-up shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ec5b13]/10 text-[#ec5b13] flex items-center justify-center">
                <span className="material-symbols-outlined">history</span>
              </div>
              <h3 className="font-black text-xl tracking-tight text-white">Guess History</h3>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ec5b13]/10 text-[#ec5b13] animate-pulse shrink-0">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ec5b13] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ec5b13]"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Live Sync</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col space-y-6 pr-2 custom-scrollbar overflow-y-auto">
            {/* Previous Words array */}
            {room.usedWords.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Previous Words</span>
                  <div className="h-px bg-white/10 flex-1 ml-4"></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {room.usedWords.map((word, i) => (
                    <span key={i} className="px-5 py-2.5 bg-white/5 text-slate-300 rounded-full border border-white/10 text-xs font-black uppercase tracking-tight">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Current Round Live Tracker */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-[#ec5b13] uppercase tracking-widest">Round {room.round || 1} (Current)</span>
                <div className="h-px bg-[#ec5b13]/20 flex-1 ml-4"></div>
              </div>
              <div className="flex flex-col gap-3">
                {room.players.map((p) => {
                  const playerGuessed = !!room.currentGuesses[p.id];
                  const isMe = p.id === sessionId;
                  const displayWord = room.status === "reveal" && countdown === 0 ? room.currentGuesses[p.id] : (isMe && playerGuessed ? room.currentGuesses[p.id] : "Ready");
                  
                  return (
                    <div key={p.id} className="flex items-center gap-4">
                      <div className={`shrink-0 w-10 h-10 rounded-full border-2 ${playerGuessed ? 'border-[#ec5b13] shadow-[0_0_10px_rgba(236,91,19,0.3)] text-white' : 'border-white/20 text-slate-500'} flex items-center justify-center font-bold bg-[#1e293b]`}>
                        {p.name.charAt(0)}
                      </div>
                      
                      {playerGuessed ? (
                        <div className="flex-1 bg-[#ec5b13]/10 p-4 rounded-2xl border border-[#ec5b13]/20 text-white font-black text-sm flex items-center justify-between transition-all">
                          <span className="uppercase tracking-wide">{displayWord}</span>
                          <span className="material-symbols-outlined text-[#ec5b13] text-xl">check_circle</span>
                        </div>
                      ) : (
                        <div className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5 italic text-slate-400 text-sm font-medium transition-all">
                          Waiting for {p.name}...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-white/10 shrink-0">
            <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
              <span className="material-symbols-outlined text-base">info</span>
              <span>Points awarded for matching words</span>
            </div>
          </div>
        </aside>
      </div>

      {/* Room Settings Modal (Host Only) */}
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
