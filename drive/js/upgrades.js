// Bengkel upgrade shop: permanent car improvements, saved with the journey.
export const UPGRADES = [
  {
    key: 'tank', icon: '⛽', name: 'Long-range tank',
    desc: '+10L fuel capacity per level', max: 2, base: 200000, step: 150000,
  },
  {
    key: 'tune', icon: '🔥', name: 'Engine tune',
    desc: '+12% power, +15 km/h top speed', max: 3, base: 250000, step: 200000,
  },
  {
    key: 'eco', icon: '🌿', name: 'Eco kit',
    desc: '−15% fuel thirst per level', max: 3, base: 180000, step: 150000,
  },
  {
    key: 'tires', icon: '🛞', name: 'Wet-grip tires',
    desc: 'more grip & stability in the rain', max: 2, base: 150000, step: 150000,
  },
  {
    key: 'beam', icon: '💡', name: 'LED light bar',
    desc: 'longer, brighter headlights', max: 2, base: 120000, step: 130000,
  },
];

export class UpgradeSet {
  constructor() {
    this.levels = { tank: 0, tune: 0, eco: 0, tires: 0, beam: 0 };
  }

  static def(key) {
    return UPGRADES.find((u) => u.key === key);
  }

  maxed(key) {
    return this.levels[key] >= UpgradeSet.def(key).max;
  }

  costOf(key) {
    const u = UpgradeSet.def(key);
    return u.base + u.step * this.levels[key];
  }

  buy(key) {
    if (!this.maxed(key)) this.levels[key]++;
  }

  pips(key) {
    const u = UpgradeSet.def(key);
    return '●'.repeat(this.levels[key]) + '○'.repeat(u.max - this.levels[key]);
  }

  tankCap() { return 30 + 10 * this.levels.tank; }
  power() { return 1 + 0.12 * this.levels.tune; }
  topBoost() { return 4 * this.levels.tune; } // m/s, ≈14 km/h per level
  ecoMult() { return Math.max(0.55, 1 - 0.15 * this.levels.eco); }
  gripBoost() { return 0.12 * this.levels.tires; }
  beamLvl() { return this.levels.beam; }

  serialize() {
    return { ...this.levels };
  }

  load(d) {
    if (!d) return;
    for (const k of Object.keys(this.levels)) {
      const max = UpgradeSet.def(k).max;
      this.levels[k] = Math.max(0, Math.min(max, d[k] | 0));
    }
  }
}
