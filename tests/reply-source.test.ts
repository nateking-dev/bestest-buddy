import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateReaction, hatchSoul, describeReplySource, hasApiKey } from '../src/llm';
import { mergeCompanion, roll } from '../src/lib/buddy/companion';
import type BestestBuddyPlugin from '../src/main';

const { bones } = roll('reply-source-seed');
const companion = mergeCompanion(bones, { name: 'Nib', personality: 'wry duck' });

function fakePlugin(settings: Partial<Record<string, unknown>> = {}): BestestBuddyPlugin {
  return {
    data: {
      settings: {
        provider: 'openai',
        openAIApiKey: '',
        claudeApiKey: '',
        model: 'gpt-test',
        snarkLevel: 50,
        ...settings,
      },
    },
  } as unknown as BestestBuddyPlugin;
}

describe('reply source reporting', () => {
  beforeEach(() => {
    // requestUrl throws in the obsidian test stub, which stands in for a failed call.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a canned reaction when the provider has no key', async () => {
    const result = await generateReaction(fakePlugin(), {
      companion,
      event: { type: 'long_pause', at: Date.now() },
    });

    expect(result.source).toEqual({ kind: 'fallback', reason: 'no-api-key' });
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('reports a canned reaction when the API call fails', async () => {
    const result = await generateReaction(fakePlugin({ openAIApiKey: 'sk-test' }), {
      companion,
      event: { type: 'long_pause', at: Date.now() },
    });

    expect(result.source).toEqual({ kind: 'fallback', reason: 'request-failed' });
  });

  it('reports a canned soul when hatching without a key', async () => {
    const result = await hatchSoul(fakePlugin(), bones);

    expect(result.source).toEqual({ kind: 'fallback', reason: 'no-api-key' });
    expect(result.name.length).toBeGreaterThan(0);
  });

  it('only checks the key for the selected provider', () => {
    expect(hasApiKey(fakePlugin({ openAIApiKey: 'sk-test' }))).toBe(true);
    expect(hasApiKey(fakePlugin({ provider: 'claude', openAIApiKey: 'sk-test' }))).toBe(false);
    expect(hasApiKey(fakePlugin({ provider: 'claude', claudeApiKey: 'sk-ant' }))).toBe(true);
  });

  it('describes canned sources and stays silent for API replies', () => {
    expect(describeReplySource({ kind: 'api' })).toBeNull();
    expect(describeReplySource(null)).toBeNull();
    expect(describeReplySource({ kind: 'fallback', reason: 'no-api-key' })).toContain('no API key');
  });
});
