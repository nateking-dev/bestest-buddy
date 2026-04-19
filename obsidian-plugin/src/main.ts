import {
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from 'obsidian';
import { hatchSoul, generateReaction } from './llm';
import { VIEW_TYPE_BUDDY } from './constants';
import { BuddyEventController } from './events';
import { BuddySettingTab } from './settings';
import { BuddyStore } from './store';
import { spriteFrameCount } from './lib/buddy/sprites';
import type { BuddyEvent, BuddyPluginData, BuddyMood, BuddySessionMode } from './types';
import { BuddyView } from './view';

const SPRITE_TICK_MS = 440;
const BUBBLE_SHOW_MS = 10_000;
const BUBBLE_REVEAL_MS = 850;
const BUBBLE_HOLD_MS = 4_200;
const BUBBLE_FADE_MS = 3_600;
const PET_BURST_MS = 2_800;
const IDLE_SEQUENCE = [0, 0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 2, 0, 0, 0, 0] as const;
const PET_HEARTS = [
  '   <3    <3   ',
  '  <3  <3   <3  ',
  ' <3   <3  <3   ',
  '<3  <3      <3 ',
  '.    .   .  ',
] as const;
const QUIET_IDLE_SETTLE_MS = 90_000;
const CHATTY_TICK_INTERVAL_MS = 20_000;
const CHATTY_TICK_COOLDOWN_MS = 30_000;

function currentMoodMode(plugin: BestestBuddyPlugin): BuddyMood {
  const mood = plugin.data.moodState;
  if (!mood) {
    return 'quiet';
  }
  if (Date.now() - mood.updatedAt > 20 * 60_000) {
    return 'quiet';
  }
  return mood.mode;
}

function currentSessionMode(plugin: BestestBuddyPlugin): BuddySessionMode {
  const session = plugin.data.sessionState;
  if (!session) {
    return 'idle';
  }
  if (Date.now() - session.updatedAt > 25 * 60_000) {
    return 'idle';
  }
  return session.mode;
}

function nextMoodForEvent(event: BuddyEvent, currentMood: BuddyMood): BuddyMood {
  const transitions: Partial<Record<BuddyEvent['type'], BuddyMood>> = {
    pet: 'pleased',
    writing_burst: currentMood === 'concerned' ? 'curious' : 'pleased',
    steady_session: 'pleased',
    revision_spike: 'concerned',
    long_pause: currentMood === 'pleased' ? 'quiet' : 'concerned',
    returned_after_pause: 'curious',
    daily_note_opened: 'quiet',
    new_note_created: 'curious',
    direct_question: 'curious',
  };
  return transitions[event.type] ?? currentMood;
}

function nextSessionForEvent(
  event: BuddyEvent,
  currentSession: BuddySessionMode,
): BuddySessionMode {
  const transitions: Partial<Record<BuddyEvent['type'], BuddySessionMode>> = {
    session_started: 'starting',
    note_opened: 'starting',
    new_note_created: 'starting',
    writing_burst: 'flowing',
    steady_session: 'flowing',
    revision_spike: 'revising',
    long_pause: 'stuck',
    returned_after_pause: 'returning',
    daily_note_opened: 'starting',
    direct_question: currentSession === 'idle' ? 'starting' : currentSession,
    pet: currentSession,
  };
  return transitions[event.type] ?? currentSession;
}

function cooldownFor(
  frequency: BuddyPluginData['settings']['frequency'],
  sessionMode: BuddySessionMode,
): number {
  const base =
    frequency === 'chatty' ? 90_000 : frequency === 'normal' ? 180_000 : 300_000;

  const multiplier: Record<BuddySessionMode, number> = {
    idle: 1,
    starting: 0.95,
    flowing: 1.6,
    revising: 1.15,
    stuck: 0.75,
    returning: 0.85,
  };

  return Math.round(base * multiplier[sessionMode]);
}

function shouldReactAmbiently(
  event: BuddyEvent,
  frequency: BuddyPluginData['settings']['frequency'],
  sessionMode: BuddySessionMode,
  sessionPatterns: string[],
): boolean {
  const baseChance: Record<BuddyEvent['type'], number> = {
    session_started: 0.08,
    note_opened: 0.05,
    new_note_created: 0.45,
    writing_burst: 0.5,
    steady_session: 0.72,
    revision_spike: 0.42,
    long_pause: 0.38,
    returned_after_pause: 0.34,
    daily_note_opened: 0.28,
    direct_question: 1,
    pet: 1,
    manual_note_help_request: 1,
    chatty_tick: 0.9,
  };

  const multiplier =
    frequency === 'chatty' ? 1.35 : frequency === 'normal' ? 1 : 0.72;

  const sessionMultiplier: Record<BuddySessionMode, number> = {
    idle: 1,
    starting: 0.95,
    flowing: 0.4,
    revising: 0.9,
    stuck: 1.35,
    returning: 1.1,
  };

  const eventSessionBias: Partial<Record<BuddyEvent['type'], Partial<Record<BuddySessionMode, number>>>> = {
    steady_session: { flowing: 0.3 },
    writing_burst: { flowing: 0.35 },
    revision_spike: { revising: 1.35, stuck: 1.15 },
    long_pause: { stuck: 1.4, flowing: 0.25 },
    returned_after_pause: { returning: 1.4, stuck: 1.2 },
    daily_note_opened: { starting: 1.15, flowing: 0.6 },
    new_note_created: { starting: 1.2 },
  };

  const bias = eventSessionBias[event.type]?.[sessionMode] ?? 1;
  const patternMultiplier =
    sessionPatterns.includes('repeated_long_pauses') && event.type === 'long_pause'
      ? 1.2
      : sessionPatterns.includes('revision_loop') && event.type === 'revision_spike'
        ? 1.18
        : sessionPatterns.includes('sustained_momentum') &&
            (event.type === 'steady_session' || event.type === 'writing_burst')
          ? 0.7
          : 1;
  const adjustedChance = Math.min(
    0.95,
    baseChance[event.type] * multiplier * sessionMultiplier[sessionMode] * bias * patternMultiplier,
  );
  return Math.random() < adjustedChance;
}

function detectSessionPatterns(events: BuddyEvent[]): string[] {
  const recent = events.filter((event) => Date.now() - event.at <= 30 * 60_000);
  const counts = recent.reduce<Record<string, number>>((acc, event) => {
    acc[event.type] = (acc[event.type] ?? 0) + 1;
    return acc;
  }, {});

  const patterns: string[] = [];

  if ((counts.long_pause ?? 0) >= 2) {
    patterns.push('repeated_long_pauses');
  }
  if ((counts.revision_spike ?? 0) >= 2) {
    patterns.push('revision_loop');
  }
  if ((counts.steady_session ?? 0) + (counts.writing_burst ?? 0) >= 3) {
    patterns.push('sustained_momentum');
  }
  if ((counts.returned_after_pause ?? 0) >= 1 && (counts.long_pause ?? 0) >= 1) {
    patterns.push('stop_start_session');
  }
  if ((counts.new_note_created ?? 0) >= 2) {
    patterns.push('fresh-page-exploration');
  }

  return patterns;
}

export function describeMood(mode?: BuddyMood): string {
  switch (mode) {
    case 'curious':
      return 'curious';
    case 'pleased':
      return 'pleased';
    case 'concerned':
      return 'concerned';
    case 'sleepy':
      return 'sleepy';
    default:
      return 'quiet';
  }
}

export function describeSession(mode?: BuddySessionMode): string {
  switch (mode) {
    case 'starting':
      return 'just getting started';
    case 'flowing':
      return 'building momentum';
    case 'revising':
      return 'deep in revision';
    case 'stuck':
      return 'working through a snag';
    case 'returning':
      return 'finding the thread again';
    default:
      return 'idle';
  }
}

export function describePatterns(patterns: string[]): string | null {
  if (patterns.includes('revision_loop')) {
    return 'In a revision loop.';
  }
  if (patterns.includes('repeated_long_pauses')) {
    return 'Noticing repeated pauses.';
  }
  if (patterns.includes('sustained_momentum')) {
    return 'Momentum looks steady.';
  }
  if (patterns.includes('stop_start_session')) {
    return 'This session has been stop-and-start.';
  }
  if (patterns.includes('fresh-page-exploration')) {
    return 'You are opening a lot of fresh pages.';
  }
  return null;
}

export default class BestestBuddyPlugin extends Plugin {
  data!: BuddyPluginData;
  store = new BuddyStore(this);
  currentBubble: string | null = null;
  currentSpriteFrame = 0;
  currentSpriteBlink = false;
  busy = false;
  lastError: string | null = null;
  bubbleShownAt: number | null = null;
  petStartedAt: number | null = null;

  private spriteTimer: number | null = null;
  private bubbleTimer: number | null = null;
  private chattyTickTimer: number | null = null;
  private eventController = new BuddyEventController(this);
  private spriteTick = 0;

  async onload(): Promise<void> {
    await this.store.load();
    this.startChattyTick();

    this.registerView(VIEW_TYPE_BUDDY, (leaf) => new BuddyView(leaf, this));
    this.addRibbonIcon('sparkles', 'Bestest Buddy', async () => {
      await this.activateView();
    });

    this.addCommand({
      id: 'open-panel',
      name: 'Open panel',
      callback: async () => {
        await this.activateView();
      },
    });

    this.addCommand({
      id: 'pet-buddy',
      name: 'Pet buddy',
      callback: async () => {
        await this.petBuddy();
      },
    });

    this.addCommand({
      id: 'ask-buddy-about-current-note',
      name: 'Ask buddy about current note',
      callback: async () => {
        await this.askAboutCurrentNote();
      },
    });

    this.addCommand({
      id: 'mute-ambient-reactions',
      name: 'Mute ambient reactions',
      callback: async () => {
        await this.store.setMuted(true);
        this.refreshViews();
      },
    });

    this.addCommand({
      id: 'unmute-ambient-reactions',
      name: 'Unmute ambient reactions',
      callback: async () => {
        await this.store.setMuted(false);
        this.refreshViews();
      },
    });

    this.addCommand({
      id: 'reset-buddy',
      name: 'Reset buddy',
      callback: async () => {
        await this.store.resetCompanion();
        this.currentBubble = null;
        this.refreshViews();
      },
    });

    this.addSettingTab(new BuddySettingTab(this));
    this.eventController.register();
    this.startSpriteLoop();
    this.app.workspace.onLayoutReady(() => {
      void this.ensureHatched();
      void this.activateView();
    });
  }

  onunload(): void {
    if (this.spriteTimer !== null) {
      window.clearInterval(this.spriteTimer);
    }
    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
    }
    if (this.chattyTickTimer !== null) {
      window.clearInterval(this.chattyTickTimer);
    }
    this.eventController.destroy();
  }

  async activateView(): Promise<void> {
    try {
      const { workspace } = this.app;
      let leaf = workspace.getLeavesOfType(VIEW_TYPE_BUDDY)[0];

      if (!leaf) {
        const newLeaf = workspace.getRightLeaf(false);
        if (!newLeaf) {
          return;
        }
        leaf = newLeaf;
        await leaf.setViewState({ type: VIEW_TYPE_BUDDY, active: true });
      }

      workspace.revealLeaf(leaf);
    } catch (error) {
      console.error('Bestest Buddy failed to activate view', error);
    }
  }

  refreshViews(stageOnly = false): void {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_BUDDY).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof BuddyView) {
        if (stageOnly) {
          view.updateStage();
        } else {
          void view.render();
        }
      }
    });
  }

  getSessionPatterns(): string[] {
    return detectSessionPatterns(this.store.getRecentEvents(12));
  }

  async ensureHatched(): Promise<void> {
    const existing = this.store.getCompanion();
    if (existing) {
      this.refreshViews();
      return;
    }

    this.busy = true;
    this.lastError = null;
    this.refreshViews();
    try {
      const soul = await hatchSoul(this, this.store.getCompanionBones());
      const companion = await this.store.hatchCompanion({
        ...soul,
        hatchedAt: Date.now(),
      });
      await this.showBubble(`${companion.name} hatched and is now watching this vault.`);
    } catch {
      this.lastError = 'Buddy could not hatch right now.';
      new Notice(this.lastError);
    } finally {
      this.busy = false;
      this.refreshViews();
    }
  }

  async petBuddy(): Promise<void> {
    const companion = this.store.getCompanion();
    if (!companion) {
      await this.ensureHatched();
      return;
    }
    this.petStartedAt = Date.now();
    this.refreshViews(true);
    await this.handleBuddyEvent({
      type: 'pet',
      at: Date.now(),
      notePath: this.app.workspace.getActiveFile()?.path,
      noteTitle: this.app.workspace.getActiveFile()?.basename,
    }, true);
  }

  async askAboutCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('No active note to ask about.');
      return;
    }
    await this.sendDirectMessage(`What do you notice about this note?`, file);
  }

  async sendDirectMessage(message: string, file?: TFile | null): Promise<void> {
    const companion = this.store.getCompanion();
    if (!companion) {
      await this.ensureHatched();
      return;
    }

    const targetFile = file ?? this.app.workspace.getActiveFile();
    const directContext =
      this.data.settings.includeCurrentNoteInDirectReplies && targetFile
        ? await this.resolveDirectNoteContext(targetFile)
        : undefined;

    this.busy = true;
    this.lastError = null;
    this.refreshViews();
    try {
      const mood = currentMoodMode(this);
      const sessionMode = currentSessionMode(this);
      const reaction = await generateReaction(this, {
        companion,
        event: {
          type: 'direct_question',
          at: Date.now(),
          notePath: targetFile?.path,
          noteTitle: targetFile?.basename,
          excerpt: directContext?.text,
          contextKind: directContext?.kind,
          message,
        },
        directMessage: message,
        noteContext: directContext?.text,
        recentEvents: this.store.getRecentEvents(),
        mood,
        sessionMode,
      });
      await this.store.appendEvent({
        type: 'direct_question',
        at: Date.now(),
        notePath: targetFile?.path,
        noteTitle: targetFile?.basename,
        excerpt: directContext?.text,
        contextKind: directContext?.kind,
        message,
      });
      await this.store.updateMood(nextMoodForEvent({ type: 'direct_question', at: Date.now() }, mood));
      await this.store.updateSession(
        nextSessionForEvent(
          { type: 'direct_question', at: Date.now(), notePath: targetFile?.path },
          sessionMode,
        ),
        targetFile?.path,
      );
      await this.showBubble(reaction);
    } catch {
      this.lastError = 'Buddy reply failed.';
      new Notice(this.lastError);
    } finally {
      this.busy = false;
      this.refreshViews();
    }
  }

  async handleBuddyEvent(event: BuddyEvent, force = false): Promise<void> {
    const companion = this.store.getCompanion();
    if (!companion) {
      return;
    }

    await this.store.appendEvent(event);

    if (!force) {
      if (this.data.muted || !this.data.settings.ambientEnabled) {
        return;
      }
      const sessionMode = currentSessionMode(this);
      const sessionPatterns = detectSessionPatterns(this.store.getRecentEvents(12));
      const lastReactionAt = this.data.lastReactionAt ?? 0;
      if (Date.now() - lastReactionAt < cooldownFor(this.data.settings.frequency, sessionMode)) {
        return;
      }
      if (
        ![
          'writing_burst',
          'steady_session',
          'revision_spike',
          'long_pause',
          'returned_after_pause',
          'new_note_created',
          'daily_note_opened',
        ].includes(event.type)
      ) {
        return;
      }
      if (!shouldReactAmbiently(event, this.data.settings.frequency, sessionMode, sessionPatterns)) {
        return;
      }
    }

    const noteContext = event.notePath && this.data.settings.includeCurrentNoteInDirectReplies
      ? (this.readCursorExcerpt(event.notePath) ?? await this.readNoteExcerptByPath(event.notePath))
      : undefined;

    this.busy = true;
    this.lastError = null;
    this.refreshViews();
    try {
      const mood = currentMoodMode(this);
      const sessionMode = currentSessionMode(this);
      const sessionPatterns = detectSessionPatterns(this.store.getRecentEvents(12));
      const reaction = await generateReaction(this, {
        companion,
        event,
        noteContext,
        recentEvents: this.store.getRecentEvents(),
        mood,
        sessionMode,
        sessionPatterns,
      });
      await this.store.updateMood(nextMoodForEvent(event, mood));
      await this.store.updateSession(nextSessionForEvent(event, sessionMode), event.notePath);
      await this.showBubble(reaction);
    } catch {
      this.lastError = 'Buddy reaction failed.';
      this.refreshViews();
    } finally {
      this.busy = false;
      this.refreshViews();
    }
  }

  private async showBubble(text: string): Promise<void> {
    this.currentBubble = text;
    this.bubbleShownAt = Date.now();
    await this.store.setLastReactionAt(this.bubbleShownAt);
    this.refreshViews(true);

    if (this.bubbleTimer !== null) {
      window.clearTimeout(this.bubbleTimer);
    }

    this.bubbleTimer = window.setTimeout(() => {
      this.currentBubble = null;
      this.bubbleShownAt = null;
      this.refreshViews(true);
    }, BUBBLE_REVEAL_MS + BUBBLE_HOLD_MS + BUBBLE_FADE_MS);
  }

  private startSpriteLoop(): void {
    this.spriteTimer = window.setInterval(() => {
      const companion = this.store.getCompanion();
      if (companion) {
        const now = Date.now();
        const frameCount = spriteFrameCount(companion.species);
        const petting = this.isPetting(now);
        const speaking = this.currentBubble !== null;

        if (speaking || petting) {
          this.currentSpriteFrame = this.spriteTick % frameCount;
          this.currentSpriteBlink = false;
        } else {
          const step = IDLE_SEQUENCE[this.spriteTick % IDLE_SEQUENCE.length] ?? 0;
          this.currentSpriteBlink = step === -1;
          this.currentSpriteFrame = this.currentSpriteBlink ? 0 : step % frameCount;
        }
      } else {
        this.currentSpriteFrame = 0;
        this.currentSpriteBlink = false;
      }

      this.spriteTick += 1;
      this.refreshViews(true);
    }, SPRITE_TICK_MS);
    this.registerInterval(this.spriteTimer);
  }

  isBubbleFading(now = Date.now()): boolean {
    return this.bubbleShownAt !== null && now - this.bubbleShownAt >= BUBBLE_REVEAL_MS + BUBBLE_HOLD_MS;
  }

  getDisplayedBubble(now = Date.now()): string | null {
    if (!this.currentBubble || this.bubbleShownAt === null) {
      return this.currentBubble;
    }

    const elapsed = now - this.bubbleShownAt;
    if (elapsed >= BUBBLE_REVEAL_MS) {
      return this.currentBubble;
    }

    const words = this.currentBubble.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      return this.currentBubble;
    }

    const revealCount = Math.max(1, Math.ceil((elapsed / BUBBLE_REVEAL_MS) * words.length));
    return words.slice(0, revealCount).join(' ');
  }

  getSpriteMicrostate(now = Date.now()): 'default' | 'settled' | 'post-pet' {
    if (this.isPetting(now)) {
      return 'post-pet';
    }

    const lastEventAt = this.store.getRecentEvents(1)[0]?.at ?? 0;
    if (currentSessionMode(this) === 'idle' && now - lastEventAt >= QUIET_IDLE_SETTLE_MS) {
      return 'settled';
    }

    return 'default';
  }

  getPetHearts(now = Date.now()): string | null {
    if (!this.isPetting(now) || this.petStartedAt === null) {
      return null;
    }
    const elapsedTicks = Math.floor((now - this.petStartedAt) / SPRITE_TICK_MS);
    return PET_HEARTS[elapsedTicks % PET_HEARTS.length] ?? PET_HEARTS[0];
  }

  private isPetting(now = Date.now()): boolean {
    if (this.petStartedAt === null) {
      return false;
    }
    if (now - this.petStartedAt >= PET_BURST_MS) {
      this.petStartedAt = null;
      return false;
    }
    return true;
  }

  private startChattyTick(): void {
    this.chattyTickTimer = window.setInterval(() => { void this.fireChattyTick(); }, CHATTY_TICK_INTERVAL_MS);
    this.registerInterval(this.chattyTickTimer);
  }

  private async fireChattyTick(): Promise<void> {
    if (this.data.settings.frequency !== 'chatty') return;
    if (this.data.muted || !this.data.settings.ambientEnabled) return;
    if (!this.store.getCompanion()) return;

    const recentWriting = this.store.getRecentEvents(20).some(
      (e) =>
        ['writing_burst', 'steady_session', 'revision_spike', 'note_opened'].includes(e.type) &&
        Date.now() - e.at < 180_000,
    );
    if (!recentWriting) return;

    if (Date.now() - (this.data.lastReactionAt ?? 0) < CHATTY_TICK_COOLDOWN_MS) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.file || !activeView.editor) return;

    const excerpt = this.readCursorExcerpt(activeView.file.path);
    await this.handleBuddyEvent(
      {
        type: 'chatty_tick',
        at: Date.now(),
        notePath: activeView.file.path,
        noteTitle: activeView.file.basename,
        excerpt,
        contextKind: 'note_excerpt',
      },
      true,
    );
  }

  private readCursorExcerpt(forPath: string): string | undefined {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView?.editor || activeView.file?.path !== forPath) return undefined;
    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const totalLines = editor.lineCount();
    const startLine = Math.max(0, cursor.line - 4);
    const endLine = Math.min(totalLines - 1, cursor.line + 4);
    const lines: string[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lines.push(editor.getLine(i));
    }
    const compact = lines.join(' ').replace(/\s+/g, ' ').trim();
    return compact || undefined;
  }

  private async readNoteExcerpt(file: TFile): Promise<string | undefined> {
    const content = await this.app.vault.cachedRead(file);
    const compact = content.replace(/\s+/g, ' ').trim();
    return compact ? compact.slice(0, 320) : undefined;
  }

  private async resolveDirectNoteContext(
    file: TFile,
  ): Promise<
    | {
        text: string;
        kind: 'selection' | 'full_note';
      }
    | undefined
  > {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const activeSelection =
      activeView?.file?.path === file.path ? activeView.editor?.getSelection().trim() : '';

    if (activeSelection) {
      return {
        text: activeSelection.slice(0, 4_000),
        kind: 'selection',
      };
    }

    const content = await this.app.vault.cachedRead(file);
    const compact = content.replace(/\s+/g, ' ').trim();
    if (!compact) {
      return undefined;
    }

    return {
      text: compact.slice(0, 8_000),
      kind: 'full_note',
    };
  }

  private async readNoteExcerptByPath(path: string): Promise<string | undefined> {
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile ? this.readNoteExcerpt(file) : undefined;
  }
}
