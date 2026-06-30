import type { BuddyPluginSettings } from './types';

export const VIEW_TYPE_BUDDY = 'bestest-buddy-view';
export const MAX_RECENT_EVENTS = 20;

// Current persisted-data schema version. Bump when the BuddyPluginData shape
// changes in a way that needs migrating in BuddyStore.load().
export const CURRENT_DATA_VERSION = 1;

export const DEFAULT_SETTINGS: BuddyPluginSettings = {
  provider: 'openai',
  openAIApiKey: '',
  claudeApiKey: '',
  model: 'gpt-4.1-mini',
  ambientEnabled: true,
  frequency: 'normal',
  burstThreshold: 50,
  includeCurrentNoteInDirectReplies: true,
  minimalMode: false,
  snarkLevel: 50,
};
