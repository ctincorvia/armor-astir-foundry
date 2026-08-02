import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../scripts/moves.js";
import { TRAITS } from "../scripts/traits.js";
import {
	ALL_PLAYBOOK_MOVES,
	MOVE_POOLS,
	choosePlaybookMove,
	findPlaybookMove,
	playbookMoveSections,
	resolvePlaybookMoves
} from "../scripts/playbook-moves.js";

const BULLHEADED = "the-impostor:bullheaded";
// Deny is the one real Cantrip with traits/results — plays the same functional role the old
// placeholder cantrip did (rolls +CHANNEL, disabled by default for The Scout).
const DENY = "cantrips:deny";
const SCOUT_KEYS = MOVE_POOLS.find((pool) => pool.key === "the-scout").moves.map((move) => move.key);
const CANTRIP_KEYS = MOVE_POOLS.find((pool) => pool.key === "cantrips").moves.map((move) => move.key);
const SOLDIER_KEYS = MOVE_POOLS.find((pool) => pool.key === "soldier").moves.map((move) => move.key);

// Fakes the jQuery `.find("[name='playbook-move']:checked").val()` chain choosePlaybookMove uses
// to read the picked radio. `undefined` stands in for "nothing checked", which is what an empty
// jQuery set's .val() returns.
function fakePickerHtml(checkedValue) {
	return { find: () => ({ val: () => checkedValue }) };
}

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog implementation stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
});

describe("MOVE_POOLS", () => {
	it("gives every pool a key, a label and a moves array", () => {
		for (const pool of MOVE_POOLS) {
			expect(pool.key).toBeTruthy();
			expect(pool.label).toBeTruthy();
			expect(Array.isArray(pool.moves)).toBe(true);
		}
	});

	it("names a real playbook on every playbook-specific pool", () => {
		const playbookNames = PLAYBOOKS.map((playbook) => playbook.name);

		for (const pool of MOVE_POOLS.filter((p) => p.playbookName)) {
			expect(playbookNames).toContain(pool.playbookName);
		}
	});

	it("explains when each universal pool applies, since nothing enforces it in code", () => {
		for (const pool of MOVE_POOLS.filter((p) => !p.playbookName)) {
			expect(pool.note).toBeTruthy();
		}
	});

	it("prefixes every move key with its own pool's key, keeping same-named moves distinct", () => {
		for (const pool of MOVE_POOLS) {
			for (const move of pool.moves) {
				expect(move.key.startsWith(`${pool.key}:`)).toBe(true);
			}
		}
	});

	it("keeps every move key unique across basic, special and playbook moves", () => {
		const keys = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES].map((move) => move.key);

		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every playbook move the same shape the sheet expects of a basic move", () => {
		for (const move of ALL_PLAYBOOK_MOVES) {
			expect(move.name).toBeTruthy();
			expect(Array.isArray(move.traits)).toBe(true);
			expect(move.description).toBeTruthy();
			// Every trait a move can roll has to be a real, steppable stat on the sheet.
			for (const key of move.traits) {
				expect(TRAITS.some((trait) => trait.key === key)).toBe(true);
			}
		}
	});

	it("gives every uses entry a key and a label", () => {
		for (const move of ALL_PLAYBOOK_MOVES.filter((m) => m.uses)) {
			for (const use of move.uses) {
				expect(use.key).toBeTruthy();
				expect(use.label).toBeTruthy();
			}
		}
	});

	it("caps Seek Allies and Personal Familiar with their stated per-Sortie/per-Downtime uses", () => {
		const seekAllies = findPlaybookMove("cantrips:seek-allies");
		const personalFamiliar = findPlaybookMove("cantrips:personal-familiar");

		expect(seekAllies.uses.map((use) => use.key)).toEqual(["sortie"]);
		expect(personalFamiliar.uses.map((use) => use.key)).toEqual(["sortie", "downtime"]);
	});

	// PlaybookActorSheet#_onRefreshSortie reads this field to know which uses entries and flat
	// hold pools to clear — Downtime isn't a resettable button in this module, so Personal
	// Familiar's downtime use deliberately carries no period.
	it("scopes Sortie-limited uses and flat hold pools to the Sortie, leaving Downtime unscoped", () => {
		const seekAllies = findPlaybookMove("cantrips:seek-allies");
		const personalFamiliar = findPlaybookMove("cantrips:personal-familiar");
		const arityMethod = findPlaybookMove("soldier:the-arity-method");
		const getOutOfMyWay = findPlaybookMove("soldier:get-out-of-my-way");
		const onceTheWarsOver = findPlaybookMove("soldier:once-the-wars-over");

		expect(seekAllies.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(arityMethod.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(personalFamiliar.uses.find((use) => use.key === "sortie").period).toBe("Sortie");
		expect(personalFamiliar.uses.find((use) => use.key === "downtime").period).toBeUndefined();
		expect(getOutOfMyWay.period).toBe("Sortie");
		expect(onceTheWarsOver.period).toBe("Sortie");
	});

	it("scopes The Scout's own flat hold moves the same way", () => {
		const improvisation = findPlaybookMove("the-scout:improvisation");
		const pathFinding = findPlaybookMove("the-scout:path-finding");

		expect(improvisation.period).toBe("Sortie");
		expect(pathFinding.period).toBeUndefined();
	});

	it("marks Field Scout and Giant Slayer as The Scout's Starting Moves", () => {
		const fieldScout = findPlaybookMove("the-scout:field-scout");
		const giantSlayer = findPlaybookMove("the-scout:giant-slayer");

		expect(fieldScout.starting).toBe(true);
		expect(giantSlayer.starting).toBe(true);
	});
});

describe("findPlaybookMove", () => {
	it("finds a move by key across every pool", () => {
		expect(findPlaybookMove(BULLHEADED).name).toBe("Bullheaded");
		expect(findPlaybookMove(DENY).name).toBe("Deny");
	});

	it("returns null for an unknown key", () => {
		expect(findPlaybookMove("nope:not-a-move")).toBeNull();
	});
});

describe("resolvePlaybookMoves", () => {
	it("resolves stored keys to move definitions in order", () => {
		const moves = resolvePlaybookMoves([DENY, BULLHEADED]);

		expect(moves.map((move) => move.key)).toEqual([DENY, BULLHEADED]);
	});

	it("drops keys that no longer match a move, rather than yielding holes", () => {
		const moves = resolvePlaybookMoves([BULLHEADED, "the-scout:deleted-move"]);

		expect(moves.map((move) => move.key)).toEqual([BULLHEADED]);
	});

	it("defaults to an empty list when the actor has never picked anything", () => {
		expect(resolvePlaybookMoves()).toEqual([]);
	});
});

// The ordering/nesting/emptiness rules are asserted against fixtures rather than the live pools,
// so they keep testing the same thing as real move content fills MOVE_POOLS in — an assertion
// like "Other Playbooks is dropped when every other pool is empty" would silently stop covering
// that case the moment The Commander gains its first move.
const FIXTURE_POOLS = [
	{
		key: "alpha",
		label: "The Alpha",
		playbookName: "The Alpha",
		moves: [{ key: "alpha:one", name: "Alpha One", traits: ["clash"], description: "<p>a</p>" }]
	},
	{
		key: "beta",
		label: "The Beta",
		playbookName: "The Beta",
		moves: [{ key: "beta:one", name: "Beta One", traits: [], description: "<p>b</p>" }]
	},
	{ key: "gamma", label: "The Gamma", playbookName: "The Gamma", moves: [] },
	{
		key: "universal",
		label: "Universal",
		note: "Anyone may take these.",
		moves: [{ key: "universal:one", name: "Universal One", traits: ["channel"], description: "<p>u</p>" }]
	}
];

describe("playbookMoveSections", () => {
	it("puts the actor's own playbook pool first, expanded", () => {
		const [first] = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(first.key).toBe("alpha");
		expect(first.open).toBe(true);
		expect(first.note).toBe("Your playbook.");
		expect(first.moves.map((move) => move.key)).toEqual(["alpha:one"]);
	});

	it("lists the universal pools after the actor's own and the other playbooks last, collapsed", () => {
		const sections = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["alpha", "universal", "other-playbooks"]);
		expect(sections.find((section) => section.key === "universal").open).toBe(false);
	});

	it("carries a universal pool's advisory note through to the picker", () => {
		const universal = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "universal");

		expect(universal.note).toBe("Anyone may take these.");
	});

	it("nests the other playbooks' pools one level down, never the actor's own", () => {
		const others = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "other-playbooks");

		expect(others.note).toContain("rare circumstances");
		expect(others.moves).toBeUndefined();
		// Gamma is empty, so only Beta survives — an empty pool is dropped here too.
		expect(others.sections.map((section) => section.key)).toEqual(["beta"]);
	});

	it("exposes each move's rollable traits as display labels", () => {
		const [first] = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(first.moves[0].traitLabels).toEqual(["CLASH"]);
	});

	it("leaves traitLabels empty for a move that rolls nothing", () => {
		const others = playbookMoveSections("The Alpha", [], FIXTURE_POOLS)
			.find((section) => section.key === "other-playbooks");

		expect(others.sections[0].moves[0].traitLabels).toEqual([]);
	});

	it("filters out moves the actor already has, so nothing can be taken twice", () => {
		const sections = playbookMoveSections("The Alpha", ["alpha:one"], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "alpha")).toBe(false);
	});

	it("drops pools left empty once the actor's picks are filtered out", () => {
		const sections = playbookMoveSections("The Alpha", ["alpha:one", "universal:one"], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["other-playbooks"]);
	});

	it("drops the Other Playbooks section entirely when every other pool is empty", () => {
		const sections = playbookMoveSections("The Alpha", ["beta:one"], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "other-playbooks")).toBe(false);
	});

	it("still offers the universal pools when the actor's playbook has no pool of its own", () => {
		const sections = playbookMoveSections("The Unwritten", [], FIXTURE_POOLS);

		expect(sections.map((section) => section.key)).toEqual(["universal", "other-playbooks"]);
	});

	it("treats a missing playbook name the same as an unrecognised one", () => {
		const sections = playbookMoveSections(undefined, [], FIXTURE_POOLS);

		expect(sections.some((section) => section.key === "alpha")).toBe(false);
		expect(sections.find((section) => section.key === "other-playbooks").sections)
			.toHaveLength(2);
	});

	it("offers The Scout's own moves from the real pools", () => {
		const [first] = playbookMoveSections("The Scout");

		expect(first.key).toBe("the-scout");
		expect(first.moves.map((move) => move.key)).toEqual(SCOUT_KEYS);
	});

	it("offers The Impostor's Bullheaded from the real pools", () => {
		const [first] = playbookMoveSections("The Impostor");

		expect(first.key).toBe("the-impostor");
		expect(first.moves.map((move) => move.key)).toEqual([BULLHEADED]);
	});

	it("offers the real universal pools to every playbook", () => {
		const keys = playbookMoveSections("The Scout").map((section) => section.key);

		expect(keys).toContain("cantrips");
		expect(keys).toContain("soldier");
	});
});

describe("choosePlaybookMove", () => {
	it("renders the picker template with the built sections", async () => {
		choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(
			expect.stringContaining("playbook-move-picker"),
			expect.objectContaining({ sections: expect.any(Array) })
		);
	});

	it("opens the dialog with the module's own styling classes, sized larger than Dialog's default and resizable", async () => {
		choosePlaybookMove("The Scout");
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
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(BULLHEADED));

		expect(await promise).toBe(BULLHEADED);
	});

	it("resolves null when Add is clicked with nothing selected", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakePickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when cancelled", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = choosePlaybookMove("The Scout");
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("hides the moves the actor already has from the picker", async () => {
		choosePlaybookMove("The Scout", [...SCOUT_KEYS, ...CANTRIP_KEYS, ...SOLDIER_KEYS]);
		await Promise.resolve();
		await Promise.resolve();

		const { sections } = renderTemplate.mock.calls.at(-1)[1];

		expect(sections.flatMap((section) => section.moves ?? [])).toEqual([]);
	});
});
