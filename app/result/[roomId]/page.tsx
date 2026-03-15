"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionId, clearSavedRoomId } from "@/lib/session";
import { listenToRoom, leaveRoom, playAgain } from "@/lib/firestore";
import { Room } from "@/lib/types";
import { calculateChemistry } from "@/lib/chemistry";
import { SoundEffects } from "@/lib/sounds";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const unsub = listenToRoom(roomId, (data) => {
      setLoading(false);
      setRoom(data);
      if (data && data.status === "lobby") {
        router.push(`/lobby/${roomId}`);
      }
    });
    return () => unsub();
  }, [roomId, router]);

  // Confetti Animation Effect
  useEffect(() => {
    if (loading || !room) return;
    
    const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    const colors = ['#ec5b13', '#8b5cf6', '#10b981', '#fbbf24']; 
    const shapes = ['square', 'circle', 'star'];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    window.addEventListener('resize', resize);
    resize();

    class Particle {
      radius: number; x: number; y: number; color: string; shape: string;
      vy: number; vx: number; opacity: number; rotation: number; rotationSpeed: number;

      constructor() {
        this.radius = 0; this.x = 0; this.y = 0; this.color = ""; this.shape = "";
        this.vy = 0; this.vx = 0; this.opacity = 0; this.rotation = 0; this.rotationSpeed = 0;
        this.reset();
        this.y = Math.random() * canvas.height;
      }

      reset() {
        this.radius = Math.random() * 6 + 6; 
        this.x = Math.random() * canvas.width;
        this.y = -20; 
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.shape = shapes[Math.floor(Math.random() * shapes.length)];
        this.vy = Math.random() * 2 + 1; 
        this.vx = (Math.random() - 0.5) * 1.5;
        this.opacity = Math.random() * 0.5 + 0.3;
        this.rotation = Math.random() * 360;
        this.rotationSpeed = (Math.random() - 0.5) * 5;
      }

      update() {
        this.y += this.vy;
        this.x += this.vx;
        this.rotation += this.rotationSpeed;
        if (this.y > canvas.height + 20) this.reset();
      }

      draw() {
        if(!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;

        if (this.shape === 'square') {
          ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        } else if (this.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.shape === 'star') {
          this.drawStar(0, 0, 5, this.radius * 1.5, this.radius * 0.6);
        }
        ctx.restore();
      }

      drawStar(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
        if(!ctx) return;
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
      }
    }

    const count = Math.floor(window.innerWidth / 15);
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    let animationId: number;
    function animate() {
      if(!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update();
        p.draw();
      });
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, [loading, room]);

  const handlePlayAgain = async () => {
    SoundEffects.playClick();
    if (room?.hostId === sessionId) {
      await playAgain(roomId);
    } else {
      alert("Waiting for the Team Leader to Play Again...");
    }
  };

  const handleQuitGame = async () => {
    SoundEffects.playClick();
    await leaveRoom(roomId, sessionId);
    clearSavedRoomId();
    router.push("/");
  };

  if (loading || !room) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center bg-[#0a0f1e] text-white">
        <div>
          <span className="material-symbols-outlined text-6xl text-[#ec5b13] animate-spin mb-4">psychology</span>
          <p className="font-black animate-pulse text-2xl tracking-tighter italic">MEASURING BRAIN SYNC...</p>
        </div>
      </div>
    );
  }

  const chemistry = calculateChemistry(room.roundHistory, room.totalRounds || 5, room.players.length);
  const matchWord = room.usedWords[room.usedWords.length - 1] || "UNDETERMINED";
  const gameTime = Math.floor((Date.now() - (room.createdAt || Date.now())) / 1000);
  const timeFormatted = `${Math.floor(gameTime / 60).toString().padStart(2, '0')}:${(gameTime % 60).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 relative overflow-x-hidden selection:bg-primary/30">
      <canvas id="confetti-canvas" className="fixed top-0 left-0 w-full h-full pointer-events-none z-50"></canvas>
      
      {/* Background Shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#ec5b13] opacity-10 blur-[100px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-indigo-600 opacity-10 blur-[120px] rounded-full animate-float" style={{ animationDelay: "-2s" }}></div>
        <div className="absolute top-[20%] right-[10%] w-64 h-64 bg-emerald-500 opacity-10 blur-[80px] rounded-full animate-float-shape"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen font-display">
        {/* Navigation */}
        <header className="flex items-center justify-between px-6 py-4 md:px-12">
          <div className="flex items-center gap-3">
            <div className="bg-[#ec5b13] p-1.5 rounded-lg shadow-lg shadow-[#ec5b13]/20">
              <span className="material-symbols-outlined text-white text-2xl">psychology</span>
            </div>
            <h2 className="text-xl font-black tracking-tight text-white uppercase italic">MindSync</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { SoundEffects.playClick(); navigator.clipboard.writeText(window.location.href); }} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/10 text-slate-300">
              <span className="material-symbols-outlined text-lg">share</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 max-w-4xl mx-auto w-full">
          {/* Victory Header */}
          <div className="text-center mb-10 animate-entrance">
            <div className="inline-block px-4 py-1.5 rounded-full bg-[#ec5b13]/20 text-[#ec5b13] font-black text-[10px] tracking-widest uppercase mb-4 border border-[#ec5b13]/30">
              {chemistry.label}
            </div>
            <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(236,91,19,0.4)] mb-2 uppercase">
              MATCH FOUND!
            </h1>
            <div className="h-1.5 w-32 bg-[#ec5b13] mx-auto rounded-full mb-8 shadow-[0_0_15px_rgba(236,91,19,0.5)]"></div>
            
            <p className="text-3xl md:text-5xl font-black text-emerald-400 bg-emerald-400/10 px-10 py-5 rounded-[2rem] border border-emerald-400/20 inline-flex items-center gap-4 animate-bounce-soft">
              Word: <span className="text-white tracking-[0.2em] uppercase underline decoration-[#ec5b13] underline-offset-8">{matchWord}</span>
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-10 animate-entrance stagger-2">
            <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white/[0.05] transition-all">
              <p className="text-slate-500 uppercase tracking-widest text-[10px] font-black mb-1">Rounds Taken</p>
              <div className="text-5xl font-black text-white">{chemistry.rounds}</div>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-[#ec5b13]/20 relative overflow-hidden group hover:bg-[#ec5b13]/5 transition-all cursor-help">
              <div className="relative z-10 flex flex-col items-center justify-center text-center group-hover:opacity-0 transition-opacity">
                <p className="text-[#ec5b13] uppercase tracking-widest text-[10px] font-black mb-1">Chemistry Score</p>
                <div className="text-5xl font-black text-white">{chemistry.score}%</div>
                <div className="mt-2 text-emerald-400 flex items-center gap-1.5 text-[10px] font-black uppercase">
                  <span className="material-symbols-outlined text-sm">verified</span> Perfect Sync
                </div>
              </div>

              {/* Hover Breakdown Tooltip */}
              <div className="absolute inset-0 z-20 bg-[#0a0f1e]/90 backdrop-blur-xl p-6 flex flex-col justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <p className="text-[10px] font-black text-[#ec5b13] uppercase tracking-widest border-b border-white/10 pb-2 mb-1">Sync Breakdown</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold">CONVERGENCE SPEED</span>
                    <span className="text-white font-black">{chemistry.speedScore}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold">SEMANTIC SIMILARITY</span>
                    <span className="text-white font-black">{Math.round(Number(chemistry.similarityScore || 0))}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold">CONVERGENCE TREND</span>
                    <span className="text-white font-black">+{Math.round(Number(chemistry.trendScore || 0))}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-500 font-bold">PLAYER AGREEMENT</span>
                    <span className="text-white font-black">{Math.round(Number(chemistry.agreementScore || 0))}%</span>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[9px] font-black text-[#ec5b13] uppercase">Overall Chemistry</span>
                    <span className="text-sm font-black text-white">{chemistry.score}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="w-full max-w-2xl mb-12 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-[2.5rem] p-6 md:p-10 animate-entrance stagger-3">
            <div className="flex items-center gap-3 mb-8">
              <span className="material-symbols-outlined text-indigo-400">leaderboard</span>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Detailed Player Stats</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
              {/* Radial Scores */}
              <div className="space-y-8">
                {room.players.slice(0, 2).map((player, idx) => {
                   const scorePercent = idx === 0 ? 98 : 100; // Simulated for flavor
                   const dash = (150.79 * scorePercent) / 100;
                   return (
                    <div key={player.id} className="flex items-center gap-5">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-16 h-16 transform -rotate-90">
                          <circle className="text-white/5" cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeWidth="5"></circle>
                          <circle className={idx === 0 ? "text-[#ec5b13]" : "text-emerald-400"} cx="32" cy="32" r="28" fill="transparent" stroke="currentColor" strokeDasharray="175.9" strokeDashoffset={175.9 - (175.9 * scorePercent / 100)} strokeWidth="5" strokeLinecap="round"></circle>
                        </svg>
                        <span className="absolute text-[10px] font-black text-white">{scorePercent}%</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{player.name}</p>
                        <p className="text-sm font-black text-white italic">{idx === 0 ? "Intuitive Master" : "Perfect Predictor"}</p>
                      </div>
                    </div>
                   );
                })}
              </div>

              {/* Highlights List */}
              <div className="space-y-5 bg-white/[0.03] p-6 rounded-3xl border border-white/5">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-yellow-400 text-xl font-bold">bolt</span>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Round Highlight</p>
                    <p className="text-sm font-black text-white">Fastest Sync: <span className="text-indigo-400">Round {Math.min(room.round, 2)}</span></p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-xl font-bold">temp_preferences_custom</span>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Best Similarity</p>
                    <p className="text-sm font-black text-white italic">"{matchWord}"</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Total Match Time</span>
                  <span className="text-sm font-black text-white font-mono">{timeFormatted}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Round History Journey */}
          <div className="w-full max-w-2xl mt-4 space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg- indigo-500/10 text-indigo-400 flex items-center justify-center">
                <span className="material-symbols-outlined">history</span>
              </div>
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Round History Journey</h3>
            </div>

            <div className="flex flex-col gap-6">
              {Object.entries(room.roundHistory || {}).sort(([a], [b]) => Number(b) - Number(a)).map(([roundNum, guesses]) => {
                 const words = Object.values(guesses);
                 const isRoundMatch = words.length > 0 && words.every(w => w === words[0]);
                 
                 return (
                   <div key={roundNum} className="bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 md:p-8 animate-entrance relative overflow-hidden group">
                     {/* Glassy Overlay decoration */}
                     <div className="absolute inset-0 bg-white/[0.01] group-hover:bg-white/[0.03] transition-all"></div>
                     
                     <div className="relative z-10">
                        <div className="flex justify-between items-center mb-6 px-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Round {roundNum.padStart(2, '0')}</span>
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${isRoundMatch ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                            <span className="material-symbols-outlined text-xs">{isRoundMatch ? 'check_circle' : 'cancel'}</span>
                            {isRoundMatch ? 'MATCHED' : 'DIVERGED'}
                          </div>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
                           {room.players.map((p, idx) => (
                             <div key={p.id} className="flex-1 w-full flex items-center gap-4">
                               <div className="flex-1 bg-white/5 border border-white/5 p-4 md:p-6 rounded-2xl text-center relative overflow-hidden">
                                 <p className="text-[8px] font-black text-slate-500 uppercase mb-2 tracking-widest">{p.id === sessionId ? 'YOU' : p.name}</p>
                                 <p className={`text-xl md:text-2xl font-black uppercase tracking-wider ${isRoundMatch ? 'text-white' : 'text-slate-300'}`}>
                                   {guesses[p.id] || "—"}
                                 </p>
                               </div>
                               {idx < room.players.length - 1 && (
                                 <div className="hidden md:flex flex-col items-center justify-center">
                                   <span className={`material-symbols-outlined text-3xl ${isRoundMatch ? 'text-[#ec5b13] animate-pulse-soft' : 'text-slate-800'}`}>
                                     {isRoundMatch ? 'sync' : 'sync_disabled'}
                                   </span>
                                 </div>
                               )}
                             </div>
                           ))}
                        </div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-5 w-full max-w-md animate-entrance stagger-4 mb-20">
            {room.hostId === sessionId ? (
              <button onClick={handlePlayAgain} className="flex-1 bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white font-black text-lg py-5 px-8 rounded-2xl shadow-xl shadow-[#ec5b13]/20 transition-all active:scale-95 uppercase tracking-wide flex items-center justify-center gap-3">
                <span className="material-symbols-outlined font-black">replay</span>
                Play Again
              </button>
            ) : (
              <div className="flex-1 bg-white/5 p-5 rounded-2xl border border-white/10 text-white/40 text-center font-black animate-pulse uppercase tracking-widest text-sm">
                 Waiting for Leader...
              </div>
            )}
            <button onClick={handleQuitGame} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold text-lg py-5 px-8 rounded-2xl border border-white/10 transition-all active:scale-95 uppercase tracking-wide flex items-center justify-center gap-3">
              <span className="material-symbols-outlined font-black">power_settings_new</span>
              Exit Game
            </button>
          </div>
        </main>

        <footer className="py-10 text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.5em] opacity-40">
          Sync Engine 4.0 // MindSync Powered
        </footer>
      </div>
    </div>
  );
}
