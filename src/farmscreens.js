// Layar peternakan: Kolam, Pasar, Koleksi, dan Pet. Menambah metode ke UI.prototype.
import { ITEMS, CATEGORIES, getItem, itemsOf } from './core/catalog.js';
import {
  RARITIES, FEEDS, EGGS, PET_KINDS, SLOT_COSTS, MAX_SLOTS, GROW_SEC, DEALER_RATE, PET_MAX,
  rarityIdx, rarityWeights, animalValue, sizeLabel, petBuffValue, getPetKind, expectedMult, growMs, getHabitat, slotsOfHab, slotQty,
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

// ---------- Lahan di peta ----------
const hab = (id) => getHabitat(id);

P.tapPlot = function tapPlot({ slot, hab: habId, buy }) {
  const e = this.e;
  if (buy) return this.openBuyPlot(habId);
  const pr = e.slotProgress(slot);
  if (pr?.ready) return this.harvestUI(slot);
  return this.openPlot(slot);
};

P.tapBuilding = function tapBuilding(id) {
  if (id === 'pasar') return this.openPasar();
  if (id === 'pet') return this.openPet();
  if (id === 'kantor') return this.openMenu();
  if (id === 'npc') return this.openNpc();
  return null;
};

P.openKolam = function openKolam() { this.ctx.travel('kolam'); };
P.openKandang = function openKandang() { this.ctx.travel('kandang'); };

P.openBuyPlot = function openBuyPlot(habId) {
  const e = this.e;
  const H = hab(habId);
  const fm = e.state.farm;
  this.openSheet(`Bangun ${H.one} baru`, () => {
    const cost = SLOT_COSTS[fm.slots.length];
    const have = fm.habs.filter((x) => x === habId).length;
    const bal = e.state.ledger.balance;
    return [
      h('div', { class: 'card hero' }, h('b', {}, H.name), h('div', { class: 'sub' }, `Sekarang ${have} dari maksimal ${H.max}. Lahan baru memperbanyak hewan yang bisa dipanen bersamaan.`)),
      h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, 'Biaya'), h('span', { class: 'price' }, cost ? rp(cost) : 'Gratis')),
        h('div', { class: 'sub' }, `Kas kamu ${rp(bal)}`),
        h('button', { class: 'btn', disabled: have >= H.max || bal < cost || fm.slots.length >= MAX_SLOTS,
          onClick: () => { this.act(() => e.buySlot(habId), `${H.one} baru dibuka!`, 'upgrade'); this.ctx.scene()?.refreshFarm(); this.closeModal(); } }, `Bangun ${H.one}`)),
    ];
  });
};

P.openPlot = function openPlot(i) {
  const e = this.e;
  const fm0 = e.state.farm;
  const H = hab(fm0.habs[i]);
  const speciesOf = () => e.unlockedItems().filter((it) => H.cats.includes(it.cat));
  this.plantSel = this.plantSel || { itemId: null, feed: null };
  let lastState = '';
  const stateKey = () => `${e.state.farm.slots[i] ? 1 : 0}${e.slotProgress(i)?.ready ? 1 : 0}`;
  this.openSheet(`${H.one} ${slotsOfHab(e, H.id).indexOf(i) + 1}`, () => {
    const fm = e.state.farm;
    const slot = fm.slots[i];
    const out = [];
    lastState = stateKey();
    if (slot) {
      const it = getItem(slot.itemId);
      const pr = e.slotProgress(i);
      const feed = slot.feed ? FEEDS.find((f) => f.id === slot.feed) : null;
      out.push(h('div', { class: `card${pr.ready ? ' hero' : ''}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(it), 64, pr.ready ? 'bounce' : ''),
          h('div', { class: 'grow' }, h('b', {}, `${it.name}${slotQty(slot) > 1 ? ` ×${slotQty(slot)}` : ''}`), h('div', { class: 'sub' }, feed ? `Pakan: ${feed.name}` : 'Tanpa pakan'),
            h('div', { class: 'sub', 'data-t': i }, pr.ready ? 'SIAP PANEN!' : `Sisa ${mmss(pr.remainMs)}`))),
        h('div', { class: 'meter' }, h('i', { 'data-b': i, style: `width:${Math.round(pr.pct * 100)}%` }))));
      out.push(pr.ready
        ? h('button', { class: 'btn', onClick: () => { this.closeModal(); this.harvestUI(i); } }, 'Panen sekarang')
        : h('div', { class: 'sub' }, 'Sabar ya, hewanmu sedang tumbuh. Ketuk lahan lagi saat sudah siap.'));
      return out;
    }
    const list = speciesOf();
    if (!list.length) {
      out.push(h('div', { class: 'card warn' }, h('b', {}, `Belum ada spesies untuk ${H.name}`), h('div', { class: 'sub' }, H.id === 'kandang' ? 'Naikkan Toko ke Lv 2 untuk membuka burung dan satwa kecil.' : 'Buka spesies baru di menu.')));
      return out;
    }
    const sel = this.plantSel;
    if (!sel.itemId || !list.some((x) => x.id === sel.itemId)) sel.itemId = list[0].id;
    const item = getItem(sel.itemId);
    const have = fm.bibit[sel.itemId] || 0;
    const cap = H.cap;
    const maxQty = Math.max(0, Math.min(cap, have, sel.feed ? (fm.feeds[sel.feed] || 0) : cap));
    if (sel.qty === undefined || sel.qty > maxQty || sel.qty < 1) sel.qty = Math.max(1, maxQty);
    const qty = sel.qty;
    const feedOk = !sel.feed || (fm.feeds[sel.feed] || 0) >= 1;
    const feedLuck = (sel.feed ? FEEDS.find((f) => f.id === sel.feed).luck : 0) + e.farmBuffs().luck * 10;
    out.push(h('div', { class: 'chips wrap' }, list.map((it) => h('button', { class: `chip${it.id === sel.itemId ? ' on' : ''}`, onClick: () => { sel.itemId = it.id; sel.qty = undefined; this.rerender(); } },
      svgEl(animalSVG(it), 18), ' ', it.name.split(' ').slice(-1)[0], ` ×${fm.bibit[it.id] || 0}`))));
    out.push(h('div', { class: 'card' },
      h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(item), 52),
        h('div', { class: 'grow' }, h('b', {}, item.name), h('div', { class: 'sub' }, `Bibit punya ${have} · tumbuh ${mmss(growMs(e, sel.itemId, sel.feed))}`),
          h('div', { class: 'sub' }, `Muat maksimal ${cap} sekaligus`))),
      h('div', { class: 'row', style: 'justify-content:space-between' },
        h('b', {}, 'Jumlah'),
        h('div', { class: 'stepper' },
          h('button', { disabled: qty <= 1, onClick: () => { sel.qty = Math.max(1, qty - 1); this.rerender(); } }, '−'),
          h('b', { style: 'min-width:34px;text-align:center;font-size:18px' }, String(qty)),
          h('button', { disabled: qty >= maxQty, onClick: () => { sel.qty = Math.min(maxQty, qty + 1); this.rerender(); } }, '+'),
          h('button', { class: 'qbtn', disabled: qty >= maxQty, onClick: () => { sel.qty = maxQty; this.rerender(); } }, 'Maks')))));
    out.push(h('div', { class: 'card' },
      h('b', {}, 'Pakan (opsional, 1 per hewan)'),
      h('div', { class: 'chips wrap' },
        h('button', { class: `chip${!sel.feed ? ' on' : ''}`, onClick: () => { sel.feed = null; sel.qty = undefined; this.rerender(); } }, 'Tanpa'),
        FEEDS.map((f) => h('button', { class: `chip${sel.feed === f.id ? ' on' : ''}`, onClick: () => { sel.feed = f.id; sel.qty = undefined; this.rerender(); } },
          svgEl(feedSVG(f), 18), ` ${f.name.replace('Pakan ', '')} ×${fm.feeds[f.id] || 0}`))),
      h('div', { class: 'sub' }, `Nilai rata-rata ≈ ${expectedMult(feedLuck).toFixed(2)}× harga dasar`),
      oddsBar(feedLuck)));
    if (!have) {
      out.push(h('button', { class: 'btn secondary', onClick: () => { this.closeModal(); this.openPasar(); } }, 'Bibit habis, ke Pasar'));
    } else {
      out.push(h('button', { class: 'btn', disabled: !feedOk || maxQty < 1,
        onClick: () => { this.act(() => e.plant(i, sel.itemId, sel.feed, qty), `Menanam ${qty} ${item.name}`, 'ok'); sel.qty = undefined; this.ctx.scene()?.refreshFarm(); this.closeModal(); } },
      feedOk && maxQty >= 1 ? `Tanam ${qty} ${item.name}` : 'Pakan habis, beli di Pasar'));
    }
    return out;
  });
  this.modalTimer = setInterval(() => {
    if (!this.modal) return;
    if (stateKey() !== lastState) { this.rerender(); return; }
    const slot = e.state.farm.slots[i];
    if (!slot) return;
    const pr = e.slotProgress(i);
    const b = this.modal.body.querySelector(`[data-b="${i}"]`);
    const t = this.modal.body.querySelector(`[data-t="${i}"]`);
    if (b) b.style.width = `${Math.round(pr.pct * 100)}%`;
    if (t) t.textContent = pr.ready ? 'SIAP PANEN!' : `Sisa ${mmss(pr.remainMs)}`;
  }, 500);
};

P.showReveal = function showReveal(a, extra = 0) {
  if (!a) return;
  const it = getItem(a.itemId);
  const r = rarOf(a);
  const big = rarityIdx(a.rarity) >= 3;
  const card = h('div', { class: `reveal-card${big ? ' big' : ''}`, style: `--rc:${r.color}` },
    svgEl(animalSVG(it), 110),
    h('div', { class: 'rname', style: `color:${r.color}` }, r.name),
    h('h3', {}, it.name),
    h('div', { class: 'sub' }, `${sizeLabel(a.itemId, a.size)} · ≈ ${rp(animalValue(a))}`),
    extra > 0 ? h('div', { class: 'sub' }, `+${extra} hewan lain masuk stok`) : null);
  const ov = h('div', { class: 'reveal', onClick: () => ov.remove() }, card);
  document.body.append(ov);
  setTimeout(() => ov.remove(), big ? 2800 : 1800);
};

P.harvestUI = function harvestUI(i) {
  const sc = this.ctx.scene();
  const at = sc?.plotCenter?.(i);
  let got = null;
  this.act(() => { got = this.e.harvest(i); return got; }, null, null);
  if (!got || !got.length) return;
  const a = got.slice().sort((x, y) => rarityIdx(y.rarity) - rarityIdx(x.rarity))[0];
  this.playHarvest(a);
  sc?.refreshFarm();
  if (at) sc.burst(at.x, at.y, rarityIdx(a.rarity) >= 3 ? 0xffd84d : 0xffffff, 14);
  this.showReveal(a, got.length - 1);
  toast(got.length > 1 ? `Panen ${got.length} hewan. Terbaik: ${this.harvestMsg(a)}` : this.harvestMsg(a), 'ok');
};

P.harvestAllUI = function harvestAllUI() {
  const got = [];
  this.act(() => { got.push(...this.e.harvestAll()); return got; }, null, null);
  const best = got.slice().sort((a, b) => rarityIdx(b.rarity) - rarityIdx(a.rarity))[0];
  if (!best) return;
  this.playHarvest(best);
  this.ctx.scene()?.refreshFarm();
  this.showReveal(best, got.length - 1);
  toast(`Panen ${got.length} hewan`, 'ok');
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
  this.openSheet('Pasar', () => {
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
  this.openSheet('Koleksi', () => {
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
  this.openSheet('Pet', () => {
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
