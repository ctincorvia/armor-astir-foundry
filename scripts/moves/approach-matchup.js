// The Approach "type wheel": each Approach beats the next entry and loses to the previous one,
// cyclically. Pinned as its own ordered list rather than relying on APPROACHES' (approaches.js)
// iteration order, even though today they coincide, so a future reorder of the Approach dropdown
// can't silently reshuffle this wheel.
export const APPROACH_CYCLE = ["mundane", "arcane", "divine", "profane", "elemental"];

// +1 when `attacker` beats `target`, -1 when `target` beats `attacker`, 0 for a tie, an unknown/
// unset key, or a non-adjacent pair (each Approach only beats/loses to exactly one other — the
// other two pairings on the wheel are neutral). Returned as a signed stack count, not an
// "advantage"/"disadvantage" or "confidence"/"desperation" string, so the caller decides which
// axis it feeds — see moves-mixin.js's _targetMatchupEffect, which resolves this to one of
// roll-effects.js's EFFECT_STATES (Tier-vs-Tier is the sibling signal that feeds
// ADVANTAGE_STATES instead, via _targetTierAdvantage, independently of this one).
export function approachMatchupStack(attacker, target) {
	const a = APPROACH_CYCLE.indexOf(attacker);
	const b = APPROACH_CYCLE.indexOf(target);
	if (a === -1 || b === -1) return 0;
	const length = APPROACH_CYCLE.length;
	if ((a + 1) % length === b) return 1;
	if ((b + 1) % length === a) return -1;
	return 0;
}

// Resolves an approachMatchupStack signed count to the Effect-axis state it feeds (Confidence when
// the attacker counters the target's Approach, Desperation when countered, null for a tie/neutral
// pairing) — shared by move-grants-mixin.js's own _targetMatchupEffect (Playbook/Fire Support) and
// carrier-actor-sheet.js's _targetApproachRollModifier (the Carrier's own direct rolls), so the two
// don't each reimplement the same stack-to-effect mapping.
export function approachMatchupEffect(attackerApproach, targetApproach) {
	const stack = approachMatchupStack(attackerApproach, targetApproach);
	if (stack === 1) return "confidence";
	if (stack === -1) return "desperation";
	return null;
}

// The forced Roll Modifier object shape for an Approach matchup result — shared the same way
// approachMatchupEffect above is, so move-grants-mixin.js's _targetMatchupRollModifier and
// carrier-actor-sheet.js's _targetApproachRollModifier build an identical entry.
export function approachRollModifier(effect) {
	if (!effect) return null;
	return {
		key: "target-approach-matchup",
		label: effect === "confidence" ? "Approach Confidence" : "Approach Desperation",
		description: "This roll's Approach confidence/desperation against the currently targeted NPC.",
		advantage: null,
		effect,
		requiresAdvantage: null,
		reminderOnly: false,
		disabled: false,
		disabledReason: null,
		forced: true
	};
}
