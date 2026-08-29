import { afterEach, describe, expect, it } from "vitest";

import { buildReflavorTemplate, downloadReflavorTemplate } from "../scripts/reflavor/reflavor-export.js";
import { REFLAVOR_SECTIONS, resolveSectionCatalog } from "../scripts/reflavor/reflavor-schema.js";
import { applyReflavor, resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";

// buildReflavorTemplate reads (never writes) every catalog, but the "reflects an already-applied
// reflavor" case below does apply an override — reset afterward so nothing leaks into unrelated
// suites, per docs/domains/reflavor.md's own Testing note.
afterEach(() => {
	resetToBaseline();
});

describe("buildReflavorTemplate", () => {
	it("has exactly the five override section names plus the additions skeleton, one entry per live catalog key", () => {
		const template = buildReflavorTemplate();

		expect(Object.keys(template)).toEqual([...Object.keys(REFLAVOR_SECTIONS), "additions"]);
		for (const [sectionName, section] of Object.entries(REFLAVOR_SECTIONS)) {
			expect(Object.keys(template[sectionName])).toEqual(resolveSectionCatalog(section).map((entry) => entry.key));
		}
	});

	it("includes an empty additions skeleton for all four addable sections", () => {
		const template = buildReflavorTemplate();

		expect(template.additions).toEqual({ equipment: [], astirWeapons: [], astirParts: [], moves: [] });
	});

	it("includes only fields the entry actually defines, dropping the rest", () => {
		const template = buildReflavorTemplate();

		const exchangeBlows = template.moves["exchange-blows"];
		expect(exchangeBlows.name).toBe("Exchange Blows");
		expect(exchangeBlows.results.success).toEqual(expect.any(String));
		expect(exchangeBlows).not.toHaveProperty("questions");
		expect(exchangeBlows).not.toHaveProperty("activateChoices");

		const readTheRoom = template.moves["read-the-room"];
		expect(readTheRoom.questions).toEqual(expect.any(Array));
		expect(readTheRoom.questionPrompts.success).toEqual(expect.any(String));

		const facilitator = template.moves["the-diplomat:facilitator"];
		expect(facilitator.activateChoices.prompt).toEqual(expect.any(String));
		expect(facilitator.activateChoices.options).toEqual(expect.any(Array));
	});

	it("represents labeled sub-arrays as {itemKey: label} maps", () => {
		const template = buildReflavorTemplate();

		expect(template.moves["help-or-hinder"].conditions).toEqual({
			downtime: "Spent meaningful time together during Downtime",
			"prior-help": "They've helped or hindered you previously this Sortie",
			hook: "They're part of one of your Hooks"
		});
	});

	it("only writes name/description for equipment/astirWeapons and label/description for equipmentTags", () => {
		const template = buildReflavorTemplate();

		expect(Object.keys(template.equipment["dagger-i"]).sort()).toEqual(["description", "name"]);
		expect(Object.keys(template.equipmentTags.blitz).sort()).toEqual(["description", "label"]);
	});

	it("reflects an already-applied reflavor's current text, not the pristine baseline", () => {
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });

		const template = buildReflavorTemplate();
		expect(template.moves["exchange-blows"].name).toBe("Trade Fire");
	});
});

describe("downloadReflavorTemplate", () => {
	it("calls the Foundry saveDataToFile global with the template as pretty-printed JSON", () => {
		downloadReflavorTemplate();

		expect(saveDataToFile).toHaveBeenCalledWith(
			JSON.stringify(buildReflavorTemplate(), null, 2),
			"text/json",
			"armor-astir-reflavor-template.json"
		);
	});
});
