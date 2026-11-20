// Efek suara dan musik latar dibuat dengan WebAudio (tanpa berkas audio, tetap bisa offline).
const KEY = 'pasarsatwa_audio_v1';

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (v && typeof v === 'object') return v;
  } catch { /* penyimpanan tidak tersedia */ }
  return {};
}

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Progresi santai: C - Am - F - G, tangga pentatonik C untuk melodi.
const CHORDS = [
  { bass: 48, notes: [60, 64, 67, 72] },
  { bass: 45, notes: [57, 60, 64, 69] },
  { bass: 41, notes: [53, 57, 60, 65] },
  { bass: 43, notes: [55, 59, 62, 67] },
];
const PENTA = [72, 74, 76, 79, 81, 84];

export class AudioManager {
  constructor() {
    const p = load();
    this.sfxVol = typeof p.sfx === 'number' ? p.sfx : 0.7;
    this.musicVol = typeof p.music === 'number' ? p.music : 0.5;
    this.muted = !!p.muted;
    this.ctx = null;
    this.musicOn = false;
    this.timer = null;
    this.step = 0;
    this.nextTime = 0;
    this.lastCoin = 0;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ sfx: this.sfxVol, music: this.musicVol, muted: this.muted }));
    } catch { /* abaikan */ }
  }

  // Harus dipanggil dari gestur pengguna (browser menolak suara otomatis).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.musicOn) this.startMusic();
    return true;
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.muted ? 0 : 1;
    this.sfxGain.gain.value = this.sfxVol * 0.5;
    this.musicGain.gain.value = this.musicVol * 0.22;
  }

  setSfx(v) { this.sfxVol = v; this.applyVolumes(); this.save(); }
  setMusic(v) { this.musicVol = v; this.applyVolumes(); this.save(); }
  setMuted(m) { this.muted = m; this.applyVolumes(); this.save(); }

  suspend(flag) {
    if (!this.ctx) return;
    if (flag) this.ctx.suspend();
    else if (!this.muted) this.ctx.resume();
  }

  _tone(dest, freq, start, dur, { type = 'sine', vol = 0.5, slideTo = null, attack = 0.005 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  play(name) {
    if (!this.ctx || this.muted || this.sfxVol <= 0) return;
    const c = this.ctx;
    const t = c.currentTime;
    const d = this.sfxGain;
    const T = (f, s, dur, o) => this._tone(d, f, t + s, dur, o);
    switch (name) {
      case 'click': T(900, 0, 0.05, { type: 'triangle', vol: 0.4 }); break;
      case 'buy': T(660, 0, 0.09, { type: 'triangle' }); T(520, 0.07, 0.12, { type: 'triangle' }); break;
      case 'coin':
        if (t - this.lastCoin < 0.07) return;
        this.lastCoin = t;
        T(988, 0, 0.07, { type: 'square', vol: 0.25 }); T(1319, 0.06, 0.18, { type: 'square', vol: 0.25 });
        break;
      case 'ok': T(523, 0, 0.08, { type: 'triangle' }); T(659, 0.07, 0.08, { type: 'triangle' }); T(784, 0.14, 0.16, { type: 'triangle' }); break;
      case 'err': T(200, 0, 0.2, { type: 'sawtooth', vol: 0.3, slideTo: 110 }); break;
      case 'star': [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, i * 0.09, 0.3, { type: 'triangle', vol: 0.5 })); break;
      case 'open': T(440, 0, 0.12, { type: 'sine' }); T(660, 0.1, 0.12, { type: 'sine' }); T(880, 0.2, 0.35, { type: 'sine' }); break;
      case 'close': T(880, 0, 0.12, { type: 'sine' }); T(660, 0.1, 0.12, { type: 'sine' }); T(440, 0.2, 0.35, { type: 'sine' }); break;
      case 'day': T(392, 0, 0.2, { type: 'triangle' }); T(494, 0.15, 0.2, { type: 'triangle' }); T(587, 0.3, 0.4, { type: 'triangle' }); break;
      case 'bad': T(330, 0, 0.12, { type: 'square', vol: 0.2 }); T(247, 0.12, 0.25, { type: 'square', vol: 0.2 }); break;
      default: break;
    }
  }

  // ---------- Musik ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 120);
  }

  stopMusic() {
    this.musicOn = false;
    clearInterval(this.timer);
  }

  _schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const stepDur = 60 / 92 / 2; // delapan not per bar pada 92 bpm
    while (this.nextTime < c.currentTime + 0.4) {
      const bar = Math.floor(this.step / 8) % CHORDS.length;
      const i = this.step % 8;
      const ch = CHORDS[bar];
      const t = this.nextTime;
      const dest = this.musicGain;
      // arpeggio lembut
      const arp = [0, 1, 2, 3, 2, 1, 2, 3][i];
      this._tone(dest, midi(ch.notes[arp]), t, stepDur * 1.8, { type: 'triangle', vol: 0.5 });
      // bass di not pertama dan kelima
      if (i === 0 || i === 4) this._tone(dest, midi(ch.bass), t, stepDur * 3.2, { type: 'sine', vol: 0.8 });
      // melodi jarang, mirip kalimba
      const phrase = (this.step * 7 + bar * 3) % 11;
      if (i % 2 === 1 && phrase < 4) this._tone(dest, midi(PENTA[(this.step + bar * 2) % PENTA.length]), t, stepDur * 2.5, { type: 'sine', vol: 0.45 });
      this.nextTime += stepDur;
      this.step += 1;
    }
  }
}

export const audio = new AudioManager();
