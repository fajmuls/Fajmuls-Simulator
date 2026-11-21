import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { GameEngine, newState } from './core/engine.js';
import { SaveManager, serialize, deserialize } from './core/save.js';
import { WorldScene } from './game/WorldScene.js';
import { UI, toast, h } from './ui.js';
import './screens.js';
import './farmscreens.js';
import './storyscreens.js';
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
  document.addEventListener('visibilitychange', () => audio.suspend(document.hidden));

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
    onDayEnd: (summary) => {
      persist();
      ui.showDaySummary(summary);
    },
  });

  const host = document.getElementById('game');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = () => ({ w: Math.max(2, Math.round(host.clientWidth * dpr)), h: Math.max(2, Math.round(host.clientHeight * dpr)) });
  const first = size();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: first.w,
    height: first.h,
    backgroundColor: '#8fd36f',
    audio: { noAudio: true },
    render: { antialias: true, pixelArt: false, roundPixels: false },
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
    scene: world,
  });
  const onResize = () => { const sz = size(); game.scale.setZoom(1 / dpr); game.scale.resize(sz.w, sz.h); };
  new ResizeObserver(onResize).observe(host);

  if (restored?.slot === 'backup') toast('Simpanan utama rusak, memuat cadangan', 'err');

  if (new URLSearchParams(location.search).has('debug')) {
    window.fajmuls = { engine, ui, game, saves };
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
