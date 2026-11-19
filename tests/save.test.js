import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { serialize, deserialize, validateState, SaveManager, MemoryAdapter } from '../src/core/save.js';

function sample() {
  const e = new GameEngine(newState(21));
  e.buyStock('cacing', 3, 10);
  e.buyStock('lele', 2, 5);
  return e.state;
}

describe('simpan dan muat', () => {
  it('bolak-balik menghasilkan state yang identik', () => {
    const s = sample();
    const back = deserialize(serialize(s));
    expect(back).toEqual(s);
  });

  it('menolak simpan saat toko buka', () => {
    const s = sample();
    s.phase = 'open';
    expect(() => serialize(s)).toThrow();
  });

  it('mendeteksi data yang diubah (checksum)', () => {
    const text = serialize(sample());
    const w = JSON.parse(text);
    w.data = w.data.replace('"reputation":10', '"reputation":99');
    expect(() => deserialize(JSON.stringify(w))).toThrow('Checksum');
  });

  it('menolak JSON rusak dan berkas milik game lain', () => {
    expect(() => deserialize('{{{')).toThrow();
    expect(() => deserialize('{"game":"lain","data":"x"}')).toThrow();
  });

  it('validateState menangkap saldo negatif dan stok tidak valid', () => {
    const s = sample();
    s.ledger.balance = -5;
    expect(validateState(s).length).toBeGreaterThan(0);
    const t = sample();
    t.stock['cacing:3'].qty = -1;
    expect(validateState(t).length).toBeGreaterThan(0);
    const u = sample();
    u.prices['cacing:3'] = 0;
    expect(validateState(u).length).toBeGreaterThan(0);
  });

  it('SaveManager memakai cadangan bila simpanan utama rusak', async () => {
    const adapter = new MemoryAdapter();
    const mgr = new SaveManager(adapter);
    const s1 = sample();
    const s1Copy = structuredClone(s1);
    await mgr.save(s1);
    const e = new GameEngine(s1);
    e.buyStock('cacing', 3, 5);
    await mgr.save(e.state); // simpanan pertama jadi cadangan
    await adapter.set('main', 'rusak total');
    const loaded = await mgr.load();
    expect(loaded.slot).toBe('backup');
    expect(loaded.state).toEqual(s1Copy);
  });

  it('SaveManager mengembalikan null bila tidak ada simpanan', async () => {
    expect(await new SaveManager(new MemoryAdapter()).load()).toBeNull();
  });

  it('simpanan rusak tidak menimpa cadangan yang sehat', async () => {
    const adapter = new MemoryAdapter();
    const mgr = new SaveManager(adapter);
    const s1 = sample();
    await mgr.save(s1);
    await mgr.save(s1); // main + backup sehat
    await adapter.set('main', 'rusak');
    await mgr.save(s1);
    const loaded = await mgr.load();
    expect(loaded.slot).toBe('main');
  });
});
