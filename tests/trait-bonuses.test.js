import { describe, expect, it } from "vitest";
import { TRAIT_BONUS_SOURCES, hasUnboundedTraits, patronChannelBonus, traitBonusesFor } from "../scripts/moves/trait-bonuses.js";

describe("TRAIT_BONUS_SOURCES", () => {
	it("maps danger and burden to their count keys", () => {
		expect(TRAIT_BONUS_SOURCES).toEqual({ danger: "dangerCount", burden: "burdenCount" });
	});
});

describe("traitBonusesFor", () => {
	it("resolves to an empty object for an empty move list", () => {
		expect(traitBonusesFor([])).toEqual({});
	});

	it("ignores a move with no traitBonus", () => {
		expect(traitBonusesFor([{ key: "m1" }], { dangerCount: 3 })).toEqual({});
	});

	it("applies a fixed-trait bonus scaled by danger count", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves, { dangerCount: 2 })).toEqual({ channel: 2 });
	});

	it("clamps a fixed-trait bonus at its max", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves, { dangerCount: 5 })).toEqual({ channel: 3 });
	});

	it("defaults dangerCount/burdenCount to 0/0 when omitted", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves)).toEqual({});
	});

	it("contributes nothing when the scaled count is 0", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves, { dangerCount: 0 })).toEqual({});
	});

	it("is uncapped when no max is given", () => {
		const moves = [{ key: "unmaxed-source", traitBonus: { trait: "channel", per: "danger" } }];

		expect(traitBonusesFor(moves, { dangerCount: 9 })).toEqual({ channel: 9 });
	});

	it("contributes nothing for a traitBonus with no fixed trait", () => {
		const moves = [{ key: "no-target", traitBonus: { per: "burden", max: 3 } }];

		expect(traitBonusesFor(moves, { burdenCount: 4 })).toEqual({});
	});

	it("stacks two moves' bonuses onto the same trait", () => {
		const moves = [
			{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } },
			{ key: "other-source", traitBonus: { trait: "channel", per: "burden", max: 2 } }
		];

		expect(traitBonusesFor(moves, { dangerCount: 2, burdenCount: 1 })).toEqual({ channel: 3 });
	});

	it("keeps two moves' bonuses on different traits separate", () => {
		const moves = [
			{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } },
			{ key: "other-source", traitBonus: { trait: "clash", per: "burden", max: 2 } }
		];

		expect(traitBonusesFor(moves, { dangerCount: 2, burdenCount: 1 })).toEqual({ channel: 2, clash: 1 });
	});
});

describe("patronChannelBonus", () => {
	const PATRON = { key: "the-witch:patron", grantsChannelWhileInfluence: true };

	it("is 0 with no Influence, even with Patron picked", () => {
		expect(patronChannelBonus([PATRON], 0)).toBe(0);
	});

	it("is 0 with Influence but Patron not picked", () => {
		expect(patronChannelBonus([], 1)).toBe(0);
	});

	it("is 1 once both Influence >= 1 and Patron is picked", () => {
		expect(patronChannelBonus([PATRON], 1)).toBe(1);
	});

	it("stays at 1 as Influence rises further — a threshold gate, not a scaling bonus", () => {
		expect(patronChannelBonus([PATRON], 5)).toBe(1);
	});
});

describe("hasUnboundedTraits", () => {
	it("is false for an empty move list", () => {
		expect(hasUnboundedTraits([])).toBe(false);
	});

	it("is false when no picked move carries removesTraitCap", () => {
		expect(hasUnboundedTraits([{ key: "arcane-augments" }])).toBe(false);
	});

	it("is true when a picked move carries removesTraitCap", () => {
		expect(hasUnboundedTraits([{ key: "the-impostor:let-loose", removesTraitCap: true }])).toBe(true);
	});
});
