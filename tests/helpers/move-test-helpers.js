import { vi } from "vitest";

// Shared fixture for the plain-CLASH trait object used across configureMoveRoll/rollMove describes
// (lockedEffect, lockedAdvantage, equipment spends, astir part spends, guided, and configureMoveRoll
// itself) that don't otherwise need a real actor-backed trait.
export const CLASH_TRAIT = { key: "clash", label: "CLASH", value: 1 };

// checkedConditions/checkedEquipmentTags/checkedAstirPartSpends/checkedRollModifiers/
// checkedPendingRollModifiers fake the jQuery `.find("[name='...']:checked").map(...).get()`
// chains configureMoveRoll uses to collect Help or Hinder's checkbox values, equipment spends,
// Astir Part spends, and (non-deferred/deferred) Roll Modifiers checkboxes. rollStackChecked/
// disadvantageConversionChecked fake the single `.find("[name='...']").prop("checked")` reads All
// In's own Stack checkbox and Embrace Chaos's own Convert checkbox use (each a bare boolean, not a
// list, since only one of either is ever rendered).
//
// panelScoped (default false, so every existing caller's selector strings are unaffected) fakes
// configureMoveRoll's weaponBundles-only rescoping (see move-dialogs.js's own doc comment) of the
// equipment-tag/roll-modifier/pending-roll-modifier checked-list reads to
// `[data-weapon-panel].active [name='...']:checked` instead of the bare `[name='...']:checked` —
// the trait select needs no special case here, since its own read always falls through to the
// generic `values[selector]` branch below regardless of which selector string it's keyed by.
export function fakeRollHtml(
	values,
	checkedConditions = [],
	checkedEquipmentTags = [],
	checkedAstirPartSpends = [],
	checkedRollModifiers = [],
	checkedPendingRollModifiers = [],
	rollStackChecked = false,
	disadvantageConversionChecked = false,
	panelScoped = false
) {
	const scope = panelScoped ? "[data-weapon-panel].active " : "";
	return {
		find: (selector) => {
			if (selector === "[name='condition']:checked") {
				return { map: (fn) => ({ get: () => checkedConditions.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === `${scope}[name='equipment-tag']:checked`) {
				return { map: (fn) => ({ get: () => checkedEquipmentTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='astir-part-spend']:checked") {
				return { map: (fn) => ({ get: () => checkedAstirPartSpends.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === `${scope}[name='roll-modifier']:checked`) {
				return { map: (fn) => ({ get: () => checkedRollModifiers.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === `${scope}[name='pending-roll-modifier']:checked`) {
				return { map: (fn) => ({ get: () => checkedPendingRollModifiers.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='roll-stack']") {
				return { prop: (prop) => (prop === "checked" ? rollStackChecked : undefined) };
			}
			if (selector === "[name='disadvantage-conversion']") {
				return { prop: (prop) => (prop === "checked" ? disadvantageConversionChecked : undefined) };
			}
			return { val: () => values[selector] };
		}
	};
}

// Seeds the die's raw results (pre-substitution/keep) so rollMove's real, unmocked
// applyRollEffects computes the total exactly as it would in production — there is no `total`
// to inject directly any more, since rollMove derives it from the dice breakdown + trait value.
export function mockRoll({ dice = [3, 3] } = {}) {
	Roll.mockImplementation(function (formula, data) {
		this.formula = formula;
		this.data = data;
		this._total = 0;
		this.terms = [];
		this.dice = [{ results: dice.map((value) => ({ result: value, active: true })), modifiers: [] }];
		this.evaluate = vi.fn().mockImplementation(async () => this);
		this.toMessage = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(this, "total", { get: () => this._total, configurable: true });
	});
}

// mockRoll above replaces Roll.mockImplementation with one fixed implementation shared by *every*
// `new Roll(...)` call, which breaks down once a test needs the initial pool roll and one-or-more
// later explosion rolls (see moves.js#explodeSixes) to return *different* results. This queues one
// Roll.mockImplementationOnce per array entry — consumed strictly in call order, so entry 0 is the
// first `new Roll(...)` a test triggers (the initial pool, when testing through rollMove) and each
// subsequent entry is one explosion die.
export function mockRollSequence(diceSets) {
	for (const dice of diceSets) {
		Roll.mockImplementationOnce(function (formula, data) {
			this.formula = formula;
			this.data = data;
			this._total = 0;
			this.terms = [];
			this.dice = [{ results: dice.map((value) => ({ result: value, active: true })), modifiers: [] }];
			this.evaluate = vi.fn().mockImplementation(async () => this);
			this.toMessage = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(this, "total", { get: () => this._total, configurable: true });
		});
	}
}
