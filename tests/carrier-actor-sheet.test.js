import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the dialog is mocked — BASIC_MOVES/configureMoveRoll's real trait-building stays untouched
// elsewhere, same reasoning playbook-actor-sheet.test.js already uses for these modules.
vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	rollMove: vi.fn()
}));

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

import { BASIC_MOVES, configureMoveRoll, rollMove } from "../scripts/moves/moves.js";
import { TIER_MAX, configureEquipment } from "../scripts/equipment/equipment.js";
import {
	CarrierActorSheet,
	CARRIER_SHEET_TEMPLATE,
	findCarrierActors,
	chooseCarrier,
	registerCarrierActorSheet
} from "../scripts/world-actors/carrier-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");

beforeEach(() => {
	configureMoveRoll.mockClear();
	rollMove.mockClear();
	configureEquipment.mockClear();
});

describe("CarrierActorSheet.defaultOptions", () => {
	it("merges the carrier sheet's classes/template onto the base world-actor options", () => {
		expect(CarrierActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "carrier"],
			template: CARRIER_SHEET_TEMPLATE,
			width: 640,
			height: "auto"
		});
	});
});

describe("CarrierActorSheet#_entryDefaults", () => {
	it("seeds a crew member with name/position/description", () => {
		const sheet = new CarrierActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", position: "", description: "" });
	});
});

describe("CarrierActorSheet#getData", () => {
	it("reads crew, description, and crew members off the actor", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 2 } },
				details: { description: { value: "A sturdy old freighter." } },
				attributes: { crewMembers: [{ id: "1", name: "Vex", position: "Pilot", description: "" }] }
			}
		};

		const data = sheet.getData({});

		expect(data.crew).toBe(2);
		expect(data.description).toBe("A sturdy old freighter.");
		expect(data.crewMembers).toEqual([{ id: "1", name: "Vex", position: "Pilot", description: "" }]);
	});

	it("defaults crew/description/crewMembers when unset", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.crew).toBe(0);
		expect(data.description).toBe("");
		expect(data.crewMembers).toEqual([]);
	});

	it("builds a weapon entry with value/scale/tier/tags and a quick-roll move per weapon move", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					weapons: [
						{ id: "w1", name: "Ram Cannon", description: "A hull-mounted cannon.", kind: "weapon", tags: ["melee"], scale: "astir", tier: 5 }
					]
				}
			}
		};

		const data = sheet.getData({});

		expect(data.weapons).toHaveLength(1);
		expect(data.weapons[0]).toMatchObject({
			id: "w1",
			name: "Ram Cannon",
			description: "A hull-mounted cannon.",
			scaleLabel: "Astir Scale",
			tier: 5
		});
		expect(data.weapons[0].tags).toEqual(expect.arrayContaining([expect.objectContaining({ key: "melee" })]));
		expect(data.weapons[0].moves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows" },
			{ key: "strike-decisively", name: "Strike Decisively" }
		]);
	});

	it("treats a missing tags array as empty and falls back to the raw scale key if unrecognized", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: [{ id: "w1", name: "Ram Cannon", scale: "unknown-scale" }] } }
		};

		const data = sheet.getData({});

		expect(data.weapons[0].tags).toEqual([]);
		expect(data.weapons[0].value).toBe(0);
		expect(data.weapons[0].scaleLabel).toBe("unknown-scale");
	});

	it("caps weapons at 2 and reports canAddWeapon", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					weapons: [
						{ id: "w1", name: "Ram Cannon", kind: "weapon", tags: [], scale: "astir", tier: 5 },
						{ id: "w2", name: "Boarding Claw", kind: "weapon", tags: [], scale: "astir", tier: 5 }
					]
				}
			}
		};

		const data = sheet.getData({});

		expect(data.canAddWeapon).toBe(false);
	});

	it("defaults weapons to empty, with canAddWeapon true, when unset", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.weapons).toEqual([]);
		expect(data.canAddWeapon).toBe(true);
	});
});

describe("CarrierActorSheet#activateListeners", () => {
	it("binds the crew stepper and weapon handlers alongside the shared entry-list handlers", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".crew-step");
		expect(html.find).toHaveBeenCalledWith(".weapon-add");
		expect(html.find).toHaveBeenCalledWith(".weapon-edit");
		expect(html.find).toHaveBeenCalledWith(".weapon-remove");
		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
	});
});

describe("CarrierActorSheet#_onCrewStep", () => {
	it("increments crew by the clicked delta", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { stats: { crew: { value: 0 } } }, update: vi.fn() };

		sheet._onCrewStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.crew.value": 1 });
	});

	it("clamps at the maximum", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { stats: { crew: { value: 3 } } }, update: vi.fn() };

		sheet._onCrewStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { stats: { crew: { value: -3 } } }, update: vi.fn() };

		sheet._onCrewStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing crew value as 0", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onCrewStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.crew.value": 1 });
	});
});

describe("CarrierActorSheet#_onWeaponAdd", () => {
	it("saves a new weapon, forcing kind/tier regardless of what configureEquipment resolved", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Ram Cannon", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: 5 });

		await sheet._onWeaponAdd();

		expect(configureEquipment).toHaveBeenCalledWith(null, undefined, { carrierWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons": [
				{ id: "test-id", spent: [], name: "Ram Cannon", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: TIER_MAX }
			]
		});
	});

	it("does nothing once the actor already has the maximum weapons", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: [{ id: "w1" }, { id: "w2" }] } },
			update: vi.fn()
		};

		await sheet._onWeaponAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("CarrierActorSheet#_onWeaponEdit", () => {
	it("saves over the matching weapon, keeping its id/spent and forcing kind/tier, leaving the other untouched", async () => {
		const sheet = new CarrierActorSheet();
		const existing = { id: "w1", spent: ["blitz"], name: "Old Name", kind: "weapon", tags: [], scale: "astir", tier: 5 };
		const other = { id: "w2", name: "Boarding Claw" };
		sheet.actor = { system: { attributes: { weapons: [existing, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: 1 });

		await sheet._onWeaponEdit({ currentTarget: { dataset: { weaponId: "w1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(existing, undefined, { carrierWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons": [
				{ id: "w1", spent: ["blitz"], name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: TIER_MAX },
				other
			]
		});
	});

	it("treats a missing spent array as empty", async () => {
		const sheet = new CarrierActorSheet();
		const existing = { id: "w1", name: "Old Name", kind: "weapon", tags: [], scale: "astir", tier: 5 };
		sheet.actor = { system: { attributes: { weapons: [existing] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: 1 });

		await sheet._onWeaponEdit({ currentTarget: { dataset: { weaponId: "w1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons": [
				{ id: "w1", spent: [], name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: TIER_MAX }
			]
		});
	});

	it("does nothing when no weapon matches the given id", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: [{ id: "w1" }] } }, update: vi.fn() };

		await sheet._onWeaponEdit({ currentTarget: { dataset: { weaponId: "missing" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: [{ id: "w1" }] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onWeaponEdit({ currentTarget: { dataset: { weaponId: "w1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("CarrierActorSheet#_onWeaponRemove", () => {
	it("removes the weapon matching the clicked button's id", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: [{ id: "w1" }, { id: "w2" }] } },
			update: vi.fn()
		};

		sheet._onWeaponRemove({ currentTarget: { dataset: { weaponId: "w1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.weapons": [{ id: "w2" }] });
	});
});

describe("CarrierActorSheet#_onWeaponMoveRoll", () => {
	it("rolls +CREW with the clicked weapon, using the actor's own crew value", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: { crew: { value: 2 } }, attributes: { weapons: [{ id: "w1", name: "Ram Cannon" }] } }
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 2 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", weaponId: "w1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[{ key: "crew", label: "CREW", value: 2 }],
			{}
		);
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			{ key: "crew", label: "CREW", value: 2 },
			{ weaponLabel: "Ram Cannon" }
		);
	});

	it("works for strike-decisively too", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: { crew: { value: 0 } }, attributes: { weapons: [{ id: "w1", name: "Ram Cannon" }] } }
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 0 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", weaponId: "w1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(STRIKE_DECISIVELY, expect.any(Array), {});
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: { crew: { value: 0 } }, attributes: { weapons: [{ id: "w1", name: "Ram Cannon" }] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", weaponId: "w1" } } });

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when no weapon matches the given id", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { stats: { crew: { value: 0 } }, attributes: { weapons: [] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", weaponId: "missing" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: { crew: { value: 0 } }, attributes: { weapons: [{ id: "w1", name: "Ram Cannon" }] } }
		};

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", weaponId: "w1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("treats a missing crew value as 0", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { weapons: [{ id: "w1", name: "Ram Cannon" }] } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", weaponId: "w1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, [{ key: "crew", label: "CREW", value: 0 }], {});
	});
});

describe("findCarrierActors", () => {
	it("filters game.actors down to carrier-type actors", () => {
		const carrier = { id: "c1", type: "armor-astir.carrier" };
		game.actors.filter.mockImplementation((fn) => [carrier, { id: "other", type: "armor-astir.cause" }].filter(fn));

		expect(findCarrierActors()).toEqual([carrier]);
	});
});

describe("chooseCarrier", () => {
	it("offers one button per carrier, resolving the clicked carrier's id", async () => {
		const carrier1 = { id: "c1", name: "The Wanderer" };
		const carrier2 = { id: "c2", name: "The Anchor" };
		const promise = chooseCarrier([carrier1, carrier2]);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		expect(Object.keys(dialogOptions.buttons)).toEqual(["c1", "c2"]);

		dialogOptions.buttons.c2.callback();

		expect(await promise).toBe("c2");
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = chooseCarrier([{ id: "c1", name: "The Wanderer" }]);

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});
});

describe("registerCarrierActorSheet", () => {
	it("registers the sheet as the default sheet for the carrier actor type", () => {
		registerCarrierActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("armor-astir", CarrierActorSheet, {
			types: ["armor-astir.carrier"],
			makeDefault: true,
			label: "Carrier"
		});
	});
});
