// Ilustrasi tempat berlevel: 5 jenis tempat x 15 level, semuanya dibangkitkan dari parameter.
// Tiap level berbeda: bahan dan warna berganti (kayu, batu, baja, emas, kristal) dan hiasan bertambah
// (bendera, lampu, permata, bintang, cahaya, mahkota). Ukuran kanvas sama dengan gambar lama.
import { OUT } from './art.world.js';

const sw = (w = 2.4) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;

export const TIER_NAMES = [
  'Kayu Sederhana', 'Kayu Rapi', 'Anyaman Batu', 'Batu Kali', 'Batu Putih', 'Biru Es', 'Baja Biru', 'Kuningan',
  'Emas Muda', 'Emas Kerajaan', 'Kristal Ungu', 'Kristal Violet', 'Kristal Langit', 'Giok Ajaib', 'Mahkota Surgawi',
];
const BASE = ['#c98a4a', '#d4a05a', '#b9a58a', '#a9a9a0', '#c4c4bc', '#9db8d0', '#7fa8c8', '#d9c27a', '#e6b84a', '#f0b040', '#c9a0e8', '#b08ae0', '#8ad0f0', '#8ae8d8', '#ffe27a'];
const TRIM = ['#a8693a', '#b07a40', '#8d7a60', '#7c7c74', '#9a9a92', '#6f92b0', '#5a88aa', '#b89a4a', '#c8962a', '#d88a20', '#9a70c8', '#8260c0', '#5aaad0', '#5ac8b8', '#e0b030'];
const ROOF = ['#e2574c', '#e8704c', '#d9534f', '#c0392b', '#3f78d8', '#3f6ad8', '#4b5ed8', '#a24dc7', '#9333ea', '#7e3fc0', '#e56aa3', '#d94f9a', '#2fa8a0', '#1f9a8a', '#ff7a3a'];
const WATER = ['#4fc3f0', '#47bde8', '#3fb4e0', '#38b0d8', '#34c6d0', '#30d0c0', '#38d8b0', '#5ae0a0', '#7ae0e0', '#8ae8f0', '#a0d0ff', '#b8b0ff', '#d0a8ff', '#f0a8ff', '#ffd0f0'];

export const MAX_LEVEL = 15;
const clampLv = (lv) => Math.max(1, Math.min(MAX_LEVEL, Math.round(lv) || 1));
const tier = (lv) => ({ base: BASE[lv - 1], trim: TRIM[lv - 1], roof: ROOF[lv - 1], water: WATER[lv - 1], acc: lv >= 8 ? '#fff6a8' : '#ffd84d' });

const gem = (x, y, c) => `<path d="M${x} ${y - 4.5} L${x + 4.5} ${y} L${x} ${y + 4.5} L${x - 4.5} ${y} Z" fill="${c}" ${sw(1.4)}/>`;
const star = (x, y, r = 5) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="#fff6a8" stroke="#e0a92c" stroke-width="1" stroke-linejoin="round"/>`;
const lamp = (x, y, glow) => `<rect x="${x - 1.5}" y="${y}" width="3" height="16" rx="1.5" fill="#5a5560" ${sw(1.6)}/><circle cx="${x}" cy="${y - 1}" r="4.6" fill="${glow ? '#fff3a0' : '#ffe27a'}" ${sw(1.8)}/>`;
const flag = (x, y, c) => `<path d="M${x} ${y + 14} V${y}" ${sw(2)}/><path d="M${x} ${y} L${x + 13} ${y + 4} L${x} ${y + 8} Z" fill="${c}" ${sw(1.6)}/>`;
const crown = (x, y) => `<path d="M${x - 9} ${y + 8} L${x - 11} ${y - 3} L${x - 5} ${y + 2} L${x} ${y - 7} L${x + 5} ${y + 2} L${x + 11} ${y - 3} L${x + 9} ${y + 8} Z" fill="#ffd84d" ${sw(1.8)}/><circle cx="${x}" cy="${y - 7}" r="2.2" fill="#e2574c"/>`;
const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${(rx * 0.25).toFixed(1)}" fill="#2b1d1433"/>`;

// ---------- Kolam (170 x 112) ----------
function pond(lv) {
  const t = tier(lv);
  let s = '';
  if (lv >= 12) s += `<ellipse cx="85" cy="62" rx="84" ry="49" fill="${t.acc}" opacity=".3"/>`;
  s += `<ellipse cx="85" cy="62" rx="80" ry="46" fill="${t.base}" ${sw(3.2)}/>`;
  s += `<ellipse cx="85" cy="58" rx="70" ry="38" fill="${t.water}" ${sw(3)}/>`;
  s += '<ellipse cx="85" cy="58" rx="70" ry="38" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 10" opacity=".5"/>';
  s += '<path d="M44 52 q10 -6 20 0 M96 70 q10 -6 20 0 M108 46 q8 -4 16 0" fill="none" stroke="#fff" stroke-width="2.6" opacity=".8"/>';
  const n = 6 + lv;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s += `<ellipse cx="${(85 + 75 * Math.cos(a)).toFixed(1)}" cy="${(62 + 42 * Math.sin(a)).toFixed(1)}" rx="${lv > 6 ? 6 : 5}" ry="3.6" fill="${t.trim}" ${sw(1.6)}/>`;
  }
  if (lv >= 2) s += `<ellipse cx="62" cy="68" rx="9" ry="5" fill="#58b368" ${sw(2)}/>`;
  if (lv >= 4) s += `<ellipse cx="112" cy="50" rx="8" ry="4.4" fill="#7ccf6a" ${sw(2)}/><rect x="118" y="68" width="40" height="8" rx="2" fill="${t.trim}" ${sw(2)}/><path d="M128 68 V76 M138 68 V76 M148 68 V76" ${sw(1.4)}/>`;
  if (lv >= 7) s += '<path d="M85 58 V38 M85 38 Q75 44 71 56 M85 38 Q95 44 99 56" fill="none" stroke="#e8fbff" stroke-width="3.4" stroke-linecap="round"/>';
  if (lv >= 5) s += lamp(12, 52, lv >= 12) + lamp(158, 52, lv >= 12);
  if (lv >= 3) s += flag(26, 6, t.roof);
  if (lv >= 8) s += gem(85, 17, t.roof) + gem(24, 80, t.roof) + gem(146, 82, t.roof);
  if (lv >= 11) s += star(36, 28, 5) + star(140, 24, 4) + star(64, 10, 3);
  if (lv >= 14) s += crown(85, 10);
  if (lv >= 15) s += '<path d="M18 62 Q85 -6 152 62" fill="none" stroke="#ff8a8a" stroke-width="3" opacity=".7"/><path d="M22 62 Q85 0 148 62" fill="none" stroke="#8ad0ff" stroke-width="3" opacity=".7"/>';
  return svg(170, 112, s);
}

// ---------- Kebun umpan (120 x 84) ----------
function bed(lv) {
  const t = tier(lv);
  const soil = lv < 7 ? '#6b4a2b' : lv < 11 ? '#5a3f28' : '#3f2a4a';
  let s = '';
  if (lv >= 12) s += `<rect x="0" y="8" width="120" height="74" rx="14" fill="${t.acc}" opacity=".3"/>`;
  s += `<rect x="6" y="14" width="108" height="62" rx="9" fill="${t.base}" ${sw(3.2)}/>`;
  s += `<rect x="14" y="22" width="92" height="46" rx="6" fill="${soil}" ${sw(2.4)}/>`;
  s += `<path d="M18 32 H102 M18 45 H102 M18 58 H102" stroke="${t.trim}" stroke-width="2.2" opacity=".7"/>`;
  const pts = [[26, 34], [52, 34], [78, 34], [100, 34], [26, 47], [52, 47], [78, 47], [100, 47], [26, 60], [52, 60], [78, 60], [100, 60], [39, 40], [65, 53]];
  const n = Math.min(pts.length, 2 + lv);
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    s += `<path d="M${x} ${y} v-7 M${x} ${y - 4} q-5 -4 -7 -1 M${x} ${y - 4} q5 -4 7 -1" fill="none" stroke="${lv >= 11 ? '#7be0b0' : '#3f9a52'}" stroke-width="2.4" stroke-linecap="round"/>`;
  }
  if (lv >= 3) s += `<rect x="2" y="8" width="7" height="20" rx="2" fill="${t.trim}" ${sw(1.8)}/><rect x="111" y="8" width="7" height="20" rx="2" fill="${t.trim}" ${sw(1.8)}/>`;
  if (lv >= 4) s += `<rect x="10" y="66" width="14" height="10" rx="3" fill="#8fd0f0" ${sw(1.6)}/><path d="M24 69 L32 64" ${sw(2)}/>`;
  if (lv >= 5) s += lamp(8, -2, lv >= 12) + lamp(112, -2, lv >= 12);
  if (lv >= 6) s += `<circle cx="20" cy="20" r="3.2" fill="#ff7a8a" ${sw(1.4)}/><circle cx="100" cy="20" r="3.2" fill="#ffd84d" ${sw(1.4)}/>`;
  if (lv >= 8) s += gem(60, 15, t.roof) + gem(14, 74, t.roof) + gem(106, 74, t.roof);
  if (lv >= 3) s += flag(60, -4, t.roof);
  if (lv >= 11) s += star(30, 10, 4) + star(92, 8, 4);
  if (lv >= 14) s += crown(60, 6);
  return svg(120, 84, s);
}

// ---------- Kandang hewan kecil: rumah kayu dengan roda hamster (112 x 126) ----------
function hutch(lv) {
  const t = tier(lv);
  let s = shadow(56, 118, 44);
  if (lv >= 12) s += `<ellipse cx="56" cy="76" rx="56" ry="50" fill="${t.acc}" opacity=".28"/>`;
  s += `<rect x="16" y="58" width="80" height="52" rx="6" fill="${t.base}" ${sw(3)}/>`;
  s += `<path d="M8 62 L56 28 L104 62 Z" fill="${t.roof}" ${sw(3.2)}/>`;
  s += `<path d="M44 110 V84 Q44 74 56 74 Q68 74 68 84 V110 Z" fill="${t.trim}" ${sw(2.4)}/>`;
  s += `<rect x="22" y="68" width="16" height="22" rx="3" fill="#fff6d1" opacity=".7" ${sw(2)}/><path d="M27 68 V90 M33 68 V90" ${sw(1.6)}/>`;
  s += `<rect x="74" y="68" width="16" height="22" rx="3" fill="#fff6d1" opacity=".7" ${sw(2)}/><path d="M79 68 V90 M85 68 V90" ${sw(1.6)}/>`;
  if (lv >= 2) s += `<circle cx="90" cy="100" r="10" fill="none" stroke="${t.trim}" stroke-width="3"/><path d="M90 90 V110 M80 100 H100" stroke="${t.trim}" stroke-width="1.8"/>`;
  if (lv >= 3) s += `<ellipse cx="28" cy="108" rx="9" ry="3.6" fill="#f4a261" ${sw(1.6)}/>` + flag(56, 10, t.acc);
  if (lv >= 4) s += `<rect x="98" y="72" width="7" height="16" rx="3" fill="#8fd0f0" ${sw(1.6)}/>`;
  if (lv >= 5) s += lamp(8, 62, lv >= 12) + lamp(104, 62, lv >= 12);
  if (lv >= 8) s += gem(56, 44, t.acc) + gem(20, 62, t.acc) + gem(92, 62, t.acc);
  if (lv >= 11) s += star(22, 34, 5) + star(92, 30, 4);
  if (lv >= 14) s += crown(56, 22);
  return svg(112, 126, s);
}

// ---------- Kandang burung: sangkar kubah (112 x 126) ----------
function aviary(lv) {
  const t = tier(lv);
  let s = shadow(56, 118, 44);
  if (lv >= 12) s += `<ellipse cx="56" cy="70" rx="56" ry="54" fill="${t.acc}" opacity=".28"/>`;
  s += `<path d="M16 98 Q16 26 56 26 Q96 26 96 98 Z" fill="${t.base}" opacity=".38" ${sw(3)}/>`;
  [26, 36, 46, 56, 66, 76, 86].forEach((x) => {
    const k = (x - 56) / 40;
    const top = 26 + 72 * (1 - Math.sqrt(Math.max(0, 1 - k * k)));
    s += `<path d="M${x} 98 V${top.toFixed(1)}" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>`;
  });
  s += `<path d="M20 62 H92" stroke="${t.trim}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<rect x="12" y="96" width="88" height="14" rx="5" fill="${t.trim}" ${sw(3)}/>`;
  s += `<circle cx="56" cy="24" r="5" fill="${t.roof}" ${sw(2)}/>`;
  if (lv >= 2) s += `<path d="M40 40 V56" stroke="${OUT}" stroke-width="1.6"/><circle cx="40" cy="58" r="3.4" fill="${t.roof}" ${sw(1.6)}/>`;
  if (lv >= 3) s += flag(56, 4, t.roof);
  if (lv >= 4) s += `<rect x="72" y="76" width="14" height="14" rx="3" fill="${t.roof}" ${sw(1.8)}/><circle cx="79" cy="83" r="3" fill="#3b2a1c"/>`;
  if (lv >= 5) s += lamp(6, 66, lv >= 12) + lamp(106, 66, lv >= 12);
  if (lv >= 8) s += gem(56, 34, t.acc) + gem(26, 100, t.acc) + gem(86, 100, t.acc);
  if (lv >= 11) s += star(18, 38, 5) + star(98, 34, 4);
  if (lv >= 14) s += crown(56, 16);
  return svg(112, 126, s);
}

// ---------- Kandang reptil: terarium kaca dengan lampu pemanas (112 x 126) ----------
function terrarium(lv) {
  const t = tier(lv);
  let s = shadow(56, 118, 44);
  if (lv >= 12) s += `<ellipse cx="56" cy="76" rx="56" ry="50" fill="${t.acc}" opacity=".28"/>`;
  s += `<rect x="12" y="44" width="88" height="66" rx="8" fill="#d8f3ff" opacity=".55" ${sw(3)}/>`;
  s += `<rect x="14" y="88" width="84" height="20" rx="5" fill="${t.base}" ${sw(2.4)}/>`;
  s += `<ellipse cx="34" cy="88" rx="12" ry="7" fill="#b8b3a8" ${sw(2)}/><ellipse cx="44" cy="84" rx="8" ry="5" fill="#d0cbbf" ${sw(1.8)}/>`;
  s += `<path d="M80 88 Q74 70 82 60 M80 80 Q90 76 92 68 M80 74 Q70 70 68 62" fill="none" stroke="#3f9a52" stroke-width="3.4" stroke-linecap="round"/>`;
  s += `<rect x="10" y="40" width="92" height="8" rx="3" fill="${t.trim}" ${sw(2.4)}/>`;
  s += `<rect x="10" y="106" width="92" height="8" rx="3" fill="${t.trim}" ${sw(2.4)}/>`;
  if (lv >= 2) s += `<path d="M18 70 Q40 60 56 72" fill="none" stroke="#8a5a2e" stroke-width="4" stroke-linecap="round"/>`;
  if (lv >= 3) s += `<path d="M34 40 Q56 20 78 40 Z" fill="${t.roof}" ${sw(2.4)}/>` + flag(98, 24, t.acc);
  if (lv >= 4) s += '<path d="M44 44 L36 86 H76 L68 44 Z" fill="#ffe9a0" opacity=".28"/>' + `<rect x="96" y="56" width="4" height="22" rx="2" fill="#fff" ${sw(1.4)}/><rect x="97.2" y="66" width="1.6" height="12" fill="#e2574c"/>`;
  if (lv >= 5) s += lamp(6, 62, lv >= 12) + lamp(106, 62, lv >= 12);
  if (lv >= 8) s += gem(56, 44, t.acc) + gem(20, 110, t.acc) + gem(92, 110, t.acc);
  if (lv >= 11) s += star(18, 30, 5) + star(94, 28, 4);
  if (lv >= 14) s += crown(56, 16);
  return svg(112, 126, s);
}

const MAKERS = { kolam: pond, kebun: bed, kecil: hutch, burung: aviary, reptil: terrarium };
export const habSVG = (hab, level) => (MAKERS[hab] || hutch)(clampLv(level));
export const habKey = (hab, level) => `hab_${hab}_${clampLv(level)}`;
export const habTierName = (level) => TIER_NAMES[clampLv(level) - 1];
