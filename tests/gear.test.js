import { describe, it, expect } from 'vitest';
import { GameEngine, newState } from '../src/core/engine.js';
import '../src/gearpatch.js';
import { PERKS, skillCost } from '../src/core/catalog.js';
import { auditLedger, credit } from '../src/core/ledger.js';
import { validateState, serialize, deserialize } from '../src/core/save.js';
import * as gear from '../src/core/gear.js';
import { PET_KINDS } from '../src/core/farm.js';
import '../src/pets.js';

const mk = (seed = 1) => { const e = new GameEngine(newState(seed)); credit(e.state.ledger, 1, 'reward', 5_000_000, 'modal'); return e; };

describe('perlengkapan', () => {
  it('ada 20 barang, 5 slot x 4, tiap perk unik dan valid', () => {
    expect(gear.GEAR).toHaveLength(20);
    for (const s of gear.SLOTS) expect(gear.GEAR.filter((g) => g.slot === s.id)).toHaveLength(4);
    const perks = gear.GEAR.map((g) => g.perk);
    expect(new Set(perks).size).toBe(20);
    for (const p of perks) expect(PERKS.some((x) => x.id === p)).toBe(true);
  });

  it('pemain baru mendapat barang pemula per slot dan perknya aktif', () => {
    const e = mk();
    e.mods();
    const g = e.state.gear;
    for (const s of gear.SLOTS) expect(g.equipped[s.id]).toBeTruthy();
    expect(e.state.skills.panen_ganda).toBe(1); // Topi Jerami Lv1
    expect(e.skillPointsSpent()).toBe(0); // perk tidak memakai poin
  });

  it('beli, pasang, dan upgrade barang menaikkan rank perk; kas seimbang', () => {
    const e = mk();
    gear.ensureGear(e);
    gear.buyGear(e, 'topi_elang');
    gear.equipGear(e, 'topi_elang');
    expect(e.state.skills.mata_elang).toBe(1);
    expect(e.state.skills.panen_ganda).toBeUndefined(); // Topi Jerami dilepas
    expect(() => gear.upgradeGear(e, 'topi_elang')).toThrow(/Bahan/);
    gear.buyMat(e, 'kain', 20);
    const before = e.state.ledger.balance;
    gear.upgradeGear(e, 'topi_elang');
    expect(e.state.ledger.balance).toBeLessThan(before);
    expect(e.state.skills.mata_elang).toBe(2); // Lv2 -> rank 2
    expect(() => gear.buyGear(e, 'topi_elang')).toThrow(/dimiliki/);
    expect(auditLedger(e.state.ledger)).toEqual([]);
    expect(validateState(deserialize(serialize(e.state)))).toEqual([]);
  });

  it('level maksimum 10 dan rank dibatasi maksimal perk', () => {
    const e = mk();
    gear.ensureGear(e);
    gear.buyGear(e, 'tas_ajaib'); gear.equipGear(e, 'tas_ajaib');
    gear.buyMat(e, 'logam', 200);
    for (let i = 1; i < gear.MAX_GEAR_LV; i++) gear.upgradeGear(e, 'tas_ajaib');
    expect(gear.gearLevel(e, 'tas_ajaib')).toBe(10);
    expect(() => gear.upgradeGear(e, 'tas_ajaib')).toThrow(/maksimum/);
    expect(e.state.skills.bibit_unggul).toBe(5); // maksimal perk Bibit Unggul = 5
  });

  it('migrasi: poin perk lama dikembalikan, atribut direset, poin atribut ikut jadi poin skill', () => {
    const e = mk();
    e.state.skills = { tawar: 3, juragan: 2 };
    e.state.attrs = { dagang: 2, karisma: 0, tangkas: 1, hoki: 0 };
    const perkCost = [0, 1, 2].reduce((n, k) => n + skillCost(PERKS.find((p) => p.id === 'tawar'), k), 0);
    const totalBefore = e.skillPointsTotal;
    e.mods();
    expect(e.state.gear.refunded).toBe(perkCost);
    expect(e.state.attrs).toEqual({ dagang: 0, karisma: 0, tangkas: 0, hoki: 0 });
    expect(e.state.skills.juragan).toBe(2); // skill pohon tidak disentuh
    expect(e.state.skills.tawar).toBeUndefined();
    expect(e.skillPointsFree()).toBe(e.skillPointsTotal() - e.skillPointsSpent());
    expect(e.skillPointsTotal()).toBeGreaterThanOrEqual(perkCost);
    expect(typeof totalBefore).toBe('function');
  });

  it('perk tidak bisa dipelajari dengan poin; reset skill tidak menghapus perk dari barang', () => {
    const e = mk();
    e.mods();
    expect(e.canLearn('tawar')).toMatch(/Perlengkapan/);
    e.state.skills.juragan = 1;
    e.resetSkills();
    expect(e.state.skills.juragan).toBeUndefined();
    expect(e.state.skills.panen_ganda).toBe(1);
  });

  it('celup warna memotong kas dan bisa kembali ke warna asli', () => {
    const e = mk();
    gear.ensureGear(e);
    const b = e.state.ledger.balance;
    gear.setDye(e, 'topi_jerami', 2);
    expect(b - e.state.ledger.balance).toBe(gear.DYE_COST);
    expect(e.state.gear.dye.topi_jerami).toBe(2);
    gear.setDye(e, 'topi_jerami', 0);
    expect(e.state.gear.dye.topi_jerami).toBeUndefined();
    expect(() => gear.setDye(e, 'topi_elang', 1)).toThrow(/belum/);
  });
});

describe('pet dengan efek unik', () => {
  it('12 jenis pet memakai 12 perk berbeda', () => {
    const perks = PET_KINDS.map((k) => gear.PET_PERK[k.id]).filter(Boolean);
    expect(perks).toHaveLength(12);
    expect(new Set(perks).size).toBe(12);
  });

  it('pet yang dipasang menambah rank perknya; efek lama dimatikan', () => {
    const e = mk();
    e.state.pets.owned.push({ id: 1, kind: 'rubah', rarity: 'epic' }, { id: 2, kind: 'dagang', rarity: 'common' });
    e.state.pets.nextId = 3;
    e.mods();
    const base = e.state.skills.panen_ganda || 0;
    e.equipPet(1);
    expect(e.state.skills.panen_ganda).toBe(base + 2); // epic = rank 2
    e.equipPet(2);
    expect(e.state.skills.lidah_emas).toBe(1);
    expect(e.farmBuffs().value).toBe(0); // buff lama pet tidak aktif lagi
    e.unequipPet(1);
    expect(e.state.skills.panen_ganda).toBe(base);
  });

  it('level pet menaikkan rank: Lv 10 dan Lv 20 +1 masing-masing', () => {
    const e = mk();
    const p = { id: 1, kind: 'hoki', rarity: 'rare', lv: 1 };
    expect(gear.petRank(e, p)).toBe(2);
    p.lv = 10; expect(gear.petRank(e, p)).toBe(3);
    p.lv = 20; expect(gear.petRank(e, p)).toBe(4);
  });
});
