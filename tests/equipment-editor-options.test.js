import { beforeEach, describe, expect, it, vi } from "vitest";

import { EQUIPMENT_TAGS, TIER_MAX, configureEquipment } from "../scripts/equipment/equipment.js";

// A fixture catalog independent of EQUIPMENT_TAGS's real (currently Blitz-only) content, so
// summation/negative-value/multi-tag behavior stays covered as the shipped catalog grows —
// mirrors the injectable `pools` argument playbookMoveSections takes in playbook-moves.js.
const FIXTURE_TAGS = [
	{ key: "fixture-positive", label: "Fixture Positive", value: 2, description: "a" },
	{ key: "fixture-negative", label: "Fixture Negative", value: -1, description: "b" },
	{ key: "fixture-spendable", label: "Fixture Spendable", value: 1, description: "c", spend: { period: "Scene", effect: "confidence" } }
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

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog implementation stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
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

