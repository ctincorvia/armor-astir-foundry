cat > "C:\Users\Charlie\.claude\plans\i-m-going-to-include-encapsulated-moler-agent-a4f4b1a5924284b25.md" << 'PLANEOF'
# The Wither — Implementation Plan

Scope recap: this plan covers a new playbook end to end. Everything data-shaped (stats,
Look/Consider, Approach, Gear, Gravity Trigger, most moves) is pure catalog data, no new logic.
Three moves get real mechanics: **Dark Rebirth** (extend `grantsAutomaticSuccess`), **Number Of
The Beast** (exploding-6 dice math + 3-sixes trigger badge), **Cold Company** (persistent
haunted/dispelled state that locks Advantage/Disadvantage on every roll and auto-flips on outcome
tier). Everything else stays prose-only per the scope decisions already agreed.

---

## 1. Data-only additions (checklist — patterns already fully resolved, no re-derivation needed)

All of these mirror the Paradigm/Witch commit (`0b8926b`) verbatim — copy their shape field-for-field.

- [ ] `scripts/actor-creation.js` — add `{ packId: "armor-astir.basic-playbook-wither", name: "The Wither" }` to `PLAYBOOKS`.
- [ ] `scripts/core/approaches.js` — add `PLAYBOOK_APPROACHES["the-wither"] = ["profane"]`.
- [ ] `scripts/playbook/gravity-triggers.js` — add `GRAVITY_TRIGGERS["the-wither"] = "When you use your born to die move, advance a GRAVITY clock with someone who fears or mistrusts your magic."`.
- [ ] `scripts/playbook/playbook-flavor.js` — add `PLAYBOOK_FLAVOR["the-wither"]` with the 4-entry `look` array (You look / You wear / Your magic is like / When you launch your Astir, you say) and the 8-prompt `consider` array from the rules text.
- [ ] `scripts/equipment/starting-gear.js` — new `STARTING_GEAR_POOLS` entry: `playbookName: "The Wither"`, `freeformNotes: ["1 Astir III, built on the Astir & Ardents tab.", "Clothes that match your look."]`, `grantedItems: [{ key: "the-wither:withering-grip-i", name: "Withering Grip I", kind: "weapon", tags: ["melee", "bane"], description: "..." }]`, `groups: [{ key: "the-wither:gear", label: "Choose 2 Wither Gear.", chooseCount: 2, items: [Carved Wand I {ranged}, Wicked Blade I {melee, mundane}, Sidearm I {ranged, defensive}, Shield Broach I {ward}] }]` — copy field names straight off the Witch/Paradigm entries in that same file.
- [ ] `scripts/moves/starting-moves.js` — new `STARTING_MOVE_POOLS` entry: `{ playbookName: "The Wither", poolKey: "the-wither", grantedKeys: ["the-wither:born-to-die"], pickOneKeys: [], chooseCount: 0 }`. Zero new logic — `astir.js`'s `chooseAstirMove`/`astirMoveSections` already generically handles "pick a move from your own pool or Cantrips" for the Astir's bonus move.
- [ ] `src/packs/basic-playbook-wither/character_The_Wither_<fresh-8-char-id>.json` — new compendium source doc, copy `src/packs/basic-playbook-witch/character_The_Witch_tHeW1tchN3wZq8Rv.json` structure exactly:
  - `system.stats.channel = { value: 3 }` (no `disabled` key — matches every CHANNEL-granting playbook)
  - `system.attributes.approach = "profane"`
  - `system.playbook = { name: "The Wither", slug: "the-wither", uuid: "" }`
  - fresh random `_id`/`_key` (8-char alphanumeric, Foundry-style)
- [ ] `module.json` — add a `basic-playbook-wither` pack entry, mirrored exactly off the `basic-playbook-witch`/`basic-playbook-paradigm` blocks (`name`, `label: "Basic Playbook - The Wither"`, `path: "packs/basic-playbook-wither"`, `type: "Actor"`, `system: "pbta"`, same `ownership` block).
- [ ] **Post-implementation build step (not skippable):** run `npm run pullJSONtoLDB` to compile `src/packs/basic-playbook-wither/*.json` into the real gitignored LevelDB pack the module actually loads at runtime.

---

## 2. `scripts/moves/playbook-moves.js` — new `MOVE_POOLS` entry

Add a new pool object (insert after `the-witch`, matching `MOVE_POOLS` ordering-by-addition convention):

```js
{
	key: "the-wither",
	label: "The Wither",
	playbookName: "The Wither",
	moves: [
		{
			key: "the-wither:born-to-die",
			name: "Born To Die",
			starting: true,
			traits: [],
			description:
				"<p>You may use the subsystems move by taking a risk instead of spending Power.</p>"
			// Prose only — see section 3.1. subsystems (moves.js SPECIAL_MOVES) has zero enforced
			// Power-spend mechanic today (no flatHold, traits: []), so there's nothing to override.
		},
		{ key: "the-wither:dark-rebirth", ... },           // section 4 — real mechanic
		{ key: "the-wither:number-of-the-beast", ... },    // section 5 — real mechanic
		{ key: "the-wither:cold-company", ... },            // section 6 — real mechanic
		{ key: "the-wither:the-old-blood", ... },           // section 3.2 — addsTraitToMove (real), weapon grant (prose)
		{ key: "the-wither:wretched-visage", traits: [], description: "..." },     // prose only
		{ key: "the-wither:fresh-hells", traits: [], description: "..." },         // prose only
		{ key: "the-wither:abyssal-summons", traits: [], description: "..." },     // prose only
		{ key: "the-wither:dark-guarantees", traits: [], description: "..." }      // prose only
	]
}
```

Every move key is pool-prefixed (`the-wither:*`), matching the existing collision-avoidance convention across `MOVE_POOLS`.

---

## 3. Prose-only / partially-prose moves

### 3.1 Born To Die
Stays exactly as scoped: `traits: []`, description only. No code path to hook — confirmed `subsystems` (`scripts/moves/moves.js` `SPECIAL_MOVES`) has no Power-spend enforcement to override.

### 3.2 The Old Blood — split move
```js
{
	key: "the-wither:the-old-blood",
	name: "The Old Blood",
	traits: [],
	// Real: +CHANNEL becomes an offered rollable trait on Exchange Blows/Strike Decisively, additive
	// not replacing — exact shape Turn Unearthly (the-paradigm:turn-unearthly) already uses, resolved
	// generically by moves-mixin.js#_moveTraits (no new code needed beyond this declaration).
	addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "channel" },
	description:
		"<p>If you are outside your Astir and fighting on foot, you can exchange blows and strike " +
		"decisively with +CHANNEL when attempting to cause physical harm. When appropriate, you will " +
		"obtain a tier I melee weapon with bane and one of the following tags of your choice: " +
		"concealable, area, impact, blitz, ruin/reloading.</p>"
	// The weapon-grant half has no grant mechanism anywhere in the codebase (Soldier's Nightmare of
	// Solomon/Field Scout/Giant Slayer all leave this manual) — player builds it via the Equipment
	// tab's configureEquipment editor, matching every existing precedent. No code needed.
}
```
No new mechanic code required — `_moveTraits()` in `scripts/playbook/playbook-sheet/moves-mixin.js` (~line 262-270) already resolves `addsTraitToMove.moveKeys` generically.

The `piloted` tag already exists on all Astirs, so it is possible to derive whether or not someone is "On foot"

### 3.3 Wretched Visage, Fresh Hells, Abyssal Summons, Dark Guarantees
All four: `traits: []`, description only, no `results`, no roll — matching Bullheaded/White Devil/Subsystems' shape. Dark Guarantees explicitly follows The Arity Method's own precedent/comment (conditional future-roll buff has "no hook yet", stays descriptive).

---

## 4. Dark Rebirth — real mechanic (extend `grantsAutomaticSuccess`)

### 4.1 Move definition
```js
{
	key: "the-wither:dark-rebirth",
	name: "Dark Rebirth",
	traits: [],
	// New variant of the existing grantsAutomaticSuccess mechanism (Hot-blooded/Once the War's
	// Over/The Arity Method): instead of spending this move's own hold/uses pool, the "cost" is
	// adding a Danger of type peril to the actor, gated on the actor currently holding zero
	// peril-type Dangers (see PlaybookActorSheet#_availableAutomaticSuccess). Scoped to
	// bite-the-dust only, same `moves` restriction The Arity Method already uses.
	grantsAutomaticSuccess: { moves: ["bite-the-dust"], costsPeril: true },
	description:
		"<p>If you are forced to bite the dust and have no perils, you may put yourself in peril to " +
		"succeed as if you rolled a 10+. Say what dark rite or power saves you.</p>"
}
```

### 4.2 `scripts/playbook/playbook-sheet/moves-mixin.js` — `_availableAutomaticSuccess(move)` (~line 336-347)

Extend the spendability filter with a `costsPeril` branch, reading `this._dangers()` (already available on the mixin via `tracking-mixin.js`) instead of `moveHold`/`moveUses`:

```js
_availableAutomaticSuccess(move) {
	return ALL_MOVES
		.filter((m) => m.grantsAutomaticSuccess)
		.filter((m) => !m.grantsAutomaticSuccess.moves || m.grantsAutomaticSuccess.moves.includes(move.key))
		.filter((m) => {
			const { cost, useKey, costsPeril } = m.grantsAutomaticSuccess;
			if (costsPeril) {
				const dangers = this._dangers();
				// Gated on zero *peril*-type Dangers currently held (not DANGER_MAX gating elsewhere)
				// and, defensively, not already at DANGER_MAX — can't add a Danger to a full list.
				return dangers.length < DANGER_MAX && dangers.every((danger) => danger.type !== "peril");
			}
			return useKey
				? !this.actor.system.attributes?.moveUses?.[m.key]?.[useKey]
				: (this.actor.system.attributes?.moveHold?.[m.key]?.value ?? 0) >= cost;
		})
		.map((m) => ({ key: m.key, name: m.name, ...m.grantsAutomaticSuccess }));
}
```
`DANGER_MAX` is already imported in this file (`from "./tracking-mixin.js"`), no new import needed.

### 4.3 `scripts/moves/move-chat-listeners.js` — `handleAutomaticSuccess(message, offer, sourceKey)` (~line 28-53)

Extend the spend branch with a `costsPeril` case, appending a Danger the same way `tracking-mixin.js#_onDangerAdd` does:

```js
async function handleAutomaticSuccess(message, offer, sourceKey) {
	const actor = game.actors.get(offer.actorId);
	const move = ALL_MOVES.find((m) => m.key === offer.moveKey);
	const source = offer.sources.find((s) => s.key === sourceKey);
	if (!actor || !move || !source) return;

	if (source.costsPeril) {
		const dangers = actor.system.attributes?.dangers ?? [];
		await actor.update({
			"system.attributes.dangers": [
				...dangers,
				{ id: foundry.utils.randomID(), type: "peril", label: source.name }
			]
		});
	} else if (source.useKey) {
		await actor.update({ [`system.attributes.moveUses.${source.key}.${source.useKey}`]: true });
	} else {
		const current = actor.system.attributes?.moveHold?.[source.key]?.value ?? 0;
		await actor.update({
			[`system.attributes.moveHold.${source.key}.value`]: Math.max(HOLD_MIN, current - source.cost)
		});
	}

	// ...unchanged flavor-rewrite tail below (edits `flavor` to a success, unchanged).
}
```
No import changes needed — this file already imports `HOLD_MIN`/`ALL_MOVES`; `foundry.utils.randomID` is a global.

### 4.4 Regression check
`Hot-blooded` (`cost: 3`), `Once the War's Over` (`cost: 1`), `The Arity Method` (`useKey: "sortie"`) all keep hitting the untouched `useKey`/`cost` branches — `costsPeril` is `undefined` for all three, so the new `if (costsPeril)` branch is simply never entered for them. Zero behavior change.

---

## 5. Number Of The Beast — real mechanic (exploding 6s + 3-sixes trigger)

**Scope reminder:** only the dice math is in code. The "killed in a spectacular fashion" consequence cannot be mechanized (no death/incapacitation system anywhere in this module) — it surfaces as an unmissable chat-card badge only, narrated by the table.

### 5.1 Design risks / judgment calls (flag explicitly for the implementer to confirm before or during build)

1. **Original vs. post-substitution face.** Recommendation: check the **post**-Confidence/Desperation-substitution face (the same `result` field `applyRollEffects` already mutates in place and the chat card already displays) — not the pre-roll `original` face. Rationale: it's the simpler, already-available signal, it's consistent with what the table actually sees on the die, and it lets a Confidence roll's 1→6 substitution genuinely trigger the omen (thematically apt for Wither) while a Desperation roll's 6→1 substitution genuinely suppresses it.
2. **All dice rolled, or just the two kept for the total?** Recommendation: **all** dice in the pool (2-4 depending on Advantage/Disadvantage), including ones discarded by keep-highest/keep-lowest selection — "whenever you roll a 6" reads as a physical-dice trigger, not a "the total counted it" trigger, and it's the more generous/exciting reading for a mechanic literally about escalating supernatural danger.
3. **Do exploded dice get Confidence/Desperation substitution too, and can they re-explode?** Recommendation: **yes to both** — apply the same single-face substitution to every freshly-rolled exploded die, and let an exploded die that lands on a (post-substitution) 6 explode again. This is the standard "exploding dice" trope and keeps the mechanic self-consistent with judgment call #1.
4. **Hard cap on exploding dice.** Recommendation: a defensive constant `NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS = 8` (in `roll-effects.js`, beside `DIE_FACES`/`KEPT_DICE`) — purely a runaway-loop guard (probability of ever hitting it is astronomically low: 8 consecutive 6-in-6 rolls), not a balance lever. Once hit, the loop just stops rolling further explosions; nothing else in the flow needs to react to the cap being hit.

These are genuine ambiguities in the rules text — confirm with the user/table before finalizing if a different reading is preferred; the plan below is written against the recommendations above but every one of them is a one-line change to swap.

### 5.2 Move definition (`playbook-moves.js`)
```js
{
	key: "the-wither:number-of-the-beast",
	name: "Number Of The Beast",
	traits: [],
	// A standing effect on every roll this actor makes (see PlaybookActorSheet#_hasExplodingSixes /
	// moves.js#rollMove's options.explodeOnSix), not scoped to one target move key — the same
	// "actor-wide, not move-scoped" shape Cold Company's own grantsHauntedStandingRoll needs (see
	// section 6), rather than the single-move grantsAdvantageOnMove/grantsEffectOnMove/
	// addsTraitToMove trio.
	grantsExplodingSixes: true,
	description:
		"<p>Whenever you roll a 6, roll an additional die and add it to the total for that roll. If " +
		"you ever roll three 6's during one move, you are killed in a spectacular fashion at the " +
		"nearest suitable moment.</p>"
}
```

### 5.3 `scripts/moves/roll-effects.js` — new constant
```js
// Number Of The Beast's exploding-6 mechanic (see moves.js#explodeSixes) — purely a defensive cap
// against a runaway explosion chain, not a balance lever: 8 consecutive 6-in-6 explosions is
// astronomically unlikely (6^-8), so this is never expected to actually bind in play.
export const NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS = 8;
```

### 5.4 `scripts/moves/moves.js` — new `explodeSixes(dice, effect)` function, colocated with `rollMove` (needs `new Roll`, so belongs here rather than the "pure, no-Foundry-API" `roll-effects.js`)

```js
// Number Of The Beast's exploding-6 mechanic (see playbook-moves.js's the-wither:number-of-the-beast
// / grantsExplodingSixes). Rolls one additional d6 for every die in `dice` (the full pool — see
// applyRollEffects — not just the two kept for the total; see the design-risk note in the plan)
// whose final, post-substitution face shows a 6, and lets a freshly-rolled exploded die that itself
// lands on a 6 explode again, up to NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS as a defensive cap. Each
// exploded die gets the same Confidence/Desperation single-face substitution the initial pool
// already got (see applyRollEffects), so a Desperation roll that turns an exploded 6 into a 1 does
// not chain-explode, and a Confidence roll that turns an exploded 1 into a 6 does.
//
// Returns { bonus, sixCount, extraDice, triggered }:
//  - bonus: sum of every exploded die's final face, added to the roll's total unconditionally
//    ("add it to the total for that roll" — not "if kept").
//  - sixCount: total 6-faces across the *entire* roll (initial pool + every exploded die).
//  - extraDice: {original, result, changed} breakdown per exploded die, same shape as
//    applyRollEffects' own return, for the chat card to render alongside the normal dice list.
//  - triggered: true once sixCount reaches 3. There is no death/incapacitation system anywhere in
//    this module to hook the "killed in a spectacular fashion" consequence into (see claude.md) —
//    this only drives an unmissable chat-card badge; narrating the consequence is left to the table.
export async function explodeSixes(dice, effect) {
	let sixCount = dice.filter((die) => die.result === DIE_FACES).length;
	let toRoll = sixCount;
	const extraDice = [];
	let bonus = 0;

	while (toRoll > 0 && extraDice.length < NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS) {
		toRoll -= 1;
		const explosionRoll = new Roll(`1d${DIE_FACES}`);
		await explosionRoll.evaluate();
		const original = explosionRoll.dice[0].results[0].result;
		const result = original === effect.from ? effect.to : original;
		extraDice.push({ original, result, changed: original !== result });
		bonus += result;
		if (result === DIE_FACES) {
			sixCount += 1;
			toRoll += 1;
		}
	}

	return { bonus, sixCount, extraDice, triggered: sixCount >= 3 };
}
```
Import `NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS` alongside the existing `roll-effects.js` imports at the top of `moves.js`.

### 5.5 `scripts/moves/moves.js#rollMove` — wire it in

After the existing `applyRollEffects` call and before `roll._total` is computed (~line 604-609):

```js
const dice = applyRollEffects(roll.dice[0].results, { advantage, effect });
if (advantage.dice > KEPT_DICE) {
	roll.dice[0].modifiers.push(advantage.keepLowest ? `kl${KEPT_DICE}` : `kh${KEPT_DICE}`);
}

// Number Of The Beast (see playbook-moves.js) — options.explodeOnSix is set by
// PlaybookActorSheet#_rollMove whenever the acting actor has picked that move; applies to every
// roll they make, not just one move key.
const explosion = options.explodeOnSix ? await explodeSixes(dice, effect) : null;

roll._formula = roll.formula;
roll._total = dice.filter((die) => die.kept).reduce((sum, die) => sum + die.result, 0)
	+ (explosion?.bonus ?? 0)
	+ value;
```

**Important regression guard:** do **not** merge `explosion.extraDice` into the `dice` array that gets returned as `{ message, dice, tier }` — `roll-effects.js#rolledDoubles` (Flourish Component's "regain Power on doubles") does `dice.filter((die) => die.kept)` and asserts `kept.length === KEPT_DICE` (exactly 2). If exploded dice were appended into that same array with `kept: true`, a roll that both explodes and rolls doubles on its two real kept dice would silently stop being recognized as doubles. Keep `dice` exactly as `applyRollEffects` returns it; carry `explosion` as a **separate** field, both in the `flavorArgs` passed to the chat template and (optionally) in the returned object if a future caller needs it — the existing `{ message, dice }` return / `_onMoveResolved(move, dice)` call site stays untouched by this move alone (Cold Company's `tier` threading below is the one return-shape change actually needed).

`flavorArgs` (~line 699-728) gets two new fields:
```js
explodedDice: explosion?.extraDice.length ? explosion.extraDice : null,
beastTriggered: Boolean(explosion?.triggered),
```

### 5.6 `templates/move-chat.hbs` — render the exploded dice + trigger badge

Add after the existing `<ol class="move-dice">` block (~line 24):
```hbs
{{#if explodedDice}}
<ol class="move-dice move-dice-exploded">
	{{#each explodedDice}}
	<li class="move-die move-die-exploded{{#if changed}} move-die-changed{{/if}}">
		{{#if changed}}<span class="move-die-original">{{original}}</span>{{/if}}
		<span class="move-die-face">{{result}}</span>
	</li>
	{{/each}}
</ol>
{{/if}}
{{#if beastTriggered}}
<div class="move-beast-trigger">Number Of The Beast: three 6's rolled — you are killed in a spectacular fashion at the nearest suitable moment. Narrate it with your Director.</div>
{{/if}}
```
(A `.move-beast-trigger` CSS rule for an unmissable warning style belongs in `styles/playbook-actor-sheet.css` or wherever `move-chat` styling lives — cosmetic, not covered further here.)

### 5.7 `scripts/playbook/playbook-sheet/moves-mixin.js` — gate `explodeOnSix` on the acting actor

New helper, same shape as `_hasShakenTenet()`:
```js
// Number Of The Beast (see playbook-moves.js's grantsExplodingSixes) — a standing, actor-wide
// effect on every roll, not scoped to any one move key, so this reads the actor's picked moves
// directly rather than going through _grantedXOnMove's single-target-move resolvers.
_hasExplodingSixes() {
	return resolvePlaybookMoves(this._playbookMoves()).some((m) => m.grantsExplodingSixes);
},
```
In `_rollMove` (~line 583-588), fold into `baseOptions`:
```js
const baseOptions = {
	...config,
	...(traitBonus && { traitBonus }),
	...(spentPartLabels.length && { spentPartLabels }),
	...(automaticSuccess.length && { automaticSuccess }),
	...(this._hasExplodingSixes() && { explodeOnSix: true })
};
```

### 5.8 Regression check
`options.explodeOnSix` defaults to falsy for every actor who hasn't picked Number Of The Beast — `explodeSixes` is never called, `flavorArgs.explodedDice`/`beastTriggered` resolve to `null`/`false`, template renders nothing extra. Zero behavior change for every other playbook.

---

## 6. Cold Company — real mechanic (persistent haunted/dispelled state, standing Advantage lock)

### 6.1 Design approach
Reuse the **existing** generic `uses` checkbox mechanism (`system.attributes.moveUses.<moveKey>.<useKey>`, already rendered by `_moveGroupMoves`'s `uses` mapping and writable via the existing `_onMoveUseToggle` handler) instead of inventing a new top-level actor field. This gets the storage field, the sheet checkbox UI, and a manual-override toggle for free, with zero new schema and zero new template markup for the *storage* — only the *read* (Advantage-axis roll lock) and *write* (auto-flip on outcome tier) need new mixin code.

### 6.2 Move definition (`playbook-moves.js`)
```js
{
	key: "the-wither:cold-company",
	name: "Cold Company",
	traits: [],
	// Reuses the existing generic `uses` checkbox (system.attributes.moveUses.<key>.dispelled),
	// rendered and manually toggleable via the existing _onMoveUseToggle handler with zero new code
	// — but also read/written automatically: see PlaybookActorSheet#_coldCompanyAdvantage (every
	// roll's Dice-select lock) and #_onMoveResolved (auto-flip on 10+/6-).
	uses: [{
		key: "dispelled",
		label: "Dispelled (advantage on every roll, until you fail a move with a 6-) — unchecked: haunted (disadvantage on every roll, until you succeed with a 10+)"
	}],
	grantsHauntedStandingRoll: { useKey: "dispelled" },
	description:
		"<p>You are constantly followed by one or more spectres/ghosts/ghouls from your past. Make " +
		"all rolls with disadvantage until you succeed on a move with a 10+ (dispels the haunting for " +
		"a while: roll with advantage until you fail on a move with a 6-, at which point disadvantage " +
		"returns and the cycle begins anew).</p>"
}
```

### 6.3 `scripts/playbook/playbook-sheet/moves-mixin.js` — read path

New shared helper (DRY between the read and write paths):
```js
// Cold Company (see playbook-moves.js's grantsHauntedStandingRoll) — finds the actor's picked
// Cold Company move, if any. Shared by _coldCompanyAdvantage (read, every roll) and
// _onMoveResolved's flip (write, after every roll) so the useKey string only lives in one place.
_coldCompanyMove() {
	return resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsHauntedStandingRoll);
},
// The Advantage-axis standing lock every roll this actor makes gets — unlike
// _grantedAdvantageForMove (Don't Follow Me), which only ever locks one specific target move, this
// applies unconditionally to every roll, so it isn't resolved through that single-target-move
// lookup. Returns null when the actor hasn't picked Cold Company at all — a true no-op for every
// other actor, same "compute regardless, resolves to nothing" stance _grantedEffectForMove etc.
// already take.
_coldCompanyAdvantage() {
	const coldCompany = this._coldCompanyMove();
	if (!coldCompany) return null;
	const { useKey } = coldCompany.grantsHauntedStandingRoll;
	const dispelled = Boolean(this.actor.system.attributes?.moveUses?.[coldCompany.key]?.[useKey]);
	return dispelled ? "advantage" : "disadvantage";
},
```

In `_rollMove` (~line 517), extend the existing single-source `lockedAdvantage`:
```js
// Don't Follow Me's single-target-move grant (see _grantedAdvantageForMove) wins if it and Cold
// Company's standing haunted-state lock somehow both apply — in practice these two moves live on
// mutually exclusive playbooks (Impostor / Wither), so this ordering is a defensive tie-break, not
// an expected real-world collision. An Astir Part's own reactive spend.advantage (Artifact) still
// wins over either, per configureMoveRoll's own precedence — untouched by this change.
const lockedAdvantage = this._grantedAdvantageForMove(move) ?? this._coldCompanyAdvantage();
```

### 6.4 `scripts/moves/moves.js#rollMove` — expose `tier` on the return value

`_onMoveResolved`'s flip needs the roll's outcome tier, which `rollMove` already computes internally (`const tier = moveResultTier(roll.total);`, ~line 611) but never returns. Extend the return statement (~line 748):
```js
return { message, dice, tier };
```
This is the same "extend rollMove's return shape as an escape hatch" pattern CLAUDE.md already documents (added once before for Flourish Component's `dice`).

`postGuidedResult` (moves.js, ~line 756-789) always resolves as a mixed success (`const tier = "mixed";`) and currently returns only a `ChatMessage` (no `{message, dice}` wrapper) — leave its return shape alone; the sheet-layer call site (below) passes the literal `"mixed"` tier directly rather than reading it off a return value, since Cold Company only reacts to `"success"`/`"failure"`, and `"mixed"` is a guaranteed no-op either way.

### 6.5 `scripts/playbook/playbook-sheet/moves-mixin.js` — thread `tier` through and write path

`_rollMove`'s two call-sites of `_onMoveResolved` (~line 549 for Guided, ~line 598 for a real roll):
```js
// Guided ("Take 7-9") branch:
await this._onMoveResolved(move, null, "mixed");
...
// Real-roll branch:
const result = await rollMove(this.actor, move, config.trait, options);
await this._onMoveResolved(move, result.dice, result.tier);
```

`_onMoveResolved(move, dice, tier)` (~line 606-625) — new signature, new Cold Company block inserted **before** the existing `if (!this._mountedFrame()) return;` early-return (same "base playbook feature, not an Astir Part effect, must not be skipped when unpiloted" reasoning the Patron-boon check right above it already documents):

```js
async _onMoveResolved(move, dice, tier) {
	if (move.key === "lead-a-sortie"
			&& resolvePlaybookMoves(this._playbookMoves()).some((m) => m.key === "the-witch:patron")) {
		await this._grantRandomWitchBoons();
	}
	// Cold Company (see _coldCompanyMove/_coldCompanyAdvantage) — flips the haunted/dispelled state
	// based on THIS roll's own outcome tier, for every move this actor rolls. A 7-9 is a no-op either
	// way (Cold Company's own text only reacts to 10+/6-); already-dispelled staying dispelled on
	// another 10+, or already-haunted staying haunted on another 6-, are also no-ops — the checkbox
	// only ever flips, never redundantly re-writes the same value.
	const coldCompany = this._coldCompanyMove();
	if (coldCompany) {
		const { useKey } = coldCompany.grantsHauntedStandingRoll;
		const dispelled = Boolean(this.actor.system.attributes?.moveUses?.[coldCompany.key]?.[useKey]);
		if (tier === "success" && !dispelled) {
			await this.actor.update({ [`system.attributes.moveUses.${coldCompany.key}.${useKey}`]: true });
		} else if (tier === "failure" && dispelled) {
			await this.actor.update({ [`system.attributes.moveUses.${coldCompany.key}.${useKey}`]: false });
		}
	}

	if (!this._mountedFrame()) return;
	const parts = this._mountedParts();
	if (move.key === "lead-a-sortie" && parts.some((part) => part.grantsPotionsOnLeadASortie)) {
		await this._grantPotions();
	}
	if (dice && parts.some((part) => part.regainPowerOnDoubles) && rolledDoubles(dice)) {
		await this._regainAstirPower(1);
	}
}
```

### 6.5.1 Note on `handleReroll`/rerolled moves
`move-chat-listeners.js#handleReroll` calls `rollMove` directly (bypassing `_rollMove`/`_onMoveResolved` entirely, posting a fresh message) — Cold Company's flip will **not** re-fire off a Decisive/Defensive/Versatile reroll's own outcome. This matches the existing precedent that reroll's own result never re-triggers any of `_onMoveResolved`'s other effects either (Flourish Component doubles-regen, Patron boons) — no new gap introduced, just flag it as a known, pre-existing limitation of the reroll path that a future feature might want revisited.

### 6.6 Regression check
- `_coldCompanyMove()` returns `undefined` for every actor without `the-wither:cold-company` picked → `_coldCompanyAdvantage()` returns `null` → `lockedAdvantage` unchanged from today (`this._grantedAdvantageForMove(move) ?? null`).
- `_onMoveResolved`'s new block is a no-op when `coldCompany` is falsy — every existing call site/test (`sheet._onMoveResolved(LEAD_A_SORTIE, null)`, 2-arg calls with `tier` implicitly `undefined`) still behaves exactly as before, since `tier === "success"`/`"failure"` is false when `tier` is `undefined`.
- `rollMove`'s new `tier` field on its return object is additive — no existing caller destructures/asserts an exact `{message, dice}` shape (confirmed: no `toEqual` assertion on `rollMove`'s return value anywhere in `tests/moves.test.js`).

---

## 7. Suggested implementation order

1. Data-only pieces (section 1) + static move-pool entries with prose-only moves (section 3) — gets the playbook selectable and mostly playable, fastest path to a smoke-testable state.
2. Dark Rebirth (section 4) — smallest, most isolated of the three "build" mechanics, extends a mechanism that already has 3 working examples.
3. Number Of The Beast (section 5) — self-contained dice math, no cross-cutting precedence-chain changes, but touches the chat template.
4. Cold Company (section 6) — touches the shared `_rollMove`/`_onMoveResolved` pipeline and the `rollMove` return shape, so land it last once the pipeline is otherwise stable, to minimize churn while the other two are still being tested.
5. Compendium pack JSON + `module.json` + `npm run pullJSONtoLDB` — last, once every move key referenced by `grantedKeys`/pool content is finalized.

---

## 8. Test plan

### 8.1 New test file: `tests/playbook-actor-sheet-wither.test.js`
Mirrors `tests/playbook-actor-sheet-paradigm.test.js`'s setup (same `vi.mock` calls for `equipment.js#configureEquipment`, `astir.js#chooseAstirPart/chooseAstirWeapon`, `carrier-actor-sheet.js#findCarrierActors`) plus `tests/playbook-actor-sheet-roll-results.test.js`'s pattern of mocking `moves.js`'s `configureMoveRoll`/`postGuidedResult`/`rollMove` to unit-test `_rollMove`/`_onMoveResolved` in isolation. Covers:
- `_availableAutomaticSuccess` — Dark Rebirth offered only when the actor has zero peril-type Dangers and isn't at `DANGER_MAX`; not offered once a peril exists; not offered for moves other than `bite-the-dust` (the `moves` restriction).
- `_hasExplodingSixes` — true only when `the-wither:number-of-the-beast` is picked; `_rollMove` passes `explodeOnSix: true` into `rollMove`'s options in that case (assert via the mocked `rollMove`'s call args), and omits it otherwise.
- `_coldCompanyMove`/`_coldCompanyAdvantage` — `null`/no lock when not picked; `"disadvantage"` when the `dispelled` use-checkbox is unset; `"advantage"` once set; `configureMoveRoll` called with the corresponding `lockedAdvantage` in `_rollMove`'s call args (same `toHaveBeenCalledWith(move, expect.any(Array), {...})` pattern the Unreliable-tag tests already use).
- `_onMoveResolved` tier-flip: `tier: "success"` while haunted → `actor.update` called setting `dispelled: true`; `tier: "success"` while already dispelled → no update; `tier: "failure"` while dispelled → `dispelled: false`; `tier: "failure"` while already haunted → no update; `tier: "mixed"` → never updates either way; a move rolled with `tier` unset (2-arg call) → never updates (backward-compat smoke check).
- `_onMoveResolved`'s new call also still fires the pre-existing Patron-boon / Flourish-Component-doubles checks unchanged when Cold Company isn't in play (regression guard for the reordering).

### 8.2 New/extended coverage in `tests/moves.test.js`
- `explodeSixes(dice, effect)` as a directly-imported pure(ish) async function: no 6s → `{ bonus: 0, sixCount: 0, extraDice: [], triggered: false }`; one initial 6 that explodes into a non-6 → correct `bonus`/`extraDice`; a chain of exploded 6s reaching `sixCount >= 3` → `triggered: true`; explosion hits `NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS` → loop terminates instead of hanging (assert `extraDice.length` capped, and that `Roll` wasn't called more than the cap + initial-pool-6-count times); a Desperation roll that substitutes an exploded 6 down to a 1 does not re-explode; a Confidence roll that substitutes an exploded 1 up to a 6 does re-explode.
  - **New test helper needed**: the existing `mockRoll({ dice })` helper replaces `Roll.mockImplementation` with one fixed implementation shared by *every* `new Roll(...)` call, which breaks down once a test needs the initial `${advantage.dice}d6` roll and one-or-more later `1d6` explosion rolls to return *different* results. Add a sibling helper (e.g. `mockRollSequence([[3,3], [6], [2]])`) built on `Roll.mockImplementationOnce` chained per array entry — first entry is the initial pool, each subsequent entry is one explosion die, in call order.
- `rollMove` with `options.explodeOnSix: true` (using the new sequenced mock): asserts `roll._total` includes the exploded bonus, asserts `flavorArgs`/the `renderTemplate` call includes `explodedDice`/`beastTriggered`, and — the regression-guard case — asserts the returned `dice` array is unchanged in length/shape from the non-exploding case (so `rolledDoubles` downstream is unaffected).
- `rollMove`'s return value now includes `tier` — extend an existing assertion (or add one) confirming `result.tier` matches `moveResultTier(roll.total)` for a representative success/mixed/failure case.
- `handleAutomaticSuccess`'s `costsPeril` branch — likely lives in `tests/move-chat-listeners.test.js` instead (see 8.3) since that's where `handleAutomaticSuccess` itself is tested today; cross-reference here so it isn't duplicated.

### 8.3 `tests/move-chat-listeners.test.js` additions
- `handleAutomaticSuccess` with a `costsPeril` source: asserts `actor.update` is called with `system.attributes.dangers` appended with a new `{ id: "test-id", type: "peril", label: <source.name> }` entry (using the existing `foundry.utils.randomID` mock returning `"test-id"`), and that the existing `useKey`/`cost` branches are untouched (regression check alongside the new branch, not a new file).

### 8.4 `tests/playbook-moves.test.js` additions
- The-Wither pool appears in `MOVE_POOLS` with the right `key`/`label`/`playbookName`.
- Move-key-uniqueness test (already generic, ~line 71) picks up the 9 new `the-wither:*` keys automatically — just confirm it still passes, no edit needed unless it fails.
- `the-wither:the-old-blood`'s `addsTraitToMove.trait` ("channel") is a real `TRAITS` key — covered by the existing generic assertion already checking this for every move (per `moves-mixin.js`'s own comment), confirm it extends automatically.
- New explicit assertions for each of the four flags this playbook introduces: `grantsAutomaticSuccess.costsPeril` on Dark Rebirth, `grantsExplodingSixes` on Number Of The Beast, `grantsHauntedStandingRoll`/`uses` on Cold Company, `addsTraitToMove` on The Old Blood.

### 8.5 `tests/starting-gear.test.js`, `tests/starting-moves.test.js`, `tests/gravity-triggers.test.js`, `tests/approaches.test.js`, `tests/playbook-flavor.test.js`
Each gets a new `describe`/`it` block for `"the-wither"`, following the exact per-playbook assertion shape already used for Witch/Paradigm in each of those files (see section 1's checklist for the exact values to assert against — `PLAYBOOK_APPROACHES["the-wither"]` → `["profane"]`, `GRAVITY_TRIGGERS["the-wither"]` → the exact trigger string, `PLAYBOOK_FLAVOR["the-wither"].look`/`.consider` lengths (4 and 8 respectively), `STARTING_GEAR_POOLS` entry's `grantedItems`/`groups` shape, `STARTING_MOVE_POOLS` entry's `grantedKeys`/`pickOneKeys`/`chooseCount`). None of these files' existing assertions need edits — they're all scoped per-playbook, confirmed by inspection (no full-catalog `toEqual` assertions that would break on addition).

### 8.6 `tests/actor-creation.test.js`
Confirm/extend whatever generic-iteration test already covers `PLAYBOOKS` (if any assert against a fixed array length or fixed list of names, that assertion needs a one-line addition — check at implementation time; every other file in section 8.5 was confirmed scoped-per-playbook already, but this file wasn't inspected in as much depth as the others during planning).

### 8.7 Explicitly NOT touched
`tests/playbook-actor-sheet-moves.test.js` — asserts the full `moveGroups` array in one `toEqual` for Basic+Special moves only. Per CLAUDE.md's own documented rule ("adding a playbook move doesn't break that test"), no changes needed there.

### 8.8 Coverage-gate note
Per CLAUDE.md's "100% coverage is a hard gate": every new branch introduced above needs at least one exercising test — in particular the `costsPeril` branch in both `_availableAutomaticSuccess` and `handleAutomaticSuccess`, every branch of `explodeSixes`' `while` loop (0 explosions / 1 explosion / chained explosions / cap hit), both the substitution and re-explosion branches inside it, `_coldCompanyAdvantage`'s two return values, and all four branches of `_onMoveResolved`'s new tier-flip block (success-while-haunted, success-while-dispelled, failure-while-dispelled, failure-while-haunted) plus the mixed/undefined no-op case.

---

## 9. Files touched — summary

**New files:**
- `src/packs/basic-playbook-wither/character_The_Wither_<id>.json`

**Modified (data-only):**
- `scripts/actor-creation.js`
- `scripts/core/approaches.js`
- `scripts/playbook/gravity-triggers.js`
- `scripts/playbook/playbook-flavor.js`
- `scripts/equipment/starting-gear.js`
- `scripts/moves/starting-moves.js`
- `module.json`

**Modified (moves catalog):**
- `scripts/moves/playbook-moves.js` — new `the-wither` `MOVE_POOLS` entry (9 moves)

**Modified (real mechanics):**
- `scripts/moves/roll-effects.js` — `NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS` constant
- `scripts/moves/moves.js` — `explodeSixes`, `rollMove` (explosion wiring + `tier` on return)
- `scripts/playbook/playbook-sheet/moves-mixin.js` — `_availableAutomaticSuccess` (costsPeril), `_hasExplodingSixes`, `_coldCompanyMove`/`_coldCompanyAdvantage`, `_rollMove` (lockedAdvantage chain, explodeOnSix option, tier threading), `_onMoveResolved` (new signature + Cold Company flip)
- `scripts/moves/move-chat-listeners.js` — `handleAutomaticSuccess` (costsPeril branch)
- `templates/move-chat.hbs` — exploded-dice list + beast-trigger badge

**New test file:**
- `tests/playbook-actor-sheet-wither.test.js`

**Modified test files:**
- `tests/moves.test.js`, `tests/move-chat-listeners.test.js`, `tests/playbook-moves.test.js`, `tests/starting-gear.test.js`, `tests/starting-moves.test.js`, `tests/gravity-triggers.test.js`, `tests/approaches.test.js`, `tests/playbook-flavor.test.js`, `tests/actor-creation.test.js` (verify only)

### Critical Files for Implementation
- scripts/playbook/playbook-sheet/moves-mixin.js
- scripts/moves/moves.js
- scripts/moves/playbook-moves.js
- scripts/moves/move-chat-listeners.js
- scripts/moves/roll-effects.js
PLANEOF
echo "written"