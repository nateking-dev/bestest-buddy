import { PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import { DEFAULT_SETTINGS } from './constants';
import type BestestBuddyPlugin from './main';
import type { BuddyPluginSettings, LLMProvider } from './types';

type SettingKey = keyof BuddyPluginSettings;
type ApiKeyField = 'openAIApiKey' | 'claudeApiKey';
type ModelMismatch = 'claude-model-on-openai' | 'openai-model-on-claude';

// Flag an obvious provider/model mismatch (e.g. a Claude model under the OpenAI provider).
function modelProviderMismatch(provider: LLMProvider, model: string): ModelMismatch | null {
  const m = model.toLowerCase();
  if (provider === 'openai' && m.includes('claude')) {
    return 'claude-model-on-openai';
  }
  if (provider === 'claude' && m.includes('gpt')) {
    return 'openai-model-on-claude';
  }
  return null;
}

const MISMATCH_MESSAGES: Record<ModelMismatch, string> = {
  'claude-model-on-openai': 'This looks like a Claude model, but the provider is set to OpenAI.',
  'openai-model-on-claude': 'This looks like an OpenAI model, but the provider is set to Claude.',
};

const SNARK_WARNING = 'Warning: snark level above 90 may use significantly more tokens.';

/**
 * One source of wording for both rendering paths. The declarative definitions
 * and the imperative fallback must describe the same settings, so the copy is
 * shared rather than written twice.
 */
const COPY = {
  provider: {
    name: 'LLM provider',
    desc: 'Which API to use for hatch and buddy reactions.',
  },
  openAIApiKey: {
    name: 'OpenAI API key',
    desc: 'Used when provider is set to OpenAI. Stored unencrypted in this vault’s plugin data.',
  },
  claudeApiKey: {
    name: 'Claude API key',
    desc: 'Used when provider is set to Claude (Anthropic). Stored unencrypted in this vault’s plugin data.',
  },
  model: {
    name: 'Model',
    desc: 'Model name for the selected provider (e.g. gpt-4.1-mini or claude-haiku-4-5-20251001).',
  },
  ambientEnabled: {
    name: 'Ambient reactions',
    desc: 'Allow buddy to occasionally react to note activity.',
  },
  frequency: {
    name: 'Reaction frequency',
    desc: 'How talkative buddy should be when ambient reactions are enabled.',
  },
  burstThreshold: {
    name: 'Writing burst threshold',
    desc: 'How many new words trigger a writing burst reaction. Minimum 10.',
  },
  includeCurrentNoteInDirectReplies: {
    name: 'Include current note context',
    desc: 'Share the current note title and a short excerpt with the LLM provider for direct replies and ambient reactions. Note content is never stored in plugin data.',
  },
  minimalMode: {
    name: 'Minimal mode',
    desc: 'Show only the sprite in the sidebar panel.',
  },
  snarkLevel: {
    name: 'Snark level',
    desc: 'Controls how often and how sharply buddy comments. 0 = rare and gentle, 100 = constant and merciless.',
  },
} as const satisfies Record<SettingKey, { name: string; desc: string }>;

const PROVIDER_OPTIONS: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Claude (Anthropic)',
};

const FREQUENCY_OPTIONS: Record<string, string> = {
  quiet: 'Quiet',
  normal: 'Normal',
  chatty: 'Chatty',
};

export class BuddySettingTab extends PluginSettingTab {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app, plugin);
  }

  /**
   * Declarative settings, used from Obsidian 1.13.0. They also feed the
   * settings search index, which the imperative display() below cannot do.
   * display() stays as the fallback because minAppVersion is still 1.7.2.
   */
  getSettingDefinitions(): SettingDefinitionItem<SettingKey>[] {
    return [
      {
        ...COPY.provider,
        control: { type: 'dropdown', key: 'provider', options: PROVIDER_OPTIONS },
      },
      {
        ...COPY.openAIApiKey,
        render: (setting) => this.addApiKeyInput(setting, 'openAIApiKey', 'sk-...'),
      },
      {
        ...COPY.claudeApiKey,
        render: (setting) => this.addApiKeyInput(setting, 'claudeApiKey', 'sk-ant-...'),
      },
      {
        ...COPY.model,
        control: { type: 'text', key: 'model', placeholder: DEFAULT_SETTINGS.model },
      },
      // One row per direction, so refreshDomState() alone keeps the wording
      // honest as the provider and model change.
      ...this.warningRows(),
      {
        ...COPY.ambientEnabled,
        control: { type: 'toggle', key: 'ambientEnabled' },
      },
      {
        ...COPY.frequency,
        control: { type: 'dropdown', key: 'frequency', options: FREQUENCY_OPTIONS },
      },
      {
        ...COPY.burstThreshold,
        control: {
          type: 'number',
          key: 'burstThreshold',
          min: 10,
          step: 1,
          placeholder: String(DEFAULT_SETTINGS.burstThreshold),
          validate: (value) => (value < 10 ? 'Minimum is 10 words.' : undefined),
        },
      },
      {
        ...COPY.includeCurrentNoteInDirectReplies,
        control: { type: 'toggle', key: 'includeCurrentNoteInDirectReplies' },
      },
      {
        ...COPY.minimalMode,
        control: { type: 'toggle', key: 'minimalMode' },
      },
      {
        ...COPY.snarkLevel,
        control: { type: 'slider', key: 'snarkLevel', min: 0, max: 100, step: 1 },
      },
    ];
  }

  /** Settings live on the plugin's own data object, not the conventional one. */
  getControlValue(key: string): unknown {
    return (this.plugin.data.settings as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.data.settings;

    switch (key as SettingKey) {
      case 'provider':
        settings.provider = value as LLMProvider;
        break;
      case 'model':
        settings.model = String(value).trim() || DEFAULT_SETTINGS.model;
        break;
      case 'burstThreshold':
        settings.burstThreshold = normalizeBurstThreshold(value);
        break;
      case 'frequency':
        settings.frequency = value as BuddyPluginSettings['frequency'];
        break;
      case 'snarkLevel':
        settings.snarkLevel = Number(value);
        break;
      case 'ambientEnabled':
      case 'includeCurrentNoteInDirectReplies':
      case 'minimalMode':
        settings[key as 'minimalMode'] = Boolean(value);
        break;
      default:
        return;
    }

    await this.plugin.store.save();

    if (key === 'minimalMode') {
      this.plugin.refreshViews();
    }
    // Cheap: re-evaluates the warning rows' visible predicates in place.
    this.refreshDomState();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(COPY.provider.name)
      .setDesc(COPY.provider.desc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(PROVIDER_OPTIONS)
          .setValue(this.plugin.data.settings.provider)
          .onChange(async (value) => {
            this.plugin.data.settings.provider = value as LLMProvider;
            await this.plugin.store.save();
            refreshModelWarning();
          }),
      );

    new Setting(containerEl)
      .setName(COPY.openAIApiKey.name)
      .setDesc(COPY.openAIApiKey.desc)
      .then((setting) => this.addApiKeyInput(setting, 'openAIApiKey', 'sk-...'));

    new Setting(containerEl)
      .setName(COPY.claudeApiKey.name)
      .setDesc(COPY.claudeApiKey.desc)
      .then((setting) => this.addApiKeyInput(setting, 'claudeApiKey', 'sk-ant-...'));

    new Setting(containerEl)
      .setName(COPY.model.name)
      .setDesc(COPY.model.desc)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.model)
          .setValue(this.plugin.data.settings.model)
          .onChange(async (value) => {
            this.plugin.data.settings.model = value.trim() || DEFAULT_SETTINGS.model;
            await this.plugin.store.save();
            refreshModelWarning();
          }),
      );

    const modelWarning = containerEl.createEl('p', {
      cls: 'bestest-buddy-settings-warning is-hidden',
    });
    const refreshModelWarning = (): void => {
      const mismatch = this.currentMismatch();
      modelWarning.setText(mismatch ? MISMATCH_MESSAGES[mismatch] : '');
      modelWarning.toggleClass('is-hidden', mismatch === null);
    };
    refreshModelWarning();

    new Setting(containerEl)
      .setName(COPY.ambientEnabled.name)
      .setDesc(COPY.ambientEnabled.desc)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.data.settings.ambientEnabled).onChange(async (value) => {
          this.plugin.data.settings.ambientEnabled = value;
          await this.plugin.store.save();
        }),
      );

    new Setting(containerEl)
      .setName(COPY.frequency.name)
      .setDesc(COPY.frequency.desc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(FREQUENCY_OPTIONS)
          .setValue(this.plugin.data.settings.frequency)
          .onChange(async (value) => {
            this.plugin.data.settings.frequency = value as BuddyPluginSettings['frequency'];
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName(COPY.burstThreshold.name)
      .setDesc(COPY.burstThreshold.desc)
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.burstThreshold))
          .setValue(String(this.plugin.data.settings.burstThreshold))
          .onChange(async (value) => {
            this.plugin.data.settings.burstThreshold = normalizeBurstThreshold(value);
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName(COPY.includeCurrentNoteInDirectReplies.name)
      .setDesc(COPY.includeCurrentNoteInDirectReplies.desc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.data.settings.includeCurrentNoteInDirectReplies)
          .onChange(async (value) => {
            this.plugin.data.settings.includeCurrentNoteInDirectReplies = value;
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName(COPY.minimalMode.name)
      .setDesc(COPY.minimalMode.desc)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.data.settings.minimalMode).onChange(async (value) => {
          this.plugin.data.settings.minimalMode = value;
          await this.plugin.store.save();
          this.plugin.refreshViews();
        }),
      );

    new Setting(containerEl)
      .setName(COPY.snarkLevel.name)
      .setDesc(COPY.snarkLevel.desc)
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 1)
          .setValue(this.plugin.data.settings.snarkLevel)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.data.settings.snarkLevel = value;
            snarkWarning.toggleClass('is-hidden', value <= 90);
            await this.plugin.store.save();
          }),
      );

    const snarkWarning = containerEl.createEl('p', {
      cls: 'bestest-buddy-settings-warning',
      text: SNARK_WARNING,
    });
    snarkWarning.toggleClass('is-hidden', this.plugin.data.settings.snarkLevel <= 90);
  }

  private warningRows(): SettingDefinitionItem<SettingKey>[] {
    const rows: SettingDefinitionItem<SettingKey>[] = (
      Object.keys(MISMATCH_MESSAGES) as ModelMismatch[]
    ).map((mismatch) => ({
      name: 'Model may not match provider',
      desc: MISMATCH_MESSAGES[mismatch],
      searchable: false,
      visible: () => this.currentMismatch() === mismatch,
    }));

    rows.push({
      name: 'High snark level',
      desc: SNARK_WARNING,
      searchable: false,
      visible: () => this.plugin.data.settings.snarkLevel > 90,
    });

    return rows;
  }

  private currentMismatch(): ModelMismatch | null {
    return modelProviderMismatch(
      this.plugin.data.settings.provider,
      this.plugin.data.settings.model,
    );
  }

  private addApiKeyInput(setting: Setting, key: ApiKeyField, placeholder: string): void {
    setting.addText((text) => {
      text.inputEl.type = 'password';
      text
        .setPlaceholder(placeholder)
        .setValue(this.plugin.data.settings[key])
        .onChange(async (value) => {
          this.plugin.data.settings[key] = value.trim();
          await this.plugin.store.save();
        });
    });
  }
}

function normalizeBurstThreshold(value: unknown): number {
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(parsed) ? Math.max(10, Math.round(parsed)) : DEFAULT_SETTINGS.burstThreshold;
}
