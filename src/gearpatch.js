// Memasang sistem Perlengkapan ke GameEngine tanpa menulis ulang engine.js:
// - poin skill tidak lagi menghitung perk (perk kini berasal dari barang dan pet, bukan dibeli dengan poin)
// - poin atribut ikut dihitung sebagai poin skill
// - rank perk dihitung ulang setiap kali barang, pet, atau skill berubah
import { GameEngine } from './core/engine.js';
import { getSkill, skillCost } from './core/catalog.js';
import { PET_KINDS } from './core/farm.js';
import { ensureGear, applyGear } from './core/gear.js';

const P = GameEngine.prototype;

if (!P._gearPatched) {
  P._gearPatched = true;

  // Efek lama pet (5 jenis buff yang kembar) dimatikan; efek unik tiap pet kini lewat perk (gear.js).
  for (const k of PET_KINDS) { k.base = 0; k.text = () => ''; }

  const before = (name) => {
    const orig = P[name];
    P[name] = function patched(...a) { applyGear(this); return orig.apply(this, a); };
  };
  const after = (name) => {
    const orig = P[name];
    P[name] = function patched(...a) { const r = orig.apply(this, a); applyGear(this); return r; };
  };
  ['mods', 'capacity', 'walkMul', 'farmBuffs', 'fastThreshold', 'startDay'].forEach(before);
  ['equipPet', 'unequipPet', 'releasePet', 'sellPet', 'sellSparePets', 'hatch', 'learnSkill', 'replaceState'].forEach(after);

  const totalOrig = P.skillPointsTotal;
  P.skillPointsTotal = function skillPointsTotal() { ensureGear(this); return totalOrig.call(this) + this.attrPointsTotal(); };

  P.skillPointsSpent = function skillPointsSpent() {
    ensureGear(this);
    let n = 0;
    for (const [id, rank] of Object.entries(this.state.skills)) {
      const def = getSkill(id);
      if (def.attr) continue; // perk berasal dari barang dan pet, tidak memakai poin
      for (let r = 0; r < rank; r++) n += skillCost(def, r);
    }
    return n;
  };

  const canLearnOrig = P.canLearn;
  P.canLearn = function canLearn(id) {
    if (getSkill(id).attr) return 'Perk didapat dari Perlengkapan dan Pet';
    return canLearnOrig.call(this, id);
  };

  const resetOrig = P.resetSkills;
  P.resetSkills = function resetSkills() {
    resetOrig.call(this);
    applyGear(this);
  };
}
