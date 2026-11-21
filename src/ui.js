import {
  CATEGORIES, QUALITIES, STAR_PERKS, getItem, getQuality, itemsOf, parseLotKey,
} from './core/catalog.js';
import { DAY_LENGTH_SEC } from './core/engine.js';
import { auditLedger } from './core/ledger.js';
import { audio } from './audio.js';
import { ACHIEVEMENTS } from './core/goals.js';
import { RARITIES, rarityIdx, animalValue, sizeLabel } from './core/farm.js';
import { animalSVG, uiIconSVG, svgEl } from './art.svg.js';

export const rarOf = (a) => RARITIES[rarityIdx(a.rarity)];
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
    this.hudLow = h('button', { class: 'hud-chip quest ready', style: 'display:none', onClick: () => this.openKolam() });
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

  // ---------- Ambil hewan dari rak ----------
  openPicker(catId) {
    const scene = this.ctx.scene();
    this.openSheet(`Rak ${CATEGORIES.find((c) => c.id === catId).name}`, () => {
      const e = this.e;
      const orders = scene?.waitingOrders() || [];
      const out = [h('div', { class: 'sub' }, 'Pilih hewan yang diminta pelanggan (ditandai biru), lalu ketuk pelanggannya untuk menyerahkan. Waktu berhenti selama kamu memilih.')];
      const list = e.state.farm.animals.filter((a) => getItem(a.itemId).cat === catId)
        .sort((a, b) => a.itemId.localeCompare(b.itemId) || rarityIdx(b.rarity) - rarityIdx(a.rarity) || b.size - a.size);
      if (!list.length) out.push(h('div', { class: 'card' }, 'Rak kosong. Panen dulu di Kolam atau beli bibit di Pasar.'));
      for (const a of list) {
        const it = getItem(a.itemId);
        const want = orders.some((o) => o.itemId === a.itemId && rarityIdx(a.rarity) + 1 >= o.minQuality);
        out.push(h('button', { class: `card animal${want ? ' hero' : ''}`, style: `text-align:left;border-left:5px solid ${rarOf(a).color}`,
          onClick: () => { scene?.setCarry(a); audio.play('ok'); this.closeModal(); } },
        h('div', { class: 'row', style: 'gap:10px;flex-wrap:nowrap' }, svgEl(animalSVG(it), 40),
          h('div', { class: 'grow' }, h('b', {}, it.name), h('div', { class: 'sub' }, `${sizeLabel(a.itemId, a.size)} · `, h('span', { style: `color:${rarOf(a).color};font-weight:700` }, rarOf(a).name))),
          h('span', { class: 'price' }, rp(animalValue(a))))));
      }
      return out;
    });
    scene?.setPaused(true);
    this.pickerOpen = true;
  }

  // ---------- Tutorial ----------
  tutorialSteps() {
    return [
      { mid: true, title: 'Selamat datang di Pasar Satwa! 🐾', text: 'Di sini kamu membudidayakan hewan sendiri, lalu menjualnya langsung ke pelanggan. Tidak ada yang otomatis. Tutorial singkat ini bisa dilewati kapan saja.' },
      { el: () => this.tabs.pasar, title: '1. Belanja di Pasar', text: 'Beli bibit (cacing, anak ikan, dll) dan pakan. Pakan mahal membuat hewan lebih besar dan lebih mungkin langka.' },
      { el: () => this.tabs.kolam, title: '2. Tanam di Kolam', text: 'Tanam bibit di kolam, pilih pakan, lalu tunggu beberapa menit sampai tumbuh. Setelah siap, panen: hasilnya punya ukuran dan rarity dari Common sampai Secret.' },
      { el: () => this.tabs.koleksi, title: '3. Koleksi', text: 'Hewan hasil panen disimpan di Kandang. Buku Koleksi mencatat rarity dan ukuran terbaik tiap spesies.' },
      { el: () => this.tabs.pet, title: '4. Pet', text: 'Tetaskan telur untuk mendapat pet dengan rarity berbeda. Pet yang dipasang memberi buff peluang, kecepatan, harga, dan tip.' },
      { el: () => this.goBtn, title: '5. Buka toko dan layani sendiri', text: 'Pelanggan antre dengan pesanannya di atas kepala. Ketuk rak untuk mengambil hewan yang tepat (waktu berhenti saat memilih), lalu ketuk pelanggan untuk menyerahkan. Cepat = tip. Kolektor dan VIP membayar mahal untuk hewan langka.' },
      { el: () => this.hudQuest, title: '6. Misi harian', text: 'Selesaikan misi untuk hadiah uang dan poin skill. Ketuk untuk melihat dan mengambil hadiah.' },
      { el: () => this.tabs.fitur, title: '7. Fitur', text: 'Misi, Buku Langganan, Upgrade toko, Skill, Karyawan (tampil di toko dan memberi buff), Bank, dan lainnya.' },
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
    const readyN = s.farm.slots.filter((_, i) => e.slotProgress(i)?.ready).length;
    this.hudLow.style.display = readyN ? '' : 'none';
    this.hudLow.textContent = `🌱 ${readyN} siap panen`;
    this.hudLow.classList.remove('warn');
    this.tabs.kolam?.classList.toggle('badge-dot', readyN > 0);
    if (s.phase === 'open' && tick) {
      const t = tick.today;
      this.hudLive.textContent = `Toko BUKA · dilayani ${t.served}/${t.customers} · omzet ${rpShort(t.revenue)}${tick.closing ? ' · menutup...' : ''}`;
      this.hudBar.style.width = `${Math.round(tick.progress * 100)}%`;
    } else if (s.phase === 'idle') {
      const sp = e.starProgress();
      this.hudLive.textContent = `Toko TUTUP · hewan ${s.farm.animals.length} · reputasi ${sp.rep.toFixed(1)}${sp.to ? ` / ${sp.to}` : ''}`;
      this.hudBar.style.width = `${sp.pct}%`;
      this.hudBar.parentElement.title = sp.to ? `Reputasi ${sp.rep.toFixed(1)} / ${sp.to} untuk bintang berikutnya` : 'Bintang maksimum';
    }
    this.syncDock();
  }

  // ---------- Dock ----------
  buildDock() {
    const dock = document.getElementById('dock');
    const defs = [
      ['kolam', 'kolam', 'Kolam', () => this.openKolam(), false],
      ['pasar', 'pasar', 'Pasar', () => this.openPasar(), false],
      ['koleksi', 'koleksi', 'Koleksi', () => this.openKoleksi(), false],
      ['pet', 'pet', 'Pet', () => this.openPet(), false],
      ['fitur', 'fitur', 'Fitur', () => this.openFitur(), false],
      ['menu', 'menu', 'Menu', () => this.openMenu(), false],
    ];
    const tabs = h('div', { class: 'dock-tabs' });
    for (const [id, icon, label, fn, lockWhenOpen] of defs) {
      const b = h('button', { class: 'tab', onClick: fn }, svgEl(uiIconSVG(icon), 26), label);
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
    dock.append(h('div', { class: 'dock-main' }, this.goBtn, this.speedBox), tabs);
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
      if (this.e.state.farm.animals.length === 0) {
        if (!confirm('Belum ada hewan untuk dijual. Pelanggan akan pulang kecewa. Tetap buka toko?')) return;
      }
      this.closeModal();
      this.speed = this.speed === 0 ? 1 : this.speed;
      this.ctx.openShop();
      audio.play('open');
      this.ctx.setSpeed(this.speed);
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
    clearInterval(this.modalTimer);
    this.modalTimer = null;
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
      h('div', { class: 'sub' }, `Pelanggan ${r.served}/${r.customers} terlayani · terjual ${r.soldUnits} hewan · reputasi ${r.repDelta >= 0 ? '+' : ''}${r.repDelta}`),
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
      const hints = [];
      const ready = e.state.farm.slots.filter((_, i) => e.slotProgress(i)?.ready).length;
      if (ready) hints.push(`🌱 ${ready} kolam siap dipanen`);
      hints.push(`Hewan di kandang: ${e.state.farm.animals.length}`);
      if (e.skillPointsFree() > 0) hints.push(`🌳 ${e.skillPointsFree()} poin skill belum dipakai`);
      hints.push(`${e.mods().event.icon} Besok: ${e.mods().event.name}`);
      out.push(h('div', { class: 'card' }, `Kas sekarang: ${rp(summary.endCash)}`, hints.map((t) => h('div', { class: 'sub' }, t))));
      out.push(h('div', { class: 'row' },
        h('button', { class: 'btn grow', onClick: () => { this.closeModal(); this.openKolam(); } }, '🌱 Ke Kolam'),
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
