import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn(),
	chooseAstirMove: vi.fn()
}));

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

vi.mock("../scripts/moves/move-dialogs.js", async (importOriginal) => ({
	...(await importOriginal()),
	showMoveDescription: vi.fn()
}));

import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MOVE_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	ASTIR_PART_CATALOG,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon
} from "../scripts/frames/astir.js";
import { configureEquipment } from "../scripts/equipment/equipment.js";
import { showMoveDescription } from "../scripts/moves/move-dialogs.js";
import { NpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");
const WEAPON_CONDUIT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:weapon-conduit");

beforeEach(() => {
	chooseAstirPart.mockClear();
	chooseAstirWeapon.mockClear();
	chooseAstirMove.mockClear();
	configureEquipment.mockClear();
	showMoveDescription.mockClear();
	ui.notifications.warn.mockClear();
});

describe("NpcActorSheet#_astir/_astirPartKeys", () => {
	it("defaults to null/empty when unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		expect(sheet._astir()).toBeNull();
		expect(sheet._astirPartKeys({})).toEqual([]);
	});

	it("reads parts only, never an extraParts pool", () => {
		const sheet = new NpcActorSheet();

		expect(sheet._astirPartKeys({ parts: [WARDING.key], extraParts: [ARTIFACT.key] })).toEqual([WARDING.key]);
	});
});

describe("NpcActorSheet#getData - astir", () => {
	it("reports exists: false with no available gate when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: {} };

		const data = sheet.getData().astir;

		expect(data.exists).toBe(false);
		expect(data.available).toBeUndefined();
		expect(data.cores).toBe(ASTIR_CORES);
	});

	it("resolves the Astir's own fields using the actor's own name, no Callsign", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			name: "Warhound",
			system: {
				attributes: {
					astir: { id: "a1", core: "alchemical", approach: "mundane", tier: 4, power: 3, overheating: true, piloted: true, parts: [] }
				}
			}
		};

		const data = sheet.getData().astir;

		expect(data.name).toBe("Warhound");
		expect(data.img).toBe(ASTIR_DEFAULT_IMG);
		expect(data.core).toBe("alchemical");
		expect(data.approach).toBe("mundane");
		expect(data.tier).toBe(4);
		expect(data.overheating).toBe(true);
		expect(data.piloted).toBe(true);
		expect(data.power).toEqual({ value: 3, max: expect.any(Number), negative: false });
	});

	it("treats a missing parts array as empty for both parts and partsFull", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1" } } } };

		const data = sheet.getData().astir;

		expect(data.parts).toEqual([]);
		expect(data.partsFull).toBe(false);
	});

	it("never renders Extra Parts, Extra Weapons, or Potions fields", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1", parts: [] } } } };

		const data = sheet.getData().astir;

		expect(data.extraParts).toBeUndefined();
		expect(data.extraWeapons).toBeUndefined();
		expect(data.potions).toBeUndefined();
	});

	it("resolves parts without a guided-move dropdown field", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1", tier: 4, parts: [WARDING.key] } } } };

		const [part] = sheet.getData().astir.parts;

		expect(part.key).toBe(WARDING.key);
		expect(part.name).toBe(WARDING.name);
		expect(part.tier).toBe(4);
		expect(part.disabled).toBe(false);
		expect(part.guidedMoveChoosable).toBeUndefined();
	});

	it("flags disabled parts off moveUses", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			name: "Warhound",
			system: { attributes: { astir: { id: "a1", parts: [WARDING.key] }, moveUses: { [WARDING.key]: { disabled: true } } } }
		};

		expect(sheet.getData().astir.parts[0].disabled).toBe(true);
	});

	it("flags partsFull once at ASTIR_MAX_PARTS", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1", parts: [WARDING.key, ARTIFACT.key] } } } };

		expect(sheet.getData().astir.partsFull).toBe(true);
	});

	it("resolves the Astir Move when one is stored", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1", parts: [], move: null } } } };

		expect(sheet.getData().astir.move).toBeNull();
	});

	it("resolves a stored move key to its catalog entry", () => {
		const sheet = new NpcActorSheet();
		const move = ASTIR_MOVE_CATALOG[0];
		sheet.actor = { name: "Warhound", system: { attributes: { astir: { id: "a1", parts: [], move: move.key } } } };

		expect(sheet.getData().astir.move).toEqual({ key: move.key, name: move.name });
	});
});

describe("NpcActorSheet#_astirParts/_isPartDisabled", () => {
	it("resolves installed parts", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [WARDING.key] } } } };

		expect(sheet._astirParts().map((p) => p.key)).toEqual([WARDING.key]);
	});

	it("reads Disabled off moveUses", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { moveUses: { [WARDING.key]: { disabled: true } } } } };

		expect(sheet._isPartDisabled(WARDING.key)).toBe(true);
		expect(sheet._isPartDisabled(ARTIFACT.key)).toBe(false);
	});
});

describe("NpcActorSheet#_astirPowerUpdates", () => {
	it("clamps power/weaponPower to the derived max", () => {
		const sheet = new NpcActorSheet();
		const astir = { power: 4, weaponPower: 0, piloted: false, parts: [] };
		sheet.actor = { system: { attributes: { equipment: [] } } };

		expect(sheet._astirPowerUpdates(astir)).toEqual({
			"system.attributes.astir.power": 4,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("forces Piloted off with a warning once Power goes negative", () => {
		const sheet = new NpcActorSheet();
		const astir = { power: 0, weaponPower: 0, piloted: true, parts: [] };
		const equipment = [
			{ id: "1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = { system: { attributes: { equipment } } };

		const updates = sheet._astirPowerUpdates(astir, { parts: [], equipment });

		expect(updates["system.attributes.astir.piloted"]).toBe(false);
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirCreate", () => {
	it("seeds a fresh Astir with move: null, no required-move lookup", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": {
				id: "test-id", img: ASTIR_DEFAULT_IMG, core: "", approach: "", tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE, overheating: false, piloted: false, parts: [], move: null
			}
		});
	});

	it("does nothing when an Astir already exists", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirCreate();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirDelete", () => {
	it("clears the Astir and strips astir-owned equipment", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1" },
					equipment: [{ id: "1", astir: true }, { id: "2", kind: "gear" }]
				}
			},
			update: vi.fn()
		};

		sheet._onAstirDelete();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir": null,
			"system.attributes.equipment": [{ id: "2", kind: "gear" }]
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirDelete();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirCoreChange", () => {
	it("writes the new core and clears an Approach it no longer offers", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "", approach: "profane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.core": "alchemical",
			"system.attributes.astir.approach": ""
		});
	});

	it("keeps an Approach the new core still offers", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", core: "", approach: "mundane" } } }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.core": "alchemical" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirCoreChange({ currentTarget: { value: "alchemical" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirApproachChange", () => {
	it("writes the chosen approach", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.approach": "arcane" });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirApproachChange({ currentTarget: { value: "arcane" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirTierStep", () => {
	it("steps within the 3-4 band", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: 3 } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": 4 });
	});

	it("treats a missing tier as ASTIR_TIER_MIN", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.tier": ASTIR_TIER_MIN + 1 });
	});

	it("clamps at the bounds", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", tier: ASTIR_TIER_MAX } } }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirPowerStep/_onAstirWeaponPowerStep", () => {
	it("steps Power within its derived max", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 1, parts: [] }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 2 });
	});

	it("treats a missing power as 0", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.power": 1 });
	});

	it("floors Power at ASTIR_POWER_MIN", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: ASTIR_POWER_MIN }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("steps Weapon Power within its derived max", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", weaponPower: 1, parts: [WEAPON_CONDUIT.key] }, equipment: [] } },
			update: vi.fn()
		};

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.weaponPower": 2 });
	});

	it("treats a missing weaponPower as 0, not stepping past its derived max of 0 with no Weapon Conduit installed", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for either stepper when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPowerStep({ currentTarget: { dataset: { delta: "1" } } });
		sheet._onAstirWeaponPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirOverheatingToggle/_onAstirPilotedToggle", () => {
	it("writes the checked state for Overheating", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.overheating": true });
	});

	it("writes the checked state for Piloted with no mount-exclusivity", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };

		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.piloted": true });
	});

	it("does nothing for either toggle when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirOverheatingToggle({ currentTarget: { checked: true } });
		sheet._onAstirPilotedToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirPartAdd/_onAstirPartRemove", () => {
	it("adds the chosen part and recomputes Power", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalled();
		expect(sheet.actor.update.mock.calls[0][0]["system.attributes.astir.parts"]).toEqual([WARDING.key]);
	});

	it("treats a missing parts array as empty when adding", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update.mock.calls[0][0]["system.attributes.astir.parts"]).toEqual([WARDING.key]);
	});

	it("refuses once at ASTIR_MAX_PARTS", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [WARDING.key, ARTIFACT.key] } } } , update: vi.fn() };

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("does nothing when the picker is cancelled or there is no Astir", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();

		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		await sheet._onAstirPartAdd();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("removes an installed part and recomputes Power", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [WARDING.key] }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: WARDING.key } } });

		expect(sheet.actor.update.mock.calls[0][0]["system.attributes.astir.parts"]).toEqual([]);
	});

	it("treats a missing parts array as empty when removing", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing removing a part that isn't installed or with no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();

		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: WARDING.key } } });
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirMoveAdd/_onAstirMoveRemove", () => {
	it("always opens the free picker, with no required-move short-circuit", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [], move: null } } }, update: vi.fn() };
		chooseAstirMove.mockResolvedValue("astir-move:test");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith(undefined, [], undefined, undefined, []);
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": "astir-move:test" });
	});

	it("passes the current move as already-selected", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [], move: "old-move" } } }, update: vi.fn() };
		chooseAstirMove.mockResolvedValue(null);

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith(undefined, ["old-move"], undefined, undefined, []);
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).not.toHaveBeenCalled();
	});

	it("clears the move", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: "x" } } }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": null });
	});

	it("does nothing removing a move when there is no Astir", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment, saving astir/catalogSource: true and recomputing Power", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };
		const template = { key: "x", name: "Lance", description: "", tags: [] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: [] });

		await sheet._onAstirWeaponAdd();

		expect(chooseAstirWeapon).toHaveBeenCalledWith(undefined, []);
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { astirWeapon: true, lockTags: true });
		const updates = sheet.actor.update.mock.calls[0][0];
		expect(updates["system.attributes.equipment"][0]).toMatchObject({ astir: true, catalogSource: true, name: "Lance" });
	});

	it("carries the familiar flag from the template", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };
		const template = { key: "x", name: "Familiar Weapon", description: "", tags: [], familiar: true };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Familiar Weapon", description: "", kind: "weapon", tags: [] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"][0].familiar).toBe(true);
	});

	it("does nothing when the catalog picker is cancelled or there is no Astir", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponAdd();
		expect(chooseAstirWeapon).not.toHaveBeenCalled();

		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);
		await sheet._onAstirWeaponAdd();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "x", name: "Lance", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onAstirWeaponCustomAdd", () => {
	it("skips the catalog step, saving astir/catalogSource: false", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] }, equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Custom Lance", description: "", kind: "weapon", tags: [] });

		await sheet._onAstirWeaponCustomAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { astirWeapon: true, maxTagValue: 0 });
		const updates = sheet.actor.update.mock.calls[0][0];
		expect(updates["system.attributes.equipment"][0]).toMatchObject({ astir: true, catalogSource: false });
	});

	it("does nothing when the editor is dismissed or there is no Astir", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponCustomAdd();
		expect(configureEquipment).not.toHaveBeenCalled();

		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [] } } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);
		await sheet._onAstirWeaponCustomAdd();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onMoveInfo", () => {
	it("resolves an Astir Part key and shows its description", async () => {
		const sheet = new NpcActorSheet();

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: WARDING.key } } });

		expect(showMoveDescription).toHaveBeenCalledWith(WARDING);
	});

	it("falls back to resolving an Astir Move key when it isn't an Astir Part", async () => {
		const sheet = new NpcActorSheet();
		const move = ASTIR_MOVE_CATALOG[0];

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: move.key } } });

		expect(showMoveDescription).toHaveBeenCalledWith(move);
	});

	it("does nothing for a key that resolves to neither", async () => {
		const sheet = new NpcActorSheet();

		await sheet._onMoveInfo({ currentTarget: { dataset: { move: "unresolvable-key" } } });

		expect(showMoveDescription).not.toHaveBeenCalled();
	});
});
