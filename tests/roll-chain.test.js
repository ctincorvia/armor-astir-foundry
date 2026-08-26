import { describe, expect, it } from "vitest";
import {
	ADVANTAGE_DISPLAY_ORDER,
	EFFECT_DISPLAY_ORDER,
	advantageOffset,
	chainEntryResult,
	effectOffset,
	resolveRollChain,
	stepAdvantage,
	stepEffect
} from "../scripts/moves/roll-chain.js";

describe("advantageOffset", () => {
	it.each([
		["disadvantage2", -2],
		["disadvantage", -1],
		["none", 0],
		["advantage", 1],
		["advantage2", 2]
	])("resolves %s to offset %i", (key, expected) => {
		expect(advantageOffset(key)).toBe(expected);
	});
});

describe("effectOffset", () => {
	it.each([
		["desperation", -1],
		["none", 0],
		["confidence", 1]
	])("resolves %s to offset %i", (key, expected) => {
		expect(effectOffset(key)).toBe(expected);
	});
});

describe("stepAdvantage", () => {
	it.each(ADVANTAGE_DISPLAY_ORDER.map((key, index) => [key, index]))(
		"steps %s by 0 to itself",
		(key) => {
			expect(stepAdvantage(key, 0)).toBe(key);
		}
	);

	it("steps none by +1 to advantage", () => {
		expect(stepAdvantage("none", 1)).toBe("advantage");
	});

	it("steps none by -1 to disadvantage", () => {
		expect(stepAdvantage("none", -1)).toBe("disadvantage");
	});

	it("steps advantage by +1 to advantage2", () => {
		expect(stepAdvantage("advantage", 1)).toBe("advantage2");
	});

	it("returns null stepping off the top end (advantage2 + 1)", () => {
		expect(stepAdvantage("advantage2", 1)).toBeNull();
	});

	it("returns null stepping off the bottom end (disadvantage2 - 1)", () => {
		expect(stepAdvantage("disadvantage2", -1)).toBeNull();
	});

	it("steps disadvantage2 by +2 to none", () => {
		expect(stepAdvantage("disadvantage2", 2)).toBe("none");
	});
});

describe("stepEffect", () => {
	it("steps none by +1 to confidence", () => {
		expect(stepEffect("none", 1)).toBe("confidence");
	});

	it("steps none by -1 to desperation", () => {
		expect(stepEffect("none", -1)).toBe("desperation");
	});

	it("returns null stepping off the top end (confidence + 1)", () => {
		expect(stepEffect("confidence", 1)).toBeNull();
	});

	it("returns null stepping off the bottom end (desperation - 1)", () => {
		expect(stepEffect("desperation", -1)).toBeNull();
	});

	it.each(EFFECT_DISPLAY_ORDER)("steps %s by 0 to itself", (key) => {
		expect(stepEffect(key, 0)).toBe(key);
	});
});

describe("chainEntryResult", () => {
	it("steps advantage up by one when entry.advantage is set", () => {
		const result = chainEntryResult({ advantage: "none", effect: "none" }, { key: "x", advantage: "advantage" });
		expect(result).toEqual({ advantage: "advantage", effect: "none" });
	});

	it("steps effect down by one when entry.effect is set", () => {
		const result = chainEntryResult({ advantage: "none", effect: "confidence" }, { key: "x", effect: "desperation" });
		expect(result).toEqual({ advantage: "none", effect: "none" });
	});

	it("steps both axes when entry has both advantage and effect", () => {
		const result = chainEntryResult(
			{ advantage: "advantage", effect: "none" },
			{ key: "x", advantage: "advantage", effect: "desperation" }
		);
		expect(result).toEqual({ advantage: "advantage2", effect: "desperation" });
	});

	it("returns null when requiresAdvantage is present and doesn't match current state", () => {
		const result = chainEntryResult(
			{ advantage: "none", effect: "none" },
			{ key: "x", advantage: "advantage", requiresAdvantage: ["advantage"] }
		);
		expect(result).toBeNull();
	});

	it("applies normally when requiresAdvantage is present and matches current state", () => {
		const result = chainEntryResult(
			{ advantage: "advantage", effect: "none" },
			{ key: "x", advantage: "advantage", effect: "desperation", requiresAdvantage: ["advantage"] }
		);
		expect(result).toEqual({ advantage: "advantage2", effect: "desperation" });
	});

	it("applies normally when requiresAdvantage is absent", () => {
		const result = chainEntryResult({ advantage: "none", effect: "none" }, { key: "x", advantage: "advantage" });
		expect(result).toEqual({ advantage: "advantage", effect: "none" });
	});

	it("returns null when stepping advantage would run off the top end", () => {
		const result = chainEntryResult({ advantage: "advantage2", effect: "none" }, { key: "x", advantage: "advantage" });
		expect(result).toBeNull();
	});

	it("returns null when stepping advantage would run off the bottom end", () => {
		const result = chainEntryResult(
			{ advantage: "disadvantage2", effect: "none" },
			{ key: "x", advantage: "disadvantage" }
		);
		expect(result).toBeNull();
	});

	it("returns null when stepping effect would run off the top end", () => {
		const result = chainEntryResult({ advantage: "none", effect: "confidence" }, { key: "x", effect: "confidence" });
		expect(result).toBeNull();
	});

	it("returns null when stepping effect would run off the bottom end", () => {
		const result = chainEntryResult({ advantage: "none", effect: "desperation" }, { key: "x", effect: "desperation" });
		expect(result).toBeNull();
	});

	it("returns null for a no-op entry (neither advantage nor effect set)", () => {
		const result = chainEntryResult({ advantage: "advantage", effect: "confidence" }, { key: "x" });
		expect(result).toBeNull();
	});
});

describe("resolveRollChain", () => {
	it("returns the base state unchanged with no entries", () => {
		const result = resolveRollChain({ advantage: "none", effect: "none" }, []);
		expect(result).toEqual({ advantage: "none", effect: "none", applied: [] });
	});

	it("folds a single applicable entry", () => {
		const result = resolveRollChain(
			{ advantage: "none", effect: "none" },
			[{ key: "a", advantage: "advantage" }]
		);
		expect(result).toEqual({ advantage: "advantage", effect: "none", applied: ["a"] });
	});

	it("skips (does not apply) an entry whose gate fails mid-chain, while a later entry still succeeds", () => {
		const result = resolveRollChain(
			{ advantage: "none", effect: "none" },
			[
				{ key: "gated", advantage: "advantage", requiresAdvantage: ["advantage"] },
				{ key: "ungated", effect: "confidence" }
			]
		);
		expect(result).toEqual({ advantage: "none", effect: "confidence", applied: ["ungated"] });
	});

	// Reproduces the user's exact walkthrough: base disadvantage2, an Embrace-Chaos-shaped entry
	// (+2 Advantage, requires disadvantage/disadvantage2) resolves to none; an All-In-shaped entry
	// (+1 Advantage/-1 Effect, requires advantage) is inapplicable at that point since the state is
	// now "none", not "advantage" — it's skipped, not retried. A third entry then pushes Advantage
	// to "advantage" directly, at which point a second All-In-shaped entry (a separate array
	// element, since a real chain never rechecks a skipped entry) applies: advantage2 + effect
	// stepped down one notch (none -> desperation).
	it("reproduces the Embrace Chaos + All In walkthrough, including an inapplicable-then-applicable entry", () => {
		const embraceChaos = { key: "the-witch:embrace-chaos", advantage: "advantage2", requiresAdvantage: ["disadvantage", "disadvantage2"] };
		const allInFirstTry = { key: "cantrips:all-in-1", advantage: "advantage", effect: "desperation", requiresAdvantage: ["advantage"] };
		const forceAdvantage = { key: "force-advantage", advantage: "advantage" };
		const allInSecondTry = { key: "cantrips:all-in-2", advantage: "advantage", effect: "desperation", requiresAdvantage: ["advantage"] };

		const result = resolveRollChain(
			{ advantage: "disadvantage2", effect: "none" },
			[embraceChaos, allInFirstTry, forceAdvantage, allInSecondTry]
		);

		expect(result).toEqual({
			advantage: "advantage2",
			effect: "desperation",
			applied: ["the-witch:embrace-chaos", "force-advantage", "cantrips:all-in-2"]
		});
	});
});

// The Arcanist's Warding ritual (arcanist.js's ARCANIST_RITUALS) — a +1 Advantage step gated to
// only apply from disadvantage or worse ("ignore a disadvantage"), distinct from Embrace Chaos's
// own +2 step above: disadvantage(-1)+1=none(0) and disadvantage2(-2)+1=disadvantage(-1), each
// stepping up exactly one notch rather than converting all the way past none.
describe("chainEntryResult - Warding ritual shape", () => {
	it("steps +1 Advantage from disadvantage to none, or disadvantage2 to disadvantage", () => {
		const warding = { key: "ritual-1", advantage: "advantage", requiresAdvantage: ["disadvantage", "disadvantage2"] };

		expect(chainEntryResult({ advantage: "disadvantage", effect: "none" }, warding))
			.toEqual({ advantage: "none", effect: "none" });
		expect(chainEntryResult({ advantage: "disadvantage2", effect: "none" }, warding))
			.toEqual({ advantage: "disadvantage", effect: "none" });
	});

	it("gates off once the roll is no longer at a disadvantage", () => {
		const warding = { key: "ritual-1", advantage: "advantage", requiresAdvantage: ["disadvantage", "disadvantage2"] };

		expect(chainEntryResult({ advantage: "none", effect: "none" }, warding)).toBeNull();
	});
});
