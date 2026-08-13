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

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { UNARMED, chooseWeapon } from "../scripts/equipment/equipment.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import {
	EXCHANGE_BLOWS, STRIKE_DECISIVELY, DISPEL_UNCERTAINTIES, WEAVE_MAGIC, READ_THE_ROOM,
	LEAD_A_SORTIE, ARCANE_AUGMENTS, LET_LOOSE, DONT_FOLLOW_ME
} from "./helpers/move-fixtures.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
	chooseWeapon.mockClear();
});

describe("PlaybookActorSheet#_rollMove - forced weapon effects (Unreliable)", () => {
	it("locks Effect to Desperation on the first roll with an unspent Unreliable weapon this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("does not lock Effect when the Unreliable tag is already spent this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: []
		});
	});

	it("treats a missing spent array as nothing spent yet, for a forced tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: "desperation", lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("marks the forced tag spent after rolling, alongside any player-chosen spend, in one update", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable", "blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		const config = {
			trait: { key: "clash", label: "CLASH", value: 0 },
			advantage: "none",
			effect: "desperation",
			spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }]
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["blitz", "unreliable"] }]
		});
	});

	it("does not force an effect for a weapon with no forcesEffect tag", async () => {
		const sheet = new PlaybookActorSheet();
		const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("treats a missing tags array as no forced effect", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("never forces an effect for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - Field Scout's grantsEffectOnMove", () => {
	it("locks Read the Room's Effect to Confidence when Field Scout is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(READ_THE_ROOM, expect.any(Array), expect.objectContaining({
			lockedEffect: "confidence", lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("leaves Read the Room's Effect unlocked without Field Scout picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { sense: { value: 0 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "read-the-room" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(READ_THE_ROOM, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});

	it("does not lock a different move's Effect just because Field Scout is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 0 } }, attributes: { playbookMoves: ["the-scout:field-scout"] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - Don't Follow Me's grantsTraitOnMove/grantsAdvantageOnMove", () => {
	it("locks Lead a Sortie's Trait to DEFY and its Dice to Advantage when picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 2 } },
				attributes: { playbookMoves: [DONT_FOLLOW_ME.key] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: { key: "defy", label: "DEFY", value: 2 },
			lockedAdvantage: "advantage"
		}));
	});

	it("leaves Lead a Sortie's Trait and Dice unlocked without Don't Follow Me picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 }, defy: { value: 2 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: null,
			lockedAdvantage: null
		}));
	});

	it("does not lock a different move's Trait/Dice just because Don't Follow Me is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 0 } }, attributes: { playbookMoves: [DONT_FOLLOW_ME.key] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedTrait: null,
			lockedAdvantage: null
		}));
	});

	it("does not lock the granted trait when it's disabled for this actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0, disabled: true } },
				attributes: { playbookMoves: [DONT_FOLLOW_ME.key] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(LEAD_A_SORTIE, expect.any(Array), expect.objectContaining({
			lockedTrait: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - derived Trait bonuses (Arcane Augments, Let Loose)", () => {
	it("adds a picked Arcane Augments-style bonus into the trait's dialog value and the roll's traitBonus option", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 1 } },
				attributes: {
					playbookMoves: [ARCANE_AUGMENTS.key],
					dangers: [{ id: "1", type: "risk", label: "Exposed" }, { id: "2", type: "peril", label: "Cornered" }]
				}
			},
			update: vi.fn()
		};
		const trait = { key: "channel", label: "CHANNEL", value: 3 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(WEAVE_MAGIC, [trait], expect.any(Object));
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, WEAVE_MAGIC, trait, expect.objectContaining({ traitBonus: 2 }));
	});

	it("omits traitBonus entirely when the chosen trait has no bonus", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 } } }, update: vi.fn() };
		const trait = { key: "clash", label: "CLASH", value: 1 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove.mock.calls.at(-1)[3]).not.toHaveProperty("traitBonus");
	});

	it("lets a Let Loose player pick which Trait its per-burden bonus applies to", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0 } },
				attributes: {
					playbookMoves: [LET_LOOSE.key],
					burdens: [{ id: "1", label: "A lingering injury" }],
					traitBonusChoices: { [LET_LOOSE.key]: "channel" }
				}
			},
			update: vi.fn()
		};
		const trait = { key: "channel", label: "CHANNEL", value: 1 };
		configureMoveRoll.mockResolvedValue({ trait, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "weave-magic" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(WEAVE_MAGIC, [trait], expect.any(Object));
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, WEAVE_MAGIC, trait, expect.objectContaining({ traitBonus: 1 }));
	});
});

describe("PlaybookActorSheet#_rollMove - Familiar weapons (+CHANNEL override)", () => {
	const wisp = { id: "eq1", kind: "weapon", astir: true, familiar: true, name: "Wisp Familiar", description: "", tags: ["ranged"], spent: [] };

	it("rolls Exchange Blows with a Familiar weapon as +CHANNEL instead of CLASH/TALK", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [wisp] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "channel", label: "CHANNEL", value: 3 }],
			expect.any(Object)
		);
	});

	it("rolls Strike Decisively with a Familiar weapon as +CHANNEL too", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [wisp] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			STRIKE_DECISIVELY,
			[{ key: "channel", label: "CHANNEL", value: 3 }],
			expect.any(Object)
		);
	});

	it("defaults CHANNEL to 0 when the actor has no channel stat at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 1 }, talk: { value: 2 } }, attributes: { equipment: [wisp] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "channel", label: "CHANNEL", value: 0 }],
			expect.any(Object)
		);
	});

	it("leaves CLASH/TALK untouched for a non-Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 2 }, channel: { value: 3 } },
				attributes: { equipment: [halberd] }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "clash", label: "CLASH", value: 1 }, { key: "talk", label: "TALK", value: 2 }],
			expect.any(Object)
		);
	});
});
