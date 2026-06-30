# Submitting Bestest Buddy to the Obsidian community plugin directory

This is a working draft of the steps to list the plugin in Obsidian's community
directory (the `obsidianmd/obsidian-releases` registry). Work top to bottom.

## ⚠️ Prerequisite: manifest must be at the repository root

Obsidian's validation bot reads `manifest.json` (and `versions.json`) from the
**root of the default branch**, and the GitHub release must carry `main.js`,
`manifest.json`, and `styles.css` as assets. Right now those files live in
`obsidian-plugin/`, so the repo is **not yet submittable as-is**.

Pick one:

- **Recommended — promote the plugin to the repo root.** This repo effectively
  *is* the plugin (the `dist/` + `dist-server/` web prototype is gitignored and
  unused). Move `obsidian-plugin/*` up to the root: `manifest.json`,
  `versions.json`, `styles.css`, `src/`, `tests/`, `esbuild.config.mjs`,
  `tsconfig.json`, `package.json`, build to `./main.js`. Update the two CI
  workflows (drop the `working-directory: obsidian-plugin` default and the
  `obsidian-plugin/` asset path prefixes).
- **Alternative — a dedicated release repo.** Keep this monorepo for development
  and publish the built artifacts to a separate `bestest-buddy` repo whose root
  holds `manifest.json`/`versions.json`/`main.js`/`styles.css`. More moving parts.

Everything below assumes the manifest lives at the submitted repo's root.

## Pre-submission checklist (Obsidian guidelines)

- [x] `LICENSE` present (MIT).
- [x] `manifest.json` with `id`, `name`, `version`, `minAppVersion`,
      `description`, `author`, `isDesktopOnly`.
- [x] `id` is unique and contains neither "obsidian" nor "plugin" → `bestest-buddy`.
- [x] `description` ≤ 250 chars, ends with a period, does not contain "Obsidian".
- [x] `versions.json` maps `1.0.0` → `1.5.0`.
- [x] `README.md` describes the plugin.
- [x] No `innerHTML`/`outerHTML`; no static inline styles (uses CSS + variables).
- [ ] `manifest.json` is at the **repo root** (see prerequisite above).
- [ ] A GitHub **release tagged `1.0.0`** (no leading `v`) exists with
      `main.js`, `manifest.json`, `styles.css` attached. Pushing the `1.0.0`
      tag triggers `release.yml`, which builds and attaches them automatically.

## Cut the 1.0.0 release

```bash
git tag 1.0.0
git push origin 1.0.0
# release.yml builds + attaches main.js / manifest.json / styles.css
```

Confirm the release at `https://github.com/nateking-dev/bestest-buddy/releases/tag/1.0.0`
has all three assets.

## Open the directory PR

1. Fork `obsidianmd/obsidian-releases`.
2. Append this entry to the end of `community-plugins.json`:

   ```json
   {
     "id": "bestest-buddy",
     "name": "Bestest Buddy",
     "author": "Nathan King",
     "description": "A vault-scoped writing companion that lives in your sidebar — hatches an ASCII pet per vault and reacts to how you write.",
     "repo": "nateking-dev/bestest-buddy"
   }
   ```

3. Open a PR using their **"Add a community plugin"** template and tick every box
   in their checklist. The automated bot will validate the manifest, release
   assets, and entry; respond to anything it flags.
4. A maintainer reviews and merges. After that the plugin appears in
   Obsidian → Settings → Community plugins → Browse.

## Publishing future updates

1. Bump `version` in `manifest.json` and `package.json`.
2. Add the new version → minAppVersion mapping to `versions.json`.
3. Commit, then `git tag X.Y.Z && git push origin X.Y.Z`.

`release.yml` publishes the release; Obsidian clients pick up the update
automatically — no further directory PR is needed.
