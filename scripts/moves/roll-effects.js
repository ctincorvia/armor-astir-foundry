export const DIE_FACES = 6;
export const KEPT_DICE = 2;

// Number Of The Beast's exploding-6 mechanic (see moves.js#explodeSixes) — purely a defensive cap
// against a runaway explosion chain, not a balance lever: 8 consecutive 6-in-6 explosions is
// astronomically unlikely (6^-8), so this is never expected to actually bind in play.
export const NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS = 8;

// Advantage/Disadvantage: roll one extra die per stack (up to two stacks) and keep the
// highest/lowest two. Mutually exclusive with each other, hence one flat list rather than two
// independent toggles — selecting one is structurally exclusive of the others.
export const ADVANTAGE_STATES = [
	{ key: "none", label: "None", dice: 2, keepLowest: false },
	{ key: "advantage", label: "Advantage", dice: 3, keepLowest: false },
	{ key: "advantage2", label: "Advantage x2", dice: 4, keepLowest: false },
	{ key: "disadvantage", label: "Disadvantage", dice: 3, keepLowest: true },
	{ key: "disadvantage2", label: "Disadvantage x2", dice: 4, keepLowest: true }
];

// Confidence/Desperation: substitute one die face for another. Mutually exclusive with each
// other and non-stacking, hence a flat list like ADVANTAGE_STATES above.
export const EFFECT_STATES = [
	{ key: "none", label: "None", from: null, to: null },
	{ key: "confidence", label: "Confidence", from: 1, to: DIE_FACES },
	{ key: "desperation", label: "Desperation", from: DIE_FACES, to: 1 }
];

export function advantageState(key) {
	return ADVANTAGE_STATES.find((state) => state.key === key) ?? ADVANTAGE_STATES[0];
}

export function effectState(key) {
	return EFFECT_STATES.find((state) => state.key === key) ?? EFFECT_STATES[0];
}

// Mutates a DiceTerm's results array in place: substitutes faces per `effect`, then flags the
// kept KEPT_DICE entries as active and the rest as discarded per `advantage`, mirroring the
// active/discarded fields Foundry's own DiceTerm._keepOrDrop sets so the chat tooltip renders
// discarded dice correctly. Substitution runs before keep-selection so a die that becomes a 6
// under Confidence can then be kept as a high die (and vice versa for Desperation) — see
// claude.md-adjacent plan notes on ordering.
//
// Returns a plain-data breakdown (one entry per die, in original roll order) for display: the
// mutation above overwrites result.result in place, so this is the only place the die's original
// face is still available.
export function applyRollEffects(results, { advantage, effect }) {
	const originals = results.map((result) => result.result);

	for (const result of results) {
		if (result.result === effect.from) result.result = effect.to;
	}

	const sorted = [...results].sort((a, b) => (advantage.keepLowest ? a.result - b.result : b.result - a.result));
	const kept = new Set(sorted.slice(0, KEPT_DICE));

	for (const result of results) {
		const isKept = kept.has(result);
		result.active = isKept;
		result.discarded = !isKept;
	}

	return results.map((result, index) => ({
		original: originals[index],
		result: result.result,
		changed: originals[index] !== result.result,
		kept: result.active
	}));
}

// True when the two dice actually kept for the total (see applyRollEffects) show the same face —
// Flourish Component's "regain 1 Power when you roll doubles" reads off this (see
// PlaybookActorSheet#_onMoveResolved). Checked post-substitution/post-keep-selection, i.e. against
// what the roll actually resolved to, not the original faces.
export function rolledDoubles(dice) {
	const kept = dice.filter((die) => die.kept);
	return kept.length === KEPT_DICE && kept.every((die) => die.result === kept[0].result);
}

export function rollConditions(advantage, effect) {
	const conditions = [];
	if (advantage.key !== "none") conditions.push({ key: advantage.key, label: advantage.label });
	if (effect.key !== "none") conditions.push({ key: effect.key, label: effect.label });
	return conditions;
}

// Retroactively adding Advantage/Disadvantage to an already-posted roll (see moves.js#rollMove's
// showAddAdvantage/showAddDisadvantage and move-chat-listeners.js#handleAdvantage) walks
// ADVANTAGE_STATES one step at a time in the requested direction: "none" jumps straight to the
// 3-dice state, and clicking the same direction again stacks up to the 4-dice cap (returning
// null once maxed). Clicking the *opposite* direction steps back down instead of stacking or
// being blocked — one step down keeps the current direction's keepLowest, only landing on
// direction-flipped state once it reaches "none" (advantage2 + disadvantage -> advantage,
// advantage + disadvantage -> none), so both sides of the axis stay reachable from a maxed state.
export function nextAdvantageState(key, direction) {
	const current = advantageState(key);
	if (current.key === "none") return advantageState(direction);
	const sameDirection = current.keepLowest === (direction === "disadvantage");
	if (sameDirection) {
		if (current.dice >= 4) return null;
		return ADVANTAGE_STATES.find((state) => state.keepLowest === current.keepLowest && state.dice === current.dice + 1);
	}
	if (current.dice === 3) return ADVANTAGE_STATES[0];
	return ADVANTAGE_STATES.find((state) => state.keepLowest === current.keepLowest && state.dice === current.dice - 1);
}

// Adds one freshly-rolled die to an existing dice breakdown (see applyRollEffects' own return
// shape above) and recomputes which KEPT_DICE dice are kept under the new, one-larger pool —
// mirrors applyRollEffects' own sort/keep logic, but works from the breakdown's already-resolved
// `.result` faces rather than raw DiceTerm results. The existing dice were already substituted
// when the roll first happened and are left untouched; the new die goes through the same
// `effect.from -> effect.to` substitution applyRollEffects applies, before sort/keep-selection, so
// a roll's active Confidence/Desperation still applies to a die added later via Advantage/
// Disadvantage. `effect` defaults to a no-op shape so callers with no active effect can omit it.
export function addDie(dice, keepLowest, newFace, effect = { from: null, to: null }) {
	const substituted = newFace === effect.from ? effect.to : newFace;
	const pool = [...dice.map(({ result }) => ({ result })), { result: substituted }];
	const sorted = [...pool].sort((a, b) => (keepLowest ? a.result - b.result : b.result - a.result));
	const kept = new Set(sorted.slice(0, KEPT_DICE));

	return [
		...dice.map((die, index) => ({ ...die, kept: kept.has(pool[index]) })),
		{ original: newFace, result: substituted, changed: substituted !== newFace, kept: kept.has(pool[dice.length]) }
	];
}

// The inverse of addDie above, for nextAdvantageState's new step-down case: drops the last entry
// in the breakdown (the die that was most recently added by a prior stack-up) and recomputes
// which KEPT_DICE dice are kept under the new, one-smaller pool. Never rolls a fresh die — a
// step-down never needs one, since it's only ever discarding an existing die from the pool.
export function removeDie(dice, keepLowest) {
	const remaining = dice.slice(0, -1);
	const pool = remaining.map(({ result }) => ({ result }));
	const sorted = [...pool].sort((a, b) => (keepLowest ? a.result - b.result : b.result - a.result));
	const kept = new Set(sorted.slice(0, KEPT_DICE));

	return remaining.map((die, index) => ({ ...die, kept: kept.has(pool[index]) }));
}
