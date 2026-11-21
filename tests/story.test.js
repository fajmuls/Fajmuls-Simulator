import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { CHAPTERS } from '../src/core/story.js';
import { makeClock } from './farmbot.js';

const mk = () => { const e = new GameEngine(newState(7)); const clock = makeClock(e); return { e, clock }; };

describe('cerita', () => {
  it('bab 1 maju saat menanam, hadiah cair sekali lewat ledger', () => {
    const { e } = mk();
    expect(e.storyNow().index).toBe(0);
    expect(e.storyNow().ready).toBe(false);
    expect(() => e.claimStory()).toThrow();
    e.buyBibit('lele', 1);
    e.plant(1, 'lele', null);
    const n = e.storyNow();
    expect(n.cur).toBe(1);
    expect(n.ready).toBe(true);
    const before = e.state.ledger.balance;
    const r = e.claimStory();
    expect(r.cash).toBe(CHAPTERS[0].reward.cash);
    expect(e.state.ledger.balance).toBe(before + r.cash);
    expect(e.storyNow().index).toBe(1);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('bab 2 menghitung panen', () => {
    const { e, clock } = mk();
    e.buyBibit('lele', 3);
    for (const s of [1, 2]) e.plant(s, 'lele', null);
    e.claimStory();
    clock.t += 60_000;
    e.harvest(1); e.harvest(2);
    expect(e.storyNow().cur).toBe(2);
    e.plant(1, 'lele', null);
    clock.t += 60_000;
    e.harvest(1);
    expect(e.storyNow().ready).toBe(true);
  });

  it('markStoryIntro menandai dialog sudah dilihat', () => {
    const { e } = mk();
    expect(e.storyNow().introSeen).toBe(false);
    e.markStoryIntro();
    expect(e.storyNow().introSeen).toBe(true);
  });
});
