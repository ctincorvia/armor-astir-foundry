import { beforeEach, describe, expect, it, vi } from "vitest";
import { DRAIN_GROUP, resolveEquipmentTags } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG, ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir.js";
import {
	ARDENT_DEFAULT_NAME,
	ARDENT_FEATURE_MAX_BASE,
	ARDENT_FEATURE_PARTS,
	ARDENT_FEATURE_WEAPONS,
	ARDENT_MAX_LOADOUT,
	ARDENT_TIER_DEFAULT,
	ARDENT_TIER_MAX,
	ARDENT_TIER_MIN,
	ardentBaselineLoadoutCount,
	ardentFeatureLoadoutCount,
	ardentFeatureMax,
	ardentLoadoutCount,
	ardentParts,
	ardentWeapons,
	buildArdent,
	chooseFrame,
	isAceFeaturePart
} from "../scripts/frames/ardent.js";

beforeEach(() => {
	vi.resetAllMocks();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("ARDENT_TIER_MIN/ARDENT_TIER_MAX/ARDENT_TIER_DEFAULT", () => {
	it("sits in its own 2-4 band, defaulting to 2 — distinct from the Astir's 3-4 band", () => {
		expect(ARDENT_TIER_MIN).toBe(2);
		expect(ARDENT_TIER_MAX).toBe(4);
		expect(ARDENT_TIER_DEFAULT).toBe(2);
	});
});

describe("ARDENT_MAX_LOADOUT", () => {
	it("caps a combined parts+weapons loadout at 2", () => {
		expect(ARDENT_MAX_LOADOUT).toBe(2);
	});
});

describe("ardentParts", () => {
	it("excludes exactly the entries with a powerCost or a weaponPowerBonus — an Ardent has no Power", () => {
		const eligible = ardentParts();

		for (const part of eligible) {
			expect(part.powerCost).toBeUndefined();
			expect(part.weaponPowerBonus).toBeUndefined();
		}
		for (const part of ASTIR_PART_CATALOG) {
			const shouldBeEligible = !part.powerCost && !part.weaponPowerBonus;
			expect(eligible.includes(part)).toBe(shouldBeEligible);
		}
	});

	it("returns a non-empty strict subset of the real Astir part catalog", () => {
		const eligible = ardentParts();

		expect(eligible.length).toBeGreaterThan(0);
		expect(eligible.length).toBeLessThan(ASTIR_PART_CATALOG.length);
	});

	it("returns the exact same object references as the source catalog — a view, not a copy", () => {
		const catalog = [
			{ key: "a", name: "A", traits: [], description: "a" },
			{ key: "b", name: "B", traits: [], description: "b", powerCost: 1 }
		];

		const eligible = ardentParts(catalog);

		expect(eligible).toEqual([catalog[0]]);
		expect(eligible[0]).toBe(catalog[0]);
	});

	it("takes an injectable catalog for fixture-based tests", () => {
		const catalog = [
			{ key: "a", name: "A", traits: [], description: "a" },
			{ key: "b", name: "B", traits: [], description: "b", weaponPowerBonus: 2 }
		];

		expect(ardentParts(catalog).map((part) => part.key)).toEqual(["a"]);
	});
});

describe("ardentWeapons", () => {
	it("excludes exactly the entries carrying a Drain tag — an Ardent has no Power for Drain to reduce", () => {
		const eligible = ardentWeapons();

		for (const weapon of eligible) {
			const drainTag = resolveEquipmentTags(weapon.tags ?? []).some((tag) => tag.exclusiveGroup === DRAIN_GROUP);
			expect(drainTag).toBe(false);
		}
		for (const weapon of ASTIR_WEAPON_CATALOG) {
			const hasDrain = resolveEquipmentTags(weapon.tags ?? []).some((tag) => tag.exclusiveGroup === DRAIN_GROUP);
			expect(eligible.includes(weapon)).toBe(!hasDrain);
		}
	});

	it("returns a non-empty strict subset of the real Astir weapon catalog", () => {
		const eligible = ardentWeapons();

		expect(eligible.length).toBeGreaterThan(0);
		expect(eligible.length).toBeLessThan(ASTIR_WEAPON_CATALOG.length);
	});

	it("returns the exact same object references as the source catalog — a view, not a copy", () => {
		const catalog = [
			{ key: "a", name: "A", description: "a", tags: ["melee"] },
			{ key: "b", name: "B", description: "b", tags: ["melee", "drain-1"] }
		];

		const eligible = ardentWeapons(catalog);

		expect(eligible).toEqual([catalog[0]]);
		expect(eligible[0]).toBe(catalog[0]);
	});

	it("takes an injectable catalog for fixture-based tests", () => {
		const catalog = [
			{ key: "a", name: "A", description: "a", tags: ["drain-2"] },
			{ key: "b", name: "B", description: "b", tags: [] }
		];

		expect(ardentWeapons(catalog).map((weapon) => weapon.key)).toEqual(["b"]);
	});

	it("treats a missing tags array as having no Drain", () => {
		const catalog = [{ key: "a", name: "A", description: "a" }];

		expect(ardentWeapons(catalog)).toEqual(catalog);
	});
});

describe("buildArdent", () => {
	it("defaults to name Ardent, Tier minimum, unpiloted, and no parts", () => {
		expect(buildArdent()).toEqual({
			id: "test-id",
			name: ARDENT_DEFAULT_NAME,
			approach: "",
			tier: ARDENT_TIER_DEFAULT,
			piloted: false,
			parts: []
		});
	});

	it("takes a custom name", () => {
		expect(buildArdent("Warhound").name).toBe("Warhound");
	});

	it("gives every call a fresh parts array, not one shared between Ardents", () => {
		const a = buildArdent();
		const b = buildArdent();

		expect(a.parts).not.toBe(b.parts);
	});

	it("carries no core, power, weaponPower, overheating, img, or move", () => {
		const ardent = buildArdent();

		expect(ardent.core).toBeUndefined();
		expect(ardent.power).toBeUndefined();
		expect(ardent.weaponPower).toBeUndefined();
		expect(ardent.overheating).toBeUndefined();
		expect(ardent.img).toBeUndefined();
		expect(ardent.move).toBeUndefined();
	});
});

describe("ardentLoadoutCount", () => {
	it("counts installed parts plus this Ardent's own equipment-flagged weapons", () => {
		const ardent = { id: "ar1", parts: ["astir-part:a", "astir-part:b"] };
		const equipment = [
			{ id: "1", kind: "weapon", ardent: "ar1" },
			{ id: "2", kind: "weapon", ardent: "ar2" },
			{ id: "3", kind: "gear", ardent: "ar1" }
		];

		expect(ardentLoadoutCount(ardent, equipment)).toBe(3);
	});

	it("ignores another Ardent's weapons and mundane/Astir weapons", () => {
		const ardent = { id: "ar1", parts: [] };
		const equipment = [
			{ id: "1", kind: "weapon", ardent: "ar2" },
			{ id: "2", kind: "weapon", astir: true },
			{ id: "3", kind: "weapon" }
		];

		expect(ardentLoadoutCount(ardent, equipment)).toBe(0);
	});

	it("treats a missing parts array and missing equipment as empty", () => {
		expect(ardentLoadoutCount({ id: "ar1" })).toBe(0);
	});
});

describe("chooseFrame", () => {
	const astirFrame = { kind: "astir", id: "astir", name: "Vanguard" };
	const ardentFrame = { kind: "ardent", id: "ar1", name: "Warhound" };

	it("opens a Dialog with one labelled button per frame", () => {
		chooseFrame([astirFrame, ardentFrame]);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe("Mount Up");
		expect(Object.keys(dialogData.buttons)).toEqual(["astir", "ar1"]);
		expect(dialogData.buttons.astir.label).toBe("Vanguard");
		expect(dialogData.buttons.ar1.label).toBe("Warhound");
	});

	it("resolves the clicked frame", async () => {
		const promise = chooseFrame([astirFrame, ardentFrame]);

		Dialog.mock.calls.at(-1)[0].buttons.ar1.callback();

		expect(await promise).toBe(ardentFrame);
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseFrame([astirFrame, ardentFrame]);

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("uses the module's own styling", () => {
		chooseFrame([astirFrame]);

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir"] });
	});
});

describe("ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS", () => {
	it("carries no powerCost or weaponPowerBonus on any part — an Ardent has no Power pool", () => {
		for (const part of ARDENT_FEATURE_PARTS) {
			expect(part.powerCost).toBeUndefined();
			expect(part.weaponPowerBonus).toBeUndefined();
		}
	});

	it("carries no Drain tag on any weapon — an Ardent has no Power for Drain to reduce", () => {
		for (const weapon of ARDENT_FEATURE_WEAPONS) {
			const hasDrain = resolveEquipmentTags(weapon.tags ?? []).some((tag) => tag.exclusiveGroup === DRAIN_GROUP);
			expect(hasDrain).toBe(false);
		}
	});

	it("is a separate catalog from the generic Astir-derived one — no overlapping keys", () => {
		const featureKeys = [...ARDENT_FEATURE_PARTS, ...ARDENT_FEATURE_WEAPONS].map((entry) => entry.key);
		const astirKeys = [...ASTIR_PART_CATALOG, ...ASTIR_WEAPON_CATALOG].map((entry) => entry.key);
		for (const key of featureKeys) {
			expect(astirKeys.includes(key)).toBe(false);
		}
	});

	// Chromatic Reserves' "swap to any other Approach for a single Scene, 3x per Sortie" (see
	// moves-mixin.js's promptsApproachOverride/_nextUnusedMoveUseKey and move-roll-mixin.js's
	// _onMoveActivate branch) — same mechanism astir-parts.js's Chromatic Focus uses.
	it("flags Chromatic Reserves with promptsApproachOverride", () => {
		const chromaticReserves = ARDENT_FEATURE_PARTS.find((p) => p.key === "ardent-feature:chromatic-reserves");
		expect(chromaticReserves.promptsApproachOverride).toBe(true);
	});
});

describe("isAceFeaturePart", () => {
	it("is true for a key in ARDENT_FEATURE_PARTS", () => {
		expect(isAceFeaturePart(ARDENT_FEATURE_PARTS[0].key)).toBe(true);
	});

	it("is false for a key in the generic Astir-derived catalog", () => {
		expect(isAceFeaturePart(ASTIR_PART_CATALOG[0].key)).toBe(false);
	});

	it("takes an injectable catalog for fixture-based tests", () => {
		const catalog = [{ key: "custom:a" }];
		expect(isAceFeaturePart("custom:a", catalog)).toBe(true);
		expect(isAceFeaturePart("custom:b", catalog)).toBe(false);
	});
});

describe("ardentBaselineLoadoutCount", () => {
	it("counts baseline parts and weapons, excluding Ardent Feature parts and commanderFeature weapons", () => {
		const featureKey = ARDENT_FEATURE_PARTS[0].key;
		const ardent = { id: "ar1", parts: ["astir-part:a", featureKey] };
		const equipment = [
			{ id: "1", kind: "weapon", ardent: "ar1" },
			{ id: "2", kind: "weapon", ardent: "ar1", commanderFeature: true },
			{ id: "3", kind: "weapon", ardent: "ar2" }
		];

		expect(ardentBaselineLoadoutCount(ardent, equipment)).toBe(2);
	});

	it("matches ardentLoadoutCount exactly when nothing is Feature-flagged", () => {
		const ardent = { id: "ar1", parts: ["astir-part:a", "astir-part:b"] };
		const equipment = [{ id: "1", kind: "weapon", ardent: "ar1" }];

		expect(ardentBaselineLoadoutCount(ardent, equipment)).toBe(ardentLoadoutCount(ardent, equipment));
	});

	it("treats a missing parts array and missing equipment as empty", () => {
		expect(ardentBaselineLoadoutCount({ id: "ar1" })).toBe(0);
	});
});

describe("ardentFeatureLoadoutCount", () => {
	it("counts only Ardent Feature parts and commanderFeature weapons", () => {
		const featureKey = ARDENT_FEATURE_PARTS[0].key;
		const ardent = { id: "ar1", parts: ["astir-part:a", featureKey] };
		const equipment = [
			{ id: "1", kind: "weapon", ardent: "ar1" },
			{ id: "2", kind: "weapon", ardent: "ar1", commanderFeature: true },
			{ id: "3", kind: "weapon", ardent: "ar2", commanderFeature: true }
		];

		expect(ardentFeatureLoadoutCount(ardent, equipment)).toBe(2);
	});

	it("treats a missing parts array and missing equipment as empty", () => {
		expect(ardentFeatureLoadoutCount({ id: "ar1" })).toBe(0);
	});
});

describe("ARDENT_FEATURE_MAX_BASE/ardentFeatureMax", () => {
	it("defaults to 3 with no picked moves", () => {
		expect(ARDENT_FEATURE_MAX_BASE).toBe(3);
		expect(ardentFeatureMax([])).toBe(3);
		expect(ardentFeatureMax()).toBe(3);
	});

	it("sums ardentFeatureBonus across picked moves on top of the base (Requisitions: +2)", () => {
		expect(ardentFeatureMax([{ ardentFeatureBonus: 2 }])).toBe(5);
	});

	it("ignores a picked move with no ardentFeatureBonus flag", () => {
		expect(ardentFeatureMax([{ key: "x" }])).toBe(3);
	});
});
