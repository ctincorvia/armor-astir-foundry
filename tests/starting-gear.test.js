import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { STARTING_GEAR_POOLS, chooseStartingGear, findStartingGearPool } from "../scripts/equipment/starting-gear.js";
import { findEquipmentTag } from "../scripts/equipment/equipment.js";

// A fixture pool set independent of the real STARTING_GEAR_POOLS (currently Scout/Impostor
// content), mirroring the injectable `pools`/`playbooks` pattern MOVE_POOLS/playbookMoveSections
// and choosePlaybook already use, so ordering/cap behavior stays covered as real content grows in.
// Two groups (rather than one) so cross-group independence — e.g. The Diplomat's separate 1-weapon
// and 3-gear budgets — has real fixture coverage rather than only being exercised by hand-checked
// production data.
const FIXTURE_POOLS = [
	{
		playbookName: "Fixture Playbook",
		customWeaponNote: "Design a +2 total cost weapon.",
		freeformNotes: ["Any tier I weapons that feel appropriate.", "Clothes that match your look."],
		grantedItems: [{ key: "fixture:granted", name: "Granted Item", description: "g" }],
		groups: [
			{
				key: "fixture:group-a",
				label: "Choose 2.",
				chooseCount: 2,
				items: [
					{ key: "fixture:alpha", name: "Alpha", description: "a" },
					{ key: "fixture:bravo", name: "Bravo", description: "b" },
					{ key: "fixture:charlie", name: "Charlie", description: "c" },
					{ key: "fixture:delta", name: "Delta", description: "d" }
				]
			},
			{
				key: "fixture:group-b",
				label: "Choose 1.",
				chooseCount: 1,
				items: [
					{ key: "fixture:echo", name: "Echo", description: "e" },
					{ key: "fixture:foxtrot", name: "Foxtrot", description: "f" }
				]
			}
		]
	},
	{ playbookName: "Fixture Empty Playbook", grantedItems: [], groups: [] }
];

// Fakes the jQuery `.find("[name='starting-gear-item-<groupKey>']:checked").map(...).get()` chain
// chooseStartingGear uses to read each group's checked boxes, mirroring fakeEquipmentHtml's
// tag-checkbox branch in tests/equipment.test.js. `checkedByGroupKey` maps a group key to the
// checked values that group's selector should resolve to (missing keys resolve to none checked).
function fakeStartingGearHtml(checkedByGroupKey) {
	return {
		find: (selector) => {
			const groupKey = /name='starting-gear-item-(.+)'/.exec(selector)[1];
			const checkedKeys = checkedByGroupKey[groupKey] ?? [];
			return { map: (fn) => ({ get: () => checkedKeys.map((value, index) => fn(index, { value })) }) };
		}
	};
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

describe("STARTING_GEAR_POOLS", () => {
	it("names a real playbook on every pool", () => {
		const playbookNames = PLAYBOOKS.map((playbook) => playbook.name);

		for (const pool of STARTING_GEAR_POOLS) {
			expect(playbookNames).toContain(pool.playbookName);
		}
	});

	it("gives every item within a pool a unique key", () => {
		for (const pool of STARTING_GEAR_POOLS) {
			const keys = pool.groups.flatMap((group) => group.items.map((item) => item.key));
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it("prefixes every item's key with its own pool's playbook slug", () => {
		const scout = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");
		for (const group of scout.groups) {
			for (const item of group.items) {
				expect(item.key.startsWith("the-scout:")).toBe(true);
			}
		}
	});

	it("names a real Equipment tag on every item that declares one, e.g. Blades & Bracers' ward", () => {
		for (const pool of STARTING_GEAR_POOLS) {
			for (const item of pool.groups.flatMap((group) => group.items).filter((i) => i.tags)) {
				for (const tagKey of item.tags) {
					expect(findEquipmentTag(tagKey)).toBeTruthy();
				}
			}
		}
	});

	it("names a real Equipment tag on every granted item too", () => {
		for (const pool of STARTING_GEAR_POOLS) {
			for (const item of pool.grantedItems.filter((i) => i.tags)) {
				for (const tagKey of item.tags) {
					expect(findEquipmentTag(tagKey)).toBeTruthy();
				}
			}
		}
	});

	it("gives every weapon-kind item (granted or pickable) one of the Melee/Ranged/Sniper tags", () => {
		for (const pool of STARTING_GEAR_POOLS) {
			const allItems = [...pool.grantedItems, ...pool.groups.flatMap((group) => group.items)];
			for (const item of allItems.filter((i) => i.kind === "weapon")) {
				expect(item.tags.some((key) => ["melee", "ranged", "sniper"].includes(key))).toBe(true);
			}
		}
	});

	it("grants The Impostor exactly Augments I, a melee/bane weapon", () => {
		const impostor = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");

		expect(impostor.grantedItems).toHaveLength(1);
		expect(impostor.grantedItems[0]).toMatchObject({
			key: "the-impostor:augments-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Impostor 2 of 4 Impostor Gear items to choose from", () => {
		const impostor = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");

		expect(impostor.groups).toHaveLength(1);
		expect(impostor.groups[0].chooseCount).toBe(2);
		expect(impostor.groups[0].items.map((item) => item.key)).toEqual([
			"the-impostor:power-focus-i",
			"the-impostor:nullblade-i",
			"the-impostor:sidearm-i",
			"the-impostor:shield-broach-i"
		]);
	});

	it("gives Nullblade I the mundane tag", () => {
		const impostor = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");
		const nullblade = impostor.groups[0].items.find((item) => item.key === "the-impostor:nullblade-i");

		expect(nullblade.tags).toContain("mundane");
	});

	it("gives The Diplomat 1 Diplomacy 'Tool' weapon and 3 'Diplomacy' Tools as independent budgets", () => {
		const diplomat = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Diplomat");

		expect(diplomat.groups).toHaveLength(2);
		const [tools, gear] = diplomat.groups;
		expect(tools.chooseCount).toBe(1);
		expect(tools.items.every((item) => item.kind === "weapon")).toBe(true);
		expect(gear.chooseCount).toBe(3);
		expect(gear.items.every((item) => item.kind === undefined)).toBe(true);
	});
});

describe("findStartingGearPool", () => {
	it("resolves a known playbook name to its pool", () => {
		expect(findStartingGearPool("Fixture Playbook", FIXTURE_POOLS)).toEqual(FIXTURE_POOLS[0]);
	});

	it("resolves an unknown playbook name to null", () => {
		expect(findStartingGearPool("Not a Real Playbook", FIXTURE_POOLS)).toBeNull();
	});

	it("defaults to the real STARTING_GEAR_POOLS", () => {
		expect(findStartingGearPool("The Scout")).toEqual(
			STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout")
		);
	});
});

describe("chooseStartingGear", () => {
	it("resolves null immediately, without opening a dialog, for an unknown playbook", async () => {
		expect(await chooseStartingGear("Not a Real Playbook", FIXTURE_POOLS)).toBeNull();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("renders the picker template with the pool's granted items, groups and freeform notes", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-gear-picker"), {
			grantedItems: FIXTURE_POOLS[0].grantedItems,
			groups: FIXTURE_POOLS[0].groups,
			freeformNotes: FIXTURE_POOLS[0].freeformNotes
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults freeformNotes to an empty list when the pool doesn't define any", async () => {
		const promise = chooseStartingGear("Fixture Empty Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-gear-picker"), expect.objectContaining({
			freeformNotes: []
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog Choose Starting Gear", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose Starting Gear");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the picked items' full definitions when Add is clicked", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingGearHtml({ "fixture:group-a": ["fixture:bravo", "fixture:alpha"] })
		);

		const [groupA] = FIXTURE_POOLS[0].groups;
		expect(await promise).toEqual([groupA.items[1], groupA.items[0]]);
	});

	it("truncates each group's checked selection to its own chooseCount, in checkbox order", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingGearHtml({ "fixture:group-a": ["fixture:alpha", "fixture:bravo", "fixture:charlie"] })
		);

		const [groupA] = FIXTURE_POOLS[0].groups;
		expect(await promise).toEqual([groupA.items[0], groupA.items[1]]);
	});

	it("clamps each group independently, so one group's cap never eats into another's budget", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingGearHtml({
			"fixture:group-a": ["fixture:alpha", "fixture:bravo"],
			"fixture:group-b": ["fixture:echo"]
		}));

		const [groupA, groupB] = FIXTURE_POOLS[0].groups;
		expect(await promise).toEqual([groupA.items[0], groupA.items[1], groupB.items[0]]);
	});

	it("drops checked keys that no longer match an item in that group", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingGearHtml({ "fixture:group-a": ["stale-key", "fixture:alpha"] })
		);

		expect(await promise).toEqual([FIXTURE_POOLS[0].groups[0].items[0]]);
	});

	it("resolves an empty list when Add is clicked with nothing checked", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingGearHtml({}));

		expect(await promise).toEqual([]);
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});
});
