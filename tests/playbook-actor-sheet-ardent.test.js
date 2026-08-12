import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the picker dialogs are mocked — the catalogs and helpers stay real, so the sheet is
// exercised against the actual Astir Part/Weapon content Ardents can also use.
vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// Only the editor and weapon-choice dialogs are mocked — the tag catalog and resolve helpers stay
// real, same reasoning as astir.js above.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseWeapon: vi.fn()
}));

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn()
}));

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { BASIC_MOVES, configureMoveRoll } from "../scripts/moves/moves.js";
import { chooseWeapon, configureEquipment } from "../scripts/equipment/equipment.js";
import { ASTIR_PART_CATALOG, chooseAstirPart, chooseAstirWeapon } from "../scripts/frames/astir.js";
import { ARDENT_TIER_MAX, ARDENT_TIER_MIN, ardentParts, ardentWeapons } from "../scripts/frames/ardent.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const INPUT_CHANNEL = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:input-channel");
const WARDING = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:warding");
const ARTIFACT = ASTIR_PART_CATALOG.find((p) => p.key === "astir-part:artifact");

beforeEach(() => {
	chooseAstirPart.mockClear();
	chooseAstirWeapon.mockClear();
	configureEquipment.mockClear();
	chooseWeapon.mockClear();
	configureMoveRoll.mockClear();
	ui.notifications.warn.mockClear();
});

describe("PlaybookActorSheet#getData - ardents", () => {
	it("defaults to an empty list when there are no Ardents", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet.getData().ardents).toEqual([]);
	});

	it("exposes the Ardent tier bounds", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.ardentTierMin).toBe(ARDENT_TIER_MIN);
		expect(data.ardentTierMax).toBe(ARDENT_TIER_MAX);
	});

	it("resolves an Ardent's own fields, defaulting name and offering the full Approach list", () => {
		const sheet = new PlaybookActorSheet();
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
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [] }] } } };

		expect(sheet.getData().ardents[0].name).toBe("Warhound");
	});

	it("resolves parts to name/partType and this Ardent's own tier, without a Power cost field", () => {
		const sheet = new PlaybookActorSheet();
		const part = WARDING;
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [part.key] }] } } };

		expect(sheet.getData().ardents[0].parts).toEqual([
			{ key: part.key, name: part.name, partType: part.partType, tier: ARDENT_TIER_MIN }
		]);
	});

	it("surfaces only this Ardent's own ardent-flagged weapons, with the Ardent's own tier and Astir scale", () => {
		const sheet = new PlaybookActorSheet();
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
		expect(data.equipment.ardentWeapons.map((w) => w.id)).toEqual(["1", "2"]);
	});

	it("flags loadoutFull once parts+weapons reach ARDENT_MAX_LOADOUT", () => {
		const sheet = new PlaybookActorSheet();
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
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } } };

		expect(sheet.getData().ardents[0].loadoutFull).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - ardent moves group", () => {
	it("adds no group for an Ardent with no parts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [] }] } } };

		expect(sheet.getData().moveGroups.some((g) => g.label === "Warhound Moves")).toBe(false);
	});

	it("lists an Ardent's own installed parts under a group named after it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { ardents: [{ id: "ar1", name: "Warhound", parts: [WARDING.key] }] } }
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Warhound Moves");

		expect(group.moves.map((m) => m.key)).toEqual([WARDING.key]);
		expect(group.addable).toBeUndefined();
	});

	it("defaults an unnamed Ardent's group label to Ardent Moves", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }] } } };

		expect(sheet.getData().moveGroups.some((g) => g.label === "Ardent Moves")).toBe(true);
	});

	it("gates the group unless this Ardent specifically is the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [
						{ id: "ar1", name: "Warhound", parts: [WARDING.key], piloted: true },
						{ id: "ar2", name: "Kestrel", parts: [WARDING.key], piloted: false }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups.find((g) => g.label === "Warhound Moves").moves[0].gated).toBe(false);
		expect(data.moveGroups.find((g) => g.label === "Kestrel Moves").moves[0].gated).toBe(true);
	});

	it("gates every Ardent's group when the Astir is mounted instead", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", piloted: true, parts: [] },
					ardents: [{ id: "ar1", name: "Warhound", parts: [WARDING.key], piloted: false }]
				}
			}
		};

		const group = sheet.getData().moveGroups.find((g) => g.label === "Warhound Moves");

		expect(group.moves[0].gated).toBe(true);
	});
});

describe("PlaybookActorSheet#activateListeners - ardent", () => {
	it("binds every Ardent control to its handler", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		const bound = [
			".ardent-create",
			".ardent-delete",
			".ardent-name-input",
			".ardent-approach-select",
			".ardent-tier-step",
			".ardent-piloted-checkbox",
			".ardent-part-add",
			".ardent-part-remove",
			".ardent-weapon-catalog-add"
		];
		for (const selector of bound) {
			expect(html.find).toHaveBeenCalledWith(selector);
		}
	});
});

describe("PlaybookActorSheet#_onArdentCreate", () => {
	it("appends a fresh Ardent to an empty list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onArdentCreate();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [
				{ id: "test-id", name: "Ardent", approach: "", tier: ARDENT_TIER_MIN, piloted: false, parts: [] }
			]
		});
	});

	it("appends alongside existing Ardents rather than replacing them", () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "ar1", name: "Warhound" };
		sheet.actor = { system: { attributes: { ardents: [existing] } }, update: vi.fn() };

		sheet._onArdentCreate();

		const updated = sheet.actor.update.mock.calls[0][0]["system.attributes.ardents"];
		expect(updated[0]).toBe(existing);
		expect(updated).toHaveLength(2);
	});
});

describe("PlaybookActorSheet#_onArdentDelete", () => {
	it("removes the matching Ardent and every weapon it owns", () => {
		const sheet = new PlaybookActorSheet();
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
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentDelete({ currentTarget: { dataset: { ardentId: "not-a-real-id" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentNameChange", () => {
	it("trims and writes the new name, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", name: "Kestrel" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", name: "Old" }, other] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "  Warhound  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", name: "Warhound" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentNameChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "x" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentApproachChange", () => {
	it("writes the chosen Approach, unrestricted by any Core, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", approach: "mundane" };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", approach: "" }, other] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "ar1" }, value: "elemental" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", approach: "elemental" }, other]
		});
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentApproachChange({ currentTarget: { dataset: { ardentId: "nope" }, value: "elemental" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentTierStep", () => {
	it("increments within the 2-4 band, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", tier: 3 };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: 2 }, other] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: 3 }, other] });
	});

	it("treats a missing tier as ARDENT_TIER_DEFAULT", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", tier: ARDENT_TIER_MIN + 1 }] });
	});

	it("clamps at ARDENT_TIER_MAX", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MAX }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at ARDENT_TIER_MIN", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", tier: ARDENT_TIER_MIN }] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "ar1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentTierStep({ currentTarget: { dataset: { ardentId: "nope", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentPartAdd", () => {
	it("offers the Ardent-eligible catalog and adds the chosen part, leaving other Ardents untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }, other] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }, other]
		});
	});

	it("treats a missing parts array as empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirPart).toHaveBeenCalledWith([], ardentParts(), { title: "Add an Ardent Part" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.ardents": [{ id: "ar1", parts: [WARDING.key] }]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new PlaybookActorSheet();
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
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an already-picked part", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] } ] } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(WARDING.key);

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentPartAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentPartRemove", () => {
	it("removes the matching part, leaving other Ardents untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "ar2", parts: [ARTIFACT.key] };
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [WARDING.key] }, other] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.ardents": [{ id: "ar1", parts: [] }, other] });
	});

	it("does nothing for a part that isn't installed", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1" }] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "ar1", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		sheet._onArdentPartRemove({ currentTarget: { dataset: { ardentId: "nope", part: WARDING.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onArdentWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with ardentWeapon, then saves flagged for this Ardent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Spear", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(chooseAstirWeapon).toHaveBeenCalledWith(ardentWeapons(), { title: "Pick an Ardent Weapon" });
		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { ardentWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], ardent: "ar1", name: "Spear", description: "", kind: "weapon", tags: ["melee"] }
			]
		});
	});

	it("refuses once the combined loadout is already at ARDENT_MAX_LOADOUT", async () => {
		const sheet = new PlaybookActorSheet();
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
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [{ id: "ar1", parts: [] }], equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "x", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "ar1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown Ardent id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { ardents: [] } }, update: vi.fn() };

		await sheet._onArdentWeaponAdd({ currentTarget: { dataset: { ardentId: "nope" } } });

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onEquipmentEdit - Ardent weapons", () => {
	it("reopens an Ardent weapon with the ardentWeapon option and carries the ardent flag forward", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: ["melee"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Spear II", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { ardentWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Spear II", description: "", kind: "weapon", tags: ["melee"], ardent: "ar1" }
			]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentRemove - Ardent weapons", () => {
	it("removes an Ardent weapon without touching Astir Power", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "1", kind: "weapon", ardent: "ar1" };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("PlaybookActorSheet#_onMoveRoll - Ardent weapon choice", () => {
	it("offers only the mounted Ardent's own weapons, excluding the Astir's and other Ardents'", async () => {
		const sheet = new PlaybookActorSheet();
		const mine = { id: "eq1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] };
		const otherArdent = { id: "eq2", kind: "weapon", ardent: "ar2", name: "Axe", description: "", tags: [], spent: [] };
		const astirWeapon = { id: "eq3", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] };
		const mundane = { id: "eq4", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", piloted: false },
					ardents: [{ id: "ar1", piloted: true }, { id: "ar2", piloted: false }],
					equipment: [mine, otherArdent, astirWeapon, mundane]
				}
			}
		};
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([mine]);
	});
});

describe("PlaybookActorSheet#_moveTraits - Input Channel from a mounted Ardent", () => {
	it("offers +CHANNEL when Input Channel is installed on the mounted Ardent", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 1 }, channel: { value: 2, disabled: true } },
				attributes: { ardents: [{ id: "ar1", parts: [INPUT_CHANNEL.key], piloted: true }] }
			}
		};

		expect(sheet._moveTraits({ traits: ["clash"] })).toEqual([
			{ key: "clash", label: "CLASH", value: 1 },
			{ key: "channel", label: "CHANNEL", value: 2 }
		]);
	});
});

describe("PlaybookActorSheet#_onMoveRoll - astir part spends from a mounted Ardent", () => {
	it("offers an Ardent-installed part's spend when it's the mounted frame", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: { ardents: [{ id: "ar1", parts: [ARTIFACT.key], piloted: true }] }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null, lockedAdvantage: null, lockedTrait: null,
			astirPartSpends: [{
				partKey: ARTIFACT.key, partName: "Artifact", description: ARTIFACT.spend.description,
				effect: null, advantage: "advantage", disabled: false
			}],
			equipmentSpends: []
		});
	});
});
