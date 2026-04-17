# Bestest Buddy for Obsidian

Bestest Buddy is a vault-scoped writing companion that lives in an Obsidian sidebar. It hatches a persistent ASCII pet for each vault, watches how you write, and reacts with short in-context observations instead of full chatbot-style conversations.

The plugin is built around three ideas:

- Your buddy is tied to one vault and keeps its identity until you reset it.
- It reacts to writing activity, pauses, revisions, note creation, and direct questions.
- It stays lightweight inside the workspace: short replies, a compact side panel, and no autonomous note edits.

## What The Plugin Does

### Vault-scoped companion

Each vault gets its own generated buddy with persistent identity traits:

- Name
- Personality
- Species
- Rarity
- Hat
- Eye style
- Shiny state
- Stats: `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK`

The buddy is generated from a vault seed, so it remains stable for that vault until you reset it.

### Sidebar view

The plugin registers a dedicated right-sidebar panel and opens it automatically when Obsidian layout is ready. The panel includes:

- A header with the buddy name, rarity, species, hat, shiny flag, and personality
- An animated ASCII sprite with multiple species-specific frames
- A speech bubble for reactions and replies
- Session and mood status indicators
- Pattern hints when the plugin detects recurring session behavior
- Action buttons for hatch/pet, mute/unmute, ask about note, and reset
- A compact direct-chat input

### Animated ASCII pet

The buddy is visually animated in the panel:

- Idle animation loop
- Speaking animation while a bubble is visible
- Petting animation with floating heart frames
- Blink states
- A quieter "settled" microstate when the session has been idle for a while

### Ambient writing reactions

When ambient reactions are enabled and the plugin is not muted, Bestest Buddy can react to vault activity such as:

- Opening a daily note
- Creating a new note
- Writing in a burst
- Sustaining a writing session
- Making a large revision cut
- Pausing for a while
- Returning after a pause

These reactions are intentionally selective. The plugin uses cooldowns, probability, and session state to avoid constant interruptions.

### Direct chat

You can send the buddy a direct message from the panel, or use the command to ask about the current note. Direct replies are:

- Short and compact
- Grounded in the buddy's personality and current session state
- Optionally based on the current note context

When note context is enabled, direct chat uses:

- The current editor selection if there is one
- Otherwise the current note text

### Current-note awareness

The plugin can include note context in buddy replies:

- For direct chat, it prefers the active selection and falls back to the full note
- For ambient reactions, it can include a compact excerpt from the current note

This helps reactions feel specific to the note without turning the buddy into a full drafting assistant.

### Session tracking

The plugin tracks recent events and derives a lightweight view of the session:

- `idle`
- `starting`
- `flowing`
- `revising`
- `stuck`
- `returning`

It also tracks mood:

- `quiet`
- `curious`
- `pleased`
- `concerned`
- `sleepy`

The sidebar reflects these states in the status area and stage styling.

### Pattern detection

Bestest Buddy looks at recent events and surfaces higher-level session patterns such as:

- Repeated long pauses
- Revision loops
- Sustained momentum
- Stop-start sessions
- Fresh-page exploration

These patterns influence both the UI hint text and the likelihood/tone of ambient reactions.

### Persistence

The plugin stores its state in plugin data for the current vault, including:

- Vault seed
- Hatched companion soul data
- Mute state
- Last reaction timestamp
- Recent event history
- Mood state
- Session state
- Plugin settings

### Reset support

Resetting the buddy:

- Generates a new vault seed
- Removes the current buddy
- Clears recent events
- Clears session state
- Clears mood state
- Clears the last reaction timestamp

After reset, the next hatch produces a new vault-specific companion.

## Commands

The plugin registers these Obsidian commands:

- `Bestest Buddy: Open panel`
- `Bestest Buddy: Pet buddy`
- `Bestest Buddy: Ask buddy about current note`
- `Bestest Buddy: Mute ambient reactions`
- `Bestest Buddy: Unmute ambient reactions`
- `Bestest Buddy: Reset buddy`

It also adds a ribbon icon to open the panel.

## Settings

The settings tab exposes the following options:

- `OpenAI API key`
  Stores the API key used for hatching the buddy and generating reactions.

- `Model`
  The Responses API model used for hatch and direct replies. The default is `gpt-4.1-mini`.

- `Ambient reactions`
  Enables or disables automatic buddy reactions to writing activity.

- `Reaction frequency`
  Controls how talkative the buddy is when ambient reactions are enabled.
  Available values:
  `quiet`, `normal`, `chatty`

- `Include current note context`
  Allows direct buddy replies to use the current note selection or note text.

- `Enable write actions`
  Present in settings but currently reserved for future explicit write features. In the current version, the plugin does not autonomously write to notes.

## How Reactions Are Triggered

The plugin listens to workspace and editor activity and records buddy events.

### Events it records

- `note_opened`
- `daily_note_opened`
- `new_note_created`
- `writing_burst`
- `steady_session`
- `revision_spike`
- `long_pause`
- `returned_after_pause`
- `direct_question`
- `pet`

### How writing-related events are inferred

- A `writing_burst` is triggered after significant word growth in a note.
- A `steady_session` is triggered after sustained active editing over time.
- A `revision_spike` is triggered after a large deletion/change during an established draft.
- A `long_pause` is triggered after a period of inactivity while working.
- A `returned_after_pause` is triggered when editing resumes after a long pause.

Ambient reactions only fire for selected event types, and only if:

- A buddy already exists
- Ambient reactions are enabled
- The plugin is not muted
- The reaction cooldown has expired
- The random chance for the event passes

The cooldown changes with both the selected reaction frequency and the current session mode.

## OpenAI Usage And Fallback Behavior

The plugin uses the OpenAI Responses API for two jobs:

- Generating the buddy's name and personality at hatch time
- Generating short reaction lines and direct replies

If no API key is configured, or if the API request fails:

- Buddy hatching falls back to local name/personality generation
- Reactions fall back to local rule-based text

That means the plugin still works without an API key, but responses are less rich.

## What It Does Not Do

Current limitations are explicit in the code:

- It does not autonomously edit or write notes.
- It does not produce long-form assistant responses.
- It does not maintain a full chat transcript UI.
- It does not sync buddies across vaults.
- It does not use network services other than the configured OpenAI API call path.

## Installation

Build the plugin:

```bash
cd obsidian-plugin
npm install
npm run build
```

For development:

```bash
cd obsidian-plugin
npm run dev
```

Then copy these files into your vault's plugin folder:

- `main.js`
- `manifest.json`
- `styles.css`

The manifest ID is `bestest-buddy`, so the target directory will usually be:

```text
<your-vault>/.obsidian/plugins/bestest-buddy/
```

After copying the files:

1. Open Obsidian settings.
2. Go to Community Plugins.
3. Enable Bestest Buddy.
4. Open the Bestest Buddy settings tab and add an OpenAI API key if you want model-generated hatching and reactions.

## Development

Useful scripts:

- `npm run build`
- `npm run dev`
- `npm run typecheck`

## Summary

Bestest Buddy is a sidebar-native Obsidian companion with:

- A persistent vault-specific ASCII pet
- Auto-hatching and auto-opening panel behavior
- Ambient writing reactions based on actual editing patterns
- Direct chat with optional note context
- Session and mood tracking
- Local persistence and reset support
- OpenAI-powered replies with local fallbacks

It is intentionally small, reactive, and companion-like rather than a full writing agent.
