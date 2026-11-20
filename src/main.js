import Phaser from 'phaser';
import { registerSW } from 'virtual:pwa-register';
import './style.css';
import { GameEngine, newState } from './core/engine.js';
import { SaveManager, serialize, deserialize } from './core/save.js';
import { ShopScene, W, H } from './game/ShopScene.js';
import { UI, toast, h } from './ui.js';
import './screens.js';

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
    openShop: () => scene.openShop(),
    closeShop: () => scene.closeShop(),
    setSpeed: (s) => scene?.setSpeed(s),
    newGame() {
      engine.replaceState(newState());
      scene?.refreshShelves();
      persist();
      ui.refreshHud();
      toast('Game baru dimulai', 'ok');
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

  const shop = new ShopScene(engine, {
    onReady: (s) => {
      scene = s;
      ui.refreshHud();
    },
    onTick: (tick) => ui.refreshHud(tick),
    onDayEnd: (summary) => {
      persist();
      ui.showDaySummary(summary);
    },
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#000000',
    pixelArt: true,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: shop,
  });

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
