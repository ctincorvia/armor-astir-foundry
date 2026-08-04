import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPROACHES } from "../scripts/core/approaches.js";
import { DRAIN_GROUP, findEquipmentTag } from "../scripts/equipment/equipment.js";
import { findPlaybookMove } from "../scripts/moves/playbook-moves.js";
import {
	ASTIR_CORES,
	ASTIR_MOVE_CATALOG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	ASTIR_WEAPON_CATALOG,
	astirCoreApproaches,
	astirMaxPower,
	astirMaxWeaponPower,
	astirMoveSections,
	astirWeaponDrainTotal,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon,
	findAstirMove,
	findAstirPart,
	findCatalogAstirWeapon,
	resolveAstirParts
} from "../scripts/frames/astir.js";

// Fakes the jQuery `.find("[name='catalog-item']:checked").val()` / `.find("[name='playbook-move']:checked").val()`
// chains the picker dialogs use to read the picked radio, mirroring the equivalent fakes in
// tests/equipment.test.js and tests/playbook-moves.test.js.
function fakePickerHtml(checkedValue) {
	return { find: () => ({ val: () => checkedValue }) };
}

beforeEach(() => {
	vi.resetAllMocks();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
});

describe("ASTIR_CORES", () => {
	it("gives every core exactly two real Approaches", () => {
		const approachKeys = APPROACHES.map((approach) => approach.key);
		for (const core of ASTIR_CORES) {
			expect(core.approaches).toHaveLength(2);
			for (const key of core.approaches) {
				expect(approachKeys).toContain(key);
			}
		}
	});

	it("keeps every core key unique", () => {
		const keys = ASTIR_CORES.map((core) => core.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});

describe("astirCoreApproaches", () => {
	it("resolves a core's two Approaches by key", () => {
		expect(astirCoreApproaches("alchemical").map((a) => a.key)).toEqual(["mundane", "arcane"]);
		expect(astirCoreApproaches("crystalline").map((a) => a.key)).toEqual(["arcane", "profane"]);
		expect(astirCoreApproaches("ancient").map((a) => a.key)).toEqual(["mundane", "divine"]);
		expect(astirCoreApproaches("natural").map((a) => a.key)).toEqual(["divine", "elemental"]);
		expect(astirCoreApproaches("occult").map((a) => a.key)).toEqual(["profane", "elemental"]);
	});

	it("returns an empty list for an unchosen/unknown core, so the Approach select blanks", () => {
		expect(astirCoreApproaches("")).toEqual([]);
		expect(astirCoreApproaches("not-a-core")).toEqual([]);
	});
});

describe("ASTIR_TIER_MIN/ASTIR_TIER_MAX", () => {
	it("sits in its own 3-4 band, distinct from equipment's 1-5", () => {
		expect(ASTIR_TIER_MIN).toBe(3);
		expect(ASTIR_TIER_MAX).toBe(4);
	});
});

describe("ASTIR_POWER_MIN/ASTIR_POWER_BASE", () => {
	it("starts a new Astir at 4 power, floored at 0", () => {
		expect(ASTIR_POWER_MIN).toBe(0);
		expect(ASTIR_POWER_BASE).toBe(4);
	});
});

describe("ASTIR_PART_CATALOG", () => {
	it("gives every part a key prefixed astir-part:, the move shape, and a valid partType", () => {
		for (const part of ASTIR_PART_CATALOG) {
			expect(part.key.startsWith("astir-part:")).toBe(true);
			expect(part.name).toBeTruthy();
			expect(Array.isArray(part.traits)).toBe(true);
			expect(part.description).toBeTruthy();
			expect(["Active", "Passive"]).toContain(part.partType);
			// Not every part carries a Power cost (see astirMaxPower) — only the ones with a
			// "(-X Power)" annotation in the rulebook do.
			if (part.powerCost !== undefined) expect(typeof part.powerCost).toBe("number");
		}
	});

	it("gives every part a unique key", () => {
		const keys = ASTIR_PART_CATALOG.map((part) => part.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	// Subsystems' own rules text ("re-activate an expended [Active] Astir part") assumes every
	// Active part can become Expended — see claude.md's Astir section. period: "Sortie" is what
	// PlaybookActorSheet#_onRefreshSortie reads to clear it in bulk.
	it("gives every Active part a manual, Sortie-scoped Expended checkbox", () => {
		const activeParts = ASTIR_PART_CATALOG.filter((part) => part.partType === "Active");
		expect(activeParts.length).toBeGreaterThan(0);
		for (const part of activeParts) {
			expect(part.uses).toEqual([{ key: "expended", label: "Expended", period: "Sortie" }]);
		}
	});

	it("gives a spend with an effect or advantage a short plain-text spend.description", () => {
		for (const part of ASTIR_PART_CATALOG.filter((p) => p.spend?.effect || p.spend?.advantage)) {
			expect(part.spend.description).toBeTruthy();
		}
	});
});

describe("findAstirPart/resolveAstirParts", () => {
	const FIXTURE_PARTS = [
		{ key: "astir-part:a", name: "A", traits: [], description: "a", powerCost: 1 },
		{ key: "astir-part:b", name: "B", traits: [], description: "b", powerCost: 2 }
	];

	it("finds a part by key", () => {
		expect(findAstirPart("astir-part:a", FIXTURE_PARTS).name).toBe("A");
	});

	it("returns null for an unknown key", () => {
		expect(findAstirPart("astir-part:nope", FIXTURE_PARTS)).toBeNull();
	});

	it("resolves stored keys to part definitions in order", () => {
		const parts = resolveAstirParts(["astir-part:b", "astir-part:a"], FIXTURE_PARTS);
		expect(parts.map((p) => p.key)).toEqual(["astir-part:b", "astir-part:a"]);
	});

	it("drops a key that no longer resolves, rather than yielding a hole", () => {
		const parts = resolveAstirParts(["astir-part:a", "astir-part:deleted"], FIXTURE_PARTS);
		expect(parts.map((p) => p.key)).toEqual(["astir-part:a"]);
	});

	it("defaults to an empty list when the Astir has no parts", () => {
		expect(resolveAstirParts()).toEqual([]);
	});
});

// Shared by astirWeaponDrainTotal/astirMaxPower/astirMaxWeaponPower below — mirrors equipment.js's
// own FIXTURE_TAGS convention (see tests/equipment.test.js) rather than depending on the real
// EQUIPMENT_TAGS catalog's Drain entries.
const DRAIN_TAGS = [
	{ key: "drain-1", label: "Drain 1", value: -1, exclusiveGroup: DRAIN_GROUP },
	{ key: "drain-2", label: "Drain 2", value: -2, exclusiveGroup: DRAIN_GROUP },
	{ key: "non-drain", label: "Non-Drain", value: -1 }
];

describe("astirWeaponDrainTotal", () => {
	it("sums Drain tags across every weapon mounted on the Astir, as a positive magnitude", () => {
		const equipment = [
			{ id: "1", kind: "weapon", astir: true, tags: ["drain-1"] },
			{ id: "2", kind: "weapon", astir: true, tags: ["drain-2"] }
		];
		expect(astirWeaponDrainTotal(equipment, DRAIN_TAGS)).toBe(3);
	});

	it("ignores a mundane (non-Astir) weapon's Drain", () => {
		const equipment = [{ id: "1", kind: "weapon", tags: ["drain-2"] }];
		expect(astirWeaponDrainTotal(equipment, DRAIN_TAGS)).toBe(0);
	});

	it("ignores gear, even if it somehow carries a Drain tag", () => {
		const equipment = [{ id: "1", kind: "gear", tags: ["drain-2"] }];
		expect(astirWeaponDrainTotal(equipment, DRAIN_TAGS)).toBe(0);
	});

	it("ignores a non-Drain tag", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true, tags: ["non-drain"] }];
		expect(astirWeaponDrainTotal(equipment, DRAIN_TAGS)).toBe(0);
	});

	it("defaults to 0 for missing/empty equipment", () => {
		expect(astirWeaponDrainTotal()).toBe(0);
	});

	it("treats a missing tags array on an Astir weapon entry as empty", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true }];
		expect(astirWeaponDrainTotal(equipment, DRAIN_TAGS)).toBe(0);
	});
});

describe("astirMaxPower", () => {
	const FIXTURE_PARTS = [
		{ key: "astir-part:a", name: "A", traits: [], description: "a", powerCost: 1 },
		{ key: "astir-part:b", name: "B", traits: [], description: "b", powerCost: 2 },
		{ key: "astir-part:no-cost", name: "C", traits: [], description: "c" },
		{ key: "astir-part:conduit", name: "Conduit", traits: [], description: "d", weaponPowerBonus: 2 }
	];

	it("starts at the base when no parts are equipped", () => {
		expect(astirMaxPower([], [], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("subtracts every equipped part's powerCost from the base", () => {
		expect(astirMaxPower(["astir-part:a", "astir-part:b"], [], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE - 3);
	});

	it("treats a missing powerCost as 0", () => {
		expect(astirMaxPower(["astir-part:no-cost"], [], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("floors at ASTIR_POWER_MIN rather than going negative from part cost alone", () => {
		const heavy = [
			{ key: "astir-part:heavy", name: "Heavy", traits: [], description: "h", powerCost: 99 }
		];
		expect(astirMaxPower(["astir-part:heavy"], [], heavy)).toBe(ASTIR_POWER_MIN);
	});

	it("ignores a stale key that no longer resolves", () => {
		expect(astirMaxPower(["astir-part:deleted"], [], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("is untouched by Weapon Drain fully absorbed by the Weapon Power pool", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true, tags: ["drain-1"] }];
		expect(astirMaxPower(["astir-part:conduit"], equipment, FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("is reduced by whatever Weapon Drain didn't fit in the Weapon Power pool", () => {
		// Weapon Power capacity is 2 (Conduit); 3 Drain absorbs 2, spills 1 onto main Power.
		const equipment = [
			{ id: "1", kind: "weapon", astir: true, tags: ["drain-1"] },
			{ id: "2", kind: "weapon", astir: true, tags: ["drain-2"] }
		];
		expect(astirMaxPower(["astir-part:conduit"], equipment, FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE - 1);
	});

	it("can go negative from Weapon Drain when there's no Weapon Power pool to absorb it", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true, tags: ["drain-2"] }];
		expect(astirMaxPower([], equipment, FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE - 2);

		const veryHeavy = [
			{ id: "1", kind: "weapon", astir: true, tags: ["drain-2"] },
			{ id: "2", kind: "weapon", astir: true, tags: ["drain-2"] },
			{ id: "3", kind: "weapon", astir: true, tags: ["drain-2"] }
		];
		expect(astirMaxPower([], veryHeavy, FIXTURE_PARTS)).toBeLessThan(0);
	});
});

describe("astirMaxWeaponPower", () => {
	const FIXTURE_PARTS = [
		{ key: "astir-part:a", name: "A", traits: [], description: "a", weaponPowerBonus: 2 },
		{ key: "astir-part:no-bonus", name: "B", traits: [], description: "b" }
	];

	it("starts at 0 when no parts are equipped", () => {
		expect(astirMaxWeaponPower([], [], FIXTURE_PARTS)).toBe(0);
	});

	it("adds every equipped part's weaponPowerBonus", () => {
		expect(astirMaxWeaponPower(["astir-part:a"], [], FIXTURE_PARTS)).toBe(2);
	});

	it("treats a missing weaponPowerBonus as 0", () => {
		expect(astirMaxWeaponPower(["astir-part:no-bonus"], [], FIXTURE_PARTS)).toBe(0);
	});

	it("ignores a stale key that no longer resolves", () => {
		expect(astirMaxWeaponPower(["astir-part:deleted"], [], FIXTURE_PARTS)).toBe(0);
	});

	it("is reduced by Weapon Drain claiming part of its capacity", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true, tags: ["drain-1"] }];
		expect(astirMaxWeaponPower(["astir-part:a"], equipment, FIXTURE_PARTS)).toBe(1);
	});

	it("floors at 0 rather than going negative when Drain exceeds capacity", () => {
		const equipment = [{ id: "1", kind: "weapon", astir: true, tags: ["drain-2"] }];
		expect(astirMaxWeaponPower([], equipment, FIXTURE_PARTS)).toBe(0);
	});
});

describe("ASTIR_MOVE_CATALOG", () => {
	it("gives every move a key prefixed astir: and the move shape", () => {
		for (const move of ASTIR_MOVE_CATALOG) {
			expect(move.key.startsWith("astir:")).toBe(true);
			expect(move.name).toBeTruthy();
			expect(Array.isArray(move.traits)).toBe(true);
			expect(move.description).toBeTruthy();
		}
	});
});

describe("findAstirMove", () => {
	const FIXTURE_CATALOG = [{ key: "astir:a", name: "A", traits: [], description: "a" }];

	it("finds a move in the dedicated Astir Moves catalog", () => {
		expect(findAstirMove("astir:a", FIXTURE_CATALOG).name).toBe("A");
	});

	it("falls back to the playbook/Cantrips pools, since the unique move can come from either", () => {
		const move = findAstirMove("cantrips:deny", FIXTURE_CATALOG);
		expect(move).toEqual(findPlaybookMove("cantrips:deny"));
	});

	it("returns null when the key resolves nowhere", () => {
		expect(findAstirMove("nope:not-a-move", FIXTURE_CATALOG)).toBeNull();
	});
});

describe("ASTIR_WEAPON_CATALOG/findCatalogAstirWeapon", () => {
	it("gives every entry a name, description and tags array, with no scale/tier (inherited)", () => {
		for (const item of ASTIR_WEAPON_CATALOG) {
			expect(item.key).toBeTruthy();
			expect(item.name).toBeTruthy();
			expect(item.description).toBeTruthy();
			expect(Array.isArray(item.tags)).toBe(true);
			expect(item.scale).toBeUndefined();
			expect(item.tier).toBeUndefined();
		}
	});

	it("finds a catalog entry by key", () => {
		const key = ASTIR_WEAPON_CATALOG[0].key;
		expect(findCatalogAstirWeapon(key).key).toBe(key);
	});

	it("returns null for an unknown key", () => {
		expect(findCatalogAstirWeapon("not-a-real-key")).toBeNull();
	});

	it("only ever references a real EQUIPMENT_TAGS key", () => {
		for (const item of ASTIR_WEAPON_CATALOG) {
			for (const tagKey of item.tags) {
				expect(findEquipmentTag(tagKey)).not.toBeNull();
			}
		}
	});
});

describe("chooseAstirPart", () => {
	const FIXTURE_PARTS = [
		{ key: "astir-part:a", name: "A", traits: [], description: "a", powerCost: 1 },
		{ key: "astir-part:b", name: "B", traits: [], description: "b", powerCost: 2 }
	];

	it("renders the equipment catalog picker template with the offerable parts", async () => {
		chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("equipment-catalog-picker"),
			{ items: FIXTURE_PARTS }
		);
	});

	it("excludes already-picked parts, the same as a playbook move only being takeable once", async () => {
		chooseAstirPart(["astir-part:a"], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.any(String), { items: [FIXTURE_PARTS[1]] });
	});

	it("resolves the checked part's key", async () => {
		const promise = chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml("astir-part:a"));

		expect(await promise).toBe("astir-part:a");
	});

	it("resolves null when nothing is selected", async () => {
		const promise = chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when cancelled", async () => {
		const promise = chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("defaults the dialog title to Add an Astir Part", async () => {
		chooseAstirPart([], FIXTURE_PARTS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Add an Astir Part");
	});

	it("takes an overridable title, so ardent.js can reuse this same picker", async () => {
		chooseAstirPart([], FIXTURE_PARTS, { title: "Add an Ardent Part" });
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Add an Ardent Part");
	});
});

describe("chooseAstirWeapon", () => {
	const FIXTURE_CATALOG = [{ key: "fixture-astir-weapon", name: "Fixture Astir Weapon", description: "d", tags: [] }];

	it("renders the equipment catalog picker template with the whole catalog", async () => {
		chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.any(String), { items: FIXTURE_CATALOG });
	});

	it("resolves the chosen catalog item", async () => {
		const promise = chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml("fixture-astir-weapon"));

		expect(await promise).toEqual(FIXTURE_CATALOG[0]);
	});

	it("resolves null when nothing is selected", async () => {
		const promise = chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when cancelled", async () => {
		const promise = chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when closed", async () => {
		const promise = chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("defaults the dialog title to Pick an Astir Weapon", async () => {
		chooseAstirWeapon(FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Pick an Astir Weapon");
	});

	it("takes an overridable title, so ardent.js can reuse this same picker", async () => {
		chooseAstirWeapon(FIXTURE_CATALOG, { title: "Pick an Ardent Weapon" });
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Pick an Ardent Weapon");
	});
});

// Fixtures independent of the real (currently placeholder-only) MOVE_POOLS/ASTIR_MOVE_CATALOG, the
// same reasoning playbook-moves.test.js's FIXTURE_POOLS gives for playbookMoveSections.
const FIXTURE_POOLS = [
	{
		key: "alpha",
		label: "The Alpha",
		playbookName: "The Alpha",
		moves: [{ key: "alpha:one", name: "Alpha One", traits: [], description: "<p>a</p>" }]
	},
	{ key: "beta", label: "The Beta", playbookName: "The Beta", moves: [] },
	{
		key: "cantrips",
		label: "Cantrips",
		note: "Any playbook may take these.",
		moves: [{ key: "cantrips:one", name: "Cantrip One", traits: [], description: "<p>c</p>" }]
	},
	{
		key: "soldier",
		label: "Soldier Moves",
		note: "Only through Advancement.",
		moves: [{ key: "soldier:one", name: "Soldier One", traits: [], description: "<p>s</p>" }]
	}
];
const FIXTURE_ASTIR_CATALOG = [{ key: "astir:one", name: "Astir One", traits: [], description: "<p>m</p>" }];

describe("astirMoveSections", () => {
	it("puts the actor's own playbook pool first, expanded", () => {
		const [first] = astirMoveSections("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(first.key).toBe("alpha");
		expect(first.open).toBe(true);
		expect(first.moves.map((m) => m.key)).toEqual(["alpha:one"]);
	});

	it("offers Cantrips next, but never Soldier Moves or another playbook's pool", () => {
		const sections = astirMoveSections("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(sections.map((s) => s.key)).toEqual(["alpha", "cantrips", "astir-moves"]);
	});

	it("offers the dedicated Astir Moves catalog last", () => {
		const sections = astirMoveSections("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(sections.at(-1)).toEqual(
			expect.objectContaining({ key: "astir-moves", moves: expect.arrayContaining([expect.objectContaining({ key: "astir:one" })]) })
		);
	});

	it("drops a pool section once its moves are all already selected", () => {
		const sections = astirMoveSections("The Alpha", ["alpha:one"], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(sections.some((s) => s.key === "alpha")).toBe(false);
	});

	it("still offers Cantrips and the Astir catalog when the actor's playbook has no pool of its own", () => {
		const sections = astirMoveSections("The Unwritten", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(sections.map((s) => s.key)).toEqual(["cantrips", "astir-moves"]);
	});

	it("drops the Astir catalog section once its own move is already selected", () => {
		const sections = astirMoveSections("The Alpha", ["astir:one"], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);

		expect(sections.some((s) => s.key === "astir-moves")).toBe(false);
	});

	it("works against the real MOVE_POOLS/ASTIR_MOVE_CATALOG", () => {
		const sections = astirMoveSections("The Scout");

		expect(sections.map((s) => s.key)).toContain("cantrips");
		expect(sections.some((s) => s.key === "soldier")).toBe(false);
	});
});

describe("chooseAstirMove", () => {
	it("renders the playbook move picker template with the built sections", async () => {
		chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("playbook-move-picker"),
			expect.objectContaining({ sections: expect.any(Array) })
		);
	});

	it("opens the dialog with the module's own styling, sized larger than Dialog's default and resizable", async () => {
		chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({
			classes: ["armor-astir", "playbook-move-picker"],
			width: 560,
			height: 700,
			resizable: true
		});
	});

	it("resolves the checked move's key", async () => {
		const promise = chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml("cantrips:one"));

		expect(await promise).toBe("cantrips:one");
	});

	it("resolves null when nothing is selected", async () => {
		const promise = chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when cancelled", async () => {
		const promise = chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseAstirMove("The Alpha", [], FIXTURE_POOLS, FIXTURE_ASTIR_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});
});
