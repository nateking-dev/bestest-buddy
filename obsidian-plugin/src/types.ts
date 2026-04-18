import type { Eye, Hat, Species, StatName, StoredCompanion } from './lib/buddy/types';

export type BuddyFrequency = 'quiet' | 'normal' | 'chatty';
export type BuddyMood = 'quiet' | 'curious' | 'pleased' | 'concerned' | 'sleepy';
export type BuddySessionMode =
  | 'idle'
  | 'starting'
  | 'flowing'
  | 'revising'
  | 'stuck'
  | 'returning';
export type BuddyEventType =
  | 'session_started'
  | 'note_opened'
  | 'new_note_created'
  | 'writing_burst'
  | 'steady_session'
  | 'revision_spike'
  | 'long_pause'
  | 'returned_after_pause'
  | 'daily_note_opened'
  | 'direct_question'
  | 'pet'
  | 'manual_note_help_request';

export type BuddyEvent = {
  type: BuddyEventType;
  at: number;
  notePath?: string;
  noteTitle?: string;
  excerpt?: string;
  contextKind?: 'selection' | 'note_excerpt' | 'full_note';
  wordCount?: number;
  message?: string;
};

export type LLMProvider = 'openai' | 'claude';

export type BuddyPluginSettings = {
  provider: LLMProvider;
  openAIApiKey: string;
  claudeApiKey: string;
  model: string;
  ambientEnabled: boolean;
  frequency: BuddyFrequency;
  burstThreshold: number;
  includeCurrentNoteInDirectReplies: boolean;
  enableWriteActions: boolean;
  minimalMode: boolean;
  snarkLevel: number;
};

export type CompanionOverrides = {
  species?: Species;
  eye?: Eye;
  hat?: Hat;
  shiny?: boolean;
  stats?: Partial<Record<StatName, number>>;
};

export type BuddyPluginData = {
  vaultSeed?: string;
  storedCompanion?: StoredCompanion;
  companionOverrides?: CompanionOverrides;
  muted: boolean;
  lastReactionAt?: number;
  recentEvents: BuddyEvent[];
  moodState?: {
    mode: BuddyMood;
    updatedAt: number;
  };
  sessionState?: {
    mode: BuddySessionMode;
    updatedAt: number;
    notePath?: string;
  };
  settings: BuddyPluginSettings;
};
