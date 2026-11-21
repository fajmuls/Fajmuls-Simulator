// Layar cerita: dialog Pak Pasar dan panel bab. Menambah metode ke UI.prototype.
import { UI, h, rp, toast } from './ui.js';
import { NPC, CHAPTERS, rewardText } from './core/story.js';
import { npcSVG } from './art.world.js';
import { svgEl } from './art.svg.js';
import { audio } from './audio.js';

const P = UI.prototype;

P.closeDialog = function closeDialog() {
  this.dialogEls?.forEach((el) => el.remove());
  this.dialogEls = null;
};

// Dialog bergaya novel visual: potret di kiri, teks di kanan, ketuk untuk lanjut.
P.showDialog = function showDialog(lines, { name = NPC.name, onDone, last = 'Oke' } = {}) {
  this.closeDialog();
  let i = 0;
  const who = h('div', { class: 'who' }, name);
  const txt = h('div', { class: 'txt' });
  const btn = h('button', { class: 'btn small' }, '');
  const back = h('div', { class: 'dialog-back' });
  const box = h('div', { class: 'dialog' }, h('div', { class: 'dialog-in' },
    h('div', { class: 'portrait' }, svgEl(npcSVG(), 62)),
    h('div', {}, who, txt, h('div', { class: 'row', style: 'justify-content:flex-end' }, btn))));
  const show = () => {
    txt.textContent = lines[i];
    btn.textContent = i >= lines.length - 1 ? last : 'Lanjut';
  };
  const next = () => {
    audio.play('ok');
    if (i < lines.length - 1) { i += 1; show(); return; }
    this.closeDialog();
    onDone?.();
  };
  btn.addEventListener('click', next);
  back.addEventListener('click', next);
  this.dialogEls = [back, box];
  document.body.append(back, box);
  show();
};

P.openNpc = function openNpc() {
  const e = this.e;
  const n = e.storyNow();
  if (n.done) {
    this.showDialog(['Kamu sudah jadi Raja Pasar Satwa, Nak. Pasar ini milikmu sekarang.', 'Aku tinggal duduk minum teh dan menonton.'], { last: 'Terima kasih' });
    return;
  }
  const lines = n.introSeen ? [`${n.chapter.title}: ${n.chapter.goal}.`, n.ready ? 'Tantanganmu sudah beres. Ambil hadiahmu!' : `Kemajuan kamu ${n.cur} dari ${n.need}. Semangat!`] : n.chapter.lines;
  this.showDialog(lines, {
    last: n.ready ? 'Ambil hadiah' : 'Siap!',
    onDone: () => {
      if (!n.introSeen) { e.markStoryIntro(); this.ctx.persist(); }
      this.ctx.scene()?.refreshNpc?.();
      this.refreshHud();
      if (n.ready) this.claimStoryUI();
    },
  });
};

P.claimStoryUI = function claimStoryUI() {
  let r = null;
  this.act(() => { r = this.e.claimStory(); return r; }, null, 'star');
  if (r) {
    toast(`Hadiah: ${rewardText(r)}`, 'ok');
    this.ctx.scene()?.refreshNpc?.();
    const nx = this.e.storyNow();
    if (!nx.done) setTimeout(() => this.openNpc(), 450);
  }
};

P.openCerita = function openCerita() {
  const e = this.e;
  this.openSheet('Cerita Pasar Satwa', () => {
    const n = e.storyNow();
    const out = [];
    if (n.done) {
      out.push(h('div', { class: 'card hero' }, h('b', {}, 'Tamat!'), h('div', { class: 'sub' }, 'Kamu sudah menamatkan semua bab. Terus kembangkan tokomu.')));
    } else {
      const pctv = Math.round((n.cur / n.need) * 100);
      out.push(h('div', { class: `card${n.ready ? ' hero' : ''}` },
        h('div', { class: 'row', style: 'flex-wrap:nowrap;gap:10px' }, svgEl(npcSVG(), 48),
          h('div', { class: 'grow' }, h('div', { class: 'sub' }, `Bab ${n.index + 1} dari ${n.total}`), h('b', {}, n.chapter.title), h('div', { class: 'sub' }, n.chapter.goal))),
        h('div', { class: 'meter' }, h('i', { style: `width:${pctv}%` })),
        h('div', { class: 'sub' }, n.chapter.money ? `${rp(n.cur)} / ${rp(n.need)}` : `${n.cur} / ${n.need}`),
        h('div', { class: 'sub' }, `Hadiah: ${rewardText(n.chapter.reward)}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn small secondary', onClick: () => { this.closeModal(); this.openNpc(); } }, 'Dengar Pak Pasar'),
          n.ready ? h('button', { class: 'btn small', onClick: () => { this.closeModal(); this.claimStoryUI(); } }, 'Ambil hadiah') : null)));
    }
    out.push(h('h3', { class: 'sec' }, 'Semua bab'));
    CHAPTERS.forEach((c, i) => {
      const st = n.done || i < n.index ? 'selesai' : i === n.index ? 'berjalan' : 'terkunci';
      out.push(h('div', { class: `card${st === 'terkunci' ? ' dim' : ''}` },
        h('div', { class: 'card-top' }, h('b', {}, `${i + 1}. ${st === 'terkunci' ? '???' : c.title}`), h('span', { class: `badge${st === 'selesai' ? ' good' : ''}` }, st))));
    });
    return out;
  });
};
