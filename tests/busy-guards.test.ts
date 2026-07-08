import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BestestBuddyPlugin from '../src/main';
import { generateReaction } from '../src/llm';
import type { BuddyPluginData } from '../src/types';

vi.mock('../src/llm', () => ({
  hatchSoul: vi.fn(async () => ({ name: 'Stub', personality: 'stubby' })),
  generateReaction: vi.fn(async () => 'stub reaction'),
}));

function pluginData(): BuddyPluginData {
  return {
    dataVersion: 2,
    vaultSeed: 'seed',
    storedCompanion: { name: 'Jinx', personality: 'snarky', hatchedAt: 1 },
    muted: false,
    recentEvents: [],
    settings: {
      provider: 'openai',
      openAIApiKey: '',
      claudeApiKey: '',
      model: 'gpt-4.1-mini',
      ambientEnabled: true,
      frequency: 'chatty',
      burstThreshold: 50,
      includeCurrentNoteInDirectReplies: false,
      minimalMode: false,
      snarkLevel: 50,
    },
  };
}

function makePlugin(): BestestBuddyPlugin {
  const fakeEditor = {
    getCursor: () => ({ line: 0, ch: 0 }),
    lineCount: () => 1,
    getLine: () => 'some note text',
  };
  const activeView = { file: { path: 'a.md', basename: 'a' }, editor: fakeEditor };
  const app = {
    workspace: {
      getActiveViewOfType: () => activeView,
      getActiveFile: () => null,
      getLeavesOfType: () => [],
    },
  };
  // The stub Plugin base class takes (app, manifest) loosely.
  const plugin = new (BestestBuddyPlugin as unknown as new (
    app: unknown,
    manifest: unknown,
  ) => BestestBuddyPlugin)(app, {});
  plugin.data = pluginData();
  return plugin;
}

describe('busy guards on concurrent LLM entry points (regression: #29)', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout, clearTimeout, setInterval, clearInterval });
    vi.mocked(generateReaction).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chatty tick fires when idle (control)', async () => {
    const plugin = makePlugin();
    plugin.data.recentEvents = [{ type: 'note_opened', at: Date.now() }];
    const handle = vi.spyOn(plugin, 'handleBuddyEvent').mockResolvedValue(undefined);

    await (plugin as unknown as { fireChattyTick(): Promise<void> }).fireChattyTick();

    expect(handle).toHaveBeenCalledTimes(1);
    expect(handle.mock.calls[0]![0].type).toBe('chatty_tick');
  });

  it('chatty tick is skipped while another request is in flight', async () => {
    const plugin = makePlugin();
    plugin.data.recentEvents = [{ type: 'note_opened', at: Date.now() }];
    const handle = vi.spyOn(plugin, 'handleBuddyEvent').mockResolvedValue(undefined);
    plugin.busy = true;

    await (plugin as unknown as { fireChattyTick(): Promise<void> }).fireChattyTick();

    expect(handle).not.toHaveBeenCalled();
  });

  it('direct message goes through when idle (control)', async () => {
    const plugin = makePlugin();

    await plugin.sendDirectMessage('hello buddy');

    expect(generateReaction).toHaveBeenCalledTimes(1);
    expect(plugin.currentBubble).toBe('stub reaction');
    expect(plugin.busy).toBe(false);
  });

  it('direct message is rejected while another request is in flight', async () => {
    const plugin = makePlugin();
    plugin.busy = true;

    await plugin.sendDirectMessage('hello buddy');

    expect(generateReaction).not.toHaveBeenCalled();
    expect(plugin.currentBubble).toBeNull();
    // The guard must not clobber the in-flight request's busy flag.
    expect(plugin.busy).toBe(true);
  });

  it('hatch is skipped while another request is in flight', async () => {
    const plugin = makePlugin();
    plugin.data.storedCompanion = undefined;
    plugin.busy = true;

    await plugin.ensureHatched();

    expect(plugin.data.storedCompanion).toBeUndefined();
    expect(plugin.busy).toBe(true);
  });
});
