import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	EQUIPMENT_TAGS,
	MAX_TAGS,
	OVERRIDE_MAX_TAG_VALUE,
	TIER_MAX,
	TIER_MIN,
	configureEquipment
} from "../scripts/equipment/equipment.js";

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
function fakeEquipmentRenderHtml({ name = "", kind = "gear", weaponRange } = {}) {
	const state = {
		handlers: {},
		total: undefined,
		checkedTags: [],
		uncheckedKeys: [],
		name,
		kind,
		weaponRange,
		saveDisabled: undefined,
		saveDisabledClass: undefined,
		saveGateTooltip: undefined,
		gearOnlyHidden: undefined,
		gearOnlyUnchecked: false,
		overrideBlockVisible: undefined,
		overrideButtonMode: "override",
		overrideButtonLabel: "Override Max",
		overrideButtonHandlers: undefined,
		reminderVisible: undefined,
		maxValueDisplay: undefined,
		unlockedDisabled: undefined
	};
	// The "Override Max"/"Lock Max" button's own fake, kept as one stable object reference (rather
	// than a fresh one per .find() call) since configureEquipment's render callback chains
	// `.attr("data-mode", ...).text(...)` off a single `overrideButton` variable captured once —
	// `.attr(name)` (one argument) reads the current mode back, mirroring how the real DOM attribute
	// a click handler reads its own current mode from.
	const overrideButtonFake = {
		attr: (attrName, value) => {
			if (value === undefined) return state.overrideButtonMode;
			if (attrName === "data-mode") state.overrideButtonMode = value;
			return overrideButtonFake;
		},
		text: (value) => { state.overrideButtonLabel = value; return overrideButtonFake; },
		on: (event, handler) => { state.overrideButtonHandlers = { ...state.overrideButtonHandlers, [event]: handler }; }
	};
	state.html = {
		find: (selector) => {
			if (selector === ".equipment-editor-max-override") {
				return {
					show: () => { state.overrideBlockVisible = true; },
					hide: () => { state.overrideBlockVisible = false; }
				};
			}
			if (selector === ".equipment-editor-max-override-button") return overrideButtonFake;
			// The catalog-unlock click handler's single combined-selector .find() call (see
			// equipment-dialogs.js's override-button click handler) — records whatever `disabled`
			// value it's set to, mirroring the other `.prop(name, value)` capture fakes below. Real
			// jQuery matches whichever of Kind/Tier/Range/Tag actually exist in the DOM and no-ops on
			// the rest; this fake can't distinguish per-field, so it only proves the call itself
			// happened with the right value.
			if (selector === "[name='kind'], [name='tier'], [name='weapon-range'], [name='tag']") {
				return { prop: (name, value) => { if (name === "disabled") state.unlockedDisabled = value; } };
			}
			if (selector === ".equipment-editor-max-override-reminder") {
				return { toggle: (visible) => { state.reminderVisible = visible; } };
			}
			if (selector === ".equipment-editor-tag-max-value") {
				return { text: (value) => { state.maxValueDisplay = value; } };
			}
			if (selector === "[name='tag']") return { on: (event, handler) => { state.handlers[event] = handler; } };
			if (selector === "[name='tag']:checked") {
				return { map: (fn) => ({ get: () => state.checkedTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === ".equipment-editor-tag-total-value") return { text: (value) => { state.total = value; } };
			// name/kind/weapon-range mirror fakeEquipmentHtml's .val() reads (used by isValid, live as
			// the dialog is open) while also capturing the listener configureEquipment's render callback
			// wires to each, the same way `[name='tag']` already does above for its own change handler.
			if (selector === "[name='name']") {
				return {
					val: () => state.name,
					on: (event, handler) => { state.nameHandlers = { ...state.nameHandlers, [event]: handler }; }
				};
			}
			if (selector === "[name='kind']") {
				return {
					val: () => state.kind,
					on: (event, handler) => { state.kindHandlers = { ...state.kindHandlers, [event]: handler }; }
				};
			}
			if (selector === "[name='weapon-range']:checked") return { val: () => state.weaponRange };
			if (selector === "[name='weapon-range']") {
				return { on: (event, handler) => { state.weaponRangeHandlers = { ...state.weaponRangeHandlers, [event]: handler }; } };
			}
			// Captures Save's live disabled/enabled state and its .disabled class + data-gate-tooltip
			// attribute (the weapon-move-roll gated-button pattern — see equipment-dialogs.js's
			// updateSaveState), mirroring the exclusiveGroup uncheck capture just below for the same
			// `.prop(name, value)` shape.
			if (selector === "[data-button='save']") {
				return {
					prop: (prop, value) => { if (prop === "disabled") state.saveDisabled = value; },
					toggleClass: (cls, value) => { if (cls === "disabled") state.saveDisabledClass = value; },
					attr: (attr, value) => { if (attr === "data-gate-tooltip") state.saveGateTooltip = value; },
					removeAttr: (attr) => { if (attr === "data-gate-tooltip") state.saveGateTooltip = undefined; }
				};
			}
			const tagCheckboxMatch = selector.match(/^\[name='tag'\]\[value='(.+)'\]$/);
			if (tagCheckboxMatch) {
				const key = tagCheckboxMatch[1];
				return { prop: (name, value) => { if (name === "checked" && value === false) state.uncheckedKeys.push(key); } };
			}
			if (selector === ".equipment-editor-tag[data-gear-only='true']") {
				return {
					hide: () => { state.gearOnlyHidden = true; },
					show: () => { state.gearOnlyHidden = false; },
					find: (innerSelector) => {
						if (innerSelector === "[name='tag']") {
							return { prop: (name, value) => { if (name === "checked" && value === false) state.gearOnlyUnchecked = true; } };
						}
						return {};
					}
				};
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

	it("starts Save disabled when opening a blank Add dialog", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.saveDisabled).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("enables Save once a name is typed into the name field", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.saveDisabled).toBe(true);

		state.name = "Rations";
		state.nameHandlers.input();

		expect(state.saveDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it(`re-disables Save when checking enough tags to exceed ${MAX_TAGS}`, async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.saveDisabled).toBe(false);

		state.checkedTags = [
			"blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "fragile"
		];
		state.handlers.change({ target: { value: "fragile", checked: true } });

		expect(state.saveDisabled).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-disables Save when checked tags' summed value exceeds an injected maxTagValue", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 1 });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.saveDisabled).toBe(false);

		state.checkedTags = ["fixture-positive"];
		state.handlers.change({ target: { value: "fixture-positive", checked: true } });

		expect(state.saveDisabled).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-disables Save when Ward is checked while Kind is weapon (a gearOnly tag)", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations", kind: "weapon", weaponRange: "melee" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.saveDisabled).toBe(false);

		state.checkedTags = ["ward"];
		state.handlers.change({ target: { value: "ward", checked: true } });

		expect(state.saveDisabled).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides and unchecks Ward immediately when a dialog opens already at Kind = weapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Halberd", kind: "weapon", weaponRange: "melee" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.gearOnlyHidden).toBe(true);
		expect(state.gearOnlyUnchecked).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("leaves Ward visible when a dialog opens at Kind = gear", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Ward Charm", kind: "gear" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.gearOnlyHidden).toBe(false);
		expect(state.gearOnlyUnchecked).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("hides Ward reactively when Kind is switched from gear to weapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Ward Charm", kind: "gear" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.gearOnlyHidden).toBe(false);

		state.kind = "weapon";
		state.kindHandlers.change();

		expect(state.gearOnlyHidden).toBe(true);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("shows Ward again reactively when Kind is switched from weapon back to gear", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Halberd", kind: "weapon", weaponRange: "melee" });
		Dialog.mock.calls.at(-1)[0].render(state.html);
		expect(state.gearOnlyHidden).toBe(true);

		state.kind = "gear";
		state.kindHandlers.change();

		expect(state.gearOnlyHidden).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("starts Save enabled when opening an Edit dialog with a valid pre-filled name", async () => {
		const entry = { id: "abc", name: "Halberd", tags: [] };
		const promise = configureEquipment(entry, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Halberd" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.saveDisabled).toBe(false);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("toggles the Save button's disabled class and gate-tooltip to the disabled reason, and clears them once valid", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml();
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.saveDisabledClass).toBe(true);
		expect(state.saveGateTooltip).toBe("Equipment needs a name.");

		state.name = "Rations";
		state.nameHandlers.input();

		expect(state.saveDisabledClass).toBe(false);
		expect(state.saveGateTooltip).toBeUndefined();

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("sets the Save button's gate-tooltip to the MAX_TAGS-exceeded reason", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = [
			"blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "fragile"
		];
		state.handlers.change({ target: { value: "fragile", checked: true } });

		expect(state.saveDisabledClass).toBe(true);
		expect(state.saveGateTooltip).toBe(`Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`);

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("sets the Save button's gate-tooltip to the maxTagValue-exceeded reason", async () => {
		const promise = configureEquipment(null, FIXTURE_TAGS, { maxTagValue: 1 });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = ["fixture-positive"];
		state.handlers.change({ target: { value: "fixture-positive", checked: true } });

		expect(state.saveDisabledClass).toBe(true);
		expect(state.saveGateTooltip).toBe("This equipment's tags can total at most 1.");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("sets the Save button's gate-tooltip to the missing-weapon-range reason", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Lance" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.saveDisabledClass).toBe(true);
		expect(state.saveGateTooltip).toBe("A weapon needs one of the Melee, Ranged or Sniper tags.");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("sets the Save button's gate-tooltip to the gearOnly-on-a-weapon reason", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Rations", kind: "weapon", weaponRange: "melee" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		state.checkedTags = ["ward"];
		state.handlers.change({ target: { value: "ward", checked: true } });

		expect(state.saveDisabledClass).toBe(true);
		expect(state.saveGateTooltip).toBe("Ward can only be added to Gear, not Weapons.");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("re-derives the disabled reason directly at Save time (Enter-to-submit), independent of the DOM's live disabled state", async () => {
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

	describe("lockTags option", () => {
		it("renders every field disabled while still allowing Kind/Tier/Range/Tags to be passed through unlocked-looking template data", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { lockTags: true });
			await Promise.resolve();
			await Promise.resolve();

			expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
				lockTags: true
			}));

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("enables Save with just a name, ignoring tag/kind/range validity entirely", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { lockTags: true });
			await Promise.resolve();
			await Promise.resolve();

			// No weapon-range checked and Kind is "weapon" — normally invalid — but lockTags
			// short-circuits invalidReason to just the blank-name check.
			const state = fakeEquipmentRenderHtml({ name: "Halberd", kind: "weapon" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.saveDisabled).toBe(false);
			expect(state.saveDisabledClass).toBe(false);
			expect(state.saveGateTooltip).toBeUndefined();

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("still disables Save (with the blank-name reason) when the name is empty", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { lockTags: true });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "", kind: "weapon" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.saveDisabled).toBe(true);
			expect(state.saveDisabledClass).toBe(true);
			expect(state.saveGateTooltip).toBe("Equipment needs a name.");

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("resolves the (unchanged) picked template's fields on Save, once a name is present", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true });
			await Promise.resolve();
			await Promise.resolve();

			const dialogOptions = Dialog.mock.calls.at(-1)[0];
			dialogOptions.buttons.save.callback(fakeEquipmentHtml({
				"[name='name']": "Lance",
				"[name='description']": "A long spear."
			}, ["drain-1"], "melee"));

			expect(await promise).toEqual({
				name: "Lance",
				description: "A long spear.",
				kind: "weapon",
				tags: ["melee", "drain-1"]
			});
		});
	});

	describe("Override Max option", () => {
		it("shows the override block on initial render for a weapon flow with a numeric cap (astirWeapon)", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.overrideBlockVisible).toBe(true);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("shows the override block on initial render for the generic caller when it opens at Kind = weapon", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Halberd", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.overrideBlockVisible).toBe(true);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("hides the override block on initial render for the generic caller when it opens at Kind = gear", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Rations", kind: "gear" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.overrideBlockVisible).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("hides the override block reactively when Kind is switched from weapon to gear, resetting the effective cap", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Halberd", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);
			expect(state.overrideBlockVisible).toBe(true);

			state.overrideButtonHandlers.click();
			expect(state.maxValueDisplay).toBe(OVERRIDE_MAX_TAG_VALUE);

			state.kind = "gear";
			state.kindHandlers.change();

			expect(state.overrideBlockVisible).toBe(false);
			expect(state.overrideButtonMode).toBe("override");
			expect(state.overrideButtonLabel).toBe("Override Max");
			// Reset all the way back to the base cap (0 here), not left at the flat override ceiling.
			expect(state.maxValueDisplay).toBe(0);
			expect(state.reminderVisible).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("shows the override block again when Kind is switched back to weapon", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Rations", kind: "gear" });
			Dialog.mock.calls.at(-1)[0].render(state.html);
			expect(state.overrideBlockVisible).toBe(false);

			state.kind = "weapon";
			state.weaponRange = "melee";
			state.kindHandlers.change();

			expect(state.overrideBlockVisible).toBe(true);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("clicking Override Max raises the effective cap to OVERRIDE_MAX_TAG_VALUE, flips the button to Lock Max, shows the reminder, and updates the max readout", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);
			expect(state.reminderVisible).toBe(false);
			expect(state.maxValueDisplay).toBe(0);

			state.overrideButtonHandlers.click();

			expect(state.overrideButtonMode).toBe("lock");
			expect(state.overrideButtonLabel).toBe("Lock Max");
			expect(state.reminderVisible).toBe(true);
			expect(state.maxValueDisplay).toBe(OVERRIDE_MAX_TAG_VALUE);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("allows Save once Override Max is clicked and checked tags total between the base cap and the raised ceiling (previously blocked)", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			// Blitz is worth +1 — over the base cap of 0, blocking Save until Override Max is clicked.
			state.checkedTags = ["blitz"];
			state.handlers.change({ target: { value: "blitz", checked: true } });
			expect(state.saveDisabled).toBe(true);

			state.overrideButtonHandlers.click();

			expect(state.saveDisabled).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("clicking Lock Max commits the effective cap to the current tag total, floored at 0, and flips the button back to Override Max", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			state.overrideButtonHandlers.click();
			state.checkedTags = ["blitz"];
			state.handlers.change({ target: { value: "blitz", checked: true } });

			state.overrideButtonHandlers.click();

			expect(state.overrideButtonMode).toBe("override");
			expect(state.overrideButtonLabel).toBe("Override Max");
			expect(state.maxValueDisplay).toBe(1);
			// Still above the base cap of 0, so the reminder stays up.
			expect(state.reminderVisible).toBe(true);
			expect(state.saveDisabled).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("hides the reminder once Lock Max commits the effective cap back down to exactly the base cap", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			state.overrideButtonHandlers.click();
			// Nothing checked -- Lock Max should floor the total at 0, exactly the base cap.
			state.overrideButtonHandlers.click();

			expect(state.maxValueDisplay).toBe(0);
			expect(state.reminderVisible).toBe(false);
			expect(state.saveDisabled).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("starts already overridden when initial.maxTagValueOverride differs from the base maxTagValue", async () => {
			const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"], maxTagValueOverride: 3 };
			const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("equipment-editor"), expect.objectContaining({
				hasOverride: true,
				maxTagValue: 0
			}));

			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			Dialog.mock.calls.at(-1)[0].render(state.html);

			// The button rests at "Override Max" even though a persisted override is already active
			// (see the design note in equipment-dialogs.js) -- only the readout and reminder reflect it.
			expect(state.overrideButtonMode).toBe("override");
			expect(state.overrideButtonLabel).toBe("Override Max");
			expect(state.maxValueDisplay).toBe(3);
			expect(state.reminderVisible).toBe(true);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("resolves maxTagValueOverride on Save when still overridden, without needing Lock Max clicked first", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const dialogOptions = Dialog.mock.calls.at(-1)[0];
			// Raises the live effective cap via a real Override Max click first -- without it, checking
			// Blitz (worth 1, over the base cap of 0) would make invalidReason block Save entirely,
			// same as before this feature existed.
			const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
			dialogOptions.render(state.html);
			state.overrideButtonHandlers.click();

			dialogOptions.buttons.save.callback(fakeEquipmentHtml({
				"[name='name']": "Lance",
				"[name='description']": ""
			}, ["blitz"], "melee"));

			expect(await promise).toEqual(expect.objectContaining({ maxTagValueOverride: 1 }));
		});

		it("omits maxTagValueOverride on Save when never overridden", async () => {
			const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const dialogOptions = Dialog.mock.calls.at(-1)[0];
			dialogOptions.buttons.save.callback(fakeEquipmentHtml({
				"[name='name']": "Lance",
				"[name='description']": ""
			}, [], "melee"));

			const result = await promise;
			expect(result).not.toBeNull();
			expect(result).not.toHaveProperty("maxTagValueOverride");
		});

		it("omits maxTagValueOverride on Save when locked back down to exactly the base cap (no field, not maxTagValueOverride: 0)", async () => {
			const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"], maxTagValueOverride: 3 };
			const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, maxTagValue: 0 });
			await Promise.resolve();
			await Promise.resolve();

			const dialogOptions = Dialog.mock.calls.at(-1)[0];
			dialogOptions.buttons.save.callback(fakeEquipmentHtml({
				"[name='name']": "Lance",
				"[name='description']": ""
			}, [], "melee"));

			const result = await promise;
			expect(result).not.toHaveProperty("maxTagValueOverride");
		});

		it("behaves like the pre-existing raise-the-cap mechanism for carrierWeapon + allowOverride: true, not the catalog-unlock mechanism (never lockTags, nothing to unlock)", async () => {
			const entry = { id: "abc", name: "Ram Cannon", kind: "weapon", tags: ["melee"] };
			const promise = configureEquipment(entry, EQUIPMENT_TAGS, { carrierWeapon: true, maxTagValue: 2, allowOverride: true });
			await Promise.resolve();
			await Promise.resolve();

			const dialogOptions = Dialog.mock.calls.at(-1)[0];
			const state = fakeEquipmentRenderHtml({ name: "Ram Cannon", weaponRange: "melee" });
			dialogOptions.render(state.html);

			state.overrideButtonHandlers.click();
			// The combined-selector unlock .find() is only ever called for a lockTags entry -- a
			// carrierWeapon caller is never lockTags, so nothing here is unlocked, just the cap raised.
			expect(state.unlockedDisabled).toBeUndefined();
			expect(state.maxValueDisplay).toBe(OVERRIDE_MAX_TAG_VALUE);

			state.checkedTags = ["blitz"];
			state.handlers.change({ target: { value: "blitz", checked: true } });

			state.overrideButtonHandlers.click();
			expect(state.overrideButtonMode).toBe("override");
			expect(state.maxValueDisplay).toBe(1);

			dialogOptions.buttons.save.callback(fakeEquipmentHtml({
				"[name='name']": "Ram Cannon",
				"[name='description']": "",
				"[name='tier']": "5"
			}, ["blitz"], "melee"));

			const result = await promise;
			expect(result).not.toHaveProperty("catalogSource");
			expect(result).toHaveProperty("maxTagValueOverride", 1);
		});

		describe("catalog unlock (lockTags + allowOverride: true, the Edit-only escape hatch)", () => {
			it("leaves fields locked and validation short-circuited until Override Max is actually clicked", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				// No weapon-range checked in the DOM and no tags checked -- normally invalid -- but the
				// still-locked entry short-circuits invalidReason to just the blank-name check.
				expect(state.saveDisabled).toBe(false);
				expect(state.unlockedDisabled).toBeUndefined();

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});

			it("clicking Override Max on a locked entry unlocks the disabled fields and raises the cap to OVERRIDE_MAX_TAG_VALUE", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				state.overrideButtonHandlers.click();

				expect(state.unlockedDisabled).toBe(false);
				expect(state.overrideButtonMode).toBe("lock");
				expect(state.overrideButtonLabel).toBe("Lock Max");
				expect(state.maxValueDisplay).toBe(OVERRIDE_MAX_TAG_VALUE);

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});

			it("makes the MAX_TAGS-exceeded check actually fire once unlocked, where lockTags alone always resolved null", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				state.overrideButtonHandlers.click();
				state.checkedTags = [
					"blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "fragile"
				];
				state.handlers.change({ target: { value: "fragile", checked: true } });

				expect(state.saveDisabled).toBe(true);
				expect(state.saveGateTooltip).toBe(`Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`);

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});

			it("makes the raised-cap budget check actually fire once unlocked, blocking a total over OVERRIDE_MAX_TAG_VALUE", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				state.overrideButtonHandlers.click();
				// ruin/versatile/vorpal are each worth +2 -- three of them total 6, one over the raised
				// OVERRIDE_MAX_TAG_VALUE (5) cap.
				state.checkedTags = ["ruin", "versatile", "vorpal"];
				state.handlers.change({ target: { value: "vorpal", checked: true } });

				expect(state.saveDisabled).toBe(true);
				expect(state.saveGateTooltip).toBe(`This equipment's tags can total at most ${OVERRIDE_MAX_TAG_VALUE}.`);

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});

			it("makes the missing-weapon-range check actually fire once unlocked", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: [] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				state.overrideButtonHandlers.click();

				expect(state.saveDisabled).toBe(true);
				expect(state.saveGateTooltip).toBe("A weapon needs one of the Melee, Ranged or Sniper tags.");

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});

			it("resolves catalogSource: false plus maxTagValueOverride on Save once unlocked with a nonzero tag total", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const dialogOptions = Dialog.mock.calls.at(-1)[0];
				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
				dialogOptions.render(state.html);
				state.overrideButtonHandlers.click();

				dialogOptions.buttons.save.callback(fakeEquipmentHtml({
					"[name='name']": "Lance",
					"[name='description']": ""
				}, ["blitz"], "melee"));

				expect(await promise).toEqual(expect.objectContaining({ catalogSource: false, maxTagValueOverride: 1 }));
			});

			it("resolves catalogSource: false without maxTagValueOverride on Save when unlocked but settled back at exactly 0", async () => {
				const entry = { id: "abc", name: "Lance", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const dialogOptions = Dialog.mock.calls.at(-1)[0];
				const state = fakeEquipmentRenderHtml({ name: "Lance", kind: "weapon", weaponRange: "melee" });
				dialogOptions.render(state.html);
				state.overrideButtonHandlers.click();

				dialogOptions.buttons.save.callback(fakeEquipmentHtml({
					"[name='name']": "Lance",
					"[name='description']": ""
				}, [], "melee"));

				const result = await promise;
				expect(result).toEqual(expect.objectContaining({ catalogSource: false }));
				expect(result).not.toHaveProperty("maxTagValueOverride");
			});

			it("resolves with no catalogSource key at all on Save when Override Max is never clicked, behaving exactly as before this feature", async () => {
				const entry = { id: "abc", name: "Lance", description: "Old text", kind: "weapon", tags: ["melee", "blitz"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { astirWeapon: true, lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const dialogOptions = Dialog.mock.calls.at(-1)[0];
				// Only name/description ever change on a still-locked entry -- the fake DOM's tag/range
				// values below mirror what the (disabled, unclickable) fields still show, same as the
				// pre-existing "resolves the (unchanged) picked template's fields" test above.
				dialogOptions.buttons.save.callback(fakeEquipmentHtml({
					"[name='name']": "Lance",
					"[name='description']": "New text"
				}, ["blitz"], "melee"));

				expect(await promise).toEqual({ name: "Lance", description: "New text", kind: "weapon", tags: ["melee", "blitz"] });
			});

			it("resets the resting effective cap to 0 (not the original null) when Kind is switched away from weapon after an unlock -- the generic caller's own locked weapon catalog pick renders a live Kind select", async () => {
				const entry = { id: "abc", name: "Cannon", kind: "weapon", tags: ["melee"] };
				const promise = configureEquipment(entry, EQUIPMENT_TAGS, { lockTags: true, allowOverride: true });
				await Promise.resolve();
				await Promise.resolve();

				const state = fakeEquipmentRenderHtml({ name: "Cannon", kind: "weapon", weaponRange: "melee" });
				Dialog.mock.calls.at(-1)[0].render(state.html);

				state.overrideButtonHandlers.click();
				expect(state.maxValueDisplay).toBe(OVERRIDE_MAX_TAG_VALUE);

				state.kind = "gear";
				state.kindHandlers.change();

				// Resting baseline is 0 (what _equipmentEditLockState hands back once catalogSource:
				// false is persisted), not the original null base maxTagValue a still-locked entry had.
				expect(state.maxValueDisplay).toBe(0);
				expect(state.reminderVisible).toBe(false);
				expect(state.overrideButtonMode).toBe("override");

				Dialog.mock.calls.at(-1)[0].close();
				await promise;
			});
		});
	});

	it("doesn't wire a Kind change listener for an astirWeapon flow (no Kind select is rendered), and forces kind to weapon so the Range radio still gates Save", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS, { astirWeapon: true });
		await Promise.resolve();
		await Promise.resolve();

		const state = fakeEquipmentRenderHtml({ name: "Lance" });
		Dialog.mock.calls.at(-1)[0].render(state.html);

		expect(state.kindHandlers).toBeUndefined();
		// No Range radio checked yet — kind is forced to "weapon" internally, so Save stays disabled.
		expect(state.saveDisabled).toBe(true);

		state.weaponRange = "melee";
		state.weaponRangeHandlers.change();

		expect(state.saveDisabled).toBe(false);

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
		}, ["blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "fragile"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it(`allows exactly ${MAX_TAGS} regular tags`, async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		const tags = ["blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct"];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Rations",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, tags));

		expect(await promise).toEqual(expect.objectContaining({ tags }));
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
		}, ["blitz", "concealable", "impact", "infinite", "mounted", "decisive", "defensive", "distinct", "drain-1"]));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("resolves null and warns when Ward is checked and Kind is weapon", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Cannon",
			"[name='kind']": "weapon",
			"[name='description']": ""
		}, ["ward"], "melee"));

		expect(await promise).toBeNull();
		expect(ui.notifications.warn).toHaveBeenCalledWith(expect.stringContaining("Ward"));
	});

	it("saves Ward on Gear without triggering the weapon-only restriction", async () => {
		const promise = configureEquipment(null, EQUIPMENT_TAGS);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.save.callback(fakeEquipmentHtml({
			"[name='name']": "Ward Charm",
			"[name='kind']": "gear",
			"[name='description']": ""
		}, ["ward"]));

		expect(await promise).toEqual(expect.objectContaining({ tags: ["ward"] }));
	});
});
