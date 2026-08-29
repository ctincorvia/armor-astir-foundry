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

## Adding brand-new catalog entries (`scripts/custom-content/`)

Reflavor only ever reskins *existing* catalog entries — it has nothing to say about a Director who
wants to add content the rulebook never shipped. `scripts/custom-content/` is a second, sibling
engine that does that: it lets a world's uploaded JSON also carry a top-level `additions` key,
alongside the five existing override sections, injecting brand-new entries into `EQUIPMENT_CATALOG`,
`ASTIR_WEAPON_CATALOG`, `ASTIR_PART_CATALOG`, and (Moves — see below) `CUSTOM_MOVE_CATALOG`/
`ALL_MOVES`/`ALL_PLAYBOOK_MOVES`/`ASTIR_MOVE_CATALOG`.

It is deliberately a separate engine from reflavor-apply.js's baseline/reset machinery rather than a
new REFLAVOR_SECTIONS entry: reflavor's whole model is "snapshot a pristine baseline, reset to it,
then reapply overrides on top," which only makes sense for content that already existed before the
first upload. A brand-new entry has no baseline to revert to — its lifecycle is add / update-in-place
/ retract by key, not snapshot / restore by identity, so it gets its own tracking `Map`
(`scripts/custom-content/custom-content-apply.js`'s `injected`) instead.

### Shape

```json
{
  "moves": { "...": "existing override sections, unaffected" },
  "additions": {
    "equipment": [{ "key": "custom:...", "name": "...", "kind": "weapon", "tags": [...], "scale": "foot", "description": "..." }],
    "astirWeapons": [{ "key": "custom:...", "name": "...", "tags": [...], "description": "..." }],
    "astirParts": [{ "key": "custom:...", "name": "...", "partType": "Active", "traits": [], "description": "...", "powerCost": 1 }],
    "moves": [{ "key": "custom:...", "name": "...", "traits": [], "description": "..." }]
  }
}
```

See `reflavor-examples/scifi-reskin.json`'s `additions` section for a worked example (an Astir
weapon, a piece of foot gear, and a foot-scale weapon) that validates and applies cleanly against
the real engine, alongside that same file's pre-existing override sections.

`scripts/reflavor/reflavor-apply.js`'s `walkOverrides` explicitly skips the `additions` key rather
than flagging it as an unrecognized section — it's a sibling key on the same JSON, handled entirely
by this engine, not by reflavor's own override walk.

### The `custom:` key prefix — required, not auto-coerced

Every addition's `key` must already start with `custom:` (`CUSTOM_KEY_PREFIX` in
`custom-content-schema.js`) — a missing or wrongly-prefixed key is a validation error, not something
the engine silently rewrites. Auto-coercing a bare key into `custom:<key>` was considered and
rejected: it would make a Director's uploaded JSON silently diverge from what actually lands in the
catalog (harder to search, and confusing when reporting a validation problem back by key), whereas
requiring the prefix up front keeps the uploaded text and the live catalog key identical, and
guarantees custom content can never collide with a future rulebook key the way an unprefixed one
theoretically could.

### The verified three-array requirement for Parts

Catalogs are not uniformly "live" the way reflavor's own catalogs mostly are. `EQUIPMENT_CATALOG` and
`ASTIR_WEAPON_CATALOG` are themselves the live source arrays every picker/filter reads by reference,
so a single `.push()` into either is immediately visible everywhere (pickers, `ardentWeapons()`,
etc.). `ARDENT_PART_CATALOG` (`ardent.js`) and `ALL_MOVES` (`all-moves.js`), though, are each a
**fixed one-time array spread** computed once at module load —
`[...ASTIR_PART_CATALOG, ...ARDENT_FEATURE_PARTS]` and (transitively) `[...ARDENT_PART_CATALOG, ...]`
respectively. Pushing a new object into `ASTIR_PART_CATALOG` alone does **not** make it appear in
either of those two — they're independent array objects holding a snapshot of references taken at
load time, not a live view over `ASTIR_PART_CATALOG`.

That matters because `ARDENT_PART_CATALOG` is what `resolveAstirParts(keys, ARDENT_PART_CATALOG)`
actually reads from every playbook-sheet mixin (`ardent-mixin.js`, `frames-mixin.js`,
`moves-mixin.js`, `progression-mixin.js`), and `ALL_MOVES` is what every Roll/Activate/Description
button and Refresh Sortie's uses-clearing walk resolves a move key against. A custom Part pushed only
into `ASTIR_PART_CATALOG` would show up correctly in the Astir tab's own part picker (which reads
`ASTIR_PART_CATALOG` directly) but silently fail to roll, activate, or describe the moment a
character actually picked it — a bug that would only surface in play, not in the picker.

`custom-content-schema.js`'s `CUSTOM_CONTENT_SECTIONS.astirParts.catalogs` is therefore
`[ASTIR_PART_CATALOG, ARDENT_PART_CATALOG, ALL_MOVES]` — three separate arrays, each independently
`.push()`ed with the exact same entry object in `custom-content-apply.js`'s `applyEntry`, so all three
readers see the identical object at the same time. `equipment` and `astirWeapons` each list only
their own single live array, since neither has this fixed-spread problem.

`REFLAVOR_SECTIONS.astirWeapons` (`reflavor-schema.js`) had the identical hazard for a different
reason: its own catalog was `[...ASTIR_WEAPON_CATALOG, ...ARDENT_FEATURE_WEAPONS]`, precomputed once
at module load, before any custom Astir weapon could exist — so a Director-added weapon would never
become reflavor-overridable. That one section's `catalog` is now a zero-arg function
(`() => [...ASTIR_WEAPON_CATALOG, ...ARDENT_FEATURE_WEAPONS]`) instead of a precomputed array,
re-spread fresh on every read; `resolveSectionCatalog(section)` (exported from `reflavor-schema.js`)
is what every reader (`reflavor-apply.js`, `reflavor-export.js`) now calls instead of reading
`section.catalog` directly, so it transparently handles either shape. The other four
`REFLAVOR_SECTIONS` entries stay plain arrays — `equipment`'s catalog is the same live
`EQUIPMENT_CATALOG` reference custom-content also targets, and `astirParts`'s catalog
(`ARDENT_PART_CATALOG`) is one of custom-content's own three target arrays — so a custom Part or
Equipment entry is reflavor-overridable the moment it exists, with no function wrapper needed.

### The verified four-array requirement for Moves

A custom Move needs one array more than a custom Part's three (see above): `CUSTOM_MOVE_CATALOG`
(`scripts/moves/custom-move-catalog.js`), `ALL_MOVES`, `ALL_PLAYBOOK_MOVES`, and `ASTIR_MOVE_CATALOG`.
`CUSTOM_MOVE_CATALOG` is a dedicated, dependency-free bookkeeping array that exists purely so both
pickers (`playbookMoveSections`/`astirMoveSections`) have a single, always-current "every custom
move" list to build their own "Custom Moves" section from, independent of which of the other three
catalogs a given lookup happens to go through. `ALL_MOVES`/`ALL_PLAYBOOK_MOVES`/`ASTIR_MOVE_CATALOG`
are the three catalogs the two pickers and every Roll/Activate/Description lookup actually resolve a
move key against — a custom Move pushed only into `CUSTOM_MOVE_CATALOG` would appear in the picker's
own "Custom Moves" section but silently fail to roll, activate, or describe the moment a character
picked it, the identical bug class the three-array requirement for Parts guards against above.
`custom-content-schema.js`'s `CUSTOM_CONTENT_SECTIONS.moves.catalogs` is therefore
`[CUSTOM_MOVE_CATALOG, ALL_MOVES, ALL_PLAYBOOK_MOVES, ASTIR_MOVE_CATALOG]` — four separate arrays,
each independently `.push()`ed with the exact same entry object in `custom-content-apply.js`'s
`applyEntry`, so all four readers see the identical object at the same time.

#### Fields deliberately left out of v1

Three fields that are valid on a hand-authored catalog move are not on `CUSTOM_MOVE_ALLOWED_FIELDS`
(`custom-content-moves-schema.js`), each for its own reason:

- `usesWeapon` — `WEAPON_MOVES`'s own separate fixed-filter (see `docs/domains/moves.md`) isn't
  reached by anything a custom-content move flows through, so setting it would silently do nothing.
- `variableDicePool`/`successOptions` — these back a wholly separate roll pipeline from the ordinary
  trait roll every other field here assumes, out of scope for v1.
- `requiresParts` — would need to be gated in the Astir Move picker (`chooseAstirMove`) but has no
  equivalent gate in the Playbook Move picker (`choosePlaybookMove`), since a custom move always
  appears unconditionally in both pickers' own "Custom Moves" section — allowing the field would
  create a real inconsistency (gated in one picker, not the other) rather than a merely incomplete
  feature.

#### Three-tier validation depth

`custom-content-moves-validate.js`'s `validateMoveFields` (and every helper it composes) follows the
same three-tier depth as the rest of this engine, deliberately stopping short of a fourth tier:
(1) a type/shape guard on every field (string, number, array-of-strings, or a bare `{}`/array
shape); (2) a required-sub-key guard on any structured field (e.g. `grantsEquipment` needs `kind`
and `name`, `hold` needs `success`/`mixed`/`failure`); (3) cross-reference resolution — whether a
`moveKey`/`moveKeys` string a field names actually resolves to a real move elsewhere in the
catalog — is deliberately never checked, matching this codebase's existing graceful-degradation
philosophy for stale or forward-referenced move keys (`resolvePlaybookMoves`, `unmetMoveRequirements`
both already tolerate a key that doesn't resolve, rather than treating it as an error).

### Update-in-place, not splice-and-reinsert

Re-uploading a file that still names an existing `custom:` key doesn't remove and recreate that
catalog entry — `applyEntry` in `custom-content-apply.js` mutates the already-injected object's own
fields in place (clearing every field but `key`, then reassigning from the freshly validated set),
preserving its object identity. This matters for the same reason reflavor's own baseline is
identity-keyed (see above): a Part that also happens to be reflavor-overridden, or an actor that
already stored a reference-shaped structure pointing at this exact object, would silently break if
the object were replaced with a new one carrying the same `key` string. A key that disappears from a
re-upload (or whose whole `additions.<section>` array disappears) is retracted — spliced out of every
catalog it was pushed into — matching the same "each upload is the complete desired state" contract
reflavor's own reset-then-reapply already has.

### The allowlisted Part behavior flags

A custom Astir/Ardent Part may set any of `ASTIR_PART_BEHAVIOR_FLAGS` (`custom-content-schema.js`):
`powerCost`, `weaponPowerBonus`, `uses`, `showsReadTheRoomQuestions`, `regainPowerOnDoubles`,
`grantsGuided`, `promptsApproachOverride`, `grantsPotionsOnRefreshSortie`, `grantsRollModifier`,
`grantsChannelOnAnyMove`, `bonusDowntimeTokens`, `numericTrackers` — every one of these is already a
generic declarative flag `PlaybookActorSheet`'s mixins read off *any* Part object, not hardcoded to a
specific built-in key (see `astir-parts.js`'s own file-level comment), so setting one on a custom Part
activates real behavior immediately, with zero new sheet code. A field name outside this list (or
outside a section's own `allowedFields`) is a warning, not an error — the entry still gets created,
just without that one unrecognized field — mirroring reflavor's own "never throws, just warns and
drops" philosophy. Deep-shape validation of a recognized flag's own payload (e.g. that every
`numericTrackers` item actually has a numeric `min`/`max`) is deliberately not enforced, the same
"authored, not runtime-checked" treatment every hand-written catalog literal already gets in this
codebase.

### v1 exclusion: Commander's Ardent Features

A Director cannot use this system to add to `ARDENT_FEATURE_PARTS`/`ARDENT_FEATURE_WEAPONS`
(`ardent.js`) — the Commander-exclusive catalogs a Custom Ardent draws its Feature slots from. Only
the shared `ASTIR_PART_CATALOG`/`ASTIR_WEAPON_CATALOG` are open to custom additions, which is already
enough surface for every playbook's Ardent, since `ardentParts()`/`ardentWeapons()` filter live over
those same two catalogs. Opening up the Commander-exclusive catalogs too would need a fourth
`CUSTOM_CONTENT_SECTIONS` entry and a decision about whether a custom Ardent Feature should count
against `ardentFeatureMax` the same way a built-in one does — deferred rather than guessed at for v1.

### Testing

Like `reflavor-apply.test.js`, `tests/custom-content-apply.test.js` mutates the real, shared catalog
objects rather than injectable fixtures, for the identical reason: this engine's entire job is
mutating those shared arrays, so a fixture catalog would test nothing real. Every test calls
`resetCustomContent()` (and, where a test also exercised reflavor overrides on top, `resetToBaseline()`
too) in `afterEach` so no injected entry or baseline mutation leaks into an unrelated suite.

## Deferred (not in v1)

- A migration pass rewriting existing actors' already-snapshotted equipment.
- Per-actor reflavor overrides.
- Reflavoring playbook names, pool labels, traits, or approaches — each is a name-keyed join, see
  Excluded above.
- Custom additions to the Commander-exclusive `ARDENT_FEATURE_PARTS`/`ARDENT_FEATURE_WEAPONS`
  catalogs — see "v1 exclusion: Commander's Ardent Features" above.
