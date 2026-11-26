// v12: kota/cabang, ekspedisi karyawan, dan prestise (musim baru). Semua fungsi menerima engine `e`.
import { credit, debit } from './ledger.js';
import { mulberry32, hashSeed } from './rng.js';
import { getStaff, START_CASH } from './catalog.js';
import * as farm from './farm.js';

// ---------- Kota (cabang) ----------
// cat = pengali minat pelanggan per kategori; rent = sewa tambahan per hari; count/wtp = pengali pelanggan dan tambahan harga.
export const CITIES = [
  { id: 'pusat', name: 'Kota Asal', icon: '🏠', cost: 0, fare: 0, needStars: 1, rent: 0, count: 1, wtp: 0, cat: {}, desc: 'Toko utama kamu.' },
  { id: 'bandung', name: 'Bandung', icon: '🌄', cost: 150000, fare: 3000, needStars: 2, rent: 4000, count: 1.05, wtp: 0.04, cat: { kecil: 2.2, burung: 1.2 }, desc: 'Pecinta satwa kecil. Hamster, kelinci, dan landak laris.' },
  { id: 'surabaya', name: 'Surabaya', icon: '🌆', cost: 400000, fare: 5000, needStars: 3, rent: 9000, count: 1.15, wtp: 0.05, cat: { ikan: 2.2, reptil: 1.4 }, desc: 'Kota pelabuhan. Ikan dan reptil paling dicari.' },
  { id: 'bali', name: 'Bali', icon: '🌴', cost: 1200000, fare: 9000, needStars: 4, rent: 22000, count: 1.25, wtp: 0.12, cat: { burung: 2.2, reptil: 2 }, desc: 'Turis royal. Burung dan reptil eksotis dibayar mahal.' },
  { id: 'jakarta', name: 'Jakarta', icon: '🏙️', cost: 3000000, fare: 15000, needStars: 5, rent: 60000, count: 1.6, wtp: 0.15, cat: { ikan: 1.3, burung: 1.3, reptil: 1.3, kecil: 1.3 }, desc: 'Ramai sekali dan semua jenis hewan laku.' },
];
export const getCity = (id) => CITIES.find((c) => c.id === id) || CITIES[0];
export const newCities = () => ({ at: 'pusat', owned: { pusat: true }, stats: {} });
export const cityNow = (e) => getCity(e.state.cities?.at);

export function buyCity(e, id) {
  e._requireIdle();
  const c = getCity(id);
  const cs = e.state.cities;
  if (c.id === 'pusat' || cs.owned[id]) throw new Error('Cabang ini sudah kamu miliki');
  if (e.state.stars < c.needStars) throw new Error(`Butuh bintang ${c.needStars} untuk membuka cabang ${c.name}`);
  debit(e.state.ledger, e.state.day, 'expand', c.cost, `Buka cabang ${c.name}`);
  cs.owned[id] = true;
  return c.cost;
}

export function travelTo(e, id) {
  e._requireIdle();
  const c = getCity(id);
  const cs = e.state.cities;
  if (!cs.owned[c.id]) throw new Error('Cabang belum dibuka');
  if (cs.at === c.id) throw new Error('Kamu sudah di sini');
  if (c.fare > 0) debit(e.state.ledger, e.state.day, 'travel', c.fare, `Ongkos ke ${c.name}`);
  cs.at = c.id;
  return c.fare;
}

export function noteCityDay(e, revenue) {
  const cs = e.state.cities;
  const st = (cs.stats[cs.at] ||= { days: 0, revenue: 0, best: 0 });
  st.days += 1;
  st.revenue += revenue;
  st.best = Math.max(st.best, revenue);
}

// ---------- Ekspedisi ----------
export const DESTS = [
  { id: 'hutan', name: 'Hutan Hujan', icon: '🌳', cats: ['burung', 'kecil'], cost: 8000, minDay: 1, risk: 0.08 },
  { id: 'laut', name: 'Pesisir & Karang', icon: '🏝️', cats: ['ikan', 'reptil'], cost: 14000, minDay: 1, risk: 0.1 },
  { id: 'gunung', name: 'Pegunungan Liar', icon: '⛰️', cats: ['burung', 'reptil', 'kecil'], cost: 30000, minDay: 1, risk: 0.14 },
  { id: 'rimba', name: 'Rimba Misterius', icon: '🌋', cats: ['ikan', 'burung', 'reptil', 'kecil'], cost: 80000, minDay: 1, risk: 0.18 },
];
export const getDest = (id) => DESTS.find((d) => d.id === id);
export const newExped = () => ({ active: [], done: 0, nextId: 1, last: null });
export const EXPED_DAYS = [1, 2, 3];

export const awayCrew = (e) => new Set((e.state.exped?.active || []).map((x) => x.crewUid));

export function sendExpedition(e, crewUid, destId, days) {
  e._requireIdle();
  const ex = e.state.exped;
  const d = getDest(destId);
  if (!d) throw new Error('Tujuan tidak dikenal');
  if (!EXPED_DAYS.includes(days)) throw new Error('Lama ekspedisi tidak valid');
  const m = e.state.crew.hired.find((x) => x.uid === crewUid);
  if (!m) throw new Error('Karyawan tidak ada');
  if (awayCrew(e).has(crewUid)) throw new Error('Karyawan sedang dalam ekspedisi');
  if (ex.active.length >= 3) throw new Error('Maksimal 3 ekspedisi berjalan');
  const cost = d.cost * days;
  debit(e.state.ledger, e.state.day, 'expedition', cost, `Bekal ekspedisi ${d.name}`);
  m.away = true;
  ex.active.push({ id: ex.nextId++, crewUid, dest: destId, days, backDay: e.state.day + days });
  return cost;
}

// Dipanggil saat hari berganti. Mengembalikan daftar hasil untuk UI.
export function resolveExpeditions(e) {
  const s = e.state;
  const ex = s.exped;
  const out = [];
  ex.active = ex.active.filter((x) => {
    if (s.day < x.backDay) return true;
    const m = s.crew.hired.find((c) => c.uid === x.crewUid);
    if (m) delete m.away;
    const d = getDest(x.dest);
    const rng = mulberry32(hashSeed(s.seed, 'exped', x.id));
    const res = { dest: d.id, name: d.name, days: x.days, crew: m ? getStaff(m.type).name : 'Karyawan', failed: false, animals: [], sold: 0, pet: null, cash: 0 };
    const risk = Math.max(0.02, d.risk - 0.03 * (x.days - 1) - 0.02 * ((m?.lvl || 1) - 1));
    if (rng() < risk) {
      res.failed = true;
    } else {
      const n = x.days + (rng() < 0.5 ? 1 : 0) + (m && m.lvl >= 3 ? 1 : 0);
      const pool = e.unlockedItems().filter((i) => d.cats.includes(i.cat) && i.tier >= 2);
      const luck = 2 + x.days * 1.5 + farm.farmBuffs(e).luck * 10;
      for (let k = 0; k < n && pool.length; k++) {
        const it = pool[Math.floor(rng() * pool.length)];
        const r = farm.rollRarity(rng, luck);
        const animal = { id: s.farm.nextAnimal++, itemId: it.id, rarity: farm.RARITIES[r].id, size: farm.rollSize(rng, 0.3), cost: 0 };
        const book = (s.farm.book[it.id] ||= {});
        const rec = book[animal.rarity] || { n: 0, best: 0 };
        rec.n += 1; rec.best = Math.max(rec.best, animal.size);
        book[animal.rarity] = rec;
        if (farm.stockFull(e)) {
          const v = Math.max(1, Math.round(farm.animalValue(animal) * farm.DEALER_RATE));
          credit(s.ledger, s.day, 'sale', v, `Hasil ekspedisi ${d.name} (gudang penuh, dijual)`);
          res.sold += v;
        } else s.farm.animals.push(animal);
        res.animals.push({ itemId: it.id, rarity: animal.rarity });
        s.stats.bred += 1;
      }
      if (rng() < 0.12 + 0.06 * x.days && s.pets.owned.length < farm.petMax(e)) {
        const rr = farm.rollRarity(rng, 3);
        const kinds = farm.PET_KINDS;
        const pet = { id: s.pets.nextId++, kind: kinds[Math.floor(rng() * kinds.length)].id, rarity: farm.RARITIES[rr].id };
        s.pets.owned.push(pet);
        farm.noteBookPet(s.pets, pet);
        res.pet = { kind: pet.kind, rarity: pet.rarity };
      }
      const bonus = Math.round(d.cost * x.days * (0.5 + rng()));
      if (bonus > 0) { credit(s.ledger, s.day, 'expedition', bonus, `Temuan ekspedisi ${d.name}`); res.cash = bonus; }
      ex.done += 1;
    }
    ex.last = res;
    out.push(res);
    return false;
  });
  return out;
}

// ---------- Prestise ----------
export const PRESTIGE_MIN_STARS = 3;
export const PUPS = [
  { id: 'pgold', name: 'Lidah Emas Abadi', icon: '💰', max: 10, per: 0.05, unit: '% bayaran pelanggan', desc: '+5% bayaran pelanggan tiap rank.' },
  { id: 'pcust', name: 'Nama Besar', icon: '📣', max: 10, per: 0.03, unit: '% pelanggan', desc: '+3% jumlah pelanggan tiap rank.' },
  { id: 'pgudang', name: 'Gudang Warisan', icon: '📦', max: 5, per: 20, unit: ' kapasitas gudang', desc: '+20 kapasitas gudang tiap rank.' },
  { id: 'pslot', name: 'Tim Veteran', icon: '👥', max: 3, per: 1, unit: ' slot karyawan', desc: '+1 slot karyawan tiap rank.' },
  { id: 'pmodal', name: 'Modal Warisan', icon: '🪙', max: 8, per: 40000, unit: ' modal awal', desc: '+Rp40.000 modal awal tiap rank.' },
];
export const newPrestige = () => ({ points: 0, spent: {}, runs: 0, best: { day: 0, revenue: 0, stars: 1 }, totalRevenue: 0 });
export const pup = (e, id) => (e.state.prestige?.spent?.[id]) || 0;
export const pupCost = (rank) => 2 + rank;

export function prestigeGain(e) {
  const s = e.state;
  const rev = s.stats.revenue || 0;
  return Math.max(0, Math.floor(Math.sqrt(rev / 100000)) + 3 * (s.stars - 1) + Math.floor(s.day / 25));
}
export const canPrestige = (e) => e.state.stars >= PRESTIGE_MIN_STARS && e.state.phase === 'idle';

export function buyPup(e, id) {
  const def = PUPS.find((p) => p.id === id);
  if (!def) throw new Error('Bonus tidak dikenal');
  const pr = e.state.prestige;
  const rank = pup(e, id);
  if (rank >= def.max) throw new Error('Sudah maksimal');
  const cost = pupCost(rank);
  if (pr.points < cost) throw new Error('Poin Legenda kurang');
  pr.points -= cost;
  pr.spent[id] = rank + 1;
  return cost;
}

// Mulai musim baru: uang, toko, hewan, dan karyawan di-reset. Skill, perk, atribut, koleksi, pet, dan cerita dibawa.
export function prestigeNow(e, newStateFn) {
  if (!canPrestige(e)) throw new Error(`Butuh bintang ${PRESTIGE_MIN_STARS} dan toko tutup`);
  const old = e.state;
  const gain = prestigeGain(e);
  const fresh = newStateFn(old.seed + old.day + 1);
  const pr = { ...old.prestige };
  pr.points += gain;
  pr.runs += 1;
  pr.totalRevenue += old.stats.revenue || 0;
  pr.best = { day: Math.max(pr.best.day, old.day), revenue: Math.max(pr.best.revenue, old.stats.bestDay || 0), stars: Math.max(pr.best.stars, old.stars) };
  fresh.prestige = pr;
  fresh.skills = old.skills;
  fresh.attrs = old.attrs;
  fresh.story = old.story;
  fresh.ach = old.ach;
  fresh.pets = old.pets;
  fresh.farm.book = old.farm.book;
  fresh.policy = old.policy;
  fresh.exped = newExped();
  fresh.cities = newCities();
  fresh.regulars = {};
  fresh.stats.bestRar = old.stats.bestRar || 0;
  fresh.crew.bonusSlots = old.crew.bonusSlots;
  fresh.tutorial = { step: 0, done: true };
  const start = START_CASH + 40000 * (pr.spent.pmodal || 0);
  if (start > START_CASH) credit(fresh.ledger, 1, 'bonus', start - START_CASH, 'Modal Warisan');
  fresh.history = [];
  return { state: fresh, gain };
}
