import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { MOVE_POOLS } from "../scripts/playbook-moves.js";
import {
	STARTING_MOVE_POOLS,
	chooseStartingMoves,
	findStartingMovePool,
	startingMovePickerData
} from "../scripts/starting-moves.js";

// A fixture pool set independent of the real STARTING_MOVE_POOLS, mirroring the injectable
// `pools`/`movePools` pattern playbookMoveSections/chooseStartingGear already use, so ordering/cap
// behavior stays covered as real content grows in.
const FIXTURE_MOVE_POOLS = [
	{
		key: "fixture-playbook",
		label: "Fixture Playbook",
		playbookName: "Fixture Playbook",
		moves: [
			{ key: "fixture-playbook:alpha", name: "Alpha", traits: ["clash"], description: "<p>a</p>" },
			{ key: "fixture-playbook:beta", name: "Beta", traits: [], description: "<p>b</p>" },
			{ key: "fixture-playbook:gamma", name: "Gamma", traits: [], description: "<p>c</p>" },
			{ key: "fixture-playbook:delta", name: "Delta", traits: [], description: "<p>d</p>" }
		]
	},
	{ key: "fixture-empty", label: "Fixture Empty", playbookName: "Fixture Empty Playbook", moves: [] }
];

const FIXTURE_POOLS = [
	{
		playbookName: "Fixture Playbook",
		poolKey: "fixture-playbook",
		pickOneKeys: ["fixture-playbook:alpha", "fixture-playbook:beta"],
		chooseCount: 2
	},
	{ playbookName: "Fixture Empty Playbook", poolKey: "fixture-empty", pickOneKeys: [], chooseCount: 0 }
];

// Fakes the jQuery chains chooseStartingMoves uses: `.val()` for the pickOne radio, and
// `.map(...).get()` for the checked Additional Move checkboxes — mirrors fakeStartingGearHtml/
// fakeRollHtml's selector-branching shape elsewhere in this test suite.
function fakeStartingMoveHtml(pickOneValue, additionalValues = []) {
	return {
		find: (selector) => {
			if (selector === "[name='starting-move-pick-one']:checked") {
				return { val: () => pickOneValue };
			}
			return { map: (fn) => ({ get: () => additionalValues.map((value, index) => fn(index, { value })) }) };
		}
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
});

describe("STARTING_MOVE_POOLS", () => {
	it("names a real playbook on every pool", () => {
		const playbookNames = PLAYBOOKS.map((playbook) => playbook.name);

		for (const pool of STARTING_MOVE_POOLS) {
			expect(playbookNames).toContain(pool.playbookName);
		}
	});

	it("points poolKey at a real MOVE_POOLS entry", () => {
		const poolKeys = MOVE_POOLS.map((pool) => pool.key);

		for (const pool of STARTING_MOVE_POOLS) {
			expect(poolKeys).toContain(pool.poolKey);
		}
	});

	it("names real moves within its own pool for every pickOneKeys entry", () => {
		const scout = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Scout");
		const scoutMoveKeys = MOVE_POOLS.find((pool) => pool.key === "the-scout").moves.map((move) => move.key);

		for (const key of scout.pickOneKeys) {
			expect(scoutMoveKeys).toContain(key);
		}
	});

	it("gives The Scout exactly Field Scout and Giant Slayer as its pick-one options", () => {
		const scout = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Scout");

		expect(scout.pickOneKeys).toEqual(["the-scout:field-scout", "the-scout:giant-slayer"]);
		expect(scout.chooseCount).toBe(2);
	});
});

describe("findStartingMovePool", () => {
	it("resolves a known playbook name to its pool", () => {
		expect(findStartingMovePool("Fixture Playbook", FIXTURE_POOLS)).toEqual(FIXTURE_POOLS[0]);
	});

	it("resolves an unknown playbook name to null", () => {
		expect(findStartingMovePool("Not a Real Playbook", FIXTURE_POOLS)).toBeNull();
	});

	it("defaults to the real STARTING_MOVE_POOLS", () => {
		expect(findStartingMovePool("The Scout")).toEqual(
			STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Scout")
		);
	});
});

describe("startingMovePickerData", () => {
	it("splits a pool's source moves into pickOneMoves and additionalMoves", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves.map((move) => move.key)).toEqual(["fixture-playbook:alpha", "fixture-playbook:beta"]);
		expect(data.additionalMoves.map((move) => move.key)).toEqual(["fixture-playbook:gamma", "fixture-playbook:delta"]);
		expect(data.chooseCount).toBe(2);
	});

	it("shapes each move through pickerMove, exposing trait labels", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves[0]).toEqual({
			key: "fixture-playbook:alpha",
			name: "Alpha",
			traitLabels: ["CLASH"],
			description: "<p>a</p>"
		});
	});

	it("drops a pickOneKeys entry that no longer matches a move in its source pool", () => {
		const staleKeyPool = { playbookName: "Fixture Playbook", poolKey: "fixture-playbook", pickOneKeys: ["fixture-playbook:alpha", "fixture-playbook:deleted"], chooseCount: 2 };

		const data = startingMovePickerData(staleKeyPool, FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves.map((move) => move.key)).toEqual(["fixture-playbook:alpha"]);
	});

	it("resolves to empty lists for a pool whose source pool has no moves yet", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[1], FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves).toEqual([]);
		expect(data.additionalMoves).toEqual([]);
	});

	it("resolves to empty lists when poolKey doesn't match any MOVE_POOLS entry at all", () => {
		const orphanPool = { playbookName: "Fixture Playbook", poolKey: "not-a-real-pool", pickOneKeys: [], chooseCount: 0 };

		const data = startingMovePickerData(orphanPool, FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves).toEqual([]);
		expect(data.additionalMoves).toEqual([]);
	});
});

describe("chooseStartingMoves", () => {
	it("resolves null immediately, without opening a dialog, for an unknown playbook", async () => {
		expect(await chooseStartingMoves("Not a Real Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS)).toBeNull();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("renders the picker template with the pool's pickOne/additional moves and choose count", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-move-picker"), {
			pickOneMoves: startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS).pickOneMoves,
			additionalMoves: startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS).additionalMoves,
			chooseCount: 2
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog Choose Starting Moves", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose Starting Moves");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the pickOne key plus the checked Additional Move keys when Add is clicked", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml("fixture-playbook:alpha", ["fixture-playbook:gamma", "fixture-playbook:delta"])
		);

		expect(await promise).toEqual(["fixture-playbook:alpha", "fixture-playbook:gamma", "fixture-playbook:delta"]);
	});

	it("truncates the checked Additional Move selection to chooseCount, in checkbox order", async () => {
		const morePool = [{ ...FIXTURE_POOLS[0], chooseCount: 1 }];
		const promise = chooseStartingMoves("Fixture Playbook", morePool, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml(undefined, ["fixture-playbook:gamma", "fixture-playbook:delta"])
		);

		expect(await promise).toEqual(["fixture-playbook:gamma"]);
	});

	it("drops a checked pickOne value that doesn't match a real pickOneMoves key", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingMoveHtml("stale-key", []));

		expect(await promise).toEqual([]);
	});

	it("drops checked Additional Move keys that don't match a real additionalMoves key", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingMoveHtml(undefined, ["stale-key", "fixture-playbook:gamma"]));

		expect(await promise).toEqual(["fixture-playbook:gamma"]);
	});

	it("resolves an empty list when Add is clicked with nothing checked", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingMoveHtml(undefined, []));

		expect(await promise).toEqual([]);
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("opens the dialog with the module's own styling classes", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "starting-move-picker"] });

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});
