// Data peta dunia tunggal: tata letak, dinding, pintu, titik berdiri, dan grid tabrakan.
import { NavGrid } from './nav.js';
import { CATEGORIES } from '../core/catalog.js';
import { mulberry32 } from '../core/rng.js';

export const WORLD = { w: 1400, h: 1000 };
export const CELL = 12;
export const PAD = 6; // ruang napas karakter terhadap dinding

// Kotak area (untuk menandai zona dan menghindari dekorasi)
export const BOX = {
  kolam: { x: 40, y: 50, w: 520, h: 380 },
  kandang: { x: 840, y: 50, w: 520, h: 380 },
  toko: { x: 464, y: 696, w: 472, h: 274 },
};

export const GATES = { kolam: { x: 330, w: 60 }, kandang: { x: 1090, w: 60 } }; // celah di dinding bawah (y=430)

export const PLOTS = {
  kolam: [[140, 140], [310, 140], [140, 300], [310, 300]],
  kebun: [[480, 150], [480, 290]],
  kandang: [[930, 160], [1090, 160], [1250, 160], [1010, 315], [1170, 315]],
};
export const PLOT_SIZE = { kolam: [140, 100], kebun: [116, 80], kandang: [104, 110] };
export const plotFront = (hab, x, y) => ({ x, y: y + PLOT_SIZE[hab][1] / 2 + 22 });

export const RACK_Y = 795;
export const rackX = (i) => 532 + i * 84;
export const QUEUE_Y = 928;
export const ROAD_Y = 948;
export const ENTRY_X = 300;
export const slotX = (k) => 812 - k * 50;
export const COUNTER = { x: 884, y: 878 };

export const SPOTS = {
  kolam: { x: 330, y: 392 },
  kandang: { x: 1090, y: 392 },
  toko: { x: 700, y: 842 },
  pasar: { x: 250, y: 742 },
  pet: { x: 1150, y: 742 },
  kantor: { x: 700, y: 262 },
  npc: { x: 650, y: 392 },
  plaza: { x: 700, y: 470 },
  start: { x: 700, y: 842 },
};

// jalan: garis tengah (lebar digambar 72)
export const ROADS = [
  [[150, 450], [1250, 450]], [[700, 200], [700, 700]],
  [[330, 450], [330, 392]], [[1090, 450], [1090, 392]],
  [[415, 450], [415, 760]], [[140, 760], [415, 760]], [[415, 760], [415, 948]], [[100, 948], [470, 948]],
  [[985, 450], [985, 760]], [[985, 760], [1260, 760]],
];

// Bangunan (bawah gambar di y) dan jejak tabrakannya
export const BUILDINGS = {
  kantor: { x: 700, y: 232, w: 220, h: 160 },
  pasar: { x: 250, y: 700, w: 220, h: 160 },
  pet: { x: 1150, y: 700, w: 200, h: 170 },
  toko: { x: 700, y: 700, w: 380, h: 150 },
};


const W = 12;
// Pagar kebun dan kandang (celah di bawah = gerbang)
export function fenceRects() {
  const R = [];
  for (const k of ['kolam', 'kandang']) {
    const b = BOX[k];
    const g = GATES[k];
    R.push([b.x, b.y - 6, b.w, W], [b.x - 6, b.y, W, b.h], [b.x + b.w - 6, b.y, W, b.h]);
    R.push([b.x, b.y + b.h - 6, g.x - g.w / 2 - b.x, W], [g.x + g.w / 2, b.y + b.h - 6, b.x + b.w - (g.x + g.w / 2), W]);
  }
  return R;
}
// Dinding toko: sudut atas, sisi kiri (celah pintu pelanggan di bawah), sisi kanan, bawah
export function shopWalls() {
  return [[464, 690, 46, W], [890, 690, 46, W], [464, 696, W, 224], [BOX.toko.x + BOX.toko.w - W, 696, W, 278], [464, 962, 472, W]];
}

export function colliders() {
  const R = [];
  // tepi dunia
  R.push([-60, -60, WORLD.w + 120, 90], [-60, WORLD.h - 28, WORLD.w + 120, 90], [-60, -60, 84, WORLD.h + 120], [WORLD.w - 24, -60, 84, WORLD.h + 120]);
  R.push(...fenceRects(), ...shopWalls());
  // bangunan
  R.push([600, 110, 200, 122]); // balai
  R.push([150, 570, 200, 126]); // pasar
  R.push([1060, 560, 180, 136]); // rumah pet
  // toko: fasad dengan pintu di tengah
  R.push([510, 560, 166, 136], [724, 560, 166, 136]);
  // rak dan meja kasir
  CATEGORIES.forEach((_, i) => R.push([rackX(i) - 38, 738, 76, 56]));
  R.push([COUNTER.x - 28, COUNTER.y - 34, 56, 36]);
  // lahan
  for (const hab of Object.keys(PLOTS)) {
    const [w, h] = PLOT_SIZE[hab];
    for (const [x, y] of PLOTS[hab]) R.push([x - w / 2, y - h / 2, w, h]);
  }
  // alun-alun
  R.push([596, 396, 28, 24]); // papan petunjuk
  return R;
}

export const CIRCLES = [[800, 325, 34], [590, 252, 8], [810, 252, 8]];

// Dekorasi acak yang tidak boleh menutup jalan, lahan, atau pintu.
export function decorSpots(seed = 777) {
  const rng = mulberry32(seed);
  const noDecor = [
    [BOX.kolam.x - 20, BOX.kolam.y - 20, BOX.kolam.w + 40, BOX.kolam.h + 40],
    [BOX.kandang.x - 20, BOX.kandang.y - 20, BOX.kandang.w + 40, BOX.kandang.h + 40],
    [BOX.toko.x - 30, 520, BOX.toko.w + 60, 470],
    [520, 150, 360, 380], // balai dan alun-alun
    [100, 520, 340, 280], [960, 510, 340, 300], // halaman pasar dan rumah pet
  ];
  const bandHit = (x, y) => ROADS.some(([a, b]) => {
    const x0 = Math.min(a[0], b[0]) - 50; const x1 = Math.max(a[0], b[0]) + 50;
    const y0 = Math.min(a[1], b[1]) - 50; const y1 = Math.max(a[1], b[1]) + 50;
    return x > x0 && x < x1 && y > y0 && y < y1;
  });
  const free = (x, y) => !bandHit(x, y) && !noDecor.some(([bx, by, bw, bh]) => x > bx && x < bx + bw && y > by && y < by + bh);
  const pick = (n, tries = 900) => {
    const out = [];
    for (let i = 0; i < tries && out.length < n; i++) {
      const x = 40 + rng() * (WORLD.w - 80);
      const y = 40 + rng() * (WORLD.h - 80);
      if (free(x, y)) out.push([Math.round(x), Math.round(y)]);
    }
    return out;
  };
  return { tufts: pick(70), flowers: pick(34), bushes: pick(14), trees: pick(14), rocks: pick(8) };
}

export function buildNav() {
  const nav = new NavGrid(WORLD.w, WORLD.h, CELL);
  for (const [x, y, w, h] of colliders()) nav.addRect(x, y, w, h, PAD);
  for (const [x, y, r] of CIRCLES) nav.addCircle(x, y, r + PAD);
  const d = decorSpots();
  for (const [x, y] of d.trees) nav.addCircle(x, y, 16 + PAD);
  for (const [x, y] of d.bushes) nav.addCircle(x, y, 10 + PAD);
  for (const [x, y] of d.rocks) nav.addCircle(x, y, 10 + PAD);
  return nav;
}

// zona tempat titik berada: 'kebun' | 'toko' | 'luar'
export function zoneOf(x, y) {
  const inB = (b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
  if (inB(BOX.kolam) || inB(BOX.kandang)) return 'kebun';
  if (inB(BOX.toko)) return 'toko';
  return 'luar';
}
