import { beforeEach, describe, expect, it, vi } from "vitest";
import { APPROACHES } from "../scripts/approaches.js";
import { findPlaybookMove } from "../scripts/playbook-moves.js";
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
	astirMoveSections,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon,
	findAstirMove,
	findAstirPart,
	findCatalogAstirWeapon,
	resolveAstirParts
} from "../scripts/astir.js";

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
	it("gives every part a key prefixed astir-part:, the move shape, and a numeric powerCost", () => {
		for (const part of ASTIR_PART_CATALOG) {
			expect(part.key.startsWith("astir-part:")).toBe(true);
			expect(part.name).toBeTruthy();
			expect(Array.isArray(part.traits)).toBe(true);
			expect(part.description).toBeTruthy();
			expect(typeof part.powerCost).toBe("number");
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

describe("astirMaxPower", () => {
	const FIXTURE_PARTS = [
		{ key: "astir-part:a", name: "A", traits: [], description: "a", powerCost: 1 },
		{ key: "astir-part:b", name: "B", traits: [], description: "b", powerCost: 2 },
		{ key: "astir-part:no-cost", name: "C", traits: [], description: "c" }
	];

	it("starts at the base when no parts are equipped", () => {
		expect(astirMaxPower([], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("subtracts every equipped part's powerCost from the base", () => {
		expect(astirMaxPower(["astir-part:a", "astir-part:b"], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE - 3);
	});

	it("treats a missing powerCost as 0", () => {
		expect(astirMaxPower(["astir-part:no-cost"], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
	});

	it("floors at ASTIR_POWER_MIN rather than going negative", () => {
		const heavy = [
			{ key: "astir-part:heavy", name: "Heavy", traits: [], description: "h", powerCost: 99 }
		];
		expect(astirMaxPower(["astir-part:heavy"], heavy)).toBe(ASTIR_POWER_MIN);
	});

	it("ignores a stale key that no longer resolves", () => {
		expect(astirMaxPower(["astir-part:deleted"], FIXTURE_PARTS)).toBe(ASTIR_POWER_BASE);
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
