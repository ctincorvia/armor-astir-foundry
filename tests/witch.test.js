import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	WITCH_BOONS,
	chooseWitchBoons,
	findWitchBoon,
	pickRandomBoons,
	resolveWitchBoons
} from "../scripts/playbook/witch.js";

const FIXTURE_BOONS = [
	{ key: "witch-boon:a", name: "A", description: "a" },
	{ key: "witch-boon:b", name: "B", description: "b" },
	{ key: "witch-boon:c", name: "C", description: "c" },
	{ key: "witch-boon:d", name: "D", description: "d" }
];

// Fakes the jQuery `.find("[name='witch-boon']:checked").map(...).get()` chain the picker dialog
// uses to read the checked boxes, mirroring starting-moves.test.js's own fakeStartingMoveHtml.
function fakeWitchBoonsHtml(checkedValues = []) {
	return {
		find: () => ({ map: (fn) => ({ get: () => checkedValues.map((value, index) => fn(index, { value })) }) })
	};
}

// Fakes the jQuery `.find(selector)` chain chooseWitchBoons' own render callback uses: the bare
// `[name='witch-boon']` selector captures the change handler updateSaveState is wired to, its
// `:checked`-suffixed counterpart reports whatever keys the test has set in `checkedValues` at
// call time (mirroring fakeWitchBoonsHtml's own reads), and `[data-button='add']` captures Add's
// own disabled/class/tooltip state, mirroring tests/equipment-editor.test.js's
// fakeEquipmentRenderHtml's `[data-button='save']` branch.
function fakeWitchBoonsRenderHtml(checkedValues = []) {
	const state = {
		checkedValues,
		changeHandler: null,
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
			if (selector === "[name='witch-boon']:checked") {
				return { map: (fn) => ({ get: () => state.checkedValues.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='witch-boon']") {
				return { on: (event, handler) => { state.changeHandler = handler; } };
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

describe("WITCH_BOONS", () => {
	it("has exactly 6 boons, each with a key, name and description", () => {
		expect(WITCH_BOONS).toHaveLength(6);
		for (const boon of WITCH_BOONS) {
			expect(boon.key).toBeTruthy();
			expect(boon.name).toBeTruthy();
			expect(boon.description).toBeTruthy();
		}
	});

	it("namespaces every key witch-boon:...", () => {
		for (const boon of WITCH_BOONS) {
			expect(boon.key.startsWith("witch-boon:")).toBe(true);
		}
	});

	it("gives every boon a traits array, even one with no roll of its own", () => {
		for (const boon of WITCH_BOONS) {
			expect(Array.isArray(boon.traits)).toBe(true);
		}
	});

	it("gives Masking Boon a +CHANNEL roll with success/mixed/failure results", () => {
		const masking = findWitchBoon("witch-boon:masking");
		expect(masking.traits).toEqual(["channel"]);
		expect(masking.results).toEqual({
			success: "You are disguised or cloaked in a fashion appropriate to your patron.",
			mixed: "The Director will tell you a flaw with your disguise.",
			failure: null
		});
	});

	it("flags Trickster's Boon to show a roll rider on every move and activate on doubles", () => {
		const tricksters = findWitchBoon("witch-boon:tricksters");
		expect(tricksters.traits).toEqual([]);
		expect(tricksters.showsRollRiderOnAllRolls).toBe(true);
		expect(tricksters.activatesOnDoubles).toBe(true);
	});
});

describe("findWitchBoon/resolveWitchBoons", () => {
	it("finds a boon by key", () => {
		expect(findWitchBoon("witch-boon:a", FIXTURE_BOONS).name).toBe("A");
	});

	it("returns null for an unknown key", () => {
		expect(findWitchBoon("witch-boon:nope", FIXTURE_BOONS)).toBeNull();
	});

	it("resolves stored keys to boon definitions in order", () => {
		const boons = resolveWitchBoons(["witch-boon:b", "witch-boon:a"], FIXTURE_BOONS);
		expect(boons.map((b) => b.key)).toEqual(["witch-boon:b", "witch-boon:a"]);
	});

	it("drops a key that no longer resolves, rather than yielding a hole", () => {
		const boons = resolveWitchBoons(["witch-boon:a", "witch-boon:deleted"], FIXTURE_BOONS);
		expect(boons.map((b) => b.key)).toEqual(["witch-boon:a"]);
	});

	it("defaults to an empty list when no keys are given", () => {
		expect(resolveWitchBoons()).toEqual([]);
	});
});

describe("pickRandomBoons", () => {
	it("picks `count` boon keys from the catalog", () => {
		const keys = pickRandomBoons(FIXTURE_BOONS, 2, [], () => 0);
		expect(keys).toHaveLength(2);
	});

	it("is deterministic given a fixed random sequence", () => {
		// random() always 0 -> always picks the first remaining entry, so with nothing held this
		// always picks the catalog's own first two keys in order.
		const keys = pickRandomBoons(FIXTURE_BOONS, 2, [], () => 0);
		expect(keys).toEqual(["witch-boon:a", "witch-boon:b"]);
	});

	it("never returns a duplicate key within one grant", () => {
		const keys = pickRandomBoons(FIXTURE_BOONS, 4, [], () => 0);
		expect(new Set(keys).size).toBe(4);
	});

	it("prefers boons not currently held", () => {
		const keys = pickRandomBoons(FIXTURE_BOONS, 2, ["witch-boon:a", "witch-boon:b"], () => 0);
		expect(keys).toEqual(["witch-boon:c", "witch-boon:d"]);
	});

	it("falls back to the full catalog once there aren't enough un-held boons to fill the grant", () => {
		// Only witch-boon:d is un-held; count 2 can't be filled from a 1-entry pool, so this falls
		// back to drawing from the whole catalog (including already-held boons).
		const keys = pickRandomBoons(FIXTURE_BOONS, 2, ["witch-boon:a", "witch-boon:b", "witch-boon:c"], () => 0);
		expect(keys).toEqual(["witch-boon:a", "witch-boon:b"]);
	});

	it("returns fewer than count when the catalog itself is smaller than count", () => {
		const keys = pickRandomBoons(FIXTURE_BOONS.slice(0, 1), 2, [], () => 0);
		expect(keys).toEqual(["witch-boon:a"]);
	});
});

describe("chooseWitchBoons", () => {
	it("renders the picker template with every boon flagged held/unheld, and the choose count", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, ["witch-boon:a"]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("witch-boons-picker"), {
			boons: [
				{ ...FIXTURE_BOONS[0], held: true },
				{ ...FIXTURE_BOONS[1], held: false },
				{ ...FIXTURE_BOONS[2], held: false },
				{ ...FIXTURE_BOONS[3], held: false }
			],
			count: 2
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog Choose Boons", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose Boons");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the checked keys, in checkbox order", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeWitchBoonsHtml(["witch-boon:b", "witch-boon:a"]));

		expect(await promise).toEqual(["witch-boon:b", "witch-boon:a"]);
	});

	it("resolves null and warns when the checked selection exceeds count", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeWitchBoonsHtml(["witch-boon:a", "witch-boon:b", "witch-boon:c"])
		);

		expect(ui.notifications.warn).toHaveBeenCalledWith("You can choose at most 2 Boons (currently 3 selected).");
		expect(await promise).toBeNull();
	});

	it("uses the singular 'Boon' in the gate-tooltip message when count is 1", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 1, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeWitchBoonsHtml(["witch-boon:a", "witch-boon:b"])
		);

		expect(ui.notifications.warn).toHaveBeenCalledWith("You can choose at most 1 Boon (currently 2 selected).");
		expect(await promise).toBeNull();
	});

	it("starts Choose enabled when the dialog first renders with nothing checked", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeWitchBoonsRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.addDisabled).toBe(false);
		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables Choose and sets a gate-tooltip once more than count boons are checked", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeWitchBoonsRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedValues = ["witch-boon:a", "witch-boon:b", "witch-boon:c"];
		state.changeHandler();

		expect(state.addDisabledClass).toBe(true);
		expect(state.addGateTooltip).toBe("You can choose at most 2 Boons (currently 3 selected).");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-enables Choose and clears the tooltip once unchecked back down within count", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeWitchBoonsRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedValues = ["witch-boon:a", "witch-boon:b", "witch-boon:c"];
		state.changeHandler();
		expect(state.addDisabledClass).toBe(true);

		state.checkedValues = ["witch-boon:a", "witch-boon:b"];
		state.changeHandler();

		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("drops a checked value that doesn't match a real catalog key", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeWitchBoonsHtml(["stale-key", "witch-boon:a"]));

		expect(await promise).toEqual(["witch-boon:a"]);
	});

	it("resolves an empty list when Choose is clicked with nothing checked", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeWitchBoonsHtml([]));

		expect(await promise).toEqual([]);
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("opens the dialog with the module's own styling classes", async () => {
		const promise = chooseWitchBoons(FIXTURE_BOONS, 2, []);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "witch-boons-picker"] });

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});
