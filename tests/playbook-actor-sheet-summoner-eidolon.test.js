import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { EIDOLON_DRIVE, BINDING, HELPING_HANDS, LIVING_DRIVE } from "./helpers/move-fixtures.js";

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
	Dialog.mockClear();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
});

describe("PlaybookActorSheet#_onEidolonDriveSummon", () => {
	it("no-ops for an unknown move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [{ id: "a1" }] } }, update: vi.fn() };

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops with zero bound allies", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("no-ops when an ally is already summoned this Scene, even with multiple bound allies", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex" }, { id: "a2", name: "Ossa" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			},
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(Dialog).not.toHaveBeenCalled();
	});

	it("summons the sole ally directly with exactly one bound, with no Astir to return Power to", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "Vex", powerInvested: 0 }] } },
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(Dialog).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a1", bonusUsed: false }
		});
	});

	it("returns 1 Power to the summoned ally, clamped to the Astir's derived max, when an Astir exists", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", powerInvested: 2 }],
					astir: { power: 4, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a1", bonusUsed: false },
			"system.attributes.boundAllies": [{ id: "a1", name: "Vex", powerInvested: 1 }],
			// Astir Power is already at its base max (4) with no parts — the +1 return clamps there.
			"system.attributes.astir.power": 4
		});
	});

	it("never pushes an ally's powerInvested below 0 when returning Power", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", powerInvested: 0 }],
					astir: { power: 2, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(updates["system.attributes.boundAllies"]).toEqual([{ id: "a1", name: "Vex", powerInvested: 0 }]);
	});

	it("prompts chooseSummonAlly with more than one bound ally and summons the chosen one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", powerInvested: 0 }, { id: "a2", name: "Ossa", powerInvested: 0 }]
				}
			},
			update: vi.fn()
		};

		const promise = sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(dialogData.buttons)).toEqual(["a1", "a2"]);
		dialogData.buttons.a2.callback();
		await promise;

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a2", bonusUsed: false }
		});
	});

	it("aborts the whole summon when the disambiguation dialog is closed without a choice", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", powerInvested: 0 }, { id: "a2", name: "Ossa", powerInvested: 0 }]
				}
			},
			update: vi.fn()
		};

		const promise = sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		Dialog.mock.calls.at(-1)[0].close();
		await promise;

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_consumeEidolonDriveBonus", () => {
	it("no-ops when no ally is currently summoned", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._consumeEidolonDriveBonus();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops once the bonus is already used", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { eidolonDrive: { summonedAllyId: "a1", bonusUsed: true } } },
			update: vi.fn()
		};

		await sheet._consumeEidolonDriveBonus();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("flips bonusUsed to true the first time", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { eidolonDrive: { summonedAllyId: "a1", bonusUsed: false } } },
			update: vi.fn()
		};

		await sheet._consumeEidolonDriveBonus();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.eidolonDrive.bonusUsed": true });
	});
});

describe("PlaybookActorSheet#getData - Bound Allies / Downtime Ally wiring", () => {
	it("is null for both without their granting moves picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { playbookMoves: [] } } };

		const data = sheet.getData();

		expect(data.boundAllies).toBeNull();
		expect(data.downtimeAlly).toBeNull();
	});

	it("populates both once their granting moves are picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { playbookMoves: [BINDING.key, HELPING_HANDS.key] } }
		};

		const data = sheet.getData();

		expect(data.boundAllies).not.toBeNull();
		expect(data.downtimeAlly).not.toBeNull();
	});
});

describe("PlaybookActorSheet#getData - Living Drive ungates Eidolon Drive while unmounted", () => {
	it("stays gated while unmounted without Living Drive picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				playbook: { name: "The Summoner" },
				attributes: {
					playbookMoves: [],
					// A bound ally isolates this test to the mounted-frame gate specifically, rather
					// than also being gated by summonGated (zero bound allies) for an unrelated reason.
					boundAllies: [{ id: "a1" }],
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: EIDOLON_DRIVE.key, piloted: false }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.find((m) => m.key === EIDOLON_DRIVE.key).gated).toBe(true);
	});

	it("ungates Eidolon Drive specifically while unmounted once Living Drive is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				playbook: { name: "The Summoner" },
				attributes: {
					playbookMoves: [LIVING_DRIVE.key],
					boundAllies: [{ id: "a1" }],
					astir: { id: "a1", core: "", approach: "", tier: 3, power: 4, parts: [], move: EIDOLON_DRIVE.key, piloted: false }
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Astir Moves");

		expect(group.moves.find((m) => m.key === EIDOLON_DRIVE.key).gated).toBe(false);
	});
});

describe("PlaybookActorSheet#_grantsUnpilotedAstirMove", () => {
	it("is false without Living Drive picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._grantsUnpilotedAstirMove(EIDOLON_DRIVE)).toBe(false);
	});

	it("is true for Eidolon Drive once Living Drive is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [LIVING_DRIVE.key] } } };

		expect(sheet._grantsUnpilotedAstirMove(EIDOLON_DRIVE)).toBe(true);
	});

	it("is false for a move Living Drive doesn't target", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [LIVING_DRIVE.key] } } };

		expect(sheet._grantsUnpilotedAstirMove(BINDING)).toBe(false);
	});
});

describe("PlaybookActorSheet#_moveGroupMoves - Eidolon Drive's Summon button", () => {
	it("is summonable, and gated when there are no bound allies", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { boundAllies: [] } } };

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect(entry.summonable).toBe(true);
		expect(entry.gated).toBe(true);
	});

	it("is ungated with at least one bound ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { boundAllies: [{ id: "a1" }] } } };

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect(entry.gated).toBe(false);
	});

	it("is gated once an ally is already summoned this Scene, even with bound allies available", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect(entry.gated).toBe(true);
	});

	it("leaves an ordinary move's summonable false", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: {} } };

		const [entry] = sheet._moveGroupMoves([BINDING]);

		expect(entry.summonable).toBe(false);
	});

	it("omits summonedAllyInfo entirely with nothing summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { boundAllies: [] } } };

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect("summonedAllyInfo" in entry).toBe(false);
	});

	it("includes summonedAllyInfo at +3 before the one-time bonus is used", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect(entry.summonedAllyInfo).toEqual({ name: "Vex", traitLabel: "TALK", value: 3 });
	});

	it("includes summonedAllyInfo at +1 once the one-time bonus has been used", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([EIDOLON_DRIVE]);

		expect(entry.summonedAllyInfo).toEqual({ name: "Vex", traitLabel: "TALK", value: 1 });
	});

	it("omits summonedAllyInfo for an ordinary move even while an ally is summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const [entry] = sheet._moveGroupMoves([BINDING]);

		expect("summonedAllyInfo" in entry).toBe(false);
	});
});

describe("PlaybookActorSheet#_moveTraits - Eidolon Drive's summoned-ally trait push", () => {
	it("does not offer the synthetic trait with no ally summoned", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 } }, attributes: {} } };

		const traits = sheet._moveTraits({ traits: ["clash"] });

		expect(traits.some((t) => t.key === "eidolon-drive-ally")).toBe(false);
	});

	it("offers the ally's trait at +3 before the one-time bonus is used", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: ["clash"] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Vex (TALK)", value: 3 });
	});

	it("offers the ally's trait at +1 once the one-time bonus has been used", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: ["clash"] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Vex (TALK)", value: 1 });
	});

	it("is offered unconditionally, even on a move whose own traits don't include it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: [] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Vex (TALK)", value: 3 });
	});

	it("falls back to a default label when the summoned ally has no name", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", trait: "know" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: [] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Summoned Ally (KNOW)", value: 3 });
	});

	it("does not offer the synthetic trait if the summoned ally id no longer resolves (e.g. Released)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: { boundAllies: [], eidolonDrive: { summonedAllyId: "a1", bonusUsed: false } }
			}
		};

		const traits = sheet._moveTraits({ traits: [] });

		expect(traits.some((t) => t.key === "eidolon-drive-ally")).toBe(false);
	});
});

describe("PlaybookActorSheet#_rollMove - consumes Eidolon Drive's one-time bonus", () => {
	it("consumes the bonus when the resolved trait is eidolon-drive-ally", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false },
					equipment: []
				}
			},
			update: vi.fn()
		};
		const config = { trait: { key: "eidolon-drive-ally", label: "Vex (TALK)", value: 3 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.eidolonDrive.bonusUsed": true });
	});

	it("does not consume the bonus when a different trait is rolled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, talk: { value: 0 } },
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "talk" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false },
					equipment: []
				}
			},
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 1 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith({ "system.attributes.eidolonDrive.bonusUsed": true });
	});
});
