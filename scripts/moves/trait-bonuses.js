// Pure helpers for a move's declarative traitBonus (Arcane Augments, Let Loose — see
// playbook-moves.js), kept free of any Foundry API the same way entry-list.js is, so the summing
// logic is testable without stubbing an actor. Mirrors the catalog-in-code / keys-on-actor split
// every other system in this module uses: a move just carries a plain traitBonus object, and
// PlaybookActorSheet evaluates it generically (see claude.md, "Anything that depends on actor
// state...").
//
// traitBonus shape: { trait?, chooseTrait?, per, max? }
//   trait        — fixed target trait key (e.g. Arcane Augments always targets channel).
//   chooseTrait  — true when the target is picked per-actor instead (Let Loose); the caller
//                  resolves it via `choices[move.key]`, keyed the same way system.attributes.
//                  moveUses/moveHold already key per-move state.
//   per          — which count this bonus scales with; see TRAIT_BONUS_SOURCES below.
//   max          — optional cap on the bonus itself (Arcane Augments' +3). Uncapped when absent —
//                  Let Loose's own text overrides the usual Trait max, so nothing here should
//                  reimpose one.
export const TRAIT_BONUS_SOURCES = {
	danger: "dangerCount",
	burden: "burdenCount"
};

// Sums every traitBonus-bearing move's contribution, keyed by target trait — two sources can
// stack onto the same trait (e.g. a hypothetical second bonus move), so this is addition, not a
// last-write-wins map. A move whose target can't be resolved (chooseTrait with nothing picked
// yet) or whose resolved bonus is 0 or less contributes nothing, so an actor with no
// traitBonus moves picked resolves to an empty object.
export function traitBonusesFor(moves, { dangerCount = 0, burdenCount = 0, choices = {} } = {}) {
	const counts = { dangerCount, burdenCount };
	const bonuses = {};
	for (const move of moves) {
		const traitBonus = move.traitBonus;
		if (!traitBonus) continue;
		const trait = traitBonus.chooseTrait ? choices[move.key] : traitBonus.trait;
		if (!trait) continue;
		const count = counts[TRAIT_BONUS_SOURCES[traitBonus.per]];
		const bonus = traitBonus.max != null ? Math.min(traitBonus.max, count) : count;
		if (bonus <= 0) continue;
		bonuses[trait] = (bonuses[trait] ?? 0) + bonus;
	}
	return bonuses;
}
