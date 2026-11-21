import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { REGULARS, bondLevel, BOND_THRESH, LEVEL_REWARDS } from '../src/core/regulars.js';
import { runDay } from './engine.test.js';

describe('langganan', () => {
  it('12 langganan unik dengan favorit nyata', () => {
    expect(new Set(REGULARS.map((r) => r.id)).size).toBe(12);
    const e = new GameEngine(newState(1));
    for (const r of REGULARS) expect(() => e.isUnlocked(r.fav)).not.toThrow();
  });

  it('level kedekatan mengikuti ambang', () => {
    expect(bondLevel(0)).toBe(1);
    BOND_THRESH.forEach((t, i) => expect(bondLevel(t)).toBe(i + 1));
    expect(bondLevel(999)).toBe(5);
  });

  const stockUp = (e) => {
    for (const it of e.unlockedItems()) {
      const n = Math.min(e.totalQty(it.id) < 8 ? 8 : 0, e.maxAffordable(it.id, 3));
      if (n > 0 && e.state.ledger.balance > 5000) e.buyStock(it.id, 3, n);
    }
  };
  const playDay = (e) => {
    stockUp(e);
    const plan = e.startDay();
    const regs = plan.filter((c) => c.regularId).map((c) => c.id);
    for (const c of plan) {
      let any = false;
      for (let i = 0; i < c.wants.length; i++) if (e.browse(c, i).ok) any = true;
      e.pay(c.id);
      e.customerLeft(c.id, any);
    }
    e.endDay();
    return regs;
  };

  it('rencana deterministik dan maksimal 3 langganan per hari', () => {
    const a = new GameEngine(newState(11));
    const b = new GameEngine(newState(11));
    for (let d = 0; d < 25; d++) {
      const ra = playDay(a); const rb = playDay(b);
      expect(ra).toEqual(rb);
      expect(ra.length).toBeLessThanOrEqual(3);
    }
  });

  it('simulasi 60 hari: kedekatan tumbuh, hadiah dapat diambil sekali, buku kas tetap seimbang', () => {
    const e = new GameEngine(newState(5));
    for (let i = 0; i < 60; i++) playDay(e);
    const entries = Object.entries(e.state.regulars);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some(([, r]) => r.bond > 0 && r.visits > 0)).toBe(true);
    expect(auditLedger(e.state.ledger)).toEqual([]);
    expect(validateState(e.state)).toEqual([]);
    for (const [id, r] of entries) {
      let guard = 0;
      while ((r.claimed ?? 1) < bondLevel(r.bond) && guard++ < 6) {
        const before = e.state.ledger.balance;
        const got = e.claimRegular(id);
        expect(e.state.ledger.balance - before).toBe(got.cash || 0);
        expect(LEVEL_REWARDS[got.level]).toBeTruthy();
      }
      expect(() => e.claimRegular(id)).toThrow();
    }
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('claimRegular menolak langganan yang belum pernah datang', () => {
    const e = new GameEngine(newState(2));
    expect(() => e.claimRegular('joko')).toThrow();
  });
});

describe('isi ke target', () => {
  it('mengisi sampai target tanpa menembus kas dan tetap seimbang', () => {
    const e = new GameEngine(newState(9));
    e.setRestock('cacing', 20, 1);
    const log = e.refillToTargets();
    expect(e.totalQty('cacing')).toBe(20);
    expect(log[0].n).toBe(20);
    expect(e.refillToTargets()).toEqual([]);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });
});

describe('pelayanan manual', () => {
  const setup = () => {
    const e = new GameEngine(newState(3));
    e.buyStock('cacing', 1, 10);
    e.buyStock('jangkrik', 1, 10);
    e.startDay();
    return e;
  };
  const cust = (itemId, id = 'm1') => ({ id, type: 'biasa', wants: [{ itemId, qty: 2, noise: 1.05 }] });

  it('barang salah ditolak tanpa mengubah stok', () => {
    const e = setup();
    const before = e.totalQty('jangkrik');
    expect(e.browse(cust('cacing'), 0, { itemId: 'jangkrik', quality: 1 })).toMatchObject({ ok: false, reason: 'salah' });
    expect(e.totalQty('jangkrik')).toBe(before);
  });

  it('barang benar terjual, tip cepat 10%, buku kas seimbang', () => {
    const e = setup();
    const c = cust('cacing');
    const r = e.browse(c, 0, { itemId: 'cacing', quality: 1 });
    expect(r.ok).toBe(true);
    const bal = e.state.ledger.balance;
    const total = e.pay(c.id, { fast: true });
    expect(e.state.ledger.balance - bal).toBe(total + Math.round(total * 0.1));
    expect(e.today.tips).toBe(Math.round(total * 0.1));
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('kualitas lot yang diserahkan harus ada di stok', () => {
    const e = setup();
    expect(e.browse(cust('cacing'), 0, { itemId: 'cacing', quality: 2 })).toMatchObject({ ok: false, reason: 'habis' });
  });
});
