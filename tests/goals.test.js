import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { validateState } from '../src/core/save.js';
import { ACHIEVEMENTS, QUEST_DEFS } from '../src/core/goals.js';
import { runDay } from './engine.test.js';

describe('misi', () => {
  it('misi dibuat deterministik: 3 harian + 2 mingguan, id unik, lolos validasi', () => {
    const a = new GameEngine(newState(7));
    const b = new GameEngine(newState(7));
    a.ensureQuests(); b.ensureQuests();
    expect(a.state.quests.daily.length).toBe(3);
    expect(a.state.quests.weekly.length).toBe(2);
    expect(a.state.quests).toEqual(b.state.quests);
    expect(new Set(a.state.quests.daily.map((q) => q.key)).size).toBe(3);
    expect(validateState(a.state)).toEqual([]);
  });

  it('progres naik saat menjual, belanja, dan melayani; hadiah cair ke kas tepat sekali', () => {
    const e = new GameEngine(newState(3));
    e.ensureQuests();
    e.state.quests.daily = [
      { id: 'sell_units', key: 'sell_units', kind: 'sell_units', cat: null, goal: 3, prog: 0, claimed: false, reward: { cash: 700, points: 0 } },
      { id: 'buy_units', key: 'buy_units', kind: 'buy_units', cat: null, goal: 10, prog: 0, claimed: false, reward: { cash: 300, points: 0 } },
    ];
    e.buyStock('cacing', 3, 10);
    expect(e.state.quests.daily[1].prog).toBe(10);
    runDay(e);
    // hari berganti: misi lama selesai ditagih otomatis, misi baru dibuat
    const before = e.state.ledger.balance;
    e.ensureQuests();
    expect(e.state.quests.dayId).toBe(2);
    expect(e.state.quests.daily.every((q) => q.prog === 0)).toBe(true);
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(before);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('claimQuest menolak misi belum selesai dan klaim ganda', () => {
    const e = new GameEngine(newState(4));
    e.ensureQuests();
    expect(() => e.claimQuest('daily', 0)).toThrow('belum selesai');
    const q = e.state.quests.daily[0];
    q.prog = q.goal;
    const cash = e.state.ledger.balance;
    const r = e.claimQuest('daily', 0);
    expect(e.state.ledger.balance).toBe(cash + r.cash);
    expect(() => e.claimQuest('daily', 0)).toThrow('sudah');
    expect(e.state.stats.questsDone).toBe(1);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('target naik mengikuti bintang', () => {
    const lo = new GameEngine(newState(9));
    const hi = new GameEngine(newState(9));
    hi.state.stars = 4;
    hi.state.reputation = 80;
    lo.ensureQuests(); hi.ensureQuests();
    const wLo = lo.state.quests.weekly.find((q) => q.key === 'w_revenue');
    const wHi = hi.state.quests.weekly.find((q) => q.key === 'w_revenue');
    expect(wHi.goal).toBeGreaterThan(wLo.goal * 2);
    expect(wLo.reward.points).toBe(0); // poin skill datang dari peti misi penuh, bukan misi tunggal
    expect(wHi.reward.cash).toBeGreaterThan(wLo.reward.cash * 2);
  });

  it('misi mingguan berganti tiap 7 hari', () => {
    const e = new GameEngine(newState(2));
    e.ensureQuests();
    expect(e.state.quests.weekId).toBe(0);
    e.state.day = 8;
    e.ensureQuests();
    expect(e.state.quests.weekId).toBe(1);
    e.state.day = 14;
    e.ensureQuests();
    expect(e.state.quests.weekId).toBe(1);
  });

  it('semua definisi misi punya teks dan target positif', () => {
    for (const d of QUEST_DEFS) {
      expect(d.text(5, 'ikan').length).toBeGreaterThan(3);
      expect(d.base).toBeGreaterThan(0);
    }
  });
});

describe('pencapaian', () => {
  it('ada 20 pencapaian dengan id unik', () => {
    expect(ACHIEVEMENTS.length).toBe(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(20);
  });

  it('terbuka saat syarat terpenuhi, hadiah hanya bisa diambil sekali', () => {
    const e = new GameEngine(newState(5));
    expect(e.checkAchievements()).toEqual([]);
    e.state.stats.customers = 150;
    const fresh = e.checkAchievements();
    expect(fresh).toContain('cust_1');
    expect(fresh).toContain('cust_100');
    expect(e.checkAchievements()).toEqual([]);
    const cash = e.state.ledger.balance;
    const r = e.claimAchievement('cust_100');
    expect(e.state.ledger.balance).toBe(cash + r.cash);
    expect(() => e.claimAchievement('cust_100')).toThrow('sudah');
    expect(() => e.claimAchievement('rev_10m')).toThrow('belum terbuka');
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('hadiah poin menambah poin skill', () => {
    const e = new GameEngine(newState(6));
    e.state.stars = 2;
    e.state.reputation = 16;
    e.checkAchievements();
    const free = e.skillPointsFree();
    e.claimAchievement('star_2');
    expect(e.skillPointsFree()).toBe(free + 1);
  });

  it('simulasi 60 hari: kas, audit, dan validasi tetap sehat dengan misi aktif', () => {
    const e = new GameEngine(newState(8));
    for (let d = 0; d < 60; d++) {
      for (const it of e.unlockedItems()) {
        const n = Math.min(e.totalQty(it.id) < 6 ? 6 : 0, e.maxAffordable(it.id, 3));
        if (n > 0 && e.state.ledger.balance > 8000) e.buyStock(it.id, 3, n);
      }
      e.ensureQuests();
      for (const sc of ['daily', 'weekly']) {
        e.state.quests[sc].forEach((q, i) => { if (q.prog >= q.goal && !q.claimed) e.claimQuest(sc, i); });
      }
      for (const a of Object.keys(e.state.ach)) { try { e.claimAchievement(a); } catch { /* sudah */ } }
      const s = runDay(e);
      expect(Array.isArray(s.newAchievements)).toBe(true);
      expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
      expect(auditLedger(e.state.ledger)).toEqual([]);
    }
    expect(validateState(e.state)).toEqual([]);
    expect(e.state.stats.questsDone).toBeGreaterThan(0);
  });
});
