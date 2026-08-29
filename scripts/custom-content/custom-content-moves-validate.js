import { validateTagKeys, validateWeaponRangeTag } from "./custom-content-tag-validate.js";
import { EQUIPMENT_TAGS } from "../equipment/equipment-tags.js";
import { findEquipmentTag } from "../equipment/equipment-helpers.js";
import { WEAPON_SCALES } from "../equipment/equipment-constants.js";

// The moves-specific validator for custom-content-apply.js's SECTION_VALIDATORS dispatch — see
// docs/domains/reflavor.md's moves subsection for the three-tier validation-depth approach every
// helper below follows: (1) type/shape guard, (2) required-sub-key guard on any structured field,
// (3) cross-reference resolution (a move key genuinely resolving to something real) is deliberately
// never checked, matching this codebase's existing graceful-degradation philosophy for stale/
// forward-referenced move keys (resolvePlaybookMoves, unmetMoveRequirements).

function isPlainObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value) {
	return Array.isArray(value) && value.every((item) => typeof item === "string");
}

// Every field here needs only a bare type guard — no required sub-keys, no bespoke shape. "true"
// means the field is only ever legal as the literal boolean `true` (mirrors astir-parts.js's own
// removesTraitCap/separateHold/suppressActivateButton/questionsOnFailure flags, none of which are
// ever meaningfully `false` — the field's mere presence is the "on" signal).
const SIMPLE_FIELD_TYPES = {
	name: "string",
	description: "string",
	traits: "string[]",
	downtimeAbility: "string",
	tierBonus: "number",
	downtimeTokensMax: "number",
	exclusiveGroup: "string",
	removesTraitCap: "true",
	requiresMoves: "string[]",
	grantsWeaponTags: "string[]",
	separateHold: "true",
	suppressActivateButton: "true",
	flatHold: "number",
	questionsOnFailure: "true",
	questions: "string[]"
};

function validateSimpleFields(entry, errors, context) {
	for (const [field, type] of Object.entries(SIMPLE_FIELD_TYPES)) {
		if (!(field in entry)) continue;
		const value = entry[field];
		if (type === "string" && typeof value !== "string") {
			errors.push(`${context}'s "${field}" must be a string.`);
		} else if (type === "number" && typeof value !== "number") {
			errors.push(`${context}'s "${field}" must be a number.`);
		} else if (type === "true" && value !== true) {
			errors.push(`${context}'s "${field}" must be true.`);
		} else if (type === "string[]" && !isStringArray(value)) {
			errors.push(`${context}'s "${field}" must be an array of strings.`);
		}
	}
}

// Each tiered field is keyed success/mixed/failure(/critical) — required lists which of those keys
// must actually be present (results/questionPrompts require none: a prose-only move may define no
// tiers at all, or only some), and type governs every present key's own value.
const TIERED_FIELD_SPECS = {
	results: { keys: ["success", "mixed", "failure", "critical"], required: [], type: "stringOrNull" },
	hold: { keys: ["success", "mixed", "failure", "critical"], required: ["success", "mixed", "failure"], type: "number" },
	questionPrompts: { keys: ["success", "mixed", "failure"], required: [], type: "string" }
};

function validateTieredFields(entry, errors, context) {
	for (const [field, spec] of Object.entries(TIERED_FIELD_SPECS)) {
		if (!(field in entry)) continue;
		const value = entry[field];
		if (!isPlainObject(value)) {
			errors.push(`${context}'s "${field}" must be an object.`);
			continue;
		}
		for (const key of spec.required) {
			if (!(key in value)) errors.push(`${context}'s "${field}" is missing required key "${key}".`);
		}
		for (const key of spec.keys) {
			if (!(key in value)) continue;
			const tierValue = value[key];
			if (spec.type === "number" && typeof tierValue !== "number") {
				errors.push(`${context}'s "${field}.${key}" must be a number.`);
			} else if (spec.type === "string" && typeof tierValue !== "string") {
				errors.push(`${context}'s "${field}.${key}" must be a string.`);
			} else if (spec.type === "stringOrNull" && tierValue !== null && typeof tierValue !== "string") {
				errors.push(`${context}'s "${field}.${key}" must be a string or null.`);
			}
		}
	}
}

// Each labeled sub-array is a list of {key, label, ...mechanical fields} objects (see
// docs/domains/reflavor.md's own "Sub-array label overrides" for the reflavor-side counterpart of
// this same shape) — requiredKeys lists every key its own real-world resolver dereferences
// unconditionally (fixedTraits' `value`, numericTrackers' `min`/`max`), numericKeys narrows which of
// those must additionally be numbers.
const LABELED_SUB_ARRAY_SPECS = {
	conditions: { requiredKeys: ["key", "label"], numericKeys: [] },
	intents: { requiredKeys: ["key", "label"], numericKeys: [] },
	uses: { requiredKeys: ["key", "label"], numericKeys: [] },
	fixedTraits: { requiredKeys: ["key", "label", "value"], numericKeys: ["value"] },
	numericTrackers: { requiredKeys: ["key", "label", "min", "max"], numericKeys: ["min", "max"] }
};

function validateLabeledSubArrays(entry, errors, context) {
	for (const [field, spec] of Object.entries(LABELED_SUB_ARRAY_SPECS)) {
		if (!(field in entry)) continue;
		const value = entry[field];
		if (!Array.isArray(value)) {
			errors.push(`${context}'s "${field}" must be an array.`);
			continue;
		}
		value.forEach((item, index) => {
			if (!isPlainObject(item)) {
				errors.push(`${context}'s "${field}[${index}]" must be an object.`);
				return;
			}
			for (const key of spec.requiredKeys) {
				if (!(key in item)) errors.push(`${context}'s "${field}[${index}]" is missing required key "${key}".`);
			}
			for (const key of spec.numericKeys) {
				if (key in item && typeof item[key] !== "number") {
					errors.push(`${context}'s "${field}[${index}].${key}" must be a number.`);
				}
			}
		});
	}
}

// grantsAutomaticSuccess is one of {cost}/{useKey, moves?}/{costsPeril, moves?}/{excludeMoves?}
// (bare {} also legal — the costless "offered on any roll" case) plus optional requiresTier/
// buttonLabel — see docs/domains/moves.md's own shape-table row for the full mechanic.
function validateGrantsAutomaticSuccess(entry, errors, context) {
	const value = entry.grantsAutomaticSuccess;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsAutomaticSuccess" must be an object.`);
		return;
	}
	const exclusiveKeys = ["cost", "useKey", "costsPeril"].filter((key) => key in value);
	if (exclusiveKeys.length > 1) {
		errors.push(`${context}'s "grantsAutomaticSuccess" can only set one of "cost", "useKey" or "costsPeril".`);
	}
	if ("cost" in value && typeof value.cost !== "number") {
		errors.push(`${context}'s "grantsAutomaticSuccess.cost" must be a number.`);
	}
	if ("useKey" in value && typeof value.useKey !== "string") {
		errors.push(`${context}'s "grantsAutomaticSuccess.useKey" must be a string.`);
	}
	if ("costsPeril" in value && value.costsPeril !== true) {
		errors.push(`${context}'s "grantsAutomaticSuccess.costsPeril" must be true.`);
	}
	if ("moves" in value && !isStringArray(value.moves)) {
		errors.push(`${context}'s "grantsAutomaticSuccess.moves" must be an array of strings.`);
	}
	if ("excludeMoves" in value && !isStringArray(value.excludeMoves)) {
		errors.push(`${context}'s "grantsAutomaticSuccess.excludeMoves" must be an array of strings.`);
	}
	if ("requiresTier" in value && typeof value.requiresTier !== "string") {
		errors.push(`${context}'s "grantsAutomaticSuccess.requiresTier" must be a string.`);
	}
	if ("buttonLabel" in value && typeof value.buttonLabel !== "string") {
		errors.push(`${context}'s "grantsAutomaticSuccess.buttonLabel" must be a string.`);
	}
}

function validateGrantsDowngradeHold(entry, errors, context) {
	const value = entry.grantsDowngradeHold;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsDowngradeHold" must be an object.`);
		return;
	}
	if (typeof value.amount !== "number") errors.push(`${context}'s "grantsDowngradeHold.amount" must be a number.`);
	if ("moves" in value && !isStringArray(value.moves)) {
		errors.push(`${context}'s "grantsDowngradeHold.moves" must be an array of strings.`);
	}
	if ("excludeMoves" in value && !isStringArray(value.excludeMoves)) {
		errors.push(`${context}'s "grantsDowngradeHold.excludeMoves" must be an array of strings.`);
	}
}

const ROLL_MODIFIER_GATE_KEYS = ["requiresOverheating", "costsSpotlight", "costsHold", "costsPotion", "costsUse", "costsTracker"];

function validateRollModifierEntry(value, errors, context, index) {
	const label = `${context}'s "grantsRollModifier[${index}]"`;
	if (!isPlainObject(value)) {
		errors.push(`${label} must be an object.`);
		return;
	}
	if (!("advantage" in value) && !("effect" in value) && !("reminderOnly" in value)) {
		errors.push(`${label} needs at least one of "advantage", "effect" or "reminderOnly".`);
	}
	if ("advantage" in value && typeof value.advantage !== "string") errors.push(`${label}'s "advantage" must be a string.`);
	if ("effect" in value && typeof value.effect !== "string") errors.push(`${label}'s "effect" must be a string.`);
	if ("reminderOnly" in value && value.reminderOnly !== true) errors.push(`${label}'s "reminderOnly" must be true.`);

	const gateKeys = ROLL_MODIFIER_GATE_KEYS.filter((key) => key in value);
	if (gateKeys.length > 1) {
		errors.push(`${label} can only set one resource gate (${ROLL_MODIFIER_GATE_KEYS.join(", ")}).`);
	}
	if ("requiresOverheating" in value && value.requiresOverheating !== true) {
		errors.push(`${label}'s "requiresOverheating" must be true.`);
	}
	if ("costsSpotlight" in value && typeof value.costsSpotlight !== "number") {
		errors.push(`${label}'s "costsSpotlight" must be a number.`);
	}
	if ("costsPotion" in value && typeof value.costsPotion !== "string") errors.push(`${label}'s "costsPotion" must be a string.`);
	if ("costsUse" in value && typeof value.costsUse !== "string") errors.push(`${label}'s "costsUse" must be a string.`);
	if ("costsHold" in value) {
		if (!isPlainObject(value.costsHold)) {
			errors.push(`${label}'s "costsHold" must be an object.`);
		} else {
			if (typeof value.costsHold.amount !== "number") errors.push(`${label}'s "costsHold.amount" must be a number.`);
			if ("moveKey" in value.costsHold && typeof value.costsHold.moveKey !== "string") {
				errors.push(`${label}'s "costsHold.moveKey" must be a string.`);
			}
		}
	}
	if ("costsTracker" in value) {
		if (!isPlainObject(value.costsTracker)) {
			errors.push(`${label}'s "costsTracker" must be an object.`);
		} else {
			if (typeof value.costsTracker.trackerKey !== "string") errors.push(`${label}'s "costsTracker.trackerKey" must be a string.`);
			if (typeof value.costsTracker.amount !== "number") errors.push(`${label}'s "costsTracker.amount" must be a number.`);
			if ("moveKey" in value.costsTracker && typeof value.costsTracker.moveKey !== "string") {
				errors.push(`${label}'s "costsTracker.moveKey" must be a string.`);
			}
		}
	}
	if ("moveKeys" in value && !isStringArray(value.moveKeys)) errors.push(`${label}'s "moveKeys" must be an array of strings.`);
	if ("requiresAdvantage" in value && !isStringArray(value.requiresAdvantage)) {
		errors.push(`${label}'s "requiresAdvantage" must be an array of strings.`);
	}
	if ("forced" in value && typeof value.forced !== "boolean") errors.push(`${label}'s "forced" must be a boolean.`);
	if ("buttonLabel" in value && typeof value.buttonLabel !== "string") errors.push(`${label}'s "buttonLabel" must be a string.`);
}

function validateGrantsRollModifier(entry, errors, context) {
	const value = entry.grantsRollModifier;
	if (!Array.isArray(value)) {
		errors.push(`${context}'s "grantsRollModifier" must be an array.`);
		return;
	}
	value.forEach((item, index) => validateRollModifierEntry(item, errors, context, index));
}

function validateAddsCriticalReminderToMove(entry, errors, context) {
	const value = entry.addsCriticalReminderToMove;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "addsCriticalReminderToMove" must be an object.`);
		return;
	}
	if (typeof value.reminder !== "string") errors.push(`${context}'s "addsCriticalReminderToMove.reminder" must be a string.`);
	if ("moveKeys" in value && !isStringArray(value.moveKeys)) {
		errors.push(`${context}'s "addsCriticalReminderToMove.moveKeys" must be an array of strings.`);
	}
	if ("requiresTrait" in value && typeof value.requiresTrait !== "string") {
		errors.push(`${context}'s "addsCriticalReminderToMove.requiresTrait" must be a string.`);
	}
}

// addsMixedReminderToMove/addsSuccessReminderToMove/addsFailureReminderToMove share the exact same
// shape — {reminder, moveKeys} — unlike their addsCriticalReminderToMove sibling above, moveKeys is
// required here, not optional (see docs/domains/moves.md's own note on this asymmetry).
function validateReminderWithRequiredMoveKeys(field) {
	return (entry, errors, context) => {
		const value = entry[field];
		if (!isPlainObject(value)) {
			errors.push(`${context}'s "${field}" must be an object.`);
			return;
		}
		if (typeof value.reminder !== "string") errors.push(`${context}'s "${field}.reminder" must be a string.`);
		if (!isStringArray(value.moveKeys)) errors.push(`${context}'s "${field}.moveKeys" must be an array of strings.`);
	};
}

// Exactly one of two mutually-exclusive shapes: {chooseMove: true, trait, requiresUnmounted?} (the
// player picks the target move on their own sheet) or a fixed-target form naming exactly one of
// moveKey/moveKeys plus the same trait, optionally gated by requiresUnmounted/requiresAstirMounted.
function validateAddsTraitToMove(entry, errors, context) {
	const value = entry.addsTraitToMove;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "addsTraitToMove" must be an object.`);
		return;
	}
	if (typeof value.trait !== "string") errors.push(`${context}'s "addsTraitToMove.trait" must be a string.`);

	if ("chooseMove" in value) {
		if (value.chooseMove !== true) errors.push(`${context}'s "addsTraitToMove.chooseMove" must be true.`);
		if ("moveKey" in value || "moveKeys" in value) {
			errors.push(`${context}'s "addsTraitToMove" cannot combine "chooseMove" with "moveKey"/"moveKeys".`);
		}
	} else {
		const hasMoveKey = "moveKey" in value;
		const hasMoveKeys = "moveKeys" in value;
		if (hasMoveKey === hasMoveKeys) {
			errors.push(`${context}'s "addsTraitToMove" needs exactly one of "moveKey" or "moveKeys" (or "chooseMove: true").`);
		} else if (hasMoveKey && typeof value.moveKey !== "string") {
			errors.push(`${context}'s "addsTraitToMove.moveKey" must be a string.`);
		} else if (hasMoveKeys && !isStringArray(value.moveKeys)) {
			errors.push(`${context}'s "addsTraitToMove.moveKeys" must be an array of strings.`);
		}
	}
	if ("requiresUnmounted" in value && typeof value.requiresUnmounted !== "boolean") {
		errors.push(`${context}'s "addsTraitToMove.requiresUnmounted" must be a boolean.`);
	}
	if ("requiresAstirMounted" in value && typeof value.requiresAstirMounted !== "boolean") {
		errors.push(`${context}'s "addsTraitToMove.requiresAstirMounted" must be a boolean.`);
	}
}

function validateAddsQuestionsToMove(entry, errors, context) {
	const value = entry.addsQuestionsToMove;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "addsQuestionsToMove" must be an object.`);
		return;
	}
	if (typeof value.moveKey !== "string") errors.push(`${context}'s "addsQuestionsToMove.moveKey" must be a string.`);
	if (!isStringArray(value.questions) || value.questions.length === 0) {
		errors.push(`${context}'s "addsQuestionsToMove.questions" must be a non-empty array of strings.`);
	}
}

// Reuses custom-content-apply.js's own validateTagKeys/validateWeaponRangeTag rather than
// re-deriving the tag/range-tag rules — a custom move's grantsEquipment field is exactly the same
// weapon/gear shape an equipment addition's own tags already are.
function validateGrantsEquipment(entry, errors, context) {
	const value = entry.grantsEquipment;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsEquipment" must be an object.`);
		return;
	}
	if (value.kind !== "weapon" && value.kind !== "gear") {
		errors.push(`${context}'s "grantsEquipment.kind" must be "weapon" or "gear".`);
	}
	if (typeof value.name !== "string") errors.push(`${context}'s "grantsEquipment.name" must be a string.`);

	if (!isStringArray(value.tags)) {
		errors.push(`${context}'s "grantsEquipment.tags" must be an array of strings.`);
	} else {
		const tagContext = `${context}'s "grantsEquipment"`;
		validateTagKeys(value.tags, errors, tagContext);
		if (value.kind === "weapon") validateWeaponRangeTag(value.tags, errors, tagContext);
	}
	if ("scale" in value && !WEAPON_SCALES.some((scale) => scale.key === value.scale)) {
		errors.push(`${context}'s "grantsEquipment.scale" must be "foot" or "astir".`);
	}
}

function validateGrantsWeaponTagChoice(entry, errors, context) {
	const value = entry.grantsWeaponTagChoice;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsWeaponTagChoice" must be an object.`);
		return;
	}
	if (typeof value.targetEquipmentName !== "string") {
		errors.push(`${context}'s "grantsWeaponTagChoice.targetEquipmentName" must be a string.`);
	}
	if (!isStringArray(value.options)) {
		errors.push(`${context}'s "grantsWeaponTagChoice.options" must be an array of strings.`);
	} else {
		for (const tagKey of value.options) {
			if (!findEquipmentTag(tagKey, EQUIPMENT_TAGS)) {
				errors.push(`${context}'s "grantsWeaponTagChoice" references unknown tag "${tagKey}".`);
			}
		}
	}
}

function validateGrantsAdvantageOnMove(entry, errors, context) {
	const value = entry.grantsAdvantageOnMove;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsAdvantageOnMove" must be an object.`);
		return;
	}
	if (typeof value.moveKey !== "string") errors.push(`${context}'s "grantsAdvantageOnMove.moveKey" must be a string.`);
	if (typeof value.advantage !== "string") errors.push(`${context}'s "grantsAdvantageOnMove.advantage" must be a string.`);
}

function validateQuickRollsMove(entry, errors, context) {
	const value = entry.quickRollsMove;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "quickRollsMove" must be an object.`);
		return;
	}
	if (typeof value.moveKey !== "string") errors.push(`${context}'s "quickRollsMove.moveKey" must be a string.`);
	if ("trait" in value && typeof value.trait !== "string") errors.push(`${context}'s "quickRollsMove.trait" must be a string.`);
	if ("advantage" in value && typeof value.advantage !== "string") {
		errors.push(`${context}'s "quickRollsMove.advantage" must be a string.`);
	}
	if ("reminders" in value && !isStringArray(value.reminders)) {
		errors.push(`${context}'s "quickRollsMove.reminders" must be an array of strings.`);
	}
}

function validateGrantsExternalRollBonus(entry, errors, context) {
	const value = entry.grantsExternalRollBonus;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "grantsExternalRollBonus" must be an object.`);
		return;
	}
	if (typeof value.dieFaces !== "number") errors.push(`${context}'s "grantsExternalRollBonus.dieFaces" must be a number.`);
}

function validateUpgradesExternalRollBonusDie(entry, errors, context) {
	const value = entry.upgradesExternalRollBonusDie;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "upgradesExternalRollBonusDie" must be an object.`);
		return;
	}
	if (typeof value.moveKey !== "string") errors.push(`${context}'s "upgradesExternalRollBonusDie.moveKey" must be a string.`);
	if (typeof value.dieFaces !== "number") errors.push(`${context}'s "upgradesExternalRollBonusDie.dieFaces" must be a number.`);
}

// Either bare `true` (Scene-scoped) or a plain object carrying a string `period` (e.g. Sortie-scoped)
// — see docs/domains/moves.md's own promptsApproachOverride entry for the two real shapes this
// mirrors (Chromatic Focus/Reserves vs. the Arcanist's Aspect ritual).
function validatePromptsApproachOverride(entry, errors, context) {
	const value = entry.promptsApproachOverride;
	if (value === true) return;
	if (!isPlainObject(value) || typeof value.period !== "string") {
		errors.push(`${context}'s "promptsApproachOverride" must be true or an object with a string "period".`);
	}
}

function validateBonusDowntimeTokens(entry, errors, context) {
	const value = entry.bonusDowntimeTokens;
	if (!isPlainObject(value)) {
		errors.push(`${context}'s "bonusDowntimeTokens" must be an object.`);
		return;
	}
	if (typeof value.max !== "number") errors.push(`${context}'s "bonusDowntimeTokens.max" must be a number.`);
	if (typeof value.description !== "string") errors.push(`${context}'s "bonusDowntimeTokens.description" must be a string.`);
}

const BESPOKE_FIELD_VALIDATORS = {
	grantsAutomaticSuccess: validateGrantsAutomaticSuccess,
	grantsDowngradeHold: validateGrantsDowngradeHold,
	grantsRollModifier: validateGrantsRollModifier,
	addsCriticalReminderToMove: validateAddsCriticalReminderToMove,
	addsMixedReminderToMove: validateReminderWithRequiredMoveKeys("addsMixedReminderToMove"),
	addsSuccessReminderToMove: validateReminderWithRequiredMoveKeys("addsSuccessReminderToMove"),
	addsFailureReminderToMove: validateReminderWithRequiredMoveKeys("addsFailureReminderToMove"),
	addsTraitToMove: validateAddsTraitToMove,
	addsQuestionsToMove: validateAddsQuestionsToMove,
	grantsEquipment: validateGrantsEquipment,
	grantsWeaponTagChoice: validateGrantsWeaponTagChoice,
	grantsAdvantageOnMove: validateGrantsAdvantageOnMove,
	quickRollsMove: validateQuickRollsMove,
	grantsExternalRollBonus: validateGrantsExternalRollBonus,
	upgradesExternalRollBonusDie: validateUpgradesExternalRollBonusDie,
	promptsApproachOverride: validatePromptsApproachOverride,
	bonusDowntimeTokens: validateBonusDowntimeTokens
};

// The moves-section entry in custom-content-apply.js's SECTION_VALIDATORS dispatch — mirrors
// validateEquipmentFields/validateAstirWeaponFields/validatePartFields' own role for their
// sections, just composed from several smaller helpers given the size of the field surface.
export function validateMoveFields(entry, errors, context) {
	validateSimpleFields(entry, errors, context);
	validateTieredFields(entry, errors, context);
	validateLabeledSubArrays(entry, errors, context);
	for (const [field, validator] of Object.entries(BESPOKE_FIELD_VALIDATORS)) {
		if (field in entry) validator(entry, errors, context);
	}
}
