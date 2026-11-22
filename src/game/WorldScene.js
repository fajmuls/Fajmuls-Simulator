import Phaser from 'phaser';
import { CATEGORIES, ITEMS, STAFF, getItem } from '../core/catalog.js';
import { RARITIES, HABITATS, HAB_LEVEL_CAPS, SLOT_COSTS, MAX_SLOTS, getHabitat } from '../core/farm.js';
import { animalSVG, staffSVG, petSVG, svgUri } from '../art.svg.js';
import * as A from '../art.world.js';
import { DAY_LENGTH_SEC } from '../core/engine.js';
import { hashSeed, mulberry32 } from '../core/rng.js';
import { regularDef } from '../core/regulars.js';
import { PET_KINDS } from '../core/farm.js';
import { storyNow } from '../core/story.js';

export const WORLD = { w: 1400, h: 1000 };
const BASE_VIEW_W = 440; // lebar pandang (satuan dunia) pada zoom 1
const FONT = "'Trebuchet MS','Segoe UI',system-ui,sans-serif";

// pusat kamera dan titik berdiri pemain untuk tiap hub
export const HUBS = {
  kolam: { name: 'Kolam & Kebun', zoom: 0.8, x: 320, y: 250, spot: { x: 330, y: 445 } },
  kandang: { name: 'Kandang', zoom: 0.8, x: 1090, y: 250, spot: { x: 1090, y: 445 } },
  pasar: { name: 'Pasar', x: 250, y: 690, spot: { x: 250, y: 770 } },
  pet: { name: 'Rumah Pet', x: 1150, y: 690, spot: { x: 1150, y: 770 } },
  toko: { name: 'Toko', zoom: 0.85, x: 700, y: 760, spot: { x: 700, y: 850 } },
  plaza: { name: 'Alun-alun', x: 700, y: 330, spot: { x: 700, y: 450 } },
};

// Layar: Kebun (kolam + kandang, digeser kiri-kanan) dan Toko (terkunci saat buka).
export const VIEWS = {
  kebun: { x: 0, y: 0, w: 1400, h: 530, fit: 'h' },
  toko: { x: 455, y: 520, w: 490, h: 450, fit: 'w' },
};

const PLOTS = {
  kolam: [[130, 150], [320, 150], [130, 300], [320, 300]],
  kebun: [[480, 160], [480, 275]],
  kandang: [[930, 175], [1070, 175], [1210, 175], [1000, 335], [1140, 335]],
};
const PLOT_SIZE = { kolam: [170, 112], kebun: [120, 84], kandang: [112, 126] };

const RACK_Y = 795;
const rackX = (i) => 532 + i * 84;
const QUEUE_Y = 928;
const ROAD_Y = 948;
const ENTRY_X = 420;
const slotX = (k) => 812 - k * 56;
const WALK_SPEED = 70;
const PLAYER_SPEED = 230;

const rupiah = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const NAMES = ['Budi', 'Siti', 'Andi', 'Wati', 'Agus', 'Dewi', 'Hendra', 'Lina', 'Putra', 'Mega', 'Rahmat', 'Nina', 'Fajar', 'Yuni', 'Eko', 'Tari', 'Bagas', 'Sinta', 'Doni', 'Maya', 'Iwan', 'Ratna', 'Joni', 'Citra'];
const TITLE = { biasa: '', pelit: 'Si ', vip: 'Tuan ', kolektor: 'Kolektor ' };
export const customerName = (id, type) => `${TITLE[type] || ''}${NAMES[hashSeed(`n${id}`) % NAMES.length]}`;

const T = (scene, x, y, str, size = 12, color = '#3b2a1c', extra = {}) => scene.add.text(x, y, str, {
  fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', resolution: 3, ...extra,
}).setOrigin(0.5);

export class WorldScene extends Phaser.Scene {
  constructor(engine, hooks = {}) {
    super('world');
    this.engine = engine;
    this.hooks = hooks;
    this.speed = 1;
    this.dayActive = false;
    this.closing = false;
    this.clock = 0;
    this.pending = [];
    this.customers = [];
    this.queue = [];
    this.popups = [];
    this.fxList = [];
    this.paused = false;
    this.carry = null;
    this.playerTarget = null;
    this.uz = 1;
    this.camGoal = null;
    this.follow = false;
    this.rackSprites = [];
    this.plots = [];
    this.petSprites = [];
    this.staffSprites = {};
    this._lastTick = '';
    this._lastHub = '';
    this._acc = 0;
  }

  // ---------- Memuat gambar ----------
  _svg(key, svg, scale = 2) {
    this.load.svg(key, svgUri(svg), { scale });
  }

  preload() {
    this.load.on('progress', (v) => this.hooks.onProgress?.(v));
    this._svg('player', A.playerSVG(), 3);
    this._svg('npc', A.npcSVG(), 3);
    this._svg('exclaim', A.exclaimSVG(), 3);
    this._svg('toko', A.tokoSVG(), 2);
    this._svg('pasar', A.pasarSVG(), 2);
    this._svg('pethouse', A.petHouseSVG(), 2);
    this._svg('kantor', A.kantorSVG(), 2);
    this._svg('signpost', A.signpostSVG(), 2.5);
    this._svg('pond', A.pondSVG(), 2);
    this._svg('bed', A.bedSVG(), 2);
    this._svg('cage', A.cageSVG(), 2);
    this._svg('rack', A.rackSVG(), 2.5);
    this._svg('counter', A.counterSVG(), 2.5);
    this._svg('tree0', A.treeSVG(0), 2);
    this._svg('tree1', A.treeSVG(1), 2);
    this._svg('bush', A.bushSVG(), 2.5);
    ['#ff7a8a', '#ffd84d', '#ffffff', '#b794f6'].forEach((c, i) => this._svg(`flower${i}`, A.flowerSVG(c), 3));
    this._svg('tuft', A.tuftSVG(), 3);
    this._svg('rock', A.rockSVG(), 3);
    this._svg('lamp', A.lampSVG(), 3);
    this._svg('fountain', A.fountainSVG(), 2.5);
    this._svg('fence', A.fenceSVG(), 3);
    this._svg('sparkle', A.sparkleSVG(), 3);
    for (const it of ITEMS) this._svg(`icon_${it.id}`, animalSVG(it), 2.5);
    for (const st of STAFF) this._svg(`staff_${st.id}`, staffSVG(st.id), 2);
    for (const k of PET_KINDS) this._svg(`pet_${k.id}`, petSVG(k.id, null), 2.5);
    for (const type of A.CUSTOMER_TYPES_LOOK) {
      for (let k = 0; k < A.LOOKS_PER_TYPE; k++) this._svg(A.lookKey(type, k), A.customerSVG(A.poolLook(type, k)), 3);
    }
    for (const [id, look] of Object.entries(A.REGULAR_LOOKS)) this._svg(`reg_${id}`, A.customerSVG(look), 3);
  }

  create() {
    this.cameras.main.setBackgroundColor('#8fd36f');
    this._buildGround();
    this._buildHubs();

    this.player = this.add.image(HUBS.toko.spot.x, HUBS.toko.spot.y, 'player').setOrigin(0.5, 1).setScale(0.5 * 1.2);
    this.player.setDisplaySize(44, 68);
    this.playerY = HUBS.toko.spot.y;
    this.playerBob = 0;

    this.tint = this.add.rectangle(0, 0, 4000, 4000, 0xff8a3d, 0).setOrigin(0).setScrollFactor(0).setDepth(20000);
    this.rainG = this.add.graphics().setScrollFactor(0).setDepth(20001);
    this.rain = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));

    this._setupInput();
    this.scale.on('resize', () => { const c = this.cameras.main; const cx = c.scrollX + c.width / 2 / c.zoom; const cy = c.scrollY + c.height / 2 / c.zoom; this._fitCamera(); c.centerOn(cx, cy); });
    this.setView('kebun', HUBS.kolam.x);
    this.refreshShelves();
    this.hooks.onReady?.(this);
  }

  // ---------- Kamera dan input ----------
  _fitCamera() {
    const cam = this.cameras.main;
    const v = VIEWS[this.view || 'kebun'];
    const z = v.fit === 'h' ? this.scale.height / v.h : this.scale.width / v.w;
    this.baseZoom = z;
    this.uz = 1;
    cam.setBounds(v.x, v.y, v.w, v.h);
    cam.setZoom(z);
    this.tint.setSize(this.scale.width, this.scale.height);
  }

  setView(id, focusX = null) {
    const first = !this.view;
    if (!VIEWS[id]) return;
    this.view = id;
    this.camGoal = null;
    this._fitCamera();
    const cam = this.cameras.main;
    const v = VIEWS[id];
    if (id === 'kebun') cam.centerOn(focusX ?? this._kebunX ?? HUBS.kolam.x, v.y + v.h / 2);
    else cam.centerOn(v.x + v.w / 2, v.y + v.h / 2);
    this.player?.setVisible(id === 'toko');
    for (const s of this.petSprites || []) { s.img.setVisible(id === 'toko'); s.ring.setVisible(id === 'toko'); }
    this.carryIcon?.setVisible(id === 'toko');
    this.carryRing?.setVisible(id === 'toko');
    this.hooks.onHub?.(id);
    return first;
  }

  _setupInput() {
    this.drag = null;
    const reset = () => { this.drag = null; };
    this.input.on('pointerdown', (p) => {
      this.drag = { x: p.x, y: p.y, lx: p.x, ly: p.y, moved: false, id: p.id };
    });
    this.input.on('pointermove', (p) => {
      const d = this.drag;
      if (!d || !p.isDown || p.id !== d.id) return;
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) < 9) return;
      d.moved = true;
      this.camGoal = null;
      if (this.view !== 'kebun') return;
      const cam = this.cameras.main;
      cam.scrollX -= (p.x - d.lx) / cam.zoom;
      d.lx = p.x;
      d.ly = p.y;
      this._kebunX = cam.scrollX + cam.width / 2 / cam.zoom;
    });
    this.input.on('pointerup', (p) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this._onTap(wp.x, wp.y);
    });
    this.input.on('pointerupoutside', reset);
    this.input.on('gameout', reset);
    this.game.events.on('blur', reset);
    this.input.on('pointerdown', () => { this.camGoal = null; });
  }

  zoomBy() {}
  overview() {}

  focusHub(id, instant = false) {
    const h = HUBS[id];
    if (!h) return;
    const cam = this.cameras.main;
    if (instant) { cam.centerOn(h.x, VIEWS.kebun.y + VIEWS.kebun.h / 2); this._kebunX = h.x; } else this.camGoal = { x: h.x, y: VIEWS.kebun.y + VIEWS.kebun.h / 2 };
    this._kebunX = h.x;
  }

  // Pindah layar. 'kolam'/'kandang' = layar Kebun digeser ke bagian itu; 'toko' = layar Toko.
  travelTo(id, then) {
    if (id === 'toko') this.setView('toko');
    else if (id === 'kolam' || id === 'kandang') {
      if (this.view !== 'kebun') this.setView('kebun', HUBS[id].x);
      else this.focusHub(id);
    }
    then?.();
  }

  currentHub() { return this.view || 'kebun'; }

  // ---------- Dunia statis ----------
  _buildGround() {
    const g = this.add.graphics().setDepth(-100);
    const rng = mulberry32(777);
    g.fillStyle(0x8fd36f, 1).fillRect(0, 0, WORLD.w, WORLD.h);
    g.fillStyle(0x9ddc7c, 1);
    for (let i = 0; i < 46; i++) g.fillEllipse(rng() * WORLD.w, rng() * WORLD.h, 120 + rng() * 160, 60 + rng() * 80);
    // jalan: garis tebal bergaris tepi gelap
    const roads = [
      [[150, 450], [1250, 450]], [[700, 200], [700, 960]], [[330, 450], [330, 380]], [[1090, 450], [1090, 380]],
      [[250, 450], [250, 790]], [[1150, 450], [1150, 790]], [[420, ROAD_Y], [980, ROAD_Y]],
    ];
    this.roads = roads;
    const draw = (width, color) => {
      g.lineStyle(width, color, 1);
      for (const r of roads) g.lineBetween(r[0][0], r[0][1], r[1][0], r[1][1]);
    };
    draw(80, 0x3b2a1c);
    g.fillStyle(0x3b2a1c, 1).fillCircle(700, 360, 158);
    draw(72, 0xf1d9a0);
    g.fillStyle(0xf1d9a0, 1).fillCircle(700, 360, 150);
    g.lineStyle(4, 0xe0c27c, 1).strokeCircle(700, 360, 128);
    // halaman toko
    g.fillStyle(0x3b2a1c, 1).fillRoundedRect(470, 696, 460, 268, 18);
    g.fillStyle(0xf1d9a0, 1).fillRoundedRect(476, 702, 448, 256, 14);
    g.lineStyle(3, 0xe0c27c, 1);
    for (let x = 500; x < 920; x += 56) g.lineBetween(x, 706, x, 954);
    // petak hub
    const hubBox = (x, y, w, h, c1, c2) => {
      g.fillStyle(0x3b2a1c, 1).fillRoundedRect(x, y, w, h, 26);
      g.fillStyle(c1, 1).fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 22);
      g.lineStyle(3, c2, 0.8).strokeRoundedRect(x + 16, y + 16, w - 32, h - 32, 16);
    };
    hubBox(40, 50, 520, 380, 0xa6e283, 0x7bc45e);
    hubBox(840, 50, 520, 380, 0xa6e283, 0x7bc45e);
    hubBox(40, 540, 420, 330, 0xb6e68f, 0x8bd070);
    hubBox(940, 540, 420, 330, 0xb6e68f, 0x8bd070);
    this.groundG = g;

    const blocked = [
      [40, 50, 520, 380], [840, 50, 520, 380], [40, 540, 420, 330], [940, 540, 420, 330], [470, 520, 460, 440], [540, 190, 320, 340],
      [100, 430, 1200, 40], [660, 190, 80, 780], [210, 430, 80, 380], [1110, 430, 80, 380], [330, 400, 4, 60], [1090, 400, 4, 60],
    ];
    const free = (x, y, pad = 28) => !blocked.some(([bx, by, bw, bh]) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad);
    const spots = (n, tries = 600) => {
      const out = [];
      for (let i = 0; i < tries && out.length < n; i++) {
        const x = 20 + rng() * (WORLD.w - 40);
        const y = 20 + rng() * (WORLD.h - 40);
        if (free(x, y)) out.push([x, y]);
      }
      return out;
    };
    for (const [x, y] of spots(110)) this.add.image(x, y, 'tuft').setScale(0.5).setDepth(-50);
    spots(46).forEach(([x, y], i) => this.add.image(x, y, `flower${i % 4}`).setScale(0.55).setDepth(y));
    spots(26).forEach(([x, y]) => this.add.image(x, y, 'bush').setScale(0.6).setOrigin(0.5, 1).setDepth(y));
    spots(18).forEach(([x, y], i) => this.add.image(x, y, `tree${i % 2}`).setScale(0.5).setOrigin(0.5, 0.96).setDepth(y));
    spots(10).forEach(([x, y]) => this.add.image(x, y, 'rock').setScale(0.5).setDepth(y));
    // pohon pembatas tepi
    for (let x = 30; x < WORLD.w; x += 74) { this.add.image(x, 14, `tree${(x / 74) % 2 | 0}`).setScale(0.5).setOrigin(0.5, 0.9).setDepth(2); }
    for (let x = 30; x < WORLD.w; x += 74) { this.add.image(x, WORLD.h + 2, `tree${(x / 74 + 1) % 2 | 0}`).setScale(0.5).setOrigin(0.5, 0.96).setDepth(WORLD.h + 2); }
    for (let y = 80; y < WORLD.h; y += 90) {
      this.add.image(10, y, 'tree0').setScale(0.5).setOrigin(0.5, 0.96).setDepth(y);
      this.add.image(WORLD.w - 10, y, 'tree1').setScale(0.5).setOrigin(0.5, 0.96).setDepth(y);
    }
  }

  _label(x, y, text, w = 150) {
    const g = this.add.graphics().setDepth(900);
    g.fillStyle(0x3b2a1c, 1).fillRoundedRect(x - w / 2 - 3, y - 15, w + 6, 30, 10);
    g.fillStyle(0xffe6a8, 1).fillRoundedRect(x - w / 2, y - 12, w, 24, 8);
    const t = T(this, x, y, text, 13).setDepth(901);
    return [g, t];
  }

  _buildHubs() {
    const d = (img, depth) => img.setDepth(depth ?? img.y);
    // kantor dan alun-alun
    this.kantor = d(this.add.image(700, 232, 'kantor').setOrigin(0.5, 1).setDisplaySize(220, 160));
    this._label(700, 244, 'BALAI PASAR', 120).forEach((o) => o.setDepth(900));
    this.add.image(800, 345, 'fountain').setOrigin(0.5, 1).setDisplaySize(120, 100).setDepth(345);
    this.add.image(610, 420, 'signpost').setOrigin(0.5, 1).setDisplaySize(72, 80).setDepth(420);
    for (const x of [590, 810]) this.add.image(x, 260, 'lamp').setOrigin(0.5, 1).setDisplaySize(22, 56).setDepth(260);
    // pak pasar (NPC cerita)
    this.npc = this.add.image(630, 355, 'npc').setOrigin(0.5, 1).setDisplaySize(44, 68).setDepth(355);
    this.npcMark = this.add.image(630, 270, 'exclaim').setDisplaySize(24, 30).setDepth(9000).setVisible(false);
    this.tweens.add({ targets: this.npcMark, y: 262, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // pasar
    this.pasarB = d(this.add.image(250, 700, 'pasar').setOrigin(0.5, 1).setDisplaySize(220, 160));
    this._label(250, 712, 'PASAR', 90);
    // rumah pet
    this.petB = d(this.add.image(1150, 700, 'pethouse').setOrigin(0.5, 1).setDisplaySize(200, 170));
    this._label(1150, 712, 'RUMAH PET', 120);
    // toko
    this.add.image(700, 700, 'toko').setOrigin(0.5, 1).setDisplaySize(380, 150).setDepth(700);
    this.add.image(884, 878, 'counter').setOrigin(0.5, 1).setScale(0.45).setDepth(878);
    // papan nama hub
    this._label(300, 84, 'KOLAM & KEBUN', 160);
    this._label(1100, 84, 'KANDANG SATWA', 160);
    // pagar kecil di sekitar kolam/kandang
    for (let x = 70; x < 540; x += 46) this.add.image(x, 408, 'fence').setOrigin(0.5, 1).setScale(0.5).setDepth(408);
    for (let x = 870; x < 1340; x += 46) this.add.image(x, 408, 'fence').setOrigin(0.5, 1).setScale(0.5).setDepth(408);
  }

  // ---------- Lahan (kolam, petak, kandang) ----------
  _clearPlots() {
    for (const p of this.plots) for (const o of p.objs) o.destroy();
    this.plots = [];
  }

  refreshFarm() {
    const e = this.engine;
    const fm = e.state.farm;
    // pertahankan sprite bila struktur tidak berubah
    const sig = fm.habs.join(',') + '|' + fm.slots.map((lots, i) => `${fm.levels[i]}:${(lots || []).map((s) => `${s.itemId}x${s.qty || 1}`).join('+')}`).join(',') + '|' + e.state.ledger.balance / 1e12;
    if (sig === this._plotSig && this.plots.length) return;
    this._plotSig = sig;
    this._clearPlots();
    for (const hab of HABITATS) {
      const owned = fm.habs.map((h, i) => (h === hab.id ? i : -1)).filter((i) => i >= 0);
      PLOTS[hab.id].forEach(([x, y], k) => {
        const [w, h] = PLOT_SIZE[hab.id];
        const plot = { hab: hab.id, x, y, w, h, k, slot: owned[k] ?? null, objs: [] };
        if (plot.slot === null) {
          const next = k === owned.length;
          const cost = SLOT_COSTS[fm.slots.length];
          const g = this.add.graphics().setDepth(y - 5);
          g.lineStyle(3, 0x3b2a1c, next ? 0.8 : 0.3);
          g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 14);
          g.fillStyle(0xffffff, next ? 0.22 : 0.08).fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
          const lab = T(this, x, y - 8, next ? 'Lahan baru' : 'Terkunci', 12, next ? '#3b2a1c' : '#7a6249').setDepth(y);
          const price = T(this, x, y + 10, next ? (fm.slots.length >= MAX_SLOTS ? 'penuh' : (cost ? rupiah(cost) : 'gratis')) : '', 11, '#8a4b08').setDepth(y);
          plot.objs.push(g, lab, price);
          plot.buy = next && fm.slots.length < MAX_SLOTS;
        } else {
          const tex = hab.id === 'kolam' ? 'pond' : hab.id === 'kebun' ? 'bed' : 'cage';
          const base = this.add.image(x, y, tex).setDisplaySize(w, h).setDepth(y - 6);
          plot.objs.push(base);
          const lots = fm.slots[plot.slot] || [];
          const used = lots.reduce((n, l) => n + (l.qty || 1), 0);
          const cap = HAB_LEVEL_CAPS[(fm.levels[plot.slot] || 1) - 1];
          plot.lotOf = [];
          const flat = [];
          lots.forEach((l, li) => { for (let q = 0; q < (l.qty || 1) && flat.length < 8; q++) flat.push({ li, itemId: l.itemId }); });
          plot.occs = flat.map((f) => this.add.image(x, y, `icon_${f.itemId}`).setDepth(y + 2));
          plot.lotOf = flat.map((f) => f.li);
          plot.bar = this.add.graphics().setDepth(y + 30);
          plot.mark = this.add.image(x + w / 2 - 14, y - h / 2 + 6, 'exclaim').setDisplaySize(22, 28).setDepth(y + 40).setVisible(false);
          plot.objs.push(...plot.occs, plot.bar, plot.mark);
          plot.objs.push(T(this, x - w / 2 + 18, y - h / 2 + 10, `Lv${fm.levels[plot.slot] || 1} · ${used}/${cap}`, 11, '#ffffff', { stroke: '#3b2a1c', strokeThickness: 3 }).setDepth(y + 35));
          if (!lots.length) {
            const t = T(this, x, y + h / 2 - 8, 'kosong', 11, '#3b2a1c').setDepth(y + 4).setAlpha(0.55);
            plot.objs.push(t);
          }
        }
        this.plots.push(plot);
      });
    }
    this._updatePlots(0, true);
  }

  _updatePlots(time, force = false) {
    const e = this.engine;
    for (const p of this.plots) {
      if (p.slot === null || !p.occs || !p.occs.length) continue;
      const prs = (e.state.farm.slots[p.slot] || []).map((_, li) => e.slotProgress(p.slot, li));
      if (!prs.length || prs.some((x) => !x)) continue;
      const anyReady = prs.some((x) => x.ready);
      const many = p.occs.length;
      p.occs.forEach((occ, idx) => {
        const pr = prs[p.lotOf[idx]] || prs[0];
        const grow = 0.34 + 0.66 * pr.pct;
        const size = (many > 3 ? 28 : many > 1 ? 34 : 40) * grow;
        occ.setDisplaySize(size, size);
        const t = time / 1000 + p.k * 1.7 + idx * 2.3;
        if (p.hab === 'kolam') {
          occ.setPosition(p.x + Math.sin(t * 0.8) * (p.w * 0.3), p.y + 2 + Math.sin(t * 1.3) * (many > 1 ? 12 : 7));
          occ.setFlipX(Math.cos(t * 0.8) < 0);
          occ.setAngle(Math.sin(t * 3) * 5);
        } else if (p.hab === 'kandang') {
          occ.setPosition(p.x + Math.sin(t * 0.6) * (many > 1 ? 30 : 20), p.y + 22 - Math.abs(Math.sin(t * 2.2)) * (pr.ready ? 12 : 5));
          occ.setFlipX(Math.cos(t * 0.6) < 0);
        } else {
          occ.setPosition(p.x + Math.sin(t * 0.7) * (many > 1 ? 30 : 22), p.y + 4 + Math.sin(t * 2 + idx) * (many > 1 ? 10 : 2));
          occ.setFlipX(Math.cos(t * 0.7) < 0);
        }
        if (pr.ready) occ.setScale(occ.scaleX * (1 + Math.sin(time / 180 + idx) * 0.06), occ.scaleY * (1 + Math.sin(time / 180 + idx) * 0.06));
      });
      p.mark.setVisible(anyReady);
      if (anyReady) p.mark.y = p.y - p.h / 2 + 6 + Math.sin(time / 160) * 3;
      // bilah kemajuan: penghuni yang paling dekat siap (diperbarui seperempat detik sekali)
      if (force || time - (p.barT || 0) > 250) {
        p.barT = time;
        const pr = anyReady ? prs.find((x) => x.ready) : prs.slice().sort((x, y) => x.remainMs - y.remainMs)[0];
        const bw = Math.min(64, p.w * 0.55);
        const bx = p.x - bw / 2;
        const by = p.y + p.h / 2 - 2;
        p.bar.clear();
        p.bar.fillStyle(0x3b2a1c, 1).fillRoundedRect(bx - 2, by - 2, bw + 4, 9, 4);
        p.bar.fillStyle(anyReady ? 0x58b368 : 0xffb938, 1).fillRoundedRect(bx, by, Math.max(2, bw * pr.pct), 5, 2.5);
        if (!anyReady) {
          const s = Math.ceil(pr.remainMs / 1000);
          if (!p.timer) { p.timer = T(this, p.x, by + 14, '', 10, '#3b2a1c').setDepth(p.y + 31); p.objs.push(p.timer); }
          p.timer.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
        } else if (p.timer) p.timer.setText('SIAP!');
      }
    }
  }

  // ---------- Rak toko ----------
  refreshShelves() {
    for (const o of this.rackSprites) o.destroy();
    this.rackSprites = [];
    const e = this.engine;
    CATEGORIES.forEach((cat, i) => {
      const cx = rackX(i);
      const open = e.categoryOpen(cat.id);
      const rack = this.add.image(cx, RACK_Y, 'rack').setOrigin(0.5, 1).setDisplaySize(78, 88).setDepth(RACK_Y);
      const lab = T(this, cx, RACK_Y - 94, cat.short, 11, '#3b2a1c', { backgroundColor: '#ffe6a8', padding: { x: 4, y: 1 } }).setDepth(RACK_Y + 1);
      this.rackSprites.push(rack, lab);
      if (!open) {
        const cover = this.add.rectangle(cx, RACK_Y - 46, 70, 76, 0x3b2a1c, 0.72).setDepth(RACK_Y + 2);
        const t = T(this, cx, RACK_Y - 46, `Toko\nLv ${cat.needShop}`, 11, '#ffe6a8', { align: 'center' }).setDepth(RACK_Y + 3);
        this.rackSprites.push(cover, t);
        return;
      }
      const counts = {};
      for (const a of e.state.farm.animals) if (getItem(a.itemId).cat === cat.id) counts[a.itemId] = (counts[a.itemId] || 0) + 1;
      const rows = Object.entries(counts).sort((a, b) => getItem(b[0]).tier - getItem(a[0]).tier).slice(0, 4);
      const slots = [[-17, -70], [17, -70], [-17, -38], [17, -38]];
      rows.forEach(([id, qty], k) => {
        const img = this.add.image(cx + slots[k][0], RACK_Y + slots[k][1] + 4, `icon_${id}`).setDisplaySize(26, 26).setDepth(RACK_Y + 2);
        const qt = T(this, cx + slots[k][0] + 9, RACK_Y + slots[k][1] + 16, String(qty), 9, '#ffffff', { stroke: '#3b2a1c', strokeThickness: 3 }).setDepth(RACK_Y + 3);
        this.rackSprites.push(img, qt);
      });
      if (!rows.length) this.rackSprites.push(T(this, cx, RACK_Y - 46, 'KOSONG', 11, '#b3261e').setDepth(RACK_Y + 3));
    });
    this.refreshStaff();
    this.refreshFarm();
    this.refreshPets();
    this.refreshNpc();
  }

  refreshDecor() { this.refreshShelves(); }

  refreshNpc() {
    const n = storyNow(this.engine);
    const show = !n.done && (!n.introSeen || n.ready);
    this.npcMark?.setVisible(show);
  }

  refreshStaff() {
    const spots = { kasir: [886, 848], pramuniaga: [560, 850], penjaga: [640, 850], satpam: [500, 900], badut: [560, 930], perawat: [330, 462] };
    for (const st of STAFF) {
      const on = !!this.engine.state.staff[st.id];
      let sp = this.staffSprites[st.id];
      if (on && !sp && this.textures.exists(`staff_${st.id}`)) {
        const [x, y] = spots[st.id];
        sp = this.add.image(x, y, `staff_${st.id}`).setOrigin(0.5, 1).setDisplaySize(46, 46).setDepth(y);
        sp.baseY = y;
        this.staffSprites[st.id] = sp;
      } else if (!on && sp) {
        sp.destroy();
        delete this.staffSprites[st.id];
      }
    }
  }

  // ---------- Pet yang mengikuti pemain ----------
  refreshPets() {
    const pets = this.engine.state.pets;
    const ids = pets.equipped.join(',');
    if (ids === this._petIds) return;
    this._petIds = ids;
    for (const s of this.petSprites) { s.img.destroy(); s.ring.destroy(); }
    this.petSprites = [];
    pets.equipped.forEach((id, i) => {
      const p = pets.owned.find((x) => x.id === id);
      if (!p) return;
      const col = Phaser.Display.Color.HexStringToColor(RARITIES.find((r) => r.id === p.rarity).color).color;
      const ring = this.add.ellipse(this.player.x, this.playerY, 30, 10, col, 0.55).setStrokeStyle(2, col).setDepth(1);
      const img = this.add.image(this.player.x - 30 * (i + 1), this.playerY, `pet_${p.kind}`).setOrigin(0.5, 1).setDisplaySize(34, 34);
      img.setVisible(this.view === 'toko'); ring.setVisible(this.view === 'toko');
      this.petSprites.push({ img, ring, i, id });
    });
  }

  // ---------- Kendali dari UI ----------
  setSpeed(s) { this.speed = s; }
  setPaused(v) { this.paused = !!v; }

  openShop() {
    const plan = this.engine.startDay();
    this.pending = plan.slice();
    this.clock = 0;
    this.closing = false;
    this.dayActive = true;
    this.customers = [];
    this.queue = [];
    this.setCarry(null);
    this.refreshShelves();
  }

  closeShop() {
    if (!this.dayActive || this.closing) return;
    this.closing = true;
    this.engine.dropUnspawned(this.pending.length);
    this.pending = [];
  }

  setCarry(animal) {
    this.carry = animal || null;
    this.carryIcon?.destroy();
    this.carryRing?.destroy();
    this.carryIcon = null;
    this.carryRing = null;
    if (animal) {
      const col = Phaser.Display.Color.HexStringToColor(RARITIES.find((r) => r.id === animal.rarity).color).color;
      this.carryRing = this.add.circle(this.player.x, this.playerY - 78, 18, col, 0.6).setStrokeStyle(3, col).setDepth(19000);
      this.carryIcon = this.add.image(this.player.x, this.playerY - 78, `icon_${animal.itemId}`).setDisplaySize(30, 30).setDepth(19001);
      this.carryRing.setVisible(this.view === 'toko'); this.carryIcon.setVisible(this.view === 'toko');
    }
  }

  waitingOrders() {
    return this.customers.filter((c) => c.state === 'waiting' && c.order).map((c) => c.order);
  }

  // ---------- Siklus per frame ----------
  update(time, delta) {
    const dt = delta / 1000;
    this._movePlayer(time, dt);
    this._moveCamera(dt);
    this._updatePopups(dt);
    this._updateFx(dt);
    this._updatePlots(time);
    this._updatePets(time, dt);
    this._updateWeather(time);
    for (const sp of Object.values(this.staffSprites)) sp.y = sp.baseY + Math.sin(time / 500 + sp.baseY) * 1.4;
    this._acc += dt;
    if (this._acc > 0.5) this._acc = 0;
    if (!this.dayActive || this.paused) return;

    const sdt = Math.min(dt, 0.1) * this.speed;
    if (sdt <= 0) return;
    this.clock += sdt;
    while (!this.closing && this.pending.length && this.pending[0].spawnAt <= this.clock) this._spawn(this.pending.shift());
    if (!this.closing && this.clock >= DAY_LENGTH_SEC && this.pending.length === 0) this.closing = true;
    for (const c of this.customers.slice()) this._updateCustomer(c, sdt, time);
    this._updateQueue(sdt);
    if (this.closing && this.pending.length === 0 && this.customers.length === 0) this._finishDay();
    this._tick();
  }

  _tick() {
    const t = this.engine.today;
    if (!t) return;
    const progress = Math.min(1, this.clock / DAY_LENGTH_SEC);
    const key = `${Math.round(progress * 100)}|${t.revenue}|${t.served}|${t.lost}|${this.customers.length}`;
    if (key === this._lastTick) return;
    this._lastTick = key;
    this.tint.setAlpha(Math.max(0, progress - 0.55) * 0.5);
    this.hooks.onTick?.({ progress, today: t, inStore: this.customers.length, closing: this.closing });
  }

  _finishDay() {
    this.dayActive = false;
    this.closing = false;
    this.tint.setAlpha(0);
    const summary = this.engine.endDay();
    this.refreshShelves();
    this._lastTick = '';
    this.hooks.onDayEnd?.(summary);
  }

  _updateWeather(time) {
    const raining = this.engine.eventOf().id === 'hujan';
    this.rainG.clear();
    if (!raining) return;
    this.rainG.lineStyle(2, 0x5b9bd8, 0.55);
    const w = this.scale.width;
    const h = this.scale.height;
    for (const r of this.rain) {
      const y = ((r.y + time / 900 * r.s) % 1) * h;
      const x = r.x * w - (y * 0.1);
      this.rainG.lineBetween(x, y, x - 3, y + 14);
    }
  }

  // ---------- Pemain ----------
  // Karakter diam di toko: ketukan langsung bekerja tanpa berjalan.
  _goTo(x, y, then) {
    // Di Toko karakter berjalan sungguhan (kecepatan dari skill); di Kebun ketukan langsung bekerja.
    if (this.view !== 'toko') { then?.(); return; }
    const tx = Math.max(500, Math.min(900, x));
    const ty = Math.max(822, Math.min(935, y));
    this.playerTarget = { x: tx, y: ty, then };
  }

  _movePlayer(time, dt) {
    const t = this.playerTarget;
    let moving = false;
    if (t) {
      const dx = t.x - this.player.x;
      const dy = t.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      const step = PLAYER_SPEED * (this.engine.walkMul?.() ?? 1) * dt;
      if (dist <= step) {
        this.player.x = t.x;
        this.playerY = t.y;
        this.playerTarget = null;
        t.then?.();
      } else {
        this.player.x += (dx / dist) * step;
        this.playerY += (dy / dist) * step;
        if (Math.abs(dx) > 1) this.player.setFlipX(dx < 0);
        moving = true;
      }
    }
    const bob = Math.sin(time / (moving ? 70 : 380)) * (moving ? 2.6 : 1.1);
    this.player.y = this.playerY + bob;
    this.player.setAngle(moving ? Math.sin(time / 70) * 4 : 0);
    this.player.setDepth(this.playerY + 1);
    if (this.carryIcon) {
      this.carryIcon.setPosition(this.player.x, this.playerY - 78 + bob);
      this.carryRing.setPosition(this.player.x, this.playerY - 78 + bob);
    }
  }

  _moveCamera(dt) {
    const cam = this.cameras.main;
    const goal = this.camGoal;
    if (!goal) return;
    const cx = cam.scrollX + cam.width / 2 / cam.zoom;
    const cy = cam.scrollY + cam.height / 2 / cam.zoom;
    const k = 1 - Math.pow(0.0008, dt);
    cam.centerOn(cx + (goal.x - cx) * k, cy + (goal.y - cy) * k);
    if (Math.hypot(goal.x - cx, goal.y - cy) < 2) this.camGoal = null;
  }

  _updatePets(time, dt) {
    const dir = this.player.flipX ? 1 : -1;
    for (const s of this.petSprites) {
      const tx = this.player.x + dir * (28 + s.i * 24);
      const ty = this.playerY + (s.i % 2 ? 7 : -3);
      const k = 1 - Math.pow(0.002, dt);
      s.img.x += (tx - s.img.x) * k;
      s.img.y += (ty - s.img.y) * k;
      const moving = Math.hypot(tx - s.img.x, ty - s.img.y) > 3;
      s.img.setFlipX(tx - s.img.x < -1 ? true : tx - s.img.x > 1 ? false : s.img.flipX);
      s.img.y += -Math.abs(Math.sin(time / (moving ? 110 : 420) + s.i)) * (moving ? 6 : 2);
      s.img.setDepth(s.img.y + 1);
      s.ring.setPosition(s.img.x, ty + 1).setDepth(s.img.y - 1);
    }
  }

  // ---------- Ketukan ----------
  _onTap(x, y) {
    // pelanggan yang menunggu
    const cust = this.customers.find((c) => c.state === 'waiting' && Math.abs(x - c.x) < 24 && y > c.y - 110 && y < c.y + 8);
    if (cust) {
      if (!this.carry) { this._popup(cust.x, cust.y - 100, 'Ambil hewannya di rak dulu', '#fff'); return; }
      this._goTo(cust.x, cust.y - 48, () => this._serve(cust));
      return;
    }
    // rak toko
    if (y > RACK_Y - 110 && y < RACK_Y + 8) {
      const idx = CATEGORIES.findIndex((c, i) => Math.abs(x - rackX(i)) < 42);
      if (idx >= 0) {
        if (!this.engine.categoryOpen(CATEGORIES[idx].id)) { this._popup(rackX(idx), RACK_Y - 110, `Butuh Toko Lv ${CATEGORIES[idx].needShop}`, '#fff'); return; }
        this._goTo(rackX(idx), RACK_Y + 38, () => {
          if (!this.dayActive) this._popup(rackX(idx), RACK_Y - 110, 'Buka toko dulu', '#fff');
          else this.hooks.onPickShelf?.(CATEGORIES[idx].id);
        });
        return;
      }
    }
    // lahan
    const plot = this.plots.find((p) => Math.abs(x - p.x) < p.w / 2 && Math.abs(y - p.y) < p.h / 2 + 8);
    if (plot) {
      this._goTo(plot.x, plot.y + plot.h / 2 + 22, () => this.hooks.onTapPlot?.({ slot: plot.slot, hab: plot.hab, buy: !!plot.buy }));
      return;
    }
    // bangunan dan NPC
    const near = (bx, by, w, h) => Math.abs(x - bx) < w / 2 && y > by - h && y < by + 12;
    if (near(250, 700, 220, 160)) { this._goTo(250, 760, () => this.hooks.onTapBuilding?.('pasar')); return; }
    if (near(1150, 700, 200, 170)) { this._goTo(1150, 760, () => this.hooks.onTapBuilding?.('pet')); return; }
    if (near(700, 232, 220, 160)) { this._goTo(700, 262, () => this.hooks.onTapBuilding?.('kantor')); return; }
    if (near(630, 355, 50, 80)) { this._goTo(640, 385, () => this.hooks.onTapBuilding?.('npc')); return; }
    this._goTo(x, y);
  }

  // ---------- Pelayanan ----------
  _serve(c) {
    if (c.state !== 'waiting' || !this.carry) return;
    const res = this.engine.serveAnimal(c.data, c.wantIdx, this.carry.id);
    if (!res.ok) {
      const msg = { salah: 'Bukan itu!', kualitas: 'Kurang langka', mahal: 'Kemahalan!', habis: 'Stok habis' }[res.reason] || '?';
      this._popup(c.x, c.y - 100, msg, '#ffd0d0');
      c.patience -= res.reason === 'salah' ? 6 : 3;
      if (res.reason === 'habis') this.setCarry(null);
      return;
    }
    c.bought = true;
    const col = RARITIES.find((r) => r.id === this.carry.rarity).color;
    this.burst(c.x, c.y - 70, Phaser.Display.Color.HexStringToColor(col).color);
    this.setCarry(null);
    this.hooks.onSale?.(res.total);
    this.refreshShelves();
    this._nextWant(c);
  }

  _beginOrder(c) {
    c.state = 'waiting';
    c.patience = c.maxPatience = Math.round(45 * (1 + this.engine.farmBuffs().patience));
    // Utamakan hewan yang memang ada di stok. Kalau stok barangnya kosong, pelanggan cepat pulang tanpa menghukum reputasi.
    const want = c.data.wants[c.wantIdx];
    const stock = this.engine.state.farm.animals;
    if (!stock.some((a) => a.itemId === want.itemId) && stock.length && Math.random() < 0.8) {
      const unlocked = new Set(this.engine.unlockedItems().map((i) => i.id));
      const pool = [...new Set(stock.map((a) => a.itemId))].filter((id) => unlocked.has(id));
      if (pool.length) want.itemId = pool[Math.floor(Math.random() * pool.length)];
    }
    c.lackStock = !stock.some((a) => a.itemId === want.itemId);
    if (c.lackStock) c.patience = c.maxPatience = Math.min(c.maxPatience, 12);
    c.order = this.engine.orderInfo(c.data, c.wantIdx);
    this._clearBubble(c);
    c.bubble = this._makeBubble(c);
  }

  _makeBubble(c) {
    const o = c.order;
    const rar = o.minQuality > 1 ? RARITIES[o.minQuality - 1] : null;
    const w = 54;
    const g = this.add.graphics().setDepth(820);
    g.fillStyle(0x3b2a1c, 1).fillRoundedRect(-w / 2 - 3, -56, w + 6, 58, 14);
    g.fillStyle(0xffffff, 1).fillRoundedRect(-w / 2, -53, w, 52, 11);
    g.fillStyle(0x3b2a1c, 1).fillTriangle(-9, 2, 9, 2, 0, 12);
    g.fillStyle(0xffffff, 1).fillTriangle(-6, -1, 6, -1, 0, 8);
    const icon = this.add.image(0, -36, `icon_${o.itemId}`).setDisplaySize(32, 32).setDepth(821);
    const short = rar ? (rar.name.length > 7 ? rar.name.slice(0, 6) + '.' : rar.name) : 'bebas';
    const need = rar
      ? T(this, 0, -17, `≥${short}`, 10, rar.color, { stroke: '#3b2a1c', strokeThickness: 2.5 }).setDepth(821)
      : T(this, 0, -17, 'bebas', 10, '#6b5a45').setDepth(821);
    const bar = this.add.graphics().setDepth(821);
    const label = T(this, 0, 0, customerName(c.data.id, c.data.type), 10, '#fff', { stroke: '#3b2a1c', strokeThickness: 3 }).setDepth(822);
    return { g, icon, need, bar, label, w, parts: [g, icon, need, bar, label] };
  }

  _placeBubble(c) {
    const b = c.bubble;
    if (!b) return;
    const bx = c.x;
    const by = c.y - 74;
    b.g.setPosition(bx, by);
    b.icon.setPosition(bx, by - 36);
    b.need.setPosition(bx, by - 17);
    b.label.setPosition(bx, c.y - 54);
    const f = Math.max(0, c.patience / c.maxPatience);
    b.bar.clear();
    b.bar.fillStyle(0x3b2a1c, 1).fillRoundedRect(bx - 21, by - 8, 42, 7, 3);
    b.bar.fillStyle(f > 0.5 ? 0x58b368 : f > 0.25 ? 0xffb938 : 0xe2574c, 1).fillRoundedRect(bx - 19, by - 6.5, Math.max(1, 38 * f), 4, 2);
  }

  _clearBubble(c) {
    if (!c.bubble) return;
    for (const o of c.bubble.parts) o.destroy();
    c.bubble = null;
  }

  _orderFail(c, reason) {
    if (!c.lackStock) c.slow = true;
    this._popup(c.x, c.y - 100, c.lackStock ? 'Stoknya kosong' : { habis: 'Habis...', sabar: 'Lama sekali!' }[reason] || '...', '#ffd0d0');
    this._clearBubble(c);
    c.state = 'failing';
    c.timer = 0.9;
  }

  _nextWant(c) {
    c.wantIdx += 1;
    if (c.wantIdx < c.data.wants.length) { this._beginOrder(c); return; }
    this._finishManual(c);
  }

  _finishManual(c) {
    this._clearBubble(c);
    this.queue = this.queue.filter((q) => q !== c);
    if (c.bought) {
      const total = this.engine.pay(c.data.id, { fast: c.patience > c.maxPatience * this.engine.fastThreshold() });
      if (total > 0) this._popup(c.x, c.y - 90, '+' + rupiah(total), '#ffd84d');
      this._leave(c, true);
    } else this._leave(c, false);
  }

  // ---------- Pelanggan ----------
  _lookKeyFor(data) {
    if (data.regularId && this.textures.exists(`reg_${data.regularId}`)) return `reg_${data.regularId}`;
    return A.lookKey(data.type, A.lookIndex(data.id));
  }

  _spawn(data) {
    const key = this._lookKeyFor(data);
    const c = { data, x: ENTRY_X, y: ROAD_Y, state: 'walk', wp: [], wantIdx: 0, bought: false, timer: 0, slot: -1, ph: Math.random() * 6 };
    c.sprite = this.add.image(c.x, c.y, key).setOrigin(0.5, 1).setDisplaySize(44, 68);
    if (data.regularId) {
      c.tag = T(this, c.x, c.y - 120, `★ ${regularDef(data.regularId)?.name || 'Langganan'}`, 10, '#3b2a1c', { backgroundColor: '#ffd84d', padding: { x: 4, y: 1 } }).setDepth(9400);
    }
    this.customers.push(c);
    if (this.queue.length >= 7) { this._popup(c.x + 10, c.y - 40, 'Antre penuh', '#ffd0d0'); this._leave(c, false); } else this._routeToQueue(c);
  }

  _routeToQueue(c) {
    this.queue.push(c);
    c.slot = this.queue.length - 1;
    const sx = slotX(c.slot);
    c.wp = [{ x: sx, y: ROAD_Y }, { x: sx, y: QUEUE_Y }];
    c.then = () => this._beginOrder(c);
    c.state = 'walk';
  }

  _leave(c, satisfied) {
    this.engine.customerLeft(c.data.id, satisfied, !satisfied && !c.slow);
    c.wp = [];
    if (c.y < ROAD_Y - 10) c.wp.push({ x: c.x, y: ROAD_Y });
    c.wp.push({ x: ENTRY_X - 40, y: ROAD_Y });
    c.then = () => this._remove(c);
    c.state = 'walk';
    c.leaving = true;
  }

  _remove(c) {
    this._clearBubble(c);
    c.tag?.destroy();
    c.sprite.destroy();
    this.customers = this.customers.filter((x) => x !== c);
  }

  _updateCustomer(c, dt, time) {
    let moving = false;
    if (c.state === 'walk') {
      let budget = WALK_SPEED * dt;
      while (budget > 0 && c.wp.length) {
        const p = c.wp[0];
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget) { c.x = p.x; c.y = p.y; c.wp.shift(); budget -= dist; } else { c.x += (dx / dist) * budget; c.y += (dy / dist) * budget; budget = 0; }
        if (Math.abs(dx) > 0.5) c.sprite.setFlipX(dx < 0);
        moving = true;
      }
      if (c.wp.length === 0) { const next = c.then; c.then = null; next?.(); }
    } else if (c.state === 'waiting') {
      c.patience -= dt;
      if (c.patience <= 0) this._orderFail(c, 'sabar');
    } else if (c.state === 'failing') {
      c.timer -= dt;
      if (c.timer <= 0) this._nextWant(c);
    }
    const bob = moving ? Math.sin(time / 80 + c.ph) * 2.4 : Math.sin(time / 420 + c.ph) * 0.8;
    c.sprite.setPosition(c.x, c.y + bob).setDepth(c.y).setAngle(moving ? Math.sin(time / 80 + c.ph) * 4 : 0);
    c.tag?.setPosition(c.x, c.y - 120);
    if (c.bubble) this._placeBubble(c);
  }

  _updateQueue(dt) {
    this.queue.forEach((c, k) => {
      c.slot = k;
      if (c.state !== 'waiting' && c.state !== 'failing') return;
      const dx = slotX(k) - c.x;
      if (Math.abs(dx) > 0.5) {
        c.x += Math.min(Math.abs(dx), WALK_SPEED * dt) * Math.sign(dx);
        c.sprite.setFlipX(dx < 0);
      }
    });
  }

  // ---------- Efek ----------
  burst(x, y, color = 0xffd84d, n = 10) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'sparkle').setDisplaySize(12 + Math.random() * 8, 12 + Math.random() * 8).setTint(color).setDepth(19500);
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 60;
      this.fxList.push({ s, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.7 + Math.random() * 0.3, max: 1 });
    }
  }

  _updateFx(dt) {
    for (const f of this.fxList.slice()) {
      f.life -= dt;
      f.s.x += f.vx * dt;
      f.s.y += f.vy * dt;
      f.vy += 90 * dt;
      f.s.setAlpha(Math.max(0, Math.min(1, f.life / 0.4)));
      if (f.life <= 0) { f.s.destroy(); this.fxList = this.fxList.filter((x) => x !== f); }
    }
  }

  plotCenter(slot) {
    const p = this.plots.find((x) => x.slot === slot);
    return p ? { x: p.x, y: p.y } : null;
  }

  _popup(x, y, text, color) {
    const t = T(this, x, y, text, 13, color, { stroke: '#3b2a1c', strokeThickness: 4 }).setDepth(19800);
    this.popups.push({ t, life: 1.2 });
  }

  popupAt(x, y, text, color = '#ffffff') { this._popup(x, y, text, color); }

  _updatePopups(dt) {
    for (const p of this.popups.slice()) {
      p.life -= dt;
      p.t.y -= 24 * dt;
      p.t.setAlpha(Math.max(0, Math.min(1, p.life / 0.5)));
      if (p.life <= 0) { p.t.destroy(); this.popups = this.popups.filter((x) => x !== p); }
    }
  }
}

export { getHabitat };
