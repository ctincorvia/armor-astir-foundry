# Turn several dialog "Lock" sources into forced (uncheckable) Roll Modifiers

## Context

Today several standing effects lock the pre-roll dialog's Advantage/Disadvantage or Confidence/
Desperation via the "Lock" mechanism (`lockedAdvantage`/`lockedEffect` in `configureMoveRoll`),
which disables the whole Dice/Effect notch slider and shows a static "Locked: X" note, with no
way for the player to interact with the signal short of moving a slider they can't touch:

- Being a Tier higher/lower than a targeted NPC (`_targetTierAdvantage`) → Advantage/Disadvantage.
- A favorable/unfavorable Approach matchup against that NPC (`_targetMatchupEffect`) → Confidence/Desperation.
- Don't Follow Me (The Impostor)/Born Leader (The Captain)/Legacy (an Astir Move) — three
  playbook sources that all grant a standing Advantage lock on one specific move through the same
  shared, generic resolver, `_grantedAdvantageForMove`/`_grantingMoves()` (this module's
  "declarative flag, evaluated generically" convention means there's no way to single out Don't
  Follow Me alone here — migrating it migrates all three).
- Cold Company (The Wither) — a standing, actor-wide Advantage/Disadvantage lock on *every* roll
  this actor makes (`_coldCompanyAdvantage`), not scoped to any one move.

The user wants all of these to instead surface as entries in the dialog's existing "Roll
Modifiers" section — pre-checked, and *functioning exactly like any other Roll Modifier*
(composes with the chain via `roll-chain.js`, can still be overridden by moving the Dice/Effect
steppers directly) — with the one difference that the checkbox itself can't be unchecked.

**Two things stay untouched, deliberately out of scope:**
- Don't Follow Me's *other* half, `grantsTraitOnMove` (`lockedTrait`, the Trait select) — Roll
  Modifiers have no "trait" dimension in this codebase's data model (only `advantage`/`effect`),
  so this can't move into the same mechanism. It stays exactly as today: a disabled `<select>`
  with its own "Locked: DEFY" note, unrelated to the Advantage-axis change to the same move.
- Every other lock source: forced weapon tags, Field Scout's standing Confidence grant
  (`grantsEffectOnMove`), pending/deferred roll-modifier grants (Snakes in the Grass, etc.), and
  the two "emergency" desperation locks — `forcesDesperationAtMaxPerils` (bite-the-dust) and
  `forcesDesperationOnShakenTenet` (weave-magic), so named because they react to the character
  being in a crisis state (every Danger slot full of Perils, or a broken Tenet) rather than being
  a standing grant or a passive read of the current target; that's why they sit at the *highest*
  precedence in `_lockedEffectFor` today. None of these were named by the user, and none of them
  fit "a boon/debuff from comparing yourself to something" the way Tier/Approach/Cold Company/the
  Advantage-grant trio do — they keep disabling the whole slider exactly as today.

## Design

### Effect axis (Confidence/Desperation) — unchanged from the original design
`_targetMatchupEffect` is still the only thing moving on this axis. Remove it as the trailing `??`
fallback from `_lockedEffectFor` (`scripts/playbook/playbook-sheet/move-roll-mixin.js`), and add a
`_targetMatchupRollModifier(move, lockedEffect)` resolver (masked out whenever `lockedEffect` is
still non-null after removing that fallback — i.e. a genuine hard lock already claims Effect).

### Advantage axis (Advantage/Disadvantage) — three sources now compete for one Roll Modifier slot
Unlike Effect, three different signals can each want to occupy the Advantage axis: the shared
Advantage grant (Don't Follow Me/Born Leader/Legacy), Cold Company, and Tier. Only one can ever be
"the" forced entry at a time (they all move the same single axis), so — mirroring the *exact*
precedence order `_lockedAdvantageFor` already uses today — introduce one function that resolves
all three via an ordinary `??` chain and returns at most one entry:

```js
// move-grants-mixin.js
_advantageRollModifier(move) {
    return this._grantedAdvantageRollModifier(move)   // Don't Follow Me / Born Leader / Legacy
        ?? this._coldCompanyRollModifier()             // Cold Company
        ?? this._targetTierRollModifier(move)          // Tier vs. targeted NPC
        ?? null;
}
```

`_lockedAdvantageFor` (`move-roll-mixin.js`) shrinks to just its one remaining genuine hard-lock
source, `pendingGrant`, masked by `_advantageRollModifier` so a deferred grant's Advantage half
never surfaces as a competing hard lock once one of the three roll-modifier sources already claims
the axis (replicating today's `??` order, where Don't Follow Me/Born Leader/Legacy and Cold
Company both already out-rank `pendingGrant?.advantage`):

```js
_lockedAdvantageFor(move, pendingGrant) {
    if (this._advantageRollModifier(move)) return null;
    return pendingGrant?.advantage ?? null;
}
```

Because masking is now fully self-contained inside `_advantageRollModifier`, **`_rollModifiersForMove`
doesn't need a `lockedAdvantage` parameter at all** — it just calls `this._advantageRollModifier(move)`
directly. No threading of `lockedAdvantage` through `_weaponRollBundle`/`_rollMoveWithWeaponChoice`
is needed; the function's signature stays `_rollModifiersForMove(move, lockedEffect)`, unchanged
from today.

Unlike the Effect-axis change, this one reaches **every roll**, not just `usesWeapon` ones — Cold
Company and the Advantage-grant trio apply to any move (Lead a Sortie, Dispel Uncertainties, etc.),
only Tier stays internally gated on `move.usesWeapon` (via `_targetTierAdvantage`'s own existing
guard). `_rollModifiersForMove` is already called from both `_rollMove`'s single-weapon path and
`_weaponRollBundle`'s per-bundle path, so this falls out for free — no new call site needed.

### The "forced" Roll Modifier shape
A `forced` entry is an ordinary Roll Modifier entry with one extra `forced: true` flag. It carries
a real `advantage`/`effect` step, no resource gate (`disabled: false`), and composes through the
exact same `chainEntryResult`/`reverseChainStep` machinery every other entry uses — the only
special case is presentation: its checkbox renders `checked disabled` (can't be unchecked) instead
of the normal enabled/unavailable states, and it's pre-folded into the dialog's initial
`currentAdvantage`/`currentEffect` seed at open (mirroring what checking it "would" do) via
`roll-chain.js`'s existing `resolveRollChain` helper, rather than the player having to check it
themselves. Because it's disabled-when-checked, the browser physically can't fire an uncheck
event — no new "prevent unchecking" logic needed anywhere in the render callback's event wiring.

## Files to change

### `scripts/playbook/playbook-sheet/move-roll-mixin.js`
- `_lockedEffectFor(move, weapon, pendingGrant)` (~L130): drop the trailing
  `?? this._targetMatchupEffect(move)`.
- `_lockedAdvantageFor(move, pendingGrant)` (~L162): replace the whole body with the
  `_advantageRollModifier`-masked form shown in the Design section above — drops
  `_grantedAdvantageForMove`, `_coldCompanyAdvantage`, and `_targetTierAdvantage` entirely, keeping
  only `pendingGrant?.advantage`, masked by `_advantageRollModifier(move)`.
- Update both functions' doc comments — point to `_rollModifiersForMove`'s/`_advantageRollModifier`'s
  new `forced` entries for what used to be documented here as the tail of each precedence chain.
- No other changes needed in this file: `_rollModifiersForMove`'s signature is unchanged
  (`move, lockedEffect`), so its two existing call sites (`_rollMove`'s single-weapon path,
  `_weaponRollBundle`) need no new argument threaded through.

### `scripts/playbook/playbook-sheet/move-grants-mixin.js`
- Add a `_grantingMoveForAdvantage(move)` finder, extracted from the existing
  `_grantedAdvantageForMove` (~L105-108) the same way `_grantingMoveForFailureReminder`/
  `_grantedFailureReminderForMove` are already split — needed so the new roll-modifier resolver
  below can read the granting move's own `.name` for its label, mirroring how every other
  Roll-Modifier entry already defaults its label to its source's name:
  ```js
  _grantingMoveForAdvantage(move) {
      return this._grantingMoves().find((m) => m.grantsAdvantageOnMove?.moveKey === move.key) ?? null;
  }
  _grantedAdvantageForMove(move) {
      return this._grantingMoveForAdvantage(move)?.grantsAdvantageOnMove.advantage ?? null;
  }
  ```
- Add four new resolvers, each returning a Roll-Modifier-shaped object or `null`, plus the
  combinator that chains them (all next to `_targetTierAdvantage`/`_targetMatchupEffect`):
  - `_grantedAdvantageRollModifier(move)`: wraps `_grantingMoveForAdvantage(move)` — covers Don't
    Follow Me, Born Leader, and Legacy uniformly, since all three set the same
    `grantsAdvantageOnMove` flag. `key`: derived from the granting move (e.g.
    `` `granted-advantage-${granting.key}` ``, so it can never collide across sources since only
    one can ever be granted for a given move+actor). `label`: `` `${granting.name}: Advantage` ``
    (or `Disadvantage`, though no catalog entry grants that today).
  - `_coldCompanyRollModifier()`: wraps `_coldCompanyAdvantage()`/`_coldCompanyMove()`. `key`:
    `"cold-company-advantage"`. `label`: e.g. `"Cold Company: Dispelled"` (advantage) /
    `"Cold Company: Haunted"` (disadvantage), matching the move's own `uses` checkbox label
    ("Dispelled") for the dispelled/advantage state.
  - `_targetTierRollModifier(move)`: wraps `_targetTierAdvantage(move)` (no masking parameter
    needed — see below). `key`: `"target-tier-matchup"`. `label`: "Tier Advantage"/"Tier
    Disadvantage".
  - `_targetMatchupRollModifier(move, lockedEffect)`: wraps `_targetMatchupEffect(move)`, `null`
    when `lockedEffect` is already set (this one *does* still need its own masking parameter — see
    below, it has no sibling roll-modifier competitors on the Effect axis to chain through). `key`:
    `"target-approach-matchup"`. `label`: "Approach Confidence"/"Approach Desperation".
  - `_advantageRollModifier(move)`: the `??`-chain combinator from the Design section
    (`_grantedAdvantageRollModifier(move) ?? _coldCompanyRollModifier() ?? _targetTierRollModifier(move) ?? null`)
    — this is what actually masks the three Advantage-axis candidates against each other, so
    `_targetTierRollModifier` itself needs no separate masking parameter unlike its Effect-axis
    counterpart.
  - Every new entry follows the same shape as an ordinary catalog entry: `{ key, label,
    description, advantage, effect, requiresAdvantage: null, reminderOnly: false, deferred: false,
    disabled: false, disabledReason: null, forced: true }` (`advantage`/`effect` — whichever axis
    doesn't apply stays `null`).
- `_rollModifiersForMove(move, lockedEffect)` (~L390): unchanged signature. After building
  `entries` from the catalog `grantsRollModifier` loop (give every entry built there — both the
  `reminderOnly` branch and the normal branch — an explicit `forced: false` field, so every entry
  in the list has a consistent shape), push `this._advantageRollModifier(move)` and
  `this._targetMatchupRollModifier(move, lockedEffect)` onto it when non-null.
- Update the function's own doc comment, and `_grantedAdvantageForMove`'s existing doc comment
  (which currently references Don't Follow Me/`_lockedAdvantageFor` — that whole paragraph needs
  rewriting to describe the new roll-modifier path instead), to describe the new `forced` entries
  and the masking rule.

### `scripts/moves/move-dialogs.js` (`configureMoveRoll`)
- In the `render` callback, move the `rollModifierScope`/`activeRollModifiers` definitions (today
  ~L229-238) *above* the `currentAdvantage`/`currentEffect` declaration (today ~L226-227), then
  seed them by folding every `forced` entry from `activeRollModifiers()` through
  `resolveRollChain` (import it alongside the existing `chainEntryResult`/`reverseChainStep`
  import from `../moves/roll-chain.js`):
  ```js
  let currentAdvantage = lockedAdvantage ?? "none";
  let currentEffect = lockedEffect ?? "none";
  const forcedSeed = resolveRollChain(
      { advantage: currentAdvantage, effect: currentEffect },
      activeRollModifiers().filter((entry) => entry.forced)
  );
  currentAdvantage = forcedSeed.advantage;
  currentEffect = forcedSeed.effect;
  ```
- No other JS changes needed: `repaintAvailability()` already skips checked rows unconditionally,
  and the Roll button's `:checked` selector already picks up disabled-but-checked checkboxes, so
  a forced entry's key flows into `spentRollModifiers` same as any checked entry — harmless, since
  `_spendRollModifiers` simply finds no matching catalog spec for these two synthetic keys and
  no-ops for them.
- Update the function's big doc comment (the `lockedAdvantage`/`lockedEffect`/`rollModifiers`
  paragraphs) to note that target-matchup no longer feeds `lockedAdvantage`/`lockedEffect` and
  instead arrives as `forced` Roll Modifier entries, seeded in exactly this way.

### `templates/move-roll-dialog.hbs`
Both Roll Modifiers row blocks (weaponBundles column-2, ~L96-107; single-weapon column-2,
~L242-253) get the same two changes:
- Checkbox attributes: `{{#if forced}}checked disabled{{else}}{{#if disabled}}disabled{{/if}}{{/if}}`
  (replacing the current bare `{{#if disabled}}disabled{{/if}}`).
- A note next to the label, reusing the existing `.move-roll-modifier-deferred-note` class (same
  muted/italic style already used for the deferred "(applies to your next qualifying roll)" note
  — no new CSS needed): `{{#if forced}}<span class="move-roll-modifier-deferred-note">(automatic)</span>{{/if}}`.
- Do **not** add `forced` to the row's own `{{#if disabled}} disabled{{/if}}` class list — a
  forced entry's `disabled` field stays `false`, so the row renders at full opacity (not the
  greyed-out "unavailable" look), which is correct since it's active, not unavailable.

Run `npx handlebars templates/move-roll-dialog.hbs -f /dev/null` after editing to catch a syntax
error — this can't be caught by the test suite (see CLAUDE.md's "Templates and CSS are invisible
to the test suite"). No CSS file changes needed since no new class is introduced.

### `docs/domains/moves.md`
Add a new paragraph after the existing step-offset paragraph (after L60, before the All
In/Embrace Chaos example at L62) documenting: what the five migrated sources are
(`_targetTierAdvantage`, `_targetMatchupEffect`, the shared `_grantedAdvantageForMove` trio, and
`_coldCompanyAdvantage` — none of this is currently documented in this file at all, only in code
comments, so this is the first doc coverage any of it gets), that they now surface as `forced:
true` Roll Modifier entries rather than feeding `lockedAdvantage`/`lockedEffect`, the masking rule
(`_advantageRollModifier`'s own `??` chain for the three Advantage-axis sources, plus
`_targetMatchupRollModifier`'s single `lockedEffect`-present check for the Effect axis), and that
Don't Follow Me's Trait lock (`grantsTraitOnMove`/`lockedTrait`) is a deliberate, separate
exception that stays as a hard lock since Roll Modifiers have no trait dimension. Also document
that a forced entry is pre-checked/pre-folded into `currentAdvantage`/`currentEffect` at dialog
open and can't be unchecked, but otherwise composes through the chain exactly like any other entry
(a player can still check All In afterward, or move the steppers directly, exactly as before).

## Tests to update

- **`tests/playbook-actor-sheet-move-roll-targets.test.js`** — full rewrite of the assertion
  shape, same as the original design: `weaponRollConfig({ lockedAdvantage, lockedEffect })`
  assertions on Tier/Approach become assertions that `weaponBundles[0].rollModifiers` contains a
  `{ key: "target-tier-matchup", ..., forced: true }` and/or `{ key: "target-approach-matchup",
  ..., forced: true }` entry, with `lockedAdvantage`/`lockedEffect` now `null` in those cases. The
  "Cold Company wins over Tier"/"forced weapon tag wins over Approach" precedence tests flip the
  other way: the hard-lock case (forced weapon tag) keeps asserting `lockedEffect` directly and no
  `target-approach-matchup` entry; the Cold Company case now asserts `rollModifiers` contains the
  `cold-company-advantage` entry instead of `target-tier-matchup` (Cold Company now outranks Tier
  as a roll-modifier candidate the same way it outranked it as a lock before), not `lockedAdvantage`.
- **`tests/playbook-actor-sheet-wither.test.js`** (`describe("PlaybookActorSheet#_coldCompanyMove
  / _coldCompanyAdvantage")`, ~L171-246) — the four `lockedAdvantage`-asserting tests (haunted,
  dispelled, and the two "leaves/passes lockedAdvantage" cases, rolling the non-`usesWeapon`
  `dispel-uncertainties` move) all flip to asserting `rollModifiers` contains/omits the
  `cold-company-advantage` forced entry instead, with `lockedAdvantage` now always `null` for this
  source. Add a direct unit test for the new `_coldCompanyRollModifier()` resolver alongside the
  existing `_coldCompanyAdvantage()` ones.
- **`tests/playbook-actor-sheet-roll-results.test.js`** (`describe("PlaybookActorSheet#_rollMove -
  Don't Follow Me's grantsTraitOnMove/grantsAdvantageOnMove")`, ~L190-240, rolling the
  non-`usesWeapon` `lead-a-sortie` move) — `lockedAdvantage: "advantage"` assertions flip to a
  `rollModifiers` entry (`granted-advantage-the-impostor:dont-follow-me`, `forced: true`);
  `lockedTrait` assertions are unchanged (still a genuine hard lock, per the Design section).
- **`tests/playbook-actor-sheet-astir-effects.test.js`** (`describe("PlaybookActorSheet#_grantedAdvantageForMove
  - Legacy (Astir Move)")`, ~L67-106) — these call `_grantedAdvantageForMove` directly, which keeps
  its existing signature/behavior (still resolves the granting move's advantage value); no
  rewrite needed there, but add a companion assertion (or new test) confirming Legacy's grant also
  now reaches the dialog as a `rollModifiers` entry, not `lockedAdvantage`, the same way Don't
  Follow Me's does, for parity coverage of the third source sharing this resolver.
- **`tests/playbook-actor-sheet-the-captain.test.js`** (~L500-503) — this test's `lockedAdvantage:
  null` assertion is incidental (Born Leader isn't picked in that fixture), so it likely needs no
  change, but confirm after the rewrite that it still passes for the right reason (nothing masks
  `lockedAdvantage` there, not "Born Leader's grant happens not to apply this time" vs. some new
  bug). No existing test directly exercises Born Leader's own grant — consider adding one for
  parity with the Don't Follow Me/Legacy coverage above, given all three now share one code path.
- **`tests/playbook-actor-sheet-roll-modifiers.test.js`** and/or **`tests/move-roll-modifiers.test.js`**
  — add direct unit coverage for `_advantageRollModifier` (each of the three sources winning in
  precedence order, and the `null`-when-none-apply case), `_grantedAdvantageRollModifier`,
  `_coldCompanyRollModifier`, `_targetTierRollModifier`, and `_targetMatchupRollModifier` (its
  `lockedEffect`-present masking case) individually.
- **`tests/move-roll-dialog.test.js`** — add a case in `configureMoveRoll` render-callback
  coverage: a `forced: true` entry in `rollModifiers` is pre-checked+disabled in the rendered
  markup and its step is already reflected in the seeded `currentAdvantage`/`currentEffect` (i.e.
  the hidden `[name='advantage']`/`[name='effect']` inputs) without any simulated checkbox click.
- **`tests/move-roll-dialog-chain.test.js`** — add a case showing a `forced` entry composes with
  a manually-checked ordinary entry afterward (e.g. checking All In once a forced Tier Advantage
  has already put `currentAdvantage` at `"advantage"` satisfies All In's own `requiresAdvantage`
  gate), and confirm attempting to interact with the forced checkbox itself is a no-op (it's
  `disabled`, so no `change` event exercise is even possible — this may just mean asserting the
  rendered `disabled`/`checked` attributes rather than simulating a click).
- Coverage is a **100% hard gate** (`vitest.config.js`) — every new branch above (the `??` chain in
  `_advantageRollModifier`, masking in `_targetMatchupRollModifier`, the `resolveRollChain` seed
  line, `_grantingMoveForAdvantage`'s extraction) needs matching test coverage or the build fails.
  The template's new `{{#if forced}}` branches are template-only and untestable per CLAUDE.md — no
  test needed there, just the manual-verification note below.

## Verification

1. `npx handlebars templates/move-roll-dialog.hbs -f /dev/null` — catches a Handlebars syntax
   error in the new `{{#if forced}}` branches.
2. `git add` the changed files, then `npx lint-staged` and `npm run test:coverage` — both must
   pass clean, coverage at 100%.
3. Manual client verification (required — this touches `.hbs`, which the test suite can't render;
   per CLAUDE.md this must be stated explicitly in the completion report, not implied as
   "verified"): reload the Foundry client (esmodules need a full reload) and confirm:
   - Target an NPC with a different Tier and/or an Approach on the opposing side of the type
     wheel, open Exchange Blows/Strike Decisively's roll dialog: the Roll Modifiers section shows
     a pre-checked "Tier Advantage"/"Tier Disadvantage" and/or "Approach Confidence"/"Approach
     Desperation" row, each showing "(automatic)" and impossible to uncheck by clicking it, and
     the Dice/Effect notch sliders start already stepped to match but remain freely draggable.
   - An Impostor with Don't Follow Me picked, rolling Lead a Sortie: the Roll Modifiers section
     shows a pre-checked, uncheckable "Don't Follow Me: Advantage" row; the Trait select is
     separately disabled with its existing "Locked: DEFY" note (unchanged), and the Dice slider
     itself is *not* disabled (only the checkbox).
   - An actor with Cold Company picked, rolling any move while haunted (or dispelled): the Roll
     Modifiers section shows a pre-checked, uncheckable "Cold Company: Haunted"/"Cold Company:
     Dispelled" row on a plain non-weapon move too (e.g. Dispel Uncertainties), not just Exchange
     Blows/Strike Decisively.
   - A hard-lock scenario still using the old mechanism (e.g. a weapon carrying an unspent
     Unreliable tag against a favorable Approach target, or bite-the-dust at max Perils) still
     shows the old "Locked: X" note with the slider itself disabled, and does **not** also show a
     competing forced Roll Modifier row for that same axis.
   - A scenario where two Advantage-axis sources could both apply (e.g. Cold Company haunted
     *and* a Tier advantage against the target) shows only the higher-precedence one
     (Cold Company) as a forced Roll Modifier row, not both.
