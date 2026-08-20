# Add a "Spend Inspiration" chat-card button for Bardic Inspiration

## Context
The Icon's Bardic Inspiration move
([the-icon.js:49-62](../scripts/moves/move-pools/the-icon.js#L49-L62)) is currently `flatHold: 3`
with no coded spend — its own code comment says applying the d4 "stays a manual, narrated
adjustment," per `docs/domains/moves.md`'s "systems that do not exist yet" convention. The user
wants a chat-card button that spends this hold and rolls the bonus die automatically. Showstopper
([the-icon.js:119-134](../scripts/moves/move-pools/the-icon.js#L119-L134)) upgrades that die to a
d6 when the spending Icon has also picked it.

This is the first genuinely **cross-actor** mechanic in the module: every existing chat-card offer
(reroll, automatic success, downgrade, heat up, advantage) is computed from *the rolling actor's
own* state at roll time and drawn by that same actor's client. Bardic Inspiration needs a
*different* actor (an Icon, not the roller) to act on someone else's already-posted roll — and the
set of who can currently act changes over time (hold refills, actors are added), so eligibility has
to be computed live at render time from `game.actors`, not baked into the flavor HTML once at roll
time the way every other offer is.

**Permission constraint (confirmed against the installed client's `chat-message.mjs`):**
`ChatMessage#canUpdate` only allows the message's author or a GM to call `.update()`. A non-GM Icon
player clicking on someone *else's* roll can't edit that card. Per user decision, this button does
**not** try to live-edit the original roll's total — no socket/GM-relay is introduced. Instead it
spends the hold, rolls the die, and posts a **separate** announcement chat message reporting the
result; adding that number to the roll stays a manual, narrated step, consistent with the "manual
trackers, not enforcement" convention already used throughout this module. Per user decision,
Showstopper's d6 upgrade is auto-detected on the spending Icon.

Per user clarification: the rules assume there is never more than one Icon. If, contrary to the
rules, two Icon actors both have hold to spend on the same roll, whichever eligible actor a given
viewer controls is used; if a viewer (typically the GM) controls more than one eligible actor, one
is picked at random rather than prompting a choice.

## Design

### New declarative flags (data), not hardcoded move keys
Following this module's existing convention (`grantsAutomaticSuccess`, `grantsDowngradeHold`,
`grantsRollStack`, etc. — see `docs/domains/moves.md`'s "Adding move content"), express this as
flags on the move catalog objects rather than hardcoding move keys in the listener:

- `scripts/moves/move-pools/the-icon.js`'s `the-icon:bardic-inspiration` entry gains
  `grantsExternalRollBonus: { dieFaces: 4 }`.
- `the-icon:showstopper` entry gains
  `upgradesExternalRollBonusDie: { moveKey: "the-icon:bardic-inspiration", dieFaces: 6 }` — the same
  "grant lives on the granting move, references its target by `moveKey`" shape
  `grantsAdvantageOnMove`/`grantsTraitOnMove` already use.
- Update both moves' existing code comments, which currently say this stays entirely manual — only
  "add the die to the total" and Showstopper's GRAVITY-clock advance remain manual now.

### `scripts/moves/move-chat-listeners.js` (all new logic lives here — no new file; this file
already owns "read a message's flags, decide button visibility, spend a resource, update/post
chat")
- `eligibleExternalRollBonusActors(rollingActorId)`: `game.actors.filter(...)` for actors that are
  not the roller, that the current user owns (`actor.isOwner` — true for GM on every actor, which is
  what makes the GM see this too), that have picked some move with `grantsExternalRollBonus`, and
  whose hold for that move's key is `> 0`. Mirrors `_availableAutomaticSuccess`'s flag-scan shape in
  `move-grants-mixin.js`, but scanning `game.actors` instead of one sheet's own picked moves.
- `handleExternalRollBonus(message, offer)`: re-runs `eligibleExternalRollBonusActors` fresh (don't
  trust a render-time snapshot — hold can change between render and click), picks one at random if
  more than one, resolves the die size (checking for a picked `upgradesExternalRollBonusDie` move
  targeting the source), decrements the source's hold (`Math.max(HOLD_MIN, current - 1)`, same clamp
  `handleAutomaticSuccess` already uses), rolls `1d{dieFaces}`, and posts a new chat message via
  `dieRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor })` where `flavor` is
  rendered through the existing `MOVE_CHAT_TEMPLATE`'s plain description branch (same shape
  `postMoveDescription` in `move-roll.js` already uses) naming the spending actor, the source move,
  the target actor, and the target's move (`offer.flavorArgs.name`).
- `onRenderMoveChat`: inside the existing `if (advantageOffer)` block, call
  `eligibleExternalRollBonusActors(advantageOffer.actorId)`; if non-empty, append a
  `<button class="move-roll-bonus">Spend Inspiration</button>` into the card
  (`html.find(".armor-astir-move-chat").append(...)`) and wire its click the same way every other
  button here is wired: disable immediately, call the handler, re-enable in a `finally` (rather than
  leaving it permanently disabled, since — unlike every other offer — a single Icon can legitimately
  spend more than one hold point across multiple clicks on the same card, as there's no
  "already spent on this card" flag to make the offer disappear).
- This button is **not** gated by the existing `canAct` (author-or-GM) check used for Add
  Advantage/Disadvantage — it doesn't call `message.update()` at all, only `actor.update()` (on an
  actor the clicking user owns, always permitted) and `ChatMessage.create()`/`Roll#toMessage`
  (always permitted for any player), so the author/GM restriction doesn't apply here.

No changes needed to `move-roll.js`, `moves.js`, or `templates/move-chat.hbs` — the announcement
reuses `postMoveDescription`'s existing template branch, and every other offer type's own logic is
untouched (they still only ever read/write the rolling actor's own state).

### Styling
`styles/move-chat.css:123-163` already groups `.move-reroll`, `.move-automatic-success`,
`.move-heatup` under shared base/hover/disabled rules — add `.move-roll-bonus` to those same three
selector groups for a visually consistent button.

### Docs
Add a paragraph to `docs/domains/moves.md` (after the `grantsDisadvantageConversion` paragraph,
before "A 12+ result hooks in...") documenting `grantsExternalRollBonus`/`upgradesExternalRollBonusDie`
as the first cross-actor mechanism: computed live from `game.actors` at chat-render time rather than
baked at roll time, and why it posts a separate announcement instead of editing the original card
(the `ChatMessage#canUpdate` author/GM wall).

## Verification
- `npx lint-staged` and `npm run test:coverage` must pass (100% coverage gate — the new
  `eligibleExternalRollBonusActors`/`handleExternalRollBonus`/button-wiring logic all need tests in
  `tests/move-chat-listeners.test.js`, following the existing `fakeChatHtml()` harness pattern
  there, extended with an `.append()` stub and a `.move-roll-bonus` `.on()` stub; also extend
  `game.actors.filter` mocking per-test as needed).
- Test cases to cover: button appears only when the current user owns an eligible non-roller Icon
  with hold > 0; doesn't appear for the roller's own card; random selection among 2+ eligible actors
  (mock `Math.random`); Showstopper upgrades the die to d6; hold clamps at `HOLD_MIN`; a stale click
  (hold ran out since render) no-ops.
- Since chat rendering/templates are invisible to the test suite (`renderTemplate` is stubbed — see
  claude.md's "Templates and CSS are invisible to the test suite"), manually verify in a running
  Foundry client: two player accounts, one playing the Icon; confirm the button shows on the
  non-Icon player's roll but not on the Icon's own roll, spending decrements hold and posts a new
  chat message with the rolled die, and the GM's view behaves the same way.
