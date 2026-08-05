import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching how lead-a-sortie's CREW
// fixedTraits placeholder behaves before Carrier exists — same mock playbook-actor-sheet.test.js
// itself applies, needed here since getData's move-trait resolution reaches it regardless of which
// feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("PlaybookActorSheet#getData - isParadigm", () => {
	it("is true only for the Paradigm playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-paradigm" } } };

		expect(sheet.getData().isParadigm).toBe(true);
	});

	it("is false for every other playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		expect(sheet.getData().isParadigm).toBe(false);
	});

	it("is false with no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet.getData().isParadigm).toBe(false);
	});
});
