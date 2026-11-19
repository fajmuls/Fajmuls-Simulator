import { ITEMS, QUALITIES, UPGRADES, getItem, getQuality, getUpgrade, lotKey, DAILY_RENT } from './core/catalog.js';
import { DAY_LENGTH_SEC } from './core/engine.js';
import { auditLedger } from './core/ledger.js';

export const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export function toast(msg, kind = '') {
  const root = document.getElementById('toast-root');
  const el = h('div', { class: `toast ${kind}` }, msg);
  root.append(el);
  setTimeout(() => el.remove(), 2600);
}

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export class UI {
  constructor(ctx) {
    // ctx: { engine, scene(), persist(), openShop(), closeShop(), setSpeed(), newGame(), importText() , exportText() }
    this.ctx = ctx;
    this.modal = null;
    this.speed = 1;
    this.tabs = {};
    this.buildDock();
    this.buildHud();
  }

  get e() { return this.ctx.engine; }

  // ---------- HUD ----------
  buildHud() {
    const hud = document.getElementById('hud');
    this.hudDay = h('span', { class: 'hud-chip' });
    this.hudRep = h('span', { class: 'hud-chip' });
    this.hudDebt = h('span', { class: 'hud-chip warn', style: 'display:none' });
    this.hudCash = h('div', { class: 'hud-cash' });
    this.hudLive = h('div', { class: 'sub' });
    this.hudBar = h('i');
    hud.append(
      h('div', { class: 'hud-row' }, h('div', { class: 'hud-title' }, '🐟 Fajmuls Simulator'), h('div', { class: 'row' }, this.hudDay, this.hudRep)),
      h('div', { class: 'hud-row' }, this.hudCash, this.hudDebt),
      h('div', { class: 'hud-row' }, this.hudLive),
      h('div', { class: 'bar' }, this.hudBar),
    );
    this.refreshHud();
  }

  refreshHud(tick) {
    const s = this.e.state;
    this.hudDay.innerHTML = `Hari <b>${s.day}</b>`;
    this.hudRep.innerHTML = `Reputasi <b>${s.reputation}</b>`;
    this.hudCash.textContent = rp(s.ledger.balance);
    if (s.arrears > 0) {
      this.hudDebt.style.display = '';
      this.hudDebt.textContent = `Tunggakan ${rp(s.arrears)}`;
    } else this.hudDebt.style.display = 'none';

    if (s.phase === 'open' && tick) {
      const t = tick.today;
      this.hudLive.textContent = `Toko BUKA · dilayani ${t.served}/${t.customers} · omzet ${rp(t.revenue)}${tick.closing ? ' · menutup...' : ''}`;
      this.hudBar.style.width = `${Math.round(tick.progress * 100)}%`;
    } else if (s.phase === 'idle') {
      this.hudLive.textContent = `Toko TUTUP · stok ${this.e.usedCapacity()}/${this.e.capacity()} unit · sewa harian ${rp(DAILY_RENT)}`;
      this.hudBar.style.width = '0%';
    }
    this.syncDock();
  }

  // ---------- Dock ----------
  buildDock() {
    const dock = document.getElementById('dock');
    const defs = [
      ['grosir', '🛒', 'Grosir', () => this.openGrosir(), true],
      ['harga', '🏷️', 'Harga', () => this.openHarga(), true],
      ['stok', '📦', 'Stok', () => this.openStok(), false],
      ['laporan', '📈', 'Laporan', () => this.openLaporan(), false],
      ['upgrade', '⚙️', 'Upgrade', () => this.openUpgrade(), true],
      ['menu', '☰', 'Menu', () => this.openMenu(), false],
    ];
    const tabs = h('div', { class: 'dock-tabs' });
    for (const [id, icon, label, fn, lockWhenOpen] of defs) {
      const b = h('button', { class: 'tab', onClick: fn }, h('span', {}, icon), label);
      b.dataset.lock = lockWhenOpen ? '1' : '';
      this.tabs[id] = b;
      tabs.append(b);
    }
    this.goBtn = h('button', { class: 'btn go', onClick: () => this.toggleShop() });
    this.speedBox = h('div', { class: 'speed' });
    for (const s of [1, 2, 4]) {
      const b = h('button', { class: 'btn secondary', onClick: () => { this.speed = s; this.ctx.setSpeed(s); this.syncDock(); } }, `${s}x`);
      b.dataset.s = s;
      this.speedBox.append(b);
    }
    dock.append(h('div', { class: 'dock-main' }, this.goBtn, this.speedBox), tabs);
    this.syncDock();
  }

  syncDock() {
    const open = this.e.state.phase === 'open';
    for (const b of Object.values(this.tabs)) b.disabled = open && b.dataset.lock === '1';
    this.goBtn.textContent = open ? '⏹ Tutup Toko' : `▶ Buka Toko (Hari ${this.e.state.day})`;
    this.goBtn.classList.toggle('stop', open);
    this.speedBox.style.display = open ? '' : 'none';
    for (const b of this.speedBox.children) b.classList.toggle('on', Number(b.dataset.s) === this.speed);
  }

  toggleShop() {
    if (this.e.state.phase === 'open') {
      this.ctx.closeShop();
      toast('Toko ditutup. Pelanggan yang tersisa diselesaikan dulu.');
    } else {
      if (this.e.usedCapacity() === 0) {
        if (!confirm('Stok kosong. Pelanggan tidak bisa membeli apa pun. Tetap buka toko?')) return;
      }
      this.closeModal();
      this.ctx.openShop();
      this.syncDock();
    }
  }

  // ---------- Modal dasar ----------
  openSheet(title, render) {
    this.closeModal();
    const body = h('div', { class: 'sheet-body' });
    const sheet = h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'x', onClick: () => this.closeModal(), 'aria-label': 'Tutup' }, '✕')),
      body);
    const overlay = h('div', { class: 'overlay', onClick: (ev) => { if (ev.target === overlay) this.closeModal(); } }, sheet);
    document.getElementById('modal-root').append(overlay);
    this.modal = { overlay, body, render };
    this.rerender();
  }

  rerender() {
    if (!this.modal) return;
    const top = this.modal.body.scrollTop;
    this.modal.body.replaceChildren(...[].concat(this.modal.render()));
    this.modal.body.scrollTop = top;
  }

  closeModal() {
    this.modal?.overlay.remove();
    this.modal = null;
  }

  act(fn, okMsg) {
    try {
      fn();
      if (okMsg) toast(okMsg, 'ok');
      this.ctx.persist();
      this.ctx.scene()?.refreshShelves();
    } catch (err) {
      toast(err.message || String(err), 'err');
    }
    this.refreshHud();
    this.rerender();
  }

  // ---------- Grosir ----------
  openGrosir() {
    this.sel = this.sel || {};
    this.openSheet('🛒 Grosir', () => {
      const e = this.e;
      const used = e.usedCapacity();
      const cap = e.capacity();
      const out = [
        h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, 'Kapasitas toko'), h('span', { class: 'price' }, `${used} / ${cap}`)),
          h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (used / cap) * 100)}%` })),
          h('div', { class: 'sub' }, `Uang: ${rp(e.state.ledger.balance)}. Harga grosir berubah tiap hari.`)),
      ];
      for (const it of e.unlockedItems()) {
        const s = (this.sel[it.id] ||= { q: Math.min(3, e.maxQuality()), n: 5 });
        s.q = Math.min(s.q, e.maxQuality());
        const unit = e.wholesalePrice(it.id, s.q);
        const yesterday = e.state.day > 1 ? e.wholesalePrice(it.id, s.q, e.state.day - 1) : unit;
        const diff = unit - yesterday;
        const max = e.maxAffordable(it.id, s.q);
        s.n = Math.max(1, Math.min(s.n, Math.max(1, max)));
        const total = unit * s.n;
        const qSel = h('select', { onChange: (ev) => { s.q = Number(ev.target.value); this.rerender(); } },
          QUALITIES.filter((q) => q.id <= e.maxQuality()).map((q) => h('option', { value: q.id, selected: q.id === s.q }, `${q.name} ${stars(q.stars)} · ${rp(e.wholesalePrice(it.id, q.id))}`)));
        const nInput = h('input', { type: 'number', min: 1, max: Math.max(1, max), value: s.n, inputMode: 'numeric', onChange: (ev) => { s.n = Math.max(1, Math.floor(Number(ev.target.value) || 1)); this.rerender(); } });
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' },
            h('div', {}, h('div', { class: 'card-title' }, it.name), h('div', { class: 'sub' }, it.category)),
            h('div', { class: 'price' }, rp(unit), ' ', h('span', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : 'sub' }, diff === 0 ? '' : (diff > 0 ? `▲${diff}` : `▼${-diff}`)))),
          qSel,
          h('div', { class: 'row' },
            h('div', { class: 'stepper' },
              h('button', { onClick: () => { s.n = Math.max(1, s.n - 1); this.rerender(); } }, '−'),
              nInput,
              h('button', { onClick: () => { s.n = Math.min(Math.max(1, max), s.n + 1); this.rerender(); } }, '+')),
            h('button', { class: 'btn secondary small', onClick: () => { s.n = Math.max(1, max); this.rerender(); } }, `Maks (${max})`),
            h('div', { class: 'grow price', style: 'text-align:right' }, rp(total))),
          h('button', { class: 'btn', disabled: max < 1 || s.n > max, onClick: () => this.act(() => e.buyStock(it.id, s.q, s.n), `Dibeli ${s.n} ${it.name}`) },
            max < 1 ? 'Tidak bisa beli (uang/ruang kurang)' : `Beli ${s.n} · ${rp(total)}`)));
      }
      const locked = ITEMS.filter((i) => !e.isUnlocked(i.id));
      if (locked.length) out.push(h('div', { class: 'sub' }, `Terkunci: ${locked.map((i) => i.name).join(', ')} (buka lewat Kontrak Supplier).`));
      return out;
    });
  }

  // ---------- Harga ----------
  openHarga() {
    this.openSheet('🏷️ Atur Harga Jual', () => {
      const e = this.e;
      const lots = e.stockLots();
      const out = [h('div', { class: 'sub' }, 'Harga di bawah pasar menarik lebih banyak pelanggan. Di atas pasar, hanya pembeli royal yang mau. Si Pelit hanya membeli jika murah.')];
      if (!lots.length) out.push(h('div', { class: 'card' }, 'Belum ada stok. Beli dulu di Grosir.'));
      for (const lot of lots) {
        const ref = e.retailRef(lot.itemId, lot.quality);
        const price = e.priceOf(lot.itemId, lot.quality);
        const unitCost = Math.round(lot.cost / lot.qty);
        const margin = price - unitCost;
        const input = h('input', { type: 'number', min: 1, value: price, inputMode: 'numeric' });
        const apply = (v) => this.act(() => e.setPrice(lot.itemId, lot.quality, v));
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' },
            h('div', {}, h('div', { class: 'card-title' }, getItem(lot.itemId).name, ' ', h('span', { class: 'stars' }, stars(getQuality(lot.quality).stars))), h('div', { class: 'sub' }, `${getQuality(lot.quality).name} · stok ${lot.qty} · modal ±${rp(unitCost)}/unit`)),
            h('div', { class: 'price' }, `Pasar ${rp(ref)}`)),
          h('div', { class: 'row' },
            h('div', { class: 'grow' }, input),
            h('button', { class: 'btn small', onClick: () => apply(Math.floor(Number(input.value))) }, 'Simpan'),
            h('button', { class: 'btn secondary small', onClick: () => apply(e.suggestedPrice(lot.itemId, lot.quality)) }, 'Harga pasar')),
          h('div', { class: `sub ${margin < 0 ? 'bad' : 'good'}` }, `Untung per unit: ${margin >= 0 ? '+' : ''}${rp(margin)} (${Math.round((margin / Math.max(1, price)) * 100)}%)`)));
      }
      return out;
    });
  }

  // ---------- Stok ----------
  openStok() {
    this.openSheet('📦 Stok Toko', () => {
      const e = this.e;
      const lots = e.stockLots();
      const used = e.usedCapacity();
      const out = [h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, 'Kapasitas'), h('span', { class: 'price' }, `${used} / ${e.capacity()}`)),
        h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (used / e.capacity()) * 100)}%` })))];
      if (!lots.length) out.push(h('div', { class: 'card' }, 'Stok kosong.'));
      else {
        const value = lots.reduce((s, l) => s + l.cost, 0);
        out.push(h('div', { class: 'card' },
          h('table', {},
            h('tr', {}, h('th', {}, 'Barang'), h('th', {}, 'Qty'), h('th', {}, 'Modal'), h('th', {}, 'Harga')),
            lots.map((l) => h('tr', {}, h('td', {}, `${getItem(l.itemId).name} (${getQuality(l.quality).name})`), h('td', {}, l.qty), h('td', {}, rp(l.cost)), h('td', {}, rp(e.priceOf(l.itemId, l.quality)))))),
          h('div', { class: 'sub' }, `Nilai modal stok: ${rp(value)}`)));
      }
      return out;
    });
  }

  // ---------- Laporan ----------
  openLaporan() {
    this.openSheet('📈 Laporan Keuangan', () => {
      const s = this.e.state;
      const last = s.history[s.history.length - 1];
      const out = [h('div', { class: 'grid2' },
        h('div', { class: 'stat' }, 'Uang kas', h('b', {}, rp(s.ledger.balance))),
        h('div', { class: 'stat' }, 'Total omzet', h('b', {}, rp(s.stats.revenue))),
        h('div', { class: 'stat' }, 'Hari terbaik', h('b', {}, rp(s.stats.bestDay))),
        h('div', { class: 'stat' }, 'Total pelanggan', h('b', {}, s.stats.customers)))];
      if (last) out.push(this.summaryCard(last, `Hari ${last.day} (terakhir)`));
      if (s.history.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, '10 hari terakhir'),
          h('table', {},
            h('tr', {}, h('th', {}, 'Hari'), h('th', {}, 'Omzet'), h('th', {}, 'Laba'), h('th', {}, 'Plgn')),
            s.history.slice(-10).reverse().map((r) => h('tr', {}, h('td', {}, r.day), h('td', {}, rp(r.revenue)), h('td', { class: r.net >= 0 ? 'good' : 'bad' }, rp(r.net)), h('td', {}, `${r.served}/${r.customers}`))))));
      } else out.push(h('div', { class: 'card' }, 'Belum ada hari yang selesai. Buka toko dulu.'));
      const recent = s.ledger.entries.slice(-8).reverse();
      if (recent.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, 'Transaksi terakhir'),
          h('table', {}, recent.map((x) => h('tr', {}, h('td', {}, `H${x.day} ${x.desc}`), h('td', { class: x.amount >= 0 ? 'good' : 'bad' }, (x.amount >= 0 ? '+' : '') + rp(x.amount)))))));
      }
      return out;
    });
  }

  summaryCard(r, title) {
    return h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, title), h('span', { class: `price ${r.net >= 0 ? 'good' : 'bad'}` }, `${r.net >= 0 ? '+' : ''}${rp(r.net)}`)),
      h('table', {},
        h('tr', {}, h('td', {}, 'Omzet penjualan'), h('td', {}, rp(r.revenue))),
        h('tr', {}, h('td', {}, 'Modal barang terjual'), h('td', {}, '− ' + rp(r.cogs))),
        h('tr', {}, h('td', {}, 'Laba kotor'), h('td', {}, rp(r.grossProfit))),
        h('tr', {}, h('td', {}, 'Sewa toko'), h('td', {}, '− ' + rp(r.rent))),
        h('tr', {}, h('td', {}, h('b', {}, 'Laba bersih')), h('td', {}, h('b', {}, rp(r.net))))),
      h('div', { class: 'sub' }, `Pelanggan ${r.served}/${r.customers} terlayani · terjual ${r.soldUnits} unit · reputasi ${r.repDelta >= 0 ? '+' : ''}${r.repDelta}`),
      r.arrears > 0 ? h('div', { class: 'sub bad' }, `Tunggakan sewa: ${rp(r.arrears)}`) : null);
  }

  showDaySummary(summary) {
    this.openSheet(`🌙 Hari ${summary.day} selesai`, () => [
      this.summaryCard(summary, 'Ringkasan hari ini'),
      h('div', { class: 'card' }, `Kas sekarang: ${rp(summary.endCash)}. Belanja stok dan sesuaikan harga untuk besok.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: () => { this.closeModal(); this.openGrosir(); } }, '🛒 Belanja stok'),
        h('button', { class: 'btn secondary grow', onClick: () => this.closeModal() }, 'Tutup')),
    ]);
    this.refreshHud();
  }

  // ---------- Upgrade ----------
  openUpgrade() {
    this.openSheet('⚙️ Upgrade Toko', () => {
      const e = this.e;
      return UPGRADES.map((u) => {
        const lvl = e.state.upgrades[u.id];
        const cost = e.upgradeCost(u.id);
        return h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('div', { class: 'card-title' }, u.name), h('span', { class: 'badge' }, `Level ${lvl}/${u.costs.length}`)),
          h('div', { class: 'sub' }, u.desc),
          h('div', { class: 'meter' }, h('i', { style: `width:${(lvl / u.costs.length) * 100}%` })),
          cost === null
            ? h('div', { class: 'sub good' }, 'Level maksimum')
            : h('button', { class: 'btn', disabled: !(e.state.ledger.balance >= cost), onClick: () => this.act(() => e.buyUpgrade(u.id), `${u.name} naik level!`) }, `Upgrade · ${rp(cost)}`));
      });
    });
  }

  // ---------- Menu ----------
  openMenu() {
    this.openSheet('☰ Menu', () => {
      const e = this.e;
      const ta = h('textarea', { placeholder: 'Tempel isi berkas simpanan di sini untuk mengimpor...' });
      const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onChange: async (ev) => {
        const f = ev.target.files[0];
        if (f) ta.value = await f.text();
      } });
      return [
        h('div', { class: 'card' }, h('b', {}, 'Simpan'),
          h('div', { class: 'sub' }, 'Game tersimpan otomatis di perangkat setiap kali toko tutup. Hari yang sedang berjalan tidak disimpan.'),
          h('button', { class: 'btn', onClick: () => { this.ctx.persist(true); toast('Tersimpan', 'ok'); } }, '💾 Simpan sekarang')),
        h('div', { class: 'card' }, h('b', {}, 'Cadangan (ekspor / impor)'),
          h('button', { class: 'btn secondary', onClick: () => this.ctx.exportFile() }, '⬇️ Unduh berkas simpanan'),
          fileIn,
          h('button', { class: 'btn secondary', onClick: () => fileIn.click() }, '📂 Pilih berkas simpanan'),
          ta,
          h('button', { class: 'btn', onClick: () => {
            try { this.ctx.importText(ta.value); this.closeModal(); toast('Simpanan dimuat', 'ok'); } catch (err) { toast(err.message, 'err'); }
          } }, '⬆️ Impor dari teks')),
        h('div', { class: 'card' }, h('b', {}, 'Audit keuangan'),
          h('div', { class: 'sub' }, 'Memeriksa bahwa saldo sama dengan seluruh transaksi.'),
          h('button', { class: 'btn secondary', onClick: () => {
            const p = auditLedger(e.state.ledger);
            toast(p.length ? `Masalah: ${p[0]}` : '✅ Buku kas sehat, saldo cocok dengan transaksi', p.length ? 'err' : 'ok');
          } }, '🔍 Jalankan audit')),
        h('div', { class: 'card' }, h('b', {}, 'Game baru'),
          h('button', { class: 'btn danger', disabled: e.state.phase === 'open', onClick: () => {
            if (confirm('Hapus progres dan mulai game baru? Ini tidak bisa dibatalkan.')) { this.ctx.newGame(); this.closeModal(); }
          } }, '🗑️ Mulai game baru')),
        h('div', { class: 'sub', style: 'text-align:center' }, `Fajmuls Simulator v0.1 · 1 hari = ${DAY_LENGTH_SEC}s pada 1x`),
      ];
    });
  }
}

export { lotKey };
