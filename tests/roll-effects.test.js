import { describe, expect, it } from "vitest";

import {
	ADVANTAGE_STATES,
	DIE_FACES,
	EFFECT_STATES,
	addDie,
	advantageState,
	applyRollEffects,
	effectState,
	nextAdvantageState,
	removeDie,
	rollConditions,
	rolledDoubles
} from "../scripts/moves/roll-effects.js";

function results(...values) {
	return values.map((value) => ({ result: value, active: true, discarded: false }));
}

function activeValues(rolled) {
	return rolled.filter((r) => r.active).map((r) => r.result);
}

describe("advantageState", () => {
	it("resolves a known key to its state entry", () => {
		expect(advantageState("advantage2")).toBe(ADVANTAGE_STATES.find((s) => s.key === "advantage2"));
	});

	it("falls back to none for an unknown or missing key", () => {
		expect(advantageState("bogus")).toBe(ADVANTAGE_STATES[0]);
		expect(advantageState(undefined)).toBe(ADVANTAGE_STATES[0]);
	});
});

describe("effectState", () => {
	it("resolves a known key to its state entry", () => {
		expect(effectState("desperation")).toBe(EFFECT_STATES.find((s) => s.key === "desperation"));
	});

	it("falls back to none for an unknown or missing key", () => {
		expect(effectState("bogus")).toBe(EFFECT_STATES[0]);
		expect(effectState(undefined)).toBe(EFFECT_STATES[0]);
	});
});

describe("applyRollEffects", () => {
	it("keeps both dice active when there is no advantage or disadvantage", () => {
		const rolled = results(3, 5);

		applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("none") });

		expect(activeValues(rolled)).toEqual(expect.arrayContaining([3, 5]));
		expect(rolled.every((r) => r.active)).toBe(true);
	});

	it("keeps the highest two of three dice under advantage", () => {
		const rolled = results(2, 5, 4);

		applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("none") });

		expect(activeValues(rolled).sort()).toEqual([4, 5]);
		expect(rolled.find((r) => r.result === 2).discarded).toBe(true);
	});

	it("keeps the highest two of four dice under advantage x2", () => {
		const rolled = results(1, 6, 3, 2);

		applyRollEffects(rolled, { advantage: advantageState("advantage2"), effect: effectState("none") });

		expect(activeValues(rolled).sort()).toEqual([3, 6]);
	});

	it("keeps the lowest two of three dice under disadvantage", () => {
		const rolled = results(2, 5, 4);

		applyRollEffects(rolled, { advantage: advantageState("disadvantage"), effect: effectState("none") });

		expect(activeValues(rolled).sort()).toEqual([2, 4]);
		expect(rolled.find((r) => r.result === 5).discarded).toBe(true);
	});

	it("keeps the lowest two of four dice under disadvantage x2", () => {
		const rolled = results(1, 6, 3, 2);

		applyRollEffects(rolled, { advantage: advantageState("disadvantage2"), effect: effectState("none") });

		expect(activeValues(rolled).sort()).toEqual([1, 2]);
	});

	it("treats every 1 as a 6 under confidence before keep-selection applies", () => {
		const rolled = results(1, 1, 3);

		applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("confidence") });

		expect(activeValues(rolled).sort()).toEqual([6, 6]);
		expect(rolled.every((r) => r.result === 6 || r.result === 3)).toBe(true);
	});

	it("keeping the lowest two still reflects the confidence substitution", () => {
		const rolled = results(1, 1, 3);

		applyRollEffects(rolled, { advantage: advantageState("disadvantage"), effect: effectState("confidence") });

		expect(activeValues(rolled).sort()).toEqual([3, 6]);
	});

	it("treats every 6 as a 1 under desperation before keep-selection applies", () => {
		const rolled = results(6, 6, 3);

		applyRollEffects(rolled, { advantage: advantageState("disadvantage"), effect: effectState("desperation") });

		expect(activeValues(rolled).sort()).toEqual([1, 1]);
	});

	it("leaves dice that don't match the substitution's source face untouched", () => {
		const rolled = results(2, 3);

		applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("confidence") });

		expect(activeValues(rolled).sort()).toEqual([2, 3]);
	});

	it("breaks a tie at the cut point deterministically", () => {
		const rolled = results(4, 4, 4);

		applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("none") });

		expect(activeValues(rolled)).toEqual([4, 4]);
		expect(rolled.filter((r) => r.discarded)).toHaveLength(1);
	});

	it("uses DIE_FACES as the confidence/desperation target face", () => {
		expect(EFFECT_STATES.find((s) => s.key === "confidence").to).toBe(DIE_FACES);
		expect(EFFECT_STATES.find((s) => s.key === "desperation").from).toBe(DIE_FACES);
	});

	it("returns a breakdown with the original face preserved for a substituted die", () => {
		const rolled = results(1, 3);

		const breakdown = applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("confidence") });

		expect(breakdown).toEqual([
			{ original: 1, result: 6, changed: true, kept: true },
			{ original: 3, result: 3, changed: false, kept: true }
		]);
	});

	it("marks dropped dice as not kept in the breakdown, in original roll order", () => {
		const rolled = results(2, 5, 4);

		const breakdown = applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("none") });

		expect(breakdown).toEqual([
			{ original: 2, result: 2, changed: false, kept: false },
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 4, result: 4, changed: false, kept: true }
		]);
	});

	it("marks the highest dice as not kept in the breakdown under disadvantage", () => {
		const rolled = results(2, 5, 4);

		const breakdown = applyRollEffects(rolled, { advantage: advantageState("disadvantage"), effect: effectState("none") });

		expect(breakdown.map((die) => die.kept)).toEqual([true, false, true]);
	});
});

describe("rolledDoubles", () => {
	it("is true when the two kept dice show the same result", () => {
		const rolled = results(3, 3);
		const breakdown = applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("none") });

		expect(rolledDoubles(breakdown)).toBe(true);
	});

	it("is false when the two kept dice differ", () => {
		const rolled = results(3, 5);
		const breakdown = applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("none") });

		expect(rolledDoubles(breakdown)).toBe(false);
	});

	it("ignores a discarded die that would have matched, under advantage", () => {
		// Keeps the highest two (5, 4); the discarded 4 would tie the kept 4 if counted.
		const rolled = results(4, 5, 4);
		const breakdown = applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("none") });

		expect(rolledDoubles(breakdown)).toBe(false);
	});

	it("is true when the two kept dice under advantage happen to match", () => {
		const rolled = results(2, 5, 5);
		const breakdown = applyRollEffects(rolled, { advantage: advantageState("advantage"), effect: effectState("none") });

		expect(rolledDoubles(breakdown)).toBe(true);
	});

	it("reflects a Confidence/Desperation substitution, same as the total itself does", () => {
		const rolled = results(1, 6);
		const breakdown = applyRollEffects(rolled, { advantage: advantageState("none"), effect: effectState("confidence") });

		expect(rolledDoubles(breakdown)).toBe(true);
	});
});

describe("rollConditions", () => {
	it("is empty when nothing is active", () => {
		expect(rollConditions(advantageState("none"), effectState("none"))).toEqual([]);
	});

	it("lists the active advantage state", () => {
		expect(rollConditions(advantageState("advantage2"), effectState("none"))).toEqual([
			{ key: "advantage2", label: "Advantage x2" }
		]);
	});

	it("lists the active effect state", () => {
		expect(rollConditions(advantageState("none"), effectState("desperation"))).toEqual([
			{ key: "desperation", label: "Desperation" }
		]);
	});

	it("lists both when advantage and an effect are both active", () => {
		expect(rollConditions(advantageState("disadvantage"), effectState("confidence"))).toEqual([
			{ key: "disadvantage", label: "Disadvantage" },
			{ key: "confidence", label: "Confidence" }
		]);
	});
});

describe("nextAdvantageState", () => {
	it("jumps from none straight to the 3-dice advantage state", () => {
		expect(nextAdvantageState("none", "advantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "advantage"));
	});

	it("jumps from none straight to the 3-dice disadvantage state", () => {
		expect(nextAdvantageState("none", "disadvantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "disadvantage"));
	});

	it("steps advantage up to advantage x2", () => {
		expect(nextAdvantageState("advantage", "advantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "advantage2"));
	});

	it("steps disadvantage up to disadvantage x2", () => {
		expect(nextAdvantageState("disadvantage", "disadvantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "disadvantage2"));
	});

	it("steps advantage down to none when disadvantage is clicked", () => {
		expect(nextAdvantageState("advantage", "disadvantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "none"));
	});

	it("steps disadvantage down to none when advantage is clicked", () => {
		expect(nextAdvantageState("disadvantage", "advantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "none"));
	});

	it("steps advantage x2 down to advantage x1 when disadvantage is clicked", () => {
		expect(nextAdvantageState("advantage2", "disadvantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "advantage"));
	});

	it("steps disadvantage x2 down to disadvantage x1 when advantage is clicked", () => {
		expect(nextAdvantageState("disadvantage2", "advantage")).toBe(ADVANTAGE_STATES.find((s) => s.key === "disadvantage"));
	});

	it("is null once already maxed at advantage x2 and advantage is clicked again", () => {
		expect(nextAdvantageState("advantage2", "advantage")).toBeNull();
	});

	it("is null once already maxed at disadvantage x2 and disadvantage is clicked again", () => {
		expect(nextAdvantageState("disadvantage2", "disadvantage")).toBeNull();
	});
});

describe("addDie", () => {
	it("recomputes kept for the highest two when keepLowest is false", () => {
		const dice = [
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 5, result: 5, changed: false, kept: true }
		];

		const result = addDie(dice, false, 6);

		expect(result).toEqual([
			{ original: 2, result: 2, changed: false, kept: false },
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: true }
		]);
	});

	it("recomputes kept for the lowest two when keepLowest is true", () => {
		const dice = [
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 5, result: 5, changed: false, kept: true }
		];

		const result = addDie(dice, true, 1);

		expect(result).toEqual([
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 5, result: 5, changed: false, kept: false },
			{ original: 1, result: 1, changed: false, kept: true }
		]);
	});

	it("preserves the existing dice entries' original/result/changed fields untouched", () => {
		const dice = [
			{ original: 1, result: 6, changed: true, kept: true },
			{ original: 3, result: 3, changed: false, kept: true }
		];

		// A tying new high die bumps the lower-value existing entry (result: 3) out of the kept
		// set — original/result/changed on both existing entries stay exactly as they were.
		const result = addDie(dice, false, 6);

		expect(result[0]).toEqual({ original: 1, result: 6, changed: true, kept: true });
		expect(result[1]).toEqual({ original: 3, result: 3, changed: false, kept: false });
	});

	it("always marks the new die's own changed as false, even when it doesn't make the cut", () => {
		const dice = [
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: true }
		];

		const result = addDie(dice, false, 1);

		expect(result.at(-1)).toEqual({ original: 1, result: 1, changed: false, kept: false });
	});

	it("substitutes the new die's face under Confidence, letting it win the keep-highest slot", () => {
		const dice = [
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 3, result: 3, changed: false, kept: true }
		];

		const result = addDie(dice, false, 1, effectState("confidence"));

		expect(result.at(-1)).toEqual({ original: 1, result: 6, changed: true, kept: true });
		expect(result[0]).toEqual({ original: 2, result: 2, changed: false, kept: false });
		expect(result[1]).toEqual({ original: 3, result: 3, changed: false, kept: true });
	});

	it("substitutes the new die's face under Desperation, letting it win the keep-lowest slot", () => {
		const dice = [
			{ original: 4, result: 4, changed: false, kept: true },
			{ original: 3, result: 3, changed: false, kept: true }
		];

		const result = addDie(dice, true, 6, effectState("desperation"));

		expect(result.at(-1)).toEqual({ original: 6, result: 1, changed: true, kept: true });
		expect(result[0]).toEqual({ original: 4, result: 4, changed: false, kept: false });
	});

	it("leaves the new die's face untouched when the effect doesn't match its face", () => {
		const dice = [
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 3, result: 3, changed: false, kept: true }
		];

		const result = addDie(dice, false, 4, effectState("confidence"));

		expect(result.at(-1)).toEqual({ original: 4, result: 4, changed: false, kept: true });
	});
});

describe("removeDie", () => {
	it("drops the last die and recomputes kept for the highest two when keepLowest is false", () => {
		const dice = [
			{ original: 2, result: 2, changed: false, kept: false },
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: true },
			{ original: 3, result: 3, changed: false, kept: false }
		];

		const result = removeDie(dice, false);

		expect(result).toEqual([
			{ original: 2, result: 2, changed: false, kept: false },
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: true }
		]);
	});

	it("drops the last die and recomputes kept for the lowest two when keepLowest is true", () => {
		const dice = [
			{ original: 5, result: 5, changed: false, kept: false },
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: false },
			{ original: 1, result: 1, changed: false, kept: true }
		];

		const result = removeDie(dice, true);

		expect(result).toEqual([
			{ original: 5, result: 5, changed: false, kept: true },
			{ original: 2, result: 2, changed: false, kept: true },
			{ original: 6, result: 6, changed: false, kept: false }
		]);
	});

	it("preserves the remaining dice entries' original/result/changed fields untouched", () => {
		const dice = [
			{ original: 1, result: 6, changed: true, kept: true },
			{ original: 3, result: 3, changed: false, kept: false },
			{ original: 6, result: 6, changed: false, kept: true },
			{ original: 2, result: 2, changed: false, kept: false }
		];

		// Dropping the trailing die leaves a tie for highest (two dice showing 6) — both entries'
		// own original/result/changed stay exactly as they were regardless of the kept recompute.
		const result = removeDie(dice, false);

		expect(result[0]).toEqual({ original: 1, result: 6, changed: true, kept: true });
		expect(result[1]).toEqual({ original: 3, result: 3, changed: false, kept: false });
	});

	it("keeps both remaining dice when dropping down to a 2-die pool", () => {
		const dice = [
			{ original: 4, result: 4, changed: false, kept: true },
			{ original: 1, result: 1, changed: false, kept: false },
			{ original: 5, result: 5, changed: false, kept: true }
		];

		const result = removeDie(dice, false);

		expect(result).toEqual([
			{ original: 4, result: 4, changed: false, kept: true },
			{ original: 1, result: 1, changed: false, kept: true }
		]);
	});
});
