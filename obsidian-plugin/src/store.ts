import { Notice } from 'obsidian';
import { createStableUserSeed, mergeCompanion, roll } from './lib/buddy/companion';
import type { Companion, Eye, Hat, Species, StatName, StoredCompanion } from './lib/buddy/types';
import { DEFAULT_SETTINGS, MAX_RECENT_EVENTS } from './constants';
import type BestestBuddyPlugin from './main';
import type { BuddyEvent, BuddyMood, BuddyPluginData, BuddySessionMode, CompanionOverrides } from './types';

export class BuddyStore {
  constructor(private readonly plugin: BestestBuddyPlugin) {}

  async load(): Promise<BuddyPluginData> {
    const raw = (await this.plugin.loadData()) as Partial<BuddyPluginData> | null;
    const data: BuddyPluginData = {
      vaultSeed: raw?.vaultSeed,
      storedCompanion: raw?.storedCompanion,
      companionOverrides: raw?.companionOverrides,
      muted: raw?.muted ?? false,
      lastReactionAt: raw?.lastReactionAt,
      recentEvents: raw?.recentEvents ?? [],
      moodState: raw?.moodState,
      sessionState: raw?.sessionState,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw?.settings ?? {}),
      },
    };

    this.plugin.data = data;
    return data;
  }

  async save(): Promise<void> {
    await this.plugin.saveData(this.plugin.data);
  }

  ensureVaultSeed(): string {
    if (this.plugin.data.vaultSeed) {
      return this.plugin.data.vaultSeed;
    }
    const seed = createStableUserSeed();
    this.plugin.data.vaultSeed = seed;
    void this.save();
    return seed;
  }

  getCompanion(): Companion | null {
    const seed = this.plugin.data.vaultSeed;
    const stored = this.plugin.data.storedCompanion;
    if (!seed || !stored) {
      return null;
    }
    const base = mergeCompanion(seed, stored);
    const overrides = this.plugin.data.companionOverrides;
    if (!overrides) {
      return base;
    }
    return {
      ...base,
      species: overrides.species ?? base.species,
      eye: overrides.eye ?? base.eye,
      hat: overrides.hat ?? base.hat,
      shiny: overrides.shiny ?? base.shiny,
      stats: overrides.stats ? { ...base.stats, ...overrides.stats } : base.stats,
    };
  }

  async hatchCompanion(stored: StoredCompanion): Promise<Companion> {
    const seed = this.ensureVaultSeed();
    this.plugin.data.storedCompanion = stored;
    await this.save();
    return mergeCompanion(seed, stored);
  }

  getCompanionBones() {
    return roll(this.ensureVaultSeed()).bones;
  }

  async resetCompanion(): Promise<void> {
    this.plugin.data.vaultSeed = createStableUserSeed();
    this.plugin.data.storedCompanion = undefined;
    this.plugin.data.companionOverrides = undefined;
    this.plugin.data.lastReactionAt = undefined;
    this.plugin.data.recentEvents = [];
    this.plugin.data.moodState = undefined;
    this.plugin.data.sessionState = undefined;
    await this.save();
    new Notice('Buddy reset for this vault.');
  }

  async setOverride<K extends keyof Omit<CompanionOverrides, 'stats'>>(
    key: K,
    value: Species | Eye | Hat | boolean,
  ): Promise<void> {
    this.plugin.data.companionOverrides = {
      ...this.plugin.data.companionOverrides,
      [key]: value,
    };
    await this.save();
  }

  async setStatOverrides(stats: Partial<Record<StatName, number>>): Promise<void> {
    this.plugin.data.companionOverrides = {
      ...this.plugin.data.companionOverrides,
      stats: { ...this.plugin.data.companionOverrides?.stats, ...stats },
    };
    await this.save();
  }

  async clearStatOverrides(): Promise<void> {
    if (this.plugin.data.companionOverrides) {
      this.plugin.data.companionOverrides = {
        ...this.plugin.data.companionOverrides,
        stats: undefined,
      };
    }
    await this.save();
  }

  async clearAppearanceOverrides(): Promise<void> {
    this.plugin.data.companionOverrides = undefined;
    await this.save();
  }

  async setMuted(muted: boolean): Promise<void> {
    this.plugin.data.muted = muted;
    await this.save();
  }

  async setLastReactionAt(timestamp: number): Promise<void> {
    this.plugin.data.lastReactionAt = timestamp;
    await this.save();
  }

  async appendEvent(event: BuddyEvent): Promise<void> {
    this.plugin.data.recentEvents = [...this.plugin.data.recentEvents, event].slice(-MAX_RECENT_EVENTS);
    await this.save();
  }

  async updateMood(mode: BuddyMood): Promise<void> {
    this.plugin.data.moodState = {
      mode,
      updatedAt: Date.now(),
    };
    await this.save();
  }

  async updateSession(mode: BuddySessionMode, notePath?: string): Promise<void> {
    this.plugin.data.sessionState = {
      mode,
      updatedAt: Date.now(),
      notePath,
    };
    await this.save();
  }

  getRecentEvents(limit = 6): BuddyEvent[] {
    return this.plugin.data.recentEvents.slice(-limit);
  }
}
