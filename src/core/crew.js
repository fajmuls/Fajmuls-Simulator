// Sistem karyawan: slot dari skill, lisensi atau misi, level, buff tunggal, dan keputusan kerja (kasir, penjaga stok).
// Semua fungsi menerima engine `e` dan hanya memakai state, sehingga bisa diuji tanpa Phaser.
import { getStaff, getItem, CREW_UPGRADE_MULS, CREW_MAX_LEVEL } from './catalog.js';
import { debit } from './ledger.js';
import * as farm from './farm.js';

export const newCrew = () => ({ licenses: {}, hired: [], nextUid: 1, bonusSlots: 0, keeper: { rules: {}, harvest: true, autoBuy: true } });

export const crewSlots = (e) => (e.state.skills.tim || 0) + (e.state.crew.bonusSlots || 0);
export const crewList = (e) => e.state.crew.hired;
export const crewCount = (e, type) => e.state.crew.hired.filter((m) => m.type === type).length;
export const levelMul = (m) => 1 + 0.25 * (m.lvl - 1); // kekuatan efek dan kecepatan kerja per level

export function crewStat(e, stat) {
  const s = e.state;
  switch (stat) {
    case 'customers': return s.stats.customers || 0;
    case 'stars': return s.stars;
    case 'bred': return s.stats.bred || 0;
    case 'planted': return s.stats.planted || 0;
    case 'stolen': return s.stats.stolen || 0;
    case 'bestRar': return (s.stats.bestRar || 0);
    default: return 0;
  }
}

// Status satu jenis karyawan: terbuka lewat lisensi atau misi.
export function crewStatus(e, type) {
  const def = getStaff(type);
  const have = crewStat(e, def.mission.stat);
  const missionDone = have >= def.mission.goal;
  const licensed = !!e.state.crew.licenses[type];
  return { def, have, goal: def.mission.goal, missionDone, licensed, unlocked: licensed || missionDone, via: licensed ? 'lisensi' : missionDone ? 'misi' : null };
}

export function buyLicense(e, type) {
  const st = crewStatus(e, type);
  if (st.def.secret) throw new Error('Karyawan rahasia hanya terbuka lewat misi');
  if (st.unlocked) throw new Error('Sudah terbuka');
  debit(e.state.ledger, e.state.day, 'license', st.def.license, `Lisensi ${st.def.name}`);
  e.state.crew.licenses[type] = true;
  return st.def.license;
}

export const wageOf = (e, m) => {
  const def = getStaff(m.type);
  const cut = Math.min(0.6, 0.08 * (e.state.skills.akuntan || 0));
  return Math.round(def.wage * 1.5 * (1 + 0.15 * (m.lvl - 1)) * (1 - cut));
};
export const totalWages = (e) => e.state.crew.hired.reduce((n, m) => n + wageOf(e, m), 0);

export function hire(e, type) {
  const st = crewStatus(e, type);
  if (!st.unlocked) throw new Error(`${st.def.name} belum terbuka`);
  const c = e.state.crew;
  if (c.hired.length >= crewSlots(e)) throw new Error(crewSlots(e) === 0 ? 'Belum ada slot karyawan. Pelajari skill Manajemen Tim' : 'Slot karyawan penuh');
  if (crewCount(e, type) >= st.def.max) throw new Error(`${st.def.name} maksimal ${st.def.max} orang`);
  const m = { uid: c.nextUid++, type, lvl: 1 };
  c.hired.push(m);
  return m;
}

export function fire(e, uid) {
  const c = e.state.crew;
  const i = c.hired.findIndex((m) => m.uid === uid);
  if (i < 0) throw new Error('Karyawan tidak ada');
  c.hired.splice(i, 1);
}

export function upgradeCost(e, m) {
  if (m.lvl >= CREW_MAX_LEVEL) return null;
  const def = getStaff(m.type);
  return Math.round(def.wage * 1.5 * CREW_UPGRADE_MULS[m.lvl - 1] * (def.secret ? 1.5 : 1));
}

export function upgrade(e, uid) {
  const m = e.state.crew.hired.find((x) => x.uid === uid);
  if (!m) throw new Error('Karyawan tidak ada');
  const cost = upgradeCost(e, m);
  if (cost === null) throw new Error('Sudah level maksimal');
  debit(e.state.ledger, e.state.day, 'crew', cost, `Naik level ${getStaff(m.type).name}`);
  m.lvl += 1;
  return cost;
}

// Jumlah efek buff dari semua karyawan jenis tertentu (kunci: patience, count, grow, harvest, luck).
export function crewBuff(e, key) {
  let v = 0;
  for (const m of e.state.crew.hired) {
    const def = getStaff(m.type);
    if (def.buff && def.buff.key === key) v += def.buff.per * levelMul(m);
  }
  return v;
}

// Detik antar pekerjaan. Awal lambat, makin cepat dengan level dan skill Tim Sigap.
const BASE_INTERVAL = { kasir: 7, penjaga: 16 };
export function workInterval(e, m) {
  const speed = levelMul(m) * (1 + 0.1 * (e.state.skills.tim_cepat || 0));
  return BASE_INTERVAL[getStaff(m.type).job] / speed;
}

// Peluang total satpam mengusir pencuri (digabung dari semua satpam).
export function guardChance(e) {
  let miss = 1;
  for (const m of e.state.crew.hired) if (m.type === 'satpam') miss *= 1 - Math.min(0.95, 0.7 * levelMul(m) * 0.85);
  return 1 - miss;
}

// ---------- Kasir ----------
// Hewan termurah yang memenuhi pesanan: jenis cocok dan rarity cukup.
export function pickAnimalFor(e, customer, wantIdx) {
  const info = e.orderInfo(customer, wantIdx);
  let best = null;
  for (const a of e.state.farm.animals) {
    if (a.itemId !== info.itemId) continue;
    if (farm.rarityIdx(a.rarity) + 1 < info.minQuality) continue;
    if (!best || farm.animalValue(a) < farm.animalValue(best)) best = a;
  }
  return best ? best.id : null;
}

// ---------- Penjaga stok ----------
export function setKeeperRule(e, itemId, rule) {
  getItem(itemId);
  const c = e.state.crew.keeper;
  const below = Math.max(0, Math.min(50, Math.floor(rule.below || 0)));
  if (below === 0) { delete c.rules[itemId]; return null; }
  const qty = Math.max(1, Math.min(6, Math.floor(rule.qty || 1)));
  const feed = rule.feed ? farm.getFeed(rule.feed).id : null;
  c.rules[itemId] = { below, qty, feed };
  return c.rules[itemId];
}

export function setKeeperOpts(e, patch) {
  const c = e.state.crew.keeper;
  if (typeof patch.harvest === 'boolean') c.harvest = patch.harvest;
  if (typeof patch.autoBuy === 'boolean') c.autoBuy = patch.autoBuy;
}

// Stok satu spesies: hewan jadi di gudang + yang sedang tumbuh.
export function stockOf(e, itemId) {
  let n = farm.animalCount(e, itemId);
  for (const lots of e.state.farm.slots) for (const l of lots || []) if (l.itemId === itemId) n += farm.slotQty(l);
  return n;
}

// Rencana pekerjaan berikutnya (tanpa mengubah state). `busy` = lahan yang sedang dikerjakan karyawan lain.
export function keeperPlan(e, busy = new Set()) {
  const k = e.state.crew.keeper;
  const fm = e.state.farm;
  if (k.harvest) {
    for (let i = 0; i < fm.slots.length; i++) if (!busy.has(i) && farm.spotReady(e, i) > 0) return { type: 'panen', slot: i };
  }
  const reserve = e.dailyObligations();
  let best = null;
  for (const [itemId, rule] of Object.entries(k.rules)) {
    if (!e.isUnlocked(itemId)) continue;
    const have = stockOf(e, itemId);
    if (have >= rule.below) continue;
    const hab = farm.habitatOf(itemId).id;
    const slot = fm.habs.findIndex((h, i) => h === hab && !busy.has(i) && farm.spotFree(e, i) > 0);
    if (slot < 0) continue;
    const qty = Math.min(rule.qty, rule.below - have, farm.spotFree(e, slot));
    const owned = fm.bibit[itemId] || 0;
    let buy = 0;
    if (owned < qty) {
      if (!k.autoBuy) continue;
      buy = qty - owned;
      if (e.state.ledger.balance - reserve < farm.bibitPrice(e, itemId) * buy) continue;
    }
    const feed = rule.feed && (fm.feeds[rule.feed] || 0) >= qty && farm.feedOpen(e, farm.getFeed(rule.feed)) ? rule.feed : null;
    const deficit = rule.below - have;
    if (!best || deficit > best.deficit) best = { type: 'tanam', slot, itemId, qty, feed, buy, deficit };
  }
  return best;
}

export function keeperPerform(e, plan) {
  if (plan.type === 'panen') return { type: 'panen', animals: farm.harvestSpot(e, plan.slot) };
  if (plan.buy > 0) farm.buyBibit(e, plan.itemId, plan.buy);
  farm.plant(e, plan.slot, plan.itemId, plan.feed, plan.qty);
  return { type: 'tanam', itemId: plan.itemId, qty: plan.qty };
}

