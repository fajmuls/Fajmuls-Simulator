// Ilustrasi vektor SVG bersih untuk hewan, pakan, telur, pet, dan ikon menu. Semua 48x48.
import { getItem } from './core/catalog.js';

const OUT = '#3b2a1c';
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
const st = `stroke="${OUT}" stroke-width="1.8"`;

const EXTRA = {
  cacing: { a: '#e879a0', b: '#be185d', w: '#fbcfe8' },
  jangkrik: { a: '#92400e', b: '#451a03', w: '#fde68a' },
  pelet: { a: '#d97706', b: '#92400e', w: '#fde68a' },
  voer: { a: '#ca8a04', b: '#713f12', w: '#fef08a' },
};
const palOf = (it) => it.pal || EXTRA[it.id] || { a: '#a3a3a3', b: '#525252', w: '#e5e5e5' };

const BODY = {
  fish: (p) => `
    <path d="M6 24 L15 15 L15 33 Z" fill="${p.b}" ${st}/>
    <path d="M14 24 C16 13 32 10 40 24 C32 38 16 35 14 24 Z" fill="${p.a}" ${st}/>
    <path d="M22 13 L28 8 L32 15 Z" fill="${p.b}" ${st}/>
    <path d="M24 34 L28 40 L31 33 Z" fill="${p.b}" ${st}/>
    <path d="M20 17 C22 24 22 24 20 31" fill="none" stroke="${p.w}" stroke-width="2"/>
    <circle cx="35" cy="21" r="2.8" fill="#fff" ${st}/><circle cx="35.6" cy="21" r="1.2" fill="${OUT}"/>`,
  bird: (p) => `
    <path d="M10 18 L4 14 L7 22 Z" fill="${p.b}" ${st}/>
    <ellipse cx="25" cy="27" rx="15" ry="12" fill="${p.a}" ${st}/>
    <circle cx="33" cy="17" r="8" fill="${p.a}" ${st}/>
    <path d="M40 16 L47 19 L40 21 Z" fill="${p.b}" ${st}/>
    <ellipse cx="23" cy="29" rx="8" ry="6" fill="${p.w}" opacity="0.9"/>
    <path d="M18 24 C24 20 30 26 24 32 C18 31 16 28 18 24 Z" fill="${p.b}" ${st}/>
    <circle cx="35" cy="15" r="2" fill="#fff" ${st}/><circle cx="35.5" cy="15" r="0.9" fill="${OUT}"/>
    <path d="M22 38 V43 M28 38 V43" ${st} fill="none"/>`,
  lizard: (p) => `
    <ellipse cx="22" cy="28" rx="16" ry="11" fill="${p.b}" ${st}/>
    <path d="M10 28 C10 18 34 18 34 28 Z" fill="${p.a}" ${st}/>
    <path d="M16 22 L20 28 M22 20 L26 28 M28 22 L30 28" stroke="${p.w}" stroke-width="1.8" fill="none"/>
    <circle cx="39" cy="26" r="6" fill="${p.a}" ${st}/>
    <circle cx="41" cy="24.5" r="1.8" fill="#fff" ${st}/><circle cx="41.4" cy="24.5" r="0.8" fill="${OUT}"/>
    <path d="M10 36 L6 41 M18 38 L16 43 M28 38 L30 43 M36 35 L40 40 M6 30 L1 33" ${st} fill="none"/>`,
  small: (p) => `
    <circle cx="14" cy="14" r="5" fill="${p.b}" ${st}/><circle cx="34" cy="14" r="5" fill="${p.b}" ${st}/>
    <ellipse cx="24" cy="28" rx="16" ry="14" fill="${p.a}" ${st}/>
    <ellipse cx="24" cy="33" rx="9" ry="7" fill="${p.w}"/>
    <circle cx="18" cy="24" r="2.2" fill="${OUT}"/><circle cx="30" cy="24" r="2.2" fill="${OUT}"/>
    <path d="M22 29 L24 31 L26 29 Z" fill="#f472b6" ${st}/>`,
  rabbit: (p) => `
    <ellipse cx="16" cy="11" rx="4" ry="10" fill="${p.a}" ${st}/><ellipse cx="32" cy="11" rx="4" ry="10" fill="${p.a}" ${st}/>
    <ellipse cx="16" cy="12" rx="1.8" ry="6" fill="${p.b}"/><ellipse cx="32" cy="12" rx="1.8" ry="6" fill="${p.b}"/>
    <ellipse cx="24" cy="30" rx="16" ry="13" fill="${p.a}" ${st}/>
    <ellipse cx="24" cy="35" rx="8" ry="5" fill="${p.w}"/>
    <circle cx="18" cy="27" r="2.2" fill="${OUT}"/><circle cx="30" cy="27" r="2.2" fill="${OUT}"/>
    <path d="M22 31 L24 33 L26 31 Z" fill="#f472b6" ${st}/>`,
  worm: (p) => `
    <path d="M6 34 C10 18 16 40 22 26 C28 12 32 36 42 18" fill="none" stroke="${OUT}" stroke-width="10"/>
    <path d="M6 34 C10 18 16 40 22 26 C28 12 32 36 42 18" fill="none" stroke="${p.a}" stroke-width="7"/>
    <path d="M13 24 V30 M21 26 V32 M30 22 V28" stroke="${p.w}" stroke-width="1.4"/>
    <circle cx="42" cy="18" r="1.4" fill="${OUT}"/>`,
  cricket: (p) => `
    <ellipse cx="22" cy="26" rx="14" ry="8" fill="${p.a}" ${st}/>
    <circle cx="38" cy="22" r="5" fill="${p.a}" ${st}/>
    <path d="M38 18 C40 10 46 8 47 6 M36 18 C34 10 30 6 28 4" fill="none" ${st}/>
    <path d="M12 30 L6 42 L10 42 L18 33 M24 33 L26 43 M32 32 L38 42" ${st} fill="none"/>
    <path d="M14 22 C20 14 30 16 32 24" fill="${p.b}" ${st}/>
    <circle cx="40" cy="21" r="1.3" fill="#fff" ${st}/>`,
  pellet: (p) => `
    <ellipse cx="16" cy="30" rx="8" ry="6" fill="${p.a}" ${st}/><ellipse cx="32" cy="32" rx="8" ry="6" fill="${p.a}" ${st}/>
    <ellipse cx="24" cy="20" rx="8" ry="6" fill="${p.a}" ${st}/>
    <circle cx="14" cy="28" r="1.4" fill="${p.w}"/><circle cx="30" cy="30" r="1.4" fill="${p.w}"/><circle cx="22" cy="18" r="1.4" fill="${p.w}"/>`,
  seed: (p) => `
    <path d="M10 38 C6 30 14 22 22 24 C26 32 18 40 10 38 Z" fill="${p.a}" ${st}/>
    <path d="M26 30 C24 20 34 14 40 18 C42 28 34 34 26 30 Z" fill="${p.a}" ${st}/>
    <path d="M14 33 L19 28 M30 26 L36 22" stroke="${p.w}" stroke-width="1.6"/>`,
};

export function animalSVG(itemOrId) {
  const it = typeof itemOrId === 'string' ? getItem(itemOrId) : itemOrId;
  const draw = BODY[it.icon] || BODY.small;
  return wrap(draw(palOf(it)));
}

export function feedSVG(feed) {
  const c = feed.color;
  return wrap(`
    <path d="M12 14 C10 22 8 32 10 41 L38 41 C40 32 38 22 36 14 Z" fill="${c}" ${st}/>
    <path d="M12 14 L16 7 L32 7 L36 14 Z" fill="${c}" ${st}/><path d="M16 7 L32 7" ${st}/>
    <rect x="15" y="21" width="18" height="12" rx="3" fill="#fff" opacity="0.88" stroke="${OUT}" stroke-width="1.2"/>
    <path d="M19 27 L22 24 L25 29 L29 24" fill="none" stroke="${c}" stroke-width="2"/>`);
}

export function eggSVG(egg) {
  const c = egg.color;
  return wrap(`
    <path d="M24 5 C35 5 41 20 41 29 C41 38 33 44 24 44 C15 44 7 38 7 29 C7 20 13 5 24 5 Z" fill="${c}" ${st}/>
    <path d="M10 26 L16 22 L21 27 L27 21 L33 27 L38 23" fill="none" stroke="#fff" stroke-width="2.4" opacity="0.8"/>
    <ellipse cx="17" cy="17" rx="3" ry="5" fill="#fff" opacity="0.55" transform="rotate(-20 17 17)"/>`);
}

const PET_BODY = {
  hoki: (c) => `
    <path d="M10 16 L12 4 L20 12 Z M38 16 L36 4 L28 12 Z" fill="${c}" ${st}/>
    <circle cx="24" cy="26" r="16" fill="${c}" ${st}/>
    <ellipse cx="24" cy="32" rx="8" ry="6" fill="#fff" opacity="0.85"/>
    <circle cx="17" cy="24" r="2.6" fill="#fff" ${st}/><circle cx="31" cy="24" r="2.6" fill="#fff" ${st}/>
    <circle cx="17" cy="24.4" r="1.1" fill="${OUT}"/><circle cx="31" cy="24.4" r="1.1" fill="${OUT}"/>
    <path d="M22 30 L24 32 L26 30 Z" fill="#f472b6" ${st}/><path d="M8 30 L15 31 M8 34 L15 33 M40 30 L33 31 M40 34 L33 33" ${st} fill="none"/>
    <circle cx="24" cy="12" r="3" fill="#fbbf24" ${st}/>`,
  cepat: (c) => `
    <ellipse cx="24" cy="30" rx="18" ry="12" fill="${c}" ${st}/>
    <path d="M10 30 C10 16 38 16 38 30 Z" fill="#fff" opacity="0.35"/>
    <path d="M17 22 L21 30 M24 20 L27 30 M31 22 L33 30" stroke="${OUT}" stroke-width="1.6" fill="none"/>
    <circle cx="42" cy="26" r="6" fill="${c}" ${st}/><circle cx="44" cy="24.5" r="1.6" fill="${OUT}"/>
    <path d="M10 38 L7 44 M20 40 L19 45 M30 40 L31 45 M38 36 L42 42" ${st} fill="none"/>
    <path d="M3 22 L10 22 M2 27 L8 27" stroke="#38bdf8" stroke-width="2.4"/>`,
  dagang: (c) => `
    <path d="M12 8 L16 14 M36 8 L32 14" ${st} fill="none"/>
    <ellipse cx="24" cy="28" rx="15" ry="16" fill="${c}" ${st}/>
    <circle cx="17" cy="20" r="6.5" fill="#fff" ${st}/><circle cx="31" cy="20" r="6.5" fill="#fff" ${st}/>
    <circle cx="17" cy="20" r="3" fill="${OUT}"/><circle cx="31" cy="20" r="3" fill="${OUT}"/>
    <path d="M21 25 L24 31 L27 25 Z" fill="#f59e0b" ${st}/>
    <path d="M14 34 C18 40 30 40 34 34" fill="none" stroke="#fff" stroke-width="2" opacity="0.8"/>
    <circle cx="24" cy="42" r="3" fill="#fbbf24" ${st}/>`,
  ramah: (c) => `
    <ellipse cx="16" cy="10" rx="4" ry="10" fill="${c}" ${st}/><ellipse cx="32" cy="10" rx="4" ry="10" fill="${c}" ${st}/>
    <ellipse cx="24" cy="30" rx="16" ry="13" fill="${c}" ${st}/>
    <circle cx="17" cy="28" r="2" fill="${OUT}"/><circle cx="31" cy="28" r="2" fill="${OUT}"/>
    <circle cx="13" cy="33" r="3" fill="#fb7185" opacity="0.6"/><circle cx="35" cy="33" r="3" fill="#fb7185" opacity="0.6"/>
    <path d="M20 34 C22 37 26 37 28 34" fill="none" ${st}/>
    <path d="M40 8 C42 4 46 6 44 10 L40 14 L36 10 C34 6 38 4 40 8 Z" fill="#fb7185" ${st}/>`,
  setia: (c) => `
    <path d="M6 18 C2 26 8 34 12 30 L14 16 Z M42 18 C46 26 40 34 36 30 L34 16 Z" fill="#78350f" ${st}/>
    <circle cx="24" cy="26" r="15" fill="${c}" ${st}/>
    <ellipse cx="24" cy="33" rx="9" ry="7" fill="#fff" opacity="0.85"/>
    <circle cx="18" cy="23" r="2.2" fill="${OUT}"/><circle cx="30" cy="23" r="2.2" fill="${OUT}"/>
    <ellipse cx="24" cy="30" rx="3.4" ry="2.4" fill="${OUT}"/>
    <path d="M24 33 V36 M20 37 C22 39 26 39 28 37" fill="none" ${st}/>
    <path d="M24 42 L22 47 L26 47 Z" fill="#ef4444" ${st}/>`,
};

export function petSVG(kind, color) {
  const body = PET_BODY[kind] || PET_BODY.hoki;
  const palette = { hoki: '#fb923c', cepat: '#4ade80', dagang: '#a78bfa', ramah: '#f9a8d4', setia: '#fbbf24' };
  return wrap(`${body(palette[kind] || '#fb923c')}${color ? `<circle cx="42" cy="8" r="4" fill="${color}" ${st}/>` : ''}`);
}

// Ikon menu dan navigasi
const UI_ICONS = {
  kolam: `<path d="M6 30 C6 24 42 24 42 30 C42 40 6 40 6 30 Z" fill="#38bdf8" ${st}/><path d="M12 31 C16 29 18 33 22 31 S28 29 32 31" fill="none" stroke="#fff" stroke-width="2"/><path d="M14 22 C14 12 22 8 24 4 C26 8 34 12 34 22" fill="#4ade80" ${st}/><path d="M24 4 V22" ${st} fill="none"/>`,
  pasar: `<path d="M5 18 L9 6 H39 L43 18 Z" fill="#ef4444" ${st}/><path d="M5 18 C5 24 14 24 14 18 C14 24 24 24 24 18 C24 24 34 24 34 18 C34 24 43 24 43 18" fill="#fff" ${st}/><rect x="8" y="24" width="32" height="18" fill="#fbbf24" ${st}/><rect x="13" y="29" width="8" height="8" fill="#fff" stroke="${OUT}" stroke-width="1.4"/><rect x="27" y="29" width="8" height="8" fill="#a7f3d0" stroke="${OUT}" stroke-width="1.4"/>`,
  koleksi: `<path d="M8 6 H36 C38 6 40 8 40 10 V40 H12 C10 40 8 38 8 36 Z" fill="#a855f7" ${st}/><path d="M12 6 V40" ${st} fill="none"/><path d="M24 14 L26.5 20 L33 20.5 L28 24.5 L29.6 31 L24 27.5 L18.4 31 L20 24.5 L15 20.5 L21.5 20 Z" fill="#fde047" stroke="${OUT}" stroke-width="1.2"/>`,
  pet: `<ellipse cx="24" cy="32" rx="11" ry="9" fill="#fb923c" ${st}/><ellipse cx="10" cy="20" rx="4.5" ry="6" fill="#fb923c" ${st}/><ellipse cx="38" cy="20" rx="4.5" ry="6" fill="#fb923c" ${st}/><ellipse cx="18" cy="10" rx="4.5" ry="6" fill="#fb923c" ${st}/><ellipse cx="30" cy="10" rx="4.5" ry="6" fill="#fb923c" ${st}/>`,
  fitur: `<rect x="6" y="6" width="16" height="16" rx="4" fill="#38bdf8" ${st}/><rect x="26" y="6" width="16" height="16" rx="4" fill="#fbbf24" ${st}/><rect x="6" y="26" width="16" height="16" rx="4" fill="#4ade80" ${st}/><rect x="26" y="26" width="16" height="16" rx="4" fill="#f472b6" ${st}/>`,
  menu: `<rect x="6" y="9" width="36" height="6" rx="3" fill="#e5e7eb" ${st}/><rect x="6" y="21" width="36" height="6" rx="3" fill="#e5e7eb" ${st}/><rect x="6" y="33" width="36" height="6" rx="3" fill="#e5e7eb" ${st}/>`,

  kandang: `<path d="M5 20 L24 5 L43 20 Z" fill="#ef4444" ${st}/><rect x="8" y="20" width="32" height="22" fill="#fff6d1" ${st}/><path d="M16 22 V42 M24 22 V42 M32 22 V42" ${st} fill="none"/><path d="M8 32 H40" stroke="#c98a4a" stroke-width="3"/>`,
  toko: `<path d="M5 18 L9 6 H39 L43 18 Z" fill="#ef4444" ${st}/><path d="M5 18 C5 24 14 24 14 18 C14 24 24 24 24 18 C24 24 34 24 34 18 C34 24 43 24 43 18" fill="#fff" ${st}/><rect x="9" y="24" width="30" height="18" fill="#ffe9bb" ${st}/><rect x="20" y="30" width="9" height="12" fill="#a8693a" ${st}/>`,
  misi: `<circle cx="24" cy="24" r="18" fill="#fff" ${st}/><circle cx="24" cy="24" r="12" fill="#ef4444" ${st}/><circle cx="24" cy="24" r="6" fill="#fff" ${st}/><circle cx="24" cy="24" r="2.2" fill="#ef4444"/>`,
  langganan: `<path d="M24 42 C6 30 6 14 16 12 C20 11 23 14 24 16 C25 14 28 11 32 12 C42 14 42 30 24 42 Z" fill="#fb7185" ${st}/><path d="M14 18 q3 -3 6 -1" fill="none" stroke="#fff" stroke-width="2.4"/>`,
  hewan: `<ellipse cx="24" cy="30" rx="15" ry="11" fill="#f59e0b" ${st}/><circle cx="36" cy="20" r="8" fill="#f59e0b" ${st}/><circle cx="38" cy="18" r="1.8" fill="${OUT}"/><path d="M43 21 L48 23 L43 25" fill="#ef4444" ${st}/><path d="M18 40 V45 M28 40 V45" ${st} fill="none"/>`,
  bintang: `<path d="M24 4 L30 18 L45 19 L33.5 29 L37 44 L24 36 L11 44 L14.5 29 L3 19 L18 18 Z" fill="#fde047" ${st}/>`,
  skill: `<path d="M24 44 V22" ${st} fill="none"/><path d="M24 26 Q8 24 8 8 Q24 8 24 26 Z M24 32 Q40 30 40 14 Q24 14 24 32 Z" fill="#4ade80" ${st}/>`,
  upgrade: `<path d="M24 4 L40 22 H30 V42 H18 V22 H8 Z" fill="#38bdf8" ${st}/>`,
  ramuan: `<path d="M18 6 H30 V16 L40 36 Q42 44 34 44 H14 Q6 44 8 36 L18 16 Z" fill="#c084fc" ${st}/><path d="M12 32 H36" stroke="#fff" stroke-width="3"/><circle cx="20" cy="38" r="2.4" fill="#fff"/><circle cx="29" cy="35" r="1.8" fill="#fff"/>`,
  karyawan: `<circle cx="17" cy="16" r="7" fill="#fcd9b6" ${st}/><path d="M4 42 Q4 26 17 26 Q30 26 30 42 Z" fill="#3b82f6" ${st}/><circle cx="33" cy="20" r="6" fill="#fcd9b6" ${st}/><path d="M24 42 Q24 30 33 30 Q44 30 44 42 Z" fill="#10b981" ${st}/>`,
  bank: `<path d="M4 18 L24 5 L44 18 Z" fill="#fde047" ${st}/><rect x="9" y="20" width="6" height="18" fill="#fff" ${st}/><rect x="21" y="20" width="6" height="18" fill="#fff" ${st}/><rect x="33" y="20" width="6" height="18" fill="#fff" ${st}/><rect x="5" y="38" width="38" height="6" rx="2" fill="#fde047" ${st}/>`,
  investasi: `<rect x="6" y="28" width="9" height="14" fill="#4ade80" ${st}/><rect x="19" y="18" width="9" height="24" fill="#38bdf8" ${st}/><rect x="32" y="8" width="9" height="34" fill="#f472b6" ${st}/>`,
  aturan: `<rect x="8" y="8" width="32" height="32" rx="6" fill="#fde68a" ${st}/><path d="M14 18 H34 M14 26 H34 M14 34 H26" ${st} fill="none"/><circle cx="32" cy="34" r="4" fill="#ef4444" ${st}/>`,
  laporan: `<rect x="9" y="5" width="30" height="38" rx="4" fill="#fff" ${st}/><path d="M15 16 H33 M15 24 H33 M15 32 H26" ${st} fill="none"/>`,
  cerita: `<path d="M5 10 Q15 6 24 12 Q33 6 43 10 V38 Q33 34 24 40 Q15 34 5 38 Z" fill="#fff6d1" ${st}/><path d="M24 12 V40" ${st} fill="none"/><path d="M11 18 Q16 16 20 19 M11 25 Q16 23 20 26 M28 19 Q32 16 37 18 M28 26 Q32 23 37 25" fill="none" stroke="${OUT}" stroke-width="1.6"/>`,
  pengaturan: `<circle cx="24" cy="24" r="8" fill="#e5e7eb" ${st}/><path d="M24 4 V10 M24 38 V44 M4 24 H10 M38 24 H44 M10 10 L14 14 M34 34 L38 38 M38 10 L34 14 M10 38 L14 34" ${st} fill="none"/><circle cx="24" cy="24" r="14" fill="none" ${st}/>`,
  peta: `<path d="M5 12 L17 8 L31 12 L43 8 V38 L31 42 L17 38 L5 42 Z" fill="#a7f3d0" ${st}/><path d="M17 8 V38 M31 12 V42" ${st} fill="none"/><circle cx="24" cy="22" r="4" fill="#ef4444" ${st}/>`,
  coin: `<circle cx="24" cy="24" r="18" fill="#fbbf24" ${st}/><circle cx="24" cy="24" r="12" fill="none" stroke="#b45309" stroke-width="2"/><path d="M24 15 V33 M19 19 C19 15 29 15 29 20 C29 25 19 23 19 28 C19 33 29 33 29 29" fill="none" stroke="#b45309" stroke-width="2.2"/>`,
};
export const uiIconSVG = (name) => wrap(UI_ICONS[name] || UI_ICONS.menu);

// Staf (karyawan) untuk adegan toko dan daftar karyawan
const STAFF_BODY = {
  kasir: { shirt: '#3b82f6', hat: null, extra: `<rect x="30" y="30" width="12" height="9" rx="2" fill="#e5e7eb" ${st}/>` },
  pramuniaga: { shirt: '#10b981', hat: null, extra: `<path d="M14 30 L8 24" ${st} fill="none"/>` },
  penjaga: { shirt: '#f59e0b', hat: null, extra: `<rect x="31" y="28" width="9" height="12" fill="#fff" ${st}/>` },
  satpam: { shirt: '#1e3a8a', hat: '#111827', extra: `<rect x="30" y="29" width="3" height="12" fill="#6b7280" ${st}/>` },
  badut: { shirt: '#ef4444', hat: '#a855f7', extra: `<circle cx="24" cy="21" r="3" fill="#ef4444" ${st}/>` },
  petani: { shirt: '#65a30d', hat: '#fbbf24', extra: `<path d="M31 40 L38 28" ${st} fill="none"/>` },
  peramal: { shirt: '#7c3aed', hat: '#4c1d95', extra: `<circle cx="33" cy="34" r="4" fill="#a5f3fc" ${st}/>` },
  promotor: { shirt: '#f97316', hat: '#fde047', extra: `<path d="M31 28 L40 24 L40 34 Z" fill="#fff" ${st}/>` },
  pedagang: { shirt: '#0f766e', hat: null, extra: `<rect x="29" y="30" width="11" height="9" rx="1" fill="#fde68a" ${st}/>` },
  saudagar: { shirt: '#111827', hat: '#b45309', extra: `<path d="M24 36 l3 -3 l3 3 l-3 4 z" fill="#67e8f9" ${st}/>` },
  perawat: { shirt: '#f9fafb', hat: '#f9fafb', extra: `<path d="M22 31 H26 M24 29 V33" stroke="#ef4444" stroke-width="2.2"/>` },
};
export function staffSVG(id) {
  const d = STAFF_BODY[id] || STAFF_BODY.kasir;
  return wrap(`
    <rect x="14" y="26" width="20" height="16" rx="5" fill="${d.shirt}" ${st}/>
    <circle cx="24" cy="17" r="9" fill="#fcd9b6" ${st}/>
    ${d.hat ? `<path d="M14 15 C14 6 34 6 34 15 Z" fill="${d.hat}" ${st}/>` : '<path d="M15 14 C16 6 32 6 33 14 C28 10 20 10 15 14 Z" fill="#4b2e1a" stroke="#3b2a1c" stroke-width="1.4"/>'}
    <circle cx="20.5" cy="18" r="1.4" fill="${OUT}"/><circle cx="27.5" cy="18" r="1.4" fill="${OUT}"/>
    <path d="M21 22 C23 24 25 24 27 22" fill="none" ${st}/>
    ${d.extra}`);
}

export const svgUri = (svg) => `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

export function svgEl(svg, size = 36, cls = '') {
  const s = document.createElement('span');
  s.className = `svg-ico ${cls}`.trim();
  s.style.cssText = `display:inline-block;width:${size}px;height:${size}px;line-height:0;flex:0 0 auto`;
  s.innerHTML = svg.replace('width="48" height="48"', 'width="100%" height="100%"');
  return s;
}
