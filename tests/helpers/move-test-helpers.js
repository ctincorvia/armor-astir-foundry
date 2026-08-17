import { vi } from "vitest";

// Shared fixture for the plain-CLASH trait object used across configureMoveRoll/rollMove describes
// (lockedEffect, lockedAdvantage, equipment spends, astir part spends, guided, and configureMoveRoll
// itself) that don't otherwise need a real actor-backed trait.
export const CLASH_TRAIT = { key: "clash", label: "CLASH", value: 1 };

// checkedConditions/checkedEquipmentTags/checkedAstirPartSpends/checkedRollModifiers/
// checkedPendingRollModifiers fake the jQuery `.find("[name='...']:checked").map(...).get()`
// chains configureMoveRoll uses to collect Help or Hinder's checkbox values, equipment spends,
// Astir Part spends, and (non-deferred/deferred) Roll Modifiers checkboxes. rollStackChecked fakes
// the single `.find("[name='roll-stack']").prop("checked")` read All In's own checkbox uses (a
// bare boolean, not a list, since only one Stack checkbox is ever rendered).
export function fakeRollHtml(
	values,
	checkedConditions = [],
	checkedEquipmentTags = [],
	checkedAstirPartSpends = [],
	checkedRollModifiers = [],
	checkedPendingRollModifiers = [],
	rollStackChecked = false
) {
	return {
		find: (selector) => {
			if (selector === "[name='condition']:checked") {
				return { map: (fn) => ({ get: () => checkedConditions.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='equipment-tag']:checked") {
				return { map: (fn) => ({ get: () => checkedEquipmentTags.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='astir-part-spend']:checked") {
				return { map: (fn) => ({ get: () => checkedAstirPartSpends.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='roll-modifier']:checked") {
				return { map: (fn) => ({ get: () => checkedRollModifiers.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='pending-roll-modifier']:checked") {
				return { map: (fn) => ({ get: () => checkedPendingRollModifiers.map((value, index) => fn(index, { value })) }) };
			}
			if (selector === "[name='roll-stack']") {
				return { prop: (prop) => (prop === "checked" ? rollStackChecked : undefined) };
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
