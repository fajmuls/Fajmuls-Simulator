// Peternakan: bibit ditanam di kolam/kandang, tumbuh dalam hitungan menit, lalu dipanen menjadi hewan
// dengan rarity dan ukuran acak. Pakan mahal menaikkan peluang rarity. Pet memberi buff.
import { credit, debit } from './ledger.js';
import { mulberry32, hashSeed } from './rng.js';
import { getItem, ITEMS } from './catalog.js';

// w = bobot peluang (persen), mult = pengali harga, buff = pengali kekuatan pet
export const RARITIES = [
  { id: 'common', name: 'Common', w: 62, mult: 1, buff: 1, color: '#9ca3af' },
  { id: 'uncommon', name: 'Uncommon', w: 24, mult: 1.5, buff: 1.5, color: '#4ade80' },
  { id: 'rare', name: 'Rare', w: 9, mult: 2.5, buff: 2.2, color: '#38bdf8' },
  { id: 'epic', name: 'Epic', w: 3.5, mult: 4.5, buff: 3.2, color: '#c084fc' },
  { id: 'legendary', name: 'Legendary', w: 1.2, mult: 9, buff: 4.5, color: '#fbbf24' },
  { id: 'mythic', name: 'Mythic', w: 0.25, mult: 22, buff: 6.5, color: '#f43f5e' },
  { id: 'secret', name: 'Secret', w: 0.05, mult: 70, buff: 10, color: '#22d3ee' },
];
export const rarityIdx = (id) => RARITIES.findIndex((r) => r.id === id);

// luck menggeser bobot ke rarity yang lebih tinggi; size = dorongan ukuran; speed = percepatan tumbuh
export const FEEDS = [
  { id: 'dedak', name: 'Pakan Dasar', price: 60, luck: 0.5, size: 0.1, speed: 0.05, color: '#a16207' },
  { id: 'bagus', name: 'Pakan Bagus', price: 250, luck: 1.3, size: 0.2, speed: 0.1, color: '#16a34a' },
  { id: 'premium', name: 'Pakan Premium', price: 1000, luck: 2.8, size: 0.35, speed: 0.15, color: '#2563eb' },
  { id: 'super', name: 'Pakan Super', price: 4500, luck: 5, size: 0.5, speed: 0.22, color: '#9333ea' },
  { id: 'dewa', name: 'Pakan Dewa', price: 20000, luck: 9, size: 0.7, speed: 0.3, color: '#f59e0b' },
];
export const getFeed = (id) => {
  const f = FEEDS.find((x) => x.id === id);
  if (!f) throw new Error('Pakan tidak dikenal');
  return f;
};

// detik tumbuh per tier (pada tanpa pakan)
export const GROW_SEC = [45, 70, 100, 140, 200];
export const BIBIT_RATE = 0.2; // harga bibit = 20% harga jual dasar
export const SLOT_COSTS = [0, 0, 0, 4000, 10000, 25000, 60000, 140000, 300000];
export const MAX_SLOTS = SLOT_COSTS.length;
export const START_SLOTS = 3;

// ukuran dasar (cm untuk ikan/burung/reptil, gram untuk satwa kecil dan umpan)
const SIZE_BASE = {
  cacing: [8, 'cm'], jangkrik: [3, 'cm'], pelet: [20, 'g'], voer: [50, 'g'],
  lele: [25, 'cm'], mas: [15, 'cm'], cupang: [6, 'cm'], koi: [40, 'cm'], arwana: [60, 'cm'],
  pipit: [11, 'cm'], perkutut: [22, 'cm'], kenari: [13, 'cm'], lovebird: [14, 'cm'], murai: [24, 'cm'],
  kura: [15, 'cm'], bunglon: [25, 'cm'], gecko: [20, 'cm'], ularjagung: [120, 'cm'], iguana: [90, 'cm'],
  hamster: [120, 'g'], kelinci: [1500, 'g'], marmut: [800, 'g'], landak: [450, 'g'], glider: [140, 'g'],
};
export function sizeLabel(itemId, size) {
  const [base, unit] = SIZE_BASE[itemId] || [10, 'cm'];
  const v = base * size;
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${unit}`;
}

// ---------- Pet ----------
export const PET_KINDS = [
  { id: 'hoki', name: 'Kucing Hoki', buff: 'luck', base: 0.12, text: (v) => `Peluang rarity +${Math.round(v * 100)}%` },
  { id: 'cepat', name: 'Kura Cepat', buff: 'grow', base: 0.04, text: (v) => `Tumbuh ${Math.round(v * 100)}% lebih cepat` },
  { id: 'dagang', name: 'Burung Hantu Dagang', buff: 'value', base: 0.02, text: (v) => `Harga jual +${Math.round(v * 100)}%` },
  { id: 'ramah', name: 'Kelinci Ramah', buff: 'patience', base: 0.05, text: (v) => `Pelanggan ${Math.round(v * 100)}% lebih sabar` },
  { id: 'setia', name: 'Anjing Setia', buff: 'tip', base: 0.03, text: (v) => `Tip pelayanan cepat +${Math.round(v * 100)}%` },
];
export const getPetKind = (id) => PET_KINDS.find((k) => k.id === id);
export const petBuffValue = (pet) => getPetKind(pet.kind).base * RARITIES[rarityIdx(pet.rarity)].buff;

export const EGGS = [
  { id: 'telur', name: 'Telur Biasa', price: 4000, luck: 0, color: '#fde68a' },
  { id: 'emas', name: 'Telur Emas', price: 18000, luck: 3, color: '#fbbf24' },
  { id: 'berlian', name: 'Telur Berlian', price: 70000, luck: 8, color: '#67e8f9' },
];
export const getEgg = (id) => {
  const e = EGGS.find((x) => x.id === id);
  if (!e) throw new Error('Telur tidak dikenal');
  return e;
};
export const PET_MAX = 60;

// ---------- Matematika murni ----------
export function rarityWeights(luck) {
  const ws = RARITIES.map((r, i) => (i === 0 ? r.w : r.w * (1 + luck * Math.pow(i, 1.3) * 0.5)));
  const total = ws.reduce((a, b) => a + b, 0);
  return ws.map((w) => w / total);
}

export function rollRarity(rng, luck) {
  const ws = rarityWeights(luck);
  let r = rng();
  for (let i = 0; i < ws.length; i++) {
    r -= ws[i];
    if (r <= 0) return i;
  }
  return 0;
}

export function rollSize(rng, boost) {
  const u = rng();
  const r = Math.pow(u, 1 / (1 + boost * 4));
  return Math.round((0.7 + 0.7 * r) * 100) / 100;
}

export const sizeMult = (size) => Math.pow(size, 1.5);
export const animalValue = (a) => Math.max(1, Math.round(getItem(a.itemId).retail * RARITIES[rarityIdx(a.rarity)].mult * sizeMult(a.size)));
export const expectedMult = (luck) => rarityWeights(luck).reduce((s, w, i) => s + w * RARITIES[i].mult, 0);

// ---------- Operasi pada engine ----------
export const farmOf = (e) => e.state.farm;

export function slotCount(e) {
  return farmOf(e).slots.length;
}

export function petSlots(e) {
  return 2 + (e.state.shopLevel >= 3 ? 1 : 0) + (e.state.stars >= 4 ? 1 : 0);
}

export function farmBuffs(e) {
  const b = { luck: 0, grow: 0, value: 0, patience: 0, tip: 0 };
  const pets = e.state.pets;
  for (const id of pets.equipped) {
    const p = pets.owned.find((x) => x.id === id);
    if (p) b[getPetKind(p.kind).buff] += petBuffValue(p);
  }
  if (e.state.staff.perawat) b.grow += 0.15;
  if (e.state.staff.badut) b.patience += 0.2;
  if (e.state.staff.penjaga) b.patience += 0.15;
  if (e.state.staff.kasir) b.tip += 0.05;
  return b;
}

export function growMs(e, itemId, feedId) {
  const it = getItem(itemId);
  const sec = GROW_SEC[it.tier - 1];
  const speed = (feedId ? getFeed(feedId).speed : 0) + farmBuffs(e).grow;
  return Math.max(15, Math.round(sec * (1 - Math.min(0.7, speed)))) * 1000;
}

export function bibitPrice(e, itemId, day = e.state.day) {
  const it = getItem(itemId);
  return Math.max(10, Math.round(it.retail * BIBIT_RATE * e._factors(day)[itemId].wf * (1 - e.mods().disc)));
}

export function buyBibit(e, itemId, n) {
  if (!Number.isInteger(n) || n < 1) throw new Error('Jumlah tidak valid');
  if (!e.isUnlocked(itemId)) throw new Error('Spesies belum terbuka');
  const price = bibitPrice(e, itemId);
  debit(e.state.ledger, e.state.day, 'buy_stock', price * n, `Beli ${n} bibit ${getItem(itemId).name}`);
  const b = farmOf(e).bibit;
  b[itemId] = (b[itemId] || 0) + n;
  e.state.stats.bought += n;
  e.track('buy_units', n);
  return price * n;
}

export function buyFeed(e, feedId, n) {
  const f = getFeed(feedId);
  if (!Number.isInteger(n) || n < 1) throw new Error('Jumlah tidak valid');
  debit(e.state.ledger, e.state.day, 'buy_stock', f.price * n, `Beli ${n} ${f.name}`);
  const fe = farmOf(e).feeds;
  fe[feedId] = (fe[feedId] || 0) + n;
  return f.price * n;
}

export function buySlot(e) {
  const fm = farmOf(e);
  if (fm.slots.length >= MAX_SLOTS) throw new Error('Kolam sudah maksimum');
  const cost = SLOT_COSTS[fm.slots.length];
  if (cost > 0) debit(e.state.ledger, e.state.day, 'upgrade', cost, `Kolam/kandang ke-${fm.slots.length + 1}`);
  fm.slots.push(null);
  return cost;
}

export function plant(e, slot, itemId, feedId = null) {
  const fm = farmOf(e);
  if (!Number.isInteger(slot) || slot < 0 || slot >= fm.slots.length) throw new Error('Kolam tidak valid');
  if (fm.slots[slot]) throw new Error('Kolam masih terisi');
  getItem(itemId);
  if (!e.isUnlocked(itemId)) throw new Error('Spesies belum terbuka');
  if (feedId) {
    getFeed(feedId);
    if ((fm.feeds[feedId] || 0) < 1) throw new Error('Pakan habis, beli di Pasar');
  }
  if ((fm.bibit[itemId] || 0) < 1) throw new Error('Bibit habis, beli di Pasar');
  const price = bibitPrice(e, itemId);
  fm.bibit[itemId] -= 1;
  if (fm.bibit[itemId] === 0) delete fm.bibit[itemId];
  if (feedId) {
    fm.feeds[feedId] -= 1;
    if (fm.feeds[feedId] === 0) delete fm.feeds[feedId];
  }
  const now = e.now();
  fm.slots[slot] = {
    itemId, feed: feedId, plantedAt: now, readyAt: now + growMs(e, itemId, feedId),
    cost: price + (feedId ? getFeed(feedId).price : 0),
  };
  return fm.slots[slot];
}

export function slotProgress(e, slot) {
  const s = farmOf(e).slots[slot];
  if (!s) return null;
  const total = s.readyAt - s.plantedAt;
  const done = Math.min(total, Math.max(0, e.now() - s.plantedAt));
  return { pct: total > 0 ? done / total : 1, remainMs: Math.max(0, s.readyAt - e.now()), ready: e.now() >= s.readyAt };
}

export function harvest(e, slot) {
  const fm = farmOf(e);
  const s = fm.slots[slot];
  if (!s) throw new Error('Kolam kosong');
  if (e.now() < s.readyAt) throw new Error('Belum waktunya panen');
  const rng = mulberry32(hashSeed(e.state.seed, 'harvest', fm.rolls));
  fm.rolls += 1;
  const feed = s.feed ? getFeed(s.feed) : null;
  const luck = (feed ? feed.luck : 0) + farmBuffs(e).luck * 10;
  const r = rollRarity(rng, luck);
  const size = rollSize(rng, feed ? feed.size : 0);
  const animal = { id: fm.nextAnimal++, itemId: s.itemId, rarity: RARITIES[r].id, size, cost: s.cost };
  fm.animals.push(animal);
  fm.slots[slot] = null;
  const book = (fm.book[s.itemId] ||= {});
  const rec = book[animal.rarity] || { n: 0, best: 0 };
  rec.n += 1;
  rec.best = Math.max(rec.best, size);
  book[animal.rarity] = rec;
  e.state.stats.bred += 1;
  e.track('breed', 1);
  return animal;
}

export function harvestAll(e) {
  const out = [];
  fmSlots(e).forEach((s, i) => {
    if (s && e.now() >= s.readyAt) out.push(harvest(e, i));
  });
  return out;
}
const fmSlots = (e) => farmOf(e).slots;

export const animalCount = (e, itemId) => farmOf(e).animals.filter((a) => a.itemId === itemId).length;

// Pelanggan: batas harga tiap tipe (kelipatan harga dasar). Kolektor membayar penuh.
export const PAY_CAP = { biasa: 2, pelit: 1.3, vip: 4, kolektor: 1e9 };

// Pengepul membeli hewan yang tidak terjual dengan harga murah.
export const DEALER_RATE = 0.35;
export function dealerSell(e, animalId) {
  const fm = farmOf(e);
  const i = fm.animals.findIndex((a) => a.id === animalId);
  if (i < 0) throw new Error('Hewan tidak ada');
  const price = Math.max(1, Math.round(animalValue(fm.animals[i]) * DEALER_RATE));
  fm.animals.splice(i, 1);
  credit(e.state.ledger, e.state.day, 'sale', price, 'Jual ke pengepul');
  return price;
}

// ---------- Pet ----------
export function hatch(e, eggId) {
  const egg = getEgg(eggId);
  const pets = e.state.pets;
  if (pets.owned.length >= PET_MAX) throw new Error('Kandang pet penuh');
  debit(e.state.ledger, e.state.day, 'buy_stock', egg.price, `Beli ${egg.name}`);
  const rng = mulberry32(hashSeed(e.state.seed, 'pet', pets.rolls));
  pets.rolls += 1;
  const r = rollRarity(rng, egg.luck);
  const kind = PET_KINDS[Math.floor(rng() * PET_KINDS.length)];
  const pet = { id: pets.nextId++, kind: kind.id, rarity: RARITIES[r].id };
  pets.owned.push(pet);
  return pet;
}

export function equipPet(e, petId) {
  const pets = e.state.pets;
  if (!pets.owned.some((p) => p.id === petId)) throw new Error('Pet tidak ada');
  if (pets.equipped.includes(petId)) return;
  if (pets.equipped.length >= petSlots(e)) throw new Error('Slot pet penuh, lepas satu dulu');
  pets.equipped.push(petId);
}

export function unequipPet(e, petId) {
  const pets = e.state.pets;
  pets.equipped = pets.equipped.filter((x) => x !== petId);
}

// Menjual (melepas) pet: uang kembali sebagian dari harga telur terendah dikali rarity.
export function releasePet(e, petId) {
  const pets = e.state.pets;
  const p = pets.owned.find((x) => x.id === petId);
  if (!p) throw new Error('Pet tidak ada');
  const refund = Math.round(EGGS[0].price * 0.25 * RARITIES[rarityIdx(p.rarity)].buff);
  pets.owned = pets.owned.filter((x) => x.id !== petId);
  pets.equipped = pets.equipped.filter((x) => x !== petId);
  credit(e.state.ledger, e.state.day, 'reward', refund, `Melepas pet ${getPetKind(p.kind).name}`);
  return refund;
}

export const newFarm = () => ({
  slots: Array.from({ length: START_SLOTS }, () => null),
  animals: [], feeds: {}, bibit: {}, nextAnimal: 1, rolls: 0, book: {},
});
export const newPets = () => ({ owned: [], equipped: [], nextId: 1, rolls: 0 });

export { ITEMS };
