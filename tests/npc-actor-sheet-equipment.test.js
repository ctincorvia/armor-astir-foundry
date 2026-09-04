import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseEquipmentCatalogItem: vi.fn()
}));

import { TIER_MIN, chooseEquipmentCatalogItem, configureEquipment } from "../scripts/equipment/equipment.js";
import { NpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

beforeEach(() => {
	configureEquipment.mockClear();
	chooseEquipmentCatalogItem.mockClear();
});

describe("NpcActorSheet#_equipment", () => {
	it("defaults to an empty list", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		expect(sheet._equipment()).toEqual([]);
	});
});

describe("NpcActorSheet#_equipmentEntry", () => {
	it("treats a missing tags array as empty", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "gear", name: "Medkit", description: "" };

		const result = sheet._equipmentEntry(entry);

		expect(result.tags).toEqual([]);
		expect(result.value).toBe(0);
	});

	it("resolves gear with tags but no weapon-only fields", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "gear", name: "Medkit", description: "Heals.", tags: ["bulky"] };

		const result = sheet._equipmentEntry(entry);

		expect(result.id).toBe("1");
		expect(result.kind).toBe("gear");
		expect(result.name).toBe("Medkit");
		expect(result.description).toBe("Heals.");
		expect(result.tags[0]).toMatchObject({ showValue: true });
		expect(result.scale).toBeUndefined();
		expect(result.isAstir).toBeUndefined();
	});

	it("resolves a mundane weapon's scale/tier off the NPC's own Tier", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { tier: 4 } } };
		const entry = { id: "1", kind: "weapon", name: "Rifle", description: "", tags: [], scale: "foot" };

		const result = sheet._equipmentEntry(entry);

		expect(result.scale).toBe("foot");
		expect(result.tier).toBe(4);
		expect(result.isAstir).toBe(false);
		expect(result.extra).toBe(false);
		expect(result.disabled).toBe(false);
	});

	it("falls back to the raw scale key when it matches no known WEAPON_SCALES entry", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "weapon", name: "Rifle", description: "", tags: [], scale: "unknown-scale" };

		expect(sheet._equipmentEntry(entry).scaleLabel).toBe("unknown-scale");
	});

	it("defaults a mundane weapon's tier to TIER_MIN when unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "weapon", name: "Rifle", description: "", tags: [], scale: "foot" };

		expect(sheet._equipmentEntry(entry).tier).toBe(TIER_MIN);
	});

	it("resolves an Astir-owned weapon to Astir scale and its frame's Tier", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "weapon", name: "Lance", description: "", tags: [], astir: true };
		const frame = { tier: 4 };

		const result = sheet._equipmentEntry(entry, frame);

		expect(result.scale).toBe("astir");
		expect(result.scaleLabel).toBe("Astir Scale");
		expect(result.tier).toBe(4);
		expect(result.isAstir).toBe(true);
	});

	it("resolves an Ardent-owned weapon to Astir scale and its frame's Tier", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "weapon", name: "Spear", description: "", tags: [], ardent: "ar1" };
		const frame = { tier: 2 };

		const result = sheet._equipmentEntry(entry, frame);

		expect(result.scale).toBe("astir");
		expect(result.tier).toBe(2);
		expect(result.isAstir).toBe(false);
	});

	it("flags disabled off the entry", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const entry = { id: "1", kind: "weapon", name: "Rifle", description: "", tags: [], scale: "foot", disabled: true };

		expect(sheet._equipmentEntry(entry).disabled).toBe(true);
	});
});

describe("NpcActorSheet#_equipmentData", () => {
	it("partitions weapons/gear, excluding astir/ardent-owned entries from the plain weapons list", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const equipment = [
			{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: [], scale: "foot" },
			{ id: "2", kind: "weapon", name: "Lance", description: "", tags: [], astir: true },
			{ id: "3", kind: "gear", name: "Medkit", description: "", tags: [] }
		];
		const astirWeapons = [{ id: "2", name: "Lance" }];
		const ardentWeaponEntriesById = new Map();

		const data = sheet._equipmentData(equipment, astirWeapons, ardentWeaponEntriesById, []);

		expect(data.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.astirWeapons).toBe(astirWeapons);
		expect(data.gear.map((g) => g.id)).toEqual(["3"]);
	});

	it("flattens ardentWeapons across every Ardent, unfiltered by any mounted concept", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const ardents = [{ id: "ar1" }, { id: "ar2" }];
		const ardentWeaponEntriesById = new Map([
			["ar1", [{ id: "w1" }]],
			["ar2", [{ id: "w2" }]]
		]);

		const data = sheet._equipmentData([], [], ardentWeaponEntriesById, ardents);

		expect(data.ardentWeapons.map((w) => w.id)).toEqual(["w1", "w2"]);
	});
});

describe("NpcActorSheet#_saveNewEquipment", () => {
	it("appends a new entry with a generated id and empty spent", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._saveNewEquipment({ kind: "gear", name: "Medkit", description: "", tags: [] });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], kind: "gear", name: "Medkit", description: "", tags: [] }]
		});
	});
});

describe("NpcActorSheet#_onEquipmentAdd", () => {
	it("opens the custom editor with the clicked kind and the new budget rule, then saves", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ kind: "weapon", name: "Rifle", description: "", tags: [] });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { maxTagValue: 0 });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], kind: "weapon", name: "Rifle", description: "", tags: [] }]
		});
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onEquipmentCatalogAdd", () => {
	it("chains the catalog picker into the locked editor, saving catalogSource: true", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		const template = { key: "x", name: "Rifle", description: "", tags: ["ranged"] };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ kind: "weapon", name: "Rifle", description: "", tags: ["ranged"] });

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(chooseEquipmentCatalogItem).toHaveBeenCalledWith("weapon");
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { lockTags: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "weapon", name: "Rifle", description: "", tags: ["ranged"], catalogSource: true }
			]
		});
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue({ key: "x", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_equipmentEditLockState", () => {
	it("locks a plain custom entry only when catalogSource is truthy", () => {
		const sheet = new NpcActorSheet();

		expect(sheet._equipmentEditLockState({ catalogSource: true })).toEqual({ lockTags: true, maxTagValue: null });
		expect(sheet._equipmentEditLockState({})).toEqual({ lockTags: false, maxTagValue: 0 });
	});

	it("locks an Astir/Ardent-owned entry unless catalogSource is explicitly false", () => {
		const sheet = new NpcActorSheet();

		expect(sheet._equipmentEditLockState({ astir: true })).toEqual({ lockTags: true, maxTagValue: null });
		expect(sheet._equipmentEditLockState({ ardent: "ar1", catalogSource: false })).toEqual({ lockTags: false, maxTagValue: 0 });
	});
});

describe("NpcActorSheet#_onEquipmentEdit", () => {
	it("reopens a plain entry and replaces it, dropping stale fields, leaving other entries untouched", async () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "gear", name: "Medkit", description: "", tags: [], spent: [] };
		const other = { id: "2", kind: "gear", name: "Rations" };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ kind: "gear", name: "Medkit II", description: "", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { lockTags: false, maxTagValue: 0, allowOverride: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: false, kind: "gear", name: "Medkit II", description: "", tags: [] },
				other
			]
		});
	});

	it("defaults spent/disabled when the pre-edit entry carried neither", async () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "gear", name: "Medkit", description: "", tags: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ kind: "gear", name: "Medkit II", description: "", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: false, kind: "gear", name: "Medkit II", description: "", tags: [] }
			]
		});
	});

	it("reopens an Astir weapon with the astirWeapon option and recomputes Power", async () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ kind: "weapon", name: "Lance II", description: "", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { astirWeapon: true, lockTags: true, maxTagValue: null, allowOverride: true });
		const updates = sheet.actor.update.mock.calls[0][0];
		expect(updates["system.attributes.equipment"][0].astir).toBe(true);
		expect(updates["system.attributes.astir.power"]).toBe(4);
	});

	it("reopens an Ardent weapon with the ardentWeapon option, carrying the ardent flag forward", async () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ kind: "weapon", name: "Spear II", description: "", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { ardentWeapon: true, lockTags: true, maxTagValue: null, allowOverride: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: false, kind: "weapon", name: "Spear II", description: "", tags: [], ardent: "ar1" }
			]
		});
	});

	it("carries familiar/catalogSource forward when the result omits catalogSource", async () => {
		const sheet = new NpcActorSheet();
		const entry = {
			id: "1", kind: "weapon", astir: true, familiar: true, catalogSource: true, name: "Lance", description: "", tags: [], spent: []
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ kind: "weapon", name: "Lance II", description: "", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		const [updated] = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
		expect(updated.familiar).toBe(true);
		expect(updated.catalogSource).toBe(true);
	});

	it("does nothing for an unknown equipment id", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "nope" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "gear", name: "Medkit", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onEquipmentRemove", () => {
	it("removes the matching entry", () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "gear" };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});

	it("recomputes Astir Power when removing an Astir-owned weapon", () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		const updates = sheet.actor.update.mock.calls[0][0];
		expect(updates["system.attributes.equipment"]).toEqual([]);
		expect(updates["system.attributes.astir.power"]).toBe(4);
	});

	it("leaves Astir Power untouched when removing an Ardent weapon", () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "weapon", ardent: "ar1" };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("NpcActorSheet#_onEquipmentDisabledToggle", () => {
	it("writes the checked state to the matching entry, leaving others untouched", () => {
		const sheet = new NpcActorSheet();
		const entry = { id: "1", kind: "weapon" };
		const other = { id: "2", kind: "gear" };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentDisabledToggle({ currentTarget: { dataset: { equipmentId: "1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "1", kind: "weapon", disabled: true }, other]
		});
	});
});
