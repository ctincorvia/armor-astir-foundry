import { describe, expect, it } from "vitest";
import { GRAVITY_TRIGGERS, gravityTriggerForPlaybook } from "../scripts/gravity-triggers.js";

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

	it("returns null for a playbook with no known trigger", () => {
		expect(GRAVITY_TRIGGERS["some-future-playbook"]).toBeUndefined();
		expect(gravityTriggerForPlaybook("some-future-playbook")).toBeNull();
	});
});
