import { describe, expect, it } from "vitest";

import {
	CUSTOM_MOVE_ALLOWED_FIELDS,
	CUSTOM_MOVE_REQUIRED_FIELDS
} from "../scripts/custom-content/custom-content-moves-schema.js";

describe("CUSTOM_MOVE_REQUIRED_FIELDS", () => {
	it("requires exactly name/traits/description", () => {
		expect(CUSTOM_MOVE_REQUIRED_FIELDS).toEqual(["name", "traits", "description"]);
	});

	it("never requires key, which is validated separately", () => {
		expect(CUSTOM_MOVE_REQUIRED_FIELDS).not.toContain("key");
	});

	it("never requires results, since plenty of real moves define none", () => {
		expect(CUSTOM_MOVE_REQUIRED_FIELDS).not.toContain("results");
	});
});

describe("CUSTOM_MOVE_ALLOWED_FIELDS", () => {
	it("includes every required field", () => {
		for (const field of CUSTOM_MOVE_REQUIRED_FIELDS) {
			expect(CUSTOM_MOVE_ALLOWED_FIELDS).toContain(field);
		}
	});

	it("includes key, name, and description", () => {
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).toEqual(expect.arrayContaining(["key", "name", "description"]));
	});

	it("includes every simple/tiered/labeled-sub-array field", () => {
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).toEqual(expect.arrayContaining([
			"downtimeAbility",
			"tierBonus",
			"downtimeTokensMax",
			"exclusiveGroup",
			"removesTraitCap",
			"requiresMoves",
			"grantsWeaponTags",
			"separateHold",
			"suppressActivateButton",
			"flatHold",
			"questionsOnFailure",
			"questions",
			"results",
			"hold",
			"questionPrompts",
			"conditions",
			"intents",
			"uses",
			"fixedTraits",
			"numericTrackers"
		]));
	});

	it("includes every one of the 16 bespoke structured fields", () => {
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).toEqual(expect.arrayContaining([
			"grantsAutomaticSuccess",
			"grantsDowngradeHold",
			"grantsRollModifier",
			"addsCriticalReminderToMove",
			"addsMixedReminderToMove",
			"addsSuccessReminderToMove",
			"addsFailureReminderToMove",
			"addsTraitToMove",
			"addsQuestionsToMove",
			"grantsEquipment",
			"grantsWeaponTagChoice",
			"grantsAdvantageOnMove",
			"quickRollsMove",
			"grantsExternalRollBonus",
			"upgradesExternalRollBonusDie",
			"promptsApproachOverride",
			"bonusDowntimeTokens"
		]));
	});

	it("deliberately excludes the three v1-excluded fields", () => {
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).not.toContain("usesWeapon");
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).not.toContain("variableDicePool");
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).not.toContain("successOptions");
		expect(CUSTOM_MOVE_ALLOWED_FIELDS).not.toContain("requiresParts");
	});
});
