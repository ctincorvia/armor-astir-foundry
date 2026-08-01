import { beforeEach, describe, expect, it, vi } from "vitest";

import { EFFECT_STATES } from "../scripts/roll-effects.js";
import {
	EQUIPMENT_CATALOG,
	EQUIPMENT_TAGS,
	TAG_VALUE_MAX,
	TAG_VALUE_MIN,
	TIER_MAX,
	TIER_MIN,
	UNARMED,
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	chooseWeapon,
	configureEquipment,
	equipmentValue,
	findCatalogEquipment,
	findEquipmentTag,
	resolveEquipmentTags
} from "../scripts/equipment.js";

const BLITZ = EQUIPMENT_TAGS.find((tag) => tag.key === "blitz");

// A fixture catalog independent of EQUIPMENT_CATALOG's real (currently placeholder-only)
// content, mirroring FIXTURE_TAGS above and the same injectable-argument pattern
// playbookMoveSections uses in playbook-moves.js.
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

// Fakes the jQuery `.find(selector)` chain configureEquipment uses: plain fields resolve via
// `.val()`, and the checked-tag checkboxes resolve via `.map(...).get()`, mirroring fakeRollHtml
// in tests/moves.test.js and fakePickerHtml in tests/playbook-moves.test.js.
function fakeEquipmentHtml(values, checkedTags = []) {
	return {
		find: (selector) => {
			if (selector === "[name='tag']:checked") {
				return { map: (fn) => ({ get: () => checkedTags.map((value, index) => fn(index, { value })) }) };
			}
			return { val: () => values[selector] };
		}
	};
}

// Fakes the jQuery chain configureEquipment's `render` callback uses to wire up the live tag
// total: `.find("[name='tag']").on("change", handler)` to capture the handler, `.find("[name='tag']:checked")`
// to report whichever keys the test sets on `.checkedTags` at call time (so a test can change what's
// "checked" between renders and re-invoking the handler, same as a real toggle), and
// `.find(".equipment-editor-tag-total-value").text(...)` to capture what was written.
function fakeEquipmentRenderHtml() {
	const state = { handlers: {}, total: undefined, checkedTags: [] };
	state.html = {
		find: (selector) => {
			if (selector === "[name='tag']") return { on: (event, handler) => { state.handlers[event] = handler; } };
			if (selector === "[name='tag']:checked") {
				return { map: (fn) => ({ get: () => state.checkedTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === ".equipment-editor-tag-total-value") return { text: (value) => { state.total = value; } };
			return {};
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

describe("EQUIPMENT_TAGS", () => {
	it("gives every tag a unique key", () => {
		const keys = EQUIPMENT_TAGS.map((tag) => tag.key);
		expect(new Set(keys).size).toBe(keys.length);
	});

	it("keeps every tag's value within the -2..+2 range", () => {
		for (const tag of EQUIPMENT_TAGS) {
			expect(tag.value).toBeGreaterThanOrEqual(TAG_VALUE_MIN);
			expect(tag.value).toBeLessThanOrEqual(TAG_VALUE_MAX);
		}
	});

	it("only ever spends into a real EFFECT_STATES key, when it sets one at all", () => {
		// A spend with no `effect` (Ward, Vorpal, One-Use, Refresh, Dangerous) is a manual
		// "used this period" tracker with no roll-dialog offering — see equipment.js's EQUIPMENT_TAGS
		// comment — so it's exempt from this check rather than required to match a real effect.
		for (const tag of EQUIPMENT_TAGS.filter((t) => t.spend?.effect)) {
			expect(EFFECT_STATES.some((state) => state.key === tag.spend.effect)).toBe(true);
		}
	});

	it("gives every spend and forcesEffect a Scene or Sortie period", () => {
		for (const tag of EQUIPMENT_TAGS.filter((t) => t.spend || t.forcesEffect)) {
			const period = (tag.spend ?? tag.forcesEffect).period;
			expect(["Scene", "Sortie"]).toContain(period);
		}
	});

	it("only ever forces a real EFFECT_STATES key", () => {
		for (const tag of EQUIPMENT_TAGS.filter((t) => t.forcesEffect)) {
			expect(EFFECT_STATES.some((state) => state.key === tag.forcesEffect.effect)).toBe(true);
		}
	});

	it("only ever rerolls a non-empty list of move keys", () => {
		for (const tag of EQUIPMENT_TAGS.filter((t) => t.reroll)) {
			expect(tag.reroll.moves.length).toBeGreaterThan(0);
			expect(["Scene", "Sortie"]).toContain(tag.reroll.period);
		}
	});

	it("gives Blitz the rulebook's once-per-Scene confidence spend", () => {
		expect(BLITZ).toEqual({
			key: "blitz",
			label: "Blitz",
			value: 1,
			description: "You may spend this tag once per Scene to make a move with confidence.",
			spend: { period: "Scene", effect: "confidence" }
		});
	});
});

describe("WEAPON_SCALES", () => {
	it("defines exactly Foot Scale and Astir Scale", () => {
		expect(WEAPON_SCALES.map((s) => s.key)).toEqual(["foot", "astir"]);
	});
});

describe("findEquipmentTag", () => {
	it("resolves a known key to its tag definition", () => {
		expect(findEquipmentTag("fixture-positive", FIXTURE_TAGS)).toEqual(FIXTURE_TAGS[0]);
	});

	it("resolves an unknown key to null", () => {
		expect(findEquipmentTag("not-a-real-tag", FIXTURE_TAGS)).toBeNull();
	});

	it("defaults to the real EQUIPMENT_TAGS catalog", () => {
		expect(findEquipmentTag("blitz")).toEqual(BLITZ);
	});
});

describe("resolveEquipmentTags", () => {
	it("resolves each key to its tag definition, in order", () => {
		expect(resolveEquipmentTags(["fixture-negative", "fixture-positive"], FIXTURE_TAGS)).toEqual([
			FIXTURE_TAGS[1],
			FIXTURE_TAGS[0]
		]);
	});

	it("drops keys that no longer match a catalog entry", () => {
		expect(resolveEquipmentTags(["fixture-positive", "stale-key"], FIXTURE_TAGS)).toEqual([FIXTURE_TAGS[0]]);
	});

	it("defaults to an empty list", () => {
		expect(resolveEquipmentTags(undefined, FIXTURE_TAGS)).toEqual([]);
	});
});

describe("equipmentValue", () => {
	it("sums the values of the given tags", () => {
		expect(equipmentValue(["fixture-positive", "fixture-spendable"], FIXTURE_TAGS)).toBe(3);
	});

	it("lets negative tags reduce the total", () => {
		expect(equipmentValue(["fixture-positive", "fixture-negative"], FIXTURE_TAGS)).toBe(1);
	});

	it("is 0 for equipment with no tags", () => {
		expect(equipmentValue([], FIXTURE_TAGS)).toBe(0);
	});

	it("ignores stale keys that no longer resolve", () => {
		expect(equipmentValue(["fixture-positive", "stale-key"], FIXTURE_TAGS)).toBe(2);
	});
});

describe("configureEquipment", () => {
	it("renders the editor template blank, titled to Add, when creating", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			name: "",
			description: "",
			isWeapon: true,
			scale: "foot",
			tier: TIER_MIN,
			tierMin: TIER_MIN,
			tierMax: TIER_MAX,
			tags: [
				{ key: "fixture-positive", label: "Fixture Positive", value: 2, description: "a", checked: false },
				{ key: "fixture-negative", label: "Fixture Negative", value: -1, description: "b", checked: false },
				{ key: "fixture-spendable", label: "Fixture Spendable", value: 1, description: "c", checked: false }
			]
		}));
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Add Equipment");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("pre-fills the editor and titles it to Edit when given an existing entry", async () => {
		const entry = {
			id: "abc",
			name: "Halberd",
			description: "A long blade.",
			kind: "weapon",
			scale: "astir",
			tier: 3,
			tags: ["fixture-negative"]
		};
		const promise = configureEquipment(entry, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			name: "Halberd",
			description: "A long blade.",
			isWeapon: true,
			scale: "astir",
			tier: 3,
			tags: expect.arrayContaining([
				expect.objectContaining({ key: "fixture-negative", checked: true }),
				expect.objectContaining({ key: "fixture-positive", checked: false })
			])
		}));
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Edit Equipment");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("still titles to Add when a kind-only initial (no id) is given, e.g. picking a section's + button", async () => {
		const promise = configureEquipment({ kind: "gear" }, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			isWeapon: false
		}));
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Add Equipment");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves a weapon's name, description, kind, tags, scale and tier when Save is clicked", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "  Halberd  ",
			"[name='kind']": "weapon",
			"[name='description']": "  A long blade.  ",
			"[name='scale']": "astir",
			"[name='tier']": "3"
		}, ["fixture-positive", "fixture-negative"]));

		expect(await promise).toEqual({
			name: "Halberd",
			description: "A long blade.",
			kind: "weapon",
			tags: ["fixture-positive", "fixture-negative"],
			scale: "astir",
			tier: 3
		});
	});

	it("omits scale and tier when Kind is Gear", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}));

		expect(await promise).toEqual({ name: "Rations", description: "", kind: "gear", tags: [] });
	});

	it("clamps tier to the 1-5 range", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Cannon",
			"[name='kind']": "weapon",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": "99"
		}));

		expect((await promise).tier).toBe(TIER_MAX);
	});

	it("defaults a non-numeric tier to the minimum", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Cannon",
			"[name='kind']": "weapon",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": ""
		}));

		expect((await promise).tier).toBe(TIER_MIN);
	});

	it("resolves null, without saving, when the name is blank", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "   ",
			"[name='kind']": "gear",
			"[name='description']": ""
		}));

		expect(await promise).toBeNull();
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without saving", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("passes an optional note through to the template, for non-blocking guidance text", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { note: "Aim for a +2 total." });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			note: "Aim for a +2 total."
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("leaves note undefined when no options are given, unchanged for every existing caller", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			note: undefined
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults the tag total to 0 when creating blank", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			tagTotal: 0
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes the existing entry's tag total to the template when editing", async () => {
		const entry = { id: "abc", name: "Halberd", tags: ["fixture-positive", "fixture-negative"] };
		const promise = configureEquipment(entry, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			tagTotal: 1
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("recomputes and displays the tag total live as checkboxes change", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.handlers.change).toEqual(expect.any(Function));

		state.checkedTags = ["fixture-positive", "fixture-spendable"];
		state.handlers.change();
		expect(state.total).toBe(3);

		state.checkedTags = ["fixture-negative"];
		state.handlers.change();
		expect(state.total).toBe(-1);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
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

	it("gives every weapon a scale and a tier within range, and gear neither", () => {
		for (const item of EQUIPMENT_CATALOG) {
			if (item.kind === "weapon") {
				expect(WEAPON_SCALES.some((s) => s.key === item.scale)).toBe(true);
				expect(item.tier).toBeGreaterThanOrEqual(TIER_MIN);
				expect(item.tier).toBeLessThanOrEqual(TIER_MAX);
			} else {
				expect(item.scale).toBeUndefined();
				expect(item.tier).toBeUndefined();
			}
		}
	});

	it("only ever references a real EQUIPMENT_TAGS key", () => {
		for (const item of EQUIPMENT_CATALOG) {
			for (const tagKey of item.tags) {
				expect(findEquipmentTag(tagKey)).not.toBeNull();
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
		expect(findCatalogEquipment("placeholder-weapon")).toEqual(
			EQUIPMENT_CATALOG.find((item) => item.key === "placeholder-weapon")
		);
	});
});

describe("chooseEquipmentCatalogItem", () => {
	it("renders the picker template filtered to the given kind", async () => {
		const promise = chooseEquipmentCatalogItem("weapon", FIXTURE_CATALOG);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-catalog-picker"), {
			items: [FIXTURE_CATALOG[0], FIXTURE_CATALOG[1]]
		});

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
			]
		});

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
			options: [{ key: "w3", name: "Fists", value: 0, tagLabels: [] }]
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
