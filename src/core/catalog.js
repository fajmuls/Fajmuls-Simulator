// Data statis game: kualitas, barang, jenis pelanggan, dan upgrade toko.
// Semua harga dalam Rupiah bulat.

export const QUALITIES = [
  { id: 1, name: 'Buruk', mult: 0.6, stars: 1 },
  { id: 2, name: 'Biasa', mult: 0.85, stars: 2 },
  { id: 3, name: 'Bagus', mult: 1.0, stars: 3 },
  { id: 4, name: 'Prima', mult: 1.35, stars: 4 },
  { id: 5, name: 'Istimewa', mult: 1.8, stars: 5 },
];

export const ITEMS = [
  { id: 'cacing', name: 'Cacing Tanah', category: 'Umpan', wholesale: 400, retail: 700, demand: 1.0, icon: 'worm', needSupplier: 0 },
  { id: 'jangkrik', name: 'Jangkrik', category: 'Umpan', wholesale: 600, retail: 1000, demand: 0.8, icon: 'cricket', needSupplier: 0 },
  { id: 'pelet', name: 'Pelet Ikan', category: 'Pakan', wholesale: 800, retail: 1300, demand: 0.7, icon: 'pellet', needSupplier: 0 },
  { id: 'lele', name: 'Ikan Lele', category: 'Ikan', wholesale: 1200, retail: 2000, demand: 0.6, icon: 'catfish', needSupplier: 0 },
  { id: 'mas', name: 'Ikan Mas', category: 'Ikan', wholesale: 1500, retail: 2600, demand: 0.5, icon: 'goldfish', needSupplier: 0 },
  { id: 'koi', name: 'Ikan Koi', category: 'Ikan', wholesale: 4000, retail: 7500, demand: 0.25, icon: 'koi', needSupplier: 1 },
];

export const CUSTOMER_TYPES = [
  { id: 'biasa', name: 'Pembeli Biasa', weight: 0.6, wtp: 1.0, minQuality: 1, maxQty: 2, color: 0x3b82f6 },
  { id: 'pelit', name: 'Si Pelit', weight: 0.25, wtp: 0.8, minQuality: 1, maxQty: 3, color: 0x84cc16 },
  { id: 'vip', name: 'Pelanggan VIP', weight: 0.15, wtp: 1.35, minQuality: 3, maxQty: 2, color: 0xe11d48 },
];

export const UPGRADES = [
  {
    id: 'rak',
    name: 'Rak Lebih Besar',
    desc: 'Tambah kapasitas stok toko (+40 unit per level).',
    costs: [15000, 40000, 90000],
  },
  {
    id: 'dekorasi',
    name: 'Dekorasi Toko',
    desc: 'Toko lebih menarik: pelanggan datang lebih banyak (+12% per level).',
    costs: [20000, 55000, 120000],
  },
  {
    id: 'supplier',
    name: 'Kontrak Supplier',
    desc: 'Buka kualitas barang lebih tinggi di grosir. Level 1 membuka Ikan Koi.',
    costs: [30000, 100000],
  },
];

export const BASE_CAPACITY = 60;
export const CAPACITY_PER_RAK = 40;
export const BASE_MAX_QUALITY = 3;
export const START_CASH = 50000;
export const DAILY_RENT = 3000;
export const LEDGER_KEEP = 500;

export function getItem(id) {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) throw new Error(`Barang tidak dikenal: ${id}`);
  return it;
}

export function getQuality(id) {
  const q = QUALITIES.find((x) => x.id === id);
  if (!q) throw new Error(`Kualitas tidak dikenal: ${id}`);
  return q;
}

export function getUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`Upgrade tidak dikenal: ${id}`);
  return u;
}

export const lotKey = (itemId, quality) => `${itemId}:${quality}`;

export function parseLotKey(key) {
  const [itemId, q] = key.split(':');
  return { itemId, quality: Number(q) };
}
