import {
  CATEGORIES, ITEMS, CUSTOMER_TYPES, UPGRADES, QUALITIES, SKILLS, POTIONS, STAFF, SHARES, PROPERTIES, EVENTS,
  SHOP_LEVELS, STAR_THRESH, STAR_POINTS, STAR_PERKS, DEPOSIT_TERMS, DEPOSIT_MIN, DEPOSIT_MAX_ACTIVE,
  SHARE_MIN_PRICE, SHARE_SELL_FEE, SHARE_HISTORY, PROPERTY_SELL_RATE, LOAN_TERMS, LOAN_MIN, LOAN_STEP,
  LOAN_MAX_ACTIVE, LOAN_LATE_FEE, BREED_FEE_RATE, BREED_BASE_SLOTS, SKILL_POINT_EVERY_DAYS, SKILL_POINT_EVERY_FULL_DAYS,
  BASE_CAPACITY, CAPACITY_PER_RAK, BASE_MAX_QUALITY, START_CASH, DAILY_RENT,
  SPEED_STEPS, UPKEEP_PER_ANIMAL, UPKEEP_SHOP_STEP, SICK_CHANCE, THEFT_CHANCE, THIEF_FROM_DAY, THIEF_DAY_CHANCE, THIEF_CATCH_SATPAM, TAX_BRACKETS, WEALTH_TAX_FROM, WEALTH_TAX_RATE,
  getItem, getCategory, getQuality, getUpgrade, getSkill, getPotion, getStaff, getShare, getProperty,
  lotKey, parseLotKey, starsFor,
} from './catalog.js';
import { createLedger, credit, debit, sumByType } from './ledger.js';
import { mulberry32, hashSeed, pickWeighted } from './rng.js';
import * as farm from './farm.js';
import * as story from './story.js';
import { planRegulars, onRegularPaid, maxBondLevel, claimRegular } from './regulars.js';
import { ensureQuests, trackQuests, claimQuest, checkAchievements, claimAchievement } from './goals.js';

export const DAY_LENGTH_SEC = 90; // lama jendela pelanggan datang pada kecepatan 1x
export const STATE_VERSION = 8;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function priceStep(ref) {
  return ref < 2000 ? 10 : ref < 20000 ? 50 : 100;
}
const floorToStep = (v, step) => Math.max(1, Math.floor(v / step) * step);

function initShares(seed) {
  const out = {};
  for (const sh of SHARES) {
    const jitter = 0.9 + mulberry32(hashSeed(seed, 'share0', sh.id))() * 0.2;
    const price = Math.max(SHARE_MIN_PRICE, Math.round(sh.start * jitter));
    out[sh.id] = { price, hist: [price] };
  }
  return out;
}

export function newState(seed = Date.now() % 2147483647) {
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  const sd = Math.abs(Math.floor(seed)) || 1;
  return {
    v: STATE_VERSION,
    seed: sd,
    day: 1,
    phase: 'idle',
    ledger: createLedger(START_CASH),
    stock: {}, // "itemId:q" -> { qty, cost }  (cost = total modal stok itu)
    prices: {}, // "itemId:q" -> harga jual per unit
    species: {}, // itemId -> true (spesies yang sudah dibuka dengan uang)
    shopLevel: 1,
    upgrades,
    skills: {},
    potions: {},
    buffs: {},
    staff: {},
    restock: {}, // itemId -> { target, q }
    autoPrice: { on: false, pct: 0 },
    lastBuy: {}, // itemId -> { q, n }
    breeding: [],
    deposits: [],
    shares: {}, // shareId -> { qty, cost }
    sharePrices: initShares(sd),
    properties: {},
    loans: [],
    nextId: 1,
    reputation: 10,
    stars: 1,
    arrears: 0, // tunggakan sewa dan gaji
    stats: { revenue: 0, customers: 0, bestDay: 0, items: {}, sold: 0, bought: 0, bred: 0, questsDone: 0, planted: 0, hatched: 0, bestRar: 0 },
    story: { ch: 0, done: false, intro: -1 },
    quests: { dayId: 0, weekId: -1, daily: [], weekly: [] }, // misi aktif (dibuat deterministik per hari/minggu)
    ach: {}, // id pencapaian -> { day, claimed }
    bonusPoints: 0, // poin skill tambahan dari hadiah
    regulars: {}, // id pelanggan langganan -> { bond, visits, last }
    tutorial: { step: 0, done: false },
    farm: farm.newFarm(),
    pets: farm.newPets(),
    history: [],
  };
}

// Mengubah simpanan lama ke bentuk terbaru. Tidak mengubah objek masukan.
export function migrate(input) {
  if (!input || typeof input !== 'object') return input;
  if (input.v === STATE_VERSION) return input;
  if (input.v === 1) return migrate(migrateV1(input));
  if (input.v === 2) return migrate(migrateV2(input));
  if (input.v === 3) return migrate(migrateV3(input));
  if (input.v === 4) return migrate(migrateV4(input));
  if (input.v === 5) return migrate(migrateV5(input));
  if (input.v === 6) return migrate(migrateV6(input));
  if (input.v === 7) return migrateV7(input);
  return input;
}

function migrateV2(input) {
  const s = structuredClone(input);
  const base = newState(s.seed);
  s.v = 3;
  s.upgrades = { ...base.upgrades, ...s.upgrades };
  s.stats = { ...base.stats, ...s.stats, items: s.stats?.items || {} };
  return s;
}

// v3 -> v4: misi, pencapaian, pelanggan langganan, tutorial. Pemain lama tidak perlu tutorial.
function migrateV3(input) {
  const s = structuredClone(input);
  const base = newState(s.seed);
  s.v = 4;
  const soldUnits = Object.values(s.stats?.items || {}).reduce((a, b) => a + (b.units || 0), 0);
  s.stats = { ...base.stats, ...s.stats, sold: s.stats?.sold ?? soldUnits };
  s.quests = base.quests;
  s.ach = {};
  s.bonusPoints = 0;
  s.regulars = {};
  s.tutorial = { step: 0, done: s.day > 1 || Object.keys(s.stock || {}).length > 0 };
  return s;
}

// v5 -> v6: habitat di peta, cerita, statistik peternakan.
// v7 -> v8: lahan berlevel dengan daftar penghuni (lots). Satu isi lama menjadi satu penghuni.
function migrateV7(input) {
  const s = structuredClone(input);
  s.v = 8;
  const fm = s.farm;
  if (Array.isArray(fm.levels) && fm.slots.every((x) => Array.isArray(x))) return s; // sudah format baru
  fm.levels = fm.slots.map((x) => {
    const q = x && !Array.isArray(x) ? (x.qty || 1) : 0;
    return q > 4 ? 3 : q > 2 ? 2 : 1;
  });
  fm.slots = fm.slots.map((x) => (Array.isArray(x) ? x : x ? [x] : []));
  return s;
}

// v6 -> v7: buku koleksi pet (pet yang sudah dimiliki dicatat).
function migrateV6(input) {
  const s = structuredClone(input);
  s.v = 7;
  s.pets = s.pets || farm.newPets();
  s.pets.book = {};
  for (const p of s.pets.owned) farm.noteBookPet(s.pets, p);
  return s;
}

function migrateV5(input) {
  const s = structuredClone(input);
  s.v = 6;
  const fm = s.farm;
  const cycle = ['kebun', 'kolam', 'kolam', 'kandang', 'kolam', 'kandang', 'kolam', 'kandang', 'kandang'];
  const count = {};
  const want = (h) => ({ kolam: 4, kebun: 2, kandang: 5 }[h]);
  fm.habs = fm.slots.map((slot, i) => {
    let h = cycle[i % cycle.length];
    if (slot && slot.itemId) h = farm.habitatOf(slot.itemId).id;
    count[h] = (count[h] || 0) + 1;
    return h;
  });
  // Pastikan tidak ada habitat yang melebihi batas.
  for (let i = 0; i < fm.habs.length; i++) {
    if (!slot_ok(fm.habs, i, want)) fm.habs[i] = ['kolam', 'kebun', 'kandang'].find((h) => fm.habs.filter((x) => x === h).length < want(h)) || 'kolam';
  }
  s.stats = { ...s.stats, planted: s.stats?.planted || 0, hatched: s.stats?.hatched || 0, bestRar: s.stats?.bestRar || 0 };
  s.story = { ch: 0, done: false, intro: -1 };
  return s;
}
const slot_ok = (habs, i, want) => habs.slice(0, i + 1).filter((x) => x === habs[i]).length <= want(habs[i]);

// v4 -> v5: peternakan. Stok lama menjadi hewan common berukuran normal, rak dikosongkan.
function migrateV4(input) {
  const s = structuredClone(input);
  s.v = 5;
  s.farm = farm.newFarm();
  s.pets = farm.newPets();
  let n = 0;
  for (const [key, lot] of Object.entries(s.stock || {})) {
    const { itemId } = parseLotKey(key);
    const per = lot.qty > 0 ? Math.round(lot.cost / lot.qty) : 0;
    for (let i = 0; i < lot.qty && n < 200; i++, n++) {
      s.farm.animals.push({ id: s.farm.nextAnimal++, itemId, rarity: 'common', size: 1, cost: per });
    }
  }
  s.stock = {};
  s.prices = {};
  s.restock = {};
  s.breeding = [];
  return s;
}

function migrateV1(input) {
  const s = structuredClone(input);
  const base = newState(s.seed);
  s.v = 2;
  const upgrades = { ...base.upgrades };
  for (const [k, v] of Object.entries(s.upgrades || {})) if (k in upgrades) upgrades[k] = v;
  s.upgrades = upgrades;
  s.shopLevel = 1;
  s.species = {};
  // Spesies yang pernah dimiliki (atau sudah terbuka di versi 1) tetap terbuka, termasuk tier di bawahnya.
  const maxTier = {};
  const mark = (itemId) => {
    const it = ITEMS.find((i) => i.id === itemId);
    if (it) maxTier[it.cat] = Math.max(maxTier[it.cat] || 0, it.tier);
  };
  for (const key of Object.keys(s.stock || {})) mark(parseLotKey(key).itemId);
  for (const key of Object.keys(s.prices || {})) mark(parseLotKey(key).itemId);
  if (upgrades.supplier >= 1) mark('koi');
  for (const it of ITEMS) if (it.unlockCost > 0 && it.tier <= (maxTier[it.cat] || 0)) s.species[it.id] = true;
  Object.assign(s, {
    skills: {}, potions: {}, buffs: {}, staff: {}, restock: {}, autoPrice: { on: false, pct: 0 }, lastBuy: {},
    breeding: [], deposits: [], shares: {}, sharePrices: base.sharePrices, properties: {}, loans: [], nextId: 1,
  });
  s.stars = starsFor(s.reputation);
  return s;
}

const catIndex = (id) => CATEGORIES.findIndex((c) => c.id === id);

export class GameEngine {
  constructor(state = newState()) {
    this.state = state;
    this.reserved = new Map(); // customerId -> [{key, qty, cost, revenue}]
    this.plan = [];
    this.today = null;
    this.lastRestock = [];
    this.notes = []; // pesan sementara untuk UI (hadiah otomatis dll), tidak disimpan
    this._marketCache = new Map();
    this.now = () => Date.now(); // dapat diganti pada tes
  }

  // Mengganti seluruh state (game baru / impor) tanpa membuat engine baru.
  replaceState(state) {
    this.state = state;
    this.reserved.clear();
    this.plan = [];
    this.today = null;
    this.lastRestock = [];
    this._marketCache.clear();
  }

  // ---------- Misi dan pencapaian (lihat goals.js) ----------
  ensureQuests() { return ensureQuests(this); }
  track(kind, n = 1, extra = {}) { trackQuests(this, kind, n, extra); }
  claimQuest(scope, index) { return claimQuest(this, scope, index); }
  checkAchievements() { return checkAchievements(this); }
  claimAchievement(id) { return claimAchievement(this, id); }
  maxBondLevel() { return maxBondLevel(this); }
  claimRegular(id) { return claimRegular(this, id); }
  // ---------- Peternakan dan pet (lihat farm.js) ----------
  bibitPrice(itemId) { return farm.bibitPrice(this, itemId); }
  buyBibit(itemId, n) { return farm.buyBibit(this, itemId, n); }
  buyFeed(id, n) { return farm.buyFeed(this, id, n); }
  buySlot(hab) { return farm.buySlot(this, hab); }
  storyNow() { return story.storyNow(this); }
  claimStory() { return story.claimStory(this); }
  markStoryIntro() { story.markIntro(this); }
  plant(slot, itemId, feedId, qty = 1) { return farm.plant(this, slot, itemId, feedId, qty); }
  slotProgress(slot, k = 0) { return farm.slotProgress(this, slot, k); }
  harvest(slot, k = 0) { return farm.harvest(this, slot, k); }
  upgradeSpot(slot) { return farm.upgradeSpot(this, slot); }
  spotReady(slot) { return farm.spotReady(this, slot); }
  harvestSpot(slot) { return farm.harvestSpot(this, slot); }
  harvestAll() { return farm.harvestAll(this); }
  animalCount(itemId) { return farm.animalCount(this, itemId); }
  dealerSell(id) { return farm.dealerSell(this, id); }
  hatch(eggId) { return farm.hatch(this, eggId); }
  equipPet(id) { return farm.equipPet(this, id); }
  unequipPet(id) { return farm.unequipPet(this, id); }
  releasePet(id) { return farm.releasePet(this, id); }
  sellPet(id) { return farm.releasePet(this, id); }
  sellSparePets(maxIdx) { return farm.sellSpare(this, maxIdx); }
  petSlots() { return farm.petSlots(this); }
  farmBuffs() { return farm.farmBuffs(this); }
  takeNotes() { const n = this.notes; this.notes = []; return n; }

  _requireIdle() {
    if (this.state.phase !== 'idle') throw new Error('Tutup toko dulu untuk melakukan ini');
  }

  _requireStars(n, what) {
    if (this.state.stars < n) throw new Error(`${what} terbuka di bintang ${n}`);
  }

  _id() {
    return this.state.nextId++;
  }

  // ---------- Event, bintang, pengubah ----------
  eventOf(day = this.state.day) {
    if (day <= 1) return EVENTS[0];
    const rng = mulberry32(hashSeed(this.state.seed, 'event', day));
    const pick = pickWeighted(rng, EVENTS.map((e) => ({ ...e, weight: e.weight })));
    return EVENTS.find((e) => e.id === pick.id);
  }

  perks() {
    return STAR_PERKS[this.state.stars - 1];
  }

  starProgress() {
    const s = this.state;
    if (s.stars >= STAR_THRESH.length) return { stars: s.stars, rep: s.reputation, from: STAR_THRESH[s.stars - 1], to: null, pct: 100 };
    const from = STAR_THRESH[s.stars - 1];
    const to = STAR_THRESH[s.stars];
    return { stars: s.stars, rep: s.reputation, from, to, pct: clamp(Math.round(((s.reputation - from) / (to - from)) * 100), 0, 100) };
  }

  mods() {
    const s = this.state;
    const P = this.perks();
    const ev = this.eventOf(s.day);
    const sk = (id) => s.skills[id] || 0;
    const up = (id) => s.upgrades[id] || 0;
    const bf = (id) => (s.buffs[id] || 0) > 0;
    const hasStaff = (id) => !!s.staff[id];
    const count = P.count * (1 + 0.12 * up('dekorasi')) * (1 + 0.08 * sk('promosi')) * (bf('pemikat') ? 1.3 : 1) * (hasStaff('pramuniaga') ? 1.1 : 1) * (hasStaff('badut') ? 1.15 : 1) * (1 + 0.1 * up('renovasi')) * ev.count;
    const disc = Math.min(0.5, P.disc + 0.025 * sk('tawar') + 0.03 * up('member') + (bf('borong') ? 0.12 : 0));
    const wtp = P.wtp + 0.03 * sk('harga_prima') + (bf('hartawan') ? 0.15 : 0) + ev.wtp;
    const vip = P.vip * (1 + 0.15 * sk('vipmagnet')) * (bf('vip') ? 2 : 1) * ev.vip;
    const rentCut = Math.min(0.6, P.rent + 0.1 * sk('juragan'));
    const rentBase = Math.round(DAILY_RENT * (1 + 0.6 * (s.shopLevel - 1)) * (1 + 0.25 * (s.stars - 1)));
    const rent = Math.max(0, Math.round(rentBase * (1 - rentCut)));
    const repGain = (1 + 0.12 * sk('ramah') + 0.1 * sk('viral') + (bf('sahabat') ? 0.5 : 0)) * (hasStaff('satpam') ? 1.1 : 1);
    const repLoss = Math.max(0.1, 1 - 0.12 * sk('ramah') - (bf('sahabat') ? 0.5 : 0));
    const payTime = Math.max(0.15, 1 - 0.15 * up('kasir_modern') - 0.12 * sk('kasir_cepat') - (hasStaff('kasir') ? 0.45 : 0));
    const payMul = 1 + 0.05 * sk('lidah_emas');
    return { count, disc, wtp, vip, rent, repGain, repLoss, payTime, payMul, event: ev };
  }

  wageOf(st) {
    const cut = Math.min(0.6, 0.08 * (this.state.skills.akuntan || 0));
    return Math.round(st.wage * 1.5 * (1 - cut));
  }

  wages() {
    return STAFF.reduce((sum, st) => sum + (this.state.staff[st.id] ? this.wageOf(st) : 0), 0);
  }


  loanDue() {
    return this.state.loans.reduce((sum, l) => sum + (l.daysLeft > 0 ? Math.min(l.perDay, l.remaining) : l.remaining), 0);
  }

  dailyObligations() {
    return this.mods().rent + this.wages() + this.loanDue();
  }

  // ---------- Pasar ----------
  _factors(day) {
    if (this._marketCache.has(day)) return this._marketCache.get(day);
    const rng = mulberry32(hashSeed(this.state.seed, 'market', day));
    const f = {};
    for (const it of ITEMS) f[it.id] = { wf: 0.9 + rng() * 0.2, rf: 0.94 + rng() * 0.12 };
    this._marketCache.set(day, f);
    return f;
  }

  // Harga grosir sebelum diskon pemain
  wholesaleBase(itemId, quality, day = this.state.day) {
    const it = getItem(itemId);
    const q = getQuality(quality);
    return Math.max(1, Math.round(it.wholesale * q.mult * this._factors(day)[itemId].wf * this.eventOf(day).wholesale));
  }

  // Harga grosir yang benar-benar dibayar (sudah termasuk diskon)
  wholesalePrice(itemId, quality, day = this.state.day) {
    return Math.max(1, Math.round(this.wholesaleBase(itemId, quality, day) * (1 - this.mods().disc)));
  }

  retailRef(itemId, quality, day = this.state.day) {
    const it = getItem(itemId);
    const q = getQuality(quality);
    return Math.max(1, Math.round(it.retail * q.mult * this._factors(day)[itemId].rf));
  }

  // Harga pasar dengan selisih persen (mis. -10). Dibulatkan ke bawah ke kelipatan yang rapi.
  marketPrice(itemId, quality, pct = 0) {
    const ref = this.retailRef(itemId, quality);
    return floorToStep(ref * (1 + pct / 100), priceStep(ref));
  }

  suggestedPrice(itemId, quality) {
    return this.marketPrice(itemId, quality, 0);
  }

  // ---------- Kapasitas, kunci, spesies ----------
  capacity() {
    const s = this.state;
    const shop = SHOP_LEVELS.slice(0, s.shopLevel).reduce((sum, l) => sum + l.capacity, 0);
    return BASE_CAPACITY + shop + s.upgrades.rak * CAPACITY_PER_RAK + 12 * (s.skills.gudang || 0);
  }

  usedCapacity() {
    let n = 0;
    for (const lot of Object.values(this.state.stock)) n += lot.qty;
    n += this.state.breeding.length * 2;
    return n;
  }

  maxQuality() {
    return Math.min(QUALITIES.length, BASE_MAX_QUALITY + this.state.upgrades.supplier);
  }

  categoryOpen(catId) {
    return this.state.shopLevel >= getCategory(catId).needShop;
  }

  isUnlocked(itemId) {
    const it = getItem(itemId);
    if (!this.categoryOpen(it.cat)) return false;
    return it.unlockCost === 0 || !!this.state.species[itemId];
  }

  unlockedItems() {
    return ITEMS.filter((i) => this.isUnlocked(i.id));
  }

  // Status pembukaan spesies untuk daftar hewan
  speciesStatus(itemId) {
    const it = getItem(itemId);
    if (!this.categoryOpen(it.cat)) return { state: 'kategori', needShop: getCategory(it.cat).needShop };
    if (this.isUnlocked(itemId)) return { state: 'terbuka' };
    const prev = ITEMS.find((i) => i.cat === it.cat && i.tier === it.tier - 1);
    if (prev && !this.isUnlocked(prev.id)) return { state: 'urut', prev: prev.id };
    return { state: 'bisa', cost: it.unlockCost };
  }

  unlockSpecies(itemId) {
    this._requireIdle();
    const st = this.speciesStatus(itemId);
    if (st.state === 'terbuka') throw new Error('Spesies sudah terbuka');
    if (st.state === 'kategori') throw new Error('Perluas toko dulu untuk membuka kategori ini');
    if (st.state === 'urut') throw new Error('Buka spesies sebelumnya dulu');
    const it = getItem(itemId);
    debit(this.state.ledger, this.state.day, 'species', it.unlockCost, `Kontrak spesies ${it.name}`);
    this.state.species[itemId] = true;
    return it.unlockCost;
  }

  // ---------- Level toko dan upgrade ----------
  nextShopLevel() {
    const next = SHOP_LEVELS[this.state.shopLevel];
    return next || null;
  }

  expandShop() {
    this._requireIdle();
    const next = this.nextShopLevel();
    if (!next) throw new Error('Toko sudah level maksimum');
    if (this.state.stars < next.needStars) throw new Error(`Butuh bintang ${next.needStars} untuk memperluas toko`);
    debit(this.state.ledger, this.state.day, 'expand', next.cost, `Perluas toko jadi ${next.name}`);
    this.state.shopLevel = next.level;
    return next.cost;
  }

  upgradeAvailable(id) {
    const u = getUpgrade(id);
    if (u.needShop && this.state.shopLevel < u.needShop) return false;
    return !u.needCat || this.categoryOpen(u.needCat);
  }

  upgradeCost(id) {
    const u = getUpgrade(id);
    const lvl = this.state.upgrades[id] || 0;
    return lvl >= u.costs.length ? null : u.costs[lvl];
  }

  buyUpgrade(id) {
    this._requireIdle();
    if (!this.upgradeAvailable(id)) throw new Error('Syarat upgrade belum terpenuhi (kategori atau level toko)');
    const cost = this.upgradeCost(id);
    if (cost === null) throw new Error('Upgrade sudah level maksimum');
    debit(this.state.ledger, this.state.day, 'upgrade', cost, `Upgrade ${getUpgrade(id).name}`);
    this.state.upgrades[id] = (this.state.upgrades[id] || 0) + 1;
    return cost;
  }

  maxSpeed() {
    return SPEED_STEPS[Math.min(SPEED_STEPS.length - 1, this.state.upgrades.kecepatan || 0)];
  }

  // ---------- Skill ----------
  skillPointsTotal() {
    const s = this.state;
    return STAR_POINTS[s.stars - 1] + 2 * (s.shopLevel - 1) + Math.floor((s.day - 1) / SKILL_POINT_EVERY_DAYS)
      + Math.floor((s.stats.dailyFull || 0) / SKILL_POINT_EVERY_FULL_DAYS) + (s.stats.weeklyFull || 0) + (s.bonusPoints || 0);
  }

  skillPointsSpent() {
    return Object.values(this.state.skills).reduce((a, b) => a + b, 0);
  }

  skillPointsFree() {
    return this.skillPointsTotal() - this.skillPointsSpent();
  }

  // Pengali kecepatan jalan karakter (skill Langkah Cepat, +10% per rank).
  walkMul() { return 1 + 0.1 * (this.state.skills.langkah || 0); }

  // Batas kesabaran sisa agar pelayanan masih dihitung cepat (skill Tangan Sigap melonggarkan).
  fastThreshold() { return Math.max(0.15, 0.5 - 0.08 * (this.state.skills.sigap || 0)); }

  skillRank(id) {
    return this.state.skills[id] || 0;
  }

  canLearn(id) {
    const sk = getSkill(id);
    if (this.skillRank(id) >= sk.max) return 'Rank maksimum';
    if (sk.req && this.skillRank(sk.req) < 1) return `Butuh ${getSkill(sk.req).name}`;
    if (this.skillPointsFree() < 1) return 'Poin skill habis';
    return null;
  }

  learnSkill(id) {
    const why = this.canLearn(id);
    if (why) throw new Error(why);
    this.state.skills[id] = this.skillRank(id) + 1;
  }

  resetSkills() {
    this._requireIdle();
    // Melepas breeding yang bergantung pada skill akan merusak data, jadi tolak saat kandang terisi.
    if (this.state.breeding.length) throw new Error('Selesaikan breeding dulu sebelum reset skill');
    this.state.skills = {};
  }

  // ---------- Ramuan ----------
  buyPotion(id, qty = 1) {
    this._requireIdle();
    this._requireStars(2, 'Ramuan');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah harus bilangan bulat minimal 1');
    const p = getPotion(id);
    debit(this.state.ledger, this.state.day, 'potion', p.price * qty, `Beli ${qty} ${p.name}`);
    this.state.potions[id] = (this.state.potions[id] || 0) + qty;
  }

  activatePotion(id) {
    this._requireIdle();
    const p = getPotion(id);
    if ((this.state.potions[id] || 0) < 1) throw new Error('Ramuan habis');
    if ((this.state.buffs[id] || 0) > 0) throw new Error('Ramuan ini masih aktif');
    this.state.potions[id] -= 1;
    this.state.buffs[id] = p.days;
  }

  // ---------- Karyawan ----------
  hire(id) {
    this._requireIdle();
    const st = getStaff(id);
    this._requireStars(st.needStars, st.name);
    if (this.state.staff[id]) throw new Error('Sudah dipekerjakan');
    this.state.staff[id] = true;
  }

  fire(id) {
    this._requireIdle();
    getStaff(id);
    if (!this.state.staff[id]) throw new Error('Karyawan tidak ada');
    if (id === 'perawat' && this.state.breeding.length) throw new Error('Selesaikan breeding dulu');
    delete this.state.staff[id];
  }

  setRestock(itemId, target, quality) {
    getItem(itemId);
    if (!Number.isInteger(target) || target < 0 || target > 500) throw new Error('Target stok tidak valid');
    if (!Number.isInteger(quality) || quality < 1 || quality > QUALITIES.length) throw new Error('Kualitas tidak valid');
    if (target === 0) delete this.state.restock[itemId];
    else this.state.restock[itemId] = { target, q: quality };
  }

  totalQty(itemId) {
    let n = 0;
    for (const [key, lot] of Object.entries(this.state.stock)) if (parseLotKey(key).itemId === itemId) n += lot.qty;
    return n;
  }

  // Penjaga Stok: isi ulang barang yang tersisa kurang dari separuh target.
  runAutoRestock() {
    const log = [];
    if (!this.state.staff.penjaga) return log;
    const reserve = this.dailyObligations();
    for (const [itemId, rule] of Object.entries(this.state.restock)) {
      if (!rule || rule.target <= 0 || !this.isUnlocked(itemId)) continue;
      const have = this.totalQty(itemId);
      if (have >= Math.ceil(rule.target * 0.5)) continue;
      const q = Math.min(rule.q, this.maxQuality());
      const unit = this.wholesalePrice(itemId, q);
      const n = Math.min(rule.target - have, this.capacity() - this.usedCapacity(), Math.floor((this.state.ledger.balance - reserve) / unit));
      if (n < 1) continue;
      const cost = this._buy(itemId, q, n, 'Restok otomatis');
      log.push({ itemId, q, n, cost });
    }
    return log;
  }

  // Isi ulang semua barang ke target Penjaga Stok (manual, tanpa perlu karyawan). Menyisakan uang untuk kewajiban harian.
  refillToTargets() {
    this._requireIdle();
    const log = [];
    const reserve = this.dailyObligations();
    for (const [itemId, rule] of Object.entries(this.state.restock)) {
      if (!rule || rule.target <= 0 || !this.isUnlocked(itemId)) continue;
      const have = this.totalQty(itemId);
      if (have >= rule.target) continue;
      const q = Math.min(rule.q, this.maxQuality());
      const unit = this.wholesalePrice(itemId, q);
      const n = Math.min(rule.target - have, this.capacity() - this.usedCapacity(), Math.floor((this.state.ledger.balance - reserve) / unit));
      if (n < 1) continue;
      const cost = this._buy(itemId, q, n, 'Isi ke target');
      this.track('buy_units', n);
      log.push({ itemId, q, n, cost });
    }
    return log;
  }

  // ---------- Belanja ----------
  _buy(itemId, quality, qty, label = 'Beli') {
    const unit = this.wholesalePrice(itemId, quality);
    const total = unit * qty;
    debit(this.state.ledger, this.state.day, 'buy_stock', total, `${label} ${qty} ${getItem(itemId).name} (${getQuality(quality).name})`);
    this.state.stats.bought += qty;
    const key = lotKey(itemId, quality);
    const lot = this.state.stock[key] || { qty: 0, cost: 0 };
    lot.qty += qty;
    lot.cost += total;
    this.state.stock[key] = lot;
    if (!this.state.prices[key]) this.state.prices[key] = this.suggestedPrice(itemId, quality);
    return total;
  }

  buyStock(itemId, quality, qty) {
    this._requireIdle();
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah harus bilangan bulat minimal 1');
    if (!this.isUnlocked(itemId)) throw new Error('Barang belum terbuka');
    if (!Number.isInteger(quality) || quality < 1 || quality > this.maxQuality()) throw new Error('Kualitas belum tersedia di grosir');
    if (this.usedCapacity() + qty > this.capacity()) throw new Error('Kapasitas toko tidak cukup');
    const total = this._buy(itemId, quality, qty);
    this.track('buy_units', qty);
    this.state.lastBuy[itemId] = { q: quality, n: Math.max(qty, this.state.lastBuy[itemId]?.n || 0) };
    return total;
  }

  // Beli ulang barang yang stoknya sudah kurang dari jumlah pembelian terakhir.
  restockLast() {
    this._requireIdle();
    const log = [];
    for (const [itemId, last] of Object.entries(this.state.lastBuy)) {
      if (!this.isUnlocked(itemId)) continue;
      const need = last.n - this.totalQty(itemId);
      if (need < 1) continue;
      const q = Math.min(last.q, this.maxQuality());
      const n = Math.min(need, this.maxAffordable(itemId, q));
      if (n < 1) continue;
      const cost = this._buy(itemId, q, n, 'Isi ulang');
      log.push({ itemId, q, n, cost });
    }
    return log;
  }

  maxAffordable(itemId, quality) {
    const unit = this.wholesalePrice(itemId, quality);
    const byMoney = Math.floor(this.state.ledger.balance / unit);
    const bySpace = this.capacity() - this.usedCapacity();
    return Math.max(0, Math.min(byMoney, bySpace));
  }

  // ---------- Harga jual ----------
  setPrice(itemId, quality, price) {
    this._requireIdle();
    if (!Number.isInteger(price) || price < 1) throw new Error('Harga harus bilangan bulat minimal 1');
    const ref = this.retailRef(itemId, quality);
    if (price > ref * 5) throw new Error('Harga terlalu tinggi');
    this.state.prices[lotKey(itemId, quality)] = price;
  }

  priceOf(itemId, quality) {
    return this.state.prices[lotKey(itemId, quality)] ?? this.suggestedPrice(itemId, quality);
  }

  // Semua stok dihargai pasar +pct persen (pct boleh negatif). Mengembalikan jumlah lot yang diubah.
  setAllPrices(pct) {
    this._requireIdle();
    if (!Number.isFinite(pct) || pct < -90 || pct > 400) throw new Error('Persentase harga tidak valid');
    let n = 0;
    for (const [key, lot] of Object.entries(this.state.stock)) {
      if (lot.qty <= 0) continue;
      const { itemId, quality } = parseLotKey(key);
      this.state.prices[key] = this.marketPrice(itemId, quality, pct);
      n += 1;
    }
    return n;
  }

  setAutoPrice(on, pct = 0) {
    this._requireIdle();
    if (!Number.isFinite(pct) || pct < -90 || pct > 400) throw new Error('Persentase harga tidak valid');
    this.state.autoPrice = { on: !!on, pct };
    if (on) this.setAllPrices(pct);
  }

  stockLots() {
    return Object.entries(this.state.stock)
      .filter(([, l]) => l.qty > 0)
      .map(([key, l]) => ({ key, ...parseLotKey(key), qty: l.qty, cost: l.cost }));
  }

  lowStock(threshold = 3) {
    const out = [];
    for (const it of this.unlockedItems()) {
      const stocked = Object.keys(this.state.prices).some((k) => parseLotKey(k).itemId === it.id) || this.state.lastBuy[it.id];
      if (!stocked) continue;
      const q = this.totalQty(it.id);
      if (q <= threshold) out.push({ itemId: it.id, qty: q });
    }
    return out;
  }

  // ---------- Breeding ----------
  breedSlots() {
    const s = this.state;
    if (!(s.skills.breeder > 0)) return 0;
    return BREED_BASE_SLOTS + (s.skills.kandang_besar || 0);
  }

  startBreeding(itemId, quality) {
    this._requireIdle();
    const s = this.state;
    if (!(s.skills.breeder > 0)) throw new Error('Pelajari skill Pengembang Biak dulu');
    if (s.breeding.length >= this.breedSlots()) throw new Error('Semua kandang breeding terpakai');
    const it = getItem(itemId);
    if (!getCategory(it.cat).animal) throw new Error('Hanya hewan yang bisa dibiakkan');
    const key = lotKey(itemId, quality);
    const lot = s.stock[key];
    if (!lot || lot.qty < 2) throw new Error('Butuh minimal 2 ekor dengan kualitas yang sama di stok');
    const fee = Math.max(1, Math.round(this.wholesalePrice(itemId, quality) * 2 * BREED_FEE_RATE));
    const pairCost = lot.qty === 2 ? lot.cost : Math.round((lot.cost * 2) / lot.qty);
    debit(s.ledger, s.day, 'breeding', fee, `Biaya breeding ${it.name} (${getQuality(quality).name})`);
    lot.qty -= 2;
    lot.cost -= pairCost;
    if (lot.qty === 0) lot.cost = 0;
    const id = this._id();
    const rng = mulberry32(hashSeed(s.seed, 'breed', id));
    const perawat = !!s.staff.perawat;
    const bibit = (s.buffs.bibit || 0) > 0;
    const duration = Math.max(1, 2 + it.tier - (perawat ? 1 : 0));
    const litter = 1 + (rng() < 0.5 ? 1 : 0) + (it.tier <= 2 ? 1 : 0) + (bibit ? 1 : 0);
    const upChance = clamp(0.1 + 0.08 * (s.skills.bibit_unggul || 0) + (bibit ? 0.2 : 0) + (perawat ? 0.1 : 0), 0, 0.8);
    const offspring = [];
    for (let i = 0; i < litter; i++) offspring.push(Math.min(QUALITIES.length, quality + (rng() < upChance ? 1 : 0)));
    s.breeding.push({ id, itemId, quality, pairCost, fee, ready: s.day + duration, offspring });
    return { id, ready: s.day + duration, litter };
  }

  collectBreeding(id) {
    this._requireIdle();
    const s = this.state;
    const idx = s.breeding.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error('Breeding tidak ditemukan');
    const b = s.breeding[idx];
    if (s.day < b.ready) throw new Error('Belum waktunya diambil');
    if (this.usedCapacity() + b.offspring.length > this.capacity()) throw new Error('Kapasitas toko tidak cukup untuk anakan');
    const pk = lotKey(b.itemId, b.quality);
    const parents = s.stock[pk] || { qty: 0, cost: 0 };
    parents.qty += 2;
    parents.cost += b.pairCost;
    s.stock[pk] = parents;
    if (!s.prices[pk]) s.prices[pk] = this.suggestedPrice(b.itemId, b.quality);
    const n = b.offspring.length;
    const share = Math.floor(b.fee / n);
    const rem = b.fee - share * n;
    b.offspring.forEach((q, i) => {
      const key = lotKey(b.itemId, q);
      const lot = s.stock[key] || { qty: 0, cost: 0 };
      lot.qty += 1;
      lot.cost += share + (i === 0 ? rem : 0);
      s.stock[key] = lot;
      if (!s.prices[key]) s.prices[key] = this.suggestedPrice(b.itemId, q);
    });
    s.breeding.splice(idx, 1);
    s.stats.bred += 1;
    this.track('breed', 1);
    return b.offspring.slice();
  }

  // ---------- Investasi ----------
  openDeposit(amount, termIdx) {
    this._requireIdle();
    this._requireStars(3, 'Investasi');
    const s = this.state;
    const term = DEPOSIT_TERMS[termIdx];
    if (!term) throw new Error('Tenor tidak valid');
    if (!Number.isInteger(amount) || amount < DEPOSIT_MIN) throw new Error(`Minimal deposito Rp ${DEPOSIT_MIN.toLocaleString('id-ID')}`);
    if (s.deposits.length >= DEPOSIT_MAX_ACTIVE) throw new Error('Terlalu banyak deposito aktif');
    debit(s.ledger, s.day, 'invest', amount, `Deposito ${term.days} hari`);
    s.deposits.push({ id: this._id(), principal: amount, interest: Math.floor(amount * term.rate), matureDay: s.day + term.days - 1 });
  }

  withdrawDeposit(id) {
    this._requireIdle();
    const s = this.state;
    const idx = s.deposits.findIndex((d) => d.id === id);
    if (idx < 0) throw new Error('Deposito tidak ditemukan');
    const d = s.deposits[idx];
    credit(s.ledger, s.day, 'invest_return', d.principal, 'Deposito dicairkan lebih awal (tanpa bunga)');
    s.deposits.splice(idx, 1);
  }

  sharePrice(id) {
    return this.state.sharePrices[id].price;
  }

  buyShares(id, qty) {
    this._requireIdle();
    this._requireStars(3, 'Investasi');
    getShare(id);
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah lembar harus bilangan bulat minimal 1');
    const total = this.sharePrice(id) * qty;
    debit(this.state.ledger, this.state.day, 'stock_buy', total, `Beli ${qty} lembar ${getShare(id).name}`);
    const h = this.state.shares[id] || { qty: 0, cost: 0 };
    h.qty += qty;
    h.cost += total;
    this.state.shares[id] = h;
    return total;
  }

  sellShares(id, qty) {
    this._requireIdle();
    getShare(id);
    const h = this.state.shares[id];
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Jumlah lembar harus bilangan bulat minimal 1');
    if (!h || h.qty < qty) throw new Error('Lembar saham tidak cukup');
    const gross = this.sharePrice(id) * qty;
    const fee = Math.floor(gross * SHARE_SELL_FEE);
    const net = gross - fee;
    credit(this.state.ledger, this.state.day, 'stock_sell', net, `Jual ${qty} lembar ${getShare(id).name} (biaya ${fee})`);
    const costOut = qty === h.qty ? h.cost : Math.round((h.cost * qty) / h.qty);
    h.qty -= qty;
    h.cost -= costOut;
    if (h.qty === 0) {
      h.cost = 0;
      delete this.state.shares[id];
    }
    return net;
  }

  buyProperty(id) {
    this._requireIdle();
    this._requireStars(3, 'Investasi');
    const p = getProperty(id);
    const have = this.state.properties[id] || 0;
    if (have >= p.max) throw new Error('Sudah mencapai batas kepemilikan');
    debit(this.state.ledger, this.state.day, 'property', p.cost, `Beli ${p.name}`);
    this.state.properties[id] = have + 1;
  }

  sellProperty(id) {
    this._requireIdle();
    const p = getProperty(id);
    if (!(this.state.properties[id] > 0)) throw new Error('Properti tidak dimiliki');
    credit(this.state.ledger, this.state.day, 'property_sale', Math.floor(p.cost * PROPERTY_SELL_RATE), `Jual ${p.name}`);
    this.state.properties[id] -= 1;
    if (this.state.properties[id] === 0) delete this.state.properties[id];
  }

  propertyIncome() {
    return PROPERTIES.reduce((sum, p) => sum + (this.state.properties[p.id] || 0) * p.income, 0);
  }

  netWorth() {
    const s = this.state;
    let w = s.ledger.balance;
    for (const lot of Object.values(s.stock)) w += lot.cost;
    for (const b of s.breeding) w += b.pairCost + b.fee;
    for (const d of s.deposits) w += d.principal;
    for (const [id, h] of Object.entries(s.shares)) w += s.sharePrices[id].price * h.qty;
    for (const [id, n] of Object.entries(s.properties)) w += getProperty(id).cost * n;
    for (const l of s.loans) w -= l.remaining;
    return w - s.arrears;
  }

  // ---------- Bank ----------
  loanOutstanding() {
    return this.state.loans.reduce((sum, l) => sum + l.remaining, 0);
  }

  loanLimit() {
    return 30000 * this.state.stars + 15000 * (this.state.shopLevel - 1);
  }

  loanAvailable() {
    return Math.max(0, this.loanLimit() - this.loanOutstanding());
  }

  takeLoan(amount, termIdx) {
    this._requireIdle();
    this._requireStars(2, 'Bank');
    const s = this.state;
    const term = LOAN_TERMS[termIdx];
    if (!term) throw new Error('Tenor tidak valid');
    if (!Number.isInteger(amount) || amount < LOAN_MIN || amount % LOAN_STEP !== 0) throw new Error(`Pinjaman minimal Rp ${LOAN_MIN.toLocaleString('id-ID')} dan kelipatan Rp ${LOAN_STEP.toLocaleString('id-ID')}`);
    if (s.loans.length >= LOAN_MAX_ACTIVE) throw new Error('Terlalu banyak pinjaman aktif');
    const total = amount + Math.floor(amount * term.rate);
    if (amount > this.loanAvailable()) throw new Error('Melebihi batas pinjaman. Naikkan bintang atau perluas toko');
    credit(s.ledger, s.day, 'loan', amount, `Pinjaman bank ${term.days} hari`);
    s.loans.push({ id: this._id(), principal: amount, remaining: total, perDay: Math.ceil(total / term.days), daysLeft: term.days, late: 0 });
  }

  repayLoan(id, amount) {
    this._requireIdle();
    const s = this.state;
    const idx = s.loans.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error('Pinjaman tidak ditemukan');
    const l = s.loans[idx];
    if (!Number.isInteger(amount) || amount < 1) throw new Error('Jumlah bayar harus bilangan bulat minimal 1');
    if (amount > l.remaining) throw new Error('Melebihi sisa pinjaman');
    debit(s.ledger, s.day, 'loan_pay', amount, 'Bayar pinjaman bank');
    l.remaining -= amount;
    if (l.remaining === 0) s.loans.splice(idx, 1);
  }

  // ---------- Hari berjalan ----------
  priceAttract() {
    let weighted = 0;
    let n = 0;
    for (const lot of this.stockLots()) {
      const ref = this.retailRef(lot.itemId, lot.quality);
      weighted += (this.priceOf(lot.itemId, lot.quality) / ref) * lot.qty;
      n += lot.qty;
    }
    if (n === 0) return 1;
    const r = weighted / n;
    return clamp(1 + (1 - r) * 0.8, 0.5, 1.4);
  }

  customerCount() {
    const s = this.state;
    // Pelanggan sedikit: toko dilayani langsung satu per satu.
    const base = 4 + s.reputation * 0.05 + Math.min(s.day, 80) * 0.06;
    return clamp(Math.round(base * this.mods().count), 3, 40);
  }

  _qtyCap(item) {
    if (item.cat === 'perlengkapan') return 3;
    return item.tier <= 2 ? 2 : 1;
  }

  generatePlan() {
    const s = this.state;
    const m = this.mods();
    const rng = mulberry32(hashSeed(s.seed, 'plan', s.day));
    const n = this.customerCount();
    const items = this.unlockedItems().map((i) => ({ id: i.id, weight: i.demand * (this.animalCount(i.id) > 0 ? 3 : 1) }));
    const types = CUSTOMER_TYPES.map((t) => ({ ...t, weight: t.weight * (t.id === 'vip' ? m.vip : 1) }));
    const times = [];
    for (let i = 0; i < n; i++) times.push(rng() * DAY_LENGTH_SEC);
    times.sort((a, b) => a - b);
    const base = times.map((t, i) => {
      const type = pickWeighted(rng, types);
      const wantCount = rng() < 0.2 ? 2 : 1;
      const pool = items.slice();
      const wants = [];
      for (let w = 0; w < wantCount && pool.length; w++) {
        const pick = pickWeighted(rng, pool);
        pool.splice(pool.findIndex((p) => p.id === pick.id), 1);
        wants.push({ itemId: pick.id, qty: 1, noise: 1.0 + rng() * 0.08 });
      }
      return { id: `${s.day}-${i + 1}`, type: type.id, spawnAt: t, wants };
    });
    // pelanggan langganan datang di luar pelanggan biasa (rencana dasar tidak berubah)
    return base.concat(planRegulars(this, s.day, DAY_LENGTH_SEC)).sort((a, b) => a.spawnAt - b.spawnAt);
  }

  startDay() {
    this._requireIdle();
    this.lastRestock = this.runAutoRestock();
    if (this.state.autoPrice.on) this.setAllPrices(this.state.autoPrice.pct);
    this.plan = this.generatePlan();
    this.reserved.clear();
    this.today = { revenue: 0, cogs: 0, customers: this.plan.length, served: 0, lost: 0, soldUnits: 0, tips: 0, regulars: [], thief: this.thiefPlan(this.state.day), thefts: [], chased: 0 };
    this.state.phase = 'open';
    return this.plan;
  }

  _typeOf(customer) {
    return CUSTOMER_TYPES.find((t) => t.id === customer.type);
  }

  // Dipanggil saat toko ditutup lebih awal: pelanggan yang belum datang tidak dihitung.
  dropUnspawned(count) {
    if (this.state.phase !== 'open' || !this.today) return;
    this.today.customers = Math.max(0, this.today.customers - count);
  }

  // Pelanggan melihat satu barang di rak. Stok langsung dipesan agar tidak terjual dua kali.
  // given (opsional, mode manual): { itemId, quality } barang yang diserahkan pemain.
  browse(customer, wantIdx, given = null) {
    if (this.state.phase !== 'open') throw new Error('Toko belum buka');
    const want = customer.wants[wantIdx];
    if (given && given.itemId !== want.itemId) return { ok: false, itemId: want.itemId, reason: 'salah' };
    const type = this._typeOf(customer);
    const item = getItem(want.itemId);
    const lots = this.stockLots().filter((l) => l.itemId === want.itemId && (!given || l.quality === given.quality));
    if (lots.length === 0) return { ok: false, itemId: want.itemId, reason: 'habis' };

    const m = this.mods();
    const prem = 0.06 * (this.state.upgrades[`prem_${item.cat}`] || 0);
    const wtpMult = (1 + m.wtp + prem) * type.wtp * want.noise * (1 + (customer.bonusWtp || 0));
    const affordable = lots
      .filter((l) => l.quality >= type.minQuality)
      .map((l) => ({ ...l, price: this.priceOf(l.itemId, l.quality) }))
      .filter((l) => l.price <= Math.floor(this.retailRef(l.itemId, l.quality) * wtpMult));
    if (affordable.length === 0) {
      const tooLow = lots.every((l) => l.quality < type.minQuality);
      return { ok: false, itemId: want.itemId, reason: tooLow ? 'kualitas' : 'mahal' };
    }
    affordable.sort(type.id === 'pelit' ? (a, b) => a.price - b.price : (a, b) => b.quality - a.quality);
    const pick = affordable[0];
    const qty = Math.min(want.qty, pick.qty);
    const lot = this.state.stock[pick.key];
    const costOut = qty === lot.qty ? lot.cost : Math.round((lot.cost * qty) / lot.qty);
    lot.qty -= qty;
    lot.cost -= costOut;
    if (lot.qty === 0) lot.cost = 0;
    const revenue = pick.price * qty;
    const list = this.reserved.get(customer.id) || [];
    list.push({ key: pick.key, qty, cost: costOut, revenue });
    this.reserved.set(customer.id, list);
    return { ok: true, itemId: pick.itemId, quality: pick.quality, qty, unitPrice: pick.price, total: revenue };
  }

  // Pelanggan membayar di kasir.
  // opts.fast: pelayanan manual yang cepat memberi tip 10%.
  pay(customerId, opts = {}) {
    const list = this.reserved.get(customerId);
    if (!list || list.length === 0) return 0;
    const total = list.reduce((s, r) => s + r.revenue, 0);
    const cogs = list.reduce((s, r) => s + r.cost, 0);
    const units = list.reduce((s, r) => s + r.qty, 0);
    credit(this.state.ledger, this.state.day, 'sale', total, `Penjualan pelanggan #${customerId}`);
    this.today.revenue += total;
    this.today.cogs += cogs;
    this.today.soldUnits += units;
    const items = this.state.stats.items;
    for (const r of list) {
      const id = parseLotKey(r.key).itemId;
      const st = (items[id] ||= { units: 0, revenue: 0 });
      st.units += r.qty;
      st.revenue += r.revenue;
    }
    this.reserved.delete(customerId);
    // statistik seumur hidup dan misi
    this.state.stats.sold += units;
    this.track('serve', 1);
    this.track('sell_units', units);
    this.track('revenue', total);
    for (const r of list) this.track('sell_cat', r.qty, { cat: getItem(parseLotKey(r.key).itemId).cat });
    const cust = this.plan.find((c) => c.id === customerId);
    if (cust?.type === 'vip') this.track('vip', 1);
    if (opts.fast) {
      const tip = Math.max(1, Math.round(total * (0.1 + this.farmBuffs().tip)));
      credit(this.state.ledger, this.state.day, 'tip', tip, `Tip pelayanan cepat #${customerId}`);
      this.today.tips += tip;
    }
    if (cust?.regularId) {
      const visit = onRegularPaid(this, cust, list, total);
      this.today.tips += visit.tip;
      this.today.regulars.push(visit);
    }
    return total;
  }

  // Syarat pesanan untuk ditampilkan ke pemain (mode manual).
  orderInfo(customer, wantIdx) {
    const want = customer.wants[wantIdx];
    const type = this._typeOf(customer);
    const minQ = Math.max(type.minQuality, customer.request?.itemId === want.itemId ? customer.request.minQuality : 1);
    return { itemId: want.itemId, qty: 1, minQuality: minQ };
  }

  // Pemain menyerahkan satu hewan ke pelanggan. Harga = nilai hewan (rarity x ukuran) dengan batas per tipe pelanggan.
  serveAnimal(customer, wantIdx, animalId) {
    if (this.state.phase !== 'open') throw new Error('Toko belum buka');
    const want = customer.wants[wantIdx];
    const fm = this.state.farm;
    const idx = fm.animals.findIndex((a) => a.id === animalId);
    if (idx < 0) return { ok: false, itemId: want.itemId, reason: 'habis' };
    const a = fm.animals[idx];
    if (a.itemId !== want.itemId) return { ok: false, itemId: want.itemId, reason: 'salah' };
    const info = this.orderInfo(customer, wantIdx);
    const level = farm.rarityIdx(a.rarity) + 1;
    if (level < info.minQuality) return { ok: false, itemId: want.itemId, reason: 'kualitas' };
    const type = this._typeOf(customer);
    const m = this.mods();
    const item = getItem(a.itemId);
    const raw = farm.animalValue(a) * want.noise * (1 + m.wtp + this.farmBuffs().value) * (1 + (customer.bonusWtp || 0));
    const cap = farm.animalValue(a) * (farm.PAY_CAP[type.id] ?? 1.25) * (customer.regularId ? 1.2 : 1);
    const ev = this.eventOf();
    const lomba = level >= 3 && ev.rare ? 1 + ev.rare : 1; // Rare ke atas
    const price = Math.max(1, Math.round(Math.min(raw, cap) * m.payMul * lomba));
    fm.animals.splice(idx, 1);
    const list = this.reserved.get(customer.id) || [];
    list.push({ key: lotKey(a.itemId, level), qty: 1, cost: a.cost, revenue: price, animal: a });
    this.reserved.set(customer.id, list);
    return { ok: true, itemId: a.itemId, quality: level, qty: 1, unitPrice: price, total: price, animal: a, capped: raw > cap };
  }

  // noStock: pelanggan pergi karena pemain memang tidak punya barangnya. Tidak menghukum reputasi.
  customerLeft(customerId, satisfied, noStock = false) {
    if (satisfied) this.today.served += 1;
    else if (noStock) this.today.skipped = (this.today.skipped || 0) + 1;
    else this.today.lost += 1;
  }

  _payUpTo(type, amount, desc) {
    const s = this.state;
    const pay = Math.min(amount, s.ledger.balance);
    if (pay > 0) debit(s.ledger, s.day, type, pay, desc);
    return pay;
  }

  _updateSharePrices(day) {
    const s = this.state;
    for (const sh of SHARES) {
      const sp = s.sharePrices[sh.id];
      const rng = mulberry32(hashSeed(s.seed, 'share', sh.id, day));
      const change = (rng() - 0.5) * 2 * sh.vol + sh.drift;
      sp.price = Math.max(SHARE_MIN_PRICE, Math.round(sp.price * (1 + change)));
      sp.hist.push(sp.price);
      if (sp.hist.length > SHARE_HISTORY) sp.hist.shift();
    }
  }

  endDay() {
    if (this.state.phase !== 'open') throw new Error('Toko belum buka');
    const s = this.state;
    const day = s.day;
    const m = this.mods();

    // Kembalikan pesanan yang belum dibayar (jaga integritas stok dan uang).
    for (const [id, list] of this.reserved) {
      for (const r of list) {
        if (r.animal) { s.farm.animals.push(r.animal); continue; }
        const lot = s.stock[r.key] || { qty: 0, cost: 0 };
        lot.qty += r.qty;
        lot.cost += r.cost;
        s.stock[r.key] = lot;
      }
      this.today.lost += 1;
      this.reserved.delete(id);
    }

    // Kerugian stok: hewan sakit/mati dan pencurian (nilai modal keluar dari stok, tidak menyentuh kas).
    const died = this._applySickness(day);
    const stolen = [...this._applyTheft(day, this.today.customers), ...(this.today.thefts || [])];

    // Pemasukan pasif lebih dulu: properti dan deposito yang jatuh tempo.
    const propIncome = this.propertyIncome();
    if (propIncome > 0) credit(s.ledger, day, 'rent_income', propIncome, 'Pendapatan sewa properti');
    let depositReturn = 0;
    let depositInterest = 0;
    s.deposits = s.deposits.filter((d) => {
      if (day < d.matureDay) return true;
      credit(s.ledger, day, 'invest_return', d.principal, 'Deposito jatuh tempo');
      if (d.interest > 0) credit(s.ledger, day, 'interest', d.interest, 'Bunga deposito');
      depositReturn += d.principal;
      depositInterest += d.interest;
      return false;
    });

    // Kewajiban: tunggakan, sewa, gaji, cicilan.
    const arrearsPaid = s.arrears > 0 ? this._payUpTo('arrears', s.arrears, 'Bayar tunggakan sewa dan gaji') : 0;
    s.arrears -= arrearsPaid;
    const rentPaid = this._payUpTo('rent', m.rent, 'Sewa toko harian');
    s.arrears += m.rent - rentPaid;
    let wagesDue = 0;
    let wagesPaid = 0;
    for (const st of STAFF) {
      if (!s.staff[st.id]) continue;
      const w = this.wageOf(st);
      wagesDue += w;
      const paid = this._payUpTo('wage', w, `Gaji ${st.name}`);
      wagesPaid += paid;
      s.arrears += w - paid;
    }
    const upkeepDue = this.upkeep();
    const upkeepPaid = this._payUpTo('upkeep', upkeepDue, 'Perawatan hewan dan toko');
    s.arrears += upkeepDue - upkeepPaid;
    const taxDue = this.taxFor(this.today.revenue) + this.wealthTax();
    const taxPaid = this._payUpTo('tax', taxDue, 'Pajak toko');
    s.arrears += taxDue - taxPaid;
    let loanPaid = 0;
    let anyLate = false;
    s.loans = s.loans.filter((l) => {
      const due = l.daysLeft > 0 ? Math.min(l.perDay, l.remaining) : l.remaining;
      const paid = this._payUpTo('loan_pay', due, 'Cicilan pinjaman bank');
      loanPaid += paid;
      l.remaining -= paid;
      if (paid < due) {
        l.remaining += Math.ceil((due - paid) * LOAN_LATE_FEE);
        l.late += 1;
        anyLate = true;
      }
      l.daysLeft = Math.max(0, l.daysLeft - 1);
      return l.remaining > 0;
    });

    // Reputasi dan bintang (bintang tidak pernah turun)
    const t = this.today;
    // Reputasi naik pelan dan makin sulit mendekati 100. Disimpan dengan satu desimal.
    const rawDelta = t.served * 0.5 * m.repGain * (1 - s.reputation / 140) - t.lost * 0.2 * m.repLoss - (anyLate ? 2 : 0);
    const floorRep = Math.max(5, STAR_THRESH[s.stars - 1]);
    const newRep = clamp(Math.round((s.reputation + rawDelta) * 10) / 10, floorRep, 100);
    const repDelta = Math.round((newRep - s.reputation) * 10) / 10;
    s.reputation = newRep;
    const newStars = starsFor(s.reputation);
    let starUp = null;
    if (newStars > s.stars) {
      starUp = { from: s.stars, to: newStars };
      s.stars = newStars;
    }
    s.stats.revenue += t.revenue;
    s.stats.customers += t.customers;
    s.stats.bestDay = Math.max(s.stats.bestDay, t.revenue);

    const byType = sumByType(s.ledger, day);
    const summary = {
      day,
      event: m.event.id,
      revenue: t.revenue,
      cogs: t.cogs,
      grossProfit: t.revenue - t.cogs,
      rent: m.rent,
      wages: wagesDue,
      net: t.revenue + t.tips - t.cogs - m.rent - wagesDue - upkeepDue - taxDue,
      tips: t.tips,
      regulars: t.regulars,
      upkeep: upkeepDue,
      tax: taxDue,
      died,
      stolen,
      chased: this.today.chased || 0,
      propIncome,
      depositReturn,
      depositInterest,
      loanPaid,
      arrearsPaid,
      customers: t.customers,
      served: t.served,
      lost: t.lost,
      soldUnits: t.soldUnits,
      repDelta,
      stars: s.stars,
      starUp,
      endCash: s.ledger.balance,
      arrears: s.arrears,
      cashFlow: byType,
      restock: this.lastRestock,
    };
    s.history.push(summary);
    if (s.history.length > 30) s.history.shift();

    // Ramuan berkurang satu hari, harga saham bergerak, lalu hari berganti.
    for (const id of Object.keys(s.buffs)) {
      s.buffs[id] -= 1;
      if (s.buffs[id] <= 0) delete s.buffs[id];
    }
    this._updateSharePrices(day);
    this.track('profit', Math.max(0, summary.net));
    summary.newAchievements = this.checkAchievements();
    s.day += 1;
    s.phase = 'idle';
    this.plan = [];
    this.today = null;
    this.lastRestock = [];
    return summary;
  }

  // ---------- Pengeluaran: perawatan, pajak, sakit, pencurian ----------
  stockAnimalCount() {
    let n = 0;
    for (const [key, lot] of Object.entries(this.state.stock)) if (getCategory(getItem(parseLotKey(key).itemId).cat).animal) n += lot.qty;
    return n;
  }

  upkeep() {
    const s = this.state;
    const base = this.stockAnimalCount() * UPKEEP_PER_ANIMAL * (1 + UPKEEP_SHOP_STEP * (s.shopLevel - 1));
    return Math.round(base * (s.staff.perawat ? 0.7 : 1));
  }

  taxFor(revenue) {
    let tax = 0;
    for (let i = 0; i < TAX_BRACKETS.length; i++) {
      const lo = TAX_BRACKETS[i].from;
      const hi = i + 1 < TAX_BRACKETS.length ? TAX_BRACKETS[i + 1].from : Infinity;
      if (revenue > lo) tax += (Math.min(revenue, hi) - lo) * TAX_BRACKETS[i].rate;
    }
    return Math.floor(tax);
  }

  wealthTax() {
    const over = this.state.ledger.balance - WEALTH_TAX_FROM;
    return over > 0 ? Math.floor(over * WEALTH_TAX_RATE) : 0;
  }

  _removeUnits(key, qty) {
    const lot = this.state.stock[key];
    const costOut = qty === lot.qty ? lot.cost : Math.round((lot.cost * qty) / lot.qty);
    lot.qty -= qty;
    lot.cost -= costOut;
    if (lot.qty === 0) lot.cost = 0;
  }

  _applySickness(day) {
    const s = this.state;
    if ((s.buffs.obat || 0) > 0 || day < 3) return [];
    const p = SICK_CHANCE * (s.staff.perawat ? 0.4 : 1);
    const rng = mulberry32(hashSeed(s.seed, 'sick', day));
    const out = {};
    for (const [key, lot] of Object.entries(s.stock)) {
      const itemId = parseLotKey(key).itemId;
      if (!getCategory(getItem(itemId).cat).animal || lot.qty <= 0) continue;
      let dead = 0;
      for (let i = 0; i < lot.qty; i++) if (rng() < p) dead += 1;
      if (dead > 0) {
        this._removeUnits(key, dead);
        out[itemId] = (out[itemId] || 0) + dead;
      }
    }
    return Object.entries(out).map(([itemId, n]) => ({ itemId, n }));
  }

  _applyTheft(day, customers) {
    const s = this.state;
    if (day < 5) return [];
    const p = THEFT_CHANCE * (s.staff.satpam ? 0.2 : 1);
    const rng = mulberry32(hashSeed(s.seed, 'theft', day));
    const out = {};
    for (let i = 0; i < customers; i++) {
      if (rng() >= p) continue;
      const lots = Object.entries(s.stock).filter(([, l]) => l.qty > 0);
      if (!lots.length) break;
      const [key] = lots[Math.floor(rng() * lots.length)];
      this._removeUnits(key, 1);
      const itemId = parseLotKey(key).itemId;
      out[itemId] = (out[itemId] || 0) + 1;
    }
    return Object.entries(out).map(([itemId, n]) => ({ itemId, n }));
  }

  // ---------- Pencuri di kolam ----------
  // Rencana hari ini ditentukan seed: kapan datang (pecahan hari) dan angka acak untuk memilih sasaran dan hasil.
  thiefPlan(day = this.state.day) {
    if (day < THIEF_FROM_DAY) return null;
    const rng = mulberry32(hashSeed(this.state.seed, 'thief', day));
    if (rng() >= THIEF_DAY_CHANCE) return null;
    return { at: 0.2 + rng() * 0.55, pick: rng(), pick2: rng(), caughtRoll: rng(), done: false };
  }

  // Lahan kolam yang berpenghuni (sasaran pencuri). Cadangan: lahan apa pun yang berpenghuni.
  thiefTargets() {
    const fm = this.state.farm;
    const occupied = (i) => (fm.slots[i] || []).some((l) => (l.qty ?? 1) > 0);
    const kolam = fm.habs.map((h, i) => (h === 'kolam' && occupied(i) ? i : -1)).filter((i) => i >= 0);
    if (kolam.length) return kolam;
    return fm.habs.map((_, i) => (occupied(i) ? i : -1)).filter((i) => i >= 0);
  }

  thiefPreview() {
    const plan = this.today?.thief;
    if (!plan || plan.done) return null;
    const t = this.thiefTargets();
    return t.length ? { slot: t[Math.floor(plan.pick * t.length)] } : null;
  }

  guardOn() { return !!this.state.staff.satpam; }

  // Satpam hanya menjaga kolam. Pencuri yang menuju lahan lain tidak terhalang.
  thiefCaught(slot) {
    const plan = this.today?.thief;
    return !!plan && this.guardOn() && this.state.farm.habs[slot] === 'kolam' && plan.caughtRoll < THIEF_CATCH_SATPAM;
  }

  // Pencuri sampai di sasaran: satpam mengusir, atau satu ekor hilang dari lahan itu.
  resolveThief() {
    const plan = this.today?.thief;
    if (!plan || plan.done) return null;
    plan.done = true;
    const t = this.thiefTargets();
    if (!t.length) return { none: true };
    const slot = t[Math.floor(plan.pick * t.length)];
    if (this.thiefCaught(slot)) {
      this.today.chased = (this.today.chased || 0) + 1;
      return { caught: true, slot };
    }
    const lots = this.state.farm.slots[slot].filter((l) => (l.qty ?? 1) > 0);
    const lot = lots[Math.floor(plan.pick2 * lots.length)];
    lot.qty = lot.qty ?? 1;
    const unit = Math.round((lot.cost || 0) / Math.max(1, lot.qty));
    lot.qty -= 1;
    lot.cost = Math.max(0, (lot.cost || 0) - unit);
    if (lot.qty <= 0) this.state.farm.slots[slot] = this.state.farm.slots[slot].filter((l) => l !== lot);
    this.state.stats.stolen = (this.state.stats.stolen || 0) + 1;
    const itemId = lot.itemId;
    const row = this.today.thefts.find((x) => x.itemId === itemId);
    if (row) row.n += 1; else this.today.thefts.push({ itemId, n: 1 });
    return { stolen: true, slot, itemId, loss: unit };
  }

  canSave() {
    return this.state.phase === 'idle';
  }
}

export { catIndex };
