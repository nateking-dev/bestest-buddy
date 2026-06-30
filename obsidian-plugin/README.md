# Bestest Buddy — Obsidian plugin

This directory contains the Bestest Buddy Obsidian plugin source.

**Bestest Buddy** is a vault-scoped writing companion that lives in an Obsidian sidebar. It hatches a persistent ASCII pet for each vault, watches how you write, and reacts with short in-context observations instead of full chatbot-style conversations.

> 📖 **Full documentation lives in the [root README](../README.md)** — features, commands, settings, reaction model, LLM providers, customization, and privacy. This file covers only what you need to build and work on the plugin itself.

## Build

```bash
npm install

npm run dev        # esbuild watch build
npm run build      # production build → main.js
npm run typecheck  # tsc --noEmit
npm test           # vitest (unit tests in tests/)
```

The plugin is written in TypeScript and bundled with esbuild. The distributable consists of three files: `main.js`, `manifest.json`, and `styles.css`.

## Install into a vault

Copy the three distributable files into your vault's plugin folder (the manifest `id` is `bestest-buddy`):

```bash
VAULT="/path/to/your/vault"
mkdir -p "$VAULT/.obsidian/plugins/bestest-buddy"
cp main.js manifest.json styles.css "$VAULT/.obsidian/plugins/bestest-buddy/"
```

Then enable **Bestest Buddy** under Settings → Community plugins. Obsidian does not hot-reload plugin files, so after copying a new `main.js`, toggle the plugin off/on or reload Obsidian (`Cmd/Ctrl+R`). Requires Obsidian 1.5.0+.

## Source layout

```
src/
├─ main.ts             plugin entry: lifecycle, commands, reaction logic
├─ view.ts             sidebar panel rendering
├─ events.ts           workspace/editor event detection
├─ store.ts            persistence and companion state
├─ settings.ts         settings tab
├─ customize.ts        customization modals
├─ llm.ts              OpenAI/Claude calls, prompts, local fallbacks
├─ constants.ts        defaults and view type
├─ types.ts            plugin/data/settings types
└─ lib/buddy/
   ├─ companion.ts     seeded generation and rarity/stat rolls
   ├─ sprites.ts       ASCII sprite frames per species
   ├─ reactions.ts     local reaction text
   └─ types.ts         species, rarities, hats, eyes, stats
```
