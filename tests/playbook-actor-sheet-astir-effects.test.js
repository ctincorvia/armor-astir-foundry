import { describe, expect, it, vi } from "vitest";

import { ASTIR_POWER_BASE } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import {
	EXCHANGE_BLOWS,
	FUTURE_SIGHT,
	INERTIA_DRIVE,
	LEAD_A_SORTIE,
	LEGACY,
	MANA_DEVOURER,
	PETRIFIER_CORE,
	READ_THE_ROOM,
	STRIKE_DECISIVELY,
	WEATHER_THE_STORM
} from "./helpers/move-fixtures.js";

describe("PlaybookActorSheet#_regainAstirPower", () => {
	it("adds the given amount, clamped to the parts-adjusted maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not exceed the maximum", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_BASE, parts: [] } } },
			update: vi.fn()
		};

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power and parts array as 0 and none", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._regainAstirPower(1);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

// _grantingMoves (moves-mixin.js) is what lets an Astir Move (Legacy, Mana Devourer, Petrifier
// Core, Inertia Drive, Future Sight — see astir.js's ASTIR_MOVE_CATALOG) source the same
// grantsAdvantageOnMove/addsSuccessReminderToMove/addsFailureReminderToMove/
// addsCriticalReminderToMove/addsQuestionsToMove flags a picked playbook move already can, but only
// while the Astir specifically is the mounted frame — the same mounted-vs-installed distinction
// every other Astir Part effect already draws. Legacy's own pair of tests below exercises both
// branches of _grantingMoves itself; the rest just need one passing case each so their own call
// site isn't dead code.
describe("PlaybookActorSheet#_grantedAdvantageForMove - Legacy (Astir Move)", () => {
	it("grants advantage on Lead a Sortie when Legacy is picked and the Astir is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: LEGACY.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBe("advantage");
	});

	it("grants nothing when the Astir is not the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: LEGACY.key, piloted: false, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});

	it("grants nothing when an Ardent is mounted instead of the Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", move: LEGACY.key, piloted: false, parts: [] },
					ardents: [{ id: "ard1", name: "Ardent", piloted: true, parts: [] }]
				}
			}
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});

	it("grants nothing without Legacy picked, even while the Astir is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: null, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedAdvantageForMove(LEAD_A_SORTIE)).toBeNull();
	});

	// Parity with Don't Follow Me/Born Leader (see playbook-actor-sheet-roll-results.test.js/
	// playbook-actor-sheet-the-captain.test.js): Legacy's grant reaches the roll-modifier dialog as a
	// forced Roll Modifier entry too, not a lockedAdvantage lock -- all three playbook sources share
	// the same _grantedAdvantageRollModifier resolver.
	it("surfaces as a forced Roll Modifier entry, not lockedAdvantage, once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: LEGACY.key, piloted: true, parts: [] } } }
		};

		const entries = sheet._rollModifiersForMove(LEAD_A_SORTIE, null);

		expect(entries).toEqual([{
			key: `granted-advantage-${LEGACY.key}`,
			label: "Legacy: Advantage",
			description: LEGACY.description,
			advantage: "advantage",
			effect: null,
			requiresAdvantage: null,
			reminderOnly: false,
			disabled: false,
			disabledReason: null,
			forced: true
		}]);
	});
});

describe("PlaybookActorSheet#_grantedSuccessReminderForMove - Mana Devourer (Astir Move)", () => {
	it("returns Mana Devourer's reminder for Strike Decisively once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: MANA_DEVOURER.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedSuccessReminderForMove(STRIKE_DECISIVELY)).toBe(
			"+1 Power (against another Astir, with physical harm)"
		);
	});
});

describe("PlaybookActorSheet#_grantedFailureReminderForMove - Petrifier Core (Astir Move)", () => {
	it("returns Petrifier Core's reminder for Exchange Blows once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: PETRIFIER_CORE.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedFailureReminderForMove(EXCHANGE_BLOWS)).toBe(
			"If you took disadvantage, your opponent takes the risk (restrained)"
		);
	});
});

describe("PlaybookActorSheet#_grantedCriticalReminderForMove - Inertia Drive (Astir Move)", () => {
	it("returns Inertia Drive's reminder for Weather the Storm once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: INERTIA_DRIVE.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedCriticalReminderForMove(WEATHER_THE_STORM)).toBe("Regain 1 Power");
	});
});

describe("PlaybookActorSheet#_grantedQuestionsForMove - Future Sight (Astir Move)", () => {
	it("returns Future Sight's questions for Read the Room once picked and mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", move: FUTURE_SIGHT.key, piloted: true, parts: [] } } }
		};

		expect(sheet._grantedQuestionsForMove(READ_THE_ROOM)).toEqual(FUTURE_SIGHT.addsQuestionsToMove.questions);
	});
});
