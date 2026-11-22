import {
  CATEGORIES, QUALITIES, STAR_PERKS, getItem, getQuality, itemsOf, parseLotKey,
} from './core/catalog.js';
import { DAY_LENGTH_SEC } from './core/engine.js';
import { auditLedger } from './core/ledger.js';
import { audio } from './audio.js';
import { ACHIEVEMENTS } from './core/goals.js';
import { RARITIES, rarityIdx, animalValue, sizeLabel } from './core/farm.js';
import { animalSVG, uiIconSVG, svgEl } from './art.svg.js';
import { statIconSVG, EVENT_ICONS } from './art.world.js';
import { REGULARS } from './core/regulars.js';

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
    // ctx: { engine, scene(), persist(), travel(), openShop(), closeShop(), setSpeed(), newGame(), importText(), exportFile() }
    this.ctx = ctx;
    this.modal = null;
    this.speed = 1;
    this.tabs = {};
    this.buildHud();
    this.buildFloat();
    this.buildDock();
  }

  get e() { return this.ctx.engine; }

  // ---------- HUD ----------
  buildHud() {
    const hud = document.getElementById('hud');
    this.hudDay = h('span', { class: 'pill' });
    this.hudStar = h('span', { class: 'pill star' });
    this.hudDebt = h('span', { class: 'pill warn', style: 'display:none' });
    this.hudCash = h('div', { class: 'hud-cash' });
    this.hudLive = h('div', { class: 'hud-live' });
    this.hudBar = h('i');
    this.bellBtn = h('button', { class: 'round', 'aria-label': 'Riwayat notifikasi', onClick: () => this.openRiwayat() }, svgEl(statIconSVG('bell'), 22));
    this.soundBtn = h('button', { class: 'round', 'aria-label': 'Suara', onClick: () => { audio.unlock(); audio.setMuted(!audio.muted); this.syncSound(); } });
    hud.append(
      h('div', { class: 'hud-row' },
        h('div', { class: 'hud-cashbox' }, svgEl(uiIconSVG('coin'), 26), this.hudCash),
        h('div', { class: 'hud-right' }, this.hudDay, this.hudStar, this.bellBtn, this.soundBtn)),
      h('div', { class: 'hud-row' }, this.hudLive, this.hudDebt),
      h('div', { class: 'bar' }, this.hudBar),
    );
    this.syncSound();
  }

  // Tombol mengambang di atas peta: misi, event, cerita, panen, zoom.
  buildFloat() {
    const fl = document.getElementById('float');
    this.fQuest = h('button', { class: 'fchip', onClick: () => this.openMisi() });
    this.fEvent = h('button', { class: 'fchip', onClick: () => this.openEvent() });
    this.fStory = h('button', { class: 'fchip', onClick: () => this.openNpc() });
    this.fReady = h('button', { class: 'fchip ready', style: 'display:none', onClick: () => this.harvestAllUI() });
    this.fNavL = h('button', { class: 'round big navl', 'aria-label': 'Ke Kolam', onClick: () => this.ctx.scene()?.travelTo('kolam') }, '◀');
    this.fNavR = h('button', { class: 'round big navr', 'aria-label': 'Ke Kandang', onClick: () => this.ctx.scene()?.travelTo('kandang') }, '▶');
    this.fNavLab = h('div', { class: 'navlab' }, 'Geser kiri/kanan');
    fl.append(h('div', { class: 'fcol' }, this.fQuest, this.fEvent, this.fStory, this.fReady), this.fNavL, this.fNavR);
  }

  // ---------- Ambil hewan dari rak ----------
  openPicker(catId) {
    const scene = this.ctx.scene();
    this.openSheet(`Rak ${CATEGORIES.find((c) => c.id === catId).name}`, () => {
      const e = this.e;
      const orders = scene?.waitingOrders() || [];
      const out = [h('div', { class: 'sub' }, 'Pilih hewan yang diminta pelanggan (bertanda), lalu ketuk pelanggannya. Waktu berhenti selama kamu memilih.')];
      const list = e.state.farm.animals.filter((a) => getItem(a.itemId).cat === catId)
        .sort((a, b) => a.itemId.localeCompare(b.itemId) || rarityIdx(b.rarity) - rarityIdx(a.rarity) || b.size - a.size);
      if (!list.length) out.push(h('div', { class: 'card' }, 'Rak kosong. Panen dulu di Kolam atau Kandang, atau beli bibit di Pasar.'));
      const groups = [];
      for (const a of list) {
        const g = groups.find((x) => x.a.itemId === a.itemId && x.a.rarity === a.rarity && x.a.size === a.size);
        if (g) g.n += 1; else groups.push({ a, n: 1 });
      }
      const wants = (a) => orders.some((o) => o.itemId === a.itemId && rarityIdx(a.rarity) + 1 >= o.minQuality);
      groups.sort((x, y) => Number(wants(y.a)) - Number(wants(x.a)));
      for (const { a, n } of groups) {
        const it = getItem(a.itemId);
        const want = wants(a);
        out.push(h('button', { class: `card animal${want ? ' hero' : ''}`, style: `text-align:left;border-left:6px solid ${rarOf(a).color}`,
          onClick: () => { scene?.setCarry(a); audio.play('ok'); this.closeModal(); } },
        h('div', { class: 'row', style: 'gap:10px;flex-wrap:nowrap' }, svgEl(animalSVG(it), 40),
          h('div', { class: 'grow' }, h('b', {}, n > 1 ? `${it.name} ×${n}` : it.name), h('div', { class: 'sub' }, `${sizeLabel(a.itemId, a.size)} · `, h('span', { style: `color:${rarOf(a).color};font-weight:800` }, rarOf(a).name))),
          want ? h('span', { class: 'badge good' }, 'dipesan') : null,
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
      { mid: true, title: 'Selamat datang di Pasar Satwa!', text: 'Ini kebunmu. Geser ke kiri-kanan untuk melihat Kolam dan Kandang. Ketuk lahan untuk langsung menanam atau panen. Semua dilayani langsung olehmu, tidak ada yang otomatis.' },
      { el: () => this.tabs.pasar, title: '1. Belanja di Pasar', text: 'Beli bibit atau anak hewan dan pakan. Pakan mahal membuat hewan lebih besar dan lebih mungkin langka.' },
      { el: () => this.tabs.kebun, title: '2. Tanam di Kebun', text: 'Di layar Kebun, ketuk lahan kosong, pilih bibit, jumlah, dan pakan, lalu tunggu tumbuh. Satu lahan bisa diisi banyak sekaligus. Saat tanda seru muncul, ketuk lahan itu untuk panen.' },
      { el: () => this.tabs.pet, title: '3. Pet', text: 'Tetaskan telur untuk mendapat pet. Pet yang dipasang menemanimu di toko dan memberi buff.' },
      { el: () => this.goBtn, title: '4. Buka toko dan layani', text: 'Pelanggan antre membawa pesanan di atas kepala. Ketuk rak untuk mengambil hewan yang tepat, lalu ketuk pelanggan untuk menyerahkan. Cepat melayani berarti tip.' },
      { el: () => this.fStory, title: '5. Cerita dan misi', text: 'Ketuk tombol ini atau Pak Pasar di Kebun untuk melanjutkan cerita. Misi harian memberi hadiah tambahan.' },
      { el: () => this.tabs.menu, title: '6. Menu', text: 'Koleksi, Skill, Upgrade, Karyawan, Bank, Laporan, dan Pengaturan ada di sini.' },
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
    this.openSheet('Riwayat notifikasi', () => [
      notifLog.length ? null : h('div', { class: 'card' }, 'Belum ada notifikasi.'),
      ...notifLog.map((n) => h('div', { class: `card${n.kind === 'err' ? ' warn' : ''}` }, h('div', {}, n.msg), h('div', { class: 'sub' }, new Date(n.t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })))),
    ].filter(Boolean));
  }

  openEvent() {
    const e = this.e;
    const ev = e.eventOf();
    const next = e.eventOf(e.state.day + 1);
    this.openSheet('Event hari ini', () => [
      h('div', { class: 'card hero' }, h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:12px' }, svgEl(EVENT_ICONS[ev.id] || EVENT_ICONS.cerah, 56),
        h('div', {}, h('b', { style: 'font-size:18px' }, ev.name), h('div', { class: 'sub' }, ev.desc)))),
      h('div', { class: 'card' }, h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:12px' }, svgEl(EVENT_ICONS[next.id] || EVENT_ICONS.cerah, 40),
        h('div', {}, h('div', { class: 'sub' }, 'Besok'), h('b', {}, next.name), h('div', { class: 'sub' }, next.desc)))),
    ]);
  }

  syncSound() {
    this.soundBtn.replaceChildren(svgEl(statIconSVG(audio.muted ? 'mute' : 'sound'), 22));
  }

  setHub(id) {
    for (const [k, b] of Object.entries(this.tabs)) b.classList.toggle('on', b.dataset.hub === id && k !== 'menu');
    this.view = id;
    if (this.fNavL) { const k = id === 'kebun' && this.e.state.phase !== 'open'; this.fNavL.style.display = k ? '' : 'none'; this.fNavR.style.display = k ? '' : 'none'; }
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
    this.fQuest.replaceChildren(svgEl(statIconSVG('quest'), 20), h('span', {}, `${doneQ}/${s.quests.daily.length}${claimable ? ' ●' : ''}`));
    this.fQuest.classList.toggle('ready', claimable > 0);
    const ev = e.eventOf();
    this.fEvent.replaceChildren(svgEl(EVENT_ICONS[ev.id] || EVENT_ICONS.cerah, 22));
    this.fEvent.title = ev.name;
    this.fEvent.setAttribute('aria-label', `Event: ${ev.name}`);
    const sn = e.storyNow();
    if (sn.done) {
      this.fStory.style.display = 'none';
    } else {
      this.fStory.style.display = '';
      this.fStory.replaceChildren(svgEl(statIconSVG('story'), 20), h('span', {}, `${sn.ready ? 'Beres!' : `${sn.cur}/${sn.need}`.replace(/(\d+)\/(\d{5,})/, (_m, a, b) => `${rpShort(Number(a)).replace('Rp ', '')}/${rpShort(Number(b)).replace('Rp ', '')}`)}`));
      this.fStory.classList.toggle('ready', sn.ready || !sn.introSeen);
    }
    const readyN = s.farm.slots.filter((_, i) => e.slotProgress(i)?.ready).length;
    this.fReady.style.display = readyN ? '' : 'none';
    this.fReady.replaceChildren(svgEl(statIconSVG('harvest'), 20), h('span', {}, `${readyN}`));
    this.tabs.kebun?.classList.toggle('badge-dot', readyN > 0);
    this.tabs.menu?.classList.toggle('badge-dot', claimable > 0 || (!sn.done && sn.ready));
    if (s.phase === 'open' && tick) {
      const t = tick.today;
      this.hudLive.textContent = `Toko BUKA · dilayani ${t.served}/${t.customers} · omzet ${rpShort(t.revenue)}${tick.closing ? ' · menutup...' : ''}`;
      this.hudBar.style.width = `${Math.round(tick.progress * 100)}%`;
    } else if (s.phase === 'idle') {
      const sp = e.starProgress();
      this.hudLive.textContent = `Toko TUTUP · hewan ${s.farm.animals.length} · reputasi ${sp.rep.toFixed(1)}${sp.to ? ` / ${sp.to}` : ''}`;
      this.hudBar.style.width = `${sp.pct}%`;
    }
    this.syncDock();
  }

  // ---------- Dock ----------
  buildDock() {
    const dock = document.getElementById('dock');
    const lock = (fn) => () => {
      if (this.e.state.phase === 'open') { toast('Toko sedang buka. Tutup toko dulu untuk pindah layar.', 'err'); return; }
      fn();
    };
    const defs = [
      ['pasar', 'pasar', 'Pasar', null, lock(() => this.openPasar())],
      ['kebun', 'kolam', 'Kebun', 'kebun', lock(() => { this.closeModal(); this.ctx.travel('kolam'); })],
      ['toko', 'toko', 'Toko', 'toko', () => { this.closeModal(); this.ctx.travel('toko'); }],
      ['pet', 'pet', 'Pet', null, lock(() => this.openPet())],
      ['menu', 'menu', 'Menu', null, () => this.openMenu()],
    ];
    const tabs = h('div', { class: 'dock-tabs' });
    for (const [id, icon, label, hub, fn] of defs) {
      const b = h('button', { class: 'tab', onClick: fn }, svgEl(uiIconSVG(icon), 28), h('span', {}, label));
      b.dataset.hub = hub || '';
      this.tabs[id] = b;
      tabs.append(b);
    }
    this.goBtn = h('button', { class: 'btn go', onClick: () => this.toggleShop() });
    this.speedBtn = h('button', { class: 'btn secondary speedbtn', 'aria-label': 'Kecepatan', onClick: () => this.cycleSpeed() });
    dock.append(h('div', { class: 'dock-main' }, this.goBtn, this.speedBtn), tabs);
    this.syncDock();
  }

  cycleSpeed() {
    const steps = [0, 1, 2, 4, 8].filter((s) => s <= this.e.maxSpeed());
    const i = steps.indexOf(this.speed);
    this.speed = steps[(i + 1) % steps.length];
    if (this.speed === 0 && this.e.state.phase !== 'open') this.speed = 1;
    this.ctx.setSpeed(this.speed);
    this.syncDock();
    if (this.e.maxSpeed() < 8 && this.speed === steps.at(-1)) toast('Mesin Waktu di Menu > Upgrade membuka kecepatan lebih tinggi');
  }

  syncDock() {
    const open = this.e.state.phase === 'open';
    if (this.speed > this.e.maxSpeed()) this.speed = this.e.maxSpeed();
    this.goBtn.replaceChildren(svgEl(statIconSVG(open ? 'stop' : 'play'), 22), h('span', {}, open ? 'Tutup Toko' : `Buka Toko · Hari ${this.e.state.day}`));
    this.goBtn.classList.toggle('stop', open);
    for (const k of ['pasar', 'kebun', 'pet']) this.tabs[k]?.classList.toggle('locked', open);
    if (this.fNavL && this.view === 'kebun') { this.fNavL.style.display = open ? 'none' : ''; this.fNavR.style.display = open ? 'none' : ''; }
    this.speedBtn.textContent = this.speed === 0 ? 'Jeda' : `${this.speed}x`;
  }

  toggleShop() {
    if (this.e.state.phase === 'open') {
      this.ctx.closeShop();
      audio.play('close');
      toast('Toko ditutup. Pelanggan yang tersisa diselesaikan dulu.');
    } else {
      if (this.e.state.farm.animals.length === 0) {
        toast('Stok masih kosong. Panen dulu di Kebun atau beli di Pasar sebelum buka toko.', 'err');
        return;
      }
      this.closeModal();
      this.speed = this.speed === 0 ? 1 : this.speed;
      this.ctx.openShop();
      this.ctx.scene()?.travelTo('toko');
      audio.play('open');
      const ev = this.e.eventOf();
      if (ev.id !== 'cerah') toast(`Event hari ini: ${ev.name}. ${ev.desc || ''}`, 'ok');
      this.ctx.setSpeed(this.speed);
      this.syncDock();
    }
  }

  // ---------- Panel dasar: tinggi tetap, isi dipecah ke halaman, tanpa scroll ----------
  openSheet(title, render) {
    this.closeModal();
    const body = h('div', { class: 'sheet-body' });
    const pager = h('div', { class: 'pager', style: 'display:none' });
    const sheet = h('div', { class: 'sheet' },
      h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'x', onClick: () => this.closeModal(), 'aria-label': 'Tutup' }, '✕')),
      body, pager);
    const overlay = h('div', { class: 'overlay', onClick: (ev) => { if (ev.target === overlay) this.closeModal(); } }, sheet);
    document.getElementById('modal-root').append(overlay);
    this.modal = { overlay, sheet, body, pager, render, page: 0, pages: 1 };
    let sx = null;
    body.addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; }, { passive: true });
    body.addEventListener('touchend', (ev) => {
      if (sx === null) return;
      const dx = ev.changedTouches[0].clientX - sx;
      sx = null;
      if (Math.abs(dx) > 70) this.gotoPage(this.modal.page + (dx < 0 ? 1 : -1));
    }, { passive: true });
    this.rerender();
  }

  rerender() {
    if (!this.modal) return;
    this.modal.nodes = [].concat(this.modal.render()).filter(Boolean);
    this.layoutPages();
  }

  gotoPage(p) {
    const m = this.modal;
    if (!m) return;
    m.page = Math.max(0, Math.min(m.pages - 1, p));
    this.showPage();
  }

  // Memecah node menjadi halaman yang pas di layar. Node bertanda .sticky (tab) muncul di tiap halaman.
  layoutPages() {
    const m = this.modal;
    const { body, nodes } = m;
    m.sheet.style.height = '';
    body.style.flex = '';
    body.style.overflowY = 'hidden';
    body.replaceChildren(...nodes);
    const cs = getComputedStyle(body);
    const gap = parseFloat(cs.rowGap) || 10;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    // Ukur dua kali: tanpa bilah halaman (satu halaman) dan dengan bilah halaman (beberapa halaman).
    const pg = m.pager;
    pg.style.display = 'none';
    const availFull = body.clientHeight - pad;
    pg.style.display = '';
    pg.replaceChildren(h('div', { style: 'height:36px' }));
    const availPaged = body.clientHeight - pad;
    const hs = nodes.map((n) => n.offsetHeight);
    let si = 0;
    while (si < nodes.length && nodes[si].classList?.contains('sticky')) si++;
    const sticky = nodes.slice(0, si);
    const stickyH = hs.slice(0, si).reduce((a, b) => a + b + gap, 0);
    const restH = hs.slice(si).reduce((a, b) => a + b, 0) + gap * Math.max(0, nodes.length - si - 1);
    const single = stickyH + restH <= availFull + 1;
    m.single = single;
    m.fitH = stickyH + restH + pad;
    const avail = single ? availFull : availPaged;
    const limit = Math.max(120, avail - stickyH);
    const pages = [];
    let cur = [];
    let used = 0;
    for (let i = si; i < nodes.length; i++) {
      const need = hs[i] + (cur.length ? gap : 0);
      if (cur.length && used + need > limit) { pages.push(cur); cur = []; used = 0; }
      used += hs[i] + (cur.length ? gap : 0);
      cur.push({ n: nodes[i], h: hs[i] });
    }
    if (cur.length || !pages.length) pages.push(cur);
    m.sticky = sticky;
    m.pageList = pages;
    m.limit = limit;
    m.pages = pages.length;
    m.page = Math.max(0, Math.min(m.page, m.pages - 1));
    this.showPage();
  }

  showPage() {
    const m = this.modal;
    const page = m.pageList[m.page] || [];
    m.body.replaceChildren(...m.sticky, ...page.map((x) => x.n));
    m.body.scrollTop = 0;
    const tall = page.length === 1 && page[0].h > m.limit + 2;
    m.body.style.overflowY = tall ? 'auto' : 'hidden';
    const pg = m.pager;
    if (m.pages <= 1) {
      pg.style.display = 'none';
      if (m.single && !tall) { m.sheet.style.height = 'auto'; m.body.style.flex = '0 0 auto'; }
      return;
    }
    pg.style.display = '';
    pg.replaceChildren(
      h('button', { class: 'pg-btn', disabled: m.page === 0, onClick: () => this.gotoPage(m.page - 1), 'aria-label': 'Halaman sebelumnya' }, '◀'),
      h('div', { class: 'pg-dots' }, Array.from({ length: m.pages }, (_, i) => h('i', { class: i === m.page ? 'on' : '', onClick: () => this.gotoPage(i) }))),
      h('span', { class: 'pg-n' }, `${m.page + 1}/${m.pages}`),
      h('button', { class: 'pg-btn', disabled: m.page >= m.pages - 1, onClick: () => this.gotoPage(m.page + 1), 'aria-label': 'Halaman berikutnya' }, '▶'));
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
    return h('div', { class: 'chips sticky' }, options.map((o) => h('button', { class: `chip${o.id === current ? ' on' : ''}`, onClick: () => { if (this.modal) this.modal.page = 0; onPick(o.id); } }, o.label)));
  }

  lockCard(text) {
    return h('div', { class: 'card' }, h('div', { class: 'sub' }, `🔒 ${text}`));
  }

  openLaporan() {
    this.openSheet('Laporan Keuangan', () => {
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
        h('button', { class: 'btn grow', onClick: () => { this.closeModal(); this.ctx.travel('kolam'); } }, '🌱 Ke Kolam'),
        h('button', { class: 'btn secondary grow', onClick: () => { this.closeModal(); this.toggleShop(); } }, `▶ Mulai hari ${e.state.day}`)),
        h('button', { class: 'btn secondary', onClick: () => this.closeModal() }, 'Tutup'));
      return out;
    });
    this.refreshHud();
  }


  // ---------- Menu utama: kisi ikon ----------
  tileGrids(tiles, per = 9) {
    const out = [];
    for (let i = 0; i < tiles.length; i += per) {
      out.push(h('div', { class: 'grid3' }, tiles.slice(i, i + per).map(([icon, title, sub, fn, badge]) =>
        h('button', { class: 'tile', onClick: fn },
          h('div', { class: 'tile-icon' }, svgEl(uiIconSVG(icon), 40), badge ? h('span', { class: 'dot' }, badge) : null),
          h('b', {}, title), h('span', { class: 'sub' }, sub)))));
    }
    return out;
  }

  openMenu() {
    this.openSheet('Menu', () => {
      const e = this.e;
      const s = e.state;
      const sn = e.storyNow();
      const tiles = [
        ['koleksi', 'Koleksi', `${s.farm.animals.length} hewan`, () => this.openKoleksi(), null],
        ['cerita', 'Cerita', sn.done ? 'Tamat' : `Bab ${sn.index + 1}/${sn.total}`, () => this.openCerita(), !sn.done && sn.ready ? '!' : null],
        ['misi', 'Misi', this.questSummary(), () => this.openMisi(), this.claimableCount() || null],
        ['langganan', 'Langganan', `${Object.keys(s.regulars).length}/${REGULARS.length} dikenal`, () => this.openLangganan(), this.regularClaimable() || null],
        ['hewan', 'Spesies', 'Buka hewan baru', () => this.openSpesies(), null],
        ['bintang', 'Bintang', starsText(s.stars), () => this.openBintang(), null],
        ['skill', 'Skill', `${e.skillPointsFree()} poin`, () => this.openSkill(), e.skillPointsFree() > 0 ? e.skillPointsFree() : null],
        ['upgrade', 'Upgrade', `Toko Lv ${s.shopLevel}`, () => this.openUpgrade(), null],
        ['ramuan', 'Ramuan', s.stars >= 2 ? `${Object.keys(s.buffs).length} aktif` : 'butuh ★2', () => this.openRamuan(), null],
        ['karyawan', 'Karyawan', `${Object.keys(s.staff).length} bekerja`, () => this.openKaryawan(), null],
        ['bank', 'Bank', s.stars >= 2 ? `${s.loans.length} pinjaman` : 'butuh ★2', () => this.openBank(), null],
        ['investasi', 'Investasi', s.stars >= 3 ? rpShort(e.netWorth()) : 'butuh ★3', () => this.openInvestasi(), null],
        ['laporan', 'Laporan', 'Keuangan', () => this.openLaporan(), null],
        ['pengaturan', 'Pengaturan', 'Suara, simpan', () => this.openPengaturan(), null],
      ];
      return this.tileGrids(tiles);
    });
  }

  openFitur() { this.openMenu(); }

  openPengaturan() {
    this.openSheet('Pengaturan', () => {
      const e = this.e;
      const ta = h('textarea', { placeholder: 'Tempel isi berkas simpanan di sini untuk mengimpor...' });
      const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none', onChange: async (ev) => {
        const f = ev.target.files[0];
        if (f) ta.value = await f.text();
      } });
      return [
        h('div', { class: 'card' }, h('b', {}, 'Cara bermain'),
          h('div', { class: 'sub', style: 'white-space:pre-line' }, [
            '1. Beli bibit dan pakan di Pasar.',
            '2. Tanam di Kolam, Kebun, atau Kandang. Tunggu tumbuh, lalu ketuk untuk panen.',
            '3. Buka toko, ketuk rak untuk mengambil hewan, ketuk pelanggan untuk menyerahkan.',
            '4. Hewan langka dibayar mahal. Pakan mahal dan pet membantu peluang langka.',
            '5. Ikuti cerita Pak Pasar dan selesaikan misi harian.',
          ].join('\n'))),
        h('div', { class: 'card' }, h('b', {}, 'Suara'),
          h('label', { class: 'sub' }, 'Efek suara', h('input', { type: 'range', min: 0, max: 100, value: Math.round(audio.sfxVol * 100), onInput: (ev) => audio.setSfx(Number(ev.target.value) / 100), onChange: () => audio.play('ok') })),
          h('label', { class: 'sub' }, 'Musik latar', h('input', { type: 'range', min: 0, max: 100, value: Math.round(audio.musicVol * 100), onInput: (ev) => audio.setMusic(Number(ev.target.value) / 100) })),
          h('button', { class: 'btn secondary small', onClick: () => { audio.unlock(); audio.setMuted(!audio.muted); this.syncSound(); this.rerender(); } }, audio.muted ? 'Suara mati, tekan untuk menyalakan' : 'Suara menyala, tekan untuk membisukan')),
        h('div', { class: 'card' }, h('b', {}, 'Tampilan'),
          h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: getA11y().big, onChange: (ev) => setA11y({ big: ev.target.checked }) }), 'Huruf besar'),
          h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: getA11y().contrast, onChange: (ev) => setA11y({ contrast: ev.target.checked }) }), 'Kontras tinggi'),
          installEvt ? h('button', { class: 'btn secondary small', onClick: async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; this.rerender(); } }, 'Pasang aplikasi di layar utama') : h('div', { class: 'sub' }, 'Untuk memasang: gunakan menu browser "Tambahkan ke layar utama".'),
          h('button', { class: 'btn secondary small', onClick: () => { this.e.state.tutorial = { step: 0, done: false }; this.closeModal(); this.startTutorial(); } }, 'Ulangi tutorial')),
        h('div', { class: 'card' }, h('b', {}, 'Simpan'),
          h('div', { class: 'sub' }, 'Tersimpan otomatis di perangkat setiap toko tutup. Hari yang sedang berjalan tidak disimpan.'),
          h('button', { class: 'btn', onClick: () => { this.ctx.persist(true); toast('Tersimpan', 'ok'); } }, 'Simpan sekarang')),
        h('div', { class: 'card' }, h('b', {}, 'Cadangan (ekspor / impor)'),
          h('button', { class: 'btn secondary', onClick: () => this.ctx.exportFile() }, 'Unduh berkas simpanan'),
          fileIn,
          h('button', { class: 'btn secondary', onClick: () => fileIn.click() }, 'Pilih berkas simpanan'),
          ta,
          h('button', { class: 'btn', onClick: () => {
            try { this.ctx.importText(ta.value); this.closeModal(); toast('Simpanan dimuat', 'ok'); } catch (err) { toast(err.message, 'err'); }
          } }, 'Impor dari teks')),
        h('div', { class: 'card' }, h('b', {}, 'Audit keuangan'),
          h('div', { class: 'sub' }, 'Memeriksa bahwa saldo sama dengan seluruh transaksi.'),
          h('button', { class: 'btn secondary', onClick: () => {
            const p = auditLedger(e.state.ledger);
            toast(p.length ? `Masalah: ${p[0]}` : 'Buku kas sehat, saldo cocok dengan transaksi', p.length ? 'err' : 'ok');
          } }, 'Jalankan audit')),
        h('div', { class: 'card' }, h('b', {}, 'Game baru'),
          h('button', { class: 'btn danger', disabled: e.state.phase === 'open', onClick: () => {
            if (confirm('Hapus progres dan mulai game baru? Ini tidak bisa dibatalkan.')) { this.ctx.newGame(); this.closeModal(); }
          } }, 'Mulai game baru')),
        h('div', { class: 'sub', style: 'text-align:center' }, `Pasar Satwa by Fajmuls · v6.0 · 1 hari = ${DAY_LENGTH_SEC}s pada 1x`),
      ];
    });
  }
}

export { parseLotKey };
