"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionId, clearSavedRoomId } from "@/lib/session";
import { listenToRoom, leaveRoom, playAgain } from "@/lib/firestore";
import { Room } from "@/lib/types";
import { calculateChemistry, getEnhancedSimilarity } from "@/lib/chemistry";
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
    let stopSpawning = false;
    
    // Stop spawning more confetti after 6 seconds for a "slow finish"
    const stopTimeout = setTimeout(() => {
      stopSpawning = true;
    }, 6000);

    function animate() {
      if(!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      let allGone = true;
      particles.forEach(p => {
        p.update();
        if (stopSpawning && p.y > canvas.height) {
           p.opacity = 0; // Don't draw or reset
        } else {
           p.draw();
           allGone = false;
        }
        
        // If we want a slow finish, we can stop calling reset() inside update()
        // Let's modify Particle class update slightly below
      });

      if (!allGone || !stopSpawning) {
        animationId = requestAnimationFrame(animate);
      }
    }

    // Modify Particle class for internal stopping logic
    const originalUpdate = Particle.prototype.update;
    Particle.prototype.update = function() {
      this.y += this.vy;
      this.x += this.vx;
      this.rotation += this.rotationSpeed;
      if (this.y > canvas.height + 20) {
        if (!stopSpawning) {
          this.reset();
        } else {
          this.opacity *= 0.95; // Fade out as they fall if we're stopping
        }
      }
    };

    animate();

    return () => {
      clearTimeout(stopTimeout);
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
            <div className="bg-[#ec5b13] p-10 rounded-[3rem] shadow-[0_20px_50px_-10px_rgba(236,91,19,0.3)] flex flex-col items-center justify-center text-center relative overflow-hidden group hover:scale-[1.02] transition-transform w-full">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-10 -mt-10"></div>
              <p className="text-white/70 uppercase tracking-[0.3em] text-[10px] font-black mb-2">Total Sync Score</p>
              <div className="text-8xl md:text-9xl font-black text-white drop-shadow-2xl">{chemistry.score}%</div>
              <p className="mt-4 text-white font-black italic text-lg tracking-tight uppercase">"{chemistry.label}"</p>
            </div>
            
            <div className="bg-white/[0.03] backdrop-blur-xl p-8 rounded-[3rem] border border-white/10 relative overflow-hidden group hover:bg-white/[0.05] transition-all cursor-help w-full">
              <div className="relative z-10">
                <p className="text-slate-500 uppercase tracking-widest text-[10px] font-black mb-4 flex items-center gap-2">
                   <span className="material-symbols-outlined text-sm">analytics</span>
                   Chemistry Breakdown
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center group/item">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-tighter group-hover/item:text-slate-200 transition-colors">Sync Speed</span>
                    <div className="flex items-center gap-3">
                       <span className="text-white font-black">{chemistry.speedScore}%</span>
                       <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${chemistry.speedScore}%` }}></div>
                       </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center group/item">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-tighter group-hover/item:text-slate-200 transition-colors">Semantic Flow</span>
                    <div className="flex items-center gap-3">
                       <span className="text-white font-black">{Math.round(Number(chemistry.similarityScore || 0))}%</span>
                       <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${chemistry.similarityScore}%` }}></div>
                       </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center group/item">
                    <span className="text-slate-400 font-bold text-xs uppercase tracking-tighter group-hover/item:text-slate-200 transition-colors">Group Agreement</span>
                    <div className="flex items-center gap-3">
                       <span className="text-white font-black">{Math.round(Number(chemistry.agreementScore || 0))}%</span>
                       <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${chemistry.agreementScore}%` }}></div>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Stats & Individual Chemistry */}
          <div className="w-full max-w-2xl mb-12 flex flex-col gap-8 animate-entrance stagger-3">
            <div className="bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-[2.5rem] p-6 md:p-10">
              <div className="flex items-center gap-3 mb-8">
                <span className="material-symbols-outlined text-[#ec5b13]">diversity_3</span>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Team Individual Chemistry</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(() => {
                   const pairs: { p1: any, p2: any, score: number }[] = [];
                   for (let i = 0; i < room.players.length; i++) {
                     for (let j = i + 1; j < room.players.length; j++) {
                        const p1 = room.players[i];
                        const p2 = room.players[j];
                        
                        let totalSim = 0;
                        const roundEntries = Object.values(room.roundHistory);
                        roundEntries.forEach(guesses => {
                           if (guesses[p1.id] && guesses[p2.id]) {
                             totalSim += getEnhancedSimilarity(guesses[p1.id], guesses[p2.id]);
                           }
                        });
                        const avgSim = totalSim / (roundEntries.length || 1);
                        pairs.push({ p1, p2, score: Math.min(100, Math.round(avgSim * 100)) });
                     }
                   }
                   
                   return pairs.sort((a, b) => b.score - a.score).map((pair, idx) => (
                     <div key={`${pair.p1.id}-${pair.p2.id}`} className="bg-white/5 border border-white/5 p-5 rounded-2xl flex items-center justify-between group hover:border-[#ec5b13]/20 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="flex -space-x-3">
                              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-black text-slate-400 text-sm border border-white/10">{pair.p1.name.charAt(0)}</div>
                              <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center font-black text-slate-300 text-sm border border-white/10 shadow-xl">{pair.p2.name.charAt(0)}</div>
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{pair.p1.name} & {pair.p2.name}</p>
                              <p className="text-xs font-black text-white italic">Rank #{idx + 1} Best Match</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className={`text-xl font-black ${pair.score >= 80 ? 'text-emerald-400' : 'text-[#ec5b13]'}`}>{pair.score}%</div>
                           <div className="w-16 h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                              <div className={`h-full ${pair.score >= 80 ? 'bg-emerald-400' : 'bg-[#ec5b13]'}`} style={{ width: `${pair.score}%` }}></div>
                           </div>
                        </div>
                     </div>
                   ));
                })()}
              </div>
            </div>

            {/* Quick Actions/Ideas Section */}
            <div className="bg-gradient-to-br from-[#ec5b13]/10 to-indigo-900/20 backdrop-blur-3xl border border-[#ec5b13]/20 rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden group">
               <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#ec5b13] opacity-20 blur-[60px] rounded-full group-hover:scale-125 transition-transform duration-700"></div>
               <div className="relative z-10">
                  <h3 className="text-xl font-black text-white italic mb-6">WHAT'S NEXT, SYNCERS?</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <div className="bg-black/20 p-4 rounded-2xl border border-white/5 hover:translate-y-[-5px] transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-[#ec5b13] mb-2">trending_up</span>
                        <p className="text-[10px] font-black text-white uppercase mb-1">STREAK MODE</p>
                        <p className="text-[9px] text-slate-400 leading-tight">Can you match 3 games in a row without failing? Unlock 'Legend' status.</p>
                     </div>
                     <div className="bg-black/20 p-4 rounded-2xl border border-white/5 hover:translate-y-[-5px] transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-indigo-400 mb-2">emoji_events</span>
                        <p className="text-[10px] font-black text-white uppercase mb-1">GLOBAL RANK</p>
                        <p className="text-[9px] text-slate-400 leading-tight">Your top score is {chemistry.score}%. You're in the top 12% of players today!</p>
                     </div>
                     <div className="bg-black/20 p-4 rounded-2xl border border-white/5 hover:translate-y-[-5px] transition-all cursor-pointer" onClick={() => { SoundEffects.playClick(); navigator.clipboard.writeText(window.location.href); alert("Link copied! Challenge your friends."); }}>
                        <span className="material-symbols-outlined text-emerald-400 mb-2">share</span>
                        <p className="text-[10px] font-black text-white uppercase mb-1">CHALLENGE</p>
                        <p className="text-[9px] text-slate-400 leading-tight">Share this result on X or WhatsApp and tag your 'Mind Twin'.</p>
                     </div>
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
