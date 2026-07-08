// Runtime stub for the `obsidian` package, which ships type declarations only.
// vitest.config.mjs aliases `obsidian` here so modules with value imports
// (instanceof checks, class extends, requestUrl) can load under vitest.
// Typechecking still uses the real obsidian types; these stubs only need to
// exist and be constructible, not to match the real signatures.

export class TFile {}

export class Notice {
  constructor(_message?: string) {}
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  constructor(app?: unknown, manifest?: unknown) {
    this.app = app;
    this.manifest = manifest;
  }
  async loadData(): Promise<unknown> {
    return null;
  }
  async saveData(_data: unknown): Promise<void> {}
  registerEvent(_eventRef?: unknown): void {}
  registerInterval(id: number): number {
    return id;
  }
  registerView(): void {}
  addRibbonIcon(): void {}
  addCommand(): void {}
  addSettingTab(): void {}
}

export class WorkspaceLeaf {}

export class ItemView {
  leaf: unknown;
  constructor(leaf?: unknown) {
    this.leaf = leaf;
  }
}

export class MarkdownView {}

export class Modal {
  app: unknown;
  constructor(app?: unknown) {
    this.app = app;
  }
  open(): void {}
  close(): void {}
}

export class FuzzySuggestModal extends Modal {
  setPlaceholder(_text?: string): void {}
}

export class PluginSettingTab {
  app: unknown;
  constructor(app?: unknown, _plugin?: unknown) {
    this.app = app;
  }
}

export class Setting {
  constructor(_containerEl?: unknown) {}
  setName(): this {
    return this;
  }
  setDesc(): this {
    return this;
  }
  addText(): this {
    return this;
  }
  addToggle(): this {
    return this;
  }
  addDropdown(): this {
    return this;
  }
  addSlider(): this {
    return this;
  }
  addButton(): this {
    return this;
  }
}

export class TextAreaComponent {
  inputEl = { placeholder: '', disabled: false, maxLength: 0 };
  constructor(_containerEl?: unknown) {}
  setValue(): this {
    return this;
  }
  onChange(): this {
    return this;
  }
}

export function requestUrl(): never {
  throw new Error('requestUrl is not available in tests');
}
