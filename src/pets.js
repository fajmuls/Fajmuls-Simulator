// Pet tambahan: 7 jenis baru (total 12) dengan gambar sendiri. Efek memakai 5 jenis buff yang sudah ada
// (luck, grow, value, patience, tip), jadi tidak ada aturan ekonomi baru yang perlu dikhawatirkan.
import { PET_KINDS } from './core/farm.js';
import { petSVG as basePetSVG } from './art.svg.js';

const OUT = '#3b2a1c';
const st = `stroke="${OUT}" stroke-width="1.8"`;
const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
const eye = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff" ${st}/><circle cx="${x + 0.4}" cy="${y + 0.4}" r="1.1" fill="${OUT}"/>`;

export const NEW_PET_KINDS = [
  { id: 'rubah', name: 'Rubah Beruntung', buff: 'luck', base: 0.13, text: (v) => `Peluang rarity +${Math.round(v * 100)}%` },
  { id: 'bintang', name: 'Bintang Hoki', buff: 'luck', base: 0.125, text: (v) => `Peluang rarity +${Math.round(v * 100)}%` },
  { id: 'panda', name: 'Panda Sabar', buff: 'patience', base: 0.055, text: (v) => `Pelanggan ${Math.round(v * 100)}% lebih sabar` },
  { id: 'naga', name: 'Naga Mini', buff: 'value', base: 0.022, text: (v) => `Harga jual +${Math.round(v * 100)}%` },
  { id: 'penguin', name: 'Penguin Dagang', buff: 'value', base: 0.021, text: (v) => `Harga jual +${Math.round(v * 100)}%` },
  { id: 'poni', name: 'Poni Ajaib', buff: 'grow', base: 0.042, text: (v) => `Tumbuh ${Math.round(v * 100)}% lebih cepat` },
  { id: 'kodok', name: 'Kodok Ramah', buff: 'tip', base: 0.032, text: (v) => `Tip pelayanan cepat +${Math.round(v * 100)}%` },
];
for (const k of NEW_PET_KINDS) if (!PET_KINDS.some((x) => x.id === k.id)) PET_KINDS.push(k);

const ART = {
  rubah: () => `
    <path d="M8 22 L10 4 L21 14 Z M40 22 L38 4 L27 14 Z" fill="#f97316" ${st}/>
    <path d="M24 43 L8 28 C7 14 41 14 40 28 Z" fill="#f97316" ${st}/>
    <path d="M24 43 L13 31 C19 37 29 37 35 31 Z" fill="#fff" ${st}/>
    <circle cx="17" cy="25" r="2.1" fill="${OUT}"/><circle cx="31" cy="25" r="2.1" fill="${OUT}"/>
    <circle cx="24" cy="36" r="2.2" fill="${OUT}"/>
    <path d="M5 40 C0 34 4 28 9 30 C8 34 8 38 5 40 Z" fill="#fb923c" ${st}/>`,
  bintang: () => `
    <path d="M24 3 L30 17 L45 18 L33.5 28 L37 43 L24 35 L11 43 L14.5 31 L3 18 L18 17 Z" fill="#fde047" ${st}/>
    <circle cx="20" cy="24" r="2" fill="${OUT}"/><circle cx="28" cy="24" r="2" fill="${OUT}"/>
    <path d="M20 29 Q24 33 28 29" fill="none" ${st}/>
    <circle cx="16" cy="28" r="2.4" fill="#fb7185" opacity=".6"/><circle cx="32" cy="28" r="2.4" fill="#fb7185" opacity=".6"/>`,
  panda: () => `
    <circle cx="11" cy="11" r="6" fill="#222" ${st}/><circle cx="37" cy="11" r="6" fill="#222" ${st}/>
    <circle cx="24" cy="26" r="16" fill="#fff" ${st}/>
    <ellipse cx="17" cy="24" rx="4.4" ry="5.6" fill="#222" transform="rotate(-20 17 24)"/><ellipse cx="31" cy="24" rx="4.4" ry="5.6" fill="#222" transform="rotate(20 31 24)"/>
    <circle cx="17.5" cy="24" r="1.5" fill="#fff"/><circle cx="30.5" cy="24" r="1.5" fill="#fff"/>
    <ellipse cx="24" cy="31" rx="3" ry="2.2" fill="#222"/>
    <path d="M21 35 Q24 38 27 35" fill="none" ${st}/>`,
  naga: () => `
    <path d="M12 18 L8 5 L19 12 Z M36 18 L40 5 L29 12 Z" fill="#fde047" ${st}/>
    <path d="M4 30 L13 21 L11 35 Z M44 30 L35 21 L37 35 Z" fill="#16a34a" ${st}/>
    <ellipse cx="24" cy="29" rx="14" ry="13" fill="#4ade80" ${st}/>
    <ellipse cx="24" cy="35" rx="8" ry="6" fill="#bbf7d0"/>
    ${eye(18, 25)}${eye(30, 25)}
    <circle cx="21" cy="34" r="1.1" fill="${OUT}"/><circle cx="27" cy="34" r="1.1" fill="${OUT}"/>
    <path d="M24 42 L22 47 L26 47 Z" fill="#ef4444" ${st}/>`,
  penguin: () => `
    <path d="M9 28 L3 37 L11 35 Z M39 28 L45 37 L37 35 Z" fill="#1e293b" ${st}/>
    <ellipse cx="24" cy="26" rx="14" ry="17" fill="#1e293b" ${st}/>
    <ellipse cx="24" cy="31" rx="9" ry="12" fill="#fff"/>
    ${eye(19, 18)}${eye(29, 18)}
    <path d="M21 22 L24 27 L27 22 Z" fill="#f59e0b" ${st}/>
    <path d="M17 43 L13 46 L22 46 Z M31 43 L27 46 L35 46 Z" fill="#f59e0b" ${st}/>
    <path d="M16 40 H32" stroke="#f43f5e" stroke-width="3"/>`,
  poni: () => `
    <path d="M24 1 L28 14 L20 14 Z" fill="#fde047" ${st}/>
    <path d="M10 19 L12 8 L20 14 Z M38 19 L36 8 L28 14 Z" fill="#f9a8d4" ${st}/>
    <ellipse cx="24" cy="29" rx="15" ry="14" fill="#fff" ${st}/>
    <path d="M10 20 Q3 30 9 40 Q8 29 15 23 Z" fill="#c084fc" ${st}/><path d="M38 20 Q45 30 39 40 Q40 29 33 23 Z" fill="#c084fc" ${st}/>
    <circle cx="18" cy="28" r="2.2" fill="${OUT}"/><circle cx="30" cy="28" r="2.2" fill="${OUT}"/>
    <circle cx="15" cy="34" r="2.6" fill="#fb7185" opacity=".6"/><circle cx="33" cy="34" r="2.6" fill="#fb7185" opacity=".6"/>
    <path d="M21 36 Q24 39 27 36" fill="none" ${st}/>`,
  kodok: () => `
    <circle cx="14" cy="13" r="7" fill="#4ade80" ${st}/><circle cx="34" cy="13" r="7" fill="#4ade80" ${st}/>
    <circle cx="14" cy="13" r="3.8" fill="#fff" ${st}/><circle cx="34" cy="13" r="3.8" fill="#fff" ${st}/>
    <circle cx="14.6" cy="13.6" r="1.6" fill="${OUT}"/><circle cx="34.6" cy="13.6" r="1.6" fill="${OUT}"/>
    <ellipse cx="24" cy="30" rx="18" ry="13" fill="#4ade80" ${st}/>
    <path d="M10 33 Q24 45 38 33" fill="none" ${st}/>
    <circle cx="13" cy="31" r="3" fill="#fb7185" opacity=".6"/><circle cx="35" cy="31" r="3" fill="#fb7185" opacity=".6"/>`,
};

export function petArt(kind, color) {
  if (ART[kind]) return wrap(`${ART[kind]()}${color ? `<circle cx="42" cy="8" r="4" fill="${color}" ${st}/>` : ''}`);
  return basePetSVG(kind, color);
}
