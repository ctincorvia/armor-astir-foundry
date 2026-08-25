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
- The Unreliable equipment tag (`forcesEffect`, via `_forcedWeaponEffect`) — forces Desperation on
  the first roll each Scene with an affected weapon, until spent. Unlike the other four, this one
  is *per-weapon*, not actor-wide or target-scoped — see the Design section for what that changes.
- Pending deferred `grantsRollModifier` grants (`pendingGrant`/`_pendingRollModifierGrant`) — a
  one-shot Advantage or Effect step a player earns by checking a box and spending a resource
  (hold/a `uses` checkbox/a Potion) on one roll, which then silently sits pending until it fires on
  the actor's *next* qualifying roll: Snakes In The Grass (The Adrift), Bullheaded (The Impostor),
  Bonded In Blood (The Summoner), Ravenous Spectre (The Revenant) — all four grant `advantage:
  "advantage"` — and Alchemical Suite's two Potions (an Astir Part): Blue grants `advantage:
  "advantage"` scoped to Weave Magic, Yellow grants `effect: "confidence"` scoped to Exchange
  Blows/Strike Decisively (the *only* source that ever populates `pendingGrant?.effect` — this
  branch isn't dead code, just narrow). See the Design section for why migrating this one source
  also retires the entire `lockedAdvantage` mechanism.

The user wants all of these to instead surface as entries in the dialog's existing "Roll
Modifiers" section — pre-checked, and *functioning exactly like any other Roll Modifier*
(composes with the chain via `roll-chain.js`, can still be overridden by moving the Dice/Effect
steppers directly) — with the one difference that the checkbox itself can't be unchecked.

**Two things stay untouched, deliberately out of scope:**
- Don't Follow Me's *other* half, `grantsTraitOnMove` (`lockedTrait`, the Trait select) — Roll
  Modifiers have no "trait" dimension in this codebase's data model (only `advantage`/`effect`),
  so this can't move into the same mechanism. It stays exactly as today: a disabled `<select>`
  with its own "Locked: DEFY" note, unrelated to the Advantage-axis change to the same move.
- Every other lock source: Field Scout's standing Confidence grant (`grantsEffectOnMove`) and the
  two "emergency" desperation locks — `forcesDesperationAtMaxPerils` (bite-the-dust) and
  `forcesDesperationOnShakenTenet` (weave-magic), so named because they react to the character
  being in a crisis state (every Danger slot full of Perils, or a broken Tenet) rather than being
  a standing grant or a passive read of the current target; that's why they sit at the *highest*
  precedence in `_lockedEffectFor` today. Neither was named by the user, and neither fits "a
  boon/debuff from comparing yourself to something/earning a bonus" the way everything else
  migrated here does — they keep disabling the whole Effect slider exactly as today.

## Design

### Effect axis (Confidence/Desperation) — three sources now, composing with each other, still masked as a group
`_targetMatchupEffect` (Approach), `_forcedWeaponEffect` (the Unreliable tag, or any future
`forcesEffect`-flagged tag), and any *pending deferred grant whose spec sets `effect`* (today, only
Alchemical Suite's Yellow Potion) all move onto this axis. `_lockedEffectFor`
(`scripts/playbook/playbook-sheet/move-roll-mixin.js`) drops `forced?.effect`, the trailing
`?? this._targetMatchupEffect(move)`, *and* `pendingGrant?.effect` (see the "Pending deferred
grants" subsection below for why `pendingGrant` disappears from this function's signature
entirely, not just this one line) — leaving only the two true "emergency" locks
(`forcesDesperationAtMaxPerils`/`forcesDesperationOnShakenTenet`) and Field Scout's standing grant:

```js
_lockedEffectFor(move, weapon) {
    return (move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null)
        ?? (move.forcesDesperationOnShakenTenet && this._hasShakenTenet() ? "desperation" : null)
        ?? this._grantedEffectForMove(move)
        ?? null;
}
```

Add two resolvers — `_targetMatchupRollModifier(move, lockedEffect)` (unchanged from the original
design) and `_forcedWeaponRollModifier(weapon, lockedEffect)` wrapping `_forcedWeaponEffect` — each
individually masked `null` whenever the trimmed `lockedEffect` above is set, but *not* masked
against each other. A pending Yellow-Potion-shaped grant gets the same treatment, but via a filter
inside `_rollModifiersForMove` rather than its own dedicated resolver — see "Pending deferred
grants" below. Same "compose, not compete" principle as the Advantage axis: an Unreliable weapon
(-1) fought against a favorably-matched target (+1 from Approach) should cancel to a flat roll, not
have the weapon tag arbitrarily win with Approach silently discarded. All applicable entries get
pushed into `rollModifiers` independently, and `resolveRollChain` folds them in sequence exactly
like the Advantage-axis group — including correctly clamping when two land the same direction
(there's no "desperation2"/"confidence2" state, so `EFFECT_DISPLAY_ORDER`'s 3-entry range means a
second same-direction step is silently a no-op, same as any other already-at-the-edge case).

**This is a real, user-visible behavior change to existing, working functionality**, not a pure
refactor: today, `tests/playbook-actor-sheet-move-roll-targets.test.js`'s "lets a forced weapon tag
win over a favorable Approach target match" test has Unreliable win outright and Approach get
silently discarded. Under this design, the same scenario now shows *both* as forced entries and
they cancel to a flat roll (`none`) — see "Tests to update" below.

Because `_forcedWeaponEffect` is *per-weapon* (unlike Tier/Cold Company/the grant trio, which are
weapon-independent), `_rollModifiersForMove` needs a third parameter: `weapon`. Both of its
existing call sites (`_weaponRollBundle`, `_rollMove`'s single-weapon path) already have `weapon`
in scope, so this is a small, mechanical threading change, not new plumbing. `_forcedWeaponEffect`
already returns `null` safely for `weapon` being `undefined`/`null` (non-`usesWeapon` moves, or
Unarmed), so no new guard is needed for those cases.

`_finishMoveRoll`'s own "mark the tag spent" logic (`const forced = this._forcedWeaponEffect(weapon);`,
~L261) is a completely separate, independent call already — it never read `lockedEffect` and isn't
touched by any of this.

**Deliberately out of scope: `CarrierActorSheet#_onWeaponMoveRoll`** (`scripts/world-actors/carrier-actor-sheet.js`,
~L251-284) has its own, parallel `_forcedWeaponEffect`/`lockedEffect` handling for the Carrier's
own weapon rolls, and never passes `rollModifiers` to `configureMoveRoll` at all — there's no Roll
Modifiers infrastructure there to migrate Unreliable into, and introducing one would be a much
larger, unrelated change nobody has asked for. Its handling of Unreliable stays exactly as today:
a plain `lockedEffect`, disabling the Effect slider outright.

### Advantage axis (Advantage/Disadvantage) — every source composes, `lockedAdvantage` is retired entirely
**Design correction, per user feedback:** an earlier draft of this plan mirrored
`_lockedAdvantageFor`'s existing `??` precedence chain and had these sources pick a single "winner"
the same way the old hard-lock mechanism had to (a plain string can only hold one value). That's
wrong once they're Roll Modifiers — Roll Modifiers are *designed* to compose (that's the whole
point of the chain model: All In + Embrace Chaos already stack today). Rules-wise, a dispelled Cold
Company (+1 Advantage) and a Tier advantage (+1 Advantage) against the same target should
genuinely stack to Advantage x2, not have one silently mask the other. So: **no combinator, no
precedence chain, no masking among any Advantage-axis source at all.** Each is resolved and pushed
independently — whichever currently apply, all of them:

```js
// move-grants-mixin.js's _rollModifiersForMove
const grantedAdvantage = this._grantedAdvantageRollModifier(move);   // Don't Follow Me / Born Leader / Legacy
if (grantedAdvantage) entries.push(grantedAdvantage);
const coldCompany = this._coldCompanyRollModifier();
if (coldCompany) entries.push(coldCompany);
const tier = this._targetTierRollModifier(move);
if (tier) entries.push(tier);
// ...plus every pending deferred grant whose spec sets advantage — see "Pending deferred grants" below.
```

`move-dialogs.js`'s render callback already needs to fold every `forced` entry through
`resolveRollChain` in sequence (see below) to seed the initial slider position — that fold already
handles an arbitrary number of entries correctly with zero extra code, since it's the same
mechanism ordinary checked modifiers already use to stack (clamping at the display range's edges,
canceling a `+1`/`-1` pair to `none`). Two, three, or more of these landing on the same roll (e.g.
Cold Company dispelled + a Tier advantage + a pending Bullheaded grant) just works.

**Second-order consequence, once the pending-grant migration (below) is folded in too: nothing is
left that ever populates `lockedAdvantage`.** The four sources that fed it — the shared grant, Cold
Company, `pendingGrant?.advantage`, Tier — are now *all* Roll Modifiers. There is no fifth source;
"Artifact" (an Astir Part sometimes mentioned in the same breath in `_grantedAdvantageForMove`'s
own doc comment) was already an ordinary, always-checkable `grantsRollModifier` catalog entry, not
a `lockedAdvantage` contributor, so it was never part of this chain to begin with. Per the user's
explicit decision: **remove `_lockedAdvantageFor` entirely, along with every piece of
`lockedAdvantage` plumbing** — it's genuinely dead code once this lands, not scaffolding worth
keeping:
- `_lockedAdvantageFor` itself (`move-roll-mixin.js`) — deleted.
- The `lockedAdvantage` parameter to `configureMoveRoll` (`move-dialogs.js`) — removed, along with
  its `buildNotchedSlider(ADVANTAGE_DISPLAY_ORDER, advantageState, lockedAdvantage)` call passing a
  lock key (the Advantage slider is simply never disabled), its `lockedAdvantageLabel` display
  field, and `let currentAdvantage = lockedAdvantage ?? "none";` becoming `let currentAdvantage =
  "none";`.
- The two `{{#if lockedAdvantage}}<p class="move-roll-locked-note">Locked: {{lockedAdvantageLabel}}</p>{{/if}}`
  blocks in `templates/move-roll-dialog.hbs` (weaponBundles branch and single-weapon branch) — removed.
- Every `lockedAdvantage`/`lockedAdvantage:` reference across `_rollMove`/`_rollMoveWithWeaponChoice`
  (`move-roll-mixin.js`) and the test suite — see "Files to change"/"Tests to update" below.

`_rollModifiersForMove`'s signature stays `(move, lockedEffect, weapon)` — no `lockedAdvantage`
parameter is ever needed, and no threading through `_weaponRollBundle`/`_rollMoveWithWeaponChoice`.

**Why the Effect axis does NOT get the same full-removal treatment (asymmetry, kept deliberately):**
the Roll button's callback in `move-dialogs.js` has a real `activeLockedEffect ??` override at
submit time for Effect — *not* present for Advantage — specifically so an "emergency" lock
(bite-the-dust's max-Perils Desperation, weave-magic's Shaken Tenet) can never be diverged from, by
design. Letting Approach's/Unreliable's/a pending Yellow Potion's forced entry compose past that
would let a favorable signal silently cancel out an emergency lock — a real rules question outside
what was asked here. So `lockedEffect`/`_lockedEffectFor` stay, just trimmed to their two true
emergency sources plus Field Scout, and `_targetMatchupRollModifier`/`_forcedWeaponRollModifier`
keep their masking against it, unchanged from the earlier draft.

Unlike the Effect-axis change, the Advantage-axis one reaches **every roll**, not just `usesWeapon`
ones — Cold Company, the Advantage-grant trio, and most pending deferred grants apply to any move
(Lead a Sortie, Dispel Uncertainties, Cool Off, etc.), only Tier stays internally gated on
`move.usesWeapon` (via `_targetTierAdvantage`'s own existing guard). `_rollModifiersForMove` is
already called from both `_rollMove`'s single-weapon path and `_weaponRollBundle`'s per-bundle
path, so this falls out for free — no new call site needed.

### Pending deferred grants — every currently-pending grant composes, not just the first found
**Extends the same "compose, not compete" fix to a mechanism that had the identical bug.**
`_pendingRollModifierGrant(move)` today scans every roll-modifier source for a still-pending
`deferred: true` spec and `return`s on the *first* match — meaning if a player somehow had two
grants pending at once for the same upcoming move (e.g. checked both Bullheaded's unscoped grant
and Blue Potion on the same earlier roll, then rolls Weave Magic next), only the first one found
would ever apply; the second would silently sit pending, unconsumed, for some future roll. Replace
it with a version that collects *every* currently-pending, qualifying entry as an array of
ordinary Roll-Modifier-shaped, `forced: true` objects — `_pendingRollModifierEntries(move)`:

```js
// move-grants-mixin.js
_pendingRollModifierEntries(move) {
    const entries = [];
    for (const source of this._rollModifierSources()) {
        for (const spec of source.grantsRollModifier ?? []) {
            if (!spec.deferred) continue;
            if (spec.moveKeys && !spec.moveKeys.includes(move.key)) continue;
            const specKey = spec.key ?? "default";
            const pending = Boolean(this.actor.system.attributes?.pendingRollModifiers?.[source.key]?.[specKey]);
            if (!pending) continue;
            entries.push({
                key: `pending-${source.key}-${specKey}`,
                label: spec.label ?? source.name,
                description: spec.description ?? source.description,
                advantage: spec.advantage ?? null,
                effect: spec.effect ?? null,
                requiresAdvantage: null,
                reminderOnly: false,
                deferred: false,
                disabled: false,
                disabledReason: null,
                forced: true,
                sourceKey: source.key,
                specKey
            });
        }
    }
    return entries;
}
```

`label`/`description` reuse the exact same `spec.label ?? source.name` / `spec.description ??
source.description` fallback the catalog loop above already uses — Alchemical Suite's two Potions
carry their own (`"Blue Potion"`/`"Yellow Potion"` and their own rules-text descriptions); the
other four sources fall back to their granting move's own name/description. `key` is namespaced
(`pending-<sourceKey>-<specKey>`) specifically so it never collides with the *catalog* spec's own
`key` (`spec.key ?? source.key`, used when *offering* a fresh deferred grant on a different roll) —
this also means a spent-once-already pending entry's key never matches anything
`_spendRollModifiers` looks for, so it's a safe no-op there, same as the other new forced entries.
`sourceKey`/`specKey` ride along on the entry (extra fields beyond the standard row shape) purely
so the clearing step below doesn't need to re-derive them.

**Wired into `_rollModifiersForMove` itself** (not threaded through as a parameter — `move` is
already in scope there): after the five independent pushes above, spread in
`this._pendingRollModifierEntries(move)`, filtering out any entry whose own `effect` is set while
the (trimmed) `lockedEffect` is also set — the same per-entry masking `_targetMatchupRollModifier`/
`_forcedWeaponRollModifier` already get, applied here inline since a pending entry can carry either
axis:

```js
for (const entry of this._pendingRollModifierEntries(move)) {
    if (entry.effect && lockedEffect) continue;
    entries.push(entry);
}
```

Advantage-setting pending entries are never masked, consistent with that axis's "always compose"
rule.

**Clearing becomes a batch, not N sequential `actor.update()` calls.** Today's
`_clearPendingRollModifier(sourceKey, specKey)` writes one path per call; once more than one
pending grant can be consumed on the same roll, calling it in a loop means N separate Foundry
document updates for one roll. Replace it with a plural, batched version matching
`_spendRollModifiers`'s own existing `updates` object pattern:

```js
async _clearPendingRollModifiers(entries) {
    if (!entries.length) return;
    const updates = {};
    for (const entry of entries) {
        updates[`system.attributes.pendingRollModifiers.${entry.sourceKey}.${entry.specKey}`] = false;
    }
    await this.actor.update(updates);
}
```

Both `_rollMove`'s single-weapon path and `_rollMoveWithWeaponChoice` replace their
`if (pendingGrant) await this._clearPendingRollModifier(pendingGrant.sourceKey, pendingGrant.specKey);`
line with `await this._clearPendingRollModifiers(this._pendingRollModifierEntries(move));` — called
once, after `if (!config) return;`, same placement as today. Clearing stays **unconditional** on
every currently-pending entry once the player actually rolls (doesn't cancel) — matching today's
existing behavior exactly: the original code already cleared `pendingGrant` regardless of whether
its value actually "won" the old `??` chain (e.g. a pending grant already got silently discarded by
a higher-precedence lock like bite-the-dust today, and was still cleared). Masked-but-still-cleared
is not a new decision this migration introduces, just the same existing semantics expressed as a
`continue` filter instead of a `??` link.

`_weaponRollBundle` no longer needs a `pendingGrant` field in its options object at all — since
`_lockedEffectFor` no longer takes `pendingGrant` and `_rollModifiersForMove` resolves pending
entries internally via `move` alone, the only remaining use of `pendingGrant` in that function
disappears entirely.

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
- `_lockedEffectFor(move, weapon, pendingGrant)` (~L130) → `_lockedEffectFor(move, weapon)`: drop
  `forced?.effect`, the trailing `?? this._targetMatchupEffect(move)`, **and** `pendingGrant?.effect`
  — the `pendingGrant` parameter disappears entirely, see the Design section's rewritten body.
  `forced` (the local `this._forcedWeaponEffect(weapon)` call) is no longer needed in this function
  at all; remove the now-dead `const forced = ...` line too.
- `_lockedAdvantageFor(move, pendingGrant)` (~L162): **delete the whole function.** Per the user's
  explicit decision, this is dead code once every one of its four sources (the shared grant, Cold
  Company, pendingGrant, Tier) is a Roll Modifier — see the Design section's "Advantage axis"
  subsection.
- `_pendingRollModifierGrant`'s two call sites (`_rollMove`'s single-weapon path ~L480,
  `_rollMoveWithWeaponChoice` ~L406) — replace `const pendingGrant = this._pendingRollModifierGrant(move);`
  with nothing at the top (no longer needed up front); each function instead calls
  `this._pendingRollModifierEntries(move)` once, later, purely for the clearing step (see below).
- Every remaining `lockedAdvantage` reference in both functions — `const lockedAdvantage =
  this._lockedAdvantageFor(...)`, its inclusion in the `configureMoveRoll(...)` options object, and
  (in `_rollMoveWithWeaponChoice`) its use as the `configureMoveRoll` top-level field — all removed.
- `_lockedEffectFor`'s two remaining call sites (`_weaponRollBundle` ~L373, `_rollMove`'s
  single-weapon path ~L481) drop the now-removed `pendingGrant` argument:
  `this._lockedEffectFor(move, weapon)`.
- `_weaponRollBundle` (~L371-395) and `_rollMove`'s single-weapon path (~L488-492): both already
  have `weapon` in scope right where they call `this._rollModifiersForMove(move, lockedEffect)` —
  change both call sites to `this._rollModifiersForMove(move, lockedEffect, weapon)`. `_weaponRollBundle`
  also drops `pendingGrant` from its destructured options parameter (`{ traits, pendingGrant }` →
  `{ traits }`) and from `_rollMoveWithWeaponChoice`'s call building `weaponBundles` — nothing
  downstream of it needs `pendingGrant` anymore.
- Both functions' clearing step (after `if (!config) return;`) changes from
  `if (pendingGrant) await this._clearPendingRollModifier(pendingGrant.sourceKey, pendingGrant.specKey);`
  to `await this._clearPendingRollModifiers(this._pendingRollModifierEntries(move));`.
- Update every touched function's doc comment — point to `_rollModifiersForMove`'s new `forced`
  entries for what used to be documented here as the tail of each precedence chain, note that
  `_lockedAdvantageFor`/`lockedAdvantage` no longer exist at all, and that the Effect axis's three
  sources (Approach, Unreliable, a pending Yellow-Potion-shaped grant) compose with each other but
  stay masked as a group behind the two remaining hard-lock sources (the emergency locks, Field
  Scout).

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
- Import `findEquipmentTag` from `../../equipment/equipment.js` (already barrel-exported from
  `equipment-helpers.js`) — needed by the new `_forcedWeaponRollModifier` resolver below to look up
  the forced tag's own `label`/`description` for display, the same way every other Roll-Modifier
  entry's label/description ultimately traces back to its source.
- Add five new resolvers, each returning a Roll-Modifier-shaped object or `null` — **no combinator,
  no precedence chain between them** (all next to `_targetTierAdvantage`/`_targetMatchupEffect`):
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
  - `_targetTierRollModifier(move)`: wraps `_targetTierAdvantage(move)`. `key`:
    `"target-tier-matchup"`. `label`: "Tier Advantage"/"Tier Disadvantage". No masking parameter —
    it's independent of the other two Advantage-axis sources by design (they compose).
  - `_targetMatchupRollModifier(move, lockedEffect)`: wraps `_targetMatchupEffect(move)`, `null`
    when `lockedEffect` is already set — masked, same reasoning as before (the Roll button's
    `activeLockedEffect` override at submit time means an unmasked entry here could silently
    override an emergency lock like bite-the-dust's). `key`: `"target-approach-matchup"`. `label`:
    "Approach Confidence"/"Approach Desperation".
  - `_forcedWeaponRollModifier(weapon, lockedEffect)`: wraps `_forcedWeaponEffect(weapon)`, `null`
    when `lockedEffect` is already set (same masking as `_targetMatchupRollModifier`, and **not**
    masked against it — see the Design section's "compose, not compete" treatment of this axis's
    two sources). `key`: `` `forced-weapon-effect-${forced.tagKey}` `` (namespaced by tag key so a
    future second `forcesEffect` tag can't collide). `label`/`description`: from
    `findEquipmentTag(forced.tagKey)` (e.g. "Unreliable" and its rules text) — this is the one new
    resolver whose label doesn't come from a move/grant source, so it needs its own lookup.
  - Every new entry follows the same shape as an ordinary catalog entry: `{ key, label,
    description, advantage, effect, requiresAdvantage: null, reminderOnly: false, deferred: false,
    disabled: false, disabledReason: null, forced: true }` (`advantage`/`effect` — whichever axis
    doesn't apply stays `null`).
- `_rollModifiersForMove(move, lockedEffect, weapon)` (~L390): **new third parameter.** After
  building `entries` from the catalog `grantsRollModifier` loop (give every entry built there —
  both the `reminderOnly` branch and the normal branch — an explicit `forced: false` field, so
  every entry in the list has a consistent shape), push `_grantedAdvantageRollModifier(move)`,
  `_coldCompanyRollModifier()`, `_targetTierRollModifier(move)`, `_forcedWeaponRollModifier(weapon,
  lockedEffect)`, and `_targetMatchupRollModifier(move, lockedEffect)` onto it individually, each
  only when non-null — five independent pushes, not a chained `??`. Then loop over
  `this._pendingRollModifierEntries(move)`, pushing each entry unless `entry.effect && lockedEffect`
  (see the Design section's "Pending deferred grants" subsection for the exact filter).
- Replace `_pendingRollModifierGrant(move)` (~L469-481, returns the *first* pending match or `null`)
  with `_pendingRollModifierEntries(move)` (returns *every* currently-pending, qualifying entry, as
  an array of full Roll-Modifier-shaped objects — see the Design section's code block for the exact
  body). Update its doc comment: "the first still-pending deferred grant" becomes "every
  still-pending deferred grant", and the return shape changes from a single `{advantage, effect,
  sourceKey, specKey}` object to an array of ordinary Roll Modifier row objects, each additionally
  carrying `sourceKey`/`specKey` for the clearing step.
- Replace `_clearPendingRollModifier(sourceKey, specKey)` (~L484-486) with the batched
  `_clearPendingRollModifiers(entries)` from the Design section — one `actor.update()` covering
  every entry passed in, guarded by `if (!entries.length) return;` so the common (nothing pending)
  case is a no-op with no update call at all, matching `_spendRollModifiers`'s own guard shape.
- Import `findEquipmentTag` from `../../equipment/equipment.js` (already barrel-exported from
  `equipment-helpers.js`) — needed by `_forcedWeaponRollModifier` to look up the forced tag's own
  `label`/`description` for display, the same way every other Roll-Modifier entry's label/
  description ultimately traces back to its source.
- Update the function's own doc comment, and `_grantedAdvantageForMove`'s existing doc comment
  (which currently references Don't Follow Me/`_lockedAdvantageFor` — that whole paragraph needs
  rewriting to describe the new roll-modifier path instead, including that `_lockedAdvantageFor` no
  longer exists), to describe the new `forced` entries: every Advantage-axis source (the grant
  trio, Cold Company, Tier, and any pending advantage grant) composes with every other
  unconditionally; the Effect axis's three sources (Approach, Unreliable, a pending Yellow-Potion-
  shaped grant) compose with each other but stay masked as a group behind the two remaining
  Effect-axis hard locks.

### `scripts/moves/move-dialogs.js` (`configureMoveRoll`)
- **Remove `lockedAdvantage` from the function's signature entirely** — drop
  `lockedAdvantage = null` from the destructured options, drop `lockedAdvantage`/
  `lockedAdvantageLabel` from the `renderTemplate` context object, and change
  `buildNotchedSlider(ADVANTAGE_DISPLAY_ORDER, advantageState, lockedAdvantage)` to
  `buildNotchedSlider(ADVANTAGE_DISPLAY_ORDER, advantageState, null)` (or, more simply, since
  `buildNotchedSlider`'s `lockedKey` param has no default today, either give it one or just always
  pass `null` explicitly here — the Effect slider's own call keeps passing `lockedEffect` as
  before, `buildNotchedSlider` itself is untouched and stays shared/generic).
- In the `render` callback, move the `rollModifierScope`/`activeRollModifiers` definitions (today
  ~L229-238) *above* the `currentAdvantage`/`currentEffect` declaration (today ~L226-227), then
  seed them by folding every `forced` entry from `activeRollModifiers()` through
  `resolveRollChain` (import it alongside the existing `chainEntryResult`/`reverseChainStep`
  import from `../moves/roll-chain.js`):
  ```js
  let currentAdvantage = "none";
  let currentEffect = lockedEffect ?? "none";
  const forcedSeed = resolveRollChain(
      { advantage: currentAdvantage, effect: currentEffect },
      activeRollModifiers().filter((entry) => entry.forced)
  );
  currentAdvantage = forcedSeed.advantage;
  currentEffect = forcedSeed.effect;
  ```
- The Roll button's callback already reads `advantage: html.find("[name='advantage']").val()` with
  no `lockedAdvantage`-based override (unlike Effect's `activeLockedEffect ??`) — nothing to change
  there, this was already the correct read for a fully composable axis.
- No other JS changes needed: `repaintAvailability()` already skips checked rows unconditionally,
  and the Roll button's `:checked` selector already picks up disabled-but-checked checkboxes, so a
  forced entry's key flows into `spentRollModifiers` same as any checked entry — harmless, since
  `_spendRollModifiers` simply finds no matching catalog spec for any of these synthetic keys and
  no-ops for them.
- Update the function's big doc comment — the `lockedAdvantage` paragraph (today ~L48-52) is
  deleted outright (there is no `lockedAdvantage` concept left to document), and the
  `lockedEffect`/`rollModifiers` paragraphs are updated to note that target-matchup, the forced
  weapon effect, and pending deferred grants no longer feed `lockedAdvantage`/`lockedEffect` and
  instead arrive as `forced` Roll Modifier entries, seeded in exactly this way.

### `templates/move-roll-dialog.hbs`
- Remove both `{{#if lockedAdvantage}}<p class="move-roll-locked-note">Locked:
  {{lockedAdvantageLabel}}</p>{{/if}}` blocks — one in the weaponBundles branch (~L44-46), one in
  the single-weapon branch (~L191-193). There is no replacement markup; the Advantage slider simply
  never shows a locked note again.
- Both Roll Modifiers row blocks (weaponBundles column-2, ~L96-107; single-weapon column-2,
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
In/Embrace Chaos example at L62) documenting: what the migrated sources are — `_targetTierAdvantage`,
`_targetMatchupEffect`, the shared `_grantedAdvantageForMove` trio, `_coldCompanyAdvantage`,
`_forcedWeaponEffect`/Unreliable, and every pending deferred `grantsRollModifier` grant (Snakes In
The Grass, Bullheaded, Bonded In Blood, Ravenous Spectre, Alchemical Suite's two Potions) — none of
this is currently documented in this file at all, only in code comments, so this is the first doc
coverage any of it gets. Document that they now surface as `forced: true` Roll Modifier entries,
and the Advantage/Effect axis asymmetry explicitly:
- **Advantage axis: `lockedAdvantage` no longer exists.** Every source that ever fed it (the
  shared grant, Cold Company, Tier, pending advantage grants) is now a `forced` Roll Modifier, and
  none of them mask each other — they all compose unconditionally (e.g. a dispelled Cold Company
  plus a Tier advantage genuinely stacks to Advantage x2). `_lockedAdvantageFor` was deleted, not
  just trimmed.
- **Effect axis keeps `lockedEffect`, trimmed to two sources:** the two emergency locks
  (`forcesDesperationAtMaxPerils`/`forcesDesperationOnShakenTenet`) and Field Scout's standing
  grant. Everything else that used to feed it — Approach, Unreliable, and a pending Yellow-Potion-
  shaped grant — is now a `forced` Roll Modifier that composes freely *with the other two* (e.g. an
  Unreliable weapon against a favorably-matched target cancels to a flat roll) but stays masked *as
  a group* behind whichever of the two remaining hard locks applies — because the Roll button's
  `activeLockedEffect` override at submit time means an unmasked entry here could otherwise
  silently cancel an emergency lock like bite-the-dust's.
- Explain *why* the two axes land differently: it's not an oversight, it's the presence/absence of
  that submit-time override, which only ever existed for Effect.

Also document that Don't Follow Me's Trait lock (`grantsTraitOnMove`/`lockedTrait`) is a
deliberate, separate exception that stays as a hard lock since Roll Modifiers have no trait
dimension, that `CarrierActorSheet`'s own separate Unreliable handling for its own weapon rolls is
untouched (no Roll Modifiers infrastructure exists there), that `_pendingRollModifierGrant` (single
result) became `_pendingRollModifierEntries` (every currently-pending result, since more than one
can legitimately be pending and qualifying at once) and `_clearPendingRollModifier` became the
batched `_clearPendingRollModifiers`, and that a forced entry is pre-checked/pre-folded into
`currentAdvantage`/`currentEffect` at dialog open and can't be unchecked, but otherwise composes
through the chain exactly like any other entry (a player can still check All In afterward, or move
the steppers directly).

## Tests to update

- **`tests/playbook-actor-sheet-move-roll-targets.test.js`** — full rewrite of the assertion
  shape. `weaponRollConfig({ lockedAdvantage, lockedEffect })` assertions on Tier/Approach become
  assertions that `weaponBundles[0].rollModifiers` contains a `{ key: "target-tier-matchup", ...,
  forced: true }` and/or `{ key: "target-approach-matchup", ..., forced: true }` entry, with the
  `lockedAdvantage` key dropped from the expected object entirely (not set to `null` — the key no
  longer exists on any `configureMoveRoll` call) and `lockedEffect` staying `null`. Both precedence
  tests **change meaning, not just assertion shape** — neither is a "wins over" test anymore:
  - The old "Cold Company wins over Tier" test → rewrite to assert both `cold-company-advantage`
    and `target-tier-matchup` entries are present simultaneously in `rollModifiers` (they compose),
    plus an assertion (here or in `move-roll-dialog.test.js`) that they'd stack to `advantage2`.
  - The old "lets a forced weapon tag win over a favorable Approach target match" test (Unreliable
    rifle + favorable Approach target) → rewrite to assert **both** a `forced-weapon-effect-unreliable`
    entry (`effect: "desperation"`) and a `target-approach-matchup` entry (`effect: "confidence"`)
    are present in `rollModifiers` — they now compose and cancel, so add a
    `move-roll-dialog.test.js` case (or assert here) confirming the seeded `currentEffect` lands on
    `"none"`, not `"desperation"` as it does today. Flag this rewritten test's diff clearly in the
    PR/completion report — it's a genuine behavior change to a previously-passing scenario, not
    just a refactor of how the same outcome is asserted.
  - A genuine masking case still needs coverage somewhere: an Unreliable weapon *and* a favorable
    Approach match, but rolled while also at max Perils (`forcesDesperationAtMaxPerils`) — confirm
    `lockedEffect` still wins outright (old "Locked: Desperation" behavior) and *neither*
    `forced-weapon-effect-unreliable` nor `target-approach-matchup` appears in `rollModifiers`, per
    the still-masked-as-a-pair rule.
- **`tests/playbook-actor-sheet-wither.test.js`** (`describe("PlaybookActorSheet#_coldCompanyMove
  / _coldCompanyAdvantage")`, ~L171-246) — the four `lockedAdvantage`-asserting tests (haunted,
  dispelled, and the two "leaves/passes lockedAdvantage" cases, rolling the non-`usesWeapon`
  `dispel-uncertainties` move) all flip to asserting `rollModifiers` contains/omits the
  `cold-company-advantage` forced entry instead — `lockedAdvantage` isn't just `null` now, **the
  key is gone from `configureMoveRoll`'s call entirely**, since `_lockedAdvantageFor` no longer
  exists (delete/adjust these assertions accordingly, don't just change the expected value to
  `null`). Add a direct unit test for the new `_coldCompanyRollModifier()` resolver alongside the
  existing `_coldCompanyAdvantage()` ones, plus a case with Cold Company *and* a pending deferred
  advantage grant both active on the same roll, confirming both forced entries appear and compose
  (see the new pending-grants coverage below for the fixture this needs).
- **`tests/playbook-actor-sheet-roll-results.test.js`** (`describe("PlaybookActorSheet#_rollMove -
  Don't Follow Me's grantsTraitOnMove/grantsAdvantageOnMove")`, ~L190-240, rolling the
  non-`usesWeapon` `lead-a-sortie` move) — `lockedAdvantage: "advantage"` assertions flip to a
  `rollModifiers` entry (`granted-advantage-the-impostor:dont-follow-me`, `forced: true`), with
  `lockedAdvantage` dropped from the expected object rather than set to a value; `lockedTrait`
  assertions are unchanged (still a genuine hard lock, per the Design section).
- **`tests/playbook-actor-sheet-astir-effects.test.js`** (`describe("PlaybookActorSheet#_grantedAdvantageForMove
  - Legacy (Astir Move)")`, ~L67-106) — these call `_grantedAdvantageForMove` directly, which keeps
  its existing signature/behavior (still resolves the granting move's advantage value); no
  rewrite needed there, but add a companion assertion (or new test) confirming Legacy's grant also
  now reaches the dialog as a `rollModifiers` entry, not `lockedAdvantage`, the same way Don't
  Follow Me's does, for parity coverage of the third source sharing this resolver.
- **`tests/playbook-actor-sheet-the-captain.test.js`** (~L500-503) — this test's `lockedAdvantage:
  null` assertion needs the key removed from its expected object, not changed to `null`, since
  `configureMoveRoll` is never called with that key at all anymore. No existing test directly
  exercises Born Leader's own grant — consider adding one for parity with the Don't Follow
  Me/Legacy coverage above, given all three now share one code path.
- **`tests/playbook-actor-sheet-roll-modifiers.test.js`** — this file owns essentially all of the
  deferred-grant mechanism's dedicated coverage, and needs the most surgery:
  - `describe("PlaybookActorSheet#_pendingRollModifierGrant")` (~L693-786, 6 cases) → rewrite to
    `describe("PlaybookActorSheet#_pendingRollModifierEntries")`. Each `toEqual({advantage, effect,
    sourceKey, specKey})` assertion becomes `toEqual([{...fullRollModifierShape, forced: true,
    sourceKey, specKey}])` (an array, even for the single-pending-grant cases) or `toEqual([])` for
    the "nothing pending"/"scoped grant doesn't match"/"non-deferred entry" cases (not `toBeNull()`
    anymore). Add a new case with **two** pending grants simultaneously qualifying for the same
    move (e.g. Bullheaded's unscoped grant + Blue Potion, both pending, rolling Weave Magic) —
    confirms the array holds both, which is the actual bug this rewrite fixes (today's
    `_pendingRollModifierGrant` would silently return only the first).
  - `describe("PlaybookActorSheet#_clearPendingRollModifier")` (~L788-798) → rewrite to
    `describe("PlaybookActorSheet#_clearPendingRollModifiers")`, taking an array. The existing
    single-entry case's assertion (`actor.update` called with one path set to `false`) stays the
    same shape; add a second case with two entries confirming **one** `actor.update()` call with
    both paths set, and a third confirming an empty array is a true no-op (`actor.update` not
    called at all).
  - `describe("PlaybookActorSheet#_rollModifiersForMove - Bonded In Blood")` (~L804-816) and
    `"- Bullheaded"` (~L822-834) are **unaffected** — they exercise the catalog loop's normal branch
    (offering a *fresh* deferred grant to check on this roll, `[name='pending-roll-modifier']`),
    a completely different code path from `_pendingRollModifierEntries` (consuming an *already-
    pending* one). Worth a one-line note in the PR description so a reviewer doesn't assume they
    were missed.
  - `describe("PlaybookActorSheet#_rollMove - pending Roll Modifier grant")` (~L842+, 5 cases):
    "folds a pending grant's effect into lockedEffect..." → rewrite to assert `weaponBundles[0].rollModifiers`
    contains the Yellow-Potion-derived forced entry and `weaponBundles[0].lockedEffect` is `null`.
    "folds a pending grant's advantage into lockedAdvantage..." → rewrite to assert `rollModifiers`
    contains the Snakes-in-the-Grass-derived forced entry, and drop the `lockedAdvantage` assertion
    entirely (the key no longer exists on the call). The two clearing tests ("clears the pending
    grant once the roll dialog resolves..." and "...through the usesWeapon branch too") likely need
    **no assertion change** — a single pending entry still produces the exact same batched
    `actor.update({[path]: false})` shape the old singular call produced; confirm this rather than
    assuming it. "does not clear anything when dismissed" stays as-is. Add a new case with two
    pending grants clearing together in one `actor.update()` call, mirroring the
    `_clearPendingRollModifiers` unit case above but through the real `_rollMove` integration path.
  - Also add direct unit coverage for `_grantedAdvantageRollModifier`, `_coldCompanyRollModifier`,
    `_targetTierRollModifier` (each independently, including a case with several simultaneously
    non-null — confirms `_rollModifiersForMove` pushes all of them, not just one),
    `_forcedWeaponRollModifier` (both effect outcomes — only `"desperation"` exists in the catalog
    today, so the `"confidence"` branch may be untestable without a fixture-only `forcesEffect` tag;
    check whether `tests/helpers/`'s equipment fixtures already have one before assuming a new
    fixture is needed — and its `lockedEffect`-present masking case), and `_targetMatchupRollModifier`
    (its own masking case, plus a case with all three Effect-axis sources non-null at once).
- **Wider sweep: every remaining `lockedAdvantage`/`lockedAdvantage:` reference across the test
  suite.** `lockedAdvantage` appears in roughly a dozen more test files beyond the ones itemized
  above (e.g. `tests/move-roll-dialog.test.js`, `tests/move-roll-dialog-chain.test.js`,
  `tests/playbook-actor-sheet-move-rolls.test.js`, `tests/playbook-actor-sheet-roll-guided.test.js`,
  `tests/playbook-actor-sheet-weapon-rolls.test.js`, `tests/playbook-actor-sheet-move-roll-spends.test.js`,
  `tests/playbook-actor-sheet-ardent.test.js`) — some asserting a real locked value, most just
  including `lockedAdvantage: null` in a big literal expected-call object incidentally. **Grep
  `lockedAdvantage` across `tests/` before considering this task done** — every hit needs the key
  either removed from the expected object (the incidental cases) or rewritten to check
  `rollModifiers` instead (the cases that were actually testing a lock). `tests/move-roll-dialog.test.js`
  specifically has a dedicated `describe("configureMoveRoll - lockedAdvantage")` block — this whole
  describe should be **deleted**, not rewritten, since the parameter it tests no longer exists.
- **`tests/move-roll-dialog.test.js`** — beyond deleting the `lockedAdvantage` describe block above,
  add a case in `configureMoveRoll` render-callback coverage: a `forced: true` entry in
  `rollModifiers` is pre-checked+disabled in the rendered markup and its step is already reflected
  in the seeded `currentAdvantage`/`currentEffect` (i.e. the hidden `[name='advantage']`/
  `[name='effect']` inputs) without any simulated checkbox click. Add a second case with **two**
  `forced: true` Advantage-axis entries at once, confirming `resolveRollChain` folds both in
  sequence and the seeded `currentAdvantage` lands on `advantage2` (or cancels to `none` when
  they're opposite signs), and a third case with two `forced: true` Effect-axis entries canceling
  to `"none"` — these are the direct regression tests for the stacking behavior this conversation's
  design corrections introduced.
- **`tests/move-roll-dialog-chain.test.js`** — add a case showing a `forced` entry composes with
  a manually-checked ordinary entry afterward (e.g. checking All In once a forced Tier Advantage
  has already put `currentAdvantage` at `"advantage"` satisfies All In's own `requiresAdvantage`
  gate), and confirm attempting to interact with the forced checkbox itself is a no-op (it's
  `disabled`, so no `change` event exercise is even possible — this may just mean asserting the
  rendered `disabled`/`checked` attributes rather than simulating a click).
- Coverage is a **100% hard gate** (`vitest.config.js`) — every new branch above (each of the five
  independent resolvers, the masking branches in `_targetMatchupRollModifier`/
  `_forcedWeaponRollModifier`, `_pendingRollModifierEntries`'s multi-entry loop and its own
  effect/`lockedEffect` masking filter inside `_rollModifiersForMove`, `_clearPendingRollModifiers`'
  empty-array guard, the `resolveRollChain` seed line handling any number of forced entries on
  either axis, `_grantingMoveForAdvantage`'s extraction, `_rollModifiersForMove`'s new `weapon`
  parameter) needs matching test coverage or the build fails. The template's new `{{#if forced}}`
  branches are template-only and untestable per CLAUDE.md — no test needed there, just the
  manual-verification note below.

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
   - A weapon carrying an unspent Unreliable tag, rolled with no target/Approach signal in play:
     the Roll Modifiers section shows a pre-checked, uncheckable "Unreliable" row and the Effect
     slider starts pre-stepped to Desperation, but remains freely draggable (not disabled).
   - **The Effect-axis stacking/canceling case:** the same Unreliable weapon, this time against a
     favorably-matched Approach target — the Roll Modifiers section shows **both** "Unreliable" and
     "Approach Confidence" as separate, simultaneously checked forced rows, and the Effect slider
     starts pre-stepped to **`none`** (they cancel), not Desperation as it does in the current
     (pre-migration) build. This is the concrete before/after to check.
   - **The Advantage-axis stacking case:** a scenario where two Advantage-axis sources both apply
     at once — e.g. Cold Company dispelled (+1) *and* a Tier advantage (+1) against the same
     target — shows **both** as separate, simultaneously checked forced Roll Modifier rows, and the
     Dice slider starts pre-stepped to **Advantage x2**, not just Advantage. Also check the
     canceling case: Cold Company haunted (-1) plus a Tier advantage (+1) shows both rows checked,
     but the slider starts at `none`.
   - **A genuine remaining hard-lock scenario:** bite-the-dust at max Perils, rolled with an
     Unreliable weapon against a favorable Approach target too — still shows the old "Locked:
     Desperation" note with the Effect slider itself disabled, and does **not** also show either
     "Unreliable" or "Approach Confidence" as a forced Roll Modifier row — this is the pair-masking
     rule still holding for the sources that stay genuine hard locks.
   - **Pending deferred grants, single:** check Bullheaded's box (or Snakes in the Grass, Bonded in
     Blood, Ravenous Spectre) on one roll, spend its resource, then open the dialog for the actor's
     next qualifying roll — the Roll Modifiers section shows a pre-checked, uncheckable row named
     for the source (e.g. "Bullheaded") and the Dice slider starts pre-stepped to Advantage.
   - **Pending deferred grants, composing:** check both Bullheaded's box *and* Blue Potion on the
     same earlier roll (both unscoped/Weave-Magic-scoped), then roll Weave Magic next — the Roll
     Modifiers section shows **both** as separate forced rows and the Dice slider starts at
     Advantage x2. This is the concrete fix for the bug `_pendingRollModifierGrant` had today
     (silently applying only the first pending grant found, leaving the second stuck pending).
   - **Pending deferred grant, Effect axis:** spend a Yellow Potion, then roll Exchange Blows or
     Strike Decisively next — the Roll Modifiers section shows a pre-checked, uncheckable "Yellow
     Potion" row and the Effect slider starts pre-stepped to Confidence.
   - **The Advantage slider never shows a "Locked: X" note anywhere in the app, for any reason** —
     since `lockedAdvantage`/`_lockedAdvantageFor` are fully removed, this is worth a quick spot
     check across a few different playbooks/scenarios (Impostor, Wither, an Astir with Legacy) to
     confirm nothing regressed to a broken/undefined state rather than just "unlocked."
