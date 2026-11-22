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
export const SLOT_COSTS = [0, 0, 0, 4000, 10000, 25000, 60000, 140000, 300000, 500000, 800000];
export const MAX_SLOTS = SLOT_COSTS.length;
export const START_SLOTS = 3;

// Habitat: tiap lahan (slot) berada di satu tempat di peta dan hanya cocok untuk kategori tertentu.
export const HABITATS = [
  { id: 'kolam', name: 'Kolam Ikan', one: 'Kolam', cats: ['ikan'], max: 4, cap: 8 },
  { id: 'kebun', name: 'Kebun Umpan', one: 'Petak', cats: ['perlengkapan'], max: 2, cap: 8 },
  { id: 'kandang', name: 'Kandang Satwa', one: 'Kandang', cats: ['burung', 'reptil', 'kecil'], max: 5, cap: 5 },
];
export const START_HABS = ['kebun', 'kolam', 'kolam'];
export const getHabitat = (id) => HABITATS.find((h) => h.id === id);
export const habitatOf = (itemId) => HABITATS.find((h) => h.cats.includes(getItem(itemId).cat));
export const slotsOfHab = (e, hab) => farmOf(e).habs.map((h, i) => (h === hab ? i : -1)).filter((i) => i >= 0);

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
  return 2 + (e.state.shopLevel >= 3 ? 1 : 0) + (e.state.stars >= 4 ? 1 : 0) + (e.state.skills.slot_pet || 0);
}

export function farmBuffs(e) {
  const b = { luck: 0, grow: 0, value: 0, patience: 0, tip: 0 };
  const pets = e.state.pets;
  const sk = e.state.skills;
  const petMul = 1 + 0.12 * (sk.pet_kuat || 0);
  for (const id of pets.equipped) {
    const p = pets.owned.find((x) => x.id === id);
    if (p) b[getPetKind(p.kind).buff] += petBuffValue(p) * petMul;
  }
  b.grow += 0.04 * (sk.tumbuh_cepat || 0);
  b.luck += 0.06 * (sk.mata_elang || 0);
  b.patience += 0.08 * (sk.sabar || 0);
  b.tip += 0.08 * (sk.tip_besar || 0);
  const ev = e.eventOf();
  b.tip += ev.tip || 0;
  b.patience += ev.patience || 0;
  if (e.state.staff.perawat) b.grow += 0.15;
  if (e.state.staff.badut) b.patience += 0.2;
  if (e.state.staff.penjaga) b.patience += 0.15;
  if (e.state.staff.kasir) b.tip += 0.05;
  return b;
}

export function growMs(e, itemId, feedId) {
  const it = getItem(itemId);
  const sec = GROW_SEC[it.tier - 1];
  const speed = (feedId ? getFeed(feedId).speed : 0) + farmBuffs(e).grow + (e.eventOf().grow || 0);
  return Math.max(15, Math.round(sec * (1 - Math.min(0.7, speed)))) * 1000;
}

export function bibitPrice(e, itemId, day = e.state.day) {
  const it = getItem(itemId);
  const cut = Math.min(0.75, e.mods().disc + 0.04 * (e.state.skills.bibit_murah || 0));
  return Math.max(10, Math.round(it.retail * BIBIT_RATE * e._factors(day)[itemId].wf * e.eventOf(day).wholesale * (1 - cut)));
}

export const feedPrice = (e, feedOrId) => {
  const f = typeof feedOrId === 'string' ? getFeed(feedOrId) : feedOrId;
  return Math.max(1, Math.round(f.price * (1 - 0.06 * (e.state.skills.pakan_hemat || 0))));
};

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
  const unit = feedPrice(e, f);
  debit(e.state.ledger, e.state.day, 'buy_stock', unit * n, `Beli ${n} ${f.name}`);
  const fe = farmOf(e).feeds;
  fe[feedId] = (fe[feedId] || 0) + n;
  return unit * n;
}

export function buySlot(e, hab = null) {
  const fm = farmOf(e);
  if (fm.slots.length >= MAX_SLOTS) throw new Error('Lahan sudah maksimum');
  const room = (h) => fm.habs.filter((x) => x === h.id).length < h.max;
  const h = hab ? getHabitat(hab) : HABITATS.find(room);
  if (!h) throw new Error('Habitat tidak dikenal');
  if (!room(h)) throw new Error(`${h.name} sudah penuh`);
  const cost = SLOT_COSTS[fm.slots.length];
  if (cost > 0) debit(e.state.ledger, e.state.day, 'upgrade', cost, `${h.one} baru di ${h.name}`);
  fm.slots.push(null);
  fm.habs.push(h.id);
  return cost;
}

export const slotQty = (s) => (s && s.qty) || 1;
export const slotCap = (e, slot) => getHabitat(farmOf(e).habs[slot]).cap;

export function plant(e, slot, itemId, feedId = null, qty = 1) {
  const fm = farmOf(e);
  if (!Number.isInteger(slot) || slot < 0 || slot >= fm.slots.length) throw new Error('Kolam tidak valid');
  if (fm.slots[slot]) throw new Error('Kolam masih terisi');
  getItem(itemId);
  if (!e.isUnlocked(itemId)) throw new Error('Spesies belum terbuka');
  if (habitatOf(itemId).id !== fm.habs[slot]) throw new Error(`${getItem(itemId).name} tidak cocok di ${getHabitat(fm.habs[slot]).name}`);
  if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah tidak valid');
  if (qty > slotCap(e, slot)) throw new Error(`Muat maksimal ${slotCap(e, slot)} sekaligus`);
  if (feedId) {
    getFeed(feedId);
    if ((fm.feeds[feedId] || 0) < qty) throw new Error('Pakan kurang, beli di Pasar');
  }
  if ((fm.bibit[itemId] || 0) < qty) throw new Error('Bibit kurang, beli di Pasar');
  const price = bibitPrice(e, itemId);
  fm.bibit[itemId] -= qty;
  if (fm.bibit[itemId] === 0) delete fm.bibit[itemId];
  if (feedId) {
    fm.feeds[feedId] -= qty;
    if (fm.feeds[feedId] === 0) delete fm.feeds[feedId];
  }
  const now = e.now();
  fm.slots[slot] = {
    itemId, feed: feedId, plantedAt: now, readyAt: now + growMs(e, itemId, feedId), qty,
    cost: price + (feedId ? feedPrice(e, feedId) : 0),
  };
  e.state.stats.planted = (e.state.stats.planted || 0) + qty;
  e.track('plant', qty);
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
  const feed = s.feed ? getFeed(s.feed) : null;
  const luck = (feed ? feed.luck : 0) + farmBuffs(e).luck * 10 + (e.eventOf().luck || 0);
  const out = [];
  let n = slotQty(s);
  // hewan bonus: Musim Subur (pasti) + skill Panen Berkah (peluang)
  const bonusRng = mulberry32(hashSeed(e.state.seed, 'bonus', fm.rolls));
  n += e.eventOf().bonus || 0;
  if (bonusRng() < 0.08 * (e.state.skills.panen_ganda || 0)) n += 1;
  for (let k = 0; k < n; k++) {
    const rng = mulberry32(hashSeed(e.state.seed, 'harvest', fm.rolls));
    fm.rolls += 1;
    const r = rollRarity(rng, luck);
    const size = rollSize(rng, feed ? feed.size : 0);
    const animal = { id: fm.nextAnimal++, itemId: s.itemId, rarity: RARITIES[r].id, size, cost: Math.round(s.cost) };
    fm.animals.push(animal);
    out.push(animal);
    const book = (fm.book[s.itemId] ||= {});
    const rec = book[animal.rarity] || { n: 0, best: 0 };
    rec.n += 1;
    rec.best = Math.max(rec.best, size);
    book[animal.rarity] = rec;
    e.state.stats.bred += 1;
    e.state.stats.bestRar = Math.max(e.state.stats.bestRar || 0, r);
  }
  fm.slots[slot] = null;
  e.track('harvest', n);
  return out;
}

export function harvestAll(e) {
  const out = [];
  fmSlots(e).forEach((s, i) => {
    if (s && e.now() >= s.readyAt) out.push(...harvest(e, i));
  });
  return out;
}
const fmSlots = (e) => farmOf(e).slots;

export const animalCount = (e, itemId) => farmOf(e).animals.filter((a) => a.itemId === itemId).length;

// Pelanggan: batas harga tiap tipe, kelipatan NILAI hewan itu (sudah termasuk rarity dan ukuran).
export const PAY_CAP = { biasa: 1.25, pelit: 1.1, vip: 1.6, kolektor: 2.5 };

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
  noteBookPet(pets, pet);
  e.state.stats.hatched = (e.state.stats.hatched || 0) + 1;
  return pet;
}

// Buku koleksi pet: mencatat semua pet yang pernah didapat, walau sudah dijual.
export function noteBookPet(pets, pet) {
  pets.book ||= {};
  const k = (pets.book[pet.kind] ||= {});
  k[pet.rarity] = (k[pet.rarity] || 0) + 1;
}

export const petSellValue = (p) => Math.round(EGGS[0].price * 0.25 * RARITIES[rarityIdx(p.rarity)].buff);

// Jual sekaligus semua pet di inventori yang tidak dipasang dan rarity-nya <= maxRarityIdx.
export function sellSpare(e, maxRarityIdx) {
  const pets = e.state.pets;
  const list = pets.owned.filter((p) => !pets.equipped.includes(p.id) && rarityIdx(p.rarity) <= maxRarityIdx);
  let total = 0;
  for (const p of list) total += releasePet(e, p.id);
  return { n: list.length, total };
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
  const refund = petSellValue(p);
  pets.owned = pets.owned.filter((x) => x.id !== petId);
  pets.equipped = pets.equipped.filter((x) => x !== petId);
  credit(e.state.ledger, e.state.day, 'reward', refund, `Jual pet ${getPetKind(p.kind).name}`);
  return refund;
}

export const newFarm = () => ({
  slots: Array.from({ length: START_SLOTS }, () => null),
  habs: [...START_HABS],
  animals: [], feeds: {}, bibit: {}, nextAnimal: 1, rolls: 0, book: {},
});
export const newPets = () => ({ owned: [], equipped: [], nextId: 1, rolls: 0, book: {} });

export { ITEMS };
