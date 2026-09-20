<!-- Domain conventions for scripts/world-actors/, split out of claude.md — see claude.md for cross-cutting conventions. -->

# World actors

Everything in the world that isn't a player character: the **Carrier** (the players' moving base),
the **Authority** (the empire being fought), the **Cause** (the loose alliance fighting it), and the
**NPC** (the minimal "something with a Tier you can point at"). All four are Foundry Actors with
their own `type`, declared in [module.json](../../module.json)'s `documentTypes.Actor` block as
`carrier` / `authority` / `cause` / `npc` and addressed in code as `armor-astir.<key>`.

They are *not* playbooks. A playbook is a `character` actor that ships in a compendium pack (see
[packs.md](packs.md)); a world actor has no compendium entry at all — it is built from a literal in
[actor-creation.js](../../scripts/actor-creation.js)'s `WORLD_ACTOR_KINDS`.

### File layout

| File | Holds |
|---|---|
| `world-actor-sheet.js` | `WorldActorSheet` — the shared base class: generic id-keyed list CRUD |
| `entry-list.js` | `addEntry`/`removeEntry`/`updateEntryField` — pure array helpers, no Foundry API but `randomID` |
| `carrier-actor-sheet.js` | `CarrierActorSheet`, `WEAPON_SLOTS`, `carrierWeaponTagKeys`, `findCarrierActors`, `findAssignedPlaybookActors`, `chooseCarrier` |
| `authority-actor-sheet.js` | `AuthorityActorSheet`, `STABILITY_MAX`, `PILLARS_PER_DIVISION` |
| `division-kinds.js` | `DIVISION_KINDS` catalog + `findDivisionKind` |
| `cause-actor-sheet.js` | `CauseActorSheet` |
| `faction-kinds.js` | `FACTION_KINDS` catalog + `findFactionKind` |
| `npc-actor-sheet.js` | `NpcActorSheet`, `NPC_ACTOR_TYPE` (the orchestrator) |
| `npc-sheet/*.js` | `NpcEquipmentSheetMixin`, `NpcAstirSheetMixin`, `NpcArdentSheetMixin`, `NpcMovesSheetMixin` |

Templates live at `templates/<kind>-actor-sheet.hbs`, with per-section partials under
`templates/authority-sheet/`, `templates/cause-sheet/` and `templates/npc-sheet/`. Every partial has
to be listed in [main.js](../../scripts/main.js)'s `AUTHORITY_SHEET_PARTIALS` /
`CAUSE_SHEET_PARTIALS` / `NPC_SHEET_PARTIALS` and passed to `loadTemplates` in the `init` hook, or
Foundry throws on first render. Styling is split across `styles/world-actor-shared.css` (all three
`WorldActorSheet` descendants), `styles/authority-sheet.css` and `styles/cause-sheet.css`.

Each sheet registers itself from its own `register*ActorSheet()` export, called at the bottom of
`main.js` — not from a central registry.

## The shared base: three data attributes, no per-list handlers

`WorldActorSheet` exists because Carrier, Authority and Cause are all, structurally, the same thing:
one or more **id-keyed lists under `system.attributes`**. Rather than a handler per list, every
editable control carries three data attributes and rides one of four generic handlers:

| Attribute | Meaning |
|---|---|
| `data-list` | which key under `system.attributes` the list lives at |
| `data-entry-id` | which entry in that list |
| `data-field` | which field on that entry |

- `.entry-list-add` → `_onEntryAdd` (appends `_entryDefaults()` with a fresh `randomID`)
- `.entry-list-remove` → `_onEntryRemove`
- `.entry-list-field` → `_onEntryFieldChange` (branches on `type === "checkbox"`, so text inputs,
  textareas and checkboxes all share one handler)
- `.entry-list-counter-step` → `_onEntryCounterStep` (also reads `data-delta`/`data-min`/`data-max`)

**The consequence worth knowing: a new list, or a new clamped +/- counter, on any of these three
sheets needs template markup only — no new JS.** That is the whole point of the base class, and the
reason to reach for these classes rather than adding a bespoke handler.

`_entryDefaults(key)` is the one override point, so a concrete sheet can seed list-specific fields
(Crew Members' `position`, Factions' `exhausted`/`seized`/`grip`/`kind`) without the base class
knowing every list's shape.

**Fixed-slot lists use the same machinery.** The Authority's three Divisions and nine Pillars are
ordinary id-keyed lists that happen to be seeded at creation and never rendered with an add/remove
control. They edit through the exact same `_onEntryFieldChange`/`_onEntryCounterStep` as a freeform
list — there is no second "fixed slot" code path.

`entry-list.js` keeps the CRUD itself free of any Foundry API beyond `randomID`, so it is testable
without stubbing `actor.update`. [tracking-mixin.js](../../scripts/playbook/playbook-sheet/tracking-mixin.js)
imports those same three helpers for the Playbook sheet's Ace Crew and Hooks lists, wiring them by
hand since `PlaybookActorSheet` doesn't extend `WorldActorSheet`.

## The Carrier

The players' moving base. One trait (**Crew**, bounded -3..+3 to match the playbook sheet's own
`TRAIT_MIN`/`TRAIT_MAX`), a free-text description, a freely-picked Approach (the full `APPROACHES`
list — a Carrier has no playbook to restrict it), a Crew Members roster, a shared Crew Support hold
pool, a read-only Quarters section, and two weapon slots.

Only two things on the sheet fall outside the generic entry-list shape, which is the entire reason
`CarrierActorSheet` exists as a subclass: the Crew stepper (a top-level stat, not a list) and the
weapons section (which goes through `configureEquipment`'s dialog, not a plain field).

### The Carrier carries two named, fixed-role weapon slots

```js
export const WEAPON_SLOTS = [
    { key: "primary",   tier: TIER_MAX, label: "Tier V Weapon",   lockedTagKeys: ["set-up", "mounted"], maxTagValue: 2 },
    { key: "secondary", tier: 3,        label: "Tier III Weapon", lockedTagKeys: ["mounted"],           maxTagValue: 1 }
];
```

Unlike a playbook character's equipment — a flat array under `system.attributes.equipment` — a
Carrier's weapons live in a **slot-keyed object** at `system.attributes.weapons`, one entry per
`WEAPON_SLOTS` key, with `null` meaning "slot empty". Each slot fixes three things the player can't
change:

- **Tier.** A Carrier has no personal Tier stat; the weapon's slot *is* its Tier. `primary` is
  Tier V (`TIER_MAX`), `secondary` is Tier III. The value is written onto the stored entry at
  add/edit time (`tier: slot.tier`) as well as read off the slot.
- **Locked tags.** `lockedTagKeys` are always in effect and are never offered in the editor — they
  go into `excludedTagKeys` on the `configureEquipment` call alongside `two-handed`, which a
  Carrier weapon never takes.
- **Tag-value budget.** `maxTagValue` is 2 for the primary, 1 for the secondary.

`carrierWeaponTagKeys(slot, entry)` is the single source of a weapon's **effective** tag list: its
own stored `tags` unioned with the slot's `lockedTagKeys`. It's exported as a standalone function
rather than only existing as the sheet's `_weaponTagKeys` method specifically so that
[move-roll-mixin.js](../../scripts/playbook/playbook-sheet/move-roll-mixin.js) can pre-merge those
locked tags when a Playbook character borrows the weapon (below).

The slot-keyed shape has one real cost, and it's worth knowing where it surfaces: every
array-shaped equipment write needs a slot-keyed twin. That's why
[equipment-helpers.js](../../scripts/equipment/equipment-helpers.js) carries both `mergeSpentTags`
(array) and `mergeSpentWeaponSlotTags` (slot-keyed object), with `spendEquipmentTagsOnActor`
branching on which shape the target actor stores — so a caller spending a tag never has to know
whether it's writing to a Playbook or a Carrier.

In-card buttons address a weapon by `data-equipment-id`, because the shared
`templates/shared/equipment-card.hbs` partial is written against an id, not a slot key.
`_weaponSlotForId` maps back.

### Borrowed weapons: Fire Support

The Captain's **Fire Support** ("using … the Carrier's weaponry") folds the world's Carrier weapons
into a Playbook character's own weapon choice for that roll. `move-roll-mixin.js` shallow-copies
each Carrier weapon with:

```js
{ ...entry, tags: carrierWeaponTagKeys(slot, entry), fromCarrier: true, carrierActorId: carrier.id }
```

The Carrier's stored array is never mutated. `fromCarrier` is the flag every downstream weapon-roll
method branches on (`_equipmentSpends`, `_narrativeWeaponTags`, `_forcedWeaponEffect`,
`_availableReroll`, `_weaponIsGuided` in
[equipment-mixin.js](../../scripts/playbook/playbook-sheet/equipment-mixin.js)) to route through the
shared `resolve*` resolvers instead of its own actor-scoped versions, and `carrierActorId` is what
`_finishMoveRoll` uses to write any spend back onto the Carrier that actually owns the weapon.
That is why those resolvers were pulled out of the mixin into `equipment-helpers.js` in the first
place — so a borrowed weapon rolls *identically* to a native one.

**Only offered when exactly one Carrier exists in the world.** Zero or multiple is left unresolved
with no prompt and no throw — the same simplification `_crewFixedTraitValue` already makes for
CREW's own display value.

### Tier and Approach matchups

A Carrier rolls Exchange Blows / Strike Decisively directly from its own sheet, always `+CREW`
(no trait choice, no Unarmed option — with no weapon there's simply no button to click). Against a
single targeted NPC it gets both matchup axes:

- `_targetTierRollModifier(slot)` — Tier advantage/disadvantage, using the **slot's** fixed Tier as
  the attacker's, via `target-tier.js`'s shared `tierMatchupAdvantage`/`tierRollModifier`.
- `_targetApproachRollModifier(lockedEffect)` — the Effect-axis sibling, masked to `null` whenever
  `lockedEffect` is already set ("compose, not compete").

`getTargetedNpc()` resolves a target only when there is **exactly one** target and it is
specifically an NPC actor. Another Playbook character, a Carrier/Authority/Cause, or an ambiguous
multi-target selection all resolve to `null`.

### Quarters (read-only mirror)

Quarters themselves belong to the *Support playbook character* that owns them
([quarters.js](../../scripts/playbook/quarters.js)): a name, a description, and up to
`QUARTERS_BENEFIT_MAX` (2) picked benefits. The Carrier sheet renders a read-only roster of them —
editing only ever happens on the owning playbook actor's sheet.

`findAssignedPlaybookActors(carrierId)` picks the rows: every `character` actor whose
`system.playbook.slug` is in `SUPPORT_PLAYBOOK_SLUGS` **and** whose Quarters has been touched at all
(`hasQuarters` — a name, description, or at least one benefit; an untouched section shouldn't
clutter every Carrier). With 0 or 1 Carrier in the world there's nothing to choose between, so the
`carrierId` filter is skipped entirely and every such actor is shown — mirroring how the +CREW roll
only prompts `chooseCarrier` once `findCarrierActors().length > 1`.

Of the four benefits only `extra-token` carries a real mechanical effect (it feeds
`progression-mixin.js`'s `_bonusDowntimeTokenKeyedSources`); the other three are tracked as a pick
and applied by hand.

### What else reads a Carrier

`findCarrierActors()` (every `armor-astir.carrier` in `game.actors`) is imported by six Playbook-side
mixins — `frames-mixin`, `move-roll-mixin`, `move-tracking-mixin`, `move-traits-mixin`,
`moves-mixin`, `quarters-mixin` — to resolve a live +CREW value, the Crew Support hold pool, and
Fire Support's weapon list. `system.attributes.crewSupportHold` is a single **Carrier-wide** counter,
not a per-character copy: the Carrier sheet's own stepper and a playbook character's Crew Support
move card write to the same field. Its bounds are read off the `crew-support` move's own
`numericTrackers[0]` rather than re-declared as magic numbers.

## The Authority

The empire/oppressor. A **Stability** rating (1..9, seeded at max), exactly **three Divisions**, and
exactly **three Pillars per Division** (nine total) — all seeded by `createWorldActor`, so the sheet
always has a full set to render and neither list gets an add/remove control.

**Pillars are a flat list with a foreign key, not nested inside Divisions.**
`system.attributes.pillars` is one flat array where each entry carries `divisionId` pointing back at
its owning Division. This is what lets GRIP / Felled / the kind-select all ride the base class's
generic handlers unchanged — those handlers only know how to read and write *one flat list at a
time*. `_divisionsData()` re-groups them by `divisionId` for rendering. The same flat shape the
Cause's Factions already use.

Derived fresh every render, never stored:

- `vulnerable` = `losses >= strength` — drives the red VULNERABLE badge (reusing the Playbook
  sheet's `.defenseless-label` class).
- `passiveOutcome` / `activeOutcomes` — resolved from the Division's `kind` key against
  `DIVISION_KINDS`.

`kindOptions` is attached **per division** rather than once at the top of `getData`'s return, purely
so the template's `{{selectOptions kindOptions …}}` needs no `{{../}}` hop from inside
`{{#each divisions}}`.

Stability's own stepper is a plain click-to-set: unlike Spotlight or Gravity Clock progress (which
bottom out at 0 and support click-the-top-step-to-decrement), Stability's floor is **1** — there is
no empty state to decrement into.

**Schemes** are generic narrative clocks stored at `system.attributes.schemes` — same widget markup,
same `clocks.js` helpers as the Playbook sheet's Clocks section, just under this sheet's own name for
it. See [clocks.md](clocks.md).

Seeded values (`actor-creation.js`): Divisions start at Strength 5/4/4, Disfavor 0, Losses 0; Pillars
at `grip: 0`, `felled: false`; `kind` is deliberately left `""` on both Divisions and Factions,
because picking it is a GM rules decision, not something the code should guess.

## The Cause

The loosely organized factions opposing the Authority. Two independent freeform rosters —
`system.attributes.factions` and `system.attributes.waywardFactions` (a Faction that's broken from
the Authority's control) — sharing one entry shape: name, description, an exhausted/refreshed
checkbox, a seized/unseized checkbox, a Grip counter (0-3), and a `kind` key.

This is the thinnest of the three. Checkboxes go through `_onEntryFieldChange`, Grip through
`_onEntryCounterStep`; **the only reason `CauseActorSheet` exists rather than using `WorldActorSheet`
directly is `_entryDefaults` seeding those extra fields** — plus `_factionsData`, which defaults a
missing `grip` to 0 (Factions created before Grip existed have no such field) and attaches the
resolved kind's text.

## The NPC

The minimal "something in the world with a Tier" actor: name, description, a freely-picked Approach,
a Tier stepper (`TIER_MIN`..`TIER_MAX`), a Rival tracker, and full Equipment / Astir / Ardent /
Moves support.

**It extends `ActorSheet` directly, not `WorldActorSheet`** — an NPC has no entry-list at all, so
inheriting the list-CRUD machinery would add nothing but unused surface.

Its four tabs are mixins merged with `Object.assign` onto the prototype, the same pattern
`PlaybookActorSheet` uses. Each is a **deliberately trimmed** port of the Playbook-side equivalent,
and the governing fact is: **an NPC never rolls.** So each mixin drops every roll-dialog-only
concept:

| Mixin | Trimmed relative to the Playbook sheet |
|---|---|
| `equipment-mixin` | no `weaponMoves`, spends, narrative tags, reroll/guided/forced-effect resolution, starting gear — just add/catalog-pick/edit/remove |
| `astir-mixin` | no CHANNEL-availability gate, no Sortie-scoped Extra Parts/Weapons pools, no Potions, no guided-move dropdown; the unique Move is freely pickable (no playbook to require one) |
| `ardent-mixin` | no Extra Parts/Weapons pool, no Commander "Ardent Features" carve-out, Piloted is an independent checkbox with no Mount Up/Dismount exclusion |
| `moves-mixin` | attach/detach plus the chat and rules-text buttons; no traits, hold or uses tracking |

`equipment-card.hbs` is shared with the Playbook sheet unchanged: passing no `weaponMoves` and never
marking a tag `spendable` is exactly what keeps it roll-free, so the partial needed no NPC-specific
branch.

**Tier resolution differs from the Playbook sheet.** An Astir/Ardent-owned weapon inherits its
frame's Tier and the `astir` scale; a mundane weapon uses the NPC's own Tier — there is no
on-foot-vs-mounted distinction to resolve the way `_conflictTier` covers on the player side.

The **Rival** tracker is a checkbox plus Target/Need/Want text and an unbounded Hold counter, with
the Leverage rules text rendered inline. Everything but the checkbox is hidden until it's ticked.

An NPC is also the only actor `getTargetedNpc()` will resolve to, which makes it the input to both
matchup axes (`target-tier.js`, `approach-matchup.js`) wherever a Playbook character or Carrier rolls
at a target.

## Creation and seeding

`WORLD_ACTOR_KINDS` in [actor-creation.js](../../scripts/actor-creation.js) is the one place each
kind's starting `system` data lives. Unlike `PLAYBOOKS`, these are **not compendium-backed** —
`buildSystem()` returns the data directly, and it's a function called freshly per creation
specifically so array/object fields are never shared by reference between two actors made from the
same entry.

`createWorldActor` always sets `prototypeToken.actorLink: true` — these are world-unique actors, not
things you stamp out copies of.

The sidebar's Create Actor button is intercepted by `registerPlaybookActorCreation`, which fronts
everything with `chooseActorKind` (Playbook, or one of the `WORLD_ACTOR_KINDS` names). The
interception itself has to work on two different Foundry generations: v12's AppV1 sidebar binds the
click directly, while v13+'s AppV2 `ActorDirectory` dispatches through a delegated `data-action`
listener on the application root. Hence `cloneNode` + `replaceWith` (strips any v12-style direct
listener), `capture: true`, and `stopImmediatePropagation` in the handler — without all three, a
v13+ click opens both the kind picker *and* core's own Create Actor dialog.

## Recurring conventions

These are the module-wide conventions from claude.md, and how they land here specifically:

- **Catalog in code, keys on the actor.** `DIVISION_KINDS` and `FACTION_KINDS` hold the definitions;
  the actor stores only the chosen `kind` key. Edited outcome text reaches existing Authorities and
  Causes with no data migration. Both are resolved fresh in `getData` and rendered read-only — the
  same convention `astir-parts.js`'s `partType` follows.
- **Derive fresh every render, never persist.** `vulnerable`, the resolved kind text, `kindOptions`,
  Stability's expanded step array, a Scheme's `progressSteps`, and the Quarters roster are all
  computed in `getData`.
- **Manual trackers, not enforcement.** Nothing here resets itself — not Grip, not Disfavor, not
  Losses, not exhausted/seized, not Rival hold, not the Crew Support pool.

One genuine presentational difference between the two kind catalogs: `DIVISION_KINDS`' `passive`
and `active` strings contain embedded HTML (`<p>`, `<ul>`), so the template renders them with
`{{{ }}}`; `FACTION_KINDS`' ten `opposes`/`outcome` strings are plain text and render with `{{ }}`.
Don't mix them up when adding to either catalog.

## See also

- [equipment.md](equipment.md) — the tag catalog, `configureEquipment`, and the shared `resolve*`
  weapon-roll helpers a Carrier weapon depends on
- [clocks.md](clocks.md) — the Schemes clocks the Authority sheet renders
- [frames.md](frames.md) — the Astir/Ardent catalogs the NPC sheet's mixins reuse
- [packs.md](packs.md) — why playbooks are compendium-backed and world actors aren't
