import type { BuddyPluginSettings } from './types';

export const VIEW_TYPE_BUDDY = 'bestest-buddy-view';
export const MAX_RECENT_EVENTS = 20;

export const DEFAULT_SETTINGS: BuddyPluginSettings = {
  provider: 'openai',
  openAIApiKey: '',
  claudeApiKey: '',
  model: 'gpt-4.1-mini',
  ambientEnabled: true,
  frequency: 'normal',
  burstThreshold: 50,
  includeCurrentNoteInDirectReplies: true,
  enableWriteActions: false,
  minimalMode: false,
};
