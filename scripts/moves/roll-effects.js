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
// 3-dice state, an established direction can only step up to the 4-dice cap, and the opposite
// direction is blocked outright rather than silently overriding whatever's already locked in — a
// player can't un-ring the bell on an Advantage a GM already granted by clicking Disadvantage.
export function nextAdvantageState(key, direction) {
	const current = advantageState(key);
	if (current.key === "none") return advantageState(direction);
	if (current.keepLowest !== (direction === "disadvantage")) return null;
	if (current.dice >= 4) return null;
	return ADVANTAGE_STATES.find((state) => state.keepLowest === current.keepLowest && state.dice === current.dice + 1);
}

// Adds one freshly-rolled die to an existing dice breakdown (see applyRollEffects' own return
// shape above) and recomputes which KEPT_DICE dice are kept under the new, one-larger pool —
// mirrors applyRollEffects' own sort/keep logic, but works from the breakdown's already-resolved
// `.result` faces rather than raw DiceTerm results, and never re-runs Confidence/Desperation
// substitution on any of them: the existing dice were already substituted when the roll first
// happened, and a die added after the fact was never subject to that roll's own effect.
export function addDie(dice, keepLowest, newFace) {
	const pool = [...dice.map(({ result }) => ({ result })), { result: newFace }];
	const sorted = [...pool].sort((a, b) => (keepLowest ? a.result - b.result : b.result - a.result));
	const kept = new Set(sorted.slice(0, KEPT_DICE));

	return [
		...dice.map((die, index) => ({ ...die, kept: kept.has(pool[index]) })),
		{ original: newFace, result: newFace, changed: false, kept: kept.has(pool[dice.length]) }
	];
}
