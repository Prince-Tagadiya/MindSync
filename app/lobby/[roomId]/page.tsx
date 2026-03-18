"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionId, getPlayerName, setSavedRoomId, clearSavedRoomId } from "@/lib/session";
import { listenToRoom, startGame, leaveRoom, joinRoom, updateRoomSettings, changeHost } from "@/lib/firestore";
import { Room } from "@/lib/types";
import { SoundEffects } from "@/lib/sounds";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingLeader, setPendingLeader] = useState<any>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);

  const sessionId = typeof window !== "undefined" ? getSessionId() : "";
  const isHost = room?.hostId === sessionId;

  useEffect(() => {
    if (!roomId || !sessionId) return;
    const name = getPlayerName();
    
    // Auto-join if name exists
    if (name) {
      joinRoom(roomId, sessionId, name).catch(() => {});
    }

    setSavedRoomId(roomId);

    const unsub = listenToRoom(roomId, (data) => {
      setLoading(false);
      if (!data) {
        setError("Room not found.");
        return;
      }
      setRoom(data);

      // If they have no name and aren't in the player list, show join modal
      const isPlayer = data.players.some(p => p.id === sessionId);
      if (!isPlayer && !getPlayerName()) {
        setShowJoinModal(true);
      }

      if (data.status === "playing" || data.status === "countdown" || data.status === "reveal") {
        if (isPlayer) router.push(`/game/${roomId}`);
      }
      if (data.status === "finished") {
        if (isPlayer) router.push(`/result/${roomId}`);
      }
    });

    return () => unsub();
  }, [roomId, sessionId, router]);

  const handleJoin = async () => {
    if (!joinName.trim() || joining) return;
    setJoining(true);
    SoundEffects.playClick();
    try {
      const { setPlayerName } = await import("@/lib/session");
      setPlayerName(joinName.trim());
      const res = await joinRoom(roomId, sessionId, joinName.trim());
      if (res.success) {
        setShowJoinModal(false);
        SoundEffects.playSuccess();
      } else {
        setError(res.error || "Failed to join.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setJoining(false);
    }
  };

  const handleInvite = async () => {
    SoundEffects.playClick();
    const inviteUrl = window.location.href;
    const shareData = {
      title: "Join my MindSync Room!",
      text: `Let's sync minds! Join my room ${roomId} and see our chemistry.`,
      url: inviteUrl,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log("Share cancelled or failed", err);
        // Fallback to copy
        navigator.clipboard.writeText(inviteUrl);
      }
    } else {
      navigator.clipboard.writeText(inviteUrl);
      alert("Invite link copied to clipboard!");
    }
  };

  const handleStartGame = async () => {
    SoundEffects.playClick();
    setStartError("");
    const result = await startGame(roomId, sessionId);
    if (!result.success) {
      setStartError(result.error || "Failed to start game.");
      SoundEffects.playError();
    } else {
      SoundEffects.playSuccess();
    }
  };

  const handleLeaveRoom = async () => {
    SoundEffects.playClick();
    await leaveRoom(roomId, sessionId);
    clearSavedRoomId();
    router.push("/");
  };

  const handleCopyCode = () => {
    SoundEffects.playClick();
    navigator.clipboard.writeText(roomId);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 font-bold animate-pulse">Loading Room...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2rem] flex flex-col items-center shadow-lg animate-entrance">
          <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
          <p className="text-red-400 font-bold text-xl mb-6">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/10 shadow-inner"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center w-full max-w-4xl mx-auto z-10 px-4 py-8">
      {/* Room Code Badge */}
      <div className="mb-10 text-center animate-scale-in flex-shrink-0 stagger-1">
        <div className="inline-flex flex-col items-center">
          <span className="text-slate-300 text-xs font-bold uppercase tracking-widest mb-2">Room Code</span>
          <div
            onClick={handleInvite}
            className="bg-white/10 border border-white/20 backdrop-blur-xl px-8 py-3 rounded-full shadow-2xl flex items-center gap-4 hover:scale-105 transition-transform duration-300 cursor-pointer"
            title="Invite collaborators"
          >
            <h1 className="text-white text-2xl md:text-4xl font-black tracking-[0.2em]">{roomId}</h1>
            <button className="text-[#ec5b13] hover:text-[#ec5b13]/80 transition-colors">
              <span className="material-symbols-outlined">share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Player List Card */}
      <div className="w-full bg-white/5 border border-white/10 flex-shrink-0 backdrop-blur-2xl rounded-[2.5rem] p-8 shadow-2xl mb-8 animate-entrance stagger-2">
        <div className="flex items-center justify-between mb-8 px-2">
          <h3 className="text-white text-xl font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-400">group</span>
            Players in Lobby
          </h3>
          <div className="flex items-center gap-4">
            <span className="bg-[#ec5b13]/20 text-[#ec5b13] px-4 py-1 rounded-full text-sm font-bold">
              {room?.players.length || 0} / 8
            </span>
            {isHost && (
              <button 
                onClick={() => {
                   SoundEffects.playClick();
                   setShowSettingsModal(true);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white border border-white/10"
              >
                <span className="material-symbols-outlined">settings</span>
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {room?.players.map((player) => {
            const isPlayerHost = player.id === room?.hostId;
            const isYou = player.id === sessionId;
            return (
              <div
                key={player.id}
                onClick={() => {
                  if (isHost && !isYou) {
                    setPendingLeader(player);
                  }
                }}
                className={`relative bg-[#1e293b]/50 border ${isHost && !isYou ? 'border-indigo-500/50 hover:bg-[#1e293b] cursor-pointer' : 'border-white/5'} rounded-2xl p-4 flex flex-col items-center justify-center gap-3 backdrop-blur-md shadow-lg player-card transition-all`}
                title={isHost && !isYou ? "Click to Make Leader" : ""}
              >
                {isPlayerHost && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-500 to-yellow-300 border-2 border-[#1e293b] flex justify-center items-center shadow-md animate-pulse-soft">
                    <span className="material-symbols-outlined text-white text-[16px]">stars</span>
                  </div>
                )}
                
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec5b13] p-1 flex items-center justify-center shadow-lg relative overflow-hidden animate-avatar-idle">
                  <div className="w-full h-full bg-[#0a0f1e] rounded-full flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10"></div>
                    <span className="text-white text-2xl font-black select-none z-10 tracking-widest">{player.name.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-center text-center">
                  <span className="text-white font-bold leading-tight max-w-full truncate px-2 text-sm">{player.name}</span>
                  {isYou && <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1">You</span>}
                  {isHost && !isYou && <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden md:block">Make Leader</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sync Bonus Guide */}
      <div className="w-full bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-6 md:p-8 shadow-2xl mb-8 animate-entrance stagger-3 overflow-hidden relative">
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#ec5b13]/5 blur-[60px] rounded-full"></div>
        
        <h3 className="text-white text-xl font-black italic uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ec5b13]">stars</span>
          Sync Rewards
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
          <BonusCard title="ULTRA SYNC" reward="+50" condition="Match same sec" icon="bolt" color="text-yellow-400" bgColor="bg-yellow-400/10" />
          <BonusCard title="HARMONY" reward="+25" condition="WHOLE room sync" icon="join_inner" color="text-emerald-400" bgColor="bg-emerald-400/10" />
          <BonusCard title="MIND TWINS" reward="+20" condition="Exact word sync" icon="handshake" color="text-[#ec5b13]" bgColor="bg-[#ec5b13]/10" />
          <BonusCard title="LATE SAVE" reward="+15" condition="Sync in final 5s" icon="history" color="text-orange-400" bgColor="bg-orange-400/10" />
          <BonusCard title="HIGH SYNC" reward="+10" condition="Close spell match" icon="auto_fix_high" color="text-purple-400" bgColor="bg-purple-400/10" />
          <BonusCard title="FIRST BLOOD" reward="+5" condition="1st to submit" icon="rocket_launch" color="text-blue-400" bgColor="bg-blue-400/10" />
        </div>
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
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col w-full max-w-md gap-4 px-4 animate-entrance shrink-0 mx-auto">
        {isHost ? (
          <div>
            <button
              onClick={handleStartGame}
              disabled={(room?.players.length || 0) < 2}
              className="w-full relative overflow-hidden bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black text-xl py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:bg-slate-700 disabled:text-slate-400 group"
            >
              <div className="absolute inset-0 bg-[#ec5b13] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0 hidden"></div>
              <span className="relative z-10 flex items-center justify-center gap-2 w-full">
                <span className="material-symbols-outlined font-bold">play_arrow</span>
                <span>START GAME</span>
              </span>
            </button>
            {startError && <p className="text-red-400 text-center font-bold mt-2 text-sm">{startError}</p>}
          </div>
        ) : (
          <div className="text-center text-white/40 justify-center w-full max-w-md mx-auto animate-entrance flex-shrink-0 animate-pulse text-sm mb-4">
            Waiting for the host to start the game...
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={handleInvite}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl border border-white/10 backdrop-blur-md flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-lg">share</span>
            Invite
          </button>
          <button
            onClick={handleLeaveRoom}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-4 rounded-2xl border border-red-500/20 backdrop-blur-md flex items-center justify-center gap-2 transition-all"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Leave
          </button>
        </div>
      </div>
      {/* Join Room Modal (For New Invitees) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in-up">
          <div className="relative w-full max-w-md glass-panel rounded-[2.5rem] shadow-2xl border border-white/10 p-10 flex flex-col gap-8 text-center bg-[#0a0f1e]/90 overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ec5b13] to-transparent"></div>
             
             <div>
               <div className="w-20 h-20 bg-[#ec5b13]/20 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-12">
                  <span className="material-symbols-outlined text-[#ec5b13] text-5xl">psychology</span>
               </div>
               <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Ready to Sync?</h2>
               <p className="text-slate-400 font-medium">You've been invited to join room <span className="text-[#ec5b13] font-bold tracking-widest">{roomId}</span></p>
             </div>

             <div className="space-y-4">
               <div className="relative group">
                  <input 
                    autoFocus
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    placeholder="ENTER YOUR NAME"
                    maxLength={15}
                    className="w-full bg-white/5 border-2 border-white/10 rounded-2xl h-16 px-6 text-center text-white font-black text-xl uppercase tracking-widest focus:border-[#ec5b13] transition-all outline-none placeholder:text-slate-600 placeholder:font-bold"
                  />
                  <div className="absolute inset-y-0 right-4 flex items-center text-slate-600 group-focus-within:text-[#ec5b13] transition-colors">
                     <span className="material-symbols-outlined">badge</span>
                  </div>
               </div>
               
               <button 
                onClick={handleJoin}
                disabled={!joinName.trim() || joining}
                className="w-full py-5 bg-[#ec5b13] hover:bg-[#ec5b13]/90 text-white font-black rounded-2xl text-xl shadow-[0_10px_30px_-5px_rgba(236,91,19,0.3)] transition-all hover:translate-y-[-2px] active:translate-y-0 disabled:opacity-50"
               >
                 {joining ? "Joining..." : "JOIN NOW"}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Transfer Leader Modal */}
      {pendingLeader && isHost && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in-up">
          <div className="relative w-full max-w-sm bg-[#0f172a]/95 glass-panel rounded-3xl shadow-2xl border border-white/10 p-8 flex flex-col gap-6 text-center">
             <div className="w-16 h-16 rounded-full bg-[#ec5b13]/20 text-[#ec5b13] flex items-center justify-center mx-auto mb-2">
                 <span className="material-symbols-outlined text-4xl">admin_panel_settings</span>
             </div>
             
             <div>
               <h2 className="text-2xl font-black text-white mb-2">Transfer Leadership</h2>
               <p className="text-slate-400 text-sm">
                 Are you sure you want to make <span className="text-white font-bold">{pendingLeader.name}</span> the new Team Leader? You will lose host privileges.
               </p>
             </div>

             <div className="flex flex-col gap-3 mt-4">
               <button 
                 onClick={() => {
                   SoundEffects.playClick();
                   changeHost(roomId, sessionId, pendingLeader.id);
                   setPendingLeader(null);
                 }}
                 className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-2xl transition-all shadow-lg"
               >
                 Confirm Transfer
               </button>
               <button 
                 onClick={() => {
                    SoundEffects.playClick();
                    setPendingLeader(null);
                 }}
                 className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10"
               >
                 Cancel
               </button>
             </div>
          </div>
        </div>
      )}
    </main>
  );
}

function BonusCard({ title, reward, condition, icon, color, bgColor }: any) {
  return (
    <div className={`p-4 rounded-2xl border border-white/5 ${bgColor} backdrop-blur-sm flex flex-col gap-2 transition-all hover:scale-[1.02]`}>
      <div className="flex items-center justify-between">
        <span className={`material-symbols-outlined ${color} text-2xl`}>{icon}</span>
        <span className={`font-black text-lg ${color}`}>{reward}</span>
      </div>
      <div>
        <p className="text-white font-bold text-xs uppercase tracking-wider">{title}</p>
        <p className="text-white/40 text-[10px] font-medium leading-tight mt-1">{condition}</p>
      </div>
    </div>
  );
}
