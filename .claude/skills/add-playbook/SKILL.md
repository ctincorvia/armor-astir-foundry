---
name: add-playbook
description: Add a new playbook to the armor-astir-foundry module (e.g. "add the Wither playbook") — walks the rules text into the catalog-data recipe (approach, Gravity Trigger, Look/Consider, starting gear/moves, MOVE_POOLS entry, compendium pack), classifies each move against CLAUDE.md's shape table, isolates genuinely new mechanics for design confirmation, and drives the implementation + test plan to the project's 100%-coverage gate.
---

# Add a playbook

This module has added several playbooks the same way (Arcanist, Commander, Diplomat, Impostor,
Paradigm, Scout, Witch, Wither). The shape of the work is always the same split: most of a playbook
is pure catalog data with an already-solved pattern, and one or two moves are a genuinely new
mechanic that needs real design judgment. This skill's job is to do the mechanical 80% the same way
every time and to explicitly surface the other 20% instead of quietly improvising it.

Read `CLAUDE.md` at the repo root before starting — it is the canonical reference for every
convention named below (the "Adding move content" table, "Move changes: what breaks", the Astir/
Ardent/Equipment sections, sheet-styling rules). This skill tells you the *order of operations* and
*where to stop and ask*; CLAUDE.md tells you the *exact shape* once you know what you're building.

## 0. Inputs needed from the user

If not already provided, ask for (or locate) the playbook's full rules text: name, stats/Approach
options, starting gear, starting moves, Gravity Trigger, Look/Consider prompts, and the full text of
every playbook move. Don't guess flavor text or move wording from the name alone — Look/Consider and
move descriptions should come from the actual rules text, not be invented. (Exception: if the user
explicitly asks you to author flavor text because the source material doesn't specify it, do so and
say so — this happened for Wither's four purely-descriptive moves, which had a mechanical hook
specified but no verbatim rules prose.)

## 1. Classify every move first, before touching any file

For each move, match its rules text against CLAUDE.md's "Adding move content" table (the
`traits`/`conditions`/`hold`/`flatHold`/`grantsAutomaticSuccess`/`uses`/`tierBonus`/
`downtimeTokensMax`/`fixedTraits`/`intents`/prose-only rows). Most moves land on an existing row or
are pure prose — that's the common case and needs no new code, just correctly-shaped data.

A move needs a **new mechanic** only when it doesn't fit any existing row or existing flag semantics
(not just "no move has used this exact flag before" — reusing `grantsAutomaticSuccess` with a new
`costsPeril`-style cost variant, as Wither's Dark Rebirth did, is still "fits an existing row").
Before writing any code for a genuinely new mechanic:

1. Write out the design ambiguities explicitly, the way the Wither plan's section 5.1 did for
   Number Of The Beast's exploding dice (original vs. post-substitution face, all dice vs. kept
   dice, cap constant, etc.) — one bullet per ambiguity, with a recommended reading and its
   rationale.
2. Confirm the reading with the user (or proceed on your stated recommendation if the user has
   already signaled they're fine with judgment calls being made and flagged, as prior playbook
   sessions in this project have) before finalizing the plan.
3. Never invent machinery mid-content-entry for a system that doesn't exist yet (weapon-tag
   profiles, roll-modifier stacking, move prerequisites, result tiers above 10+) — transcribe as
   prose with a comment flagging the gap, per CLAUDE.md's "Systems that do not exist yet" list.

## 2. Data-only checklist (no design judgment — copy the pattern of the most recent prior playbook)

Find the most recently added playbook's commit (`git log --oneline -- scripts/moves/move-pools/`
or similar) and mirror its shape field-for-field for:

- `scripts/actor-creation.js` — `PLAYBOOKS` entry (`packId`, `name`).
- `scripts/core/approaches.js` — `PLAYBOOK_APPROACHES["<slug>"]`.
- `scripts/playbook/gravity-triggers.js` — `GRAVITY_TRIGGERS["<slug>"]`.
- `scripts/playbook/playbook-flavor.js` — `PLAYBOOK_FLAVOR["<slug>"]` (`look` + `consider` arrays).
- `scripts/equipment/starting-gear.js` — new `STARTING_GEAR_POOLS` entry (`freeformNotes`,
  `grantedItems`, `groups` with `chooseCount`).
- `scripts/moves/starting-moves.js` — new `STARTING_MOVE_POOLS` entry (`grantedKeys`,
  `pickOneKeys`, `chooseCount`) — only needed if the playbook grants a pick from its own pool at
  creation (e.g. an Astir's bonus move); otherwise this step may be a no-op, confirm against the
  rules text.
- `scripts/moves/move-pools/<slug>.js` — new pool file exporting one `{ key, label, playbookName,
  moves }` object (mirror an existing pool file's shape exactly), then register it in
  `scripts/moves/move-pools/index.js`: add the import and append it to the exported `MOVE_POOLS`
  array, after the last existing entry. `scripts/moves/playbook-moves.js` itself is a barrel and
  needs no edit for this. Every move key is pool-prefixed (`<slug>:move-key>`).
- `src/packs/basic-playbook-<slug>/character_<Name>_<fresh-8-char-id>.json` — copy the most recent
  prior playbook's compendium source doc structure exactly; generate a **fresh** random 8-char
  alphanumeric id, never reuse another playbook's.
- `module.json` — new `basic-playbook-<slug>` pack entry, mirrored off the existing blocks.

**Build step (not skippable):** run `npm run pullJSONtoLDB` to compile the new pack into the real
gitignored LevelDB directory the module loads at runtime. If Foundry is currently running, this can
fail on packs it holds open with a lock — if so, ask the user to close Foundry, or compile only the
new pack in isolation as a stopgap and tell the user to re-run the full command once Foundry is
closed. Don't skip re-running it after Foundry closes; a partially-compiled set of packs is easy to
forget about.

**On a local Windows dev setup, also re-copy `module.json` into `Data/modules/armor-astir`** (see
`docs/windows-dev-setup.md`) — this step just edited `module.json` to add the new pack entry, and
that file is a plain copy there, not a junction, so the copy goes stale the moment the repo's
version changes. Skipping this produces no error at compile or reload time; the symptom only shows
up later as Foundry saying the new playbook is missing from the compendium, since its manifest copy
never learned the new pack exists. Don't assume a working directory outside the repo — check
whether `Data/modules/armor-astir` is reachable (e.g. listed as an additional working directory)
before attempting this, and skip it silently if it isn't this user's machine.

## 3. Real-mechanic implementation

Once any new-mechanic design questions from step 1 are resolved, implement them following whichever
existing precedent is closest (grep for the flag family: `grantsAutomaticSuccess`, `grantsAdvantageOnMove`/
`grantedAdvantageForMove`, `addsTraitToMove`, `uses`, standing actor-wide effects like
`grantsExplodingSixes`/`grantsHauntedStandingRoll`). Two failure modes to check for explicitly,
both hard-won from prior playbook additions:

- **A flag read generically across all actors (not scoped to one target move) must still verify the
  acting actor has actually picked the move that grants it**, not just check ambient actor state.
  Dark Rebirth's `costsPeril` branch in `_availableAutomaticSuccess` originally checked only "does
  this actor have zero peril Dangers," with nothing checking whether Dark Rebirth was even picked —
  it would have offered itself to every actor's Bite the Dust roll. Any new standing/global-state
  branch needs the same "is this move in `resolvePlaybookMoves(this._playbookMoves())`" guard the
  cost/useKey branches get for free by construction.
- **Don't let a new field on `rollMove`'s or `_onMoveResolved`'s return/argument shape break an
  existing consumer that does a strict array/shape assertion** (e.g. `rolledDoubles`'s
  `kept.length === KEPT_DICE` check) — extend additively, and re-run the full suite rather than just
  the new test file.

## 4. Test plan

Mirror the shape of the most recent prior playbook's test additions:

- New `tests/playbook-actor-sheet-<slug>.test.js` only if the playbook introduces sheet-level logic
  (new mechanics) — pure data-only playbooks may not need one.
- One `describe`/`it` block per playbook in each of: `tests/approaches.test.js`,
  `tests/gravity-triggers.test.js`, `tests/playbook-flavor.test.js`, `tests/starting-gear.test.js`,
  `tests/starting-moves.test.js`, `tests/playbook-moves.test.js` (pool shape + the generic
  move-key-uniqueness assertion picks up new keys automatically).
- Extend the relevant `tests/move-*.test.js` file (`moves.test.js` was split by concern — see
  `move-roll.test.js`, `move-roll-modifiers.test.js`, `move-roll-dialog.test.js`, `move-dice.test.js`,
  `move-output.test.js`, `move-helpers.test.js`, `move-roll-moves.test.js`; match the new mechanic to
  whichever file already covers that function) or `tests/move-chat-listeners.test.js`, for any new
  mechanic function (e.g. a new pure dice-math helper, a new spend branch).
- Check `tests/actor-creation.test.js` for a fixed-length/fixed-list assertion over `PLAYBOOKS`
  before assuming it needs no change — it hasn't, the last several times, because it's scoped
  generically, but verify by inspection each time rather than assuming.
- `tests/playbook-actor-sheet-moves.test.js` (the full `moveGroups` `toEqual`) only needs updating
  if you add a **basic or special** move, never for a playbook move — per CLAUDE.md's own note.

## 5. Before declaring done

Per CLAUDE.md: `git add` the changes and run `npx lint-staged` and `npm run test:coverage`. Coverage
is a **hard 100% gate**, not advisory — every new branch (including any new judgment-call branch
from step 3) needs an exercising test before you're done, not a follow-up. Do not commit unless the
user explicitly asks.

## 6. Delegating the implementation

Once the data-only checklist and any new-mechanic design questions are settled (step 1's ambiguities
resolved, either by the user or by your stated recommendation), this is exactly the kind of
self-contained, fully-specified task CLAUDE.md's "Implementing Plans from Plan Mode" section asks to
hand to a subagent rather than grinding through inline — write the finalized checklist + mechanic
specs as the brief (not "implement the plan we discussed"), and let the subagent do the file-by-file
work and iterate on `test:coverage` until it's green.
