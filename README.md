# Bestest Buddy

A vault-scoped writing companion for [Obsidian](https://obsidian.md). Bestest Buddy hatches a persistent ASCII pet for each vault, watches how you write, and reacts with short, in-context observations — a companion that lives in your sidebar, not a chatbot you converse with.

It is built around three principles:

- **One buddy per vault.** Your companion is generated from a vault seed and keeps its identity until you reset it.
- **Reactive, not conversational.** It responds to writing bursts, pauses, revisions, new notes, and direct questions with brief quips.
- **Lightweight and non-intrusive.** Short replies, a compact panel, cooldowns to avoid nagging, and **no autonomous edits to your notes**.

```
   .----.
  / ×  × \      Capy Scribbles
 |   --   |     Common Capybara
  `-____-´
```

---

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Settings](#settings)
- [How reactions work](#how-reactions-work)
- [LLM providers & fallbacks](#llm-providers--fallbacks)
- [Customization](#customization)
- [Privacy & data](#privacy--data)
- [What it does not do](#what-it-does-not-do)
- [Development](#development)
- [Project structure](#project-structure)

---

## Features

### Vault-scoped companion
Each vault gets its own generated buddy with persistent traits:

- **Name** and **personality** (LLM-generated, with a local fallback)
- **Species** — one of 18: duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk
- **Rarity** — common, uncommon, rare, epic, legendary, mythic
- **Hat** — none, crown, top hat, propeller, halo, wizard, beanie, tiny duck
- **Eye style** — one of `·` `✦` `×` `◉` `@` `°`
- **Shiny** state and an optional custom **sprite color**
- **Stats** — `GRAMMARING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK`

The buddy is derived deterministically from the vault seed, so it stays stable until reset.

#### Rarity
Rarity is rolled by weight, so most buddies are common and a mythic is genuinely rare:

| Rarity | Weight | Notes |
| --- | --- | --- |
| Common | 60 | |
| Uncommon | 25 | |
| Rare | 10 | |
| Epic | 4 | |
| Legendary | 1 | |
| Mythic | 0.1 | Animated rainbow sprite, background, and nameplate |

### Sidebar panel
A dedicated right-sidebar view that opens automatically when the workspace is ready. It includes:

- A header with name, rarity, species, hat, shiny flag, and personality
- An **animated ASCII sprite** with species-specific frames
- A **speech bubble** that reveals replies word-by-word, then fades
- **Session** and **mood** status indicators
- **Pattern hints** when recurring session behavior is detected
- Action buttons: hatch/pet, mute/unmute, ask about the current note, reset
- A compact **direct-chat input**

Enable **Minimal mode** to show only the sprite.

### Animated sprite
The pet is alive in the panel:

- Idle animation loop with occasional blinks
- Speaking animation while a bubble is visible
- Petting animation with floating heart frames
- A quieter **"settled"** microstate after a long idle period

### Ambient writing reactions
When enabled and not muted, the buddy occasionally reacts to vault activity: opening a daily note, creating a note, writing in a burst, sustaining a session, making a large revision cut, pausing, or returning after a pause. Reactions are deliberately selective — gated by cooldown, probability, session state, and your snark level — so they punctuate rather than interrupt.

### Direct chat & note awareness
Send the buddy a message from the panel, or use the command to ask about the current note. Replies are short, grounded in the buddy's personality and session state, and — when note context is enabled — informed by your current selection (or the full note if nothing is selected).

### Session, mood & pattern tracking
The plugin keeps a lightweight model of your session:

- **Session modes:** idle, starting, flowing, revising, stuck, returning
- **Moods:** quiet, curious, pleased, concerned, sleepy
- **Patterns:** repeated long pauses, revision loop, sustained momentum, stop-start session, fresh-page exploration

These influence the UI hints and the likelihood and tone of reactions.

---

## Installation

Bestest Buddy is not yet in the community plugin directory, so install it manually.

**1. Build it:**

```bash
cd obsidian-plugin
npm install
npm run build
```

**2. Copy the build artifacts** into your vault's plugin folder (`id` is `bestest-buddy`):

```bash
VAULT="/path/to/your/vault"
mkdir -p "$VAULT/.obsidian/plugins/bestest-buddy"
cp obsidian-plugin/{main.js,manifest.json,styles.css} \
   "$VAULT/.obsidian/plugins/bestest-buddy/"
```

Only those three files are needed — do not copy `src/` or `node_modules/`.

**3. Enable it:** Obsidian → Settings → Community plugins → enable **Bestest Buddy**.

> Updating an existing install? Obsidian doesn't hot-reload plugin files. After copying a new `main.js`, toggle the plugin off/on or reload Obsidian (`Cmd/Ctrl+R`).

---

## Getting started

1. Enable the plugin. Your buddy hatches automatically and the panel opens.
2. (Optional) Open **Settings → Bestest Buddy** and add an API key for richer, model-generated names and reactions. Without a key, the plugin still works using local fallbacks.
3. Write. The buddy reacts to your activity, and you can pet it, ask it about a note, or chat from the panel.

Requires Obsidian **1.5.0+**. Works on desktop and mobile (`isDesktopOnly: false`).

---

## Commands

All commands are available from the command palette under **Bestest Buddy**. A `sparkles` ribbon icon also opens the panel.

| Command | Action |
| --- | --- |
| Open panel | Reveal the sidebar view |
| Pet buddy | Trigger the petting animation and a reaction |
| Ask buddy about current note | Generate an observation about the active note |
| Mute / Unmute ambient reactions | Toggle automatic reactions |
| Reset buddy | New vault seed; clears companion, events, mood, session |
| Customize: choose species / eye style / hat / rarity / color | Override a generated trait |
| Customize: edit stats | Manually set stat values |
| Customize: toggle shiny | Toggle the shiny flag |
| Customize: reset appearance to generated | Clear all appearance overrides |

---

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| **LLM provider** | OpenAI | `OpenAI` or `Claude (Anthropic)` |
| **OpenAI API key** | — | Used when provider is OpenAI (masked input) |
| **Claude API key** | — | Used when provider is Claude (masked input) |
| **Model** | `gpt-4.1-mini` | Model name for the selected provider (e.g. `gpt-4.1-mini`, `claude-haiku-4-5-20251001`) |
| **Ambient reactions** | on | Allow the buddy to react to note activity |
| **Reaction frequency** | Normal | `Quiet`, `Normal`, or `Chatty` |
| **Writing burst threshold** | 50 | New words that trigger a writing-burst reaction (minimum 10) |
| **Include current note context** | on | Pass note title and excerpt to replies |
| **Minimal mode** | off | Show only the sprite in the panel |
| **Snark level** | 50 | 0 = rare and gentle, 100 = constant and merciless. Values above 90 can use significantly more tokens. |

---

## How reactions work

The plugin listens to workspace and editor activity and records buddy **events**:

`session_started`, `note_opened`, `new_note_created`, `writing_burst`, `steady_session`, `revision_spike`, `long_pause`, `returned_after_pause`, `daily_note_opened`, `direct_question`, `pet`, `manual_note_help_request`, `chatty_tick`.

Writing-related events are inferred from editing behavior:

- **Writing burst** — significant word growth in a note (see *Writing burst threshold*)
- **Steady session** — sustained active editing over time
- **Revision spike** — a large deletion/change during an established draft
- **Long pause** — a period of inactivity while working
- **Returned after pause** — editing resumes after a long pause

An **ambient** reaction only fires when **all** of these hold: a buddy exists, ambient reactions are enabled, the plugin is not muted, the cooldown has expired, the event type is reaction-eligible, and a probability roll passes. The cooldown and probability are modulated by reaction frequency, current session mode, detected patterns, and snark level.

When frequency is set to **Chatty**, a periodic *chatty tick* lets the buddy comment on the text near your cursor during active writing (subject to its own cooldown).

---

## LLM providers & fallbacks

The buddy uses an LLM for two jobs: generating its **name and personality** at hatch time, and generating short **reactions and direct replies**.

| Provider | Endpoint | Example model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1/responses` | `gpt-4.1-mini` |
| Claude (Anthropic) | `https://api.anthropic.com/v1/messages` | `claude-haiku-4-5-20251001` |

**Fallbacks:** if no API key is configured or a request fails, hatching falls back to local name/personality generation and reactions fall back to local rule-based text. The plugin remains fully functional without any API key — responses are just less varied.

---

## Customization

Beyond the generated buddy, you can override any visible trait via the **Customize** commands: species, eye style, hat, rarity, sprite color (presets or a custom `#rrggbb` hex), shiny, and individual stats. Overrides are stored separately from the generated companion, so **Customize: reset appearance to generated** restores the original at any time.

---

## Privacy & data

- All state is stored in the plugin's per-vault data (`data.json`): vault seed, hatched companion, appearance overrides, mute state, recent events (most recent 20), mood and session state, and your settings.
- The only network calls are to the **provider endpoint you configure**. Note title and excerpts are sent only when *Include current note context* is enabled, and direct-chat context is truncated before sending.
- API keys are stored in plugin data and masked in the settings UI. Treat your vault's `.obsidian` data accordingly.

---

## What it does not do

These limits are intentional:

- It does not autonomously edit or write to your notes.
- It does not produce long-form, assistant-style responses.
- It does not maintain a full chat transcript UI.
- It does not sync buddies across vaults.
- It makes no network calls other than to the configured provider.

---

## Development

```bash
cd obsidian-plugin
npm install

npm run dev        # esbuild watch build
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm test           # vitest (unit tests)
```

The plugin is written in TypeScript and bundled with esbuild into `main.js`. The distributable consists of `main.js`, `manifest.json`, and `styles.css`.

Unit tests live in `obsidian-plugin/tests/` (vitest) and cover the pure generation and sprite logic. CI (`.github/workflows/ci.yml`) runs typecheck, tests, and build on every push and PR; tagging a commit `X.Y.Z` triggers `release.yml` to build and attach the release artifacts.

---

## Project structure

```
bestest-buddy/
├─ README.md                 ← you are here
└─ obsidian-plugin/
   ├─ manifest.json          plugin manifest (id, version, minAppVersion)
   ├─ esbuild.config.mjs     build configuration
   ├─ styles.css             panel and sprite styling (incl. mythic animations)
   └─ src/
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

> Note: `dist/` and `dist-server/` are gitignored build outputs and not part of the plugin source.

---

## License & author

Author: **Nathan King**.

With thanks to **Owen McGrath**, a valued contributor.

See the repository for license details.
