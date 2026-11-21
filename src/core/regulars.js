// Pelanggan langganan: punya hewan favorit, kadang meminta kualitas tertentu, dan makin akrab makin menguntungkan.
import { credit } from './ledger.js';
import { mulberry32, hashSeed } from './rng.js';
import { parseLotKey } from './catalog.js';

export const REGULARS = [
  { id: 'joko', name: 'Pak Joko', icon: '👴', fav: 'cacing', story: 'Pemancing sejati, tak pernah pulang tanpa umpan.' },
  { id: 'rina', name: 'Bu Rina', icon: '👩', fav: 'lele', story: 'Punya kolam lele di belakang rumahnya.' },
  { id: 'dimas', name: 'Dimas', icon: '🧑‍🎓', fav: 'cupang', story: 'Mahasiswa yang gemar memelihara cupang cantik.' },
  { id: 'ahen', name: 'Koh Ahen', icon: '👨‍🦳', fav: 'koi', story: 'Kolektor koi dengan selera tinggi.' },
  { id: 'sari', name: 'Nenek Sari', icon: '👵', fav: 'pipit', story: 'Suka mendengar kicau burung tiap pagi.' },
  { id: 'rt', name: 'Pak RT', icon: '👮', fav: 'perkutut', story: 'Perkutut jadi kebanggaan satu kampung.' },
  { id: 'lala', name: 'Mbak Lala', icon: '💃', fav: 'lovebird', story: 'Lovebird warna-warni untuk teras rumahnya.' },
  { id: 'bram', name: 'Tuan Bram', icon: '🎩', fav: 'murai', story: 'Ikut lomba kicau burung setiap bulan.' },
  { id: 'tia', name: 'Kak Tia', icon: '🧒', fav: 'kura', story: 'Terpesona pada kura-kura sejak kecil.' },
  { id: 'kevin', name: 'Ko Kevin', icon: '🕶️', fav: 'ularjagung', story: 'Pecinta reptil yang nyentrik.' },
  { id: 'ayu', name: 'Dr. Ayu', icon: '🥼', fav: 'kelinci', story: 'Dokter hewan yang diam-diam menyayangi kelinci.' },
  { id: 'rudi', name: 'Bang Rudi', icon: '🧔', fav: 'glider', story: 'Pemburu sugar glider langka.' },
];

export const BOND_THRESH = [0, 3, 8, 16, 30]; // poin kedekatan untuk level 1..5
export const LEVEL_NAMES = ['Kenalan', 'Pelanggan', 'Teman', 'Sahabat', 'Keluarga'];
export const LEVEL_REWARDS = { 2: { cash: 1500 }, 3: { cash: 4000 }, 4: { cash: 10000 }, 5: { cash: 25000, points: 1 } };
export const LEVEL_PERKS = ['', 'Rela bayar +5% lebih mahal', 'Rela bayar +8% dan lebih sering datang', 'Memberi tip 5% tiap kunjungan, rela bayar +10%', 'Rela bayar +12%, membawa teman (kunjungan paling sering)'];
const WTP_BONUS = [0, 0, 0.05, 0.08, 0.1, 0.12];
export const MAX_PER_DAY = 3;

export const regularDef = (id) => REGULARS.find((r) => r.id === id);
export const bondLevel = (bond) => BOND_THRESH.reduce((lv, t, i) => (bond >= t ? i + 1 : lv), 1);
export const nextThresh = (bond) => BOND_THRESH.find((t) => t > bond) ?? null;

// Pelanggan langganan hari ini (ditambahkan di luar pelanggan biasa, maksimal MAX_PER_DAY).
export function planRegulars(engine, day, dayLen) {
  const s = engine.state;
  const picks = [];
  for (const r of REGULARS) {
    if (!engine.isUnlocked(r.fav)) continue;
    const lvl = bondLevel(s.regulars[r.id]?.bond || 0);
    const rng = mulberry32(hashSeed(s.seed, 'reg', day, r.id));
    const roll = rng();
    if (roll >= 0.28 + 0.04 * (lvl - 1)) continue;
    const qty = 1 + Math.floor(rng() * (lvl >= 3 ? 3 : 2));
    const wantsRequest = rng() < 0.5 && engine.maxQuality() >= 2;
    const minQuality = Math.min(engine.maxQuality(), 2 + Math.floor(lvl / 2));
    picks.push({
      roll,
      c: {
        id: `${day}-r${r.id}`,
        type: 'biasa',
        regularId: r.id,
        spawnAt: rng() * dayLen,
        wants: [{ itemId: r.fav, qty, noise: 0.98 + rng() * 0.1 }],
        request: wantsRequest ? { itemId: r.fav, minQuality } : null,
        bonusWtp: WTP_BONUS[lvl],
      },
    });
  }
  return picks.sort((a, b) => a.roll - b.roll).slice(0, MAX_PER_DAY).map((p) => p.c);
}

// Dipanggil setelah pelanggan langganan membayar. Mengembalikan ringkasan kunjungan.
export function onRegularPaid(engine, customer, list, total) {
  const s = engine.state;
  const def = regularDef(customer.regularId);
  const entry = (s.regulars[customer.regularId] ||= { bond: 0, visits: 0, last: 0, claimed: 1 });
  const before = bondLevel(entry.bond);
  const req = customer.request;
  const fulfilled = !!req && list.some((r) => {
    const { itemId, quality } = parseLotKey(r.key);
    return itemId === req.itemId && quality >= req.minQuality;
  });
  entry.visits += 1;
  entry.last = s.day;
  entry.bond += 1 + (fulfilled ? 2 : 0);
  const lvl = bondLevel(entry.bond);
  const tip = Math.round(total * ((fulfilled ? 0.15 : 0) + (lvl >= 4 ? 0.05 : 0)));
  if (tip > 0) credit(s.ledger, s.day, 'tip', tip, `Tip dari ${def.name}`);
  return { id: def.id, name: def.name, icon: def.icon, fulfilled, requested: !!req, tip, bondGain: 1 + (fulfilled ? 2 : 0), levelUp: lvl > before ? lvl : 0 };
}

export function maxBondLevel(engine) {
  return Object.values(engine.state.regulars).reduce((m, r) => Math.max(m, bondLevel(r.bond)), 0);
}

// Mengambil hadiah level berikutnya yang sudah tercapai untuk satu langganan.
export function claimRegular(engine, id) {
  const s = engine.state;
  const e = s.regulars[id];
  if (!e) throw new Error('Belum pernah bertemu langganan ini');
  const lvl = bondLevel(e.bond);
  const next = (e.claimed ?? 1) + 1;
  if (next > lvl || !LEVEL_REWARDS[next]) throw new Error('Belum ada hadiah baru');
  const r = LEVEL_REWARDS[next];
  e.claimed = next;
  if (r.cash) credit(s.ledger, s.day, 'reward', r.cash, `Hadiah kedekatan ${regularDef(id).name} (${LEVEL_NAMES[next - 1]})`);
  if (r.points) s.bonusPoints += r.points;
  return { ...r, level: next };
}
