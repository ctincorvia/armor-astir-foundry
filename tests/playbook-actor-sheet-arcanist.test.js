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

// findCarrierActors defaults to no Carriers in the world — same mock playbook-actor-sheet-
// patron.test.js applies, needed here since getData's move-trait resolution reaches it regardless
// of which feature is under test.
vi.mock("../scripts/world-actors/carrier-actor-sheet.js", async (importOriginal) => ({
	...(await importOriginal()),
	findCarrierActors: vi.fn(() => [])
}));

vi.mock("../scripts/playbook/arcanist.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseArcanistRituals: vi.fn()
}));

import { findCarrierActors } from "../scripts/world-actors/carrier-actor-sheet.js";
import { ARCANIST_RITUALS, chooseArcanistRituals } from "../scripts/playbook/arcanist.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { PREPARE_RITUALS, WEATHER_THE_STORM } from "./helpers/move-fixtures.js";

const PREPARE_RITUALS_KEY = PREPARE_RITUALS.key;

beforeEach(() => {
	chooseArcanistRituals.mockReset();
	findCarrierActors.mockClear();
	findCarrierActors.mockReturnValue([]);
});

describe("PlaybookActorSheet#getData - isArcanist", () => {
	it("is true only for the Arcanist playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-arcanist" } } };

		expect(sheet.getData().isArcanist).toBe(true);
	});

	it("is false for every other playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		expect(sheet.getData().isArcanist).toBe(false);
	});

	it("is false with no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(sheet.getData().isArcanist).toBe(false);
	});
});

describe("PlaybookActorSheet#_arcanistData / getData.arcanist", () => {
	it("shows all 3 slots as unprepared with no rituals stored", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet._arcanistData();

		expect(data.slots).toHaveLength(3);
		expect(data.slots.map((s) => s.label)).toEqual(["Ritual 1", "Ritual 2", "Ritual 3"]);
		expect(data.slots.every((s) => !s.prepared && !s.spent && s.name === null)).toBe(true);
		expect(data.wardHold).toBe(0);
		expect(data.canAdapt).toBe(false);
	});

	it("shapes a prepared, unspent confidence slot with its target move's name resolved", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: WEATHER_THE_STORM.key }, null, null] }
				}
			}
		};

		const [slot] = sheet._arcanistData().slots;

		expect(slot.prepared).toBe(true);
		expect(slot.spent).toBe(false);
		expect(slot.name).toBe("Make a Move in Confidence");
		expect(slot.moveName).toBe(WEATHER_THE_STORM.name);
	});

	it("falls back to the raw moveKey when it no longer resolves against _ritualMoveOptions", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: "stale-move-key" }, null, null] }
				}
			}
		};

		expect(sheet._arcanistData().slots[0].moveName).toBe("stale-move-key");
	});

	it("shows spent true once that slot's ritual-N flag is checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] },
					moveUses: { [PREPARE_RITUALS_KEY]: { "ritual-1": true } }
				}
			}
		};

		expect(sheet._arcanistData().slots[0].spent).toBe(true);
	});

	it("reads the Wardhold tracker value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 4 } } } }
		};

		expect(sheet._arcanistData().wardHold).toBe(4);
	});

	it("canAdapt is false without Adaptive Rituals picked, even with an unspent prepared slot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } }
		};

		const data = sheet._arcanistData();
		expect(data.canAdapt).toBe(false);
		expect(data.adaptTooltip).toBeTruthy();
	});

	it("canAdapt is false with Adaptive Rituals picked but every prepared slot already spent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] },
					moveUses: { [PREPARE_RITUALS_KEY]: { "ritual-1": true } }
				}
			}
		};

		expect(sheet._arcanistData().canAdapt).toBe(false);
	});

	it("canAdapt is true with Adaptive Rituals picked and at least one unspent prepared slot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] }
				}
			}
		};

		const data = sheet._arcanistData();
		expect(data.canAdapt).toBe(true);
		expect(data.adaptTooltip).toBeNull();
	});

	it("getData.arcanist matches _arcanistData's own output, computed regardless of playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { slug: "the-scout" }, attributes: { arcanist: { rituals: [] } } }
		};

		expect(sheet.getData().arcanist).toEqual(sheet._arcanistData());
	});
});

describe("PlaybookActorSheet#_ritualMoveOptions", () => {
	it("includes a rollable basic move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 } }, attributes: {} } };

		expect(sheet._ritualMoveOptions().map((m) => m.key)).toContain(WEATHER_THE_STORM.key);
	});

	it("excludes a move with no traits/conditions/fixedTraits and nothing granting it a trait", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: {} } };

		expect(sheet._ritualMoveOptions().map((m) => m.key)).not.toContain("subsystems");
	});

	it("returns only key/name pairs", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 } }, attributes: {} } };

		const [option] = sheet._ritualMoveOptions();
		expect(Object.keys(option).sort()).toEqual(["key", "name"]);
	});
});

describe("PlaybookActorSheet#_onPrepareRituals", () => {
	it("does nothing when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		chooseArcanistRituals.mockResolvedValue(null);

		await sheet._onPrepareRituals();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the picker with 3 blank slots, regardless of what's currently prepared", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } },
			update: vi.fn()
		};
		chooseArcanistRituals.mockResolvedValue(null);

		await sheet._onPrepareRituals();

		expect(chooseArcanistRituals).toHaveBeenCalledWith(
			ARCANIST_RITUALS, [null, null, null], sheet._ritualMoveOptions(),
			expect.objectContaining({ title: "Prepare Rituals", buttonLabel: "Prepare" })
		);
	});

	it("writes the new slots, resets Wardhold to the fresh total, and clears all 3 spent flags in one update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] },
					moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 1 } }
				}
			},
			update: vi.fn()
		};
		const next = [{ ritualKey: "arcanist-ritual:warding", moveKey: null }, { ritualKey: "arcanist-ritual:warding", moveKey: null }, null];
		chooseArcanistRituals.mockResolvedValue(next);

		await sheet._onPrepareRituals();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.arcanist.rituals": next,
			[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`]: 4,
			[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-1`]: false,
			[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-2`]: false,
			[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-3`]: false
		});
	});
});

describe("PlaybookActorSheet#_onAdaptRituals", () => {
	it("no-ops when Adaptive Rituals isn't picked", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAdaptRituals();

		expect(chooseArcanistRituals).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when nothing is left to re-choose (every slot empty)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-arcanist:adaptive-rituals"] } },
			update: vi.fn()
		};

		await sheet._onAdaptRituals();

		expect(chooseArcanistRituals).not.toHaveBeenCalled();
	});

	it("no-ops when every prepared slot is already spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:aspect" }, null, null] },
					moveUses: { [PREPARE_RITUALS_KEY]: { "ritual-1": true } }
				}
			},
			update: vi.fn()
		};

		await sheet._onAdaptRituals();

		expect(chooseArcanistRituals).not.toHaveBeenCalled();
	});

	it("does nothing further when the picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] }
				}
			},
			update: vi.fn()
		};
		chooseArcanistRituals.mockResolvedValue(null);

		await sheet._onAdaptRituals();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("seeds the picker with locked (spent) slots passed through and unspent ones editable", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: {
						rituals: [
							{ ritualKey: "arcanist-ritual:aspect" },
							{ ritualKey: "arcanist-ritual:warding" },
							null
						]
					},
					moveUses: { [PREPARE_RITUALS_KEY]: { "ritual-1": true } }
				}
			},
			update: vi.fn()
		};
		chooseArcanistRituals.mockResolvedValue(null);

		await sheet._onAdaptRituals();

		expect(chooseArcanistRituals).toHaveBeenCalledWith(
			ARCANIST_RITUALS,
			[
				{ ritualKey: "arcanist-ritual:aspect", locked: true },
				{ ritualKey: "arcanist-ritual:warding", locked: false },
				null
			],
			sheet._ritualMoveOptions(),
			expect.objectContaining({ title: "Adapt Rituals", buttonLabel: "Adapt" })
		);
	});

	it("writes the new slots and the adapted Wardhold, without touching the spent flags", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-arcanist:adaptive-rituals"],
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] },
					moveTrackers: { [PREPARE_RITUALS_KEY]: { "ward-hold": 1 } }
				}
			},
			update: vi.fn()
		};
		const next = [{ ritualKey: "arcanist-ritual:warding", moveKey: null }, { ritualKey: "arcanist-ritual:warding", moveKey: null }, null];
		chooseArcanistRituals.mockResolvedValue(next);

		await sheet._onAdaptRituals();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.arcanist.rituals": next,
			// previous max 2, current 1 (1 already spent) -> next max 4 - 1 spent = 3.
			[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`]: 3
		});
	});
});

describe("PlaybookActorSheet#_preparedRitualMoves", () => {
	it("returns an empty list with nothing prepared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._preparedRitualMoves()).toEqual([]);
	});

	it("shapes a confidence slot with a Spent uses entry routed to the real move's own bucket", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: WEATHER_THE_STORM.key }, null, null] }
				}
			}
		};

		const [move] = sheet._preparedRitualMoves();

		expect(move.key).toBe("arcanist-ritual-slot:1");
		expect(move.traits).toEqual([]);
		expect(move.uses).toEqual([{ key: "ritual-1", label: "Spent" }]);
		expect(move.usesMoveKey).toBe(PREPARE_RITUALS_KEY);
		expect(move.promptsApproachOverride).toBeUndefined();
		expect(move.description).toContain(WEATHER_THE_STORM.name);
	});

	it("shapes an aspect slot with promptsApproachOverride Sortie-scoped", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [null, { ritualKey: "arcanist-ritual:aspect" }, null] } } }
		};

		const [move] = sheet._preparedRitualMoves();

		expect(move.key).toBe("arcanist-ritual-slot:2");
		expect(move.uses).toEqual([{ key: "ritual-2", label: "Spent" }]);
		expect(move.usesMoveKey).toBe(PREPARE_RITUALS_KEY);
		expect(move.promptsApproachOverride).toEqual({ period: "Sortie" });
	});

	it("shapes a warding slot with no uses entry at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [null, null, { ritualKey: "arcanist-ritual:warding" }] } } }
		};

		const [move] = sheet._preparedRitualMoves();

		expect(move.key).toBe("arcanist-ritual-slot:3");
		expect(move.uses).toBeUndefined();
		expect(move.usesMoveKey).toBeUndefined();
	});

	it("falls back to the raw moveKey in its description when it no longer resolves in ALL_MOVES", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					arcanist: { rituals: [{ ritualKey: "arcanist-ritual:confidence", moveKey: "stale-move-key" }, null, null] }
				}
			}
		};

		const [move] = sheet._preparedRitualMoves();

		expect(move.description).toContain("stale-move-key");
	});

	it("skips null (empty) slots entirely", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [null, { ritualKey: "arcanist-ritual:warding" }, null] } } }
		};

		expect(sheet._preparedRitualMoves()).toHaveLength(1);
	});
});

describe("PlaybookActorSheet#_preparedRitualEntry", () => {
	it("finds a synthesized ritual slot by key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { arcanist: { rituals: [{ ritualKey: "arcanist-ritual:warding" }, null, null] } } }
		};

		expect(sheet._preparedRitualEntry("arcanist-ritual-slot:1")).toBeTruthy();
	});

	it("returns null for an unknown key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._preparedRitualEntry("arcanist-ritual-slot:1")).toBeNull();
	});
});
