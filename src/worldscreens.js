// Layar "Dunia": cabang kota, ekspedisi karyawan, dan prestise (musim baru). Menambah metode ke UI.prototype.
import { UI, h, rp, rpShort } from './ui.js';
import { CITIES, DESTS, EXPED_DAYS, PUPS, getCity, getDest, pup, pupCost, PRESTIGE_MIN_STARS } from './core/world2.js';
import { RARITIES, getPetKind } from './core/farm.js';
import { getItem, getStaff } from './core/catalog.js';

const P = UI.prototype;
const CAT_NAME = { ikan: 'Ikan', burung: 'Burung', reptil: 'Reptil', kecil: 'Satwa Kecil' };

P.openDunia = function openDunia() {
  this.openSheet('Dunia', () => {
    const tab = this._duniaTab || 'kota';
    const setTab = (t) => { this._duniaTab = t; this.rerender(); };
    const out = [h('div', { class: 'row' }, ...[['kota', 'Kota'], ['ekspedisi', 'Ekspedisi'], ['prestise', 'Prestise']].map(([id, label]) =>
      h('button', { class: `btn small grow ${tab === id ? '' : 'secondary'}`, onClick: () => setTab(id) }, label)))];
    out.push(...(tab === 'kota' ? this._tabKota() : tab === 'ekspedisi' ? this._tabEkspedisi() : this._tabPrestise()));
    return out;
  });
};

P._tabKota = function _tabKota() {
  const e = this.e;
  const s = e.state;
  const idle = s.phase === 'idle';
  const out = [h('div', { class: 'card' }, h('div', { class: 'sub' }, 'Buka cabang di kota lain lalu pindah ke sana untuk berjualan. Tiap kota punya selera pelanggan sendiri, tapi menambah sewa harian. Pindah hanya saat toko tutup.'))];
  for (const c of CITIES) {
    const owned = !!s.cities.owned[c.id];
    const here = s.cities.at === c.id;
    const st = s.cities.stats[c.id];
    const likes = Object.entries(c.cat).filter(([, v]) => v > 1.25).map(([k]) => CAT_NAME[k]).join(', ');
    let action;
    if (here) action = h('span', { class: 'price' }, '📍 Di sini');
    else if (owned) action = h('button', { class: 'btn small', disabled: !idle, onClick: () => this.act(() => e.travelTo(c.id), `Tiba di ${c.name}`, 'ok') }, c.fare ? `Pindah · ${rp(c.fare)}` : 'Pulang');
    else action = h('button', { class: 'btn small', disabled: !idle || s.stars < c.needStars, onClick: () => this.ask(`Buka cabang ${c.name} seharga ${rp(c.cost)}?`, () => this.act(() => e.buyCity(c.id), `Cabang ${c.name} dibuka`, 'coin'), { yes: 'Buka' }) }, s.stars < c.needStars ? `Butuh ★${c.needStars}` : `Buka · ${rp(c.cost)}`);
    out.push(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, `${c.icon} ${c.name}`), action),
      h('div', { class: 'sub' }, c.desc),
      c.id !== 'pusat' ? h('div', { class: 'sub' }, `Sewa +${rp(c.rent)}/hari · pelanggan ×${c.count}${c.wtp ? ` · bayaran +${Math.round(c.wtp * 100)}%` : ''}${likes ? ` · suka: ${likes}` : ''}`) : null,
      st ? h('div', { class: 'sub' }, `Dimainkan ${st.days} hari · total ${rpShort(st.revenue)} · rekor ${rpShort(st.best)}`) : null));
  }
  return out;
};

P._tabEkspedisi = function _tabEkspedisi() {
  const e = this.e;
  const s = e.state;
  const ex = s.exped;
  const idle = s.phase === 'idle';
  const away = new Set(ex.active.map((x) => x.crewUid));
  const out = [h('div', { class: 'card' }, h('div', { class: 'sub' }, 'Kirim satu karyawan menjelajah 1–3 hari. Makin lama makin aman dan hasilnya makin bagus, tapi dia tidak bekerja selama pergi (gaji tetap jalan).'))];
  if (ex.active.length) {
    out.push(h('div', { class: 'card' }, h('b', {}, `Sedang berjalan (${ex.active.length}/3)`),
      ex.active.map((x) => {
        const m = s.crew.hired.find((c) => c.uid === x.crewUid);
        const d = getDest(x.dest);
        return h('div', { class: 'sub' }, `${d.icon} ${m ? getStaff(m.type).name : 'Karyawan'} → ${d.name}, pulang hari ke-${x.backDay} (${Math.max(0, x.backDay - s.day)} hari lagi)`);
      })));
  }
  if (ex.last) {
    const r = ex.last;
    out.push(h('div', { class: 'card' }, h('b', {}, `Hasil terakhir: ${r.name}`),
      r.failed ? h('div', { class: 'sub' }, `${r.crew} pulang dengan tangan kosong.`) : [
        h('div', { class: 'sub' }, r.animals.map((a) => `${getItem(a.itemId).name} (${RARITIES.find((x) => x.id === a.rarity).name})`).join(', ') || 'Tidak ada hewan'),
        r.pet ? h('div', { class: 'sub' }, `🐾 Pet baru: ${getPetKind(r.pet.kind).name} (${RARITIES.find((x) => x.id === r.pet.rarity).name})`) : null,
        h('div', { class: 'sub' }, `Temuan ${rp(r.cash)}${r.sold ? ` · gudang penuh, ${rp(r.sold)} dijual otomatis` : ''}`)]));
  }
  const free = s.crew.hired.filter((m) => !away.has(m.uid));
  if (!s.crew.hired.length) out.push(h('div', { class: 'card sub' }, 'Belum ada karyawan. Rekrut dulu di menu Karyawan.'));
  else {
    this._expSel ||= {};
    const sel = this._expSel;
    if (!free.some((m) => m.uid === sel.uid)) sel.uid = free[0]?.uid;
    sel.dest ||= DESTS[0].id;
    sel.days ||= 1;
    const who = h('select', { onChange: (ev) => { sel.uid = Number(ev.target.value); } },
      free.map((m) => h('option', { value: m.uid, selected: m.uid === sel.uid }, `${getStaff(m.type).name} Lv${m.lvl}`)));
    const days = h('div', { class: 'row' }, EXPED_DAYS.map((d) => h('button', { class: `btn small grow ${sel.days === d ? '' : 'secondary'}`, onClick: () => { sel.days = d; this.rerender(); } }, `${d} hari`)));
    out.push(h('div', { class: 'card' }, h('b', {}, 'Kirim ekspedisi'), free.length ? who : h('div', { class: 'sub' }, 'Semua karyawan sedang pergi.'), days));
    for (const d of DESTS) {
      const cost = d.cost * sel.days;
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `${d.icon} ${d.name}`),
          h('button', { class: 'btn small', disabled: !idle || !free.length, onClick: () => { sel.dest = d.id; this.act(() => e.sendExpedition(sel.uid, d.id, sel.days), `Berangkat ke ${d.name}`, 'ok'); } }, `Kirim · ${rp(cost)}`)),
        h('div', { class: 'sub' }, `Hewan: ${d.cats.map((c) => CAT_NAME[c]).join(', ')} · risiko gagal ±${Math.round(d.risk * 100)}%`)));
    }
  }
  return out;
};

P._tabPrestise = function _tabPrestise() {
  const e = this.e;
  const s = e.state;
  const pr = s.prestige;
  const gain = e.prestigeGain();
  const out = [h('div', { class: 'card' },
    h('div', { class: 'card-top' }, h('b', {}, `Poin Legenda: ${pr.points}`), h('span', { class: 'sub' }, `Musim ke-${pr.runs + 1}`)),
    h('div', { class: 'sub' }, `Mulai musim baru: uang, toko, hewan, dan karyawan di-reset. Skill, perk, atribut, pet, koleksi, dan cerita tetap. Kamu dapat Poin Legenda untuk bonus permanen.`),
    h('div', { class: 'sub' }, `Rekor: hari ${pr.best.day} · bintang ${pr.best.stars} · hari terbaik ${rpShort(pr.best.revenue)}`),
    h('button', { class: 'btn grow', disabled: !e.canPrestige(), onClick: () => this.ask(`Mulai musim baru dan dapat ${gain} Poin Legenda? Uang, toko, hewan, dan karyawan akan di-reset.`, () => { this.act(() => e.prestigeNow(), (g) => `Musim baru! +${g} Poin Legenda`, 'coin'); this.ctx.scene()?.refreshShelves(); }, { yes: 'Mulai musim baru', danger: true }) },
      s.stars < PRESTIGE_MIN_STARS ? `Butuh ★${PRESTIGE_MIN_STARS}` : `Musim baru · +${gain} poin`))];
  for (const p of PUPS) {
    const rank = pup(e, p.id);
    out.push(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, `${p.icon} ${p.name}`), h('span', { class: 'sub' }, `rank ${rank}/${p.max}`)),
      h('div', { class: 'sub' }, p.desc),
      rank >= p.max ? h('div', { class: 'sub' }, 'Maksimal') : h('button', { class: 'btn small', disabled: pr.points < pupCost(rank), onClick: () => this.act(() => e.buyPup(p.id), 'Bonus permanen dibeli', 'ok') }, `Beli · ${pupCost(rank)} poin`)));
  }
  return out;
};
