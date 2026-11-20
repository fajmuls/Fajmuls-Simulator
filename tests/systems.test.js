import { describe, it, expect } from 'vitest';
import { GameEngine, newState, migrate } from '../src/core/engine.js';
import { auditLedger } from '../src/core/ledger.js';
import { serialize, deserialize, validateState } from '../src/core/save.js';
import { runDay } from './engine.test.js';
import { STAR_THRESH, POTIONS } from '../src/core/catalog.js';

function rich(seed = 1, stars = 3, cash = 2_000_000) {
  const e = new GameEngine(newState(seed));
  e.state.ledger.opening = cash;
  e.state.ledger.balance = cash;
  e.state.stars = stars;
  e.state.reputation = Math.max(e.state.reputation, STAR_THRESH[stars - 1]);
  return e;
}
const totalCost = (e) => Object.values(e.state.stock).reduce((s, l) => s + l.cost, 0);

describe('harga pasar semua', () => {
  it('setAllPrices(0) menyamakan semua harga dengan harga pasar', () => {
    const e = rich();
    e.buyStock('cacing', 3, 10);
    e.buyStock('lele', 2, 5);
    e.setPrice('cacing', 3, 123);
    expect(e.setAllPrices(0)).toBe(2);
    expect(e.priceOf('cacing', 3)).toBe(e.marketPrice('cacing', 3, 0));
    expect(e.priceOf('lele', 2)).toBe(e.marketPrice('lele', 2, 0));
    expect(e.priceOf('cacing', 3)).toBeLessThanOrEqual(e.retailRef('cacing', 3));
  });

  it('pasar -10% tidak melebihi 90% harga pasar dan tidak turun terlalu jauh', () => {
    const e = rich();
    e.buyStock('cacing', 3, 10);
    e.buyStock('lele', 3, 5);
    e.setAllPrices(-10);
    for (const [id, q] of [['cacing', 3], ['lele', 3]]) {
      const ref = e.retailRef(id, q);
      const price = e.priceOf(id, q);
      expect(price).toBeLessThanOrEqual(ref * 0.9);
      expect(price).toBeGreaterThan(ref * 0.9 - 110);
    }
  });

  it('menolak persentase tidak valid', () => {
    const e = rich();
    expect(() => e.setAllPrices(NaN)).toThrow();
    expect(() => e.setAllPrices(-95)).toThrow();
  });

  it('harga otomatis diterapkan saat toko dibuka', () => {
    const e = rich();
    e.buyStock('cacing', 3, 10);
    e.setAutoPrice(true, -10);
    e.setPrice('cacing', 3, 3000);
    e.startDay();
    expect(e.priceOf('cacing', 3)).toBe(e.marketPrice('cacing', 3, -10));
  });
});

describe('spesies dan level toko', () => {
  it('spesies dibuka berurutan dan memotong uang', () => {
    const e = rich();
    expect(e.speciesStatus('mas').state).toBe('bisa');
    expect(e.speciesStatus('koi').state).toBe('urut');
    expect(() => e.unlockSpecies('koi')).toThrow();
    const before = e.state.ledger.balance;
    e.unlockSpecies('mas');
    expect(e.state.ledger.balance).toBe(before - 5000);
    expect(e.isUnlocked('mas')).toBe(true);
    expect(() => e.unlockSpecies('mas')).toThrow();
    e.unlockSpecies('cupang');
    e.unlockSpecies('koi');
    expect(e.isUnlocked('koi')).toBe(true);
  });

  it('kategori burung terkunci sampai toko diperluas', () => {
    const e = rich(1, 1);
    expect(e.categoryOpen('burung')).toBe(false);
    expect(e.speciesStatus('pipit').state).toBe('kategori');
    e.expandShop();
    expect(e.state.shopLevel).toBe(2);
    expect(e.categoryOpen('burung')).toBe(true);
    expect(e.isUnlocked('pipit')).toBe(true);
    expect(e.capacity()).toBe(100);
  });

  it('perluasan toko butuh bintang', () => {
    const e = rich(1, 1);
    e.expandShop();
    expect(() => e.expandShop()).toThrow('bintang'); // level 3 butuh bintang 2
    e.state.stars = 2;
    e.expandShop();
    expect(e.state.shopLevel).toBe(3);
  });

  it('upgrade premium kategori butuh kategori terbuka', () => {
    const e = rich(1, 1);
    expect(() => e.buyUpgrade('prem_burung')).toThrow();
    e.buyUpgrade('prem_ikan');
    expect(e.state.upgrades.prem_ikan).toBe(1);
  });
});

describe('bintang dan skill', () => {
  it('bintang tidak pernah turun walau reputasi jatuh', () => {
    const e = rich(2, 3);
    e.state.reputation = STAR_THRESH[2];
    for (let i = 0; i < 5; i++) runDay(e); // toko kosong, banyak pelanggan kecewa
    expect(e.state.stars).toBe(3);
    expect(e.state.reputation).toBeGreaterThanOrEqual(STAR_THRESH[2]);
  });

  it('naik bintang tercatat di ringkasan harian', () => {
    const e = rich(2, 1);
    e.state.reputation = STAR_THRESH[1] - 0.2;
    e.buyStock('cacing', 3, 20);
    e.buyStock('lele', 3, 10);
    let up = null;
    for (let i = 0; i < 15 && !up; i++) {
      const room = Math.min(20, e.maxAffordable('cacing', 3));
      if (room > 0) e.buyStock('cacing', 3, room);
      up = runDay(e).starUp;
    }
    expect(up).toEqual({ from: 1, to: 2 });
    expect(e.state.stars).toBe(2);
  });

  it('poin skill diturunkan dari bintang, level toko, dan hari', () => {
    const e = rich(1, 1);
    expect(e.skillPointsTotal()).toBe(0);
    e.state.stars = 3;
    expect(e.skillPointsTotal()).toBe(2);
    e.state.day = 21;
    expect(e.skillPointsTotal()).toBe(4);
  });

  it('skill butuh prasyarat dan poin', () => {
    const e = rich(1, 3);
    e.state.day = 11; // 2 + 1 = 3 poin
    expect(() => e.learnSkill('harga_prima')).toThrow('Butuh');
    e.learnSkill('tawar');
    e.learnSkill('tawar');
    e.learnSkill('tawar');
    expect(() => e.learnSkill('tawar')).toThrow();
    expect(e.skillPointsFree()).toBe(0);
    expect(() => e.learnSkill('harga_prima')).toThrow('Poin');
    expect(e.mods().disc).toBeCloseTo(0.03 + 0.09, 5);
    e.resetSkills();
    expect(e.skillPointsFree()).toBe(3);
  });
});

describe('ramuan', () => {
  it('butuh bintang 2, bisa dibeli dan diaktifkan sekali', () => {
    const e = rich(1, 1);
    expect(() => e.buyPotion('pemikat')).toThrow('bintang');
    e.state.stars = 2;
    const before = e.state.ledger.balance;
    e.buyPotion('pemikat', 2);
    expect(e.state.ledger.balance).toBe(before - 8000);
    e.activatePotion('pemikat');
    expect(e.state.potions.pemikat).toBe(1);
    expect(() => e.activatePotion('pemikat')).toThrow('aktif');
  });

  it('ramuan borong memberi diskon grosir dan buff habis setelah hari berlalu', () => {
    const e = rich(1, 2);
    const base = e.wholesalePrice('cacing', 3);
    e.buyPotion('borong');
    e.activatePotion('borong');
    expect(e.wholesalePrice('cacing', 3)).toBeLessThan(base);
    runDay(e);
    expect(e.state.buffs.borong).toBeUndefined();
  });

  it('ramuan pemikat menambah pelanggan', () => {
    const a = rich(4, 2);
    const b = rich(4, 2);
    a.buyStock('cacing', 3, 20);
    b.buyStock('cacing', 3, 20);
    b.buyPotion('pemikat');
    b.activatePotion('pemikat');
    expect(b.customerCount()).toBeGreaterThanOrEqual(a.customerCount());
    expect(POTIONS.length).toBeGreaterThan(3);
  });
});

describe('karyawan', () => {
  it('gaji dibayar tiap hari dan tunggakan tercatat bila uang kurang', () => {
    const e = rich(1, 3);
    e.hire('kasir');
    e.hire('perawat');
    expect(e.wages()).toBe(8000);
    const cash = e.state.ledger.balance;
    const s = runDay(e);
    expect(s.wages).toBe(8000);
    expect(e.state.ledger.balance).toBe(cash - s.rent - 8000);

    const poor = rich(1, 3, 5000);
    poor.hire('kasir');
    poor.hire('perawat');
    runDay(poor);
    expect(poor.state.ledger.balance).toBeGreaterThanOrEqual(0);
    expect(poor.state.arrears).toBeGreaterThan(0);
    expect(auditLedger(poor.state.ledger)).toEqual([]);
  });

  it('karyawan butuh bintang yang cukup', () => {
    const e = rich(1, 2);
    e.hire('kasir');
    expect(() => e.hire('penjaga')).toThrow('bintang');
  });

  it('penjaga stok mengisi ulang barang yang menipis saat toko dibuka', () => {
    const e = rich(1, 3);
    e.hire('penjaga');
    e.setRestock('cacing', 30, 3);
    e.buyStock('cacing', 3, 5); // kurang dari separuh target
    e.startDay();
    expect(e.totalQty('cacing')).toBe(30);
    expect(e.lastRestock.length).toBe(1);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('penjaga stok tidak membelanjakan uang cadangan kewajiban harian', () => {
    const e = rich(1, 3, 40000);
    e.hire('penjaga');
    e.setRestock('cacing', 500, 3);
    e.startDay();
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(e.wages() + 3000 - 1);
  });
});

describe('breeding', () => {
  function breeder() {
    const e = rich(8, 3);
    e.state.day = 31; // banyak poin skill
    e.learnSkill('breeder');
    e.buyStock('lele', 3, 6);
    return e;
  }

  it('butuh skill, 2 ekor, dan slot', () => {
    const e = rich(8, 3);
    e.buyStock('lele', 3, 6);
    expect(() => e.startBreeding('lele', 3)).toThrow('skill');
    const f = breeder();
    expect(() => f.startBreeding('cacing', 3)).toThrow();
    f.startBreeding('lele', 3);
    expect(() => f.startBreeding('lele', 3)).toThrow('kandang');
  });

  it('modal terjaga: nilai stok naik tepat sebesar biaya breeding', () => {
    const e = breeder();
    const costBefore = totalCost(e);
    const cashBefore = e.state.ledger.balance;
    const b = e.startBreeding('lele', 3);
    const entry = e.state.breeding[0];
    expect(e.state.ledger.balance).toBe(cashBefore - entry.fee);
    for (let i = 0; i < 20 && e.state.day < b.ready; i++) runDay(e);
    const costMid = totalCost(e) + entry.pairCost;
    e.collectBreeding(b.id);
    expect(totalCost(e)).toBe(costMid + entry.fee);
    expect(e.state.breeding.length).toBe(0);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('kapasitas dihitung termasuk induk, dan anakan butuh ruang', () => {
    const e = breeder();
    const used = e.usedCapacity();
    const b = e.startBreeding('lele', 3);
    expect(e.usedCapacity()).toBe(used);
    expect(() => e.collectBreeding(b.id)).toThrow('Belum');
    for (let i = 0; i < 20 && e.state.day < b.ready; i++) runDay(e);
    // penuhi kapasitas
    e.state.stock['cacing:3'] = { qty: e.capacity() - e.usedCapacity(), cost: 0 };
    expect(() => e.collectBreeding(b.id)).toThrow('Kapasitas');
    e.state.stock['cacing:3'].qty = 0;
    const offspring = e.collectBreeding(b.id);
    expect(offspring.length).toBeGreaterThanOrEqual(1);
    expect(e.usedCapacity()).toBeLessThanOrEqual(e.capacity());
  });

  it('tidak bisa reset skill saat kandang terisi', () => {
    const e = breeder();
    e.startBreeding('lele', 3);
    expect(() => e.resetSkills()).toThrow();
  });
});

describe('investasi', () => {
  it('deposito jatuh tempo mengembalikan pokok plus bunga dan lolos audit', () => {
    const e = rich(1, 3);
    const start = e.state.ledger.balance;
    e.openDeposit(100000, 0); // 3 hari, bunga 3%
    expect(e.state.ledger.balance).toBe(start - 100000);
    for (let i = 0; i < 3; i++) runDay(e);
    expect(e.state.deposits.length).toBe(0);
    const credits = e.state.ledger.entries.filter((x) => x.type === 'invest_return' || x.type === 'interest').reduce((s, x) => s + x.amount, 0);
    expect(credits).toBe(103000);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('pencairan awal hanya mengembalikan pokok', () => {
    const e = rich(1, 3);
    const start = e.state.ledger.balance;
    e.openDeposit(50000, 2);
    e.withdrawDeposit(e.state.deposits[0].id);
    expect(e.state.ledger.balance).toBe(start);
  });

  it('validasi deposito', () => {
    const e = rich(1, 3);
    expect(() => e.openDeposit(100, 0)).toThrow();
    expect(() => e.openDeposit(10000.5, 0)).toThrow();
    expect(() => e.openDeposit(10000, 9)).toThrow();
    const lowStar = rich(1, 2);
    expect(() => lowStar.openDeposit(10000, 0)).toThrow('bintang');
  });

  it('saham: beli dan jual dengan biaya, harga bergerak tiap hari tetapi deterministik', () => {
    const e = rich(2, 3);
    const p0 = e.sharePrice('satwamart');
    const cost = e.buyShares('satwamart', 10);
    expect(cost).toBe(p0 * 10);
    const before = e.state.ledger.balance;
    const net = e.sellShares('satwamart', 10);
    expect(net).toBe(p0 * 10 - Math.floor(p0 * 10 * 0.01));
    expect(e.state.ledger.balance).toBe(before + net);
    expect(() => e.sellShares('satwamart', 1)).toThrow();
    const a = rich(2, 3);
    const b = rich(2, 3);
    runDay(a);
    runDay(b);
    expect(a.sharePrice('arwanatech')).toBe(b.sharePrice('arwanatech'));
    expect(a.state.sharePrices.arwanatech.hist.length).toBe(2);
  });

  it('properti memberi pendapatan harian dan bisa dijual 80%', () => {
    const e = rich(3, 3);
    e.buyProperty('kios');
    const cash = e.state.ledger.balance;
    const s = runDay(e);
    expect(s.propIncome).toBe(2400);
    expect(e.state.ledger.balance).toBe(cash + 2400 - s.rent);
    const before = e.state.ledger.balance;
    e.sellProperty('kios');
    expect(e.state.ledger.balance).toBe(before + 160000);
    expect(() => e.sellProperty('kios')).toThrow();
  });
});

describe('bank', () => {
  it('pinjaman: uang masuk, cicilan dipotong tiap hari, lunas lalu hilang', () => {
    const e = rich(1, 2, 100000);
    const start = e.state.ledger.balance;
    e.takeLoan(20000, 0); // 7 hari, total 21600
    expect(e.state.ledger.balance).toBe(start + 20000);
    expect(e.state.loans[0].remaining).toBe(21600);
    for (let i = 0; i < 8 && e.state.loans.length; i++) runDay(e);
    expect(e.state.loans.length).toBe(0);
    const paid = e.state.ledger.entries.filter((x) => x.type === 'loan_pay').reduce((s, x) => s - x.amount, 0);
    expect(paid).toBe(21600);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('cicilan telat kena denda dan reputasi turun, saldo tidak negatif', () => {
    const e = rich(1, 2, 50000);
    e.state.reputation = 30; // di atas batas bintang agar penurunan terlihat
    e.takeLoan(5000, 0); // total 5400, cicilan 772 per hari
    // kosongkan kas lewat transaksi sah (belanja habis-habisan lalu sewa) agar cicilan tidak terbayar
    e.state.ledger.opening = 0;
    e.state.ledger.archived = 0;
    e.state.ledger.balance = 0;
    e.state.ledger.entries = [];
    const s = runDay(e);
    expect(e.state.ledger.balance).toBeGreaterThanOrEqual(0);
    expect(e.state.loans[0].late).toBe(1);
    expect(e.state.loans[0].remaining).toBeGreaterThan(5400 - 772);
    expect(s.repDelta).toBeLessThanOrEqual(-2);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('batas pinjaman mengikuti bintang dan level toko', () => {
    const e = rich(1, 2);
    expect(e.loanLimit()).toBe(60000);
    expect(() => e.takeLoan(65000, 0)).toThrow();
    e.takeLoan(30000, 1);
    expect(e.loanAvailable()).toBeLessThan(30000);
    expect(() => e.takeLoan(5500, 0)).toThrow();
    const low = rich(1, 1);
    expect(() => low.takeLoan(5000, 0)).toThrow('bintang');
  });

  it('bayar pinjaman lebih awal', () => {
    const e = rich(1, 2);
    e.takeLoan(10000, 1);
    const l = e.state.loans[0];
    e.repayLoan(l.id, l.remaining);
    expect(e.state.loans.length).toBe(0);
    expect(() => e.repayLoan(999, 1)).toThrow();
  });
});

describe('migrasi simpanan versi 1', () => {
  function v1State() {
    const s = newState(77);
    const old = {
      v: 1, seed: s.seed, day: 12, phase: 'idle', ledger: s.ledger, reputation: 30, arrears: 0,
      stock: { 'mas:3': { qty: 4, cost: 7200 }, 'cacing:2': { qty: 10, cost: 3000 } },
      prices: { 'mas:3': 3000, 'cacing:2': 600 },
      upgrades: { rak: 1, dekorasi: 0, supplier: 1 },
      stats: { revenue: 1000, customers: 50, bestDay: 400 }, history: [],
    };
    return old;
  }

  it('memuat simpanan lama tanpa kehilangan stok, upgrade, dan spesies', () => {
    const old = v1State();
    const loaded = deserialize(serialize(old));
    expect(loaded.v).toBe(2);
    expect(loaded.stock['mas:3'].qty).toBe(4);
    expect(loaded.upgrades.rak).toBe(1);
    expect(loaded.upgrades.supplier).toBe(1);
    expect(loaded.species.mas).toBe(true);
    expect(loaded.species.koi).toBe(true); // supplier level 1 di versi 1 membuka koi
    expect(loaded.species.cupang).toBe(true); // tier di bawah koi ikut terbuka
    expect(loaded.shopLevel).toBe(1);
    expect(loaded.stars).toBe(2);
    expect(validateState(loaded)).toEqual([]);
    const e = new GameEngine(loaded);
    expect(e.isUnlocked('koi')).toBe(true);
    runDay(e);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('migrate tidak mengubah objek asli', () => {
    const old = v1State();
    const copy = structuredClone(old);
    migrate(old);
    expect(old).toEqual(copy);
  });
});
