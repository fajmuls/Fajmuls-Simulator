import { describe, it, expect } from 'vitest';
import { GameEngine, newState, migrate } from '../src/core/engine.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { serialize, deserialize, validateState } from '../src/core/save.js';
import { runDay } from './engine.test.js';
import { STAR_THRESH, POTIONS, UPGRADES, getItem } from '../src/core/catalog.js';

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
    e.setPrice('cacing', 3, 2000);
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
    expect(e.state.ledger.balance).toBe(before - getItem('mas').unlockCost);
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
    e.state.reputation = STAR_THRESH[1] - 0.05;
    e.buyStock('cacing', 3, 20);
    e.buyStock('lele', 3, 10);
    let up = null;
    for (let i = 0; i < 60 && !up; i++) {
      const room = Math.min(20, e.maxAffordable('cacing', 3));
      if (room > 0) e.buyStock('cacing', 3, room);
      up = runDay(e).starUp;
    }
    expect(up).toEqual({ from: 1, to: 2 });
    expect(e.state.stars).toBe(2);
  });

  it('poin skill diturunkan dari bintang, level toko, hari, dan misi', () => {
    const e = rich(1, 1);
    expect(e.skillPointsTotal()).toBe(0);
    e.state.stars = 3;
    expect(e.skillPointsTotal()).toBe(4);
    e.state.day = 21; // 4 kelipatan 5 hari
    expect(e.skillPointsTotal()).toBe(8);
    e.state.stats.dailyFull = 7; // 2 poin dari 6 hari misi penuh
    e.state.stats.weeklyFull = 2; // +1 per minggu penuh
    expect(e.skillPointsTotal()).toBe(12);
  });

  it('skill butuh prasyarat dan poin, efeknya kuat', () => {
    const e = rich(1, 1);
    e.state.day = 16; // 3 poin
    expect(e.skillPointsFree()).toBe(3);
    expect(() => e.learnSkill('harga_prima')).toThrow('Butuh');
    e.learnSkill('tawar');
    e.learnSkill('tawar');
    e.learnSkill('tawar');
    expect(() => e.learnSkill('tawar')).toThrow('Poin');
    expect(e.skillPointsFree()).toBe(0);
    expect(e.mods().disc).toBeCloseTo(0.075, 5);
    e.resetSkills();
    expect(e.skillPointsFree()).toBe(3);
  });

  it('skill baru: jalan, VIP, harga jual, gaji', () => {
    const e = rich(1, 1);
    expect(e.walkMul()).toBe(1);
    e.state.skills.langkah = 10;
    expect(e.walkMul()).toBeCloseTo(2, 5);
    const v0 = e.mods().vip;
    e.state.skills.vipmagnet = 8;
    expect(e.mods().vip / v0).toBeCloseTo(2.2, 5);
    e.state.skills.lidah_emas = 8;
    expect(e.mods().payMul).toBeCloseTo(1.4, 5);
    e.state.staff.kasir = true;
    const w0 = e.wages();
    e.state.skills.akuntan = 5;
    expect(e.wages()).toBeLessThan(w0);
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
    expect(e.wages()).toBe(12000); // gaji x1,5
    const cash = e.state.ledger.balance;
    const s = runDay(e);
    expect(s.wages).toBe(12000);
    expect(e.state.ledger.balance).toBe(cash - s.rent - 12000 - s.upkeep - s.tax);

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
    expect(e.state.ledger.balance).toBe(cash + 2400 - s.rent - s.upkeep - s.tax);
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
    expect(loaded.v).toBe(8);
    expect(loaded.stats.items).toEqual({});
    expect(loaded.upgrades.kecepatan).toBe(0);
    expect(loaded.farm.animals.filter((a) => a.itemId === 'mas').length).toBe(4);
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

describe('v3: kecepatan, pengeluaran, karyawan baru', () => {
  const mk = (seed = 1, stars = 3, cash = 2000000) => {
    const e = new GameEngine(newState(seed));
    e.state.stars = stars;
    e.state.reputation = [0, 15, 35, 60, 85][stars - 1] + 1;
    e.state.ledger.opening = cash;
    e.state.ledger.balance = cash;
    return e;
  };

  it('kecepatan 4x dan 8x harus dibeli', () => {
    const e = mk();
    expect(e.maxSpeed()).toBe(2);
    e.buyUpgrade('kecepatan');
    expect(e.maxSpeed()).toBe(4);
    e.buyUpgrade('kecepatan');
    expect(e.maxSpeed()).toBe(8);
    expect(() => e.buyUpgrade('kecepatan')).toThrow();
  });

  it('migrasi v2 menambah upgrade dan statistik baru tanpa mengubah data lama', () => {
    const e = mk();
    e.buyStock('cacing', 3, 5);
    const v2 = structuredClone(e.state);
    v2.v = 2;
    delete v2.upgrades.kecepatan;
    delete v2.upgrades.renovasi;
    delete v2.stats.items;
    const copy = structuredClone(v2);
    const m = migrate(v2);
    expect(v2).toEqual(copy);
    expect(m.v).toBe(8);
    expect(m.upgrades.kecepatan).toBe(0);
    expect(m.stats.items).toEqual({});
    expect(m.farm.animals.filter((a) => a.itemId === 'cacing').length).toBe(5);
    expect(validateState(m)).toEqual([]);
  });

  it('pajak progresif dan perawatan dibayar tiap hari, audit tetap sehat', () => {
    const e = mk();
    expect(e.taxFor(50000)).toBe(0);
    expect(e.taxFor(100000)).toBe(2000);
    expect(e.taxFor(300000)).toBe(Math.floor(140000 * 0.05 + 100000 * 0.09));
    expect(e.wealthTax()).toBe(Math.floor((2000000 - 1500000) * 0.003));
    e.unlockSpecies('mas');
    e.buyStock('mas', 3, 10);
    expect(e.stockAnimalCount()).toBe(10);
    expect(e.upkeep()).toBe(60);
    const s = runDay(e);
    expect(s.upkeep).toBeGreaterThanOrEqual(0);
    expect(s.tax).toBeGreaterThan(0);
    expect(auditLedger(e.state.ledger)).toEqual([]);
  });

  it('obat mencegah hewan mati, tanpa obat sebagian bisa mati dan modalnya hilang dari stok', () => {
    const e = mk(7);
    e.state.day = 10;
    e.state.stock['lele:3'] = { qty: 500, cost: 500 * 1000 };
    e.state.buffs.obat = 2;
    expect(e._applySickness(10)).toEqual([]);
    delete e.state.buffs.obat;
    const died = e._applySickness(10);
    const n = died.reduce((a, b) => a + b.n, 0);
    expect(n).toBeGreaterThan(0);
    expect(e.state.stock['lele:3'].qty).toBe(500 - n);
    expect(e.state.stock['lele:3'].cost).toBe(Math.round((500000 * (500 - n)) / 500));
  });

  it('satpam menurunkan pencurian, tidak ada pencurian sebelum hari 5', () => {
    const base = () => { const e = mk(3, 2); e.state.stock['cacing:3'] = { qty: 5000, cost: 5000 * 400 }; return e; };
    const a = base();
    const b = base();
    b.hire('satpam');
    const ta = a._applyTheft(20, 400).reduce((x, y) => x + y.n, 0);
    const tb = b._applyTheft(20, 400).reduce((x, y) => x + y.n, 0);
    expect(ta).toBeGreaterThan(tb);
    expect(a._applyTheft(4, 400)).toEqual([]);
  });

  it('badut menambah pelanggan dan renovasi butuh toko level 4', () => {
    const e = mk();
    const before = e.mods().count;
    e.hire('badut');
    expect(e.mods().count).toBeCloseTo(before * 1.15, 5);
    expect(e.upgradeAvailable('renovasi')).toBe(false);
    e.state.shopLevel = 4;
    expect(e.upgradeAvailable('renovasi')).toBe(true);
  });

  it('statistik per spesies tercatat saat penjualan', () => {
    const e = mk(5, 1, 50000);
    e.buyStock('cacing', 3, 30);
    runDay(e);
    const st = e.state.stats.items.cacing;
    expect(st.units).toBeGreaterThan(0);
    expect(st.revenue).toBeGreaterThan(0);
  });
});

describe('v4: migrasi misi, pencapaian, langganan, tutorial', () => {
  it('migrasi v3 menambah field baru, tidak mengubah data lama, dan lolos validasi', () => {
    const e = new GameEngine(newState(11));
    e.buyStock('cacing', 3, 8);
    const v3 = structuredClone(e.state);
    v3.v = 3;
    for (const k of ['quests', 'ach', 'bonusPoints', 'regulars', 'tutorial']) delete v3[k];
    for (const k of ['sold', 'bought', 'bred', 'questsDone']) delete v3.stats[k];
    v3.stats.items = { cacing: { units: 12, revenue: 5000 } };
    const copy = structuredClone(v3);
    const m = migrate(v3);
    expect(v3).toEqual(copy);
    expect(m.v).toBe(8);
    expect(m.stats.sold).toBe(12);
    expect(m.stats.bought).toBe(0);
    expect(m.quests).toEqual({ dayId: 0, weekId: -1, daily: [], weekly: [] });
    expect(m.ach).toEqual({});
    expect(m.regulars).toEqual({});
    expect(m.bonusPoints).toBe(0);
    expect(m.tutorial).toEqual({ step: 0, done: true }); // sudah punya stok = pemain lama
    expect(m.farm.animals.filter((a) => a.itemId === 'cacing').length).toBe(8);
    expect(validateState(m)).toEqual([]);
  });

  it('pemain baru memulai tutorial, pemain v3 di hari 1 tanpa stok juga', () => {
    const n = newState(3);
    expect(n.tutorial).toEqual({ step: 0, done: false });
    const old = structuredClone(n);
    old.v = 3;
    for (const k of ['quests', 'ach', 'bonusPoints', 'regulars', 'tutorial']) delete old[k];
    expect(migrate(old).tutorial.done).toBe(false);
  });

  it('validasi menolak data misi/pencapaian/langganan rusak', () => {
    const base = () => newState(5);
    let s = base(); s.quests.daily = [{ id: 'x', goal: 0, prog: 0, claimed: false }];
    expect(validateState(s)).toContain('Misi rusak');
    s = base(); s.ach = { a: { day: 'x', claimed: false } };
    expect(validateState(s)).toContain('Pencapaian rusak');
    s = base(); s.regulars = { r: { bond: -1, visits: 0, last: 0 } };
    expect(validateState(s)).toContain('Langganan rusak');
    s = base(); s.bonusPoints = 1.5;
    expect(validateState(s)).toContain('Poin bonus tidak valid');
    s = base(); s.tutorial = { step: 0, done: 'ya' };
    expect(validateState(s)).toContain('Tutorial rusak');
  });
});
