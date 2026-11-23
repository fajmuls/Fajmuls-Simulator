import { describe, it, expect } from 'vitest';
import { GameEngine, newState, migrate } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { STAFF } from '../src/core/catalog.js';
import { guardChance } from '../src/core/crew.js';
import { makeClock } from './farmbot.js';

const mk = (seed = 3) => { const e = new GameEngine(newState(seed)); const clock = makeClock(e); credit(e.state.ledger, 1, 'reward', 5_000_000, 'modal tes'); return { e, clock }; };
const free = (e, type) => { e.state.skills.tim = (e.state.skills.tim || 0) + 1; e.state.crew.licenses[type] = true; return e.hire(type); };

describe('karyawan v9', () => {
  it('katalog: tiap jenis punya batas jumlah dan satu efek (buff atau pekerjaan)', () => {
    for (const st of STAFF) {
      expect(st.max).toBeGreaterThanOrEqual(1);
      expect(st.max).toBeLessThanOrEqual(3);
      expect(!!st.buff !== !!st.job).toBe(true);
      expect(st.mission.goal).toBeGreaterThan(0);
      if (!st.secret) expect(st.license).toBeGreaterThan(0);
    }
    expect(STAFF.filter((s) => s.secret).length).toBeGreaterThanOrEqual(2);
  });

  it('lisensi dibeli dengan uang, misi membuka otomatis, rahasia hanya lewat misi', () => {
    const { e } = mk();
    expect(e.crewStatus('kasir').unlocked).toBe(false);
    const cash = e.state.ledger.balance;
    e.buyLicense('kasir');
    expect(e.state.ledger.balance).toBe(cash - 6000);
    expect(e.crewStatus('kasir')).toMatchObject({ unlocked: true, via: 'lisensi' });
    expect(() => e.buyLicense('kasir')).toThrow(/Sudah terbuka/);
    expect(() => e.buyLicense('petani')).toThrow(/misi/);
    e.state.stats.customers = 120;
    expect(e.crewStatus('badut')).toMatchObject({ unlocked: true, via: 'misi' });
    e.state.stats.bred = 200;
    expect(e.crewStatus('petani').unlocked).toBe(true);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('batas jumlah per jenis dan slot dari skill', () => {
    const { e } = mk();
    e.state.crew.licenses.satpam = true;
    e.state.skills.tim = 5;
    e.hire('satpam');
    e.hire('satpam');
    expect(() => e.hire('satpam')).toThrow(/maksimal 2/);
    expect(e.crewSlots()).toBe(5);
  });

  it('upgrade berbayar menaikkan level, gaji, dan kekuatan buff', () => {
    const { e } = mk();
    const m = free(e, 'pramuniaga');
    const w0 = e.wages();
    const p0 = e.crewBuff('patience');
    const cash = e.state.ledger.balance;
    const cost = e.upgradeCrew(m.uid);
    expect(e.state.ledger.balance).toBe(cash - cost);
    expect(m.lvl).toBe(2);
    expect(e.wages()).toBeGreaterThan(w0);
    expect(e.crewBuff('patience')).toBeCloseTo(p0 * 1.25, 5);
    for (let i = 0; i < 3; i++) e.upgradeCrew(m.uid);
    expect(m.lvl).toBe(5);
    expect(() => e.upgradeCrew(m.uid)).toThrow(/maksimal/);
  });

  it('skill Tim Sigap mempercepat kerja, level juga', () => {
    const { e } = mk();
    const m = free(e, 'kasir');
    const t0 = e.workInterval(m);
    e.state.skills.tim_cepat = 5;
    expect(e.workInterval(m)).toBeCloseTo(t0 / 1.5, 5);
    m.lvl = 5;
    expect(e.workInterval(m)).toBeCloseTo(t0 / 1.5 / 2, 5);
  });

  it('migrasi v8 -> v9 mempertahankan karyawan lama dengan slot bonus', () => {
    const old = JSON.parse(JSON.stringify(newState(4)));
    old.v = 8;
    delete old.crew;
    old.staff = { kasir: true, satpam: true };
    const m = migrate(old);
    expect(m.v).toBe(9);
    expect(m.staff).toBeUndefined();
    expect(m.crew.hired.map((x) => x.type).sort()).toEqual(['kasir', 'satpam']);
    expect(m.crew.bonusSlots).toBe(2);
    expect(validateState(m)).toEqual([]);
    const e = new GameEngine(m);
    expect(e.crewSlots()).toBe(2);
    expect(e.crewCount('kasir')).toBe(1);
  });

  it('validasi menolak karyawan melebihi batas atau jenis asing', () => {
    const { e } = mk();
    const s = JSON.parse(JSON.stringify(e.state));
    s.crew.hired = [1, 2, 3, 4].map((uid) => ({ uid, type: 'satpam', lvl: 1 }));
    expect(validateState(s).length).toBeGreaterThan(0);
    s.crew.hired = [{ uid: 1, type: 'hantu', lvl: 1 }];
    expect(validateState(s).length).toBeGreaterThan(0);
  });

  it('peluang satpam mengusir bertambah dengan jumlah dan level', () => {
    const { e } = mk();
    expect(guardChance(e)).toBe(0);
    const a = free(e, 'satpam');
    const one = guardChance(e);
    free(e, 'satpam');
    const two = guardChance(e);
    expect(one).toBeGreaterThan(0.4);
    expect(two).toBeGreaterThan(one);
    a.lvl = 5;
    expect(guardChance(e)).toBeGreaterThan(two);
    expect(guardChance(e)).toBeLessThan(1);
  });
});

describe('kasir otomatis', () => {
  it('memilih hewan termurah yang memenuhi syarat jenis dan rarity', () => {
    const { e } = mk();
    const fm = e.state.farm;
    fm.animals.push({ id: 1, itemId: 'lele', rarity: 'rare', size: 1, cost: 1 }, { id: 2, itemId: 'lele', rarity: 'common', size: 1, cost: 1 }, { id: 3, itemId: 'cacing', rarity: 'common', size: 1, cost: 1 });
    const cust = { id: 1, type: 'biasa', wants: [{ itemId: 'lele', noise: 1 }] };
    expect(e.cashierPick(cust, 0)).toBe(2);
    e.orderInfo = () => ({ itemId: 'lele', qty: 1, minQuality: 3 });
    expect(e.cashierPick(cust, 0)).toBe(1);
    e.orderInfo = () => ({ itemId: 'lele', qty: 1, minQuality: 5 });
    expect(e.cashierPick(cust, 0)).toBeNull();
  });
});

describe('penjaga stok', () => {
  const setup = () => {
    const { e, clock } = mk();
    e.state.shopLevel = 2;
    free(e, 'penjaga');
    e.setKeeperRule('lele', { below: 5, qty: 2, feed: null });
    return { e, clock };
  };

  it('aturan disimpan, 0 menghapus', () => {
    const { e } = setup();
    expect(e.state.crew.keeper.rules.lele).toEqual({ below: 5, qty: 2, feed: null });
    e.setKeeperRule('lele', { below: 0 });
    expect(e.state.crew.keeper.rules.lele).toBeUndefined();
  });

  it('menanam bila stok kurang dari ambang, membeli bibit otomatis', () => {
    const { e } = setup();
    const plan = e.keeperPlan();
    expect(plan).toMatchObject({ type: 'tanam', itemId: 'lele', qty: 2, buy: 2 });
    const bal = e.state.ledger.balance;
    e.keeperPerform(plan);
    expect(e.state.ledger.balance).toBeLessThan(bal);
    expect(e.state.farm.slots[plan.slot][0]).toMatchObject({ itemId: 'lele', qty: 2 });
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('tidak menanam bila stok sudah cukup (hewan jadi + yang tumbuh)', () => {
    const { e } = setup();
    for (let i = 0; i < 5; i++) e.state.farm.animals.push({ id: 100 + i, itemId: 'lele', rarity: 'common', size: 1, cost: 1 });
    expect(e.keeperPlan()).toBeNull();
  });

  it('tanpa autoBuy dan tanpa bibit tidak berbuat apa-apa', () => {
    const { e } = setup();
    e.setKeeperOpts({ autoBuy: false });
    expect(e.keeperPlan()).toBeNull();
    e.state.farm.bibit.lele = 2;
    expect(e.keeperPlan()).toMatchObject({ type: 'tanam', buy: 0 });
  });

  it('memanen yang siap lebih dulu, dan menghindari lahan yang sedang dikerjakan', () => {
    const { e, clock } = setup();
    const plan = e.keeperPlan();
    e.keeperPerform(plan);
    clock.t += 200_000;
    const p2 = e.keeperPlan();
    expect(p2).toMatchObject({ type: 'panen', slot: plan.slot });
    const p3 = e.keeperPlan(new Set([plan.slot]));
    expect(p3?.type === 'panen').toBe(false);
    e.keeperPerform(p2);
    expect(e.animalCount('lele')).toBe(2);
  });

  it('uang cadangan kewajiban harian tidak dipakai membeli bibit', () => {
    const { e } = setup();
    e.state.ledger.balance = e.dailyObligations() + 10;
    expect(e.keeperPlan()).toBeNull();
  });
});
