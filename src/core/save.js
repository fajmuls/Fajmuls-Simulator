import { auditLedger } from './ledger.js';
import { ITEMS, UPGRADES, QUALITIES, parseLotKey } from './catalog.js';
import { STATE_VERSION } from './engine.js';

const isInt = (v) => Number.isSafeInteger(v);

// Memeriksa bentuk dan isi data simpanan. Mengembalikan daftar masalah (kosong = valid).
export function validateState(s) {
  const p = [];
  if (!s || typeof s !== 'object') return ['Data bukan objek'];
  if (s.v !== STATE_VERSION) p.push(`Versi data tidak dikenal: ${s.v}`);
  if (!isInt(s.seed) || s.seed < 1) p.push('Benih tidak valid');
  if (!isInt(s.day) || s.day < 1) p.push('Hari tidak valid');
  if (s.phase !== 'idle') p.push('Hanya data saat toko tutup yang boleh dimuat');
  if (!isInt(s.reputation) || s.reputation < 0 || s.reputation > 100) p.push('Reputasi tidak valid');
  if (!isInt(s.arrears) || s.arrears < 0) p.push('Tunggakan tidak valid');

  const l = s.ledger;
  if (!l || typeof l !== 'object' || !Array.isArray(l.entries)) p.push('Buku kas rusak');
  else p.push(...auditLedger(l));

  if (!s.stock || typeof s.stock !== 'object') p.push('Stok rusak');
  else {
    for (const [key, lot] of Object.entries(s.stock)) {
      const { itemId, quality } = parseLotKey(key);
      if (!ITEMS.some((i) => i.id === itemId) || !QUALITIES.some((q) => q.id === quality)) p.push(`Kunci stok tidak dikenal: ${key}`);
      if (!isInt(lot?.qty) || lot.qty < 0 || !isInt(lot?.cost) || lot.cost < 0) p.push(`Stok ${key} tidak valid`);
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
  if (!Array.isArray(s.history)) p.push('Riwayat rusak');
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
    state = JSON.parse(wrapper.data);
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
