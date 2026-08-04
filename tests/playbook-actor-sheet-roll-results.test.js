import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

// Only the weapon-choice dialog is mocked — the tag catalog and resolve helpers stay real.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseWeapon: vi.fn()
}));

import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { UNARMED, chooseWeapon } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const ARCANE_AUGMENTS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:arcane-augments");
const LET_LOOSE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:let-loose");
const DONT_FOLLOW_ME = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-impostor:dont-follow-me");
const ALCHEMICAL_SUITE = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:alchemical-suite");
const FLOURISH_COMPONENT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:flourish-component");
const SPELL_ROUTINES = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:spell-routines");

beforeEach(() => {
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	// Tests that do care (Flourish Component's doubles regen) override this per-test.
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
	const wisp = { id: "eq1", kind: "weapon", astir: true, familiar: true, name: "Wisp Familiar III", description: "", tags: ["ranged"], spent: [] };

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

describe("PlaybookActorSheet#_rollMove - reroll offer (Decisive/Defensive/Versatile)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("offers a reroll when the weapon has an unspent reroll tag matching this move", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Defensive",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("does not offer a reroll when the weapon's reroll tag doesn't cover this move", async () => {
		const sheet = new PlaybookActorSheet();
		// Decisive only covers strike-decisively, not exchange-blows.
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["decisive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", weaponTags: "Decisive" });
	});

	it("does not offer an already-spent reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", weaponTags: "Defensive" });
	});

	it("offers Versatile's reroll for strike-decisively as well as exchange-blows", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Versatile",
			reroll: { equipmentId: "eq1", tagKey: "versatile" }
		});
	});

	it("treats a missing spent array as nothing spent yet, for a reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			weaponTags: "Defensive",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("treats a missing tags array as no reroll offer", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Fists", weaponTags: null });
	});

	it("never offers a reroll for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_rollMove - automatic success offer (Hot-blooded/Once the War's Over/The Arity Method)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("offers Hot-blooded once its own hold pool reaches its cost", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { equipment: [], moveHold: { "the-impostor:hot-blooded": { value: 3 } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Unarmed",
			weaponTags: null,
			automaticSuccess: [{ key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 }]
		});
	});

	it("does not offer Hot-blooded below its cost", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { equipment: [], moveHold: { "the-impostor:hot-blooded": { value: 2 } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("treats a missing moveHold pool as 0, offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("offers a useKey source (The Arity Method) when its own uses checkbox is unchecked, restricted to bite-the-dust", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = { system: { stats: { defy: { value: 0 } }, attributes: {} } };
		configureMoveRoll.mockResolvedValue({ ...config, trait: defy });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, BITE_THE_DUST, defy, {
			...config,
			trait: defy,
			automaticSuccess: [{ key: "soldier:the-arity-method", name: "The Arity Method", useKey: "sortie", moves: ["bite-the-dust"] }]
		});
	});

	it("does not offer The Arity Method once its Sortie use is already checked", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: { stats: { defy: { value: 0 } }, attributes: { moveUses: { "soldier:the-arity-method": { sortie: true } } } }
		};
		configureMoveRoll.mockResolvedValue({ ...config, trait: defy });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, BITE_THE_DUST, defy, { ...config, trait: defy });
	});

	it("does not offer The Arity Method for a move other than bite-the-dust, even with its use unchecked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", weaponTags: null });
	});

	it("offers every qualifying source at once", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [],
					moveHold: {
						"the-impostor:hot-blooded": { value: 3 },
						"soldier:once-the-wars-over": { value: 1 }
					}
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.automaticSuccess.map((source) => source.key)).toEqual(
			expect.arrayContaining(["the-impostor:hot-blooded", "soldier:once-the-wars-over"])
		);
		expect(options.automaticSuccess).toHaveLength(2);
	});
});

describe("PlaybookActorSheet#_rollMove - Guided (take 7-9)", () => {
	it("passes guided: true to configureMoveRoll when the weapon has a live Guided tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [], equipmentSpends: [],
			guided: true
		});
	});

	it("omits guided from configureMoveRoll's options for a non-Guided weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("treats a missing tags array as not Guided", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("is never Guided for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, lockedAdvantage: null, lockedTrait: null, astirPartSpends: [], equipmentSpends: [] });
	});

	it("posts a guided result and never rolls when Take 7-9 is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Rifle", weaponTags: "Guided" });
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("labels the guided result Unarmed when taking 7-9 with no weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Unarmed", weaponTags: null });
	});
});

describe("PlaybookActorSheet#_rollMove - Spell Routines (Guided on any move)", () => {
	it("is Guided for a non-weapon move when piloted with Spell Routines installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: true } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: [],
			guided: true
		});
	});

	it("is not Guided when not piloted, even with Spell Routines installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [SPELL_ROUTINES.key], piloted: false } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [],
			equipmentSpends: []
		});
	});
});

describe("PlaybookActorSheet#_rollMove - Astir Part reactions (potions, doubles regen)", () => {
	it("grants a Potion of each color after this actor rolls Lead a Sortie with Alchemical Suite installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: true, potions: { red: 1, blue: 0, yellow: 0 } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.potions": { red: 2, blue: 1, yellow: 1 }
		});
	});

	it("does not grant Potions for a move other than Lead a Sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: true } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.attributes.astir.potions": expect.anything()
		}));
	});

	it("regains 1 Power when the roll's kept dice come up doubles with Flourish Component installed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("does not regain Power when the roll's kept dice are not doubles", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", parts: [FLOURISH_COMPONENT.key], piloted: true, power: 1 } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 5, result: 5, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not react to potions/doubles when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 }, defy: { value: 0 } },
				attributes: {
					astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key, FLOURISH_COMPONENT.key], piloted: false, power: 1 }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "know", label: "KNOW", value: 1 }, advantage: "none", effect: "none" });
		rollMove.mockResolvedValue({
			message: undefined,
			dice: [{ original: 3, result: 3, changed: false, kept: true }, { original: 3, result: 3, changed: false, kept: true }]
		});

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveResolved", () => {
	it("does nothing when not piloted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", parts: [ALCHEMICAL_SUITE.key], piloted: false } } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveResolved(LEAD_A_SORTIE, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
