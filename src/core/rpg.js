// Petualangan (semi-RPG): pet yang dipasang menjadi party, menjelajah zona berlantai-lantai, melawan musuh
// dengan pilihan taktik, lalu membawa pulang bibit, pakan, uang, dan hewan langka. Murni logika (tanpa DOM)
// supaya mudah diuji. Statusnya disimpan di state.rpg dan dibuat saat pertama dipakai (tanpa migrasi).
import { credit } from './ledger.js';
import { mulberry32, hashSeed } from './rng.js';
import { getItem } from './catalog.js';
import {
  RARITIES, FEEDS, rarityIdx, rollRarity, rollSize, getFeed, feedOpen, stockFull, animalValue,
} from './farm.js';

export const PET_MAX_LV = 20;
export const xpNeed = (lv) => 20 + 10 * (lv - 1);

// base = kekuatan musuh lantai 1; naik 30% per lantai; bos di lantai terakhir x1.5.
// loot = bobot jenis hadiah. minRar = rarity minimum hewan hadiah (0 = common).
export const ZONES = [
  { id: 'hutan', name: 'Hutan Bibit', icon: '🌲', desc: 'Jelajah hutan: bibit dan pakan, sesekali hewan umpan.', floors: 4, base: 5, cat: 'perlengkapan', loot: { bibit: 5, pakan: 3, uang: 3, hewan: 1 }, minRar: 0, boss: 'Babi Hutan' },
  { id: 'danau', name: 'Danau Kristal', icon: '🎣', desc: 'Memancing ikan langka di perairan jernih.', floors: 4, base: 9, cat: 'ikan', loot: { bibit: 2, pakan: 2, uang: 2, hewan: 4 }, minRar: 1, boss: 'Ikan Raja' },
  { id: 'rawa', name: 'Rawa Reptil', icon: '🐊', desc: 'Rawa berlumpur dengan reptil buas.', floors: 5, base: 16, cat: 'reptil', loot: { bibit: 3, pakan: 2, uang: 2, hewan: 3 }, minRar: 2, boss: 'Buaya Lumpur' },
  { id: 'gua', name: 'Gua Berlian', icon: '💎', desc: 'Dungeon gelap penuh satwa kecil dan harta.', floors: 6, base: 26, cat: 'kecil', loot: { bibit: 2, pakan: 3, uang: 4, hewan: 3 }, minRar: 2, boss: 'Raja Kelelawar' },
  { id: 'menara', name: 'Menara Awan', icon: '☁️', desc: 'Menara tinggi tempat burung langka bersarang.', floors: 7, base: 42, cat: 'burung', loot: { bibit: 2, pakan: 3, uang: 3, hewan: 4 }, minRar: 3, boss: 'Elang Petir' },
];
export const getZone = (id) => {
  const z = ZONES.find((x) => x.id === id);
  if (!z) throw new Error('Zona tidak dikenal');
  return z;
};

export const maxEnergy = (e) => 4 + (e.state.stars || 1);

// Status petualangan. Energi pulih +2 per hari yang lewat (dihitung saat diakses).
export function rpgOf(e) {
  const s = e.state;
  s.rpg ||= { day: s.day, energy: 5, run: null, runs: 0, rolls: 0, clears: {}, last: null };
  const r = s.rpg;
  const d = s.day - r.day;
  if (d > 0) { r.energy = Math.min(maxEnergy(e), r.energy + 2 * d); r.day = s.day; }
  r.energy = Math.min(r.energy, maxEnergy(e));
  return r;
}

const attr = (e, k) => (e.state.attrs && e.state.attrs[k]) || 0;

export const petPower = (p) => Math.round(Math.pow(rarityIdx(p.rarity) + 1, 1.25) * 3 * (1 + 0.08 * ((p.lv || 1) - 1)) * 10) / 10;

export function partyPower(e) {
  const pets = e.state.pets;
  let sum = 0;
  for (const id of pets.equipped) {
    const p = pets.owned.find((x) => x.id === id);
    if (p) sum += petPower(p);
  }
  return Math.round(sum * (1 + 0.06 * attr(e, 'ketangkasan')) * 10) / 10;
}

export const enemyPower = (z, floor) => Math.round(z.base * (1 + 0.3 * (floor - 1)) * (floor === z.floors ? 1.5 : 1) * 10) / 10;

// Peluang menang: seimbang = 50%, dua kali lebih kuat = 75%. Hati-hati lebih rendah tapi luka lebih ringan.
export function winChance(P, E, action = 'serang') {
  const base = 0.5 + (P - E) / (2 * Math.max(P, E, 1));
  const c = action === 'hati' ? base - 0.12 : base;
  return Math.max(0.05, Math.min(0.95, c));
}

const pickW = (rng, arr, w) => {
  const total = arr.reduce((s, x) => s + w(x), 0);
  let r = rng() * total;
  for (const x of arr) { r -= w(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
};

const itemsFor = (e, z) => {
  const all = e.unlockedItems();
  const cat = all.filter((it) => it.cat === z.cat);
  return cat.length ? cat : all;
};

function makeLoot(e, z, floor, boss, kind, rng) {
  if (kind === 'uang') return { k: 'uang', n: Math.max(1, Math.round((250 + 220 * floor) * (boss ? 2 : 1) * (1 + z.base / 40))) };
  if (kind === 'bibit') {
    const it = pickW(rng, itemsFor(e, z), (x) => x.tier);
    return { k: 'bibit', id: it.id, n: 1 + (rng() < 0.4 ? 1 : 0) + (boss ? 1 : 0) };
  }
  if (kind === 'pakan') {
    const open = FEEDS.filter((f) => feedOpen(e, f));
    const f = pickW(rng, open, (x) => 1 + x.luck);
    return { k: 'pakan', id: f.id, n: 1 + (rng() < 0.5 ? 1 : 0) };
  }
  const it = pickW(rng, itemsFor(e, z), (x) => x.tier);
  const luck = 2 + 0.5 * attr(e, 'hoki') + 0.3 * floor;
  let ri = Math.max(z.minRar || 0, rollRarity(rng, luck));
  if (boss) ri = Math.min(RARITIES.length - 1, ri + 1);
  return { k: 'hewan', id: it.id, rar: RARITIES[ri].id, size: rollSize(rng, 0.4) };
}

function rollLoot(e, z, floor, boss, rng) {
  const kinds = Object.entries(z.loot).filter(([, w]) => w > 0);
  const n = boss ? 3 : 1 + (floor >= 3 ? 1 : 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = boss && i === 0 ? 'hewan' : pickW(rng, kinds, (x) => x[1])[0];
    out.push(makeLoot(e, z, floor, boss, kind, rng));
  }
  return out;
}

export function lootText(l) {
  if (l.k === 'uang') return `Rp ${l.n.toLocaleString('id-ID')}`;
  if (l.k === 'bibit') return `${l.n} bibit ${getItem(l.id).name}`;
  if (l.k === 'pakan') return `${l.n} ${getFeed(l.id).name}`;
  return `${RARITIES[rarityIdx(l.rar)].name} ${getItem(l.id).name}`;
}

// Memasukkan hadiah ke gudang, kas, dan pakan. Hewan hasil dijual 35% bila gudang penuh.
export function applyLoot(e, loot) {
  const fm = e.state.farm;
  let coins = 0;
  let converted = 0;
  for (const l of loot) {
    if (l.k === 'uang') {
      credit(e.state.ledger, e.state.day, 'reward', l.n, 'Hadiah petualangan');
      coins += l.n;
    } else if (l.k === 'bibit') {
      fm.bibit[l.id] = (fm.bibit[l.id] || 0) + l.n;
    } else if (l.k === 'pakan') {
      fm.feeds[l.id] = (fm.feeds[l.id] || 0) + l.n;
    } else {
      const animal = { id: fm.nextAnimal++, itemId: l.id, rarity: l.rar, size: l.size, cost: 0 };
      if (stockFull(e)) {
        const v = Math.max(1, Math.round(animalValue(animal) * 0.35));
        credit(e.state.ledger, e.state.day, 'reward', v, 'Hewan petualangan dijual (gudang penuh)');
        coins += v;
        converted += 1;
      } else {
        fm.animals.push(animal);
        const book = (fm.book[l.id] ||= {});
        const rec = book[l.rar] || { n: 0, best: 0 };
        rec.n += 1;
        rec.best = Math.max(rec.best, l.size);
        book[l.rar] = rec;
        e.state.stats.bestRar = Math.max(e.state.stats.bestRar || 0, rarityIdx(l.rar));
      }
    }
  }
  return { coins, converted };
}

// XP untuk pet yang dipasang; naik level menambah kekuatan petualangan (bukan buff toko).
export function grantXp(e, xp) {
  const pets = e.state.pets;
  const ups = [];
  for (const id of pets.equipped) {
    const p = pets.owned.find((x) => x.id === id);
    if (!p) continue;
    p.lv ||= 1;
    p.xp = (p.xp || 0) + xp;
    while (p.lv < PET_MAX_LV && p.xp >= xpNeed(p.lv)) { p.xp -= xpNeed(p.lv); p.lv += 1; ups.push({ id: p.id, lv: p.lv }); }
    if (p.lv >= PET_MAX_LV) p.xp = 0;
  }
  return ups;
}

export function startRun(e, zoneId) {
  const r = rpgOf(e);
  const z = getZone(zoneId);
  if (r.run) throw new Error('Petualangan masih berjalan');
  if (r.energy < 1) throw new Error('Energi habis. Pulih +2 tiap hari');
  if (partyPower(e) <= 0) throw new Error('Pasang minimal 1 pet di tab Inventori');
  r.energy -= 1;
  r.runs += 1;
  r.last = null;
  r.run = { zone: z.id, floor: 1, hp: 100, loot: [], log: [`Masuk ${z.name}`], won: 0 };
  return r.run;
}

function finish(e, reason) {
  const r = rpgOf(e);
  const run = r.run;
  const z = getZone(run.zone);
  const keep = reason === 'kalah' ? Math.ceil(run.loot.length / 2) : run.loot.length;
  const loot = run.loot.slice(0, keep);
  const got = applyLoot(e, loot);
  let bonus = 0;
  if (reason === 'clear') {
    bonus = Math.round((1500 * z.base) / 5);
    credit(e.state.ledger, e.state.day, 'reward', bonus, `Bonus tamat ${z.name}`);
  }
  const xp = Math.max(1, Math.round((4 + run.won * 3) * (reason === 'kalah' ? 0.5 : 1)));
  const ups = grantXp(e, xp);
  r.clears[z.id] = Math.max(r.clears[z.id] || 0, reason === 'clear' ? z.floors : run.won);
  r.last = { zone: z.id, reason, loot, lost: run.loot.length - keep, coins: got.coins + bonus, converted: got.converted, xp, ups: ups.length };
  r.run = null;
  return { over: true, summary: r.last };
}

// action: 'serang' | 'hati' | 'mundur'
export function step(e, action) {
  const r = rpgOf(e);
  const run = r.run;
  if (!run) throw new Error('Tidak ada petualangan yang berjalan');
  if (action === 'mundur') return finish(e, 'mundur');
  if (action !== 'serang' && action !== 'hati') throw new Error('Aksi tidak dikenal');
  const z = getZone(run.zone);
  const P = partyPower(e);
  const E = enemyPower(z, run.floor);
  const rng = mulberry32(hashSeed(e.state.seed, 'rpg', r.rolls));
  r.rolls += 1;
  const boss = run.floor === z.floors;
  if (rng() < winChance(P, E, action)) {
    run.won += 1;
    const items = rollLoot(e, z, run.floor, boss, rng);
    run.loot.push(...items);
    run.hp = Math.min(100, run.hp + 5);
    run.log.push(`Lantai ${run.floor}: ${boss ? z.boss : 'musuh'} kalah! ${items.map(lootText).join(', ')}`);
    if (boss) return finish(e, 'clear');
    run.floor += 1;
    return { win: true, over: false };
  }
  run.hp -= (action === 'hati' ? 15 : 30) + Math.round(rng() * 10);
  run.log.push(`Lantai ${run.floor}: kalah bertarung, HP berkurang`);
  if (run.log.length > 12) run.log.splice(0, run.log.length - 12);
  if (run.hp <= 0) return finish(e, 'kalah');
  return { win: false, over: false };
}
