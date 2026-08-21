<!-- Domain conventions for scripts/reflavor/, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Reflavor

A GM-uploaded, world-scoped JSON file that overrides display text — `name`/`description` and a
handful of other prose fields — on the move/equipment/tag/Astir-part/Astir-weapon catalogs, purely
for reskinning the fiction (a harder sci-fi setting, a fantasy reskin, another mecha franchise's
vocabulary) with the mechanics left completely untouched. GM-only (`registerMenu`'s
`restricted: true`), one reskin per campaign, no per-actor variant.

Not to be confused with `scripts/playbook/playbook-flavor.js`, which is unrelated (chargen
Look/Consider text).

## Why mutate catalogs in place, not an overlay

Every catalog in this codebase is a plain JS object literal, and every derived list shares object
references rather than deep-copying — no `structuredClone`, `duplicate()`, or
`JSON.parse(JSON.stringify(...))` anywhere in `scripts/`. `ALL_MOVES` spreads `BASIC_MOVES`/
`SPECIAL_MOVES`/`ALL_PLAYBOOK_MOVES`/`ARDENT_PART_CATALOG`/`ASTIR_MOVE_CATALOG`; `WEAPON_MOVES` is a
`.filter()` over `ALL_MOVES`; `ARDENT_PART_CATALOG` spreads `ASTIR_PART_CATALOG`/
`ARDENT_FEATURE_PARTS`. Every one of these copies references, not values.

That means mutating a catalog entry's own fields in place, once, before the first sheet renders,
reflavors the *entire* application — sheet, pickers, roll dialog, chat card, and the chat-card
re-render handlers (`handleAutomaticSuccess`/`handleDowngrade`/`handleAdvantage`, which each
re-resolve via `ALL_MOVES.find(m => m.key === ...)`) — with zero call-site changes anywhere else in
the codebase.

The rejected alternative was an overlay function wrapped around each read site. That would need
edits at roughly 15 `ALL_MOVES.find` call sites across 7 files, and would still miss the
eagerly-spread `ARDENT_PART_CATALOG`/`WEAPON_MOVES`, which are computed once at module-load time —
before any overlay could ever install itself.

## The baseline/idempotency contract

`scripts/reflavor/reflavor-apply.js` captures a pristine snapshot of every catalog entry's
overridable fields into a `Map` (keyed by object identity, not by `key` string — see below) the
moment the module loads, via a top-level `captureBaseline()` call that runs before anything else in
the module can ever mutate a catalog.

`applyReflavor(overrides)` always **resets every entry to that baseline first**, then applies
`overrides` on top. This reset-first order is what makes re-uploading idempotent: uploading file B
after file A replaces A's text entirely rather than compounding onto it — there is no way for two
uploads' text to blend. `resetToBaseline()` is the same reset, exposed directly for "Clear reflavor"
and for tests that need to guarantee a clean catalog between cases (see Testing below).

Only fields on each section's own allowlist (`reflavor-schema.js`) are ever written, and only when
both the schema and the uploaded JSON name them — a deep-merge was deliberately rejected because it
would let a malformed file silently rewrite `traits`/`tags`/`hold`/`grantsRollModifier`/etc., which
is the one thing this feature promises never to do. Anything else in the JSON — an unrecognized
section name, an unrecognized catalog key, an unrecognized field name — produces a warning and is
otherwise ignored; only malformed JSON or a non-object root is a hard error.

### Why the baseline Map is keyed by object identity, not by catalog key

The `astirParts` JSON section targets `ARDENT_PART_CATALOG`, and the `moves` section targets
`ALL_MOVES` — but `ALL_MOVES` already spreads `ARDENT_PART_CATALOG` into itself (see all-moves.js).
Every Astir/Ardent Part is therefore the *same object* reachable from both catalogs at once. Keying
the baseline by the entry object itself (rather than by a `{catalog, key}` pair) means walking both
catalogs during `captureBaseline`/`resetToBaseline` naturally snapshots/restores each shared Part
exactly once, with no special-casing — and a GM can equally reflavor a Part under either JSON
section, since both resolve to the same underlying object.

### Sub-array label overrides

Several move/Part fields aren't plain strings: `uses`/`conditions`/`intents`/`numericTrackers`/
`fixedTraits` are each an array of `{key, label, ...mechanical fields}` objects, where only `label`
is display text. Rather than accept a replacement array (which would let a JSON file also rewrite
`period`/`min`/`max`/`value` — mechanical fields with no business being reflavorable), these fields
take a plain `{itemKey: newLabel}` map in the upload JSON — e.g.
`"uses": {"expended": "Overloaded"}` — so the only thing an override can ever touch is the label
text on a sub-array item whose `key` already exists on the entry. `activateChoices` is the one
exception with no per-item key at all (`{prompt, options: [string, ...]}` — `options` is a plain
array of strings, not objects), so `prompt` is a simple string overwrite and `options` replaces the
whole array.

## The key-referenced vs. snapshotted asymmetry

Two storage regimes exist in this codebase, and reflavor's effect on each is opposite:

| Content | Storage | Reflavor effect |
|---|---|---|
| Moves (basic/special/playbook/Astir), Astir + Ardent **Parts**, Equipment **Tags** | actor stores **keys**, resolved live (`resolvePlaybookMoves`, `resolveAstirParts`, `resolveEquipmentTags`) | **Retroactive** — existing characters update immediately. |
| Equipment items, **all** weapons (foot/Astir/Ardent/Feature/Carrier), starting gear | **Snapshotted at pick time** into `system.attributes.equipment`, carrying no `catalogKey` and no link back (see `docs/domains/equipment.md`) | **Pickers and future picks only** — an already-picked item keeps its original text forever. |

This is deliberate, pre-existing design — equipment stays freely renameable by the player, so a link
back to the catalog would be meaningless (see `docs/domains/equipment.md`'s own note on why a
catalog pick is a snapshot, not a reference). Reflavor does not change this; it inherits it. A
migration pass rewriting existing actors' snapshotted equipment is explicitly out of scope for v1
(see Deferred below) — the config UI states this limitation directly rather than silently
under-delivering.

## Excluded fields — name-keyed joins, not display text

A few fields that look like display text are deliberately **not** on any section's allowlist,
because they're load-bearing joins rather than prose:

- `grantsEquipment.name` and `grantsWeaponTagChoice.targetEquipmentName` are matched against a
  stored equipment entry's own `name` at read time (`equipment-mixin.js`,
  `move-tracking-mixin.js`) — rewriting one side of the join silently grants a duplicate weapon or
  stops a tag choice from applying. `docs/domains/equipment.md` already flags this fragility as a
  pre-existing hazard independent of reflavor.
- Move-pool `label`/`playbookName` and `REQUIRED_ASTIR_MOVE_BY_PLAYBOOK` keys are matched against
  `actor.system.playbook.name` — also a name-keyed join, not display text a player reads.
- Every catalog `key`, and every mechanical field (`traits`, `tags`, `hold`,
  `grantsRollModifier`, `requiresParts`, tier-gating flags, etc.) — reflavor's entire premise is that
  these are never touched.

## Known limitations

- **Equipment/weapons already on a character never retroactively reflavor** — see the asymmetry
  table above. Only the catalog pickers and future picks show the new text.
- **A mid-session upload can leave an already-posted chat card showing a mix of old and new text.**
  A posted move-roll card stores its rendered HTML in `message.flavor` plus a `flavorArgs` snapshot
  in flags (`move-roll.js`), while `handleAutomaticSuccess`/`handleDowngrade` re-render that flavor
  by merging a *fresh* `ALL_MOVES` lookup over the stale snapshot — so a card rolled before an
  upload can show the old move `name` beside newly-reflavored `resultText` if someone clicks one of
  those offers afterward. Uploading between sessions avoids this; the config dialog says so.
- The `ReflavorConfig` dialog's appearance has not been visually verified in a live Foundry client —
  this repo's tooling cannot render or screenshot a Foundry sheet (see claude.md's "Templates and
  CSS are invisible to the test suite").
- **The shipped `scifi-reskin.json` example leaves `astir:refresh-matrix` untouched.** That move
  (`scripts/frames/astir-moves.js`) has its own prose naming "Familiar Matrix" and "Familiars"
  directly, and since the example deliberately doesn't populate a `moves` section, that move's text
  still reads with the old terminology even after a full application of the file. This is a scope
  boundary of the example itself, not a limitation of the reflavor engine — `moves` can be
  reflavored like any other section; the shipped example just doesn't exercise it.

## Testing

`tests/reflavor-apply.test.js` mutates the real, shared catalog objects (`ALL_MOVES`,
`EQUIPMENT_CATALOG`, etc.) rather than injectable fixtures — unlike most of this codebase's own
tests, which favor an injectable-catalog parameter specifically so tests never touch live content
(`findCatalogEquipment`, `findEquipmentTag`, `findAstirPart`, `resolveAstirParts` all take one).
Reflavor's entire job *is* mutating those shared objects, so an injectable catalog would test
nothing real — the engine has to be exercised against the actual catalogs. This makes test
isolation the real hazard: `tests/playbook-actor-sheet-moves.test.js` asserts the whole
`data.moveGroups` array in one `toEqual`, and several suites pin move keys as module constants, so a
mutation that leaked out of `reflavor-apply.test.js` would break unrelated suites in confusing ways.
Every test in that file calls `resetToBaseline()` in `afterEach` for this reason, and `npm run
test:coverage`'s full run (not just the reflavor files in isolation) is the actual proof no leak
occurred.

## Deferred (not in v1)

- A migration pass rewriting existing actors' already-snapshotted equipment.
- Per-actor reflavor overrides.
- Reflavoring playbook names, pool labels, traits, or approaches — each is a name-keyed join, see
  Excluded above.
