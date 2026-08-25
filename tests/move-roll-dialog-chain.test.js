import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASIC_MOVES, configureMoveRoll } from "../scripts/moves/moves.js";
import { UNARMED } from "../scripts/equipment/equipment.js";
import { CLASH_TRAIT, mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/Roll implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
		this.close = vi.fn(() => this.data.close?.());
	});
	mockRoll();
	renderTemplate.mockResolvedValue("");
});

// Live-recompute DOM tests for configureMoveRoll's render callback (see move-dialogs.js and
// roll-chain.js's chainEntryResult/reverseChainStep) -- everything this file exercises only fires
// when .render() is actually invoked, unlike tests/move-roll-dialog.test.js's own Roll-button-
// callback-only tests, which simulate the already-painted result directly instead. A purpose-built
// fake DOM (fakeChainDom below) tracks per-key checkbox/row/reason state and both notch groups' own
// handlers, since the production code re-queries live "currently checked"/current-value state on
// every change rather than tracking it independently itself.
function fakeChainDom({ rollModifierKeys = [], weaponSelectValue = undefined, scoped = false } = {}) {
	const scope = scoped ? "[data-weapon-panel].active " : "";
	const state = {
		checked: new Set(),
		disabled: {},
		rowDisabled: {},
		reasons: {},
		advantageHiddenValue: "none",
		effectHiddenValue: "none",
		advantageNotchChecked: null,
		effectNotchChecked: null,
		advantageReadout: null,
		effectReadout: null,
		weaponSelectValue,
		handlers: { advantageNotch: [], effectNotch: [], rollModifier: [], weaponSelect: [] }
	};

	const selectors = new Map();

	function rollModifierCheckboxEl(key) {
		return {
			prop(name, value) {
				if (value === undefined) {
					return name === "checked" ? state.checked.has(key) : Boolean(state.disabled[key]);
				}
				if (name === "checked") { if (value) state.checked.add(key); else state.checked.delete(key); }
				else if (name === "disabled") state.disabled[key] = value;
				return this;
			}
		};
	}

	for (const key of rollModifierKeys) {
		const checkboxEl = rollModifierCheckboxEl(key);
		selectors.set(`${scope}[name='roll-modifier'][value='${key}']`, checkboxEl);
		selectors.set(`${scope}[data-roll-modifier-row="${key}"] [name='roll-modifier']`, checkboxEl);
		selectors.set(`${scope}[data-roll-modifier-row="${key}"]`, {
			toggleClass(cls, force) { state.rowDisabled[key] = force; return this; }
		});
		selectors.set(`${scope}[data-roll-modifier-row="${key}"] [data-roll-modifier-reason]`, {
			text(value) { if (value === undefined) return state.reasons[key] ?? ""; state.reasons[key] = value; return this; }
		});
	}

	selectors.set(`${scope}[name='roll-modifier']:checked`, {
		map(fn) {
			const values = rollModifierKeys.filter((key) => state.checked.has(key));
			return { get: () => values.map((value, index) => fn(index, { value })) };
		}
	});
	selectors.set("[name='roll-modifier']", {
		on(event, handler) { if (event === "change") state.handlers.rollModifier.push(handler); }
	});
	selectors.set("[name='advantage']", {
		val(value) { if (value === undefined) return state.advantageHiddenValue; state.advantageHiddenValue = value; return this; }
	});
	selectors.set("[name='effect']", {
		val(value) { if (value === undefined) return state.effectHiddenValue; state.effectHiddenValue = value; return this; }
	});
	selectors.set("[name='advantage-notch']", {
		on(event, handler) { if (event === "change") state.handlers.advantageNotch.push(handler); }
	});
	selectors.set("[name='effect-notch']", {
		on(event, handler) { if (event === "change") state.handlers.effectNotch.push(handler); }
	});
	selectors.set("[data-notched-slider='advantage'] [data-notched-slider-readout]", {
		text(value) { if (value === undefined) return state.advantageReadout; state.advantageReadout = value; return this; }
	});
	selectors.set("[data-notched-slider='effect'] [data-notched-slider-readout]", {
		text(value) { if (value === undefined) return state.effectReadout; state.effectReadout = value; return this; }
	});
	if (weaponSelectValue !== undefined) {
		selectors.set("[name='weapon-select']", {
			on(event, handler) { if (event === "change") state.handlers.weaponSelect.push(handler); },
			val: () => state.weaponSelectValue
		});
		selectors.set("[data-weapon-panel]", { removeClass() { return this; } });
	}

	const noop = { on() {}, val() {}, prop() { return noop; }, text() { return noop; }, toggleClass() { return noop; } };

	const html = {
		find: (selector) => {
			if (selectors.has(selector)) return selectors.get(selector);
			// The resolved notch value varies per recompute() call, so these two are matched by
			// pattern instead of pre-registered per key, the same "computed live" reason
			// rollModifierScope/activeRollModifiers themselves aren't pre-registered either.
			const notchMatch = selector.match(/^\[name='(advantage|effect)-notch'\]\[value='([^']*)'\]$/);
			if (notchMatch) {
				const [, axis, key] = notchMatch;
				return {
					prop(name, value) {
						if (value === undefined) return state[`${axis}NotchChecked`] === key;
						if (name === "checked" && value) state[`${axis}NotchChecked`] = key;
						return this;
					}
				};
			}
			if (weaponSelectValue !== undefined && selector.startsWith("[data-weapon-panel=")) {
				return { addClass() { return this; } };
			}
			return noop;
		}
	};

	return { html, state };
}

function checkRollModifier(dom, key) {
	dom.state.checked.add(key);
	for (const handler of dom.state.handlers.rollModifier) handler({ target: { value: key, checked: true } });
}

function uncheckRollModifier(dom, key) {
	dom.state.checked.delete(key);
	for (const handler of dom.state.handlers.rollModifier) handler({ target: { value: key, checked: false } });
}

function pickNotch(dom, axis, key, title) {
	for (const handler of dom.state.handlers[`${axis}Notch`]) handler({ target: { value: key, title } });
}

function switchWeapon(dom, weaponKey) {
	dom.state.weaponSelectValue = weaponKey;
	for (const handler of dom.state.handlers.weaponSelect) handler({ target: { value: weaponKey } });
}

async function openDialog(options) {
	const promise = configureMoveRoll(EXCHANGE_BLOWS, [CLASH_TRAIT], options);
	await Promise.resolve();
	await Promise.resolve();
	return { dialogOptions: Dialog.mock.calls.at(-1)[0], promise };
}

describe("configureMoveRoll - live chain recompute", () => {
	const allInEntry = {
		key: "cantrips:all-in", label: "All In", description: "d",
		advantage: "advantage", effect: "desperation", requiresAdvantage: ["advantage"],
		reminderOnly: false, disabled: false, disabledReason: null, forced: false
	};
	const embraceChaosEntry = {
		key: "the-witch:embrace-chaos", label: "Embrace Chaos", description: "d",
		advantage: "advantage2", effect: null, requiresAdvantage: ["disadvantage", "disadvantage2"],
		reminderOnly: false, disabled: false, disabledReason: null, forced: false
	};
	const advantageOnlyEntry = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, requiresAdvantage: null,
		reminderOnly: false, disabled: false, disabledReason: null, forced: false
	};
	const effectOnlyEntry = {
		key: "the-scout:field-scout", label: "Field Scout", description: "d",
		advantage: null, effect: "confidence", requiresAdvantage: null,
		reminderOnly: false, disabled: false, disabledReason: null, forced: false
	};
	// A synthetic forced: true entry, standing in for whatever real source (Tier, Cold Company,
	// ...) would otherwise seed the base Advantage state -- there is no
	// lockedAdvantage anymore (see docs/domains/moves.md), so every "starts pre-stepped" scenario
	// below has to seed via one or more forced Roll Modifier entries folded through resolveRollChain
	// instead. Each one nudges Advantage by exactly one step; stack two to reach disadvantage2/
	// advantage2 the same way two real forced sources stacking would. Never registered in
	// fakeChainDom's own rollModifierKeys -- repaintAvailability() finds no selector for it and reads
	// the DOM's own noop fallback as already-checked, matching a real forced row's checked+disabled
	// state.
	function seedEntry(key, advantage) {
		return {
			key, label: "Seed", description: "d",
			advantage, effect: null, requiresAdvantage: null,
			reminderOnly: false, disabled: false, disabledReason: null, forced: true
		};
	}
	// The Effect-axis counterpart to seedEntry above.
	function seedEffectEntry(key, effect) {
		return {
			key, label: "Seed", description: "d",
			advantage: null, effect, requiresAdvantage: null,
			reminderOnly: false, disabled: false, disabledReason: null, forced: true
		};
	}

	it("paints the Dice/Effect sliders from the base state on initial render, with no arrow when nothing composed", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);

		expect(dom.state.advantageHiddenValue).toBe("none");
		expect(dom.state.advantageReadout).toBe("None");
		expect(dom.state.effectHiddenValue).toBe("none");
		expect(dom.state.effectReadout).toBe("None");

		dialogOptions.close();
	});

	it("seeds the base state from a forced Roll Modifier entry / lockedEffect", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:advantage", "advantage")],
			lockedEffect: "confidence"
		});
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);

		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.effectHiddenValue).toBe("confidence");

		dialogOptions.close();
	});

	// Two forced Advantage-axis entries at once (e.g. Cold Company dispelled + a Tier advantage in
	// production) fold in sequence via the same resolveRollChain pass -- stacking to Advantage x2,
	// with neither entry needing to be checked by the player.
	it("stacks two forced Advantage-axis entries to advantage2 on initial render", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:advantage-1", "advantage"), seedEntry("seed:advantage-2", "advantage")]
		});
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);

		expect(dom.state.advantageHiddenValue).toBe("advantage2");

		dialogOptions.close();
	});

	// Opposite-sign forced Advantage-axis entries (e.g. Cold Company haunted + a Tier advantage)
	// cancel to none, the same as any other chain fold.
	it("cancels two opposite-sign forced Advantage-axis entries to none on initial render", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:advantage", "advantage"), seedEntry("seed:disadvantage", "disadvantage")]
		});
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);

		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});

	// Two forced Effect-axis entries canceling to none -- the concrete regression case for an
	// Unreliable weapon (-1 Effect) composing with a favorable Approach match (+1 Effect) instead of
	// one silently winning outright (see docs/domains/moves.md's "Effect axis" note and
	// playbook-actor-sheet-move-roll-targets.test.js's own integration-level version of this).
	it("cancels two opposite-sign forced Effect-axis entries to none on initial render", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEffectEntry("seed:desperation", "desperation"), seedEffectEntry("seed:confidence", "confidence")]
		});
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);

		expect(dom.state.effectHiddenValue).toBe("none");

		dialogOptions.close();
	});

	it("composes a checked entry onto the base and shows the base -> result arrow in the readout", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.advantageReadout).toBe("None → Advantage");
		expect(dom.state.checked.has(advantageOnlyEntry.key)).toBe(true);

		dialogOptions.close();
	});

	it("reverses a checked entry's own nudge on uncheck, showing the reverse transition in the readout", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);
		uncheckRollModifier(dom, advantageOnlyEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("none");
		expect(dom.state.advantageReadout).toBe("Advantage → None");

		dialogOptions.close();
	});

	it("clamps an uncheck's reversal to a no-op on an axis pushed out of the entry's own reach", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [
				seedEntry("seed:disadvantage-1", "disadvantage"),
				seedEntry("seed:disadvantage-2", "disadvantage"),
				embraceChaosEntry
			]
		});
		const dom = fakeChainDom({ rollModifierKeys: [embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, embraceChaosEntry.key);
		expect(dom.state.advantageHiddenValue).toBe("none");

		// The player manually moves back down to the bottom of the axis -- somewhere Embrace
		// Chaos's own +2 step can no longer reach back down from.
		pickNotch(dom, "advantage", "disadvantage2", "Disadvantage x2");
		expect(dom.state.advantageHiddenValue).toBe("disadvantage2");

		uncheckRollModifier(dom, embraceChaosEntry.key);

		// Reversing Embrace Chaos's own +2 step from "disadvantage2" would run off the bottom of
		// the axis -- reverseChainStep clamps that to a no-op rather than failing outright, and the
		// checkbox itself still unchecks normally.
		expect(dom.state.advantageHiddenValue).toBe("disadvantage2");
		expect(dom.state.advantageReadout).toBe("Disadvantage x2");
		expect(dom.state.checked.has(embraceChaosEntry.key)).toBe(false);

		dialogOptions.close();
	});

	it("reverses an Effect-only entry's own nudge on uncheck without touching Advantage", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [effectOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [effectOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, effectOnlyEntry.key);
		expect(dom.state.effectHiddenValue).toBe("confidence");

		uncheckRollModifier(dom, effectOnlyEntry.key);

		expect(dom.state.effectHiddenValue).toBe("none");
		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});

	it("clamps an Effect-only entry's reversal to a no-op on the Effect axis, leaving Advantage untouched", async () => {
		const { dialogOptions } = await openDialog({
			lockedEffect: "desperation",
			rollModifiers: [effectOnlyEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [effectOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, effectOnlyEntry.key);
		expect(dom.state.effectHiddenValue).toBe("none");

		// The player manually moves back down to the bottom of the Effect axis -- somewhere Field
		// Scout's own +1 step can no longer reach back down from.
		pickNotch(dom, "effect", "desperation", "Desperation");
		expect(dom.state.effectHiddenValue).toBe("desperation");

		uncheckRollModifier(dom, effectOnlyEntry.key);

		expect(dom.state.effectHiddenValue).toBe("desperation");
		expect(dom.state.effectReadout).toBe("Desperation");
		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});

	// The user's own walkthrough: "Embrace Chaos converts Disadvantage to Advantage, then All In
	// converts that Advantage to Advantage x2" -- checking All In first (before Advantage is
	// reached) is a no-op gate failure; checking Embrace Chaos afterward still composes correctly
	// since chain order follows *check* order, not catalog/array order.
	it("composes All In on top of Embrace Chaos when Embrace Chaos is checked first", async () => {
		// Embrace Chaos's own +2 resolves plain Disadvantage to Advantage (-1+2=+1), which then
		// satisfies All In's own requiresAdvantage gate -- matching the fiction's exact walkthrough
		// ("Embrace Chaos converts Disadvantage to Advantage, then All In converts that Advantage to
		// Advantage x2"). Disadvantage x2 resolves to None instead (-2+2=0), which would NOT satisfy
		// All In's gate -- see the "unchecks a checked entry..." test below for that case.
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:disadvantage", "disadvantage"), allInEntry, embraceChaosEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, embraceChaosEntry.key);
		checkRollModifier(dom, allInEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage2");
		expect(dom.state.effectHiddenValue).toBe("desperation");
		expect(dom.state.checked.has(embraceChaosEntry.key)).toBe(true);
		expect(dom.state.checked.has(allInEntry.key)).toBe(true);

		dialogOptions.close();
	});

	// The inverse check order: All In is checked while its own requiresAdvantage gate isn't
	// satisfied yet (base is disadvantage2), so chainEntryResult returns null and the nudge is
	// skipped -- but per the new model a modifier is never auto-unchecked, so All In stays checked
	// and simply contributes nothing to the current Advantage. Embrace Chaos checked afterward
	// still nudges on its own.
	it("stays checked even when its own gate isn't satisfied, contributing nothing to the current value", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [
				seedEntry("seed:disadvantage-1", "disadvantage"),
				seedEntry("seed:disadvantage-2", "disadvantage"),
				allInEntry, embraceChaosEntry
			]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, allInEntry.key);

		expect(dom.state.checked.has(allInEntry.key)).toBe(true);
		expect(dom.state.advantageHiddenValue).toBe("disadvantage2");

		checkRollModifier(dom, embraceChaosEntry.key);

		expect(dom.state.checked.has(embraceChaosEntry.key)).toBe(true);
		expect(dom.state.checked.has(allInEntry.key)).toBe(true);
		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});

	it("disables an unchecked row once its own gate becomes unreachable from the current chain state, with a requiresAdvantage reason", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [
				seedEntry("seed:disadvantage-1", "disadvantage"),
				seedEntry("seed:disadvantage-2", "disadvantage"),
				allInEntry, embraceChaosEntry
			]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);

		// At disadvantage2, All In's own requiresAdvantage (["advantage"]) isn't satisfied.
		expect(dom.state.disabled[allInEntry.key]).toBe(true);
		expect(dom.state.rowDisabled[allInEntry.key]).toBe(true);
		expect(dom.state.reasons[allInEntry.key]).toBe("Requires Advantage");

		dialogOptions.close();
	});

	it("re-enables a row once an earlier checked entry makes its gate reachable", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:disadvantage", "disadvantage"), allInEntry, embraceChaosEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		expect(dom.state.disabled[allInEntry.key]).toBe(true);

		checkRollModifier(dom, embraceChaosEntry.key);

		expect(dom.state.disabled[allInEntry.key]).toBe(false);
		expect(dom.state.rowDisabled[allInEntry.key]).toBe(false);
		expect(dom.state.reasons[allInEntry.key]).toBe("");

		dialogOptions.close();
	});

	it("never touches a row that's statically disabled for its own resource gate", async () => {
		const staticallyDisabledEntry = { ...advantageOnlyEntry, key: "static-disabled", disabled: true, disabledReason: "Needs 1 hold" };
		const { dialogOptions } = await openDialog({ rollModifiers: [staticallyDisabledEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [staticallyDisabledEntry.key] });

		dialogOptions.render(dom.html);

		expect(dom.state.disabled[staticallyDisabledEntry.key]).toBeUndefined();
		expect(dom.state.rowDisabled[staticallyDisabledEntry.key]).toBeUndefined();
		expect(dom.state.reasons[staticallyDisabledEntry.key]).toBeUndefined();

		dialogOptions.close();
	});

	it("skips a reminderOnly entry entirely -- no checkbox, never gated live", async () => {
		const reminderOnlyEntry = {
			key: "the-wither:dark-guarantees", label: "Dark Guarantees", description: "d",
			advantage: null, effect: null, requiresAdvantage: null,
			reminderOnly: true, disabled: false, disabledReason: null
		};
		const { dialogOptions } = await openDialog({ rollModifiers: [reminderOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [] });

		expect(() => dialogOptions.render(dom.html)).not.toThrow();

		dialogOptions.close();
	});

	it("re-derives baseAdvantage from a manually picked Dice notch, then recomposes", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [allInEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key] });

		dialogOptions.render(dom.html);
		pickNotch(dom, "advantage", "advantage", "Advantage");

		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.disabled[allInEntry.key]).toBe(false);

		checkRollModifier(dom, allInEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage2");
		expect(dom.state.effectHiddenValue).toBe("desperation");

		dialogOptions.close();
	});

	it("re-derives baseEffect from a manually picked Effect notch", async () => {
		const { dialogOptions } = await openDialog({});
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);
		pickNotch(dom, "effect", "confidence", "Confidence");

		expect(dom.state.effectHiddenValue).toBe("confidence");
		expect(dom.state.effectReadout).toBe("Confidence");

		dialogOptions.close();
	});

	it("only checked entries end up in the Roll button's own spentRollModifiers", async () => {
		const { dialogOptions, promise } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);

		dialogOptions.buttons.roll.callback(dom.html);

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentRollModifiers).toEqual([advantageOnlyEntry.key]);
	});

	// The reported regression: checking a modifier that nudges None -> Advantage, then clicking the
	// "None" notch, used to be silently absorbed -- the whole-chain recompute() would re-derive
	// Advantage back to "advantage" (since the checked box was still checked) and force the notch
	// back to where it started, so the click never visibly moved the stepper. Under the new model a
	// direct notch click always wins outright, and the checked modifier is left checked rather than
	// being reconciled against it.
	it("does not snap back when the None notch is clicked after a checked modifier nudged away from it (regression)", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);
		pickNotch(dom, "advantage", "none", "None");

		expect(dom.state.checked.has(advantageOnlyEntry.key)).toBe(true);
		expect(dom.state.advantageHiddenValue).toBe("none");
		expect(dom.state.advantageReadout).toBe("None");

		dialogOptions.close();
	});

	it("still spends a checked modifier's resource even after its nudge is overridden back away by the player", async () => {
		const { dialogOptions, promise } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);
		pickNotch(dom, "advantage", "none", "None");

		dialogOptions.buttons.roll.callback(dom.html);

		const result = await promise;
		expect(result.advantage).toBe("none");
		expect(result.spentRollModifiers).toEqual([advantageOnlyEntry.key]);
	});

	it("stacks a newly checked modifier on top of a manual override, keeping both modifiers checked", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [advantageOnlyEntry, embraceChaosEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);
		expect(dom.state.advantageHiddenValue).toBe("advantage");

		pickNotch(dom, "advantage", "disadvantage", "Disadvantage");
		expect(dom.state.advantageHiddenValue).toBe("disadvantage");

		// Embrace Chaos's own requiresAdvantage gate is satisfied by the manually-picked
		// Disadvantage, and its own +2 step applies from *that* current value, not from wherever
		// advantageOnlyEntry's own earlier nudge originally landed.
		checkRollModifier(dom, embraceChaosEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.checked.has(advantageOnlyEntry.key)).toBe(true);
		expect(dom.state.checked.has(embraceChaosEntry.key)).toBe(true);

		dialogOptions.close();
	});

	// Bug 2: the reason text for a failed requiresAdvantage gate used to hardcode "Requires
	// Advantage" regardless of what the gate actually named -- wrong for Embrace Chaos, whose own
	// gate requires Disadvantage (or Disadvantage x2), not Advantage.
	it("labels a failed requiresAdvantage gate from the gate's own contents, not a hardcoded 'Requires Advantage' (bug 2)", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [embraceChaosEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [embraceChaosEntry.key] });

		dialogOptions.render(dom.html);

		expect(dom.state.disabled[embraceChaosEntry.key]).toBe(true);
		expect(dom.state.reasons[embraceChaosEntry.key]).toBe("Requires Disadvantage or Disadvantage x2");

		dialogOptions.close();
	});

	// A forced entry composes with the player's own later manual check exactly like any other
	// already-applied step -- a forced Tier Advantage seed already puts currentAdvantage at
	// "advantage" before the player does anything, which satisfies All In's own requiresAdvantage
	// gate the moment it's checked, the same as if the player had picked the Advantage notch by
	// hand. There's nothing to test for "the forced checkbox itself can't be unchecked" beyond this
	// seeding -- the checkbox renders checked+disabled in the real template (untestable here per
	// CLAUDE.md's renderTemplate stub), so the browser physically can't fire a change event on it;
	// no uncheck-handling code exists for a forced row to exercise.
	it("a forced seed composes with a manually checked ordinary entry afterward", async () => {
		const { dialogOptions } = await openDialog({
			rollModifiers: [seedEntry("seed:advantage", "advantage"), allInEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key] });

		dialogOptions.render(dom.html);
		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.disabled[allInEntry.key]).toBe(false);

		checkRollModifier(dom, allInEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage2");
		expect(dom.state.effectHiddenValue).toBe("desperation");

		dialogOptions.close();
	});
});

describe("configureMoveRoll - live chain recompute (weaponBundles)", () => {
	const halberdModifier = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, requiresAdvantage: null,
		reminderOnly: false, disabled: false, disabledReason: null
	};
	const unarmedBundle = {
		weaponKey: UNARMED, weaponLabel: "Unarmed", weaponCard: null,
		traits: [CLASH_TRAIT], traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: null, equipmentSpends: [], guided: null, rollModifiers: []
	};
	const halberdBundle = {
		weaponKey: "eq1", weaponLabel: "Halberd", weaponCard: null,
		traits: [CLASH_TRAIT], traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: null, equipmentSpends: [], guided: null, rollModifiers: [halberdModifier]
	};

	const forcedDesperationEntry = {
		key: "equipment:unreliable", label: "Unreliable", description: "d",
		advantage: null, effect: "desperation", requiresAdvantage: null,
		reminderOnly: false, disabled: false, disabledReason: null, forced: true
	};
	const forcedConfidenceEntry = {
		key: "approach:favorable-matchup", label: "Favorable Matchup", description: "d",
		advantage: null, effect: "confidence", requiresAdvantage: null,
		reminderOnly: false, disabled: false, disabledReason: null, forced: true
	};
	const unreliableBundle = {
		weaponKey: "eq2", weaponLabel: "Unreliable Weapon", weaponCard: null,
		traits: [CLASH_TRAIT], traitOptions: [{ key: "clash", label: "CLASH (1)" }],
		lockedEffect: null, equipmentSpends: [], guided: null, rollModifiers: [forcedDesperationEntry]
	};
	const unreliableWithMatchupBundle = {
		...unreliableBundle,
		rollModifiers: [forcedDesperationEntry, forcedConfidenceEntry]
	};

	it("resolves the active panel's own rollModifiers, scoped to the active weapon panel's selectors", async () => {
		const { dialogOptions } = await openDialog({ weaponBundles: [unarmedBundle, halberdBundle] });
		const dom = fakeChainDom({ rollModifierKeys: [halberdModifier.key], weaponSelectValue: "eq1", scoped: true });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, halberdModifier.key);

		expect(dom.state.advantageHiddenValue).toBe("advantage");

		dialogOptions.close();
	});

	it("re-scopes to the newly active panel's own rollModifiers when the weapon-select changes", async () => {
		const { dialogOptions } = await openDialog({ weaponBundles: [unarmedBundle, halberdBundle] });
		const dom = fakeChainDom({ rollModifierKeys: [halberdModifier.key], weaponSelectValue: UNARMED, scoped: true });

		dialogOptions.render(dom.html);
		// Unarmed's own rollModifiers is empty, so nothing to disable/enable yet.
		expect(dom.state.disabled[halberdModifier.key]).toBeUndefined();

		switchWeapon(dom, "eq1");

		// Now scoped to Halberd's own bundle, whose rollModifiers includes the entry -- recompute()
		// re-ran as part of the weapon-select's own change handler and found it applicable (no
		// requiresAdvantage gate), so it stays enabled rather than disabled.
		expect(dom.state.disabled[halberdModifier.key]).toBe(false);

		dialogOptions.close();
	});

	// The reported regression's setup half: a weapon-specific forced Roll Modifier (e.g. the
	// Unreliable equipment tag) never appears in the Unarmed bundle's own rollModifiers (weapon is
	// null there), so the initial render seed -- computed against Unarmed, the template's own
	// default-selected panel -- can't fold it in. Switching the weapon-select to the actual weapon
	// must re-seed against that panel's own forced entries, not just re-paint availability.
	it("re-seeds Effect from the newly active weapon panel's own forced Roll Modifier when the weapon-select changes", async () => {
		const { dialogOptions } = await openDialog({ weaponBundles: [unarmedBundle, unreliableBundle] });
		const dom = fakeChainDom({ rollModifierKeys: [], weaponSelectValue: UNARMED, scoped: true });

		dialogOptions.render(dom.html);
		expect(dom.state.effectHiddenValue).toBe("none");

		switchWeapon(dom, "eq2");

		expect(dom.state.effectHiddenValue).toBe("desperation");

		dialogOptions.close();
	});

	// The direct regression test: an Unreliable weapon (forced Desperation) plus a favorable
	// Approach target matchup (forced Confidence) on the same weapon's bundle should cancel to a
	// neutral roll once that weapon is selected -- not silently seed from Unarmed's own fold (which
	// never sees the weapon-specific entry) and leave Desperation out entirely.
	it("cancels a weapon's forced Desperation against a forced Confidence in the same bundle after switching weapons (regression)", async () => {
		const { dialogOptions } = await openDialog({ weaponBundles: [unarmedBundle, unreliableWithMatchupBundle] });
		const dom = fakeChainDom({ rollModifierKeys: [], weaponSelectValue: UNARMED, scoped: true });

		dialogOptions.render(dom.html);
		expect(dom.state.effectHiddenValue).toBe("none");

		switchWeapon(dom, "eq2");

		expect(dom.state.effectHiddenValue).toBe("none");

		dialogOptions.close();
	});

	// Defensive: activeRollModifiers() falls back to an empty list rather than throwing when the
	// weapon-select's own value doesn't match any bundle's weaponKey (e.g. a render before the
	// <select> has settled on one of its own options).
	it("falls back to an empty rollModifiers list when the active weapon key matches no bundle", async () => {
		const { dialogOptions } = await openDialog({ weaponBundles: [unarmedBundle, halberdBundle] });
		const dom = fakeChainDom({ rollModifierKeys: [], weaponSelectValue: "no-such-weapon", scoped: true });

		expect(() => dialogOptions.render(dom.html)).not.toThrow();
		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});
});
