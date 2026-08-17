import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching how lead-a-sortie's CREW
// fixedTraits placeholder behaved before Carrier existed.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => []),
	chooseCarrier: vi.fn()
}));

import { BASIC_MOVES, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { findCarrierActors, chooseCarrier } from "../scripts/world-actors/carrier-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EXCHANGE_BLOWS, BITE_THE_DUST, WEAVE_MAGIC, LEAD_A_SORTIE, DENY, I_KNOW_YOU, BUREAUCRAT } from "./helpers/move-fixtures.js";

// _availableHeatUp's own return value for an actor with no Astir at all (see moves-mixin.js) —
// every fixture in this file lacks one unless a test says otherwise, so _rollMove's baseOptions
// always threads this same false through to rollMove.
const NO_HEAT_UP = false;

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
	chooseCarrier.mockClear();
});

describe("PlaybookActorSheet#_onMoveRoll", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move has no enabled traits to roll with", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { disabled: true }, talk: { disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does not roll when the roll dialog is dismissed without a selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("rolls a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 2 } } } };
		const config = { trait: { key: "channel", label: "CHANNEL", value: 2 }, advantage: "normal", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: DENY.key } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DENY, config.trait, { ...config, heatUp: NO_HEAT_UP });
	});

	it("offers I Know You's flat +3 FAMILIARITY fixedTrait, with no actor stat contributing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const familiarity = { key: "familiarity", label: "FAMILIARITY", value: 3 };
		const config = { trait: familiarity, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: I_KNOW_YOU.key } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			I_KNOW_YOU,
			[familiarity],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, I_KNOW_YOU, familiarity, { ...config, heatUp: NO_HEAT_UP });
	});

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("configures the roll, then rolls the move with the chosen trait and modifiers", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: 0 } } } };
		const talk = { key: "talk", label: "TALK", value: 0 };
		const config = { trait: talk, advantage: "advantage", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 1 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
		// exchange-blows is usesWeapon (see moves.js) and the actor has no equipment at all here,
		// so the weapon-choice step is skipped straight to "Unarmed" — see
		// "PlaybookActorSheet#_onMoveRoll - weapon choice" for the chooseWeapon-driven paths.
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, talk, { ...config, weaponLabel: "Unarmed", weaponTags: null, heatUp: NO_HEAT_UP }
		);
	});

	it("rolls a no-trait move (Help or Hinder) through to completion with no traitBonus option", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		const config = { conditions: ["hook"], advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			undefined,
			{ ...config, heatUp: NO_HEAT_UP }
		);
	});

	it("finds a special move (lead a sortie) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("resolves lead a sortie's CREW from the single Carrier in the world, without prompting", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([{ id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(chooseCarrier).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 2 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("prompts to choose a Carrier when more than one exists, and rolls with its Crew value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		const carrier1 = { id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } };
		const carrier2 = { id: "carrier2", name: "The Anchor", system: { stats: { crew: { value: -1 } } } };
		findCarrierActors.mockReturnValue([carrier1, carrier2]);
		chooseCarrier.mockResolvedValue("carrier2");
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(chooseCarrier).toHaveBeenCalledWith([carrier1, carrier2]);
		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: -1 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("aborts the roll when the multi-Carrier choice dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { stats: { crew: { value: 2 } } } },
			{ id: "carrier2", name: "The Anchor", system: { stats: { crew: { value: -1 } } } }
		]);
		chooseCarrier.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("treats a single Carrier missing its crew stat as 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([{ id: "carrier1", name: "The Wanderer", system: { stats: {} } }]);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("treats the chosen Carrier missing its crew stat as 0", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		findCarrierActors.mockReturnValue([
			{ id: "carrier1", name: "The Wanderer", system: { stats: {} } },
			{ id: "carrier2", name: "The Anchor", system: { stats: {} } }
		]);
		chooseCarrier.mockResolvedValue("carrier1");
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("does nothing for subsystems, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing for b-plot, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveRoll - bite the dust's locked Desperation", () => {
	const defy = { key: "defy", label: "DEFY", value: 0 };

	it("locks Desperation when at max Dangers and every one is a Peril", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null });
	});

	it("does not lock Desperation when at max Dangers but the types are mixed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null });
	});

	it("does not lock Desperation when below max Dangers, even if all are Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null });
	});

	it("never locks Desperation for a move without forcesDesperationAtMaxPerils, even at max Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});
});

describe("PlaybookActorSheet#_onMoveRoll - weave magic's locked Desperation on a Shaken Tenet", () => {
	it("locks Desperation on Weave Magic when a Tenet is Shaken", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 } },
				attributes: {
					hooks: [{ id: "1", description: "A vow", depth: "normal", shaken: true }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			WEAVE_MAGIC,
			[{ key: "channel", label: "CHANNEL", value: 0 }],
			{ lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("does not lock Desperation on Weave Magic when no Tenet is Shaken", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 } },
				attributes: {
					hooks: [{ id: "1", description: "A vow", depth: "normal", shaken: false }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			WEAVE_MAGIC,
			[{ key: "channel", label: "CHANNEL", value: 0 }],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("does not lock Desperation on Weave Magic with no hooks at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0 } }, attributes: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			WEAVE_MAGIC,
			[{ key: "channel", label: "CHANNEL", value: 0 }],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});

	it("never locks Desperation for a move without forcesDesperationOnShakenTenet, even with a Shaken Tenet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					hooks: [{ id: "1", description: "A vow", depth: "normal", shaken: true }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
	});
});

describe("PlaybookActorSheet#_onMoveRoll - Bureaucrat's quick-roll redirect to Exchange Blows", () => {
	it("rolls the real Exchange Blows move with TALK forced and carries Bureaucrat's own reminders", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 2 } } } };
		const talk = { key: "talk", label: "TALK", value: 2 };
		const config = { trait: talk, advantage: "normal", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: BUREAUCRAT.key } } });

		// The dialog is configured against the real target move (Exchange Blows), not Bureaucrat
		// itself, with TALK locked in from Bureaucrat's own quickRollsMove.trait.
		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 2 }
			],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: talk, astirPartSpends: [], equipmentSpends: [], rollModifiers: [], rollStack: null }
		);
		// No equipment at all, so the weapon-choice step resolves straight to Unarmed, same as any
		// other usesWeapon move with no weapons — and Bureaucrat's own reminders ride along
		// unconditionally via extraReminders.
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			talk,
			{
				...config,
				weaponLabel: "Unarmed",
				weaponTags: null,
				extraReminders: BUREAUCRAT.quickRollsMove.reminders,
				heatUp: NO_HEAT_UP
			}
		);
	});
});
