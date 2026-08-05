import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

// Only the weapon-choice dialog is mocked — the tag catalog and resolve helpers stay real.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching how lead-a-sortie's CREW
// fixedTraits placeholder behaved before Carrier existed.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => []),
	chooseCarrier: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { UNARMED, chooseWeapon } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { findCarrierActors, chooseCarrier } from "../scripts/world-actors/carrier-actor-sheet.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
const WEAPON_CONDUIT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:weapon-conduit");
const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
	chooseWeapon.mockClear();
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

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DENY, config.trait, config);
	});

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
		// exchange-blows is usesWeapon (see moves.js) and the actor has no equipment at all here,
		// so the weapon-choice step is skipped straight to "Unarmed" — see
		// "PlaybookActorSheet#_onMoveRoll - weapon choice" for the chooseWeapon-driven paths.
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, talk, { ...config, weaponLabel: "Unarmed", weaponTags: null });
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
			config
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
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

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
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

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
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
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] }
		);
	});
});

// dispel-uncertainties (not a usesWeapon move) stands in for "any ordinary move" here — these
// tests exercise _equipmentSpends' own unscoped behavior (offering, spent/stale filtering,
// disabling, marking), which is identical for every move except Exchange Blows/Strike Decisively.
// Weapon-scoping itself (chooseWeapon, the weaponLabel it produces) is covered separately below in
// "PlaybookActorSheet#_onMoveRoll - weapon choice" and "PlaybookActorSheet#_equipmentSpends -
// weapon scoping".
describe("PlaybookActorSheet#_onMoveRoll - equipment spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};

	it("offers every unspent spendable tag across the actor's equipment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DISPEL_UNCERTAINTIES,
			[{ key: "know", label: "KNOW", value: 1 }],
			{ lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [blitzSpend] }
		);
	});

	it("excludes a tag already marked spent on its entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("treats a missing spent array on an entry as nothing spent yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [blitzSpend]
		});
	});

	it("treats a missing tags array on an entry as offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("excludes a tag key that no longer resolves in the catalog", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", tags: ["stale-key"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("excludes an Astir weapon's spendable tag while unpiloted, even for a non-usesWeapon move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: false },
					equipment: [{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("offers an Astir weapon's spendable tag once piloted, excluding a mundane weapon's", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["blitz"], spent: [] },
						{ id: "eq2", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
	});

	it("leaves a gear entry's spendable tag unaffected by piloted state", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", piloted: true },
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
	});

	it("excludes a spend tag with no effect (e.g. Ward) from the roll-dialog offering", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["ward"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("disables offered spends when the roll's Effect is already locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [{ ...blitzSpend, disabled: true }]
		});
	});

	it("marks each checked spend's tag as spent, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("treats a missing spent array as empty when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not touch equipment when nothing was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentTags: [] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("leaves equipment on other entries untouched when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const spent = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		const untouched = { id: "eq2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [spent, untouched] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...spent, spent: ["blitz"] }, untouched]
		});
	});
});

describe("PlaybookActorSheet#_onMoveRoll - astir part spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const artifactSpend = {
		partKey: ARTIFACT.key,
		partName: "Artifact",
		description: ARTIFACT.spend.description,
		effect: null,
		advantage: "advantage",
		disabled: false
	};

	it("offers an installed part's spend when piloted and not yet Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [artifactSpend],
			equipmentSpends: []
		});
	});

	it("offers nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: false } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	it("excludes a part already marked Expended", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true },
					moveUses: { [ARTIFACT.key]: { expended: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	it("excludes a part with no spend field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WEAPON_CONDUIT.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	// Warding used to carry a `spend` with no `effect`/`advantage`, which leaked it into every
	// move's roll dialog as a checkbox that did nothing when checked (see claude.md's Astir
	// section) — this pins it as permanently excluded, the same way an effect-less equipment tag
	// (Ward) is excluded from _equipmentSpends, rather than relying on it merely happening to have
	// no `spend` field today.
	it("excludes Warding, a part whose spend sets neither effect nor advantage", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [WARDING.key], piloted: true } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});

	// No Astir Part in the catalog uses spend.effect yet (only Artifact's spend.advantage), but
	// _astirPartSpends supports it symmetrically with an equipment tag's spend.effect (see
	// claude.md's Astir section) — this stubs _mountedParts with a synthetic part so that support
	// stays exercised rather than silently rotting until a real effect-based part is added.
	it("offers a hypothetical part whose spend sets effect rather than advantage", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 } }, attributes: {} } };
		sheet._mountedParts = () => [
			{ key: "astir-part:fixture", name: "Fixture", spend: { effect: "confidence", description: "d" } }
		];
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: "astir-part:fixture", partName: "Fixture", description: "d",
				effect: "confidence", advantage: null, disabled: false
			}],
			equipmentSpends: []
		});
	});

	// Artifact's spend sets Advantage, not Effect (unlike an equipment tag's spend) — a locked
	// Effect (bite-the-dust at max Perils) has nothing to conflict with, so it stays offerable.
	it("leaves an advantage-only spend enabled even when the roll's Effect is locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					astir: { id: "a1", parts: [ARTIFACT.key], piloted: true }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: ARTIFACT.key,
				partName: "Artifact",
				description: ARTIFACT.spend.description,
				effect: null,
				advantage: "advantage",
				disabled: false
			}],
			equipmentSpends: []
		});
	});

	it("marks each checked part spend Expended, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ARTIFACT.key], piloted: true } }
			},
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentParts: [ARTIFACT.key] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.moveUses.${ARTIFACT.key}.expended`]: true });
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, {
			...config,
			spentPartLabels: [{ key: ARTIFACT.key, label: "Artifact" }]
		});
	});

	it("does not touch moveUses when no astir part was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: {} },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});
});

describe("PlaybookActorSheet#activateListeners - weapon moves", () => {
	it("binds a click handler to the per-weapon quick-roll buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll - weapon choice", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
	const sidearm = { id: "eq2", kind: "weapon", name: "Sidearm", description: "", tags: [], spent: [], scale: "foot", tier: 1 };

	it("prompts chooseWeapon with the actor's weapons when the move usesWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, sidearm] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd, sidearm]);
	});

	it("excludes Astir weapons from the weapon choice while unpiloted", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: false }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd]);
	});

	it("excludes mundane weapons from the weapon choice while piloted, offering only Astir weapons", async () => {
		const sheet = new PlaybookActorSheet();
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { astir: { id: "a1", piloted: true }, equipment: [halberd, astirWeapon] }
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([astirWeapon]);
	});

	it("aborts the whole roll when the weapon-choice dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("scopes the roll to no weapon and labels it Unarmed when Unarmed is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("scopes the roll to the chosen weapon and labels it by name", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(armed.id);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: armed.id, tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz" });
	});

	it("treats an id chooseWeapon resolved that no longer matches any weapon as Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue("not-a-real-weapon-id");
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("skips chooseWeapon entirely and rolls Unarmed when the actor has no weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_onWeaponMoveRoll", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };

	it("rolls the clicked move with the clicked weapon, without prompting chooseWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd", weaponTags: "Blitz" });
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", equipmentId: "eq1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized equipment id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "not-a-real-id" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});
});
