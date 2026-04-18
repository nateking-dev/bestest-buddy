import { PluginSettingTab, Setting } from 'obsidian';
import { DEFAULT_SETTINGS } from './constants';
import type BestestBuddyPlugin from './main';

export class BuddySettingTab extends PluginSettingTab {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Bestest Buddy' });

    new Setting(containerEl)
      .setName('LLM provider')
      .setDesc('Which API to use for hatch and buddy reactions.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('openai', 'OpenAI')
          .addOption('claude', 'Claude (Anthropic)')
          .setValue(this.plugin.data.settings.provider)
          .onChange(async (value) => {
            this.plugin.data.settings.provider = value as typeof this.plugin.data.settings.provider;
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName('OpenAI API key')
      .setDesc('Used when provider is set to OpenAI.')
      .addText((text) =>
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.data.settings.openAIApiKey)
          .onChange(async (value) => {
            this.plugin.data.settings.openAIApiKey = value.trim();
            await this.plugin.store.save();
          }),
      );

    new Setting(containerEl)
      .setName('Claude API key')
      .setDesc('Used when provider is set to Claude (Anthropic).')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.data.settings.claudeApiKey)
          .onChange(async (value) => {
            this.plugin.data.settings.claudeApiKey = value.trim();
            await this.plugin.store.save();
          }),
      );

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
          }),
      );

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
      .setName('Enable write actions')
      .setDesc('Reserved for explicit future note-writing actions. No autonomous writes happen in v1.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.data.settings.enableWriteActions).onChange(async (value) => {
          this.plugin.data.settings.enableWriteActions = value;
          await this.plugin.store.save();
        }),
      );
  }
}
