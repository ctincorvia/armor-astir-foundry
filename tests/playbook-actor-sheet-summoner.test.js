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

import { configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { APPROACHES } from "../scripts/core/approaches.js";
import { TRAITS } from "../scripts/core/traits.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { chooseSummonAlly } from "../scripts/playbook/playbook-sheet/summoner-mixin.js";

const EIDOLON_DRIVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:eidolon-drive");
const BINDING = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:binding");
const HELPING_HANDS = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:helping-hands");
const LIVING_DRIVE = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-summoner:living-drive");

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	rollMove.mockResolvedValue({ message: undefined, dice: null, tier: undefined });
	Dialog.mockClear();
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
});

describe("PlaybookActorSheet#_boundAllies/_eidolonDrive/_downtimeAlly", () => {
	it("default to their empty/blank shapes when unset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._boundAllies()).toEqual([]);
		expect(sheet._eidolonDrive()).toEqual({ summonedAllyId: null, bonusUsed: false });
		expect(sheet._downtimeAlly()).toBeNull();
	});

	it("return the stored values when set", () => {
		const sheet = new PlaybookActorSheet();
		const ally = { id: "a1", name: "Vex", approach: "profane", trait: "channel", powerInvested: 2 };
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [ally],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true },
					downtimeAlly: { name: "Pip", powerInvested: 1 }
				}
			}
		};

		expect(sheet._boundAllies()).toEqual([ally]);
		expect(sheet._eidolonDrive()).toEqual({ summonedAllyId: "a1", bonusUsed: true });
		expect(sheet._downtimeAlly()).toEqual({ name: "Pip", powerInvested: 1 });
	});
});

describe("PlaybookActorSheet#_bindingMove/_helpingHandsMove", () => {
	it("are undefined when neither move is picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._bindingMove()).toBeUndefined();
		expect(sheet._helpingHandsMove()).toBeUndefined();
	});

	it("resolve to their move objects once picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key, HELPING_HANDS.key] } } };

		expect(sheet._bindingMove()).toEqual(BINDING);
		expect(sheet._helpingHandsMove()).toEqual(HELPING_HANDS);
	});
});

describe("PlaybookActorSheet#_boundAlliesData", () => {
	it("is null without Binding picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._boundAlliesData()).toBeNull();
	});

	it("exposes the full APPROACHES/TRAITS catalogs, not a playbook-restricted subset", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key] } } };

		const data = sheet._boundAlliesData();

		expect(data.approaches).toEqual(APPROACHES);
		expect(data.traits).toEqual(TRAITS);
	});

	it("disables Invest without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key] } } };

		expect(sheet._boundAlliesData().canInvest).toBe(false);
	});

	it("enables Invest with an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BINDING.key], astir: { power: 2 } } } };

		expect(sheet._boundAlliesData().canInvest).toBe(true);
	});

	it("maps each ally with defaults and flags the currently-summoned one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [BINDING.key],
					boundAllies: [{ id: "a1", name: "Vex" }, { id: "a2", name: "Ossa", approach: "profane", trait: "know", powerInvested: 2 }],
					eidolonDrive: { summonedAllyId: "a2", bonusUsed: false }
				}
			}
		};

		const { list } = sheet._boundAlliesData();

		expect(list).toEqual([
			{ id: "a1", name: "Vex", approach: "", trait: "", powerInvested: 0, summoned: false },
			{ id: "a2", name: "Ossa", approach: "profane", trait: "know", powerInvested: 2, summoned: true }
		]);
	});
});

describe("PlaybookActorSheet#_downtimeAllyData", () => {
	it("is null without Helping Hands picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [] } } };

		expect(sheet._downtimeAllyData()).toBeNull();
	});

	it("reports exists: false with nothing bound yet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [HELPING_HANDS.key] } } };

		expect(sheet._downtimeAllyData()).toEqual({ exists: false, canInvest: false, name: "", powerInvested: 0 });
	});

	it("reports the bound ally's own fields once set, and canInvest with an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [HELPING_HANDS.key],
					downtimeAlly: { name: "Pip", powerInvested: 1 },
					astir: { power: 3 }
				}
			}
		};

		expect(sheet._downtimeAllyData()).toEqual({ exists: true, canInvest: true, name: "Pip", powerInvested: 1 });
	});
});

describe("PlaybookActorSheet#_onBoundAllyAdd/_onBoundAllyFieldChange", () => {
	it("appends a blank ally entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		sheet._onBoundAllyAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "test-id", name: "", approach: "", trait: "", powerInvested: 0 }]
		});
	});

	it("updates a single field on the matching entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "" }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyFieldChange({ currentTarget: { dataset: { entryId: "a1", field: "name" }, value: "Vex" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", name: "Vex" }]
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyInvestPower", () => {
	it("no-ops without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the Astir's Power is already 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: { power: 0 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the entry can't be found", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "nope" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("moves 1 Power from the Astir to the ally's own powerInvested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 1 }], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", powerInvested: 2 }],
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyRelease", () => {
	it("no-ops when the entry can't be found", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "nope" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("removes the entry without touching Power when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 2 }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.boundAllies": [] });
	});

	it("removes the entry without touching Power when nothing was invested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: { power: 2, parts: [] } } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.boundAllies": [] });
	});

	it("refunds the ally's full Power investment to the Astir, clamped to its derived max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 3 }],
					astir: { power: 3, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			// Base Astir Power (4) is the clamp ceiling with no parts/equipment — 3 + 3 would be 6,
			// clamped to 4.
			"system.attributes.astir.power": 4
		});
	});

	it("clears the active summon when releasing the currently-summoned ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 0 }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true }
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("leaves the active summon untouched when releasing a different ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 0 }, { id: "a2", powerInvested: 0 }],
					eidolonDrive: { summonedAllyId: "a2", bonusUsed: false }
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(updates["system.attributes.eidolonDrive"]).toBeUndefined();
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyAdd", () => {
	it("creates a blank Downtime Ally slot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": { name: "", powerInvested: 0 }
		});
	});

	it("no-ops when one is already bound", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyNameChange", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyNameChange({ currentTarget: { value: "Pip" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("updates the name once bound", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyNameChange({ currentTarget: { value: "Pip" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeAlly.name": "Pip" });
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyInvestPower", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { power: 2 } } }, update: vi.fn() };

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the Astir's Power is already 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: { power: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("moves 1 Power from the Astir to the Downtime Ally's own powerInvested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly.powerInvested": 1,
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyRelease", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clears the slot without touching Power when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeAlly": null });
	});

	it("refunds the full Power investment to the Astir, clamped to its derived max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					downtimeAlly: { name: "Pip", powerInvested: 3 },
					astir: { power: 3, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": null,
			"system.attributes.astir.power": 4
		});
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

	it("summons the sole ally directly with exactly one bound, with no Astir to return Power to", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "Vex", powerInvested: 0 }] } },
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(Dialog).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a1", bonusUsed: false },
			[`system.attributes.moveUses.${EIDOLON_DRIVE.key}.summoned`]: true
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
			[`system.attributes.moveUses.${EIDOLON_DRIVE.key}.summoned`]: true,
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
			"system.attributes.eidolonDrive": { summonedAllyId: "a2", bonusUsed: false },
			[`system.attributes.moveUses.${EIDOLON_DRIVE.key}.summoned`]: true
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

	it("leaves an ordinary move's summonable false", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: {} } };

		const [entry] = sheet._moveGroupMoves([BINDING]);

		expect(entry.summonable).toBe(false);
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

describe("chooseSummonAlly", () => {
	const ally = { id: "a1", name: "Vex" };
	const unnamedAlly = { id: "a2" };

	it("opens a Dialog with one labelled button per ally", () => {
		chooseSummonAlly([ally, unnamedAlly]);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe("Summon an Ally");
		expect(dialogData.buttons.a1.label).toBe("Vex");
		// Falls back to "Unnamed Ally" for an ally with no stored name.
		expect(dialogData.buttons.a2.label).toBe("Unnamed Ally");
	});

	it("resolves the clicked ally's id", async () => {
		const promise = chooseSummonAlly([ally]);

		Dialog.mock.calls.at(-1)[0].buttons.a1.callback();

		expect(await promise).toBe("a1");
	});

	it("resolves null when the dialog is closed", async () => {
		const promise = chooseSummonAlly([ally]);

		Dialog.mock.calls.at(-1)[0].close();

		expect(await promise).toBeNull();
	});

	it("uses the module's own styling", () => {
		chooseSummonAlly([ally]);

		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir"] });
	});
});

describe("PlaybookActorSheet#_boundAlliesData - missing ally name falls back to an empty string", () => {
	it("maps an ally with no stored name to an empty string, not undefined", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [BINDING.key], boundAllies: [{ id: "a1" }] } }
		};

		expect(sheet._boundAlliesData().list[0].name).toBe("");
	});
});

describe("PlaybookActorSheet#_onBoundAllyInvestPower - nullish defaults", () => {
	it("treats a missing Astir Power as 0 (no Power to invest)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: {} } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing ally powerInvested as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1" }], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", powerInvested: 1 }],
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyRelease - nullish defaults", () => {
	it("treats missing Astir parts/power as their own defaults when refunding", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 2 }], astir: {}, equipment: [] } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			// astirMaxPower([], []) = 4 (base, no parts); 0 (missing power) + 2 invested = 2.
			"system.attributes.astir.power": 2
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyInvestPower - nullish defaults", () => {
	it("treats a missing Astir Power as 0 (no Power to invest)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: {} } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing Downtime Ally powerInvested as 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip" }, astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly.powerInvested": 1,
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyRelease - nullish defaults", () => {
	it("treats missing Astir parts/power as their own defaults when refunding", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 2 }, astir: {}, equipment: [] } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": null,
			"system.attributes.astir.power": 2
		});
	});
});

describe("PlaybookActorSheet#_onEidolonDriveSummon - nullish defaults", () => {
	it("treats a missing ally powerInvested and missing Astir parts/power as their own defaults", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "Vex" }], astir: {}, equipment: [] } },
			update: vi.fn()
		};

		await sheet._onEidolonDriveSummon({ currentTarget: { dataset: { move: EIDOLON_DRIVE.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.eidolonDrive": { summonedAllyId: "a1", bonusUsed: false },
			[`system.attributes.moveUses.${EIDOLON_DRIVE.key}.summoned`]: true,
			// Math.max(0, (missing powerInvested = 0) - 1) = 0.
			"system.attributes.boundAllies": [{ id: "a1", name: "Vex", powerInvested: 0 }],
			// astirMaxPower([], []) = 4; (missing power = 0) + 1 = 1.
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_moveTraits - Eidolon Drive ally trait label fallback", () => {
	it("falls back to the raw trait key when it doesn't match a known TRAITS entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					boundAllies: [{ id: "a1", name: "Vex", trait: "not-a-real-trait" }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: false }
				}
			}
		};

		const traits = sheet._moveTraits({ traits: [] });

		expect(traits).toContainEqual({ key: "eidolon-drive-ally", label: "Vex (not-a-real-trait)", value: 3 });
	});
});
