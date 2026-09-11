import { describe, expect, it } from "vitest";
import { approachMatchupStack, approachMatchupEffect, approachRollModifier } from "../scripts/moves/approach-matchup.js";

// The Approach type wheel (see approach-matchup.js): mundane beats arcane, arcane beats divine,
// divine beats profane, profane beats elemental, elemental beats mundane, cyclically.
describe("approachMatchupStack", () => {
	it("returns +1 when mundane beats arcane, -1 the other way", () => {
		expect(approachMatchupStack("mundane", "arcane")).toBe(1);
		expect(approachMatchupStack("arcane", "mundane")).toBe(-1);
	});

	it("returns +1 when arcane beats divine, -1 the other way", () => {
		expect(approachMatchupStack("arcane", "divine")).toBe(1);
		expect(approachMatchupStack("divine", "arcane")).toBe(-1);
	});

	it("returns +1 when divine beats profane, -1 the other way", () => {
		expect(approachMatchupStack("divine", "profane")).toBe(1);
		expect(approachMatchupStack("profane", "divine")).toBe(-1);
	});

	it("returns +1 when profane beats elemental, -1 the other way", () => {
		expect(approachMatchupStack("profane", "elemental")).toBe(1);
		expect(approachMatchupStack("elemental", "profane")).toBe(-1);
	});

	it("returns +1 when elemental beats mundane, -1 the other way", () => {
		expect(approachMatchupStack("elemental", "mundane")).toBe(1);
		expect(approachMatchupStack("mundane", "elemental")).toBe(-1);
	});

	it("returns 0 for a same-Approach pair", () => {
		expect(approachMatchupStack("mundane", "mundane")).toBe(0);
	});

	it("returns 0 for a non-adjacent, neutral pair", () => {
		expect(approachMatchupStack("mundane", "divine")).toBe(0);
		expect(approachMatchupStack("mundane", "profane")).toBe(0);
	});

	it("returns 0 when either key is unknown or empty", () => {
		expect(approachMatchupStack("", "mundane")).toBe(0);
		expect(approachMatchupStack("mundane", "")).toBe(0);
		expect(approachMatchupStack("bogus", "mundane")).toBe(0);
	});
});

describe("approachMatchupEffect", () => {
	it("resolves a +1 stack (attacker counters target) to confidence", () => {
		expect(approachMatchupEffect("mundane", "arcane")).toBe("confidence");
	});

	it("resolves a -1 stack (attacker is countered) to desperation", () => {
		expect(approachMatchupEffect("arcane", "mundane")).toBe("desperation");
	});

	it("resolves a neutral (0) stack to null", () => {
		expect(approachMatchupEffect("mundane", "mundane")).toBeNull();
		expect(approachMatchupEffect("mundane", "divine")).toBeNull();
	});
});

describe("approachRollModifier", () => {
	it("returns null for a null effect", () => {
		expect(approachRollModifier(null)).toBeNull();
	});

	it("builds a forced Confidence entry", () => {
		expect(approachRollModifier("confidence")).toEqual({
			key: "target-approach-matchup",
			label: "Approach Confidence",
			description: "This roll's Approach confidence/desperation against the currently targeted NPC.",
			advantage: null,
			effect: "confidence",
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: true
		});
	});

	it("builds a forced Desperation entry", () => {
		expect(approachRollModifier("desperation")).toEqual({
			key: "target-approach-matchup",
			label: "Approach Desperation",
			description: "This roll's Approach confidence/desperation against the currently targeted NPC.",
			advantage: null,
			effect: "desperation",
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: true
		});
	});
});
