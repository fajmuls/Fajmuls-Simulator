// Pasang gambar tempat berlevel ke WorldScene tanpa mengubah file besarnya:
// memuat 75 tekstur (5 jenis x 15 level), mengganti gambar dasar lahan menurut level,
// memberi nama tiap tempat, dan menggerakkan hewan kandang baru seperti di dalam sangkar.
// Juga memuat gambar 7 pet baru, memasang layar gacha (Tahap 3) dan Petualangan (Tahap 4),
// serta penjaga anti-macet: karakter tidak bisa bergerak dan peta hitam setelah kembali ke game.
import { WorldScene } from './WorldScene.js';
import { SPOTS } from './worldmap.js';
import { HABITATS, HAB_LEVEL_CAPS, habZone, getHabitat } from '../core/farm.js';
import { habSVG, habKey } from '../art.habs.js';
import { svgUri } from '../art.svg.js';
import { NEW_PET_KINDS, petArt } from '../pets.js';
import { UI } from '../ui.js';
import '../gachascreens.js';
import '../rpgscreens.js';

const preload0 = WorldScene.prototype.preload;
WorldScene.prototype.preload = function preload() {
  // Pet baru dimuat lebih dulu supaya gambarnya yang dipakai (kunci yang sama tidak dimuat dua kali).
  for (const k of NEW_PET_KINDS) this.load.svg(`pet_${k.id}`, svgUri(petArt(k.id, null)), { scale: 2.5 });
  preload0.call(this);
  for (const h of HABITATS) {
    for (let lv = 1; lv <= HAB_LEVEL_CAPS.length; lv++) this.load.svg(habKey(h.id, lv), svgUri(habSVG(h.id, lv)), { scale: 2 });
  }
};

const refresh0 = WorldScene.prototype.refreshFarm;
WorldScene.prototype.refreshFarm = function refreshFarm() {
  refresh0.call(this);
  const fm = this.engine.state.farm;
  for (const p of this.plots) {
    if (p.vis) continue;
    p.vis = true;
    const H = getHabitat(p.hab);
    if (p.slot !== null) {
      const key = habKey(p.hab, fm.levels[p.slot] || 1);
      const base = p.objs[0];
      if (base && this.textures.exists(key)) { base.setTexture(key); base.setDisplaySize(p.w, p.h); }
    }
    const name = this.add.text(p.x, p.y - p.h / 2 - 9, `${H.one} ${p.k + 1}`, {
      fontFamily: "'Trebuchet MS','Segoe UI',system-ui,sans-serif", fontSize: '10px', color: '#3b2a1c', fontStyle: 'bold', resolution: 2,
      backgroundColor: '#ffe6a8', padding: { x: 4, y: 1 },
    }).setOrigin(0.5).setDepth(p.y + 36).setAlpha(p.slot === null ? 0.6 : 1);
    p.objs.push(name);
  }
};

const update0 = WorldScene.prototype._updatePlots;
WorldScene.prototype._updatePlots = function updatePlots(time, force) {
  update0.call(this, time, force);
  const e = this.engine;
  for (const p of this.plots) {
    if (p.slot === null || !p.occs || !p.occs.length || p.hab === 'kandang' || habZone(p.hab) !== 'kandang') continue;
    const many = p.occs.length;
    p.occs.forEach((occ, idx) => {
      const pr = e.slotProgress(p.slot, p.lotOf[idx]) || e.slotProgress(p.slot, 0);
      const t = time / 1000 + p.k * 1.7 + idx * 2.3;
      occ.setPosition(p.x + Math.sin(t * 0.6) * (many > 1 ? 30 : 20), p.y + 22 - Math.abs(Math.sin(t * 2.2)) * (pr && pr.ready ? 12 : 5));
      occ.setFlipX(Math.cos(t * 0.6) < 0);
    });
  }
};

// ---------- Penjaga anti-macet ----------
// 1) Panel yang tertinggal: setelah menutup panel, semua lapisan .overlay sisa dibuang supaya tidak menghalangi sentuhan ke peta.
const close0 = UI.prototype._close;
UI.prototype._close = function close() {
  close0.call(this);
  const root = document.getElementById('modal-root');
  if (root && !this.askNode) for (const n of [...root.children]) if (n.classList && n.classList.contains('overlay')) n.remove();
};

function installGuards(scene) {
  const game = scene.game;
  const canvas = game.canvas;

  // 2) Kecepatan jalan tidak boleh NaN atau nol.
  const eng = scene.engine;
  if (typeof eng.walkMul === 'function' && !eng._walkPatched) {
    const orig = eng.walkMul.bind(eng);
    eng.walkMul = () => { const v = orig(); return Number.isFinite(v) && v > 0 ? v : 1; };
    eng._walkPatched = true;
  }

  // 3) Peta hitam setelah keluar-masuk game: konteks WebGL hilang atau halaman dipulihkan dari cache.
  canvas?.addEventListener('webglcontextlost', (ev) => ev.preventDefault());
  canvas?.addEventListener('webglcontextrestored', () => setTimeout(() => location.reload(), 150));
  window.addEventListener('pageshow', (ev) => { if (ev.persisted) location.reload(); });
  const recover = () => {
    try {
      const gl = game.renderer && game.renderer.gl;
      if (gl && gl.isContextLost && gl.isContextLost()) { setTimeout(() => { if (gl.isContextLost()) location.reload(); }, 2500); return; }
      const host = document.getElementById('game');
      if (host && host.clientWidth > 2 && host.clientHeight > 2) {
        const dpr = game.scale.zoom ? 1 / game.scale.zoom : 1;
        game.scale.resize(Math.round(host.clientWidth * dpr), Math.round(host.clientHeight * dpr));
      }
      const loop = game.loop;
      if (loop && loop.running === false) loop.wake(true);
      if (scene.scene.isPaused()) scene.scene.resume();
      if (scene.scene.isSleeping()) scene.scene.wake();
      if (!scene.input.enabled) scene.input.enabled = true;
      scene.drag = null;
    } catch (err) { console.warn('pemulihan layar gagal', err); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { setTimeout(recover, 200); setTimeout(recover, 1200); } });
  window.addEventListener('focus', () => setTimeout(recover, 200));

  // 4) Karakter macet: posisi tak valid, berdiri di sel terblokir, atau jalur tak bergerak lebih dari ~2 detik.
  let lastPos = '';
  let still = 0;
  setInterval(() => {
    if (document.hidden) return;
    const p = scene.player;
    if (!p || !scene.nav) return;
    if (!Number.isFinite(p.x) || !Number.isFinite(scene.playerY)) {
      p.x = SPOTS.start.x; scene.playerY = SPOTS.start.y; scene.path = []; scene.pathThen = null; return;
    }
    if (!scene.nav.walkable(p.x, scene.playerY)) {
      const c = scene.nav.nearestFree(p.x, scene.playerY);
      if (c) { const q = scene.nav.center(c[0], c[1]); p.x = q.x; scene.playerY = q.y; scene.path = []; scene.pathThen = null; }
    }
    const key = `${Math.round(p.x)}:${Math.round(scene.playerY)}`;
    if (scene.path && scene.path.length && key === lastPos) {
      still += 1;
      if (still >= 3) {
        scene.path = []; scene.pathThen = null; still = 0;
        if (scene.dest) { scene.dest.destroy(); scene.dest = null; }
      }
    } else still = 0;
    lastPos = key;
    if (!scene.input.enabled) scene.input.enabled = true;
  }, 700);
}

const create0 = WorldScene.prototype.create;
WorldScene.prototype.create = function create() {
  create0.call(this);
  try { installGuards(this); } catch (err) { console.warn('penjaga anti-macet gagal dipasang', err); }
};
