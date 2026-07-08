import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor, TFile } from 'obsidian';
import { BuddyEventController } from '../src/events';
import type BestestBuddyPlugin from '../src/main';
import type { BuddyEvent } from '../src/types';

function fakeEditor(text: string): Editor {
  const lines = text.split('\n');
  return {
    getValue: () => text,
    getCursor: () => ({ line: 0, ch: 0 }),
    lineCount: () => lines.length,
    getLine: (i: number) => lines[i] ?? '',
  } as unknown as Editor;
}

function fakeFile(path: string): TFile {
  return { path, basename: path.replace(/\.md$/, '') } as TFile;
}

function words(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i % 10}`).join(' ');
}

function harness() {
  const events: BuddyEvent[] = [];
  const plugin = {
    data: { settings: { burstThreshold: 50 } },
    handleBuddyEvent: async (event: BuddyEvent) => {
      events.push(event);
    },
  } as unknown as BestestBuddyPlugin;
  const controller = new BuddyEventController(plugin) as unknown as {
    handleEditorChange(editor: Editor, file: TFile | null): Promise<void>;
  };
  return { events, controller };
}

describe('BuddyEventController revision detection', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('fires revision_spike for a large deletion within the same file (control)', async () => {
    const { events, controller } = harness();
    const file = fakeFile('a.md');

    await controller.handleEditorChange(fakeEditor(words(400)), file);
    await controller.handleEditorChange(fakeEditor(words(300)), file);

    expect(events.map((e) => e.type)).toContain('revision_spike');
  });

  it('does not fire revision_spike when the same leaf switches to a shorter file (regression: #28)', async () => {
    const { events, controller } = harness();

    // Edit a long note, then — without any active-leaf-change — type in a much
    // shorter note opened in the same leaf. The length drop is a file switch,
    // not a revision.
    await controller.handleEditorChange(fakeEditor(words(400)), fakeFile('long.md'));
    await controller.handleEditorChange(fakeEditor(words(100)), fakeFile('short.md'));

    expect(events.map((e) => e.type)).not.toContain('revision_spike');
  });
});
