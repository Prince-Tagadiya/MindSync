"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionId, clearSavedRoomId } from "@/lib/session";
import { listenToRoom, leaveRoom, playAgain } from "@/lib/firestore";
import { Room, Player } from "@/lib/types";
import { calculateChemistry, getEnhancedSimilarity, getAvgSim, calculatePairwiseChemistry } from "@/lib/chemistry";
import { SoundEffects } from "@/lib/sounds";
import { toBlob } from "html-to-image";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const sessionId = typeof window !== "undefined" ? getSessionId() : "";

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

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

  const handleShareStory = async () => {
    if (!storyRef.current || sharing) return;
    setSharing(true);
    SoundEffects.playClick();
    
    try {
      const blob = await toBlob(storyRef.current, {
        quality: 0.95,
        width: 1080,
        height: 1920,
      });
      
      if (!blob) throw new Error("Failed to generate image");

      const file = new File([blob], `MindSync-Result-${roomId}.jpg`, { type: 'image/jpeg' });
      
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'We Synced on MindSync!',
          text: 'Check out our chemistry score!',
        });
      } else {
        // Fallback: Download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MindSync-Result-${roomId}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        alert("Story image downloaded! Share it manually to your story.");
      }
    } catch (error) {
       console.error("Story sharing failed", error);
       alert("Could not generate shareable image. Try again!");
    } finally {
       setSharing(false);
    }
  };

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
           p.opacity = 0; 
        } else {
           p.draw();
           allGone = false;
        }
      });

      if (!allGone || !stopSpawning) {
        animationId = requestAnimationFrame(animate);
      }
    }

    const originalUpdate = Particle.prototype.update;
    Particle.prototype.update = function() {
      this.y += this.vy;
      this.x += this.vx;
      this.rotation += this.rotationSpeed;
      if (this.y > canvas.height + 20) {
        if (!stopSpawning) {
          this.reset();
        } else {
          this.opacity *= 0.95; 
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
      <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0a0f1e] text-white">
        <div>
          <span className="material-symbols-outlined text-6xl text-[#ec5b13] animate-spin mb-4">psychology</span>
          <p className="font-black animate-pulse text-2xl tracking-tighter italic">MEASURING BRAIN SYNC...</p>
        </div>
      </div>
    );
  }

  // Handle results persistence if room is already reset but we're on results page
  const displayData = room.status === "finished" ? {
    history: room.roundHistory,
    players: room.players,
    rounds: room.round
  } : room.lastMatchResults ? {
    history: room.lastMatchResults.roundHistory,
    players: room.players.map(p => ({ 
      ...p, 
      coins: room.lastMatchResults?.playerCoins[p.id] !== undefined ? room.lastMatchResults.playerCoins[p.id] : p.coins 
    })),
    rounds: room.lastMatchResults.totalRounds
  } : {
    history: room.roundHistory,
    players: room.players,
    rounds: room.round
  };

  const chemistry = calculateChemistry(displayData.history, displayData.rounds, displayData.players.length);
  const pairwise = calculatePairwiseChemistry(displayData.history, displayData.players);
  
  // Calculate Best Pair (Twins Duo)
  const getBestPair = () => {
    let best = { p1: "", p2: "", score: 0 };
    const players = displayData.players;
    const history = displayData.history;
    
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        let totalSim = 0;
        let rounds = 0;
        Object.values(history).forEach(guesses => {
          if (guesses[players[i].id] && guesses[players[j].id]) {
            totalSim += getEnhancedSimilarity(guesses[players[i].id], guesses[players[j].id]);
            rounds++;
          }
        });
        const avg = totalSim / (rounds || 1);
        if (avg > best.score) {
          best = { p1: players[i].name, p2: players[j].name, score: avg };
        }
      }
    }
    return best;
  };

  const bestPair = getBestPair();
  const sortedByCoins = [...displayData.players].sort((a,b) => (b.coins || 0) - (a.coins || 0));

  const checkAllMatch = (guesses: Record<string, string>) => {
    const words = Object.values(guesses);
    if (words.length < 2) return false;
    return words.every(w => w.toLowerCase().trim() === words[0].toLowerCase().trim());
  };

  const personalSyncs = pairwise.filter(p => p.p1 === room.players.find(p => p.id === sessionId)?.name || p.p2 === room.players.find(p => p.id === sessionId)?.name);

  const topPartner = pairwise.length > 0 ? pairwise.reduce((prev, current) => (prev.score > current.score) ? prev : current) : null;
  const storyTopPartners = topPartner ? {
     p1: room?.players.find(p => p.name === topPartner.p1) || { name: topPartner.p1 },
     p2: room?.players.find(p => p.name === topPartner.p2) || { name: topPartner.p2 }
  } : null;

  return (
    <main className="min-h-screen bg-[#0a0f1d] text-slate-100 font-display relative overflow-x-hidden selection:bg-[#ec5b13] selection:text-white">
      {/* Off-screen Story Generation Card */}
      <StoryCard 
        room={room} 
        totalChemistry={chemistry.score} 
        topPartners={storyTopPartners} 
        ref={storyRef}
      />
      
      <canvas id="confetti-canvas" className="fixed inset-0 pointer-events-none z-50 pointer-events-none" />
      
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#ec5b13]/10 blur-[150px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 blur-[180px] rounded-full animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-10 pt-12 md:pt-20">
        {/* Header */}
        <div className="text-center space-y-4 mb-16 md:mb-20 animate-entrance">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-2">
             <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Match Concluded</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ec5b13] via-orange-400 to-yellow-300 drop-shadow-[0_0_30px_rgba(236,91,19,0.3)] italic">THE RESULTS</span>
          </h1>
          <p className="text-slate-400 font-bold max-w-xs md:max-w-md mx-auto text-sm md:text-base">{displayData.rounds} ROUNDS OF BRAIN SYNC. HOW DID YOU DO?</p>
        </div>

        {/* Sync Percentage Card */}
        <div className="relative mb-16 md:mb-20 animate-scale-in">
          <div className="absolute inset-0 bg-gradient-to-b from-[#ec5b13]/20 via-transparent to-transparent rounded-[2rem] md:rounded-[3rem] blur-xl opacity-50"></div>
          <div className="bg-white/[0.02] backdrop-blur-3xl p-8 md:p-16 text-center border border-white/10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-40 h-40 md:w-64 md:h-64 border-[20px] md:border-[40px] border-white/5 rounded-full"></div>
            
            <div className="relative">
              <div className="text-[7rem] md:text-[14rem] font-black text-white leading-none tracking-tighter flex items-center justify-center gap-1">
                 {chemistry.score}<span className="text-2xl md:text-6xl text-[#ec5b13] mt-4 md:mt-8">%</span>
              </div>
              <h2 className="text-xl md:text-4xl font-black text-[#ec5b13] uppercase italic tracking-widest mt-2 md:mt-4">
                 {chemistry.label}
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 pt-10 md:pt-12 border-t border-white/10 mt-8 md:mt-10">
              <StatItem label="Speed" value={chemistry.speedScore} icon="bolt" color="#ec5b13" />
              <StatItem label="Similarity" value={Math.round(chemistry.similarityScore)} icon="auto_awesome" color="#8b5cf6" />
              <StatItem label="Trend" value={Math.round(chemistry.trendScore * 3.33)} icon="trending_up" color="#10b981" />
              <StatItem label="Agreement" value={Math.round(chemistry.agreementScore)} icon="handshake" color="#fbbf24" />
            </div>
          </div>
        </div>

        {/* Peer Breakdown (Individual Sync Section) */}
        {pairwise.length > 0 && (
          <div className="mb-16 md:mb-20 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
             <h3 className="text-xl md:text-2xl font-black uppercase italic mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-purple-500">cell_tower</span>
                Network Chemistry
             </h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pairwise.map((pair, idx) => (
                   <div key={idx} className="bg-white/[0.03] border border-white/10 rounded-[2rem] p-6 hover:bg-white/[0.06] transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                         <div className="flex -space-x-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-black ring-2 ring-[#0a0f1d]">{pair.p1.charAt(0)}</div>
                            <div className="w-10 h-10 rounded-xl bg-slate-700 border border-white/10 flex items-center justify-center text-xs font-black ring-2 ring-[#0a0f1d]">{pair.p2.charAt(0)}</div>
                         </div>
                         <div>
                            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">{pair.label}</p>
                            <p className="font-bold text-sm text-slate-200">{pair.p1} + {pair.p2}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-black italic">{pair.score}%</p>
                         <div className="w-12 h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${pair.score}%` }}></div>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* Twins Duo Highlight */}
        {bestPair.score > 0.5 && (
          <div className="mb-16 md:mb-20 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
             <h3 className="text-xl md:text-2xl font-black uppercase italic mb-8 flex items-center justify-center gap-3 shrink-0">
                <span className="material-symbols-outlined text-yellow-400">auto_awesome</span>
                THE TWINS DUO
             </h3>
             
             <div className="bg-white/[0.02] border border-yellow-400/20 rounded-[2.5rem] p-8 md:p-10 bg-gradient-to-br from-yellow-400/5 via-transparent to-transparent relative group max-w-2xl mx-auto">
                <div className="flex flex-row items-center justify-center gap-6 md:gap-10">
                   <div className="text-center">
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-slate-800 border-2 border-yellow-400/50 flex items-center justify-center text-2xl md:text-4xl font-black text-white shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                         {bestPair.p1.charAt(0)}
                      </div>
                      <p className="mt-3 md:mt-4 font-black uppercase text-[10px] md:text-sm tracking-widest text-slate-300">{bestPair.p1}</p>
                   </div>
                   
                   <div className="flex flex-col items-center">
                      <div className="bg-yellow-400 text-[#0a0f1d] px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter mb-3">
                         {Math.round(bestPair.score * 100)}% SYNC
                      </div>
                      <span className="material-symbols-outlined text-yellow-500 text-3xl md:text-5xl animate-pulse">handshake</span>
                   </div>

                   <div className="text-center">
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-3xl bg-slate-800 border-2 border-yellow-400/50 flex items-center justify-center text-2xl md:text-4xl font-black text-white shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                         {bestPair.p2.charAt(0)}
                      </div>
                      <p className="mt-3 md:mt-4 font-black uppercase text-[10px] md:text-sm tracking-widest text-slate-300">{bestPair.p2}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* Wavelength Hall of Fame */}
        <div className="mb-16 md:mb-20 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
           <h3 className="text-xl md:text-2xl font-black uppercase italic mb-8 flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-yellow-500">military_tech</span>
              MIND SYNC RANKINGS
           </h3>
           <div className="flex flex-col gap-4 max-w-2xl mx-auto">
              {sortedByCoins.map((p, idx) => (
                <div key={p.id} className={`bg-white/[0.02] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between group relative overflow-hidden ${idx === 0 ? 'bg-gradient-to-r from-yellow-400/5 to-transparent border-yellow-400/20 shadow-[0_0_30px_rgba(250,204,21,0.05)]' : ''}`}>
                   <div className="flex items-center gap-4 md:gap-6">
                      <span className={`text-2xl font-black italic opacity-20 ${idx === 0 ? 'text-yellow-400' : 'text-slate-600'}`}>{idx + 1}</span>
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center text-2xl font-black ${idx === 0 ? 'bg-yellow-400 text-slate-900 shadow-xl' : 'bg-white/5 text-slate-300'}`}>
                         {p.name.charAt(0)}
                      </div>
                      <div>
                         <p className="font-black uppercase tracking-tight text-lg md:text-2xl">{p.name}</p>
                         <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{idx === 0 ? 'GRAND MASTER' : idx === 1 ? 'ELITE SYNCER' : 'PLAYER'}</p>
                      </div>
                   </div>
                   <div className="text-right flex flex-col items-end">
                      <div className="flex items-center gap-1 md:gap-2">
                         <span className="text-2xl md:text-4xl font-black text-white">{p.coins || 0}</span>
                         <span className="material-symbols-outlined text-yellow-500 text-2xl font-black">monetization_on</span>
                      </div>
                      <p className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-yellow-500/50 mt-0.5">SCORE</p>
                   </div>
                </div>
              ))}
           </div>
        </div>

         {/* Global Control Bar (Fixed Bottom on Mobile) */}
         <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/95 to-transparent z-40 block md:hidden">
            <div className="flex gap-2">
               <button onClick={handlePlayAgain} className="flex-[2] bg-white text-[#0a0f1d] py-5 rounded-2xl font-black text-xl active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-2xl shadow-white/5">
                  <span className="material-symbols-outlined">refresh</span> REPLAY
               </button>
               <button 
                onClick={handleShareStory} 
                disabled={sharing}
                className="flex-1 bg-[#ec5b13] text-white py-5 rounded-2xl font-black text-xl active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-2xl"
               >
                  <span className="material-symbols-outlined">{sharing ? 'sync' : 'share'}</span>
               </button>
               <button onClick={handleQuitGame} className="w-16 bg-white/10 rounded-2xl backdrop-blur-xl border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform">
                  <span className="material-symbols-outlined">exit_to_app</span>
               </button>
            </div>
         </div>

         {/* Desktop Controls */}
         <div className="hidden md:flex gap-6 mb-20 max-w-4xl mx-auto">
            <button onClick={handlePlayAgain} className="flex-[2] bg-white text-[#0a0f1d] py-7 rounded-[2.5rem] font-black text-3xl hover:bg-[#ec5b13] hover:text-white transition-all transform hover:scale-[1.02] active:scale-95 shadow-2xl flex items-center justify-center gap-4">
               <span className="material-symbols-outlined text-4xl">celebration</span> PLAY AGAIN
            </button>
            <button 
              onClick={handleShareStory} 
              disabled={sharing}
              className="flex-1 bg-[#ec5b13] text-white py-7 rounded-[2.5rem] font-black text-2xl hover:bg-[#ec5b13]/90 transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3 shadow-2xl shadow-[#ec5b13]/20"
            >
               <span className="material-symbols-outlined text-3xl">{sharing ? 'sync' : 'share'}</span>
               {sharing ? 'GENERATING...' : 'SHARE STORY'}
            </button>
            <button onClick={handleQuitGame} className="flex-1 px-12 py-7 rounded-[2.5rem] bg-white/5 border border-white/10 font-black text-xl hover:bg-white/10 transition-all flex items-center justify-center gap-3">
               EXIT
            </button>
         </div>

        {/* History Log */}
        <div className="animate-fade-in-up pb-10" style={{ animationDelay: '0.8s' }}>
           <h3 className="text-xl md:text-2xl font-black italic uppercase mb-8 flex items-center gap-3">
              <span className="material-symbols-outlined">history</span> Full Log
           </h3>
           <div className="space-y-4 md:space-y-6">
              {Object.entries(displayData.history).sort(([a],[b]) => parseInt(b)-parseInt(a)).map(([r, guesses]) => {
                const isMatch = checkAllMatch(guesses);
                return (
                  <div key={r} className="bg-white/[0.02] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden">
                    <div className="bg-white/5 px-6 md:px-10 py-4 md:py-5 border-b border-white/5 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Round {r}</span>
                       {isMatch && <span className="text-[9px] font-black uppercase text-emerald-400 border border-emerald-400/20 px-3 py-1 rounded-full bg-emerald-400/10">Perfect Match</span>}
                    </div>
                    <div className="p-6 md:p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                       {displayData.players.map(p => (
                         <div key={p.id} className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500">
                               {p.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                               <p className="text-[9px] font-black text-slate-500 uppercase truncate mb-0.5">{p.name}</p>
                               <p className={`text-sm md:text-base font-black uppercase tracking-tight truncate ${isMatch ? 'text-emerald-400' : 'text-slate-200'}`}>{guesses[p.id] || '-'}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                );
              })}
           </div>
        </div>
      </div>
    </main>
  );
}

function StatItem({ label, value, icon, color }: { label: string, value: number, icon: string, color: string }) {
  return (
    <div className="space-y-3 group">
      <div className="flex items-center justify-center gap-2 text-slate-500 group-hover:text-slate-300 transition-colors">
        <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
        <span className="text-[11px] font-black uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className="text-4xl md:text-5xl font-black text-white">{value}%</div>
    </div>
  );
}

// STORY CARD COMPONENT (OFF-SCREEN)
function StoryCard({ room, totalChemistry, topPartners, ref }: any) {
  if (!room) return null;
  return (
    <div 
      ref={ref}
      style={{ width: '1080px', height: '1920px', position: 'fixed', left: '-10000px', top: '-10000px' }}
      className="bg-[#0a0f1e] overflow-hidden flex flex-col font-['Be_Vietnam_Pro'] text-white p-0 relative"
    >
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0a0f1e] to-black"></div>
          <div className="absolute top-[10%] left-[10%] w-[800px] h-[800px] bg-[#ec5b13]/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full p-20 items-center justify-between text-center">
         {/* MindSync Header */}
         <div>
            <div className="text-white text-3xl font-black italic tracking-[0.3em] uppercase mb-4 opacity-40">MindSync</div>
            <div className="w-32 h-1.5 bg-[#ec5b13] mx-auto rounded-full"></div>
         </div>

         {/* Main Hero */}
         <div className="flex flex-col items-center">
            <h1 className="text-8xl font-black italic tracking-tighter uppercase mb-6 leading-none">
              <span className="text-[#ec5b13]">We</span> Synced!
            </h1>
            <div className="p-12 rounded-full border-4 border-white/10 bg-white/5 backdrop-blur-3xl shadow-[0_0_80px_rgba(236,91,19,0.2)]">
               <div className="text-[200px] font-black leading-none text-[#ec5b13]">{totalChemistry}%</div>
               <div className="text-2xl font-black tracking-[0.4em] uppercase text-white/40 mt-4">Chemistry</div>
            </div>
         </div>

         {/* Connection Info */}
         <div className="w-full space-y-12">
            {topPartners && (
              <div className="space-y-6">
                <div className="text-white/60 font-black tracking-widest uppercase text-xl italic">Deepest Connection</div>
                <div className="flex items-center justify-center gap-10">
                   <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-3xl bg-[#ec5b13]/20 flex items-center justify-center text-4xl font-black text-[#ec5b13]">{topPartners.p1.name.charAt(0)}</div>
                      <div className="text-3xl font-black uppercase tracking-tight">{topPartners.p1.name}</div>
                   </div>
                   <span className="material-symbols-outlined text-6xl text-[#ec5b13]">link</span>
                   <div className="flex flex-col items-center gap-4">
                      <div className="w-24 h-24 rounded-3xl bg-[#ec5b13]/20 flex items-center justify-center text-4xl font-black text-[#ec5b13]">{topPartners.p2.name.charAt(0)}</div>
                      <div className="text-3xl font-black uppercase tracking-tight">{topPartners.p2.name}</div>
                   </div>
                </div>
              </div>
            )}
            
            <div className="bg-white/5 border border-white/10 rounded-[4rem] p-10 flex items-center justify-center gap-8">
               <div className="text-right">
                  <div className="text-white/40 font-bold text-xl uppercase tracking-widest mb-1">Rounds played</div>
                  <div className="text-5xl font-black whitespace-nowrap">{room.round}</div>
               </div>
               <div className="w-px h-16 bg-white/10"></div>
               <div className="text-left">
                  <div className="text-white/40 font-bold text-xl uppercase tracking-widest mb-1">Total Players</div>
                  <div className="text-5xl font-black whitespace-nowrap">{room.players.length}</div>
               </div>
            </div>
         </div>

         {/* Call to Action */}
         <div className="space-y-8">
            <div className="text-3xl font-black tracking-widest text-[#ec5b13] flex items-center justify-center gap-4">
              <span className="material-symbols-outlined text-5xl">sensors</span>
              SYNC YOUR MIND
            </div>
            <div className="text-2xl font-bold tracking-tight text-white/30 lowercase italic">mindsync-app.netlify.app</div>
         </div>
      </div>
    </div>
  );
}
