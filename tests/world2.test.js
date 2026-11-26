import { describe, it, expect } from 'vitest';
import { GameEngine, newState, migrate } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { CITIES, DESTS, PUPS } from '../src/core/world2.js';

const mk = (seed = 5) => { const e = new GameEngine(newState(seed)); credit(e.state.ledger, 1, 'reward', 9_000_000, 'modal tes'); return e; };
const day = (e) => { e.startDay(); return e.endDay(); };
const staff = (e) => { e.state.crew.licenses.kasir = true; e.state.crew.hired.push({ uid: e.state.crew.nextUid++, type: 'kasir', lvl: 1 }); return e.state.crew.hired.at(-1); };

describe('kota / cabang', () => {
  it('cabang butuh bintang dan uang, ongkos pindah dicatat, dan data lolos validasi', () => {
    const e = mk();
    expect(() => e.buyCity('bandung')).toThrow(/bintang/);
    e.state.stars = 2;
    e.buyCity('bandung');
    expect(() => e.buyCity('bandung')).toThrow();
    e.travelTo('bandung');
    expect(e.state.cities.at).toBe('bandung');
    expect(() => e.travelTo('bali')).toThrow();
    expect(validateState(e.state)).toEqual([]);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });
  it('kota mengubah sewa, pelanggan, dan minat kategori', () => {
    const e = mk();
    e.state.stars = 5;
    const base = e.mods();
    e.buyCity('bandung');
    e.travelTo('bandung');
    const m = e.mods();
    expect(m.rent).toBe(base.rent + CITIES[1].rent);
    expect(m.count).toBeGreaterThan(base.count);
    day(e);
    expect(e.state.cities.stats.bandung.days).toBe(1);
  });
  it('tidak bisa pindah saat toko buka', () => {
    const e = mk();
    e.state.stars = 2; e.buyCity('bandung');
    e.startDay();
    expect(() => e.travelTo('bandung')).toThrow();
  });
});

describe('ekspedisi', () => {
  it('karyawan pergi, pulang di hari yang tepat, dan membawa hasil', () => {
    const e = mk();
    const m = staff(e);
    e.sendExpedition(m.uid, 'hutan', 1);
    expect(m.away).toBe(true);
    expect(() => e.sendExpedition(m.uid, 'laut', 1)).toThrow();
    expect(() => e.fire(m.uid)).toThrow();
    expect(validateState(e.state)).toEqual([]);
    const sum = day(e);
    expect(sum.exped.length).toBe(1);
    expect(m.away).toBeUndefined();
    expect(e.state.exped.active.length).toBe(0);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });
  it('gudang penuh: hasil dijual otomatis dan tidak melebihi kapasitas', () => {
    const e = mk(9);
    const m = staff(e);
    e.state.shopLevel = 5; e.state.skills.mata_elang = 3;
    const cap = e.animalCap();
    while (e.state.farm.animals.length < cap) e.state.farm.animals.push({ id: e.state.farm.nextAnimal++, itemId: 'lele', rarity: 'common', size: 1, cost: 0 });
    const cash0 = e.state.ledger.balance;
    e.sendExpedition(m.uid, 'rimba', 3);
    const cash1 = e.state.ledger.balance;
    let res = [];
    for (let i = 0; i < 3; i++) { e.startDay(); res = res.concat(e.endDay().exped); }
    expect(res.length).toBe(1);
    expect(e.state.farm.animals.length).toBe(cap);
    if (!res[0].failed) expect(res[0].sold + res[0].cash).toBeGreaterThan(0);
    expect(cash1).toBeLessThan(cash0);
    expect(validateState(e.state)).toEqual([]);
  });
  it('tujuan dan lama valid', () => {
    expect(DESTS.length).toBeGreaterThan(2);
    const e = mk();
    const m = staff(e);
    expect(() => e.sendExpedition(m.uid, 'hutan', 9)).toThrow();
    expect(() => e.sendExpedition(m.uid, 'x', 1)).toThrow();
  });
});
describe('prestise', () => {
  it('butuh bintang, memberi poin, mereset uang/toko, membawa skill, pet, dan koleksi', () => {
    const e = mk();
    expect(e.canPrestige()).toBe(false);
    e.state.stars = 4; e.state.day = 60; e.state.stats.revenue = 4_000_000; e.state.shopLevel = 3;
    e.state.skills.promosi = 2; e.state.pets.owned.push({ id: 99, kind: 'hoki', rarity: 'rare' });
    const gain = e.prestigeGain();
    expect(gain).toBeGreaterThan(5);
    e.prestigeNow();
    const s = e.state;
    expect(s.prestige.points).toBe(gain);
    expect(s.prestige.runs).toBe(1);
    expect(s.day).toBe(1);
    expect(s.shopLevel).toBe(1);
    expect(s.stars).toBe(1);
    expect(s.skills.promosi).toBe(2);
    expect(s.pets.owned.some((p) => p.id === 99)).toBe(true);
    expect(validateState(s)).toEqual([]);
    expect(auditLedger(s.ledger)).toEqual([]);
  });
  it('bonus permanen dibeli dengan poin dan berpengaruh', () => {
    const e = mk();
    e.state.prestige.points = 50;
    const cap0 = e.animalCap();
    const pay0 = e.mods().payMul;
    for (const p of PUPS) e.buyPup(p.id);
    expect(e.animalCap()).toBe(cap0 + 20);
    expect(e.mods().payMul).toBeGreaterThan(pay0);
    expect(e.state.prestige.points).toBeLessThan(50);
    e.state.prestige.points = 0;
    expect(() => e.buyPup('pgold')).toThrow();
  });
  it('migrasi v11 -> v12 menambah data baru dan lolos validasi', () => {
    const e = mk();
    const old = JSON.parse(JSON.stringify(e.state));
    old.v = 11; delete old.cities; delete old.exped; delete old.prestige;
    const m = migrate(old);
    expect(m.v).toBe(12);
    expect(validateState(m)).toEqual([]);
  });
});
