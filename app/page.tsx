"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSessionId, getPlayerName, setPlayerName, setSavedRoomId } from "@/lib/session";
import { createRoom, joinRoom } from "@/lib/firestore";
import { SoundEffects } from "@/lib/sounds";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Create Room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createPlayers, setCreatePlayers] = useState(2);
  const [createMode, setCreateMode] = useState("normal");
  const [createTimer, setCreateTimer] = useState(30);
  const [createShowPrompt, setCreateShowPrompt] = useState(true);
  const [createPreventRepeated, setCreatePreventRepeated] = useState(true);
  const [createMaxRounds, setCreateMaxRounds] = useState(5);

  useEffect(() => {
    const saved = getPlayerName();
    if (saved) setName(saved);
  }, []);

  const handleOpenCreateModal = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name.");
      return;
    }
    setError("");
    setShowCreateModal(true);
  };

  const handleCreateRoom = async () => {
    SoundEffects.playClick();
    const trimmed = name.trim();
    if (!trimmed) return;
    
    setLoading(true);

    try {
      const sessionId = getSessionId();
      setPlayerName(trimmed);
      const roomId = await createRoom({
        hostId: sessionId,
        hostName: trimmed,
        timePerRound: createTimer,
        showPrompt: createShowPrompt,
        preventRepeated: createPreventRepeated,
        maxRounds: createMaxRounds,
      });
      setSavedRoomId(roomId);
      SoundEffects.playSuccess();
      router.push(`/lobby/${roomId}`);
    } catch (err) {
      SoundEffects.playError();
      setError("Failed to create room. Try again.");
      console.error(err);
      setShowCreateModal(false);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    SoundEffects.playClick();
    const trimmedName = name.trim();
    const trimmedCode = roomCode.trim().toUpperCase();

    if (!trimmedName || !trimmedCode) {
      if (!trimmedName) setError("Please enter your name.");
      else setError("Please enter a room code.");
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
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10 w-full overflow-x-hidden">
      <header id="global-header" className="flex items-center justify-between whitespace-nowrap px-4 md:px-20 py-4 md:py-6 animate-fade-in-up flex-shrink-0 z-10 w-full relative">
        <div className="flex items-center gap-2 md:gap-3 text-white cursor-pointer group">
          <a href="/" className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#ec5b13] rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-base md:text-xl">psychology</span>
            </div>
            <h2 className="text-white text-xl md:text-2xl font-black leading-tight tracking-tight">MindSync</h2>
          </a>
        </div>
        <div className="flex items-center gap-2 md:gap-4 scale-90 md:scale-100 origin-right">
          <button className="px-4 md:px-6 py-2 bg-white/10 hover:bg-white/20 transition-colors text-white text-[10px] md:text-sm font-bold rounded-xl border border-white/10 shadow-lg">Rules</button>
          <button className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-[#ec5b13] bg-[#ec5b13]/20 flex items-center justify-center text-[#ec5b13] hover:bg-[#ec5b13]/40 transition-colors shadow-lg">
            <span className="material-symbols-outlined text-xs md:text-sm">person</span>
          </button>
        </div>
      </header>

      <main id="home-screen" className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-16">
        <div className="max-w-[800px] w-full text-center flex flex-col items-center gap-6 md:gap-8 z-10">
          <div className="flex flex-col gap-3 md:gap-4 animate-fade-in-up">
            <h1 className="text-white text-5xl md:text-9xl font-black leading-none tracking-tighter glow-text animate-pulse-slow italic uppercase border-b-4 border-[#ec5b13]/20 pb-2">
              MindSync
            </h1>
            <h2 className="text-slate-300 text-base md:text-2xl font-medium max-w-[280px] md:max-w-lg mx-auto leading-relaxed animate-fade-in-up animate-delay-100 italic opacity-80">
              Think alike. Type together. Win as one.
            </h2>
          </div>

          {/* Name Input */}
          <div className="w-full max-w-sm animate-fade-in-up animate-delay-200">
            <div className="relative group">
              <input
                id="player-name-input"
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-2xl text-white focus:outline-0 focus:ring-4 focus:ring-[#ec5b13]/30 border-2 border-white/20 bg-white/10 backdrop-blur-md focus:border-[#ec5b13] h-14 px-6 text-lg font-bold transition-all placeholder:text-slate-400 placeholder:font-normal"
                placeholder="Enter your name"
                type="text"
                maxLength={15}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleOpenCreateModal()}
              />
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#ec5b13] transition-colors">
                <span className="material-symbols-outlined">badge</span>
              </div>
            </div>
            {error && <p className="text-red-400 text-sm mt-2 font-bold">{error}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center animate-fade-in-up animate-delay-300">
            <button
              onClick={handleOpenCreateModal}
              className="group flex-1 flex min-w-[180px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl h-16 px-8 bg-[#ec5b13] hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(236,91,19,0.6)] text-white text-lg font-extrabold transition-all duration-300"
            >
              <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">add_circle</span>
              <span>Create Room</span>
            </button>
            <button
              onClick={() => {
                SoundEffects.playClick();
                if (!name.trim()) {
                  setError("Please enter your name first.");
                } else if (roomCode.trim().length > 0) {
                  handleJoinRoom();
                } else {
                  document.getElementById('room-code-input')?.focus();
                }
              }}
              className="group flex-1 flex min-w-[180px] cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-2xl h-16 px-8 bg-[#22c55e] hover:scale-105 hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.6)] text-white text-lg font-extrabold transition-all duration-300"
            >
              <span className="material-symbols-outlined group-hover:scale-110 transition-transform">group_add</span>
              <span>Join Room</span>
            </button>
          </div>

          {/* Room Code Input */}
          <div className="flex flex-col gap-3 w-full max-w-sm mt-4 animate-fade-in-up animate-delay-400">
            <p className="text-slate-300 text-sm font-bold uppercase tracking-widest">Have a room code?</p>
            <div className="relative group">
              <input
                id="room-code-input"
                className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-2xl text-white focus:outline-0 focus:ring-4 focus:ring-[#22c55e]/30 border-2 border-white/20 bg-white/5 backdrop-blur-md focus:border-[#22c55e] h-16 placeholder:text-slate-500 px-6 text-xl text-center font-bold tracking-[0.5em] transition-all uppercase"
                maxLength={6}
                placeholder="CODE12"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              />
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#22c55e] transition-colors">
                <span className="material-symbols-outlined">key</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* How it works cards */}
        <div className="w-full px-4 md:px-0 mt-16 max-w-5xl mx-auto z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-4 text-center items-center hover:bg-white/10 transition-colors group animate-fade-in-up animate-delay-100">
              <div className="size-14 rounded-2xl bg-yellow-400/20 text-yellow-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">lightbulb</span>
              </div>
              <h3 className="text-white text-xl font-bold">Think</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Read the prompt and let your first instinct guide you to a single word.</p>
            </div>
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-4 text-center items-center hover:bg-white/10 transition-colors group animate-fade-in-up animate-delay-200">
              <div className="size-14 rounded-2xl bg-[#ec5b13]/20 text-[#ec5b13] flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">keyboard</span>
              </div>
              <h3 className="text-white text-xl font-bold">Type</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Submit your word silently. No hints or gestures allowed!</p>
            </div>
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col gap-4 text-center items-center hover:bg-white/10 transition-colors group animate-fade-in-up animate-delay-300">
              <div className="size-14 rounded-2xl bg-[#22c55e]/20 text-[#22c55e] flex items-center justify-center group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-3xl">sync</span>
              </div>
              <h3 className="text-white text-xl font-bold">Sync</h3>
              <p className="text-slate-400 leading-relaxed text-sm">Reveal the words. If they all match, your minds are truly synced!</p>
            </div>
          </div>
        </div>
      </main>

      <footer id="global-footer" className="w-full bg-[#1e293b]/80 border-t border-white/10 backdrop-blur-2xl px-6 md:px-20 py-12 mt-auto flex-shrink-0 animate-fade-in-up z-10 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center md:items-start gap-8">
          <div className="flex flex-col gap-4 text-white text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
               <span className="material-symbols-outlined text-[#ec5b13]">psychology</span>
               <span className="font-black text-xl">MindSync</span>
            </div>
            <p className="text-slate-400 text-sm max-w-[400px] leading-relaxed">
              Think of the same word as your friends without communicating. If everyone guesses the same word, you win. The ultimate test of friendship and intuition.
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-6">
            <div className="flex justify-center gap-4">
              <a className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors border border-white/10" href="#"><span className="material-symbols-outlined text-sm">share</span></a>
              <a className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors border border-white/10" href="#"><span className="material-symbols-outlined text-sm">settings</span></a>
              <a className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors border border-white/10" href="#"><span className="material-symbols-outlined text-sm">help</span></a>
            </div>
            <p className="text-slate-500 text-xs font-medium">© 2024 MindSync Multiplayer Games</p>
          </div>
        </div>
      </footer>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-panel rounded-3xl shadow-2xl flex flex-col border border-white/10 bg-[#0f172a]/90">
            <div className="sticky top-0 z-20 bg-[#1e293b]/90 backdrop-blur-md px-8 py-6 border-b border-white/10">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-white tracking-tight">Create Room</h2>
                  <p className="text-[#ec5b13] font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">stars</span> MindSync Party Mode
                  </p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/70 hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-8">
              {/* Player Settings Section */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#ec5b13] font-bold">groups</span>
                  <h3 className="text-lg font-bold text-white">Player Settings</h3>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {[2, 3, 4, 5, 6].map(num => (
                    <button key={num} onClick={() => setCreatePlayers(num)} className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-2xl border-2 transition-all hover:scale-105 font-black text-sm md:text-xl ${createPlayers === num ? 'border-[#ec5b13] bg-[#ec5b13]/20 text-white shadow-[0_0_15px_rgba(236,91,19,0.3)]' : 'border-white/10 bg-white/5 hover:border-white/30 text-white/50 hover:text-white'}`}>
                      {num}
                    </button>
                  ))}
                </div>
              </section>

              {/* Game Mode Selection */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[#ec5b13] font-bold">sports_esports</span>
                  <h3 className="text-lg font-bold text-white">Game Mode</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { id: 'normal', icon: 'mood', color: 'text-green-400', border: 'peer-checked:border-green-400 peer-checked:bg-green-400/10', title: 'Normal', desc: 'Relaxed play' },
                    { id: 'hard', icon: 'bolt', color: 'text-orange-400', border: 'peer-checked:border-orange-400 peer-checked:bg-orange-400/10', title: 'Hard', desc: 'Limited clues' },
                    { id: 'chaos', icon: 'cyclone', color: 'text-purple-400', border: 'peer-checked:border-purple-400 peer-checked:bg-purple-400/10', title: 'Chaos', desc: 'Random rules' }
                  ].map(mode => (
                    <label key={mode.id} className="relative cursor-pointer group">
                      <input checked={createMode === mode.id} onChange={() => setCreateMode(mode.id)} className="peer sr-only" name="mode" type="radio" />
                      <div className={`p-4 rounded-2xl border-2 border-white/10 bg-white/5 ${mode.border} flex flex-col items-center text-center gap-1 transition-all`}>
                        <span className={`material-symbols-outlined ${mode.color}`}>{mode.icon}</span>
                        <span className="font-bold text-white">{mode.title}</span>
                        <span className="text-xs text-white/40">{mode.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Word & Reveal Rules */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#ec5b13] font-bold">rule</span>
                    <h3 className="text-lg font-bold text-white">Logic Rules</h3>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-white/80 font-medium">Show prompt/hint</span>
                      <div className="relative inline-flex items-center">
                        <input checked={createShowPrompt} onChange={(e) => { SoundEffects.playClick(); setCreateShowPrompt(e.target.checked); }} className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ec5b13] shadow-inner"></div>
                      </div>
                    </label>
                    {/* Fixed "Prevent repeated words" toggle */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-emerald-400">history</span>
                        <span className="text-sm font-bold text-slate-200">Prevent repeated words</span>
                      </div>
                      <button 
                        onClick={() => { SoundEffects.playClick(); setCreatePreventRepeated(!createPreventRepeated); }}
                        className={`w-12 h-6 rounded-full transition-colors relative ${createPreventRepeated ? 'bg-[#ec5b13]' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${createPreventRepeated ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                </section>

                {/* Time & Reveal */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#ec5b13] font-bold">timer</span>
                    <h3 className="text-lg font-bold text-white">Time Control</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-white/80 font-medium">Guess Timer: <span className="text-[#ec5b13]">{createTimer}s</span></span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#ec5b13]">15s</span>
                        <input value={createTimer} onChange={e => { setCreateTimer(Number(e.target.value)); }} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#ec5b13]" max="60" min="15" step="15" type="range" />
                        <span className="text-xs font-bold text-[#ec5b13]">60s</span>
                      </div>
                    </div>
                    {/* Max Rounds Slider */}
                    <div className="flex flex-col gap-2 mt-4">
                      <span className="text-white/80 font-medium font-bold">Max Rounds: <span className="text-[#ec5b13]">{createMaxRounds}</span></span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#ec5b13]">5</span>
                        <input value={createMaxRounds} onChange={e => { setCreateMaxRounds(Number(e.target.value)); }} className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#ec5b13]" max="100" min="5" step="5" type="range" />
                        <span className="text-xs font-bold text-[#ec5b13]">100</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Accessibility & Effects */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-white/10">
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#ec5b13] font-bold">record_voice_over</span>
                    <h3 className="text-lg font-bold text-white">Voice Settings</h3>
                  </div>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-white/80 font-medium">Text-to-speech reveal</span>
                    <div className="relative inline-flex items-center">
                      <input className="sr-only peer" type="checkbox" />
                      <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ec5b13] shadow-inner"></div>
                    </div>
                  </label>
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[#ec5b13] font-bold">auto_fix_high</span>
                    <h3 className="text-lg font-bold text-white">Animation Settings</h3>
                  </div>
                  <div className="space-y-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-white/80 font-medium">Confetti animation</span>
                      <div className="relative inline-flex items-center">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ec5b13] shadow-inner"></div>
                      </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer group">
                      <span className="text-white/80 font-medium">Card reveal effects</span>
                      <div className="relative inline-flex items-center">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ec5b13] shadow-inner"></div>
                      </div>
                    </label>
                  </div>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#1e293b]/90 backdrop-blur-md px-8 py-6 border-t border-white/10 flex flex-col sm:flex-row gap-4 z-20">
              <button disabled={loading} onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-white/50 hover:text-white hover:bg-white/5 transition-colors">
                Cancel
              </button>
              <button disabled={loading} onClick={handleCreateRoom} className="flex-[2] px-6 py-4 rounded-2xl font-black text-white bg-[#22c55e] hover:bg-[#16a34a] shadow-[0_8px_0_rgb(21,128,61)] hover:translate-y-[2px] hover:shadow-[0_6px_0_rgb(21,128,61)] active:translate-y-[8px] active:shadow-none transition-all flex items-center justify-center gap-2 text-xl disabled:opacity-50">
                {loading ? "Creating..." : "Create Room"}
                <span className="material-symbols-outlined">rocket_launch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
