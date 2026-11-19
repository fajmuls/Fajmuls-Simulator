import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { ITEMS } from '../src/core/catalog.js';

function runDay(engine) {
  const plan = engine.startDay();
  for (const c of plan) {
    let any = false;
    for (let i = 0; i < c.wants.length; i++) {
      const r = engine.browse(c, i);
      if (r.ok) any = true;
    }
    engine.pay(c.id);
    engine.customerLeft(c.id, any);
  }
  return engine.endDay();
}

function sumStock(engine) {
  return Object.values(engine.state.stock).reduce((s, l) => s + l.qty, 0);
}

describe('engine: belanja', () => {
  it('membeli stok mengurangi uang tepat sebesar harga grosir', () => {
    const e = new GameEngine(newState(42));
    const before = e.state.ledger.balance;
    const unit = e.wholesalePrice('cacing', 2);
    const total = e.buyStock('cacing', 2, 10);
    expect(total).toBe(unit * 10);
    expect(e.state.ledger.balance).toBe(before - unit * 10);
    expect(e.state.stock['cacing:2'].qty).toBe(10);
    expect(e.state.stock['cacing:2'].cost).toBe(unit * 10);
  });

  it('menolak beli bila uang atau kapasitas tidak cukup, tanpa mengubah state', () => {
    const e = new GameEngine(newState(42));
    const snapshot = JSON.stringify(e.state);
    expect(() => e.buyStock('koi', 1, 1)).toThrow(); // belum terbuka
    expect(() => e.buyStock('cacing', 5, 1)).toThrow(); // kualitas belum tersedia
    expect(() => e.buyStock('cacing', 2, 0)).toThrow();
    expect(() => e.buyStock('cacing', 2, 1.5)).toThrow();
    expect(() => e.buyStock('cacing', 2, 61)).toThrow(); // melewati kapasitas
    expect(() => e.buyStock('ikan', 2, 1)).toThrow();
    expect(JSON.stringify(e.state)).toBe(snapshot);
  });

  it('upgrade rak menambah kapasitas dan memotong uang', () => {
    const e = new GameEngine(newState(7));
    expect(e.capacity()).toBe(60);
    const before = e.state.ledger.balance;
    e.buyUpgrade('rak');
    expect(e.capacity()).toBe(100);
    expect(e.state.ledger.balance).toBe(before - 15000);
  });

  it('kontrak supplier membuka Ikan Koi dan kualitas lebih tinggi', () => {
    const s = newState(7);
    const e = new GameEngine(s);
    e.buyUpgrade('supplier');
    expect(e.isUnlocked('koi')).toBe(true);
    expect(e.maxQuality()).toBe(4);
  });
});

describe('engine: hari berjalan', () => {
  it('tidak bisa belanja saat toko buka', () => {
    const e = new GameEngine(newState(1));
    e.buyStock('cacing', 2, 10);
    e.startDay();
    expect(() => e.buyStock('cacing', 2, 1)).toThrow();
    expect(() => e.setPrice('cacing', 2, 900)).toThrow();
  });

  it('penjualan: pendapatan masuk ke kas, stok berkurang, modal terbawa', () => {
    const e = new GameEngine(newState(3));
    e.buyStock('cacing', 3, 40);
    e.buyStock('pelet', 3, 20);
    const startCash = e.state.ledger.balance;
    const startStock = sumStock(e);
    const summary = runDay(e);
    const sold = startStock - sumStock(e);
    expect(summary.soldUnits).toBe(sold);
    expect(e.state.ledger.balance).toBe(startCash + summary.revenue - Math.min(3000, startCash + summary.revenue));
    expect(summary.grossProfit).toBe(summary.revenue - summary.cogs);
    expect(auditLedger(e.state.ledger)).toEqual([]);
    expect(validateState(e.state)).toEqual([]);
  });

  it('harga terlalu mahal membuat pelanggan pergi (tidak ada penjualan)', () => {
    const e = new GameEngine(newState(5));
    e.buyStock('cacing', 3, 30);
    e.setPrice('cacing', 3, e.retailRef('cacing', 3) * 4);
    const s = runDay(e);
    expect(s.soldUnits).toBe(0);
    expect(s.revenue).toBe(0);
    expect(e.state.stock['cacing:3'].qty).toBe(30);
  });

  it('toko tanpa stok tidak menjual apa pun dan reputasi turun/tetap 0 batas bawah', () => {
    const e = new GameEngine(newState(9));
    const s = runDay(e);
    expect(s.revenue).toBe(0);
    expect(e.state.reputation).toBeGreaterThanOrEqual(0);
  });

  it('pesanan yang belum dibayar dikembalikan ke stok saat hari berakhir', () => {
    const e = new GameEngine(newState(11));
    e.buyStock('cacing', 3, 30);
    const plan = e.startDay();
    let reservedQty = 0;
    for (const c of plan) {
      for (let i = 0; i < c.wants.length; i++) {
        const r = e.browse(c, i);
        if (r.ok) reservedQty += r.qty;
      }
      // sengaja tidak memanggil pay()
    }
    expect(reservedQty).toBeGreaterThan(0);
    const cash = e.state.ledger.balance;
    e.endDay();
    expect(e.state.stock['cacing:3'].qty).toBe(30);
    expect(e.state.stock['cacing:3'].cost).toBe(e.wholesalePrice('cacing', 3, 1) * 30);
    expect(e.state.ledger.balance).toBe(cash - 3000);
  });

  it('sewa yang tak terbayar menjadi tunggakan, saldo tidak pernah negatif', () => {
    const s = newState(13);
    s.ledger = { ...s.ledger };
    const e = new GameEngine(s);
    // habiskan uang
    e.buyStock('cacing', 3, 60);
    while (e.state.ledger.balance > 0 && e.maxAffordable('lele', 3) === 0) break;
    const bal = e.state.ledger.balance;
    expect(bal).toBeGreaterThanOrEqual(0);
    runDay(e);
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
    expect(e.state.arrears).toBeGreaterThanOrEqual(0);
  });

  it('hari yang sama dengan benih yang sama menghasilkan rencana pelanggan yang sama', () => {
    const a = new GameEngine(newState(99));
    const b = new GameEngine(newState(99));
    a.buyStock('cacing', 3, 20);
    b.buyStock('cacing', 3, 20);
    expect(a.generatePlan()).toEqual(b.generatePlan());
  });
});

describe('engine: audit simulasi 120 hari', () => {
  it('bot yang belanja dan jualan 120 hari tetap lolos audit keuangan', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const e = new GameEngine(newState(seed));
      for (let d = 0; d < 120; d++) {
        // bot: beli sedikit untuk setiap barang, upgrade bila uang berlimpah
        for (const it of e.unlockedItems()) {
          const q = Math.min(3, e.maxQuality());
          const n = Math.min(8, e.maxAffordable(it.id, q));
          if (n > 0 && e.state.ledger.balance > 10000) e.buyStock(it.id, q, n);
        }
        for (const id of ['rak', 'dekorasi', 'supplier']) {
          const c = e.upgradeCost(id);
          if (c !== null && e.state.ledger.balance > c + 20000) { e.buyUpgrade(id); break; }
        }
        runDay(e);
        expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
        expect(auditLedger(e.state.ledger)).toEqual([]);
        for (const lot of Object.values(e.state.stock)) {
          expect(lot.qty).toBeGreaterThanOrEqual(0);
          expect(lot.cost).toBeGreaterThanOrEqual(0);
          if (lot.qty === 0) expect(lot.cost).toBe(0);
        }
        expect(e.usedCapacity()).toBeLessThanOrEqual(e.capacity());
      }
      expect(validateState(e.state)).toEqual([]);
      expect(e.state.day).toBe(121);
      expect(ITEMS.length).toBeGreaterThan(0);
    }
  });
});
