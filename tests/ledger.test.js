import { describe, it, expect } from 'vitest';
import { createLedger, credit, debit, auditLedger } from '../src/core/ledger.js';

describe('ledger', () => {
  it('menolak jumlah bukan bilangan bulat positif', () => {
    const l = createLedger(1000);
    expect(() => credit(l, 1, 'sale', 0, 'x')).toThrow();
    expect(() => credit(l, 1, 'sale', -5, 'x')).toThrow();
    expect(() => credit(l, 1, 'sale', 10.5, 'x')).toThrow();
    expect(() => debit(l, 1, 'rent', NaN, 'x')).toThrow();
    expect(l.balance).toBe(1000);
  });

  it('tidak boleh membuat saldo negatif', () => {
    const l = createLedger(500);
    expect(() => debit(l, 1, 'buy_stock', 501, 'x')).toThrow('Uang tidak cukup');
    expect(l.balance).toBe(500);
    debit(l, 1, 'buy_stock', 500, 'x');
    expect(l.balance).toBe(0);
  });

  it('saldo selalu sama dengan jumlah transaksi', () => {
    const l = createLedger(1000);
    credit(l, 1, 'sale', 700, 'a');
    debit(l, 1, 'rent', 300, 'b');
    credit(l, 2, 'sale', 1, 'c');
    expect(l.balance).toBe(1401);
    expect(auditLedger(l)).toEqual([]);
  });

  it('audit mendeteksi saldo yang dimanipulasi', () => {
    const l = createLedger(1000);
    credit(l, 1, 'sale', 700, 'a');
    l.balance += 1;
    expect(auditLedger(l).length).toBeGreaterThan(0);
  });

  it('arsip menjaga invarian saat catatan lama dipangkas', () => {
    const l = createLedger(100);
    for (let i = 0; i < 2000; i++) credit(l, 1, 'sale', 3, 'x');
    expect(l.entries.length).toBeLessThan(700);
    expect(l.balance).toBe(100 + 2000 * 3);
    expect(auditLedger(l)).toEqual([]);
  });
});
