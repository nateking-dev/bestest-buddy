import { describe, it, expect } from 'vitest';
import { roll, mergeCompanion, createStableUserSeed } from '../src/lib/buddy/companion';
import { RARITIES, SPECIES, STAT_NAMES } from '../src/lib/buddy/types';

describe('roll', () => {
  it('is deterministic for a given seed', () => {
    expect(roll('hello')).toEqual(roll('hello'));
  });

  it('produces varied bones across seeds', () => {
    const sigs = new Set(['a', 'b', 'c', 'd', 'e'].map((s) => JSON.stringify(roll(s).bones)));
    expect(sigs.size).toBeGreaterThan(1);
  });

  it('only emits known species, rarities, and the full stat set', () => {
    for (let i = 0; i < 2000; i++) {
      const { bones } = roll(`seed-${i}`);
      expect(RARITIES).toContain(bones.rarity);
      expect(SPECIES).toContain(bones.species);
      expect(Object.keys(bones.stats).sort()).toEqual([...STAT_NAMES].sort());
    }
  });

  it('gives common buddies no hat', () => {
    for (let i = 0; i < 5000; i++) {
      const { bones } = roll(`hat-${i}`);
      if (bones.rarity === 'common') expect(bones.hat).toBe('none');
    }
  });
});

describe('stat generation', () => {
  it('keeps every stat within 1..100 for all rarities, including mythic (regression)', () => {
    const seen = new Set<string>();
    const violations: string[] = [];
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const { bones } = roll(`stat-${i}`);
      seen.add(bones.rarity);
      for (const stat of STAT_NAMES) {
        const v = bones.stats[stat];
        if (v < 1 || v > 100) violations.push(`${bones.rarity}/${stat}=${v}`);
      }
    }
    expect(violations).toEqual([]);
    // Confirm the sweep actually exercised mythic — the rarity whose 70 floor
    // exposed the >100 overflow this test guards against.
    expect([...seen].sort()).toEqual([...RARITIES].sort());
  });
});

describe('mergeCompanion', () => {
  it('keeps stored soul fields and overlays rolled bones', () => {
    const c = mergeCompanion('seed-xyz', { name: 'Jinx', personality: 'snarky', hatchedAt: 123 });
    expect(c.name).toBe('Jinx');
    expect(c.personality).toBe('snarky');
    expect(c.hatchedAt).toBe(123);
    expect(RARITIES).toContain(c.rarity);
    expect(SPECIES).toContain(c.species);
  });

  it('derives the same bones as roll for the same seed', () => {
    const merged = mergeCompanion('abc', { name: 'n', personality: 'p', hatchedAt: 0 });
    const { bones } = roll('abc');
    expect({ rarity: merged.rarity, species: merged.species, hat: merged.hat }).toEqual({
      rarity: bones.rarity,
      species: bones.species,
      hat: bones.hat,
    });
  });
});

describe('createStableUserSeed', () => {
  it('returns a non-empty string', () => {
    const seed = createStableUserSeed();
    expect(typeof seed).toBe('string');
    expect(seed.length).toBeGreaterThan(0);
  });
});
