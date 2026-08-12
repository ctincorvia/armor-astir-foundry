import { beforeEach, describe, expect, it, vi } from "vitest";

import { EFFECT_STATES } from "../scripts/moves/roll-effects.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import {
	DRAIN_GROUP,
	EQUIPMENT_CATALOG,
	EQUIPMENT_TAGS,
	MAX_TAGS,
	TAG_VALUE_MAX,
	TAG_VALUE_MIN,
	TIER_MAX,
	TIER_MIN,
	UNARMED,
	WEAPON_RANGE_GROUP,
	WEAPON_SCALES,
	baseEquipmentTagKey,
	buildTagReference,
	chooseEquipmentCatalogItem,
	chooseWeapon,
	configureEquipment,
	equipmentValue,
	findCatalogEquipment,
	findEquipmentTag,
	groupEquipmentTags,
	rerollSpendKey,
	rerollSpendKeys,
	resolveEquipmentTags,
	wirePickerTabs,
	withTagLabels
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

// Isolated to the exclusiveGroup mechanism's own tests, rather than adding value: 0 entries into
// FIXTURE_TAGS above and perturbing every other test that asserts FIXTURE_TAGS' exact grouped
// shape (see the groupEquipmentTags and configureEquipment describe blocks below).
const FIXTURE_EXCLUSIVE_TAGS = [
	{ key: "fixture-solo", label: "Fixture Solo", value: 1, description: "a" },
	{ key: "fixture-exclusive-a", label: "Fixture Exclusive A", value: 0, description: "b", exclusiveGroup: "fixture-group" },
	{ key: "fixture-exclusive-b", label: "Fixture Exclusive B", value: 0, description: "c", exclusiveGroup: "fixture-group" }
];

// Fakes the jQuery `.find(selector)` chain configureEquipment uses: plain fields resolve via
// `.val()`, the checked-tag checkboxes resolve via `.map(...).get()`, and the Range radio group
// resolves via `.val()` on its own selector — mirroring fakeRollHtml in tests/moves.test.js and
// fakePickerHtml in tests/playbook-moves.test.js. `weaponRange` mimics whichever
// Melee/Ranged/Sniper radio is checked (undefined when none is, the defensive-fallback case).
function fakeEquipmentHtml(values, checkedTags = [], weaponRange) {
	return {
		find: (selector) => {
			if (selector === "[name='tag']:checked") {
				return { map: (fn) => ({ get: () => checkedTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='weapon-range']:checked") {
				return { val: () => weaponRange };
			}
			return { val: () => values[selector] };
		}
	};
}

// Fakes the jQuery chain configureEquipment's `render` callback uses to wire up the live tag
// total and exclusiveGroup behavior: `.find("[name='tag']").on("change", handler)` to capture the
// handler (invoked with a `{ target: { value, checked } }` event, mirroring a real DOM change
// event), `.find("[name='tag']:checked")` to report whichever keys the test sets on `.checkedTags`
// at call time (so a test can change what's "checked" between renders and re-invoking the
// handler, same as a real toggle), `.find(".equipment-editor-tag-total-value").text(...)` to
// capture what was written, and `.find("[name='tag'][value='<key>']").prop("checked", false)` to
// record which sibling(s) the exclusiveGroup logic force-unchecked, in `uncheckedKeys`.
function fakeEquipmentRenderHtml() {
	const state = { handlers: {}, total: undefined, checkedTags: [], uncheckedKeys: [] };
	state.html = {
		find: (selector) => {
			if (selector === "[name='tag']") return { on: (event, handler) => { state.handlers[event] = handler; } };
			if (selector === "[name='tag']:checked") {
				return { map: (fn) => ({ get: () => state.checkedTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === ".equipment-editor-tag-total-value") return { text: (value) => { state.total = value; } };
			const tagCheckboxMatch = selector.match(/^\[name='tag'\]\[value='(.+)'\]$/);
			if (tagCheckboxMatch) {
				const key = tagCheckboxMatch[1];
				return { prop: (name, value) => { if (name === "checked" && value === false) state.uncheckedKeys.push(key); } };
			}
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

	it("keeps every tag's value within the -3..+2 range", () => {
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

	it("only ever rerolls a non-empty list of move keys that each resolve to a real move", () => {
		// PlaybookActorSheet#_equipmentEntry (equipment-mixin.js) trusts every reroll.moves key to
		// resolve via ALL_MOVES with no stale-key fallback, when building a multi-move reroll tag's
		// (Versatile) per-move row label — this is what guarantees that.
		for (const tag of EQUIPMENT_TAGS.filter((t) => t.reroll)) {
			expect(tag.reroll.moves.length).toBeGreaterThan(0);
			expect(["Scene", "Sortie"]).toContain(tag.reroll.period);
			for (const moveKey of tag.reroll.moves) {
				expect(ALL_MOVES.some((move) => move.key === moveKey)).toBe(true);
			}
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

	it("gives Melee, Ranged and Sniper a value of 0 and WEAPON_RANGE_GROUP as their exclusiveGroup", () => {
		expect(EQUIPMENT_TAGS.filter((tag) => tag.exclusiveGroup === WEAPON_RANGE_GROUP).map((tag) => tag.key))
			.toEqual(["melee", "ranged", "sniper"]);
		for (const key of ["melee", "ranged", "sniper"]) {
			expect(findEquipmentTag(key).value).toBe(0);
		}
	});

	it("gives Drain 1/2/3 DRAIN_GROUP as their exclusiveGroup and escalating negative values", () => {
		expect(EQUIPMENT_TAGS.filter((tag) => tag.exclusiveGroup === DRAIN_GROUP).map((tag) => tag.key))
			.toEqual(["drain-3", "drain-2", "drain-1"]);
		expect(findEquipmentTag("drain-1").value).toBe(-1);
		expect(findEquipmentTag("drain-2").value).toBe(-2);
		expect(findEquipmentTag("drain-3").value).toBe(-3);
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

describe("rerollSpendKey / rerollSpendKeys / baseEquipmentTagKey", () => {
	const SINGLE_MOVE_TAG = { key: "defensive", reroll: { moves: ["exchange-blows"], period: "Scene" } };
	const MULTI_MOVE_TAG = { key: "versatile", reroll: { moves: ["exchange-blows", "strike-decisively"], period: "Scene" } };

	it("rerollSpendKey returns the bare tag key for a single-move reroll tag", () => {
		expect(rerollSpendKey(SINGLE_MOVE_TAG, "exchange-blows")).toBe("defensive");
	});

	it("rerollSpendKey returns a compound key for a multi-move reroll tag", () => {
		expect(rerollSpendKey(MULTI_MOVE_TAG, "exchange-blows")).toBe("versatile:exchange-blows");
		expect(rerollSpendKey(MULTI_MOVE_TAG, "strike-decisively")).toBe("versatile:strike-decisively");
	});

	it("rerollSpendKeys returns just the bare key, in a single-entry array, for a single-move reroll tag", () => {
		expect(rerollSpendKeys(SINGLE_MOVE_TAG)).toEqual(["defensive"]);
	});

	it("rerollSpendKeys returns one compound key per move for a multi-move reroll tag", () => {
		expect(rerollSpendKeys(MULTI_MOVE_TAG)).toEqual(["versatile:exchange-blows", "versatile:strike-decisively"]);
	});

	it("baseEquipmentTagKey is a no-op for a plain, non-compound key", () => {
		expect(baseEquipmentTagKey("defensive")).toBe("defensive");
	});

	it("baseEquipmentTagKey strips a compound key back to its catalog tag key", () => {
		expect(baseEquipmentTagKey("versatile:exchange-blows")).toBe("versatile");
		expect(baseEquipmentTagKey("versatile:strike-decisively")).toBe("versatile");
	});
});

describe("groupEquipmentTags", () => {
	it("groups tags into the fixed -2/-1/+1/+2 order regardless of input order", () => {
		const shuffled = [FIXTURE_TAGS[2], FIXTURE_TAGS[0], FIXTURE_TAGS[1]];

		expect(groupEquipmentTags(shuffled)).toEqual([
			{ label: "Minor Drawbacks (-1)", tags: [FIXTURE_TAGS[1]] },
			{ label: "Strong Benefits (+1)", tags: [FIXTURE_TAGS[2]] },
			{ label: "Rare Benefits (+2)", tags: [FIXTURE_TAGS[0]] }
		]);
	});

	it("preserves each group's tags in their original relative order", () => {
		const twoNegatives = [
			{ key: "fixture-negative-a", value: -1 },
			{ key: "fixture-negative-b", value: -1 }
		];

		expect(groupEquipmentTags(twoNegatives)[0].tags).toEqual(twoNegatives);
	});

	it("drops a group with no matching tags", () => {
		// FIXTURE_TAGS has no -2 entry, so that group is absent entirely rather than rendered empty.
		expect(groupEquipmentTags(FIXTURE_TAGS).map((group) => group.label)).toEqual([
			"Minor Drawbacks (-1)",
			"Strong Benefits (+1)",
			"Rare Benefits (+2)"
		]);
	});

	it("returns an empty list for an empty input", () => {
		expect(groupEquipmentTags([])).toEqual([]);
	});
});

describe("withTagLabels", () => {
	it("resolves an item's tag keys to their labels", () => {
		expect(withTagLabels({ key: "fixture-item", tags: ["fixture-positive", "fixture-negative"] }, FIXTURE_TAGS)).toEqual({
			key: "fixture-item",
			tags: ["fixture-positive", "fixture-negative"],
			tagLabels: ["Fixture Positive", "Fixture Negative"]
		});
	});

	it("defaults to an empty tagLabels array when the item has no tags field", () => {
		expect(withTagLabels({ key: "fixture-item" }, FIXTURE_TAGS)).toEqual({
			key: "fixture-item",
			tagLabels: []
		});
	});

	it("spreads the rest of the item through untouched", () => {
		const item = { key: "fixture-item", name: "Fixture Item", description: "d", tags: [] };
		expect(withTagLabels(item, FIXTURE_TAGS)).toEqual({ ...item, tagLabels: [] });
	});
});

describe("buildTagReference", () => {
	it("unions and groups tag keys referenced across a list of items", () => {
		const items = [
			{ key: "a", tags: ["fixture-positive"] },
			{ key: "b", tags: ["fixture-negative"] }
		];

		expect(buildTagReference(items, FIXTURE_TAGS)).toEqual({
			tagGroups: [
				{ label: "Minor Drawbacks (-1)", tags: [FIXTURE_TAGS[1]] },
				{ label: "Rare Benefits (+2)", tags: [FIXTURE_TAGS[0]] }
			],
			hasTags: true
		});
	});

	it("dedupes a tag key shared by two items", () => {
		const items = [
			{ key: "a", tags: ["fixture-positive"] },
			{ key: "b", tags: ["fixture-positive"] }
		];

		expect(buildTagReference(items, FIXTURE_TAGS).tagGroups).toEqual([
			{ label: "Rare Benefits (+2)", tags: [FIXTURE_TAGS[0]] }
		]);
	});

	it("reports hasTags false and an empty tagGroups for an empty item list", () => {
		expect(buildTagReference([], FIXTURE_TAGS)).toEqual({ tagGroups: [], hasTags: false });
	});

	it("reports hasTags false when no item carries a tags field at all", () => {
		const items = [{ key: "a" }, { key: "b" }];
		expect(buildTagReference(items, FIXTURE_TAGS)).toEqual({ tagGroups: [], hasTags: false });
	});
});

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

describe("wirePickerTabs", () => {
	it("wires a click handler onto [data-picker-tab]", () => {
		const state = fakePickerTabsHtml();
		wirePickerTabs(state.html);

		expect(state.handler).toEqual(expect.any(Function));
	});

	it("switches the active tab and panel to the clicked target", () => {
		const state = fakePickerTabsHtml();
		wirePickerTabs(state.html);

		state.handler({ currentTarget: { dataset: { pickerTab: "tags" } } });

		expect(state.removeClassCalls).toContainEqual(["[data-picker-tab]", "active"]);
		expect(state.addClassCalls).toContainEqual(["[data-picker-tab='tags']", "active"]);
		expect(state.removeClassCalls).toContainEqual(["[data-picker-tab-panel]", "active"]);
		expect(state.addClassCalls).toContainEqual(["[data-picker-tab-panel='tags']", "active"]);
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
			tier: TIER_MIN,
			tierMin: TIER_MIN,
			tierMax: TIER_MAX,
			// Grouped by value (see the groupEquipmentTags describe block below for the grouping
			// rules themselves) — FIXTURE_TAGS has no -2 entry, so only three groups render, and
			// every tag starts unchecked/every group starts closed since nothing is being edited.
			tagGroups: [
				{
					label: "Minor Drawbacks (-1)",
					tags: [{ key: "fixture-negative", label: "Fixture Negative", value: -1, description: "b", checked: false }],
					open: false
				},
				{
					label: "Strong Benefits (+1)",
					tags: [{ key: "fixture-spendable", label: "Fixture Spendable", value: 1, description: "c", checked: false }],
					open: false
				},
				{
					label: "Rare Benefits (+2)",
					tags: [{ key: "fixture-positive", label: "Fixture Positive", value: 2, description: "a", checked: false }],
					open: false
				}
			]
		}));
		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Add Equipment");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides Drain 1/2/3 from the mundane (non-astirWeapon) flow's tag checkboxes", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toEqual(expect.arrayContaining(["drain-1", "drain-2", "drain-3"]));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("excludes Melee/Ranged/Sniper from the checkbox tag groups entirely — they render as their own radio group instead", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toEqual(expect.arrayContaining(["melee", "ranged", "sniper"]));
		// Melee/Ranged/Sniper were the only value: 0 tags, so the whole band disappears.
		expect(tagGroups.map((group) => group.label)).not.toContain("No Effect (0)");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults weaponRangeOptions to Melee checked when creating blank", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const { weaponRangeOptions } = renderTemplate.mock.calls.at(-1)[1];
		expect(weaponRangeOptions).toEqual([
			expect.objectContaining({ key: "melee", checked: true }),
			expect.objectContaining({ key: "ranged", checked: false }),
			expect.objectContaining({ key: "sniper", checked: false })
		]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("pre-checks the entry's existing range tag when editing, instead of the default", async () => {
		const entry = { id: "abc", name: "Rayrifle", tags: ["sniper"] };
		const promise = configureEquipment(entry, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const { weaponRangeOptions } = renderTemplate.mock.calls.at(-1)[1];
		expect(weaponRangeOptions).toEqual([
			expect.objectContaining({ key: "melee", checked: false }),
			expect.objectContaining({ key: "ranged", checked: false }),
			expect.objectContaining({ key: "sniper", checked: true })
		]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("falls back to the default range option when editing an entry with no range tag at all", async () => {
		// Covers a Gear item being reconfigured, or old/stale data — either way `tags` carries none
		// of Melee/Ranged/Sniper, so the same first-group-member fallback as a blank create applies.
		const entry = { id: "abc", name: "Rations", tags: [] };
		const promise = configureEquipment(entry, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const { weaponRangeOptions } = renderTemplate.mock.calls.at(-1)[1];
		expect(weaponRangeOptions.find((option) => option.key === "melee").checked).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("renders no weaponRangeOptions when the injected tag catalog has none", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			weaponRangeOptions: []
		}));

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
			tier: 3,
			// The group holding fixture-negative (already on the entry) opens; the groups holding
			// only fixture-spendable/fixture-positive (not on the entry) stay closed.
			tagGroups: [
				expect.objectContaining({
					label: "Minor Drawbacks (-1)",
					tags: [expect.objectContaining({ key: "fixture-negative", checked: true })],
					open: true
				}),
				expect.objectContaining({
					label: "Strong Benefits (+1)",
					tags: [expect.objectContaining({ key: "fixture-spendable", checked: false })],
					open: false
				}),
				expect.objectContaining({
					label: "Rare Benefits (+2)",
					tags: [expect.objectContaining({ key: "fixture-positive", checked: false })],
					open: false
				})
			]
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

	it("resolves a weapon's name, description, kind and tags when Save is clicked, always as Foot Scale with no stored tier", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "  Halberd  ",
			"[name='kind']": "weapon",
			"[name='description']": "  A long blade.  "
		}, ["fixture-positive", "fixture-negative"], "fixture-melee"));

		expect(await promise).toEqual({
			name: "Halberd",
			description: "A long blade.",
			kind: "weapon",
			tags: ["fixture-melee", "fixture-positive", "fixture-negative"],
			scale: "foot"
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
		state.handlers.change({ target: { value: "fixture-spendable", checked: true } });
		expect(state.total).toBe(3);

		state.checkedTags = ["fixture-negative"];
		state.handlers.change({ target: { value: "fixture-positive", checked: false } });
		expect(state.total).toBe(-1);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("unchecks a tag's exclusiveGroup sibling(s) when it's checked", async () => {
		const promise = configureEquipment(null, FIXTURE_EXCLUSIVE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = ["fixture-exclusive-a", "fixture-exclusive-b"];
		state.handlers.change({ target: { value: "fixture-exclusive-b", checked: true } });

		expect(state.uncheckedKeys).toEqual(["fixture-exclusive-a"]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("doesn't uncheck an exclusiveGroup sibling when the changed tag is unchecked, not checked", async () => {
		const promise = configureEquipment(null, FIXTURE_EXCLUSIVE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = [];
		state.handlers.change({ target: { value: "fixture-exclusive-a", checked: false } });

		expect(state.uncheckedKeys).toEqual([]);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("leaves a non-exclusive tag checked when an exclusiveGroup tag changes", async () => {
		const promise = configureEquipment(null, FIXTURE_EXCLUSIVE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = ["fixture-solo", "fixture-exclusive-a"];
		state.handlers.change({ target: { value: "fixture-exclusive-a", checked: true } });

		// fixture-solo isn't in the group, so it's never targeted; fixture-exclusive-b is the group
		// sibling and gets a (harmless, idempotent-in-a-real-DOM) uncheck regardless of whether it
		// was actually checked.
		expect(state.uncheckedKeys).toEqual(["fixture-exclusive-b"]);
		expect(state.uncheckedKeys).not.toContain("fixture-solo");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves null and warns when a weapon is saved with no Range radio checked (defensive fallback — the radio always has a default in normal use)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Cannon",
			"[name='kind']": "weapon",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": "1"
		}, ["blitz"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("saves a weapon once one of Melee/Ranged/Sniper is selected", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Cannon",
			"[name='kind']": "weapon",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": "1"
		}, [], "sniper"));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["sniper"] }));
	});

	it("doesn't require Melee/Ranged/Sniper for Gear", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["blitz"]));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["blitz"] }));
	});

	it("never merges the Range radio's value into Gear's tags, even though the field is always rendered in the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["blitz"], "melee"));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["blitz"] }));
	});

	it(`resolves null and warns when more than ${MAX_TAGS} regular tags are checked`, async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["blitz", "concealable", "impact", "infinite", "mounted"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it(`allows exactly ${MAX_TAGS} regular tags`, async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["blitz", "concealable", "impact", "infinite"]));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["blitz", "concealable", "impact", "infinite"] }));
	});

	it("counts a Drain tag against the MAX_TAGS cap, unlike Melee/Ranged/Sniper", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["blitz", "concealable", "impact", "infinite", "drain-1"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("configureEquipment - astirWeapon option", () => {
	it("passes astirWeapon through to the template, forcing isWeapon true regardless of initial.kind", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			astirWeapon: true,
			isWeapon: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves kind: weapon without ever reading a Kind field from the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Lance",
			"[name='description']": "A long spear."
		}, [], "melee"));

		expect(await promise).toEqual({ name: "Lance", description: "A long spear.", kind: "weapon", tags: ["melee"] });
	});

	it("never resolves scale or tier, even if somehow present in the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Lance",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": "5"
		}, [], "melee"));

		const result = await promise;
		expect(result.scale).toBeUndefined();
		expect(result.tier).toBeUndefined();
	});

	it("still requires one of the Melee/Ranged/Sniper tags (defensive fallback)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Lance",
			"[name='description']": ""
		}, ["blitz"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("still enforces MAX_TAGS", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Lance",
			"[name='description']": ""
		}, ["blitz", "concealable", "impact", "infinite", "mounted", "restraining"], "melee"));

		expect(await promise).toBeNull();
	});

	it("still offers Drain 1/2/3 in the tag checkboxes", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).toEqual(expect.arrayContaining(["drain-1", "drain-2", "drain-3"]));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("configureEquipment - starting gear budget options", () => {
	it("removes excludedTagKeys entries from the rendered tagGroups", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { excludedTagKeys: ["fixture-positive"] });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toContain("fixture-positive");
		expect(renderedKeys).toEqual(expect.arrayContaining(["fixture-negative", "fixture-spendable"]));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes maxTagValue and hasTagValueCap through to the template", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 2 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			maxTagValue: 2,
			hasTagValueCap: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("saves when the checked tag total is exactly at maxTagValue", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 2 });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["fixture-positive"]));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["fixture-positive"] }));
	});

	it("resolves null and warns when the checked tag total exceeds maxTagValue", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 1 });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["fixture-positive"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("never blocks a save on tag total when maxTagValue is null (the default), unaffected for every existing caller", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["fixture-positive", "fixture-spendable"]));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["fixture-positive", "fixture-spendable"] }));
	});
});

describe("configureEquipment - carrierWeapon option", () => {
	it("passes carrierWeapon through to the template, hiding Kind and pre-filling TIER_MAX", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			carrierWeapon: true,
			hideKind: true,
			isWeapon: true,
			tier: TIER_MAX
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves kind: weapon and scale: astir without ever reading those fields from the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Ram Cannon",
			"[name='description']": "A hull-mounted cannon.",
			"[name='tier']": "3"
		}, [], "melee"));

		expect(await promise).toEqual({
			name: "Ram Cannon",
			description: "A hull-mounted cannon.",
			kind: "weapon",
			tags: ["melee"],
			scale: "astir",
			tier: TIER_MAX
		});
	});

	it("always resolves Tier 5, even if a different value is present in the (disabled) DOM field", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Ram Cannon",
			"[name='description']": "",
			"[name='tier']": "1"
		}, [], "melee"));

		expect((await promise).tier).toBe(TIER_MAX);
	});

	it("still requires one of the Melee/Ranged/Sniper tags (defensive fallback)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Ram Cannon",
			"[name='description']": ""
		}, ["blitz"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("hides Drain 1/2/3 from the tag checkboxes — a Carrier weapon is never an Astir weapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toEqual(expect.arrayContaining(["drain-1", "drain-2", "drain-3"]));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("configureEquipment - ardentWeapon option", () => {
	it("hides Kind and Tier in the template, forcing isWeapon true", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			hideKind: true,
			hideTier: true,
			isWeapon: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves kind: weapon without ever reading a Kind field from the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Spear",
			"[name='description']": "A long spear."
		}, [], "melee"));

		expect(await promise).toEqual({ name: "Spear", description: "A long spear.", kind: "weapon", tags: ["melee"] });
	});

	it("never resolves scale or tier, even if somehow present in the DOM", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Spear",
			"[name='description']": "",
			"[name='scale']": "foot",
			"[name='tier']": "5"
		}, [], "melee"));

		const result = await promise;
		expect(result.scale).toBeUndefined();
		expect(result.tier).toBeUndefined();
	});

	it("still requires one of the Melee/Ranged/Sniper tags (defensive fallback)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Spear",
			"[name='description']": ""
		}, ["blitz"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("hides Drain 1/2/3 from the tag checkboxes — an Ardent has no Power for Drain to reduce", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toEqual(expect.arrayContaining(["drain-1", "drain-2", "drain-3"]));

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
