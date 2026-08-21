import { vi } from "vitest";

// Shared fixture for the plain-CLASH trait object used across configureMoveRoll/rollMove describes
// (lockedEffect, lockedAdvantage, equipment spends, astir part spends, guided, and configureMoveRoll
// itself) that don't otherwise need a real actor-backed trait.
export const CLASH_TRAIT = { key: "clash", label: "CLASH", value: 1 };

// A no-op fake jQuery object for selectors a render-callback test harness doesn't otherwise care
// about — e.g. wireNotchedSlider's own .find() calls (move-dialogs.js), which every
// configureMoveRoll render callback now issues regardless of which live-reactive wiring a given
// test is actually exercising. configureMoveRoll's own render callback unconditionally runs its
// live chain recompute() (see roll-chain.js's resolveRollChain) on every render, so map/get/
// toggleClass are included too — every render-callback test harness in this file's "wiring" style
// describes hits at least one of these through recompute()'s own selector reads, whether or not
// that particular test cares about the chain itself.
export function fakeNoopJQuery() {
	const noop = {
		on() {}, val() {}, trigger() { return noop; }, text() { return noop; },
		prop() { return noop; }, removeClass() { return noop; }, addClass() { return noop; },
		toggleClass() { return noop; }, map() { return noop; }, get() { return []; }
	};
	return noop;
}

// The single bundle a configureMoveRoll call made through _onWeaponMoveRoll's own weaponBundles
// path produces (offerUnarmed: false — see move-roll-mixin.js) — every field the old single-weapon
// configureMoveRoll options carried at the top level (lockedEffect, equipmentSpends, narrativeTags,
// rollModifiers, guided, rerollTag, and the weapon's own Trait list) now lives on this one bundle
// instead, since _rollMoveWithWeaponChoice always dispatches through weaponBundles once `weapon` is
// an array. Reads the mock's most recent call, matching this file's other `.mock.calls.at(-1)` uses.
export function soleWeaponBundle(configureMoveRollMock) {
	const { weaponBundles } = configureMoveRollMock.mock.calls.at(-1)[2];
	return weaponBundles[0];
}

// checkedConditions/checkedEquipmentTags/checkedAstirPartSpends/checkedRollModifiers/
// checkedPendingRollModifiers fake the jQuery `.find("[name='...']:checked").map(...).get()`
// chains configureMoveRoll uses to collect Help or Hinder's checkbox values, equipment spends,
// Astir Part spends, and (non-deferred/deferred) Roll Modifiers checkboxes.
//
// panelScoped (default false, so every existing caller's selector strings are unaffected) fakes
// configureMoveRoll's weaponBundles-only rescoping (see move-dialogs.js's own doc comment) of the
// equipment-tag/roll-modifier/pending-roll-modifier reads to `[data-weapon-panel].active
// [name='...']` instead of the bare `[name='...']` — the trait select needs no special case here,
// since its own read always falls through to the generic `values[selector]` branch below
// regardless of which selector string it's keyed by.
export function fakeRollHtml(
	values,
	checkedConditions = [],
	checkedEquipmentTags = [],
	checkedAstirPartSpends = [],
	checkedRollModifiers = [],
	checkedPendingRollModifiers = [],
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
