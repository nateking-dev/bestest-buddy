import type { Companion } from './types';

export type ReactionEvent = 'pet' | 'greet' | 'idle' | 'user_message';

function personalityCue(companion: Companion): string {
  const tone = companion.personality.toLowerCase();
  if (tone.includes('snark')) return 'wry';
  if (tone.includes('calm')) return 'calm';
  if (tone.includes('chaos')) return 'chaotic';
  if (tone.includes('gentle')) return 'gentle';
  return 'playful';
}

export function buildFallbackReaction(
  companion: Companion,
  event: ReactionEvent,
  userMessage?: string,
): string {
  const cue = personalityCue(companion);
  const prefix = companion.shiny ? 'Sparkle check:' : '';

  if (event === 'pet') {
    return `${prefix} ${companion.name} leans into the pet. Very ${cue}.`.trim();
  }

  if (event === 'greet') {
    return `${prefix} ${companion.name} reports for buddy duty.`.trim();
  }

  if (event === 'idle') {
    return `${prefix} ${companion.name} is quietly judging the air currents.`.trim();
  }

  const lowered = userMessage?.toLowerCase() ?? '';
  if (lowered.includes('hello') || lowered.includes('hi')) {
    return `${prefix} hi. ${companion.name} was already here first.`.trim();
  }
  if (lowered.includes('debug')) {
    return `${prefix} ${companion.name} votes for reading the failing branch twice.`.trim();
  }

  return `${prefix} ${companion.name} heard that and has one ${cue} eyebrow up.`.trim();
}

