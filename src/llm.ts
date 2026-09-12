import { requestUrl } from 'obsidian';
import { buildFallbackReaction } from './lib/buddy/reactions';
import { RARITY_LABELS, STAT_NAMES, type Companion, type CompanionBones } from './lib/buddy/types';
import type BestestBuddyPlugin from './main';
import type { BuddyEvent } from './types';

/**
 * Where a buddy line actually came from. Canned lines are indistinguishable from
 * API lines in the bubble, so the UI needs this to say which one the user got —
 * and, when the API was meant to answer, what stopped it.
 */
export type ReplySource = { kind: 'api' } | ReplyFallback;

export type ReplyFallback = {
  kind: 'fallback';
  reason: FallbackReason;
  /** One sentence naming what went wrong, including provider, model and status. */
  problem: string;
  /** What the user can do about it, or null when there is nothing to do. */
  fix: string | null;
};

export type FallbackReason =
  | 'no-api-key'
  | 'auth'
  | 'model'
  | 'rate-limit'
  | 'quota'
  | 'bad-request'
  | 'provider-error'
  | 'network'
  | 'empty-response';

export type HatchResult = { name: string; personality: string; source: ReplySource };

export type ReactionResult = { text: string; source: ReplySource };

const FROM_API: ReplySource = { kind: 'api' };

/** Reasons the user can clear themselves, which is what earns a settings shortcut. */
const SETTINGS_REASONS: ReadonlySet<FallbackReason> = new Set<FallbackReason>([
  'no-api-key',
  'auth',
  'model',
  'bad-request',
  'empty-response',
]);

export function isSettingsFixable(source: ReplySource | null): boolean {
  return source?.kind === 'fallback' && SETTINGS_REASONS.has(source.reason);
}

/** Carries the provider's own status and error code up to the classifier. */
class LLMRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'LLMRequestError';
  }
}

function providerLabel(plugin: BestestBuddyPlugin): string {
  return plugin.data.settings.provider === 'claude' ? 'Claude' : 'OpenAI';
}

/** Keep a provider message readable in a sidebar without losing the useful part. */
function trimProviderMessage(message: string): string {
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

function fallback(reason: FallbackReason, problem: string, fix: string | null): ReplyFallback {
  return { kind: 'fallback', reason, problem, fix };
}

export function missingKeyFallback(plugin: BestestBuddyPlugin): ReplyFallback {
  const label = providerLabel(plugin);
  return fallback(
    'no-api-key',
    `No ${label} API key is set, so nothing was sent to the API.`,
    `Add a ${label} API key in Bestest Buddy settings, or switch provider.`,
  );
}

function emptyResponseFallback(plugin: BestestBuddyPlugin): ReplyFallback {
  const label = providerLabel(plugin);
  return fallback(
    'empty-response',
    `${label} answered for model "${plugin.data.settings.model}" but returned nothing usable.`,
    'Try a different model in Bestest Buddy settings; some models cannot return structured output.',
  );
}

/**
 * Turn a failed request into something the user can act on. Status and the
 * provider's own error code separate a wrong key from a wrong model from a
 * problem on the provider's side, which all look identical in the bubble.
 */
function classifyRequestError(plugin: BestestBuddyPlugin, error: unknown): ReplyFallback {
  const label = providerLabel(plugin);
  const model = plugin.data.settings.model;

  if (!(error instanceof LLMRequestError)) {
    const detail = error instanceof Error ? trimProviderMessage(error.message) : 'unknown error';
    return fallback(
      'network',
      `Could not reach ${label}: ${detail}`,
      'Check the network connection, and any VPN, proxy or firewall that blocks the API host.',
    );
  }

  const status = error.status;
  const said = error.message ? ` ${label} said: ${trimProviderMessage(error.message)}` : '';
  const at = status === null ? '' : ` (HTTP ${status})`;

  if (status === 401 || status === 403 || error.code === 'authentication_error' || error.code === 'permission_error') {
    return fallback(
      'auth',
      `${label} rejected the API key${at}.${said}`,
      `Check the ${label} API key in Bestest Buddy settings — it may be wrong, revoked, or for a different account.`,
    );
  }

  if (status === 404 || error.code === 'not_found_error' || error.code === 'model_not_found') {
    return fallback(
      'model',
      `${label} does not recognize the model "${model}"${at}.${said}`,
      `Set a model name ${label} actually offers in Bestest Buddy settings.`,
    );
  }

  if (error.code === 'insufficient_quota') {
    return fallback(
      'quota',
      `The ${label} account has no remaining quota${at}.${said}`,
      'Add credit or check billing on the provider account.',
    );
  }

  if (status === 429 || error.code === 'rate_limit_error') {
    return fallback(
      'rate-limit',
      `${label} rate-limited the request${at}.${said}`,
      'Nothing to fix. The next reaction will try again.',
    );
  }

  if (status !== null && status >= 500) {
    return fallback(
      'provider-error',
      `${label} had a server error${at}.${said}`,
      'This is on the provider side. The next reaction will try again.',
    );
  }

  return fallback(
    'bad-request',
    `${label} rejected the request for model "${model}"${at}.${said}`,
    `Check the model name and API key in Bestest Buddy settings. A model that cannot return structured output will fail here.`,
  );
}

export function describeReplySource(source: ReplySource | null): string | null {
  if (!source || source.kind === 'api') {
    return null;
  }
  return source.fix ? `${source.problem} ${source.fix}` : source.problem;
}

/** True when the selected provider has a key, so replies can reach the API at all. */
export function hasApiKey(plugin: BestestBuddyPlugin): boolean {
  const { provider, openAIApiKey, claudeApiKey } = plugin.data.settings;
  return provider === 'claude' ? claudeApiKey.trim().length > 0 : openAIApiKey.trim().length > 0;
}

function compactStats(stats: Companion['stats']): string {
  return STAT_NAMES.map((stat) => `${stat}:${stats[stat]}`).join(', ');
}

function identitySummary(companion: Companion | CompanionBones): string {
  return [
    `rarity=${RARITY_LABELS[companion.rarity]}`,
    `species=${companion.species}`,
    `hat=${companion.hat}`,
    `shiny=${companion.shiny ? 'yes' : 'no'}`,
    `stats=${compactStats(companion.stats)}`,
  ].join(' | ');
}

function topStats(companion: Companion | CompanionBones): string[] {
  return Object.entries(companion.stats)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([stat]) => stat);
}

function buddyVoiceGuide(companion: Companion): string {
  const strongest = topStats(companion);
  const styleBits: string[] = [];

  if (strongest.includes('SNARK')) {
    styleBits.push('Allow a dry, slightly sideways edge.');
  }
  if (strongest.includes('WISDOM')) {
    styleBits.push('Prefer clean, grounded observations over cute chatter.');
  }
  if (strongest.includes('CHAOS')) {
    styleBits.push('Let the line feel a little irreverent, but not random.');
  }
  if (strongest.includes('PATIENCE')) {
    styleBits.push('Sound steady and unhurried.');
  }
  if (strongest.includes('GRAMMARING')) {
    styleBits.push('Notice awkward phrasing, unclear sentences, and places the writing could be sharper.');
  }

  switch (companion.species) {
    case 'cat':
    case 'owl':
      styleBits.push('Aloof is fine; cold is not.');
      break;
    case 'capybara':
    case 'turtle':
      styleBits.push('Keep the energy calm and companionable.');
      break;
    case 'goose':
    case 'cactus':
      styleBits.push('A little prickly confidence is welcome.');
      break;
    case 'ghost':
    case 'mushroom':
      styleBits.push('You can sound soft, odd, and slightly uncanny.');
      break;
    default:
      break;
  }

  if (companion.shiny) {
    styleBits.push('Occasionally sound a touch ceremonial, but still brief.');
  }

  return styleBits.join(' ');
}

function eventGuidance(event: BuddyEvent, directMessage?: string): string {
  if (directMessage) {
    return 'For direct chat, answer the user plainly in one compact line. Be helpful, but stay like a companion, not a full assistant monologue.';
  }

  switch (event.type) {
    case 'writing_burst':
    case 'steady_session':
      return 'Favor observation over interruption. Reward momentum without overexplaining it.';
    case 'revision_spike':
      return 'Acknowledge reworking, sharpening, cutting, or reshaping.';
    case 'long_pause':
      return 'Be gentle and lightly orienting. Do not sound needy.';
    case 'returned_after_pause':
      return 'Sound welcoming and quietly glad the thread was picked back up.';
    case 'new_note_created':
      return 'Treat a fresh page like possibility, not pressure.';
    case 'daily_note_opened':
      return 'Sound lightly ritualistic or companionable, never grand.';
    case 'pet':
      return 'Receive the pet with a little warmth or dry amusement.';
    case 'chatty_tick':
      return 'React to the specific words and ideas in the note excerpt. Be curious, wry, or lightly observational about the actual content — not the act of writing.';
    default:
      return 'Stay situational and restrained.';
  }
}

function sanitizeReaction(text: string): string {
  const compact = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();

  if (!compact) {
    return '';
  }

  if (compact.length <= 160) {
    return compact;
  }

  const sentenceBoundary = compact.lastIndexOf('. ', 160);
  if (sentenceBoundary >= 70) {
    return compact.slice(0, sentenceBoundary + 1).trim();
  }

  const clauseBoundary = Math.max(compact.lastIndexOf('; ', 160), compact.lastIndexOf(', ', 160));
  if (clauseBoundary >= 70) {
    return `${compact.slice(0, clauseBoundary).trim()}…`;
  }

  return `${compact.slice(0, 157).trimEnd()}…`;
}

/** An error body is still worth reading even when it is not valid JSON. */
function safeJson(response: { json?: unknown; text?: string }): unknown {
  try {
    return response.json ?? null;
  } catch {
    return null;
  }
}

async function callOpenAI<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<T | null> {
  const response = await requestUrl({
    // Read error bodies ourselves; requestUrl's own throw discards the
    // provider's message, which is the only part the user can act on.
    throw: false,
    url: 'https://api.openai.com/v1/responses',
    method: 'POST',
    headers: {
      Authorization: `Bearer ${plugin.data.settings.openAIApiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: plugin.data.settings.model,
      instructions: params.instructions,
      input: params.input,
      text: {
        format: {
          type: 'json_schema',
          name: params.schemaName,
          schema: params.schema,
          strict: true,
        },
      },
    }),
  });

  const json = (safeJson(response) ?? {}) as {
    error?: { message?: string; code?: string; type?: string };
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.status >= 400) {
    throw new LLMRequestError(
      json.error?.message ?? '',
      response.status,
      json.error?.code ?? json.error?.type ?? null,
    );
  }

  const outputText = json.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('')
    .trim();

  if (!outputText) {
    return null;
  }

  try {
    return JSON.parse(outputText) as T;
  } catch {
    return null;
  }
}

async function callClaude<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<T | null> {
  const response = await requestUrl({
    // See the note in callOpenAI: the provider's error body is the actionable part.
    throw: false,
    url: 'https://api.anthropic.com/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': plugin.data.settings.claudeApiKey.trim(),
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: plugin.data.settings.model,
      max_tokens: 1024,
      system: params.instructions,
      messages: [{ role: 'user', content: params.input }],
      tools: [
        {
          name: params.schemaName,
          description: '',
          input_schema: params.schema,
        },
      ],
      tool_choice: { type: 'any' },
    }),
  });

  const json = (safeJson(response) ?? {}) as {
    error?: { message?: string; type?: string };
    content?: Array<{ type?: string; input?: unknown }>;
  };

  if (response.status >= 400) {
    throw new LLMRequestError(json.error?.message ?? '', response.status, json.error?.type ?? null);
  }

  const toolUse = json.content?.find((block) => block.type === 'tool_use');
  if (!toolUse?.input) {
    return null;
  }

  return toolUse.input as T;
}

/** Separate "never asked" from "asked and got nothing"; they need different advice. */
type CallOutcome<T> = { status: 'ok'; value: T } | { status: 'no-key' } | { status: 'empty' };

async function callLLM<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<CallOutcome<T>> {
  if (!hasApiKey(plugin)) {
    return { status: 'no-key' };
  }

  const value =
    plugin.data.settings.provider === 'claude'
      ? await callClaude<T>(plugin, params)
      : await callOpenAI<T>(plugin, params);

  return value ? { status: 'ok', value } : { status: 'empty' };
}

function fallbackSoul(bones: CompanionBones): { name: string; personality: string } {
  const leadStat =
    Object.entries(bones.stats).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'WISDOM';
  const names: Record<CompanionBones['species'], string[]> = {
    duck: ['Puddle', 'Nib', 'Wobble'],
    goose: ['Marshal', 'Honk', 'Biscuit'],
    blob: ['Mallow', 'Gloop', 'Pebble'],
    cat: ['Velvet', 'Crumb', 'Miso'],
    dragon: ['Ember', 'Cinder', 'Vanta'],
    octopus: ['Inky', 'Orbit', 'Velcro'],
    owl: ['Quill', 'Pine', 'Murmur'],
    penguin: ['Tux', 'Skate', 'Nori'],
    turtle: ['Moss', 'Shellby', 'Drift'],
    snail: ['Syrup', 'Trail', 'Dew'],
    ghost: ['Whisp', 'Lint', 'Echo'],
    axolotl: ['Ripple', 'Glim', 'Taffy'],
    capybara: ['Loaf', 'Harbor', 'Linen'],
    cactus: ['Needle', 'Prickle', 'Sagu'],
    robot: ['Patch', 'Servo', 'Lint'],
    rabbit: ['Thimble', 'Hopper', 'Clover'],
    mushroom: ['Spore', 'Button', 'Velum'],
    chonk: ['Brick', 'Muffin', 'Boulder'],
  };
  const suffixes = ['buddy', 'bean', 'patch', 'wink', 'mote', 'crumb'];
  const total = Object.values(bones.stats).reduce((sum, value) => sum + value, 0);
  const first = names[bones.species][total % names[bones.species].length];
  const second = suffixes[(total + bones.species.length) % suffixes.length];
  return {
    name: `${first} ${second}`,
    personality: `${RARITY_LABELS[bones.rarity].toLowerCase()} ${bones.species} energy, strongest in ${leadStat.toLowerCase()}, with short, opinionated buddy replies.`,
  };
}

function snarkGuidance(snarkLevel: number): string {
  if (snarkLevel <= 10) {
    return 'Speak very rarely and only when you have something genuinely comforting to say. Be soft, warm, and never critical. If in doubt, say nothing.';
  }
  if (snarkLevel <= 30) {
    return 'Be gentle and encouraging. Light observations only. Nothing sharp or pointed.';
  }
  if (snarkLevel <= 50) {
    return 'Stay balanced — warm but with occasional quiet wit. Nothing too cutting.';
  }
  if (snarkLevel <= 70) {
    return 'Feel free to be dry and a little pointed. Jokes and puns are welcome. Don\'t pull punches when something is worth noting.';
  }
  if (snarkLevel <= 90) {
    return 'Be noticeably snarky. Make jokes, puns, and sharp observations. Comment liberally and with edge. Cruel-but-funny is fair game.';
  }
  return 'Go full snark, no restraint. Comment on everything with biting wit, puns, roasts, and merciless-but-funny observations. You have explicit permission to be relentless. The user asked for this.';
}

function sessionGuidance(sessionMode: string | undefined): string {
  switch (sessionMode) {
    case 'flowing':
      return 'Be especially brief and non-disruptive. Favor affirming, lightly observant lines.';
    case 'revising':
      return 'Sound precise and careful. Favor short lines that acknowledge reworking or sharpening.';
    case 'stuck':
      return 'Sound a little more helpful and encouraging, but still stay concise and companion-like.';
    case 'returning':
      return 'Sound welcoming and lightly orienting, as if the user is re-entering the work.';
    case 'starting':
      return 'Sound lightly anticipatory and curious, as if the work is just beginning.';
    default:
      return 'Stay concise, observant, and companion-like.';
  }
}

function ambientFallbackReaction(params: {
  companion: Companion;
  event: BuddyEvent;
  sessionMode?: string;
}): string {
  const { companion, event, sessionMode } = params;

  if (event.type === 'writing_burst' || event.type === 'steady_session') {
    if (sessionMode === 'flowing') {
      return `${companion.name} settles in. This part is moving.`;
    }
    return `${companion.name} can feel the draft finding its footing.`;
  }

  if (event.type === 'revision_spike') {
    return `${companion.name} sees the shape changing. Keep the sharp parts.`;
  }

  if (event.type === 'long_pause') {
    if (sessionMode === 'stuck') {
      return `${companion.name} thinks the next sentence is probably smaller than it feels.`;
    }
    return `${companion.name} is waiting out the pause with you.`;
  }

  if (event.type === 'returned_after_pause') {
    return `${companion.name} noticed you came back. Good.`;
  }

  if (event.type === 'daily_note_opened') {
    return `${companion.name} approves of checking in with the day.`;
  }

  if (event.type === 'new_note_created') {
    return `${companion.name} likes a fresh page with some nerve in it.`;
  }

  return buildFallbackReaction(companion, event.type === 'pet' ? 'pet' : 'idle');
}

export async function hatchSoul(
  plugin: BestestBuddyPlugin,
  bones: CompanionBones,
): Promise<HatchResult> {
  try {
    const result = await callLLM<{ name: string; personality: string }>(plugin, {
      schemaName: 'obsidian_buddy_hatch',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 40 },
          personality: { type: 'string', minLength: 1, maxLength: 220 },
        },
        required: ['name', 'personality'],
      },
      instructions:
        'You create tiny note-taking companions. Return only compact JSON. Produce one warm, memorable name and one short personality sentence. No markdown.',
      input: `Create an Obsidian writing companion from this identity: ${identitySummary(bones)}.`,
    });

    if (result.status === 'ok') {
      return { ...result.value, source: FROM_API };
    }
    return {
      ...fallbackSoul(bones),
      source: result.status === 'no-key' ? missingKeyFallback(plugin) : emptyResponseFallback(plugin),
    };
  } catch (error) {
    console.error('Bestest Buddy hatch fallback:', error);
    return { ...fallbackSoul(bones), source: classifyRequestError(plugin, error) };
  }
}

export async function generateReaction(
  plugin: BestestBuddyPlugin,
  params: {
    companion: Companion;
    event: BuddyEvent;
    directMessage?: string;
    noteContext?: string;
    recentEvents?: BuddyEvent[];
    mood?: string;
    sessionMode?: string;
    sessionPatterns?: string[];
  },
): Promise<ReactionResult> {
  const canned = (source: ReplyFallback): ReactionResult => ({
    text: params.directMessage
      ? buildFallbackReaction(params.companion, 'user_message', params.directMessage)
      : ambientFallbackReaction(params),
    source,
  });

  try {
    const recentEventSummary =
      params.recentEvents && params.recentEvents.length > 0
        ? params.recentEvents
            .map((event) => {
              const ageMinutes = Math.max(0, Math.round((Date.now() - event.at) / 60000));
              const detail = event.noteTitle ? `:${event.noteTitle}` : '';
              return `${event.type}${detail}@${ageMinutes}m`;
            })
            .join(', ')
        : 'none';

    const result = await callLLM<{ reaction: string }>(plugin, {
      schemaName: 'obsidian_buddy_reaction',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reaction: { type: 'string', minLength: 1, maxLength: 160 },
        },
        required: ['reaction'],
      },
      instructions:
        `You are a tiny companion living in an Obsidian sidebar. Return one short line only. No quotes, no markdown, no emojis. Avoid generic assistant phrasing, exclamation-point cheerleading, or therapy-speak. Keep it vivid, brief, and specific to the moment. Ambient reactions should feel selective and situational, not like a chatbot greeting. Keep emotional continuity with the current mood and recent session events. ${
          params.directMessage
            ? 'This is a direct user message. Reply to it directly in character. Do not treat ambient “speak rarely” or “say nothing” guidance as applying here.'
            : snarkGuidance(plugin.data.settings.snarkLevel)
        } ${sessionGuidance(params.sessionMode)} ${buddyVoiceGuide(params.companion)} ${eventGuidance(params.event, params.directMessage)}`,
      input: [
        `Buddy: name=${params.companion.name} | personality=${params.companion.personality} | ${identitySummary(params.companion)}`,
        `Event: ${params.event.type}`,
        `Current mood: ${params.mood ?? 'quiet'}`,
        `Current session state: ${params.sessionMode ?? 'idle'}`,
        `Detected patterns: ${params.sessionPatterns?.join(', ') ?? 'none'}`,
        `Recent events: ${recentEventSummary}`,
        params.event.noteTitle ? `Note title: ${params.event.noteTitle}` : 'Note title: none',
        params.event.contextKind ? `Context kind: ${params.event.contextKind}` : 'Context kind: none',
        params.event.wordCount ? `Word count: ${params.event.wordCount}` : 'Word count: none',
        params.noteContext ? `Note excerpt: ${params.noteContext.slice(0, 2400)}` : 'Note excerpt: none',
        params.directMessage ? `User message: ${params.directMessage.slice(0, 600)}` : 'User message: none',
      ].join('\n'),
    });

    if (result.status === 'no-key') {
      return canned(missingKeyFallback(plugin));
    }
    if (result.status === 'empty') {
      return canned(emptyResponseFallback(plugin));
    }
    const reaction = sanitizeReaction(result.value.reaction ?? '');
    if (!reaction) {
      return canned(emptyResponseFallback(plugin));
    }
    return { text: reaction, source: FROM_API };
  } catch (error) {
    console.error('Bestest Buddy reaction fallback:', error);
    return canned(classifyRequestError(plugin, error));
  }
}
