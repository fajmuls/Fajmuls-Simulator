import Phaser from 'phaser';
import { CATEGORIES, getItem, getQuality, itemsOf } from '../core/catalog.js';
import { DAY_LENGTH_SEC } from '../core/engine.js';
import { hashSeed } from '../core/rng.js';
import { regularDef } from '../core/regulars.js';
import {
  HAIRS, SKINS, buildCustomerTextures, buildIconTextures, buildShopBackground, buildShelfTexture,
  addBackground, customerTextureKey,
} from './art.js';

export const W = 360;
export const H = 400;

const AISLE_Y = 232; // lorong tempat pelanggan berjalan
const SHELF_STAND_Y = 200; // posisi kaki pelanggan saat melihat rak
const ROAD_Y = 374; // jalur ke pintu
const DOOR_X = 30;
const PAY_X = 300;
const PAY_Y = 342;
const QUEUE_GAP = 26;
const WALK_SPEED = 64; // piksel per detik (pada kecepatan 1x)
const BROWSE_TIME = 0.9;
const PAY_TIME = 0.7;

const rupiah = (n) => 'Rp ' + n.toLocaleString('id-ID');
const shelfX = (i) => 40 + i * 70;
const catIdx = (catId) => CATEGORIES.findIndex((c) => c.id === catId);

export class ShopScene extends Phaser.Scene {
  constructor(engine, hooks = {}) {
    super('shop');
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
    this.shelfSprites = [];
    this._lastTick = '';
  }

  create() {
    buildIconTextures(this);
    buildCustomerTextures(this);
    addBackground(this, 'shop_bg', buildShopBackground(this, W, H));
    buildShelfTexture(this, 'shelf', 64);

    this.add.image(0, 0, 'shop_bg').setOrigin(0, 0).setDepth(0);

    this.shelfLabels = [];
    this.shelfCovers = [];
    CATEGORIES.forEach((c, i) => {
      this.add.image(shelfX(i), 60, 'shelf').setOrigin(0.5, 0).setDepth(1);
      this.shelfLabels.push(
        this.add.text(shelfX(i), 52, c.short, { fontFamily: 'monospace', fontSize: '9px', color: '#3b2210', fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(2),
      );
    });
    this.sign = this.add.text(W / 2, 12, 'PASAR SATWA', { fontFamily: 'monospace', fontSize: '13px', color: '#fde68a', fontStyle: 'bold', stroke: '#3b2210', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(3);
    this.signStars = this.add.text(W / 2, 28, '', { fontFamily: 'monospace', fontSize: '10px', color: '#fbbf24', stroke: '#3b2210', strokeThickness: 3 }).setOrigin(0.5, 0).setDepth(3);
    this.decor = this.add.graphics().setDepth(1);
    this.add.image(8, 250, 'icon_plant').setOrigin(0, 0.5).setScale(1.2).setDepth(3);
    this.add.image(350, 150, 'icon_plant').setOrigin(1, 0.5).setScale(1.2).setDepth(3);

    this.owner = this.add.image(272, 262, 'owner').setOrigin(0.5, 1).setDepth(262);
    this.ownerBaseY = 262;

    this.refreshShelves();
    this.hooks.onReady?.(this);
  }

  // ---------- Rak ----------
  refreshShelves() {
    for (const sp of this.shelfSprites) sp.destroy();
    this.shelfSprites = [];
    const e = this.engine;
    CATEGORIES.forEach((cat, i) => {
      const cx = shelfX(i);
      const open = e.categoryOpen(cat.id);
      if (!open) {
        const cover = this.add.rectangle(cx, 92, 62, 52, 0x1f2937, 0.78).setDepth(3);
        const t = this.add.text(cx, 92, `Toko\nLv ${cat.needShop}`, { fontFamily: 'monospace', fontSize: '10px', color: '#9ca3af', align: 'center', fontStyle: 'bold' }).setOrigin(0.5).setDepth(4);
        this.shelfSprites.push(cover, t);
        return;
      }
      const rows = itemsOf(cat.id)
        .map((it) => ({ it, qty: e.totalQty(it.id) }))
        .filter((r) => r.qty > 0)
        .sort((a, b) => b.it.tier - a.it.tier)
        .slice(0, 4);
      const slots = [[-16, 80], [16, 80], [-16, 106], [16, 106]];
      rows.forEach((r, k) => {
        const img = this.add.image(cx + slots[k][0], slots[k][1], `icon_${r.it.id}`).setDepth(2);
        const qt = this.add.text(cx + slots[k][0], slots[k][1] + 12, String(r.qty), { fontFamily: 'monospace', fontSize: '8px', color: '#fff', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5, 0).setDepth(3);
        this.shelfSprites.push(img, qt);
      });
      if (rows.length === 0) {
        const t = this.add.text(cx, 92, 'KOSONG', { fontFamily: 'monospace', fontSize: '10px', color: '#b91c1c', fontStyle: 'bold' }).setOrigin(0.5).setDepth(3);
        this.shelfSprites.push(t);
      }
    });
    this.refreshDecor();
  }

  // Dekorasi toko ikut berubah sesuai level toko dan bintang.
  refreshDecor() {
    const e = this.engine;
    const lvl = e.state.shopLevel;
    const g = this.decor;
    g.clear();
    const colors = [0x9ca3af, 0x16a34a, 0x2563eb, 0xdc2626, 0xf59e0b];
    const col = colors[lvl - 1];
    for (let x = 0; x < W; x += 24) {
      g.fillStyle((x / 24) % 2 === 0 ? col : 0xffffff, 1);
      g.fillRect(x, 0, 24, 8);
    }
    if (lvl >= 3) {
      for (const lx of [60, 180, 300]) {
        g.fillStyle(0xfacc15, 1);
        g.fillRect(lx - 3, 40, 6, 8);
        g.fillStyle(0x92400e, 1);
        g.fillRect(lx - 1, 34, 2, 6);
      }
    }
    if (lvl >= 4) {
      g.fillStyle(0xb91c1c, 1);
      g.fillRect(120, 330, 70, 40);
      g.fillStyle(0xfecaca, 1);
      g.fillRect(124, 334, 62, 2);
    }
    const st = e.state.stars;
    this.signStars.setText('★'.repeat(st) + '☆'.repeat(5 - st) + `  Toko Lv ${lvl}`);
  }

  // ---------- Kendali dari UI ----------
  setSpeed(s) {
    this.speed = s;
  }

  openShop() {
    const plan = this.engine.startDay();
    this.pending = plan.slice();
    this.clock = 0;
    this.closing = false;
    this.dayActive = true;
    this.customers = [];
    this.queue = [];
    this.refreshShelves();
  }

  closeShop() {
    if (!this.dayActive || this.closing) return;
    this.closing = true;
    this.engine.dropUnspawned(this.pending.length);
    this.pending = [];
  }

  // ---------- Siklus per frame ----------
  update(time, delta) {
    this._animateOwner(time);
    this._updatePopups(delta / 1000);
    if (!this.dayActive) return;

    const dt = Math.min(delta / 1000, 0.1) * this.speed;
    if (dt <= 0) return;
    this.clock += dt;

    while (!this.closing && this.pending.length && this.pending[0].spawnAt <= this.clock) {
      this._spawn(this.pending.shift());
    }
    // Waktu habis: berhenti menerima pelanggan baru.
    if (!this.closing && this.clock >= DAY_LENGTH_SEC && this.pending.length === 0) this.closing = true;

    for (const c of this.customers.slice()) this._updateCustomer(c, dt);
    this._updateQueue(dt);

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
    this.hooks.onTick?.({ progress, today: t, inStore: this.customers.length, closing: this.closing });
  }

  _finishDay() {
    this.dayActive = false;
    this.closing = false;
    const summary = this.engine.endDay();
    this.refreshShelves();
    this._lastTick = '';
    this.hooks.onDayEnd?.(summary);
  }

  _animateOwner(time) {
    this.owner.y = this.ownerBaseY + Math.sin(time / 400) * 1.2;
  }

  // ---------- Pelanggan ----------
  _spawn(data) {
    const h = hashSeed(data.id);
    const hair = h % HAIRS.length;
    const skin = (h >>> 3) % SKINS.length;
    const c = {
      data, hair, skin, x: -16, y: ROAD_Y, state: 'walk', wp: [], wantIdx: 0,
      bought: false, timer: 0, anim: 0, frame: 'idle', bubble: null, slot: -1,
    };
    c.sprite = this.add.image(c.x, c.y, customerTextureKey(data.type, hair, skin, 'idle')).setOrigin(0.5, 1);
    if (data.regularId) {
      const q = data.request ? ` ${data.request.minQuality > 0 ? '★' + data.request.minQuality + '+' : ''}` : '';
      c.tag = this.add.text(c.x, c.y - 72, `⭐ ${regularDef(data.regularId)?.name || 'Langganan'}${data.request ? ' · 🎯' + q : ''}`, {
        fontFamily: 'monospace', fontSize: '9px', color: '#2b1604', backgroundColor: '#fbbf24', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1).setDepth(9999);
    }
    this.customers.push(c);
    this._routeToShelf(c);
  }

  _pushWaypoints(c, pts, then) {
    c.wp = pts;
    c.then = then;
    c.state = 'walk';
  }

  _routeToShelf(c) {
    const want = c.data.wants[c.wantIdx];
    const idx = catIdx(getItem(want.itemId).cat);
    const sx = shelfX(idx) + (c.data.id.length % 3 - 1) * 4;
    const pts = [];
    if (c.y > AISLE_Y + 4) pts.push({ x: Math.max(c.x, DOOR_X), y: ROAD_Y }, { x: DOOR_X, y: ROAD_Y }, { x: DOOR_X, y: AISLE_Y });
    else if (c.y < AISLE_Y - 4) pts.push({ x: c.x, y: AISLE_Y });
    pts.push({ x: sx, y: AISLE_Y }, { x: sx, y: SHELF_STAND_Y });
    this._pushWaypoints(c, pts, () => this._startBrowse(c));
  }

  _startBrowse(c) {
    c.state = 'browse';
    c.timer = BROWSE_TIME;
    const res = this.engine.browse(c.data, c.wantIdx);
    let text;
    if (res.ok) {
      c.bought = true;
      text = `${res.qty}× ${getItem(res.itemId).name.split(' ')[0]}`;
      c.bubble = this._makeBubble(c, text, '#166534', res.itemId);
    } else {
      const msg = { habis: 'Habis...', mahal: 'Kemahalan!', kualitas: 'Kurang bagus' }[res.reason] || '?';
      c.bubble = this._makeBubble(c, msg, '#991b1b');
    }
    this.refreshShelves();
  }

  _makeBubble(c, text, bg, itemId) {
    const t = this.add.text(c.x, c.y - 40, text, {
      fontFamily: 'monospace', fontSize: '10px', color: '#fff', backgroundColor: bg, padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(9999);
    let icon = null;
    if (itemId) {
      icon = this.add.image(c.x, c.y - 56, `icon_${itemId}`).setScale(0.8).setDepth(9999);
    }
    return { t, icon };
  }

  _clearBubble(c) {
    if (c.bubble) {
      c.bubble.t.destroy();
      c.bubble.icon?.destroy();
      c.bubble = null;
    }
  }

  _afterBrowse(c) {
    this._clearBubble(c);
    c.wantIdx += 1;
    if (c.wantIdx < c.data.wants.length) {
      const x = c.x;
      this._pushWaypoints(c, [{ x, y: AISLE_Y }], () => this._routeToShelf(c));
    } else if (c.bought) {
      this._routeToQueue(c);
    } else {
      this._leave(c, false);
    }
  }

  _routeToQueue(c) {
    this.queue.push(c);
    const slot = this.queue.length - 1;
    c.slot = slot;
    const sx = this._slotX(slot);
    const pts = [{ x: c.x, y: AISLE_Y }];
    if (sx >= 230) pts.push({ x: 224, y: AISLE_Y }, { x: 224, y: PAY_Y }, { x: sx, y: PAY_Y });
    else pts.push({ x: sx, y: AISLE_Y }, { x: sx, y: PAY_Y });
    this._pushWaypoints(c, pts, () => { c.state = 'queued'; });
  }

  _slotX(k) {
    return PAY_X - k * QUEUE_GAP;
  }

  _leave(c, satisfied) {
    this.engine.customerLeft(c.data.id, satisfied);
    const pts = [];
    if (c.y < ROAD_Y - 10) {
      if (c.y > AISLE_Y + 4) pts.push({ x: c.x, y: ROAD_Y });
      else pts.push({ x: c.x, y: AISLE_Y }, { x: DOOR_X, y: AISLE_Y }, { x: DOOR_X, y: ROAD_Y });
    }
    pts.push({ x: -24, y: ROAD_Y });
    this._pushWaypoints(c, pts, () => this._remove(c));
    c.leaving = true;
  }

  _remove(c) {
    this._clearBubble(c);
    c.tag?.destroy();
    c.sprite.destroy();
    this.customers = this.customers.filter((x) => x !== c);
  }

  _updateCustomer(c, dt) {
    if (c.state === 'walk') {
      let budget = WALK_SPEED * dt;
      while (budget > 0 && c.wp.length) {
        const p = c.wp[0];
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= budget) {
          c.x = p.x;
          c.y = p.y;
          c.wp.shift();
          budget -= dist;
        } else {
          c.x += (dx / dist) * budget;
          c.y += (dy / dist) * budget;
          budget = 0;
        }
        if (dx !== 0) c.sprite.setFlipX(dx < 0);
      }
      c.anim += dt;
      const f = Math.floor(c.anim / 0.16) % 2 === 0 ? 'walkA' : 'walkB';
      if (f !== c.frame) {
        c.frame = f;
        c.sprite.setTexture(customerTextureKey(c.data.type, c.hair, c.skin, f));
      }
      if (c.wp.length === 0) {
        c.frame = 'idle';
        c.sprite.setTexture(customerTextureKey(c.data.type, c.hair, c.skin, 'idle'));
        const next = c.then;
        c.then = null;
        next?.();
      }
    } else if (c.state === 'browse') {
      c.timer -= dt;
      if (c.timer <= 0) this._afterBrowse(c);
    } else if (c.state === 'paying') {
      c.timer -= dt;
      if (c.timer <= 0) {
        const total = this.engine.pay(c.data.id);
        if (total > 0) {
          this._popup(c.x, c.y - 50, '+' + rupiah(total), '#facc15');
          this.hooks.onSale?.(total);
        }
        this.queue = this.queue.filter((q) => q !== c);
        this._leave(c, true);
      }
    }
    c.sprite.setPosition(c.x, c.y);
    c.sprite.setDepth(c.y);
    c.tag?.setPosition(c.x, c.y - 72);
    if (c.bubble) {
      c.bubble.t.setPosition(c.x, c.y - 40);
      c.bubble.icon?.setPosition(c.x, c.y - 58);
    }
  }

  _updateQueue(dt) {
    this.queue.forEach((c, k) => {
      c.slot = k;
      if (c.state !== 'queued' && c.state !== 'paying') return;
      const tx = this._slotX(k);
      const dx = tx - c.x;
      if (Math.abs(dx) > 0.5) {
        const step = Math.min(Math.abs(dx), WALK_SPEED * dt) * Math.sign(dx);
        c.x += step;
        c.sprite.setFlipX(dx < 0);
      } else if (k === 0 && c.state === 'queued') {
        c.state = 'paying';
        c.timer = PAY_TIME * this.engine.mods().payTime;
      }
    });
  }

  // ---------- Efek ----------
  _popup(x, y, text, color) {
    const t = this.add.text(x, y, text, {
      fontFamily: 'monospace', fontSize: '12px', color, stroke: '#000', strokeThickness: 3, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10000);
    this.popups.push({ t, life: 1.1 });
  }

  _updatePopups(dt) {
    for (const p of this.popups.slice()) {
      p.life -= dt;
      p.t.y -= 22 * dt;
      p.t.setAlpha(Math.max(0, Math.min(1, p.life / 0.5)));
      if (p.life <= 0) {
        p.t.destroy();
        this.popups = this.popups.filter((x) => x !== p);
      }
    }
  }
}

export { getQuality };
