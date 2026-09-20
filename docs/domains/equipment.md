<!-- Domain conventions for scripts/equipment/, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Equipment

### File layout

| File | Role |
|---|---|
| `equipment.js` | Barrel only — re-exports every name below so no importer's path changes when a split happens. No logic of its own. |
| `equipment-constants.js` | True leaf: `TAG_VALUE_MIN`/`MAX`, the four `*_GROUP` strings, `MAX_TAGS`, `TIER_MIN`/`MAX`, `OVERRIDE_MAX_TAG_VALUE`, the two template paths, `UNARMED`, `WEAPON_SCALES`, `TAG_VALUE_GROUPS`. Imports nothing. |
| `equipment-tags.js` | Catalog: `EQUIPMENT_TAGS` |
| `equipment-catalog.js` | Catalog: `EQUIPMENT_CATALOG` (whole pre-built items, not tags) |
| `equipment-helpers.js` | Pure functions: lookups (`findEquipmentTag`, `conflictingTagKeys`, `resolveEquipmentTags`, `equipmentValue`), spend bookkeeping (`mergeSpentTags`, `rerollSpendKey(s)`, `baseEquipmentTagKey`), display shaping (`groupEquipmentTags`, `withTagLabels`, `buildTagReference`, `wirePickerTabs`), and the weapon-roll resolvers |
| `equipment-dialogs.js` | `chooseEquipmentCatalogItem`, `configureEquipment` |
| `starting-gear.js` | `chooseStartingGear`, `findStartingGearPool`, the custom-weapon budget constants |
| `starting-gear-pools.js` | Catalog: `STARTING_GEAR_POOLS` (~900 lines, split off purely for size) |

`equipment-constants.js` exists so `equipment-tags.js` and `equipment-dialogs.js` can both read the
shared constants without either depending on `equipment-helpers.js`. Route a name two siblings both
need through whichever one owns it, never back through the barrel.

### Storage shape

A playbook actor keeps **one flat array**, `system.attributes.equipment`, holding weapons and gear
together. Entries are distinguished by field, not by container:

| Field | Meaning |
|---|---|
| `kind` | `"weapon"` or `"gear"` — the only required discriminator |
| `astir: true` | an Astir weapon (an ordinary entry, just flagged) |
| `ardent: "<ardentId>"` | an Ardent weapon, scoped to one Ardent |
| neither | a mundane, foot-scale weapon or plain gear |
| `tags` | array of `EQUIPMENT_TAGS` keys |
| `spent` | array of spend keys consumed this period (see Spends) |

A **Carrier** is the exception: `system.attributes.weapons` is a slot-keyed object
(`primary`/`secondary`), not an array, because its weapons are two named fixed roles rather than a
list. That's why `spendEquipmentTagsOnActor` branches on which shape an actor stores, and why
`mergeSpentWeaponSlotTags` exists alongside `mergeSpentTags`.

### Catalog in code, keys on the actor — with one deliberate exception

`EQUIPMENT_TAGS` follows the module-wide rule: the actor stores only tag *keys*, so edited rules
text reaches existing characters, and `resolveEquipmentTags` silently drops keys that no longer
resolve.

`EQUIPMENT_CATALOG`, `ASTIR_WEAPON_CATALOG` and the starting-gear pools deliberately do **not**.
Picking one is a **snapshot**: the item's name, description and tags are copied onto the entry, no
`catalogKey` is stored, and there is no link back. So edited catalog text reaches *future* picks
only — an already-picked item keeps its original wording forever. This is also why reflavoring
(`docs/domains/reflavor.md`) can only affect pickers and future picks for equipment.

### Tag metadata

Beyond `key`/`label`/`value`/`description`, a tag may carry:

| Field | Effect |
|---|---|
| `spend: {period, effect?}` | Shows a manual "used" checkbox on the Equipment tab. Only with a real `effect` (an `EFFECT_STATES` key) does it *also* appear as a roll-dialog checkbox — a spend with no effect (Ward, Vorpal, One-Use, Refresh, Dangerous) only tracks "used this period", since its effect happens outside any one roll. |
| `forcesEffect: {period, effect}` | The inverse of `spend`: not opt-in. Unreliable is the only one — it auto-locks the first roll each Scene to Desperation. |
| `reroll: {moves, period}` | Rerolls a failure on the named move(s) once per period. |
| `guided: true` | Offers "take a 7-9 without rolling" on any `usesWeapon` move. No period limit, nothing to mark spent. |
| `gearOnly: true` | Not pickable on a Weapon through the editor. Ward only. |
| `exclusiveGroup` / `excludes` | See Tag exclusivity below. |

`value` mirrors the rulebook's -3..+2 banding, and `TAG_VALUE_GROUPS` drives the editor's accordion
sections off that same field, so the groups can't drift from what a tag is worth. Where a tag's own
text claims to change "value" by some other number (Treasure, Valuable), that's the rulebook's
monetary sense — **this module has no economy or appraisal system**, so it stays flavor.

**A multi-move reroll tag tracks each move independently.** `rerollSpendKey` produces a compound
key (`versatile:exchange-blows`) only when a tag names more than one move; a single-move tag keeps
storing its bare key. Without that, Versatile would exhaust on first use regardless of which move
triggered it, making it strictly worse than picking the two single-move tags it combines.
`baseEquipmentTagKey` strips a compound key back for period lookups.

### "Narrative tag" — the definition

A **narrative tag** is one with no codified mechanic: no `spend`, no `forcesEffect`, no `reroll`,
no `guided`, and not in `DRAIN_GROUP`. `resolveNarrativeWeaponTags` filters on exactly that, and
the roll dialog shows the survivors read-only in its Tags section as flavor prompts.

Two consequences that surprise readers:

- **Drain is excluded** despite carrying none of those flags. It isn't flavor — it has a real
  mechanic (`astirWeaponDrainTotal` reduces the Astir's max Power), it just isn't one expressed
  through a roll-time flag, so it needs the explicit `exclusiveGroup !== DRAIN_GROUP` clause the
  other four conditions would miss.
- **Reroll tags are excluded**, which means nothing in the Tags section tells a player they have a
  reroll available. `_availableRerollTag` exists purely to fill that gap with its own read-only
  display before the player commits to the roll.

Scoping differs from spends: an **unscoped** roll (a move that never involves a weapon) drops every
weapon-kind entry outright, because a weapon's flavor has nothing to say about a roll that doesn't
use one. A spend, by contrast, is an actionable resource a player might burn on any roll, so it
survives. Gear is unfiltered either way.

### Tier is never stored — derive it from the wielder

**No equipment in this module stores its own Tier**, with exactly one exception. Tier is resolved
fresh in `_equipmentEntry`:

| Entry | Tier source |
|---|---|
| Astir / Ardent weapon | the owning frame's `.tier` |
| Mundane weapon, gear | `_conflictTier().base` — the character's own on-foot Tier |
| **Carrier weapon** | `entry.tier` — stored |

The Carrier is the exception because there is no wielder to inherit from: a Carrier has no Tier of
its own, so each slot carries a fixed one (`carrierWeaponTier`). That's also why `configureEquipment`
renders Tier as a visible-but-disabled field for `carrierWeapon` rather than hiding it as it does
for every other flow.

This is why catalog keys carry a `-i` tier suffix (`dagger-i`) while the entries they produce
don't, and why a move granting equipment names it "Hand-casting", not "Hand-casting II".

### Scale is never a player-facing choice

`WEAPON_SCALES` is resolved by flow, never by a `<select>`: the mundane path is always `"foot"`,
`carrierWeapon` is always `"astir"`, and `astirWeapon`/`ardentWeapon` store no scale at all. Scale
drives real behavior (the Piloted mutual-exclusivity that hides mundane weapons while a frame is
mounted), so letting a plain custom weapon be labeled Astir Scale without being flagged `astir: true`
would render as one thing and behave as another.

### Tag exclusivity

Two mechanisms keep contradictory tags off one item. Both resolve through a single function,
`conflictingTagKeys`, and are enforced in a single place: `configureEquipment`'s tag `change`
handler, which unchecks everything that function returns.

#### `exclusiveGroup` — "at most one of these N"

A string on a tag entry; every tag sharing the value forms a mutually exclusive family.

| Group | Members | Required? | Renders as |
|---|---|---|---|
| `WEAPON_RANGE_GROUP` | Melee / Ranged / Sniper | **Yes**, on weapons | native radio group |
| `DRAIN_GROUP` | Drain 1 / 2 / 3 | No | checkboxes |
| `MOUNTED_TWO_HANDED_GROUP` | Mounted / 2H | No | checkboxes |
| `APPROACH_GROUP` | Mundane / Arcane / Divine / Profane / Elemental | No | checkboxes |

`WEAPON_RANGE_GROUP` is the only required group and the only one exempt from `MAX_TAGS` — it's a
pure classifier (all `value: 0`), not a pick. It renders as a native radio group because a checkbox
trio validated only at Save time meant a player who forgot to check one got a warning *after* the
dialog had already closed, discarding everything else they'd entered (Foundry's `Dialog` always
closes after a button callback). A radio group with a default can't reach that state, so the
Save-time range check is now a defensive fallback, not the primary safeguard.

`DRAIN_GROUP` is only rendered on the `astirWeapon` flow — Drain reduces an Astir's Power and does
nothing anywhere else, so offering it elsewhere would be a permanently inert pick. `APPROACH_GROUP`
exists because a weapon overrides your Approach to *one* thing while wielded; its members are
generated from `APPROACHES` (`scripts/core/approaches.js`) so they can't drift from the sheet's own
dropdown. Note that the Approach override is **descriptive only** — `system.attributes.approach` is
a single persistent field with no "actively equipped" state to hang a temporary override off. The
real, wired version of that concept is `chooseApproachOverride`, triggered by Astir Parts.

#### `excludes` — arbitrary pairwise conflicts

An array of tag keys. This exists because `exclusiveGroup` can only describe a **clique** — a set
where every member conflicts with every other — and most real conflicts aren't shaped that way. The
ammo/usage cluster is the proof:

- Limited, Infinite, One-Use and Refresh all conflict with each other.
- Reload conflicts with One-Use and Refresh, but **not** with Limited or Infinite — limited ammo
  that still needs cycling, and endless ammo on a slow-firing weapon, are both coherent.

Those two non-edges make the ruleset a graph, not a clique, so no arrangement of `exclusiveGroup`
strings can express it without also banning the legal combinations.

The full set (asserted verbatim in `tests/equipment-tags.test.js`):

| Pair | Why |
|---|---|
| Limited ⊥ Infinite, One-Use, Refresh | contradictory supply claims |
| One-Use ⊥ Infinite, Reload, Refresh | contradictory supply / readying claims |
| Refresh ⊥ Infinite, Reload | ditto |
| Huge ⊥ Concealable | "never going to hide" vs "easily hidden" |
| Weak ⊥ Impact | "lacking in physical impact" vs "packs a heavy physical punch" |
| Huge ⊥ Bulky | Huge is a strictly more severe Bulky |
| Treasure ⊥ Valuable | Treasure strictly supersedes Valuable |
| Bane ⊥ Ruin | Ruin's own text supersedes Bane |
| Versatile ⊥ Decisive, Defensive | Versatile *is* both |

The last four are strict-superset pairs, and banning them is a value-budget fix as much as a
coherence one: Huge (-2) plus Bulky (-1) banked -3 of credit for a single drawback. Versatile is the
one that changed live behaviour rather than just tidying — because `rerollSpendKey` tracks each tag
independently, Versatile + Decisive granted **two** strike-decisively rerolls per Scene.

Audited and deliberately **not** made exclusive: Distinct/Concealable (a memorable weapon can still
be hidden when not in use), Intimate/Ranged (would need Save-time validation, since range is a
required radio group with nothing to uncheck), Junk/Valuable (a damaged antique can be both), and
Infinite/Drain (Infinite's mechanical meaning is only about running out from a roll).

**Declare each pair exactly once**, on whichever tag reads as the owner. `conflictingTagKeys`
resolves the reverse direction itself, so a second declaration is redundant — and redundancy is the
shape that rots into a half-edit later. The test suite fails on a double declaration, an `excludes`
naming an unknown tag, self-exclusion, or any asymmetry.

#### What enforcement doesn't reach

Enforcement is **UI-side only**: the dialog makes a conflicting pair unreachable, so `invalidReason`
carries no matching Save-time check.

- **Catalog data bypasses it.** `EQUIPMENT_CATALOG`, `ASTIR_WEAPON_CATALOG` and
  `starting-gear-pools.js` hardcode `tags` arrays that never pass through the dialog. The guard is a
  test — "catalog tag combinations" walks all three and fails on any conflicting pair.
- **Move-granted tags bypass it, and this is not fixed.** See Move-granted tags below.
- **Existing saved equipment is grandfathered**, matching "manual trackers, not enforcement". This
  is currently theoretical: nothing in any catalog or pack violated a rule when they were introduced.

### Budget, locking and provenance — the "Equipment" notes

Three independent limits apply in `configureEquipment`, all enforced at Save by `invalidReason`:

| Limit | Value | Notes |
|---|---|---|
| `MAX_TAGS` | 8 | Range tags never count — structurally, since they're never checkboxes. |
| `maxTagValue` | `null` (no cap), or `0` | The "tags must sum to 0 or less" budget rule. |
| `gearOnly` | — | Ward can't land on a weapon. |

**Provenance decides which limits apply**, resolved by `_equipmentEditLockState`:

| Entry | `lockTags` | `maxTagValue` |
|---|---|---|
| `catalogSource: true` | locked | `null` |
| `startingGear: true` | never locked | `null` (permanently budget-exempt) |
| Astir/Ardent weapon, no flag | **locked** | `null` |
| Plain equipment, no flag | **unlocked** | `0` |

The defaults differ by domain on purpose. An Astir/Ardent weapon's *only* prior path was a catalog
pick, so a missing `catalogSource` there means "catalog" — a new custom one persists
`catalogSource: false` explicitly to opt out. Plain equipment could always have been either
catalog-picked or hand-authored, genuinely indistinguishable after the fact, so a missing flag
defaults to unlocked to preserve pre-change behaviour — at the accepted cost that an old plain
custom weapon becomes newly budget-capped on its next edit.

`lockTags` renders Kind/Tier/Range/Tags **disabled rather than omitted**, so a locked entry's design
stays visible through every future edit while Name and Description stay live.

**"Override Max" is a Director escape hatch** gated by `allowOverride` (default
`!carrierWeapon && !lockTags`). One button, two mechanisms depending on whether the entry is a
catalog pick:

1. **Raise a numeric cap** — the original. Clicking raises the live `effectiveMaxTagValue` to a flat
   `OVERRIDE_MAX_TAG_VALUE` (5); clicking again ("Lock Max") commits it down to whatever the checked
   tags actually total, floored at 0 — never back to the original cap, since the player may have
   deliberately settled somewhere in between. Save performs the same lock implicitly.
2. **Unlock a catalog pick** — `lockTags`-only. A catalog entry has no numeric cap at all (the lock,
   not a cap, is what makes it uneditable), so raising one means nothing until the fields are
   unlocked. This flips `catalogUnlocked`, removes `disabled` from every rendered field, and on Save
   resolves `catalogSource: false`, converting the entry into an ordinary custom weapon from then on.

A resolved override persists as `maxTagValueOverride`; every caller already spreads `...result`
wholesale, so it carries forward with no call-site change. The button always rests at "Override Max"
on open, even when re-editing an already-overridden entry, so a Director is never stuck unable to
jump back to the ceiling.

### Starting gear

`chooseStartingGear` opens one playbook's pool. Each group validates its checked count against its
own `chooseCount` independently, so a playbook's weapon and gear budgets can't bleed into each
other. Picked items become ordinary snapshot entries stamped `startingGear: true`.

The pool's custom weapon is a **second, independent dialog** — cancelling one still saves the other.
It excludes Valuable and Treasure outright (`CUSTOM_WEAPON_EXCLUDED_TAG_KEYS`): with no economy
system behind them they'd be free padding to stack against the budget for nothing.

Availability is a **live emptiness check**, not a one-time flag, so a fully-cancelled run leaves the
actor untouched and the button available to try again.

### Move-granted tags — the one real bypass

`_weaponTagKeys` unions an entry's stored tags with two move-driven grants, **at read time, never
persisted**:

- `grantsWeaponTags` — applies to every weapon uniformly (The Attendant's Signed & Sealed).
- `grantsWeaponTagChoice` — a player-chosen tag applied only to the one weapon it names, matched by
  `name` (the same fragile link `grantsEquipment`'s dedupe relies on — renaming the weapon breaks it).

Neither passes through `configureEquipment`, so **neither is subject to `MAX_TAGS`, the value
budget, or tag exclusivity**. A move granting Decisive to a weapon that already has Versatile still
produces a conflicting effective list. Deliberately out of scope: granted tags are transient and
unstored, and the stacking question there is a moves-domain decision, not a tag-catalog one.

### Spends are manual trackers

Nothing knows when a Sortie, Downtime or Scene begins, so no `spent` entry ever clears itself — the
player clears it, same as every other tracker in this module. `mergeSpentTags` is shared by the
sheet's own pre-roll spend and by `move-chat-listeners.js`'s `handleReroll`, which fires from a chat
card click with no sheet instance attached.

### History: `chooseWeapon` became `weaponBundles`

There used to be a third dialog here — `chooseWeapon`, a separate "which weapon?" prompt shown
before the roll dialog. It was folded into `configureMoveRoll` itself as `weaponBundles`, so the
player picks weapon and roll options in one window. "Unarmed" is always the first bundle (the
`UNARMED` sentinel, distinct from the dialog being dismissed, which resolves `null` like every other
picker), except when the caller already knows the weapon and passes `offerUnarmed: false`.

### Shared resolvers exist so a borrowed weapon rolls identically

The six weapon-roll resolvers in `equipment-helpers.js` (`resolveEquipmentSpends`,
`resolveNarrativeWeaponTags`, `resolveForcedWeaponEffect`, `resolveAvailableReroll`,
`resolveAvailableRerollTag`, `weaponTagsAreGuided`) are pure functions of `(tagKeys, entry, ...)`
rather than sheet methods, so a Carrier weapon borrowed via Fire Support resolves the same whether
it's rolled from the Carrier's sheet or a playbook's. Each sheet resolves its own tag-key list first
and passes it in. A `fromCarrier` entry additionally carries `spendActorId`, so a reroll's spend
routes to the Carrier that owns the weapon rather than the rolling actor.
