import { NPC_ACTOR_TYPE } from "../world-actors/npc-actor-sheet.js";

// Wraps the raw game.user.targets read (this module has no other targeting plumbing at all) so
// it's mockable in tests, the same isolation reasoning every other Foundry-global touch in this
// codebase gets (see claude.md). Only ever resolves to a target when there's exactly one target
// and it's specifically an NPC actor (see docs/domains/world-actors.md, "World actors") — another Playbook character,
// a Carrier/Authority/Cause, or an ambiguous multi-target selection all resolve to null.
export function getTargetedNpc() {
	const targets = Array.from(game.user?.targets ?? []);
	if (targets.length !== 1) return null;
	const { actor } = targets[0];
	return actor?.type === NPC_ACTOR_TYPE ? actor : null;
}

// The Advantage-axis counterpart to approach-matchup.js's approachMatchupEffect — +1 higher/-1
// lower/0 equal Tier resolves to advantage/disadvantage/null. Shared by move-grants-mixin.js's own
// _targetTierAdvantage (Playbook/Fire Support) and carrier-actor-sheet.js's _targetTierRollModifier
// (the Carrier's own direct rolls), so the two don't each reimplement the same stack math.
export function tierMatchupAdvantage(attackerTier, targetTier) {
	const stack = Math.sign(attackerTier - targetTier);
	if (stack === 1) return "advantage";
	if (stack === -1) return "disadvantage";
	return null;
}

// The forced Roll Modifier object shape for a Tier matchup result — shared the same way
// tierMatchupAdvantage above is, so move-grants-mixin.js's _targetTierRollModifier and
// carrier-actor-sheet.js's own version build an identical entry.
export function tierRollModifier(advantage) {
	if (!advantage) return null;
	return {
		key: "target-tier-matchup",
		label: advantage === "advantage" ? "Tier Advantage" : "Tier Disadvantage",
		description: "This roll's Tier advantage/disadvantage against the currently targeted NPC.",
		advantage,
		effect: null,
		requiresAdvantage: null,
		reminderOnly: false,
		disabled: false,
		disabledReason: null,
		forced: true
	};
}
