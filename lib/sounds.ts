export const SoundEffects = {
  playClick: () => playTone(600, "sine", 0.05),
  playSubmit: () => playTone(800, "sine", 0.1),
  playSuccess: () => {
    playTone(400, "sine", 0.15);
    setTimeout(() => playTone(800, "sine", 0.2), 150);
  },
  playError: () => {
    playTone(300, "square", 0.15);
    setTimeout(() => playTone(250, "square", 0.2), 150);
  },
  playTick: () => playTone(800, "sine", 0.03, 0.1),
  playReveal: () => {
    playTone(400, "sine", 0.1);
    setTimeout(() => playTone(500, "sine", 0.1), 80);
  },
  playCoin: () => {
    playTone(800, "sine", 0.1, 0.4);
    setTimeout(() => playTone(1200, "sine", 0.1, 0.4), 60);
  },
};

function playTone(freq: number, type: OscillatorType, duration: number, vol = 0.5) {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const actx = new AudioContext();
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, actx.currentTime);
    
    gain.gain.setValueAtTime(vol, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(actx.destination);
    
    osc.start();
    osc.stop(actx.currentTime + duration);
  } catch (e) {
    // Ignore audio context errors (e.g., user hasn't interacted yet)
  }
}
