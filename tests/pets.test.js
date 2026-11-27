import { describe, it, expect } from 'vitest';
import { PET_KINDS, RARITIES, petBuffValue } from '../src/core/farm.js';
import { NEW_PET_KINDS, petArt } from '../src/pets.js';

describe('pet baru', () => {
  it('total 12 jenis, id unik, memakai buff yang sudah ada', () => {
    expect(PET_KINDS).toHaveLength(12);
    expect(new Set(PET_KINDS.map((k) => k.id)).size).toBe(12);
    const buffs = new Set(['luck', 'grow', 'value', 'patience', 'tip']);
    for (const k of PET_KINDS) {
      expect(buffs.has(k.buff)).toBe(true);
      expect(k.base).toBeGreaterThan(0);
      expect(k.text(k.base)).toMatch(/\d/);
    }
  });
  it('setiap pet baru punya gambar sendiri dan nilai buff wajar', () => {
    const arts = new Set();
    for (const k of NEW_PET_KINDS) {
      const s = petArt(k.id, '#fff');
      expect(s.startsWith('<svg')).toBe(true);
      expect(s).not.toMatch(/NaN|undefined/);
      arts.add(s);
      const v = petBuffValue({ kind: k.id, rarity: RARITIES[RARITIES.length - 1].id });
      expect(v).toBeGreaterThan(k.base);
      expect(v).toBeLessThan(2);
    }
    expect(arts.size).toBe(NEW_PET_KINDS.length);
  });
});
