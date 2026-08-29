import { afterEach, describe, expect, it } from "vitest";

import { ALL_MOVES } from "../scripts/moves/all-moves.js";
import { EQUIPMENT_CATALOG, EQUIPMENT_TAGS } from "../scripts/equipment/equipment.js";
import { ARDENT_PART_CATALOG, ARDENT_FEATURE_WEAPONS } from "../scripts/frames/ardent.js";
import { ASTIR_WEAPON_CATALOG } from "../scripts/frames/astir-weapons.js";
import {
	applyReflavor,
	captureBaseline,
	resetToBaseline,
	validateReflavor
} from "../scripts/reflavor/reflavor-apply.js";

// This file mutates the real, shared catalog objects rather than injectable fixtures — deliberate,
// see docs/domains/reflavor.md's own Testing section for why: reflavor's entire job is mutating
// these shared objects, so an injectable catalog would test nothing real. Every test resets back to
// baseline in afterEach so no mutation leaks into unrelated suites that assert catalog content by
// identity/exact toEqual (tests/playbook-actor-sheet-moves.test.js, equipment-tags.test.js, etc.).
afterEach(() => {
	resetToBaseline();
});

const findMove = (key) => ALL_MOVES.find((move) => move.key === key);
const findEquipment = (key) => EQUIPMENT_CATALOG.find((item) => item.key === key);
const findTag = (key) => EQUIPMENT_TAGS.find((tag) => tag.key === key);
const findAstirWeapon = (key) => ASTIR_WEAPON_CATALOG.find((weapon) => weapon.key === key);
const findArdentFeatureWeapon = (key) => ARDENT_FEATURE_WEAPONS.find((weapon) => weapon.key === key);
const findAstirPart = (key) => ARDENT_PART_CATALOG.find((part) => part.key === key);

describe("captureBaseline/resetToBaseline", () => {
	it("round-trips a mutated entry back to its pristine text", () => {
		const original = findMove("exchange-blows").name;

		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });
		expect(findMove("exchange-blows").name).toBe("Trade Fire");

		resetToBaseline();
		expect(findMove("exchange-blows").name).toBe(original);
	});

	it("is idempotent — re-capturing after a mutation never adopts the mutated value as the new baseline", () => {
		const original = findMove("exchange-blows").description;

		captureBaseline();
		applyReflavor({ moves: { "exchange-blows": { description: "New flavor text" } } });
		captureBaseline();
		resetToBaseline();

		expect(findMove("exchange-blows").description).toBe(original);
	});
});

describe("applyReflavor", () => {
	it("applies a name override, readable directly off the live catalog", () => {
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
	});

	it("is idempotent — applying a second file leaves zero trace of the first", () => {
		const originalDescription = findMove("exchange-blows").description;

		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire", description: "First upload's text" } } });
		applyReflavor({ moves: { "exchange-blows": { name: "Clash Protocol" } } });

		const move = findMove("exchange-blows");
		expect(move.name).toBe("Clash Protocol");
		expect(move.description).toBe(originalDescription);
	});

	it("merges results per tier, leaving the untouched tiers at their prior value", () => {
		const originalMixed = findMove("exchange-blows").results.mixed;

		applyReflavor({ moves: { "exchange-blows": { results: { success: "New success text" } } } });

		const move = findMove("exchange-blows");
		expect(move.results.success).toBe("New success text");
		expect(move.results.mixed).toBe(originalMixed);
	});

	it("adds a tiered field (e.g. questionPrompts) to an entry that previously had none", () => {
		expect(findMove("exchange-blows").questionPrompts).toBeUndefined();

		applyReflavor({ moves: { "exchange-blows": { questionPrompts: { success: "New prompt" } } } });

		expect(findMove("exchange-blows").questionPrompts).toEqual({ success: "New prompt" });
	});

	it("merges questionPrompts per tier", () => {
		const originalMixedPrompt = findMove("read-the-room").questionPrompts.mixed;

		applyReflavor({ moves: { "read-the-room": { questionPrompts: { success: "New success prompt" } } } });

		const move = findMove("read-the-room");
		expect(move.questionPrompts.success).toBe("New success prompt");
		expect(move.questionPrompts.mixed).toBe(originalMixedPrompt);
	});

	it("replaces the questions array wholesale", () => {
		const originalQuestions = [...findMove("read-the-room").questions];

		applyReflavor({ moves: { "read-the-room": { questions: ["What do you see?"] } } });
		expect(findMove("read-the-room").questions).toEqual(["What do you see?"]);

		resetToBaseline();
		expect(findMove("read-the-room").questions).toEqual(originalQuestions);
	});

	it("overrides successOptions and downtimeAbility as plain strings", () => {
		applyReflavor({
			moves: {
				"plan-and-prepare": { successOptions: "<ul><li>New option</li></ul>" },
				"help-or-hinder": { downtimeAbility: "New downtime text." }
			}
		});

		expect(findMove("plan-and-prepare").successOptions).toBe("<ul><li>New option</li></ul>");
		expect(findMove("help-or-hinder").downtimeAbility).toBe("New downtime text.");
	});

	it("overrides a labeled sub-array's item label via a {itemKey: label} map, leaving siblings untouched", () => {
		applyReflavor({
			moves: {
				"help-or-hinder": {
					conditions: { downtime: "New Condition Label" },
					intents: { help: "Assist" }
				}
			}
		});

		const move = findMove("help-or-hinder");
		expect(move.conditions.find((condition) => condition.key === "downtime").label).toBe("New Condition Label");
		expect(move.conditions.find((condition) => condition.key === "prior-help").label).toBe("They've helped or hindered you previously this Sortie");
		expect(move.intents.find((intent) => intent.key === "help").label).toBe("Assist");
		expect(move.intents.find((intent) => intent.key === "hinder").label).toBe("Hinder");
	});

	it("overrides numericTrackers and fixedTraits labels the same way", () => {
		applyReflavor({
			moves: {
				"ardent-feature:chromatic-reserves": { numericTrackers: { uses: "Charges Remaining" } },
				"lead-a-sortie": { fixedTraits: { crew: "SQUAD" } }
			}
		});

		expect(findMove("ardent-feature:chromatic-reserves").numericTrackers[0].label).toBe("Charges Remaining");
		expect(findMove("lead-a-sortie").fixedTraits[0].label).toBe("SQUAD");
	});

	it("ignores a labeled sub-array override whose item key doesn't exist on the entry", () => {
		const originalLabels = findMove("help-or-hinder").conditions.map((condition) => condition.label);

		applyReflavor({ moves: { "help-or-hinder": { conditions: { "no-such-condition": "Ignored" } } } });

		expect(findMove("help-or-hinder").conditions.map((condition) => condition.label)).toEqual(originalLabels);
	});

	it("silently no-ops a labeled sub-array override on an entry that has no such field at all", () => {
		const warnings = applyReflavor({ moves: { "exchange-blows": { uses: { expended: "X" } } } });

		expect(warnings).toEqual([]);
		expect(findMove("exchange-blows").uses).toBeUndefined();
	});

	it("merges activateChoices' prompt and options independently", () => {
		const originalOptions = [...findMove("the-diplomat:facilitator").activateChoices.options];

		applyReflavor({ moves: { "the-diplomat:facilitator": { activateChoices: { prompt: "New prompt" } } } });
		let move = findMove("the-diplomat:facilitator");
		expect(move.activateChoices.prompt).toBe("New prompt");
		expect(move.activateChoices.options).toEqual(originalOptions);

		applyReflavor({ moves: { "the-diplomat:facilitator": { activateChoices: { options: ["A", "B"] } } } });
		move = findMove("the-diplomat:facilitator");
		expect(move.activateChoices.options).toEqual(["A", "B"]);
	});

	it("silently no-ops an activateChoices override on an entry with no activateChoices of its own", () => {
		const warnings = applyReflavor({ moves: { "exchange-blows": { activateChoices: { prompt: "X" } } } });

		expect(warnings).toEqual([]);
		expect(findMove("exchange-blows").activateChoices).toBeUndefined();
	});

	it("silently skips the sibling \"additions\" top-level key rather than warning about it", () => {
		const warnings = applyReflavor({
			additions: { equipment: [{ key: "custom:x", name: "X", kind: "gear", description: "..." }] },
			moves: { "exchange-blows": { name: "Trade Fire" } }
		});

		expect(warnings).not.toContain("Unknown reflavor section \"additions\" was ignored.");
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
	});

	it("warns on an unknown top-level section but still applies other valid sections", () => {
		const warnings = applyReflavor({
			bogusSection: { x: {} },
			moves: { "exchange-blows": { name: "Trade Fire" } }
		});

		expect(warnings).toContain("Unknown reflavor section \"bogusSection\" was ignored.");
		expect(findMove("exchange-blows").name).toBe("Trade Fire");
	});

	it("warns on an unknown field name but still applies other valid fields on the same entry, without touching mechanics", () => {
		const warnings = applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire", traits: ["bogus"] } } });

		expect(warnings).toContain("Unknown field \"traits\" on moves entry \"exchange-blows\" was ignored.");
		const move = findMove("exchange-blows");
		expect(move.name).toBe("Trade Fire");
		expect(move.traits).toEqual(["clash", "talk"]);
	});

	it("warns on an unknown catalog key", () => {
		const warnings = applyReflavor({ moves: { "no-such-move": { name: "X" } } });
		expect(warnings).toContain("Unknown moves key \"no-such-move\" was ignored.");
	});

	it("applies name/label/description overrides to equipment, equipmentTags, and astirWeapons", () => {
		applyReflavor({
			equipment: { "dagger-i": { name: "Vibroblade" } },
			equipmentTags: { blitz: { label: "Surge" } },
			astirWeapons: { forceknife: { name: "Plasma Shiv" } }
		});

		expect(findEquipment("dagger-i").name).toBe("Vibroblade");
		expect(findTag("blitz").label).toBe("Surge");
		expect(findAstirWeapon("forceknife").name).toBe("Plasma Shiv");
	});

	it("astirWeapons also reaches ARDENT_FEATURE_WEAPONS entries", () => {
		applyReflavor({ astirWeapons: { "ardent-feature:antipersonnel-turret": { name: "Flak Battery" } } });
		expect(findArdentFeatureWeapon("ardent-feature:antipersonnel-turret").name).toBe("Flak Battery");
	});

	it("astirParts mutates the same shared object ALL_MOVES also resolves", () => {
		applyReflavor({ astirParts: { "astir-part:extra-arms": { name: "Manipulator Rack" } } });

		const viaAstirParts = findAstirPart("astir-part:extra-arms");
		const viaAllMoves = findMove("astir-part:extra-arms");
		expect(viaAstirParts.name).toBe("Manipulator Rack");
		expect(viaAllMoves).toBe(viaAstirParts);
	});

	it("with no overrides argument, just resets to baseline", () => {
		const original = findMove("exchange-blows").name;
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });

		const warnings = applyReflavor();

		expect(warnings).toEqual([]);
		expect(findMove("exchange-blows").name).toBe(original);
	});
});

describe("resetToBaseline", () => {
	it("clears a previously applied override with no new overrides", () => {
		const original = findMove("exchange-blows").name;
		applyReflavor({ moves: { "exchange-blows": { name: "Trade Fire" } } });

		resetToBaseline();

		expect(findMove("exchange-blows").name).toBe(original);
	});
});

describe("validateReflavor", () => {
	it("returns the parsed overrides plus empty warnings/errors for a clean file", () => {
		const { overrides, warnings, errors } = validateReflavor(JSON.stringify({
			moves: { "exchange-blows": { name: "Trade Fire" } }
		}));

		expect(overrides).toEqual({ moves: { "exchange-blows": { name: "Trade Fire" } } });
		expect(warnings).toEqual([]);
		expect(errors).toEqual([]);
	});

	it("collects the same warnings applyReflavor would, without mutating any catalog", () => {
		const original = findMove("exchange-blows").name;

		const { warnings } = validateReflavor(JSON.stringify({ moves: { "no-such-move": { name: "X" } } } ));

		expect(warnings).toContain("Unknown moves key \"no-such-move\" was ignored.");
		expect(findMove("exchange-blows").name).toBe(original);
	});

	it("treats an empty object as a no-op with no warnings or errors", () => {
		const { overrides, warnings, errors } = validateReflavor("{}");
		expect(overrides).toEqual({});
		expect(warnings).toEqual([]);
		expect(errors).toEqual([]);
	});

	it("reports malformed JSON as an error, leaving overrides unusable", () => {
		const { overrides, warnings, errors } = validateReflavor("{ not valid json");
		expect(overrides).toBeNull();
		expect(warnings).toEqual([]);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toMatch(/Malformed JSON/);
	});

	it("rejects an array JSON root", () => {
		const { overrides, errors } = validateReflavor("[1, 2, 3]");
		expect(overrides).toBeNull();
		expect(errors).toEqual(["Reflavor JSON must be an object keyed by section name."]);
	});

	it("rejects a string JSON root", () => {
		const { overrides, errors } = validateReflavor("\"just a string\"");
		expect(overrides).toBeNull();
		expect(errors).toEqual(["Reflavor JSON must be an object keyed by section name."]);
	});

	it("rejects a null JSON root", () => {
		const { overrides, errors } = validateReflavor("null");
		expect(overrides).toBeNull();
		expect(errors).toEqual(["Reflavor JSON must be an object keyed by section name."]);
	});
});
