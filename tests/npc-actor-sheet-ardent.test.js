import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

import { ASTIR_PART_CATALOG, chooseAstirPart, chooseAstirWeapon } from "../scripts/frames/astir.js";
import { configureEquipment } from "../scripts/equipment/equipment.js";
import { ARDENT_TIER_MAX, ARDENT_TIER_MIN, ardentParts, ardentWeapons } from "../scripts/frames/ardent.js";
import { NpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");

beforeEach(() => {
	chooseAstirPart.mockClear();
	chooseAstirWeapon.mockClear();
	configureEquipment.mockClear();
	ui.notifications.warn.mockClear();
});

describe("NpcActorSheet#getData - ardents", () => {
	it("defaults to an empty list when there are no Ardents", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().ardents).toEqual([]);
	});

	it("resolves an Ardent's own fields, defaulting name and offering the full Approach list", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", approach: "elemental", tier: 3, piloted: true, parts: [] }] } }
		};

		const [ardent] = sheet.getData().ardents;

		expect(ardent.id).toBe("ar1");
		expect(ardent.name).toBe("Ardent");
		expect(ardent.approach).toBe("elemental");
		expect(ardent.approachOptions.map((a) => a.key)).toEqual(["mundane", "arcane", "divine", "profane", "elemental"]);
		expect(ardent.tier).toBe(3);
		expect(ardent.piloted).toBe(true);
	});

	it("uses a stored name when present", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [] }] } } };

		expect(sheet.getData().ardents[0].name).toBe("Warhound");
	});

	it("treats a missing parts array as empty and a missing tier as ARDENT_TIER_DEFAULT", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } } };

		const [ardent] = sheet.getData().ardents;

		expect(ardent.parts).toEqual([]);
		expect(ardent.tier).toBe(ARDENT_TIER_MIN);
	});

	it("resolves parts to name/partType and this Ardent's own tier", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }] } } };

		expect(sheet.getData().ardents[0].parts).toEqual([
			{ key: WARDING.key, name: WARDING.name, partType: WARDING.partType, tier: ARDENT_TIER_MIN, disabled: false }
		]);
	});

	it("flags a disabled part off moveUses", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					moveUses: { [WARDING.key]: { disabled: true } }
				}
			}
		};

		expect(sheet.getData().ardents[0].parts[0].disabled).toBe(true);
	});

	it("surfaces only this Ardent's own ardent-flagged weapons, with the Ardent's own tier and Astir scale", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", tier: 4, parts: [] }, { id: "ar2", tier: 2, parts: [] }],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", ardent: "ar2", name: "Axe", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.ardents[0].weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.ardents[0].weapons[0].tier).toBe(4);
		expect(data.ardents[0].weapons[0].scaleLabel).toBe("Astir Scale");
		expect(data.ardents[1].weapons.map((w) => w.id)).toEqual(["2"]);
		// The Equipment tab's own ardentWeapons is unfiltered by any "mounted" concept — both surface.
		expect(data.equipment.ardentWeapons.map((w) => w.id)).toEqual(["1", "2"]);
	});

	it("flags loadoutFull once parts+weapons reach ARDENT_MAX_LOADOUT", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }]
				}
			}
		};

		expect(sheet.getData().ardents[0].loadoutFull).toBe(true);
	});

	it("leaves loadoutFull false below the cap", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } } };

		expect(sheet.getData().ardents[0].loadoutFull).toBe(false);
	});
});

describe("NpcActorSheet#_onArdentCreate", () => {
	it("appends a fresh Ardent to an empty list", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onArdentCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [
				{ id: "test-id", name: "Ardent", approach: "", tier: ARDENT_TIER_MIN, piloted: false, parts: [] }
			]
		});
	});

	it("appends alongside existing Ardents rather than replacing them", () => {
		const sheet = new NpcActorSheet();
		const existing = { id: "ar1", name: "Warhound" };
		sheet.actor = { system: { attributes: { ardents: [existing] } }, update: vi.fn() };

		sheet._onArdentCreate();

		const updated = sheet.actor.update.mock.calls[0][0]["system.attributes.ardents"];
		expect(updated[0]).toBe(existing);
		expect(updated).toHaveLength(2);
	});
});

describe("NpcActorSheet#_onArdentDelete", () => {
	it("removes the matching Ardent and every weapon it owns", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", name: "Kestrel" };
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", name: "Warhound" }, other],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1" },
						{ id: "2", kind: "weapon", ardent: "ar2" },
						{ id: "3", kind: "gear" }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onArdentDelete({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [other],
			"system.attributes.equipment": [
				{ id: "2", kind: "weapon", ardent: "ar2" },
				{ id: "3", kind: "gear" }
			]
		});
	});

	it("does nothing for an id that doesn't match any Ardent", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentDelete({ currentTarget: { dataset: { ardentId: "not-a-real-id" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentNameChange", () => {
	it("trims and writes the new name, leaving other Ardents untouched", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", name: "Kestrel" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Old" }, other] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "  Warhound  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", name: "Warhound" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "x" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentApproachChange", () => {
	it("writes the chosen Approach, leaving other Ardents untouched", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", approach: "mundane" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", approach: "" }, other] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "elemental" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", approach: "elemental" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "elemental" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentTierStep", () => {
	it("increments within the 2-4 band, leaving other Ardents untouched", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", tier: 3 };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: 2 }, other] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: 3 }, other] });
	});

	it("treats a missing tier as ARDENT_TIER_DEFAULT", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: ARDENT_TIER_MIN + 1 }] });
	});

	it("clamps at ARDENT_TIER_MAX", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MAX }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ARDENT_TIER_MIN", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MIN }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "nope", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentPilotedToggle", () => {
	it("writes the checked state independently, with no mount-exclusivity", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", piloted: true };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", piloted: false }, other] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "ar1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", piloted: true }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPilotedToggle({ currentTarget: { dataset: { ardentId: "nope" }, checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentPartAdd", () => {
	it("offers the Ardent-eligible catalog and adds the chosen part, leaving other Ardents untouched", async () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }, other] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }, other]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the picker is cancelled", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an already-picked part", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as empty", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }]
		});
	});
});

describe("NpcActorSheet#_onArdentPartRemove", () => {
	it("removes the matching part, leaving other Ardents untouched", () => {
		const sheet = new NpcActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }, other] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", parts: [] }, other] });
	});

	it("does nothing for a part that isn't installed", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as empty", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "nope", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with ardentWeapon and lockTags, then saves flagged for this Ardent with catalogSource: true", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Spear", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).toHaveBeenCalledWith(ardentWeapons(), [], { title: "Pick an Ardent Weapon" });
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { ardentWeapon: true, lockTags: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], ardent: "ar1", catalogSource: true, name: "Spear", description: "",
					kind: "weapon", tags: ["melee"]
				}
			]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "x", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("NpcActorSheet#_onArdentWeaponCustomAdd", () => {
	it("skips the catalog step, opening configureEquipment directly with ardentWeapon and maxTagValue: 0, saving catalogSource: false", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Custom Spear", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onArdentWeaponCustomAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { ardentWeapon: true, maxTagValue: 0 });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], ardent: "ar1", catalogSource: false, name: "Custom Spear", description: "",
					kind: "weapon", tags: ["melee"]
				}
			]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", parts: [WARDING.key] }],
					equipment: [{ id: "1", kind: "weapon", ardent: "ar1" }]
				}
			},
			update: vi.fn()
		};

		await sheet._onArdentWeaponCustomAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onArdentWeaponCustomAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentWeaponCustomAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
