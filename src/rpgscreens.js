// Layar Petualangan: tab tambahan di rumah Pet. Dipasang dengan membungkus UI.prototype.openPet
// (dari gachascreens.js) supaya tidak perlu menulis ulang layar Pet.
import { UI, h, rp } from './ui.js';
import './gachascreens.js';
import * as rpg from './core/rpg.js';

const P = UI.prototype;

function rpgNodes(ui) {
  const e = ui.e;
  const r = rpg.rpgOf(e);
  const power = rpg.partyPower(e);
  const out = [];
  out.push(h('div', { class: 'card hero' },
    h('div', { class: 'card-top' }, h('b', {}, `Energi ${r.energy}/${rpg.maxEnergy(e)}`), h('span', { class: 'badge' }, `Kekuatan party ${power}`)),
    h('div', { class: 'sub' }, 'Party = pet yang dipasang. Tiap petualangan memakai 1 energi; energi pulih +2 tiap hari. Pet naik level dari petualangan dan jadi lebih kuat.')));
  if (power <= 0) out.push(h('div', { class: 'card warn' }, h('b', {}, 'Belum ada pet dipasang'), h('div', { class: 'sub' }, 'Buka tab Inventori dan pasang pet dulu.')));

  if (r.run) {
    const run = r.run;
    const z = rpg.getZone(run.zone);
    const E = rpg.enemyPower(z, run.floor);
    const boss = run.floor === z.floors;
    const pc = (a) => Math.round(rpg.winChance(power, E, a) * 100);
    const act = (a) => () => ui.act(() => rpg.step(e, a), null, a === 'mundur' ? 'coin' : 'ok');
    out.push(h('div', { class: `card${boss ? ' warn' : ''}` },
      h('div', { class: 'card-top' }, h('b', {}, `${z.icon} ${z.name}`), h('span', { class: 'badge' }, `Lantai ${run.floor}/${z.floors}`)),
      h('div', { class: 'sub' }, `${boss ? `BOS ${z.boss}` : 'Musuh'} kekuatan ${E} · party ${power}`),
      h('div', { class: 'sub' }, `HP ${Math.max(0, run.hp)}/100`),
      h('div', { class: 'meter' }, h('i', { style: `width:${Math.max(0, Math.min(100, run.hp))}%` })),
      h('div', { class: 'row', style: 'gap:8px;margin-top:6px' },
        h('button', { class: 'btn small grow', onClick: act('serang') }, `Serang ${pc('serang')}%`),
        h('button', { class: 'btn small secondary grow', onClick: act('hati') }, `Hati-hati ${pc('hati')}%`)),
      h('button', { class: 'btn small secondary', onClick: act('mundur') }, `Mundur dan bawa pulang (${run.loot.length} hadiah)`),
      h('div', { class: 'sub' }, 'Serang: luka berat bila kalah. Hati-hati: peluang lebih rendah, luka lebih ringan. Kalah total hanya membawa separuh hadiah.')));
    if (run.log.length) out.push(h('div', { class: 'card' }, h('b', {}, 'Catatan'), ...run.log.slice(-6).map((t) => h('div', { class: 'sub' }, t))));
    return out;
  }

  if (r.last) {
    const l = r.last;
    const z = rpg.getZone(l.zone);
    const title = l.reason === 'clear' ? `Tamat! ${z.name}` : l.reason === 'mundur' ? `Mundur dari ${z.name}` : `Kalah di ${z.name}`;
    out.push(h('div', { class: `card${l.reason === 'clear' ? ' hero' : ''}` },
      h('b', {}, title),
      ...l.loot.map((x) => h('div', { class: 'sub' }, `• ${rpg.lootText(x)}`)),
      l.lost ? h('div', { class: 'sub bad' }, `${l.lost} hadiah hilang karena kalah`) : null,
      l.converted ? h('div', { class: 'sub' }, `${l.converted} hewan dijual karena gudang penuh`) : null,
      h('div', { class: 'sub good' }, `Total uang ${rp(l.coins)} · XP pet +${l.xp}${l.ups ? ` · ${l.ups} naik level` : ''}`),
      h('button', { class: 'btn small secondary', onClick: () => ui.act(() => { r.last = null; }, null, null) }, 'Tutup')));
  }

  for (const z of rpg.ZONES) {
    const done = r.clears[z.id] || 0;
    out.push(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, `${z.icon} ${z.name}`), h('span', { class: 'badge' }, `${done}/${z.floors} lantai`)),
      h('div', { class: 'sub' }, z.desc),
      h('div', { class: 'sub' }, `Musuh kekuatan ${rpg.enemyPower(z, 1)} sampai ${rpg.enemyPower(z, z.floors)} (bos ${z.boss})`),
      h('button', { class: 'btn small', disabled: r.energy < 1 || power <= 0, onClick: () => ui.act(() => rpg.startRun(e, z.id), `Masuk ${z.name}`, 'ok') }, 'Mulai (1 energi)')));
  }
  return out;
}

const open0 = P.openPet;
P.openPet = function openPetWithRpg() {
  open0.call(this);
  const m = this.modal;
  if (!m) return;
  const render0 = m.render;
  m.render = () => {
    const nodes = [].concat(render0());
    const chips = nodes[0];
    if (chips && chips.classList && chips.classList.contains('chips')) {
      chips.append(h('button', { class: `chip${this.petTab === 'rpg' ? ' on' : ''}`, onClick: () => { this.petTab = 'rpg'; this.rerender(); } }, '⚔ Petualangan'));
    }
    if (this.petTab === 'rpg') return [chips, ...rpgNodes(this)].filter(Boolean);
    return nodes;
  };
  this.rerender();
};
