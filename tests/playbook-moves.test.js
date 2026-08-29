import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	MOVE_POOLS,
	choosePlaybookMove,
	findPlaybookMove,
	moveRequirementTooltip,
	pickerMove,
	pickerSection,
	playbookMoveSections,
	resolvePlaybookMoves,
	unmetMoveRequirements
} from "../scripts/moves/playbook-moves.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { startingMoveKeysByPlaybook } from "../scripts/moves/starting-moves.js";
import { applyCustomContent, resetCustomContent } from "../scripts/custom-content/custom-content-apply.js";

const BULLHEADED = "the-impostor:bullheaded";
// Deny is the one real Cantrip with traits/results — plays the same functional role the old
// placeholder cantrip did (rolls +CHANNEL, disabled by default for The Scout).
const DENY = "cantrips:deny";
const SCOUT_KEYS = MOVE_POOLS.find((pool) => pool.key === "the-scout").moves.map((move) => move.key);
const IMPOSTOR_KEYS = MOVE_POOLS.find((pool) => pool.key === "the-impostor").moves.map((move) => move.key);
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

describe("unmetMoveRequirements", () => {
	it("returns every requiresMoves key not among the picked keys", () => {
		const move = { key: "a", requiresMoves: ["b"] };
		expect(unmetMoveRequirements(move, [])).toEqual(["b"]);
	});

	it("returns an empty list once every required key is picked", () => {
		const move = { key: "a", requiresMoves: ["b"] };
		expect(unmetMoveRequirements(move, ["b"])).toEqual([]);
	});

	it("returns an empty list for a move with no requiresMoves at all", () => {
		expect(unmetMoveRequirements({ key: "a" })).toEqual([]);
	});

	it("only reports the keys that are actually missing", () => {
		const move = { key: "a", requiresMoves: ["b", "c"] };
		expect(unmetMoveRequirements(move, ["b"])).toEqual(["c"]);
	});

	it("resolves against the real content: You Should See Me In A Crown requires Touchstone", () => {
		const move = findPlaybookMove("the-icon:you-should-see-me-in-a-crown");
		expect(unmetMoveRequirements(move, [])).toEqual(["the-icon:touchstone"]);
		expect(unmetMoveRequirements(move, ["the-icon:touchstone"])).toEqual([]);
	});
});

describe("moveRequirementTooltip", () => {
	it("returns null when nothing is missing", () => {
		expect(moveRequirementTooltip([])).toBeNull();
	});

	it("names a single missing move by its real display name", () => {
		expect(moveRequirementTooltip(["the-icon:touchstone"])).toBe("Requires Touchstone");
	});

	it("joins multiple missing moves, falling back to the raw key for a stale reference", () => {
		expect(moveRequirementTooltip(["the-icon:touchstone", "not-a-real-key"]))
			.toBe("Requires Touchstone, not-a-real-key");
	});
});

describe("pickerMove", () => {
	const REQUIRES = { key: "needs-b", name: "Needs B", traits: [], description: "<p>d</p>", requiresMoves: ["b"] };
	const FREE = { key: "free", name: "Free", traits: [], description: "<p>d</p>" };

	it("stays visible but disabled, with a tooltip, when its requiresMoves isn't met", () => {
		const result = pickerMove(REQUIRES, []);

		expect(result.key).toBe("needs-b");
		expect(result.disabled).toBe(true);
		expect(result.tooltip).toBe("Requires b");
	});

	it("is enabled with a null tooltip once requiresMoves is satisfied", () => {
		const result = pickerMove(REQUIRES, ["b"]);

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});

	it("is enabled by default for a move with no requiresMoves and no extraTooltip", () => {
		const result = pickerMove(FREE, []);

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});

	it("folds an extraTooltip callback's result in even when requiresMoves is already met", () => {
		const result = pickerMove(FREE, [], { extraTooltip: () => "Requires Foo Astir Part" });

		expect(result.disabled).toBe(true);
		expect(result.tooltip).toBe("Requires Foo Astir Part");
	});

	it("combines a requiresMoves tooltip with an extraTooltip result", () => {
		const result = pickerMove(REQUIRES, [], { extraTooltip: () => "Requires Foo Astir Part" });

		expect(result.tooltip).toBe("Requires b; Requires Foo Astir Part");
	});

	it("ignores an extraTooltip callback that returns nothing", () => {
		const result = pickerMove(FREE, [], { extraTooltip: () => null });

		expect(result.disabled).toBe(false);
		expect(result.tooltip).toBeNull();
	});
});

describe("pickerSection", () => {
	const POOL = {
		key: "pool",
		label: "Pool",
		moves: [
			{ key: "needs-b", name: "Needs B", traits: [], description: "<p>d</p>", requiresMoves: ["b"] },
			{ key: "free", name: "Free", traits: [], description: "<p>d</p>" }
		]
	};

	it("keeps a move with unmet requiresMoves in the list, disabled, rather than filtering it out", () => {
		const section = pickerSection(POOL, []);

		expect(section.moves.map((m) => m.key)).toEqual(["needs-b", "free"]);
		expect(section.moves.find((m) => m.key === "needs-b").disabled).toBe(true);
		expect(section.moves.find((m) => m.key === "free").disabled).toBe(false);
	});

	it("threads extraTooltip through to every move in the section", () => {
		const section = pickerSection(POOL, [], { extraTooltip: () => "Gated" });

		expect(section.moves.find((m) => m.key === "free").tooltip).toBe("Gated");
		expect(section.moves.find((m) => m.key === "needs-b").tooltip).toBe("Requires b; Gated");
	});

	it("drops a move named in excludeKeys, alongside the selected/exclusiveGroup filtering", () => {
		const section = pickerSection(POOL, [], { excludeKeys: new Set(["needs-b"]) });

		expect(section.moves.map((m) => m.key)).toEqual(["free"]);
	});

	it("behaves exactly as before when excludeKeys is omitted", () => {
		const section = pickerSection(POOL, []);

		expect(section.moves.map((m) => m.key)).toEqual(["needs-b", "free"]);
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
	it("puts the actor's own playbook pool first, collapsed", () => {
		const [first] = playbookMoveSections("The Alpha", [], FIXTURE_POOLS);

		expect(first.key).toBe("alpha");
		expect(first.open).toBe(false);
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

	it("offers The Impostor's own moves from the real pools", () => {
		const [first] = playbookMoveSections("The Impostor");

		expect(first.key).toBe("the-impostor");
		expect(first.moves.map((move) => move.key)).toEqual(IMPOSTOR_KEYS);
		expect(first.moves.map((move) => move.key)).toContain(BULLHEADED);
	});

	it("offers the real universal pools to every playbook", () => {
		const keys = playbookMoveSections("The Scout").map((section) => section.key);

		expect(keys).toContain("cantrips");
		expect(keys).toContain("soldier");
	});

	// Field Scout/Giant Slayer share an exclusiveGroup (see playbook-moves.js#pickerSection) — once
	// one is picked, the other must never be offered by any picker drawing from this pool.
	it("excludes Giant Slayer once Field Scout is already picked, via their shared exclusiveGroup", () => {
		const [scout] = playbookMoveSections("The Scout", ["the-scout:field-scout"]);
		const keys = scout.moves.map((move) => move.key);

		expect(keys).not.toContain("the-scout:giant-slayer");
		// An unrelated move from the same pool is unaffected by the exclusion.
		expect(keys).toContain("the-scout:team-player");
	});

	it("excludes Field Scout once Giant Slayer is already picked", () => {
		const [scout] = playbookMoveSections("The Scout", ["the-scout:giant-slayer"]);

		expect(scout.moves.map((move) => move.key)).not.toContain("the-scout:field-scout");
	});

	it("offers both Field Scout and Giant Slayer when neither is picked yet", () => {
		const [scout] = playbookMoveSections("The Scout", []);
		const keys = scout.moves.map((move) => move.key);

		expect(keys).toContain("the-scout:field-scout");
		expect(keys).toContain("the-scout:giant-slayer");
	});

	// Same shape for The Advocate's Earthly Ally/Titanic pair.
	it("excludes Titanic once Earthly Ally is already picked, via their shared exclusiveGroup", () => {
		const [advocate] = playbookMoveSections("The Advocate", ["the-advocate:earthly-ally"]);
		const keys = advocate.moves.map((move) => move.key);

		expect(keys).not.toContain("the-advocate:titanic");
		expect(keys).toContain("the-advocate:woodland-whispers");
	});

	it("offers both Earthly Ally and Titanic when neither is picked yet", () => {
		const [advocate] = playbookMoveSections("The Advocate", []);
		const keys = advocate.moves.map((move) => move.key);

		expect(keys).toContain("the-advocate:earthly-ally");
		expect(keys).toContain("the-advocate:titanic");
	});

	// You Should See Me In A Crown's real requiresMoves: ["the-icon:touchstone"] — stays offered
	// (visible but disabled) rather than filtered, until Touchstone is also picked.
	it("disables (but still offers) a move whose real requiresMoves isn't met", () => {
		const [icon] = playbookMoveSections("The Icon");
		const crown = icon.moves.find((move) => move.key === "the-icon:you-should-see-me-in-a-crown");

		expect(crown.disabled).toBe(true);
		expect(crown.tooltip).toBe("Requires Touchstone");
	});

	it("enables that same move once its prerequisite is among the picked keys", () => {
		const [icon] = playbookMoveSections("The Icon", ["the-icon:touchstone"]);
		const crown = icon.moves.find((move) => move.key === "the-icon:you-should-see-me-in-a-crown");

		expect(crown.disabled).toBe(false);
		expect(crown.tooltip).toBeNull();
	});
});

// Extends FIXTURE_POOLS' Beta pool with a second move, so the startingMoveKeys exclusion tests
// below can assert one move is dropped while an unrelated move in the same pool still appears —
// kept as its own fixture array so it doesn't disturb FIXTURE_POOLS' existing emptiness-by-
// selection tests above (which rely on Beta having exactly one move).
const STARTING_MOVE_KEYS_FIXTURE_POOLS = FIXTURE_POOLS.map((pool) =>
	pool.key === "beta"
		? { ...pool, moves: [...pool.moves, { key: "beta:two", name: "Beta Two", traits: [], description: "<p>b2</p>" }] }
		: pool
);

describe("playbookMoveSections - startingMoveKeys", () => {
	it("excludes a fixture playbook's own starting-move key from its listing under Other Playbooks", () => {
		const startingMoveKeys = new Map([["The Beta", new Set(["beta:one"])]]);
		const sections = playbookMoveSections("The Alpha", [], STARTING_MOVE_KEYS_FIXTURE_POOLS, startingMoveKeys);
		const beta = sections.find((section) => section.key === "other-playbooks")
			.sections.find((section) => section.key === "beta");

		expect(beta.moves.map((move) => move.key)).not.toContain("beta:one");
	});

	it("still offers an ordinary (non-excluded) move from that same pool", () => {
		const startingMoveKeys = new Map([["The Beta", new Set(["beta:one"])]]);
		const sections = playbookMoveSections("The Alpha", [], STARTING_MOVE_KEYS_FIXTURE_POOLS, startingMoveKeys);
		const beta = sections.find((section) => section.key === "other-playbooks")
			.sections.find((section) => section.key === "beta");

		expect(beta.moves.map((move) => move.key)).toContain("beta:two");
	});

	it("leaves the actor's own pool section unaffected even when the map contains that playbook's own key", () => {
		const startingMoveKeys = new Map([["The Alpha", new Set(["alpha:one"])]]);
		const [own] = playbookMoveSections("The Alpha", [], STARTING_MOVE_KEYS_FIXTURE_POOLS, startingMoveKeys);

		expect(own.key).toBe("alpha");
		expect(own.moves.map((move) => move.key)).toEqual(["alpha:one"]);
	});

	it("reproduces today's exact output on the existing fixtures when the fourth param is omitted", () => {
		const withDefault = playbookMoveSections("The Alpha", [], STARTING_MOVE_KEYS_FIXTURE_POOLS);
		const withEmptyMap = playbookMoveSections("The Alpha", [], STARTING_MOVE_KEYS_FIXTURE_POOLS, new Map());

		expect(withDefault).toEqual(withEmptyMap);
	});
});

describe("playbookMoveSections - customMoves", () => {
	it("does not render a Custom Moves section at all when the custom-move fixture is empty", () => {
		const sections = playbookMoveSections("The Alpha", [], FIXTURE_POOLS, new Map(), []);

		expect(sections.some((section) => section.key === "custom-moves")).toBe(false);
	});

	it("renders a labeled Custom Moves section containing the expected moves when non-empty", () => {
		const customMoves = [{ key: "custom:one", name: "Custom One", traits: [], description: "<p>c1</p>" }];
		const sections = playbookMoveSections("The Alpha", [], FIXTURE_POOLS, new Map(), customMoves);
		const custom = sections.find((section) => section.key === "custom-moves");

		expect(custom).toBeDefined();
		expect(custom.label).toBe("Custom Moves");
		expect(custom.moves.map((move) => move.key)).toEqual(["custom:one"]);
	});

	it("filters out a custom move already in selectedKeys", () => {
		const customMoves = [{ key: "custom:one", name: "Custom One", traits: [], description: "<p>c1</p>" }];
		const sections = playbookMoveSections("The Alpha", ["custom:one"], FIXTURE_POOLS, new Map(), customMoves);

		expect(sections.some((section) => section.key === "custom-moves")).toBe(false);
	});

	// selectedExclusiveGroups (playbook-moves.js) resolves a selected key's own exclusiveGroup via
	// findPlaybookMove, which reads the real ALL_PLAYBOOK_MOVES catalog rather than whatever fixture
	// is passed as customMoves — so exercising the exclusion for real requires actually registering
	// the custom moves through applyCustomContent (which does push into ALL_PLAYBOOK_MOVES), not just
	// passing a bare fixture array. A bare fixture would make excludedGroups always empty, silently
	// passing this assertion for the wrong reason (plain selectedKeys filtering alone).
	describe("exclusiveGroup exclusion, via real custom-content registration", () => {
		afterEach(() => {
			resetCustomContent();
		});

		it("excludes a custom move whose own exclusiveGroup is already covered by a different selected custom move", () => {
			applyCustomContent({
				moves: [
					{ key: "custom:group-a", name: "Group A", traits: [], description: "a", exclusiveGroup: "custom-group" },
					{ key: "custom:group-b", name: "Group B", traits: [], description: "b", exclusiveGroup: "custom-group" },
					{ key: "custom:unrelated", name: "Unrelated", traits: [], description: "u" }
				]
			});

			const sections = playbookMoveSections("The Alpha", ["custom:group-a"], FIXTURE_POOLS);
			const custom = sections.find((section) => section.key === "custom-moves");
			const keys = custom.moves.map((move) => move.key);

			expect(keys).not.toContain("custom:group-a");
			expect(keys).not.toContain("custom:group-b");
			// An unrelated custom move from the same catalog is unaffected by the exclusion.
			expect(keys).toContain("custom:unrelated");
		});
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

	it("excludes The Commander's Ace Crew/Debrief starting moves from a Scout's Other Playbooks section, while an ordinary Commander move still appears", async () => {
		choosePlaybookMove("The Scout", [], startingMoveKeysByPlaybook());
		await Promise.resolve();
		await Promise.resolve();

		const { sections } = renderTemplate.mock.calls.at(-1)[1];
		const commander = sections.find((section) => section.key === "other-playbooks")
			.sections.find((section) => section.key === "the-commander");

		const keys = commander.moves.map((move) => move.key);
		expect(keys).not.toContain("the-commander:ace-crew");
		expect(keys).not.toContain("the-commander:debrief");
		expect(keys).toContain("the-commander:withdraw");
	});
});

// grantsRollModifier lives on playbook moves, Astir Moves and Astir Parts alike (see
// astir-moves.js's own §1 doc comment) — scanned across ALL_MOVES, not just ALL_PLAYBOOK_MOVES, so
// this also catches Manawheels/Branded Blades/Goliath Shield (astir-moves.js) and Alchemical Suite
// (astir-parts.js). Mirrors equipment-tags.test.js's own "every reroll.moves key resolves to a
// real move" assertion for the identical reason: PlaybookActorSheet#_rollModifiersForMove trusts
// every moveKeys entry to resolve via ALL_MOVES with no stale-key fallback.
describe("grantsRollModifier", () => {
	it("resolves every moveKeys entry, across every catalog, to a real ALL_MOVES key", () => {
		const sources = ALL_MOVES.filter((move) => move.grantsRollModifier);
		expect(sources.length).toBeGreaterThan(0);

		for (const source of sources) {
			for (const spec of source.grantsRollModifier) {
				if (!spec.moveKeys) continue;
				for (const moveKey of spec.moveKeys) {
					expect(ALL_MOVES.some((move) => move.key === moveKey)).toBe(true);
				}
			}
		}
	});

	it("gives Alchemical Suite's two grantsRollModifier specs their own unique, truthy keys", () => {
		const alchemicalSuite = ALL_MOVES.find((move) => move.key === "astir-part:alchemical-suite");
		const keys = alchemicalSuite.grantsRollModifier.map((spec) => spec.key);

		expect(keys.every(Boolean)).toBe(true);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
