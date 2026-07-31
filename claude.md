# Foundry Module Development Notes

## Before declaring a task done
- Stage the changes (`git add`) and run the pre-commit checks (`npx lint-staged` and `npm run test:coverage`, as defined in `.husky/pre-commit`) before declaring any task done.

## What a module is
- A Foundry module is a package folder placed in the user data modules directory.
- The module folder name must match the manifest `id` exactly.
- A module can add content, UI changes, new functionality, or translations.
- The baseline PBTA Foundry system source is available in a sibling directory and should be used as the reference environment for this module.
- A similar module for Masks: New Generation is also available in a sibling directory and can be used as a practical example for structure and patterns.
- A sibling directory, `masks-newgeneration-sheets`, contains that game's character/NPC sheet module (`ActorSheet` subclasses in `module/masks-character-sheet.mjs` / `module/masks-npc-sheet.mjs`, Handlebars templates in `templates/`, styling in `styles/`) and can be referenced for how to implement and register custom character sheets. This one has never been updated for core v12+ (tagged releases and `main` all cap at v11) — it's pattern reference only, not something to version-match, and it doesn't create a mismatch risk since it imports pbta's own `PbtaActorSheet` class rather than hardcoding a Foundry-version-specific base class.
- **The sibling `pbta` and `masks-newgeneration-unofficial` repos are pinned (detached HEAD) to the exact versions actually installed** — `pbta` at tag `1.1.15.2`, `masks-newgeneration-unofficial` at tag `1.7.6` — both matching the installed Foundry v12.331.0. This makes their code a reliable reference for what's actually running.
- **If either sibling repo is ever checked out to `main` (or a different tag) again, treat it as running ahead of what's installed** until re-pinned to match. `main` on both tracks newer, unreleased core-version support (e.g. `pbta`'s `main` currently targets core v14 / pbta 1.2.0), and a base-class or namespace reference copied from ahead-of-release source can throw at module-evaluation time — which aborts this module's entire `esmodules` import chain, not just the feature being added (this has happened once already). If in doubt, confirm a reference also appears in the *installed* system bundle (`Data/systems/pbta/module/pbta.js` in the Foundry user data directory) or in Foundry's own unpacked client source (`resources/app/client/...` under the Foundry install directory) — grep both if unsure.
- Foundry does not hot-reload `esmodules` — after editing script files, the Foundry client needs a full reload (not just saving the file) to pick up the change.

## Minimum structure
```text
Data/modules/<module-id>/
  module.json
```

A practical structure is:
```text
module.json
scripts/
styles/
templates/
lang/
packs/
```

## Minimum manifest
The module must include a valid `module.json` at the root.

Useful fields:
- `id`: unique lowercase identifier, usually hyphenated
- `title`: human-readable name shown in Foundry
- `description`: summary of the module
- `version`: version number for updates
- `authors`: author info
- `compatibility`: `minimum`, `verified`, optional `maximum`

Example:
```json
{
  "id": "armor-astir",
  "title": "Armor Astir",
  "description": "A Foundry module for the Armor Astir TRPG.",
  "version": "0.1.0",
  "authors": [{ "name": "Your Name" }],
  "compatibility": {
    "minimum": "10",
    "verified": "11"
  }
}
```

## How modules load code
- Add JavaScript via `scripts` or prefer `esmodules`.
- Example:
```json
{
  "esmodules": ["scripts/main.js"]
}
```
- Use Foundry hooks for startup behavior:
```js
Hooks.on("init", () => {
  console.log("Module initialized");
});

Hooks.on("ready", () => {
  console.log("Module ready");
});
```

## Useful manifest features
- `styles`: add CSS files
- `lang`: add localization files
- `packs`: include compendium content
- `relationships`: require other modules/systems/worlds
- `system`: restrict the module to specific systems
- `url`, `manifest`, `download`: useful for distribution and updates

## Practical advice
- Keep the manifest valid JSON.
- Use a unique, lowercase `id`.
- Start simple: manifest + one script.
- Increment the version whenever you release changes.
- If the module depends on another package, declare it in `relationships`.

## Good first milestone
Build the smallest possible working module:
1. Create the folder and `module.json`
2. Add one script file
3. Load it with `esmodules` or `scripts`
4. Confirm it appears in Foundry and logs to the console

## Domain conventions
- "Playbooks" are always player-controlled Actors (type `character`), never Items. This differs from the baseline PBTA system, where a playbook is normally an Item of type `playbook` that gets applied to a blank character actor. In this module, dragging a playbook out of a compendium should produce a ready-to-play character actor directly — see `src/packs/basic-playbook-scout/` for the pattern (an Actor document with `system.details.callsign` added so players can also record a callsign alongside the actor's native name/image).

### Basic moves
- Basic moves are **not** Items or compendium content — they're plain JS objects in the `BASIC_MOVES` array in `scripts/moves.js`, rendered directly by `PlaybookActorSheet` (`scripts/playbook-actor-sheet.js`). Every playbook gets them automatically; there's no per-move pack setup.
- A move object's fields: `key`, `name`, `traits` (array of `TRAITS` keys it can roll +, empty if the move rolls no stat), `description` (HTML rules text), `results.{success,mixed,failure}` (chat result text, `null` if the move defines none). Optional: `hold` (per-tier hold grant, e.g. Read the Room), `questions`/`questionPrompts` (hold-spend flavor), `conditions` (array of `{key,label}` checkbox modifiers each worth +1, for moves with no base stat, e.g. Help or Hinder), `intents` (array of `{key,label}`, a flavor-only choice with no mechanical effect).
- Universal roll modifiers (Advantage/Disadvantage, Confidence/Desperation) live in `scripts/roll-effects.js` and apply to every move roll regardless of the move's own fields — they are not part of a move's definition.
- Trait gating: `system.stats.<key>.disabled` (e.g. `channel` is disabled by default per playbook) hides that trait from a move's rollable options via `availableMoveTraits`/`_moveTraits`, and the move's Roll button itself greys out via each move's `gated` flag in `getData` (`gated` is true only when a move's `traits` is non-empty but every one of those traits is currently disabled for the actor — a move with no `traits` by design, like Help or Hinder, is never gated).

## Compendium packs (compiled, not committed)
Foundry compendium packs are LevelDB directories at runtime, not loose JSON — you can't point `module.json`'s `packs[].path` at a folder of raw JSON files and expect it to load. The convention (matching the sibling Masks module) is:
- Keep human-readable source under `src/packs/<pack-name>/*.json` (one file per document), committed to git.
- Compile it with `@foundryvtt/foundryvtt-cli` into a real LevelDB pack under `packs/<pack-name>/` via `npm run pullJSONtoLDB` (uses `compilePack`). This output is gitignored — it's a build artifact, regenerate it, don't hand-edit it.
- `npm run pushLDBtoJSON` does the reverse (`extractPack`), for pulling edits made in the Foundry UI back into source JSON.
- Only after compiling does `module.json`'s `packs` array entry actually resolve to something Foundry can load.

## Linking a dev checkout into Foundry's Data/modules on Windows
To test a working checkout without repackaging on every change, you'd naturally symlink/junction the repo into `Data/modules/<module-id>`. **This does not work if the top-level module folder itself is the link.**

Windows/Node quirk: `fs.readdir(dir, { withFileTypes: true })` reports a junction or symlinked directory as `isSymbolicLink: true` / `isDirectory: false`, even though `fs.stat` (which follows it) correctly resolves it as a directory. Foundry's package scanner enumerates `Data/modules/*` and — like most scanners — filters on `isDirectory()` from that raw listing. A linked top-level module folder is silently skipped: no error, no warning, it just never appears in *Manage Modules*.

The fix is to invert which level gets linked:
1. Make `Data/modules/<module-id>` a **real** directory (not a reparse point).
2. Copy the small, rarely-changing manifest files into it directly: `module.json`, `LICENSE`, `README.md`. Re-copy after editing these in the repo.
3. Inside that real directory, create junctions for the frequently-changing subfolders only — e.g. `scripts/` and `packs/` — pointing at the repo's copies. Nested paths are reached via direct file access (`readFile`/`stat`), which follows reparse points fine; it's only the top-level scan that's affected.

This gives live-reloading dev iteration for code and compiled packs, while still satisfying Foundry's directory scan.
