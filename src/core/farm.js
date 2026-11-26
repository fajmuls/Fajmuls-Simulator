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
// hab (opsional) = pakan khusus yang hanya cocok untuk satu jenis tempat.
export const FEEDS = [
  { id: 'dedak', name: 'Pakan Dasar', price: 60, luck: 0.5, size: 0.1, speed: 0.05, color: '#a16207', needShop: 1 },
  { id: 'bagus', name: 'Pakan Bagus', price: 250, luck: 1.3, size: 0.2, speed: 0.1, color: '#16a34a', needShop: 2 },
  { id: 'premium', name: 'Pakan Premium', price: 1000, luck: 2.8, size: 0.35, speed: 0.15, color: '#2563eb', needShop: 3 },
  { id: 'super', name: 'Pakan Super', price: 4500, luck: 5, size: 0.5, speed: 0.22, color: '#9333ea', needShop: 4 },
  { id: 'dewa', name: 'Pakan Dewa', price: 20000, luck: 9, size: 0.7, speed: 0.3, color: '#f59e0b', needShop: 5 },
  { id: 'plankton', name: 'Plankton Kaya', price: 420, luck: 1.8, size: 0.25, speed: 0.12, color: '#0ea5e9', needShop: 2, hab: 'kolam' },
  { id: 'sayur', name: 'Sayur Segar', price: 420, luck: 1.8, size: 0.25, speed: 0.12, color: '#22c55e', needShop: 2, hab: 'kecil' },
  { id: 'biji', name: 'Biji Pilihan', price: 420, luck: 1.8, size: 0.25, speed: 0.12, color: '#ca8a04', needShop: 2, hab: 'burung' },
  { id: 'serangga', name: 'Serangga Hidup', price: 420, luck: 1.8, size: 0.25, speed: 0.12, color: '#65a30d', needShop: 2, hab: 'reptil' },
];
// Pakan mahal dibuka bertahap menurut level toko, jadi pakan murah tetap terpakai di awal.
export const feedOpen = (e, f) => (e.state.shopLevel || 1) >= f.needShop;
export const getFeed = (id) => {
  const f = FEEDS.find((x) => x.id === id);
  if (!f) throw new Error('Pakan tidak dikenal');
  return f;
};
// Pakan umum cocok di mana saja; pakan khusus hanya di jenis tempatnya.
export const feedFits = (f, habId) => !f.hab || f.hab === habId;

// detik tumbuh per tier (pada tanpa pakan)
export const GROW_SEC = [45, 70, 100, 140, 200];
export const BIBIT_RATE = 0.55; // harga bibit = 55% harga jual dasar
// Harga lahan ke-n (n = jumlah lahan saat membeli). Total 10 lahan: 5 jenis tempat x 2.
export const SLOT_COSTS = [0, 0, 0, 6000, 15000, 38000, 90000, 210000, 450000, 750000];
export const MAX_SLOTS = SLOT_COSTS.length;
export const START_SLOTS = 3;

// Habitat: tiap lahan (slot) berada di satu tempat di peta dan hanya cocok untuk kategori tertentu.
// zone = tampilan dan area di peta (kolam | kebun | kandang). Tiap jenis maksimal 2 tempat.
export const HABITATS = [
  { id: 'kolam', name: 'Kolam Ikan', one: 'Kolam', cats: ['ikan'], max: 2, cap: 8, zone: 'kolam' },
  { id: 'kebun', name: 'Kebun Umpan', one: 'Petak', cats: ['perlengkapan'], max: 2, cap: 8, zone: 'kebun' },
  { id: 'kecil', name: 'Kandang Hewan Kecil', one: 'Kandang', cats: ['kecil'], max: 2, cap: 8, zone: 'kandang' },
  { id: 'burung', name: 'Kandang Burung', one: 'Sangkar', cats: ['burung'], max: 2, cap: 8, zone: 'kandang' },
  { id: 'reptil', name: 'Kandang Reptil', one: 'Terarium', cats: ['reptil'], max: 2, cap: 8, zone: 'kandang' },
];
export const START_HABS = ['kebun', 'kolam', 'kolam'];
// Tiap lahan punya level 1 sampai 15: makin tinggi makin banyak ekor yang muat (Lv 15 = 30 ekor).
export const HAB_LEVEL_CAPS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
const UPGRADE_BASE = [10000, 40000, 80000, 150000, 280000, 500000, 850000, 1400000, 2300000, 3700000, 5800000, 9000000, 14000000, 21000000];
const UPGRADE_FACTOR = { kolam: 1, kebun: 0.6, kecil: 1.4, burung: 1.4, reptil: 1.4 };
const upgradeCosts = (f) => UPGRADE_BASE.map((c) => Math.round((c * f) / 100) * 100);
export const SPOT_UPGRADE_COSTS = Object.fromEntries(Object.entries(UPGRADE_FACTOR).map(([k, f]) => [k, upgradeCosts(f)]));
export const MAX_SPOT_LEVEL = HAB_LEVEL_CAPS.length;
export const getHabitat = (id) => HABITATS.find((h) => h.id === id);
export const habZone = (id) => (getHabitat(id) || {}).zone || 'kandang';
export const habitatOf = (itemId) => HABITATS.find((h) => h.cats.includes(getItem(itemId).cat));
export const slotsOfHab = (e, hab) => farmOf(e).habs.map((h, i) => (h === hab ? i : -1)).filter((i) => i >= 0);

// ---------- Migrasi ke v13: 5 jenis tempat, masing-masing maksimal 2 ----------
// Data lama: kandang (max 5) berisi burung/reptil/hewan kecil; kolam bisa sampai 4.
const OLD_SLOT_COSTS = [0, 0, 0, 6000, 15000, 38000, 90000, 210000, 450000, 750000, 1200000];
const OLD_UPGRADES = { kolam: [10000, 40000], kebun: [6000, 25000], kandang: [15000, 55000] };
const KANDANG_TYPES = ['kecil', 'burung', 'reptil'];

export function migrateFarmV13(state) {
  const fm = state.farm;
  if (!fm || fm.habsV13) return { refund: 0, removed: 0 };
  const habs = []; const slots = []; const levels = [];
  const counts = {};
  let refund = 0; let removed = 0;
  fm.habs.forEach((oldHab, i) => {
    const lots = fm.slots[i] || [];
    const lv = fm.levels[i] || 1;
    let h = oldHab;
    if (oldHab === 'kandang') {
      const votes = {};
      for (const l of lots) {
        let cat = null;
        try { cat = getItem(l.itemId).cat; } catch (err) { cat = null; }
        if (KANDANG_TYPES.includes(cat)) votes[cat] = (votes[cat] || 0) + (l.qty || 1);
      }
      const prefer = Object.keys(votes).sort((a, b) => votes[b] - votes[a]);
      h = [...prefer, ...KANDANG_TYPES].find((t) => (counts[t] || 0) < 2) || null;
    }
    if (!h || (counts[h] || 0) >= 2) {
      // Lahan berlebih dihapus: uang pembelian dan upgrade dikembalikan, isinya jadi bibit/pakan.
      let paid = OLD_SLOT_COSTS[i] || 0;
      for (let k = 0; k < lv - 1; k++) paid += (OLD_UPGRADES[oldHab] || [])[k] || 0;
      refund += paid;
      removed += 1;
      for (const l of lots) {
        const q = l.qty || 1;
        fm.bibit[l.itemId] = (fm.bibit[l.itemId] || 0) + q;
        if (l.feed) fm.feeds[l.feed] = (fm.feeds[l.feed] || 0) + q;
      }
      return;
    }
    counts[h] = (counts[h] || 0) + 1;
    habs.push(h); slots.push(lots); levels.push(Math.min(lv, MAX_SPOT_LEVEL));
  });
  fm.habs = habs; fm.slots = slots; fm.levels = levels;
  fm.habsV13 = true;
  if (refund > 0) credit(state.ledger, state.day, 'reward', refund, 'Pengembalian lahan lama (tiap jenis 2 tempat)');
  return { refund, removed };
}

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
export const PET_EXPAND = 20; // slot inventori per perluasan
export const PET_EXPAND_MAX = 10;
export const petMax = (e) => PET_MAX + PET_EXPAND * ((e.state.pets.extra || 0) + (e.state.skills.kandang_pet || 0));
export const petExpandCost = (e) => Math.round(20000 * Math.pow(1.8, e.state.pets.extra || 0));
export function buyPetSpace(e) {
  const n = e.state.pets.extra || 0;
  if (n >= PET_EXPAND_MAX) throw new Error('Kandang pet sudah maksimal');
  const cost = petExpandCost(e);
  debit(e.state.ledger, e.state.day, 'upgrade', cost, 'Perluas kandang pet');
  e.state.pets.extra = n + 1;
  return cost;
}

// ---------- Aturan jual dan pet ----------
export const SELL_MODES = [
  { id: 'normal', name: 'Normal', desc: 'Dijual ke pelanggan dengan harga biasa' },
  { id: 'obral', name: 'Obral', desc: 'Dijual ke pelanggan lebih murah, kasir menjualnya duluan' },
  { id: 'pengepul', name: 'Langsung ke pengepul', desc: 'Begitu panen langsung dijual murah (35%) agar gudang tidak penuh' },
  { id: 'tahan', name: 'Tahan', desc: 'Kasir tidak menjual; disimpan untuk koleksi atau pesanan khusus' },
];
export const newPolicy = () => ({ sell: {}, obralPct: 0.25, petAuto: {}, petConfirm: 3 });
export const sellMode = (e, rarity) => (e.state.policy && e.state.policy.sell[rarity]) || 'normal';

// Kapasitas gudang hewan: kecil di awal, naik bertahap.
export const animalCap = (e) => 20 + 40 * ((e.state.shopLevel || 1) - 1) + 30 * (e.state.upgrades.rak || 0) + 10 * (e.state.skills.gudang || 0) + 20 * ((e.state.prestige?.spent?.pgudang) || 0);
export const stockFull = (e) => farmOf(e).animals.length >= animalCap(e);

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
  const petMul = 1 + 0.2 * (sk.pet_kuat || 0);
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
  b.grow += e.crewBuff('grow');
  b.patience += e.crewBuff('patience');
  b.luck += e.crewBuff('luck');
  b.luck += 0.02 * ((e.state.attrs && e.state.attrs.hoki) || 0);
  b.tip += e.crewBuff('tip');
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
  if (!feedOpen(e, f)) throw new Error(`${f.name} dibuka di Toko Lv ${f.needShop}`);
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
  fm.slots.push([]);
  fm.habs.push(h.id);
  fm.levels.push(1);
  return cost;
}

export const slotQty = (lot) => (lot && lot.qty) || 1; // jumlah ekor satu penghuni
export const spotLevel = (e, i) => farmOf(e).levels[i] || 1;
export const slotCap = (e, i) => HAB_LEVEL_CAPS[spotLevel(e, i) - 1];
export const spotLots = (e, i) => farmOf(e).slots[i] || [];
export const spotUsed = (e, i) => spotLots(e, i).reduce((n, l) => n + slotQty(l), 0);
export const spotFree = (e, i) => Math.max(0, slotCap(e, i) - spotUsed(e, i));
export const spotUpgradeCost = (e, i) => {
  const lv = spotLevel(e, i);
  if (lv >= MAX_SPOT_LEVEL) return null;
  return SPOT_UPGRADE_COSTS[farmOf(e).habs[i]][lv - 1];
};

export function upgradeSpot(e, i) {
  const fm = farmOf(e);
  if (!Number.isInteger(i) || i < 0 || i >= fm.slots.length) throw new Error('Lahan tidak valid');
  const cost = spotUpgradeCost(e, i);
  if (cost === null) throw new Error('Level lahan sudah maksimum');
  const h = getHabitat(fm.habs[i]);
  debit(e.state.ledger, e.state.day, 'upgrade', cost, `Upgrade ${h.one} jadi Lv ${spotLevel(e, i) + 1}`);
  fm.levels[i] = spotLevel(e, i) + 1;
  return cost;
}

export function plant(e, slot, itemId, feedId = null, qty = 1) {
  const fm = farmOf(e);
  if (!Number.isInteger(slot) || slot < 0 || slot >= fm.slots.length) throw new Error('Lahan tidak valid');
  getItem(itemId);
  if (!e.isUnlocked(itemId)) throw new Error('Spesies belum terbuka');
  if (habitatOf(itemId).id !== fm.habs[slot]) throw new Error(`${getItem(itemId).name} tidak cocok di ${getHabitat(fm.habs[slot]).name}`);
  if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah tidak valid');
  if (spotFree(e, slot) === 0) throw new Error('Lahan penuh, upgrade atau panen dulu');
  if (qty > spotFree(e, slot)) throw new Error(`Sisa tempat ${spotFree(e, slot)} ekor`);
  if (feedId) {
    const f = getFeed(feedId);
    if (!feedFits(f, fm.habs[slot])) throw new Error(`${f.name} tidak cocok di ${getHabitat(fm.habs[slot]).name}`);
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
  const lot = {
    itemId, feed: feedId, plantedAt: now, readyAt: now + growMs(e, itemId, feedId), qty,
    cost: price + (feedId ? feedPrice(e, feedId) : 0),
  };
  (fm.slots[slot] ||= []).push(lot);
  e.state.stats.planted = (e.state.stats.planted || 0) + qty;
  e.track('plant', qty);
  return lot;
}

export function slotProgress(e, slot, k = 0) {
  const s = spotLots(e, slot)[k];
  if (!s) return null;
  const total = s.readyAt - s.plantedAt;
  const done = Math.min(total, Math.max(0, e.now() - s.plantedAt));
  return { pct: total > 0 ? done / total : 1, remainMs: Math.max(0, s.readyAt - e.now()), ready: e.now() >= s.readyAt };
}

export function harvest(e, slot, k = 0) {
  const fm = farmOf(e);
  const s = (fm.slots[slot] || [])[k];
  if (!s) throw new Error('Penghuni tidak ada');
  if (e.now() < s.readyAt) throw new Error('Belum waktunya panen');
  if (stockFull(e)) throw new Error('Gudang hewan penuh. Jual atau lepas hewan dulu.');
  const feed = s.feed ? getFeed(s.feed) : null;
  const luck = (feed ? feed.luck : 0) + farmBuffs(e).luck * 10 + (e.eventOf().luck || 0);
  const out = [];
  let n = slotQty(s);
  // hewan bonus: Musim Subur (pasti) + skill Panen Berkah (peluang)
  const bonusRng = mulberry32(hashSeed(e.state.seed, 'bonus', fm.rolls));
  n += e.eventOf().bonus || 0;
  if (bonusRng() < 0.08 * (e.state.skills.panen_ganda || 0) + e.crewBuff('harvest')) n += 1;
  for (let k = 0; k < n; k++) {
    const rng = mulberry32(hashSeed(e.state.seed, 'harvest', fm.rolls));
    fm.rolls += 1;
    const r = rollRarity(rng, luck);
    const size = rollSize(rng, feed ? feed.size : 0);
    const animal = { id: fm.nextAnimal++, itemId: s.itemId, rarity: RARITIES[r].id, size, cost: Math.round(s.cost) };
    if (sellMode(e, animal.rarity) === 'pengepul') {
      animal.dumped = Math.max(1, Math.round(animalValue(animal) * DEALER_RATE));
      credit(e.state.ledger, e.state.day, 'sale', animal.dumped, 'Jual ke pengepul (otomatis)');
    } else fm.animals.push(animal);
    out.push(animal);
    const book = (fm.book[s.itemId] ||= {});
    const rec = book[animal.rarity] || { n: 0, best: 0 };
    rec.n += 1;
    rec.best = Math.max(rec.best, size);
    book[animal.rarity] = rec;
    e.state.stats.bred += 1;
    e.state.stats.bestRar = Math.max(e.state.stats.bestRar || 0, r);
  }
  fm.slots[slot].splice(k, 1);
  e.track('harvest', n);
  return out;
}

export const spotReady = (e, i) => spotLots(e, i).filter((l) => e.now() >= l.readyAt).length;

// Panen semua penghuni yang sudah siap di satu lahan.
export function harvestSpot(e, i) {
  const out = [];
  const lots = spotLots(e, i);
  for (let k = lots.length - 1; k >= 0; k--) if (e.now() >= lots[k].readyAt && !stockFull(e)) out.push(...harvest(e, i, k));
  if (!out.length) throw new Error(stockFull(e) && lots.some((l) => e.now() >= l.readyAt) ? 'Gudang hewan penuh. Jual atau lepas hewan dulu.' : 'Belum ada yang siap panen');
  return out;
}

export function harvestAll(e) {
  const out = [];
  farmOf(e).slots.forEach((lots, i) => {
    for (let k = (lots || []).length - 1; k >= 0; k--) {
      if (e.now() >= lots[k].readyAt && !stockFull(e)) out.push(...harvest(e, i, k));
    }
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
  if (pets.owned.length >= petMax(e)) throw new Error('Kandang pet penuh. Perluas di tab Aturan atau jual pet lama');
  debit(e.state.ledger, e.state.day, 'buy_stock', egg.price, `Beli ${egg.name}`);
  const rng = mulberry32(hashSeed(e.state.seed, 'pet', pets.rolls));
  pets.rolls += 1;
  const r = rollRarity(rng, egg.luck);
  const kind = PET_KINDS[Math.floor(rng() * PET_KINDS.length)];
  const pet = { id: pets.nextId++, kind: kind.id, rarity: RARITIES[r].id };
  pets.owned.push(pet);
  noteBookPet(pets, pet);
  e.state.stats.hatched = (e.state.stats.hatched || 0) + 1;
  if (e.state.policy.petAuto[pet.rarity]) pet.autoSold = releasePet(e, pet.id);
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
  slots: Array.from({ length: START_SLOTS }, () => []),
  habs: [...START_HABS],
  levels: Array.from({ length: START_SLOTS }, () => 1),
  animals: [], feeds: {}, bibit: {}, nextAnimal: 1, rolls: 0, book: {}, habsV13: true,
});
export const newPets = () => ({ owned: [], equipped: [], nextId: 1, rolls: 0, book: {}, extra: 0 });

export { ITEMS };
