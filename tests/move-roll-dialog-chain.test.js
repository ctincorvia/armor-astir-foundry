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
// roll-chain.js's resolveRollChain) -- everything this file exercises only fires when .render() is
// actually invoked, unlike tests/move-roll-dialog.test.js's own Roll-button-callback-only tests,
// which simulate the chain's *already-painted* result directly instead. A purpose-built fake DOM
// (fakeChainDom below) tracks per-key checkbox/row/reason state and both notch groups' own
// handlers, since real jQuery fires every handler bound to the same selector in registration order
// (wireNotchedSlider's own write, then this module's own chain-recompute write) and the production
// code re-queries live "currently checked" state on every recompute() call rather than tracking it
// itself.
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
		selectors.set(`${scope}[data-roll-modifier-row="${key}"] [name='pending-roll-modifier']`, checkboxEl);
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
	selectors.set(`${scope}[name='pending-roll-modifier']:checked`, {
		map(fn) { return { get: () => [] }; }
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
	for (const handler of dom.state.handlers.rollModifier) handler();
}

function uncheckRollModifier(dom, key) {
	dom.state.checked.delete(key);
	for (const handler of dom.state.handlers.rollModifier) handler();
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
		reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};
	const embraceChaosEntry = {
		key: "the-witch:embrace-chaos", label: "Embrace Chaos", description: "d",
		advantage: "advantage2", effect: null, requiresAdvantage: ["disadvantage", "disadvantage2"],
		reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};
	const advantageOnlyEntry = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, requiresAdvantage: null,
		reminderOnly: false, deferred: false, disabled: false, disabledReason: null
	};

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

	it("seeds the base state from lockedAdvantage/lockedEffect", async () => {
		const { dialogOptions } = await openDialog({ lockedAdvantage: "advantage", lockedEffect: "confidence" });
		const dom = fakeChainDom({ rollModifierKeys: [] });

		dialogOptions.render(dom.html);

		expect(dom.state.advantageHiddenValue).toBe("advantage");
		expect(dom.state.effectHiddenValue).toBe("confidence");

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

	it("reverses cleanly on uncheck, recomputing from scratch rather than undoing incrementally", async () => {
		const { dialogOptions } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);
		uncheckRollModifier(dom, advantageOnlyEntry.key);

		expect(dom.state.advantageHiddenValue).toBe("none");
		expect(dom.state.advantageReadout).toBe("None");

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
			lockedAdvantage: "disadvantage",
			rollModifiers: [allInEntry, embraceChaosEntry]
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
	// satisfied yet (base is disadvantage2), so recompute() unchecks it immediately -- exercising
	// move-dialogs.js's own "a checked box whose entry didn't survive the chain gets unchecked"
	// branch. Embrace Chaos checked afterward still applies on its own, but All In stays unchecked
	// since a single left-to-right pass never retries a skipped entry.
	it("unchecks a checked entry whose gate isn't satisfied yet, and never retries it later in the same pass", async () => {
		const { dialogOptions } = await openDialog({
			lockedAdvantage: "disadvantage2",
			rollModifiers: [allInEntry, embraceChaosEntry]
		});
		const dom = fakeChainDom({ rollModifierKeys: [allInEntry.key, embraceChaosEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, allInEntry.key);

		expect(dom.state.checked.has(allInEntry.key)).toBe(false);
		expect(dom.state.advantageHiddenValue).toBe("disadvantage2");

		checkRollModifier(dom, embraceChaosEntry.key);

		expect(dom.state.checked.has(embraceChaosEntry.key)).toBe(true);
		expect(dom.state.checked.has(allInEntry.key)).toBe(false);
		expect(dom.state.advantageHiddenValue).toBe("none");

		dialogOptions.close();
	});

	it("disables an unchecked row once its own gate becomes unreachable from the current chain state, with a requiresAdvantage reason", async () => {
		const { dialogOptions } = await openDialog({
			lockedAdvantage: "disadvantage2",
			rollModifiers: [allInEntry, embraceChaosEntry]
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
			lockedAdvantage: "disadvantage",
			rollModifiers: [allInEntry, embraceChaosEntry]
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
			reminderOnly: true, deferred: false, disabled: false, disabledReason: null
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

	it("only checked, non-deferred entries end up in the Roll button's own spentRollModifiers", async () => {
		const { dialogOptions, promise } = await openDialog({ rollModifiers: [advantageOnlyEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [advantageOnlyEntry.key] });

		dialogOptions.render(dom.html);
		checkRollModifier(dom, advantageOnlyEntry.key);

		dialogOptions.buttons.roll.callback(dom.html);

		const result = await promise;
		expect(result.advantage).toBe("advantage");
		expect(result.spentRollModifiers).toEqual([advantageOnlyEntry.key]);
	});

	// A deferred, unchecked entry (Snakes in the Grass-shaped) still goes through the same live
	// applicability re-check as an immediate entry -- see recompute()'s own deferred ? "pending-
	// roll-modifier" : "roll-modifier" checkbox-name branch -- even though it never joins the chain
	// itself (only [name='roll-modifier'] boxes are read into checkedKeys).
	it("re-evaluates a deferred entry's own live applicability against the [name='pending-roll-modifier'] checkbox name", async () => {
		const deferredEntry = {
			key: "the-adrift:snakes-in-the-grass", label: "Snakes In The Grass", description: "d",
			advantage: "advantage", effect: null, requiresAdvantage: ["advantage"],
			reminderOnly: false, deferred: true, disabled: false, disabledReason: null
		};
		const { dialogOptions } = await openDialog({ rollModifiers: [deferredEntry] });
		const dom = fakeChainDom({ rollModifierKeys: [deferredEntry.key] });

		dialogOptions.render(dom.html);

		expect(dom.state.disabled[deferredEntry.key]).toBe(true);
		expect(dom.state.reasons[deferredEntry.key]).toBe("Requires Advantage");

		dialogOptions.close();
	});
});

describe("configureMoveRoll - live chain recompute (weaponBundles)", () => {
	const halberdModifier = {
		key: "the-diplomat:sharper-knives", label: "Sharper Knives", description: "d",
		advantage: "advantage", effect: null, requiresAdvantage: null,
		reminderOnly: false, deferred: false, disabled: false, disabledReason: null
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
