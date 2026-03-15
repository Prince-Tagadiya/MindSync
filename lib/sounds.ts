export const SoundEffects = {
  playClick: () => playTone(600, "sine", 0.05),
  playSubmit: () => playTone(800, "sine", 0.1),
  playSuccess: () => {
    playTone(400, "sine", 0.1);
    setTimeout(() => playTone(600, "sine", 0.15), 100);
    setTimeout(() => playTone(1000, "sine", 0.2), 200);
  },
  playError: () => {
    playTone(300, "square", 0.15);
    setTimeout(() => playTone(250, "square", 0.2), 150);
  },
  playTick: () => playTone(800, "sine", 0.03, 0.1),
  playShout: () => {
    // Clustered 'HA!' or group shout with noise impact
    for (let i = 0; i < 6; i++) {
      const pitch = 120 + Math.random() * 300;
      const delay = Math.random() * 0.04;
      const dur = 0.15 + Math.random() * 0.1;
      // Vocal cord simulation (saw/sq combination)
      setTimeout(() => playTone(pitch, 'sawtooth', dur, 0.1), delay * 1000);
      setTimeout(() => playTone(pitch * 1.6, 'square', dur, 0.05), delay * 1000);
    }
    // Percussive noise 'punch' to simulate the initial breath
    playTone(100, 'square', 0.1, 0.2); 
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
