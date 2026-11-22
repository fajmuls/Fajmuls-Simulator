import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { UPGRADES, ITEMS } from '../src/core/catalog.js';

export function runDay(engine) {
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

const sumStock = (e) => Object.values(e.state.stock).reduce((s, l) => s + l.qty, 0);

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

  it('menolak beli bila tidak valid, tanpa mengubah state', () => {
    const e = new GameEngine(newState(42));
    const snapshot = JSON.stringify(e.state);
    expect(() => e.buyStock('koi', 1, 1)).toThrow(); // spesies belum dibuka
    expect(() => e.buyStock('pipit', 1, 1)).toThrow(); // kategori belum dibuka
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
    expect(e.state.ledger.balance).toBe(before - UPGRADES.find((u) => u.id === 'rak').costs[0]);
  });

  it('kontrak supplier menaikkan kualitas maksimum', () => {
    const e = new GameEngine(newState(7));
    credit(e.state.ledger, 1, 'reward', 1_000_000, 'modal tes');
    expect(e.maxQuality()).toBe(3);
    e.buyUpgrade('supplier');
    expect(e.maxQuality()).toBe(4);
  });

  it('beli ulang isi ulang barang yang sudah menipis', () => {
    const e = new GameEngine(newState(3));
    e.buyStock('cacing', 3, 20);
    e.state.stock['cacing:3'].qty -= 15; // anggap terjual
    e.state.stock['cacing:3'].cost = Math.round(e.state.stock['cacing:3'].cost / 4);
    const log = e.restockLast();
    expect(log.length).toBe(1);
    expect(e.totalQty('cacing')).toBe(20);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });
});

describe('engine: hari berjalan', () => {
  it('tidak bisa belanja saat toko buka', () => {
    const e = new GameEngine(newState(1));
    e.buyStock('cacing', 2, 10);
    e.startDay();
    expect(() => e.buyStock('cacing', 2, 1)).toThrow();
    expect(() => e.setPrice('cacing', 2, 900)).toThrow();
    expect(() => e.setAllPrices(-10)).toThrow();
  });

  it('penjualan: pendapatan masuk ke kas, stok berkurang, modal terbawa', () => {
    const e = new GameEngine(newState(3));
    e.buyStock('cacing', 3, 40);
    e.buyStock('pelet', 3, 20);
    const startCash = e.state.ledger.balance;
    const startStock = sumStock(e);
    const summary = runDay(e);
    expect(summary.soldUnits).toBe(startStock - sumStock(e));
    expect(e.state.ledger.balance).toBe(startCash + summary.revenue + summary.tips - summary.rent);
    expect(summary.grossProfit).toBe(summary.revenue - summary.cogs);
    expect(summary.net).toBe(summary.grossProfit + summary.tips - summary.rent - summary.wages);
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

  it('toko tanpa stok tidak menjual apa pun dan reputasi tetap di batas bawah', () => {
    const e = new GameEngine(newState(9));
    const s = runDay(e);
    expect(s.revenue).toBe(0);
    expect(e.state.reputation).toBeGreaterThanOrEqual(5);
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
    }
    expect(reservedQty).toBeGreaterThan(0);
    const cash = e.state.ledger.balance;
    e.endDay();
    expect(e.state.stock['cacing:3'].qty).toBe(30);
    expect(e.state.stock['cacing:3'].cost).toBe(e.wholesalePrice('cacing', 3, 1) * 30);
    expect(e.state.ledger.balance).toBe(cash - e.mods().rent);
  });

  it('sewa yang tak terbayar menjadi tunggakan, saldo tidak pernah negatif', () => {
    const e = new GameEngine(newState(13));
    e.state.ledger.opening = 200;
    e.state.ledger.balance = 200;
    const s = runDay(e);
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
    expect(e.state.arrears).toBeGreaterThan(0);
    expect(s.rent).toBe(e.mods().rent);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('hari yang sama dengan benih yang sama menghasilkan rencana pelanggan yang sama', () => {
    const a = new GameEngine(newState(99));
    const b = new GameEngine(newState(99));
    a.buyStock('cacing', 3, 20);
    b.buyStock('cacing', 3, 20);
    expect(a.generatePlan()).toEqual(b.generatePlan());
  });

  it('event harian deterministik dan hari 1 selalu cerah', () => {
    const a = new GameEngine(newState(5));
    const b = new GameEngine(newState(5));
    expect(a.eventOf(1).id).toBe('cerah');
    for (let d = 1; d < 50; d++) expect(a.eventOf(d).id).toBe(b.eventOf(d).id);
  });
});

describe('engine: audit simulasi 200 hari dengan semua sistem', () => {
  it('bot yang memakai semua fitur tetap lolos audit keuangan', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const e = new GameEngine(newState(seed));
      for (let d = 0; d < 200; d++) {
        const s = e.state;
        // belanja
        for (const it of e.unlockedItems()) {
          const q = Math.min(3, e.maxQuality());
          const want = e.totalQty(it.id) < 6 ? 6 : 0;
          const n = Math.min(want, e.maxAffordable(it.id, q));
          if (n > 0 && s.ledger.balance > 15000) e.buyStock(it.id, q, n);
        }
        const tryDo = (fn) => { try { fn(); } catch { /* aturan game menolak, itu wajar */ } };
        // upgrade, spesies, skill, ramuan, karyawan, bank, investasi, breeding
        tryDo(() => { if (s.ledger.balance > 150000) e.expandShop(); });
        for (const u of UPGRADES) tryDo(() => { const c = e.upgradeCost(u.id); if (c !== null && s.ledger.balance > c + 30000) e.buyUpgrade(u.id); });
        for (const it of ITEMS) tryDo(() => { if (s.ledger.balance > it.unlockCost + 40000) e.unlockSpecies(it.id); });
        for (let k = 0; k < 3; k++) for (const sk of ['tawar', 'promosi', 'gudang', 'breeder', 'bibit_unggul', 'harga_prima']) tryDo(() => e.learnSkill(sk));
        tryDo(() => { if (s.ledger.balance > 30000) e.buyPotion('pemikat'); });
        tryDo(() => e.activatePotion('pemikat'));
        for (const id of ['kasir', 'pramuniaga', 'penjaga', 'perawat', 'satpam', 'badut']) tryDo(() => { if (s.ledger.balance > 60000) e.hire(id); });
        tryDo(() => { if (s.loans.length === 0 && d % 20 === 5) e.takeLoan(20000, 1); });
        for (const l of s.loans.slice()) tryDo(() => { if (s.ledger.balance > l.remaining + 50000) e.repayLoan(l.id, l.remaining); });
        tryDo(() => { if (s.ledger.balance > 120000) e.openDeposit(20000, d % 3); });
        tryDo(() => { if (d % 10 === 0) e.buyShares('satwamart', 5); });
        tryDo(() => { if (d % 10 === 5) e.sellShares('satwamart', 5); });
        tryDo(() => { if (s.ledger.balance > 400000) e.buyProperty('kios'); });
        for (const b of s.breeding.slice()) tryDo(() => e.collectBreeding(b.id));
        for (const lot of e.stockLots()) { if (lot.qty >= 2) { tryDo(() => e.startBreeding(lot.itemId, lot.quality)); break; } }
        tryDo(() => e.setAllPrices(d % 2 ? 0 : -10));
        runDay(e);

        expect(s.ledger.balance).toBeGreaterThanOrEqual(0);
        expect(auditLedger(s.ledger)).toEqual([]);
        for (const lot of Object.values(s.stock)) {
          expect(lot.qty).toBeGreaterThanOrEqual(0);
          expect(lot.cost).toBeGreaterThanOrEqual(0);
          if (lot.qty === 0) expect(lot.cost).toBe(0);
        }
        expect(e.usedCapacity()).toBeLessThanOrEqual(e.capacity());
        expect(e.skillPointsFree()).toBeGreaterThanOrEqual(0);
        expect(s.arrears).toBeGreaterThanOrEqual(0);
        for (const l of s.loans) expect(l.remaining).toBeGreaterThan(0);
      }
      expect(validateState(e.state)).toEqual([]);
      expect(e.state.day).toBe(201);
    }
  });
});
