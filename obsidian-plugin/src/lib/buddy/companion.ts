import {
  EYES,
  HATS,
  RARITIES,
  RARITY_WEIGHTS,
  SPECIES,
  STAT_NAMES,
  type Companion,
  type CompanionBones,
  type Rarity,
  type StatName,
  type StoredCompanion,
} from './types';

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let temp = Math.imul(value ^ (value >>> 15), 1 | value);
    temp = (temp + Math.imul(temp ^ (temp >>> 7), 61 | temp)) ^ temp;
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(rng: () => number, options: readonly T[]): T {
  return options[Math.floor(rng() * options.length)]!;
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((sum, value) => sum + value, 0);
  let remaining = rng() * total;
  for (const rarity of RARITIES) {
    remaining -= RARITY_WEIGHTS[rarity];
    if (remaining < 0) {
      return rarity;
    }
  }
  return 'common';
}

const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
  mythic: 70,
};

function rollStats(rng: () => number, rarity: Rarity): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);

  while (dump === peak) {
    dump = pick(rng, STAT_NAMES);
  }

  const stats = {} as Record<StatName, number>;
  for (const stat of STAT_NAMES) {
    if (stat === peak) {
      stats[stat] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (stat === dump) {
      stats[stat] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[stat] = floor + Math.floor(rng() * 40);
    }
  }

  return stats;
}

export type Roll = {
  bones: CompanionBones;
  inspirationSeed: number;
};

function rollFrom(rng: () => number): Roll {
  const rarity = rollRarity(rng);
  return {
    bones: {
      rarity,
      species: pick(rng, SPECIES),
      eye: pick(rng, EYES),
      hat: rarity === 'common' ? 'none' : pick(rng, HATS),
      shiny: rng() < 0.01,
      stats: rollStats(rng, rarity),
    },
    inspirationSeed: Math.floor(rng() * 1e9),
  };
}

const SALT = 'friend-2026-401';

export function roll(seed: string): Roll {
  return rollFrom(mulberry32(hashString(`${seed}${SALT}`)));
}

export function mergeCompanion(seed: string, stored: StoredCompanion): Companion {
  const { bones } = roll(seed);
  return {
    ...stored,
    ...bones,
  };
}

export function createStableUserSeed(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `buddy-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

