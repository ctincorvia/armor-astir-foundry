import { describe, expect, it } from "vitest";
import { GRAVITY_TRIGGERS, gravityTriggerForPlaybook } from "../scripts/playbook/gravity-triggers.js";

describe("gravityTriggerForPlaybook", () => {
	it("gives The Scout its trigger", () => {
		expect(gravityTriggerForPlaybook("the-scout")).toBe(GRAVITY_TRIGGERS["the-scout"]);
	});

	it("gives The Commander its trigger", () => {
		expect(gravityTriggerForPlaybook("the-commander")).toBe(GRAVITY_TRIGGERS["the-commander"]);
	});

	it("gives The Impostor its trigger", () => {
		expect(gravityTriggerForPlaybook("the-impostor")).toBe(GRAVITY_TRIGGERS["the-impostor"]);
	});

	it("gives The Arcanist its trigger", () => {
		expect(gravityTriggerForPlaybook("the-arcanist")).toBe(GRAVITY_TRIGGERS["the-arcanist"]);
	});

	it("gives The Witch its trigger", () => {
		expect(gravityTriggerForPlaybook("the-witch")).toBe(GRAVITY_TRIGGERS["the-witch"]);
	});

	it("gives The Wither its trigger", () => {
		expect(gravityTriggerForPlaybook("the-wither")).toBe(GRAVITY_TRIGGERS["the-wither"]);
		expect(GRAVITY_TRIGGERS["the-wither"]).toContain("born to die");
	});

	it("gives The Adrift its trigger", () => {
		expect(gravityTriggerForPlaybook("the-adrift")).toBe(GRAVITY_TRIGGERS["the-adrift"]);
		expect(GRAVITY_TRIGGERS["the-adrift"]).toContain("+HOME");
	});

	it("returns null for a playbook with no known trigger", () => {
		expect(GRAVITY_TRIGGERS["some-future-playbook"]).toBeUndefined();
		expect(gravityTriggerForPlaybook("some-future-playbook")).toBeNull();
	});

	describe("The Advocate (trigger varies by starting move)", () => {
		it("stores The Advocate's entry as an object keyed by starting move, not a string", () => {
			expect(typeof GRAVITY_TRIGGERS["the-advocate"]).toBe("object");
			expect(Object.keys(GRAVITY_TRIGGERS["the-advocate"])).toEqual([
				"the-advocate:earthly-ally",
				"the-advocate:titanic"
			]);
		});

		it("returns null when no starting move has been picked yet", () => {
			expect(gravityTriggerForPlaybook("the-advocate")).toBeNull();
			expect(gravityTriggerForPlaybook("the-advocate", [])).toBeNull();
		});

		it("gives the Earthly Ally trigger when that starting move is picked", () => {
			expect(gravityTriggerForPlaybook("the-advocate", ["the-advocate:earthly-ally"])).toBe(
				GRAVITY_TRIGGERS["the-advocate"]["the-advocate:earthly-ally"]
			);
		});

		it("gives the Titanic trigger when that starting move is picked", () => {
			expect(gravityTriggerForPlaybook("the-advocate", ["the-advocate:titanic"])).toBe(
				GRAVITY_TRIGGERS["the-advocate"]["the-advocate:titanic"]
			);
		});
	});
});
