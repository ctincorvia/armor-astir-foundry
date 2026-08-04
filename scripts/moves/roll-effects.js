export const DIE_FACES = 6;
export const KEPT_DICE = 2;

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
