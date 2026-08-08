import { afterEach, describe, expect, it } from "vitest";
import { getTargetedNpc } from "../scripts/moves/target-tier.js";

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
