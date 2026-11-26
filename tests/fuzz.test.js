import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { mulberry32 } from '../src/core/rng.js';
import { makeClock, farmRound } from './farmbot.js';
import { CITIES, DESTS, PUPS } from '../src/core/world2.js';
import { STAFF } from '../src/core/catalog.js';

const T = (fn) => { try { return fn(); } catch { return null; } };
const hasNaN = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__NaN__' : v)).includes('__NaN__');

describe('fuzz: permainan acak jangka panjang', () => {
  for (const seed of [11, 22, 33]) {
    it(`seed ${seed}: 150 hari aksi acak, data tetap valid`, () => {
      const e = new GameEngine(newState(seed));
      const clock = makeClock(e);
      const rng = mulberry32(seed * 7);
      credit(e.state.ledger, 1, 'reward', 200_000, 'modal tes');
      const seen = { exp: 0, runs: 0, cities: 1, skills: 0 };
      const pick = (a) => a[Math.floor(rng() * a.length)];
      for (let d = 0; d < 150; d++) {
        farmRound(e, clock);
        const s = e.state;
        if (d % 15 === 5) { s.stars = Math.max(s.stars, Math.min(5, 1 + Math.floor(d / 15))); credit(s.ledger, s.day, 'reward', 1_500_000, 'dana tes'); }
        if (rng() < 0.3) T(() => e.expandShop());
        if (rng() < 0.2) T(() => e.buyUpgrade(pick(['rak', 'dekorasi', 'renovasi'])));
        s.bonusPoints = (s.bonusPoints || 0) + 1; if (rng() < 0.5) T(() => e.learnSkill(pick(['tim', 'promosi', 'gudang', 'tawar', 'tim_besar', 'toko_ramai'])));
        if (rng() < 0.2) T(() => e.addAttr(pick(['dagang', 'karisma', 'tangkas', 'hoki'])));
        if (rng() < 0.3) { const st = pick(STAFF); s.crew.licenses[st.id] = true; s.skills.tim = Math.max(s.skills.tim || 0, 3); T(() => e.hire(st.id)); }
        if (rng() < 0.2) T(() => e.buyCity(pick(CITIES).id));
        if (rng() < 0.3) T(() => e.travelTo(pick(CITIES).id));
        if (rng() < 0.4 && s.crew.hired.length) T(() => e.sendExpedition(pick(s.crew.hired).uid, pick(DESTS).id, 1 + Math.floor(rng() * 3)));
        if (rng() < 0.05) T(() => e.fire(pick(s.crew.hired)?.uid));
        if (rng() < 0.1) T(() => e.setSellMode(pick(['common', 'uncommon', 'rare']), pick(['normal', 'obral', 'pengepul', 'tahan'])));
        if (rng() < 0.1) T(() => e.buyPup(pick(PUPS).id));
        if (s.stars >= 3 && rng() < 0.03) T(() => e.prestigeNow());
        credit(e.state.ledger, e.state.day, 'reward', 20_000, 'subsidi tes');
        e.startDay();
        e.endDay();
        const st = e.state;
        expect(validateState(st), `hari ${st.day}`).toEqual([]);
        expect(auditLedger(st.ledger)).toEqual([]);
        expect(hasNaN(st)).toBe(false);
        expect(st.farm.animals.length).toBeLessThanOrEqual(e.animalCap() + 0);
        seen.exp = Math.max(seen.exp, st.exped.done); seen.runs = st.prestige.runs; seen.cities = Math.max(seen.cities, Object.keys(st.cities.owned).length); seen.skills = Math.max(seen.skills, Object.keys(st.skills).length);
      }
      expect(seen.cities).toBeGreaterThan(1);
      expect(seen.exp).toBeGreaterThan(0);
      console.log('cakupan', seed, JSON.stringify(seen), 'hari', e.state.day);
    });
  }
});
