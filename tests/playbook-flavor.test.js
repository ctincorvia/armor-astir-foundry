import { describe, expect, it } from "vitest";
import { PLAYBOOK_FLAVOR, defaultConsiderText, defaultLookText, flavorForPlaybook } from "../scripts/playbook-flavor.js";

describe("flavorForPlaybook", () => {
	it("gives The Scout its flavor", () => {
		expect(flavorForPlaybook("the-scout")).toBe(PLAYBOOK_FLAVOR["the-scout"]);
	});

	it("returns null for a playbook with no known flavor", () => {
		expect(PLAYBOOK_FLAVOR["some-future-playbook"]).toBeUndefined();
		expect(flavorForPlaybook("some-future-playbook")).toBeNull();
	});
});

describe("PLAYBOOK_FLAVOR", () => {
	it("gives The Scout three LOOK prompts, each with a label and text", () => {
		for (const entry of PLAYBOOK_FLAVOR["the-scout"].look) {
			expect(entry.label).toBeTruthy();
			expect(entry.text).toBeTruthy();
		}
		expect(PLAYBOOK_FLAVOR["the-scout"].look).toHaveLength(3);
	});

	it("gives The Scout ten Consider questions", () => {
		expect(PLAYBOOK_FLAVOR["the-scout"].consider).toHaveLength(10);
		for (const question of PLAYBOOK_FLAVOR["the-scout"].consider) {
			expect(question).toBeTruthy();
		}
	});
});

describe("defaultLookText", () => {
	it("renders The Scout's LOOK prompts as a list", () => {
		const html = defaultLookText("the-scout");
		expect(html).toContain("<li><strong>You look:</strong> wild, cold, sharp, cocky or brash</li>");
		expect(html).toContain("<li><strong>You wear:</strong>");
		expect(html).toContain("<li><strong>You fight with:</strong>");
	});

	it("returns an empty string for a playbook with no known flavor", () => {
		expect(defaultLookText("some-future-playbook")).toBe("");
	});
});

describe("defaultConsiderText", () => {
	it("renders The Scout's Consider questions as a list", () => {
		const html = defaultConsiderText("the-scout");
		for (const question of PLAYBOOK_FLAVOR["the-scout"].consider) {
			expect(html).toContain(`<li>${question}</li>`);
		}
	});

	it("returns an empty string for a playbook with no known flavor", () => {
		expect(defaultConsiderText("some-future-playbook")).toBe("");
	});
});
