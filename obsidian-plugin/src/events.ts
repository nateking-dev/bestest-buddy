import { TFile } from 'obsidian';
import type { Editor, WorkspaceLeaf } from 'obsidian';
import type BestestBuddyPlugin from './main';

function extractWordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function excerptAround(editor: Editor): string | undefined {
  const cursor = editor.getCursor();
  const totalLines = editor.lineCount();
  const startLine = Math.max(0, cursor.line - 4);
  const endLine = Math.min(totalLines - 1, cursor.line + 4);
  const lines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push(editor.getLine(i));
  }
  const compact = lines.join(' ').replace(/\s+/g, ' ').trim();
  return compact ? compact.slice(0, 320) : undefined;
}

export class BuddyEventController {
  private typingStartedAt: number | null = null;
  private pauseTimer: number | null = null;
  private lastWordCount = 0;
  private lastPauseAt: number | null = null;
  private lastFilePath: string | null = null;
  private sessionStartWordCount = 0;
  private sessionChangeCount = 0;
  private lastTextLength = 0;
  private firedSteadySession = false;
  private lastRevisionAt = 0;
  private lastBurstAt = 0;

  constructor(private readonly plugin: BestestBuddyPlugin) {}

  register(): void {
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
        void this.handleActiveLeafChange(leaf);
      }),
    );

    this.plugin.registerEvent(
      this.plugin.app.vault.on('create', (file) => {
        if (file instanceof TFile) {
          void this.plugin.handleBuddyEvent({
            type: 'new_note_created',
            at: Date.now(),
            notePath: file.path,
            noteTitle: file.basename,
          });
        }
      }),
    );

    this.plugin.registerEvent(
      this.plugin.app.workspace.on('editor-change', (editor, view) => {
        void this.handleEditorChange(editor, view.file as TFile | null);
      }),
    );
  }

  private async handleActiveLeafChange(leaf: WorkspaceLeaf | null): Promise<void> {
    const view = leaf?.view;
    const file = view && 'file' in view ? (view.file as TFile | null) : null;
    if (!file) {
      return;
    }

    if (file.path !== this.lastFilePath) {
      this.lastFilePath = file.path;
      this.typingStartedAt = null;
      this.sessionStartWordCount = 0;
      this.sessionChangeCount = 0;
      this.lastTextLength = 0;
      this.firedSteadySession = false;
    }

    await this.plugin.handleBuddyEvent({
      type: 'note_opened',
      at: Date.now(),
      notePath: file.path,
      noteTitle: file.basename,
    });

    if (/^\d{4}-\d{2}-\d{2}$/.test(file.basename)) {
      await this.plugin.handleBuddyEvent({
        type: 'daily_note_opened',
        at: Date.now(),
        notePath: file.path,
        noteTitle: file.basename,
      });
    }
  }

  private async handleEditorChange(editor: Editor, file: TFile | null): Promise<void> {
    const text = editor.getValue();
    const wordCount = extractWordCount(text);
    const now = Date.now();
    const textLength = text.length;
    const deltaLength = textLength - this.lastTextLength;

    if (this.typingStartedAt === null) {
      this.typingStartedAt = now;
      this.sessionStartWordCount = wordCount;
      this.sessionChangeCount = 0;
      this.firedSteadySession = false;
    }
    this.sessionChangeCount += 1;

    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
    }

    if (deltaLength <= -180 && now - this.lastRevisionAt > 120_000 && wordCount >= 80) {
      await this.plugin.handleBuddyEvent({
        type: 'revision_spike',
        at: now,
        notePath: file?.path,
        noteTitle: file?.basename,
        wordCount,
        excerpt: excerptAround(editor),
      });
      this.lastRevisionAt = now;
    }

    if (wordCount - this.lastWordCount >= 120 && now - this.lastBurstAt > 120_000) {
      await this.plugin.handleBuddyEvent({
        type: 'writing_burst',
        at: now,
        notePath: file?.path,
        noteTitle: file?.basename,
        wordCount,
        excerpt: excerptAround(editor),
      });
      this.lastWordCount = wordCount;
      this.lastBurstAt = now;
    }

    if (
      !this.firedSteadySession &&
      this.typingStartedAt !== null &&
      now - this.typingStartedAt >= 120_000 &&
      wordCount - this.sessionStartWordCount >= 180 &&
      this.sessionChangeCount >= 15
    ) {
      await this.plugin.handleBuddyEvent({
        type: 'steady_session',
        at: now,
        notePath: file?.path,
        noteTitle: file?.basename,
        wordCount,
        excerpt: excerptAround(editor),
      });
      this.firedSteadySession = true;
    }

    if (this.lastPauseAt && now - this.lastPauseAt > 45_000) {
      await this.plugin.handleBuddyEvent({
        type: 'returned_after_pause',
        at: now,
        notePath: file?.path,
        noteTitle: file?.basename,
        wordCount,
        excerpt: excerptAround(editor),
      });
      this.lastPauseAt = null;
    }

    this.pauseTimer = window.setTimeout(async () => {
      this.typingStartedAt = null;
      this.lastPauseAt = Date.now();
      const pausedText = editor.getValue();
      const pausedWordCount = extractWordCount(pausedText);
      if (pausedWordCount >= 80 || this.sessionChangeCount >= 12) {
        await this.plugin.handleBuddyEvent({
          type: 'long_pause',
          at: Date.now(),
          notePath: file?.path,
          noteTitle: file?.basename,
          wordCount: pausedWordCount,
          excerpt: excerptAround(editor),
        });
      }
    }, 35_000);

    this.lastTextLength = textLength;
  }

  destroy(): void {
    if (this.pauseTimer !== null) {
      window.clearTimeout(this.pauseTimer);
    }
  }
}
