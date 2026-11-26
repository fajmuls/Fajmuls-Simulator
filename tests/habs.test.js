import { describe, it, expect } from 'vitest';
import { habSVG, habKey, MAX_LEVEL, TIER_NAMES } from '../src/art.habs.js';
import { HABITATS, HAB_LEVEL_CAPS } from '../src/core/farm.js';

describe('gambar tempat berlevel', () => {
  it('ada 5 jenis tempat x 15 level dan semuanya berbeda', () => {
    expect(MAX_LEVEL).toBe(HAB_LEVEL_CAPS.length);
    expect(TIER_NAMES).toHaveLength(15);
    for (const h of HABITATS) {
      const all = new Set();
      for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        const s = habSVG(h.id, lv);
        expect(s.startsWith('<svg')).toBe(true);
        expect(s.endsWith('</svg>')).toBe(true);
        expect(s).not.toMatch(/NaN|undefined/);
        all.add(s);
      }
      expect(all.size).toBe(15);
    }
    expect(habKey('kolam', 99)).toBe('hab_kolam_15');
  });
  it('ukuran kanvas sama dengan gambar lama per jenis', () => {
    expect(habSVG('kolam', 1)).toContain('viewBox="0 0 170 112"');
    expect(habSVG('kebun', 1)).toContain('viewBox="0 0 120 84"');
    for (const id of ['kecil', 'burung', 'reptil']) expect(habSVG(id, 1)).toContain('viewBox="0 0 112 126"');
  });
});
