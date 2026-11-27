// Layar Pet dengan gacha 1x dan 10x, animasi buka telur, sorotan pet terbaik, dan opsi lewati animasi.
// Menggantikan UI.prototype.openPet dari farmscreens.js (modul ini selalu dimuat setelahnya).
import { UI, h, rp } from './ui.js';
import './farmscreens.js';
import {
  RARITIES, EGGS, PET_KINDS, rarityIdx, rarityWeights, petBuffValue, getPetKind, petExpandCost, petSellValue,
} from './core/farm.js';
import { eggSVG, svgEl } from './art.svg.js';
import { audio } from './audio.js';
import { petArt } from './pets.js';

const P = UI.prototype;

const readSkip = () => { try { return localStorage.getItem('fajmuls:gachaSkip') === '1'; } catch { return false; } };
P.gachaSkip = readSkip();

const pct = (x) => (x >= 0.1 ? `${Math.round(x * 100)}%` : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`);
const rarTag = (r) => h('span', { class: 'rar', style: `color:${r.color};border-color:${r.color}` }, r.name);
function oddsBar(luck) {
  const ws = rarityWeights(luck);
  return h('div', { class: 'odds' }, RARITIES.map((r, i) => h('div', { class: 'odd', title: `${r.name} ${pct(ws[i])}` },
    h('i', { style: `background:${r.color}` }), h('span', {}, `${r.name.slice(0, 3)} ${pct(ws[i])}`))));
}

if (typeof document !== 'undefined' && !document.getElementById('gacha-css')) {
  const s = document.createElement('style');
  s.id = 'gacha-css';
  s.textContent = `
.gacha{position:fixed;inset:0;z-index:9999;background:rgba(30,20,12,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:14px}
.gacha .gtitle{color:#ffe6a8;margin:0;font-size:20px}
.gacha-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(96vw,470px)}
.gacha-grid.one{grid-template-columns:1fr;width:min(60vw,190px)}
.gcell{background:#fff6d1;border:3px solid #3b2a1c;border-radius:14px;padding:6px 2px;text-align:center;min-height:98px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;overflow:hidden}
.gcell small{font-size:10px;font-weight:800;color:#3b2a1c}
.gcell .sold{color:#8a4b08}
.gcell .rn{font-size:11px}
.gcell.shake .svg-ico{animation:gshake .42s infinite}
.gcell.pop{animation:gpop .5s ease-out}
.gcell.hi{border-color:var(--rc);box-shadow:0 0 14px 3px var(--rc)}
.gcell.best{animation:gpop .5s ease-out,gglow 1s infinite alternate;transform:scale(1.06)}
@keyframes gshake{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
@keyframes gpop{0%{transform:scale(.4)}60%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes gglow{from{box-shadow:0 0 8px 2px var(--rc)}to{box-shadow:0 0 24px 9px var(--rc)}}
.gacha .gsum{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:min(96vw,470px);color:#fff;font-weight:700;font-size:12px}
`;
  document.head.append(s);
}

// Menetaskan n telur sekaligus lewat engine. Berhenti bila kas atau tempat habis; hasil sebagian tetap dikembalikan.
P.hatchMany = function hatchMany(eggId, n) {
  const out = [];
  let err = null;
  for (let i = 0; i < n; i++) {
    try { out.push(this.e.hatch(eggId)); } catch (ex) { err = ex; break; }
  }
  if (!out.length && err) throw err;
  return { pets: out, err };
};

// Animasi buka telur: telur bergoyang, retak, lalu pet muncul satu per satu. Pet terbaik disorot.
P.playGacha = function playGacha(pets, egg, res = {}) {
  const n = pets.length;
  const timers = [];
  const revealed = new Array(n).fill(false);
  const grid = h('div', { class: `gacha-grid${n === 1 ? ' one' : ''}` });
  const title = h('h3', { class: 'gtitle' }, 'Menetas...');
  const sum = h('div', { class: 'gsum' });
  const btnSkip = h('button', { class: 'btn small secondary' }, 'Lewati');
  const btnClose = h('button', { class: 'btn', style: 'display:none' }, 'Tutup');
  const ov = h('div', { class: 'gacha' }, title, grid, sum, h('div', { class: 'row', style: 'justify-content:center;gap:10px' }, btnSkip, btnClose));
  const size = n === 1 ? 84 : 46;
  const cells = pets.map(() => {
    const c = h('div', { class: 'gcell shake' });
    c.append(svgEl(eggSVG(egg), size));
    grid.append(c);
    return c;
  });
  const best = pets.reduce((b, p, i) => (rarityIdx(p.rarity) > rarityIdx(pets[b].rarity) ? i : b), 0);
  const reveal = (i, quiet) => {
    if (revealed[i]) return;
    revealed[i] = true;
    const p = pets[i];
    const ri = rarityIdx(p.rarity);
    const r = RARITIES[ri];
    const c = cells[i];
    c.className = `gcell pop${ri >= 2 ? ' hi' : ''}${i === best && n > 1 && ri >= 1 ? ' best' : ''}`;
    c.style.setProperty('--rc', r.color);
    c.replaceChildren(
      svgEl(petArt(p.kind, r.color), size),
      h('b', { class: 'rn', style: `color:${r.color}` }, r.name),
      h('small', {}, getPetKind(p.kind).name),
      p.autoSold ? h('small', { class: 'sold' }, `terjual ${rp(p.autoSold)}`) : null);
    if (!quiet) audio.play(ri >= 3 ? 'star' : ri >= 1 ? 'upgrade' : 'ok');
  };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    timers.forEach(clearTimeout);
    pets.forEach((_, i) => reveal(i, true));
    title.textContent = n === 1 ? 'Pet baru!' : `Hasil menetas ${n}x`;
    const counts = {};
    for (const p of pets) counts[p.rarity] = (counts[p.rarity] || 0) + 1;
    sum.replaceChildren(
      ...RARITIES.filter((r) => counts[r.id]).map((r) => h('span', { class: 'rar', style: `color:${r.color};border-color:${r.color};background:#fff` }, `${r.name} ×${counts[r.id]}`)),
      ...(pets.some((p) => p.autoSold) ? [h('span', {}, `Terjual otomatis ${rp(pets.reduce((s, p) => s + (p.autoSold || 0), 0))}`)] : []),
      ...(res.err ? [h('span', { style: 'color:#ffd0d0' }, `Berhenti di ${n}: ${res.err.message}`)] : []));
    btnSkip.style.display = 'none';
    btnClose.style.display = '';
  };
  const close = () => {
    timers.forEach(clearTimeout);
    ov.remove();
    if (this.modal) this.rerender();
  };
  btnSkip.onclick = finish;
  btnClose.onclick = close;
  document.body.append(ov);
  if (this.gachaSkip) { finish(); return; }
  pets.forEach((_, i) => timers.push(setTimeout(() => reveal(i, false), 1500 + i * 260)));
  timers.push(setTimeout(finish, 1500 + n * 260 + 500));
};

// ---------- Layar Pet ----------
P.openPet = function openPet() {
  this.petTab ||= 'inv';
  this.openSheet('Pet', () => {
    const e = this.e;
    const pets = e.state.pets;
    const bal = e.state.ledger.balance;
    const book = pets.book || {};
    const bookTotal = PET_KINDS.length * RARITIES.length;
    const bookHave = PET_KINDS.reduce((n, k) => n + RARITIES.filter((r) => book[k.id]?.[r.id]).length, 0);
    const out = [this.chips([
      { id: 'inv', label: `🎒 Inventori (${pets.owned.length}/${e.petMax()})` },
      { id: 'telur', label: '🥚 Telur' },
      { id: 'buku', label: `📖 Buku ${bookHave}/${bookTotal}` },
      { id: 'aturan', label: '⚙ Aturan' },
    ], this.petTab, (id) => { this.petTab = id; this.rerender(); })];

    if (this.petTab === 'telur') {
      const free = e.petMax() - pets.owned.length;
      out.push(h('label', { class: 'row card' },
        h('input', { type: 'checkbox', checked: !!this.gachaSkip, onChange: (ev) => { this.gachaSkip = ev.target.checked; try { localStorage.setItem('fajmuls:gachaSkip', this.gachaSkip ? '1' : '0'); } catch { /* abaikan */ } } }),
        h('span', {}, 'Lewati animasi buka telur')));
      if (this.lastHatch) {
        const p = this.lastHatch;
        const r = RARITIES[rarityIdx(p.rarity)];
        out.push(h('div', { class: 'card hero hatched', style: `border-color:${r.color}` },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petArt(p.kind, r.color), 56, 'bounce'),
            h('div', { class: 'grow' }, h('b', {}, `Terakhir: ${getPetKind(p.kind).name}`), p.autoSold ? h('div', { class: 'sub good' }, `Otomatis terjual ${rp(p.autoSold)}`) : null, h('div', {}, rarTag(r)), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p)))))));
      }
      for (const egg of EGGS) {
        const btn = (n) => h('button', {
          class: `btn small${n > 1 ? '' : ' secondary'}`,
          disabled: bal < egg.price * n || free < n,
          onClick: () => {
            let res = null;
            this.act(() => { res = this.hatchMany(egg.id, n); return res.pets; }, null, null);
            if (res && res.pets.length) { this.lastHatch = res.pets[res.pets.length - 1]; this.playGacha(res.pets, egg, res); }
          },
        }, `${n}x · ${rp(egg.price * n)}`);
        out.push(h('div', { class: 'card' },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(eggSVG(egg), 40),
            h('div', { class: 'grow' }, h('b', {}, egg.name), h('div', { class: 'sub' }, `Isi: salah satu dari ${PET_KINDS.length} jenis pet`))),
          h('div', { class: 'row', style: 'gap:8px' }, btn(1), btn(10)),
          oddsBar(egg.luck)));
      }
      if (free < 10) out.push(h('div', { class: 'sub bad' }, free <= 0 ? 'Inventori penuh. Perluas di tab Aturan atau jual pet lama.' : `Sisa tempat ${free}. Tetas 10x butuh 10 slot kosong; perluas atau jual pet lama.`));
      return out;
    }

    if (this.petTab === 'buku') {
      out.push(h('div', { class: 'card' }, h('b', {}, `Buku Koleksi Pet ${bookHave}/${bookTotal}`),
        h('div', { class: 'sub' }, 'Mencatat semua pet yang pernah kamu dapat, walau sudah dijual.')));
      for (const k of PET_KINDS) {
        out.push(h('div', { class: 'card' },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' }, svgEl(petArt(k.id, null), 30), h('b', {}, k.name)),
          h('div', { class: 'chips wrap' }, RARITIES.map((r) => {
            const n = book[k.id]?.[r.id] || 0;
            return h('span', { class: 'rar', style: n ? `color:${r.color};border-color:${r.color}` : 'opacity:.35' }, n ? `${r.name} ×${n}` : '???');
          }))));
      }
      return out;
    }

    if (this.petTab === 'aturan') {
      const pol = e.state.policy;
      out.push(h('div', { class: 'card' }, h('b', {}, 'Jual otomatis hasil gacha'),
        h('div', { class: 'sub' }, 'Pet dengan kelangkaan yang dicentang langsung dijual saat menetas (tetap tercatat di Buku Koleksi).'),
        ...RARITIES.slice(0, 5).map((r) => h('label', { class: 'row' },
          h('input', { type: 'checkbox', checked: !!pol.petAuto[r.id], onChange: (ev) => this.act(() => e.setPetAuto(r.id, ev.target.checked), 'Disimpan', null) }),
          h('span', { class: 'rar', style: `color:${r.color};border-color:${r.color}` }, r.name)))));
      const sel = h('select', { onChange: (ev) => this.act(() => e.setPetConfirm(ev.target.value), 'Disimpan', null) },
        [...RARITIES.map((r, i) => h('option', { value: i, selected: pol.petConfirm === i }, `${r.name} ke atas`)), h('option', { value: 7, selected: pol.petConfirm >= 7 }, 'Tidak pernah')]);
      out.push(h('div', { class: 'card' }, h('b', {}, 'Konfirmasi sebelum jual'), h('div', { class: 'sub' }, 'Minta konfirmasi saat menjual pet dengan kelangkaan ini atau lebih tinggi.'), sel));
      const n = pets.extra || 0;
      out.push(h('div', { class: 'card' }, h('b', {}, `Kandang pet ${pets.owned.length}/${e.petMax()}`),
        h('div', { class: 'sub' }, `Perluasan +20 slot (${n}/10).`),
        h('button', { class: 'btn small', disabled: n >= 10 || bal < petExpandCost(e), onClick: () => this.act(() => e.buyPetSpace(), 'Kandang pet diperluas', 'upgrade') }, n >= 10 ? 'Maksimal' : `Perluas ${rp(petExpandCost(e))}`)));
      return out;
    }

    const slots = e.petSlots();
    out.push(h('div', { class: 'card' },
      h('b', {}, `Slot pet terpakai ${pets.equipped.length}/${slots}`),
      h('div', { class: 'sub' }, 'Pet yang dipasang memberi buff. Pet yang dilepas dari slot tetap tersimpan di inventori; jual hanya bila kamu mau.')));
    if (!pets.owned.length) out.push(h('div', { class: 'card' }, 'Belum punya pet. Tetaskan telur di tab Telur.'));
    const spare = pets.owned.filter((p) => !pets.equipped.includes(p.id) && rarityIdx(p.rarity) <= 1);
    if (spare.length) {
      const val = spare.reduce((n, p) => n + petSellValue(p), 0);
      out.push(h('button', { class: 'btn secondary small', onClick: () => this.ask(`Jual ${spare.length} pet Common/Uncommon yang tidak dipasang?`, () => this.act(() => e.sellSparePets(1), (v) => `${v.n} pet terjual ${rp(v.total)}`, 'coin'), { yes: 'Jual' }) }, `Jual ${spare.length} pet biasa · ${rp(val)}`));
    }
    const sorted = pets.owned.slice().sort((a, b) => Number(pets.equipped.includes(b.id)) - Number(pets.equipped.includes(a.id)) || rarityIdx(b.rarity) - rarityIdx(a.rarity));
    for (const p of sorted) {
      const r = RARITIES[rarityIdx(p.rarity)];
      const on = pets.equipped.includes(p.id);
      out.push(h('div', { class: `card${on ? ' hero' : ''}`, style: `border-left:5px solid ${r.color}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petArt(p.kind, r.color), 44),
          h('div', { class: 'grow' }, h('b', {}, getPetKind(p.kind).name), h('div', {}, rarTag(r), on ? h('span', { class: 'badge good', style: 'margin-left:6px' }, 'dipasang') : null), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p))))),
        h('div', { class: 'row' },
          h('button', { class: `btn small ${on ? 'secondary' : ''}`, onClick: () => this.act(() => (on ? e.unequipPet(p.id) : e.equipPet(p.id)), on ? 'Pet disimpan di inventori' : 'Pet dipasang', 'ok') }, on ? 'Lepas dari slot' : 'Pasang'),
          h('button', { class: 'btn small secondary', onClick: () => { const go = () => this.act(() => e.sellPet(p.id), (v) => `Pet terjual ${rp(v)}`, 'coin'); if (rarityIdx(p.rarity) >= e.state.policy.petConfirm) this.ask('Pet ini langka. Yakin dijual? (tetap tercatat di Buku Koleksi)', go, { yes: 'Jual', danger: true }); else go(); } }, `Jual ${rp(petSellValue(p))}`))));
    }
    return out;
  });
};
