import { auditLedger } from './ledger.js';
import {
  ITEMS, UPGRADES, QUALITIES, SKILLS, POTIONS, STAFF, SHARES, PROPERTIES, SHOP_LEVELS, parseLotKey,
} from './catalog.js';
import { STATE_VERSION, migrate } from './engine.js';

const isInt = (v) => Number.isSafeInteger(v);
const nonNeg = (v) => isInt(v) && v >= 0;

// Memeriksa bentuk dan isi data simpanan. Mengembalikan daftar masalah (kosong = valid).
export function validateState(s) {
  const p = [];
  if (!s || typeof s !== 'object') return ['Data bukan objek'];
  if (s.v !== STATE_VERSION) p.push(`Versi data tidak dikenal: ${s.v}`);
  if (!isInt(s.seed) || s.seed < 1) p.push('Benih tidak valid');
  if (!isInt(s.day) || s.day < 1) p.push('Hari tidak valid');
  if (s.phase !== 'idle') p.push('Hanya data saat toko tutup yang boleh dimuat');
  if (!Number.isFinite(s.reputation) || s.reputation < 0 || s.reputation > 100) p.push('Reputasi tidak valid');
  if (!isInt(s.stars) || s.stars < 1 || s.stars > 5) p.push('Bintang tidak valid');
  if (!isInt(s.shopLevel) || s.shopLevel < 1 || s.shopLevel > SHOP_LEVELS.length) p.push('Level toko tidak valid');
  if (!nonNeg(s.arrears)) p.push('Tunggakan tidak valid');
  if (!nonNeg(s.nextId)) p.push('Penghitung id tidak valid');

  const l = s.ledger;
  if (!l || typeof l !== 'object' || !Array.isArray(l.entries)) p.push('Buku kas rusak');
  else p.push(...auditLedger(l));

  if (!s.stock || typeof s.stock !== 'object') p.push('Stok rusak');
  else {
    for (const [key, lot] of Object.entries(s.stock)) {
      const { itemId, quality } = parseLotKey(key);
      if (!ITEMS.some((i) => i.id === itemId) || !QUALITIES.some((q) => q.id === quality)) p.push(`Kunci stok tidak dikenal: ${key}`);
      if (!nonNeg(lot?.qty) || !nonNeg(lot?.cost)) p.push(`Stok ${key} tidak valid`);
    }
  }
  if (!s.prices || typeof s.prices !== 'object') p.push('Harga rusak');
  else {
    for (const [key, price] of Object.entries(s.prices)) {
      if (!isInt(price) || price < 1) p.push(`Harga ${key} tidak valid`);
    }
  }
  if (!s.upgrades || typeof s.upgrades !== 'object') p.push('Upgrade rusak');
  else {
    for (const u of UPGRADES) {
      const lv = s.upgrades[u.id];
      if (!isInt(lv) || lv < 0 || lv > u.costs.length) p.push(`Level upgrade ${u.id} tidak valid`);
    }
  }
  const checkMap = (obj, name, valid, max) => {
    if (!obj || typeof obj !== 'object') { p.push(`${name} rusak`); return; }
    for (const [k, v] of Object.entries(obj)) {
      if (!valid(k)) p.push(`${name}: ${k} tidak dikenal`);
      if (!nonNeg(v) || (max && v > max(k))) p.push(`${name}: nilai ${k} tidak valid`);
    }
  };
  checkMap(s.skills, 'Skill', (k) => SKILLS.some((x) => x.id === k), (k) => SKILLS.find((x) => x.id === k).max);
  checkMap(s.potions, 'Ramuan', (k) => POTIONS.some((x) => x.id === k));
  checkMap(s.buffs, 'Buff', (k) => POTIONS.some((x) => x.id === k));
  checkMap(s.properties, 'Properti', (k) => PROPERTIES.some((x) => x.id === k), (k) => PROPERTIES.find((x) => x.id === k).max);
  const cr = s.crew;
  if (!cr || typeof cr !== 'object' || !Array.isArray(cr.hired) || !cr.licenses || typeof cr.licenses !== 'object' || !cr.keeper || typeof cr.keeper.rules !== 'object') p.push('Karyawan rusak');
  else {
    if (!Number.isInteger(cr.bonusSlots) || cr.bonusSlots < 0) p.push('Slot karyawan rusak');
    const seen = {};
    for (const m of cr.hired) {
      const def = STAFF.find((x) => x.id === m?.type);
      if (!def) { p.push(`Karyawan ${m?.type} tidak dikenal`); continue; }
      if (!Number.isInteger(m.uid) || !Number.isInteger(m.lvl) || m.lvl < 1 || m.lvl > 5) p.push('Data karyawan rusak');
      seen[m.type] = (seen[m.type] || 0) + 1;
      if (seen[m.type] > def.max) p.push(`Terlalu banyak ${def.name}`);
    }
    for (const k of Object.keys(cr.licenses)) if (!STAFF.some((x) => x.id === k)) p.push(`Lisensi ${k} tidak dikenal`);
  }
  if (!s.species || typeof s.species !== 'object') p.push('Spesies rusak');
  else for (const k of Object.keys(s.species)) if (!ITEMS.some((x) => x.id === k)) p.push(`Spesies ${k} tidak dikenal`);
  if (!s.restock || typeof s.restock !== 'object') p.push('Aturan restok rusak');
  else {
    for (const [k, r] of Object.entries(s.restock)) {
      if (!ITEMS.some((x) => x.id === k) || !nonNeg(r?.target) || !isInt(r?.q) || r.q < 1 || r.q > QUALITIES.length) p.push(`Aturan restok ${k} tidak valid`);
    }
  }
  if (!s.autoPrice || typeof s.autoPrice.on !== 'boolean' || !Number.isFinite(s.autoPrice.pct)) p.push('Harga otomatis rusak');

  if (!Array.isArray(s.breeding)) p.push('Breeding rusak');
  else {
    for (const b of s.breeding) {
      if (!ITEMS.some((x) => x.id === b.itemId) || !nonNeg(b.pairCost) || !nonNeg(b.fee) || !isInt(b.ready) || !Array.isArray(b.offspring) || b.offspring.length < 1) p.push('Data breeding tidak valid');
    }
  }
  if (!Array.isArray(s.deposits)) p.push('Deposito rusak');
  else for (const d of s.deposits) if (!nonNeg(d.principal) || d.principal < 1 || !nonNeg(d.interest) || !isInt(d.matureDay)) p.push('Data deposito tidak valid');
  if (!s.shares || typeof s.shares !== 'object') p.push('Saham rusak');
  else {
    for (const [k, h] of Object.entries(s.shares)) {
      if (!SHARES.some((x) => x.id === k) || !nonNeg(h?.qty) || !nonNeg(h?.cost)) p.push(`Saham ${k} tidak valid`);
    }
  }
  if (!s.sharePrices || typeof s.sharePrices !== 'object') p.push('Harga saham rusak');
  else for (const sh of SHARES) if (!isInt(s.sharePrices[sh.id]?.price) || s.sharePrices[sh.id].price < 1) p.push(`Harga saham ${sh.id} tidak valid`);
  if (!Array.isArray(s.loans)) p.push('Pinjaman rusak');
  else for (const ln of s.loans) if (!nonNeg(ln.remaining) || ln.remaining < 1 || !nonNeg(ln.perDay) || !nonNeg(ln.daysLeft) || !nonNeg(ln.principal)) p.push('Data pinjaman tidak valid');
  if (!Array.isArray(s.history)) p.push('Riwayat rusak');
  const st = s.stats;
  if (!st || ![st.revenue, st.customers, st.bestDay, st.sold, st.bought, st.bred, st.questsDone].every(nonNeg)) p.push('Statistik rusak');
  const q = s.quests;
  if (!q || !isInt(q.dayId) || !isInt(q.weekId) || !Array.isArray(q.daily) || !Array.isArray(q.weekly)) p.push('Misi rusak');
  else {
    for (const x of [...q.daily, ...q.weekly]) {
      if (!x || typeof x.id !== 'string' || !isInt(x.goal) || x.goal < 1 || !nonNeg(x.prog) || typeof x.claimed !== 'boolean') { p.push('Misi rusak'); break; }
    }
  }
  if (!s.ach || typeof s.ach !== 'object') p.push('Pencapaian rusak');
  else for (const a of Object.values(s.ach)) if (!a || !isInt(a.day) || typeof a.claimed !== 'boolean') { p.push('Pencapaian rusak'); break; }
  if (!nonNeg(s.bonusPoints)) p.push('Poin bonus tidak valid');
  if (!s.regulars || typeof s.regulars !== 'object') p.push('Langganan rusak');
  else for (const r of Object.values(s.regulars)) if (!r || !nonNeg(r.bond) || !nonNeg(r.visits) || !nonNeg(r.last) || (r.claimed !== undefined && !nonNeg(r.claimed))) { p.push('Langganan rusak'); break; }
  if (!s.tutorial || !nonNeg(s.tutorial.step) || typeof s.tutorial.done !== 'boolean') p.push('Tutorial rusak');
  const f = s.farm;
  if (!f || !Array.isArray(f.slots) || !Array.isArray(f.animals) || !f.feeds || typeof f.feeds !== 'object' || !f.bibit || typeof f.bibit !== 'object' || !nonNeg(f.nextAnimal) || !nonNeg(f.rolls)) p.push('Peternakan rusak');
  else {
    for (const a of f.animals) if (!a || !isInt(a.id) || typeof a.itemId !== 'string' || typeof a.rarity !== 'string' || !(a.size > 0) || !nonNeg(a.cost)) { p.push('Hewan rusak'); break; }
    if (!Array.isArray(f.habs) || f.habs.length !== f.slots.length || f.habs.some((x) => typeof x !== 'string')) p.push('Habitat rusak');
    if (!Array.isArray(f.levels) || f.levels.length !== f.slots.length || f.levels.some((x) => !Number.isInteger(x) || x < 1 || x > 3)) p.push('Level lahan rusak');
    for (const lots of f.slots) {
      if (!Array.isArray(lots)) { p.push('Kolam rusak'); break; }
      if (lots.some((sl) => !sl || typeof sl.itemId !== 'string' || !nonNeg(sl.plantedAt) || !nonNeg(sl.readyAt) || (sl.qty !== undefined && (!Number.isInteger(sl.qty) || sl.qty < 1 || sl.qty > 12)))) { p.push('Kolam rusak'); break; }
    }
  }
  if (!s.story || !nonNeg(s.story.ch) || typeof s.story.done !== 'boolean') p.push('Cerita rusak');
  const pt = s.pets;
  if (!pt || !Array.isArray(pt.owned) || !Array.isArray(pt.equipped) || !nonNeg(pt.nextId) || !nonNeg(pt.rolls) || (pt.book !== undefined && (typeof pt.book !== 'object' || pt.book === null))) p.push('Pet rusak');
  return p;
}

// Checksum FNV-1a sederhana untuk mendeteksi data rusak.
export function checksum(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}

export function serialize(state) {
  if (state.phase !== 'idle') throw new Error('Simpan hanya bisa saat toko tutup');
  const data = JSON.stringify(state);
  return JSON.stringify({ game: 'fajmuls-simulator', format: 1, checksum: checksum(data), data });
}

export function deserialize(text) {
  let wrapper;
  try {
    wrapper = JSON.parse(text);
  } catch {
    throw new Error('Berkas simpanan bukan JSON yang valid');
  }
  if (!wrapper || wrapper.game !== 'fajmuls-simulator' || typeof wrapper.data !== 'string') {
    throw new Error('Berkas ini bukan simpanan Fajmuls Simulator');
  }
  if (checksum(wrapper.data) !== wrapper.checksum) throw new Error('Checksum tidak cocok, data rusak');
  let state;
  try {
    state = migrate(JSON.parse(wrapper.data));
  } catch {
    throw new Error('Isi simpanan rusak');
  }
  const problems = validateState(state);
  if (problems.length) throw new Error(`Simpanan tidak valid: ${problems[0]}`);
  return state;
}

// ---------- Penyimpanan ----------
export class MemoryAdapter {
  constructor() { this.m = new Map(); }
  async get(k) { return this.m.get(k) ?? null; }
  async set(k, v) { this.m.set(k, v); }
}

export class LocalStorageAdapter {
  async get(k) { return localStorage.getItem(`fajmuls:${k}`); }
  async set(k, v) { localStorage.setItem(`fajmuls:${k}`, v); }
}

export class IndexedDbAdapter {
  constructor() { this.dbPromise = null; }
  _db() {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('fajmuls-simulator', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('save');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }
  async get(k) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const r = db.transaction('save').objectStore('save').get(k);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }
  async set(k, v) {
    const db = await this._db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('save', 'readwrite');
      tx.objectStore('save').put(v, k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export function createAdapter() {
  if (typeof indexedDB !== 'undefined') return new IndexedDbAdapter();
  if (typeof localStorage !== 'undefined') return new LocalStorageAdapter();
  return new MemoryAdapter();
}

export class SaveManager {
  constructor(adapter = createAdapter()) {
    this.adapter = adapter;
  }

  // Simpan baru; simpanan lama dipindah menjadi cadangan hanya bila simpanan lama itu masih valid.
  async save(state) {
    const text = serialize(state);
    const prev = await this.adapter.get('main');
    if (prev) {
      try {
        deserialize(prev);
        await this.adapter.set('backup', prev);
      } catch {
        /* simpanan lama rusak, jangan timpa cadangan yang sehat */
      }
    }
    await this.adapter.set('main', text);
  }

  async load() {
    for (const slot of ['main', 'backup']) {
      const text = await this.adapter.get(slot);
      if (!text) continue;
      try {
        return { state: deserialize(text), slot };
      } catch {
        /* coba slot berikutnya */
      }
    }
    return null;
  }
}
