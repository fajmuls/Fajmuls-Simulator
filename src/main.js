import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { GameEngine, newState } from './core/engine.js';
import { SaveManager, serialize, deserialize, validateState } from './core/save.js';
import { auditLedger, credit } from './core/ledger.js';
import { WorldScene } from './game/WorldScene.js';
import './game/habvisuals.js';
import { UI, toast, h, getA11y } from './ui.js';
import './screens.js';
import './farmscreens.js';
import './storyscreens.js';
import './worldscreens.js';
import { audio } from './audio.js';

const loadStart = performance.now();
const TIPS = ['Pakan mahal menaikkan peluang hewan langka.', 'Ketuk lahan yang bertanda seru untuk panen.', 'Layani cepat, tip lebih besar.', 'Pet yang dipasang mengikutimu dan memberi buff.', 'Cubit layar untuk zoom peta.', 'Kolektor membayar penuh untuk hewan langka.'];
function setProgress(v) {
  const f = document.getElementById('lfill');
  if (f) f.style.width = `${Math.round(6 + v * 90)}%`;
  const t = document.getElementById('ltip');
  if (t && !t.dataset.set) { t.dataset.set = '1'; t.textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }
}
function finishLoading() {
  const el = document.getElementById('loader');
  if (!el) return;
  const wait = Math.max(0, 1200 - (performance.now() - loadStart));
  setTimeout(() => {
    el.classList.add('ready');
    const f = document.getElementById('lfill'); if (f) f.style.width = '100%';
    setTimeout(() => { el.classList.add('done'); setTimeout(() => el.remove(), 500); }, 280);
  }, wait);
}

async function boot() {
  const saves = new SaveManager();
  let engine;
  let restored = null;
  try {
    restored = await saves.load();
  } catch (err) {
    console.error('Gagal memuat simpanan', err);
  }
  engine = new GameEngine(restored ? restored.state : newState());

  let scene = null;
  let ui = null;

  const persist = (loud = false) => {
    if (!engine.canSave()) return;
    saves.save(engine.state).catch((err) => {
      console.error(err);
      toast('Gagal menyimpan data di perangkat ini', 'err');
    });
    if (loud) return;
  };

  const ctx = {
    engine,
    scene: () => scene,
    persist,
    travel: (hub, then) => { ui.closeModal(); scene?.travelTo(hub, then); },
    openShop: () => scene.openShop(),
    closeShop: () => scene.closeShop(),
    setSpeed: (s) => scene?.setSpeed(s),
    newGame() {
      engine.replaceState(newState());
      scene?.refreshShelves();
      persist();
      ui.refreshHud();
      toast('Game baru dimulai', 'ok');
      setTimeout(() => ui.startTutorial(), 400);
    },
    importText(text) {
      const state = deserialize(text);
      engine.replaceState(state);
      scene?.refreshShelves();
      persist();
      ui.refreshHud();
    },
    exportFile() {
      if (!engine.canSave()) return toast('Tutup toko dulu untuk mengekspor', 'err');
      const blob = new Blob([serialize(engine.state)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `pasar-satwa-hari-${engine.state.day}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  };

  ui = new UI(ctx);

  // Suara baru boleh menyala setelah ada sentuhan pertama; klik tombol berbunyi pelan.
  const firstTouch = () => { audio.unlock(); };
  window.addEventListener('pointerdown', firstTouch, { once: true });
  document.addEventListener('click', (ev) => { if (ev.target.closest?.('button, .chip, .tile') && !ev.target.closest('.qbtn')) audio.play('click'); });
  document.addEventListener('visibilitychange', () => { audio.suspend(document.hidden); if (document.hidden) persist(); });
  window.addEventListener('pagehide', () => persist());

  const world = new WorldScene(engine, {
    onProgress: (v) => setProgress(v),
    onReady: (s) => {
      scene = s;
      ui.refreshHud();
      finishLoading();
      setTimeout(() => { ui.startTutorial(); }, 2400);
    },
    onSale: () => audio.play('coin'),
    onPickShelf: (cat) => ui.openPicker(cat),
    onTick: (tick) => ui.refreshHud(tick),
    onHub: (hub) => ui.setHub(hub),
    onTapPlot: (info) => ui.tapPlot(info),
    onTapBuilding: (id) => ui.tapBuilding(id),
    onThief: (info) => {
      if (info.phase === 'arrive') toast(info.caught ? 'Pencuri menyelinap ke kolam, tapi satpam berjaga' : 'Ada pencuri menuju lahanmu!', info.caught ? 'ok' : 'err');
      else if (info.phase === 'caught') toast('Satpam mengusir pencuri. Tidak ada yang hilang', 'ok');
      else if (info.phase === 'stolen') toast('Pencuri berhasil mengambil seekor hewan. Sewa satpam untuk menjaga kolam', 'err');
    },
    onDayEnd: (summary) => {
      persist();
      ui.showDaySummary(summary);
    },
  });

  const host = document.getElementById('game');
  const eco = getA11y().eco;
  const dpr = Math.min(window.devicePixelRatio || 1, eco ? 1 : 1.5);
  const size = () => ({ w: Math.max(2, Math.round(host.clientWidth * dpr)), h: Math.max(2, Math.round(host.clientHeight * dpr)) });
  const first = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: first.w,
    height: first.h,
    backgroundColor: '#8fd36f',
    audio: { noAudio: true },
    fps: eco ? { limit: 30 } : undefined,
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    scene: world,
  });
  // Bila perangkat kewalahan (FPS rendah beberapa kali berturut-turut), batasi ke 30 FPS agar stabil dan hemat baterai.
  let slow = 0;
  setInterval(() => {
    if (document.hidden || game.loop.hasFpsLimit) return;
    slow = game.loop.actualFps < 38 ? slow + 1 : 0;
    if (slow >= 4) game.loop.setFPSLimit(30);
  }, 2500);
  const onResize = () => { const sz = size(); game.scale.setZoom(1 / dpr); game.scale.resize(sz.w, sz.h); };
  new ResizeObserver(onResize).observe(host);

  if (restored?.slot === 'backup') toast('Simpanan utama rusak, memuat cadangan', 'err');

  if (new URLSearchParams(location.search).has('debug')) {
    window.fajmuls = { engine, ui, game, saves, credit: (n) => credit(engine.state.ledger, engine.state.day, 'reward', n, 'debug'), check: () => ({ problems: validateState(engine.state), ledger: auditLedger(engine.state.ledger), nan: /null|NaN|Infinity/.test(JSON.stringify(engine.state, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN!' : v))) && JSON.stringify(engine.state, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN!' : v)).includes('NaN!') }) };
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      const el = h('div', { class: 'toast ok' },
        'Versi baru tersedia. ',
        h('button', { class: 'btn small', onClick: () => (engine.canSave() ? updateSW(true) : toast('Tutup toko dulu, lalu muat ulang', 'err')) }, 'Muat ulang'));
      document.getElementById('toast-root').append(el);
    },
    onOfflineReady() {
      toast('Siap dipakai tanpa internet', 'ok');
    },
  });
}

boot();
