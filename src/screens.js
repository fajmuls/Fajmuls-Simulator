import {
  CATEGORIES, ITEMS, UPGRADES, SKILLS, PERKS, ATTRS, SKILL_BRANCHES, POTIONS, STAFF, SHARES, PROPERTIES, SHOP_LEVELS,
  STAR_PERKS, STAR_THRESH, DEPOSIT_TERMS, DEPOSIT_MIN, LOAN_TERMS, LOAN_MIN, LOAN_STEP, PROPERTY_SELL_RATE,
  getItem, getQuality, getUpgrade, getSkill, getShare, getProperty, itemsOf,
} from './core/catalog.js';
import { FEEDS, feedOpen, RARITIES as FRAR, SELL_MODES } from './core/farm.js';
import { UI, h, rp, rpShort, starsText, qStars, CAT_EMOJI, iname } from './ui.js';
import { ACHIEVEMENTS, achStat, questText, questIcon, CHEST_DAILY, CHEST_WEEKLY } from './core/goals.js';
import { audio } from './audio.js';
import { REGULARS, BOND_THRESH, LEVEL_NAMES, LEVEL_REWARDS, LEVEL_PERKS, bondLevel, nextThresh } from './core/regulars.js';

const P = UI.prototype;

// ---------- Menu Fitur ----------
P.openFitur = function openFitur() {
  this.openSheet('Fitur', () => {
    const e = this.e;
    const s = e.state;
    const ready = s.breeding.filter((b) => s.day >= b.ready).length;
    const tiles = [
      ['🎯', 'Misi & Pencapaian', `${this.questSummary()}`, () => this.openMisi(), this.claimableCount() || null],
      ['⭐', 'Buku Langganan', `${Object.keys(s.regulars).length}/${REGULARS.length} dikenal`, () => this.openLangganan(), this.regularClaimable() || null],
      ['🐾', 'Daftar Hewan', 'Buka spesies baru', () => this.openSpesies(), null],
      ['⭐', 'Bintang', `${starsText(s.stars)} · rep ${s.reputation.toFixed(1)}`, () => this.openBintang(), null],
      ['🌳', 'Pohon Skill', `${e.skillPointsFree()} poin bebas`, () => this.openSkill(), e.skillPointsFree() > 0 ? e.skillPointsFree() : null],
      ['🏬', 'Upgrade & Perluas', `Toko Lv ${s.shopLevel}`, () => this.openUpgrade(), null],
      ['🧪', 'Ramuan', s.stars >= 2 ? `${Object.keys(s.buffs).length} aktif` : '🔒 ★2', () => this.openRamuan(), null],
      ['🧑‍🤝‍🧑', 'Karyawan', `${s.crew.hired.length}/${this.e.crewSlots()} slot`, () => this.openKaryawan(), null],
      ['🏦', 'Bank', s.stars >= 2 ? `${s.loans.length} pinjaman` : '🔒 ★2', () => this.openBank(), null],
      ['📊', 'Investasi', s.stars >= 3 ? `Kekayaan ${rpShort(e.netWorth())}` : '🔒 ★3', () => this.openInvestasi(), null],
    ];
    return [h('div', { class: 'grid2' }, tiles.map(([icon, title, sub, fn, badge]) =>
      h('button', { class: 'tile', onClick: fn },
        h('div', { class: 'tile-icon' }, icon, badge ? h('span', { class: 'dot' }, badge) : null),
        h('b', {}, title), h('span', { class: 'sub' }, sub))))];
  });
};

// ---------- Daftar Hewan ----------
P.openSpesies = function openSpesies() {
  this.openSheet('Daftar Hewan', () => {
    const e = this.e;
    const out = [h('div', { class: 'sub' }, 'Buka spesies satu per satu dengan uang. Tier lebih tinggi harganya lebih mahal dan lebih untung. Perluas toko untuk membuka kategori baru.')];
    for (const cat of CATEGORIES) {
      const items = itemsOf(cat.id);
      const open = e.categoryOpen(cat.id);
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `${CAT_EMOJI[cat.id]} ${cat.name}`), h('span', { class: 'badge' }, open ? 'Terbuka' : `🔒 Toko Lv ${cat.needShop}`)),
        items.map((it) => {
          const st = e.speciesStatus(it.id);
          const right = st.state === 'terbuka' ? h('span', { class: 'badge good' }, '✔ Dimiliki')
            : st.state === 'bisa' ? h('button', { class: 'btn small', disabled: e.state.ledger.balance < st.cost || e.state.phase === 'open', onClick: () => this.act(() => e.unlockSpecies(it.id), `${it.name} terbuka!`) }, `Buka ${rp(st.cost)}`)
              : st.state === 'urut' ? h('span', { class: 'sub' }, `Buka ${getItem(st.prev).name} dulu`)
                : h('span', { class: 'sub' }, '🔒');
          return h('div', { class: 'row', style: 'justify-content:space-between' },
            h('div', {}, h('div', { class: 'card-title' }, `Tier ${it.tier} · ${iname(it)}`), h('div', { class: 'sub' }, `Grosir ±${rp(it.wholesale)} · Jual ±${rp(it.retail)}`)),
            right);
        })));
    }
    return out;
  });
};

// ---------- Bintang ----------
P.openBintang = function openBintang() {
  this.openSheet('Reputasi & Bintang', () => {
    const e = this.e;
    const s = e.state;
    const sp = e.starProgress();
    const out = [h('div', { class: 'card hero' },
      h('div', { class: 'card-top' }, h('b', { style: 'font-size:20px' }, starsText(s.stars)), h('span', { class: 'price' }, `Reputasi ${s.reputation.toFixed(1)}`)),
      h('div', { class: 'meter' }, h('i', { style: `width:${sp.pct}%` })),
      h('div', { class: 'sub' }, sp.to ? `Butuh reputasi ${sp.to} untuk bintang ${s.stars + 1}` : 'Bintang maksimum! 🎉'),
      h('div', { class: 'sub' }, 'Reputasi naik saat pelanggan terlayani, turun bila mereka pergi tanpa membeli atau cicilan terlambat. Bintang tidak pernah turun.'))];
    STAR_PERKS.forEach((pk, i) => {
      const got = s.stars >= pk.stars;
      out.push(h('div', { class: `card${got ? '' : ' dim'}` },
        h('div', { class: 'card-top' }, h('b', {}, `${starsText(pk.stars)} ${pk.title}`), h('span', { class: 'badge' }, got ? '✔ Aktif' : `rep ${STAR_THRESH[i]}`)),
        h('div', { class: 'sub', style: 'white-space:pre-line' }, pk.text.map((t) => `• ${t}`).join('\n'))));
    });
    return out;
  });
};

// ---------- Pohon Skill ----------
P.openSkill = function openSkill() {
  this.openSheet('Skill, Perk & Atribut', () => {
    const e = this.e;
    const tab = this.skillTab || 'skill';
    const pips = (rank, max) => h('span', { class: 'pips' }, Array.from({ length: Math.min(max, 10) }, (_v, i) => h('i', { class: i < rank ? 'on' : '' })));
    const out = [h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, 'Poin skill'), h('span', { class: 'price' }, `${e.skillPointsFree()} bebas / ${e.skillPointsTotal()}`)),
      h('div', { class: 'card-top' }, h('b', {}, 'Poin atribut'), h('span', { class: 'price' }, `${e.attrPointsFree()} bebas / ${e.attrPointsTotal()}`)),
      h('div', { class: 'sub' }, 'Skill = pohon cabang (maks 3 rank, makin tinggi makin mahal). Perk = bonus berjenjang yang butuh level atribut. Poin dari bintang, level toko, bab cerita, misi, dan hari bermain.'),
      h('button', { class: 'btn secondary small', disabled: e.skillPointsSpent() === 0 || e.state.phase === 'open', onClick: () => { if (confirm('Reset semua skill dan perk? Poin dikembalikan.')) this.act(() => e.resetSkills(), 'Skill di-reset'); } }, '↺ Reset skill & perk (gratis)')),
      this.chips([{ id: 'skill', label: '🌳 Skill' }, { id: 'perk', label: '⭐ Perk' }, { id: 'attr', label: '🎯 Atribut' }], tab, (id) => { this.skillTab = id; this.rerender(); })];

    if (tab === 'skill') {
      this.skillBranch ||= SKILL_BRANCHES[0].id;
      const used = (br) => SKILLS.filter((x) => x.branch === br.id).reduce((n, x) => n + e.skillRank(x.id), 0);
      out.push(h('div', { class: 'chips' }, SKILL_BRANCHES.map((br) => h('button', { class: `chip${br.id === this.skillBranch ? ' on' : ''}`, onClick: () => { this.skillBranch = br.id; this.rerender(); } }, `${br.icon} ${br.name}${used(br) ? ` (${used(br)})` : ''}`))));
      const nodes = SKILLS.filter((x) => x.branch === this.skillBranch);
      if (!nodes.length) out.push(h('div', { class: 'card' }, 'Belum ada skill di cabang ini. Cek tab Perk.'));
      for (let tier = 1; tier <= 4; tier++) {
        const row = nodes.filter((x) => x.tier === tier);
        if (!row.length) continue;
        out.push(h('div', { class: 'sub', style: 'font-weight:800;margin-top:4px' }, `Tingkat ${tier}`));
        for (const sk of row) {
          const rank = e.skillRank(sk.id);
          const why = e.canLearn(sk.id);
          out.push(h('div', { class: 'card' },
            h('div', { class: 'card-top' }, h('b', {}, sk.name), pips(rank, sk.max)),
            h('div', { class: 'sub' }, sk.desc),
            sk.req ? h('div', { class: 'sub' }, `↳ butuh ${getSkill(sk.req).name}${e.skillRank(sk.req) < 1 ? ' (belum)' : ' ✔'}`) : null,
            rank >= sk.max ? h('span', { class: 'badge good' }, 'Maksimal')
              : h('button', { class: 'btn small', disabled: !!why, onClick: () => this.act(() => e.learnSkill(sk.id), `${sk.name} naik`) }, why ? why : `Pelajari (${e.skillCostNext(sk.id)} poin)`)));
        }
      }
      return out;
    }

    if (tab === 'attr') {
      for (const at of ATTRS) {
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, `${at.icon} ${at.name}`), h('span', { class: 'price' }, `Lv ${e.attrLevel(at.id)}`)),
          h('div', { class: 'sub' }, at.text),
          h('button', { class: 'btn small', disabled: e.attrPointsFree() < 1, onClick: () => this.act(() => e.addAttr(at.id), `${at.name} naik`) }, '+1 level (1 poin atribut)')));
      }
      out.push(h('button', { class: 'btn secondary small', disabled: e.attrPointsSpent() === 0, onClick: () => this.act(() => e.resetAttrs(), 'Atribut di-reset') }, '↺ Reset atribut (gratis)'));
      return out;
    }

    this.perkAttr ||= ATTRS[0].id;
    out.push(h('div', { class: 'chips' }, ATTRS.map((at) => h('button', { class: `chip${at.id === this.perkAttr ? ' on' : ''}`, onClick: () => { this.perkAttr = at.id; this.rerender(); } }, `${at.icon} ${at.name} ${e.attrLevel(at.id)}`))));
    for (const pk of PERKS.filter((x) => x.attr === this.perkAttr)) {
      const rank = e.skillRank(pk.id);
      const why = e.canLearn(pk.id);
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, pk.name), h('span', { class: 'badge' }, `${rank}/${pk.max}`)),
        h('div', { class: 'meter' }, h('i', { style: `width:${(rank / pk.max) * 100}%` })),
        h('div', { class: 'sub' }, pk.desc),
        rank >= pk.max ? h('span', { class: 'badge good' }, 'Maksimal')
          : h('button', { class: 'btn small', disabled: !!why, onClick: () => this.act(() => e.learnSkill(pk.id), `${pk.name} naik`) }, why ? why : `Tingkatkan (${e.skillCostNext(pk.id)} poin)`)));
    }
    return out;
  });
};

// ---------- Upgrade & Perluas ----------
P.openUpgrade = function openUpgrade() {
  this.openSheet('Upgrade & Perluas', () => {
    const e = this.e;
    const s = e.state;
    const cur = SHOP_LEVELS[s.shopLevel - 1];
    const next = e.nextShopLevel();
    const out = [h('div', { class: 'card hero' },
      h('div', { class: 'card-top' }, h('b', {}, `🏬 ${cur.name} (Lv ${cur.level})`), h('span', { class: 'price' }, `Kapasitas ${e.capacity()}`)),
      next ? [
        h('div', { class: 'sub' }, `Berikutnya: ${next.name} — ${next.text}`),
        h('div', { class: 'sub' }, `Butuh ${starsText(next.needStars)} · sewa harian naik`),
        h('button', { class: 'btn', disabled: s.ledger.balance < next.cost || s.stars < next.needStars || s.phase === 'open', onClick: () => this.act(() => e.expandShop(), `Toko jadi ${next.name}!`) },
          s.stars < next.needStars ? `Butuh bintang ${next.needStars}` : `Perluas · ${rp(next.cost)}`),
      ] : h('div', { class: 'sub good' }, 'Toko sudah level maksimum.'))];
    for (const u of UPGRADES) {
      const lvl = s.upgrades[u.id] || 0;
      const cost = e.upgradeCost(u.id);
      const avail = e.upgradeAvailable(u.id);
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, u.name), h('span', { class: 'badge' }, `Lv ${lvl}/${u.costs.length}`)),
        h('div', { class: 'sub' }, u.desc),
        h('button', { class: 'btn small', disabled: !avail || cost === null || s.ledger.balance < cost || s.phase === 'open', onClick: () => this.act(() => e.buyUpgrade(u.id), `${u.name} naik`) },
          !avail ? '🔒 Syarat belum terpenuhi (kategori/level toko)' : cost === null ? 'Maksimum' : `Upgrade · ${rp(cost)}`)));
    }
    return out;
  });
};

// ---------- Ramuan ----------
P.openRamuan = function openRamuan() {
  this.openSheet('Ramuan', () => {
    const e = this.e;
    const s = e.state;
    if (s.stars < 2) return [this.lockCard('Ramuan terbuka di bintang 2')];
    return [h('div', { class: 'sub' }, 'Aktifkan sebelum buka toko. Efek berjalan per hari.'), ...POTIONS.map((p) => {
      const have = s.potions[p.id] || 0;
      const active = s.buffs[p.id] || 0;
      return h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `${p.icon} ${p.name}`), h('span', { class: 'badge' }, active ? `Aktif ${active} hari` : `Punya ${have}`)),
        h('div', { class: 'sub' }, p.desc),
        h('div', { class: 'row' },
          h('button', { class: 'btn secondary small grow', disabled: s.ledger.balance < p.price || s.phase === 'open', onClick: () => this.act(() => e.buyPotion(p.id), `Beli ${p.name}`) }, `Beli ${rp(p.price)}`),
          h('button', { class: 'btn small grow', disabled: have < 1 || !!active || s.phase === 'open', onClick: () => this.act(() => e.activatePotion(p.id), `${p.name} aktif`) }, 'Pakai')));
    })];
  });
};

// ---------- Aturan Jual ----------
P.openAturan = function openAturan() {
  this.openSheet('Aturan Jual', () => {
    const e = this.e;
    const pol = e.state.policy;
    const counts = {};
    for (const a of e.state.farm.animals) counts[a.rarity] = (counts[a.rarity] || 0) + 1;
    const out = [h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, 'Gudang hewan'), h('span', { class: 'price' }, `${e.state.farm.animals.length} / ${e.animalCap()}`)),
      h('div', { class: 'sub' }, 'Gudang kecil di awal, naik lewat level toko, upgrade Rak, dan skill Gudang. Bila penuh, panen tertahan.'))];
    for (const r of FRAR) {
      const cur = pol.sell[r.id] || 'normal';
      const sel = h('select', { onChange: (ev) => this.act(() => e.setSellMode(r.id, ev.target.value), 'Aturan disimpan', null) },
        SELL_MODES.map((m) => h('option', { value: m.id, selected: cur === m.id }, m.name)));
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('span', { class: 'rar', style: `color:${r.color};border-color:${r.color}` }, r.name), h('span', { class: 'sub' }, `punya ${counts[r.id] || 0}`)),
        sel, h('div', { class: 'sub' }, SELL_MODES.find((m) => m.id === cur).desc)));
    }
    const pct = h('select', { onChange: (ev) => this.act(() => e.setObralPct(Number(ev.target.value)), 'Disimpan', null) },
      [0.1, 0.15, 0.25, 0.35, 0.5].map((v) => h('option', { value: v, selected: Math.abs(pol.obralPct - v) < 0.001 }, `Diskon ${Math.round(v * 100)}%`)));
    out.push(h('div', { class: 'card' }, h('b', {}, 'Besar diskon Obral'), pct));
    return out;
  });
};

// ---------- Karyawan ----------
P.openKaryawan = function openKaryawan() {
  const tab = this._crewTab || 'tim';
  this.openSheet('Karyawan', () => {
    const e = this.e;
    const s = e.state;
    const c = s.crew;
    const slots = e.crewSlots();
    const setTab = (t) => { this._crewTab = t; this.openKaryawan(); };
    const out = [
      h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `Slot ${c.hired.length} / ${slots}`), h('span', { class: 'price' }, `${rp(e.wages())}/hari`)),
        h('div', { class: 'sub' }, slots === 0
          ? 'Belum ada slot. Pelajari skill Manajemen Tim (cabang Logistik) untuk membuka slot karyawan.'
          : 'Gaji dibayar tiap akhir hari. Tambah slot lewat skill Manajemen Tim; Tim Sigap mempercepat kerja.')),
      h('div', { class: 'row' }, ...[['tim', 'Tim'], ['rekrut', 'Rekrut'], ['stok', 'Penjaga Stok']].map(([id, label]) =>
        h('button', { class: `btn small grow ${tab === id ? '' : 'secondary'}`, onClick: () => setTab(id) }, label))),
    ];
    if (tab === 'tim') {
      if (!c.hired.length) out.push(h('div', { class: 'sub' }, 'Belum ada karyawan. Buka tab Rekrut.'));
      for (const m of c.hired) {
        const def = STAFF.find((x) => x.id === m.type);
        const cost = e.crewUpgradeCost(m);
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, `${def.icon} ${def.name} Lv${m.lvl}`), h('span', { class: 'price' }, `${rp(e.wageOf(m))}/hari`)),
          h('div', { class: 'sub' }, def.desc),
          h('div', { class: 'row' },
            h('button', { class: 'btn small grow', disabled: cost === null || s.ledger.balance < cost, onClick: () => this.act(() => e.upgradeCrew(m.uid), `${def.name} naik level`) }, cost === null ? 'Level maks' : `Naik level ${rp(cost)}`),
            h('button', { class: 'btn danger small', onClick: () => { if (confirm(`Berhentikan ${def.name}?`)) this.act(() => e.fire(m.uid), `${def.name} diberhentikan`); } }, 'Berhentikan'))));
      }
    } else if (tab === 'rekrut') {
      for (const def of STAFF) {
        const st = e.crewStatus(def.id);
        const n = c.hired.filter((m) => m.type === def.id).length;
        if (def.secret && !st.unlocked) {
          out.push(h('div', { class: 'card' }, h('div', { class: 'card-top' }, h('b', {}, '❓ ???'), h('span', { class: 'badge' }, 'Rahasia')),
            h('div', { class: 'sub' }, `Misi: ${def.mission.desc} (${Math.min(st.have, st.goal)}/${st.goal})`)));
          continue;
        }
        let action;
        if (st.unlocked) {
          action = h('button', { class: 'btn small', disabled: n >= def.max || c.hired.length >= slots, onClick: () => this.act(() => e.hire(def.id), `${def.name} dipekerjakan`) },
            n >= def.max ? `Maksimal ${def.max}` : c.hired.length >= slots ? 'Slot penuh' : 'Pekerjakan');
        } else {
          action = h('button', { class: 'btn small', disabled: s.ledger.balance < def.license, onClick: () => this.act(() => e.buyLicense(def.id), `Lisensi ${def.name} dibeli`) }, `Beli lisensi ${rp(def.license)}`);
        }
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, `${def.icon} ${def.name}`), h('span', { class: 'badge' }, `${n}/${def.max}`)),
          h('div', { class: 'sub' }, def.desc),
          st.unlocked ? h('div', { class: 'sub' }, `Terbuka lewat ${st.via}. Gaji ${rp(Math.round(def.wage * 1.5))}/hari`)
            : h('div', { class: 'sub' }, `Misi: ${def.mission.desc} (${Math.min(st.have, st.goal)}/${st.goal}) atau beli lisensi.`),
          action));
      }
    } else {
      const k = c.keeper;
      if (!c.hired.some((m) => m.type === 'penjaga')) out.push(h('div', { class: 'sub' }, 'Rekrut Penjaga Stok dulu. Awalnya ia bekerja lambat; naikkan level dan skill Tim Sigap.'));
      out.push(h('div', { class: 'card' },
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: k.harvest, onChange: (ev) => this.act(() => e.setKeeperOpts({ harvest: ev.target.checked }), 'Disimpan') }), h('span', { class: 'sub' }, 'Panen otomatis yang sudah matang')),
        h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: k.autoBuy, onChange: (ev) => this.act(() => e.setKeeperOpts({ autoBuy: ev.target.checked }), 'Disimpan') }), h('span', { class: 'sub' }, 'Beli bibit otomatis bila uang cukup'))));
      // Draft disimpan di this._keeperDraft supaya mengubah satu baris tidak menghapus baris lain.
      const items = e.unlockedItems();
      const draft = this._keeperDraft || (this._keeperDraft = {});
      for (const it of items) {
        if (!draft[it.id]) { const r = k.rules[it.id]; draft[it.id] = { below: r ? r.below : 0, qty: r ? r.qty : 1, feed: r ? r.feed || '' : '' }; }
      }
      const feeds = FEEDS.filter((f) => feedOpen(e, f));
      const dirty = items.some((it) => { const r = k.rules[it.id]; const d = draft[it.id]; return (r ? r.below : 0) !== d.below || (r ? r.qty : 1) !== d.qty || (r ? r.feed || '' : '') !== d.feed; });
      const allBelow = h('input', { type: 'number', min: 0, max: 50, value: 5, inputMode: 'numeric', style: 'width:52px' });
      const allQty = h('input', { type: 'number', min: 1, max: 6, value: 2, inputMode: 'numeric', style: 'width:44px' });
      const allFeed = h('select', {}, [h('option', { value: '' }, 'Tanpa pakan'), ...feeds.map((f) => h('option', { value: f.id }, f.name))]);
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, 'Atur semua sekaligus')),
        h('div', { class: 'row' }, h('span', { class: 'sub' }, 'Stok <'), allBelow, h('span', { class: 'sub' }, 'jml'), allQty, h('div', { class: 'grow' }, allFeed)),
        h('div', { class: 'row' },
          h('button', { class: 'btn small grow secondary', onClick: () => {
            for (const it of items) draft[it.id] = { below: Math.max(0, Math.min(50, Number(allBelow.value) || 0)), qty: Math.max(1, Math.min(6, Number(allQty.value) || 1)), feed: allFeed.value };
            this.openKaryawan();
          } }, 'Isi ke semua'),
          h('button', { class: 'btn small danger', onClick: () => { for (const it of items) draft[it.id] = { below: 0, qty: 1, feed: '' }; this.openKaryawan(); } }, 'Kosongkan'))));
      out.push(h('div', { class: 'sub', style: 'font-weight:700' }, 'Tanam lagi bila stok kurang dari (ubah lalu tekan Simpan semua):'));
      for (const it of items) {
        const d = draft[it.id];
        const below = h('input', { type: 'number', min: 0, max: 50, value: d.below, inputMode: 'numeric', style: 'width:52px', onInput: (ev) => { d.below = Math.max(0, Math.min(50, Number(ev.target.value) || 0)); } });
        const qty = h('input', { type: 'number', min: 1, max: 6, value: d.qty, inputMode: 'numeric', style: 'width:44px', onInput: (ev) => { d.qty = Math.max(1, Math.min(6, Number(ev.target.value) || 1)); } });
        const feed = h('select', { onChange: (ev) => { d.feed = ev.target.value; } }, [h('option', { value: '' }, 'Tanpa pakan'), ...feeds.map((f) => h('option', { value: f.id, selected: d.feed === f.id }, f.name))]);
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, iname(it)), h('span', { class: 'sub' }, `stok ${e.keeperStock(it.id)}`)),
          h('div', { class: 'row' }, h('span', { class: 'sub' }, '<'), below, h('span', { class: 'sub' }, 'jml'), qty, h('div', { class: 'grow' }, feed))));
      }
      out.push(h('div', { class: 'row', style: 'position:sticky;bottom:0;padding:6px 0;background:var(--cream,#fff3d6)' },
        h('button', { class: 'btn grow', onClick: () => {
          this.act(() => { for (const it of items) { const d = draft[it.id]; e.setKeeperRule(it.id, { below: d.below, qty: d.qty, feed: d.feed || null }); } }, dirty ? 'Semua aturan disimpan' : 'Aturan disimpan');
          this._keeperDraft = null;
        } }, dirty ? 'Simpan semua ●' : 'Simpan semua')));
    }
    return out;
  });
};

// ---------- Breeding ----------
P.openBreeding = function openBreeding() {
  this.openSheet('Breeding', () => {
    const e = this.e;
    const s = e.state;
    if (!e.breedSlots()) return [this.lockCard('Pelajari skill "Pengembang Biak" di Pohon Skill (cabang Peternakan).')];
    const out = [h('div', { class: 'card' },
      h('div', { class: 'card-top' }, h('b', {}, 'Kandang'), h('span', { class: 'price' }, `${s.breeding.length} / ${e.breedSlots()}`)),
      h('div', { class: 'sub' }, 'Pilih 2 ekor dengan kualitas sama dari stok. Induk dikembalikan bersama anakan saat matang. Biaya = 25% harga grosir pasangan.'))];
    for (const b of s.breeding) {
      const left = b.ready - s.day;
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `${iname(getItem(b.itemId))} ${qStars(getQuality(b.quality).stars)}`), h('span', { class: 'badge' }, left > 0 ? `${left} hari lagi` : '✔ Siap')),
        h('div', { class: 'sub' }, `${b.offspring.length} anakan`),
        h('button', { class: 'btn small', disabled: left > 0 || s.phase === 'open', onClick: () => this.act(() => e.collectBreeding(b.id), (r) => `Dapat ${r.length} anakan + 2 induk kembali`) }, 'Ambil')));
    }
    if (s.breeding.length < e.breedSlots()) {
      const cands = e.stockLots().filter((l) => getItem(l.itemId).cat !== 'perlengkapan' && l.qty >= 2);
      out.push(h('div', { class: 'sub', style: 'font-weight:700;margin-top:4px' }, 'Mulai breeding baru'));
      if (!cands.length) out.push(h('div', { class: 'card' }, 'Belum ada hewan dengan 2 ekor kualitas sama di stok.'));
      for (const l of cands) {
        const fee = Math.max(1, Math.round(e.wholesalePrice(l.itemId, l.quality) * 2 * 0.25));
        out.push(h('div', { class: 'card' },
          h('div', { class: 'card-top' }, h('b', {}, `${iname(getItem(l.itemId))} ${qStars(getQuality(l.quality).stars)}`), h('span', { class: 'sub' }, `stok ${l.qty}`)),
          h('button', { class: 'btn small', disabled: s.ledger.balance < fee || s.phase === 'open', onClick: () => this.act(() => e.startBreeding(l.itemId, l.quality), (r) => `Breeding dimulai, matang hari ${r.ready}`) }, `Mulai · ${rp(fee)}`)));
      }
    }
    return out;
  });
};

// ---------- Bank ----------
P.openBank = function openBank() {
  this.bankAmt = this.bankAmt || 10000;
  this.bankTerm = this.bankTerm ?? 0;
  this.openSheet('Bank', () => {
    const e = this.e;
    const s = e.state;
    if (s.stars < 2) return [this.lockCard('Bank terbuka di bintang 2')];
    const term = LOAN_TERMS[this.bankTerm];
    const total = this.bankAmt + Math.floor(this.bankAmt * term.rate);
    const amt = h('input', { type: 'number', min: LOAN_MIN, step: LOAN_STEP, value: this.bankAmt, inputMode: 'numeric', onChange: (ev) => { this.bankAmt = Math.max(LOAN_MIN, Math.round(Number(ev.target.value) / LOAN_STEP) * LOAN_STEP); this.rerender(); } });
    const out = [
      h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, 'Batas pinjaman'), h('span', { class: 'price' }, `${rp(e.loanAvailable())} tersedia`)),
        h('div', { class: 'sub' }, `Total batas ${rp(e.loanLimit())} (naik dengan bintang dan level toko). Cicilan dipotong otomatis tiap akhir hari; telat = denda dan reputasi turun.`)),
      h('div', { class: 'card' },
        h('b', {}, 'Ajukan pinjaman'),
        amt,
        h('select', { onChange: (ev) => { this.bankTerm = Number(ev.target.value); this.rerender(); } },
          LOAN_TERMS.map((t, i) => h('option', { value: i, selected: i === this.bankTerm }, `${t.days} hari · bunga ${Math.round(t.rate * 100)}%`))),
        h('div', { class: 'sub' }, `Terima ${rp(this.bankAmt)} · wajib kembali ${rp(total)} · cicilan ±${rp(Math.ceil(total / term.days))}/hari`),
        h('button', { class: 'btn', disabled: s.phase === 'open', onClick: () => this.act(() => e.takeLoan(this.bankAmt, this.bankTerm), `Pinjaman ${rp(this.bankAmt)} cair`) }, 'Ajukan')),
    ];
    for (const l of s.loans) {
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `Pinjaman ${rp(l.principal)}`), h('span', { class: 'price bad' }, `Sisa ${rp(l.remaining)}`)),
        h('div', { class: 'sub' }, `${l.daysLeft > 0 ? `${l.daysLeft} hari lagi` : 'Jatuh tempo'} · cicilan ${rp(l.perDay)}/hari${l.late ? ` · telat ${l.late}x` : ''}`),
        h('button', { class: 'btn secondary small', disabled: s.ledger.balance < 1 || s.phase === 'open', onClick: () => this.act(() => e.repayLoan(l.id, Math.min(l.remaining, s.ledger.balance)), 'Pembayaran dicatat') },
          s.ledger.balance >= l.remaining ? 'Lunasi' : 'Bayar sebisanya')));
    }
    if (s.arrears > 0) out.push(h('div', { class: 'card' }, h('b', { class: 'bad' }, `Tunggakan sewa/gaji: ${rp(s.arrears)}`), h('div', { class: 'sub' }, 'Dibayar otomatis dari penghasilan berikutnya.')));
    return out;
  });
};

// ---------- Investasi ----------
P.openInvestasi = function openInvestasi() {
  this.invAmt = this.invAmt || 20000;
  this.invTerm = this.invTerm ?? 1;
  this.shareQty = this.shareQty || {};
  this.openSheet('Investasi', () => {
    const e = this.e;
    const s = e.state;
    if (s.stars < 3) return [this.lockCard('Investasi terbuka di bintang 3')];
    const term = DEPOSIT_TERMS[this.invTerm];
    const out = [h('div', { class: 'card hero' }, h('div', { class: 'card-top' }, h('b', {}, 'Kekayaan bersih'), h('span', { class: 'price' }, rp(e.netWorth()))),
      h('div', { class: 'sub' }, `Pasif harian dari properti: ${rp(e.propertyIncome())}`))];

    // Deposito
    const amt = h('input', { type: 'number', min: DEPOSIT_MIN, value: this.invAmt, inputMode: 'numeric', onChange: (ev) => { this.invAmt = Math.max(DEPOSIT_MIN, Math.floor(Number(ev.target.value) || DEPOSIT_MIN)); this.rerender(); } });
    out.push(h('div', { class: 'card' },
      h('b', {}, '💰 Deposito'),
      amt,
      h('select', { onChange: (ev) => { this.invTerm = Number(ev.target.value); this.rerender(); } }, DEPOSIT_TERMS.map((t, i) => h('option', { value: i, selected: i === this.invTerm }, `${t.days} hari · bunga ${Math.round(t.rate * 100)}%`))),
      h('div', { class: 'sub' }, `Kembali ${rp(this.invAmt + Math.floor(this.invAmt * term.rate))} (bunga ${rp(Math.floor(this.invAmt * term.rate))}). Dicairkan lebih awal = tanpa bunga.`),
      h('button', { class: 'btn', disabled: s.phase === 'open', onClick: () => this.act(() => e.openDeposit(this.invAmt, this.invTerm), 'Deposito dibuka') }, 'Buka deposito')));
    for (const d of s.deposits) {
      const left = d.matureDay - s.day + 1;
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, `Deposito ${rp(d.principal)}`), h('span', { class: 'price good' }, `+${rp(d.interest)}`)),
        h('div', { class: 'sub' }, `Cair akhir hari ke-${d.matureDay} (${Math.max(0, left)} hari lagi)`),
        h('button', { class: 'btn secondary small', disabled: s.phase === 'open', onClick: () => { if (confirm('Cairkan sekarang tanpa bunga?')) this.act(() => e.withdrawDeposit(d.id), 'Dicairkan tanpa bunga'); } }, 'Cairkan lebih awal')));
    }

    // Saham
    out.push(h('div', { class: 'sub', style: 'font-weight:700;margin-top:4px' }, '📈 Saham (harga bergerak tiap hari, jual kena biaya 1%)'));
    for (const sh of SHARES) {
      const price = e.sharePrice(sh.id);
      const hist = s.sharePrices[sh.id].hist;
      const prev = hist.length > 1 ? hist[hist.length - 2] : price;
      const diff = price - prev;
      const hold = s.shares[sh.id];
      const q = (this.shareQty[sh.id] ||= 1);
      const qIn = h('input', { type: 'number', min: 1, value: q, inputMode: 'numeric', style: 'width:80px', onChange: (ev) => { this.shareQty[sh.id] = Math.max(1, Math.floor(Number(ev.target.value) || 1)); this.rerender(); } });
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('div', {}, h('b', {}, sh.name), h('div', { class: 'sub' }, sh.desc)),
          h('div', { class: 'price' }, rp(price), ' ', h('span', { class: diff > 0 ? 'down' : diff < 0 ? 'up' : 'sub' }, diff === 0 ? '' : diff > 0 ? `▲${diff}` : `▼${-diff}`))),
        h('div', { class: 'sub' }, `Grafik: ${hist.slice(-10).map((v) => v).join(' › ')}`),
        hold ? h('div', { class: 'sub' }, `Punya ${hold.qty} lembar · modal ${rp(hold.cost)} · nilai ${rp(hold.qty * price)}`) : null,
        h('div', { class: 'row' }, qIn,
          h('button', { class: 'btn small grow', disabled: s.phase === 'open', onClick: () => this.act(() => e.buyShares(sh.id, this.shareQty[sh.id]), `Beli ${this.shareQty[sh.id]} lembar`) }, `Beli ${rp(price * q)}`),
          h('button', { class: 'btn secondary small grow', disabled: !hold || s.phase === 'open', onClick: () => this.act(() => e.sellShares(sh.id, Math.min(this.shareQty[sh.id], hold.qty)), 'Saham dijual') }, 'Jual'))));
    }

    // Properti
    out.push(h('div', { class: 'sub', style: 'font-weight:700;margin-top:4px' }, '🏘️ Properti (pendapatan sewa tiap hari)'));
    for (const p of PROPERTIES) {
      const n = s.properties[p.id] || 0;
      out.push(h('div', { class: 'card' },
        h('div', { class: 'card-top' }, h('b', {}, p.name), h('span', { class: 'badge' }, `${n}/${p.max}`)),
        h('div', { class: 'sub' }, `Harga ${rp(p.cost)} · sewa ${rp(p.income)}/hari · balik modal ±${Math.ceil(p.cost / p.income)} hari · jual ${rp(Math.floor(p.cost * PROPERTY_SELL_RATE))}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn small grow', disabled: n >= p.max || s.ledger.balance < p.cost || s.phase === 'open', onClick: () => this.act(() => e.buyProperty(p.id), `${p.name} dibeli`) }, n >= p.max ? 'Maksimum' : `Beli ${rp(p.cost)}`),
          h('button', { class: 'btn secondary small', disabled: n < 1 || s.phase === 'open', onClick: () => { if (confirm(`Jual ${p.name} dengan harga ${Math.round(PROPERTY_SELL_RATE * 100)}%?`)) this.act(() => e.sellProperty(p.id), 'Properti dijual'); } }, 'Jual'))));
    }
    return out;
  });
};

// ---------- Misi & Pencapaian ----------
P.claimableCount = function claimableCount() {
  const e = this.e;
  e.ensureQuests();
  const q = e.state.quests;
  let n = [...q.daily, ...q.weekly].filter((x) => x.prog >= x.goal && !x.claimed).length;
  n += Object.values(e.state.ach).filter((a) => !a.claimed).length;
  return n;
};

P.questSummary = function questSummary() {
  const q = this.e.state.quests;
  const done = q.daily.filter((x) => x.prog >= x.goal).length;
  return `Harian ${done}/${q.daily.length}`;
};

const rewardText = (r) => [r.cash ? rp(r.cash) : null, r.points ? `${r.points} poin skill` : null].filter(Boolean).join(' + ');

P.openMisi = function openMisi() {
  this.misiTab = this.misiTab || 'daily';
  this.openSheet('Misi & Pencapaian', () => {
    const e = this.e;
    e.ensureQuests();
    const s = e.state;
    const q = s.quests;
    const unclaimedAch = Object.values(s.ach).filter((a) => !a.claimed).length;
    const out = [this.chips([
      { id: 'daily', label: `📅 Harian` },
      { id: 'weekly', label: `🗓️ Mingguan` },
      { id: 'ach', label: `🏅 Pencapaian${unclaimedAch ? ` (${unclaimedAch})` : ''}` },
    ], this.misiTab, (id) => { this.misiTab = id; this.rerender(); })];
    const questCard = (x, i, scope) => {
      const done = x.prog >= x.goal;
      return h('div', { class: `card${x.claimed ? ' dim' : ''}` },
        h('div', { class: 'card-top' }, h('b', {}, `${questIcon(x)} ${questText(x)}`), h('span', { class: 'badge' }, x.claimed ? '✔ Diambil' : `${x.prog}/${x.goal}`)),
        h('div', { class: 'meter' }, h('i', { style: `width:${Math.min(100, (x.prog / x.goal) * 100)}%` })),
        h('div', { class: 'row', style: 'justify-content:space-between' },
          h('span', { class: 'sub' }, `Hadiah: ${rewardText(x.reward)}`),
          h('button', { class: 'btn small', disabled: !done || x.claimed, onClick: () => this.act(() => e.claimQuest(scope, i), (r) => `Hadiah ${rewardText(r)}${r.chest ? ` + peti ${rp(r.chest)}!` : ''}`, 'star') }, x.claimed ? 'Selesai' : done ? 'Ambil' : 'Belum')));
    };
    if (this.misiTab === 'daily') {
      out.push(h('div', { class: 'sub' }, `Hari ${s.day}. Misi harian diganti tiap hari baru. Misi yang selesai tapi lupa diambil dibayar otomatis.`));
      q.daily.forEach((x, i) => out.push(questCard(x, i, 'daily')));
      out.push(h('div', { class: 'card hero' }, h('b', {}, `🎁 Peti misi harian ${q.dailyChest ? '(sudah diambil)' : ''}`), h('div', { class: 'sub' }, `Ambil semua misi harian: bonus ${rp(Math.round(CHEST_DAILY * (1 + 0.8 * (s.stars - 1))))}. Tiap 3 hari penuh = 1 poin skill (sudah ${s.stats.dailyFull || 0} hari).`)));
    } else if (this.misiTab === 'weekly') {
      const endDay = (q.weekId + 1) * 7;
      out.push(h('div', { class: 'sub' }, `Berakhir di akhir hari ke-${endDay} (${Math.max(0, endDay - s.day + 1)} hari lagi). Selesaikan semua untuk peti ${rp(Math.round(CHEST_WEEKLY * (1 + 0.8 * (s.stars - 1))))} + 1 poin skill${q.weeklyChest ? ' (sudah diambil)' : ''}.`));
      q.weekly.forEach((x, i) => out.push(questCard(x, i, 'weekly')));
    } else {
      e.checkAchievements();
      const total = ACHIEVEMENTS.length;
      out.push(h('div', { class: 'sub' }, `${Object.keys(s.ach).length}/${total} terbuka · Misi selesai: ${s.stats.questsDone}`));
      for (const a of ACHIEVEMENTS) {
        const st = s.ach[a.id];
        const val = Math.min(a.goal, Math.floor(achStat(e, a.stat)));
        out.push(h('div', { class: `card${st ? '' : ' dim'}` },
          h('div', { class: 'card-top' }, h('b', {}, `${a.icon} ${a.name}`), h('span', { class: 'badge' }, st ? (st.claimed ? '✔' : '🎁') : `${val.toLocaleString('id-ID')}/${a.goal.toLocaleString('id-ID')}`)),
          h('div', { class: 'sub' }, a.desc),
          st ? h('div', { class: 'row', style: 'justify-content:space-between' },
            h('span', { class: 'sub' }, `Hadiah: ${rewardText(a.reward)}`),
            h('button', { class: 'btn small', disabled: st.claimed, onClick: () => this.act(() => e.claimAchievement(a.id), (r) => `Hadiah ${rewardText(r)}`, 'star') }, st.claimed ? 'Diambil' : 'Ambil')) : null));
      }
    }
    return out;
  });
};

// ---------- Buku Langganan ----------
P.regularClaimable = function regularClaimable() {
  return Object.values(this.e.state.regulars).filter((r) => (r.claimed ?? 1) < bondLevel(r.bond) && LEVEL_REWARDS[(r.claimed ?? 1) + 1]).length;
};

P.openLangganan = function openLangganan() {
  this.openSheet('Buku Langganan', () => {
    const e = this.e;
    const out = [h('div', { class: 'sub' }, 'Pelanggan tetap datang kalau hewan favoritnya sudah kamu jual. Penuhi permintaan kualitasnya agar makin akrab, rela bayar lebih mahal, dan memberi hadiah tiap naik level.')];
    for (const r of REGULARS) {
      const st = e.state.regulars[r.id];
      const fav = getItem(r.fav);
      if (!e.isUnlocked(r.fav) && !st) {
        out.push(h('div', { class: 'card dim' }, h('b', {}, '❓ Belum dikenal'), h('div', { class: 'sub' }, `Buka spesies ${fav.name} untuk bertemu dia.`)));
        continue;
      }
      if (!st) {
        out.push(h('div', { class: 'card' }, h('b', {}, `${r.icon} ${r.name}`), h('div', { class: 'sub' }, r.story), h('div', { class: 'sub' }, `Suka: ${iname(fav)}. Belum pernah berkunjung.`)));
        continue;
      }
      const lvl = bondLevel(st.bond);
      const nt = nextThresh(st.bond);
      const claimedLv = st.claimed ?? 1;
      const canClaim = claimedLv < lvl && LEVEL_REWARDS[claimedLv + 1];
      const base = BOND_THRESH[lvl - 1];
      out.push(h('div', { class: `card${canClaim ? ' hero' : ''}` },
        h('div', { class: 'card-top' }, h('b', {}, `${r.icon} ${r.name}`), h('span', { class: 'badge' }, `Lv ${lvl} ${LEVEL_NAMES[lvl - 1]}`)),
        h('div', { class: 'sub' }, r.story),
        h('div', { class: 'sub' }, `Suka: ${iname(fav)} · ${st.visits} kunjungan`),
        h('div', { class: 'meter' }, h('i', { style: `width:${nt ? Math.min(100, ((st.bond - base) / (nt - base)) * 100) : 100}%` })),
        h('div', { class: 'sub' }, nt ? `Kedekatan ${st.bond}/${nt}` : `Kedekatan ${st.bond} (maks)`),
        LEVEL_PERKS[lvl - 1] ? h('div', { class: 'sub' }, `✨ ${LEVEL_PERKS[lvl - 1]}`) : null,
        canClaim ? h('button', { class: 'btn small', onClick: () => this.act(() => e.claimRegular(r.id), (x) => `Hadiah ${rewardText(x)}`, 'star') }, `Ambil hadiah Lv ${claimedLv + 1}: ${rewardText(LEVEL_REWARDS[claimedLv + 1])}`) : null));
    }
    return out;
  });
};
