import { describe, expect, it } from "vitest";
import { PLAYBOOK_FLAVOR, defaultConsiderText, defaultLookText, flavorForPlaybook } from "../scripts/playbook/playbook-flavor.js";

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

	it("gives The Impostor four LOOK prompts, each with a label and text", () => {
		for (const entry of PLAYBOOK_FLAVOR["the-impostor"].look) {
			expect(entry.label).toBeTruthy();
			expect(entry.text).toBeTruthy();
		}
		expect(PLAYBOOK_FLAVOR["the-impostor"].look).toHaveLength(4);
	});

	it("gives The Impostor ten Consider questions", () => {
		expect(PLAYBOOK_FLAVOR["the-impostor"].consider).toHaveLength(10);
		for (const question of PLAYBOOK_FLAVOR["the-impostor"].consider) {
			expect(question).toBeTruthy();
		}
	});

	it("gives The Impostor its two intro paragraphs", () => {
		expect(PLAYBOOK_FLAVOR["the-impostor"].intro).toHaveLength(2);
	});

	it("gives The Scout no intro paragraphs", () => {
		expect(PLAYBOOK_FLAVOR["the-scout"].intro).toBeUndefined();
	});

	it("gives The Wither four LOOK prompts, each with a label and text", () => {
		for (const entry of PLAYBOOK_FLAVOR["the-wither"].look) {
			expect(entry.label).toBeTruthy();
			expect(entry.text).toBeTruthy();
		}
		expect(PLAYBOOK_FLAVOR["the-wither"].look).toHaveLength(4);
	});

	it("gives The Wither eight Consider questions", () => {
		expect(PLAYBOOK_FLAVOR["the-wither"].consider).toHaveLength(8);
		for (const question of PLAYBOOK_FLAVOR["the-wither"].consider) {
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

	it("renders no intro paragraphs for The Scout, which doesn't define any", () => {
		const html = defaultConsiderText("the-scout");
		expect(html.startsWith("<ul>")).toBe(true);
	});

	it("renders The Impostor's intro paragraphs ahead of its Consider questions", () => {
		const html = defaultConsiderText("the-impostor");
		for (const paragraph of PLAYBOOK_FLAVOR["the-impostor"].intro) {
			expect(html).toContain(`<p>${paragraph}</p>`);
		}
		for (const question of PLAYBOOK_FLAVOR["the-impostor"].consider) {
			expect(html).toContain(`<li>${question}</li>`);
		}
		expect(html.indexOf("<p>")).toBeLessThan(html.indexOf("<ul>"));
	});

	it("returns an empty string for a playbook with no known flavor", () => {
		expect(defaultConsiderText("some-future-playbook")).toBe("");
	});
});
