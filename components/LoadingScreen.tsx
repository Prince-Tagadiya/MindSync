"use client";

import { useState, useEffect } from "react";

export default function LoadingScreen() {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Simulate initial load or wait for window.onload
    const handleLoad = () => {
      setFadeOut(true);
      setTimeout(() => setLoading(false), 800);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, []);

  if (!loading) return null;

  return (
    <div className={`fixed inset-0 z-[9999] bg-[#060e20] text-[#dee5ff] font-['Be_Vietnam_Pro'] overflow-hidden transition-all duration-700 ease-in-out ${fadeOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100'}`}>
      <style jsx global>{`
        @keyframes drift {
            0% { transform: translate(0, 0) rotate(0deg); }
            50% { transform: translate(30px, -50px) rotate(180deg); }
            100% { transform: translate(0, 0) rotate(360deg); }
        }
        @keyframes pulse-glow {
            0%, 100% { filter: drop-shadow(0 0 20px rgba(251, 205, 22, 0.4)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 50px rgba(251, 205, 22, 0.8)); transform: scale(1.05); }
        }
        @keyframes progress-fill {
            0% { width: 0%; }
            100% { width: 100%; }
        }
        @keyframes float-particle {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            50% { opacity: 0.8; }
            100% { transform: translateY(-100vh) translateX(20px); opacity: 0; }
        }
        @keyframes text-bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
        .animate-drift { animation: drift 20s infinite ease-in-out; }
        .animate-pulse-glow { animation: pulse-glow 3s infinite ease-in-out; }
        .animate-progress { animation: progress-fill 4s infinite linear; }
        .animate-text-bounce { animation: text-bounce 1.5s infinite ease-in-out; }
        
        .star-particle {
            position: absolute;
            width: 2px;
            height: 2px;
            background: white;
            border-radius: 50%;
            pointer-events: none;
        }

        .text-shadow-neon {
            text-shadow: 0 0 15px rgba(255, 221, 115, 0.6);
        }
      `}</style>

      {/* The Neon Playground Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Depth Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060e20] via-[#0f1930] to-[#000000]"></div>
        {/* Animated Floating Shapes */}
        <div className="absolute top-[10%] left-[15%] w-64 h-64 bg-[#c180ff]/10 rounded-full blur-3xl animate-drift"></div>
        <div className="absolute bottom-[20%] right-[10%] w-96 h-96 bg-[#ffdd73]/5 rounded-full blur-3xl animate-drift" style={{ animationDelay: '-5s' }}></div>
        <div className="absolute top-[40%] right-[25%] w-48 h-48 bg-[#c5ffc9]/10 rounded-[3rem] blur-2xl animate-drift" style={{ animationDelay: '-12s' }}></div>
        {/* Starry Particles */}
        <div className="absolute inset-0">
          <div className="star-particle top-[10%] left-[20%]" style={{ animation: 'float-particle 15s infinite linear' }}></div>
          <div className="star-particle top-[40%] left-[5%]" style={{ animation: 'float-particle 25s infinite linear', animationDelay: '-2s' }}></div>
          <div className="star-particle top-[80%] left-[40%]" style={{ animation: 'float-particle 18s infinite linear', animationDelay: '-7s' }}></div>
          <div className="star-particle top-[30%] left-[70%]" style={{ animation: 'float-particle 20s infinite linear', animationDelay: '-4s' }}></div>
          <div className="star-particle top-[60%] left-[85%]" style={{ animation: 'float-particle 22s infinite linear', animationDelay: '-10s' }}></div>
          <div className="star-particle top-[15%] left-[50%]" style={{ animation: 'float-particle 30s infinite linear', animationDelay: '-1s' }}></div>
        </div>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
        <div className="flex flex-col items-center space-y-12">
          <div className="relative flex items-center justify-center group">
            <div className="absolute inset-0 bg-[#ffdd73]/20 rounded-full blur-3xl scale-150 animate-pulse"></div>
            <div className="animate-pulse-glow cursor-default select-none">
              <span className="text-7xl md:text-9xl font-black font-['Plus_Jakarta_Sans'] text-[#ffdd73] italic tracking-tighter text-shadow-neon">
                MindSync
              </span>
            </div>
          </div>

          <div className="w-full max-w-xs md:max-w-md flex flex-col items-center space-y-6">
            <div className="flex items-center space-x-1 animate-text-bounce">
              <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-widest text-[#dee5ff] uppercase">Syncing</span>
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-[#ffdd73] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 bg-[#ffdd73] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-1.5 h-1.5 bg-[#ffdd73] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>

            <div className="w-full h-3 bg-[#192540] rounded-full overflow-hidden shadow-inner p-0.5">
              <div className="h-full bg-gradient-to-r from-[#5bf083] via-[#c5ffc9] to-[#6bff8f] rounded-full animate-progress shadow-[0_0_15px_rgba(91,240,131,0.5)]">
              </div>
            </div>

            <p className="text-sm text-[#a3aac4] font-medium text-center opacity-80">
              Optimizing neural pathways for the arena...
            </p>
          </div>
        </div>

        <div className="absolute bottom-12 left-0 right-0 flex justify-center space-x-4">
          <div className="flex items-center bg-[#141f38]/40 backdrop-blur-md px-4 py-2 rounded-full space-x-3 outline-[#40485d]/10 outline outline-1">
            <span className="material-symbols-outlined text-[#c180ff] text-lg">groups</span>
            <span className="text-xs font-bold text-[#dee5ff] uppercase tracking-tighter">4.2k Players Online</span>
          </div>
          <div className="flex items-center bg-[#141f38]/40 backdrop-blur-md px-4 py-2 rounded-full space-x-3 outline-[#40485d]/10 outline outline-1">
            <span className="material-symbols-outlined text-[#c5ffc9] text-lg">bolt</span>
            <span className="text-xs font-bold text-[#dee5ff] uppercase tracking-tighter">Low Latency Active</span>
          </div>
        </div>
      </main>

      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-6 pointer-events-none opacity-40">
        <div className="text-xl font-black text-[#ffdd73] italic tracking-tighter">M/S</div>
        <div className="flex space-x-6">
          <span className="material-symbols-outlined text-[#a3aac4]">settings</span>
          <span className="material-symbols-outlined text-[#a3aac4]">help</span>
        </div>
      </nav>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-1 bg-gradient-to-r from-transparent via-[#ffdd73]/30 to-transparent blur-xl"></div>
    </div>
  );
}
