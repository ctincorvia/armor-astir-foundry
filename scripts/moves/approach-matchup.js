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
