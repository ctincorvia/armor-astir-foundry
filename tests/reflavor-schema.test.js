import { describe, expect, it } from "vitest";

import { REFLAVOR_SECTIONS } from "../scripts/reflavor/reflavor-schema.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG, EQUIPMENT_TAGS } from "../scripts/equipment/equipment.js";
import { ARDENT_PART_CATALOG, ARDENT_FEATURE_WEAPONS } from "../scripts/frames/ardent.js";
import { ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir-weapons.js";

describe("REFLAVOR_SECTIONS", () => {
	it("declares exactly the five reflavorable JSON section names", () => {
		expect(Object.keys(REFLAVOR_SECTIONS)).toEqual(["moves", "equipment", "equipmentTags", "astirParts", "astirWeapons"]);
	});

	it("maps moves to ALL_MOVES", () => {
		expect(REFLAVOR_SECTIONS.moves.catalog).toBe(ALL_MOVES);
	});

	it("maps equipment to EQUIPMENT_CATALOG", () => {
		expect(REFLAVOR_SECTIONS.equipment.catalog).toBe(EQUIPMENT_CATALOG);
	});

	it("maps equipmentTags to EQUIPMENT_TAGS", () => {
		expect(REFLAVOR_SECTIONS.equipmentTags.catalog).toBe(EQUIPMENT_TAGS);
	});

	it("maps astirParts to ARDENT_PART_CATALOG", () => {
		expect(REFLAVOR_SECTIONS.astirParts.catalog).toBe(ARDENT_PART_CATALOG);
	});

	it("maps astirWeapons to ASTIR_WEAPON_CATALOG concatenated with ARDENT_FEATURE_WEAPONS", () => {
		expect(REFLAVOR_SECTIONS.astirWeapons.catalog).toEqual([...ASTIR_WEAPON_CATALOG, ...ARDENT_FEATURE_WEAPONS]);
		expect(REFLAVOR_SECTIONS.astirWeapons.catalog).toHaveLength(ASTIR_WEAPON_CATALOG.length + ARDENT_FEATURE_WEAPONS.length);
	});

	it("gives moves and astirParts the identical move-shaped field allowlist", () => {
		expect(REFLAVOR_SECTIONS.moves.fields).toEqual(REFLAVOR_SECTIONS.astirParts.fields);
		expect(REFLAVOR_SECTIONS.moves.fields).toEqual({
			simpleFields: ["name", "description", "successOptions", "downtimeAbility"],
			tieredFields: ["results", "questionPrompts"],
			arrayFields: ["questions"],
			labeledSubArrays: ["uses", "conditions", "intents", "numericTrackers", "fixedTraits"],
			activateChoices: true
		});
	});

	it("gives equipment and astirWeapons the identical name/description-only allowlist", () => {
		expect(REFLAVOR_SECTIONS.equipment.fields).toEqual(REFLAVOR_SECTIONS.astirWeapons.fields);
		expect(REFLAVOR_SECTIONS.equipment.fields).toEqual({
			simpleFields: ["name", "description"],
			tieredFields: [],
			arrayFields: [],
			labeledSubArrays: [],
			activateChoices: false
		});
	});

	it("gives equipmentTags the label/description-only allowlist", () => {
		expect(REFLAVOR_SECTIONS.equipmentTags.fields).toEqual({
			simpleFields: ["label", "description"],
			tieredFields: [],
			arrayFields: [],
			labeledSubArrays: [],
			activateChoices: false
		});
	});
});
