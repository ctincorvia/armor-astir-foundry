import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// findCarrierActors defaults to no Carriers in the world, matching every other sheet test file's
// own stance — needed here since getData's move-trait resolution reaches it regardless of which
// feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

import { BASIC_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { DANGER_MAX } from "../scripts/playbook/playbook-sheet/tracking-mixin.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const DARK_REBIRTH = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:dark-rebirth");
const NUMBER_OF_THE_BEAST = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:number-of-the-beast");
const COLD_COMPANY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:cold-company");
const THE_OLD_BLOOD = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-wither:the-old-blood");

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	// rollMove resolves { message, dice, tier } (see moves.js) — a bare default so every test that
	// doesn't care about the roll's own outcome doesn't have to configure this itself.
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
});

describe("PlaybookActorSheet#_availableAutomaticSuccess - Dark Rebirth (costsPeril)", () => {
	it("offers Dark Rebirth on bite-the-dust when picked and holding zero peril Dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [DARK_REBIRTH.key], dangers: [] } } };

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered).toContainEqual({
			key: DARK_REBIRTH.key,
			name: "Dark Rebirth",
			moves: ["bite-the-dust"],
			costsPeril: true
		});
	});

	it("offers Dark Rebirth when the actor holds only non-peril Dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [DARK_REBIRTH.key],
					dangers: [{ id: "1", type: "risk", label: "a" }]
				}
			}
		};

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(true);
	});

	it("does not offer Dark Rebirth once the actor already holds a peril Danger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [DARK_REBIRTH.key],
					dangers: [{ id: "1", type: "peril", label: "a" }]
				}
			}
		};

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(false);
	});

	it("does not offer Dark Rebirth once the actor is at DANGER_MAX, even with no perils among them", () => {
		const sheet = new PlaybookActorSheet();
		const dangers = Array.from({ length: DANGER_MAX }, (_, i) => ({ id: String(i), type: "risk", label: "a" }));
		sheet.actor = { system: { attributes: { playbookMoves: [DARK_REBIRTH.key], dangers } } };

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(false);
	});

	it("does not offer Dark Rebirth for a move other than bite-the-dust (the moves restriction)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [DARK_REBIRTH.key], dangers: [] } } };

		const offered = sheet._availableAutomaticSuccess(EXCHANGE_BLOWS);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(false);
	});

	it("does not offer Dark Rebirth at all when the actor hasn't picked it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [], dangers: [] } } };

		const offered = sheet._availableAutomaticSuccess(BITE_THE_DUST);

		expect(offered.some((source) => source.key === DARK_REBIRTH.key)).toBe(false);
	});
});

describe("PlaybookActorSheet#_hasExplodingSixes / _rollMove - Number Of The Beast", () => {
	it("is true only once the actor has picked Number Of The Beast", () => {
		const sheet = new PlaybookActorSheet();

		sheet.actor = { system: { attributes: { playbookMoves: [] } } };
		expect(sheet._hasExplodingSixes()).toBe(false);

		sheet.actor = { system: { attributes: { playbookMoves: [NUMBER_OF_THE_BEAST.key] } } };
		expect(sheet._hasExplodingSixes()).toBe(true);
	});

	it("passes explodeOnSix: true into rollMove's options once Number Of The Beast is picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { playbookMoves: [NUMBER_OF_THE_BEAST.key] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, expect.objectContaining({
			explodeOnSix: true
		}));
	});

	it("omits explodeOnSix entirely when Number Of The Beast isn't picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { playbookMoves: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		const options = rollMove.mock.calls.at(-1)[3];
		expect(options.explodeOnSix).toBeUndefined();
	});
});

describe("PlaybookActorSheet#_coldCompanyMove / _coldCompanyAdvantage", () => {
	it("returns null/no lock when Cold Company isn't picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._coldCompanyMove()).toBeUndefined();
		expect(sheet._coldCompanyAdvantage()).toBeNull();
	});

	it("locks disadvantage while haunted (the dispelled checkbox unset)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [COLD_COMPANY.key] } } };

		expect(sheet._coldCompanyAdvantage()).toBe("disadvantage");
	});

	it("locks advantage once dispelled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [COLD_COMPANY.key],
					moveUses: { [COLD_COMPANY.key]: { dispelled: true } }
				}
			}
		};

		expect(sheet._coldCompanyAdvantage()).toBe("advantage");
	});

	it("passes the corresponding lockedAdvantage into configureMoveRoll when haunted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { playbookMoves: [COLD_COMPANY.key] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedAdvantage: "disadvantage"
		}));
	});

	it("passes lockedAdvantage: advantage into configureMoveRoll once dispelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					playbookMoves: [COLD_COMPANY.key],
					moveUses: { [COLD_COMPANY.key]: { dispelled: true } }
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedAdvantage: "advantage"
		}));
	});

	it("leaves lockedAdvantage null for an actor without Cold Company picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 } }, attributes: { playbookMoves: [] } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), expect.objectContaining({
			lockedAdvantage: null
		}));
	});
});

describe("PlaybookActorSheet#_onMoveResolved - Cold Company's haunted/dispelled flip", () => {
	it("dispels the haunting on a success while haunted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [COLD_COMPANY.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "success");

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${COLD_COMPANY.key}.dispelled`]: true
		});
	});

	it("does not redundantly re-write dispelled on another success once already dispelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [COLD_COMPANY.key],
					moveUses: { [COLD_COMPANY.key]: { dispelled: true } }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "success");

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("returns the haunting on a failure while dispelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [COLD_COMPANY.key],
					moveUses: { [COLD_COMPANY.key]: { dispelled: true } }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "failure");

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${COLD_COMPANY.key}.dispelled`]: false
		});
	});

	it("does not redundantly re-write haunted on another failure while already haunted", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [COLD_COMPANY.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "failure");

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("never flips on a mixed result", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [COLD_COMPANY.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "mixed");

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("never flips when tier is omitted (Guided's 2-arg-shaped backward compatibility)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [COLD_COMPANY.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("is a no-op for an actor who hasn't picked Cold Company, whatever the tier", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } }, update: vi.fn() };

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "success");

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("still fires unrelated to whether the actor is piloted, since this is a base playbook feature", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [COLD_COMPANY.key],
					astir: { id: "a1", piloted: false }
				}
			},
			update: vi.fn()
		};

		await sheet._onMoveResolved(DISPEL_UNCERTAINTIES, null, "success");

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${COLD_COMPANY.key}.dispelled`]: true
		});
	});

	it("still fires the pre-existing Patron-boon check unchanged when Cold Company isn't in play", async () => {
		const sheet = new PlaybookActorSheet();
		const LEAD_A_SORTIE = (await import("../scripts/moves/moves.js")).SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
		const PATRON = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-witch:patron");
		sheet.actor = {
			system: { attributes: { playbookMoves: [PATRON.key] } },
			update: vi.fn()
		};

		await sheet._onMoveResolved(LEAD_A_SORTIE, null, "success");

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		const [update] = sheet.actor.update.mock.calls[0];
		expect(update["system.attributes.witch.boons"]).toHaveLength(2);
	});
});

describe("PlaybookActorSheet#_moveTraits - The Old Blood (addsTraitToMove.requiresUnmounted)", () => {
	it("offers +CHANNEL on Exchange Blows and Strike Decisively while no frame is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 3 } },
				attributes: { playbookMoves: [THE_OLD_BLOOD.key] }
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 3 }
		]);
	});

	it("does not offer +CHANNEL while the Astir is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 3 } },
				attributes: {
					playbookMoves: [THE_OLD_BLOOD.key],
					astir: { id: "a1", piloted: true }
				}
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
		expect(sheet._moveTraits({ key: "strike-decisively", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
	});

	it("does not offer +CHANNEL while an Ardent is mounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 3 } },
				attributes: {
					playbookMoves: [THE_OLD_BLOOD.key],
					ardents: [{ id: "r1", piloted: true }]
				}
			}
		};

		expect(sheet._moveTraits({ key: "exchange-blows", traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 }
		]);
	});
});
