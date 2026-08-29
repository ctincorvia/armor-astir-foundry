import { afterEach, describe, expect, it } from "vitest";

import {
	applyCustomContent,
	resetCustomContent,
	validateCustomContent
} from "../scripts/custom-content/custom-content-apply.js";
import { applyReflavor, resetToBaseline } from "../scripts/reflavor/reflavor-apply.js";
import { EQUIPMENT_CATALOG } from "../scripts/equipment/equipment-catalog.js";
import { ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir-weapons.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir-parts.js";
import { ARDENT_PART_CATALOG } from "../scripts/frames/ardent.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { MAX_TAGS } from "../scripts/equipment/equipment-constants.js";

// This file mutates the real, shared catalog objects (EQUIPMENT_CATALOG, ASTIR_WEAPON_CATALOG,
// ASTIR_PART_CATALOG, ARDENT_PART_CATALOG, ALL_MOVES) rather than injectable fixtures — deliberate,
// mirroring reflavor-apply.test.js's own choice (see docs/domains/reflavor.md's Testing section):
// this engine's entire job is pushing into/splicing out of those shared arrays, so an injectable
// catalog would test nothing real. resetCustomContent() undoes every tracked injection in afterEach
// so nothing leaks into unrelated suites that assert catalog content by exact toEqual/length; a
// couple of tests also apply a reflavor override, so resetToBaseline() runs too.
afterEach(() => {
	resetCustomContent();
	resetToBaseline();
});

const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);
const findAstirWeapon = (key) => ASTIR_WEAPON_CATALOG.find((item) => item.key === key);
const findAstirPart = (key) => ASTIR_PART_CATALOG.find((item) => item.key === key);
const findArdentPart = (key) => ARDENT_PART_CATALOG.find((item) => item.key === key);
const findMove = (key) => ALL_MOVES.find((item) => item.key === key);

describe("applyCustomContent — injection", () => {
	it("injects a new weapon entry into EQUIPMENT_CATALOG", () => {
		const warnings = applyCustomContent({
			equipment: [{ key: "custom:test-blade", name: "Test Blade", kind: "weapon", description: "d", tags: ["melee"], scale: "foot" }]
		});

		expect(warnings).toEqual([]);
		expect(findEquipment("custom:test-blade")).toMatchObject({ name: "Test Blade", kind: "weapon", scale: "foot" });
	});

	it("injects a new gear entry, defaulting a missing tags array to []", () => {
		applyCustomContent({ equipment: [{ key: "custom:test-gear", name: "Test Gear", kind: "gear", description: "d" }] });
		expect(findEquipment("custom:test-gear")).toMatchObject({ name: "Test Gear", kind: "gear", tags: [] });
	});

	it("injects a new astirWeapons entry into ASTIR_WEAPON_CATALOG", () => {
		applyCustomContent({ astirWeapons: [{ key: "custom:test-astir-weapon", name: "Test Weapon", description: "d", tags: ["ranged"] }] });
		expect(findAstirWeapon("custom:test-astir-weapon")).toMatchObject({ name: "Test Weapon" });
	});

	it("carries optional familiar/requiresParts fields through on an astirWeapons addition", () => {
		applyCustomContent({
			astirWeapons: [{
				key: "custom:test-familiar",
				name: "Test Familiar",
				description: "d",
				tags: ["ranged"],
				familiar: true,
				requiresParts: ["astir-part:familiar-matrix"]
			}]
		});

		expect(findAstirWeapon("custom:test-familiar")).toMatchObject({ familiar: true, requiresParts: ["astir-part:familiar-matrix"] });
	});

	it("carries an explicit traits array through on an astirParts addition", () => {
		applyCustomContent({
			astirParts: [{ key: "custom:test-part-traits", name: "N", partType: "Passive", description: "d", traits: ["arcane"] }]
		});
		expect(findAstirPart("custom:test-part-traits").traits).toEqual(["arcane"]);
	});

	it("carries allowlisted Astir Part behavior flags through untouched", () => {
		applyCustomContent({
			astirParts: [{
				key: "custom:test-active-part",
				name: "Test Active Part",
				partType: "Active",
				description: "d",
				powerCost: 1,
				uses: [{ key: "expended", label: "Expended", period: "Sortie" }]
			}]
		});

		expect(findAstirPart("custom:test-active-part")).toMatchObject({
			powerCost: 1,
			uses: [{ key: "expended", label: "Expended", period: "Sortie" }]
		});
	});
});

describe("applyCustomContent — astirParts three-array reach", () => {
	it("pushes the exact same object reference into ASTIR_PART_CATALOG, ARDENT_PART_CATALOG, and ALL_MOVES", () => {
		applyCustomContent({ astirParts: [{ key: "custom:test-part", name: "Test Part", partType: "Passive", description: "d" }] });

		const viaAstir = findAstirPart("custom:test-part");
		const viaArdent = findArdentPart("custom:test-part");
		const viaMoves = findMove("custom:test-part");

		expect(viaAstir).toBeDefined();
		expect(viaAstir).toBe(viaArdent);
		expect(viaAstir).toBe(viaMoves);
	});
});

describe("applyCustomContent — retraction", () => {
	it("removes a previously injected entry when its key is missing from a re-upload", () => {
		applyCustomContent({ equipment: [{ key: "custom:temp", name: "Temp", kind: "gear", description: "d" }] });
		expect(findEquipment("custom:temp")).toBeDefined();

		applyCustomContent({ equipment: [] });
		expect(findEquipment("custom:temp")).toBeUndefined();
	});

	it("retracts a whole section's previous content when the upload omits that section's key entirely", () => {
		applyCustomContent({ equipment: [{ key: "custom:temp2", name: "Temp2", kind: "gear", description: "d" }] });
		expect(findEquipment("custom:temp2")).toBeDefined();

		applyCustomContent({});
		expect(findEquipment("custom:temp2")).toBeUndefined();
	});

	it("retracts a three-array Part from all three catalogs at once", () => {
		applyCustomContent({ astirParts: [{ key: "custom:temp-part", name: "Temp Part", partType: "Passive", description: "d" }] });
		expect(findAstirPart("custom:temp-part")).toBeDefined();

		applyCustomContent({ astirParts: [] });
		expect(findAstirPart("custom:temp-part")).toBeUndefined();
		expect(findArdentPart("custom:temp-part")).toBeUndefined();
		expect(findMove("custom:temp-part")).toBeUndefined();
	});

	it("only retracts the entries in the section it's currently processing, leaving other sections' tracked entries alone mid-pass", () => {
		applyCustomContent({
			equipment: [{ key: "custom:keep-equipment", name: "N", kind: "gear", description: "d" }],
			astirWeapons: [{ key: "custom:keep-weapon", name: "N", description: "d", tags: ["melee"] }]
		});

		// Re-uploads astirWeapons unchanged while omitting equipment entirely — equipment's own
		// retraction pass has to skip over astirWeapons' still-tracked entry rather than sweeping it
		// up too, since it belongs to a different section's namespace.
		applyCustomContent({ astirWeapons: [{ key: "custom:keep-weapon", name: "N", description: "d", tags: ["melee"] }] });

		expect(findEquipment("custom:keep-equipment")).toBeUndefined();
		expect(findAstirWeapon("custom:keep-weapon")).toBeDefined();
	});

	it("tolerates an entry already spliced out of one of its own tracked catalogs by outside interference (reset)", () => {
		applyCustomContent({ astirParts: [{ key: "custom:already-gone", name: "N", partType: "Passive", description: "d" }] });

		const index = ASTIR_PART_CATALOG.findIndex((part) => part.key === "custom:already-gone");
		ASTIR_PART_CATALOG.splice(index, 1);

		expect(() => resetCustomContent()).not.toThrow();
		expect(findArdentPart("custom:already-gone")).toBeUndefined();
		expect(findMove("custom:already-gone")).toBeUndefined();
	});

	it("tolerates an entry already spliced out of one of its own tracked catalogs by outside interference (re-upload retraction)", () => {
		applyCustomContent({ astirParts: [{ key: "custom:already-gone-2", name: "N", partType: "Passive", description: "d" }] });

		const index = ALL_MOVES.findIndex((move) => move.key === "custom:already-gone-2");
		ALL_MOVES.splice(index, 1);

		expect(() => applyCustomContent({ astirParts: [] })).not.toThrow();
		expect(findAstirPart("custom:already-gone-2")).toBeUndefined();
		expect(findArdentPart("custom:already-gone-2")).toBeUndefined();
	});
});

describe("applyCustomContent — in-place update", () => {
	it("mutates an already-injected entry's fields without changing its object identity", () => {
		applyCustomContent({ equipment: [{ key: "custom:evolve", name: "Old Name", kind: "gear", description: "old" }] });
		const before = findEquipment("custom:evolve");

		applyCustomContent({ equipment: [{ key: "custom:evolve", name: "New Name", kind: "gear", description: "new" }] });
		const after = findEquipment("custom:evolve");

		expect(after).toBe(before);
		expect(after.name).toBe("New Name");
		expect(after.description).toBe("new");
	});

	it("drops a field omitted from the newer upload rather than merging it forward", () => {
		applyCustomContent({
			astirParts: [{ key: "custom:evolve-part", name: "Part", partType: "Active", description: "d", powerCost: 2 }]
		});
		expect(findAstirPart("custom:evolve-part").powerCost).toBe(2);

		applyCustomContent({
			astirParts: [{ key: "custom:evolve-part", name: "Part", partType: "Active", description: "d" }]
		});
		expect(findAstirPart("custom:evolve-part").powerCost).toBeUndefined();
	});

	it("keeps the same object reference across all three astirParts catalogs after an in-place update", () => {
		applyCustomContent({ astirParts: [{ key: "custom:evolve-reach", name: "Old", partType: "Passive", description: "d" }] });
		applyCustomContent({ astirParts: [{ key: "custom:evolve-reach", name: "New", partType: "Passive", description: "d" }] });

		const viaAstir = findAstirPart("custom:evolve-reach");
		expect(viaAstir.name).toBe("New");
		expect(findArdentPart("custom:evolve-reach")).toBe(viaAstir);
		expect(findMove("custom:evolve-reach")).toBe(viaAstir);
	});
});

describe("applyCustomContent — reflavor overridability", () => {
	it("makes a freshly-injected entry immediately reflavor-overridable", () => {
		applyCustomContent({ equipment: [{ key: "custom:reflavor-me", name: "Before", kind: "gear", description: "d" }] });

		applyReflavor({ equipment: { "custom:reflavor-me": { name: "After" } } });

		expect(findEquipment("custom:reflavor-me").name).toBe("After");
	});
});

describe("applyCustomContent — never throws on invalid data", () => {
	it("skips an addition with a blocking error and still applies the rest of the upload", () => {
		expect(() => applyCustomContent({
			equipment: [
				{ key: "not-prefixed", name: "Bad", kind: "gear", description: "d" },
				{ key: "custom:good-one", name: "Good", kind: "gear", description: "d" }
			]
		})).not.toThrow();

		expect(findEquipment("custom:good-one")).toBeDefined();
		expect(findEquipment("not-prefixed")).toBeUndefined();
	});
});

describe("validateCustomContent — malformed root", () => {
	it("returns no errors/warnings for undefined (no additions key uploaded)", () => {
		expect(validateCustomContent(undefined)).toEqual({ errors: [], warnings: [] });
	});

	it("returns no errors/warnings for null", () => {
		expect(validateCustomContent(null)).toEqual({ errors: [], warnings: [] });
	});

	it("errors on a non-object root", () => {
		const { errors } = validateCustomContent("nope");
		expect(errors).toEqual(["\"additions\" must be an object keyed by section name."]);
	});

	it("errors on an array root", () => {
		const { errors } = validateCustomContent([1, 2]);
		expect(errors).toEqual(["\"additions\" must be an object keyed by section name."]);
	});

	it("does not mutate any catalog on a dry run", () => {
		validateCustomContent({ equipment: [{ key: "custom:dry-run-only", name: "N", kind: "gear", description: "d" }] });
		expect(findEquipment("custom:dry-run-only")).toBeUndefined();
	});
});

describe("validateCustomContent — per-entry validation", () => {
	it("errors when a key is missing the custom: prefix", () => {
		const { errors } = validateCustomContent({ equipment: [{ key: "not-prefixed", name: "N", kind: "gear", description: "d" }] });
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/must have a "key" starting with "custom:"/);
	});

	it("errors when the key is entirely missing", () => {
		const { errors } = validateCustomContent({ equipment: [{ name: "N", kind: "gear", description: "d" }] });
		expect(errors[0]).toMatch(/addition #1 must have a "key" starting with "custom:"/);
	});

	it("errors on a missing required field", () => {
		const { errors } = validateCustomContent({ equipment: [{ key: "custom:missing-name", kind: "gear", description: "d" }] });
		expect(errors).toContain("equipment addition \"custom:missing-name\" is missing required field \"name\".");
	});

	it("errors on a required field left as an empty string", () => {
		const { errors } = validateCustomContent({ equipment: [{ key: "custom:empty-desc", name: "N", kind: "gear", description: "" }] });
		expect(errors).toContain("equipment addition \"custom:empty-desc\" is missing required field \"description\".");
	});

	it("errors when two additions in the same upload share a key", () => {
		const { errors } = validateCustomContent({
			equipment: [
				{ key: "custom:dupe", name: "A", kind: "gear", description: "d" },
				{ key: "custom:dupe", name: "B", kind: "gear", description: "d" }
			]
		});
		expect(errors).toContain("equipment addition \"custom:dupe\" duplicates key \"custom:dupe\" already used earlier in this upload.");
	});

	it("errors when a key collides with an existing catalog key", () => {
		// Simulates a pre-existing catalog entry whose key happens to start with "custom:" — under
		// today's real catalog content this can only ever be another already-injected addition
		// (which is deliberately excluded from the collision check, see existingKeysForSection), so
		// this pushes a bare fixture object directly to exercise the collision branch itself.
		const collidingEntry = { key: "custom:already-here", name: "Pre-existing", kind: "gear", description: "d" };
		EQUIPMENT_CATALOG.push(collidingEntry);
		try {
			const { errors } = validateCustomContent({
				equipment: [{ key: "custom:already-here", name: "New", kind: "gear", description: "d" }]
			});
			expect(errors).toContain("equipment addition \"custom:already-here\"'s key collides with an existing equipment catalog entry.");
		} finally {
			EQUIPMENT_CATALOG.splice(EQUIPMENT_CATALOG.indexOf(collidingEntry), 1);
		}
	});

	it("warns, but does not error, on an unrecognized field", () => {
		const { errors, warnings } = validateCustomContent({
			equipment: [{ key: "custom:extra-field", name: "N", kind: "gear", description: "d", bogus: true }]
		});
		expect(errors).toEqual([]);
		expect(warnings).toContain("Unknown field \"bogus\" on equipment addition \"custom:extra-field\" was ignored.");
	});

	it("warns, but does not error, on an unrecognized Astir Part behavior flag", () => {
		const { errors, warnings } = validateCustomContent({
			astirParts: [{ key: "custom:bad-flag", name: "N", partType: "Passive", description: "d", notARealFlag: true }]
		});
		expect(errors).toEqual([]);
		expect(warnings).toContain("Unknown field \"notARealFlag\" on astirParts addition \"custom:bad-flag\" was ignored.");
	});

	it("errors on an invalid equipment kind", () => {
		const { errors } = validateCustomContent({ equipment: [{ key: "custom:bad-kind", name: "N", kind: "vehicle", description: "d" }] });
		expect(errors).toContain("equipment addition \"custom:bad-kind\" has an invalid kind \"vehicle\" — must be \"weapon\" or \"gear\".");
	});

	it("errors when an equipment weapon has no scale", () => {
		const { errors } = validateCustomContent({
			equipment: [{ key: "custom:no-scale", name: "N", kind: "weapon", description: "d", tags: ["melee"] }]
		});
		expect(errors).toContain("equipment addition \"custom:no-scale\" is a weapon and needs a \"scale\" of \"foot\" or \"astir\".");
	});

	it("errors when a weapon has no melee/ranged/sniper tag", () => {
		const { errors } = validateCustomContent({
			equipment: [{ key: "custom:no-range", name: "N", kind: "weapon", description: "d", tags: ["bane"], scale: "foot" }]
		});
		expect(errors).toContain("equipment addition \"custom:no-range\" needs exactly one of the melee, ranged or sniper tags.");
	});

	it("errors when an astirWeapons addition omits tags entirely", () => {
		const { errors } = validateCustomContent({ astirWeapons: [{ key: "custom:no-tags-weapon", name: "N", description: "d" }] });
		expect(errors).toContain("astirWeapons addition \"custom:no-tags-weapon\" needs exactly one of the melee, ranged or sniper tags.");
	});

	it("errors when a weapon has more than one range tag", () => {
		const { errors } = validateCustomContent({
			astirWeapons: [{ key: "custom:two-ranges", name: "N", description: "d", tags: ["melee", "ranged"] }]
		});
		expect(errors).toContain("astirWeapons addition \"custom:two-ranges\" needs exactly one of the melee, ranged or sniper tags.");
	});

	it("errors on an unresolvable tag key", () => {
		const { errors } = validateCustomContent({
			astirWeapons: [{ key: "custom:bad-tag", name: "N", description: "d", tags: ["melee", "not-a-real-tag"] }]
		});
		expect(errors).toContain("astirWeapons addition \"custom:bad-tag\" references unknown tag \"not-a-real-tag\".");
	});

	it("errors when the non-range tag count exceeds MAX_TAGS, without counting the range tag itself", () => {
		const nonRangeTags = Array.from({ length: MAX_TAGS + 1 }, (_, index) => (index % 2 === 0 ? "fragile" : "bulky"));
		const { errors } = validateCustomContent({
			astirWeapons: [{ key: "custom:too-many-tags", name: "N", description: "d", tags: ["melee", ...nonRangeTags] }]
		});
		expect(errors).toContain(`astirWeapons addition "custom:too-many-tags" can have at most ${MAX_TAGS} tags, not counting melee/ranged/sniper.`);
	});

	it("does not error when a weapon has exactly MAX_TAGS non-range tags plus its one required range tag", () => {
		const nonRangeTags = Array.from({ length: MAX_TAGS }, (_, index) => (index % 2 === 0 ? "fragile" : "bulky"));
		const { errors } = validateCustomContent({
			astirWeapons: [{ key: "custom:exactly-max-tags", name: "N", description: "d", tags: ["melee", ...nonRangeTags] }]
		});
		expect(errors).toEqual([]);
	});

	it("errors on an invalid astirParts partType", () => {
		const { errors } = validateCustomContent({
			astirParts: [{ key: "custom:bad-part-type", name: "N", partType: "Weird", description: "d" }]
		});
		expect(errors).toContain("astirParts addition \"custom:bad-part-type\" has an invalid partType \"Weird\" — must be \"Active\" or \"Passive\".");
	});

	it("errors when an additions section value isn't an array", () => {
		const { errors } = validateCustomContent({ equipment: "not-an-array" });
		expect(errors).toContain("\"equipment\" additions must be an array.");
	});

	it("errors when a raw entry isn't an object", () => {
		const { errors } = validateCustomContent({ equipment: [null] });
		expect(errors).toContain("equipment addition #1 must be an object.");
	});
});
