// Data statis Pasar Satwa. Semua harga dalam Rupiah bulat.

export const QUALITIES = [
  { id: 1, name: 'Buruk', mult: 0.6, stars: 1 },
  { id: 2, name: 'Biasa', mult: 0.85, stars: 2 },
  { id: 3, name: 'Bagus', mult: 1.0, stars: 3 },
  { id: 4, name: 'Prima', mult: 1.35, stars: 4 },
  { id: 5, name: 'Istimewa', mult: 1.8, stars: 5 },
];

// needShop = level toko minimum agar kategori terbuka
export const CATEGORIES = [
  { id: 'perlengkapan', name: 'Umpan & Pakan', short: 'Pakan', needShop: 1, animal: false },
  { id: 'ikan', name: 'Ikan', short: 'Ikan', needShop: 1, animal: true },
  { id: 'burung', name: 'Burung', short: 'Burung', needShop: 2, animal: true },
  { id: 'reptil', name: 'Reptil', short: 'Reptil', needShop: 3, animal: true },
  { id: 'kecil', name: 'Satwa Kecil', short: 'Kecil', needShop: 4, animal: true },
];

// tier 1 = paling murah. unlockCost 0 = langsung tersedia saat kategori terbuka.
// Spesies tier N hanya bisa dibuka setelah tier N-1 terbuka.
export const ITEMS = [
  // Umpan & Pakan
  { id: 'cacing', name: 'Cacing Tanah', cat: 'perlengkapan', tier: 1, wholesale: 400, retail: 550, demand: 1.0, unlockCost: 0, icon: 'worm' },
  { id: 'jangkrik', name: 'Jangkrik', cat: 'perlengkapan', tier: 2, wholesale: 600, retail: 820, demand: 0.8, unlockCost: 0, icon: 'cricket' },
  { id: 'pelet', name: 'Pelet Ikan', cat: 'perlengkapan', tier: 3, wholesale: 800, retail: 1070, demand: 0.7, unlockCost: 0, icon: 'pellet' },
  { id: 'voer', name: 'Voer Burung', cat: 'perlengkapan', tier: 4, wholesale: 1000, retail: 1320, demand: 0.6, unlockCost: 0, icon: 'seed' },
  // Ikan
  { id: 'lele', name: 'Ikan Lele', cat: 'ikan', tier: 1, wholesale: 1200, retail: 1660, demand: 0.6, unlockCost: 0, icon: 'fish', pal: { a: '#6b7280', b: '#4b5563', w: '#d1d5db' } },
  { id: 'mas', name: 'Ikan Mas', cat: 'ikan', tier: 2, wholesale: 1800, retail: 2450, demand: 0.5, unlockCost: 5000, icon: 'fish', pal: { a: '#f97316', b: '#ea580c', w: '#fed7aa' } },
  { id: 'cupang', name: 'Ikan Cupang', cat: 'ikan', tier: 3, wholesale: 3000, retail: 4000, demand: 0.4, unlockCost: 15000, icon: 'fish', pal: { a: '#2563eb', b: '#dc2626', w: '#93c5fd' } },
  { id: 'koi', name: 'Ikan Koi', cat: 'ikan', tier: 4, wholesale: 6000, retail: 7900, demand: 0.25, unlockCost: 40000, icon: 'fish', pal: { a: '#f9fafb', b: '#dc2626', w: '#fecaca' } },
  { id: 'arwana', name: 'Ikan Arwana', cat: 'ikan', tier: 5, wholesale: 40000, retail: 52000, demand: 0.08, unlockCost: 120000, icon: 'fish', pal: { a: '#f59e0b', b: '#b45309', w: '#fde68a' } },
  // Burung
  { id: 'pipit', name: 'Burung Pipit', cat: 'burung', tier: 1, wholesale: 2500, retail: 3450, demand: 0.5, unlockCost: 0, icon: 'bird', pal: { a: '#a16207', b: '#f59e0b', w: '#fde68a' } },
  { id: 'perkutut', name: 'Burung Perkutut', cat: 'burung', tier: 2, wholesale: 5000, retail: 6800, demand: 0.4, unlockCost: 8000, icon: 'bird', pal: { a: '#9ca3af', b: '#6b7280', w: '#e5e7eb' } },
  { id: 'kenari', name: 'Burung Kenari', cat: 'burung', tier: 3, wholesale: 9000, retail: 12050, demand: 0.3, unlockCost: 25000, icon: 'bird', pal: { a: '#facc15', b: '#f97316', w: '#fef9c3' } },
  { id: 'lovebird', name: 'Lovebird', cat: 'burung', tier: 4, wholesale: 16000, retail: 21100, demand: 0.22, unlockCost: 60000, icon: 'bird', pal: { a: '#22c55e', b: '#ef4444', w: '#bbf7d0' } },
  { id: 'murai', name: 'Murai Batu', cat: 'burung', tier: 5, wholesale: 40000, retail: 52000, demand: 0.12, unlockCost: 150000, icon: 'bird', pal: { a: '#111827', b: '#ea580c', w: '#374151' } },
  // Reptil
  { id: 'kura', name: 'Kura-kura Brazil', cat: 'reptil', tier: 1, wholesale: 4000, retail: 5500, demand: 0.4, unlockCost: 0, icon: 'lizard', pal: { a: '#16a34a', b: '#a16207', w: '#bbf7d0' } },
  { id: 'bunglon', name: 'Bunglon', cat: 'reptil', tier: 2, wholesale: 8000, retail: 10900, demand: 0.3, unlockCost: 20000, icon: 'lizard', pal: { a: '#84cc16', b: '#ea580c', w: '#ecfccb' } },
  { id: 'gecko', name: 'Gecko Leopard', cat: 'reptil', tier: 3, wholesale: 14000, retail: 18750, demand: 0.25, unlockCost: 50000, icon: 'lizard', pal: { a: '#fbbf24', b: '#78350f', w: '#fef3c7' } },
  { id: 'ularjagung', name: 'Ular Jagung', cat: 'reptil', tier: 4, wholesale: 26000, retail: 34300, demand: 0.15, unlockCost: 120000, icon: 'lizard', pal: { a: '#ea580c', b: '#7f1d1d', w: '#fed7aa' } },
  { id: 'iguana', name: 'Iguana Hijau', cat: 'reptil', tier: 5, wholesale: 50000, retail: 65000, demand: 0.08, unlockCost: 280000, icon: 'lizard', pal: { a: '#15803d', b: '#166534', w: '#86efac' } },
  // Satwa kecil
  { id: 'hamster', name: 'Hamster', cat: 'kecil', tier: 1, wholesale: 3000, retail: 4150, demand: 0.5, unlockCost: 0, icon: 'small', pal: { a: '#d6a85a', b: '#92400e', w: '#fef3c7' } },
  { id: 'kelinci', name: 'Kelinci', cat: 'kecil', tier: 2, wholesale: 6000, retail: 8150, demand: 0.4, unlockCost: 15000, icon: 'rabbit', pal: { a: '#f9fafb', b: '#f9a8d4', w: '#e5e7eb' } },
  { id: 'marmut', name: 'Marmut', cat: 'kecil', tier: 3, wholesale: 9000, retail: 12050, demand: 0.3, unlockCost: 40000, icon: 'small', pal: { a: '#b45309', b: '#fef3c7', w: '#fde68a' } },
  { id: 'landak', name: 'Landak Mini', cat: 'kecil', tier: 4, wholesale: 18000, retail: 23800, demand: 0.2, unlockCost: 100000, icon: 'small', pal: { a: '#78716c', b: '#44403c', w: '#d6d3d1' } },
  { id: 'glider', name: 'Sugar Glider', cat: 'kecil', tier: 5, wholesale: 35000, retail: 45500, demand: 0.12, unlockCost: 250000, icon: 'rabbit', pal: { a: '#94a3b8', b: '#475569', w: '#e2e8f0' } },
];

export const CUSTOMER_TYPES = [
  { id: 'biasa', name: 'Pembeli Biasa', weight: 0.6, wtp: 1.0, minQuality: 1, maxQty: 1, color: 0x3b82f6 },
  { id: 'pelit', name: 'Si Pelit', weight: 0.2, wtp: 1.0, minQuality: 1, maxQty: 1, color: 0x84cc16 },
  { id: 'vip', name: 'Pelanggan VIP', weight: 0.12, wtp: 1.0, minQuality: 2, maxQty: 1, color: 0xe11d48 },
  { id: 'kolektor', name: 'Kolektor', weight: 0.08, wtp: 1.0, minQuality: 3, maxQty: 1, color: 0x9333ea },
];

// ---------- Reputasi dan bintang ----------
export const STAR_THRESH = [0, 15, 35, 60, 85]; // reputasi minimum untuk bintang 1..5
export const STAR_POINTS = [0, 2, 4, 7, 10]; // poin skill kumulatif dari bintang
export const STAR_PERKS = [
  { stars: 1, title: 'Toko Baru', count: 1.0, disc: 0, wtp: 0, vip: 1, rent: 0, unlocks: [], text: ['Mulai dagang: Umpan, Pakan, dan Ikan'] },
  { stars: 2, title: 'Dikenal Warga', count: 1.06, disc: 0, wtp: 0, vip: 1, rent: 0, unlocks: ['Ramuan', 'Bank', 'Kasir', 'Pramuniaga'], text: ['+6% pelanggan', '+1 poin skill', 'Buka: Ramuan, Bank, Karyawan Kasir & Pramuniaga'] },
  { stars: 3, title: 'Langganan Ramai', count: 1.12, disc: 0.03, wtp: 0.02, vip: 1.2, rent: 0, unlocks: ['Investasi', 'Penjaga Stok', 'Perawat Hewan'], text: ['+12% pelanggan total', 'Diskon grosir 3%', '+1 poin skill', 'Buka: Investasi, Penjaga Stok, Perawat Hewan'] },
  { stars: 4, title: 'Toko Favorit', count: 1.2, disc: 0.05, wtp: 0.04, vip: 1.5, rent: 0.1, unlocks: [], text: ['+20% pelanggan total', 'Diskon grosir 5%', 'VIP lebih sering', 'Sewa -10%', '+2 poin skill'] },
  { stars: 5, title: 'Toko Legendaris', count: 1.3, disc: 0.08, wtp: 0.08, vip: 2, rent: 0.2, unlocks: [], text: ['+30% pelanggan total', 'Diskon grosir 8%', 'Pembeli rela bayar +8%', 'VIP 2x lebih sering', 'Sewa -20%', '+2 poin skill'] },
];

export function starsFor(rep) {
  let st = 1;
  for (let i = 0; i < STAR_THRESH.length; i++) if (rep >= STAR_THRESH[i]) st = i + 1;
  return st;
}

// ---------- Level toko ----------
export const SHOP_LEVELS = [
  { level: 1, name: 'Lapak Kecil', cost: 0, needStars: 1, capacity: 0, text: 'Umpan, Pakan, Ikan' },
  { level: 2, name: 'Toko Biasa', cost: 40000, needStars: 1, capacity: 40, text: 'Buka kategori Burung, rak bertambah' },
  { level: 3, name: 'Toko Besar', cost: 120000, needStars: 2, capacity: 40, text: 'Buka kategori Reptil, kapasitas lebih besar' },
  { level: 4, name: 'Toko Lengkap', cost: 300000, needStars: 3, capacity: 40, text: 'Buka kategori Satwa Kecil' },
  { level: 5, name: 'Pasar Satwa Raya', cost: 700000, needStars: 4, capacity: 60, text: 'Toko terbesar, kapasitas maksimum' },
];

// ---------- Upgrade toko ----------
const premium = (cat, name, c1, c2) => ({ id: `prem_${cat}`, name, desc: `Pembeli rela bayar +6% per level untuk kategori ${CATEGORIES.find((x) => x.id === cat).name}.`, costs: [c1, c2], needCat: cat });
export const UPGRADES = [
  { id: 'rak', name: 'Rak Lebih Besar', desc: 'Tambah kapasitas stok (+40 unit per level).', costs: [15000, 40000, 90000, 200000, 450000, 900000] },
  { id: 'dekorasi', name: 'Dekorasi Toko', desc: 'Toko lebih menarik: pelanggan +12% per level.', costs: [20000, 55000, 120000, 260000] },
  { id: 'supplier', name: 'Kontrak Supplier', desc: 'Buka kualitas barang lebih tinggi di grosir (+1 kualitas per level).', costs: [30000, 100000] },
  { id: 'kasir_modern', name: 'Mesin Kasir Modern', desc: 'Pembayaran 15% lebih cepat per level.', costs: [12000, 35000, 80000] },
  { id: 'member', name: 'Kartu Member Grosir', desc: 'Diskon belanja grosir 3% per level.', costs: [25000, 70000, 160000] },
  { id: 'kecepatan', name: 'Mesin Waktu', desc: 'Buka kecepatan permainan: level 1 = 4x, level 2 = 8x.', costs: [60000, 200000] },
  { id: 'renovasi', name: 'Renovasi Toko', desc: 'Interior megah: pelanggan +10% per level (butuh Toko Lv 4).', costs: [800000, 2200000, 5500000], needShop: 4 },
  premium('ikan', 'Akuarium Premium', 30000, 90000),
  premium('burung', 'Sangkar Premium', 60000, 160000),
  premium('reptil', 'Terarium Premium', 90000, 220000),
  premium('kecil', 'Kandang Mewah', 120000, 300000),
];

export const BASE_CAPACITY = 60;
export const CAPACITY_PER_RAK = 40;
export const BASE_MAX_QUALITY = 3;
export const START_CASH = 50000;
export const DAILY_RENT = 900;
export const LEDGER_KEEP = 500;

// ---------- Skill ----------
export const SKILL_BRANCHES = [
  { id: 'dagang', name: 'Dagang', icon: '💰' },
  { id: 'pemasaran', name: 'Pemasaran', icon: '📣' },
  { id: 'logistik', name: 'Logistik', icon: '📦' },
  { id: 'pemain', name: 'Pemain', icon: '🏃' },
  { id: 'pertanian', name: 'Kebun & Kolam', icon: '🌱' },
  { id: 'peternakan', name: 'Peternakan & Pet', icon: '🐣' },
];
export const SKILLS = [
  // Dagang
  { id: 'tawar', branch: 'dagang', name: 'Tawar-menawar', max: 8, req: null, desc: 'Diskon belanja grosir dan bibit 2,5% per rank.' },
  { id: 'harga_prima', branch: 'dagang', name: 'Mata Dagang', max: 8, req: 'tawar', desc: 'Pembeli rela bayar 3% lebih tinggi per rank.' },
  { id: 'lidah_emas', branch: 'dagang', name: 'Lidah Emas', max: 8, req: 'harga_prima', desc: 'Harga jual semua hewan +5% per rank (di atas batas pelanggan).' },
  { id: 'tip_besar', branch: 'dagang', name: 'Senyum Bertip', max: 5, req: 'lidah_emas', desc: 'Tip pelayanan cepat +8% per rank.' },
  { id: 'penjual_ulung', branch: 'dagang', name: 'Penjual Ulung', max: 6, req: 'tip_besar', desc: 'Harga jual semua hewan +3% per rank.' },
  { id: 'juragan', branch: 'dagang', name: 'Juragan Hemat', max: 5, req: 'harga_prima', desc: 'Sewa toko turun 10% per rank.' },
  { id: 'akuntan', branch: 'dagang', name: 'Akuntan Teliti', max: 5, req: 'juragan', desc: 'Gaji karyawan turun 8% per rank.' },
  // Pemasaran
  { id: 'promosi', branch: 'pemasaran', name: 'Promosi', max: 8, req: null, desc: 'Pelanggan +8% per rank.' },
  { id: 'ramah', branch: 'pemasaran', name: 'Pelayanan Ramah', max: 5, req: 'promosi', desc: 'Reputasi naik 12% lebih cepat dan turun 12% lebih lambat per rank.' },
  { id: 'vipmagnet', branch: 'pemasaran', name: 'Magnet VIP', max: 8, req: 'ramah', desc: 'Pelanggan VIP 15% lebih sering per rank.' },
  { id: 'sabar', branch: 'pemasaran', name: 'Suasana Nyaman', max: 5, req: 'promosi', desc: 'Pelanggan 8% lebih sabar menunggu per rank.' },
  { id: 'setia', branch: 'pemasaran', name: 'Pelanggan Setia', max: 8, req: 'promosi', desc: 'Pelanggan +5% per rank.' },
  { id: 'iklan', branch: 'pemasaran', name: 'Iklan Besar', max: 6, req: 'vipmagnet', desc: 'Pelanggan +6% per rank.' },
  { id: 'toko_ramai', branch: 'pemasaran', name: 'Toko Ramai', max: 5, req: 'iklan', desc: 'Batas pelanggan harian +10 per rank.' },
  { id: 'viral', branch: 'pemasaran', name: 'Kabar Viral', max: 5, req: 'ramah', desc: 'Reputasi naik tambahan 10% per rank.' },
  // Logistik
  { id: 'gudang', branch: 'logistik', name: 'Gudang Rapi', max: 8, req: null, desc: 'Kapasitas stok +12 per rank.' },
  { id: 'tim', branch: 'logistik', name: 'Manajemen Tim', max: 6, req: null, desc: 'Tambah 1 slot karyawan per rank (awal 0 slot).' },
  { id: 'tim_cepat', branch: 'logistik', name: 'Tim Sigap', max: 5, req: 'tim', desc: 'Semua karyawan bekerja 10% lebih cepat per rank.' },
  { id: 'kasir_cepat', branch: 'logistik', name: 'Kasir Gesit', max: 5, req: 'gudang', desc: 'Pembayaran 12% lebih cepat per rank.' },
  { id: 'tim_besar', branch: 'logistik', name: 'Manajer Senior', max: 3, req: 'tim_cepat', desc: 'Tambah 1 slot karyawan per rank.' },
  { id: 'pagar', branch: 'logistik', name: 'Pagar Kuat', max: 4, req: 'gudang', desc: 'Peluang pencuri datang turun 20% per rank.' },
  { id: 'insting', branch: 'logistik', name: 'Insting Pasar', max: 1, req: 'kasir_cepat', desc: 'Lihat perkiraan harga grosir dan event besok.' },
  // Pemain
  { id: 'langkah', branch: 'pemain', name: 'Langkah Cepat', max: 10, req: null, desc: 'Karakter berjalan 10% lebih cepat per rank (di dalam Toko).' },
  { id: 'sigap', branch: 'pemain', name: 'Tangan Sigap', max: 5, req: 'langkah', desc: 'Tip cepat masih didapat walau pelanggan sudah menunggu lebih lama (+8% per rank).' },
  // Kebun & Kolam
  { id: 'tumbuh_cepat', branch: 'pertanian', name: 'Tangan Dingin', max: 8, req: null, desc: 'Bibit tumbuh 4% lebih cepat per rank.' },
  { id: 'bibit_murah', branch: 'pertanian', name: 'Pemburu Bibit', max: 5, req: 'tumbuh_cepat', desc: 'Harga bibit turun 4% per rank.' },
  { id: 'panen_ganda', branch: 'pertanian', name: 'Panen Berkah', max: 6, req: 'tumbuh_cepat', desc: 'Tiap panen punya peluang +8% per rank untuk hewan bonus.' },
  { id: 'mata_elang', branch: 'pertanian', name: 'Mata Elang', max: 6, req: 'panen_ganda', desc: 'Peluang rarity tinggi saat panen naik per rank.' },
  { id: 'pakan_hemat', branch: 'pertanian', name: 'Pakan Hemat', max: 5, req: 'bibit_murah', desc: 'Harga pakan turun 6% per rank.' },
  // Peternakan & Pet
  { id: 'breeder', branch: 'peternakan', name: 'Pengembang Biak', max: 1, req: null, desc: 'Buka kandang breeding (1 slot).' },
  { id: 'bibit_unggul', branch: 'peternakan', name: 'Bibit Unggul', max: 5, req: 'breeder', desc: 'Peluang anakan naik kualitas +8% per rank.' },
  { id: 'kandang_besar', branch: 'peternakan', name: 'Kandang Luas', max: 5, req: 'breeder', desc: 'Slot breeding +1 per rank.' },
  { id: 'pet_kuat', branch: 'peternakan', name: 'Pawang Hebat', max: 5, req: null, desc: 'Efek semua pet yang dipakai +12% per rank.' },
  { id: 'slot_pet', branch: 'peternakan', name: 'Teman Setia', max: 3, req: 'pet_kuat', desc: 'Slot pet aktif +1 per rank.' },
];
export const SKILL_POINT_EVERY_DAYS = 5; // satu poin tiap 5 hari bermain
export const SKILL_POINT_EVERY_FULL_DAYS = 3; // satu poin tiap 3 hari dengan semua misi harian selesai
// (ditambah satu poin tiap minggu dengan semua misi mingguan selesai)

// ---------- Ramuan ----------
export const POTIONS = [
  { id: 'pemikat', name: 'Ramuan Pemikat', icon: '🧪', price: 4000, days: 1, desc: 'Pelanggan +30% hari berikutnya.' },
  { id: 'hartawan', name: 'Ramuan Hartawan', icon: '💛', price: 5000, days: 1, desc: 'Pembeli rela bayar +15%.' },
  { id: 'sahabat', name: 'Ramuan Sahabat', icon: '💚', price: 6000, days: 2, desc: 'Reputasi naik 50% lebih cepat dan turun 50% lebih lambat selama 2 hari.' },
  { id: 'borong', name: 'Ramuan Borong', icon: '🛒', price: 3500, days: 1, desc: 'Diskon grosir 12% (berlaku saat belanja sebelum toko dibuka).' },
  { id: 'bibit', name: 'Ramuan Bibit', icon: '🥚', price: 8000, days: 3, desc: 'Breeding: anakan +1 dan peluang naik kualitas +20% selama 3 hari.' },
  { id: 'obat', name: 'Obat Hewan', icon: '🩹', price: 5000, days: 3, desc: 'Hewan tidak sakit atau mati selama 3 hari.' },
  { id: 'vip', name: 'Ramuan VIP', icon: '👑', price: 7000, days: 1, desc: 'Pelanggan VIP 2x lebih sering.' },
];

// ---------- Karyawan ----------
// Karyawan: tiap jenis punya SATU efek (buff atau pekerjaan) dan batas jumlah.
// Dibuka dengan lisensi (beli) atau misi; jenis rahasia hanya lewat misi sulit.
// mission.stat dibaca oleh crewStat() di crew.js.
export const STAFF = [
  { id: 'kasir', name: 'Kasir', icon: '🧾', wage: 3000, max: 3, license: 6000, job: 'kasir',
    desc: 'Melayani pelanggan di antrean menggantikanmu. Makin banyak kasir, makin banyak pelanggan dilayani bersamaan.',
    mission: { stat: 'customers', goal: 25, desc: 'Layani 25 pelanggan' } },
  { id: 'pramuniaga', name: 'Pramuniaga', icon: '🙋', wage: 3500, max: 3, license: 9000, buff: { key: 'patience', per: 0.06 },
    desc: 'Pelanggan 6% lebih sabar menunggu (per orang).',
    mission: { stat: 'stars', goal: 2, desc: 'Capai bintang 2' } },
  { id: 'badut', name: 'Badut Penarik Pengunjung', icon: '🤡', wage: 3500, max: 2, license: 14000, buff: { key: 'count', per: 0.05 },
    desc: 'Pelanggan +5% (per orang). Berkeliling di alun-alun.',
    mission: { stat: 'customers', goal: 120, desc: 'Layani 120 pelanggan' } },
  { id: 'penjaga', name: 'Penjaga Stok', icon: '📋', wage: 4000, max: 3, license: 12000, job: 'penjaga',
    desc: 'Memanen dan menanam bibit sesuai aturanmu (mis. buat lagi bila stok kurang dari 5). Pekerjaannya lambat di awal.',
    mission: { stat: 'bred', goal: 40, desc: 'Panen 40 hewan' } },
  { id: 'satpam', name: 'Satpam', icon: '💂', wage: 4500, max: 2, license: 10000, job: 'satpam',
    desc: 'Berjaga di gerbang kolam dan mengusir pencuri.',
    mission: { stat: 'stolen', goal: 1, desc: 'Pernah kehilangan hewan karena pencuri' } },
  { id: 'perawat', name: 'Perawat Hewan', icon: '🩺', wage: 5000, max: 3, license: 16000, buff: { key: 'grow', per: 0.05 },
    desc: 'Bibit tumbuh 5% lebih cepat (per orang).',
    mission: { stat: 'planted', goal: 60, desc: 'Tanam 60 hewan' } },
  { id: 'petani', name: 'Petani Ahli', icon: '🧑‍🌾', wage: 6000, max: 2, secret: true, buff: { key: 'harvest', per: 0.06 },
    desc: 'Tiap panen berpeluang +6% (per orang) memberi hewan bonus.',
    mission: { stat: 'bred', goal: 200, desc: 'Panen 200 hewan' } },
  { id: 'promotor', name: 'Promotor Toko', icon: '📣', wage: 5500, max: 2, license: 22000, buff: { key: 'tip', per: 0.06 },
    desc: 'Tip pelayanan cepat +6% (per orang).',
    mission: { stat: 'stars', goal: 3, desc: 'Capai bintang 3' } },
  { id: 'pedagang', name: 'Pedagang Senior', icon: '🧮', wage: 8000, max: 2, license: 45000, buff: { key: 'price', per: 0.03 },
    desc: 'Harga jual semua hewan +3% (per orang).',
    mission: { stat: 'customers', goal: 400, desc: 'Layani 400 pelanggan' } },
  { id: 'saudagar', name: 'Saudagar Misterius', icon: '💎', wage: 12000, max: 2, secret: true, buff: { key: 'price', per: 0.05 },
    desc: 'Harga jual semua hewan +5% (per orang). Tak mau bekerja untuk toko sembarangan.',
    mission: { stat: 'customers', goal: 1000, desc: 'Layani 1000 pelanggan' } },
  { id: 'peramal', name: 'Peramal Pasar', icon: '🔮', wage: 7000, max: 2, secret: true, buff: { key: 'luck', per: 0.08 },
    desc: 'Peluang rarity tinggi saat panen naik (per orang).',
    mission: { stat: 'bestRar', goal: 4, desc: 'Dapatkan hewan Legendary' } },
];
export const CREW_UPGRADE_MULS = [5, 12, 26, 55]; // biaya naik level = gaji x 1,5 x angka ini
export const CREW_MAX_LEVEL = 5;

// ---------- Investasi ----------
export const DEPOSIT_TERMS = [
  { days: 3, rate: 0.03 },
  { days: 7, rate: 0.08 },
  { days: 14, rate: 0.2 },
];
export const DEPOSIT_MIN = 5000;
export const DEPOSIT_MAX_ACTIVE = 6;
export const SHARES = [
  { id: 'pakanjaya', name: 'Pakan Jaya', desc: 'Stabil, naik pelan', vol: 0.02, drift: 0.002, start: 1000 },
  { id: 'satwamart', name: 'Satwa Mart', desc: 'Sedang', vol: 0.05, drift: 0, start: 2500 },
  { id: 'arwanatech', name: 'Arwana Tech', desc: 'Liar, untung atau buntung', vol: 0.1, drift: 0, start: 5000 },
];
export const SHARE_MIN_PRICE = 100;
export const SHARE_SELL_FEE = 0.01;
export const SHARE_HISTORY = 14;
export const PROPERTIES = [
  { id: 'kios', name: 'Kios Sewaan', cost: 200000, income: 2400, max: 3 },
  { id: 'kontrakan', name: 'Rumah Kontrakan', cost: 600000, income: 7800, max: 3 },
  { id: 'ruko', name: 'Ruko Dua Lantai', cost: 1500000, income: 21000, max: 2 },
];
export const PROPERTY_SELL_RATE = 0.8;

// ---------- Bank ----------
export const LOAN_TERMS = [
  { days: 7, rate: 0.08 },
  { days: 14, rate: 0.15 },
  { days: 30, rate: 0.3 },
];
export const LOAN_MIN = 5000;
export const LOAN_STEP = 1000;
export const LOAN_MAX_ACTIVE = 3;
export const LOAN_LATE_FEE = 0.05;

// ---------- Breeding ----------
export const BREED_FEE_RATE = 0.25;
export const BREED_BASE_SLOTS = 1;

// ---------- Event harian ----------
export const EVENTS = [
  { id: 'cerah', name: 'Hari Cerah', icon: '☀️', weight: 40, count: 1, wholesale: 1, wtp: 0, vip: 1, desc: 'Hari biasa.' },
  { id: 'hujan', name: 'Hujan Deras', icon: '🌧️', weight: 13, count: 0.7, wholesale: 1, wtp: 0, vip: 1, desc: 'Pelanggan -30%.' },
  { id: 'festival', name: 'Festival Pasar', icon: '🎉', weight: 10, count: 1.4, wholesale: 1, wtp: 0, vip: 1, desc: 'Pelanggan +40%.' },
  { id: 'murah', name: 'Pasar Murah Grosir', icon: '🏷️', weight: 9, count: 1, wholesale: 0.88, wtp: 0, vip: 1, desc: 'Harga grosir dan bibit -12%.' },
  { id: 'kolektor', name: 'Kolektor Datang', icon: '🧐', weight: 9, count: 1, wholesale: 1, wtp: 0.05, vip: 2, desc: 'VIP 2x lebih sering dan bayar +5%.' },
  { id: 'sepi', name: 'Hari Sepi', icon: '😴', weight: 6, count: 0.8, wholesale: 1, wtp: 0, vip: 1, desc: 'Pelanggan -20%.' },
  { id: 'bintang', name: 'Malam Bintang', icon: '🌠', weight: 7, count: 1, wholesale: 1, wtp: 0, vip: 1, luck: 3, desc: 'Peluang rarity panen naik besar hari ini.' },
  { id: 'angin', name: 'Angin Segar', icon: '🍃', weight: 7, count: 1, wholesale: 1, wtp: 0, vip: 1, grow: 0.25, desc: 'Semua bibit tumbuh 25% lebih cepat.' },
  { id: 'malam', name: 'Pasar Malam', icon: '🏮', weight: 8, count: 1.25, wholesale: 1, wtp: 0, vip: 1, tip: 0.15, desc: 'Pelanggan +25% dan tip lebih besar (+15%).' },
  { id: 'lomba', name: 'Lomba Hewan', icon: '🏆', weight: 7, count: 1, wholesale: 1, wtp: 0, vip: 1, rare: 0.3, desc: 'Hewan Rare ke atas dibayar +30%.' },
  { id: 'libur', name: 'Hari Libur', icon: '🏖️', weight: 7, count: 1.6, wholesale: 1, wtp: 0, vip: 1, patience: -0.3, desc: 'Pelanggan +60%, tapi mereka kurang sabar (-30%).' },
  { id: 'subur', name: 'Musim Subur', icon: '🌾', weight: 7, count: 1, wholesale: 1, wtp: 0, vip: 1, bonus: 1, desc: 'Tiap panen dapat 1 hewan bonus.' },
];

// ---------- Fungsi bantu ----------
export function getItem(id) {
  const it = ITEMS.find((i) => i.id === id);
  if (!it) throw new Error(`Barang tidak dikenal: ${id}`);
  return it;
}
export const getCategory = (id) => {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Kategori tidak dikenal: ${id}`);
  return c;
};
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
export const getSkill = (id) => {
  const s = SKILLS.find((x) => x.id === id);
  if (!s) throw new Error(`Skill tidak dikenal: ${id}`);
  return s;
};
export const getPotion = (id) => {
  const p = POTIONS.find((x) => x.id === id);
  if (!p) throw new Error(`Ramuan tidak dikenal: ${id}`);
  return p;
};
export const getStaff = (id) => {
  const s = STAFF.find((x) => x.id === id);
  if (!s) throw new Error(`Karyawan tidak dikenal: ${id}`);
  return s;
};
export const getShare = (id) => {
  const s = SHARES.find((x) => x.id === id);
  if (!s) throw new Error(`Saham tidak dikenal: ${id}`);
  return s;
};
export const getProperty = (id) => {
  const p = PROPERTIES.find((x) => x.id === id);
  if (!p) throw new Error(`Properti tidak dikenal: ${id}`);
  return p;
};
export const itemsOf = (cat) => ITEMS.filter((i) => i.cat === cat);

export const lotKey = (itemId, quality) => `${itemId}:${quality}`;
export function parseLotKey(key) {
  const [itemId, q] = key.split(':');
  return { itemId, quality: Number(q) };
}

// ---------- Pengeluaran (sink) ----------
export const SPEED_STEPS = [2, 4, 8]; // kecepatan maksimum menurut level upgrade 'kecepatan' (0, 1, 2)
export const UPKEEP_PER_ANIMAL = 6; // perawatan harian per ekor hewan di stok
export const UPKEEP_SHOP_STEP = 0.15; // tambahan per level toko di atas 1
export const SICK_CHANCE = 0.012; // peluang hewan mati/sakit per ekor per hari
export const THEFT_CHANCE = 0.04; // peluang pencurian per pelanggan (mulai hari ke-5)
export const THIEF_FROM_DAY = 4; // pencuri mulai muncul di kolam pada hari ini
export const THIEF_DAY_CHANCE = 0.4; // peluang ada pencuri pada hari tertentu
export const THIEF_CATCH_SATPAM = 0.92; // peluang satpam yang berjaga di kolam mengusir pencuri
export const TAX_BRACKETS = [ // pajak progresif atas omzet harian
  { from: 60000, rate: 0.05 },
  { from: 200000, rate: 0.09 },
  { from: 600000, rate: 0.14 },
];
export const WEALTH_TAX_FROM = 1500000; // kas di atas ini dikenai pajak harian
export const WEALTH_TAX_RATE = 0.003;

// ---------- Penyetelan laju ekonomi (v8): biaya kemajuan dinaikkan agar uang tidak terlalu cepat ----------
export const PROGRESS_COST_SCALE = 2.2;
const scaleCost = (n) => (n > 0 ? Math.max(500, Math.round((n * PROGRESS_COST_SCALE) / 500) * 500) : 0);
// Lisensi tier 1-2 murah supaya jenis awal tetap terpakai; tier atas tetap mahal.
const LICENSE_TIER_SCALE = { 1: 1, 2: 0.55, 3: 1.4, 4: PROGRESS_COST_SCALE, 5: PROGRESS_COST_SCALE };
for (const it of ITEMS) {
  const k = LICENSE_TIER_SCALE[it.tier] ?? PROGRESS_COST_SCALE;
  it.unlockCost = it.unlockCost > 0 ? Math.max(500, Math.round((it.unlockCost * k) / 500) * 500) : 0;
}
for (const lv of SHOP_LEVELS) lv.cost = scaleCost(lv.cost);
for (const up of UPGRADES) up.costs = up.costs.map(scaleCost);
