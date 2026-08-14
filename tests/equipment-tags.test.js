import { describe, expect, it } from "vitest";

import { EFFECT_STATES } from "../scripts/moves/roll-effects.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import {
	DRAIN_GROUP,
	EQUIPMENT_TAGS,
	TAG_VALUE_MAX,
	TAG_VALUE_MIN,
	WEAPON_RANGE_GROUP,
	WEAPON_SCALES,
	baseEquipmentTagKey,
	buildTagReference,
	equipmentValue,
	findEquipmentTag,
	groupEquipmentTags,
	rerollSpendKey,
	rerollSpendKeys,
	resolveEquipmentTags,
	wirePickerTabs,
	withTagLabels
} from "../scripts/equipment/equipment.js";

const BLITZ = EQUIPMENT_TAGS.find((tag) => tag.key === "blitz");

// A fixture catalog independent of EQUIPMENT_TAGS's real (currently Blitz-only) content, so
// summation/negative-value/multi-tag behavior stays covered as the shipped catalog grows —
// mirrors the injectable `pools` argument playbookMoveSections takes in playbook-moves.js.
const FIXTURE_TAGS = [
	{ key: "fixture-positive", label: "Fixture Positive", value: 2, description: "a" },
	{ key: "fixture-negative", label: "Fixture Negative", value: -1, description: "b" },
	{ key: "fixture-spendable", label: "Fixture Spendable", value: 1, description: "c", spend: { period: "Scene", effect: "confidence" } }
];

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

	it("flags Ward as gearOnly", () => {
		expect(EQUIPMENT_TAGS.find((tag) => tag.key === "ward").gearOnly).toBe(true);
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
