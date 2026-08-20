import { beforeEach, describe, expect, it, vi } from "vitest";

import { EQUIPMENT_TAGS, OVERRIDE_MAX_TAG_VALUE, TIER_MAX, configureEquipment } from "../scripts/equipment/equipment.js";

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
		}, [
			"blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "restraining"
		], "melee"));

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

	it("omits Ward from the tag checkboxes — gearOnly tags can't reach a weapon this way", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toContain("ward");

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

describe("configureEquipment - lockTags option", () => {
	it("defaults to false, unaffected for every existing caller", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			lockTags: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes lockTags: true through to the template alongside astirWeapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			astirWeapon: true,
			lockTags: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes lockTags: true through to the template alongside ardentWeapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true, lockTags: true });
		await Promise.resolve();
		await Promise.resolve();

		// ardentWeapon itself isn't a template field (only hideKind/hideTier/isWeapon derive from
		// it, same as the existing ardentWeapon-option describe block above) — lockTags is.
		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			hideKind: true,
			hideTier: true,
			lockTags: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves null and warns with the blank-name reason on Save when locked and unnamed", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { lockTags: true });
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "   ",
			"[name='kind']": "weapon",
			"[name='description']": ""
		}));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalledWith("Equipment needs a name.");
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

	it("omits Ward from the tag checkboxes — gearOnly tags can't reach a weapon this way", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toContain("ward");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults carrierWeaponTier to TIER_MAX, unaffected for every existing caller", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			tier: TIER_MAX
		}));

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Ram Cannon",
			"[name='description']": ""
		}, [], "melee"));

		expect((await promise).tier).toBe(TIER_MAX);
	});

	it("honors a non-default carrierWeaponTier, both pre-filled and on resolve", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true, carrierWeaponTier: 3 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			tier: 3
		}));

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Boarding Claw",
			"[name='description']": "",
			"[name='tier']": "5"
		}, [], "melee"));

		expect((await promise).tier).toBe(3);
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

	it("omits Ward from the tag checkboxes — gearOnly tags can't reach a weapon this way", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const { tagGroups } = renderTemplate.mock.calls.at(-1)[1];
		const renderedKeys = tagGroups.flatMap((group) => group.tags.map((tag) => tag.key));
		expect(renderedKeys).not.toContain("ward");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

describe("configureEquipment - Override Max scope", () => {
	it("shows the override block for the plain Equipment-tab weapon flow (maxTagValue: 0)", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 0 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true,
			hasOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides the override block when maxTagValue is null (no cap), unaffected for every caller with no budget rule", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides the override block for carrierWeapon even though it carries its own numeric per-slot cap", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true, maxTagValue: 2 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shows the override block for the astirWeapon custom-weapon flow (maxTagValue: 0)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shows the override block for the ardentWeapon custom-weapon flow (maxTagValue: 0)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { ardentWeapon: true, maxTagValue: 0 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides the override block for a locked, catalog-picked weapon -- lockTags implies maxTagValue: null, nothing to override", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("starts already overridden (hasOverride: true) when initial.maxTagValueOverride differs from the base maxTagValue", async () => {
		const entry = { id: "abc", name: "Lance", kind: "weapon", tags: [], maxTagValueOverride: OVERRIDE_MAX_TAG_VALUE };
		const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true,
			hasOverride: true,
			maxTagValue: 0
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("defaults allowOverride to false for a carrierWeapon caller (the Add-flow shape), unaffected for every existing caller", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true, maxTagValue: 2 });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shows the override block for carrierWeapon once allowOverride is explicitly true (the Edit-path opt-in)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { carrierWeapon: true, maxTagValue: 2, allowOverride: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shows the override block for a locked, catalog-picked weapon once allowOverride is explicitly true (the Edit-path opt-in)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: true
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("still hides the override block for a locked Gear catalog pick even with allowOverride: true -- isWeapon gates it regardless", async () => {
		const promise = configureEquipment({ kind: "gear" }, EQUIPMENT_TAGS, { lockTags: true, allowOverride: true });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
			showOverride: false
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});
});

