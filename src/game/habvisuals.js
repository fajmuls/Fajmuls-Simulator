// Pasang gambar tempat berlevel ke WorldScene tanpa mengubah file besarnya:
// memuat 75 tekstur (5 jenis x 15 level), mengganti gambar dasar lahan menurut level,
// memberi nama tiap tempat, dan menggerakkan hewan kandang baru seperti di dalam sangkar.
import { WorldScene } from './WorldScene.js';
import { HABITATS, HAB_LEVEL_CAPS, habZone, getHabitat } from '../core/farm.js';
import { habSVG, habKey } from '../art.habs.js';
import { svgUri } from '../art.svg.js';

const preload0 = WorldScene.prototype.preload;
WorldScene.prototype.preload = function preload() {
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
