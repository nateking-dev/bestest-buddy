import { FuzzySuggestModal, Modal, Notice, Setting } from 'obsidian';
import {
  EYES,
  HATS,
  RARITIES,
  SPECIES,
  SPRITE_COLORS,
  STAT_NAMES,
  type Eye,
  type Hat,
  type Rarity,
  type Species,
  type StatName,
} from './lib/buddy/types';
import type BestestBuddyPlugin from './main';

export class SpeciesPickerModal extends FuzzySuggestModal<Species> {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
    this.setPlaceholder('Pick a species...');
  }

  getItems(): Species[] {
    return [...SPECIES];
  }

  getItemText(item: Species): string {
    return item;
  }

  async onChooseItem(item: Species): Promise<void> {
    await this.plugin.store.setOverride('species', item);
    this.plugin.refreshViews();
    new Notice(`Species: ${item}`);
  }
}

export class EyePickerModal extends FuzzySuggestModal<Eye> {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
    this.setPlaceholder('Pick an eye style...');
  }

  getItems(): Eye[] {
    return [...EYES];
  }

  getItemText(item: Eye): string {
    return item;
  }

  async onChooseItem(item: Eye): Promise<void> {
    await this.plugin.store.setOverride('eye', item);
    this.plugin.refreshViews();
    new Notice(`Eye style: ${item}`);
  }
}

export class HatPickerModal extends FuzzySuggestModal<Hat> {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
    this.setPlaceholder('Pick a hat...');
  }

  getItems(): Hat[] {
    return [...HATS];
  }

  getItemText(item: Hat): string {
    return item;
  }

  async onChooseItem(item: Hat): Promise<void> {
    await this.plugin.store.setOverride('hat', item);
    this.plugin.refreshViews();
    new Notice(`Hat: ${item}`);
  }
}

export class RarityPickerModal extends FuzzySuggestModal<Rarity> {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
    this.setPlaceholder('Pick a rarity...');
  }

  getItems(): Rarity[] {
    return [...RARITIES];
  }

  getItemText(item: Rarity): string {
    return item;
  }

  async onChooseItem(item: Rarity): Promise<void> {
    await this.plugin.store.setOverride('rarity', item);
    this.plugin.refreshViews();
    new Notice(`Rarity: ${item}`);
  }
}

export class ColorPickerModal extends Modal {
  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Choose sprite color' });

    const grid = contentEl.createDiv({ cls: 'bestest-buddy-color-grid' });
    for (const { label, value } of SPRITE_COLORS) {
      const btn = grid.createEl('button', { text: label });
      btn.style.borderLeft = `4px solid ${value}`;
      btn.addEventListener('click', async () => {
        await this.plugin.store.setColorOverride(value);
        this.plugin.refreshViews();
        new Notice(`Color: ${label}`);
        this.close();
      });
    }

    let hexInput = '';
    new Setting(contentEl)
      .setName('Custom hex code')
      .setDesc('e.g. #FF5733')
      .addText((text) => {
        text.setPlaceholder('#rrggbb').onChange((v) => { hexInput = v; });
      })
      .addButton((btn) =>
        btn.setButtonText('Apply').setCta().onClick(async () => {
          const hex = hexInput.trim();
          if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
            new Notice('Invalid hex code. Use format #rrggbb');
            return;
          }
          await this.plugin.store.setColorOverride(hex);
          this.plugin.refreshViews();
          new Notice(`Color: ${hex}`);
          this.close();
        }),
      );

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText('Reset to rarity color').onClick(async () => {
        await this.plugin.store.clearColorOverride();
        this.plugin.refreshViews();
        new Notice('Color reset to rarity color.');
        this.close();
      }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class StatsModal extends Modal {
  private pending: Partial<Record<StatName, number>> = {};

  constructor(private readonly plugin: BestestBuddyPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Customize stats' });

    const companion = this.plugin.store.getCompanion();
    const existingOverrides = this.plugin.data.companionOverrides?.stats ?? {};

    for (const stat of STAT_NAMES) {
      const current = existingOverrides[stat] ?? companion?.stats[stat] ?? 50;
      this.pending[stat] = current;

      const label = stat.charAt(0) + stat.slice(1).toLowerCase();
      new Setting(contentEl)
        .setName(label)
        .addSlider((slider) =>
          slider
            .setLimits(1, 100, 1)
            .setValue(current)
            .setDynamicTooltip()
            .onChange((value) => {
              this.pending[stat] = value;
            }),
        );
    }

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Save')
          .setCta()
          .onClick(async () => {
            await this.plugin.store.setStatOverrides(this.pending as Record<StatName, number>);
            this.plugin.refreshViews();
            new Notice('Stats updated.');
            this.close();
          }),
      )
      .addButton((btn) =>
        btn.setButtonText('Reset to generated').onClick(async () => {
          await this.plugin.store.clearStatOverrides();
          this.plugin.refreshViews();
          new Notice('Stats reset to generated values.');
          this.close();
        }),
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
