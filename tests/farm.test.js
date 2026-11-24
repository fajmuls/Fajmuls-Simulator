import { describe, it, expect } from 'vitest';
import { GameEngine, newState, migrate } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState, serialize, deserialize } from '../src/core/save.js';
import { RARITIES, rarityWeights, rollRarity, expectedMult, FEEDS, EGGS, animalValue, PET_KINDS } from '../src/core/farm.js';
import { mulberry32 } from '../src/core/rng.js';
import { slotCap as farmCap } from '../src/core/farm.js';
import { makeClock, farmRound, serveDay } from './farmbot.js';

const mk = (seed = 1) => { const e = new GameEngine(newState(seed)); const clock = makeClock(e); return { e, clock }; };

describe('peternakan', () => {
  it('satu lahan bisa ditanami banyak sekaligus dan panen sekaligus', () => {
    const { e, clock } = mk();
    credit(e.state.ledger, 1, 'reward', 1_000_000, 'modal tes');
    e.upgradeSpot(1); e.upgradeSpot(1); // Lv3 = muat 6
    e.state.shopLevel = 2;
    e.buyBibit('lele', 6);
    e.buyFeed('bagus', 6);
    expect(() => e.plant(1, 'lele', null, 7)).toThrow();
    expect(() => e.plant(1, 'lele', 'bagus', 7)).toThrow();
    e.plant(1, 'lele', 'bagus', 5);
    expect(e.state.farm.bibit.lele).toBe(1);
    expect(e.state.farm.feeds.bagus).toBe(1);
    clock.t += 120_000;
    const got = e.harvest(1);
    expect(got).toHaveLength(5);
    expect(e.animalCount('lele')).toBe(5);
    expect(new Set(got.map((a) => a.id)).size).toBe(5);
    expect(validateState(deserialize(serialize(e.state)))).toEqual([]);
  });

  it('hewan langka dibayar sesuai nilainya, bukan terpotong harga dasar', () => {
    const { e } = mk();
    const a = { id: 'z1', itemId: 'lele', rarity: 'legendary', size: 1, cost: 100 };
    e.state.farm.animals.push(a);
    const plan = e.startDay();
    const cust = plan[0];
    cust.wants = [{ itemId: 'lele', qty: 1, noise: 1 }];
    const val = animalValue(a);
    const r = e.serveAnimal(cust, 0, 'z1');
    expect(r.ok).toBe(true);
    expect(r.unitPrice).toBeGreaterThan(val * 0.8);
    expect(r.unitPrice).toBeGreaterThan(5000);
  });

  it('bibit tumbuh sesuai waktu, panen terlalu cepat ditolak', () => {
    const { e, clock } = mk();
    e.buyBibit('cacing', 1);
    e.plant(0, 'cacing', null);
    expect(() => e.harvest(0)).toThrow();
    expect(e.slotProgress(0).ready).toBe(false);
    clock.t += 46_000;
    expect(e.slotProgress(0).ready).toBe(true);
    const [a] = e.harvest(0);
    expect(a.itemId).toBe('cacing');
    expect(e.animalCount('cacing')).toBe(1);
    expect(e.state.farm.slots[0]).toEqual([]);
  });

  it('menanam memotong kas dan tetap seimbang; kolam terisi menolak', () => {
    const { e } = mk();
    const before = e.state.ledger.balance;
    expect(() => e.plant(0, 'cacing', null)).toThrow(); // belum punya bibit
    e.buyBibit('cacing', 2);
    expect(before - e.state.ledger.balance).toBe(e.bibitPrice('cacing') * 2);
    e.plant(0, 'cacing', null);
    e.plant(0, 'cacing', null); // Lv1 muat 2
    e.buyBibit('cacing', 1);
    expect(() => e.plant(0, 'cacing', null)).toThrow(); // lahan penuh
    expect(() => e.buyBibit('koi', 1)).toThrow(); // belum terbuka
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('pakan dipakai satu per tanam dan harus dibeli dulu', () => {
    const { e } = mk();
    expect(() => e.plant(0, 'cacing', 'bagus')).toThrow();
    expect(() => e.buyFeed('bagus', 2)).toThrow(/Toko Lv 2/); // dibuka bertahap
    e.state.shopLevel = 2;
    e.buyFeed('bagus', 2);
    e.buyBibit('cacing', 1);
    e.plant(0, 'cacing', 'bagus');
    expect(e.state.farm.feeds.bagus).toBe(1);
  });

  it('peluang rarity berjumlah 100% dan pakan mahal menggeser ke rarity tinggi', () => {
    expect(rarityWeights(0).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    let prev = expectedMult(0);
    for (const f of FEEDS) { const v = expectedMult(f.luck); expect(v).toBeGreaterThan(prev); prev = v; }
    const rng = mulberry32(7);
    const n = 20000; const c = new Array(RARITIES.length).fill(0);
    for (let i = 0; i < n; i++) c[rollRarity(rng, 0)] += 1;
    expect(c[0] / n).toBeGreaterThan(0.58);
    expect(c[0] / n).toBeLessThan(0.66);
  });

  it('hasil panen deterministik untuk benih yang sama', () => {
    const run = () => { const { e, clock } = mk(5); const out = []; for (let i = 0; i < 6; i++) { e.buyBibit('cacing', 1); e.plant(0, 'cacing', null); clock.t += 60_000; out.push(...e.harvest(0)); } return out; };
    expect(run()).toEqual(run());
  });

  it('kolam tambahan dibayar sesuai harga dan ada batasnya', () => {
    const { e } = mk();
    e.state.ledger.balance = 10_000_000; e.state.ledger.opening = 10_000_000;
    for (let i = 0; i < 8; i++) e.buySlot();
    expect(e.state.farm.slots.length).toBe(11);
    expect(e.state.farm.habs.length).toBe(11);
    expect(() => e.buySlot()).toThrow();
  });

  it('habitat membatasi spesies: ikan hanya di kolam, burung hanya di kandang', () => {
    const { e } = mk();
    e.state.ledger.balance = 5_000_000; e.state.ledger.opening = 5_000_000;
    e.buyBibit('lele', 1); e.buyBibit('cacing', 1);
    expect(() => e.plant(0, 'lele', null)).toThrow(); // slot 0 = kebun
    expect(() => e.plant(1, 'cacing', null)).toThrow(); // slot 1 = kolam
    e.plant(1, 'lele', null);
    e.plant(0, 'cacing', null);
    expect(() => e.buySlot('kebun')).not.toThrow();
    expect(() => e.buySlot('kebun')).toThrow(); // kebun maksimum 2
    e.buySlot('kandang');
    expect(e.state.farm.habs.at(-1)).toBe('kandang');
  });

  it('simpanan v5 dimigrasi ke v6 dengan habitat dan cerita', () => {
    const e0 = new GameEngine(newState(3));
    const old = JSON.parse(JSON.stringify(e0.state));
    old.v = 5; delete old.farm.habs; delete old.story;
    old.farm.slots = [null, { itemId: 'lele', feed: null, plantedAt: 1, readyAt: 2, cost: 5 }, null, null];
    const m = migrate(old);
    expect(m.v).toBe(11);
    expect(m.farm.habs.length).toBe(4);
    expect(m.farm.habs[1]).toBe('kolam');
    expect(m.story.ch).toBe(0);
    expect(validateState(m)).toEqual([]);
  });
});

describe('penjualan hewan', () => {
  const open = (e, cust) => { e.startDay(); return cust; };
  it('rarity dan ukuran menentukan harga, serah barang salah ditolak, kas seimbang', () => {
    const { e } = mk();
    e.state.farm.animals.push({ id: 1, itemId: 'cacing', rarity: 'common', size: 1, cost: 100 }, { id: 2, itemId: 'cacing', rarity: 'rare', size: 1.2, cost: 100 }, { id: 3, itemId: 'jangkrik', rarity: 'common', size: 1, cost: 100 });
    const c = open(e, { id: 'x', type: 'biasa', wants: [{ itemId: 'cacing', qty: 1, noise: 1.0 }] });
    expect(e.serveAnimal(c, 0, 3)).toMatchObject({ ok: false, reason: 'salah' });
    expect(e.serveAnimal(c, 0, 999)).toMatchObject({ ok: false, reason: 'habis' });
    const r = e.serveAnimal(c, 0, 1);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(animalValue({ itemId: 'cacing', rarity: 'common', size: 1 }));
    const bal = e.state.ledger.balance;
    expect(e.pay('x')).toBe(r.total);
    expect(e.state.ledger.balance - bal).toBe(r.total);
    expect(e.animalCount('cacing')).toBe(1);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('pelanggan biasa membayar sekitar nilai hewan, batas atas 1.25x, kolektor boleh lebih', () => {
    const { e } = mk();
    e.state.farm.animals.push({ id: 1, itemId: 'cacing', rarity: 'legendary', size: 1, cost: 100 }, { id: 2, itemId: 'cacing', rarity: 'legendary', size: 1, cost: 100 });
    e.startDay();
    const biasa = { id: 'b', type: 'biasa', wants: [{ itemId: 'cacing', qty: 1, noise: 1 }] };
    const kol = { id: 'k', type: 'kolektor', wants: [{ itemId: 'cacing', qty: 1, noise: 1 }] };
    const rb = e.serveAnimal(biasa, 0, 1);
    const rk = e.serveAnimal(kol, 0, 2);
    const val = animalValue({ itemId: 'cacing', rarity: 'legendary', size: 1 });
    expect(rb.total).toBeGreaterThanOrEqual(Math.round(val * 0.9));
    expect(rb.total).toBeLessThanOrEqual(Math.round(val * 1.25));
    expect(rk.total).toBeGreaterThanOrEqual(rb.total);
  });

  it('permintaan rarity minimum menolak hewan common', () => {
    const { e } = mk();
    e.state.farm.animals.push({ id: 1, itemId: 'cacing', rarity: 'common', size: 1, cost: 1 });
    e.startDay();
    const v = { id: 'v', type: 'vip', wants: [{ itemId: 'cacing', qty: 1, noise: 1 }] };
    expect(e.serveAnimal(v, 0, 1)).toMatchObject({ ok: false, reason: 'kualitas' });
  });

  it('pesanan yang menggantung dikembalikan ke kandang saat hari berakhir', () => {
    const { e } = mk();
    e.state.farm.animals.push({ id: 1, itemId: 'cacing', rarity: 'common', size: 1, cost: 1 });
    e.startDay();
    e.serveAnimal({ id: 'z', type: 'biasa', wants: [{ itemId: 'cacing', qty: 1, noise: 1 }] }, 0, 1);
    e.endDay();
    expect(e.animalCount('cacing')).toBe(1);
  });
});

describe('pet', () => {
  it('menetas deterministik, memotong kas, slot pet terbatas', () => {
    const { e } = mk(3);
    e.state.ledger.balance = 1_000_000; e.state.ledger.opening = 1_000_000;
    const ids = [];
    for (let i = 0; i < 6; i++) ids.push(e.hatch('telur').id);
    expect(e.state.pets.owned.length).toBe(6);
    expect(e.state.ledger.balance).toBe(1_000_000 - 6 * EGGS[0].price);
    e.equipPet(ids[0]); e.equipPet(ids[1]);
    expect(() => e.equipPet(ids[2])).toThrow();
    e.unequipPet(ids[0]);
    e.equipPet(ids[2]);
    expect(e.state.pets.equipped.length).toBe(2);
    const { e: e2 } = mk(3);
    e2.state.ledger.balance = 1_000_000; e2.state.ledger.opening = 1_000_000;
    for (let i = 0; i < 6; i++) e2.hatch('telur');
    expect(e2.state.pets.owned).toEqual(e.state.pets.owned);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('buff pet menaikkan harga jual dan mempercepat tumbuh', () => {
    const { e } = mk();
    e.state.pets.owned.push({ id: 1, kind: 'dagang', rarity: 'mythic' }, { id: 2, kind: 'cepat', rarity: 'epic' });
    e.state.pets.nextId = 3;
    const base = e.farmBuffs();
    e.equipPet(1); e.equipPet(2);
    const b = e.farmBuffs();
    expect(b.value).toBeGreaterThan(base.value);
    expect(b.grow).toBeGreaterThan(base.grow);
    e.buyBibit('cacing', 1);
    const s = e.plant(0, 'cacing', null);
    expect(s.readyAt - s.plantedAt).toBeLessThan(45_000);
  });

  it('semua jenis pet punya buff bermakna', () => {
    for (const k of PET_KINDS) expect(k.text(k.base)).toMatch(/\d/);
  });
});

describe('simpanan dan simulasi', () => {
  it('simpan dan muat mempertahankan kolam, hewan, dan pet', () => {
    const { e, clock } = mk(8);
    e.buyBibit('cacing', 1);
    e.plant(0, 'cacing', null);
    e.hatch('telur');
    clock.t += 60_000;
    e.harvest(0);
    const back = deserialize(serialize(e.state));
    expect(validateState(back)).toEqual([]);
    expect(back.farm.animals).toEqual(e.state.farm.animals);
    expect(back.pets.owned).toEqual(e.state.pets.owned);
  });

  it('simulasi 100 hari: kas tidak pernah negatif dan buku kas tetap seimbang', () => {
    const { e, clock } = mk(4);
    for (let d = 0; d < 100; d++) {
      farmRound(e, clock);
      serveDay(e);
      expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
    }
    expect(auditLedger(e.state.ledger)).toEqual([]);
    expect(validateState(e.state)).toEqual([]);
    expect(e.state.stats.sold).toBeGreaterThan(0);
  });
});

describe('pengepul dan karyawan', () => {
  it('pengepul membayar 35% nilai dan kas seimbang', () => {
    const { e } = mk();
    e.state.farm.animals.push({ id: 1, itemId: 'lele', rarity: 'rare', size: 1, cost: 10 });
    const val = animalValue(e.state.farm.animals[0]);
    const bal = e.state.ledger.balance;
    expect(e.dealerSell(1)).toBe(Math.round(val * 0.35));
    expect(e.state.ledger.balance - bal).toBe(Math.round(val * 0.35));
    expect(() => e.dealerSell(1)).toThrow();
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('tiap jenis karyawan punya satu buff dan menumpuk menurut jumlah dan level', () => {
    const { e } = mk();
    const b0 = e.farmBuffs();
    const c0 = e.mods().count;
    e.state.crew.hired.push({ uid: 1, type: 'pramuniaga', lvl: 1 }, { uid: 2, type: 'pramuniaga', lvl: 1 }, { uid: 3, type: 'perawat', lvl: 1 }, { uid: 4, type: 'badut', lvl: 1 });
    const b = e.farmBuffs();
    expect(b.patience - b0.patience).toBeCloseTo(0.12, 5);
    expect(b.grow - b0.grow).toBeCloseTo(0.05, 5);
    expect(b.luck).toBe(b0.luck); // kasir/badut tidak menambah luck
    expect(e.mods().count / c0).toBeCloseTo(1.05, 5);
    e.state.crew.hired[0].lvl = 5; // level 5 = x2 kekuatan
    expect(e.farmBuffs().patience - b0.patience).toBeCloseTo(0.06 * 2 + 0.06, 5);
  });
});

describe('inventori pet', () => {
  it('pet dijual tetap tercatat di buku koleksi dan migrasi v6 membuatnya', async () => {
    const { e } = mk(5);
    e.state.ledger.balance = 1e12;
    const p = e.hatch('telur');
    expect(e.state.pets.book[p.kind][p.rarity]).toBe(1);
    e.equipPet(p.id);
    e.unequipPet(p.id);
    expect(e.state.pets.owned.length).toBe(1); // lepas dari slot tidak menghapus
    e.sellPet(p.id);
    expect(e.state.pets.owned.length).toBe(0);
    expect(e.state.pets.book[p.kind][p.rarity]).toBe(1);
    const old = JSON.parse(JSON.stringify(e.state));
    old.v = 6; delete old.pets.book; old.pets.owned.push({ id: 9, kind: 'hoki', rarity: 'rare' });
    const m = migrate(old);
    expect(m.v).toBe(11);
    expect(m.pets.book.hoki.rare).toBe(1);
  });
});

describe('lahan berlevel dengan daftar penghuni', () => {
  it('beberapa spesies dalam satu kolam, kapasitas ikut level, upgrade berbayar', () => {
    const { e, clock } = mk(9);
    e.state.ledger.balance = 1e9;
    expect(farmCap(e, 1)).toBe(2);
    e.buyBibit('lele', 2);

    e.plant(1, 'lele', null, 1);
    expect(e.state.farm.slots[1].length).toBe(1);
    e.plant(1, 'lele', null, 1);
    expect(e.state.farm.slots[1].length).toBe(2); // dua penghuni terpisah
    expect(() => { e.buyBibit('lele', 1); e.plant(1, 'lele', null, 1); }).toThrow('penuh');
    const b = e.state.ledger.balance;
    e.upgradeSpot(1);
    expect(b - e.state.ledger.balance).toBeGreaterThan(0);
    expect(farmCap(e, 1)).toBe(4);
    e.upgradeSpot(1);
    expect(() => e.upgradeSpot(1)).toThrow('maksimum');
    clock.t += 600_000;
    expect(e.spotReady(1)).toBe(2);
    const got = e.harvestSpot(1);
    expect(got.length).toBeGreaterThanOrEqual(2);
    expect(e.state.farm.slots[1]).toEqual([]);
  });

  it('migrasi v7 -> v8 mengubah isi lama menjadi satu penghuni dan memilih level cukup', () => {
    const { e } = mk(3);
    const old = JSON.parse(JSON.stringify(e.state));
    old.v = 7;
    delete old.farm.levels;
    old.farm.slots = [null, { itemId: 'lele', feed: null, plantedAt: 1, readyAt: 2, qty: 6, cost: 5 }, null];
    const m = migrate(old);
    expect(m.v).toBe(11);
    expect(m.farm.slots[1].length).toBe(1);
    expect(m.farm.levels).toEqual([1, 3, 1]);
    expect(validateState(m)).toEqual([]);
  });
});

describe('pakan dan lisensi bertahap', () => {
  it('pakan dibuka menurut level toko', () => {
    const { e } = mk();
    credit(e.state.ledger, 1, 'reward', 1_000_000, 'modal tes');
    e.buyFeed('dedak', 1);
    for (const [id, lv] of [['bagus', 2], ['premium', 3], ['super', 4], ['dewa', 5]]) {
      e.state.shopLevel = lv - 1;
      expect(() => e.buyFeed(id, 1), `${id} Lv${lv - 1}`).toThrow();
      e.state.shopLevel = lv;
      e.buyFeed(id, 1);
    }
  });
  it('lisensi tier 2 murah, tier 3 ke atas bertahap lebih mahal', async () => {
    const { ITEMS } = await import('../src/core/catalog.js');
    const t2 = ITEMS.filter((i) => i.tier === 2 && i.unlockCost > 0);
    const t3 = ITEMS.filter((i) => i.tier === 3 && i.unlockCost > 0);
    const t5 = ITEMS.filter((i) => i.tier === 5 && i.unlockCost > 0);
    expect(Math.max(...t2.map((i) => i.unlockCost))).toBeLessThanOrEqual(12000);
    expect(Math.min(...t3.map((i) => i.unlockCost))).toBeGreaterThan(Math.max(...t2.map((i) => i.unlockCost)));
    expect(Math.min(...t5.map((i) => i.unlockCost))).toBeGreaterThan(Math.max(...t3.map((i) => i.unlockCost)));
  });
});

describe('pencuri di kolam', () => {
  const mkE = (day = 10) => {
    const e = new GameEngine(newState('thief-seed'));
    e.state.day = day;
    return e;
  };
  it('tidak ada pencuri sebelum hari 4, dan rencana deterministik', () => {
    const e = mkE(2);
    expect(e.thiefPlan(3)).toBeNull();
    const a = e.thiefPlan(12);
    const b = e.thiefPlan(12);
    expect(b).toEqual(a);
  });
  it('sebagian hari ada pencuri, sebagian tidak', () => {
    const e = mkE();
    let n = 0;
    for (let d = 4; d < 104; d++) if (e.thiefPlan(d)) n += 1;
    expect(n).toBeGreaterThan(20);
    expect(n).toBeLessThan(65);
  });
  const withLots = (e) => {
    const fm = e.state.farm;
    fm.habs[0] = 'kolam';
    fm.slots[0] = [{ itemId: 'lele', feed: null, plantedAt: 0, readyAt: 1e12, qty: 3, cost: 900 }];
    e.today = { thief: { at: 0.5, pick: 0, pick2: 0, caughtRoll: 0.5, done: false }, thefts: [], chased: 0 };
  };
  it('tanpa satpam satu ekor hilang dari lahan', () => {
    const e = mkE();
    withLots(e);
    const r = e.resolveThief();
    expect(r.stolen).toBe(true);
    expect(e.state.farm.slots[0][0].qty).toBe(2);
    expect(e.state.farm.slots[0][0].cost).toBe(600);
    expect(e.today.thefts).toEqual([{ itemId: 'lele', n: 1 }]);
    expect(e.resolveThief()).toBeNull(); // sekali saja
  });
  it('lot terakhir yang dicuri dihapus', () => {
    const e = mkE();
    withLots(e);
    e.state.farm.slots[0][0].qty = 1;
    e.resolveThief();
    expect(e.state.farm.slots[0]).toEqual([]);
  });
  it('dengan satpam pencuri diusir dan tidak ada yang hilang', () => {
    const e = mkE();
    withLots(e);
    e.state.crew.hired.push({ uid: 9, type: 'satpam', lvl: 1 });
    const r = e.resolveThief();
    expect(r.caught).toBe(true);
    expect(e.state.farm.slots[0][0].qty).toBe(3);
    expect(e.today.chased).toBe(1);
  });
  it('satpam hanya menjaga kolam, kandang tidak terlindungi', () => {
    const e = mkE();
    withLots(e);
    e.state.farm.habs[0] = 'kandang';
    e.state.crew.hired.push({ uid: 9, type: 'satpam', lvl: 1 });
    expect(e.thiefCaught(0)).toBe(false);
    expect(e.resolveThief().stolen).toBe(true);
  });
  it('tanpa penghuni tidak ada yang dicuri', () => {
    const e = mkE();
    withLots(e);
    e.state.farm.slots[0] = [];
    expect(e.resolveThief()).toEqual({ none: true });
  });
});

describe('v10: aturan jual, gudang, pet', () => {
  const mkE = () => { const e = new GameEngine(newState('pol')); credit(e.state.ledger, 1, 'reward', 5_000_000, 'modal'); return e; };
  it('migrasi v9 menambah policy dan pets.extra', () => {
    const old = newState('mig'); old.v = 9; delete old.policy; delete old.pets.extra;
    const m = migrate(old);
    expect(m.v).toBe(11);
    expect(m.policy.obralPct).toBeGreaterThan(0);
    expect(m.pets.extra).toBe(0);
  });
  it('kapasitas gudang kecil di awal dan menahan panen saat penuh', () => {
    const e = mkE();
    expect(e.animalCap()).toBeLessThan(40);
    for (let i = 0; i < e.animalCap(); i++) e.state.farm.animals.push({ id: 9000 + i, itemId: 'cacing', rarity: 'common', size: 1, cost: 1 });
    expect(e.stockFull()).toBe(true);
  });
  it('mode pengepul menjual langsung saat panen, tahan dilewati kasir', () => {
    const e = mkE();
    e.setSellMode('common', 'pengepul');
    expect(e.state.policy.sell.common).toBe('pengepul');
    e.setSellMode('common', 'normal');
    expect(e.state.policy.sell.common).toBeUndefined();
    expect(() => e.setSellMode('common', 'ngawur')).toThrow();
  });
  it('auto-sell pet dan perluasan kandang', () => {
    const e = mkE();
    expect(() => e.setPetAuto('mythic', true)).toThrow();
    for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) e.setPetAuto(r, true);
    const before = e.state.pets.owned.length;
    e.hatch('telur');
    expect(e.state.pets.owned.length).toBe(before); // semua terjual otomatis
    const max = e.petMax();
    e.buyPetSpace();
    expect(e.petMax()).toBe(max + 20);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });
});
