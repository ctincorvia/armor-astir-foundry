import { describe, expect, it } from "vitest";
import { TRAIT_BONUS_SOURCES, traitBonusesFor } from "../scripts/moves/trait-bonuses.js";

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

	it("defaults dangerCount/burdenCount/choices to 0/0/empty when omitted", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves)).toEqual({});
	});

	it("contributes nothing when the scaled count is 0", () => {
		const moves = [{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } }];

		expect(traitBonusesFor(moves, { dangerCount: 0 })).toEqual({});
	});

	it("resolves a chooseTrait bonus off the actor's stored choice for that move", () => {
		const moves = [{ key: "let-loose", traitBonus: { per: "burden", chooseTrait: true } }];

		expect(traitBonusesFor(moves, { burdenCount: 4, choices: { "let-loose": "clash" } })).toEqual({ clash: 4 });
	});

	it("is uncapped when no max is given, e.g. Let Loose", () => {
		const moves = [{ key: "let-loose", traitBonus: { per: "burden", chooseTrait: true } }];

		expect(traitBonusesFor(moves, { burdenCount: 9, choices: { "let-loose": "clash" } })).toEqual({ clash: 9 });
	});

	it("contributes nothing for a chooseTrait bonus with no choice stored yet", () => {
		const moves = [{ key: "let-loose", traitBonus: { per: "burden", chooseTrait: true } }];

		expect(traitBonusesFor(moves, { burdenCount: 4, choices: {} })).toEqual({});
	});

	it("stacks two moves' bonuses onto the same trait", () => {
		const moves = [
			{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } },
			{ key: "let-loose", traitBonus: { per: "burden", chooseTrait: true } }
		];

		expect(traitBonusesFor(moves, { dangerCount: 2, burdenCount: 1, choices: { "let-loose": "channel" } }))
			.toEqual({ channel: 3 });
	});

	it("keeps two moves' bonuses on different traits separate", () => {
		const moves = [
			{ key: "arcane-augments", traitBonus: { trait: "channel", per: "danger", max: 3 } },
			{ key: "let-loose", traitBonus: { per: "burden", chooseTrait: true } }
		];

		expect(traitBonusesFor(moves, { dangerCount: 2, burdenCount: 1, choices: { "let-loose": "clash" } }))
			.toEqual({ channel: 2, clash: 1 });
	});
});
