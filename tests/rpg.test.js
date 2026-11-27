import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { validateState, serialize, deserialize } from '../src/core/save.js';
import * as rpg from '../src/core/rpg.js';
import { animalCap } from '../src/core/farm.js';

const mk = (seed = 1) => new GameEngine(newState(seed));
const withPets = (e, rarity = 'common', n = 2) => {
  const ids = [];
  for (let i = 0; i < n; i++) { e.state.pets.owned.push({ id: e.state.pets.nextId, kind: 'hoki', rarity }); ids.push(e.state.pets.nextId++); }
  e.state.pets.equipped = ids;
};

describe('petualangan', () => {
  it('energi awal penuh dan pulih +2 per hari', () => {
    const e = mk();
    withPets(e);
    const r = rpg.rpgOf(e);
    expect(r.energy).toBeGreaterThan(0);
    rpg.startRun(e, 'hutan');
    const after = rpg.rpgOf(e).energy;
    e.state.day += 1;
    expect(rpg.rpgOf(e).energy).toBe(Math.min(rpg.maxEnergy(e), after + 2));
  });

  it('butuh pet terpasang dan energi', () => {
    const e = mk();
    expect(() => rpg.startRun(e, 'hutan')).toThrow(/pet/i);
    withPets(e);
    rpg.rpgOf(e).energy = 0;
    expect(() => rpg.startRun(e, 'hutan')).toThrow(/Energi/);
    expect(() => rpg.startRun(e, 'tidakada')).toThrow();
  });

  it('peluang menang wajar: seimbang 50%, lebih kuat lebih tinggi, hati-hati lebih rendah', () => {
    expect(rpg.winChance(10, 10)).toBeCloseTo(0.5, 5);
    expect(rpg.winChance(20, 10)).toBeCloseTo(0.75, 5);
    expect(rpg.winChance(5, 10)).toBeLessThan(0.5);
    expect(rpg.winChance(10, 10, 'hati')).toBeLessThan(rpg.winChance(10, 10, 'serang'));
    expect(rpg.winChance(1000, 1)).toBeLessThanOrEqual(0.95);
    expect(rpg.winChance(1, 1000)).toBeGreaterThanOrEqual(0.05);
  });

  it('hasil deterministik untuk benih dan aksi yang sama', () => {
    const play = () => {
      const e = mk(7);
      withPets(e, 'epic', 3);
      rpg.startRun(e, 'hutan');
      for (let i = 0; i < 40 && rpg.rpgOf(e).run; i++) rpg.step(e, 'serang');
      return JSON.stringify(rpg.rpgOf(e).last);
    };
    expect(play()).toBe(play());
  });

  it('petualangan selesai, hadiah masuk, buku kas seimbang, simpanan valid', () => {
    const e = mk(3);
    withPets(e, 'mythic', 3);
    const before = e.state.ledger.balance;
    rpg.startRun(e, 'hutan');
    let guard = 0;
    while (rpg.rpgOf(e).run && guard++ < 60) rpg.step(e, 'serang');
    const r = rpg.rpgOf(e);
    expect(r.run).toBeNull();
    expect(r.last).toBeTruthy();
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(before);
    expect(auditLedger(e.state.ledger)).toEqual([]);
    expect(validateState(deserialize(serialize(e.state)))).toEqual([]);
    const p = e.state.pets.owned[0];
    expect((p.lv || 1) > 1 || (p.xp || 0) > 0).toBe(true);
  });

  it('mundur membawa semua hadiah, kalah total membawa separuh', () => {
    const e = mk(5);
    withPets(e, 'mythic', 3);
    rpg.startRun(e, 'hutan');
    rpg.step(e, 'serang');
    const run = rpg.rpgOf(e).run;
    const n = run ? run.loot.length : 0;
    if (run) {
      const res = rpg.step(e, 'mundur');
      expect(res.over).toBe(true);
      expect(res.summary.loot).toHaveLength(n);
      expect(res.summary.lost).toBe(0);
    }
    const f = mk(6);
    withPets(f, 'common', 1);
    rpg.startRun(f, 'menara');
    f.state.rpg.run.loot.push({ k: 'uang', n: 100 }, { k: 'uang', n: 100 });
    f.state.rpg.run.hp = 1;
    let guard = 0;
    while (f.state.rpg.run && guard++ < 50) rpg.step(f, 'serang');
    expect(f.state.rpg.last.reason).toBe('kalah');
    expect(f.state.rpg.last.lost).toBeGreaterThanOrEqual(1);
  });

  it('gudang penuh: hewan hadiah dijual otomatis dan kas seimbang', () => {
    const e = mk(9);
    for (let i = 0; i < animalCap(e); i++) e.state.farm.animals.push({ id: 9000 + i, itemId: 'cacing', rarity: 'common', size: 1, cost: 1 });
    const before = e.state.ledger.balance;
    const res = rpg.applyLoot(e, [{ k: 'hewan', id: 'lele', rar: 'epic', size: 1 }]);
    expect(res.converted).toBe(1);
    expect(e.state.ledger.balance).toBeGreaterThan(before);
    expect(e.state.farm.animals).toHaveLength(animalCap(e));
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('hadiah bibit, pakan, dan hewan masuk ke tempatnya', () => {
    const e = mk(2);
    rpg.applyLoot(e, [{ k: 'bibit', id: 'cacing', n: 2 }, { k: 'pakan', id: 'dedak', n: 3 }, { k: 'hewan', id: 'lele', rar: 'rare', size: 1.1 }]);
    expect(e.state.farm.bibit.cacing).toBe(2);
    expect(e.state.farm.feeds.dedak).toBe(3);
    expect(e.state.farm.animals.some((a) => a.itemId === 'lele' && a.rarity === 'rare')).toBe(true);
    expect(e.state.farm.book.lele.rare.n).toBe(1);
  });
});
