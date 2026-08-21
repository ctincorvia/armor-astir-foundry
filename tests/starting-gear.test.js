import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOKS } from "../scripts/actor-creation.js";
import {
	CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
	DEFAULT_CUSTOM_WEAPON_MAX_VALUE,
	STARTING_GEAR_POOLS,
	chooseStartingGear,
	findStartingGearPool
} from "../scripts/equipment/starting-gear.js";
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

// A separate, minimal fixture pool (not the shared FIXTURE_POOLS above, whose exact item
// positions/counts other tests key off for chooseCount clamping) carrying a real EQUIPMENT_TAGS
// key, so buildTagReference's hasTags: true branch gets real coverage.
const FIXTURE_TAGGED_POOLS = [
	{
		playbookName: "Fixture Tagged Playbook",
		grantedItems: [{ key: "fixture-tagged:granted", name: "Granted Blade", description: "g", kind: "weapon", tags: ["melee"] }],
		groups: []
	}
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

// Fakes the jQuery `.find(selector)` chain chooseStartingGear's own render callback uses: each
// group's bare `[name='starting-gear-item-<groupKey>']` selector captures the change handler
// updateSaveState is wired to, its `:checked`-suffixed counterpart reports whatever keys the test
// has set in `checkedByGroupKey` at call time (so a test can update it between renders, mirroring
// fakeStartingGearHtml above), `[data-button='add']` captures Add's own disabled/class/tooltip
// state (mirroring fakeEquipmentRenderHtml's `[data-button='save']` branch in
// tests/equipment-editor.test.js), and everything else (the picker-tab selectors wirePickerTabs
// itself uses) falls through to a generic {on, addClass, removeClass} stub, capturing the click
// handler the same way the old dedicated fakePickerTabsHtml fixture this replaced did.
function fakeStartingGearRenderHtml(checkedByGroupKey = {}) {
	const state = {
		checkedByGroupKey,
		groupChangeHandlers: {},
		pickerTabHandler: null,
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
			const checkedMatch = /^\[name='starting-gear-item-(.+)'\]:checked$/.exec(selector);
			if (checkedMatch) {
				const groupKey = checkedMatch[1];
				const checkedKeys = state.checkedByGroupKey[groupKey] ?? [];
				return { map: (fn) => ({ get: () => checkedKeys.map((value, index) => fn(index, { value })) }) };
			}
			const bareMatch = /^\[name='starting-gear-item-(.+)'\]$/.exec(selector);
			if (bareMatch) {
				const groupKey = bareMatch[1];
				return { on: (event, handler) => { state.groupChangeHandlers[groupKey] = handler; } };
			}
			return {
				on: (event, handler) => { state.pickerTabHandler = handler; },
				addClass: () => {},
				removeClass: () => {}
			};
		}
	};
	return state;
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

	it("gives The Scout a +2 custom weapon budget, above DEFAULT_CUSTOM_WEAPON_MAX_VALUE", () => {
		const scout = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");

		expect(scout.customWeaponMaxValue).toBe(2);
		expect(scout.customWeaponMaxValue).toBeGreaterThan(DEFAULT_CUSTOM_WEAPON_MAX_VALUE);
	});

	it("excludes Valuable and Treasure from the custom weapon budget, since this module has no economy system", () => {
		expect(CUSTOM_WEAPON_EXCLUDED_TAG_KEYS).toEqual(["valuable", "treasure"]);
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

	it("gives The Arcanist 2 of 4 Arcanist Gear items to choose from", () => {
		const arcanist = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Arcanist");

		expect(arcanist.groups).toHaveLength(1);
		expect(arcanist.groups[0].chooseCount).toBe(2);
		expect(arcanist.groups[0].items.map((item) => item.key)).toEqual([
			"the-arcanist:telescoping-staff-i",
			"the-arcanist:reagent-knife-i",
			"the-arcanist:sidearm-i",
			"the-arcanist:shield-broach-i"
		]);
	});

	it("grants The Arcanist Touch Spells I, a melee/bane weapon, rather than leaving it a freeform note", () => {
		const arcanist = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Arcanist");

		expect(arcanist.grantedItems).toHaveLength(1);
		expect(arcanist.grantedItems[0]).toMatchObject({
			key: "the-arcanist:touch-spells-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
		expect(arcanist.freeformNotes).toEqual([
			"1 Astir III.",
			"Clothes that match your look."
		]);
	});

	it("grants The Paradigm Divine Touch I, a melee/bane weapon", () => {
		const paradigm = findStartingGearPool("The Paradigm");

		expect(paradigm.grantedItems).toHaveLength(1);
		expect(paradigm.grantedItems[0]).toMatchObject({
			key: "the-paradigm:divine-touch-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Paradigm 2 of 4 Paradigm Gear items to choose from", () => {
		const paradigm = findStartingGearPool("The Paradigm");

		expect(paradigm.groups).toHaveLength(1);
		expect(paradigm.groups[0].chooseCount).toBe(2);
		expect(paradigm.groups[0].items).toHaveLength(4);
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

	it("grants The Witch Pact Weapon I, a melee/bane weapon", () => {
		const witch = findStartingGearPool("The Witch");

		expect(witch.grantedItems).toHaveLength(1);
		expect(witch.grantedItems[0]).toMatchObject({
			key: "the-witch:pact-weapon-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Witch 2 of 4 Witch Gear items to choose from", () => {
		const witch = findStartingGearPool("The Witch");

		expect(witch.groups).toHaveLength(1);
		expect(witch.groups[0].chooseCount).toBe(2);
		expect(witch.groups[0].items).toHaveLength(4);
	});

	it("grants The Wither Withering Grip I, a melee/bane weapon", () => {
		const wither = findStartingGearPool("The Wither");

		expect(wither.grantedItems).toHaveLength(1);
		expect(wither.grantedItems[0]).toMatchObject({
			key: "the-wither:withering-grip-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Wither 2 of 4 Wither Gear items to choose from", () => {
		const wither = findStartingGearPool("The Wither");

		expect(wither.groups).toHaveLength(1);
		expect(wither.groups[0].chooseCount).toBe(2);
		expect(wither.groups[0].items).toHaveLength(4);
	});

	it("grants The Adrift Strange Touch I, a melee/bane weapon", () => {
		const adrift = findStartingGearPool("The Adrift");

		expect(adrift.grantedItems).toHaveLength(1);
		expect(adrift.grantedItems[0]).toMatchObject({
			key: "the-adrift:strange-touch-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Adrift 2 of 4 Adrift Curios to choose from", () => {
		const adrift = findStartingGearPool("The Adrift");

		expect(adrift.groups).toHaveLength(1);
		expect(adrift.groups[0].chooseCount).toBe(2);
		expect(adrift.groups[0].items).toHaveLength(4);
	});

	it("grants The Advocate Withertouch I, a melee/bane weapon", () => {
		const advocate = findStartingGearPool("The Advocate");

		expect(advocate.grantedItems).toHaveLength(1);
		expect(advocate.grantedItems[0]).toMatchObject({
			key: "the-advocate:withertouch-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Advocate 2 of 4 Advocate Gear items to choose from", () => {
		const advocate = findStartingGearPool("The Advocate");

		expect(advocate.groups).toHaveLength(1);
		expect(advocate.groups[0].chooseCount).toBe(2);
		expect(advocate.groups[0].items).toHaveLength(4);
	});

	it("grants The Revenant Deathly Grip I, a melee/bane weapon", () => {
		const revenant = findStartingGearPool("The Revenant");

		expect(revenant.grantedItems).toHaveLength(1);
		expect(revenant.grantedItems[0]).toMatchObject({
			key: "the-revenant:deathly-grip-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Revenant 1 of 3 Spectral Aspects to choose from", () => {
		const revenant = findStartingGearPool("The Revenant");

		expect(revenant.groups).toHaveLength(1);
		expect(revenant.groups[0].chooseCount).toBe(1);
		expect(revenant.groups[0].items).toHaveLength(3);
	});

	it("grants The Summoner Conjured Blade I, a melee/bane weapon", () => {
		const summoner = findStartingGearPool("The Summoner");

		expect(summoner.grantedItems).toHaveLength(1);
		expect(summoner.grantedItems[0]).toMatchObject({
			key: "the-summoner:conjured-blade-i",
			kind: "weapon",
			tags: ["melee", "bane"]
		});
	});

	it("gives The Summoner 2 of 4 Summoner Gear items to choose from", () => {
		const summoner = findStartingGearPool("The Summoner");

		expect(summoner.groups).toHaveLength(1);
		expect(summoner.groups[0].chooseCount).toBe(2);
		expect(summoner.groups[0].items).toHaveLength(4);
	});

	it("gives The Icon no granted items and 2 of 5 Iconic Perks to choose from", () => {
		const icon = findStartingGearPool("The Icon");

		expect(icon.grantedItems).toHaveLength(0);
		expect(icon.groups).toHaveLength(1);
		expect(icon.groups[0].chooseCount).toBe(2);
		expect(icon.groups[0].items).toHaveLength(5);
	});

	it("gives Bodyguards I a melee/area/ward weapon shape", () => {
		const icon = findStartingGearPool("The Icon");
		const bodyguards = icon.groups[0].items.find((item) => item.key === "the-icon:bodyguards-i");

		expect(bodyguards).toMatchObject({
			kind: "weapon",
			tags: ["melee", "area", "ward"]
		});
	});

	it("gives The Attendant no granted items and two groups to choose from", () => {
		const attendant = findStartingGearPool("The Attendant");

		expect(attendant.grantedItems).toHaveLength(0);
		expect(attendant.groups).toHaveLength(2);
		expect(attendant.groups[0].chooseCount).toBe(1);
		expect(attendant.groups[0].items).toHaveLength(3);
		expect(attendant.groups[1].chooseCount).toBe(2);
		expect(attendant.groups[1].items).toHaveLength(4);
	});

	it("gives Watchdogs a ward tag", () => {
		const attendant = findStartingGearPool("The Attendant");
		const watchdogs = attendant.groups[1].items.find((item) => item.key === "the-attendant:watchdogs");

		expect(watchdogs).toMatchObject({ tags: ["ward"] });
	});

	it("gives The Captain no granted items, a 4-item Ornate Gear group and a 4-item Carrier Bonuses group", () => {
		const captain = findStartingGearPool("The Captain");

		expect(captain.grantedItems).toHaveLength(0);
		expect(captain.groups).toHaveLength(2);
		expect(captain.groups[0].key).toBe("the-captain:ornate-gear");
		expect(captain.groups[0].chooseCount).toBe(1);
		expect(captain.groups[0].items).toHaveLength(4);
		expect(captain.groups[1].key).toBe("the-captain:carrier-bonuses");
		expect(captain.groups[1].chooseCount).toBe(2);
		expect(captain.groups[1].items).toHaveLength(4);
	});

	it("puts only The Captain's clothes note in freeformNotes, with Crew/Carrier Bonuses modeled as items", () => {
		const captain = findStartingGearPool("The Captain");

		expect(captain.freeformNotes).toContain("Clothes that match your look.");
		expect(captain.freeformNotes.some((note) => note.includes("Crew/Carrier Bonuses"))).toBe(false);

		const bonuses = captain.groups[1].items;

		expect(bonuses.find((item) => item.key === "the-captain:marine-infantry")).toEqual({
			key: "the-captain:marine-infantry",
			name: "Marine Infantry",
			description: "They'll fight tooth and nail to defend the Carrier."
		});
		expect(bonuses.find((item) => item.key === "the-captain:cloaking-rituals")).toEqual({
			key: "the-captain:cloaking-rituals",
			name: "Cloaking Rituals",
			description: "Can hide the Carrier from sight."
		});
	});

	it("gives Ruinlock I a ranged/reload/ruin/profane weapon shape", () => {
		const captain = findStartingGearPool("The Captain");
		const ruinlock = captain.groups[0].items.find((item) => item.key === "the-captain:ruinlock-i");

		expect(ruinlock).toMatchObject({
			kind: "weapon",
			tags: ["ranged", "reload", "ruin", "profane"]
		});
	});

	it("gives Arcane Mantle I a ranged/defensive/arcane weapon shape", () => {
		const captain = findStartingGearPool("The Captain");
		const mantle = captain.groups[0].items.find((item) => item.key === "the-captain:arcane-mantle-i");

		expect(mantle).toMatchObject({
			kind: "weapon",
			tags: ["ranged", "defensive", "arcane"]
		});
	});

	it("gives The Artificer one granted item and one 4-item Artificer Tools group choosing 2", () => {
		const artificer = findStartingGearPool("The Artificer");

		expect(artificer.grantedItems).toHaveLength(1);
		expect(artificer.grantedItems[0]).toMatchObject({ key: "the-artificer:construct-manuals" });
		expect(artificer.groups).toHaveLength(1);
		expect(artificer.groups[0].chooseCount).toBe(2);
		expect(artificer.groups[0].items).toHaveLength(4);
	});

	it("puts The Artificer's Ardent and clothing note in freeformNotes, not modeled items", () => {
		const artificer = findStartingGearPool("The Artificer");

		expect(artificer.freeformNotes.some((note) => note.includes("Transport or Service Ardent II"))).toBe(true);
		expect(artificer.freeformNotes).toContain("Clothing that matches your look.");
	});

	it("gives Steelfuser I a ranged/restraining/elemental weapon shape", () => {
		const artificer = findStartingGearPool("The Artificer");
		const steelfuser = artificer.groups[0].items.find((item) => item.key === "the-artificer:steelfuser-i");

		expect(steelfuser).toMatchObject({
			kind: "weapon",
			tags: ["ranged", "restraining", "elemental"]
		});
	});

	it("gives Alchemical Gel I a gear shape with no tags", () => {
		const artificer = findStartingGearPool("The Artificer");
		const gel = artificer.groups[0].items.find((item) => item.key === "the-artificer:alchemical-gel-i");

		expect(gel.kind).toBe("gear");
		expect(gel.tags).toBeUndefined();
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
			grantedItems: FIXTURE_POOLS[0].grantedItems.map((item) => ({ ...item, tagLabels: [] })),
			groups: FIXTURE_POOLS[0].groups.map((group) => ({
				...group,
				items: group.items.map((item) => ({ ...item, tagLabels: [] }))
			})),
			freeformNotes: FIXTURE_POOLS[0].freeformNotes,
			tagGroups: [],
			hasTags: false
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("includes a Tags reference when an item carries a real tag key", async () => {
		const promise = chooseStartingGear("Fixture Tagged Playbook", FIXTURE_TAGGED_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("starting-gear-picker"), expect.objectContaining({
			hasTags: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("opens the dialog sized larger than Dialog's default, resizable, with picker tabs wired", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({
			classes: ["armor-astir", "starting-gear-picker"],
			width: 560,
			height: 700,
			resizable: true
		});
		expect(Dialog.mock.calls.at(-1)[0].render).toEqual(expect.any(Function));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("wires picker tab switching via the dialog's render option", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingGearRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.pickerTabHandler).toEqual(expect.any(Function));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("starts Add enabled when the dialog first renders with nothing checked", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingGearRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.addDisabled).toBe(false);
		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("disables Add and sets a gate-tooltip once a group's checked count exceeds its chooseCount", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingGearRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedByGroupKey["fixture:group-a"] = ["fixture:alpha", "fixture:bravo", "fixture:charlie"];
		state.groupChangeHandlers["fixture:group-a"]();

		expect(state.addDisabledClass).toBe(true);
		expect(state.addGateTooltip).toBe('You can pick at most 2 for "Choose 2." (currently 3 selected).');

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-enables Add and clears the tooltip once unchecked back down within the cap", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingGearRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedByGroupKey["fixture:group-a"] = ["fixture:alpha", "fixture:bravo", "fixture:charlie"];
		state.groupChangeHandlers["fixture:group-a"]();
		expect(state.addDisabledClass).toBe(true);

		state.checkedByGroupKey["fixture:group-a"] = ["fixture:alpha", "fixture:bravo"];
		state.groupChangeHandlers["fixture:group-a"]();

		expect(state.addDisabledClass).toBe(false);
		expect(state.addGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("keeps each group's cap independent, so over-selecting only one group disables Add on its own", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeStartingGearRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedByGroupKey["fixture:group-b"] = ["fixture:echo", "fixture:foxtrot"];
		state.groupChangeHandlers["fixture:group-b"]();

		expect(state.addDisabledClass).toBe(true);
		expect(state.addGateTooltip).toBe('You can pick at most 1 for "Choose 1." (currently 2 selected).');

		state.checkedByGroupKey["fixture:group-b"] = ["fixture:echo"];
		state.groupChangeHandlers["fixture:group-b"]();
		expect(state.addDisabledClass).toBe(false);

		state.checkedByGroupKey["fixture:group-a"] = ["fixture:alpha", "fixture:bravo", "fixture:charlie"];
		state.groupChangeHandlers["fixture:group-a"]();

		expect(state.addDisabledClass).toBe(true);
		expect(state.addGateTooltip).toBe('You can pick at most 2 for "Choose 2." (currently 3 selected).');

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

	it("resolves null and warns when a group's checked selection exceeds its chooseCount", async () => {
		const promise = chooseStartingGear("Fixture Playbook", FIXTURE_POOLS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(
			fakeStartingGearHtml({ "fixture:group-a": ["fixture:alpha", "fixture:bravo", "fixture:charlie"] })
		);

		expect(ui.notifications.warn).toHaveBeenCalledWith(
			'You can pick at most 2 for "Choose 2." (currently 3 selected).'
		);
		expect(await promise).toBeNull();
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
