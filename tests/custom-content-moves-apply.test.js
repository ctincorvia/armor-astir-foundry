import { afterEach, describe, expect, it } from "vitest";

import {
	applyCustomContent,
	resetCustomContent,
	validateCustomContent
} from "../scripts/custom-content/custom-content-apply.js";
import { CUSTOM_MOVE_CATALOG } from "../scripts/moves/custom-move-catalog.js";
import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { ASTIR_MOVE_CATALOG } from "../scripts/frames/astir-moves.js";

// Mirrors tests/custom-content-apply.test.js's own rationale (see docs/domains/reflavor.md's
// Testing note): this engine's whole job is mutating the real, shared catalog arrays, so testing
// against injectable fixtures would test nothing real. resetCustomContent() in afterEach undoes
// every tracked injection so nothing leaks into an unrelated suite that asserts catalog content by
// exact toEqual/length (e.g. tests/playbook-moves.test.js's ALL_PLAYBOOK_MOVES-based assertions).
afterEach(() => {
	resetCustomContent();
});

const findCustom = (key) => CUSTOM_MOVE_CATALOG.find((move) => move.key === key);
const findAllMoves = (key) => ALL_MOVES.find((move) => move.key === key);
const findPlaybookMove = (key) => ALL_PLAYBOOK_MOVES.find((move) => move.key === key);
const findAstirMove = (key) => ASTIR_MOVE_CATALOG.find((move) => move.key === key);

describe("applyCustomContent — moves injection, four-array reach", () => {
	it("injects a minimal valid custom move into all four catalogs, by the same object reference", () => {
		const warnings = applyCustomContent({
			moves: [{ key: "custom:test-move", name: "Test Move", traits: [], description: "d" }]
		});

		expect(warnings).toEqual([]);
		const viaCustom = findCustom("custom:test-move");
		expect(viaCustom).toMatchObject({ name: "Test Move", traits: [], description: "d" });
		expect(findAllMoves("custom:test-move")).toBe(viaCustom);
		expect(findPlaybookMove("custom:test-move")).toBe(viaCustom);
		expect(findAstirMove("custom:test-move")).toBe(viaCustom);
	});
});

describe("applyCustomContent — moves retraction", () => {
	it("removes a previously injected move from all four catalogs when re-uploaded without it", () => {
		applyCustomContent({ moves: [{ key: "custom:temp-move", name: "Temp", traits: [], description: "d" }] });
		expect(findCustom("custom:temp-move")).toBeDefined();

		applyCustomContent({ moves: [] });

		expect(findCustom("custom:temp-move")).toBeUndefined();
		expect(findAllMoves("custom:temp-move")).toBeUndefined();
		expect(findPlaybookMove("custom:temp-move")).toBeUndefined();
		expect(findAstirMove("custom:temp-move")).toBeUndefined();
	});

	it("retracts a whole moves upload when the section key disappears entirely", () => {
		applyCustomContent({ moves: [{ key: "custom:temp-move-2", name: "Temp", traits: [], description: "d" }] });
		expect(findCustom("custom:temp-move-2")).toBeDefined();

		applyCustomContent({});

		expect(findCustom("custom:temp-move-2")).toBeUndefined();
	});

	it("retracts one key while leaving a different re-uploaded key alone", () => {
		applyCustomContent({
			moves: [
				{ key: "custom:keep-move", name: "Keep", traits: [], description: "d" },
				{ key: "custom:drop-move", name: "Drop", traits: [], description: "d" }
			]
		});

		applyCustomContent({ moves: [{ key: "custom:keep-move", name: "Keep", traits: [], description: "d" }] });

		expect(findCustom("custom:keep-move")).toBeDefined();
		expect(findCustom("custom:drop-move")).toBeUndefined();
	});
});

describe("applyCustomContent — moves in-place update", () => {
	it("mutates an already-injected move's fields without changing its object identity, across all four catalogs", () => {
		applyCustomContent({ moves: [{ key: "custom:evolve-move", name: "Old", traits: [], description: "old" }] });
		const before = findCustom("custom:evolve-move");

		applyCustomContent({ moves: [{ key: "custom:evolve-move", name: "New", traits: ["clash"], description: "new" }] });
		const after = findCustom("custom:evolve-move");

		expect(after).toBe(before);
		expect(after.name).toBe("New");
		expect(after.traits).toEqual(["clash"]);
		expect(findAllMoves("custom:evolve-move")).toBe(after);
		expect(findPlaybookMove("custom:evolve-move")).toBe(after);
		expect(findAstirMove("custom:evolve-move")).toBe(after);
	});

	it("drops a field omitted from the newer upload rather than merging it forward", () => {
		applyCustomContent({
			moves: [{ key: "custom:evolve-drop", name: "N", traits: [], description: "d", tierBonus: 1 }]
		});
		expect(findCustom("custom:evolve-drop").tierBonus).toBe(1);

		applyCustomContent({ moves: [{ key: "custom:evolve-drop", name: "N", traits: [], description: "d" }] });
		expect(findCustom("custom:evolve-drop").tierBonus).toBeUndefined();
	});
});

describe("applyCustomContent — moves required fields", () => {
	it("errors when name is missing", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "custom:no-name", traits: [], description: "d" }] });
		expect(errors).toContain("moves addition \"custom:no-name\" is missing required field \"name\".");
	});

	it("errors when traits is missing", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "custom:no-traits", name: "N", description: "d" }] });
		expect(errors).toContain("moves addition \"custom:no-traits\" is missing required field \"traits\".");
	});

	it("errors when description is missing", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "custom:no-desc", name: "N", traits: [] }] });
		expect(errors).toContain("moves addition \"custom:no-desc\" is missing required field \"description\".");
	});

	it("does not error when traits is an empty array (many real moves roll no stat)", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "custom:no-roll", name: "N", traits: [], description: "d" }] });
		expect(errors).toEqual([]);
	});

	it("does not error when results is entirely absent", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "custom:no-results", name: "N", traits: [], description: "d" }] });
		expect(errors).toEqual([]);
	});
});

describe("applyCustomContent — moves key format/collision/duplicate", () => {
	it("errors when a move key is missing the custom: prefix", () => {
		const { errors } = validateCustomContent({ moves: [{ key: "not-prefixed", name: "N", traits: [], description: "d" }] });
		expect(errors[0]).toMatch(/must have a "key" starting with "custom:"/);
	});

	it("errors when two move additions in the same upload share a key", () => {
		const { errors } = validateCustomContent({
			moves: [
				{ key: "custom:dupe-move", name: "A", traits: [], description: "d" },
				{ key: "custom:dupe-move", name: "B", traits: [], description: "d" }
			]
		});
		expect(errors).toContain("moves addition \"custom:dupe-move\" duplicates key \"custom:dupe-move\" already used earlier in this upload.");
	});

	it("errors when a move key collides with an existing catalog key", () => {
		const collidingEntry = { key: "custom:already-here-move", name: "Pre-existing", traits: [], description: "d" };
		CUSTOM_MOVE_CATALOG.push(collidingEntry);
		ALL_MOVES.push(collidingEntry);
		try {
			const { errors } = validateCustomContent({
				moves: [{ key: "custom:already-here-move", name: "New", traits: [], description: "d" }]
			});
			expect(errors).toContain("moves addition \"custom:already-here-move\"'s key collides with an existing moves catalog entry.");
		} finally {
			CUSTOM_MOVE_CATALOG.splice(CUSTOM_MOVE_CATALOG.indexOf(collidingEntry), 1);
			ALL_MOVES.splice(ALL_MOVES.indexOf(collidingEntry), 1);
		}
	});
});

describe("applyCustomContent — moves unknown field", () => {
	it("warns, but does not error, on an unrecognized field, and drops it from the applied entry", () => {
		const { errors, warnings } = validateCustomContent({
			moves: [{ key: "custom:extra-field-move", name: "N", traits: [], description: "d", bogus: true }]
		});
		expect(errors).toEqual([]);
		expect(warnings).toContain("Unknown field \"bogus\" on moves addition \"custom:extra-field-move\" was ignored.");

		applyCustomContent({ moves: [{ key: "custom:extra-field-move", name: "N", traits: [], description: "d", bogus: true }] });
		expect(findCustom("custom:extra-field-move")).not.toHaveProperty("bogus");
	});
});

// A minimal base entry every field-group test extends, so each test only needs to name the one
// field it's exercising rather than repeating name/traits/description every time.
function moveWith(key, fields) {
	return { key, name: "N", traits: [], description: "d", ...fields };
}

function errorsFor(fields, key = "custom:field-test") {
	return validateCustomContent({ moves: [moveWith(key, fields)] }).errors;
}

describe("validateMoveFields — SIMPLE_FIELD_TYPES", () => {
	it("accepts a string name/description and rejects a non-string", () => {
		expect(errorsFor({ name: "Real Name" })).toEqual([]);
		expect(errorsFor({ name: 5 })).toContain("moves addition \"custom:field-test\"'s \"name\" must be a string.");
		expect(errorsFor({ description: 5 })).toContain("moves addition \"custom:field-test\"'s \"description\" must be a string.");
	});

	it("accepts a string-array traits and rejects a non-array or non-string-array", () => {
		expect(errorsFor({ traits: ["clash", "channel"] })).toEqual([]);
		expect(errorsFor({ traits: "clash" })).toContain("moves addition \"custom:field-test\"'s \"traits\" must be an array of strings.");
		expect(errorsFor({ traits: [1] })).toContain("moves addition \"custom:field-test\"'s \"traits\" must be an array of strings.");
	});

	it("accepts a string downtimeAbility and rejects a non-string", () => {
		expect(errorsFor({ downtimeAbility: "text" })).toEqual([]);
		expect(errorsFor({ downtimeAbility: 5 })).toContain("moves addition \"custom:field-test\"'s \"downtimeAbility\" must be a string.");
	});

	it("accepts a number tierBonus and rejects a non-number", () => {
		expect(errorsFor({ tierBonus: 1 })).toEqual([]);
		expect(errorsFor({ tierBonus: "1" })).toContain("moves addition \"custom:field-test\"'s \"tierBonus\" must be a number.");
	});

	it("accepts a number downtimeTokensMax and rejects a non-number", () => {
		expect(errorsFor({ downtimeTokensMax: 2 })).toEqual([]);
		expect(errorsFor({ downtimeTokensMax: "2" })).toContain("moves addition \"custom:field-test\"'s \"downtimeTokensMax\" must be a number.");
	});

	it("accepts a string exclusiveGroup and rejects a non-string", () => {
		expect(errorsFor({ exclusiveGroup: "group" })).toEqual([]);
		expect(errorsFor({ exclusiveGroup: 5 })).toContain("moves addition \"custom:field-test\"'s \"exclusiveGroup\" must be a string.");
	});

	it("accepts removesTraitCap only as literal true", () => {
		expect(errorsFor({ removesTraitCap: true })).toEqual([]);
		expect(errorsFor({ removesTraitCap: false })).toContain("moves addition \"custom:field-test\"'s \"removesTraitCap\" must be true.");
		expect(errorsFor({ removesTraitCap: "true" })).toContain("moves addition \"custom:field-test\"'s \"removesTraitCap\" must be true.");
	});

	it("accepts a string-array requiresMoves and rejects a non-string-array", () => {
		expect(errorsFor({ requiresMoves: ["a"] })).toEqual([]);
		expect(errorsFor({ requiresMoves: [1] })).toContain("moves addition \"custom:field-test\"'s \"requiresMoves\" must be an array of strings.");
	});

	it("accepts a string-array grantsWeaponTags and rejects a non-string-array", () => {
		expect(errorsFor({ grantsWeaponTags: ["bane"] })).toEqual([]);
		expect(errorsFor({ grantsWeaponTags: [1] })).toContain("moves addition \"custom:field-test\"'s \"grantsWeaponTags\" must be an array of strings.");
	});

	it("accepts separateHold only as literal true", () => {
		expect(errorsFor({ separateHold: true })).toEqual([]);
		expect(errorsFor({ separateHold: false })).toContain("moves addition \"custom:field-test\"'s \"separateHold\" must be true.");
	});

	it("accepts suppressActivateButton only as literal true", () => {
		expect(errorsFor({ suppressActivateButton: true })).toEqual([]);
		expect(errorsFor({ suppressActivateButton: 1 })).toContain("moves addition \"custom:field-test\"'s \"suppressActivateButton\" must be true.");
	});

	it("accepts a number flatHold and rejects a non-number", () => {
		expect(errorsFor({ flatHold: 3 })).toEqual([]);
		expect(errorsFor({ flatHold: "3" })).toContain("moves addition \"custom:field-test\"'s \"flatHold\" must be a number.");
	});

	it("accepts questionsOnFailure only as literal true", () => {
		expect(errorsFor({ questionsOnFailure: true })).toEqual([]);
		expect(errorsFor({ questionsOnFailure: 1 })).toContain("moves addition \"custom:field-test\"'s \"questionsOnFailure\" must be true.");
	});

	it("accepts a string-array questions and rejects a non-string-array", () => {
		expect(errorsFor({ questions: ["Q?"] })).toEqual([]);
		expect(errorsFor({ questions: [1] })).toContain("moves addition \"custom:field-test\"'s \"questions\" must be an array of strings.");
	});
});

describe("validateMoveFields — TIERED_FIELD_SPECS", () => {
	it("rejects a non-object results/hold/questionPrompts", () => {
		expect(errorsFor({ results: "nope" })).toContain("moves addition \"custom:field-test\"'s \"results\" must be an object.");
		expect(errorsFor({ hold: "nope" })).toContain("moves addition \"custom:field-test\"'s \"hold\" must be an object.");
		expect(errorsFor({ questionPrompts: "nope" })).toContain("moves addition \"custom:field-test\"'s \"questionPrompts\" must be an object.");
	});

	it("accepts a results object with only some tiers present, string or null values, since results requires none", () => {
		expect(errorsFor({ results: { success: "You win.", mixed: null } })).toEqual([]);
	});

	it("rejects a results tier value that is neither a string nor null", () => {
		expect(errorsFor({ results: { success: 5 } }))
			.toContain("moves addition \"custom:field-test\"'s \"results.success\" must be a string or null.");
	});

	it("rejects a results critical value that is neither a string nor null", () => {
		expect(errorsFor({ results: { critical: 5 } }))
			.toContain("moves addition \"custom:field-test\"'s \"results.critical\" must be a string or null.");
	});

	it("requires success/mixed/failure (but not critical) on hold, and rejects non-number values", () => {
		const errors = errorsFor({ hold: { critical: 1 } });
		expect(errors).toContain("moves addition \"custom:field-test\"'s \"hold\" is missing required key \"success\".");
		expect(errors).toContain("moves addition \"custom:field-test\"'s \"hold\" is missing required key \"mixed\".");
		expect(errors).toContain("moves addition \"custom:field-test\"'s \"hold\" is missing required key \"failure\".");
	});

	it("accepts a complete hold object with all three required tiers as numbers", () => {
		expect(errorsFor({ hold: { success: 3, mixed: 1, failure: 0 } })).toEqual([]);
	});

	it("rejects a non-number hold tier value", () => {
		expect(errorsFor({ hold: { success: "3", mixed: 1, failure: 0 } }))
			.toContain("moves addition \"custom:field-test\"'s \"hold.success\" must be a number.");
	});

	it("accepts a hold object with critical also present as a number", () => {
		expect(errorsFor({ hold: { success: 3, mixed: 1, failure: 0, critical: 5 } })).toEqual([]);
	});

	it("rejects a non-number hold.critical value", () => {
		expect(errorsFor({ hold: { success: 3, mixed: 1, failure: 0, critical: "5" } }))
			.toContain("moves addition \"custom:field-test\"'s \"hold.critical\" must be a number.");
	});

	it("accepts a questionPrompts object with only some tiers present, since it requires none", () => {
		expect(errorsFor({ questionPrompts: { success: "What do you want?" } })).toEqual([]);
	});

	it("rejects a non-string questionPrompts tier value", () => {
		expect(errorsFor({ questionPrompts: { success: 5 } }))
			.toContain("moves addition \"custom:field-test\"'s \"questionPrompts.success\" must be a string.");
	});
});

describe("validateMoveFields — LABELED_SUB_ARRAY_SPECS", () => {
	it("rejects a non-array conditions/intents/uses/fixedTraits/numericTrackers", () => {
		expect(errorsFor({ conditions: "nope" })).toContain("moves addition \"custom:field-test\"'s \"conditions\" must be an array.");
		expect(errorsFor({ intents: "nope" })).toContain("moves addition \"custom:field-test\"'s \"intents\" must be an array.");
		expect(errorsFor({ uses: "nope" })).toContain("moves addition \"custom:field-test\"'s \"uses\" must be an array.");
		expect(errorsFor({ fixedTraits: "nope" })).toContain("moves addition \"custom:field-test\"'s \"fixedTraits\" must be an array.");
		expect(errorsFor({ numericTrackers: "nope" })).toContain("moves addition \"custom:field-test\"'s \"numericTrackers\" must be an array.");
	});

	it("rejects a non-object item within conditions/intents/uses/fixedTraits/numericTrackers", () => {
		expect(errorsFor({ conditions: ["nope"] })).toContain("moves addition \"custom:field-test\"'s \"conditions[0]\" must be an object.");
	});

	it("accepts a valid {key,label} conditions/intents/uses item and rejects a missing key/label", () => {
		expect(errorsFor({ conditions: [{ key: "a", label: "A" }] })).toEqual([]);
		expect(errorsFor({ conditions: [{ label: "A" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"conditions[0]\" is missing required key \"key\".");
		expect(errorsFor({ conditions: [{ key: "a" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"conditions[0]\" is missing required key \"label\".");

		expect(errorsFor({ intents: [{ key: "a", label: "A" }] })).toEqual([]);
		expect(errorsFor({ intents: [{}] })).toContain("moves addition \"custom:field-test\"'s \"intents[0]\" is missing required key \"key\".");

		expect(errorsFor({ uses: [{ key: "a", label: "A" }] })).toEqual([]);
		expect(errorsFor({ uses: [{}] })).toContain("moves addition \"custom:field-test\"'s \"uses[0]\" is missing required key \"key\".");
	});

	it("requires key/label/value on fixedTraits, and value must be numeric", () => {
		expect(errorsFor({ fixedTraits: [{ key: "crew", label: "CREW", value: 2 }] })).toEqual([]);
		expect(errorsFor({ fixedTraits: [{ key: "crew", label: "CREW" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"fixedTraits[0]\" is missing required key \"value\".");
		expect(errorsFor({ fixedTraits: [{ key: "crew", label: "CREW", value: "2" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"fixedTraits[0].value\" must be a number.");
	});

	it("requires key/label/min/max on numericTrackers, and min/max must be numeric", () => {
		expect(errorsFor({ numericTrackers: [{ key: "t", label: "T", min: 0, max: 5 }] })).toEqual([]);
		expect(errorsFor({ numericTrackers: [{ key: "t", label: "T", max: 5 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"numericTrackers[0]\" is missing required key \"min\".");
		expect(errorsFor({ numericTrackers: [{ key: "t", label: "T", min: 0 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"numericTrackers[0]\" is missing required key \"max\".");
		expect(errorsFor({ numericTrackers: [{ key: "t", label: "T", min: "0", max: 5 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"numericTrackers[0].min\" must be a number.");
		expect(errorsFor({ numericTrackers: [{ key: "t", label: "T", min: 0, max: "5" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"numericTrackers[0].max\" must be a number.");
	});
});

describe("validateMoveFields — grantsAutomaticSuccess", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsAutomaticSuccess: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess\" must be an object.");
	});

	it("accepts the bare costless {} shape", () => {
		expect(errorsFor({ grantsAutomaticSuccess: {} })).toEqual([]);
	});

	it("accepts exactly one of cost/useKey/costsPeril and rejects more than one", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { cost: 1 } })).toEqual([]);
		expect(errorsFor({ grantsAutomaticSuccess: { useKey: "u" } })).toEqual([]);
		expect(errorsFor({ grantsAutomaticSuccess: { costsPeril: true } })).toEqual([]);
		expect(errorsFor({ grantsAutomaticSuccess: { cost: 1, useKey: "u" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess\" can only set one of \"cost\", \"useKey\" or \"costsPeril\".");
	});

	it("rejects a non-number cost", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { cost: "1" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.cost\" must be a number.");
	});

	it("rejects a non-string useKey", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { useKey: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.useKey\" must be a string.");
	});

	it("rejects a costsPeril value other than literal true", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { costsPeril: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.costsPeril\" must be true.");
	});

	it("rejects a non-string-array moves", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { moves: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.moves\" must be an array of strings.");
	});

	it("rejects a non-string-array excludeMoves", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { excludeMoves: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.excludeMoves\" must be an array of strings.");
	});

	it("rejects a non-string requiresTier", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { requiresTier: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.requiresTier\" must be a string.");
	});

	it("rejects a non-string buttonLabel", () => {
		expect(errorsFor({ grantsAutomaticSuccess: { buttonLabel: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAutomaticSuccess.buttonLabel\" must be a string.");
	});

	it("accepts a fully-specified grantsAutomaticSuccess", () => {
		expect(errorsFor({
			grantsAutomaticSuccess: {
				cost: 1,
				moves: ["a"],
				excludeMoves: ["b"],
				requiresTier: "veteran",
				buttonLabel: "Go!"
			}
		})).toEqual([]);
	});
});

describe("validateMoveFields — grantsDowngradeHold", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsDowngradeHold: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsDowngradeHold\" must be an object.");
	});

	it("requires a numeric amount", () => {
		expect(errorsFor({ grantsDowngradeHold: {} }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsDowngradeHold.amount\" must be a number.");
		expect(errorsFor({ grantsDowngradeHold: { amount: "1" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsDowngradeHold.amount\" must be a number.");
		expect(errorsFor({ grantsDowngradeHold: { amount: 1 } })).toEqual([]);
	});

	it("rejects a non-string-array moves/excludeMoves", () => {
		expect(errorsFor({ grantsDowngradeHold: { amount: 1, moves: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsDowngradeHold.moves\" must be an array of strings.");
		expect(errorsFor({ grantsDowngradeHold: { amount: 1, excludeMoves: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsDowngradeHold.excludeMoves\" must be an array of strings.");
	});

	it("accepts moves/excludeMoves as string arrays", () => {
		expect(errorsFor({ grantsDowngradeHold: { amount: 1, moves: ["a"], excludeMoves: ["b"] } })).toEqual([]);
	});
});

describe("validateMoveFields — grantsRollModifier", () => {
	it("rejects a non-array value", () => {
		expect(errorsFor({ grantsRollModifier: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier\" must be an array.");
	});

	it("rejects a non-object entry", () => {
		expect(errorsFor({ grantsRollModifier: ["nope"] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\" must be an object.");
	});

	it("requires at least one of advantage/effect/reminderOnly", () => {
		expect(errorsFor({ grantsRollModifier: [{}] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\" needs at least one of \"advantage\", \"effect\" or \"reminderOnly\".");
	});

	it("accepts advantage alone, effect alone, or reminderOnly alone", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up" }] })).toEqual([]);
		expect(errorsFor({ grantsRollModifier: [{ effect: "text" }] })).toEqual([]);
		expect(errorsFor({ grantsRollModifier: [{ reminderOnly: true }] })).toEqual([]);
	});

	it("rejects a non-string advantage/effect", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"advantage\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ effect: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"effect\" must be a string.");
	});

	it("rejects a reminderOnly value other than literal true", () => {
		expect(errorsFor({ grantsRollModifier: [{ reminderOnly: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"reminderOnly\" must be true.");
	});

	it("allows only one resource gate at a time", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", requiresOverheating: true, costsSpotlight: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\" can only set one resource gate (requiresOverheating, costsSpotlight, costsHold, costsPotion, costsUse, costsTracker).");
	});

	it("rejects a requiresOverheating value other than literal true", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", requiresOverheating: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"requiresOverheating\" must be true.");
	});

	it("accepts requiresOverheating: true alone", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", requiresOverheating: true }] })).toEqual([]);
	});

	it("rejects a non-number costsSpotlight", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsSpotlight: "1" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsSpotlight\" must be a number.");
	});

	it("accepts a numeric costsSpotlight", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsSpotlight: 1 }] })).toEqual([]);
	});

	it("rejects a non-string costsPotion/costsUse", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsPotion: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsPotion\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsUse: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsUse\" must be a string.");
	});

	it("accepts a string costsPotion/costsUse", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsPotion: "p" }] })).toEqual([]);
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsUse: "u" }] })).toEqual([]);
	});

	it("rejects a non-object costsHold, and requires a numeric amount within it", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsHold: "nope" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsHold\" must be an object.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsHold: {} }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsHold.amount\" must be a number.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsHold: { amount: "1" } }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsHold.amount\" must be a number.");
	});

	it("rejects a non-string costsHold.moveKey and accepts a valid one", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsHold: { amount: 1, moveKey: 1 } }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsHold.moveKey\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsHold: { amount: 1, moveKey: "a" } }] })).toEqual([]);
	});

	it("rejects a non-object costsTracker, and requires trackerKey/amount within it", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsTracker: "nope" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsTracker\" must be an object.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsTracker: {} }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsTracker.trackerKey\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsTracker: { trackerKey: "t" } }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsTracker.amount\" must be a number.");
	});

	it("rejects a non-string costsTracker.moveKey and accepts a valid one", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsTracker: { trackerKey: "t", amount: 1, moveKey: 1 } }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"costsTracker.moveKey\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", costsTracker: { trackerKey: "t", amount: 1, moveKey: "a" } }] })).toEqual([]);
	});

	it("rejects a non-string-array moveKeys and accepts a valid one", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", moveKeys: [1] }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"moveKeys\" must be an array of strings.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", moveKeys: ["a"] }] })).toEqual([]);
	});

	it("rejects a non-string-array requiresAdvantage and accepts a valid one", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", requiresAdvantage: [1] }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"requiresAdvantage\" must be an array of strings.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", requiresAdvantage: ["advantage"] }] })).toEqual([]);
	});

	it("rejects a non-boolean forced and accepts a boolean", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", forced: "yes" }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"forced\" must be a boolean.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", forced: true }] })).toEqual([]);
	});

	it("rejects a non-string buttonLabel and accepts a string", () => {
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", buttonLabel: 1 }] }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[0]\"'s \"buttonLabel\" must be a string.");
		expect(errorsFor({ grantsRollModifier: [{ advantage: "up", buttonLabel: "Go" }] })).toEqual([]);
	});

	it("validates every entry in a multi-entry array independently", () => {
		const errors = errorsFor({ grantsRollModifier: [{ advantage: "up" }, {}] });
		expect(errors).toContain("moves addition \"custom:field-test\"'s \"grantsRollModifier[1]\" needs at least one of \"advantage\", \"effect\" or \"reminderOnly\".");
	});
});

describe("validateMoveFields — addsCriticalReminderToMove", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ addsCriticalReminderToMove: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"addsCriticalReminderToMove\" must be an object.");
	});

	it("requires a string reminder", () => {
		expect(errorsFor({ addsCriticalReminderToMove: {} }))
			.toContain("moves addition \"custom:field-test\"'s \"addsCriticalReminderToMove.reminder\" must be a string.");
		expect(errorsFor({ addsCriticalReminderToMove: { reminder: "text" } })).toEqual([]);
	});

	it("rejects a non-string-array moveKeys, which is optional here", () => {
		expect(errorsFor({ addsCriticalReminderToMove: { reminder: "text", moveKeys: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsCriticalReminderToMove.moveKeys\" must be an array of strings.");
		expect(errorsFor({ addsCriticalReminderToMove: { reminder: "text", moveKeys: ["a"] } })).toEqual([]);
	});

	it("rejects a non-string requiresTrait", () => {
		expect(errorsFor({ addsCriticalReminderToMove: { reminder: "text", requiresTrait: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsCriticalReminderToMove.requiresTrait\" must be a string.");
		expect(errorsFor({ addsCriticalReminderToMove: { reminder: "text", requiresTrait: "clash" } })).toEqual([]);
	});
});

describe("validateMoveFields — addsMixedReminderToMove/addsSuccessReminderToMove/addsFailureReminderToMove", () => {
	for (const field of ["addsMixedReminderToMove", "addsSuccessReminderToMove", "addsFailureReminderToMove"]) {
		it(`${field} rejects a non-object value`, () => {
			expect(errorsFor({ [field]: "nope" })).toContain(`moves addition "custom:field-test"'s "${field}" must be an object.`);
		});

		it(`${field} requires a string reminder`, () => {
			expect(errorsFor({ [field]: { moveKeys: ["a"] } }))
				.toContain(`moves addition "custom:field-test"'s "${field}.reminder" must be a string.`);
		});

		it(`${field} requires moveKeys as a non-optional string array`, () => {
			expect(errorsFor({ [field]: { reminder: "text" } }))
				.toContain(`moves addition "custom:field-test"'s "${field}.moveKeys" must be an array of strings.`);
			expect(errorsFor({ [field]: { reminder: "text", moveKeys: [1] } }))
				.toContain(`moves addition "custom:field-test"'s "${field}.moveKeys" must be an array of strings.`);
		});

		it(`${field} accepts a valid {reminder, moveKeys} shape`, () => {
			expect(errorsFor({ [field]: { reminder: "text", moveKeys: ["a"] } })).toEqual([]);
		});
	}
});

describe("validateMoveFields — addsTraitToMove", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ addsTraitToMove: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove\" must be an object.");
	});

	it("requires a string trait", () => {
		expect(errorsFor({ addsTraitToMove: { moveKey: "a" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.trait\" must be a string.");
	});

	it("accepts chooseMove: true with a trait, and rejects a non-true chooseMove", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", chooseMove: true } })).toEqual([]);
		expect(errorsFor({ addsTraitToMove: { trait: "clash", chooseMove: "yes" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.chooseMove\" must be true.");
	});

	it("rejects chooseMove combined with moveKey or moveKeys", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", chooseMove: true, moveKey: "a" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove\" cannot combine \"chooseMove\" with \"moveKey\"/\"moveKeys\".");
		expect(errorsFor({ addsTraitToMove: { trait: "clash", chooseMove: true, moveKeys: ["a"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove\" cannot combine \"chooseMove\" with \"moveKey\"/\"moveKeys\".");
	});

	it("requires exactly one of moveKey or moveKeys when chooseMove is absent", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove\" needs exactly one of \"moveKey\" or \"moveKeys\" (or \"chooseMove: true\").");
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: "a", moveKeys: ["b"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove\" needs exactly one of \"moveKey\" or \"moveKeys\" (or \"chooseMove: true\").");
	});

	it("accepts a fixed moveKey and rejects a non-string one", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: "a" } })).toEqual([]);
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.moveKey\" must be a string.");
	});

	it("accepts a fixed moveKeys array and rejects a non-string-array one", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKeys: ["a"] } })).toEqual([]);
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKeys: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.moveKeys\" must be an array of strings.");
	});

	it("rejects a non-boolean requiresUnmounted/requiresAstirMounted", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: "a", requiresUnmounted: "yes" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.requiresUnmounted\" must be a boolean.");
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: "a", requiresAstirMounted: "yes" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsTraitToMove.requiresAstirMounted\" must be a boolean.");
	});

	it("accepts boolean requiresUnmounted/requiresAstirMounted", () => {
		expect(errorsFor({ addsTraitToMove: { trait: "clash", moveKey: "a", requiresUnmounted: true, requiresAstirMounted: false } }))
			.toEqual([]);
	});
});

describe("validateMoveFields — addsQuestionsToMove", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ addsQuestionsToMove: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"addsQuestionsToMove\" must be an object.");
	});

	it("requires a string moveKey", () => {
		expect(errorsFor({ addsQuestionsToMove: { questions: ["Q?"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsQuestionsToMove.moveKey\" must be a string.");
	});

	it("requires a non-empty string-array questions", () => {
		expect(errorsFor({ addsQuestionsToMove: { moveKey: "a" } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsQuestionsToMove.questions\" must be a non-empty array of strings.");
		expect(errorsFor({ addsQuestionsToMove: { moveKey: "a", questions: [] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsQuestionsToMove.questions\" must be a non-empty array of strings.");
		expect(errorsFor({ addsQuestionsToMove: { moveKey: "a", questions: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"addsQuestionsToMove.questions\" must be a non-empty array of strings.");
	});

	it("accepts a valid {moveKey, questions} shape", () => {
		expect(errorsFor({ addsQuestionsToMove: { moveKey: "a", questions: ["Q?"] } })).toEqual([]);
	});
});

describe("validateMoveFields — grantsEquipment", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsEquipment: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment\" must be an object.");
	});

	it("requires kind to be weapon or gear", () => {
		expect(errorsFor({ grantsEquipment: { name: "N", tags: [] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment.kind\" must be \"weapon\" or \"gear\".");
		expect(errorsFor({ grantsEquipment: { kind: "vehicle", name: "N", tags: [] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment.kind\" must be \"weapon\" or \"gear\".");
	});

	it("requires a string name", () => {
		expect(errorsFor({ grantsEquipment: { kind: "gear", tags: [] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment.name\" must be a string.");
	});

	it("requires tags to be a string array", () => {
		expect(errorsFor({ grantsEquipment: { kind: "gear", name: "N", tags: "nope" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment.tags\" must be an array of strings.");
	});

	it("accepts a valid gear entry with an empty tags array", () => {
		expect(errorsFor({ grantsEquipment: { kind: "gear", name: "N", tags: [] } })).toEqual([]);
	});

	it("validates real tag keys within grantsEquipment.tags", () => {
		expect(errorsFor({ grantsEquipment: { kind: "gear", name: "N", tags: ["not-a-real-tag"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment\" references unknown tag \"not-a-real-tag\".");
	});

	it("requires a range tag on a weapon-kind grantsEquipment, and accepts one that has it", () => {
		expect(errorsFor({ grantsEquipment: { kind: "weapon", name: "N", tags: ["bulky"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment\" needs exactly one of the melee, ranged or sniper tags.");
		expect(errorsFor({ grantsEquipment: { kind: "weapon", name: "N", tags: ["melee"] } })).toEqual([]);
	});

	it("does not require a range tag on gear", () => {
		expect(errorsFor({ grantsEquipment: { kind: "gear", name: "N", tags: ["bulky"] } })).toEqual([]);
	});

	it("validates an optional scale against the real WEAPON_SCALES keys", () => {
		expect(errorsFor({ grantsEquipment: { kind: "weapon", name: "N", tags: ["melee"], scale: "vehicle" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsEquipment.scale\" must be \"foot\" or \"astir\".");
		expect(errorsFor({ grantsEquipment: { kind: "weapon", name: "N", tags: ["melee"], scale: "foot" } })).toEqual([]);
		expect(errorsFor({ grantsEquipment: { kind: "weapon", name: "N", tags: ["melee"], scale: "astir" } })).toEqual([]);
	});
});

describe("validateMoveFields — grantsWeaponTagChoice", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsWeaponTagChoice: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsWeaponTagChoice\" must be an object.");
	});

	it("requires a string targetEquipmentName", () => {
		expect(errorsFor({ grantsWeaponTagChoice: { options: ["bane"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsWeaponTagChoice.targetEquipmentName\" must be a string.");
	});

	it("requires options to be a string array", () => {
		expect(errorsFor({ grantsWeaponTagChoice: { targetEquipmentName: "N", options: "nope" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsWeaponTagChoice.options\" must be an array of strings.");
	});

	it("rejects an option that isn't a real tag key", () => {
		expect(errorsFor({ grantsWeaponTagChoice: { targetEquipmentName: "N", options: ["not-a-real-tag"] } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsWeaponTagChoice\" references unknown tag \"not-a-real-tag\".");
	});

	it("accepts a valid {targetEquipmentName, options} shape", () => {
		expect(errorsFor({ grantsWeaponTagChoice: { targetEquipmentName: "N", options: ["bane", "bulky"] } })).toEqual([]);
	});
});

describe("validateMoveFields — grantsAdvantageOnMove", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsAdvantageOnMove: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAdvantageOnMove\" must be an object.");
	});

	it("requires a string moveKey and a string advantage", () => {
		expect(errorsFor({ grantsAdvantageOnMove: { advantage: "up" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAdvantageOnMove.moveKey\" must be a string.");
		expect(errorsFor({ grantsAdvantageOnMove: { moveKey: "a" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsAdvantageOnMove.advantage\" must be a string.");
	});

	it("accepts a valid {moveKey, advantage} shape", () => {
		expect(errorsFor({ grantsAdvantageOnMove: { moveKey: "a", advantage: "up" } })).toEqual([]);
	});
});

describe("validateMoveFields — quickRollsMove", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ quickRollsMove: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"quickRollsMove\" must be an object.");
	});

	it("requires a string moveKey", () => {
		expect(errorsFor({ quickRollsMove: {} }))
			.toContain("moves addition \"custom:field-test\"'s \"quickRollsMove.moveKey\" must be a string.");
	});

	it("rejects a non-string trait/advantage, both optional", () => {
		expect(errorsFor({ quickRollsMove: { moveKey: "a", trait: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"quickRollsMove.trait\" must be a string.");
		expect(errorsFor({ quickRollsMove: { moveKey: "a", advantage: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"quickRollsMove.advantage\" must be a string.");
	});

	it("rejects a non-string-array reminders, also optional", () => {
		expect(errorsFor({ quickRollsMove: { moveKey: "a", reminders: [1] } }))
			.toContain("moves addition \"custom:field-test\"'s \"quickRollsMove.reminders\" must be an array of strings.");
	});

	it("accepts a fully-specified quickRollsMove", () => {
		expect(errorsFor({ quickRollsMove: { moveKey: "a", trait: "clash", advantage: "up", reminders: ["r"] } })).toEqual([]);
	});

	it("accepts the minimal {moveKey} shape", () => {
		expect(errorsFor({ quickRollsMove: { moveKey: "a" } })).toEqual([]);
	});
});

describe("validateMoveFields — grantsExternalRollBonus", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ grantsExternalRollBonus: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsExternalRollBonus\" must be an object.");
	});

	it("requires a numeric dieFaces", () => {
		expect(errorsFor({ grantsExternalRollBonus: {} }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsExternalRollBonus.dieFaces\" must be a number.");
		expect(errorsFor({ grantsExternalRollBonus: { dieFaces: "6" } }))
			.toContain("moves addition \"custom:field-test\"'s \"grantsExternalRollBonus.dieFaces\" must be a number.");
		expect(errorsFor({ grantsExternalRollBonus: { dieFaces: 6 } })).toEqual([]);
	});
});

describe("validateMoveFields — upgradesExternalRollBonusDie", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ upgradesExternalRollBonusDie: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"upgradesExternalRollBonusDie\" must be an object.");
	});

	it("requires a string moveKey and a numeric dieFaces", () => {
		expect(errorsFor({ upgradesExternalRollBonusDie: { dieFaces: 6 } }))
			.toContain("moves addition \"custom:field-test\"'s \"upgradesExternalRollBonusDie.moveKey\" must be a string.");
		expect(errorsFor({ upgradesExternalRollBonusDie: { moveKey: "a" } }))
			.toContain("moves addition \"custom:field-test\"'s \"upgradesExternalRollBonusDie.dieFaces\" must be a number.");
		expect(errorsFor({ upgradesExternalRollBonusDie: { moveKey: "a", dieFaces: 6 } })).toEqual([]);
	});
});

describe("validateMoveFields — promptsApproachOverride", () => {
	it("accepts bare true", () => {
		expect(errorsFor({ promptsApproachOverride: true })).toEqual([]);
	});

	it("accepts an object with a string period", () => {
		expect(errorsFor({ promptsApproachOverride: { period: "Sortie" } })).toEqual([]);
	});

	it("rejects false", () => {
		expect(errorsFor({ promptsApproachOverride: false }))
			.toContain("moves addition \"custom:field-test\"'s \"promptsApproachOverride\" must be true or an object with a string \"period\".");
	});

	it("rejects an object missing a string period", () => {
		expect(errorsFor({ promptsApproachOverride: {} }))
			.toContain("moves addition \"custom:field-test\"'s \"promptsApproachOverride\" must be true or an object with a string \"period\".");
		expect(errorsFor({ promptsApproachOverride: { period: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"promptsApproachOverride\" must be true or an object with a string \"period\".");
	});
});

describe("validateMoveFields — bonusDowntimeTokens", () => {
	it("rejects a non-object value", () => {
		expect(errorsFor({ bonusDowntimeTokens: "nope" }))
			.toContain("moves addition \"custom:field-test\"'s \"bonusDowntimeTokens\" must be an object.");
	});

	it("requires a numeric max and a string description", () => {
		expect(errorsFor({ bonusDowntimeTokens: { description: "d" } }))
			.toContain("moves addition \"custom:field-test\"'s \"bonusDowntimeTokens.max\" must be a number.");
		expect(errorsFor({ bonusDowntimeTokens: { max: 1 } }))
			.toContain("moves addition \"custom:field-test\"'s \"bonusDowntimeTokens.description\" must be a string.");
		expect(errorsFor({ bonusDowntimeTokens: { max: 1, description: "d" } })).toEqual([]);
	});
});

describe("applyCustomContent — moves full-shape real-world example", () => {
	it("applies a rich custom move exercising several field groups at once, cleanly", () => {
		const warnings = applyCustomContent({
			moves: [{
				key: "custom:rich-move",
				name: "Rich Move",
				traits: ["clash"],
				description: "d",
				results: { success: "Win.", mixed: "Partial.", failure: "Lose." },
				conditions: [{ key: "flank", label: "You have the flank" }],
				grantsRollModifier: [{ advantage: "up", costsHold: { amount: 1 } }],
				grantsEquipment: { kind: "weapon", name: "Given Blade", tags: ["melee"], scale: "foot" }
			}]
		});

		expect(warnings).toEqual([]);
		expect(findCustom("custom:rich-move")).toMatchObject({ name: "Rich Move", traits: ["clash"] });
	});
});
