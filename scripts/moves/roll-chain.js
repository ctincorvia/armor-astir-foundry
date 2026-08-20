// Display order for the Dice/Effect notched sliders (templates/shared/notched-slider.hbs) — not
// roll-effects.js's ADVANTAGE_STATES/EFFECT_STATES catalog order, which that module's other
// callers (nextAdvantageState, etc.) iterate by their own logic and shouldn't be reshuffled for
// display.
// Centered on "none" so every key's position doubles as a signed step offset (see advantageOffset/
// effectOffset below) — the mechanism this whole module exists to provide.
export const ADVANTAGE_DISPLAY_ORDER = ["disadvantage2", "disadvantage", "none", "advantage", "advantage2"];
export const EFFECT_DISPLAY_ORDER = ["desperation", "none", "confidence"];

export function advantageOffset(key) {
	return ADVANTAGE_DISPLAY_ORDER.indexOf(key) - ADVANTAGE_DISPLAY_ORDER.indexOf("none");
}

export function effectOffset(key) {
	return EFFECT_DISPLAY_ORDER.indexOf(key) - EFFECT_DISPLAY_ORDER.indexOf("none");
}

export function stepAdvantage(key, offset) {
	const next = ADVANTAGE_DISPLAY_ORDER.indexOf(key) + offset;
	return next >= 0 && next < ADVANTAGE_DISPLAY_ORDER.length ? ADVANTAGE_DISPLAY_ORDER[next] : null;
}

export function stepEffect(key, offset) {
	const next = EFFECT_DISPLAY_ORDER.indexOf(key) + offset;
	return next >= 0 && next < EFFECT_DISPLAY_ORDER.length ? EFFECT_DISPLAY_ORDER[next] : null;
}

// Resolves one grantsRollModifier entry against the chain's current running state — the unit
// resolveRollChain folds left across. `entry.advantage`/`entry.effect` are the same catalog
// keys every grantsRollModifier entry already carries (e.g. "advantage", "desperation"); under
// step semantics these mean "+1 Advantage"/"-1 Effect" off whatever the state already is, not
// "set to this value" — see roll-chain.js's own module doc in docs/domains/moves.md for why this
// is a zero-data-change reinterpretation of the existing catalog shape. Returns null (the entry
// doesn't apply) when its requiresAdvantage gate fails, when stepping would run off either axis,
// or when the step is a genuine no-op — never let an inapplicable/no-op entry silently "apply".
export function chainEntryResult(state, entry) {
	if (entry.requiresAdvantage && !entry.requiresAdvantage.includes(state.advantage)) return null;

	const nextAdvantage = entry.advantage
		? stepAdvantage(state.advantage, advantageOffset(entry.advantage))
		: state.advantage;
	const nextEffect = entry.effect
		? stepEffect(state.effect, effectOffset(entry.effect))
		: state.effect;
	if (nextAdvantage === null || nextEffect === null) return null;
	if (nextAdvantage === state.advantage && nextEffect === state.effect) return null;

	return { advantage: nextAdvantage, effect: nextEffect };
}

// Folds every checked Roll Modifier, in the order the player checked them, onto the roll's base
// Dice/Effect state — a single left-to-right pass, not a fixed-point loop: an entry that's
// inapplicable when its turn comes is skipped and never retried later in the same pass, even if a
// later entry in the chain would have made it applicable. `applied` is the ordered subset of
// entry keys that actually took effect — the only ones the caller may spend a resource for (see
// move-dialogs.js's configureMoveRoll and move-grants-mixin.js's _spendRollModifiers).
export function resolveRollChain(base, entries) {
	let state = base;
	const applied = [];
	for (const entry of entries) {
		const result = chainEntryResult(state, entry);
		if (!result) continue;
		state = result;
		applied.push(entry.key);
	}
	return { advantage: state.advantage, effect: state.effect, applied };
}
