// ─── DICE ROLL SOUND ─────────────────────────────────────────────────────────
// Synthesised using Web Audio API — no audio files needed.
// Works on desktop. iOS requires unlocking the AudioContext on first user gesture.

let audioCtx = null;
let unlocked = false;

// Call this on the first user interaction (e.g. any button tap)
export function unlockAudio() {
  if (unlocked) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // iOS requires a silent buffer to be played to unlock
    const buf = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
    unlocked = true;
  } catch (e) { /* silently fail */ }
}

function getCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); unlocked = true; }
    catch (e) { return null; }
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// A single dice clack — short noise burst shaped like plastic hitting wood
function clack(ctx, t, pitch = 1200, vol = 0.28) {
  const bufSize = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // Bandpass for plastic/wood click tone
  const bpf = ctx.createBiquadFilter();
  bpf.type = "bandpass";
  bpf.frequency.value = pitch;
  bpf.Q.value = 3.5;

  // High shelf for presence
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 3000;
  shelf.gain.value = 4;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

  src.connect(bpf); bpf.connect(shelf); shelf.connect(gain); gain.connect(ctx.destination);
  src.start(t); src.stop(t + 0.06);
}

// A low resonant thud — table contact
function thud(ctx, t, vol = 0.15) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.12);
}

// A short trailing rattle — dice spinning
function rattle(ctx, t, count = 3) {
  for (let i = 0; i < count; i++) {
    const jitter = i * (0.025 + Math.random() * 0.015);
    clack(ctx, t + jitter, 900 + Math.random() * 600, 0.12 - i * 0.03);
  }
}

export function playDiceSound(numDice = 1) {
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;
  const diceCount = Math.min(numDice, 20); // cap for performance

  // Scale sound to how many dice are being rolled
  if (diceCount <= 2) {
    // Single or pair — sharp clean clacks
    clack(ctx, now, 1400, 0.3);
    thud(ctx, now + 0.008, 0.18);
    if (diceCount === 2) clack(ctx, now + 0.04, 1100, 0.22);
  } else if (diceCount <= 6) {
    // Small handful — rapid burst
    for (let i = 0; i < diceCount; i++)
      clack(ctx, now + i * 0.025, 1000 + Math.random() * 600, 0.25 - i * 0.02);
    thud(ctx, now + 0.02, 0.2);
    rattle(ctx, now + diceCount * 0.025, 2);
  } else {
    // Large roll — cascade
    thud(ctx, now, 0.22);
    for (let i = 0; i < 6; i++)
      clack(ctx, now + i * 0.018, 800 + Math.random() * 800, 0.22 - i * 0.025);
    rattle(ctx, now + 0.12, 4);
    thud(ctx, now + 0.18, 0.12);
  }
}

// For the free dice roller — simpler single roll sound
export function playFreeDiceSound(n = 1) {
  playDiceSound(n);
}