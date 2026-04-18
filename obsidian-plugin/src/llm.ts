import { requestUrl } from 'obsidian';
import { buildFallbackReaction } from './lib/buddy/reactions';
import { RARITY_LABELS, STAT_NAMES, type Companion, type CompanionBones } from './lib/buddy/types';
import type BestestBuddyPlugin from './main';
import type { BuddyEvent, BuddySessionMode } from './types';

function compactStats(stats: Companion['stats'] | CompanionBones['stats']): string {
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
  if (strongest.includes('DEBUGGING')) {
    styleBits.push('Notice patterns, friction, and what the draft is doing.');
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

async function callOpenAI<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<T> {
  const response = await requestUrl({
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

  const json = response.json as {
    error?: { message?: string };
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (response.status >= 400) {
    throw new Error(json.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  const outputText = json.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('')
    .trim();

  if (!outputText) {
    throw new Error('OpenAI response did not include output text.');
  }

  return JSON.parse(outputText) as T;
}

async function callClaude<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<T> {
  const response = await requestUrl({
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

  const json = response.json as {
    error?: { message?: string };
    content?: Array<{ type?: string; input?: unknown }>;
  };

  if (response.status >= 400) {
    throw new Error(json.error?.message ?? `Claude request failed with status ${response.status}`);
  }

  const toolUse = json.content?.find((block) => block.type === 'tool_use');
  if (!toolUse?.input) {
    throw new Error('Claude response did not include tool use output.');
  }

  return toolUse.input as T;
}

async function callLLM<T extends Record<string, unknown>>(
  plugin: BestestBuddyPlugin,
  params: {
    schemaName: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: string;
  },
): Promise<T | null> {
  const { provider, openAIApiKey, claudeApiKey } = plugin.data.settings;

  if (provider === 'claude') {
    if (!claudeApiKey.trim()) return null;
    return callClaude<T>(plugin, params);
  }

  if (!openAIApiKey.trim()) return null;
  return callOpenAI<T>(plugin, params);
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
  const first = names[bones.species][total % names[bones.species].length]!;
  const second = suffixes[(total + bones.species.length) % suffixes.length]!;
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
): Promise<{ name: string; personality: string }> {
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

    if (!result) {
      return fallbackSoul(bones);
    }
    return result;
  } catch (error) {
    console.error('Bestest Buddy hatch fallback:', error);
    return fallbackSoul(bones);
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
): Promise<string> {
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
        `You are a tiny companion living in an Obsidian sidebar. Return one short line only. No quotes, no markdown, no emojis. Avoid generic assistant phrasing, exclamation-point cheerleading, or therapy-speak. Keep it vivid, brief, and specific to the moment. Ambient reactions should feel selective and situational, not like a chatbot greeting. Keep emotional continuity with the current mood and recent session events. ${snarkGuidance(plugin.data.settings.snarkLevel)} ${sessionGuidance(params.sessionMode)} ${buddyVoiceGuide(params.companion)} ${eventGuidance(params.event, params.directMessage)}`,
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

    if (!result?.reaction) {
      return params.directMessage
        ? buildFallbackReaction(params.companion, 'user_message', params.directMessage)
        : ambientFallbackReaction(params);
    }
    const reaction = sanitizeReaction(result.reaction);
    if (!reaction) {
      return params.directMessage
        ? buildFallbackReaction(params.companion, 'user_message', params.directMessage)
        : ambientFallbackReaction(params);
    }
    return reaction;
  } catch (error) {
    console.error('Bestest Buddy reaction fallback:', error);
    return params.directMessage
      ? buildFallbackReaction(params.companion, 'user_message', params.directMessage)
      : ambientFallbackReaction(params);
  }
}
