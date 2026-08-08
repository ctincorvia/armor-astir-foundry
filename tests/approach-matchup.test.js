import { describe, expect, it } from "vitest";
import { approachAdvantageStack } from "../scripts/moves/approach-matchup.js";

// The Approach type wheel (see approach-matchup.js): mundane beats arcane, arcane beats divine,
// divine beats profane, profane beats elemental, elemental beats mundane, cyclically.
describe("approachAdvantageStack", () => {
	it("returns +1 when mundane beats arcane, -1 the other way", () => {
		expect(approachAdvantageStack("mundane", "arcane")).toBe(1);
		expect(approachAdvantageStack("arcane", "mundane")).toBe(-1);
	});

	it("returns +1 when arcane beats divine, -1 the other way", () => {
		expect(approachAdvantageStack("arcane", "divine")).toBe(1);
		expect(approachAdvantageStack("divine", "arcane")).toBe(-1);
	});

	it("returns +1 when divine beats profane, -1 the other way", () => {
		expect(approachAdvantageStack("divine", "profane")).toBe(1);
		expect(approachAdvantageStack("profane", "divine")).toBe(-1);
	});

	it("returns +1 when profane beats elemental, -1 the other way", () => {
		expect(approachAdvantageStack("profane", "elemental")).toBe(1);
		expect(approachAdvantageStack("elemental", "profane")).toBe(-1);
	});

	it("returns +1 when elemental beats mundane, -1 the other way", () => {
		expect(approachAdvantageStack("elemental", "mundane")).toBe(1);
		expect(approachAdvantageStack("mundane", "elemental")).toBe(-1);
	});

	it("returns 0 for a same-Approach pair", () => {
		expect(approachAdvantageStack("mundane", "mundane")).toBe(0);
	});

	it("returns 0 for a non-adjacent, neutral pair", () => {
		expect(approachAdvantageStack("mundane", "divine")).toBe(0);
		expect(approachAdvantageStack("mundane", "profane")).toBe(0);
	});

	it("returns 0 when either key is unknown or empty", () => {
		expect(approachAdvantageStack("", "mundane")).toBe(0);
		expect(approachAdvantageStack("mundane", "")).toBe(0);
		expect(approachAdvantageStack("bogus", "mundane")).toBe(0);
	});
});
