// Pure helpers for a move's declarative traitBonus (Arcane Augments — see playbook-moves.js), kept
// free of any Foundry API the same way entry-list.js is, so the summing logic is testable without
// stubbing an actor. Mirrors the catalog-in-code / keys-on-actor split every other system in this
// module uses: a move just carries a plain traitBonus object, and PlaybookActorSheet evaluates it
// generically (see claude.md, "Anything that depends on actor state...").
//
// traitBonus shape: { trait, per, max? }
//   trait        — fixed target trait key (e.g. Arcane Augments always targets channel).
//   per          — which count this bonus scales with; see TRAIT_BONUS_SOURCES below.
//   max          — optional cap on the bonus itself (Arcane Augments' +3).
export const TRAIT_BONUS_SOURCES = {
	danger: "dangerCount",
	burden: "burdenCount"
};

// Sums every traitBonus-bearing move's contribution, keyed by target trait — two sources can
// stack onto the same trait (e.g. a hypothetical second bonus move), so this is addition, not a
// last-write-wins map. A move whose resolved bonus is 0 or less contributes nothing, so an actor
// with no traitBonus moves picked resolves to an empty object.
export function traitBonusesFor(moves, { dangerCount = 0, burdenCount = 0 } = {}) {
	const counts = { dangerCount, burdenCount };
	const bonuses = {};
	for (const move of moves) {
		const traitBonus = move.traitBonus;
		if (!traitBonus) continue;
		const trait = traitBonus.trait;
		if (!trait) continue;
		const count = counts[TRAIT_BONUS_SOURCES[traitBonus.per]];
		const bonus = traitBonus.max != null ? Math.min(traitBonus.max, count) : count;
		if (bonus <= 0) continue;
		bonuses[trait] = (bonuses[trait] ?? 0) + bonus;
	}
	return bonuses;
}

// The Witch's Patron move ("as long as your Patron has at least 1 Influence, your CHANNEL is
// increased by 1") — a boolean threshold gate, not a linear per-count scale like
// TRAIT_BONUS_SOURCES above, so it's a separate pure function rather than a third entry there.
// influence itself is a plain manual counter (see patron-mixin.js's _witchInfluence) with no cap
// of its own; only whether it's >= 1 matters here.
export function patronChannelBonus(moves, influence) {
	return influence >= 1 && moves.some((move) => move.grantsChannelWhileInfluence) ? 1 : 0;
}

// Let Loose ("the usual max of +3 does not apply to increases earned through let loose") is pure
// rules text — the +1-per-burden increase is manual bookkeeping via the Trait +/- stepper, not a
// traitBonus. removesTraitCap is the one piece that has to be real code: without it, the stepper's
// own always-on +3 ceiling (progression-mixin.js's TRAIT_MAX) would silently make Let Loose's text
// impossible to act on. Scoped to the base Trait value only — there is no separate cap on
// traitBonus sums (Arcane Augments etc.) for this to also lift.
export function hasUnboundedTraits(moves) {
	return moves.some((move) => move.removesTraitCap);
}
