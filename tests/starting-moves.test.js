import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { MOVE_POOLS } from "../scripts/moves/playbook-moves.js";
import {
	STARTING_MOVE_POOLS,
	chooseStartingMoves,
	findStartingMovePool,
	playbookGrantsHomeInsteadOfChannel,
	startingMoveKeysByPlaybook,
	startingMovePickerData
} from "../scripts/moves/starting-moves.js";

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
		grantedKeys: ["fixture-playbook:delta"],
		pickOneKeys: ["fixture-playbook:alpha", "fixture-playbook:beta"],
		chooseCount: 2
	},
	{ playbookName: "Fixture Empty Playbook", poolKey: "fixture-empty", grantedKeys: [], pickOneKeys: [], chooseCount: 0 },
	{
		playbookName: "Fixture Granted Playbook",
		poolKey: "fixture-playbook",
		grantedKeys: ["fixture-playbook:delta"],
		pickOneKeys: [],
		chooseCount: 0
	}
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

// Fakes the jQuery `.find(selector)` chain chooseStartingMoves' own render callback uses: the bare
// `[name='starting-move-additional']` selector captures the change handler updateSaveState is
// wired to, its `:checked`-suffixed counterpart reports whatever keys the test has set in
// `additionalValues` at call time (mirroring fakeStartingMoveHtml's own reads), and
// `[data-button='add']` captures Add's own disabled/class/tooltip state, mirroring
// tests/equipment-editor.test.js's fakeEquipmentRenderHtml's `[data-button='save']` branch.
function fakeStartingMoveRenderHtml(additionalValues = []) {
	const state = {
		additionalValues,
		additionalChangeHandler: null,
		addDisabled: undefined,
		addDisabledClass: undefined,
		addGateTooltip: undefined
	};
	state.html = {
		find: (selector) => {
			if (selector === "[data-button='add']") {
				return {
					prop: (name, value) => { if (name === "disabled") state.addDisabled = value; },
					toggleClass: (cls, value) => { if (cls === "disabled") state.addDisabledClass = value; },
					attr: (attr, value) => { if (attr === "data-gate-tooltip") state.addGateTooltip = value; },
					removeAttr: (attr) => { if (attr === "data-gate-tooltip") state.addGateTooltip = undefined; }
				};
			}
			if (selector === "[name='starting-move-additional']:checked") {
				return { map: (fn) => ({ get: () => state.additionalValues.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='starting-move-additional']") {
				return { on: (event, handler) => { state.additionalChangeHandler = handler; } };
			}
			return {};
		}
	};
	return state;
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

	it("names real moves within its own pool for every grantedKeys entry", () => {
		for (const pool of STARTING_MOVE_POOLS) {
			const sourceMoveKeys = MOVE_POOLS.find((p) => p.key === pool.poolKey).moves.map((move) => move.key);
			for (const key of pool.grantedKeys) {
				expect(sourceMoveKeys).toContain(key);
			}
		}
	});

	it("grants The Impostor exactly Arcane Augments, with nothing to pick", () => {
		const impostor = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Impostor");

		expect(impostor.grantedKeys).toEqual(["the-impostor:arcane-augments"]);
		expect(impostor.pickOneKeys).toEqual([]);
		expect(impostor.chooseCount).toBe(0);
	});

	it("grants The Arcanist exactly Prepare Rituals, with nothing to pick", () => {
		const arcanist = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Arcanist");

		expect(arcanist.grantedKeys).toEqual(["the-arcanist:prepare-rituals"]);
		expect(arcanist.pickOneKeys).toEqual([]);
		expect(arcanist.chooseCount).toBe(0);
	});

	it("grants The Wither exactly Born To Die, with nothing to pick", () => {
		const wither = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Wither");

		expect(wither.grantedKeys).toEqual(["the-wither:born-to-die"]);
		expect(wither.pickOneKeys).toEqual([]);
		expect(wither.chooseCount).toBe(0);
	});

	it("grants The Adrift exactly Love, Love, Love, with nothing to pick", () => {
		const adrift = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Adrift");

		expect(adrift.grantedKeys).toEqual(["the-adrift:love-love-love"]);
		expect(adrift.pickOneKeys).toEqual([]);
		expect(adrift.chooseCount).toBe(0);
	});

	it("gives The Advocate exactly Earthly Ally and Titanic as its pick-one options, with nothing else granted", () => {
		const advocate = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Advocate");

		expect(advocate.grantedKeys).toEqual([]);
		expect(advocate.pickOneKeys).toEqual(["the-advocate:earthly-ally", "the-advocate:titanic"]);
		expect(advocate.chooseCount).toBe(0);
	});

	it("grants The Revenant exactly Never Quite Free and Unfettered, with nothing to pick", () => {
		const revenant = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Revenant");

		expect(revenant.grantedKeys).toEqual(["the-revenant:never-quite-free", "the-revenant:unfettered"]);
		expect(revenant.pickOneKeys).toEqual([]);
		expect(revenant.chooseCount).toBe(0);
	});

	it("grants The Summoner exactly Binding, with nothing to pick", () => {
		const summoner = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Summoner");

		expect(summoner.grantedKeys).toEqual(["the-summoner:binding"]);
		expect(summoner.pickOneKeys).toEqual([]);
		expect(summoner.chooseCount).toBe(0);
	});

	it("grants The Icon exactly Performance, plus 2 to choose", () => {
		const icon = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Icon");

		expect(icon.grantedKeys).toEqual(["the-icon:performance"]);
		expect(icon.pickOneKeys).toEqual([]);
		expect(icon.chooseCount).toBe(2);
	});

	it("grants The Attendant exactly Master & Servant, plus 2 to choose", () => {
		const attendant = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Attendant");

		expect(attendant.grantedKeys).toEqual(["the-attendant:master-servant"]);
		expect(attendant.pickOneKeys).toEqual([]);
		expect(attendant.chooseCount).toBe(2);
	});

	it("grants The Captain exactly In Command, plus 2 chosen from the other 8", () => {
		const captain = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Captain");

		expect(captain.grantedKeys).toEqual(["the-captain:in-command"]);
		expect(captain.pickOneKeys).toEqual([]);
		expect(captain.chooseCount).toBe(2);
	});

	it("grants The Artificer exactly Expertise, plus 2 chosen from the other 8", () => {
		const artificer = STARTING_MOVE_POOLS.find((pool) => pool.playbookName === "The Artificer");

		expect(artificer.grantedKeys).toEqual(["the-artificer:expertise"]);
		expect(artificer.pickOneKeys).toEqual([]);
		expect(artificer.chooseCount).toBe(2);
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

describe("startingMoveKeysByPlaybook", () => {
	it("unions grantedKeys and pickOneKeys into a Set, keyed by playbookName", () => {
		const keysByPlaybook = startingMoveKeysByPlaybook(FIXTURE_POOLS);

		expect(keysByPlaybook.get("Fixture Playbook")).toEqual(
			new Set(["fixture-playbook:delta", "fixture-playbook:alpha", "fixture-playbook:beta"])
		);
	});

	it("gives a chooseCount-only pool (no grantedKeys/pickOneKeys) an empty Set, not an absent entry", () => {
		const keysByPlaybook = startingMoveKeysByPlaybook(FIXTURE_POOLS);

		expect(keysByPlaybook.has("Fixture Empty Playbook")).toBe(true);
		expect(keysByPlaybook.get("Fixture Empty Playbook")).toEqual(new Set());
	});

	it("defaults to the real STARTING_MOVE_POOLS, e.g. excluding The Commander's Ace Crew and Debrief", () => {
		const keysByPlaybook = startingMoveKeysByPlaybook();

		expect(keysByPlaybook.get("The Commander")).toEqual(new Set(["the-commander:ace-crew", "the-commander:debrief"]));
	});
});

describe("playbookGrantsHomeInsteadOfChannel", () => {
	it("is true for The Adrift, whose love, love, love is flagged grantsHomeInsteadOfChannel", () => {
		expect(playbookGrantsHomeInsteadOfChannel("The Adrift")).toBe(true);
	});

	it("is false for a playbook with no grantedKeys flagged that way", () => {
		expect(playbookGrantsHomeInsteadOfChannel("The Scout")).toBe(false);
	});

	it("is false for an unknown playbook name", () => {
		expect(playbookGrantsHomeInsteadOfChannel("Not a Real Playbook", FIXTURE_POOLS)).toBe(false);
	});

	it("is false rather than throwing when the pool's own poolKey has no matching entry in movePools", () => {
		expect(playbookGrantsHomeInsteadOfChannel("Fixture Granted Playbook", FIXTURE_POOLS, [])).toBe(false);
	});
});

describe("startingMovePickerData", () => {
	it("splits a pool's source moves into grantedMoves, pickOneMoves and additionalMoves", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS);

		expect(data.grantedMoves.map((move) => move.key)).toEqual(["fixture-playbook:delta"]);
		expect(data.pickOneMoves.map((move) => move.key)).toEqual(["fixture-playbook:alpha", "fixture-playbook:beta"]);
		expect(data.additionalMoves.map((move) => move.key)).toEqual(["fixture-playbook:gamma"]);
		expect(data.chooseCount).toBe(2);
	});

	it("shapes each move through pickerMove, exposing trait labels", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves[0]).toEqual({
			key: "fixture-playbook:alpha",
			name: "Alpha",
			traitLabels: ["CLASH"],
			description: "<p>a</p>",
			disabled: false,
			tooltip: null
		});
	});

	it("resolves grantedMoves for a pool with nothing to pick, e.g. The Impostor's Arcane Augments", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[2], FIXTURE_MOVE_POOLS);

		expect(data.grantedMoves.map((move) => move.key)).toEqual(["fixture-playbook:delta"]);
		expect(data.pickOneMoves).toEqual([]);
		expect(data.additionalMoves.map((move) => move.key)).toEqual(["fixture-playbook:alpha", "fixture-playbook:beta", "fixture-playbook:gamma"]);
	});

	it("drops a pickOneKeys entry that no longer matches a move in its source pool", () => {
		const staleKeyPool = { playbookName: "Fixture Playbook", poolKey: "fixture-playbook", grantedKeys: [], pickOneKeys: ["fixture-playbook:alpha", "fixture-playbook:deleted"], chooseCount: 2 };

		const data = startingMovePickerData(staleKeyPool, FIXTURE_MOVE_POOLS);

		expect(data.pickOneMoves.map((move) => move.key)).toEqual(["fixture-playbook:alpha"]);
	});

	it("drops a grantedKeys entry that no longer matches a move in its source pool", () => {
		const staleKeyPool = { playbookName: "Fixture Playbook", poolKey: "fixture-playbook", grantedKeys: ["fixture-playbook:deleted"], pickOneKeys: [], chooseCount: 0 };

		const data = startingMovePickerData(staleKeyPool, FIXTURE_MOVE_POOLS);

		expect(data.grantedMoves).toEqual([]);
	});

	it("resolves to empty lists for a pool whose source pool has no moves yet", () => {
		const data = startingMovePickerData(FIXTURE_POOLS[1], FIXTURE_MOVE_POOLS);

		expect(data.grantedMoves).toEqual([]);
		expect(data.pickOneMoves).toEqual([]);
		expect(data.additionalMoves).toEqual([]);
	});

	it("resolves to empty lists when poolKey doesn't match any MOVE_POOLS entry at all", () => {
		const orphanPool = { playbookName: "Fixture Playbook", poolKey: "not-a-real-pool", grantedKeys: [], pickOneKeys: [], chooseCount: 0 };

		const data = startingMovePickerData(orphanPool, FIXTURE_MOVE_POOLS);

		expect(data.grantedMoves).toEqual([]);
		expect(data.pickOneMoves).toEqual([]);
		expect(data.additionalMoves).toEqual([]);
	});
});

describe("chooseStartingMoves", () => {
	it("resolves null immediately, without opening a dialog, for an unknown playbook", async () => {
		expect(await chooseStartingMoves("Not a Real Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS)).toBeNull();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("renders the picker template with the pool's granted/pickOne/additional moves and choose count", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-move-picker"), {
			grantedMoves: startingMovePickerData(FIXTURE_POOLS[0], FIXTURE_MOVE_POOLS).grantedMoves,
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

	it("starts Add enabled when the dialog first renders with nothing checked", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingMoveRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.addDisabled).toBe(false);
		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables Add and sets a gate-tooltip once more than chooseCount Additional Moves are checked", async () => {
		const morePool = [{ ...FIXTURE_POOLS[0], grantedKeys: [], chooseCount: 1 }];
		const promise = chooseStartingMoves("Fixture Playbook", morePool, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingMoveRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.additionalValues = ["fixture-playbook:gamma", "fixture-playbook:delta"];
		state.additionalChangeHandler();

		expect(state.addDisabledClass).toBe(true);
		expect(state.addGateTooltip).toBe("You can pick at most 1 Additional Move (currently 2 selected).");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-enables Add and clears the tooltip once unchecked back down within chooseCount", async () => {
		const morePool = [{ ...FIXTURE_POOLS[0], grantedKeys: [], chooseCount: 1 }];
		const promise = chooseStartingMoves("Fixture Playbook", morePool, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingMoveRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.additionalValues = ["fixture-playbook:gamma", "fixture-playbook:delta"];
		state.additionalChangeHandler();
		expect(state.addDisabledClass).toBe(true);

		state.additionalValues = ["fixture-playbook:gamma"];
		state.additionalChangeHandler();

		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the pickOne key plus the checked Additional Move keys when Add is clicked", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml("fixture-playbook:alpha", ["fixture-playbook:gamma"])
		);

		expect(await promise).toEqual(["fixture-playbook:alpha", "fixture-playbook:gamma"]);
	});

	it("does not resolve a granted move as a checked Additional Move, since it's no longer offered as one", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml(undefined, ["fixture-playbook:delta"])
		);

		expect(await promise).toEqual([]);
	});

	it("resolves null and warns when the checked Additional Move selection exceeds chooseCount", async () => {
		const morePool = [{ ...FIXTURE_POOLS[0], grantedKeys: [], chooseCount: 1 }];
		const promise = chooseStartingMoves("Fixture Playbook", morePool, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml(undefined, ["fixture-playbook:gamma", "fixture-playbook:delta"])
		);

		expect(ui.notifications.warn).toHaveBeenCalledWith(
			"You can pick at most 1 Additional Move (currently 2 selected)."
		);
		expect(await promise).toBeNull();
	});

	it("pluralizes 'Additional Moves' in the gate-tooltip message when chooseCount is greater than 1", async () => {
		const promise = chooseStartingMoves("Fixture Playbook", FIXTURE_POOLS, FIXTURE_MOVE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingMoveHtml(undefined, ["fixture-playbook:gamma", "fixture-playbook:delta", "fixture-playbook:extra"])
		);

		expect(ui.notifications.warn).toHaveBeenCalledWith(
			"You can pick at most 2 Additional Moves (currently 3 selected)."
		);
		expect(await promise).toBeNull();
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
