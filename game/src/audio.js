// Sound is synthesised: three weapon reports, a reload, a hit, a headshot, the charge's beep,
// the detonation, footsteps whose loudness follows the player's speed, and the round stingers.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = false;
    this.ambience = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      this.ctx = new AudioCtor();
    } catch {
      this.ctx = null;
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.45;
    this.master.connect(this.ctx.destination);
    this.noise = this.buildNoise();
  }

  buildNoise() {
    const ctx = this.ctx;
    const frames = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 0x9e3779b9;
    for (let i = 0; i < frames; i += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    return buffer;
  }

  tone(type, from, to, seconds, volume, delay) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(24, to), start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  burst(seconds, volume, cutoff, delay) {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.noise) return;
    const start = ctx.currentTime + (delay || 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  // Each weapon has its own report: short and dry, a rattle, a deeper crack.
  shot(id) {
    if (id === 'pistol') {
      this.tone('square', 420, 140, 0.09, 0.13);
      this.burst(0.07, 0.14, 3200);
    } else if (id === 'smg') {
      this.tone('sawtooth', 300, 110, 0.07, 0.11);
      this.burst(0.06, 0.13, 2600);
    } else {
      this.tone('sawtooth', 220, 70, 0.16, 0.16);
      this.burst(0.12, 0.16, 1800);
    }
  }

  hit(head) {
    this.tone('square', head ? 720 : 190, head ? 980 : 90, 0.08, head ? 0.16 : 0.1);
    this.burst(0.05, 0.08, 2200);
  }

  reload() {
    this.burst(0.18, 0.1, 900);
    this.tone('triangle', 220, 320, 0.12, 0.06, 0.14);
  }

  step(loud) {
    this.burst(0.07, loud ? 0.075 : 0.035, loud ? 900 : 520);
  }

  hurt() {
    this.tone('sawtooth', 104, 52, 0.24, 0.14);
  }

  beep(pitch) {
    this.tone('sine', pitch, pitch, 0.07, 0.1);
  }

  plant() {
    this.beep(600);
    this.beep(760, 0.12);
  }

  detonate() {
    this.burst(1.1, 0.4, 900);
    this.tone('sawtooth', 120, 30, 1.3, 0.3);
  }

  flash() {
    this.tone('triangle', 900, 300, 0.5, 0.16);
    this.burst(0.4, 0.24, 5200);
  }

  win() {
    this.tone('triangle', 392, 392, 0.15, 0.12);
    this.tone('triangle', 523, 523, 0.15, 0.12, 0.15);
    this.tone('triangle', 659, 659, 0.35, 0.13, 0.3);
  }

  lose() {
    this.tone('sawtooth', 260, 70, 1.2, 0.16);
    this.tone('sine', 130, 50, 1.4, 0.1, 0.1);
  }

  buy() {
    this.tone('triangle', 660, 660, 0.08, 0.1);
    this.tone('triangle', 990, 990, 0.1, 0.08, 0.07);
  }

  startAmbience() {
    const ctx = this.ctx;
    if (!ctx || this.ambience || this.muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 48;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.ambience = osc;
  }

  setMuted(next) {
    this.muted = next;
    if (this.master) this.master.gain.value = next ? 0 : 0.45;
    if (!next) this.startAmbience();
  }
}
