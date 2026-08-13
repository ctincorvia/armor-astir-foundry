import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	EQUIPMENT_CATALOG,
	EQUIPMENT_TAGS,
	UNARMED,
	WEAPON_RANGE_GROUP,
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	chooseWeapon,
	findCatalogEquipment,
	findEquipmentTag,
	wirePickerTabs
} from "../scripts/equipment/equipment.js";

const BLITZ = EQUIPMENT_TAGS.find((tag) => tag.key === "blitz");

// A fixture catalog independent of EQUIPMENT_CATALOG's real content, mirroring FIXTURE_TAGS
// above and the same injectable-argument pattern playbookMoveSections uses in
// playbook-moves.js.
const FIXTURE_CATALOG = [
	{ key: "fixture-sword", name: "Fixture Sword", kind: "weapon", description: "a", tags: [], scale: "foot", tier: 2 },
	{ key: "fixture-blade", name: "Fixture Blade", kind: "weapon", description: "b", tags: [], scale: "foot", tier: 1 },
	{ key: "fixture-rope", name: "Fixture Rope", kind: "gear", description: "c", tags: [] }
];

// Fakes the jQuery `.find("[name='catalog-item']:checked").val()` chain
// chooseEquipmentCatalogItem uses to read the picked radio, mirroring fakePickerHtml in
// tests/playbook-moves.test.js.
function fakeCatalogPickerHtml(checkedValue) {
	return { find: () => ({ val: () => checkedValue }) };
}

// A fixture catalog independent of EQUIPMENT_TAGS's real (currently Blitz-only) content, so
// summation/negative-value/multi-tag behavior stays covered as the shipped catalog grows —
// mirrors the injectable `pools` argument playbookMoveSections takes in playbook-moves.js.
const FIXTURE_TAGS = [
	{ key: "fixture-positive", label: "Fixture Positive", value: 2, description: "a" },
	{ key: "fixture-negative", label: "Fixture Negative", value: -1, description: "b" },
	{ key: "fixture-spendable", label: "Fixture Spendable", value: 1, description: "c", spend: { period: "Scene", effect: "confidence" } }
];

// Fakes the jQuery `.find(selector)` chain wirePickerTabs uses: `[data-picker-tab]` resolves an
// object exposing `.on("click", handler)` (to capture the handler) and `.removeClass`; any other
// selector (the per-target `[data-picker-tab='...']`/`[data-picker-tab-panel]` lookups) resolves
// an object exposing `.addClass`/`.removeClass`, recording which selector each was called on.
function fakePickerTabsHtml() {
	const state = { handler: null, addClassCalls: [], removeClassCalls: [] };
	state.html = {
		find: (selector) => ({
			on: (event, handler) => { state.handler = handler; },
			addClass: (cls) => { state.addClassCalls.push([selector, cls]); },
			removeClass: (cls) => { state.removeClassCalls.push([selector, cls]); }
		})
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

describe("EQUIPMENT_CATALOG", () => {
	it("gives every item a unique key", () => {
		const keys = EQUIPMENT_CATALOG.map((item) => item.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("gives every item a kind of weapon or gear", () => {
		for (const item of EQUIPMENT_CATALOG) {
			expect(["weapon", "gear"]).toContain(item.kind);
		}
	});

	it("gives every weapon a scale, and no item a tier", () => {
		for (const item of EQUIPMENT_CATALOG) {
			if (item.kind === "weapon") {
				expect(WEAPON_SCALES.some((s) => s.key === item.scale)).toBe(true);
			} else {
				expect(item.scale).toBeUndefined();
			}
			// Tier is never stored on a catalog template — every weapon derives it from whoever/
			// whatever wields it (see PlaybookActorSheet#_equipmentEntry).
			expect(item.tier).toBeUndefined();
		}
	});

	it("only ever references a real EQUIPMENT_TAGS key", () => {
		for (const item of EQUIPMENT_CATALOG) {
			for (const tagKey of item.tags) {
				expect(findEquipmentTag(tagKey)).not.toBeNull();
			}
		}
	});

	it("gives every weapon one of the WEAPON_RANGE_GROUP tags, so a picked-and-saved-unmodified item already satisfies configureEquipment's Save rule", () => {
		for (const item of EQUIPMENT_CATALOG) {
			if (item.kind === "weapon") {
				expect(item.tags.some((tagKey) => findEquipmentTag(tagKey).exclusiveGroup === WEAPON_RANGE_GROUP)).toBe(true);
			}
		}
	});
});

describe("findCatalogEquipment", () => {
	it("resolves a known key to its catalog item", () => {
		expect(findCatalogEquipment("fixture-sword", FIXTURE_CATALOG)).toEqual(FIXTURE_CATALOG[0]);
	});

	it("resolves an unknown key to null", () => {
		expect(findCatalogEquipment("not-a-real-item", FIXTURE_CATALOG)).toBeNull();
	});

	it("defaults to the real EQUIPMENT_CATALOG", () => {
		expect(findCatalogEquipment("infantry-weapon-i")).toEqual(
			EQUIPMENT_CATALOG.find((item) => item.key === "infantry-weapon-i")
		);
	});
});

// A catalog independent of FIXTURE_CATALOG above (whose items all carry tags: []), carrying a
// real EQUIPMENT_TAGS key so the hasTags: true branch of buildTagReference gets real coverage.
const FIXTURE_CATALOG_WITH_TAGS = [
	{ key: "fixture-tagged-weapon", name: "Fixture Tagged Weapon", kind: "weapon", description: "t", tags: ["blitz"], scale: "foot" }
];

describe("chooseEquipmentCatalogItem", () => {
	it("renders the picker template filtered to the given kind", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-catalog-picker"), {
			items: [
				{ ...FIXTURE_CATALOG[0], tagLabels: [] },
				{ ...FIXTURE_CATALOG[1], tagLabels: [] }
			],
			itemsTabLabel: "Weapons",
			tagGroups: [],
			hasTags: false
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("labels the items tab Gear when picking gear", async () => {
		const promise = chooseEquipmentCatalogItem("gear", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ itemsTabLabel: "Gear" }));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("includes a Tags reference when an item carries a real tag key", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG_WITH_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-catalog-picker"), {
			items: [{ ...FIXTURE_CATALOG_WITH_TAGS[0], tagLabels: [BLITZ.label] }],
			itemsTabLabel: "Weapons",
			tagGroups: [{ label: "Strong Benefits (+1)", tags: [BLITZ] }],
			hasTags: true
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("opens the dialog sized larger than Dialog's default, resizable, with picker tabs wired", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		});
		expect(Dialog.mock.calls.at(-1)[0].render).toBe(wirePickerTabs);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("wires picker tab switching via the dialog's render option", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakePickerTabsHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.handler).toEqual(expect.any(Function));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog by kind", async () => {
		const weaponPromise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Pick a Weapon");
		Dialog.mock.calls.at(-1)[0].close();
		await weaponPromise;

		const gearPromise = chooseEquipmentCatalogItem("gear", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Pick Gear");
		Dialog.mock.calls.at(-1)[0].close();
		await gearPromise;
	});

	it("resolves the picked item when Add is clicked", async () => {
		const promise = chooseEquipmentCatalogItem("gear", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeCatalogPickerHtml("fixture-rope"));

		expect(await promise).toEqual(FIXTURE_CATALOG[2]);
	});

	it("resolves null when nothing is checked and Add is clicked", async () => {
		const promise = chooseEquipmentCatalogItem("gear", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.add.callback(fakeCatalogPickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});
});

// Raw actor equipment entries (the shape system.attributes.equipment stores), independent of
// FIXTURE_TAGS above so chooseWeapon's own value/tagLabels summarization stays covered.
const FIXTURE_WEAPONS = [
	{ id: "w1", kind: "weapon", name: "Halberd", tags: ["fixture-positive", "fixture-spendable"], scale: "foot", tier: 2 },
	{ id: "w2", kind: "weapon", name: "Sidearm", tags: [], scale: "foot", tier: 1 }
];

// Fakes the jQuery `.find("[name='weapon']:checked").val()` chain chooseWeapon uses to read the
// picked radio, mirroring fakeCatalogPickerHtml above.
function fakeWeaponPickerHtml(checkedValue) {
	return { find: () => ({ val: () => checkedValue }) };
}

describe("chooseWeapon", () => {
	it("summarizes each weapon's value and tag labels for the picker template", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("weapon-picker"), {
			options: [
				{ key: "w1", name: "Halberd", value: 3, tagLabels: ["Fixture Positive", "Fixture Spendable"] },
				{ key: "w2", name: "Sidearm", value: 0, tagLabels: [] }
			],
			tagGroups: [
				{ label: "Strong Benefits (+1)", tags: [FIXTURE_TAGS[2]] },
				{ label: "Rare Benefits (+2)", tags: [FIXTURE_TAGS[0]] }
			],
			hasTags: true
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("opens the dialog sized larger than Dialog's default, resizable, with picker tabs wired", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({
			classes: ["armor-astir", "weapon-picker"],
			width: 560,
			height: 700,
			resizable: true
		});
		expect(Dialog.mock.calls.at(-1)[0].render).toBe(wirePickerTabs);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("wires picker tab switching via the dialog's render option", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakePickerTabsHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.handler).toEqual(expect.any(Function));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog Choose a Weapon", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Choose a Weapon");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the checked weapon's id when Choose is clicked", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.choose.callback(fakeWeaponPickerHtml("w2"));

		expect(await promise).toBe("w2");
	});

	it("resolves null when Choose is clicked with nothing checked", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.choose.callback(fakeWeaponPickerHtml(undefined));

		expect(await promise).toBeNull();
	});

	it("treats a weapon with no tags array as having no tags", async () => {
		const untagged = [{ id: "w3", name: "Fists", scale: "foot", tier: 1 }];
		const promise = chooseWeapon(untagged, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("weapon-picker"), {
			options: [{ key: "w3", name: "Fists", value: 0, tagLabels: [] }],
			tagGroups: [],
			hasTags: false
		});

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves UNARMED when the (pre-checked) Unarmed option is confirmed", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.choose.callback(fakeWeaponPickerHtml(UNARMED));

		expect(await promise).toBe(UNARMED);
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseWeapon(FIXTURE_WEAPONS, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});
});
