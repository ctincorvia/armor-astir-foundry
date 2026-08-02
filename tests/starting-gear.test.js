import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { STARTING_GEAR_POOLS, chooseStartingGear, findStartingGearPool } from "../scripts/starting-gear.js";
import { findEquipmentTag } from "../scripts/equipment.js";

// A fixture pool set independent of the real STARTING_GEAR_POOLS (currently Scout-only content),
// mirroring the injectable `pools`/`playbooks` pattern MOVE_POOLS/playbookMoveSections and
// choosePlaybook already use, so ordering/cap behavior stays covered as real content grows in.
const FIXTURE_POOLS = [
	{
		playbookName: "Fixture Playbook",
		chooseCount: 2,
		customWeaponNote: "Design a +2 total cost weapon.",
		freeformNotes: ["Any tier I weapons that feel appropriate.", "Clothes that match your look."],
		grantedItems: [{ key: "fixture:granted", name: "Granted Item", description: "g" }],
		items: [
			{ key: "fixture:alpha", name: "Alpha", description: "a" },
			{ key: "fixture:bravo", name: "Bravo", description: "b" },
			{ key: "fixture:charlie", name: "Charlie", description: "c" },
			{ key: "fixture:delta", name: "Delta", description: "d" }
		]
	},
	{ playbookName: "Fixture Empty Playbook", chooseCount: 0, grantedItems: [], items: [] }
];

// Fakes the jQuery `.find("[name='starting-gear-item']:checked").map(...).get()` chain
// chooseStartingGear uses to read the checked boxes, mirroring fakeEquipmentHtml's tag-checkbox
// branch in tests/equipment.test.js.
function fakeStartingGearHtml(checkedKeys) {
	return {
		find: () => ({
			map: (fn) => ({ get: () => checkedKeys.map((value, index) => fn(index, { value })) })
		})
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
			const keys = pool.items.map((item) => item.key);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it("prefixes every item's key with its own pool's playbook slug", () => {
		const scout = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");
		for (const item of scout.items) {
			expect(item.key.startsWith("the-scout:")).toBe(true);
		}
	});

	it("names a real Equipment tag on every item that declares one, e.g. Blades & Bracers' ward", () => {
		for (const pool of STARTING_GEAR_POOLS) {
			for (const item of pool.items.filter((i) => i.tags)) {
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
			for (const item of [...pool.grantedItems, ...pool.items].filter((i) => i.kind === "weapon")) {
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

		expect(impostor.chooseCount).toBe(2);
		expect(impostor.items.map((item) => item.key)).toEqual([
			"the-impostor:power-focus-i",
			"the-impostor:nullblade-i",
			"the-impostor:sidearm-i",
			"the-impostor:shield-broach-i"
		]);
	});

	it("gives Nullblade I the mundane tag", () => {
		const impostor = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");
		const nullblade = impostor.items.find((item) => item.key === "the-impostor:nullblade-i");

		expect(nullblade.tags).toContain("mundane");
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

	it("renders the picker template with the pool's granted/pickable items, choose count and freeform notes", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-gear-picker"), {
			grantedItems: FIXTURE_POOLS[0].grantedItems,
			items: FIXTURE_POOLS[0].items,
			chooseCount: 2,
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

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingGearHtml(["fixture:bravo", "fixture:alpha"]));

		expect(await promise).toEqual([FIXTURE_POOLS[0].items[1], FIXTURE_POOLS[0].items[0]]);
	});

	it("truncates the checked selection to the pool's chooseCount, in checkbox order", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingGearHtml(["fixture:alpha", "fixture:bravo", "fixture:charlie"])
		);

		expect(await promise).toEqual([FIXTURE_POOLS[0].items[0], FIXTURE_POOLS[0].items[1]]);
	});

	it("drops checked keys that no longer match an item in the pool", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingGearHtml(["stale-key", "fixture:alpha"]));

		expect(await promise).toEqual([FIXTURE_POOLS[0].items[0]]);
	});

	it("resolves an empty list when Add is clicked with nothing checked", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeStartingGearHtml([]));

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
