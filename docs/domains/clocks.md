<!-- Domain conventions for scripts/core/clocks.js and the Gravity/+HOME trackers, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Clocks

There are **three** different clock-shaped trackers in this module, and they are not variants of one
mechanism. Getting them mixed up is the main hazard here:

| | Generic clocks | Gravity Clocks | +HOME |
|---|---|---|---|
| Code | [`scripts/core/clocks.js`](../../scripts/core/clocks.js) | [`tracking-mixin.js`](../../scripts/playbook/playbook-sheet/tracking-mixin.js) | [`home-mixin.js`](../../scripts/playbook/playbook-sheet/home-mixin.js) |
| Stored at | `system.attributes.clocks` (Playbook), `system.attributes.schemes` (Authority) | `system.attributes.gravityClocks` | `system.attributes.home` |
| Shape | id-keyed list | id-keyed list | one object, not a list |
| Steps | per-clock, 2..12 (default 6) | fixed 6 | fixed 6 |
| Cap | none | 4 clocks | one, by definition |
| Extra field | — | `value` (1-3), `target` (free text) | `value` (1-3) |
| Who has it | everyone, always | everyone, always | The Adrift only |
| Touches a roll | no | yes — substitutes for a Trait | yes — substitutes for CHANNEL |

> **Note:** `scripts/core/clocks.js` is the path. Older pointers (including claude.md's own domain
> index) say `scripts/playbook/clocks.js`; the file moved to `core/` when it stopped being
> playbook-only — the Authority sheet imports it too.

## Generic clocks (`scripts/core/clocks.js`)

Reusable narrative clocks: "start or advance a 4-step clock titled *court-martialled*". Any actor
can start one whenever the fiction calls for it — not tied to a playbook, a trigger, or a move.

Five pure array helpers, no Foundry API beyond `randomID`, same testability reasoning as
[`entry-list.js`](../../scripts/world-actors/entry-list.js)'s CRUD helpers:

```js
addClock(list, { label, steps })     // appends { id, label, progress: 0, steps }
removeClock(list, id)
updateClockLabel(list, id, label)
updateClockSteps(list, id, steps)
setClockProgress(list, id, step)
```

Two invariants live in those helpers rather than at the call sites:

- **`updateClockSteps` never leaves stored data past its own bound.** Steps are clamped to
  `CLOCK_STEPS_MIN`..`CLOCK_STEPS_MAX` (2..12), *and* `progress` is pulled back down if shrinking
  the clock would leave it exceeding the new step count. A non-numeric input falls to
  `CLOCK_STEPS_MIN`, not to the default.
- **`setClockProgress` is click-to-set with click-the-top-step-to-decrement.** Clicking the
  currently-filled top step clears it by one; clicking any other step fills up to it. That's the
  same interaction as Spotlight (`_onSpotlightStep`) and Gravity progress
  (`_onGravityClockStep`) — deliberately, so every progress track on every sheet behaves the same
  way under the same click.

### Two consumers, thin wiring on both

Both callers keep the same split: **thin sheet wiring over a pure helper.** The sheet handler reads
the `data-clock-id` (and `data-step`) off the clicked element, calls the pure function, and writes
the result.

- **Playbook sheet** — `tracking-mixin.js`'s `_onClockAdd`/`_onClockRemove`/`_onClockLabelChange`/
  `_onClockStepsChange`/`_onClockStep`, rendered from `_clocksData()` under a universal,
  always-visible Clocks section (no playbook gating at all).
- **Authority sheet** — the same five handlers named `_onScheme*`, rendered from `_schemesData()`.
  Identical markup and classes (`.clock-add`, `.clock-step`, …); "Schemes" is just this sheet's own
  name for the section. See [world-actors.md](world-actors.md).

Both `_clocksData()`/`_schemesData()` expand each clock into a `progressSteps` array
(`{ step, filled }`) sized to *that clock's* own `steps`, since Handlebars can't count.

## Gravity Clocks

Per-character relationship tracks on the Social tab, next to the playbook's Gravity Trigger text.
Each has a label, a fixed-6-step progress track, a free-text **target** (who the Gravity is *with*),
and a separate **value** of 1-3. Up to `GRAVITY_CLOCK_MAX` (**4**) per character.

They are deliberately **not** built on `clocks.js`: the step count is fixed, the extra `value`/
`target` fields exist, and the cap exists — so `tracking-mixin.js` carries its own `_onGravityClock*`
handlers rather than routing through the generic helpers. The interaction on the progress track is
nonetheless identical (`_onGravityClockStep` duplicates the click-top-to-decrement logic).

The cap is enforced in two places: `_onGravityClockAdd` returns early at `GRAVITY_CLOCK_MAX`, and
`_gravityClocksData`'s `canAdd` hides the control.

### Gravity Clocks as a roll-time Trait substitute

This is the only place a clock reaches into the dice, and it works by synthesizing a **virtual
trait**.

1. `_availableGravityClocks()` offers only clocks with a `target` set — an untargeted clock has
   nothing to label a substitution with, so it's excluded rather than shown blank.
2. If that list is non-empty *and* the move has no `lockedTrait`, the roll dialog renders a
   **"Has Gravity" checkbox**. Ticking it swaps the Trait select for a Gravity Target select (a
   plain class toggle in the `render` callback — no re-render).
3. On Roll, a checked box plus a picked target resolves the trait as:

   ```js
   { key: `gravity:${clock.id}`, label: clock.target, value: clock.value }
   ```

That `gravity:`-prefixed key is **outside `TRAITS`**, and that is the whole trick. `rollMove`
already branches on `TRAITS.some(t => t.key === trait.key)` to decide whether to re-read a live actor
stat or trust `trait.value` directly, so a non-`TRAITS` key automatically takes the trust-the-value
path. `_finishMoveRoll`'s trait-bonus lookup safely no-ops to 0 for a key it doesn't recognise. **No
downstream change was needed anywhere for this to work** — the same pattern `home` and
`eidolon-drive-ally` use.

4. `rollMove` detects `trait.key.startsWith("gravity:")` and adds an unconditional chat reminder,
   *regardless of result tier*:

   ```
   Advance this GRAVITY clock with <target>.
   ```

**Nothing writes to the clock.** Rolling with Gravity is exactly the moment a Gravity Trigger might
apply, so the module nudges the player and stops there — manual trackers, not enforcement.

### Gravity Triggers

[`gravity-triggers.js`](../../scripts/playbook/gravity-triggers.js) holds the per-playbook trigger
text, keyed by `system.playbook.slug` (the same convention `approaches.js` uses — **not**
`PLAYBOOKS[].name`, which is what `MOVE_POOLS` keys on). It's display-only text rendered in the
Social tab's Gravity section; it grants nothing and fires nothing.

An entry is normally one fixed string, but may instead be an **object keyed by starting-move key**
when the trigger varies by which starting move was picked — The Advocate is the live example
(`the-advocate:earthly-ally` vs. `the-advocate:titanic`). `gravityTriggerForPlaybook` resolves either
shape, and returns `null` both for a playbook with no entry and for an object-shaped entry whose keys
don't match any picked move.

## +HOME (The Adrift)

Love, Love, Love: *"instead of a +CHANNEL trait, you have an additional GRAVITY clock … treated as
your +CHANNEL trait in all circumstances, and referred to as +HOME."*

Stored as a single object at `system.attributes.home` (`{ progress, value }`), not a list — there is
only ever one. It reuses the Gravity constants (`GRAVITY_CLOCK_PROGRESS_MAX`,
`GRAVITY_CLOCK_VALUE_MIN/MAX`) for its bounds and `_homeData()` is shaped like one
`_gravityClocksData()` entry, so the Social-tab widget renders identically.

Two things make it its own file rather than a branch inside `tracking-mixin.js`:

- **`home` is deliberately not a seventh `TRAITS` entry.** `core/traits.js` stays exactly six
  entries, because every consumer of `TRAITS` in this module assumes fixed-at-six. Instead
  `_homeTraitOption()` injects `{ key: "home", label: "HOME", value }` into a move's trait list the
  same way a `fixedTraits` entry (e.g. Lead a Sortie's CREW) is injected — and, being outside
  `TRAITS`, it takes the trust-`trait.value` path in `rollMove` with zero changes there.
- **It is the one clock in the module that advances itself.** The Adrift's Gravity Trigger is
  "whenever you use your +HOME clock, advance it", which is mechanical enough to automate:
  `move-roll-mixin.js`'s `_rollMove` calls `_advanceHome()` whenever the resolved trait key is
  `home`. It clamps at `GRAVITY_CLOCK_PROGRESS_MAX` and no-ops when already there.

  It is **not** applied on Guided's "Take 7-9" early-return path — no trait was actually rolled
  there, so there is nothing to advance.

`_onHomeProgressStep`/`_onHomeValueStep` still exist alongside the automatic advance, giving the
player manual override and correction — matching the module's manual-tracker stance everywhere else.

`_homeMove()` (does this actor have a move flagged `grantsHomeInsteadOfChannel`?) is the gate for
rendering the section at all, and doubles as the lookup for the move object itself.

## Adding a clock somewhere new

Use `core/clocks.js` unless the new tracker genuinely needs a fixed step count plus extra per-entry
fields. Wiring one up is: a `_xData()` that expands `progressSteps`, five thin handlers delegating to
the pure helpers, and the existing `.clock-*` classes in the template — the Authority's Schemes
section is the worked example of doing exactly that on a sheet that isn't the Playbook sheet.

## See also

- [world-actors.md](world-actors.md) — the Authority's Schemes section
- [moves.md](moves.md) — `fixedTraits` and how a move declares its own trait options
