import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ARCANIST_RITUALS,
	adaptedWardHold,
	chooseArcanistRituals,
	findArcanistRitual,
	resolveArcanistRituals,
	wardHoldFor
} from "../scripts/playbook/arcanist.js";

const FIXTURE_RITUALS = [
	{ key: "arcanist-ritual:confidence", name: "Make a Move in Confidence", requiresMove: true, rollModifier: { effect: "confidence" } },
	{ key: "arcanist-ritual:aspect", name: "Change Your Astir's Approach", activatesApproach: true },
	{ key: "arcanist-ritual:warding", name: "Hold 2: Ignore a Disadvantage", grantsWardHold: 2, rollModifier: { advantage: "advantage" } }
];

const MOVE_OPTIONS = [{ key: "weather-the-storm", name: "Weather the Storm" }];

// Fakes the jQuery `.find(selector)` chain chooseArcanistRituals uses: each slot's own ritual-type/
// ritual-move <select> resolves via `.val()` (mirroring equipment-dialogs.js's own `.val()` idiom
// for a <select>, not chooseWitchBoons' checkbox `.map().get()`), the confirm button's own
// disabled/class/tooltip state resolves via `[data-button='confirm']` (mirroring
// fakeWitchBoonsRenderHtml's own `[data-button='add']` branch), and each slot's own conditional
// move-select toggles via `[data-move-select='N']`.
function fakeRitualsHtml(values = {}) {
	const state = {
		values: { ...values },
		typeHandlers: {},
		moveHandlers: {},
		moveSelectHidden: {},
		confirmDisabled: undefined,
		confirmDisabledClass: undefined,
		confirmGateTooltip: undefined
	};
	state.html = {
		find: (selector) => {
			if (selector === "[data-button='confirm']") {
				return {
					prop: (name, value) => { if (name === "disabled") state.confirmDisabled = value; },
					toggleClass: (cls, value) => { if (cls === "disabled") state.confirmDisabledClass = value; },
					attr: (attr, value) => { if (attr === "data-gate-tooltip") state.confirmGateTooltip = value; },
					removeAttr: (attr) => { if (attr === "data-gate-tooltip") state.confirmGateTooltip = undefined; }
				};
			}
			const typeMatch = selector.match(/^\[name='ritual-type-(\d+)'\]$/);
			if (typeMatch) {
				const index = Number(typeMatch[1]);
				return {
					val: () => state.values[index]?.ritualKey ?? "",
					on: (event, handler) => { state.typeHandlers[index] = handler; }
				};
			}
			const moveMatch = selector.match(/^\[name='ritual-move-(\d+)'\]$/);
			if (moveMatch) {
				const index = Number(moveMatch[1]);
				return {
					val: () => state.values[index]?.moveKey ?? "",
					on: (event, handler) => { state.moveHandlers[index] = handler; }
				};
			}
			const selectMatch = selector.match(/^\[data-move-select='(\d+)'\]$/);
			if (selectMatch) {
				const index = Number(selectMatch[1]);
				return { toggleClass: (cls, value) => { if (cls === "hidden") state.moveSelectHidden[index] = value; } };
			}
			return {};
		}
	};
	return state;
}

beforeEach(() => {
	vi.resetAllMocks();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	renderTemplate.mockResolvedValue("");
});

describe("ARCANIST_RITUALS", () => {
	it("has exactly 3 rituals, each namespaced arcanist-ritual:...", () => {
		expect(ARCANIST_RITUALS).toHaveLength(3);
		for (const ritual of ARCANIST_RITUALS) {
			expect(ritual.key.startsWith("arcanist-ritual:")).toBe(true);
			expect(ritual.name).toBeTruthy();
			expect(ritual.description).toBeTruthy();
		}
	});

	it("flags the confidence ritual requiresMove, with a confidence-effect rollModifier fragment", () => {
		const confidence = findArcanistRitual("arcanist-ritual:confidence");
		expect(confidence.requiresMove).toBe(true);
		expect(confidence.rollModifier).toEqual({ effect: "confidence" });
	});

	it("flags the aspect ritual activatesApproach, with no rollModifier of its own", () => {
		const aspect = findArcanistRitual("arcanist-ritual:aspect");
		expect(aspect.activatesApproach).toBe(true);
		expect(aspect.rollModifier).toBeUndefined();
	});

	it("flags the warding ritual grantsWardHold: 2, with an ignore-a-disadvantage rollModifier fragment", () => {
		const warding = findArcanistRitual("arcanist-ritual:warding");
		expect(warding.grantsWardHold).toBe(2);
		expect(warding.rollModifier).toEqual({ advantage: "advantage", requiresAdvantage: ["disadvantage", "disadvantage2"] });
	});
});

describe("findArcanistRitual/resolveArcanistRituals", () => {
	it("finds a ritual by key", () => {
		expect(findArcanistRitual("arcanist-ritual:confidence", FIXTURE_RITUALS).name).toBe("Make a Move in Confidence");
	});

	it("returns null for an unknown key", () => {
		expect(findArcanistRitual("arcanist-ritual:nope", FIXTURE_RITUALS)).toBeNull();
	});

	it("resolves stored slots to ritual definitions in position, carrying moveKey through", () => {
		const slots = [
			{ ritualKey: "arcanist-ritual:confidence", moveKey: "weather-the-storm" },
			null,
			{ ritualKey: "arcanist-ritual:warding" }
		];
		const resolved = resolveArcanistRituals(slots, FIXTURE_RITUALS);
		expect(resolved[0].name).toBe("Make a Move in Confidence");
		expect(resolved[0].moveKey).toBe("weather-the-storm");
		expect(resolved[1]).toBeNull();
		expect(resolved[2].name).toBe("Hold 2: Ignore a Disadvantage");
		expect(resolved[2].moveKey).toBeNull();
	});

	it("drops a slot whose ritualKey no longer resolves, to null rather than a hole", () => {
		const resolved = resolveArcanistRituals([{ ritualKey: "arcanist-ritual:deleted" }], FIXTURE_RITUALS);
		expect(resolved).toEqual([null]);
	});

	it("defaults to an empty list when no slots are given", () => {
		expect(resolveArcanistRituals()).toEqual([]);
	});
});

describe("wardHoldFor", () => {
	it("is 0 with no Warding slots prepared", () => {
		expect(wardHoldFor([{ ritualKey: "arcanist-ritual:confidence" }, null, null], FIXTURE_RITUALS)).toBe(0);
	});

	it("is 2 for one Warding slot", () => {
		expect(wardHoldFor([{ ritualKey: "arcanist-ritual:warding" }, null, null], FIXTURE_RITUALS)).toBe(2);
	});

	it("is 4 for two Warding slots", () => {
		expect(wardHoldFor([
			{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, null
		], FIXTURE_RITUALS)).toBe(4);
	});

	it("is 6 for three Warding slots", () => {
		expect(wardHoldFor([
			{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }
		], FIXTURE_RITUALS)).toBe(6);
	});

	it("defaults to an empty slot array", () => {
		expect(wardHoldFor(undefined, FIXTURE_RITUALS)).toBe(0);
	});
});

describe("adaptedWardHold", () => {
	it("preserves already-spent Wardhold across an Adapt that keeps the same Warding count", () => {
		const previous = [{ ritualKey: "arcanist-ritual:warding" }, null, null];
		const next = [{ ritualKey: "arcanist-ritual:warding" }, null, null];
		// wardHoldFor(previous) = 2, current = 1 (1 already spent) -> next max 2 - 1 spent = 1.
		expect(adaptedWardHold(previous, next, 1, FIXTURE_RITUALS)).toBe(1);
	});

	it("raises the new max by the added Warding count, minus whatever was already spent", () => {
		const previous = [{ ritualKey: "arcanist-ritual:warding" }, null, null];
		const next = [{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, null];
		// previous max 2, current 1 (1 spent) -> next max 4 - 1 spent = 3.
		expect(adaptedWardHold(previous, next, 1, FIXTURE_RITUALS)).toBe(3);
	});

	it("floors at 0 when a partly-spent Warding slot is removed entirely", () => {
		const previous = [{ ritualKey: "arcanist-ritual:warding" }, null, null];
		const next = [null, null, null];
		// previous max 2, current 0 (fully spent already) -> next max 0 - 2 spent = -2, floored to 0.
		expect(adaptedWardHold(previous, next, 0, FIXTURE_RITUALS)).toBe(0);
	});

	it("clamps at 6 even if the math would exceed it", () => {
		const previous = [null, null, null];
		const next = [
			{ ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }, { ritualKey: "arcanist-ritual:warding" }
		];
		expect(adaptedWardHold(previous, next, 0, FIXTURE_RITUALS)).toBe(6);
	});
});

describe("chooseArcanistRituals", () => {
	const options = { title: "Prepare Rituals", buttonLabel: "Prepare", instructions: "Choose an effect for each of your 3 rituals." };

	it("renders the picker template with instructions, ritual/move options and 3 blank slots", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("arcanist-rituals-picker"), expect.objectContaining({
			instructions: options.instructions,
			buttonLabel: "Prepare",
			ritualOptions: FIXTURE_RITUALS.map(({ key, name }) => ({ key, name })),
			moveOptions: MOVE_OPTIONS,
			slots: [
				{ index: 0, label: "Ritual 1", locked: false, ritualKey: "", ritualName: "", requiresMove: false, moveKey: "", moveName: "" },
				{ index: 1, label: "Ritual 2", locked: false, ritualKey: "", ritualName: "", requiresMove: false, moveKey: "", moveName: "" },
				{ index: 2, label: "Ritual 3", locked: false, ritualKey: "", ritualName: "", requiresMove: false, moveKey: "", moveName: "" }
			]
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("titles the dialog and labels the confirm button from the passed options", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[0].title).toBe("Prepare Rituals");
		expect(Dialog.mock.calls.at(-1)[0].buttons.confirm.label).toBe("Prepare");

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("falls back to the raw moveKey when it doesn't resolve against the given moveOptions", async () => {
		const seed = [{ ritualKey: "arcanist-ritual:confidence", moveKey: "stale-move-key" }, null, null];
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, seed, MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("arcanist-rituals-picker"), expect.objectContaining({
			slots: expect.arrayContaining([expect.objectContaining({ index: 0, moveKey: "stale-move-key", moveName: "stale-move-key" })])
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("passes a locked slot through to the render data with its own ritual/move name resolved", async () => {
		const seed = [{ ritualKey: "arcanist-ritual:confidence", moveKey: "weather-the-storm", locked: true }, null, null];
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, seed, MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("arcanist-rituals-picker"), expect.objectContaining({
			slots: expect.arrayContaining([
				expect.objectContaining({
					index: 0, locked: true, ritualKey: "arcanist-ritual:confidence",
					ritualName: "Make a Move in Confidence", moveKey: "weather-the-storm", moveName: "Weather the Storm"
				})
			])
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves each slot's chosen ritual/move on confirm", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		const html = fakeRitualsHtml({
			0: { ritualKey: "arcanist-ritual:confidence", moveKey: "weather-the-storm" },
			1: { ritualKey: "arcanist-ritual:warding" },
			2: {}
		}).html;
		Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

		expect(await promise).toEqual([
			{ ritualKey: "arcanist-ritual:confidence", moveKey: "weather-the-storm" },
			{ ritualKey: "arcanist-ritual:warding", moveKey: null },
			null
		]);
	});

	it("passes a locked slot through unchanged on confirm, ignoring the (never-rendered) select for it", async () => {
		const seed = [{ ritualKey: "arcanist-ritual:warding", moveKey: null, locked: true }, null, null];
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, seed, MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		const html = fakeRitualsHtml({ 1: {}, 2: {} }).html;
		Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

		expect(await promise).toEqual([{ ritualKey: "arcanist-ritual:warding", moveKey: null }, null, null]);
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without confirming", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("opens the dialog with the module's own styling classes", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "arcanist-rituals-picker"] });

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	describe("invalidReason gating", () => {
		it("leaves a slot with no ritual type chosen valid (an empty slot is allowed)", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const html = fakeRitualsHtml({ 0: {}, 1: {}, 2: {} }).html;
			Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

			expect(ui.notifications.warn).not.toHaveBeenCalled();
			expect(await promise).toEqual([null, null, null]);
		});

		it("resolves null and warns once a requiresMove ritual type is chosen with no move picked", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const html = fakeRitualsHtml({ 0: { ritualKey: "arcanist-ritual:confidence" }, 1: {}, 2: {} }).html;
			Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

			expect(ui.notifications.warn).toHaveBeenCalledWith(
				"Choose a move for every ritual that makes a move in confidence."
			);
			expect(await promise).toBeNull();
		});

		it("skips a locked slot entirely when checking validity", async () => {
			const seed = [{ ritualKey: "arcanist-ritual:confidence", moveKey: null, locked: true }, null, null];
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, seed, MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const html = fakeRitualsHtml({ 1: {}, 2: {} }).html;
			Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

			expect(ui.notifications.warn).not.toHaveBeenCalled();
			expect(await promise).toEqual([{ ritualKey: "arcanist-ritual:confidence", moveKey: null }, null, null]);
		});
	});

	describe("render callback: live save-state and hidden-toggle wiring", () => {
		it("starts the confirm button enabled with nothing chosen", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeRitualsHtml();
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.confirmDisabled).toBe(false);
			expect(state.confirmDisabledClass).toBe(false);
			expect(state.confirmGateTooltip).toBeUndefined();

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("disables confirm and sets a gate-tooltip once a requiresMove type is picked with no move", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeRitualsHtml();
			Dialog.mock.calls.at(-1)[0].render(state.html);

			state.values[0] = { ritualKey: "arcanist-ritual:confidence" };
			state.typeHandlers[0]({ currentTarget: { value: "arcanist-ritual:confidence" } });

			expect(state.confirmDisabledClass).toBe(true);
			expect(state.confirmGateTooltip).toBe("Choose a move for every ritual that makes a move in confidence.");

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("re-enables confirm once the move is also picked", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeRitualsHtml();
			Dialog.mock.calls.at(-1)[0].render(state.html);

			state.values[0] = { ritualKey: "arcanist-ritual:confidence" };
			state.typeHandlers[0]({ currentTarget: { value: "arcanist-ritual:confidence" } });
			expect(state.confirmDisabledClass).toBe(true);

			state.values[0] = { ritualKey: "arcanist-ritual:confidence", moveKey: "weather-the-storm" };
			state.moveHandlers[0]();

			expect(state.confirmDisabledClass).toBe(false);
			expect(state.confirmGateTooltip).toBeUndefined();

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("shows the move-target select only once a requiresMove ritual type is chosen", async () => {
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeRitualsHtml();
			Dialog.mock.calls.at(-1)[0].render(state.html);

			state.values[0] = { ritualKey: "arcanist-ritual:warding" };
			state.typeHandlers[0]({ currentTarget: { value: "arcanist-ritual:warding" } });
			expect(state.moveSelectHidden[0]).toBe(true);

			state.values[0] = { ritualKey: "arcanist-ritual:confidence" };
			state.typeHandlers[0]({ currentTarget: { value: "arcanist-ritual:confidence" } });
			expect(state.moveSelectHidden[0]).toBe(false);

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});

		it("never wires a change handler for a locked slot's own (unrendered) selects", async () => {
			const seed = [{ ritualKey: "arcanist-ritual:warding", locked: true }, null, null];
			const promise = chooseArcanistRituals(FIXTURE_RITUALS, seed, MOVE_OPTIONS, options);
			await Promise.resolve();
			await Promise.resolve();

			const state = fakeRitualsHtml();
			Dialog.mock.calls.at(-1)[0].render(state.html);

			expect(state.typeHandlers[0]).toBeUndefined();
			expect(state.moveHandlers[0]).toBeUndefined();

			Dialog.mock.calls.at(-1)[0].close();
			await promise;
		});
	});

	// Enter-to-submit invokes the default button's callback directly, bypassing whatever the render
	// callback's live disabled state shows — the callback's own invalidReason recheck is the
	// authoritative last line of defense (see chooseWitchBoons/configureEquipment's identical
	// precedent).
	it("re-checks authoritatively in the confirm callback even if the DOM's disabled state was stale", async () => {
		const promise = chooseArcanistRituals(FIXTURE_RITUALS, [null, null, null], MOVE_OPTIONS, options);
		await Promise.resolve();
		await Promise.resolve();

		const html = fakeRitualsHtml({ 0: { ritualKey: "arcanist-ritual:confidence" }, 1: {}, 2: {} }).html;
		Dialog.mock.calls.at(-1)[0].buttons.confirm.callback(html);

		expect(await promise).toBeNull();
	});
});
