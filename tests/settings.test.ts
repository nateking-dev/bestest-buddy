import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/constants';
import { BuddySettingTab } from '../src/settings';
import type BestestBuddyPlugin from '../src/main';
import type { BuddyPluginSettings } from '../src/types';

type Definition = ReturnType<BuddySettingTab['getSettingDefinitions']>[number];

// Rows whose control is rendered by hand, so they carry no declarative key.
const RENDERED_KEYS = ['openAIApiKey', 'claudeApiKey'];

function fakePlugin(overrides: Partial<BuddyPluginSettings> = {}) {
  const save = vi.fn(async () => {});
  const refreshViews = vi.fn();
  const plugin = {
    app: {},
    data: { settings: { ...DEFAULT_SETTINGS, ...overrides } },
    store: { save },
    refreshViews,
  };
  return { plugin: plugin as unknown as BestestBuddyPlugin, save, refreshViews, settings: plugin.data.settings };
}

function controlKeys(tab: BuddySettingTab): string[] {
  const keys: string[] = [];
  for (const definition of tab.getSettingDefinitions()) {
    if ('control' in definition && definition.control) {
      keys.push(definition.control.key);
    }
  }
  return keys;
}

function named(tab: BuddySettingTab, name: string): Definition[] {
  return tab
    .getSettingDefinitions()
    .filter((definition) => 'name' in definition && definition.name === name);
}

/** Rows with no predicate are always shown. */
function isVisible(definition: Definition): boolean {
  if (!('visible' in definition) || definition.visible === undefined) {
    return true;
  }
  return typeof definition.visible === 'function' ? definition.visible() : definition.visible;
}

describe('declarative settings definitions', () => {
  let tab: BuddySettingTab;
  let harness: ReturnType<typeof fakePlugin>;

  beforeEach(() => {
    harness = fakePlugin();
    tab = new BuddySettingTab(harness.plugin);
  });

  it('covers every persisted setting, so search and the fallback cannot drift', () => {
    const covered = new Set([...controlKeys(tab), ...RENDERED_KEYS]);

    expect([...covered].sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });

  it('reads values from the plugin data object rather than plugin.settings', () => {
    harness.settings.model = 'gpt-test';

    expect(tab.getControlValue('model')).toBe('gpt-test');
    expect(tab.getControlValue('snarkLevel')).toBe(DEFAULT_SETTINGS.snarkLevel);
  });

  it('persists a changed value through the plugin store', async () => {
    await tab.setControlValue('frequency', 'chatty');

    expect(harness.settings.frequency).toBe('chatty');
    expect(harness.save).toHaveBeenCalledTimes(1);
  });

  it('applies the same normalization as the imperative fallback', async () => {
    await tab.setControlValue('burstThreshold', 4);
    expect(harness.settings.burstThreshold).toBe(10);

    await tab.setControlValue('model', '   ');
    expect(harness.settings.model).toBe(DEFAULT_SETTINGS.model);
  });

  it('repaints the panel only for the setting that changes it', async () => {
    await tab.setControlValue('ambientEnabled', false);
    expect(harness.refreshViews).not.toHaveBeenCalled();

    await tab.setControlValue('minimalMode', true);
    expect(harness.refreshViews).toHaveBeenCalledTimes(1);
  });

  it('ignores a key it does not own', async () => {
    await tab.setControlValue('somethingElse', 'x');

    expect(harness.save).not.toHaveBeenCalled();
  });

  it('shows a mismatch warning only for the direction that applies', async () => {
    const visibility = () => named(tab, 'Model may not match provider').map(isVisible);

    expect(visibility()).toEqual([false, false]);

    await tab.setControlValue('model', 'claude-haiku-4-5-20251001');
    expect(visibility()).toEqual([true, false]);

    await tab.setControlValue('provider', 'claude');
    expect(visibility()).toEqual([false, false]);

    await tab.setControlValue('model', 'gpt-4.1-mini');
    expect(visibility()).toEqual([false, true]);
  });

  it('warns about a high snark level once it passes the threshold', async () => {
    const snarkVisible = () => named(tab, 'High snark level').every(isVisible);

    expect(snarkVisible()).toBe(false);

    await tab.setControlValue('snarkLevel', 95);
    expect(snarkVisible()).toBe(true);
  });
});
