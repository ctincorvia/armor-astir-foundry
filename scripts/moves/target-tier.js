import { NPC_ACTOR_TYPE } from "../world-actors/npc-actor-sheet.js";

// Wraps the raw game.user.targets read (this module has no other targeting plumbing at all) so
// it's mockable in tests, the same isolation reasoning every other Foundry-global touch in this
// codebase gets (see claude.md). Only ever resolves to a target when there's exactly one target
// and it's specifically an NPC actor (see claude.md, "World actors") — another Playbook character,
// a Carrier/Authority/Cause, or an ambiguous multi-target selection all resolve to null.
export function getTargetedNpc() {
	const targets = Array.from(game.user?.targets ?? []);
	if (targets.length !== 1) return null;
	const { actor } = targets[0];
	return actor?.type === NPC_ACTOR_TYPE ? actor : null;
}
