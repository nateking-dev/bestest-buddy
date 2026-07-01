import { PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS } from './constants';
import type BestestBuddyPlugin from './main';
import type { LLMProvider } from './types';

// Flag an obvious provider/model mismatch (e.g. a Claude model under the OpenAI provider).
function modelProviderMismatch(provider: LLMProvider, model: string): string | null {
  const m = model.toLowerCase();
  if (provider === 'openai' && m.includes('claude')) {
    return 'This looks like a Claude model, but the provider is set to OpenAI.';
  }
  if (provider === 'claude' && m.includes('gpt')) {
    return 'This looks like an OpenAI model, but the provider is set to Claude.';
  }
  return null;
}

export class BuddySettingTab extends PluginSettingTab {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Bestest Buddy').setHeading();

    new Setting(containerEl)
      .setName('LLM provider')
      .setDesc('Which API to use for hatch and buddy reactions.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('openai', 'OpenAI')
          .addOption('claude', 'Claude (Anthropic)')
          .setValue(this.plugin.data.settings.provider)
          .onChange(async (value) => {
            this.plugin.data.settings.provider = value as LLMProvider;
            await this.plugin.store.save();
            refreshModelWarning();
          }),
      );

    new Setting(containerEl)
      .setName('OpenAI API key')
      .setDesc('Used when provider is set to OpenAI. Stored unencrypted in this vault’s plugin data.')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.data.settings.openAIApiKey)
          .onChange(async (value) => {
            this.plugin.data.settings.openAIApiKey = value.trim();
            await this.plugin.store.save();
          });
      });

    new Setting(containerEl)
      .setName('Claude API key')
      .setDesc('Used when provider is set to Claude (Anthropic). Stored unencrypted in this vault’s plugin data.')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.data.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.data.settings.claudeApiKey = value.trim();
            await this.plugin.store.save();
          });
      });

    new Setting(containerEl)
      .setName('Model')
      .setDesc('Model name for the selected provider (e.g. gpt-4.1-mini or claude-haiku-4-5-20251001).')
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
      const message = modelProviderMismatch(
        this.plugin.data.settings.provider,
        this.plugin.data.settings.model,
      );
      modelWarning.setText(message ?? '');
      modelWarning.toggleClass('is-hidden', message === null);
    };
    refreshModelWarning();

    new Setting(containerEl)
      .setName('Ambient reactions')
      .setDesc('Allow buddy to occasionally react to note activity.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.data.settings.ambientEnabled).onChange(async (value) => {
          this.plugin.data.settings.ambientEnabled = value;
          await this.plugin.store.save();
        }),
      );

    new Setting(containerEl)
      .setName('Reaction frequency')
      .setDesc('How talkative buddy should be when ambient reactions are enabled.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('quiet', 'Quiet')
          .addOption('normal', 'Normal')
          .addOption('chatty', 'Chatty')
          .setValue(this.plugin.data.settings.frequency)
          .onChange(async (value) => {
            this.plugin.data.settings.frequency = value as typeof this.plugin.data.settings.frequency;
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName('Writing burst threshold')
      .setDesc('How many new words trigger a writing burst reaction. Minimum 10.')
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.burstThreshold))
          .setValue(String(this.plugin.data.settings.burstThreshold))
          .onChange(async (value) => {
            const parsed = parseInt(value, 10);
            this.plugin.data.settings.burstThreshold = isNaN(parsed)
              ? DEFAULT_SETTINGS.burstThreshold
              : Math.max(10, parsed);
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName('Include current note context')
      .setDesc('Pass the current note title and excerpt to direct buddy replies.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.data.settings.includeCurrentNoteInDirectReplies)
          .onChange(async (value) => {
            this.plugin.data.settings.includeCurrentNoteInDirectReplies = value;
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName('Minimal mode')
      .setDesc('Show only the sprite in the sidebar panel.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.data.settings.minimalMode).onChange(async (value) => {
          this.plugin.data.settings.minimalMode = value;
          await this.plugin.store.save();
          this.plugin.refreshViews();
        }),
      );

    new Setting(containerEl)
      .setName('Snark level')
      .setDesc('Controls how often and how sharply buddy comments. 0 = rare and gentle, 100 = constant and merciless.')
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
      text: 'Warning: snark level above 90 may use significantly more tokens.',
    });
    snarkWarning.toggleClass('is-hidden', this.plugin.data.settings.snarkLevel <= 90);
  }
}
