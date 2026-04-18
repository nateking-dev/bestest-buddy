import {
  ItemView,
  Notice,
  TextAreaComponent,
  WorkspaceLeaf,
} from 'obsidian';
import { renderSprite } from './lib/buddy/sprites';
import { RARITY_COLORS, RARITY_LABELS, type Companion } from './lib/buddy/types';
import { VIEW_TYPE_BUDDY } from './constants';
import {
  describeMood,
  describePatterns,
  describeSession,
} from './main';
import type BestestBuddyPlugin from './main';

export class BuddyView extends ItemView {
  private draft = '';
  private shellEl: HTMLElement | null = null;
  private stageEl: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: BestestBuddyPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_BUDDY;
  }

  getDisplayText(): string {
    return 'Bestest Buddy';
  }

  getIcon(): string {
    return 'sparkles';
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('bestest-buddy-view');

    const shell = contentEl.createDiv({ cls: 'bestest-buddy-shell' });
    this.shellEl = shell;
    const companion = this.plugin.store.getCompanion();
    const minimal = this.plugin.data.settings.minimalMode;

    if (!minimal) {
      const header = shell.createDiv({ cls: 'bestest-buddy-card bestest-buddy-header' });
      header.createDiv({ cls: 'bestest-buddy-kicker', text: 'Bestest Buddy' });
      header.createDiv({ cls: 'bestest-buddy-title', text: companion ? companion.name : 'Vault companion' });
      header.createDiv({
        cls: 'bestest-buddy-subtitle',
        text: companion ? `${RARITY_LABELS[companion.rarity]} ${companion.species} for this vault.` : 'Hatch a companion for this vault.',
      });

      if (companion) {
        const facts = header.createEl('dl', { cls: 'bestest-buddy-facts' });
        this.addFact(facts, 'Rarity', RARITY_LABELS[companion.rarity]);
        this.addFact(facts, 'Species', companion.species);
        this.addFact(facts, 'Hat', companion.hat);
        this.addFact(facts, 'Shiny', companion.shiny ? 'Yes' : 'No');
        header.createDiv({ cls: 'bestest-buddy-personality', text: companion.personality });
      } else {
        header.createDiv({
          cls: 'bestest-buddy-empty',
          text: 'No buddy yet. Hatch one and it will stay tied to this vault until reset.',
        });
      }
    }

    this.renderStage(shell, companion);

    if (!minimal) {
      this.renderActions(shell, companion);
      this.renderInput(shell, companion);
    }
  }

  updateStage(): void {
    if (!(this.shellEl instanceof HTMLElement) || !(this.stageEl instanceof HTMLElement)) {
      void this.render();
      return;
    }

    const companion = this.plugin.store.getCompanion();
    this.renderStageInto(this.stageEl, companion);
  }

  private renderStage(shell: HTMLElement, companion: Companion | null): void {
    const stage = shell.createDiv();
    this.stageEl = stage;
    this.renderStageInto(stage, companion);
  }

  private renderStageInto(stage: HTMLElement, companion: Companion | null): void {
    stage.empty();
    const moodClass = this.plugin.data.moodState?.mode ? `is-${this.plugin.data.moodState.mode}` : '';
    const sessionClass = this.plugin.data.sessionState?.mode
      ? `is-session-${this.plugin.data.sessionState.mode}`
      : '';
    const patternClasses = this.plugin.getSessionPatterns().map((pattern) => `has-pattern-${this.toClassToken(pattern)}`);
    const microstateClass = `is-micro-${this.plugin.getSpriteMicrostate()}`;
    stage.className = [
      'bestest-buddy-stage',
      this.plugin.data.muted ? 'bestest-buddy-muted' : '',
      moodClass,
      sessionClass,
      microstateClass,
      ...patternClasses,
    ]
      .filter(Boolean)
      .join(' ');

    const speechArea = stage.createDiv({ cls: 'bestest-buddy-speechArea' });
    if (this.plugin.currentBubble) {
      speechArea.createDiv({
        cls: `bestest-buddy-bubble ${this.plugin.isBubbleFading() ? 'is-fading' : ''}`,
        text: this.plugin.getDisplayedBubble() ?? '',
      });
    }

    if (!companion) {
      return;
    }

    const hearts = this.plugin.getPetHearts();
    if (hearts) {
      stage.createDiv({ cls: 'bestest-buddy-hearts', text: hearts });
    }

    const spriteEl = stage.createEl('pre', { cls: 'bestest-buddy-sprite' });
    spriteEl.style.color = RARITY_COLORS[companion.rarity];
    const spriteLines = renderSprite(companion, this.plugin.currentSpriteFrame);
    spriteEl.setText(
      this.plugin.currentSpriteBlink
        ? spriteLines.map((line) => line.replaceAll(companion.eye, '-')).join('\n')
        : spriteLines.join('\n'),
    );

    const nameplate = stage.createDiv({ cls: 'bestest-buddy-nameplate' });
    nameplate.createDiv({ cls: 'bestest-buddy-name', text: companion.name });
    nameplate.createDiv({
      cls: 'bestest-buddy-meta',
      text: `${RARITY_LABELS[companion.rarity]} ${companion.species}`,
    });
  }

  private renderActions(shell: HTMLElement, companion: Companion | null): void {
    const actions = shell.createDiv({ cls: 'bestest-buddy-actions' });
    const statusBlock = actions.createDiv({
      cls: [
        'bestest-buddy-statusBlock',
        this.plugin.data.moodState?.mode ? `is-${this.plugin.data.moodState.mode}` : '',
        this.plugin.data.sessionState?.mode ? `is-session-${this.plugin.data.sessionState.mode}` : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    statusBlock.createDiv({
      cls: 'bestest-buddy-statusLabel',
      text: this.plugin.data.muted ? 'Muted' : `Mood: ${describeMood(this.plugin.data.moodState?.mode)}`,
    });
    statusBlock.createDiv({
      cls: 'bestest-buddy-statusMain',
      text: `Session: ${describeSession(this.plugin.data.sessionState?.mode)}`,
    });

    const patternHint = describePatterns(this.plugin.getSessionPatterns());
    if (patternHint) {
      statusBlock.createDiv({
        cls: 'bestest-buddy-statusHint',
        text: patternHint,
      });
    }

    const row = actions.createDiv({ cls: 'bestest-buddy-buttonRow' });

    const hatchOrPet = row.createEl('button', {
      cls: `bestest-buddy-button -primary`,
      text: companion ? 'Pet' : 'Hatch',
    });
    hatchOrPet.disabled = this.plugin.busy;
    hatchOrPet.onclick = async () => {
      if (companion) {
        await this.plugin.petBuddy();
      } else {
        await this.plugin.ensureHatched();
      }
    };

    const mute = row.createEl('button', {
      cls: 'bestest-buddy-button',
      text: this.plugin.data.muted ? 'Unmute' : 'Mute',
    });
    mute.onclick = async () => {
      await this.plugin.store.setMuted(!this.plugin.data.muted);
      this.plugin.refreshViews();
    };

    const ask = row.createEl('button', {
      cls: 'bestest-buddy-button',
      text: 'Ask About Note',
    });
    ask.disabled = !companion || this.plugin.busy;
    ask.onclick = async () => {
      await this.plugin.askAboutCurrentNote();
    };

    const reset = row.createEl('button', {
      cls: 'bestest-buddy-button',
      text: 'Reset',
    });
    reset.onclick = async () => {
      await this.plugin.store.resetCompanion();
      this.plugin.currentBubble = null;
      this.plugin.refreshViews();
    };
  }

  private renderInput(shell: HTMLElement, companion: Companion | null): void {
    const wrapper = shell.createDiv({
      cls: [
        'bestest-buddy-input',
        this.plugin.busy ? 'is-busy' : '',
        !companion ? 'is-disabled' : '',
      ]
        .filter(Boolean)
        .join(' '),
    });
    const contextStatus =
      this.plugin.busy
        ? 'Buddy is thinking with the current note context.'
        : this.plugin.data.settings.includeCurrentNoteInDirectReplies
          ? 'Direct chat uses current note context when enabled.'
          : 'Direct chat is currently note-agnostic.';

    wrapper.createDiv({
      cls: 'bestest-buddy-inputLabel',
      text: this.plugin.busy ? 'Buddy is thinking' : 'Direct chat',
    });

    const input = new TextAreaComponent(wrapper);
    input.inputEl.placeholder = companion
      ? `Say hi to ${companion.name}...`
      : 'Hatch buddy first...';
    input.setValue(this.draft);
    input.onChange((value) => {
      this.draft = value;
    });
    input.inputEl.disabled = !companion || this.plugin.busy;
    input.inputEl.maxLength = 1200;

    const footer = wrapper.createDiv({ cls: 'bestest-buddy-inputFooter' });
    const footerText = footer.createDiv({ cls: 'bestest-buddy-inputMeta' });
    if (this.plugin.lastError) {
      footerText.createDiv({ cls: 'bestest-buddy-error', text: this.plugin.lastError });
    } else {
      footerText.createDiv({ cls: 'bestest-buddy-status', text: contextStatus });
    }
    if (companion) {
      footerText.createDiv({
        cls: 'bestest-buddy-status bestest-buddy-statusSecondary',
        text: 'Long replies stay compact so the panel does not crowd the stage.',
      });
    }

    const send = footer.createEl('button', {
      cls: `bestest-buddy-button -primary ${this.plugin.busy ? 'is-thinking' : ''}`,
      text: this.plugin.busy ? 'Thinking' : 'Send',
    });
    send.disabled = !companion || this.plugin.busy;
    send.onclick = async () => {
      if (!this.draft.trim()) {
        new Notice('Say something to buddy first.');
        return;
      }
      const message = this.draft.trim();
      this.draft = '';
      await this.plugin.sendDirectMessage(message);
    };
  }

  private addFact(facts: HTMLElement, label: string, value: string): void {
    const wrapper = facts.createDiv();
    wrapper.createEl('dt', { text: label });
    wrapper.createEl('dd', { text: value });
  }

  private toClassToken(value: string): string {
    return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  }
}
