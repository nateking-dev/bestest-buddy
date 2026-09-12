import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestUrl } from 'obsidian';
import {
  generateReaction,
  hasApiKey,
  hatchSoul,
  isSettingsFixable,
  type ReplyFallback,
  type ReplySource,
} from '../src/llm';
import { mergeCompanion, roll } from '../src/lib/buddy/companion';
import type BestestBuddyPlugin from '../src/main';

// The obsidian stub's requestUrl always throws; replace it so each test can set
// the exact status and error body a provider would return.
vi.mock('obsidian', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('obsidian');
  return { ...actual, requestUrl: vi.fn() };
});

const SEED = 'reply-source-seed';
const { bones } = roll(SEED);
// mergeCompanion re-rolls from the seed, so pass the seed, not the bones.
const companion = mergeCompanion(SEED, {
  name: 'Nib',
  personality: 'wry duck',
  hatchedAt: 0,
});

function respondWith(status: number, body: unknown): void {
  vi.mocked(requestUrl).mockResolvedValue({ status, json: body } as never);
}

/** A body Obsidian cannot parse: the `.json` getter throws, as it does at runtime. */
function respondWithText(status: number, text: string): void {
  vi.mocked(requestUrl).mockResolvedValue({
    status,
    text,
    get json(): unknown {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  } as never);
}

function canned(source: ReplySource): ReplyFallback {
  if (source.kind !== 'fallback') {
    throw new Error('expected a canned reply');
  }
  return source;
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
    expect(canned(result.source).problem).toContain('Incorrect API key provided');
    expect(isSettingsFixable(result.source)).toBe(true);
  });

  it('names an unknown model, quoting the model that was tried', async () => {
    respondWith(404, {
      error: { message: 'The model `gpt-nope` does not exist', code: 'model_not_found' },
    });

    const result = await reactWith({ openAIApiKey: 'sk-test', model: 'gpt-nope' });

    expect(result.source).toMatchObject({ kind: 'fallback', reason: 'model' });
    expect(canned(result.source).problem).toContain('gpt-nope');
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
    expect(canned(result.source).problem).toContain('Claude');
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

  it('reads a non-JSON error body, which is often the only stated cause', async () => {
    respondWithText(403, '<html><body><h1>403 Forbidden</h1><p>Blocked by proxy</p></body></html>');

    const result = await reactWith({ openAIApiKey: 'sk-test' });
    const source = canned(result.source);

    expect(source.reason).toBe('auth');
    expect(source.problem).toContain('403 Forbidden');
    expect(source.problem).toContain('Blocked by proxy');
    expect(source.problem).not.toContain('<');
  });

  it('always offers a problem and a fix to show', async () => {
    respondWith(500, { error: { message: 'The server had an error' } });

    for (const source of [
      canned((await reactWith({})).source),
      canned((await reactWith({ openAIApiKey: 'sk-test' })).source),
    ]) {
      expect(source.problem.length).toBeGreaterThan(0);
      expect(source.fix).toBeTruthy();
    }
  });
});
