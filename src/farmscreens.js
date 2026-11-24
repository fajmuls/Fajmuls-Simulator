// Layar peternakan: Kolam, Pasar, Koleksi, dan Pet. Menambah metode ke UI.prototype.
import { ITEMS, CATEGORIES, getItem, itemsOf } from './core/catalog.js';
import {
  RARITIES, FEEDS, EGGS, PET_KINDS, SLOT_COSTS, MAX_SLOTS, GROW_SEC, DEALER_RATE, PET_MAX, petExpandCost as farmPetExpandCost,
  rarityIdx, rarityWeights, animalValue, sizeLabel, petBuffValue, getPetKind, expectedMult, growMs, getHabitat, slotsOfHab, slotQty, feedPrice, petSellValue as farmPetValue,
} from './core/farm.js';
import { UI, h, rp, toast, rarOf, CAT_EMOJI } from './ui.js';
import { audio } from './audio.js';
import { animalSVG, feedSVG, eggSVG, petSVG, svgEl } from './art.svg.js';

import * as farm from './core/farm.js';

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
  const stateKey = () => `${farm.spotLevel(e, i)}|${farm.spotLots(e, i).map((l, k) => `${l.itemId}${l.qty}${e.slotProgress(i, k)?.ready ? 1 : 0}`).join(',')}`;
  this.openSheet(`${H.one} ${slotsOfHab(e, H.id).indexOf(i) + 1}`, () => {
    const fm = e.state.farm;
    const bal = e.state.ledger.balance;
    const lots = farm.spotLots(e, i);
    const lv = farm.spotLevel(e, i);
    const cap = farm.slotCap(e, i);
    const used = farm.spotUsed(e, i);
    const free = farm.spotFree(e, i);
    const readyN = farm.spotReady(e, i);
    const up = farm.spotUpgradeCost(e, i);
    const out = [];
    lastState = stateKey();
    // kepala: level dan kapasitas
    out.push(h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, `${H.one} Lv ${lv}`), h('span', { class: 'badge' }, `${used}/${cap} ekor`)),
      h('div', { class: 'meter' }, h('i', { style: `width:${Math.round((used / cap) * 100)}%` })),
      up === null
        ? h('div', { class: 'sub' }, 'Level tertinggi.')
        : h('button', { class: 'btn small secondary', disabled: bal < up, onClick: () => this.act(() => e.upgradeSpot(i), `${H.one} naik ke Lv ${lv + 1}`, 'upgrade') },
          `Upgrade ke Lv ${lv + 1} (muat ${farm.HAB_LEVEL_CAPS[lv]} ekor) · ${rp(up)}`)));
    // daftar penghuni
    if (lots.length) {
      out.push(h('div', { class: 'sub', style: 'font-weight:700' }, `Penghuni (${lots.length})`));
      lots.forEach((lot, k) => {
        const it = getItem(lot.itemId);
        const pr = e.slotProgress(i, k);
        const feed = lot.feed ? FEEDS.find((f) => f.id === lot.feed) : null;
        out.push(h('div', { class: `card${pr.ready ? ' hero' : ''}` },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(it), 48, pr.ready ? 'bounce' : ''),
            h('div', { class: 'grow' }, h('b', {}, `${it.name} ×${slotQty(lot)}`), h('div', { class: 'sub' }, feed ? `Pakan: ${feed.name}` : 'Tanpa pakan'),
              h('div', { class: 'sub', 'data-t': `${i}:${k}` }, pr.ready ? 'SIAP PANEN!' : `Sisa ${mmss(pr.remainMs)}`))),
          h('div', { class: 'meter' }, h('i', { 'data-b': `${i}:${k}`, style: `width:${Math.round(pr.pct * 100)}%` })),
          pr.ready ? h('button', { class: 'btn small', onClick: () => { this.closeModal(); this.harvestUI(i, k); } }, 'Panen penghuni ini') : null));
      });
      if (readyN > 1) out.push(h('button', { class: 'btn', onClick: () => { this.closeModal(); this.harvestUI(i); } }, `Panen semua yang siap (${readyN})`));
    } else {
      out.push(h('div', { class: 'card' }, h('b', {}, `${H.one} masih kosong`), h('div', { class: 'sub' }, 'Tambah penghuni di bawah: pilih spesies, jumlah, dan pakan.')));
    }
    // tambah penghuni
    if (!free) {
      out.push(h('div', { class: 'card warn' }, h('b', {}, 'Penuh'), h('div', { class: 'sub' }, up === null ? 'Panen dulu untuk mengosongkan tempat.' : 'Panen dulu atau upgrade lahan untuk menambah penghuni.')));
      return out;
    }
    const list = speciesOf();
    if (!list.length) {
      out.push(h('div', { class: 'card warn' }, h('b', {}, `Belum ada spesies untuk ${H.name}`), h('div', { class: 'sub' }, H.id === 'kandang' ? 'Naikkan Toko ke Lv 2 untuk membuka burung dan satwa kecil.' : 'Buka spesies baru di menu.')));
      return out;
    }
    out.push(h('div', { class: 'sub', style: 'font-weight:700;margin-top:4px' }, `Tambah penghuni (sisa tempat ${free})`));
    const sel = this.plantSel;
    if (!sel.itemId || !list.some((x) => x.id === sel.itemId)) sel.itemId = list[0].id;
    const item = getItem(sel.itemId);
    const have = fm.bibit[sel.itemId] || 0;
    const maxQty = Math.max(0, Math.min(free, have, sel.feed ? (fm.feeds[sel.feed] || 0) : free));
    if (sel.qty === undefined || sel.qty > maxQty || sel.qty < 1) sel.qty = Math.max(1, maxQty);
    const qty = sel.qty;
    const feedOk = !sel.feed || (fm.feeds[sel.feed] || 0) >= 1;
    const feedLuck = (sel.feed ? FEEDS.find((f) => f.id === sel.feed).luck : 0) + e.farmBuffs().luck * 10;
    out.push(h('div', { class: 'pick-grid' }, list.map((it) => h('button', { class: `pick${it.id === sel.itemId ? ' on' : ''}`, onClick: () => { sel.itemId = it.id; sel.qty = undefined; this.rerender(); } },
      svgEl(animalSVG(it), 26), h('span', {}, it.name.split(' ').slice(-1)[0]), h('small', {}, `punya ${fm.bibit[it.id] || 0}`)))));
    out.push(h('div', { class: 'card' },
      h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(animalSVG(item), 52),
        h('div', { class: 'grow' }, h('b', {}, item.name), h('div', { class: 'sub' }, `Bibit punya ${have} · tumbuh ${mmss(growMs(e, sel.itemId, sel.feed))}`))),
      h('div', { class: 'row', style: 'justify-content:space-between' },
        h('b', {}, 'Jumlah'),
        h('div', { class: 'stepper' },
          h('button', { disabled: qty <= 1, onClick: () => { sel.qty = Math.max(1, qty - 1); this.rerender(); } }, '−'),
          h('b', { style: 'min-width:34px;text-align:center;font-size:18px' }, String(qty)),
          h('button', { disabled: qty >= maxQty, onClick: () => { sel.qty = Math.min(maxQty, qty + 1); this.rerender(); } }, '+'),
          h('button', { class: 'qbtn', disabled: qty >= maxQty, onClick: () => { sel.qty = maxQty; this.rerender(); } }, 'Maks')))));
    out.push(h('div', { class: 'card' },
      h('b', {}, 'Pakan (opsional, 1 per hewan)'),
      h('div', { class: 'pick-grid' },
        h('button', { class: `pick${!sel.feed ? ' on' : ''}`, onClick: () => { sel.feed = null; sel.qty = undefined; this.rerender(); } }, h('span', {}, 'Tanpa'), h('small', {}, 'gratis')),
        FEEDS.map((f) => h('button', { class: `pick${sel.feed === f.id ? ' on' : ''}`, onClick: () => { sel.feed = f.id; sel.qty = undefined; this.rerender(); } },
          svgEl(feedSVG(f), 26), h('span', {}, f.name.replace('Pakan ', '')), h('small', {}, `punya ${fm.feeds[f.id] || 0}`)))),
      h('div', { class: 'sub' }, `Nilai rata-rata ≈ ${expectedMult(feedLuck).toFixed(2)}× harga dasar`),
      oddsBar(feedLuck)));
    if (!have) {
      out.push(h('button', { class: 'btn secondary', onClick: () => { this.closeModal(); this.openPasar(); } }, 'Bibit habis, ke Pasar'));
    } else {
      out.push(h('button', { class: 'btn', disabled: !feedOk || maxQty < 1,
        onClick: () => { this.act(() => e.plant(i, sel.itemId, sel.feed, qty), `Menanam ${qty} ${item.name}`, 'ok'); sel.qty = undefined; this.ctx.scene()?.refreshFarm(); this.rerender(); } },
      feedOk && maxQty >= 1 ? `Tanam ${qty} ${item.name}` : 'Pakan habis, beli di Pasar'));
    }
    return out;
  });
  this.modalTimer = setInterval(() => {
    if (!this.modal) return;
    if (stateKey() !== lastState) { this.rerender(); return; }
    farm.spotLots(e, i).forEach((_, k) => {
      const pr = e.slotProgress(i, k);
      if (!pr) return;
      const b = this.modal.body.querySelector(`[data-b="${i}:${k}"]`);
      const t = this.modal.body.querySelector(`[data-t="${i}:${k}"]`);
      if (b) b.style.width = `${Math.round(pr.pct * 100)}%`;
      if (t) t.textContent = pr.ready ? 'SIAP PANEN!' : `Sisa ${mmss(pr.remainMs)}`;
    });
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

P.harvestUI = function harvestUI(i, k = null) {
  const sc = this.ctx.scene();
  const at = sc?.plotCenter?.(i);
  let got = null;
  this.act(() => { got = k === null ? this.e.harvestSpot(i) : this.e.harvest(i, k); return got; }, null, null);
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
  this.pasarTab ||= 'hewan';
  this.openSheet('Pasar', () => {
    const e = this.e;
    const fm = e.state.farm;
    const bal = e.state.ledger.balance;
    const lvl = e.state.shopLevel || 1;
    this.pasarQty ||= {};
    const q = (k) => this.pasarQty[k] || 1;
    const qty = (k) => h('div', { class: 'qrow' }, [1, 5, 10].map((n) => h('button', { class: `qbtn${q(k) === n ? ' on' : ''}`, onClick: () => { this.pasarQty[k] = n; this.rerender(); } }, `×${n}`)));
    const out = [this.chips([{ id: 'hewan', label: '🐟 Hewan' }, { id: 'pakan', label: '🌾 Pakan' }, { id: 'lisensi', label: '📜 Lisensi' }], this.pasarTab, (id) => { this.pasarTab = id; this.rerender(); }),
      h('div', { class: 'sub' }, `Kas ${rp(bal)}${this.pasarTab === 'hewan' ? '. Harga bibit berubah tiap hari.' : ''}`)];

    if (this.pasarTab === 'hewan') {
      for (const it of e.unlockedItems()) {
        const price = e.bibitPrice(it.id);
        const base = Math.round(it.retail * 0.2);
        const diff = price - base;
        const k = `b_${it.id}`;
        out.push(h('div', { class: 'card item compact', 'data-cat': it.cat },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' }, svgEl(animalSVG(it), 34),
            h('div', { class: 'grow' }, h('b', {}, it.name), h('div', { class: 'sub' }, `punya ${fm.bibit[it.id] || 0} · tumbuh ${mmss(GROW_SEC[it.tier - 1] * 1000)}`)),
            h('div', { style: 'text-align:right' }, h('div', { class: 'price' }, rp(price)), h('div', { class: `sub ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}` }, diff === 0 ? 'normal' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(Math.round((diff / base) * 100))}%`))),
          h('div', { class: 'row', style: 'flex-wrap:nowrap' }, qty(k), h('button', { class: 'btn small grow', disabled: bal < price * q(k), onClick: () => this.act(() => e.buyBibit(it.id, q(k)), `Beli ${q(k)} bibit ${it.name}`, 'buy') }, `Beli ${q(k)} · ${rp(price * q(k))}`))));
      }
    } else if (this.pasarTab === 'pakan') {
      out.push(h('div', { class: 'sub' }, 'Pakan mahal dibuka bertahap menurut level toko. Makin bagus pakannya, makin besar peluang rarity tinggi, ukuran, dan kecepatan tumbuh.'));
      for (const f of FEEDS) {
        const k = `f_${f.id}`;
        const open = lvl >= f.needShop;
        out.push(h('div', { class: `card compact${open ? '' : ' dim'}` },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:8px' }, svgEl(feedSVG(f), 34, open ? '' : 'locked'),
            h('div', { class: 'grow' }, h('b', {}, f.name), h('div', { class: 'sub' }, open ? `punya ${fm.feeds[f.id] || 0} · tumbuh ${Math.round(f.speed * 100)}% lebih cepat · ≈ ${expectedMult(f.luck).toFixed(2)}×` : `🔒 Dibuka di Toko Lv ${f.needShop}`)),
            h('span', { class: 'price' }, rp(feedPrice(e, f)))),
          open ? [oddsBar(f.luck), h('div', { class: 'row', style: 'flex-wrap:nowrap' }, qty(k), h('button', { class: 'btn small grow', disabled: bal < feedPrice(e, f) * q(k), onClick: () => this.act(() => e.buyFeed(f.id, q(k)), `Beli ${q(k)} ${f.name}`, 'buy') }, `Beli ${q(k)} · ${rp(feedPrice(e, f) * q(k))}`))] : null));
      }
    } else {
      out.push(h('div', { class: 'sub' }, 'Lisensi membuka spesies baru. Jenis tier rendah murah, tier tinggi mahal.'));
      out.push(h('button', { class: 'btn', onClick: () => this.openSpesies() }, '🐾 Buka daftar lisensi spesies'));
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
      if (this.lastHatch) {
        const p = this.lastHatch;
        const r = RARITIES[rarityIdx(p.rarity)];
        out.push(h('div', { class: 'card hero hatched', style: `border-color:${r.color}` },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petSVG(p.kind, r.color), 56, 'bounce'),
            h('div', { class: 'grow' }, h('b', {}, `Dapat ${getPetKind(p.kind).name}!`), p.autoSold ? h('div', { class: 'sub good' }, `Otomatis terjual ${rp(p.autoSold)}`) : null, h('div', {}, rarTag(r)), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p)))))));
      }
      for (const egg of EGGS) {
        out.push(h('div', { class: 'card' },
          h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(eggSVG(egg), 40),
            h('div', { class: 'grow' }, h('b', {}, egg.name), h('div', { class: 'sub' }, 'Isi: salah satu dari 5 jenis pet')),
            h('button', { class: 'btn small', disabled: bal < egg.price || pets.owned.length >= e.petMax(), onClick: () => { this.act(() => { this.lastHatch = e.hatch(egg.id); return this.lastHatch; }, this.lastHatch?.autoSold ? null : null, null); audio.play(rarityIdx(this.lastHatch?.rarity || 'common') >= 3 ? 'star' : 'upgrade'); } }, `Tetaskan ${rp(egg.price)}`)),
          oddsBar(egg.luck)));
      }
      if (pets.owned.length >= e.petMax()) out.push(h('div', { class: 'sub bad' }, 'Inventori penuh. Perluas di tab Aturan atau jual pet lama.'));
      return out;
    }

    if (this.petTab === 'buku') {
      out.push(h('div', { class: 'card' }, h('b', {}, `Buku Koleksi Pet ${bookHave}/${bookTotal}`),
        h('div', { class: 'sub' }, 'Mencatat semua pet yang pernah kamu dapat, walau sudah dijual.')));
      for (const k of PET_KINDS) {
        out.push(h('div', { class: 'card' },
          h('b', {}, k.name),
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
        h('button', { class: 'btn small', disabled: n >= 10 || bal < farmPetExpandCost(e), onClick: () => this.act(() => e.buyPetSpace(), 'Kandang pet diperluas', 'upgrade') }, n >= 10 ? 'Maksimal' : `Perluas ${rp(farmPetExpandCost(e))}`)));
      return out;
    }

    const slots = e.petSlots();
    out.push(h('div', { class: 'card' },
      h('b', {}, `Slot pet terpakai ${pets.equipped.length}/${slots}`),
      h('div', { class: 'sub' }, 'Pet yang dipasang memberi buff. Pet yang dilepas dari slot tetap tersimpan di inventori; jual hanya bila kamu mau.')));
    if (!pets.owned.length) out.push(h('div', { class: 'card' }, 'Belum punya pet. Tetaskan telur di tab Telur.'));
    const spare = pets.owned.filter((p) => !pets.equipped.includes(p.id) && rarityIdx(p.rarity) <= 1);
    if (spare.length) {
      const val = spare.reduce((n, p) => n + farmPetValue(p), 0);
      out.push(h('button', { class: 'btn secondary small', onClick: () => { if (confirm(`Jual ${spare.length} pet Common/Uncommon yang tidak dipasang?`)) this.act(() => e.sellSparePets(1), (v) => `${v.n} pet terjual ${rp(v.total)}`, 'coin'); } }, `Jual ${spare.length} pet biasa · ${rp(val)}`));
    }
    const sorted = pets.owned.slice().sort((a, b) => Number(pets.equipped.includes(b.id)) - Number(pets.equipped.includes(a.id)) || rarityIdx(b.rarity) - rarityIdx(a.rarity));
    for (const p of sorted) {
      const r = RARITIES[rarityIdx(p.rarity)];
      const on = pets.equipped.includes(p.id);
      out.push(h('div', { class: `card${on ? ' hero' : ''}`, style: `border-left:5px solid ${r.color}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(petSVG(p.kind, r.color), 44),
          h('div', { class: 'grow' }, h('b', {}, getPetKind(p.kind).name), h('div', {}, rarTag(r), on ? h('span', { class: 'badge good', style: 'margin-left:6px' }, 'dipasang') : null), h('div', { class: 'sub' }, getPetKind(p.kind).text(petBuffValue(p))))),
        h('div', { class: 'row' },
          h('button', { class: `btn small ${on ? 'secondary' : ''}`, onClick: () => this.act(() => (on ? e.unequipPet(p.id) : e.equipPet(p.id)), on ? 'Pet disimpan di inventori' : 'Pet dipasang', 'ok') }, on ? 'Lepas dari slot' : 'Pasang'),
          h('button', { class: 'btn small secondary', onClick: () => { if (rarityIdx(p.rarity) >= e.state.policy.petConfirm && !confirm('Pet ini langka. Yakin dijual? (tetap tercatat di Buku Koleksi)')) return; this.act(() => e.sellPet(p.id), (v) => `Pet terjual ${rp(v)}`, 'coin'); } }, `Jual ${rp(farmPetValue(p))}`))));
    }
    return out;
  });
};

export { PET_KINDS, CAT_EMOJI, toast };
