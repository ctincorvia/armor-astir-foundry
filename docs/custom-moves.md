# Custom Moves — GM Field Reference

This page lists every field you can set on a custom Move, in plain language, with the JSON shape
and a short example for each. It's meant to be read by a GM/Director, not a developer — if you're
looking for the underlying code, see the "See also" section at the bottom.

## Overview

There are two ways to add a custom Move:

1. **The inline form.** Open the reflavor/custom-content settings panel (the module's settings
   menu), and use the "Add a Custom Entry" section. It has dedicated fields for Key, Name, and
   Description, plus Traits for a Move. Anything beyond those four goes into the **Advanced** box
   as a JSON object — its keys get merged straight onto the Move you're creating.
2. **A JSON file upload.** The same panel can also load a whole JSON file that adds several Moves
   (and Equipment, Astir Weapons, Astir/Ardent Parts) at once, under a top-level `"additions"` key.
   See `reflavor-examples/scifi-reskin.json` in this repository for a full worked example — its
   `additions.moves` array is a set of real custom Moves that validate and load cleanly.

Whichever way you add it, **every custom Move's key must start with `custom:`** (e.g.
`custom:overclock-surge`) — a key that doesn't start with that prefix is rejected.

Only four fields have their own dedicated boxes in the inline form: `key`, `name`, `description`,
and `traits`. Every other field below is something you type as a JSON key into the Advanced
textarea (inline form) or directly into the Move object in your uploaded file.

## Required fields

Every custom Move needs:

- **`key`** (string) — must start with `custom:` and be unique. Example: `"custom:field-repairs"`.
- **`name`** (string) — the Move's display name. Example: `"Field Repairs"`.
- **`description`** (string) — the Move's rules text, shown wherever the Move's own "?" or Chat
  button is used. Plain text works; simple HTML tags (`<p>`, `<ul>`/`<li>`, `<strong>`) are also
  fine and render as formatted text. Example: `"<p>Once per Sortie, patch an Astir back into
  fighting shape.</p>"`.
- **`traits`** (array of trait keys) — which stats this Move can roll +. Use an empty array `[]`
  for a Move with no base-stat roll at all (a pure-fiction Move, or one that only uses
  `conditions` below). Example: `["channel"]` or `[]`.

## Field reference

Everything in this section is optional, and goes into the Advanced JSON box (or the Move object in
an uploaded file) alongside the four required fields above.

### Roll & results

- **`results`** — the chat-card text shown for each roll outcome.
  Shape: `{ "success": "...", "mixed": "...", "failure": "...", "critical": "..." }`.
  `critical` is optional — it only matters on a 12+, and if you leave it out, the `success` text is
  reused for a 12+ as well. You can also set any tier's text to `null` if you deliberately want no
  text for that tier (rather than just leaving the key out).
  ```json
  "results": {
    "success": "The surge holds. Mark overheating and do something impossible.",
    "mixed": "The surge holds, but the strain shows — mark overheating, take a peril, and do something impossible.",
    "failure": "Something critical blows out. Mark overheating and take a peril of the Director's choice."
  }
  ```

- **`conditions`** — checkbox options worth +1 each on the roll, for Moves with no base stat to
  roll (Help/Hinder-style Moves). These stack with each other and add on top of (never instead of)
  any `traits` value.
  Shape: `[{ "key": "...", "label": "..." }, ...]`.
  ```json
  "conditions": [
    { "key": "downtime", "label": "You spent Downtime preparing" },
    { "key": "hook", "label": "You're acting on a Hook" }
  ]
  ```

- **`intents`** — flavor-only choice buttons with no mechanical effect at all, just letting a
  player record *why* they're rolling.
  Shape: `[{ "key": "...", "label": "..." }, ...]`.

- **`fixedTraits`** — extra roll-option entries appended to the roll dialog as-is. Unlike a normal
  trait, the number here is **not** read live off the actor — it's a fixed value baked into the
  Move, for a stat this module has no character-sheet field for.
  Shape: `[{ "key": "...", "label": "...", "value": 0 }, ...]`.
  Two key names are special-cased by the engine and live-overridden instead of using your fixed
  `value`: `"crew"` (reads the world Carrier's current CREW) and `"familiarity"` (reads the
  rolling actor's own FAMILIARITY stat). Any other key just rolls at the fixed `value` you set.
  ```json
  "fixedTraits": [{ "key": "crew", "label": "CREW", "value": 0 }]
  ```

### Hold & resource tracking

- **`hold`** — hold gained per roll tier, banked to the actor's shared hold pool (the same pool
  Read the Room fills).
  Shape: `{ "success": 3, "mixed": 1, "failure": 0 }` — `critical` is also accepted as an optional
  override for a 12+. **All three of `success`/`mixed`/`failure` must be present numbers** if you
  set `hold` at all — but the engine only ever writes hold from `success`/`mixed`/`critical`; a
  failure roll never grants (or overwrites) hold, so the conventional value for `failure` is simply
  `0`. This also means a re-roll's hold *replaces* whatever was banked before, rather than adding
  to it.
  ```json
  "hold": { "success": 3, "mixed": 1, "failure": 0 }
  ```

- **`flatHold`** (number) — a flat hold grant with no roll behind it at all ("hold 3" with no
  "on a 10+..."). Gives the Move its own separate hold pool (instead of the shared one `hold`
  above writes to) and renders an **Activate** button on the sheet instead of a **Roll** button.
  ```json
  "flatHold": 3
  ```

- **`separateHold`** (must be `true` when present) — routes a roll-tiered `hold` grant (above) into
  its own per-Move pool instead of the shared pool. Use this when your Move's own hold would
  otherwise collide with another hold-granting Move (like Read the Room) on the same character.

- **`suppressActivateButton`** (must be `true` when present) — for a `flatHold` Move only: hides
  the automatic Activate button. Use this if the only way to actually gain the Move's hold is
  through some other mechanism (like a chat-card offer from `grantsDowngradeHold` below) rather
  than a free click.

- **`uses`** — one checkbox per entry, meant as a manual "once per Sortie/Scene" cap. Nothing
  clears a checkbox automatically the instant a Sortie or Scene actually starts — but you can give
  an entry an optional `"period": "Sortie"` or `"period": "Scene"` so the sheet's own Refresh
  Sortie/Refresh Scene button clears it in bulk along with everything else tagged that way, instead
  of the player having to hunt down and manually uncheck it.
  Shape: `[{ "key": "...", "label": "...", "period": "Sortie" }, ...]`.
  ```json
  "uses": [{ "key": "field-repairs", "label": "Used this Sortie", "period": "Sortie" }]
  ```

- **`numericTrackers`** — a generic clamped up/down counter (not a checkbox, a number with a
  minimum and maximum).
  Shape: `[{ "key": "...", "label": "...", "min": 0, "max": 3, "period": "Sortie", "resetTo": "max" }, ...]`.
  `period` works the same as `uses`' own `period` above (opts the counter into being cleared by
  Refresh Sortie/Refresh Scene). `resetTo: "max"` makes the counter start full and deplete
  downward instead of the usual "starts at 0 and fills up" pattern — leave it out for the usual
  behavior.

- **`questionPrompts`** and/or **`questions`** — flavor questions shown in chat when a player spends
  hold from this Move. `questionPrompts` is per-tier text (`{ "success": "...", "mixed": "...",
  "failure": "..." }`); `questions` is a flat array of question strings shown regardless of tier.
  `questionsOnFailure` (must be `true` when present) additionally shows the `questions` list on a
  miss too — most Moves only show questions on a non-failure result, so only set this if your
  Move's own text genuinely calls for it.

### Gating & prerequisites

- **`requiresMoves`** (array of Move keys) — this Move can't be picked, and its Roll button greys
  out, unless the actor already has every Move key listed. If a prerequisite is later removed, an
  already-picked Move's Roll button live-disables too.
  ```json
  "requiresMoves": ["custom:field-repairs"]
  ```

- **`exclusiveGroup`** (string) — Moves that share the same `exclusiveGroup` value can never both be
  offered to the same actor's Move picker at once. Give two mutually-exclusive Moves the same
  group string.

### Granting effects on other moves

Each of these references another Move by its key — that Move (custom or from the built-in
catalog) needs to already exist for the grant to do anything.

- **`grantsAdvantageOnMove`** — permanently locks a named Move's Advantage/Disadvantage whenever
  it's rolled.
  Shape: `{ "moveKey": "...", "advantage": "advantage" }`.

- **`addsTraitToMove`** — adds a new rollable trait option to a Move that doesn't normally offer
  it. Either target one fixed Move (`moveKey`), several fixed Moves (`moveKeys`), or let the player
  pick the target themselves on their own sheet (`chooseMove: true` — omit `moveKey`/`moveKeys`
  when you use this). Optional `requiresUnmounted`/`requiresAstirMounted` (`true`/`false`) further
  restrict when the extra trait option is offered.
  ```json
  "addsTraitToMove": { "moveKey": "exchange-blows", "trait": "channel" }
  ```

- **`addsQuestionsToMove`** — appends extra hold-spend questions to a *different* Move's own
  question list.
  Shape: `{ "moveKey": "...", "questions": ["...", "..."] }` (`questions` can't be empty).

- **`addsFailureReminderToMove`** / **`addsMixedReminderToMove`** / **`addsSuccessReminderToMove`**
  / **`addsCriticalReminderToMove`** — appends a one-line reminder to a named Move's chat card on
  that specific roll tier.
  Shape: `{ "reminder": "...", "moveKeys": ["...", "..."] }`. `moveKeys` is required for the
  mixed/success/failure variants; for `addsCriticalReminderToMove` only, `moveKeys` is optional —
  leaving it out applies the reminder to *every* 12+ roll. `addsCriticalReminderToMove` also
  accepts an optional `requiresTrait` (string) to further restrict it to rolls made with one
  specific trait.
  ```json
  "addsSuccessReminderToMove": { "reminder": "You also mark a tick of Corruption.", "moveKeys": ["exchange-blows"] }
  ```

- **`quickRollsMove`** — gives your custom Move its own Roll button that, instead of rolling your
  Move's own `traits`, actually rolls a *different* named Move, with an optional trait/advantage
  forced and reminders attached.
  Shape: `{ "moveKey": "...", "trait": "...", "advantage": "advantage", "reminders": ["..."] }`
  (`trait`/`advantage`/`reminders` are all optional).

### Equipment & weapon-tag grants

- **`grantsWeaponTags`** (array of tag keys) — every weapon this actor wields gets these tags for
  free, no conditions attached.
  ```json
  "grantsWeaponTags": ["blitz"]
  ```

- **`grantsWeaponTagChoice`** — lets the GM/player pick one tag from a short list, applied only to
  one specific granted weapon (matched by its exact current name).
  Shape: `{ "targetEquipmentName": "...", "options": ["tagKey1", "tagKey2"] }`. Every tag key in
  `options` must be a real tag from the module's tag catalog. Because the match is by name, renaming
  that weapon later (through reflavor or otherwise) breaks the link — avoid renaming a weapon a
  Move references this way.

- **`grantsEquipment`** — snapshots a piece of equipment onto the actor the moment this Move is
  newly picked. This is a one-time copy, not a live reference: editing your custom Move's
  `grantsEquipment` later never retroactively changes gear a character already received.
  Shape: `{ "kind": "weapon" | "gear", "name": "...", "tags": ["..."], "scale": "foot" | "astir" }`
  (`scale` only matters, and is required, when `kind` is `"weapon"`).
  ```json
  "grantsEquipment": { "kind": "weapon", "name": "Standard-Issue Sidearm", "tags": ["ranged", "concealable"] }
  ```

### Actor-wide effects

- **`removesTraitCap`** (must be `true` when present) — lifts the normal +3 ceiling on trait
  stepper values for this actor. Only affects the base trait value, not any derived bonus.

- **`tierBonus`** (number) — added on top of the actor's Tier. If a character has picked several
  Moves that each set `tierBonus`, the values are **summed**, not capped at the highest.

- **`downtimeTokensMax`** (number) — raises the actor's Downtime token cap. If a character has
  picked several Moves that each set `downtimeTokensMax`, only the **highest** one wins (not
  summed) — the opposite rule from `tierBonus` above.

- **`bonusDowntimeTokens`** — grants a separate, restricted-use pool of Downtime tokens, on top of
  (not merged into) the main Downtime token cap above.
  Shape: `{ "max": 1, "description": "Spend on repairing an Astir." }`.

- **`downtimeAbility`** (string) — pure descriptive text shown in the Downtime tab's ability list.
  This is a reference note only; it has no mechanical effect of its own.

### Chat-card offers

- **`grantsAutomaticSuccess`** — posts a chat-card button on a qualifying roll offering to treat it
  as an automatic 10+. Never offered on a roll that's already a 10+.
  Shape: an object with **at most one** of `cost` (number, spent from this Move's own `flatHold`
  pool), `useKey` (string, spent from this Move's own `uses` checkbox by that key), or
  `costsPeril: true` (spends a fresh peril Danger instead) — or none of the three, for a
  completely free offer. Optional `moves` (array of Move keys) restricts which Moves' rolls this
  can apply to; `excludeMoves` (array) is the inverse, excluding specific Move keys from an
  otherwise-unrestricted offer. Optional `requiresTier` (string, e.g. `"failure"`) restricts the
  offer to one specific non-success tier. Optional `buttonLabel` (string) overrides the chat
  button's default text.
  ```json
  "grantsAutomaticSuccess": { "useKey": "sortie", "moves": ["exchange-blows"] }
  ```

- **`grantsDowngradeHold`** — the mirror image of `grantsAutomaticSuccess`: a chat-card offer on a
  10+/12+ that lets the player opt down to a 7-9 in exchange for banking hold to this Move's own
  `flatHold` pool. Only offered while that pool has room left.
  Shape: `{ "amount": 1, "moves": ["..."], "excludeMoves": ["..."] }` (`amount` required,
  `moves`/`excludeMoves` optional, same meaning as `grantsAutomaticSuccess`'s own).

- **`grantsRollModifier`** — adds a checkable option to the roll dialog's "Roll Modifiers" section.
  This is an array — you can add more than one.
  Shape per entry: needs at least one of `advantage`, `effect`, or `reminderOnly: true`.
  `advantage`/`effect` are **signed one-step nudges** (e.g. `"advantage"` means "+1 Advantage from
  wherever the roll's dice/effect sliders currently sit," not "set Advantage to this value
  outright") — not absolute values. Optionally gate the option behind spending a resource, with
  **at most one** of: `requiresOverheating: true` (Astir must be overheating),
  `costsSpotlight: 1` (a number of Spotlight points), `costsHold: { "amount": 1 }` (this Move's own
  hold pool, or another Move's via an optional `moveKey`), `costsPotion: "..."` (an Astir Potion
  key), `costsUse: "..."` (a `uses` checkbox key on this same Move), or `costsTracker: {
  "trackerKey": "...", "amount": 1 }` (a `numericTrackers` pool on this same Move, or another
  Move's via an optional `moveKey`). You can also add `requiresAdvantage` (array of advantage-state
  keys, e.g. `["disadvantage", "disadvantage2"]` — the option only shows while the roll's *current*
  advantage state matches one of these), `moveKeys` (array, restricts which Moves' roll dialogs show
  this option — omit for "every roll"), `forced: true` (pre-checked and impossible to uncheck,
  rather than an optional pick), and `buttonLabel` (string, overrides the row's default label).
  ```json
  "grantsRollModifier": [
    { "advantage": "advantage", "moveKeys": ["exchange-blows", "strike-decisively"], "costsUse": "combat-reflexes" }
  ]
  ```

- **`grantsExternalRollBonus`** / **`upgradesExternalRollBonusDie`** — a cross-actor mechanic: lets
  a *different* actor spend their own hold to roll a bonus die against this actor's already-posted
  roll (a "Bardic Inspiration"-style support Move). Posts as its own separate chat message rather
  than editing the original roll.
  Shapes: `grantsExternalRollBonus: { "dieFaces": 6 }`,
  `upgradesExternalRollBonusDie: { "moveKey": "...", "dieFaces": 8 }` (the second form upgrades the
  die size specifically when the spending actor has also picked the Move named by `moveKey`).

- **`promptsApproachOverride`** — an Activate button letting the player snapshot a chosen Approach
  for the current Scene, or for a longer period. Either bare `true` (Scene-scoped), or an object
  `{ "period": "Sortie" }` for a longer-lived override.

## Not available on custom moves

Setting any of the following in the Advanced JSON is silently ignored — you'll see a warning in
the validation summary, and the field simply won't be applied. These are all real, working fields
on a hand-authored catalog Move, but none of them are currently wired into what a custom Move is
allowed to set:

- `usesWeapon` — the weapon-move wiring isn't reachable from custom content.
- `variableDicePool` / `successOptions` — these opt into an entirely separate dice-pool roll
  pipeline, not supported for custom Moves.
- `requiresParts` — Astir-Part prerequisite gating has no equivalent in the custom Move picker.
- `traitBonus`, `grantsChannelWhileInfluence`, `activatesApproachOverride`, `summonsAlly`,
  `grantsUnpilotedAstirMove` — playbook-specific mechanics (Summoner/Witch/Arcanist-only, etc.),
  not currently wired into the custom-content allowlist.
- `requiresChannelDisabled`, `requiresCrew`, `forcesDesperationAtMaxPerils`,
  `forcesDesperationOnShakenTenet` — availability/Effect-locking gates tied to actor or world
  state (CHANNEL disabled, the Carrier's CREW, Danger/Hook state).
- `disablesMove` — normally lets picking one Move disable another named Move's Roll button.
- `grantsEffectOnMove` — normally permanently locks a named Move's Effect (the `grantsAdvantageOnMove`
  above is available; its Effect-locking counterpart is not).
- `activateChoices`, `showsReadTheRoomQuestions` — normally post a roll-less "pick one"/question-list
  menu via an Activate button.
- `grantsCarrierWeaponAccess` — normally folds the world Carrier's weapons into a named Move's
  weapon-choice list.
- `grantsFamiliarityTrait`, `grantsHauntedStandingRoll`, `grantsExplodingSixes`,
  `grantsChannelOnAnyMove`, `grantsHomeInsteadOfChannel` — standing, actor-wide effects (a live
  FAMILIARITY read, a win/loss Advantage flip, exploding 6s, +CHANNEL on any Move, +HOME replacing
  +CHANNEL for a whole playbook).

If your Move genuinely needs one of these, write the effect into `description` as plain rules text
for now, and note it as a manual/GM-adjudicated ruling at the table.

## See also

- [docs/domains/moves.md](domains/moves.md) — the full developer-facing shape table, including
  fields only available on a hand-authored catalog Move (not through custom content).
- [docs/domains/reflavor.md](domains/reflavor.md) — how the custom-content engine itself works
  (validation depth, the allowlist mechanism, catalog wiring).
