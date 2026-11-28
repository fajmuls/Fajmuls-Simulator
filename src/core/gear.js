// Perlengkapan karakter (pengganti Atribut dan Perk) dan efek unik pet.
// 5 slot x 4 barang = 20 barang. Tiap barang membawa SATU perk unik dari 20 perk yang sudah ada.
// Nilai perk dihitung dari barang yang dipakai dan pet yang dipasang, lalu ditulis ke state.skills
// (hasil turunan), sehingga seluruh efek di engine (yang membaca state.skills) tetap bekerja tanpa diubah.
import { PERKS, skillCost } from './catalog.js';
import { debit } from './ledger.js';
import { rarityIdx } from './farm.js';

export const SLOTS = [
  { id: 'topi', name: 'Topi', icon: '🎩', mat: 'kain' },
  { id: 'baju', name: 'Baju', icon: '👕', mat: 'kain' },
  { id: 'sepatu', name: 'Sepatu', icon: '👟', mat: 'logam' },
  { id: 'tas', name: 'Tas', icon: '🎒', mat: 'logam' },
  { id: 'aksesori', name: 'Aksesori', icon: '🔔', mat: 'kain' },
];
export const MATS = [
  { id: 'kain', name: 'Kain', icon: '🧵', price: 600, sprite: 'bahan_kain' },
  { id: 'logam', name: 'Logam', icon: '🔩', price: 1200, sprite: 'bahan_logam' },
];
const PRICES = [4000, 15000, 50000, 150000];
const mk = (slot, list) => list.map(([id, name, perk], i) => ({ id, slot, name, perk, sprite: `item_${id}`, price: PRICES[i] }));
export const GEAR = [
  ...mk('topi', [['topi_jerami', 'Topi Jerami', 'panen_ganda'], ['topi_pedagang', 'Topi Pedagang', 'harga_prima'], ['topi_elang', 'Topi Elang', 'mata_elang'], ['mahkota_emas', 'Mahkota Emas', 'lidah_emas']]),
  ...mk('baju', [['celemek_hemat', 'Celemek Hemat', 'pakan_hemat'], ['jas_toko', 'Jas Toko', 'promosi'], ['rompi_gudang', 'Rompi Gudang', 'gudang'], ['jubah_vip', 'Jubah VIP', 'vipmagnet']]),
  ...mk('sepatu', [['sepatu_lari', 'Sepatu Lari', 'langkah'], ['boot_kebun', 'Boot Kebun', 'tumbuh_cepat'], ['sneaker_kasir', 'Sneaker Kasir', 'kasir_cepat'], ['sepatu_sayap', 'Sepatu Bersayap', 'sigap']]),
  ...mk('tas', [['tas_belanja', 'Tas Belanja', 'tawar'], ['tas_bibit', 'Tas Bibit', 'bibit_murah'], ['tas_kulit', 'Tas Kulit', 'penjual_ulung'], ['tas_ajaib', 'Tas Ajaib', 'bibit_unggul']]),
  ...mk('aksesori', [['lonceng_pintu', 'Lonceng Pintu', 'sabar'], ['kalung_bunga', 'Kalung Bunga', 'setia'], ['syal_ramah', 'Syal Ramah', 'tip_besar'], ['pin_iklan', 'Pin Iklan', 'iklan']]),
];
export const MAX_GEAR_LV = 10;
export const DYE_COST = 500;
export const DYES = [
  { name: 'Asli', css: '', dot: '#e5e7eb' },
  { name: 'Merah', css: 'hue-rotate(-40deg) saturate(1.5)', dot: '#ef4444' },
  { name: 'Biru', css: 'hue-rotate(170deg)', dot: '#3b82f6' },
  { name: 'Hijau', css: 'hue-rotate(90deg)', dot: '#22c55e' },
  { name: 'Kuning', css: 'hue-rotate(30deg) saturate(1.3)', dot: '#eab308' },
  { name: 'Ungu', css: 'hue-rotate(230deg)', dot: '#a855f7' },
  { name: 'Hitam', css: 'brightness(.45) saturate(.6)', dot: '#1f2937' },
];

export const getGear = (id) => {
  const g = GEAR.find((x) => x.id === id);
  if (!g) throw new Error('Barang tidak dikenal');
  return g;
};
export const getSlot = (id) => SLOTS.find((s) => s.id === id);
export const perkOf = (g) => PERKS.find((p) => p.id === g.perk);
// Rank perk dari level barang: Lv1=1, Lv2=2, Lv4=3, Lv7=5, Lv9-10=6 (dibatasi maksimal perk itu).
export const gearRank = (g, lv) => Math.min(perkOf(g).max, Math.ceil(lv * 0.6));
// Biaya naik dari level lv ke lv+1: uang + bahan (jumlah bahan = lv).
export const upgradeCost = (g, lv) => ({ coin: Math.round((g.price * 0.6 * Math.pow(1.55, lv - 1)) / 100) * 100, mat: lv });

// Efek unik pet: tiap jenis pet memegang SATU perk yang berbeda (tidak ada yang kembar).
export const PET_PERK = {
  hoki: 'mata_elang', rubah: 'panen_ganda', bintang: 'bibit_unggul', cepat: 'tumbuh_cepat', poni: 'langkah', dagang: 'lidah_emas',
  naga: 'penjual_ulung', penguin: 'tawar', ramah: 'sabar', panda: 'gudang', setia: 'tip_besar', kodok: 'promosi',
};
const RANK_BY_RARITY = [1, 1, 2, 2, 3, 4, 5];
// Rank efek pet: dari kelangkaan, +1 di Lv 10 dan +1 di Lv 20 (evolusi), dikali bonus skill Pawang Hebat.
export function petRank(e, p) {
  const lv = p.lv || 1;
  const base = RANK_BY_RARITY[rarityIdx(p.rarity)] + (lv >= 10 ? 1 : 0) + (lv >= 20 ? 1 : 0);
  return Math.max(1, Math.round(base * (1 + 0.2 * ((e.state.skills.pet_kuat) || 0))));
}
export function petEffect(e, p) {
  const perk = PERKS.find((x) => x.id === PET_PERK[p.kind]);
  if (!perk) return null;
  const rank = Math.min(perk.max, petRank(e, p));
  return { perk, rank, text: `${perk.name} +${rank}: ${perk.desc}` };
}
export const petEffectText = (e, p) => { const f = petEffect(e, p); return f ? f.text : ''; };

// Membuat state.gear. Pemain lama: poin perk yang pernah dibelanjakan dikembalikan sebagai poin skill,
// atribut direset (poin atribut kini ikut dihitung sebagai poin skill), lalu diberi 1 barang pemula per slot.
export function ensureGear(e) {
  const s = e.state;
  if (s.gear) return s.gear;
  let refund = 0;
  for (const p of PERKS) {
    const r = s.skills[p.id] || 0;
    for (let k = 0; k < r; k++) refund += skillCost(p, k);
    delete s.skills[p.id];
  }
  s.attrs = { dagang: 0, karisma: 0, tangkas: 0, hoki: 0 };
  s.bonusPoints = (s.bonusPoints || 0) + refund;
  s.gear = { owned: {}, equipped: {}, dye: {}, mats: { kain: 0, logam: 0 }, refunded: refund };
  for (const slot of SLOTS) {
    const first = GEAR.find((g) => g.slot === slot.id);
    s.gear.owned[first.id] = 1;
    s.gear.equipped[slot.id] = first.id;
  }
  return s.gear;
}

// Menghitung ulang rank perk dari barang dan pet yang aktif, lalu menuliskannya ke state.skills.
export function applyGear(e) {
  const s = e.state;
  const g = ensureGear(e);
  const rank = {};
  for (const slot of SLOTS) {
    const id = g.equipped[slot.id];
    if (id && g.owned[id]) {
      const it = getGear(id);
      rank[it.perk] = (rank[it.perk] || 0) + gearRank(it, g.owned[id]);
    }
  }
  for (const pid of s.pets.equipped) {
    const p = s.pets.owned.find((x) => x.id === pid);
    const perk = p && PET_PERK[p.kind];
    if (perk) rank[perk] = (rank[perk] || 0) + petRank(e, p);
  }
  for (const p of PERKS) {
    const r = Math.min(p.max, rank[p.id] || 0);
    if (r > 0) s.skills[p.id] = r; else delete s.skills[p.id];
  }
}

export const gearLevel = (e, id) => ensureGear(e).owned[id] || 0;
export const isEquipped = (e, id) => ensureGear(e).equipped[getGear(id).slot] === id;

export function buyGear(e, id) {
  const it = getGear(id);
  const g = ensureGear(e);
  if (g.owned[id]) throw new Error('Barang sudah dimiliki');
  debit(e.state.ledger, e.state.day, 'upgrade', it.price, `Beli ${it.name}`);
  g.owned[id] = 1;
  applyGear(e);
  return it.price;
}

export function equipGear(e, id) {
  const it = getGear(id);
  const g = ensureGear(e);
  if (!g.owned[id]) throw new Error('Barang belum dimiliki');
  g.equipped[it.slot] = id;
  applyGear(e);
}

export function unequipGear(e, slot) {
  const g = ensureGear(e);
  delete g.equipped[slot];
  applyGear(e);
}

export function upgradeGear(e, id) {
  const it = getGear(id);
  const g = ensureGear(e);
  const lv = g.owned[id];
  if (!lv) throw new Error('Barang belum dimiliki');
  if (lv >= MAX_GEAR_LV) throw new Error('Level barang sudah maksimum');
  const cost = upgradeCost(it, lv);
  const mat = getSlot(it.slot).mat;
  if ((g.mats[mat] || 0) < cost.mat) throw new Error(`Bahan ${mat} kurang (butuh ${cost.mat})`);
  debit(e.state.ledger, e.state.day, 'upgrade', cost.coin, `Upgrade ${it.name} jadi Lv ${lv + 1}`);
  g.mats[mat] -= cost.mat;
  g.owned[id] = lv + 1;
  applyGear(e);
  return cost;
}

export function buyMat(e, id, n = 1) {
  const m = MATS.find((x) => x.id === id);
  if (!m) throw new Error('Bahan tidak dikenal');
  if (!Number.isInteger(n) || n < 1) throw new Error('Jumlah tidak valid');
  const g = ensureGear(e);
  debit(e.state.ledger, e.state.day, 'upgrade', m.price * n, `Beli ${n} ${m.name}`);
  g.mats[id] = (g.mats[id] || 0) + n;
  return m.price * n;
}

export function setDye(e, id, idx) {
  getGear(id);
  const g = ensureGear(e);
  if (!g.owned[id]) throw new Error('Barang belum dimiliki');
  if (!Number.isInteger(idx) || idx < 0 || idx >= DYES.length) throw new Error('Warna tidak dikenal');
  if ((g.dye[id] || 0) === idx) return 0;
  debit(e.state.ledger, e.state.day, 'upgrade', DYE_COST, `Celup ${getGear(id).name} warna ${DYES[idx].name}`);
  if (idx === 0) delete g.dye[id]; else g.dye[id] = idx;
  return DYE_COST;
}
