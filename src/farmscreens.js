// Layar peternakan: Kolam, Pasar, Koleksi, dan Pet. Menambah metode ke UI.prototype.
import { ITEMS, CATEGORIES, getItem, itemsOf } from './core/catalog.js';
import {
  RARITIES, FEEDS, EGGS, PET_KINDS, SLOT_COSTS, MAX_SLOTS, GROW_SEC, DEALER_RATE, PET_MAX,
  rarityIdx, rarityWeights, animalValue, sizeLabel, petBuffValue, getPetKind, expectedMult, growMs,
} from './core/farm.js';
import { UI, h, rp, toast, rarOf, CAT_EMOJI } from './ui.js';
import { audio } from './audio.js';
import { animalSVG, feedSVG, eggSVG, petSVG, svgEl } from './art.svg.js';

const P = UI.prototype;

const mmss = (ms) => {
  const t = Math.ceil(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const pct = (x) => (x >= 0.1 ? `${Math.round(x * 100)}%` : `${(x * 100).toFixed(x < 0.01 ? 2 : 1)}%`);
const rarTag = (r) => h('span', { class: 'rar', style: `color:${r.color};border-color:${r.color}` }, r.name);

// Baris peluang rarity untuk nilai luck tertentu
function oddsBar(luck) {
  const ws = rarityWeights(luck);
  return h('div', { class: 'odds' }, RARITIES.map((r, i) => h('div', { class: 'odd', title: `${r.name} ${pct(ws[i])}` },
    h('i', { style: `background:${r.color}` }), h('span', {}, `${r.name.slice(0, 3)} ${pct(ws[i])}`))));
}

// ---------- Kolam ----------
P.openKolam = function openKolam() {
  const e = this.e;
  const unlocked = () => e.unlockedItems();
  if (!this.plantSel || !e.isUnlocked(this.plantSel.itemId)) this.plantSel = { itemId: unlocked()[0].id, feed: null };
  let lastReady = '';
  const readyKey = () => e.state.farm.slots.map((_, i) => (e.slotProgress(i)?.ready ? 1 : 0)).join('');
  this.openSheet('🌱 Kolam & Kandang', () => {
    const fm = e.state.farm;
    const sel = this.plantSel;
    const item = getItem(sel.itemId);
    const out = [];
    const feedLuck = (sel.feed ? FEEDS.find((f) => f.id === sel.feed).luck : 0) + e.farmBuffs().luck * 10;

    const ready = fm.slots.filter((_, i) => e.slotProgress(i)?.ready).length;
    out.push(h('div', { class: 'row' },
      h('div', { class: 'grow sub' }, `Kas ${rp(e.state.ledger.balance)} · hewan di kandang ${fm.animals.length}`),
      ready ? h('button', { class: 'btn small', onClick: () => this.harvestAllUI() }, `🌾 Panen semua (${ready})`) : null));

    // Pilihan tanam
    out.push(h('div', { class: 'card' },
      h('b', {}, 'Yang mau ditanam'),
      h('div', { class: 'chips' }, unlocked().map((it) => h('button', { class: `chip${it.id === sel.itemId ? ' on' : ''}`, onClick: () => { sel.itemId = it.id; this.rerender(); } },
        svgEl(animalSVG(it), 18), ' ', it.name.split(' ').slice(-1)[0], ` ×${fm.bibit[it.id] || 0}`))),
      h('div', { class: 'sub' }, `Bibit ${item.name}: punya ${fm.bibit[sel.itemId] || 0} · tumbuh ${mmss(growMs(e, sel.itemId, sel.feed))} · harga bibit di Pasar ${rp(e.bibitPrice(sel.itemId))}`),
      h('b', {}, 'Pakan (opsional)'),
      h('div', { class: 'chips' },
        h('button', { class: `chip${!sel.feed ? ' on' : ''}`, onClick: () => { sel.feed = null; this.rerender(); } }, 'Tanpa pakan'),
        FEEDS.map((f) => h('button', { class: `chip${sel.feed === f.id ? ' on' : ''}`, onClick: () => { sel.feed = f.id; this.rerender(); } },
          svgEl(feedSVG(f), 18), ` ${f.name.replace('Pakan ', '')} ×${fm.feeds[f.id] || 0}`))),
      h('div', { class: 'sub' }, `Nilai rata-rata hasil ≈ ${expectedMult(feedLuck).toFixed(2)}× harga dasar. Peluang rarity:`),
      oddsBar(feedLuck)));

    // Kolam
    fm.slots.forEach((slot, i) => {
      if (!slot) {
        const have = (fm.bibit[sel.itemId] || 0) > 0;
        const feedOk = !sel.feed || (fm.feeds[sel.feed] || 0) > 0;
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, `Kolam ${i + 1}`), h('span', { class: 'sub' }, 'kosong')),
          h('button', { class: 'btn small', disabled: !have || !feedOk, onClick: () => this.act(() => e.plant(i, sel.itemId, sel.feed), `Menanam ${item.name}`, 'ok') },
            !have ? `Bibit ${item.name} habis (beli di Pasar)` : !feedOk ? 'Pakan habis (beli di Pasar)' : `Tanam ${item.name}`)));
        return;
      }
      const it = getItem(slot.itemId);
      const pr = e.slotProgress(i);
      const feed = slot.feed ? FEEDS.find((f) => f.id === slot.feed) : null;
      out.push(h('div', { class: `card${pr.ready ? ' hero' : ''}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' },
          svgEl(animalSVG(it), 44, pr.ready ? 'bounce' : ''),
          h('div', { class: 'grow' },
            h('div', { class: 'card-top' }, h('b', {}, `Kolam ${i + 1} · ${it.name}`), h('span', { class: 'sub', 'data-t': i }, pr.ready ? 'SIAP!' : mmss(pr.remainMs))),
            h('div', { class: 'meter' }, h('i', { 'data-b': i, style: `width:${Math.round(pr.pct * 100)}%` })),
            h('div', { class: 'sub' }, feed ? `Pakan: ${feed.name}` : 'Tanpa pakan'))),
        pr.ready ? h('button', { class: 'btn small', onClick: () => this.harvestUI(i) }, '🌾 Panen') : null));
    });

    if (fm.slots.length < MAX_SLOTS) {
      const cost = SLOT_COSTS[fm.slots.length];
      out.push(h('button', { class: 'btn secondary', disabled: e.state.ledger.balance < cost, onClick: () => this.act(() => e.buySlot(), 'Kolam baru dibuka!', 'upgrade') }, `➕ Tambah kolam ke-${fm.slots.length + 1} (${cost ? rp(cost) : 'gratis'})`));
    }
    lastReady = readyKey();
    return out;
  });
  // Perbarui bilah kemajuan tiap detik tanpa membangun ulang layar (agar tombol tidak hilang saat ditekan).
  this.modalTimer = setInterval(() => {
    if (!this.modal) return;
    if (readyKey() !== lastReady) { this.rerender(); return; }
    e.state.farm.slots.forEach((slot, i) => {
      if (!slot) return;
      const pr = e.slotProgress(i);
      const b = this.modal.body.querySelector(`[data-b="${i}"]`);
      const t = this.modal.body.querySelector(`[data-t="${i}"]`);
      if (b) b.style.width = `${Math.round(pr.pct * 100)}%`;
      if (t) t.textContent = pr.ready ? 'SIAP!' : mmss(pr.remainMs);
    });
  }, 500);
};

P.harvestUI = function harvestUI(i) {
  this.act(() => this.e.harvest(i), (a) => this.harvestMsg(a), null);
  this.playHarvest(this.e.state.farm.animals.at(-1));
};

P.harvestAllUI = function harvestAllUI() {
  const got = [];
  this.act(() => { got.push(...this.e.harvestAll()); return got; }, (list) => `Panen ${list.length} hewan${list.some((a) => rarityIdx(a.rarity) >= 2) ? ' — ada yang langka! ✨' : ''}`, null);
  const best = got.sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity))[0];
  if (best) this.playHarvest(best);
};

P.harvestMsg = function harvestMsg(a) {
  const it = getItem(a.itemId);
  return `${rarOf(a).name}! ${it.name} ${sizeLabel(a.itemId, a.size)} (≈ ${rp(animalValue(a))})`;
};

P.playHarvest = function playHarvest(a) {
  if (!a) return;
  const r = rarityIdx(a.rarity);
  audio.play(r >= 4 ? 'star' : r >= 2 ? 'upgrade' : 'ok');
};

// ---------- Pasar ----------
P.openPasar = function openPasar() {
  this.openSheet('🛒 Pasar', () => {
    const e = this.e;
    const fm = e.state.farm;
    const bal = e.state.ledger.balance;
    this.pasarQty ||= {};
    const q = (k) => this.pasarQty[k] || 1;
    const qty = (k) => h('div', { class: 'qrow' }, [1, 5, 10].map((n) => h('button', { class: `qbtn${q(k) === n ? ' on' : ''}`, onClick: () => { this.pasarQty[k] = n; this.rerender(); } }, `×${n}`)));
    const out = [h('div', { class: 'sub' }, `Kas ${rp(bal)}. Harga bibit berubah tiap hari.`)];

    out.push(h('h3', { class: 'sec' }, 'Bibit dan anak hewan'));
    for (const it of e.unlockedItems()) {
      const price = e.bibitPrice(it.id);
      const base = Math.round(it.retail * 0.2);
      const diff = price - base;
      const k = `b_${it.id}`;
      out.push(h('div', { class: 'card item', 'data-cat': it.cat },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(it), 40),
          h('div', { class: 'grow' }, h('b', {}, it.name), h('div', { class: 'sub' }, `punya ${fm.bibit[it.id] || 0} · tumbuh ${mmss(GROW_SEC[it.tier - 1] * 1000)} · jual dasar ${rp(it.retail)}`)),
          h('div', { style: 'text-align:right' }, h('div', { class: 'price' }, rp(price)), h('div', { class: `sub ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}` }, diff === 0 ? 'normal' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(Math.round((diff / base) * 100))}%`))),
        h('div', { class: 'row' }, qty(k), h('button', { class: 'btn small grow', disabled: bal < price * q(k), onClick: () => this.act(() => e.buyBibit(it.id, q(k)), `Beli ${q(k)} bibit ${it.name}`, 'buy') }, `Beli ${q(k)} · ${rp(price * q(k))}`))));
    }
    out.push(h('button', { class: 'btn secondary', onClick: () => this.openSpesies() }, '🐾 Buka spesies baru'));

    out.push(h('h3', { class: 'sec' }, 'Pakan dan pupuk'));
    out.push(h('div', { class: 'sub' }, 'Makin mahal pakannya, makin besar peluang rarity tinggi, ukuran, dan kecepatan tumbuh.'));
    for (const f of FEEDS) {
      const k = `f_${f.id}`;
      out.push(h('div', { class: 'card' },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(feedSVG(f), 40),
          h('div', { class: 'grow' }, h('b', {}, f.name), h('div', { class: 'sub' }, `punya ${fm.feeds[f.id] || 0} · tumbuh ${Math.round(f.speed * 100)}% lebih cepat · nilai ≈ ${expectedMult(f.luck).toFixed(2)}×`)),
          h('span', { class: 'price' }, rp(f.price))),
        oddsBar(f.luck),
        h('div', { class: 'row' }, qty(k), h('button', { class: 'btn small grow', disabled: bal < f.price * q(k), onClick: () => this.act(() => e.buyFeed(f.id, q(k)), `Beli ${q(k)} ${f.name}`, 'buy') }, `Beli ${q(k)} · ${rp(f.price * q(k))}`))));
    }
    return out;
  });
};

// ---------- Koleksi dan kandang ----------
P.openKoleksi = function openKoleksi() {
  this.koleksiTab ||= 'kandang';
  this.openSheet('📖 Koleksi', () => {
    const e = this.e;
    const fm = e.state.farm;
    const out = [this.chips([{ id: 'kandang', label: `Kandang (${fm.animals.length})` }, { id: 'buku', label: 'Buku Koleksi' }], this.koleksiTab, (id) => { this.koleksiTab = id; this.rerender(); })];
    if (this.koleksiTab === 'kandang') {
      if (!fm.animals.length) out.push(h('div', { class: 'card' }, 'Kandang kosong. Tanam bibit di Kolam, tunggu tumbuh, lalu panen.'));
      const sorted = fm.animals.slice().sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity) || animalValue(b) - animalValue(a));
      out.push(sorted.length ? h('div', { class: 'sub' }, `Pengepul membeli hewan sisa seharga ${Math.round(DEALER_RATE * 100)}% nilainya. Hewan langka lebih baik dijual ke Kolektor atau pelanggan VIP.`) : null);
      for (const a of sorted.slice(0, 80)) {
        const it = getItem(a.itemId);
        const r = rarOf(a);
        out.push(h('div', { class: 'card', style: `border-left:5px solid ${r.color}` },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(it), 40),
            h('div', { class: 'grow' }, h('b', {}, it.name), h('div', { class: 'sub' }, `${sizeLabel(a.itemId, a.size)} · `, rarTag(r))),
            h('div', { style: 'text-align:right' }, h('div', { class: 'price' }, rp(animalValue(a))),
              h('button', { class: 'btn small secondary', onClick: () => { if (rarityIdx(a.rarity) >= 3 && !confirm(`${r.name} ${it.name} cukup langka. Tetap jual ke pengepul?`)) return; this.act(() => e.dealerSell(a.id), (p) => `Terjual ke pengepul ${rp(p)}`, 'coin'); } }, 'Jual murah')))));
      }
      if (sorted.length > 80) out.push(h('div', { class: 'sub' }, `+${sorted.length - 80} hewan lainnya`));
    } else {
      let found = 0;
      for (const it of ITEMS) for (const r of RARITIES) if (fm.book[it.id]?.[r.id]) found += 1;
      out.push(h('div', { class: 'card' }, h('b', {}, `Terkumpul ${found} / ${ITEMS.length * RARITIES.length}`), h('div', { class: 'meter' }, h('i', { style: `width:${(found / (ITEMS.length * RARITIES.length)) * 100}%` }))));
      for (const cat of CATEGORIES) {
        out.push(h('h3', { class: 'sec' }, cat.name));
        for (const it of itemsOf(cat.id)) {
          const known = e.isUnlocked(it.id);
          out.push(h('div', { class: `card${known ? '' : ' dim'}` },
            h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(it), 34, known ? '' : 'locked'), h('b', {}, known ? it.name : '???')),
            h('div', { class: 'dots' }, RARITIES.map((r) => {
              const rec = fm.book[it.id]?.[r.id];
              return h('div', { class: `dot${rec ? ' on' : ''}`, style: rec ? `border-color:${r.color};color:${r.color}` : '', title: r.name },
                h('b', {}, r.name.slice(0, 3)), h('span', {}, rec ? `${sizeLabel(it.id, rec.best)}` : '—'), h('span', {}, rec ? `×${rec.n}` : ''));
            }))));
        }
      }
    }
    return out;
  });
};

// ---------- Pet ----------
P.openPet = function openPet() {
  this.openSheet('🐾 Pet', () => {
    const e = this.e;
    const pets = e.state.pets;
    const bal = e.state.ledger.balance;
    const out = [];
    const slots = e.petSlots();
    out.push(h('div', { class: 'card' },
      h('b', {}, `Slot pet terpakai ${pets.equipped.length}/${slots}`),
      h('div', { class: 'sub' }, 'Pet yang dipasang memberi buff: peluang rarity, kecepatan tumbuh, harga jual, kesabaran pelanggan, dan tip. Slot bertambah di Toko Lv 3 dan ★4.')));

    if (this.lastHatch) {
      const p = this.lastHatch;
      const r = RARITIES[rarityIdx(p.rarity)];
      out.push(h('div', { class: 'card hero hatched', style: `border-color:${r.color}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petSVG(p.kind, r.color), 56, 'bounce'),
          h('div', { class: 'grow' }, h('b', {}, `Dapat ${getPetKind(p.kind).name}!`), h('div', {}, rarTag(r)), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p)))))));
    }

    out.push(h('h3', { class: 'sec' }, 'Telur (gacha)'));
    for (const egg of EGGS) {
      out.push(h('div', { class: 'card' },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(eggSVG(egg), 40),
          h('div', { class: 'grow' }, h('b', {}, egg.name), h('div', { class: 'sub' }, 'Isi: salah satu dari 5 jenis pet')),
          h('button', { class: 'btn small', disabled: bal < egg.price || pets.owned.length >= PET_MAX, onClick: () => { this.act(() => { this.lastHatch = e.hatch(egg.id); return this.lastHatch; }, null, null); audio.play(rarityIdx(this.lastHatch?.rarity || 'common') >= 3 ? 'star' : 'upgrade'); } }, `Tetaskan ${rp(egg.price)}`)),
        oddsBar(egg.luck)));
    }

    out.push(h('h3', { class: 'sec' }, `Koleksi pet (${pets.owned.length})`));
    if (!pets.owned.length) out.push(h('div', { class: 'card' }, 'Belum punya pet. Tetaskan telur di atas.'));
    const sorted = pets.owned.slice().sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity));
    for (const p of sorted) {
      const r = RARITIES[rarityIdx(p.rarity)];
      const on = pets.equipped.includes(p.id);
      out.push(h('div', { class: `card${on ? ' hero' : ''}`, style: `border-left:5px solid ${r.color}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petSVG(p.kind, r.color), 44),
          h('div', { class: 'grow' }, h('b', {}, getPetKind(p.kind).name), h('div', {}, rarTag(r)), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p))))),
        h('div', { class: 'row' },
          h('button', { class: `btn small ${on ? 'secondary' : ''}`, onClick: () => this.act(() => (on ? e.unequipPet(p.id) : e.equipPet(p.id)), on ? 'Pet dilepas dari slot' : 'Pet dipasang', 'ok') }, on ? 'Lepas dari slot' : 'Pasang'),
          h('button', { class: 'btn small secondary', onClick: () => { if (rarityIdx(p.rarity) >= 3 && !confirm('Pet ini langka. Yakin dilepas?')) return; this.act(() => e.releasePet(p.id), (v) => `Pet dilepas, dapat ${rp(v)}`, 'coin'); } }, 'Lepas'))));
    }
    return out;
  });
};

export { PET_KINDS, CAT_EMOJI, toast };
