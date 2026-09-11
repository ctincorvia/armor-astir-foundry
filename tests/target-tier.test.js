import { afterEach, describe, expect, it } from "vitest";
import { getTargetedNpc, tierMatchupAdvantage, tierRollModifier } from "../scripts/moves/target-tier.js";

afterEach(() => {
	delete game.user.targets;
});

describe("getTargetedNpc", () => {
	it("returns null when there are no targets", () => {
		game.user.targets = new Set();

		expect(getTargetedNpc()).toBeNull();
	});

	it("returns null when game.user.targets is entirely absent", () => {
		expect(getTargetedNpc()).toBeNull();
	});

	it("returns null when the single target is not an NPC actor", () => {
		game.user.targets = new Set([{ actor: { type: "armor-astir.carrier" } }]);

		expect(getTargetedNpc()).toBeNull();
	});

	it("returns the actor when the single target is an NPC actor", () => {
		const npc = { type: "armor-astir.npc", system: { attributes: { tier: 2 } } };
		game.user.targets = new Set([{ actor: npc }]);

		expect(getTargetedNpc()).toBe(npc);
	});

	it("returns null when there is more than one target, even if one is an NPC", () => {
		const npc = { type: "armor-astir.npc", system: { attributes: { tier: 2 } } };
		const other = { type: "armor-astir.carrier" };
		game.user.targets = new Set([{ actor: npc }, { actor: other }]);

		expect(getTargetedNpc()).toBeNull();
	});
});

describe("tierMatchupAdvantage", () => {
	it("returns advantage when the attacker's Tier is higher", () => {
		expect(tierMatchupAdvantage(3, 1)).toBe("advantage");
	});

	it("returns disadvantage when the attacker's Tier is lower", () => {
		expect(tierMatchupAdvantage(1, 3)).toBe("disadvantage");
	});

	it("returns null when Tiers are equal", () => {
		expect(tierMatchupAdvantage(2, 2)).toBeNull();
	});
});

describe("tierRollModifier", () => {
	it("returns null for a null advantage", () => {
		expect(tierRollModifier(null)).toBeNull();
	});

	it("builds a forced Advantage entry", () => {
		expect(tierRollModifier("advantage")).toEqual({
			key: "target-tier-matchup",
			label: "Tier Advantage",
			description: "This roll's Tier advantage/disadvantage against the currently targeted NPC.",
			advantage: "advantage",
			effect: null,
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: true
		});
	});

	it("builds a forced Disadvantage entry", () => {
		expect(tierRollModifier("disadvantage")).toEqual({
			key: "target-tier-matchup",
			label: "Tier Disadvantage",
			description: "This roll's Tier advantage/disadvantage against the currently targeted NPC.",
			advantage: "disadvantage",
			effect: null,
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: true
		});
	});
});
