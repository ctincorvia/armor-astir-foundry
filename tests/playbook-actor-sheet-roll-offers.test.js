import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { HOLD_MAX, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EXCHANGE_BLOWS, STRIKE_DECISIVELY, BITE_THE_DUST, EMBRACE_CHAOS } from "./helpers/move-fixtures.js";

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
});

describe("PlaybookActorSheet#_rollMove - reroll offer (Decisive/Defensive/Versatile)", () => {
	// weaponId resolves config.weaponId back to the clicked weapon (see move-roll-mixin.js's
	// _rollMoveWithWeaponChoice) — every _onWeaponMoveRoll test below clicks the "eq1" weapon, and
	// this same value harmlessly resolves to Unarmed for the one _onMoveRoll test in this block
	// (no "eq1" weapon on that actor, so it falls through to the Unarmed bundle regardless).
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none", weaponId: "eq1" };

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
			narrativeTags: [],
			reroll: { equipmentId: "eq1", tagKey: "defensive", spendKey: "defensive" },
			heatUp: NO_HEAT_UP
		});
	});

	it("passes rerollTag through configureMoveRoll's own top-level options on the single-weapon path (_rollMove called directly with a real weapon, not an array)", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._rollMove(EXCHANGE_BLOWS, rifle);

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			rerollTag: { tagLabel: "Defensive", description: expect.any(String) }
		}));
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

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
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

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
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
			narrativeTags: [],
			reroll: { equipmentId: "eq1", tagKey: "versatile", spendKey: "versatile:strike-decisively" },
			heatUp: NO_HEAT_UP
		});
	});

	it("tracks Versatile's two moves' rerolls independently — spending one leaves the other available", async () => {
		const sheet = new PlaybookActorSheet();
		// Already spent Versatile's exchange-blows reroll this Scene (the compound key — see
		// equipment.js#rerollSpendKey) — Strike Decisively's reroll must still be offered, which is
		// exactly the bug this generalization fixes (a single bare "versatile" spend used to block
		// both moves at once).
		const rifle = {
			id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"],
			spent: ["versatile:exchange-blows"], scale: "foot", tier: 1
		};
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, {
			...config,
			weaponLabel: "Rifle",
			narrativeTags: [],
			reroll: { equipmentId: "eq1", tagKey: "versatile", spendKey: "versatile:strike-decisively" },
			heatUp: NO_HEAT_UP
		});
	});

	it("does not offer Versatile's strike-decisively reroll once that move's own compound key is spent", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = {
			id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"],
			spent: ["versatile:strike-decisively"], scale: "foot", tier: 1
		};
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Rifle", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
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
			narrativeTags: [],
			reroll: { equipmentId: "eq1", tagKey: "defensive", spendKey: "defensive" },
			heatUp: NO_HEAT_UP
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

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Fists", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("never offers a reroll for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
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
			narrativeTags: [],
			automaticSuccess: [{ key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 }],
			heatUp: NO_HEAT_UP
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

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("treats a missing moveHold pool as 0, offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
	});

	it("offers a useKey source (The Arity Method) when picked and its own uses checkbox is unchecked, restricted to bite-the-dust", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: { stats: { defy: { value: 0 } }, attributes: { playbookMoves: ["soldier:the-arity-method"] } }
		};
		configureMoveRoll.mockResolvedValue({ ...config, trait: defy });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, BITE_THE_DUST, defy, {
			...config,
			trait: defy,
			automaticSuccess: [{ key: "soldier:the-arity-method", name: "The Arity Method", useKey: "sortie", moves: ["bite-the-dust"] }],
			heatUp: NO_HEAT_UP
		});
	});

	it("does not offer The Arity Method on an actor who never picked it, even with its use unchecked", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = { system: { stats: { defy: { value: 0 } }, attributes: {} } };
		configureMoveRoll.mockResolvedValue({ ...config, trait: defy });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, BITE_THE_DUST, defy, { ...config, trait: defy, heatUp: NO_HEAT_UP });
	});

	it("does not offer The Arity Method once its Sortie use is already checked", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					playbookMoves: ["soldier:the-arity-method"],
					moveUses: { "soldier:the-arity-method": { sortie: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue({ ...config, trait: defy });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, BITE_THE_DUST, defy, { ...config, trait: defy, heatUp: NO_HEAT_UP });
	});

	it("does not offer The Arity Method for a move other than bite-the-dust, even with its use unchecked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed", narrativeTags: [], heatUp: NO_HEAT_UP }
		);
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

describe("PlaybookActorSheet#_rollMove - downgrade offer (Embrace Chaos)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("offers Embrace Chaos's downgrade once picked, below HOLD_MAX", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { equipment: [], playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: 0 } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.downgrade).toEqual([{ key: EMBRACE_CHAOS.key, name: EMBRACE_CHAOS.name, amount: 1 }]);
	});

	it("withholds Embrace Chaos's downgrade once its own hold pool is at HOLD_MAX", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [], playbookMoves: [EMBRACE_CHAOS.key], moveHold: { [EMBRACE_CHAOS.key]: { value: HOLD_MAX } }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.downgrade).toBeUndefined();
	});

	it("withholds Embrace Chaos's downgrade when it hasn't been picked at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.downgrade).toBeUndefined();
	});
});

describe("PlaybookActorSheet#_rollMove - heat up offer (_availableHeatUp threading)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("threads _availableHeatUp's false into a non-usesWeapon move's roll options", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: {} },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ ...config, trait: { key: "know", label: "KNOW", value: 1 } });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.heatUp).toBe(false);
	});

	it("threads _availableHeatUp's true into a non-usesWeapon move's roll options once the Astir is mounted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { astir: { id: "a1", piloted: true, overheating: false } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ ...config, trait: { key: "know", label: "KNOW", value: 1 } });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.heatUp).toBe(true);
	});

	it("threads _availableHeatUp's false into a usesWeapon move's roll options, same as any other move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.heatUp).toBe(false);
	});

	it("threads _availableHeatUp's true into a usesWeapon move's roll options, not scoped to weapon state the way reroll is", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: { equipment: [], astir: { id: "a1", piloted: true, overheating: false } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.heatUp).toBe(true);
	});
});
