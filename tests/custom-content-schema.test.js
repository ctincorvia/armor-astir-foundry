import { describe, expect, it } from "vitest";

import {
	CUSTOM_CONTENT_SECTIONS,
	CUSTOM_KEY_PREFIX,
	ASTIR_PART_BEHAVIOR_FLAGS
} from "../scripts/custom-content/custom-content-schema.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment-catalog.js";
import { ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir-weapons.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir-parts.js";
import { ARDENT_PART_CATALOG } from "../scripts/frames/ardent.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { ASTIR_MOVE_CATALOG } from "../scripts/frames/astir-moves.js";
import { CUSTOM_MOVE_CATALOG } from "../scripts/moves/custom-move-catalog.js";
import {
	CUSTOM_MOVE_ALLOWED_FIELDS,
	CUSTOM_MOVE_REQUIRED_FIELDS
} from "../scripts/custom-content/custom-content-moves-schema.js";

describe("CUSTOM_KEY_PREFIX", () => {
	it("is the custom: namespace every addition key must carry", () => {
		expect(CUSTOM_KEY_PREFIX).toBe("custom:");
	});
});

describe("CUSTOM_CONTENT_SECTIONS", () => {
	it("targets the single live catalog for equipment and astirWeapons, by reference", () => {
		expect(CUSTOM_CONTENT_SECTIONS.equipment.catalogs).toEqual([EQUIPMENT_CATALOG]);
		expect(CUSTOM_CONTENT_SECTIONS.equipment.catalogs[0]).toBe(EQUIPMENT_CATALOG);
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.catalogs).toEqual([ASTIR_WEAPON_CATALOG]);
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.catalogs[0]).toBe(ASTIR_WEAPON_CATALOG);
	});

	it("targets all three catalogs an Astir/Ardent Part must reach for astirParts, by reference", () => {
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.catalogs).toHaveLength(3);
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.catalogs[0]).toBe(ASTIR_PART_CATALOG);
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.catalogs[1]).toBe(ARDENT_PART_CATALOG);
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.catalogs[2]).toBe(ALL_MOVES);
	});

	it("targets all four catalogs a custom Move must reach, by reference", () => {
		expect(CUSTOM_CONTENT_SECTIONS.moves.catalogs).toHaveLength(4);
		expect(CUSTOM_CONTENT_SECTIONS.moves.catalogs[0]).toBe(CUSTOM_MOVE_CATALOG);
		expect(CUSTOM_CONTENT_SECTIONS.moves.catalogs[1]).toBe(ALL_MOVES);
		expect(CUSTOM_CONTENT_SECTIONS.moves.catalogs[2]).toBe(ALL_PLAYBOOK_MOVES);
		expect(CUSTOM_CONTENT_SECTIONS.moves.catalogs[3]).toBe(ASTIR_MOVE_CATALOG);
	});

	it("requires name/description (plus kind or partType) but never key, which is validated separately", () => {
		expect(CUSTOM_CONTENT_SECTIONS.equipment.requiredFields).toEqual(["name", "kind", "description"]);
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.requiredFields).toEqual(["name", "description"]);
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.requiredFields).toEqual(["name", "partType", "description"]);
		expect(CUSTOM_CONTENT_SECTIONS.moves.requiredFields).toBe(CUSTOM_MOVE_REQUIRED_FIELDS);
		for (const section of Object.values(CUSTOM_CONTENT_SECTIONS)) {
			expect(section.requiredFields).not.toContain("key");
		}
	});

	it("uses CUSTOM_MOVE_ALLOWED_FIELDS as the moves section's allowedFields, by reference", () => {
		expect(CUSTOM_CONTENT_SECTIONS.moves.allowedFields).toBe(CUSTOM_MOVE_ALLOWED_FIELDS);
	});

	it("allows every ASTIR_PART_BEHAVIOR_FLAGS entry on astirParts, and none of them on the other two sections", () => {
		expect(ASTIR_PART_BEHAVIOR_FLAGS.length).toBeGreaterThan(0);
		for (const flag of ASTIR_PART_BEHAVIOR_FLAGS) {
			expect(CUSTOM_CONTENT_SECTIONS.astirParts.allowedFields).toContain(flag);
			expect(CUSTOM_CONTENT_SECTIONS.equipment.allowedFields).not.toContain(flag);
			expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.allowedFields).not.toContain(flag);
		}
	});

	it("allows the equipment-specific kind/scale fields only on equipment", () => {
		expect(CUSTOM_CONTENT_SECTIONS.equipment.allowedFields).toEqual(expect.arrayContaining(["kind", "scale"]));
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.allowedFields).not.toContain("kind");
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.allowedFields).not.toContain("scale");
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.allowedFields).not.toContain("kind");
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.allowedFields).not.toContain("scale");
	});

	it("allows familiar/requiresParts only on astirWeapons", () => {
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.allowedFields).toEqual(expect.arrayContaining(["familiar", "requiresParts"]));
		expect(CUSTOM_CONTENT_SECTIONS.equipment.allowedFields).not.toContain("familiar");
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.allowedFields).not.toContain("familiar");
	});

	it("allows traits/partType only on astirParts", () => {
		expect(CUSTOM_CONTENT_SECTIONS.astirParts.allowedFields).toEqual(expect.arrayContaining(["traits", "partType"]));
		expect(CUSTOM_CONTENT_SECTIONS.equipment.allowedFields).not.toContain("traits");
		expect(CUSTOM_CONTENT_SECTIONS.astirWeapons.allowedFields).not.toContain("partType");
	});

	it("allows key/name/description on every section", () => {
		for (const section of Object.values(CUSTOM_CONTENT_SECTIONS)) {
			expect(section.allowedFields).toEqual(expect.arrayContaining(["key", "name", "description"]));
		}
	});
});
