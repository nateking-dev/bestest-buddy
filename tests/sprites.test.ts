import { describe, it, expect } from 'vitest';
import { renderSprite, renderHat, spriteFrameCount } from '../src/lib/buddy/sprites';
import { SPECIES, HATS, type Companion, type Hat, type Species } from '../src/lib/buddy/types';

const WIDTH = 12;

function companionOf(species: Species, hat: Hat): Companion {
  return {
    name: 'Test',
    personality: 'p',
    hatchedAt: 0,
    rarity: 'common',
    species,
    eye: '×',
    hat,
    shiny: false,
    stats: { GRAMMARING: 1, PATIENCE: 1, CHAOS: 1, WISDOM: 1, SNARK: 1 },
  };
}

describe('sprite body width invariant (regression: sprite-alignment)', () => {
  it('renders every species/frame row at exactly 12 columns', () => {
    const bad: string[] = [];
    for (const species of SPECIES) {
      for (let f = 0; f < spriteFrameCount(species); f++) {
        renderSprite(companionOf(species, 'none'), f).forEach((line, r) => {
          if (line.length !== WIDTH) bad.push(`${species}/f${f}/r${r}=${line.length}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('hat rendering', () => {
  it('returns null when no hat is worn', () => {
    expect(renderHat(companionOf('capybara', 'none'))).toBeNull();
  });

  it('renders every hat at 12 columns for every species', () => {
    const bad: string[] = [];
    for (const species of SPECIES) {
      for (const hat of HATS) {
        if (hat === 'none') continue;
        const res = renderHat(companionOf(species, hat));
        expect(res).not.toBeNull();
        if (res && res.line.length !== WIDTH) bad.push(`${species}/${hat}=${res.line.length}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps every hatted sprite row at 12 columns across all frames', () => {
    const bad: string[] = [];
    for (const species of SPECIES) {
      for (const hat of HATS) {
        for (let f = 0; f < spriteFrameCount(species); f++) {
          renderSprite(companionOf(species, hat), f).forEach((line, r) => {
            if (line.length !== WIDTH) bad.push(`${species}/${hat}/f${f}/r${r}=${line.length}`);
          });
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps the wizard hat at 12 columns with a single backslash (regression: doubled backslash)', () => {
    const res = renderHat(companionOf('capybara', 'wizard'));
    expect(res?.line.length).toBe(WIDTH);
    expect((res?.line.match(/\\/g) ?? []).length).toBe(1);
  });

  it('prepends a blank row for head-at-top species when hatted', () => {
    const bare = renderSprite(companionOf('rabbit', 'none'), 0);
    const hatted = renderSprite(companionOf('rabbit', 'crown'), 0);
    expect(hatted.length).toBe(bare.length + 1);
    expect(hatted[0]!.trim()).toBe('');
  });

  it('produces a finite per-species hat offset for every species', () => {
    for (const species of SPECIES) {
      const res = renderHat(companionOf(species, 'crown'));
      expect(Number.isFinite(res!.offsetColumns)).toBe(true);
    }
  });
});
