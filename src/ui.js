import {
  CATEGORIES, QUALITIES, STAR_PERKS, getItem, getQuality, itemsOf, parseLotKey,
} from './core/catalog.js';
import { DAY_LENGTH_SEC } from './core/engine.js';
import { auditLedger } from './core/ledger.js';
import { audio } from './audio.js';
import { ACHIEVEMENTS } from './core/goals.js';

export const rp = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
export function rpShort(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}Rp ${(a / 1e9).toFixed(2).replace('.', ',')} M`;
  if (a >= 1e7) return `${sign}Rp ${(a / 1e6).toFixed(1).replace('.', ',')} jt`;
  return rp(n);
}
export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
export const qStars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

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

// Notifikasi bertumpuk di pojok kanan atas: pesan sama digabung (x2), maksimal 4 terlihat.
const MAX_TOASTS = 4;
export const notifLog = [];
export function toast(msg, kind = '') {
  notifLog.unshift({ msg, kind, t: Date.now() });
  if (notifLog.length > 60) notifLog.pop();
  const root = document.getElementById('toast-root');
  if (kind === 'err') audio.play('err');
  const last = root.lastElementChild;
  if (last && last.dataset.msg === msg && last.dataset.kind === kind) {
    const n = Number(last.dataset.n || 1) + 1;
    last.dataset.n = n;
    last.querySelector('.cnt').textContent = ` ×${n}`;
    clearTimeout(last._t);
    last._t = setTimeout(() => last.remove(), 2600);
    return;
  }
  const el = h('div', { class: `toast ${kind}`, onClick: () => el.remove() }, h('span', {}, msg), h('b', { class: 'cnt' }));
  el.dataset.msg = msg;
  el.dataset.kind = kind;
  root.append(el);
  while (root.children.length > MAX_TOASTS) root.firstElementChild.remove();
  el._t = setTimeout(() => el.remove(), 2600);
}

const A11Y_KEY = 'pasarsatwa_a11y';
export function getA11y() {
  try { return { big: false, contrast: false, ...JSON.parse(localStorage.getItem(A11Y_KEY) || '{}') }; } catch { return { big: false, contrast: false }; }
}
export function applyA11y() {
  const a = getA11y();
  document.documentElement.classList.toggle('big', !!a.big);
  document.documentElement.classList.toggle('contrast', !!a.contrast);
}
export function setA11y(patch) {
  try { localStorage.setItem(A11Y_KEY, JSON.stringify({ ...getA11y(), ...patch })); } catch { /* abaikan */ }
  applyA11y();
}
let installEvt = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (ev) => { ev.preventDefault(); installEvt = ev; });
  applyA11y();
}

export const ITEM_ICON = {
  cacing: '🪱', jangkrik: '🦗', pelet: '🥣', voer: '🌾',
  lele: '🐟', mas: '🐠', cupang: '🐡', koi: '🎏', arwana: '🐉',
  pipit: '🐤', perkutut: '🕊️', kenari: '🐥', lovebird: '🦜', murai: '🐦',
  kura: '🐢', bunglon: '🦎', gecko: '🦖', ularjagung: '🐍', iguana: '🐊',
  hamster: '🐹', kelinci: '🐰', marmut: '🐭', landak: '🦔', glider: '🐿️',
};
export const iname = (it) => `${ITEM_ICON[it.id] || '📦'} ${it.name}`;

export const CAT_EMOJI = { perlengkapan: '🪱', ikan: '🐟', burung: '🐦', reptil: '🦎', kecil: '🐹' };

export const FLOW_LABEL = {
  sale: 'Penjualan', reward: 'Hadiah', tip: 'Tip pelanggan', upkeep: 'Perawatan', tax: 'Pajak', buy_stock: 'Belanja stok', rent: 'Sewa toko', wage: 'Gaji karyawan', arrears: 'Tunggakan',
  upgrade: 'Upgrade', expand: 'Perluas toko', species: 'Kontrak spesies', potion: 'Ramuan', breeding: 'Breeding',
  invest: 'Deposito', invest_return: 'Deposito kembali', interest: 'Bunga', stock_buy: 'Beli saham', stock_sell: 'Jual saham',
  property: 'Beli properti', property_sale: 'Jual properti', rent_income: 'Sewa properti', loan: 'Pinjaman', loan_pay: 'Cicilan pinjaman',
};

export class UI {
  constructor(ctx) {
    // ctx: { engine, scene(), persist(), openShop(), closeShop(), setSpeed(), newGame(), importText(), exportFile() }
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
    this.hudStar = h('span', { class: 'hud-chip star' });
    this.hudDebt = h('span', { class: 'hud-chip warn', style: 'display:none' });
    this.hudCash = h('div', { class: 'hud-cash' });
    this.hudLive = h('div', { class: 'sub' });
    this.hudBar = h('i');
    this.hudEvent = h('span', { class: 'hud-chip' });
    this.hudLow = h('span', { class: 'hud-chip warn', style: 'display:none' });
    this.hudQuest = h('button', { class: 'hud-chip quest', onClick: () => this.openMisi() });
    this.bellBtn = h('button', { class: 'icon-btn', 'aria-label': 'Riwayat notifikasi', onClick: () => this.openRiwayat() }, '🔔');
    this.soundBtn = h('button', { class: 'icon-btn', 'aria-label': 'Suara', onClick: () => { audio.unlock(); audio.setMuted(!audio.muted); this.syncSound(); } });
    hud.append(
      h('div', { class: 'hud-row' }, h('div', { class: 'hud-title' }, '🐾 Pasar Satwa'), h('div', { class: 'row', style: 'gap:6px' }, this.hudDay, this.hudStar, this.bellBtn, this.soundBtn)),
      h('div', { class: 'hud-row' }, this.hudCash, h('div', { class: 'hud-chips' }, this.hudQuest, this.hudDebt, this.hudLow, this.hudEvent)),
      h('div', { class: 'hud-row' }, this.hudLive),
      h('div', { class: 'bar' }, this.hudBar),
    );
    this.syncSound();
    this.refreshHud();
  }

  // ---------- Pilih barang dari rak (mode manual) ----------
  openPicker(catId) {
    const scene = this.ctx.scene();
    this.openSheet(`${CAT_EMOJI[catId]} Ambil dari rak`, () => {
      const e = this.e;
      const wanted = new Set((scene?.waitingOrders() || []).map((o) => o.itemId));
      const out = [h('div', { class: 'sub' }, 'Pilih barang yang diminta pelanggan (📌), lalu ketuk pelanggannya untuk menyerahkan. Waktu berhenti selama kamu memilih.')];
      const lots = e.stockLots().filter((l) => getItem(l.itemId).cat === catId);
      if (!lots.length) out.push(h('div', { class: 'card' }, 'Rak kosong. Belanja dulu saat toko tutup.'));
      for (const l of lots) {
        const it = getItem(l.itemId);
        out.push(h('button', { class: `card item${wanted.has(l.itemId) ? ' hero' : ''}`, 'data-cat': it.cat, style: 'text-align:left',
          onClick: () => { scene?.setCarry(l.itemId, l.quality); audio.play('ok'); this.closeModal(); } },
        h('div', { class: 'card-top' }, h('b', {}, `${wanted.has(l.itemId) ? '📌 ' : ''}${iname(it)}`), h('span', { class: 'price' }, rp(e.priceOf(l.itemId, l.quality)))),
        h('div', { class: 'sub' }, `${getQuality(l.quality).name} ${qStars(l.quality)} · stok ${l.qty}`)));
      }
      return out;
    });
    scene?.setPaused(true);
    this.pickerOpen = true;
  }

  // ---------- Tutorial ----------
  tutorialSteps() {
    return [
      { mid: true, title: 'Selamat datang di Pasar Satwa! 🐾', text: 'Kamu pemilik toko hewan dan perlengkapannya. Tutorial singkat ini 8 langkah, bisa dilewati kapan saja.' },
      { el: () => this.tabs.grosir, title: '1. Belanja di Grosir', text: 'Beli stok cacing, pakan, dan hewan. Harga grosir berubah tiap hari, tombol +10 / +100 / Maks mempercepat.' },
      { el: () => this.tabs.harga, title: '2. Atur harga', text: 'Harga jual menentukan untung. Terlalu mahal, pelanggan pergi. Terlalu murah, untung tipis.' },
      { el: () => this.goBtn, title: '3. Buka toko', text: 'Tekan Buka Toko. Di mode 🖐 Manual, pelanggan antre dengan pesanan di atas kepalanya: ketuk rak untuk mengambil barang (waktu berhenti), lalu ketuk pelanggannya untuk menyerahkan. Cepat = tip 10%. Mode 🤖 Otomatis melayani sendiri.' },
      { el: () => this.speedBox, title: '4. Kecepatan', text: 'Percepat hari dengan 2x, 4x, 8x. Kecepatan di atas 1x dibuka lewat Upgrade Mesin Waktu.' },
      { el: () => this.hudQuest, title: '5. Misi harian', text: 'Selesaikan misi untuk hadiah uang dan poin skill. Ketuk untuk melihat dan mengambil hadiah.' },
      { el: () => this.tabs.fitur, title: '6. Fitur', text: 'Di sini ada Misi, Buku Langganan (pelanggan tetap yang makin akrab), Upgrade, Skill, Karyawan, Bank, dan lainnya.' },
      { el: () => this.tabs.menu, title: '7. Menu', text: 'Simpan, cadangkan, atur suara, huruf besar, dan ulangi tutorial ini kapan saja. Selamat berdagang!' },
    ];
  }

  startTutorial() {
    const t = this.e.state.tutorial;
    if (t.done) return;
    this.showTutorialStep();
  }

  clearTutorial() {
    document.querySelectorAll('.tut-hl').forEach((n) => n.classList.remove('tut-hl'));
    this.tutCard?.remove();
    this.tutCard = null;
  }

  showTutorialStep() {
    this.clearTutorial();
    const t = this.e.state.tutorial;
    const steps = this.tutorialSteps();
    if (t.done || t.step >= steps.length) { t.done = true; return; }
    const st = steps[t.step];
    const el = st.el?.();
    const ok = el && el.getBoundingClientRect().width > 0;
    if (ok) el.classList.add('tut-hl');
    const finish = () => { t.done = true; this.clearTutorial(); this.ctx.persist?.(); };
    const last = t.step === steps.length - 1;
    this.tutCard = h('div', { class: `tut-card${ok ? '' : ' mid'}` },
      h('b', {}, st.title), h('div', { class: 'sub' }, st.text),
      h('div', { class: 'row', style: 'justify-content:space-between' },
        h('button', { class: 'btn secondary small', onClick: finish }, 'Lewati'),
        h('span', { class: 'sub' }, `${t.step + 1}/${steps.length}`),
        h('button', { class: 'btn small', onClick: () => { audio.play('click'); if (last) finish(); else { t.step += 1; this.showTutorialStep(); } } }, last ? 'Selesai' : 'Lanjut')));
    document.body.append(this.tutCard);
  }

  openRiwayat() {
    this.openSheet('🔔 Riwayat notifikasi', () => [
      notifLog.length ? null : h('div', { class: 'card' }, 'Belum ada notifikasi.'),
      ...notifLog.map((n) => h('div', { class: `card${n.kind === 'err' ? ' warn' : ''}` }, h('div', {}, n.msg), h('div', { class: 'sub' }, new Date(n.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })))),
    ].filter(Boolean));
  }

  syncSound() {
    this.soundBtn.textContent = audio.muted ? '🔇' : '🔊';
  }

  refreshHud(tick) {
    const e = this.e;
    const s = e.state;
    this.hudDay.innerHTML = `Hari <b>${s.day}</b>`;
    this.hudStar.innerHTML = `<b>${starsText(s.stars)}</b>`;
    this.hudCash.textContent = rpShort(s.ledger.balance);
    const owed = s.arrears + e.loanOutstanding();
    if (owed > 0) {
      this.hudDebt.style.display = '';
      this.hudDebt.textContent = `Utang ${rpShort(owed)}`;
    } else this.hudDebt.style.display = 'none';

    e.ensureQuests();
    for (const n of e.takeNotes()) toast(n.text, 'ok');
    const claimable = this.claimableCount();
    const doneQ = s.quests.daily.filter((x) => x.prog >= x.goal).length;
    this.hudQuest.textContent = `🎯 ${doneQ}/${s.quests.daily.length}${claimable ? ' 🎁' : ''}`;
    this.hudQuest.classList.toggle('ready', claimable > 0);
    this.tabs.fitur?.classList.toggle('badge-dot', claimable > 0);
    const ev = e.mods().event;
    this.hudEvent.textContent = `${ev.icon} ${ev.name}`;
    const lowN = e.lowStock().length;
    this.hudLow.style.display = lowN && s.phase === 'idle' ? '' : 'none';
    this.hudLow.textContent = `⚠ ${lowN} tipis`;
    if (s.phase === 'open' && tick) {
      const t = tick.today;
      this.hudLive.textContent = `Toko BUKA · dilayani ${t.served}/${t.customers} · omzet ${rpShort(t.revenue)}${tick.closing ? ' · menutup...' : ''}`;
      this.hudBar.style.width = `${Math.round(tick.progress * 100)}%`;
    } else if (s.phase === 'idle') {
      const sp = e.starProgress();
      this.hudLive.textContent = `Toko TUTUP · stok ${e.usedCapacity()}/${e.capacity()} · reputasi ${sp.rep.toFixed(1)}${sp.to ? ` / ${sp.to}` : ''}`;
      this.hudBar.style.width = `${sp.pct}%`;
      this.hudBar.parentElement.title = sp.to ? `Reputasi ${sp.rep.toFixed(1)} / ${sp.to} untuk bintang berikutnya` : 'Bintang maksimum';
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
      ['fitur', '🗂️', 'Fitur', () => this.openFitur(), false],
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
    for (const [label, s] of [['⏸', 0], ['1x', 1], ['2x', 2], ['4x', 4], ['8x', 8]]) {
      const b = h('button', { class: 'btn secondary', onClick: () => this.pickSpeed(s) }, label);
      b.dataset.s = s;
      b.dataset.label = label;
      this.speedBox.append(b);
    }
    let m = '1';
    try { m = localStorage.getItem('pasarsatwa_manual') ?? '1'; } catch { /* abaikan */ }
    this.manual = m === '1';
    this.manualBtn = h('button', { class: 'btn secondary', onClick: () => {
      this.manual = !this.manual;
      try { localStorage.setItem('pasarsatwa_manual', this.manual ? '1' : '0'); } catch { /* abaikan */ }
      this.ctx.scene()?.setManual(this.manual);
      this.syncDock();
      toast(this.manual ? 'Mode manual: kamu melayani pelanggan sendiri (tip cepat 10%)' : 'Mode otomatis: pelanggan dilayani sendiri');
    } });
    dock.append(h('div', { class: 'dock-main' }, this.goBtn, this.speedBox, this.manualBtn), tabs);
    this.syncDock();
  }

  pickSpeed(s) {
    const e = this.e;
    if (s > e.maxSpeed()) {
      if (e.state.phase === 'open') return toast('Tutup toko dulu, lalu beli Mesin Waktu di Fitur → Upgrade', 'err');
      const cost = e.upgradeCost('kecepatan');
      if (cost === null) return;
      if (confirm(`Buka kecepatan ${e.maxSpeed() === 2 ? '4x' : '8x'} dengan Mesin Waktu seharga ${rp(cost)}?`)) {
        this.act(() => e.buyUpgrade('kecepatan'), `Kecepatan ${e.maxSpeed()}x terbuka!`);
      }
      return;
    }
    this.speed = s;
    this.ctx.setSpeed(s);
    this.syncDock();
  }

  syncDock() {
    const open = this.e.state.phase === 'open';
    if (this.speed > this.e.maxSpeed()) this.speed = this.e.maxSpeed();
    for (const b of Object.values(this.tabs)) b.disabled = open && b.dataset.lock === '1';
    this.goBtn.textContent = open ? '⏹ Tutup Toko' : `▶ Buka Toko (Hari ${this.e.state.day})`;
    this.goBtn.classList.toggle('stop', open);
    this.manualBtn.textContent = this.manual ? '🖐 Manual' : '🤖 Otomatis';
    for (const b of this.speedBox.children) {
      const sp = Number(b.dataset.s);
      const locked = sp > this.e.maxSpeed();
      b.classList.toggle('on', sp === this.speed);
      b.classList.toggle('locked', locked);
      b.textContent = locked ? `🔒${b.dataset.label}` : b.dataset.label;
    }
  }

  toggleShop() {
    if (this.e.state.phase === 'open') {
      this.ctx.closeShop();
      audio.play('close');
      toast('Toko ditutup. Pelanggan yang tersisa diselesaikan dulu.');
    } else {
      if (this.e.usedCapacity() === 0) {
        if (!confirm('Stok kosong. Pelanggan tidak bisa membeli apa pun. Tetap buka toko?')) return;
      }
      this.closeModal();
      this.speed = this.speed === 0 ? 1 : this.speed;
      this.ctx.scene()?.setManual(this.manual);
      this.ctx.openShop();
      audio.play('open');
      this.ctx.setSpeed(this.speed);
      const log = this.e.lastRestock;
      if (log?.length) toast(`Penjaga Stok mengisi ${log.length} jenis barang`, 'ok');
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
    if (this.pickerOpen) { this.pickerOpen = false; this.ctx.scene()?.setPaused(false); }
    this.modal?.overlay.remove();
    this.modal = null;
  }

  // Menjalankan aksi game: tampilkan pesan, simpan, segarkan tampilan.
  act(fn, okMsg, sound = 'ok') {
    try {
      const r = fn();
      if (sound) audio.play(sound);
      const msg = typeof okMsg === 'function' ? okMsg(r) : okMsg;
      if (msg) toast(msg, 'ok');
      this.ctx.persist();
      this.ctx.scene()?.refreshShelves();
    } catch (err) {
      toast(err.message || String(err), 'err');
    }
    this.refreshHud();
    this.rerender();
  }

  numInput({ value, min = 0, max = 1e12, step = 1, onChange, width }) {
    const input = h('input', { type: 'number', min, max, value, inputMode: 'numeric', style: width ? `width:${width}px` : null,
      onChange: (ev) => onChange(Math.floor(Number(ev.target.value) || 0)) });
    return input;
  }

  chips(options, current, onPick) {
    return h('div', { class: 'chips' }, options.map((o) => h('button', { class: `chip${o.id === current ? ' on' : ''}`, onClick: () => onPick(o.id) }, o.label)));
  }

  lockCard(text) {
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, `🔒 ${text}`));
  }

  // ---------- Grosir ----------
  loadPrefs() {
    try {
      const v = JSON.parse(localStorage.getItem('pasarsatwa_buyprefs'));
      if (v && typeof v === 'object') return v;
    } catch { /* abaikan */ }
    return {};
  }

  savePrefs() {
    try { localStorage.setItem('pasarsatwa_buyprefs', JSON.stringify(this.sel)); } catch { /* abaikan */ }
  }

  openGrosir() {
    this.sel = this.sel || this.loadPrefs();
    this.grosirCat = this.grosirCat || 'perlengkapan';
    this.openSheet('🛒 Grosir', () => {
      const e = this.e;
      const s = e.state;
      const used = e.usedCapacity();
      const cap = e.capacity();
      const m = e.mods();
      const openCats = CATEGORIES.filter((c) => e.categoryOpen(c.id));
      if (!openCats.some((c) => c.id === this.grosirCat)) this.grosirCat = openCats[0].id;
      const out = [
        h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, 'Kapasitas toko'), h('span', { class: 'price' }, `${used} / ${cap}`)),
          h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (used / cap) * 100)}%` })),
          h('div', { class: 'sub' }, `Uang: ${rp(s.ledger.balance)} · ${m.event.icon} ${m.event.name}: ${m.event.desc}`),
          m.disc > 0 ? h('div', { class: 'sub good' }, `Diskon grosir aktif ${Math.round(m.disc * 100)}%`) : null,
          s.breeding.length ? h('div', { class: 'sub' }, `Termasuk ${s.breeding.length * 2} induk di kandang breeding`) : null,
          e.skillRank('insting') > 0 ? h('div', { class: 'sub' }, `🔮 Besok: ${e.eventOf(s.day + 1).icon} ${e.eventOf(s.day + 1).name}`) : null),
        h('button', { class: 'btn secondary', onClick: () => this.act(() => e.restockLast(), (log) => (log.length ? `Isi ulang ${log.length} jenis barang · ${rp(log.reduce((a, b) => a + b.cost, 0))}` : 'Semua barang sudah cukup atau uang/ruang kurang')) }, '🔁 Isi ulang yang menipis (sesuai pembelian terakhir)'),
        Object.keys(s.restock).length ? h('button', { class: 'btn secondary', onClick: () => this.act(() => e.refillToTargets(), (log) => (log.length ? `Diisi ke target: ${log.length} jenis · ${rp(log.reduce((a, b) => a + b.cost, 0))}` : 'Semua sudah mencapai target atau uang/ruang kurang'), 'buy') }, '🎯 Isi semua ke target stok') : null,
        this.chips(openCats.map((c) => ({ id: c.id, label: `${CAT_EMOJI[c.id]} ${c.short}` })), this.grosirCat, (id) => { this.grosirCat = id; this.rerender(); }),
      ];
      for (const it of itemsOf(this.grosirCat)) {
        if (!e.isUnlocked(it.id)) {
          out.push(this.lockCard(`${it.name}: buka lewat Daftar Hewan (Fitur → Daftar Hewan)`));
          continue;
        }
        const sel = (this.sel[it.id] ||= { q: Math.min(3, e.maxQuality()), n: 5 });
        sel.q = Math.min(Math.max(1, sel.q), e.maxQuality());
        const unit = e.wholesalePrice(it.id, sel.q);
        const yesterday = s.day > 1 ? e.wholesalePrice(it.id, sel.q, s.day - 1) : unit;
        const diff = unit - yesterday;
        const avg = it.wholesale * getQuality(sel.q).mult * (1 - m.disc);
        const max = e.maxAffordable(it.id, sel.q);
        // sel.n adalah jumlah yang DIINGINKAN dan tidak ikut terpotong oleh uang/ruang, supaya tidak kembali ke 1.
        const qty = Math.max(0, Math.min(sel.n, max));
        const total = unit * qty;
        const have = e.totalQty(it.id);
        const setN = (v) => { sel.n = Math.max(1, Math.min(9999, Math.floor(v))); this.savePrefs(); this.rerender(); };
        const badge = unit <= avg * 0.93 ? h('span', { class: 'badge good' }, 'murah') : unit >= avg * 1.07 ? h('span', { class: 'badge bad' }, 'mahal') : null;
        const qSel = h('select', { onChange: (ev) => { sel.q = Number(ev.target.value); this.savePrefs(); this.rerender(); } },
          QUALITIES.filter((q) => q.id <= e.maxQuality()).map((q) => h('option', { value: q.id, selected: q.id === sel.q }, `${q.name} ${qStars(q.stars)} · ${rp(e.wholesalePrice(it.id, q.id))}`)));
        const nInput = h('input', { type: 'number', min: 1, max: 9999, value: sel.n, inputMode: 'numeric', onChange: (ev) => setN(Number(ev.target.value) || 1) });
        const quick = (label, delta) => h('button', { class: 'qbtn', onClick: () => { audio.play('click'); setN(sel.n + delta); } }, label);
        out.push(h('div', { class: 'card item', 'data-cat': it.cat },
          h('div', { class: 'card-top' },
            h('div', {}, h('div', { class: 'card-title' }, iname(it), ' ', badge), h('div', { class: 'sub' }, `stok ${have}${s.lastBuy[it.id] ? ` · terakhir beli ${s.lastBuy[it.id].n}` : ''}`)),
            h('div', { class: 'price' }, rp(unit), ' ', h('span', { class: diff > 0 ? 'up' : diff < 0 ? 'down' : 'sub' }, diff === 0 ? '' : (diff > 0 ? `▲${diff}` : `▼${-diff}`)))),
          e.skillRank('insting') > 0 ? h('div', { class: 'sub' }, `🔮 Besok ±${rp(e.wholesalePrice(it.id, sel.q, s.day + 1))}`) : null,
          qSel,
          h('div', { class: 'qrow' }, quick('−10', -10), quick('−1', -1), h('div', { class: 'stepper' }, nInput), quick('+1', 1), quick('+5', 5), quick('+10', 10), quick('+100', 100)),
          h('div', { class: 'row' },
            h('button', { class: 'btn secondary small', onClick: () => { audio.play('click'); setN(Math.max(1, max)); } }, `Maks (${max})`),
            h('button', { class: 'btn secondary small', onClick: () => { audio.play('click'); setN(1); } }, 'Reset'),
            h('div', { class: 'grow price', style: 'text-align:right' }, rp(total))),
          h('button', { class: 'btn', disabled: qty < 1, onClick: () => this.act(() => e.buyStock(it.id, sel.q, qty), `Dibeli ${qty} ${it.name}`, 'buy') },
            max < 1 ? 'Tidak bisa beli (uang/ruang kurang)' : `Beli ${qty}${qty < sel.n ? ` (maks dari ${sel.n})` : ''} · ${rp(total)}`)));
      }
      return out;
    });
  }

  // ---------- Harga ----------
  openHarga() {
    this.pctInput = this.pctInput ?? -10;
    this.openSheet('🏷️ Atur Harga Jual', () => {
      const e = this.e;
      const s = e.state;
      const lots = e.stockLots();
      const bulk = (pct, label) => h('button', { class: 'btn secondary small', onClick: () => this.act(() => e.setAllPrices(pct), (n) => `${n} barang dihargai ${label}`) }, label);
      const pctBox = this.numInput({ value: this.pctInput, min: -90, max: 400, width: 80, onChange: (v) => { this.pctInput = v; this.rerender(); } });
      pctBox.min = -90;
      const out = [
        h('div', { class: 'card' },
          h('b', {}, 'Atur semua harga sekaligus'),
          h('div', { class: 'row' }, bulk(0, 'Harga pasar'), bulk(-5, 'Pasar -5%'), bulk(-10, 'Pasar -10%'), bulk(10, 'Pasar +10%')),
          h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Lainnya (%):'), pctBox,
            h('button', { class: 'btn small', onClick: () => this.act(() => e.setAllPrices(this.pctInput), (n) => `${n} barang dihargai pasar ${this.pctInput >= 0 ? '+' : ''}${this.pctInput}%`) }, 'Terapkan')),
          h('label', { class: 'row sub' },
            h('input', { type: 'checkbox', checked: s.autoPrice.on, style: 'width:auto;min-height:0', onChange: (ev) => this.act(() => e.setAutoPrice(ev.target.checked, this.pctInput), ev.target.checked ? `Harga otomatis aktif: pasar ${this.pctInput >= 0 ? '+' : ''}${this.pctInput}% tiap toko dibuka` : 'Harga otomatis dimatikan') }),
            `Otomatis tiap toko dibuka (mengikuti harga pasar ${s.autoPrice.on ? `${s.autoPrice.pct >= 0 ? '+' : ''}${s.autoPrice.pct}%` : 'sesuai kolom di atas'})`),
          h('div', { class: 'sub' }, 'Harga pasar berubah tiap hari. Di bawah pasar menarik lebih banyak pelanggan; Si Pelit hanya membeli jika murah.')),
      ];
      if (!lots.length) out.push(h('div', { class: 'card' }, 'Belum ada stok. Beli dulu di Grosir.'));
      for (const cat of CATEGORIES) {
        const catLots = lots.filter((l) => getItem(l.itemId).cat === cat.id);
        if (!catLots.length) continue;
        out.push(h('div', { class: 'sub', style: 'font-weight:700;margin-top:4px' }, `${CAT_EMOJI[cat.id]} ${cat.name}`));
        for (const lot of catLots) {
          const ref = e.retailRef(lot.itemId, lot.quality);
          const price = e.priceOf(lot.itemId, lot.quality);
          const unitCost = Math.round(lot.cost / lot.qty);
          const margin = price - unitCost;
          const input = h('input', { type: 'number', min: 1, value: price, inputMode: 'numeric' });
          const apply = (v) => this.act(() => e.setPrice(lot.itemId, lot.quality, v));
          out.push(h('div', { class: 'card' },
            h('div', { class: 'card-top' },
              h('div', {}, h('div', { class: 'card-title' }, iname(getItem(lot.itemId)), ' ', h('span', { class: 'stars' }, qStars(getQuality(lot.quality).stars))),
                h('div', { class: 'sub' }, `${getQuality(lot.quality).name} · stok ${lot.qty} · modal ±${rp(unitCost)}/unit`)),
              h('div', { class: 'price' }, `Pasar ${rp(ref)}`)),
            h('div', { class: 'row' },
              h('div', { class: 'grow' }, input),
              h('button', { class: 'btn small', onClick: () => apply(Math.floor(Number(input.value))) }, 'Simpan'),
              h('button', { class: 'btn secondary small', onClick: () => apply(e.suggestedPrice(lot.itemId, lot.quality)) }, 'Pasar')),
            h('div', { class: `sub ${margin < 0 ? 'bad' : 'good'}` }, `${margin < 0 ? '⚠ RUGI ' : ''}Untung per unit: ${margin >= 0 ? '+' : ''}${rp(margin)} (${Math.round((margin / Math.max(1, price)) * 100)}%)`)));
        }
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
      const low = e.lowStock();
      if (low.length) out.push(h('div', { class: 'card' }, h('b', { class: 'bad' }, '⚠ Stok menipis'), h('div', { class: 'sub' }, low.map((l) => `${iname(getItem(l.itemId))} (${l.qty})`).join(', '))));
      if (!lots.length) out.push(h('div', { class: 'card' }, 'Stok kosong.'));
      else {
        const value = lots.reduce((s, l) => s + l.cost, 0);
        for (const cat of CATEGORIES) {
          const catLots = lots.filter((l) => getItem(l.itemId).cat === cat.id);
          if (!catLots.length) continue;
          out.push(h('div', { class: 'card' }, h('b', {}, `${CAT_EMOJI[cat.id]} ${cat.name}`),
            h('table', {},
              h('tr', {}, h('th', {}, 'Barang'), h('th', {}, 'Qty'), h('th', {}, 'Modal'), h('th', {}, 'Harga')),
              catLots.map((l) => h('tr', {}, h('td', {}, `${iname(getItem(l.itemId))} (${getQuality(l.quality).name})`), h('td', {}, l.qty), h('td', {}, rp(l.cost)), h('td', {}, rp(e.priceOf(l.itemId, l.quality))))))));
        }
        out.push(h('div', { class: 'sub' }, `Nilai modal stok: ${rp(value)}`));
      }
      return out;
    });
  }

  // ---------- Laporan ----------
  openLaporan() {
    this.openSheet('📈 Laporan Keuangan', () => {
      const e = this.e;
      const s = e.state;
      const last = s.history[s.history.length - 1];
      const out = [h('div', { class: 'grid2' },
        h('div', { class: 'stat' }, 'Uang kas', h('b', {}, rp(s.ledger.balance))),
        h('div', { class: 'stat' }, 'Kekayaan bersih', h('b', {}, rpShort(e.netWorth()))),
        h('div', { class: 'stat' }, 'Total omzet', h('b', {}, rpShort(s.stats.revenue))),
        h('div', { class: 'stat' }, 'Hari terbaik', h('b', {}, rpShort(s.stats.bestDay))),
        h('div', { class: 'stat' }, 'Total pelanggan', h('b', {}, s.stats.customers)),
        h('div', { class: 'stat' }, 'Utang', h('b', {}, rpShort(s.arrears + e.loanOutstanding()))))];
      if (last) out.push(this.summaryCard(last, `Hari ${last.day} (terakhir)`));
      const itemStats = Object.entries(s.stats.items || {}).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 8);
      if (itemStats.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, '🏆 Terlaris (sepanjang waktu)'),
          h('table', {}, h('tr', {}, h('th', {}, 'Spesies'), h('th', {}, 'Terjual'), h('th', {}, 'Omzet')),
            itemStats.map(([id, st]) => h('tr', {}, h('td', {}, iname(getItem(id))), h('td', {}, st.units), h('td', {}, rpShort(st.revenue)))))));
      }
      if (s.history.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, '10 hari terakhir'),
          h('table', {},
            h('tr', {}, h('th', {}, 'Hari'), h('th', {}, 'Omzet'), h('th', {}, 'Laba'), h('th', {}, 'Plgn')),
            s.history.slice(-10).reverse().map((r) => h('tr', {}, h('td', {}, r.day), h('td', {}, rpShort(r.revenue)), h('td', { class: r.net >= 0 ? 'good' : 'bad' }, rpShort(r.net)), h('td', {}, `${r.served}/${r.customers}`))))));
      } else out.push(h('div', { class: 'card' }, 'Belum ada hari yang selesai. Buka toko dulu.'));
      const recent = s.ledger.entries.slice(-10).reverse();
      if (recent.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, 'Transaksi terakhir'),
          h('table', {}, recent.map((x) => h('tr', {}, h('td', {}, `H${x.day} ${x.desc}`), h('td', { class: x.amount >= 0 ? 'good' : 'bad' }, (x.amount >= 0 ? '+' : '') + rp(x.amount)))))));
      }
      return out;
    });
  }

  summaryCard(r, title) {
    const rows = [
      ['Omzet penjualan', rp(r.revenue)],
      ['Modal barang terjual', '− ' + rp(r.cogs)],
      ['Laba kotor', rp(r.grossProfit)],
      ['Sewa toko', '− ' + rp(r.rent)],
    ];
    if (r.wages) rows.push(['Gaji karyawan', '− ' + rp(r.wages)]);
    if (r.upkeep) rows.push(['Perawatan hewan & toko', '− ' + rp(r.upkeep)]);
    if (r.tax) rows.push(['Pajak', '− ' + rp(r.tax)]);
    return h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, title), h('span', { class: `price ${r.net >= 0 ? 'good' : 'bad'}` }, `${r.net >= 0 ? '+' : ''}${rp(r.net)}`)),
      h('table', {}, rows.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))),
        h('tr', {}, h('td', {}, h('b', {}, 'Laba operasional')), h('td', {}, h('b', {}, rp(r.net))))),
      r.propIncome ? h('div', { class: 'sub good' }, `+ Sewa properti ${rp(r.propIncome)}`) : null,
      r.depositReturn ? h('div', { class: 'sub good' }, `+ Deposito cair ${rp(r.depositReturn)} (bunga ${rp(r.depositInterest)})`) : null,
      r.loanPaid ? h('div', { class: 'sub' }, `− Cicilan bank ${rp(r.loanPaid)}`) : null,
      h('div', { class: 'sub' }, `Pelanggan ${r.served}/${r.customers} terlayani · terjual ${r.soldUnits} unit · reputasi ${r.repDelta >= 0 ? '+' : ''}${r.repDelta}`),
      r.arrears > 0 ? h('div', { class: 'sub bad' }, `Tunggakan sewa/gaji: ${rp(r.arrears)}`) : null);
  }

  showDaySummary(summary) {
    audio.play(summary.starUp ? 'star' : 'day');
    this.openSheet(`🌙 Hari ${summary.day} selesai`, () => {
      const e = this.e;
      const out = [];
      if (summary.starUp) {
        const perk = STAR_PERKS[summary.starUp.to - 1];
        out.push(h('div', { class: 'card hero' },
          h('div', { class: 'card-title' }, `⭐ Naik bintang ${summary.starUp.to}: ${perk.title}!`),
          h('div', { class: 'sub' }, perk.text.map((t) => `• ${t}`).join('\n'))));
      }
      out.push(this.summaryCard(summary, 'Ringkasan hari ini'));
      if (summary.newAchievements?.length) {
        out.push(h('div', { class: 'card hero' }, h('b', {}, '🏅 Pencapaian baru!'),
          summary.newAchievements.map((id) => { const a = ACHIEVEMENTS.find((x) => x.id === id); return h('div', { class: 'sub' }, `${a.icon} ${a.name}: ${a.desc}`); }),
          h('button', { class: 'btn small', onClick: () => { this.closeModal(); this.openMisi(); this.misiTab = 'ach'; this.rerender(); } }, 'Lihat dan ambil hadiah')));
      }
      if (summary.regulars?.length) {
        out.push(h('div', { class: 'card' }, h('b', {}, '⭐ Langganan hari ini'),
          summary.regulars.map((r) => h('div', { class: 'sub' }, `${r.icon} ${r.name}: ${r.requested ? (r.fulfilled ? 'permintaan terpenuhi' : 'permintaan tidak terpenuhi') : 'belanja'} · +${r.bondGain} kedekatan${r.tip ? ` · tip ${rp(r.tip)}` : ''}${r.levelUp ? ' · 🎉 naik level!' : ''}`)),
          h('button', { class: 'btn small secondary', onClick: () => { this.closeModal(); this.openLangganan(); } }, 'Buka Buku Langganan')));
      }
      const lossLine = (arr) => arr.map((x) => `${x.n} ${iname(getItem(x.itemId))}`).join(', ');
      if (summary.died?.length) out.push(h('div', { class: 'card warn' }, h('b', { class: 'bad' }, '🩺 Hewan sakit dan mati'), h('div', { class: 'sub' }, lossLine(summary.died)), h('div', { class: 'sub' }, 'Pakai Ramuan Obat atau pekerjakan Perawat Hewan untuk menguranginya.')));
      if (summary.stolen?.length) out.push(h('div', { class: 'card warn' }, h('b', { class: 'bad' }, '🕵️ Ada pencurian'), h('div', { class: 'sub' }, lossLine(summary.stolen)), h('div', { class: 'sub' }, 'Satpam menurunkan pencurian sampai 80%.')));
      if (summary.restock?.length) out.push(h('div', { class: 'card' }, h('b', {}, '📋 Penjaga Stok'), h('div', { class: 'sub' }, summary.restock.map((r) => `${r.n} ${iname(getItem(r.itemId))}`).join(', '))));
      const hints = [];
      const low = e.lowStock();
      if (low.length) hints.push(`⚠ Stok menipis: ${low.map((l) => getItem(l.itemId).name).join(', ')}`);
      const ready = e.state.breeding.filter((b) => e.state.day >= b.ready).length;
      if (ready) hints.push(`🐣 ${ready} breeding siap diambil`);
      if (e.skillPointsFree() > 0) hints.push(`🌳 ${e.skillPointsFree()} poin skill belum dipakai`);
      hints.push(`${e.mods().event.icon} Besok: ${e.mods().event.name}`);
      out.push(h('div', { class: 'card' }, `Kas sekarang: ${rp(summary.endCash)}`, hints.map((t) => h('div', { class: 'sub' }, t))));
      out.push(h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: () => { this.closeModal(); this.openGrosir(); } }, '🛒 Belanja stok'),
        h('button', { class: 'btn secondary grow', onClick: () => { this.closeModal(); this.toggleShop(); } }, `▶ Mulai hari ${e.state.day}`)),
        h('button', { class: 'btn secondary', onClick: () => this.closeModal() }, 'Tutup'));
      return out;
    });
    this.refreshHud();
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
        h('div', { class: 'card' }, h('b', {}, 'Cara bermain'),
          h('div', { class: 'sub', style: 'white-space:pre-line' }, [
            '1. Belanja stok di Grosir, atur harga di Harga.',
            '2. Tekan Buka Toko: pelanggan datang, memilih, antre, bayar.',
            '3. Reputasi naik jika pelanggan puas. Naik bintang membuka fitur baru.',
            '4. Perluas toko untuk membuka kategori hewan, buka spesies baru di Daftar Hewan.',
            '5. Pakai skill, ramuan, dan karyawan. Hati-hati dengan utang dan sewa.',
          ].join('\n'))),
        h('div', { class: 'card' }, h('b', {}, '🔊 Suara'),
          h('label', { class: 'sub' }, 'Efek suara', h('input', { type: 'range', min: 0, max: 100, value: Math.round(audio.sfxVol * 100), onInput: (ev) => audio.setSfx(Number(ev.target.value) / 100), onChange: () => audio.play('ok') })),
          h('label', { class: 'sub' }, 'Musik latar', h('input', { type: 'range', min: 0, max: 100, value: Math.round(audio.musicVol * 100), onInput: (ev) => audio.setMusic(Number(ev.target.value) / 100) })),
          h('button', { class: 'btn secondary small', onClick: () => { audio.unlock(); audio.setMuted(!audio.muted); this.syncSound(); this.rerender(); } }, audio.muted ? '🔇 Suara mati, tekan untuk menyalakan' : '🔊 Suara menyala, tekan untuk membisukan')),
        h('div', { class: 'card' }, h('b', {}, '♿ Tampilan'),
          h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: getA11y().big, onChange: (ev) => setA11y({ big: ev.target.checked }) }), 'Huruf besar'),
          h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: getA11y().contrast, onChange: (ev) => setA11y({ contrast: ev.target.checked }) }), 'Kontras tinggi'),
          installEvt ? h('button', { class: 'btn secondary small', onClick: async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; this.rerender(); } }, '📲 Pasang aplikasi di layar utama') : h('div', { class: 'sub' }, 'Untuk memasang: gunakan menu browser "Tambahkan ke layar utama".'),
          h('button', { class: 'btn secondary small', onClick: () => { this.e.state.tutorial = { step: 0, done: false }; this.closeModal(); this.startTutorial(); } }, '🎓 Ulangi tutorial')),
        h('div', { class: 'card' }, h('b', {}, 'Simpan'),
          h('div', { class: 'sub' }, 'Tersimpan otomatis di perangkat setiap toko tutup. Hari yang sedang berjalan tidak disimpan.'),
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
        h('div', { class: 'sub', style: 'text-align:center' }, `Pasar Satwa by Fajmuls · v4.0 · 1 hari = ${DAY_LENGTH_SEC}s pada 1x`),
      ];
    });
  }
}

export { parseLotKey };
