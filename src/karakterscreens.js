// Layar Karakter: menggantikan layar Skill lama dengan 3 tab: Skill (3 jalur), Perlengkapan, dan Pet.
// Layar lama (skill pohon + atribut + perk) diganti saat modul ini dimuat.
import { UI, h, rp } from './ui.js';
import { spriteEl } from './aset.js';
import { SKILL_ALL, getSkill } from './core/catalog.js';
import * as gear from './core/gear.js';

const P = UI.prototype;

// Jalur skill: 15 skill pohon lama dikelompokkan jadi 3. Skill yang tidak disebut masuk Pengelola.
const PEDAGANG = ['juragan', 'akuntan', 'ramah', 'viral', 'toko_ramai'];
const PETERNAK = ['breeder', 'kandang_besar', 'slot_pet', 'kandang_pet', 'pet_kuat'];
function jalur() {
  const tree = SKILL_ALL.filter((s) => !s.attr).map((s) => s.id);
  const ped = PEDAGANG.filter((id) => tree.includes(id));
  const pet = PETERNAK.filter((id) => tree.includes(id));
  const rest = tree.filter((id) => !ped.includes(id) && !pet.includes(id));
  return [
    { id: 'pedagang', name: 'Pedagang', icon: '🛒', desc: 'Toko, reputasi, pemasaran', skills: ped },
    { id: 'peternak', name: 'Peternak', icon: '🌱', desc: 'Breeding, kandang, pet', skills: pet },
    { id: 'pengelola', name: 'Pengelola', icon: '📋', desc: 'Tim, keamanan, pasar', skills: rest },
  ];
}

const dot = (color) => h('i', { style: `display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};border:1px solid #3b2a1c;margin-right:4px;vertical-align:middle` });

function gearIcon(e, g, size) {
  const el = spriteEl(g.sprite, size);
  if (!el) return h('span', { style: `font-size:${Math.round(size * 0.7)}px;line-height:1` }, gear.getSlot(g.slot).icon);
  const d = gear.DYES[(gear.ensureGear(e).dye[g.id]) || 0];
  if (d.css) el.style.filter = d.css;
  return el;
}

function skillTab(ui) {
  const e = ui.e;
  const out = [];
  out.push(h('div', { class: 'card hero' },
    h('div', { class: 'card-top' }, h('b', {}, `Poin skill ${e.skillPointsFree()}`), h('span', { class: 'badge' }, `terpakai ${e.skillPointsSpent()}`)),
    h('div', { class: 'sub' }, 'Poin dari bintang toko, level toko, hari berjalan, misi, dan cerita. Perk tidak lagi dibeli dengan poin: kini datang dari Perlengkapan dan Pet.'),
    h('button', { class: 'btn small secondary', onClick: () => ui.ask('Reset semua skill? Poin kembali penuh.', () => ui.act(() => e.resetSkills(), 'Skill direset', 'ok'), { yes: 'Reset', danger: true }) }, 'Reset skill')));
  for (const j of jalur()) {
    const icon = spriteEl(`jalur_${j.id}`, 44);
    out.push(h('div', { class: 'card' },
      h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px;align-items:center' },
        icon || h('span', { style: 'font-size:30px' }, j.icon),
        h('div', { class: 'grow' }, h('b', {}, `Jalur ${j.name}`), h('div', { class: 'sub' }, j.desc))),
      ...j.skills.map((id) => {
        const sk = getSkill(id);
        const rank = e.skillRank(id);
        const why = e.canLearn(id);
        return h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px;align-items:center;margin-top:6px' },
          h('div', { class: 'grow' }, h('b', {}, `${sk.name} ${rank}/${sk.max}`), h('div', { class: 'sub' }, sk.desc || ''), why && rank < sk.max ? h('div', { class: 'sub bad' }, why) : null),
          h('button', { class: 'btn small', disabled: !!why, onClick: () => ui.act(() => e.learnSkill(id), `${sk.name} naik`, 'upgrade') }, rank >= sk.max ? 'Maks' : `+1 · ${e.skillCostNext(id)}`));
      })));
  }
  return out;
}

function gearTab(ui) {
  const e = ui.e;
  const g = gear.ensureGear(e);
  const bal = e.state.ledger.balance;
  const out = [];
  // Bahan upgrade
  out.push(h('div', { class: 'card' },
    h('b', {}, 'Bahan upgrade'),
    h('div', { class: 'row', style: 'gap:8px' }, ...gear.MATS.map((m) => h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:6px;align-items:center' },
      spriteEl(m.sprite, 30) || h('span', {}, m.icon),
      h('b', {}, `${m.name} ${g.mats[m.id] || 0}`),
      h('button', { class: 'btn small secondary', disabled: bal < m.price * 5, onClick: () => ui.act(() => gear.buyMat(e, m.id, 5), `5 ${m.name} dibeli`, 'coin') }, `+5 · ${rp(m.price * 5)}`)))),
    h('div', { class: 'sub' }, 'Bahan juga dibeli di sini. Naik dari level N ke N+1 butuh N bahan dan uang.')));
  // Ringkasan perk aktif
  const active = gear.SLOTS.map((s) => g.equipped[s.id]).filter(Boolean).map((id) => gear.getGear(id));
  out.push(h('div', { class: 'card hero' }, h('b', {}, 'Perk aktif dari perlengkapan'),
    ...(active.length ? active.map((it) => h('div', { class: 'sub' }, `• ${gear.perkOf(it).name} +${gear.gearRank(it, g.owned[it.id])} (${it.name} Lv ${g.owned[it.id]})`)) : [h('div', { class: 'sub' }, 'Belum ada yang dipakai.')])));
  // Pilih slot
  ui.karSlot ||= 'topi';
  out.push(ui.chips(gear.SLOTS.map((s) => ({ id: s.id, label: `${s.icon} ${s.name}` })), ui.karSlot, (id) => { ui.karSlot = id; ui.rerender(); }));
  const slot = gear.getSlot(ui.karSlot);
  for (const it of gear.GEAR.filter((x) => x.slot === slot.id)) {
    const lv = g.owned[it.id] || 0;
    const perk = gear.perkOf(it);
    const eq = g.equipped[slot.id] === it.id;
    const rows = [];
    rows.push(h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px;align-items:center' },
      gearIcon(e, it, 56),
      h('div', { class: 'grow' },
        h('b', {}, it.name, eq ? h('span', { class: 'badge good', style: 'margin-left:6px' }, 'dipakai') : null),
        h('div', { class: 'sub' }, `${perk.name}: ${perk.desc}`),
        lv ? h('div', { class: 'sub good' }, `Lv ${lv}/${gear.MAX_GEAR_LV} · efek rank ${gear.gearRank(it, lv)}`) : h('div', { class: 'sub' }, `Harga ${rp(it.price)}`))));
    if (!lv) {
      rows.push(h('button', { class: 'btn small', disabled: bal < it.price, onClick: () => ui.act(() => gear.buyGear(e, it.id), `${it.name} dibeli`, 'coin') }, `Beli ${rp(it.price)}`));
    } else {
      const up = lv < gear.MAX_GEAR_LV ? gear.upgradeCost(it, lv) : null;
      const have = g.mats[slot.mat] || 0;
      rows.push(h('div', { class: 'row', style: 'gap:8px' },
        h('button', { class: `btn small ${eq ? 'secondary' : ''}`, onClick: () => ui.act(() => (eq ? gear.unequipGear(e, slot.id) : gear.equipGear(e, it.id)), eq ? 'Dilepas' : `${it.name} dipakai`, 'ok') }, eq ? 'Lepas' : 'Pakai'),
        h('button', { class: 'btn small', disabled: !up || bal < up.coin || have < up.mat, onClick: () => ui.act(() => gear.upgradeGear(e, it.id), `${it.name} naik level`, 'upgrade') },
          up ? `Upgrade Lv ${lv + 1} · ${rp(up.coin)} + ${up.mat} ${slot.mat}` : 'Level maksimum')));
      rows.push(h('div', { class: 'chips wrap' }, ...gear.DYES.map((d, i) => h('button', {
        class: `chip${(g.dye[it.id] || 0) === i ? ' on' : ''}`,
        disabled: bal < gear.DYE_COST && (g.dye[it.id] || 0) !== i,
        onClick: () => ui.act(() => gear.setDye(e, it.id, i), i ? `Dicelup ${d.name}` : 'Warna asli', 'ok'),
      }, dot(d.dot), d.name))));
      rows.push(h('div', { class: 'sub' }, `Celup warna ${rp(gear.DYE_COST)} (hanya tampilan).`));
    }
    out.push(h('div', { class: `card${eq ? ' hero' : ''}` }, ...rows));
  }
  return out;
}

function petTab(ui) {
  const e = ui.e;
  const pets = e.state.pets;
  const out = [];
  out.push(h('div', { class: 'card hero' }, h('b', {}, `Slot pet ${pets.equipped.length}/${e.petSlots()}`),
    h('div', { class: 'sub' }, 'Tiap jenis pet punya efek unik sendiri. Kelangkaan dan level pet (Lv 10 dan 20 = evolusi) menaikkan rank efeknya.'),
    h('button', { class: 'btn small', onClick: () => ui.openPet() }, 'Buka Rumah Pet')));
  const list = pets.equipped.map((id) => pets.owned.find((p) => p.id === id)).filter(Boolean);
  if (!list.length) out.push(h('div', { class: 'card' }, 'Belum ada pet dipasang.'));
  for (const p of list) {
    const f = gear.petEffect(e, p);
    out.push(h('div', { class: 'card' }, h('b', {}, `Lv ${p.lv || 1} · ${p.kind}`), h('div', { class: 'sub good' }, f ? f.text : '')));
  }
  return out;
}

function openKarakter() {
  this.karTab ||= 'skill';
  this.openSheet('Karakter', () => {
    gear.applyGear(this.e);
    const out = [this.chips([
      { id: 'skill', label: '🌳 Skill' },
      { id: 'gear', label: '🎩 Perlengkapan' },
      { id: 'pet', label: '🐾 Pet' },
    ], this.karTab, (id) => { this.karTab = id; this.rerender(); })];
    if (this.karTab === 'gear') return out.concat(gearTab(this));
    if (this.karTab === 'pet') return out.concat(petTab(this));
    return out.concat(skillTab(this));
  });
}

P.openKarakter = openKarakter;
// Ganti layar skill lama (cari metode yang memanggil learnSkill) dengan layar Karakter.
const cand = Object.getOwnPropertyNames(P).filter((n) => typeof P[n] === 'function' && n !== 'openKarakter' && P[n].toString().includes('learnSkill'));
const name = cand.find((n) => /skill/i.test(n)) || cand[0];
if (name) P[name] = function openKarakterReplacement() { return openKarakter.call(this); };
else if (typeof console !== 'undefined') console.warn('layar skill lama tidak ditemukan; gunakan UI.openKarakter()');
