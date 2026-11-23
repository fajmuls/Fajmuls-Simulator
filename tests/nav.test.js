import { describe, it, expect } from 'vitest';
import { NavGrid } from '../src/game/nav.js';
import { buildNav, PLOTS, PLOT_SIZE, plotFront, SPOTS, rackX, RACK_Y, ENTRY_X, ROAD_Y, QUEUE_Y, slotX, zoneOf, GATES, BOX } from '../src/game/worldmap.js';
import { CATEGORIES } from '../src/core/catalog.js';

const pathLen = (p, s) => { let a = s; let L = 0; for (const q of p) { L += Math.hypot(q.x - a.x, q.y - a.y); a = q; } return L; };

describe('NavGrid', () => {
  it('menghindari dinding dan lewat celah', () => {
    const g = new NavGrid(200, 100, 10);
    g.addRect(95, 0, 10, 100);
    g.clearRect(95, 40, 10, 20);
    const p = g.find(20, 50, 180, 50);
    expect(p.length).toBeGreaterThan(0);
    expect(p.at(-1)).toMatchObject({ x: 180, y: 50 });
    expect(g.los(20, 20, 180, 20)).toBe(false);
  });
  it('tujuan di dalam dinding diarahkan ke titik terdekat', () => {
    const g = new NavGrid(100, 100, 10);
    g.addRect(40, 40, 20, 20);
    const p = g.find(5, 5, 50, 50);
    expect(g.walkable(p.at(-1).x, p.at(-1).y)).toBe(true);
  });
  it('tujuan terkurung: menuju titik terdekat yang bisa dicapai', () => {
    const g = new NavGrid(100, 100, 10);
    g.addRect(60, 0, 10, 100);
    const p = g.find(10, 50, 90, 50);
    expect(p.at(-1).x).toBeLessThan(60);
  });
});

describe('peta dunia', () => {
  const nav = buildNav();
  const from = SPOTS.start;
  const reach = (t) => {
    const p = nav.find(from.x, from.y, t.x, t.y);
    const e = p.at(-1);
    return e && Math.hypot(e.x - t.x, e.y - t.y) < 8;
  };

  it('titik berdiri penting bisa dicapai', () => {
    for (const k of ['kolam', 'kandang', 'toko', 'pasar', 'pet', 'kantor', 'npc', 'plaza']) expect(reach(SPOTS[k]), k).toBe(true);
  });
  it('depan setiap lahan bisa dicapai', () => {
    for (const hab of Object.keys(PLOTS)) for (const [x, y] of PLOTS[hab]) {
      const f = plotFront(hab, x, y);
      expect(nav.walkable(f.x, f.y), `${hab} ${x},${y} walkable`).toBe(true);
      expect(reach(f), `${hab} ${x},${y} reach`).toBe(true);
    }
  });
  it('depan setiap rak bisa dicapai', () => {
    CATEGORIES.forEach((_, i) => expect(reach({ x: rackX(i), y: RACK_Y + 38 }), `rak ${i}`).toBe(true));
  });
  it('posisi antrean pelanggan di dalam toko bisa dilayani', () => {
    for (let k = 0; k < 7; k++) expect(reach({ x: slotX(k), y: QUEUE_Y - 48 }), `antre ${k}`).toBe(true);
  });
  it('dinding toko menahan: dari luar harus lewat pintu', () => {
    // garis lurus dari alun-alun ke dalam toko menembus fasad
    expect(nav.los(560, 600, 560, 760)).toBe(false);
    const p = nav.find(700, 470, 560, 840);
    expect(p.length).toBeGreaterThan(1);
    // jalur lewat pintu tengah (x≈700) atau pintu kiri bawah, tidak lurus menembus dinding
    expect(p.some((q) => Math.abs(q.x - 700) < 30 || (q.x < 480 && q.y > 900))).toBe(true);
    expect(pathLen(p, { x: 700, y: 470 })).toBeGreaterThan(Math.hypot(140, 370));
  });
  it('pagar kebun menahan, gerbang terbuka', () => {
    const b = BOX.kolam;
    expect(nav.walkable(100, b.y + b.h)).toBe(false);
    expect(nav.walkable(GATES.kolam.x, b.y + b.h)).toBe(true);
    expect(nav.walkable(GATES.kandang.x, BOX.kandang.y + BOX.kandang.h)).toBe(true);
  });
  it('pintu pelanggan kiri bawah terbuka', () => {
    expect(nav.walkable(ENTRY_X, ROAD_Y)).toBe(true);
    expect(nav.walkable(470, ROAD_Y)).toBe(true);
    expect(nav.walkable(500, ROAD_Y)).toBe(true);
  });
  it('zona', () => {
    expect(zoneOf(300, 200)).toBe('kebun');
    expect(zoneOf(700, 850)).toBe('toko');
    expect(zoneOf(700, 450)).toBe('luar');
  });
});
