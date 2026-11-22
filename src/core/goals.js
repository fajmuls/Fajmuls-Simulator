// Misi harian/mingguan dan pencapaian. Logika murni: hanya menyentuh state lewat engine yang diberikan.
import { credit } from './ledger.js';
import { mulberry32, hashSeed } from './rng.js';
import { CATEGORIES, getCategory } from './catalog.js';

const round = (n, step) => Math.max(step, Math.round(n / step) * step);

// base = target di bintang 1. scale: 'n' (jumlah) atau 'rp' (uang) naik mengikuti bintang.
export const QUEST_DEFS = [
  { key: 'harvest', scope: 'daily', kind: 'harvest', icon: '🌾', text: (g) => `Panen ${g} hewan`, base: 3, step: 1, scale: 'n' },
  { key: 'plant', scope: 'daily', kind: 'plant', icon: '🌱', text: (g) => `Tanam ${g} bibit`, base: 3, step: 1, scale: 'n' },
  { key: 'sell_units', scope: 'daily', kind: 'sell_units', icon: '🛍️', text: (g) => `Jual ${g} barang`, base: 10, step: 1, scale: 'n' },
  { key: 'serve', scope: 'daily', kind: 'serve', icon: '🙂', text: (g) => `Layani ${g} pelanggan`, base: 8, step: 1, scale: 'n' },
  { key: 'revenue', scope: 'daily', kind: 'revenue', icon: '💰', text: (g) => `Raih omzet Rp ${g.toLocaleString('id-ID')}`, base: 8000, step: 500, scale: 'rp' },
  { key: 'buy_units', scope: 'daily', kind: 'buy_units', icon: '📦', text: (g) => `Belanja ${g} stok di grosir`, base: 12, step: 1, scale: 'n' },
  { key: 'sell_cat', scope: 'daily', kind: 'sell_cat', icon: '🐾', text: (g, cat) => `Jual ${g} ${getCategory(cat).name}`, base: 5, step: 1, scale: 'n', cat: true },
  { key: 'vip', scope: 'daily', kind: 'vip', icon: '👑', text: (g) => `Layani ${g} pelanggan VIP`, base: 1, step: 1, scale: 'vip', minStars: 2 },
  { key: 'w_revenue', scope: 'weekly', kind: 'revenue', icon: '💰', text: (g) => `Omzet Rp ${g.toLocaleString('id-ID')} minggu ini`, base: 60000, step: 1000, scale: 'rp', points: 1, minStars: 1 },
  { key: 'w_serve', scope: 'weekly', kind: 'serve', icon: '🙂', text: (g) => `Layani ${g} pelanggan minggu ini`, base: 70, step: 5, scale: 'n' },
  { key: 'w_sell_cat', scope: 'weekly', kind: 'sell_cat', icon: '🐾', text: (g, cat) => `Jual ${g} ${getCategory(cat).name} minggu ini`, base: 35, step: 5, scale: 'n', cat: true },
  { key: 'w_profit', scope: 'weekly', kind: 'profit', icon: '📈', text: (g) => `Laba bersih Rp ${g.toLocaleString('id-ID')} minggu ini`, base: 20000, step: 1000, scale: 'rp', minStars: 2 },
  { key: 'w_harvest', scope: 'weekly', kind: 'harvest', icon: '🌾', text: (g) => `Panen ${g} hewan minggu ini`, base: 12, step: 1, scale: 'n' },
  { key: 'w_breed', scope: 'weekly', kind: 'breed', icon: '🥚', text: (g) => `Selesaikan ${g} breeding`, base: 2, step: 1, scale: 'vip', needBreed: true },
];

export const weekOf = (day) => Math.floor((day - 1) / 7);

function goalFor(def, stars, rng) {
  const wobble = 0.9 + rng() * 0.2;
  let g = def.base;
  if (def.scale === 'n') g = def.base * (1 + 0.6 * (stars - 1));
  else if (def.scale === 'rp') g = def.base * (1 + 1.2 * (stars - 1));
  else if (def.scale === 'vip') g = def.base + Math.floor((stars - 1) / 2);
  return Math.max(1, round(g * (def.scale === 'vip' ? 1 : wobble), def.step));
}

// Hadiah uang naik mengikuti bintang. Poin skill tidak lagi dari misi tunggal, tapi dari misi penuh (lihat peti).
export const QUEST_CASH = 1500;
export const CHEST_DAILY = 3000;
export const CHEST_WEEKLY = 15000;
const starMul = (stars) => 1 + 0.8 * (stars - 1);

function rewardFor(def, stars, rng) {
  const cash = round(QUEST_CASH * starMul(stars) * (0.9 + rng() * 0.2) * (def.scope === 'weekly' ? 5 : 1), 50);
  return { cash, points: 0 };
}

// Peti bonus: semua misi harian (atau mingguan) sudah diambil. Dibayar sekali per hari/minggu.
function checkFull(engine, scope, notes = null) {
  const s = engine.state;
  const q = s.quests;
  const list = scope === 'weekly' ? q.weekly : q.daily;
  const flag = scope === 'weekly' ? 'weeklyChest' : 'dailyChest';
  if (!list.length || q[flag] || !list.every((x) => x.claimed)) return null;
  q[flag] = true;
  const cash = Math.round((scope === 'weekly' ? CHEST_WEEKLY : CHEST_DAILY) * starMul(s.stars));
  s.stats[scope === 'weekly' ? 'weeklyFull' : 'dailyFull'] = (s.stats[scope === 'weekly' ? 'weeklyFull' : 'dailyFull'] || 0) + 1;
  credit(s.ledger, s.day, 'reward', cash, scope === 'weekly' ? 'Peti misi mingguan penuh' : 'Peti misi harian penuh');
  const note = { type: 'reward', text: `${scope === 'weekly' ? 'Misi mingguan' : 'Misi harian'} penuh! Peti bonus +Rp ${cash.toLocaleString('id-ID')}` };
  if (notes) notes.push(note); else engine.notes.push(note);
  return { cash };
}

function pickQuests(engine, scope, count, seedKey) {
  const s = engine.state;
  const rng = mulberry32(hashSeed(s.seed, 'quest', scope, seedKey));
  const openCats = CATEGORIES.filter((c) => c.animal && engine.categoryOpen(c.id));
  const pool = QUEST_DEFS.filter((d) => d.scope === scope && (d.minStars || 1) <= s.stars && (!d.needBreed || engine.breedSlots() > 0));
  const out = [];
  const taken = new Set();
  const order = pool.map((d) => ({ d, r: rng() })).sort((a, b) => a.r - b.r).map((x) => x.d);
  // Misi mingguan omzet selalu ada (membawa poin skill).
  if (scope === 'weekly') {
    const first = order.findIndex((d) => d.key === 'w_revenue');
    if (first > 0) order.unshift(order.splice(first, 1)[0]);
  }
  for (const d of order) {
    if (out.length >= count) break;
    let cat = null;
    if (d.cat) {
      if (!openCats.length) continue;
      cat = openCats[Math.floor(rng() * openCats.length)].id;
    }
    const id = `${d.key}${cat ? `:${cat}` : ''}`;
    if (taken.has(d.key)) continue;
    taken.add(d.key);
    out.push({ id, key: d.key, kind: d.kind, cat, goal: goalFor(d, s.stars, rng), prog: 0, claimed: false, reward: rewardFor(d, s.stars, rng) });
  }
  return out;
}

export const questDef = (key) => QUEST_DEFS.find((d) => d.key === key);
export const questText = (q) => { const d = questDef(q.key); return d ? d.text(q.goal, q.cat) : q.id; };
export const questIcon = (q) => questDef(q.key)?.icon || '🎯';

function payReward(engine, reward, label) {
  const s = engine.state;
  if (reward.cash > 0) credit(s.ledger, s.day, 'reward', reward.cash, label);
  if (reward.points > 0) s.bonusPoints += reward.points;
}

// Membuat misi hari/minggu ini bila belum ada. Misi selesai yang belum ditagih dibayar otomatis saat berganti.
export function ensureQuests(engine) {
  const s = engine.state;
  const q = s.quests;
  const notes = [];
  const settle = (list) => {
    for (const x of list) {
      if (x.prog >= x.goal && !x.claimed) {
        x.claimed = true;
        s.stats.questsDone += 1;
        payReward(engine, x.reward, `Hadiah misi: ${questText(x)}`);
        notes.push({ type: 'reward', text: `Hadiah misi otomatis: ${questText(x)} (+Rp ${x.reward.cash.toLocaleString('id-ID')})` });
      }
    }
  };
  if (q.weekId !== weekOf(s.day)) {
    settle(q.weekly);
    checkFull(engine, 'weekly', notes);
    q.weekId = weekOf(s.day);
    q.weeklyChest = false;
    q.weekly = pickQuests(engine, 'weekly', s.stars >= 3 ? 3 : 2, q.weekId);
  }
  if (q.dayId !== s.day) {
    settle(q.daily);
    checkFull(engine, 'daily', notes);
    q.dayId = s.day;
    q.dailyChest = false;
    q.daily = pickQuests(engine, 'daily', 3, s.day);
  }
  engine.notes.push(...notes);
  return notes;
}

// Menambah progres semua misi yang cocok. kind: sell_units | serve | revenue | buy_units | sell_cat | vip | profit | breed
export function trackQuests(engine, kind, n, extra = {}) {
  ensureQuests(engine);
  const q = engine.state.quests;
  for (const x of [...q.daily, ...q.weekly]) {
    if (x.kind !== kind || x.claimed) continue;
    if (x.cat && x.cat !== extra.cat) continue;
    x.prog = Math.min(x.goal, x.prog + Math.max(0, Math.floor(n)));
  }
}

export function claimQuest(engine, scope, index) {
  ensureQuests(engine);
  const list = scope === 'weekly' ? engine.state.quests.weekly : engine.state.quests.daily;
  const x = list[index];
  if (!x) throw new Error('Misi tidak ditemukan');
  if (x.claimed) throw new Error('Hadiah sudah diambil');
  if (x.prog < x.goal) throw new Error('Misi belum selesai');
  x.claimed = true;
  engine.state.stats.questsDone += 1;
  payReward(engine, x.reward, `Hadiah misi: ${questText(x)}`);
  const chest = checkFull(engine, scope === 'weekly' ? 'weekly' : 'daily');
  return chest ? { ...x.reward, chest: chest.cash } : x.reward;
}

// ---------- Pencapaian ----------
// stat dihitung langsung dari state, jadi pemain lama otomatis mendapat pencapaian yang sudah layak.
export const ACHIEVEMENTS = [
  { id: 'cust_1', icon: '🙋', name: 'Pembeli Pertama', desc: 'Layani 1 pelanggan', stat: 'customers', goal: 1, reward: { cash: 500 } },
  { id: 'cust_100', icon: '🧑‍🤝‍🧑', name: 'Warung Ramai', desc: 'Layani 100 pelanggan', stat: 'customers', goal: 100, reward: { cash: 2000 } },
  { id: 'cust_1000', icon: '🏟️', name: 'Pasar Kota', desc: 'Layani 1.000 pelanggan', stat: 'customers', goal: 1000, reward: { cash: 12000 } },
  { id: 'rev_100k', icon: '🪙', name: 'Pedagang Cilik', desc: 'Total omzet Rp 100.000', stat: 'revenue', goal: 100000, reward: { cash: 3000 } },
  { id: 'rev_1m', icon: '💵', name: 'Saudagar', desc: 'Total omzet Rp 1.000.000', stat: 'revenue', goal: 1000000, reward: { cash: 15000 } },
  { id: 'rev_10m', icon: '🏦', name: 'Konglomerat', desc: 'Total omzet Rp 10.000.000', stat: 'revenue', goal: 10000000, reward: { cash: 80000, points: 1 } },
  { id: 'best_300k', icon: '🎆', name: 'Hari Spektakuler', desc: 'Omzet sehari Rp 300.000', stat: 'bestDay', goal: 300000, reward: { cash: 25000 } },
  { id: 'sold_100', icon: '🛍️', name: 'Tangan Cepat', desc: 'Jual 100 barang', stat: 'sold', goal: 100, reward: { cash: 2000 } },
  { id: 'sold_1000', icon: '📦', name: 'Raja Dagang', desc: 'Jual 1.000 barang', stat: 'sold', goal: 1000, reward: { cash: 15000 } },
  { id: 'bought_500', icon: '🛒', name: 'Penimbun', desc: 'Belanja 500 stok', stat: 'bought', goal: 500, reward: { cash: 3000 } },
  { id: 'star_2', icon: '⭐', name: 'Mulai Dikenal', desc: 'Capai bintang 2', stat: 'stars', goal: 2, reward: { points: 1 } },
  { id: 'star_3', icon: '🌟', name: 'Toko Terkenal', desc: 'Capai bintang 3', stat: 'stars', goal: 3, reward: { cash: 10000, points: 1 } },
  { id: 'star_5', icon: '🏆', name: 'Legenda Pasar', desc: 'Capai bintang 5', stat: 'stars', goal: 5, reward: { cash: 100000, points: 2 } },
  { id: 'shop_3', icon: '🏬', name: 'Toko Meluas', desc: 'Capai toko level 3', stat: 'shopLevel', goal: 3, reward: { cash: 8000 } },
  { id: 'species_10', icon: '📚', name: 'Kolektor', desc: 'Buka 10 jenis barang', stat: 'items', goal: 10, reward: { cash: 8000 } },
  { id: 'bred_5', icon: '🥚', name: 'Peternak', desc: 'Selesaikan 5 breeding', stat: 'bred', goal: 5, reward: { cash: 6000 } },
  { id: 'staff_3', icon: '🧑‍💼', name: 'Majikan', desc: 'Pekerjakan 3 karyawan', stat: 'staff', goal: 3, reward: { cash: 6000 } },
  { id: 'worth_1m', icon: '👑', name: 'Sultan', desc: 'Kekayaan bersih Rp 1.000.000', stat: 'netWorth', goal: 1000000, reward: { cash: 20000 } },
  { id: 'bond_3', icon: '🤝', name: 'Sahabat Pelanggan', desc: 'Capai kedekatan level 3 dengan satu langganan', stat: 'bond', goal: 3, reward: { points: 1 } },
  { id: 'quest_20', icon: '🎯', name: 'Pekerja Keras', desc: 'Selesaikan 20 misi', stat: 'questsDone', goal: 20, reward: { cash: 10000, points: 1 } },
];

export function achStat(engine, stat) {
  const s = engine.state;
  switch (stat) {
    case 'customers': return s.stats.customers;
    case 'revenue': return s.stats.revenue;
    case 'bestDay': return s.stats.bestDay;
    case 'sold': return s.stats.sold;
    case 'bought': return s.stats.bought;
    case 'bred': return s.stats.bred;
    case 'stars': return s.stars;
    case 'shopLevel': return s.shopLevel;
    case 'items': return engine.unlockedItems().length;
    case 'staff': return Object.keys(s.staff).length;
    case 'netWorth': return engine.netWorth();
    case 'bond': return engine.maxBondLevel ? engine.maxBondLevel() : 0;
    case 'questsDone': return s.stats.questsDone;
    default: return 0;
  }
}

// Membuka pencapaian yang sudah layak. Mengembalikan daftar id yang baru terbuka.
export function checkAchievements(engine) {
  const s = engine.state;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (s.ach[a.id]) continue;
    if (achStat(engine, a.stat) >= a.goal) {
      s.ach[a.id] = { day: s.day, claimed: false };
      fresh.push(a.id);
    }
  }
  return fresh;
}

export function claimAchievement(engine, id) {
  const s = engine.state;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const st = s.ach[id];
  if (!a || !st) throw new Error('Pencapaian belum terbuka');
  if (st.claimed) throw new Error('Hadiah sudah diambil');
  st.claimed = true;
  payReward(engine, a.reward, `Hadiah pencapaian: ${a.name}`);
  return a.reward;
}
