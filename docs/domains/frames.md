<!-- Domain conventions for scripts/frames/, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Frames (Astir, Ardents)

### File layout

| File | Role |
|---|---|
| `astir.js` | Barrel + cross-cutting logic: `ASTIR_CORES`/`astirCoreApproaches`, the Astir Tier band (`ASTIR_TIER_MIN`/`MAX`), Parts cap (`ASTIR_MAX_PARTS`/`astirMaxParts`), Power constants (`ASTIR_POWER_MIN`/`BASE`, `ASTIR_WEAPON_POWER_BASE`), `findAstirPart`, `unmetPartRequirements`/`partRequirementTooltip`, `resolveAstirParts`, `findAstirMove`, `findCatalogAstirWeapon` — plus re-exports of every sibling's public names |
| `astir-parts.js` | Catalog: `EXPENDED_USE`, `ASTIR_PART_CATALOG` |
| `astir-moves.js` | Catalog: `ASTIR_MOVE_CATALOG`, `requiredAstirMoveKey` |
| `astir-weapons.js` | Catalog: `ASTIR_WEAPON_CATALOG` |
| `astir-power.js` | Logic: `astirWeaponDrainTotal`, `astirMaxPower`, `astirMaxWeaponPower`, private `splitWeaponDrain` |
| `astir-pickers.js` | Logic: the three async-Dialog pickers — `chooseAstirPart`, `chooseAstirWeapon`, `astirMoveSections`/`chooseAstirMove` |
| `ardent.js` | Ardent catalog + logic: Tier band, `ARDENT_MAX_LOADOUT`, `ardentParts`/`ardentWeapons`, `ARDENT_FEATURE_PARTS`/`ARDENT_FEATURE_WEAPONS`, `ardentFeatureMax`, `buildArdent`, `chooseFrame` |
| `mounted-frame.js` | `getMountedFrameName` — a plain function, not a sheet method |

`astir-power.js` and `astir-pickers.js` both import from the `astir.js` barrel, which in turn re-exports them — a circular relationship on paper, but a safe one, because both files are pure logic that only ever runs *after* module load has finished (a picker opens on a button click; a Power calculation runs inside `getData`). Neither one spreads a catalog into a new array at import time, so there's no moment during load where the cycle could observe an unresolved value.

`ardent.js` deliberately breaks the barrel pattern for its own catalog imports, importing `ASTIR_PART_CATALOG`/`EXPENDED_USE` straight from `astir-parts.js` rather than through `astir.js`. Its own header comment explains why: `ARDENT_PART_CATALOG` (`[...ASTIR_PART_CATALOG, ...ARDENT_FEATURE_PARTS]`) spreads that catalog *eagerly*, at module-load time, and "several tests partially `vi.mock()`" the barrel "with an async `importOriginal()` factory (the barrel re-export wouldn't be settled yet in every load order, intermittently making `ARDENT_PART_CATALOG` undefined at spread time)." Eager catalog data and a mockable barrel don't mix; logic functions invoked later don't have this problem.

### Astir: Core, Tier, Parts, Power

**Core narrows Approach; Ardent doesn't — this is the detail most likely to surprise a reader.** An Astir's `core` (one of `ASTIR_CORES` — Alchemical, Crystalline, Ancient, Natural, Occult) fixes which two of the five `APPROACHES` it may take, resolved by `astirCoreApproaches(coreKey)`. Changing Core (`astir-mixin.js`'s `_onAstirCoreChange`) clears a currently-set Approach the new Core doesn't offer, rather than leaving it dangling unrendered. An Ardent has no Core at all — `ardent-mixin.js`'s `_ardentsData` hands every Ardent the full, unfiltered `APPROACHES` list, and `_onArdentApproachChange` has no dependent field to clear. The Astir's own Core-vs-`system.attributes.approach` split is itself deliberate: an Astir's Core-narrowed Approach is a separate field from the character's own base Approach, not a substitute for it (see `astir.js`'s own comment on `ASTIR_CORES`).

**Parts cap.** `ASTIR_MAX_PARTS` (2) is the baseline; `astirMaxParts(pickedMoves)` raises it by summing every picked move's own `astirPartCapBonus` — the same summed-across-picks shape `_conflictTier`'s `tierBonus` uses, per `docs/domains/moves.md`. Soldier's Red Comet (`soldier:red-comet`) is the only source today: it sets `grantsAstirPart: "astir-part:uncanny-speed"` (auto-granting Uncanny Speed the moment the move is picked) alongside `astirPartCapBonus: 1` to make room for the Part it just granted — see `docs/domains/moves.md`'s shape-table rows for both flags. Uncanny Speed itself carries `hiddenFromCatalog: true` in `astir-parts.js`, so `chooseAstirPart` filters it out of the ordinary "+" picker entirely (`!part.hiddenFromCatalog`) — it's reachable only through Red Comet's grant, never a free pick.

**Power.** `astirMaxPower(partKeys, equipment)` (`astir-power.js`) computes in two stages. First, every installed Part's `powerCost` is summed and netted against any `powerCapacityBonus` (Uncanny Speed's own +1 is the only source), subtracted from `ASTIR_POWER_BASE` (4) and floored at `ASTIR_POWER_MIN` (0) — call this `partsOnlyMax`. Second, Weapon Drain is applied: `astirWeaponDrainTotal` sums the magnitude of every mounted weapon's Drain-group tag, `splitWeaponDrain` pays that out of the Weapon Power pool's own capacity first (Weapon Conduit's `weaponPowerBonus`, a *separate* pool `ASTIR_WEAPON_POWER_BASE` starts at 0), and only the unabsorbed remainder subtracts from `partsOnlyMax` — **without** re-flooring. A heavily-Drained loadout can therefore legitimately push an Astir's max Power negative. `astirMaxWeaponPower` mirrors the Weapon Power side: capacity minus whatever it already absorbed, never negative by construction since `absorbed` is capped at `capacity`.

State lives at `system.attributes.astir.power`/`weaponPower` — both manually stepped (`_onAstirPowerStep`/`_onAstirWeaponPowerStep`), clamped against the *derived* max on every write. The maxima themselves are never persisted, the same `equipmentValue`/`advancements.topCount` derive-on-read discipline. When a Part or Astir weapon changes in a way that could lower the max (`_onAstirPartAdd`/`Remove`, `_onAstirWeaponAdd`, etc.), `_astirPowerUpdates` reclamps downward only; Refresh Sortie's `_astirPowerRestoreUpdates` instead resets straight to the freshly-derived max. Either path funnels through `_astirPowerBoundsUpdates`, which forces `piloted` off with a warning toast the moment the written Power goes negative on an already-mounted Astir. `frames-mixin.js`'s `_setMountedFrame` is the mirror-image guard on the way *in*: mounting the Astir while its stored Power is already negative is refused outright with its own warning, rather than letting the player mount an unsustainable loadout in the first place.

### Ardent: the lighter frame

Ardents are, in `ardent.js`'s own words, "a cheaper, more limited pilotable frame than the Astir: no Power, no Core, no unique Move, and a hard combined parts+weapons loadout cap." A character may have any number of them (`_onArdentCreate` always appends), but — per `frames-mixin.js`'s single mounting write path — only the Astir or one Ardent may be piloted at a time. Unlike the Astir's Core-narrowed pair, an Ardent picks freely from the full Approach list.

`ardentParts()`/`ardentWeapons()` are not a second catalog — they're filtered *views* over the same `ASTIR_PART_CATALOG`/`ASTIR_WEAPON_CATALOG` an Astir draws from, so a new Astir Part or weapon reaches every Ardent automatically. The filter excludes anything an Ardent has nothing to spend it on: `ardentParts` drops any Part with a `powerCost` or `weaponPowerBonus` (an Ardent has no Power pool to reduce or fund), and `ardentWeapons` drops any weapon carrying a Drain-group tag for the identical reason. `ARDENT_MAX_LOADOUT` (2) caps parts and weapons *combined*, counted by `ardentBaselineLoadoutCount` — which deliberately excludes anything classified as a Commander Ardent Feature or an Extra Weapon, so those two separately-tracked pools never interfere with the baseline cap.

**Commander's Ardent Features are a second, independently-capped pool**, not part of the shared Astir catalogs — `ARDENT_FEATURE_PARTS`/`ARDENT_FEATURE_WEAPONS` are Commander-exclusive mundane military hardware, deliberately kept out of `ASTIR_PART_CATALOG`/`ASTIR_WEAPON_CATALOG` so they never leak into another playbook's Ardent, or into the Astir tab's own picker. `ardentFeatureMax(pickedMoves)` starts from `ARDENT_FEATURE_MAX_BASE` (3) and sums each picked move's own `ardentFeatureBonus` — the same summed-across-picks idiom `astirPartCapBonus` uses (see `docs/domains/moves.md`); Commander's Requisitions (`the-commander:requisitions`) is the only source, contributing `ardentFeatureBonus: 2`. `ardentFeatureLoadoutCount`/`isAceFeaturePart` classify a part by catalog-key membership, and a Feature weapon by its own `commanderFeature: true` flag stamped at add-time — since a saved equipment entry is a freely-editable snapshot with no link back to its source catalog, that flag is the only way to tell a Feature weapon apart from a baseline one after the fact. This is also the one deliberate exclusion from the custom-content system: per `docs/domains/reflavor.md`'s "v1 exclusion: Commander's Ardent Features," a Director cannot add to either Feature catalog through custom content — only the shared `ASTIR_PART_CATALOG`/`ASTIR_WEAPON_CATALOG` are open to custom additions.

`buildArdent()`'s field set is deliberately smaller than the Astir's own `_onAstirCreate` object: `id`, `name`, `approach`, `tier`, `piloted`, `parts` — no `core`, `power`, `weaponPower`, `overheating`, `img`, or `move`, matching everything this section says an Ardent doesn't carry.

### Declarative flags reference

Every flag below is read generically by a sheet mixin — none of it is special-cased per catalog key, matching this codebase's usual "boolean on the object, evaluated in the sheet" convention. A flag already fully specified in `docs/domains/moves.md`'s own shape table is linked rather than re-explained here.

**Astir Part flags** (`astir-parts.js`):

| Flag | Effect | Example |
|---|---|---|
| `powerCost` | Permanently lowers Astir max Power by this amount while installed | Extra Arms (`powerCost: 1`) |
| `partType` | Display-only "Active"/"Passive" badge in the Parts list | every entry |
| `uses` | Manual per-part checkbox (`EXPENDED_USE` — "Expended", Sortie-scoped); every Active Part gets one | Divination Codex |
| `weaponPowerBonus` | Grants/enlarges the separate Weapon Power pool | Weapon Conduit (`weaponPowerBonus: 2`) |
| `showsReadTheRoomQuestions` | Activating posts Read the Room's real question list and checks Expended, instead of granting hold | Divination Codex |
| `regainPowerOnDoubles` | Regains 1 Power once per roll when the actor rolls doubles | Flourish Component |
| `grantsGuided` | Adds a chosen-move dropdown; takes a 7-9 on that move before rolling, via the existing Guided mechanism | Spell Routines |
| `grantsPotionsOnRefreshSortie` | Refresh Sortie makes all three Potions available again | Alchemical Suite |
| `grantsRollModifier` | See `docs/domains/moves.md`'s own `grantsRollModifier` entry — same array shape, any resource gate | Alchemical Suite's Blue/Yellow Potion spends; Artifact's `costsUse` spend |
| `promptsApproachOverride` | Activating swaps Approach for a Scene (or Sortie — see `docs/domains/moves.md`) | Chromatic Focus |
| `grantsChannelOnChosenMove` | Adds a chosen-move dropdown; that move rolls +CHANNEL | Input Channel |
| `bonusDowntimeTokens` | Grants a restricted extra Downtime token pool — see `docs/domains/moves.md` | Standardised Parts (`{ max: 1, description: "Repairs only." }`) |
| `powerCapacityBonus` | Raises Astir max Power (a positive offset, the mirror of `powerCost`) | Uncanny Speed (`powerCapacityBonus: 1`) |
| `hiddenFromCatalog` | Excluded from the ordinary "+" Part picker — reachable only via a move's `grantsAstirPart` | Uncanny Speed |
| `requiresParts` | Gates the entry (disabled + tooltip, not hidden) until the listed Part keys are installed | Binding Rituals requires `astir-part:artifact` |

**Astir Move flags** (`astir-moves.js`), reusing `docs/domains/moves.md`'s own vocabulary:

| Flag | Effect | Example |
|---|---|---|
| `grantsRollModifier` | See `docs/domains/moves.md` | Goliath Shield (advantage on Help or Hinder) |
| `grantsAdvantageOnMove` | Locks Advantage onto a specific *other* move while this one is held | Legacy → Lead a Sortie |
| `addsSuccessReminderToMove` / `addsMixedReminderToMove` | Chat-card reminder on a 10+ / 7-9 of a named move | Mana Devourer → Strike Decisively (needs both, since its own 7-9 is a success too) |
| `addsCriticalReminderToMove` | Chat-card reminder on a 12+ | Inertia Drive → Weather the Storm |
| `addsFailureReminderToMove` | Chat-card reminder on a 6- | Petrifier Core → Exchange Blows |
| `addsQuestionsToMove` | Layers extra questions onto a named move's own list | Future Sight → Read the Room |
| `requiresParts` | Same gating as the Part table above, applied to an Astir Move | Future Sight requires Complex Spellwork; Binding Rituals requires Artifact |
| `hold`/`questionPrompts`/`questions`/`separateHold` | A held-resource move with its own per-move pool, isolated from any identically-shaped move elsewhere on the actor | Lev-Spells (the Scout's Mobility, transplanted with its own `separateHold` pool) |

**Ardent Feature flags** (`ardent.js`'s `ARDENT_FEATURE_PARTS`):

| Flag | Effect | Example |
|---|---|---|
| `uses` | Manual checkbox(es), same shape as an Astir Part's own | Bane Reserves (three separate `use-1`/`use-2`/`use-3` checkboxes) |
| `numericTrackers` | A countdown/count-up stepper instead of a checkbox; `resetTo: "max"` opts a pool that starts full and depletes out of the usual starts-empty-and-fills reset | Chromatic Reserves (3 uses/Sortie, `resetTo: "max"`) |
| `promptsApproachOverride` | Same Approach-swap mechanism as the Astir's Chromatic Focus, spent from this tracker's own pool instead of a single checkbox | Chromatic Reserves |

### Pickers (`astir-pickers.js`)

Three async-Dialog pickers, each resolving to the chosen key/template or `null` on dismiss, all following the same promise/Dialog/`resolve(null)` shape used elsewhere in this codebase (`choosePlaybookMove`, `chooseFrame`): `chooseAstirPart` (the "+" Part picker, excluding already-picked and `hiddenFromCatalog` entries), `chooseAstirWeapon` (the "O" weapon catalog picker, gating any entry with unmet `requiresParts`), and `chooseAstirMove`/`astirMoveSections` (the Astir's one unique move, built from the character's own playbook pool, Cantrips, and `ASTIR_MOVE_CATALOG`).

`ardent-mixin.js` reuses all three as-is rather than duplicating dialog code — it just passes a filtered catalog (`ardentParts()`, `ardentWeapons()`, or the Commander-exclusive `ARDENT_FEATURE_PARTS`/`ARDENT_FEATURE_WEAPONS`) and an overridden `title` (e.g. "Add an Ardent Part", "Pick an Ardent Feature Weapon from Catalog"). An Ardent has no `requiresParts` concept to gate against, since no Ardent-eligible catalog entry carries one — callers with nothing to check just pass `[]`, which gates nothing.

An unmet `requiresParts` **disables the entry with a hover tooltip rather than hiding it outright** — `partRequirementTooltip(unmetPartRequirements(entry, installedPartKeys))` (`astir.js`) returns `null` when nothing's missing (so callers can `Boolean()` it directly for `disabled`), or a "Requires X, Y Astir Part(s)" string otherwise. The four Familiar weapons (`astir-weapons.js`) are the reference example: visible in the weapon picker always, but greyed out until Familiar Matrix is installed.

### Mounting and the shared frame lifecycle (`frames-mixin.js`)

`_frames()` normalizes the Astir (if it exists) and every Ardent into one shared shape — `{kind, id, name, tier, approach, piloted, parts}` — so mounting, weapon ownership, and per-frame move gating never need to special-case the Astir. `_mountedFrame()` is just `_frames().find(f => f.piloted)`. `_setMountedFrame(kind, id)` is the **single write path** enforcing "only one frame mounted at a time": every Piloted checkbox (`_onAstirPilotedToggle`, `_onArdentPilotedToggle`) and both Controls-tab buttons (`_onMountUp`, `_onDismount`) funnel through it. It refuses to mount the Astir while its stored Power is negative (see the Power section above), reverting the checkbox that triggered it; mounting an Ardent never fails, since an Ardent has no Power to gate on.

`_syncTokenImage` reverts the token image to the actor's own portrait whenever an Ardent (which has no `img` of its own) is mounted, or on a full dismount — writing both the prototype token and every currently-placed token, since a placed token's image doesn't stay in sync with the prototype after placement.

`_isPartDisabled(key)` reads a **globally-shared-by-key** Disabled flag (`system.attributes.moveUses.<key>.disabled`) — the same manual-tracker bag a Part's own Expended checkbox lives in. Because it's keyed only by part key, not by which frame installed it, a Part key installed on both the Astir and an Ardent shares one Disabled state between them.

**Refresh Scene/Sortie** (Controls tab) split along the rules' own boundaries. `_refreshPeriod(period)` is the generic, data-driven half both buttons share: it walks `ALL_MOVES` (which already flattens playbook moves and every Astir/Ardent Part together — see `docs/domains/reflavor.md`'s note on `ALL_MOVES`'s eager spread) clearing any `uses` checkbox or `numericTrackers` entry whose own `period` matches, plus dropping any equipment `spent` tag whose period matches. Refresh Sortie layers frame-specific extras on top of that generic pass: it restores Astir Power/Weapon Power to their freshly-derived max via `_astirPowerRestoreUpdates`, and wipes every frame's Sortie-scoped Extra Parts/Extra Weapons pool entirely (not just resetting their `uses` — the entries themselves are removed), since that pool is meant to be gone by the next Sortie regardless of whether anything on it was ever spent.

### Astir Weapons and Familiars (`astir-weapons.js`)

Astir weapons are ordinary `system.attributes.equipment` entries flagged `astir: true`, matching `EQUIPMENT_CATALOG`'s own weapon shape minus Scale and Tier — an Astir weapon has neither of its own, always inheriting both from the pilot's own Astir (its Tier band is `ASTIR_TIER_MIN`/`MAX`, 3-4; every catalog entry's own "Also seen as..." flavor text is written against a fictional Tier III, but the actual roll always uses the mounted Astir's real Tier).

The four `familiar: true` entries (Wisp/Mote/Needle/Claw Familiar) each carry `requiresParts: ["astir-part:familiar-matrix"]`, gated the same disabled-with-tooltip way any other `requiresParts` entry is in `chooseAstirWeapon`. Their mechanical consequence is real code, not just flavor: `move-roll-mixin.js`'s `_rollMove` checks `move.usesWeapon && weapon?.familiar` and, when true, rolls Exchange Blows/Strike Decisively as +CHANNEL instead of offering the usual CLASH/TALK choice.

Astir weapons (like all equipment in this module) are **snapshotted, not referenced** — `_onAstirWeaponAdd`/`_onArdentWeaponAdd` copy the chosen template's fields onto a fresh entry via `configureEquipment` and save it directly into `system.attributes.equipment`, with no `catalogKey` or other live link back to `ASTIR_WEAPON_CATALOG`. `catalogSource: true` is stamped on a catalog-picked entry (whose Kind/Tier/Range/Tags are then permanently locked, via `lockTags`) and `catalogSource: false` on a custom-created one, so a later edit (`_onEquipmentEdit`) knows whether to reopen it locked. Because the copy is one-way, editing or reflavoring the catalog entry afterward never touches an already-picked weapon — the same pickers-and-future-picks-only asymmetry `docs/domains/reflavor.md`'s storage-regime table describes for equipment generally.
