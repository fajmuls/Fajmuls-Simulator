import {
  ITEMS, CUSTOMER_TYPES, UPGRADES, QUALITIES,
  BASE_CAPACITY, CAPACITY_PER_RAK, BASE_MAX_QUALITY, START_CASH, DAILY_RENT,
  getItem, getQuality, getUpgrade, lotKey, parseLotKey,
} from './catalog.js';
import { createLedger, credit, debit, sumByType } from './ledger.js';
import { mulberry32, hashSeed, pickWeighted } from './rng.js';

export const DAY_LENGTH_SEC = 60; // lama jendela pelanggan datang pada kecepatan 1x
export const STATE_VERSION = 1;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const roundTo = (v, step) => Math.max(step, Math.round(v / step) * step);

export function newState(seed = Date.now() % 2147483647) {
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  return {
    v: STATE_VERSION,
    seed: Math.abs(Math.floor(seed)) || 1,
    day: 1,
    phase: 'idle',
    ledger: createLedger(START_CASH),
    stock: {}, // "itemId:q" -> { qty, cost }  (cost = total modal stok itu, Rupiah bulat)
    prices: {}, // "itemId:q" -> harga jual per unit
    upgrades,
    reputation: 10,
    arrears: 0, // tunggakan sewa
    stats: { revenue: 0, customers: 0, bestDay: 0 },
    history: [], // ringkasan harian terakhir
  };
}

export class GameEngine {
  constructor(state = newState()) {
    this.state = state;
    this.reserved = new Map(); // customerId -> [{key, qty, cost, revenue}]
    this.plan = [];
    this.today = null;
    this._marketCache = new Map();
  }

  // Mengganti seluruh state (game baru / impor) tanpa membuat engine baru.
  replaceState(state) {
    this.state = state;
    this.reserved.clear();
    this.plan = [];
    this.today = null;
    this._marketCache.clear();
  }

  // ---------- Pasar ----------
  _factors(day) {
    if (this._marketCache.has(day)) return this._marketCache.get(day);
    const rng = mulberry32(hashSeed(this.state.seed, 'market', day));
    const f = {};
    for (const it of ITEMS) {
      f[it.id] = { wf: 0.88 + rng() * 0.24, rf: 0.88 + rng() * 0.24 };
    }
    this._marketCache.set(day, f);
    return f;
  }

  wholesalePrice(itemId, quality, day = this.state.day) {
    const it = getItem(itemId);
    const q = getQuality(quality);
    return Math.max(1, Math.round(it.wholesale * q.mult * this._factors(day)[itemId].wf));
  }

  retailRef(itemId, quality, day = this.state.day) {
    const it = getItem(itemId);
    const q = getQuality(quality);
    return Math.max(1, Math.round(it.retail * q.mult * this._factors(day)[itemId].rf));
  }

  suggestedPrice(itemId, quality) {
    // dibulatkan ke bawah ke kelipatan 50 agar harga awal masih terjangkau pembeli biasa
    return Math.max(50, Math.floor(this.retailRef(itemId, quality) / 50) * 50);
  }

  // ---------- Kapasitas, kunci, upgrade ----------
  capacity() {
    return BASE_CAPACITY + this.state.upgrades.rak * CAPACITY_PER_RAK;
  }

  usedCapacity() {
    let n = 0;
    for (const lot of Object.values(this.state.stock)) n += lot.qty;
    return n;
  }

  maxQuality() {
    return Math.min(QUALITIES.length, BASE_MAX_QUALITY + this.state.upgrades.supplier);
  }

  isUnlocked(itemId) {
    return this.state.upgrades.supplier >= getItem(itemId).needSupplier;
  }

  unlockedItems() {
    return ITEMS.filter((i) => this.isUnlocked(i.id));
  }

  upgradeCost(id) {
    const u = getUpgrade(id);
    const lvl = this.state.upgrades[id];
    return lvl >= u.costs.length ? null : u.costs[lvl];
  }

  buyUpgrade(id) {
    this._requireIdle();
    const cost = this.upgradeCost(id);
    if (cost === null) throw new Error('Upgrade sudah level maksimum');
    debit(this.state.ledger, this.state.day, 'upgrade', cost, `Upgrade ${getUpgrade(id).name}`);
    this.state.upgrades[id] += 1;
    return cost;
  }

  _requireIdle() {
    if (this.state.phase !== 'idle') throw new Error('Tutup toko dulu untuk melakukan ini');
  }

  // ---------- Belanja & harga ----------
  buyStock(itemId, quality, qty) {
    this._requireIdle();
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah harus bilangan bulat minimal 1');
    if (!this.isUnlocked(itemId)) throw new Error('Barang belum terbuka');
    if (quality < 1 || quality > this.maxQuality()) throw new Error('Kualitas belum tersedia di grosir');
    if (this.usedCapacity() + qty > this.capacity()) throw new Error('Kapasitas toko tidak cukup');
    const unit = this.wholesalePrice(itemId, quality);
    const total = unit * qty;
    debit(this.state.ledger, this.state.day, 'buy_stock', total, `Beli ${qty} ${getItem(itemId).name} (${getQuality(quality).name})`);
    const key = lotKey(itemId, quality);
    const lot = this.state.stock[key] || { qty: 0, cost: 0 };
    lot.qty += qty;
    lot.cost += total;
    this.state.stock[key] = lot;
    if (!this.state.prices[key]) this.state.prices[key] = this.suggestedPrice(itemId, quality);
    return total;
  }

  maxAffordable(itemId, quality) {
    const unit = this.wholesalePrice(itemId, quality);
    const byMoney = Math.floor(this.state.ledger.balance / unit);
    const bySpace = this.capacity() - this.usedCapacity();
    return Math.max(0, Math.min(byMoney, bySpace));
  }

  setPrice(itemId, quality, price) {
    this._requireIdle();
    if (!Number.isInteger(price) || price < 1) throw new Error('Harga harus bilangan bulat minimal 1');
    const ref = this.retailRef(itemId, quality);
    if (price > ref * 5) throw new Error('Harga terlalu tinggi');
    this.state.prices[lotKey(itemId, quality)] = price;
  }

  priceOf(itemId, quality) {
    return this.state.prices[lotKey(itemId, quality)] ?? this.suggestedPrice(itemId, quality);
  }

  stockLots() {
    return Object.entries(this.state.stock)
      .filter(([, l]) => l.qty > 0)
      .map(([key, l]) => ({ key, ...parseLotKey(key), qty: l.qty, cost: l.cost }));
  }

  // ---------- Hari berjalan ----------
  priceAttract() {
    let weighted = 0;
    let n = 0;
    for (const lot of this.stockLots()) {
      const ref = this.retailRef(lot.itemId, lot.quality);
      weighted += (this.priceOf(lot.itemId, lot.quality) / ref) * lot.qty;
      n += lot.qty;
    }
    if (n === 0) return 1;
    const r = weighted / n;
    return clamp(1 + (1 - r) * 0.8, 0.5, 1.4);
  }

  customerCount() {
    const s = this.state;
    const base = 8 + s.reputation * 0.15 + Math.min(s.day, 60) * 0.2;
    const deco = 1 + 0.12 * s.upgrades.dekorasi;
    return clamp(Math.round(base * deco * this.priceAttract()), 3, 40);
  }

  generatePlan() {
    const s = this.state;
    const rng = mulberry32(hashSeed(s.seed, 'plan', s.day));
    const n = this.customerCount();
    const items = this.unlockedItems().map((i) => ({ id: i.id, weight: i.demand }));
    const times = [];
    for (let i = 0; i < n; i++) times.push(rng() * DAY_LENGTH_SEC);
    times.sort((a, b) => a - b);
    return times.map((t, i) => {
      const type = pickWeighted(rng, CUSTOMER_TYPES);
      const wantCount = rng() < 0.35 ? 2 : 1;
      const pool = items.slice();
      const wants = [];
      for (let w = 0; w < wantCount && pool.length; w++) {
        const pick = pickWeighted(rng, pool);
        pool.splice(pool.findIndex((p) => p.id === pick.id), 1);
        wants.push({
          itemId: pick.id,
          qty: 1 + Math.floor(rng() * type.maxQty),
          noise: 0.95 + rng() * 0.3,
        });
      }
      return { id: `${s.day}-${i + 1}`, type: type.id, spawnAt: t, wants };
    });
  }

  startDay() {
    this._requireIdle();
    this.plan = this.generatePlan();
    this.reserved.clear();
    this.today = { revenue: 0, cogs: 0, customers: this.plan.length, served: 0, lost: 0, soldUnits: 0 };
    this.state.phase = 'open';
    return this.plan;
  }

  // Dipanggil saat toko ditutup lebih awal: pelanggan yang belum datang tidak dihitung.
  dropUnspawned(count) {
    if (this.state.phase !== 'open' || !this.today) return;
    this.today.customers = Math.max(0, this.today.customers - count);
  }

  _typeOf(customer) {
    return CUSTOMER_TYPES.find((t) => t.id === customer.type);
  }

  // Pelanggan melihat satu barang di rak. Stok langsung dipesan agar tidak terjual dua kali.
  browse(customer, wantIdx) {
    if (this.state.phase !== 'open') throw new Error('Toko belum buka');
    const want = customer.wants[wantIdx];
    const type = this._typeOf(customer);
    const lots = this.stockLots().filter((l) => l.itemId === want.itemId);
    if (lots.length === 0) return { ok: false, itemId: want.itemId, reason: 'habis' };

    const affordable = lots
      .filter((l) => l.quality >= type.minQuality)
      .map((l) => ({ ...l, price: this.priceOf(l.itemId, l.quality) }))
      .filter((l) => l.price <= Math.floor(this.retailRef(l.itemId, l.quality) * type.wtp * want.noise));
    if (affordable.length === 0) {
      const tooLow = lots.every((l) => l.quality < type.minQuality);
      return { ok: false, itemId: want.itemId, reason: tooLow ? 'kualitas' : 'mahal' };
    }
    affordable.sort(type.id === 'pelit' ? (a, b) => a.price - b.price : (a, b) => b.quality - a.quality);
    const pick = affordable[0];
    const qty = Math.min(want.qty, pick.qty);
    const lot = this.state.stock[pick.key];
    const costOut = qty === lot.qty ? lot.cost : Math.round((lot.cost * qty) / lot.qty);
    lot.qty -= qty;
    lot.cost -= costOut;
    if (lot.qty === 0) {
      lot.cost = 0;
    }
    const revenue = pick.price * qty;
    const list = this.reserved.get(customer.id) || [];
    list.push({ key: pick.key, qty, cost: costOut, revenue });
    this.reserved.set(customer.id, list);
    return { ok: true, itemId: pick.itemId, quality: pick.quality, qty, unitPrice: pick.price, total: revenue };
  }

  // Pelanggan membayar di kasir.
  pay(customerId) {
    const list = this.reserved.get(customerId);
    if (!list || list.length === 0) return 0;
    const total = list.reduce((s, r) => s + r.revenue, 0);
    const cogs = list.reduce((s, r) => s + r.cost, 0);
    const units = list.reduce((s, r) => s + r.qty, 0);
    credit(this.state.ledger, this.state.day, 'sale', total, `Penjualan pelanggan #${customerId}`);
    this.today.revenue += total;
    this.today.cogs += cogs;
    this.today.soldUnits += units;
    this.reserved.delete(customerId);
    return total;
  }

  customerLeft(customerId, satisfied) {
    if (satisfied) this.today.served += 1;
    else this.today.lost += 1;
  }

  endDay() {
    if (this.state.phase !== 'open') throw new Error('Toko belum buka');
    const s = this.state;
    const day = s.day;

    // Kembalikan pesanan yang belum dibayar (jaga integritas stok dan uang).
    for (const [id, list] of this.reserved) {
      for (const r of list) {
        const lot = s.stock[r.key] || { qty: 0, cost: 0 };
        lot.qty += r.qty;
        lot.cost += r.cost;
        s.stock[r.key] = lot;
      }
      this.today.lost += 1;
      this.reserved.delete(id);
    }

    // Bayar tunggakan lalu sewa harian.
    let arrearsPaid = 0;
    if (s.arrears > 0 && s.ledger.balance > 0) {
      arrearsPaid = Math.min(s.arrears, s.ledger.balance);
      debit(s.ledger, day, 'arrears', arrearsPaid, 'Bayar tunggakan sewa');
      s.arrears -= arrearsPaid;
    }
    const rentPaid = Math.min(DAILY_RENT, s.ledger.balance);
    if (rentPaid > 0) debit(s.ledger, day, 'rent', rentPaid, 'Sewa toko harian');
    s.arrears += DAILY_RENT - rentPaid;

    const t = this.today;
    const repDelta = Math.round(t.served * 0.4 - t.lost * 0.3);
    s.reputation = clamp(s.reputation + repDelta, 5, 100);
    s.stats.revenue += t.revenue;
    s.stats.customers += t.customers;
    s.stats.bestDay = Math.max(s.stats.bestDay, t.revenue);

    const byType = sumByType(s.ledger, day);
    const summary = {
      day,
      revenue: t.revenue,
      cogs: t.cogs,
      grossProfit: t.revenue - t.cogs,
      rent: DAILY_RENT,
      net: t.revenue - t.cogs - DAILY_RENT,
      customers: t.customers,
      served: t.served,
      lost: t.lost,
      soldUnits: t.soldUnits,
      repDelta,
      endCash: s.ledger.balance,
      arrears: s.arrears,
      cashFlow: byType,
    };
    s.history.push(summary);
    if (s.history.length > 30) s.history.shift();

    s.day += 1;
    s.phase = 'idle';
    this.plan = [];
    this.today = null;
    return summary;
  }

  canSave() {
    return this.state.phase === 'idle';
  }
}
