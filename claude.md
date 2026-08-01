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

### Playbook moves
- Playbook moves use the **exact same move-object shape** as basic moves and run through the same `_moveGroupMoves`/`rollMove`/`postMoveDescription` path — the difference is purely *who has them*, not what they are.
- Unlike basic/special moves, **no playbook starts with any**. They're organized into pools in `MOVE_POOLS` (`scripts/playbook-moves.js`) and picked one at a time via the "+" button on the sheet's Playbook Moves section, so two Scouts can carry different sets.
- A pool with a `playbookName` (matching a `PLAYBOOKS` entry in `actor-creation.js`) belongs to that playbook; a pool without one is universal (Cantrips, Soldier Moves) and carries a `note` explaining when it applies.
- **Move keys are prefixed with their pool's key** (`the-scout:bullheaded`) because `PlaybookActorSheet` resolves every move — basic, special and playbook — from one flat `ALL_MOVES` list, and different playbooks will eventually name moves the same thing.
- The actor stores **only the picked keys**, in `system.attributes.playbookMoves`; definitions stay in code, so edited rules text reaches existing characters. `resolvePlaybookMoves` drops keys that no longer resolve. Since `swapActorPlaybook` replaces `system.attributes` wholesale, switching playbooks clears the picked moves — which matches the rulebook.
- **Pool restrictions are deliberately not enforced.** The picker shows every pool to every actor. The rules around Soldier Moves ("under specific circumstances") and reaching into another playbook's pool ("in rare circumstances") are loose enough that policing them in code would get in the table's way; the Advancement checklist (`advancements.js`) is where that bookkeeping lives, and it remains a pure tracker that grants nothing.
- `playbookMoveSections` takes an injectable `pools` argument (like `choosePlaybook(playbooks = PLAYBOOKS)`) so its ordering/nesting/emptiness tests use fixtures — otherwise those assertions would quietly stop covering their cases as real move content fills the currently-sparse pools in.
- Cantrips (`MOVE_POOLS`'s `cantrips` entry) are the first pool with real, full content — see "Adding move content" below for the shape each Cantrip maps to, including the `uses` checkbox mechanism it introduced.

### Adding move content
Adding rules text is a pure data change; adding a *mechanic* is not. Classify which one you're doing before planning — the costs are very different (see "What breaks" below).

**Deriving a move's shape from its rules text.** Match on the phrasing, not the flavor:

| Rules text says | Shape |
|---|---|
| "roll +X", "roll +X or +Y" | `traits: ["x","y"]` + `results.{success,mixed,failure}` (`null` per tier the move doesn't define) |
| "+1 if …" bullets with no base stat | `conditions: [{key,label}]`, each worth +1 — e.g. Help or Hinder |
| "on a 10+ hold 3, on a 7-9 hold 1" | `hold: {success,mixed,failure}` → writes the shared `system.resources.hold` |
| "hold 3" with no roll behind it | `flatHold: 3` → its own pool at `system.attributes.moveHold.<moveKey>`, keyed like `uses` so multiple flatHold moves on one actor don't collide, renders **Activate** instead of Roll |
| no roll, no tracked resource, pure fiction | `traits: []`, no `results` — description only (Subsystems, Bullheaded). **This is the common case for playbook moves.** |
| a choice that changes no math | `intents: [{key,label}]` |
| a stat with no UI in this module | `fixedTraits: [{key,label,value}]` — appended to the roll options as-is, never read from the actor (Lead a Sortie's CREW) |
| "once per Sortie"/"once per Downtime" | `uses: [{key,label}]` — one checkbox per entry, `checked` read from `system.attributes.moveUses.<moveKey>.<useKey>`. A **manual** tracker only: nothing in this module knows when a Sortie or Downtime starts, so nothing ever unchecks it automatically — the player does, same as the Advancement checklist. Not scoped to playbook moves; works identically for any move source. |

**Anything that depends on actor state goes in the sheet, not the move.** A move definition is static data. When behavior varies per character, put a boolean on the move and evaluate it in `PlaybookActorSheet` — that's exactly what `requiresChannelDisabled` (b-plot) and `forcesDesperationAtMaxPerils` (bite-the-dust) do.

**Systems that do not exist yet.** When move text needs one of these, transcribe it as prose in `description` and leave a code comment flagging it — don't invent machinery mid-content-entry:
- **weapon tags / profiles** — e.g. a Cantrip granting "Hand-casting II (ranged/area)" or choosing a tag (defensive, decisive, …) to attach to it.
- **roll-modifier stacking** — e.g. buying extra Advantage at the cost of Desperation. Would touch `roll-effects.js`'s state machine.
- **move-level prerequisites** — "Requires: \<other move\>". Consistent with pool membership not being enforced, these stay descriptive — the picker never checks whether the prerequisite is picked.
- **result tiers above 10+** — `moveResultTier` has exactly three tiers (success / mixed / failure); "on a 12+" text has no tier to hook into and stays descriptive.

Usage limits ("once per Sortie/Downtime") are the one exception — see the `uses` row in the shape table above. It's a manual checkbox, not real enforcement (nothing stops a second use, nothing auto-resets it), but it's cheap and removes the need to eyeball a text block during play. Cantrips' Seek Allies / Personal Familiar (`scripts/playbook-moves.js`) are the reference examples.

### Move changes: what breaks
- **Adding a basic or special move breaks a test; adding a playbook move doesn't.** `tests/playbook-actor-sheet.test.js` asserts the whole `data.moveGroups` array in a single `toEqual` that enumerates every basic and special move, so a new entry has to be added there too. The Playbook Moves group is empty in that test, so pool content never touches it.
- Tests index move groups **positionally** (`moveGroups[0]` = Basic, `[1]` = Special) — reordering `data.moveGroups` breaks many assertions at once.
- Both move test files pin specific keys as module constants (`EXCHANGE_BLOWS`, `B_PLOT`, `BULLHEADED`, …), so renaming or deleting one of those moves breaks them at import.
- **Coverage is a hard gate at 100%**, not just a report (thresholds in `vitest.config.js`). New move *data* costs nothing since it adds no branches — but any new *flag* read in `_moveGroupMoves` does, and needs its own test or the build fails.
- **`.hbs` templates are never rendered by the test suite** — `renderTemplate` is stubbed globally in `tests/setup.js`. Handlebars syntax errors, and wrong `../` scope inside a nested `{{#each}}`, sail past a fully green suite. Template changes have to be eyeballed in a real Foundry client.

### Equipment
- Equipment can be custom-made from scratch, **or** picked as a starting point from `EQUIPMENT_CATALOG` (`scripts/equipment.js`) — either way it ends up going through the same `configureEquipment` editor. Picking a catalog item is a **snapshot, not a reference**: `PlaybookActorSheet#_onEquipmentCatalogAdd` opens `chooseEquipmentCatalogItem(kind)` to pick a template, then passes it straight into `configureEquipment` as `initial` (same as editing an existing entry) so the player can still rename it, add/drop tags, or adjust tier before saving. The saved entry carries no `catalogKey` and no link back — this is deliberately unlike `playbookMoves`, which stores a permanent key reference; equipment already needed to stay freely editable (the custom-made path), and a second "linked but also editable" schema would only exist to answer a question ("has this diverged from its catalog source?") nothing in this module asks.
- **Tags** (Blitz, Defensive, …) are the other, separate catalog: `EQUIPMENT_TAGS` in `scripts/equipment.js` holds the definitions, and an equipment entry stores only the tag **keys** it has, the same catalog/keys split `MOVE_POOLS`/`playbookMoves` use for moves. `resolveEquipmentTags` drops a stale key quietly, mirroring `resolvePlaybookMoves`. Unlike `EQUIPMENT_CATALOG`, tag keys stay live-referenced even after a catalog-picked item is saved — only the item template itself (name/description/kind/scale/tier/which tag keys) is snapshotted, not the tags' own rules text.
- Weapons and gear share **one array**, `system.attributes.equipment`, distinguished by a `kind: "weapon" | "gear"` field rather than two separate arrays — add/edit/remove and tag resolution are identical either way, and only the sheet's render (and the tab's separate Weapons/Gear headers) needs to tell them apart. Only weapons carry `scale` (`WEAPON_SCALES`, purely descriptive — nothing enforces who may wield which, since Astirs aren't their own documents yet) and `tier` (1–5, independent of Value).
- An entry's **Value is always the live sum of its current tags** (`equipmentValue`) — never stored on the entry — so it can't drift out of sync after a tag is added or removed, the same reasoning as `data.advancements.topCount` being computed in `getData` rather than persisted.
- A tag with a `spend` field (e.g. Blitz: `{ period: "Scene", effect: "confidence" }`) is offerable from the move roll dialog. `PlaybookActorSheet#_equipmentSpends` collects every unspent spendable tag across the actor's equipment and passes it to `configureMoveRoll`'s `equipmentSpends` option — **not filtered by move or trait beyond the weapon-scoping below**, the same non-enforcement stance `MOVE_POOLS` takes on pool restrictions. `spend.effect` only ever sets an existing `roll-effects.js` Effect state; when the roll already has a `lockedEffect` (Bite the Dust at max Perils), offered spends render disabled rather than being silently consumed for nothing.
- **A spent tag's state lives nested on the equipment entry itself** (`entry.spent: ["blitz"]`), not in a parallel keyed map like `system.attributes.moveUses`. `moveUses` can key by move key because move keys are stable and global; equipment ids are per-actor and disposable, so a parallel map would orphan entries on delete and would need carrying separately through the playbook-swap preservation below. Nesting `spent` inside the entry avoids both problems. Like `moveUses`, unchecking is manual — nothing in this module knows when a Scene starts, so a spent tag stays spent until the player clears it themselves (on the sheet, or by spending it again next roll).
- **Equipment is the one exception to `swapActorPlaybook`'s wholesale `system.attributes` replace.** Playbook moves are meant to clear on swap (matching Bite the Dust's own "you do not gain its starting equipment" text about the *new* playbook), but existing equipment is the character's, not the old playbook's, so `swapActorPlaybook` reads it off the actor first and merges it back onto the new attributes.
- The Equipment tab's `{{#each tags}}` nested inside `{{#each weapons}}`/`{{#each gear}}` is exactly the `../` scoping shape flagged in "Move changes: what breaks" as invisible to the test suite (`renderTemplate` is stubbed) — eyeball it in a real Foundry client after template edits here.
- **A move flagged `usesWeapon: true`** (Exchange Blows, Strike Decisively — `scripts/moves.js`) can only ever be wielding one weapon at a time, so `PlaybookActorSheet#_onMoveRoll` prompts `chooseWeapon` (`scripts/equipment.js`) for which weapon — or the always-offered `UNARMED` sentinel, since both moves' text covers unarmed/verbal conflict too — before rolling. The chosen weapon is passed through to `_equipmentSpends(lockedEffect, weapon)`: passing anything other than `undefined` (including `null` for Unarmed) excludes every *other* weapon's tags from what's offered, while gear's tags are never filtered — a character can plausibly have more than one relevant piece of gear active, just not more than one weapon in hand. `chooseWeapon` is skipped entirely when the actor has no weapons at all (nothing to choose between). Every non-`usesWeapon` move leaves `weapon` `undefined`, which both `_equipmentSpends` and the `weaponLabel` computation below treat identically to before this existed.
- **Each weapon in the Equipment tab gets its own quick-roll button per `usesWeapon` move** (`data.equipment.weapons[].weaponMoves`, built once in `getData` via `_moveGroupMoves(WEAPON_MOVES)` and attached to every weapon entry rather than cross-referenced from a sibling path — see the `../` scoping note above). Clicking one (`PlaybookActorSheet#_onWeaponMoveRoll`) skips the `chooseWeapon` prompt entirely, since the click itself is the weapon choice. Both entry points converge on `_rollMove(move, weapon)`, the single roll pipeline `_onMoveRoll` and `_onWeaponMoveRoll` share.
- **The chosen weapon (or "Unarmed") always reaches the chat card**, even when nothing was spent — `_rollMove` only adds a `weaponLabel` key to `rollMove`'s options when `weapon !== undefined` (i.e. only for a `usesWeapon` move), so every other move's `rollMove` call is byte-for-byte unchanged from before.

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
