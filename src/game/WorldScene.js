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
import {
  WORLD, BOX, GATES, PLOTS, PLOT_SIZE, plotFront, RACK_Y, rackX, QUEUE_Y, ROAD_Y, ENTRY_X, slotX, COUNTER, SPOTS, ROADS, BUILDINGS,
  decorSpots, buildNav, zoneOf, fenceRects, shopWalls,
} from './worldmap.js';

export { WORLD };
const VIEW_W = 520; // lebar pandang (satuan dunia) pada layar sempit
const VIEW_MIN_H = 380; // tinggi pandang minimum pada layar lebar
const BAKE = 1.5; // skala tekstur tanah
const FONT = "'Trebuchet MS','Segoe UI',system-ui,sans-serif";

const WALK_SPEED = 70;
const PLAYER_SPEED = 230;

const rupiah = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const NAMES = ['Budi', 'Siti', 'Andi', 'Wati', 'Agus', 'Dewi', 'Hendra', 'Lina', 'Putra', 'Mega', 'Rahmat', 'Nina', 'Fajar', 'Yuni', 'Eko', 'Tari', 'Bagas', 'Sinta', 'Doni', 'Maya', 'Iwan', 'Ratna', 'Joni', 'Citra'];
const TITLE = { biasa: '', pelit: 'Si ', vip: 'Tuan ', kolektor: 'Kolektor ' };
export const customerName = (id, type) => `${TITLE[type] || ''}${NAMES[hashSeed(`n${id}`) % NAMES.length]}`;

const T = (scene, x, y, str, size = 12, color = '#3b2a1c', extra = {}) => scene.add.text(x, y, str, {
  fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold', resolution: 2, ...extra,
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
    this.path = [];
    this.pathThen = null;
    this.rackSprites = [];
    this.plots = [];
    this.petSprites = [];
    this.crewNpc = new Map();
    this.crewBusy = new Set();
    this._lastTick = '';
    this._zone = '';
    this._zoneT = 0;
    this._acc = 0;
    this.lowFx = false;
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
    this.nav = buildNav();
    this.decor = decorSpots();
    this._bakeGround();
    this._buildHubs();

    const st = SPOTS.start;
    this.player = this.add.image(st.x, st.y, 'player').setOrigin(0.5, 1);
    this.player.setDisplaySize(44, 68);
    this.playerY = st.y;
    this.playerBob = 0;

    this.tint = this.add.rectangle(0, 0, 4000, 4000, 0xff8a3d, 0).setOrigin(0).setScrollFactor(0).setDepth(20000);
    this.rainG = this.add.graphics().setScrollFactor(0).setDepth(20001);
    this.rain = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 }));

    this._setupInput();
    this._fitCamera();
    this.camPos = { x: st.x, y: st.y - 40 };
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
    this.scale.on('resize', () => { this._fitCamera(); this._clampCam(); this.cameras.main.centerOn(this.camPos.x, this.camPos.y); });
    this.refreshShelves();
    this.hooks.onReady?.(this);
  }

  // ---------- Kamera dan input ----------
  _fitCamera() {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    const z = Math.max(Math.min(w / VIEW_W, h / VIEW_MIN_H), h / WORLD.h, w / WORLD.w);
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.setZoom(z);
    this.baseZoom = z;
    this.tint.setSize(w, h);
  }

  _clampCam() {
    const cam = this.cameras.main;
    const hw = cam.width / cam.zoom / 2;
    const hh = cam.height / cam.zoom / 2;
    const p = this.camPos;
    p.x = hw * 2 >= WORLD.w ? WORLD.w / 2 : Math.max(hw, Math.min(WORLD.w - hw, p.x));
    p.y = hh * 2 >= WORLD.h ? WORLD.h / 2 : Math.max(hh, Math.min(WORLD.h - hh, p.y));
  }

  _followCamera(dt, snap = false) {
    const goalX = this.player.x;
    const goalY = this.playerY - 34;
    const k = snap ? 1 : 1 - Math.pow(0.0004, dt);
    this.camPos.x += (goalX - this.camPos.x) * k;
    this.camPos.y += (goalY - this.camPos.y) * k;
    this._clampCam();
    this.cameras.main.centerOn(this.camPos.x, this.camPos.y);
  }

  _setupInput() {
    this.drag = null;
    const reset = () => { this.drag = null; };
    this.input.on('pointerdown', (p) => { this.drag = { x: p.x, y: p.y, id: p.id }; });
    this.input.on('pointermove', (p) => {
      const d = this.drag;
      if (d && p.isDown && p.id === d.id && Math.hypot(p.x - d.x, p.y - d.y) > 28) this.drag = null; // geseran bukan ketukan
    });
    this.input.on('pointerup', (p) => {
      const d = this.drag;
      this.drag = null;
      if (!d) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this._onTap(wp.x, wp.y);
    });
    this.input.on('pointerupoutside', reset);
    this.input.on('gameout', reset);
    this.game.events.on('blur', reset);
  }

  zoomBy() {}
  overview() {}
  focusHub() {}

  // Karakter berjalan ke titik tujuan lalu menjalankan `then`.
  travelTo(id, then) {
    const s = SPOTS[id === 'kebun' ? 'kolam' : id];
    if (!s) { then?.(); return; }
    this._goTo(s.x, s.y, then);
  }

  currentHub() { return zoneOf(this.player.x, this.playerY); }
  playerPos() { return { x: this.player.x, y: this.playerY }; }

  // ---------- Dunia statis ----------
  // Seluruh tanah, jalan, pagar, dekorasi datar digambar sekali ke satu tekstur supaya ringan.
  _bakeGround() {
    const S = BAKE;
    const cv = document.createElement('canvas');
    cv.width = Math.round(WORLD.w * S);
    cv.height = Math.round(WORLD.h * S);
    const c = cv.getContext('2d');
    c.scale(S, S);
    const rng = mulberry32(777);
    const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    const img = (key) => this.textures.get(key).getSourceImage();
    const stamp = (key, x, y, sc, ox = 0.5, oy = 0.5) => { const im = img(key); const w = im.width * sc; const h = im.height * sc; c.drawImage(im, x - w * ox, y - h * oy, w, h); };

    c.fillStyle = '#8fd36f'; c.fillRect(0, 0, WORLD.w, WORLD.h);
    c.fillStyle = '#9ddc7c';
    for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(rng() * WORLD.w, rng() * WORLD.h, (120 + rng() * 160) / 2, (60 + rng() * 80) / 2, 0, 0, Math.PI * 2); c.fill(); }
    // jalan
    const strokeRoads = (width, color) => { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'butt'; for (const r of ROADS) { c.beginPath(); c.moveTo(r[0][0], r[0][1]); c.lineTo(r[1][0], r[1][1]); c.stroke(); } };
    strokeRoads(80, '#3b2a1c');
    c.fillStyle = '#3b2a1c'; c.beginPath(); c.arc(700, 360, 158, 0, Math.PI * 2); c.fill();
    strokeRoads(72, '#f1d9a0');
    c.fillStyle = '#f1d9a0'; c.beginPath(); c.arc(700, 360, 150, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#e0c27c'; c.lineWidth = 4; c.beginPath(); c.arc(700, 360, 128, 0, Math.PI * 2); c.stroke();
    // halaman pasar, rumah pet, kebun, kandang
    const box = (x, y, w, h, c1, c2, r = 26) => {
      c.fillStyle = '#3b2a1c'; rr(x, y, w, h, r); c.fill();
      c.fillStyle = c1; rr(x + 5, y + 5, w - 10, h - 10, r - 4); c.fill();
      c.strokeStyle = c2; c.globalAlpha = 0.8; c.lineWidth = 3; rr(x + 16, y + 16, w - 32, h - 32, 16); c.stroke(); c.globalAlpha = 1;
    };
    box(BOX.kolam.x, BOX.kolam.y, BOX.kolam.w, BOX.kolam.h, '#a6e283', '#7bc45e');
    box(BOX.kandang.x, BOX.kandang.y, BOX.kandang.w, BOX.kandang.h, '#a6e283', '#7bc45e');
    box(60, 560, 380, 280, '#b6e68f', '#8bd070');
    box(960, 550, 380, 290, '#b6e68f', '#8bd070');
    // lantai toko berpapan kayu
    c.fillStyle = '#3b2a1c'; rr(BOX.toko.x, 696, BOX.toko.w, BOX.toko.h, 10); c.fill();
    c.fillStyle = '#f1d9a0'; rr(BOX.toko.x + 6, 702, BOX.toko.w - 12, BOX.toko.h - 12, 8); c.fill();
    c.strokeStyle = '#e0c27c'; c.lineWidth = 3;
    for (let x = 500; x < 920; x += 56) { c.beginPath(); c.moveTo(x, 706); c.lineTo(x, 954); c.stroke(); }
    // dekorasi datar
    for (const [x, y] of this.decor.tufts) stamp('tuft', x, y, 0.5);
    this.decor.flowers.forEach(([x, y], i) => stamp(`flower${i % 4}`, x, y, 0.55));
    for (const [x, y] of this.decor.rocks) stamp('rock', x, y, 0.5);
    for (const [x, y] of this.decor.bushes) stamp('bush', x, y, 0.6, 0.5, 1);
    // pohon pembatas tepi
    for (let x = 30; x < WORLD.w; x += 74) { stamp(`tree${(x / 74) % 2 | 0}`, x, 14, 0.5, 0.5, 0.9); stamp(`tree${(x / 74 + 1) % 2 | 0}`, x, WORLD.h + 2, 0.5, 0.5, 0.96); }
    for (let y = 80; y < WORLD.h; y += 90) { stamp('tree0', 10, y, 0.5, 0.5, 0.96); stamp('tree1', WORLD.w - 10, y, 0.5, 0.5, 0.96); }
    // pagar kebun dan kandang
    const fi = img('fence');
    const fw = fi.width * 0.5;
    const fh = fi.height * 0.5;
    for (const [x, y, w, h] of fenceRects()) {
      if (w >= h) { for (let px = x + fw / 2; px < x + w + fw / 2 - 4; px += fw - 4) c.drawImage(fi, Math.min(px, x + w - fw / 2) - fw / 2, y + h / 2 - fh * 0.62, fw, fh); }
      else for (let py = y; py < y + h; py += 30) c.drawImage(fi, x + w / 2 - fw / 2, py - fh * 0.62 + 12, fw, fh);
    }
    // dinding toko
    for (const [x, y, w, h] of shopWalls()) {
      c.fillStyle = '#3b2a1c'; rr(x - 2, y - 2, w + 4, h + 4, 4); c.fill();
      c.fillStyle = '#d9a05c'; rr(x, y, w, h, 3); c.fill();
    }
    // keset pintu
    c.fillStyle = '#e2574c'; rr(676, 692, 48, 12, 4); c.fill();
    c.fillStyle = '#e2574c'; rr(466, 926, 12, 34, 3); c.fill();
    if (this.textures.exists('ground')) this.textures.remove('ground');
    this.textures.addCanvas('ground', cv);
    this.ground = this.add.image(0, 0, 'ground').setOrigin(0).setDisplaySize(WORLD.w, WORLD.h).setDepth(-100);
    // pohon berdiri (urut kedalaman dengan karakter)
    for (const [x, y] of this.decor.trees) this.add.image(x, y, `tree${(x + y) % 2}`).setScale(0.5).setOrigin(0.5, 0.96).setDepth(y);
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
    const B = BUILDINGS;
    // balai dan alun-alun
    this.kantor = d(this.add.image(B.kantor.x, B.kantor.y, 'kantor').setOrigin(0.5, 1).setDisplaySize(B.kantor.w, B.kantor.h));
    this._label(700, 244, 'BALAI PASAR', 120);
    this.add.image(800, 345, 'fountain').setOrigin(0.5, 1).setDisplaySize(120, 100).setDepth(345);
    this.add.image(610, 420, 'signpost').setOrigin(0.5, 1).setDisplaySize(72, 80).setDepth(420);
    for (const x of [590, 810]) this.add.image(x, 260, 'lamp').setOrigin(0.5, 1).setDisplaySize(22, 56).setDepth(260);
    // pak pasar (NPC cerita)
    this.npc = this.add.image(630, 355, 'npc').setOrigin(0.5, 1).setDisplaySize(44, 68).setDepth(355);
    this.npcMark = this.add.image(630, 270, 'exclaim').setDisplaySize(24, 30).setDepth(9000).setVisible(false);
    this.tweens.add({ targets: this.npcMark, y: 262, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // pasar dan rumah pet
    this.pasarB = d(this.add.image(B.pasar.x, B.pasar.y, 'pasar').setOrigin(0.5, 1).setDisplaySize(B.pasar.w, B.pasar.h));
    this.petB = d(this.add.image(B.pet.x, B.pet.y, 'pethouse').setOrigin(0.5, 1).setDisplaySize(B.pet.w, B.pet.h));
    // toko
    this.add.image(B.toko.x, B.toko.y, 'toko').setOrigin(0.5, 1).setDisplaySize(B.toko.w, B.toko.h).setDepth(700);
    this.add.image(COUNTER.x, COUNTER.y, 'counter').setOrigin(0.5, 1).setScale(0.45).setDepth(COUNTER.y);
    // papan nama kebun dan kandang (menggantung di pagar)
    this._label(300, 30, 'KOLAM & KEBUN', 160);
    this._label(1100, 30, 'KANDANG SATWA', 160);
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
    const view = this.cameras.main.worldView;
    for (const p of this.plots) {
      if (p.slot === null || !p.occs || !p.occs.length) continue;
      if (!force && (p.x + p.w < view.x - 40 || p.x - p.w > view.right + 40 || p.y + p.h < view.y - 40 || p.y - p.h > view.bottom + 40)) continue;
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

  // Sinkronkan karyawan di peta dengan daftar crew di mesin.
  refreshStaff() {
    const hired = this.engine.state.crew.hired;
    const live = new Set(hired.map((m) => m.uid));
    for (const [uid, n] of this.crewNpc) {
      if (live.has(uid)) continue;
      if (n.claim) n.claim.claimed = null;
      if (n.busy != null) this.crewBusy.delete(n.busy);
      n.sprite.destroy(); n.bar.destroy(); n.tag.destroy();
      this.crewNpc.delete(uid);
    }
    for (const m of hired) {
      let n = this.crewNpc.get(m.uid);
      if (!n) {
        if (!this.textures.exists(`staff_${m.type}`)) continue;
        const homes = this._homesOf(m.type);
        const idx = hired.filter((x) => x.type === m.type).findIndex((x) => x.uid === m.uid);
        const h = homes[idx % homes.length];
        n = { m, x: h[0], y: h[1], home: h, homes, idx, path: [], state: 'idle', timer: 0, wait: 1 + Math.random() * 3, claim: null, busy: null, plan: null };
        n.sprite = this.add.image(n.x, n.y, `staff_${m.type}`).setOrigin(0.5, 1).setDisplaySize(46, 46).setDepth(n.y);
        n.bar = this.add.graphics().setDepth(9300);
        n.tag = T(this, n.x, n.y - 54, '', 9, '#ffffff', { stroke: '#3b2a1c', strokeThickness: 3 }).setDepth(9301);
        this.crewNpc.set(m.uid, n);
      }
      n.m = m;
      n.tag.setText(m.lvl > 1 ? `Lv${m.lvl}` : '');
    }
  }

  _homesOf(type) {
    const H = {
      kasir: [[840, 862], [790, 862], [740, 862]],
      pramuniaga: [[560, 856], [640, 872], [720, 856]],
      penjaga: [[600, 836], [660, 836], [720, 836]],
      satpam: [[292, 402], [372, 402], [250, 402]],
      badut: [[680, 430], [770, 420], [650, 305], [740, 395]],
      perawat: [[270, 472], [390, 472], [330, 492]],
      petani: [[1000, 392], [1180, 392], [1090, 392]],
      peramal: [[745, 385], [705, 335]],
    };
    return H[type] || [[700, 860]];
  }

  _crewGo(n, x, y) {
    n.path = this.nav.find(n.x, n.y, x, y);
  }

  _crewMove(n, dt, speed) {
    let moving = false;
    let budget = speed * dt;
    while (budget > 0 && n.path.length) {
      const t = n.path[0];
      const dx = t.x - n.x;
      const dy = t.y - n.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) { n.x = t.x; n.y = t.y; n.path.shift(); budget -= dist; } else { n.x += (dx / dist) * budget; n.y += (dy / dist) * budget; budget = 0; }
      if (Math.abs(dx) > 0.5) n.sprite.setFlipX(dx < 0);
      moving = true;
    }
    return moving;
  }

  _crewRelease(n) {
    if (n.claim) n.claim.claimed = null;
    if (n.busy != null) this.crewBusy.delete(n.busy);
    n.claim = null; n.busy = null; n.plan = null; n.timer = 0;
    n.state = 'return';
    this._crewGo(n, n.home[0], n.home[1]);
  }

  _updateCrew(time, dt, sdt) {
    for (const n of this.crewNpc.values()) {
      const job = n.m.type;
      const jd = STAFF.find((x) => x.id === job);
      let moving = false;
      if (n.state === 'work') {
        n.timer -= dt;
        const total = this.engine.workInterval(n.m);
        const f = 1 - Math.max(0, n.timer) / total;
        n.bar.clear().fillStyle(0x3b2a1c, 1).fillRoundedRect(n.x - 15, n.y - 62, 30, 6, 3).fillStyle(0x58b368, 1).fillRoundedRect(n.x - 13.5, n.y - 60.5, Math.max(1, 27 * f), 3, 1.5);
        if (n.timer <= 0) { n.bar.clear(); this._crewFinish(n); }
      } else {
        n.bar.clear();
        if (n.state === 'walk') {
          moving = this._crewMove(n, dt, 120);
          if (!n.path.length) { n.state = 'work'; n.timer = this.engine.workInterval(n.m); }
        } else if (n.state === 'return' || n.state === 'wander') {
          moving = this._crewMove(n, dt, n.state === 'wander' ? 55 : 110);
          if (!n.path.length) { n.state = 'idle'; n.wait = 3 + Math.random() * 5; }
        } else {
          n.wait -= dt;
          if (jd.job === 'kasir' && this.dayActive) this._cashierLook(n);
          else if (jd.job === 'penjaga' && n.wait <= 0) { n.wait = 1.2; this._keeperLook(n); }
          else if (!jd.job && n.wait <= 0 && n.homes.length > 1) { const h = n.homes[Math.floor(Math.random() * n.homes.length)]; n.state = 'wander'; this._crewGo(n, h[0], h[1]); }
        }
      }
      const bob = moving ? Math.sin(time / 70 + n.m.uid) * 2.2 : Math.sin(time / 500 + n.m.uid) * 1.2;
      n.sprite.setPosition(n.x, n.y + bob).setDepth(n.y);
      n.tag.setPosition(n.x, n.y - 54);
    }
  }

  // Kasir: ambil pelanggan yang menunggu dan belum diurus, lalu hampiri.
  _cashierLook(n) {
    const c = this.queue.find((q) => q.state === 'waiting' && !q.claimed && this.engine.cashierPick(q.data, q.wantIdx) != null);
    if (!c) return;
    c.claimed = n;
    n.claim = c;
    n.state = 'walk';
    this._crewGo(n, c.x - 8, c.y - 40);
  }

  _keeperLook(n) {
    const plan = this.engine.keeperPlan(this.crewBusy);
    if (!plan) return;
    const plot = this.plots.find((p) => p.slot === plan.slot);
    if (!plot) return;
    n.plan = plan;
    n.busy = plan.slot;
    this.crewBusy.add(plan.slot);
    n.state = 'walk';
    const f = plotFront(plot.hab, plot.x, plot.y);
    this._crewGo(n, f.x, f.y);
  }

  _crewFinish(n) {
    const job = STAFF.find((x) => x.id === n.m.type).job;
    if (job === 'kasir') {
      const c = n.claim;
      if (c && c.state === 'waiting' && this.dayActive) {
        const id = this.engine.cashierPick(c.data, c.wantIdx);
        if (id != null) this._serveWith(c, id, false);
      }
    } else if (job === 'penjaga' && n.plan) {
      try {
        const r = this.engine.keeperPerform(n.plan);
        this.refreshFarm();
        const plot = this.plots.find((p) => p.slot === n.plan.slot);
        if (plot) {
          this._popup(n.x, n.y - 70, r.type === 'panen' ? `Panen ${r.animals.length} ekor` : `Tanam ${r.qty} ${getItem(r.itemId).name}`, '#e6ffd0');
          this.burst(plot.x, plot.y, 0x7ccf6a, 8);
        }
      } catch (err) {
        this._popup(n.x, n.y - 70, err.message.slice(0, 28), '#ffd0d0');
      }
    }
    this._crewRelease(n);
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
    this._clearThief();
    this.thiefSpawned = false;
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
    }
  }

  waitingOrders() {
    return this.customers.filter((c) => c.state === 'waiting' && c.order).map((c) => c.order);
  }

  // ---------- Siklus per frame ----------
  update(time, delta) {
    const dt = delta / 1000;
    this._movePlayer(time, dt);
    this._followCamera(dt);
    this._trackZone(time);
    this._updatePopups(dt);
    this._updateFx(dt);
    this._updatePlots(time);
    this._updatePets(time, dt);
    this._updateWeather(time);
    if (!this.paused) this._updateCrew(time, dt * (this.dayActive ? this.speed : 1), dt);
    this._acc += dt;
    if (this._acc > 0.5) this._acc = 0;
    if (!this.dayActive || this.paused) return;

    const sdt = Math.min(dt, 0.1) * this.speed;
    if (sdt <= 0) return;
    this.clock += sdt;
    while (!this.closing && this.pending.length && this.pending[0].spawnAt <= this.clock) this._spawn(this.pending.shift());
    if (!this.closing && this.clock >= DAY_LENGTH_SEC && this.pending.length === 0) this.closing = true;
    this._updateThief(sdt, time);
    for (const c of this.customers.slice()) this._updateCustomer(c, sdt, time);
    this._updateQueue(sdt);
    if (this.closing && this.pending.length === 0 && this.customers.length === 0 && !this.thief) this._finishDay();
    this._tick();
  }

  _trackZone(time) {
    if (time - this._zoneT < 200) return;
    this._zoneT = time;
    const z = zoneOf(this.player.x, this.playerY);
    if (z !== this._zone) { this._zone = z; this.hooks.onHub?.(z); }
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
  // Karakter berjalan sungguhan lewat jalur yang menghindari dinding; ketukan baru membatalkan tujuan lama.
  _goTo(x, y, then) {
    this.path = this.nav.find(this.player.x, this.playerY, x, y);
    const end = this.path.at(-1);
    const reached = !end || Math.hypot(end.x - x, end.y - y) < 40;
    this.pathThen = reached ? then || null : null;
    if (!this.path.length) { const t = this.pathThen; this.pathThen = null; t?.(); return; }
    if (!reached && then) this._popup(this.player.x, this.playerY - 90, 'Tidak bisa ke sana', '#ffd0d0');
    if (this.dest) this.dest.destroy();
    const tp = end || { x, y };
    this.dest = this.add.ellipse(tp.x, tp.y, 26, 10, 0xffffff, 0.5).setStrokeStyle(2, 0x3b2a1c, 0.7).setDepth(5);
  }

  _movePlayer(time, dt) {
    let moving = false;
    let budget = PLAYER_SPEED * (this.engine.walkMul?.() ?? 1) * dt;
    while (this.path.length && budget > 0) {
      const t = this.path[0];
      const dx = t.x - this.player.x;
      const dy = t.y - this.playerY;
      const dist = Math.hypot(dx, dy);
      if (dist <= budget) {
        this.player.x = t.x;
        this.playerY = t.y;
        this.path.shift();
        budget -= dist;
      } else {
        this.player.x += (dx / dist) * budget;
        this.playerY += (dy / dist) * budget;
        budget = 0;
      }
      if (Math.abs(dx) > 1) this.player.setFlipX(dx < 0);
      moving = true;
    }
    if (!this.path.length && moving === false && this.dest) { this.dest.destroy(); this.dest = null; }
    if (!this.path.length && this.pathThen) {
      const then = this.pathThen;
      this.pathThen = null;
      if (this.dest) { this.dest.destroy(); this.dest = null; }
      then();
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
      const f = plotFront(plot.hab, plot.x, plot.y);
      this._goTo(f.x, f.y, () => this.hooks.onTapPlot?.({ slot: plot.slot, hab: plot.hab, buy: !!plot.buy }));
      return;
    }
    // bangunan dan NPC
    const near = (b) => Math.abs(x - b.x) < b.w / 2 && y > b.y - b.h && y < b.y + 12;
    const B = BUILDINGS;
    if (near(B.pasar)) { this._goTo(SPOTS.pasar.x, SPOTS.pasar.y, () => this.hooks.onTapBuilding?.('pasar')); return; }
    if (near(B.pet)) { this._goTo(SPOTS.pet.x, SPOTS.pet.y, () => this.hooks.onTapBuilding?.('pet')); return; }
    if (near(B.kantor)) { this._goTo(SPOTS.kantor.x, SPOTS.kantor.y, () => this.hooks.onTapBuilding?.('kantor')); return; }
    if (near({ x: 630, y: 355, w: 50, h: 80 })) { this._goTo(SPOTS.npc.x, SPOTS.npc.y, () => this.hooks.onTapBuilding?.('npc')); return; }
    if (near(B.toko)) { this._goTo(SPOTS.toko.x, SPOTS.toko.y); return; }
    this._goTo(x, y);
  }

  // ---------- Pelayanan ----------
  _serve(c) {
    if (c.state !== 'waiting' || !this.carry) return;
    this._serveWith(c, this.carry.id, true);
  }

  // Satu pintu penjualan: dipakai tangan pemain (byHand) dan kasir karyawan.
  _serveWith(c, animalId, byHand) {
    const res = this.engine.serveAnimal(c.data, c.wantIdx, animalId);
    if (!res.ok) {
      if (!byHand) return false;
      const msg = { salah: 'Bukan itu!', kualitas: 'Kurang langka', mahal: 'Kemahalan!', habis: 'Stok habis' }[res.reason] || '?';
      this._popup(c.x, c.y - 100, msg, '#ffd0d0');
      c.patience -= res.reason === 'salah' ? 6 : 3;
      if (res.reason === 'habis') this.setCarry(null);
      return false;
    }
    c.bought = true;
    const col = RARITIES.find((r) => r.id === res.animal.rarity).color;
    this.burst(c.x, c.y - 70, Phaser.Display.Color.HexStringToColor(col).color);
    if (byHand) this.setCarry(null);
    this.hooks.onSale?.(res.total);
    this.refreshShelves();
    this._nextWant(c);
    return true;
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

  // ---------- Pencuri ----------
  _clearThief() {
    if (!this.thief) return;
    this.thief.sprite.destroy();
    this.thief.tag.destroy();
    this.thief.loot?.destroy();
    this.thief = null;
  }

  _spawnThief() {
    this.thiefSpawned = true;
    const pv = this.engine.thiefPreview();
    if (!pv) { this.engine.resolveThief(); return; }
    const plot = this.plots.find((p) => p.slot === pv.slot);
    if (!plot) { this.engine.resolveThief(); return; }
    const east = plot.hab === 'kandang';
    const entry = east ? { x: 1260, y: 452 } : { x: 130, y: 452 };
    const f = plotFront(plot.hab, plot.x, plot.y);
    const path = this.nav.find(entry.x, entry.y, f.x, f.y);
    const caught = this.engine.thiefCaught(pv.slot);
    const guard = [...this.crewNpc.values()].find((n) => n.m.type === 'satpam') || null;
    const sprite = this.add.image(entry.x, entry.y, A.lookKey('biasa', 1)).setOrigin(0.5, 1).setDisplaySize(44, 68).setTint(0x59596f);
    const tag = T(this, entry.x, entry.y - 76, 'PENCURI!', 10, '#ffffff', { backgroundColor: '#b3261e', padding: { x: 4, y: 1 } }).setDepth(9400);
    this.thief = { x: entry.x, y: entry.y, path, entry, state: 'in', caught, slot: pv.slot, guard, sprite, tag, wait: 0 };
    this._popup(entry.x, entry.y - 96, 'Ada pencuri!', '#ffd0d0');
    this.hooks.onThief?.({ phase: 'arrive', caught });
  }

  _updateThief(dt, time) {
    const eng = this.engine;
    const plan = eng.today?.thief;
    if (!this.thief && !this.thiefSpawned && plan && !plan.done && !this.closing && this.clock >= plan.at * DAY_LENGTH_SEC) this._spawnThief();
    const th = this.thief;
    if (!th) return;
    let moving = false;
    if (th.state === 'steal') {
      th.wait -= dt;
      if (th.wait <= 0) this._thiefFlee(th);
    } else {
      let budget = (th.state === 'flee' ? 150 : 95) * dt;
      while (budget > 0 && th.path.length) {
        const t = th.path[0];
        const dx = t.x - th.x;
        const dy = t.y - th.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget) { th.x = t.x; th.y = t.y; th.path.shift(); budget -= dist; } else { th.x += (dx / dist) * budget; th.y += (dy / dist) * budget; budget = 0; }
        if (Math.abs(dx) > 0.5) th.sprite.setFlipX(dx < 0);
        moving = true;
      }
      if (th.state === 'in') {
        // satpam di kolam menghentikan pencuri begitu cukup dekat
        if (th.caught && th.guard && Math.hypot(th.x - th.guard.x, th.y - th.guard.y) < 78) this._thiefStopped(th);
        else if (!th.path.length) this._thiefStrike(th);
      } else if (th.state === 'flee' && !th.path.length) {
        this._clearThief();
        return;
      }
    }
    const bob = moving ? Math.sin(time / 60) * 2.6 : 0;
    th.sprite.setPosition(th.x, th.y + bob).setDepth(th.y);
    th.tag.setPosition(th.x, th.y - 76);
    th.loot?.setPosition(th.x, th.y - 92);
  }

  _thiefStopped(th) {
    this.engine.resolveThief();
    this._popup(th.guard.x, th.guard.y - 60, 'Satpam: Berhenti!', '#ffe08a');
    this._popup(th.x, th.y - 96, 'Kabur!', '#ffd0d0');
    this.burst(th.x, th.y - 40, 0xffffff, 8);
    this.hooks.onThief?.({ phase: 'caught' });
    this._thiefFlee(th);
  }

  _thiefStrike(th) {
    const res = this.engine.resolveThief();
    th.state = 'steal';
    th.wait = 0.9;
    if (res?.stolen) {
      this._popup(th.x, th.y - 96, 'Hewan dicuri!', '#ff9b9b');
      this.burst(th.x, th.y - 40, 0xe2574c, 10);
      this.refreshFarm();
      this.refreshShelves();
      th.loot = this.add.image(th.x, th.y - 90, `icon_${res.itemId}`).setDisplaySize(26, 26).setDepth(9500);
      this.hooks.onThief?.({ phase: 'stolen', itemId: res.itemId });
    } else this.hooks.onThief?.({ phase: 'none' });
  }

  _thiefFlee(th) {
    th.state = 'flee';
    th.path = this.nav.find(th.x, th.y, th.entry.x, th.entry.y);
    th.tag.setText('KABUR!');
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
