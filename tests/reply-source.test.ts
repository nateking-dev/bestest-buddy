import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestUrl } from 'obsidian';
import {
  describeReplySource,
  generateReaction,
  hasApiKey,
  hatchSoul,
  isSettingsFixable,
} from '../src/llm';
import { mergeCompanion, roll } from '../src/lib/buddy/companion';
import type BestestBuddyPlugin from '../src/main';

// The obsidian stub's requestUrl always throws; replace it so each test can set
// the exact status and error body a provider would return.
vi.mock('obsidian', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('obsidian');
  return { ...actual, requestUrl: vi.fn() };
});

const { bones } = roll('reply-source-seed');
const companion = mergeCompanion(bones, { name: 'Nib', personality: 'wry duck' });

function respondWith(status: number, body: unknown): void {
  vi.mocked(requestUrl).mockResolvedValue({ status, json: body } as never);
}

function reactWith(settings: Partial<Record<string, unknown>>) {
  return generateReaction(fakePlugin(settings), {
    companion,
    event: { type: 'long_pause', at: Date.now() },
  });
}

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(requestUrl).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a canned reaction when the provider has no key', async () => {
    const result = await generateReaction(fakePlugin(), {
      companion,
      event: { type: 'long_pause', at: Date.now() },
    });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'no-api-key' });
    expect(result.text.length).toBeGreaterThan(0);
    expect(requestUrl).not.toHaveBeenCalled();
  });

  it('treats an unreachable host as a network problem, not a settings one', async () => {
    vi.mocked(requestUrl).mockImplementation(() => {
      throw new Error('net::ERR_INTERNET_DISCONNECTED');
    });

    const result = await reactWith({ openAIApiKey: 'sk-test' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'network' });
    expect(isSettingsFixable(result.source)).toBe(false);
  });

  it('names a rejected key as an auth problem', async () => {
    respondWith(401, { error: { message: 'Incorrect API key provided: sk-test.' } });

    const result = await reactWith({ openAIApiKey: 'sk-test' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'auth' });
    expect(describeReplySource(result.source)).toContain('Incorrect API key provided');
    expect(isSettingsFixable(result.source)).toBe(true);
  });

  it('names an unknown model, quoting the model that was tried', async () => {
    respondWith(404, {
      error: { message: 'The model `gpt-nope` does not exist', code: 'model_not_found' },
    });

    const result = await reactWith({ openAIApiKey: 'sk-test', model: 'gpt-nope' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'model' });
    expect(describeReplySource(result.source)).toContain('gpt-nope');
  });

  it('separates an exhausted quota from ordinary rate limiting', async () => {
    respondWith(429, {
      error: { message: 'You exceeded your current quota', code: 'insufficient_quota' },
    });
    expect((await reactWith({ openAIApiKey: 'sk-test' })).source).toMatchObject({ reason: 'quota' });

    respondWith(429, { error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } });
    const limited = await reactWith({ openAIApiKey: 'sk-test' });
    expect(limited.source).toMatchObject({ reason: 'rate-limit' });
    expect(isSettingsFixable(limited.source)).toBe(false);
  });

  it('maps Claude error types to the same reasons', async () => {
    respondWith(401, { error: { type: 'authentication_error', message: 'invalid x-api-key' } });

    const result = await reactWith({ provider: 'claude', claudeApiKey: 'sk-ant' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'auth' });
    expect(describeReplySource(result.source)).toContain('Claude');
  });

  it('reports a usable-looking answer with no content as an empty response', async () => {
    respondWith(200, { output: [] });

    const result = await reactWith({ openAIApiKey: 'sk-test' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'empty-response' });
  });

  it('reports a canned soul when hatching without a key', async () => {
    const result = await hatchSoul(fakePlugin(), bones);

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'no-api-key' });
    expect(result.name.length).toBeGreaterThan(0);
  });

  it('only checks the key for the selected provider', () => {
    expect(hasApiKey(fakePlugin({ openAIApiKey: 'sk-test' }))).toBe(true);
    expect(hasApiKey(fakePlugin({ provider: 'claude', openAIApiKey: 'sk-test' }))).toBe(false);
    expect(hasApiKey(fakePlugin({ provider: 'claude', claudeApiKey: 'sk-ant' }))).toBe(true);
  });

  it('returns the model line when the API answers', async () => {
    respondWith(200, {
      output: [{ content: [{ type: 'output_text', text: '{"reaction":"a real line"}' }] }],
    });

    const result = await reactWith({ openAIApiKey: 'sk-test' });

    expect(result).toEqual({ text: 'a real line', source: { kind: 'api' } });
  });

  it('describes canned sources and stays silent for API replies', () => {
    expect(describeReplySource({ kind: 'api' })).toBeNull();
    expect(describeReplySource(null)).toBeNull();
    expect(
      describeReplySource({
        kind: 'fallback',
        reason: 'no-api-key',
        problem: 'No OpenAI API key is set.',
        fix: 'Add one in settings.',
      }),
    ).toBe('No OpenAI API key is set. Add one in settings.');
  });
});
