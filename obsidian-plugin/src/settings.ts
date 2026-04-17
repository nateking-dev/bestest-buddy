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
      .setName('OpenAI API key')
      .setDesc('Stored in plugin settings for direct and ambient buddy reactions.')
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
      .setName('Model')
      .setDesc('Responses API model used for hatch and direct replies.')
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
