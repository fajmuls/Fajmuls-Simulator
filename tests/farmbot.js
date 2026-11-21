// Pemain otomatis untuk tes dan simulasi keseimbangan peternakan.
import { FEEDS, rarityIdx } from '../src/core/farm.js';
import { ITEMS, UPGRADES } from '../src/core/catalog.js';

export function makeClock(e, start = 1_000_000) {
  const clock = { t: start };
  e.now = () => clock.t;
  return clock;
}

const attempt = (fn) => { try { return fn(); } catch { return null; } };

export function farmRound(e, clock, { feedUp = true, expand = true } = {}) {
  clock.t += 240_000; // beberapa menit berlalu
  e.harvestAll();
  const s = e.state;
  // kembangkan usaha
  if (expand) {
    if (s.ledger.balance > 60000 && s.farm.slots.length < 6) attempt(() => e.buySlot());
    for (const it of ITEMS) if (it.unlockCost > 0 && s.ledger.balance > it.unlockCost * 1.5 + 5000) attempt(() => e.unlockSpecies(it.id));
    if (s.ledger.balance > 90000) attempt(() => e.expandShop());
  }
  const unlocked = e.unlockedItems();
  s.farm.slots.forEach((slot, i) => {
    if (slot) return;
    // tanam spesies yang paling sedikit stoknya, tertimbang demand
    const have = (id) => e.animalCount(id) + s.farm.slots.filter((x) => x && x.itemId === id).length * 2;
    const pick = unlocked.slice().sort((a, b) => (have(a.id) / a.demand) - (have(b.id) / b.demand))[0];
    let feed = null;
    if (feedUp) {
      for (const f of FEEDS.slice().reverse()) {
        if (f.price * 6 < pick.retail * 1.2 && s.ledger.balance > f.price * 3 + 4000) { attempt(() => e.buyFeed(f.id, 1)); feed = f.id; break; }
      }
    }
    attempt(() => e.buyBibit(pick.id, 1));
    attempt(() => e.plant(i, pick.id, feed)) || attempt(() => e.plant(i, pick.id, null));
  });
}

export function serveDay(e) {
  const plan = e.startDay();
  let sold = 0;
  for (const c of plan) {
    let any = false;
    c.wants.forEach((w, i) => {
      const info = e.orderInfo(c, i);
      const cand = e.state.farm.animals
        .filter((a) => a.itemId === w.itemId && rarityIdx(a.rarity) + 1 >= info.minQuality)
        .sort((a, b) => rarityIdx(a.rarity) - rarityIdx(b.rarity) || a.size - b.size)[0];
      if (!cand) return;
      const r = e.serveAnimal(c, i, cand.id);
      if (r.ok) { any = true; sold += 1; }
    });
    if (any) e.pay(c.id, { fast: true });
    e.customerLeft(c.id, any);
  }
  const summary = e.endDay();
  summary.soldCount = sold;
  return summary;
}
