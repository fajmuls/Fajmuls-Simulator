// Ilustrasi doodle vektor untuk dunia permainan: bangunan, lahan, karakter, pelanggan, dekorasi.
// Semua berupa string SVG; Phaser memuatnya sebagai tekstur beresolusi tinggi, jadi tidak ada piksel.
import { hashSeed } from './core/rng.js';

export const OUT = '#3b2a1c';
const sw = (w = 2.4) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`;
const shadow = (cx, cy, rx, ry = rx * 0.25) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2b1d1433"/>`;

// ---------- Pemain dan NPC ----------
export function playerSVG() {
  return svg(44, 68, `
    ${shadow(22, 65, 13)}
    <rect x="14" y="48" width="7" height="14" rx="3.5" fill="#7a5230" ${sw()}/><rect x="23" y="48" width="7" height="14" rx="3.5" fill="#7a5230" ${sw()}/>
    <ellipse cx="17" cy="62" rx="6" ry="3" fill="#4a3322" ${sw(2)}/><ellipse cx="27" cy="62" rx="6" ry="3" fill="#4a3322" ${sw(2)}/>
    <rect x="10" y="28" width="24" height="25" rx="9" fill="#58b368" ${sw()}/>
    <rect x="13" y="37" width="18" height="16" rx="6" fill="#3f78d8" ${sw()}/>
    <circle cx="19" cy="41" r="1.6" fill="#f7d25a"/><circle cx="25" cy="41" r="1.6" fill="#f7d25a"/>
    <circle cx="8" cy="42" r="4.2" fill="#f4c9a0" ${sw(2)}/><circle cx="36" cy="42" r="4.2" fill="#f4c9a0" ${sw(2)}/>
    <circle cx="22" cy="21" r="12" fill="#f4c9a0" ${sw()}/>
    <circle cx="17.5" cy="22" r="1.9" fill="${OUT}"/><circle cx="26.5" cy="22" r="1.9" fill="${OUT}"/>
    <circle cx="14.5" cy="26" r="2.6" fill="#ff8a8a" opacity=".6"/><circle cx="29.5" cy="26" r="2.6" fill="#ff8a8a" opacity=".6"/>
    <path d="M18.5 27 Q22 31 25.5 27" fill="none" ${sw(2)}/>
    <ellipse cx="22" cy="13" rx="19" ry="5.5" fill="#f7d25a" ${sw()}/>
    <path d="M12 12 Q12 2 22 2 Q32 2 32 12 Z" fill="#fbe27a" ${sw()}/>
    <path d="M12.5 10.5 Q22 13.5 31.5 10.5" fill="none" stroke="#e2574c" stroke-width="3"/>`);
}

export function npcSVG() {
  return svg(44, 68, `
    ${shadow(22, 65, 13)}
    <rect x="14" y="48" width="7" height="14" rx="3.5" fill="#5b4a8a" ${sw()}/><rect x="23" y="48" width="7" height="14" rx="3.5" fill="#5b4a8a" ${sw()}/>
    <ellipse cx="17" cy="62" rx="6" ry="3" fill="#3b2a1c" ${sw(2)}/><ellipse cx="27" cy="62" rx="6" ry="3" fill="#3b2a1c" ${sw(2)}/>
    <rect x="9" y="28" width="26" height="26" rx="9" fill="#a24dc7" ${sw()}/>
    <path d="M22 28 V54" ${sw(2)}/>
    <circle cx="8" cy="43" r="4.2" fill="#e8b98c" ${sw(2)}/><circle cx="36" cy="43" r="4.2" fill="#e8b98c" ${sw(2)}/>
    <path d="M40 30 V62" stroke="#7a5230" stroke-width="4" stroke-linecap="round"/>
    <circle cx="22" cy="21" r="12" fill="#e8b98c" ${sw()}/>
    <path d="M12 24 Q22 44 32 24 Q22 30 12 24 Z" fill="#f4f1ea" ${sw(2.2)}/>
    <path d="M11 14 Q22 4 33 14" fill="#f4f1ea" ${sw(2.2)}/>
    <path d="M14 18 Q17 15.5 20 18 M24 18 Q27 15.5 30 18" fill="none" ${sw(2)}/>
    <circle cx="17.5" cy="21" r="1.6" fill="${OUT}"/><circle cx="26.5" cy="21" r="1.6" fill="${OUT}"/>
    <circle cx="22" cy="24" r="2.4" fill="#e59a7c" ${sw(1.6)}/>
    <path d="M10 10 Q22 -2 34 10 L32 14 Q22 8 12 14 Z" fill="#7a5230" ${sw(2.2)}/>`);
}

export const exclaimSVG = () => svg(24, 30, `
  <path d="M12 2 C20 2 22 8 22 12 C22 18 16 20 14 22 L12 28 L10 22 C8 20 2 18 2 12 C2 8 4 2 12 2 Z" fill="#ffd84d" ${sw(2.2)}/>
  <rect x="10.5" y="6" width="3" height="9" rx="1.5" fill="${OUT}"/><circle cx="12" cy="18" r="1.8" fill="${OUT}"/>`);

// ---------- Pelanggan: dibangkitkan dari parameter, jadi tiap orang unik ----------
const SKIN = ['#f6d3b0', '#e8b98c', '#c68642', '#a06a3c', '#7c4a2a'];
const HAIR_COL = ['#2b1d14', '#5b341b', '#c98a1b', '#7a7a82', '#b3261e', '#3a2a6b'];
const SHIRT = ['#e2574c', '#3f78d8', '#58b368', '#f0a02c', '#a24dc7', '#2fa8a0', '#e56aa3', '#7a8aa0'];

function hairBack(style, col) {
  if (style === 1) return `<path d="M8 20 Q8 4 22 4 Q36 4 36 20 L36 34 L30 34 L30 20 L14 20 L14 34 L8 34 Z" fill="${col}" ${sw(2.2)}/>`;
  if (style === 3) return `<circle cx="22" cy="14" r="15" fill="${col}" ${sw(2.2)}/>`;
  if (style === 5) return `<path d="M34 14 Q46 18 40 34 Q38 24 32 22 Z" fill="${col}" ${sw(2.2)}/>`;
  return '';
}
function hairFront(style, col) {
  if (style === 4) return '';
  if (style === 2) return `<path d="M11 15 Q11 6 22 6 Q33 6 33 15 Q22 10 11 15 Z" fill="${col}" ${sw(2.2)}/><circle cx="22" cy="3.5" r="5" fill="${col}" ${sw(2.2)}/>`;
  return `<path d="M10.5 16 Q10 4 22 4 Q34 4 33.5 16 Q28 9 22 11 Q16 9 10.5 16 Z" fill="${col}" ${sw(2.2)}/>`;
}

// look: { type, skin, hair, hairCol, shirt, acc }
export function customerSVG(look) {
  const skin = SKIN[look.skin % SKIN.length];
  const hc = HAIR_COL[look.hairCol % HAIR_COL.length];
  const shirt = look.shirtColor || SHIRT[look.shirt % SHIRT.length];
  const type = look.type;
  let top = '';
  let face = '';
  let body = '';
  let extra = '';
  if (type === 'vip') {
    top = `<path d="M11 12 L13 3 L18 9 L22 1 L26 9 L31 3 L33 12 Z" fill="#ffd84d" ${sw(2.2)}/><circle cx="22" cy="5" r="1.6" fill="#e2574c"/>`;
    body = `<path d="M18 30 L22 36 L26 30 Z" fill="#fff" ${sw(1.8)}/><circle cx="22" cy="41" r="1.4" fill="#ffd84d"/><circle cx="22" cy="46" r="1.4" fill="#ffd84d"/>`;
    extra = `<path d="M3 20 l2 -4 l2 4 l-4 0 z M38 14 l2 -4 l2 4 l-4 0 z" fill="#ffd84d" opacity=".9"/>`;
  } else if (type === 'kolektor') {
    top = `<path d="M9 13 Q22 -2 35 13 Q22 9 9 13 Z" fill="#6a4aa8" ${sw(2.2)}/><rect x="14" y="2" width="16" height="9" rx="3" fill="#6a4aa8" ${sw(2.2)}/>`;
    face = `<circle cx="27" cy="22" r="5" fill="none" stroke="#c98a1b" stroke-width="2"/><path d="M31 25 L34 31" stroke="#c98a1b" stroke-width="1.8"/>`;
    body = `<path d="M10 32 L22 56 L34 32 Z" fill="#4b2f7a" opacity=".85"/><path d="M6 33 Q4 48 8 56 L14 52 L12 34 Z M38 33 Q40 48 36 56 L30 52 L32 34 Z" fill="#6a4aa8" ${sw(2)}/>`;
  } else if (type === 'pelit') {
    face = `<circle cx="17" cy="22" r="4.6" fill="#ffffffaa" stroke="${OUT}" stroke-width="1.8"/><circle cx="27" cy="22" r="4.6" fill="#ffffffaa" stroke="${OUT}" stroke-width="1.8"/><path d="M21.6 22 H22.4" stroke="${OUT}" stroke-width="1.8"/>`;
    body = `<rect x="29" y="40" width="10" height="8" rx="2" fill="#8d6a3a" ${sw(1.8)}/><path d="M29 43 H39" stroke="${OUT}" stroke-width="1.4"/>`;
  } else {
    const a = look.acc % 4;
    if (a === 1) top = `<path d="M10 14 Q22 -2 34 14 Z" fill="#e2574c" ${sw(2.2)}/><rect x="9" y="12" width="26" height="4" rx="2" fill="#c0392b" ${sw(2)}/>`;
    if (a === 2) face = `<circle cx="17" cy="22" r="4.4" fill="#ffffff88" stroke="${OUT}" stroke-width="1.8"/><circle cx="27" cy="22" r="4.4" fill="#ffffff88" stroke="${OUT}" stroke-width="1.8"/><path d="M21.4 22 H22.6" stroke="${OUT}" stroke-width="1.8"/>`;
    if (a === 3) body = `<path d="M14 30 Q22 38 30 30 L30 34 Q22 42 14 34 Z" fill="#f7d25a" ${sw(2)}/>`;
    if (a === 0) extra = `<rect x="2" y="36" width="9" height="12" rx="3" fill="#8d6a3a" ${sw(2)}/>`;
  }
  const eyes = type === 'pelit'
    ? `<circle cx="17" cy="22" r="1.5" fill="${OUT}"/><circle cx="27" cy="22" r="1.5" fill="${OUT}"/>`
    : `<circle cx="17.5" cy="22" r="1.8" fill="${OUT}"/><circle cx="26.5" cy="22" r="1.8" fill="${OUT}"/>`;
  const mouth = type === 'pelit' ? `<path d="M18.5 29 Q22 26 25.5 29" fill="none" ${sw(2)}/>` : `<path d="M18.5 27 Q22 31.5 25.5 27" fill="none" ${sw(2)}/>`;
  return svg(44, 68, `
    ${shadow(22, 65, 13)}
    ${hairBack(look.hair % 6, hc)}
    <rect x="14" y="48" width="7" height="14" rx="3.5" fill="#556" ${sw()}/><rect x="23" y="48" width="7" height="14" rx="3.5" fill="#556" ${sw()}/>
    <ellipse cx="17" cy="62" rx="6" ry="3" fill="#2f2118" ${sw(2)}/><ellipse cx="27" cy="62" rx="6" ry="3" fill="#2f2118" ${sw(2)}/>
    <rect x="10" y="28" width="24" height="25" rx="9" fill="${shirt}" ${sw()}/>
    ${body}
    <circle cx="8" cy="42" r="4.2" fill="${skin}" ${sw(2)}/><circle cx="36" cy="42" r="4.2" fill="${skin}" ${sw(2)}/>
    <circle cx="22" cy="21" r="12" fill="${skin}" ${sw()}/>
    ${hairFront(look.hair % 6, hc)}
    ${eyes}
    <circle cx="14.5" cy="26" r="2.4" fill="#ff8a8a" opacity=".55"/><circle cx="29.5" cy="26" r="2.4" fill="#ff8a8a" opacity=".55"/>
    ${mouth}
    ${face}
    ${top}
    ${extra}`);
}

// 36 penampilan: 6 per tipe biasa/pelit/vip/kolektor, ditambah 12 langganan dengan ciri khas.
export const CUSTOMER_TYPES_LOOK = ['biasa', 'pelit', 'vip', 'kolektor'];
export const LOOKS_PER_TYPE = 6;
export function lookFor(type, id) {
  const h = hashSeed(String(id));
  return { type, skin: h % 5, hair: (h >>> 3) % 6, hairCol: (h >>> 6) % 6, shirt: (h >>> 9) % 8, acc: (h >>> 12) % 4 };
}
export const lookKey = (type, k) => `cust_${type}_${k}`;
export const lookIndex = (id) => hashSeed(`look${id}`) % LOOKS_PER_TYPE;
export function poolLook(type, k) {
  return { type, skin: (k * 2 + 1) % 5, hair: (k + (type.length % 3)) % 6, hairCol: (k * 5 + 2) % 6, shirt: (k * 3 + type.length) % 8, acc: k };
}

export const REGULAR_LOOKS = {
  joko: { type: 'biasa', skin: 2, hair: 4, hairCol: 3, shirt: 2, acc: 1, shirtColor: '#6b8e4e' },
  rina: { type: 'biasa', skin: 1, hair: 2, hairCol: 1, shirt: 6, acc: 3 },
  dimas: { type: 'biasa', skin: 0, hair: 0, hairCol: 0, shirt: 1, acc: 2 },
  ahen: { type: 'kolektor', skin: 0, hair: 4, hairCol: 3, shirt: 4 },
  sari: { type: 'biasa', skin: 1, hair: 2, hairCol: 3, shirt: 6, acc: 3, shirtColor: '#c97aa8' },
  rt: { type: 'biasa', skin: 2, hair: 0, hairCol: 0, shirt: 7, acc: 1, shirtColor: '#4b6b3a' },
  lala: { type: 'vip', skin: 1, hair: 1, hairCol: 4, shirt: 0 },
  bram: { type: 'kolektor', skin: 0, hair: 0, hairCol: 1, shirt: 7 },
  tia: { type: 'biasa', skin: 3, hair: 5, hairCol: 0, shirt: 5, acc: 0 },
  kevin: { type: 'pelit', skin: 0, hair: 0, hairCol: 5, shirt: 3 },
  ayu: { type: 'biasa', skin: 1, hair: 5, hairCol: 1, shirt: 7, acc: 3, shirtColor: '#f4f1ea' },
  rudi: { type: 'biasa', skin: 3, hair: 3, hairCol: 0, shirt: 0, acc: 0 },
};

// ---------- Bangunan ----------
const awning = (x, y, w, h, c1, c2, n) => {
  const sw_ = w / n;
  let s = '';
  for (let i = 0; i < n; i++) s += `<path d="M${x + i * sw_} ${y} h${sw_} v${h} a${sw_ / 2} ${sw_ / 2} 0 0 1 ${-sw_} 0 Z" fill="${i % 2 ? c2 : c1}" ${sw(2.4)}/>`;
  return s;
};
const sign = (x, y, w, h, text, fs = 20, bg = '#fff3c4') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${bg}" ${sw(3)}/><text x="${x + w / 2}" y="${y + h / 2 + fs * 0.35}" text-anchor="middle" font-family="'Trebuchet MS','Segoe UI',sans-serif" font-weight="900" font-size="${fs}" fill="${OUT}" letter-spacing="1.5">${text}</text>`;

export function tokoSVG() {
  return svg(380, 150, `
    <rect x="14" y="44" width="352" height="100" rx="8" fill="#ffe9bb" ${sw(3.2)}/>
    <rect x="30" y="74" width="74" height="60" rx="5" fill="#bfe6ff" ${sw(3)}/><path d="M67 74 V134 M30 104 H104" ${sw(2.2)}/>
    <rect x="276" y="74" width="74" height="60" rx="5" fill="#bfe6ff" ${sw(3)}/><path d="M313 74 V134 M276 104 H350" ${sw(2.2)}/>
    <rect x="154" y="78" width="72" height="66" rx="6" fill="#a8693a" ${sw(3)}/><circle cx="214" cy="112" r="3.4" fill="#ffd84d" ${sw(1.6)}/>
    ${awning(8, 30, 364, 26, '#e2574c', '#fff7e6', 14)}
    ${sign(120, 2, 140, 34, 'PASAR SATWA', 15)}
    <path d="M6 30 H374" ${sw(3)}/>`);
}
export function pasarSVG() {
  return svg(220, 160, `
    <rect x="18" y="56" width="184" height="96" rx="8" fill="#ffe0a8" ${sw(3.2)}/>
    ${awning(10, 40, 200, 28, '#3fa34d', '#fff7e6', 8)}
    ${sign(60, 4, 100, 32, 'PASAR', 18, '#d9f3c9')}
    <rect x="30" y="100" width="64" height="46" rx="5" fill="#c98a4a" ${sw(3)}/><path d="M30 118 H94" ${sw(2.2)}/>
    <circle cx="48" cy="92" r="9" fill="#ff8a65" ${sw(2.2)}/><circle cx="66" cy="94" r="9" fill="#ffd84d" ${sw(2.2)}/><circle cx="82" cy="91" r="8" fill="#7ccf6a" ${sw(2.2)}/>
    <rect x="120" y="90" width="72" height="56" rx="6" fill="#d9b27a" ${sw(3)}/>
    <path d="M128 90 L134 76 H178 L184 90" fill="#f2e2c0" ${sw(2.6)}/><path d="M146 76 Q156 66 166 76" fill="none" ${sw(2.2)}/>
    <ellipse cx="156" cy="112" rx="16" ry="10" fill="#f6e3b8" ${sw(2.4)}/><path d="M146 112 H166 M156 104 V120" stroke="#c98a4a" stroke-width="2"/>`);
}
export function petHouseSVG() {
  return svg(200, 170, `
    <rect x="22" y="74" width="156" height="90" rx="10" fill="#ffd9ec" ${sw(3.2)}/>
    <path d="M10 78 L100 22 L190 78 Z" fill="#a24dc7" ${sw(3.2)}/>
    <path d="M32 74 L100 34 L168 74" fill="none" stroke="#c98ae0" stroke-width="3"/>
    <ellipse cx="100" cy="54" rx="13" ry="16" fill="#ffd84d" ${sw(2.6)}/><path d="M90 54 L95 50 L100 56 L105 50 L110 54" fill="none" stroke="#fff" stroke-width="2.4"/>
    <path d="M78 164 V116 Q78 100 100 100 Q122 100 122 116 V164 Z" fill="#a8693a" ${sw(3)}/><circle cx="114" cy="134" r="3" fill="#ffd84d" ${sw(1.6)}/>
    <circle cx="48" cy="112" r="14" fill="#bfe6ff" ${sw(3)}/><circle cx="152" cy="112" r="14" fill="#bfe6ff" ${sw(3)}/>
    <path d="M40 150 q4 -8 8 0 q4 -8 8 0" fill="none" ${sw(2.2)}/>
    ${sign(66, 84, 68, 22, 'PET', 15, '#fff3c4')}`);
}
export function kantorSVG() {
  return svg(220, 160, `
    <rect x="24" y="52" width="172" height="102" rx="8" fill="#dbe7ff" ${sw(3.2)}/>
    <path d="M12 56 L110 14 L208 56 Z" fill="#3f78d8" ${sw(3.2)}/>
    <circle cx="110" cy="40" r="15" fill="#fff" ${sw(3)}/><path d="M110 30 V40 L117 44" fill="none" ${sw(2.6)}/>
    <rect x="42" y="78" width="40" height="40" rx="4" fill="#fff6d1" ${sw(3)}/><path d="M62 78 V118 M42 98 H82" ${sw(2.2)}/>
    <rect x="138" y="78" width="40" height="40" rx="4" fill="#fff6d1" ${sw(3)}/><path d="M158 78 V118 M138 98 H178" ${sw(2.2)}/>
    <path d="M94 154 V120 Q94 106 110 106 Q126 106 126 120 V154 Z" fill="#a8693a" ${sw(3)}/>
    <path d="M110 14 V2 L126 8 L110 12" fill="#e2574c" ${sw(2.2)}/>`);
}
export function signpostSVG() {
  return svg(90, 100, `
    ${shadow(45, 96, 14)}
    <rect x="40" y="20" width="10" height="76" rx="3" fill="#a8693a" ${sw()}/>
    <path d="M8 22 H44 L52 30 L44 38 H8 Z" fill="#ffd84d" ${sw(2.4)}/>
    <path d="M82 46 H48 L40 54 L48 62 H82 Z" fill="#7ccf6a" ${sw(2.4)}/>
    <path d="M10 68 H44 L52 76 L44 84 H10 Z" fill="#8ad0ff" ${sw(2.4)}/>`);
}

// ---------- Lahan ----------
export function pondSVG() {
  return svg(170, 112, `
    <ellipse cx="85" cy="62" rx="80" ry="46" fill="#c9b79c" ${sw(3.2)}/>
    <ellipse cx="85" cy="58" rx="70" ry="38" fill="#4fc3f0" ${sw(3)}/>
    <ellipse cx="85" cy="58" rx="70" ry="38" fill="none" stroke="#b6ecff" stroke-width="3" stroke-dasharray="14 10" opacity=".6"/>
    <path d="M44 52 q10 -6 20 0 M96 70 q10 -6 20 0 M108 46 q8 -4 16 0" fill="none" stroke="#fff" stroke-width="2.6" opacity=".8"/>
    <ellipse cx="62" cy="68" rx="9" ry="5" fill="#58b368" ${sw(2)}/>
    <g fill="#d8c6aa" ${sw(2.2)}><ellipse cx="18" cy="70" rx="9" ry="6"/><ellipse cx="148" cy="70" rx="9" ry="6"/><ellipse cx="46" cy="100" rx="10" ry="6"/><ellipse cx="124" cy="100" rx="10" ry="6"/><ellipse cx="85" cy="106" rx="11" ry="6"/></g>`);
}
export function bedSVG() {
  return svg(120, 84, `
    <rect x="6" y="14" width="108" height="62" rx="9" fill="#a8693a" ${sw(3.2)}/>
    <rect x="14" y="22" width="92" height="46" rx="6" fill="#6b4a2b" ${sw(2.4)}/>
    <path d="M24 34 q6 -5 12 0 M50 44 q6 -5 12 0 M76 34 q6 -5 12 0 M30 56 q6 -5 12 0 M70 58 q6 -5 12 0" fill="none" stroke="#8a6238" stroke-width="3"/>
    <circle cx="30" cy="40" r="2" fill="#4a3322"/><circle cx="60" cy="52" r="2" fill="#4a3322"/><circle cx="90" cy="46" r="2" fill="#4a3322"/>`);
}
export function cageSVG() {
  let bars = '';
  for (let i = 0; i < 6; i++) bars += `<path d="M${22 + i * 12} 38 V94" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`;
  return svg(112, 126, `
    ${shadow(56, 118, 44)}
    <rect x="14" y="94" width="84" height="16" rx="5" fill="#a8693a" ${sw(3)}/>
    <path d="M18 94 H94 L90 34 H22 Z" fill="#fff6d1" opacity=".55"/>
    ${bars}
    <path d="M20 66 H92" stroke="#c98a4a" stroke-width="5" stroke-linecap="round"/>
    <path d="M10 38 L56 8 L102 38 Z" fill="#e2574c" ${sw(3.2)}/>
    <circle cx="56" cy="8" r="4" fill="#ffd84d" ${sw(2)}/>
    <path d="M22 100 q6 -6 12 0 q6 -6 12 0" fill="none" stroke="#e7c36a" stroke-width="3"/>`);
}

// ---------- Rak dan meja ----------
export function rackSVG() {
  return svg(84, 96, `
    ${shadow(42, 92, 34)}
    <rect x="6" y="14" width="72" height="74" rx="6" fill="#d9b27a" ${sw(3)}/>
    <rect x="12" y="22" width="60" height="26" rx="3" fill="#f6e3b8" ${sw(2)}/>
    <rect x="12" y="54" width="60" height="26" rx="3" fill="#f6e3b8" ${sw(2)}/>
    <path d="M6 50 H78" ${sw(2.4)}/>`);
}
export function counterSVG() {
  return svg(120, 70, `
    ${shadow(60, 66, 50)}
    <rect x="6" y="24" width="108" height="38" rx="7" fill="#a8693a" ${sw(3)}/>
    <rect x="6" y="16" width="108" height="12" rx="5" fill="#d9b27a" ${sw(3)}/>
    <rect x="74" y="2" width="30" height="18" rx="3" fill="#cfd8dc" ${sw(2.4)}/><rect x="78" y="5" width="22" height="7" rx="1.5" fill="#8fe39f" stroke="${OUT}" stroke-width="1.6"/>
    <path d="M16 36 H98 M16 48 H98" stroke="#7a5230" stroke-width="2"/>`);
}

// ---------- Dekorasi ----------
export const treeSVG = (v = 0) => svg(76, 100, `
  ${shadow(38, 96, 22)}
  <rect x="32" y="54" width="12" height="40" rx="4" fill="#8a5a2e" ${sw()}/>
  <circle cx="38" cy="40" r="26" fill="${v ? '#6cc36a' : '#58b368'}" ${sw(3)}/>
  <circle cx="22" cy="50" r="16" fill="${v ? '#7fd47c' : '#66c476'}" ${sw(3)}/><circle cx="54" cy="50" r="16" fill="${v ? '#7fd47c' : '#66c476'}" ${sw(3)}/>
  <path d="M30 36 q4 -4 8 0 M44 46 q4 -4 8 0" fill="none" stroke="#2f7a3f" stroke-width="2.4" opacity=".6"/>
  ${v ? '<circle cx="28" cy="30" r="3.6" fill="#ff7a7a" stroke="#3b2a1c" stroke-width="1.6"/><circle cx="50" cy="36" r="3.6" fill="#ff7a7a" stroke="#3b2a1c" stroke-width="1.6"/>' : ''}`);
export const bushSVG = () => svg(54, 38, `
  ${shadow(27, 35, 20)}
  <circle cx="16" cy="22" r="13" fill="#58b368" ${sw(2.8)}/><circle cx="38" cy="22" r="13" fill="#58b368" ${sw(2.8)}/><circle cx="27" cy="15" r="14" fill="#6cc36a" ${sw(2.8)}/>`);
export const flowerSVG = (c) => svg(22, 26, `
  <path d="M11 13 V24" stroke="#2f7a3f" stroke-width="2.4" stroke-linecap="round"/>
  <g fill="${c}" ${sw(1.6)}><circle cx="11" cy="6" r="4"/><circle cx="6" cy="11" r="4"/><circle cx="16" cy="11" r="4"/><circle cx="11" cy="14" r="4"/></g><circle cx="11" cy="10.5" r="3" fill="#ffd84d" ${sw(1.4)}/>`);
export const tuftSVG = () => svg(26, 16, `<path d="M3 14 Q5 4 8 14 M10 14 Q13 0 16 14 M18 14 Q20 5 23 14" fill="none" stroke="#3f9a52" stroke-width="2.6" stroke-linecap="round"/>`);
export const rockSVG = () => svg(40, 28, `<path d="M3 25 Q2 10 12 7 Q20 2 29 8 Q39 12 37 25 Z" fill="#b8b3a8" ${sw(2.6)}/><path d="M12 14 q4 -3 8 0" fill="none" stroke="#e7e2d6" stroke-width="2.4"/>`);
export const lampSVG = () => svg(26, 66, `
  ${shadow(13, 63, 9)}
  <rect x="10" y="22" width="6" height="40" rx="2" fill="#5a5560" ${sw(2.2)}/>
  <rect x="5" y="4" width="16" height="20" rx="5" fill="#ffe27a" ${sw(2.6)}/><path d="M9 4 V24 M17 4 V24" stroke="${OUT}" stroke-width="1.4"/>`);
export const fountainSVG = () => svg(120, 100, `
  ${shadow(60, 92, 50)}
  <ellipse cx="60" cy="68" rx="52" ry="24" fill="#c9b79c" ${sw(3)}/>
  <ellipse cx="60" cy="64" rx="44" ry="18" fill="#4fc3f0" ${sw(2.6)}/>
  <rect x="54" y="28" width="12" height="38" rx="4" fill="#d8c6aa" ${sw(2.6)}/>
  <ellipse cx="60" cy="30" rx="20" ry="7" fill="#d8c6aa" ${sw(2.6)}/>
  <path d="M60 10 Q50 20 44 34 M60 10 Q70 20 76 34 M60 10 V28" fill="none" stroke="#a7e3ff" stroke-width="4" stroke-linecap="round"/>
  <path d="M34 66 q8 -4 16 0 M70 62 q8 -4 16 0" fill="none" stroke="#fff" stroke-width="2.4" opacity=".8"/>`);
export const fenceSVG = () => svg(48, 30, `
  <rect x="2" y="12" width="44" height="5" rx="2" fill="#c98a4a" ${sw(2)}/><rect x="2" y="21" width="44" height="5" rx="2" fill="#c98a4a" ${sw(2)}/>
  <rect x="6" y="4" width="7" height="24" rx="2.5" fill="#d9a05c" ${sw(2.2)}/><rect x="34" y="4" width="7" height="24" rx="2.5" fill="#d9a05c" ${sw(2.2)}/>`);
export const sparkleSVG = () => svg(20, 20, `<path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill="#fff6a8" stroke="#e0a92c" stroke-width="1.2" stroke-linejoin="round"/>`);
export const arrowSVG = () => svg(30, 22, `<path d="M3 4 H17 V0 L29 11 L17 22 V18 H3 Z" fill="#ffd84d" ${sw(2.2)}/>`);

// ---------- Ikon status UI (event, dll) ----------
const ev = (inner) => svg(48, 48, inner);
export const EVENT_ICONS = {
  cerah: ev(`<circle cx="24" cy="24" r="10" fill="#ffd84d" ${sw(2.4)}/><path d="M24 4 V10 M24 38 V44 M4 24 H10 M38 24 H44 M10 10 L14 14 M34 34 L38 38 M38 10 L34 14 M10 38 L14 34" ${sw(3)}/>`),
  hujan: ev(`<path d="M12 30 Q4 30 6 22 Q8 14 18 16 Q22 6 32 10 Q40 12 38 22 Q46 24 42 30 Z" fill="#cfd8e3" ${sw(2.4)}/><path d="M14 36 L12 44 M24 36 L22 44 M34 36 L32 44" stroke="#3f78d8" stroke-width="3.4" stroke-linecap="round"/>`),
  festival: ev(`<path d="M8 40 L18 12 L30 24 Z" fill="#ff7a8a" ${sw(2.4)}/><circle cx="32" cy="12" r="3" fill="#ffd84d"/><circle cx="38" cy="22" r="3" fill="#58b368"/><circle cx="24" cy="6" r="3" fill="#3f78d8"/><path d="M30 24 L42 30 M28 18 L40 8" stroke="#a24dc7" stroke-width="3" stroke-linecap="round"/>`),
  murah: ev(`<path d="M6 24 L24 6 H42 V24 L24 42 Z" fill="#ffd84d" ${sw(2.4)}/><circle cx="34" cy="14" r="3" fill="#fff" ${sw(1.8)}/><path d="M16 28 L28 16" ${sw(3)}/>`),
  kolektor: ev(`<circle cx="21" cy="21" r="12" fill="#bfe6ff" ${sw(2.6)}/><path d="M30 30 L42 42" stroke="#a8693a" stroke-width="6" stroke-linecap="round"/><path d="M15 21 H27" ${sw(2.4)}/>`),
  sepi: ev(`<path d="M30 6 A18 18 0 1 0 42 30 A14 14 0 1 1 30 6 Z" fill="#ffe27a" ${sw(2.4)}/><path d="M8 10 h6 l-6 7 h6" fill="none" ${sw(2.2)}/>`),
  bintang: ev(`<path d="M24 4 L29 18 L44 18 L32 27 L37 42 L24 33 L11 42 L16 27 L4 18 L19 18 Z" fill="#ffd84d" ${sw(2.4)}/>`),
  angin: ev(`<path d="M6 18 H28 Q38 18 36 11 M6 28 H34 Q44 28 42 36 M6 38 H20" fill="none" stroke="#58b368" stroke-width="4" stroke-linecap="round"/>`),
};
export const statIconSVG = (name) => ({
  quest: ev(`<circle cx="24" cy="24" r="18" fill="#fff" ${sw(2.6)}/><circle cx="24" cy="24" r="11" fill="#e2574c" ${sw(2.2)}/><circle cx="24" cy="24" r="5" fill="#fff" ${sw(2)}/>`),
  harvest: ev(`<path d="M24 44 V20" ${sw(3)}/><path d="M24 24 Q10 22 10 8 Q24 8 24 24 Z M24 30 Q38 28 38 14 Q24 14 24 30 Z" fill="#58b368" ${sw(2.4)}/>`),
  bell: ev(`<path d="M12 34 Q14 28 14 20 Q14 8 24 8 Q34 8 34 20 Q34 28 36 34 Z" fill="#ffd84d" ${sw(2.4)}/><circle cx="24" cy="38" r="4" fill="#ffd84d" ${sw(2.2)}/>`),
  sound: ev(`<path d="M8 18 H16 L28 8 V40 L16 30 H8 Z" fill="#bfe6ff" ${sw(2.4)}/><path d="M34 16 Q40 24 34 32 M38 10 Q48 24 38 38" fill="none" ${sw(2.6)}/>`),
  mute: ev(`<path d="M8 18 H16 L28 8 V40 L16 30 H8 Z" fill="#d6d6d6" ${sw(2.4)}/><path d="M34 16 L46 32 M46 16 L34 32" ${sw(3)}/>`),
  menu: ev(`<rect x="6" y="9" width="36" height="6" rx="3" fill="#fff" ${sw(2.4)}/><rect x="6" y="21" width="36" height="6" rx="3" fill="#fff" ${sw(2.4)}/><rect x="6" y="33" width="36" height="6" rx="3" fill="#fff" ${sw(2.4)}/>`),
  play: ev(`<path d="M14 8 L40 24 L14 40 Z" fill="#fff" ${sw(2.6)}/>`),
  stop: ev(`<rect x="10" y="10" width="28" height="28" rx="6" fill="#fff" ${sw(2.6)}/>`),
  story: ev(`<path d="M6 10 Q16 6 24 12 Q32 6 42 10 V38 Q32 34 24 40 Q16 34 6 38 Z" fill="#fff6d1" ${sw(2.4)}/><path d="M24 12 V40" ${sw(2.2)}/>`),
  toko: ev(`<path d="M6 18 L10 6 H38 L42 18 Z" fill="#e2574c" ${sw(2.4)}/><rect x="9" y="18" width="30" height="24" fill="#ffe9bb" ${sw(2.4)}/><rect x="19" y="26" width="10" height="16" fill="#a8693a" ${sw(2)}/>`),
  kandang: ev(`<path d="M6 20 L24 6 L42 20 Z" fill="#e2574c" ${sw(2.4)}/><rect x="9" y="20" width="30" height="22" fill="#fff6d1" ${sw(2.4)}/><path d="M17 22 V42 M24 22 V42 M31 22 V42" ${sw(2.2)}/>`),
}[name] || ev(''));

export const worldIconKeys = Object.keys(EVENT_ICONS);
