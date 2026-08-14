import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the picker dialogs are mocked — the catalogs and helpers stay real, so the sheet is
// exercised against the actual Astir Part/Move/Weapon content.
vi.mock("../scripts/frames/astir.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseAstirPart: vi.fn(),
	chooseAstirMove: vi.fn(),
	chooseAstirWeapon: vi.fn()
}));

// Only the editor dialog is mocked — the tag catalog and resolve helpers stay real, same
// reasoning as astir.js above.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

import { configureEquipment } from "../scripts/equipment/equipment.js";
import {
	ASTIR_PART_CATALOG,
	ASTIR_TIER_MIN,
	astirMaxPower,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon
} from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";
import { ALCHEMICAL_SUITE } from "./helpers/move-fixtures.js";

beforeEach(() => {
	chooseAstirPart.mockClear();
	chooseAstirMove.mockClear();
	chooseAstirWeapon.mockClear();
	configureEquipment.mockClear();
	ui.notifications.warn.mockClear();
});

describe("PlaybookActorSheet#_onAstirPartAdd", () => {
	it("adds the chosen part and re-clamps power to the new maximum", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not lower power below what it already is, only clamps if it now exceeds the max", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats missing parts and power as empty/zero", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirPartAdd();

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("warns and refuses to open the picker once the Astir already has ASTIR_MAX_PARTS parts", async () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [partA.key, partB.key] } } },
			update: vi.fn()
		};

		await sheet._onAstirPartAdd();

		expect(ui.notifications.warn).toHaveBeenCalled();
		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("accounts for existing Astir weapon Drain when re-clamping power", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const weapon = { id: "w1", kind: "weapon", astir: true, tags: ["drain-2"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey], [weapon]),
			"system.attributes.astir.weaponPower": 0
		});
	});
});

describe("PlaybookActorSheet#_onAstirPartRemove", () => {
	it("removes the matching part and re-clamps power to the new (higher) maximum", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 0, parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the key doesn't match any current part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:not-there" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing parts array as having none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4 } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing power value as 0 once the part is removed", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [partKey] } } }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("un-pilots with a warning when removing a Power-granting part leaves Power negative under existing Drain", () => {
		const sheet = new PlaybookActorSheet();
		const conduitKey = "astir-part:weapon-conduit";
		const weapons = [
			{ id: "w1", kind: "weapon", astir: true, tags: ["drain-3"] },
			{ id: "w2", kind: "weapon", astir: true, tags: ["drain-3"] }
		];
		sheet.actor = {
			system: {
				attributes: { astir: { id: "a1", power: 4, piloted: true, parts: [conduitKey] }, equipment: weapons }
			},
			update: vi.fn()
		};

		sheet._onAstirPartRemove({ currentTarget: { dataset: { part: conduitKey } } });

		// Removing Weapon Conduit drops the Weapon Power pool (2) that was absorbing part of the
		// 6 total Drain, so all of it now spills onto main Power: max = ASTIR_POWER_BASE (4) - 6.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.parts": [],
			"system.attributes.astir.power": astirMaxPower([], weapons),
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(astirMaxPower([], weapons)).toBeLessThan(0);
		expect(ui.notifications.warn).toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirMoveAdd", () => {
	it("sets the chosen move, passing the actor's playbookMoves and the current Astir move (if any) as already-selected", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: {
					astir: { id: "a1", move: "cantrips:deny" },
					playbookMoves: ["the-scout:field-scout"]
				}
			},
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("astir:placeholder-move");

		await sheet._onAstirMoveAdd();

		// Both the actor's regular playbookMoves and the Astir's own current move end up in the
		// combined already-selected array — this is what closes the exclusiveGroup bypass (Field
		// Scout/Giant Slayer, Earthly Ally/Titanic) since both pickers draw from the same pool.
		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", ["the-scout:field-scout", "cantrips:deny"], undefined, undefined, []);
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": "astir:placeholder-move" });
	});

	it("passes just the actor's playbookMoves when no Astir move is picked yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: { astir: { id: "a1", move: null }, playbookMoves: ["the-scout:field-scout"] }
			},
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("cantrips:deny");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", ["the-scout:field-scout"], undefined, undefined, []);
	});

	it("passes an empty already-selected array when the actor has no playbookMoves and no Astir move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { astir: { id: "a1", move: null } } },
			update: vi.fn()
		};
		chooseAstirMove.mockResolvedValue("cantrips:deny");

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).toHaveBeenCalledWith("The Scout", [], undefined, undefined, []);
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: null } } }, update: vi.fn() };
		chooseAstirMove.mockResolvedValue(null);

		await sheet._onAstirMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("skips the picker and forces eidolon drive for the Summoner, whose Astir Move isn't a free pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Summoner" }, attributes: { astir: { id: "a1", move: null } } },
			update: vi.fn()
		};

		await sheet._onAstirMoveAdd();

		expect(chooseAstirMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": "the-summoner:eidolon-drive" });
	});
});

describe("PlaybookActorSheet#_onAstirMoveRemove", () => {
	it("clears the move", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", move: "cantrips:deny" } } }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.astir.move": null });
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirMoveRemove();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with astirWeapon and lockTags, then saves the result flagged astir: true, catalogSource: true", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { astirWeapon: true, lockTags: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], astir: true, catalogSource: true, name: "Lance", description: "", kind: "weapon",
					tags: ["melee"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the added weapon carries Drain, and un-pilots with a warning if it goes negative", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "e1", kind: "weapon", astir: true, tags: ["drain-3"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, piloted: true, parts: [] }, equipment: [existing] } },
			update: vi.fn()
		};
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["drain-2"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirWeaponAdd();

		// Total Drain (drain-3 existing + drain-2 new) is 5, with no Weapon Power pool to absorb any
		// of it: max Power = ASTIR_POWER_BASE (4) - 5 = -1.
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{
					id: "test-id", spent: [], astir: true, catalogSource: true, name: "Lance", description: "", kind: "weapon",
					tags: ["drain-2"]
				}
			],
			"system.attributes.astir.power": -1,
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("carries familiar: true onto the saved entry when the picked template is a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "wisp-familiar", name: "Wisp Familiar", description: "", tags: ["ranged"], familiar: true };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					astir: true,
					catalogSource: true,
					familiar: true,
					name: "Wisp Familiar",
					description: "",
					kind: "weapon",
					tags: ["ranged"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does not set familiar on the saved entry when the picked template isn't a Familiar", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "astir-fists", name: "Astir Fists", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Astir Fists", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], astir: true, catalogSource: true, name: "Astir Fists", description: "",
					kind: "weapon", tags: ["melee"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "placeholder-astir-weapon", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirWeaponCustomAdd", () => {
	it("skips the catalog step, opening configureEquipment directly with astirWeapon and maxTagValue: 0, saving catalogSource: false", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Custom Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirWeaponCustomAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { astirWeapon: true, maxTagValue: 0 });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], astir: true, catalogSource: false, name: "Custom Lance", description: "",
					kind: "weapon", tags: ["melee"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the custom weapon carries Drain, and un-pilots with a warning if it goes negative", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "e1", kind: "weapon", astir: true, tags: ["drain-3"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, piloted: true, parts: [] }, equipment: [existing] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Custom Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirWeaponCustomAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{
					id: "test-id", spent: [], astir: true, catalogSource: false, name: "Custom Lance", description: "",
					kind: "weapon", tags: ["drain-2"]
				}
			],
			"system.attributes.astir.power": -1,
			"system.attributes.astir.weaponPower": 0,
			"system.attributes.astir.piloted": false
		});
		expect(ui.notifications.warn).toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirWeaponCustomAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirWeaponCustomAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_astirPartKeys", () => {
	it("returns the regular parts when there are no extraParts", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", parts: [partKey] } } } };

		expect(sheet._astirPartKeys()).toEqual([partKey]);
	});

	it("unions regular parts and extraParts", () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", parts: [partA.key], extraParts: [partB.key] } } }
		};

		expect(sheet._astirPartKeys()).toEqual([partA.key, partB.key]);
	});

	it("treats a missing astir as empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._astirPartKeys()).toEqual([]);
	});

	it("accepts an explicit astir override rather than reading from the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };
		const partKey = ASTIR_PART_CATALOG[0].key;

		expect(sheet._astirPartKeys({ parts: [partKey] })).toEqual([partKey]);
	});
});

describe("PlaybookActorSheet#_onAstirExtraPartAdd", () => {
	it("adds the chosen part to extraParts and re-clamps power to the new maximum", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [], extraParts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirExtraPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.extraParts": [partKey],
			"system.attributes.astir.power": astirMaxPower([partKey]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("excludes both regular and already-installed extra parts from the picker", async () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [partA.key], extraParts: [partB.key] } } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirExtraPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([partA.key, partB.key]);
	});

	it("recomputes power against the combined regular+extra loadout, not just the new extraParts", async () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [partA.key], extraParts: [] } } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(partB.key);

		await sheet._onAstirExtraPartAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.extraParts": [partB.key],
			"system.attributes.astir.power": astirMaxPower([partA.key, partB.key]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, parts: [] } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(null);

		await sheet._onAstirExtraPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an already-picked extra part", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [], extraParts: [partKey] } } },
			update: vi.fn()
		};
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirExtraPartAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats missing parts and extraParts as empty", async () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = { system: { attributes: { astir: { id: "a1" } } }, update: vi.fn() };
		chooseAstirPart.mockResolvedValue(partKey);

		await sheet._onAstirExtraPartAdd();

		expect(chooseAstirPart).toHaveBeenCalledWith([]);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.extraParts": [partKey],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirExtraPartAdd();

		expect(chooseAstirPart).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirExtraPartRemove", () => {
	it("removes the matching extra part and re-clamps power, leaving regular parts untouched", () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 0, parts: [partA.key], extraParts: [partB.key] } } },
			update: vi.fn()
		};

		sheet._onAstirExtraPartRemove({ currentTarget: { dataset: { part: partB.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.extraParts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the key doesn't match any current extra part", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4, extraParts: [] } } }, update: vi.fn() };

		sheet._onAstirExtraPartRemove({ currentTarget: { dataset: { part: "astir-part:not-there" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing regular parts array as empty when recomputing power", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 0, extraParts: [partKey] } } },
			update: vi.fn()
		};

		sheet._onAstirExtraPartRemove({ currentTarget: { dataset: { part: partKey } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.astir.extraParts": [],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("treats a missing extraParts array as having none", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1", power: 4 } } }, update: vi.fn() };

		sheet._onAstirExtraPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAstirExtraPartRemove({ currentTarget: { dataset: { part: "astir-part:placeholder-part" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirExtraWeaponAdd", () => {
	it("chains the catalog picker into configureEquipment with astirWeapon, then saves the result flagged astir: true and extra: true", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["melee"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirExtraWeaponAdd();

		expect(configureEquipment).toHaveBeenCalledWith(template, undefined, { astirWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, extra: true, name: "Lance", description: "", kind: "weapon", tags: ["melee"] }
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the added weapon carries Drain, same as a regular Astir weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [] } },
			update: vi.fn()
		};
		const template = { key: "placeholder-astir-weapon", name: "Placeholder Astir Weapon", description: "", tags: ["drain-2"] };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirExtraWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], astir: true, extra: true, name: "Lance", description: "", kind: "weapon", tags: ["drain-2"] }
			],
			"system.attributes.astir.power": 2,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("carries familiar: true onto the saved entry when the picked Extra Weapon template is a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		const template = { key: "wisp-familiar", name: "Wisp Familiar", description: "", tags: ["ranged"], familiar: true };
		chooseAstirWeapon.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onAstirExtraWeaponAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					astir: true,
					extra: true,
					familiar: true,
					name: "Wisp Familiar",
					description: "",
					kind: "weapon",
					tags: ["ranged"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the catalog picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue(null);

		await sheet._onAstirExtraWeaponAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		chooseAstirWeapon.mockResolvedValue({ key: "placeholder-astir-weapon", name: "x", description: "", tags: [] });
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirExtraWeaponAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirExtraWeaponAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onAstirExtraWeaponCustomAdd", () => {
	it("skips the catalog step, opening configureEquipment directly with astirWeapon and maxTagValue: 0, saving extra: true and catalogSource: false", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Spare Lance", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onAstirExtraWeaponCustomAdd();

		expect(chooseAstirWeapon).not.toHaveBeenCalled();
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { astirWeapon: true, maxTagValue: 0 });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], astir: true, extra: true, catalogSource: false, name: "Spare Lance", description: "",
					kind: "weapon", tags: ["melee"]
				}
			],
			"system.attributes.astir.power": 0,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("lowers Power when the custom Extra Weapon carries Drain, same as a regular custom Astir weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Spare Lance", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onAstirExtraWeaponCustomAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id", spent: [], astir: true, extra: true, catalogSource: false, name: "Spare Lance", description: "",
					kind: "weapon", tags: ["drain-2"]
				}
			],
			"system.attributes.astir.power": 2,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("does nothing when the editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { id: "a1" }, equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onAstirExtraWeaponCustomAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when there is no Astir", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onAstirExtraWeaponCustomAdd();

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - astir extraParts/extraWeapons", () => {
	it("resolves extraParts separately from parts, with the same per-item shape", () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [partA.key], extraParts: [partB.key], move: null }
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.parts).toEqual([
			{ key: partA.key, name: partA.name, powerCost: partA.powerCost, partType: partA.partType, tier: 3, disabled: false }
		]);
		expect(data.astir.extraParts).toEqual([
			{ key: partB.key, name: partB.name, powerCost: partB.powerCost, partType: partB.partType, tier: 3, disabled: false }
		]);
	});

	it("flags partsFull once the regular Parts pool reaches ASTIR_MAX_PARTS, ignoring extraParts", () => {
		const sheet = new PlaybookActorSheet();
		const [partA, partB] = ASTIR_PART_CATALOG;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [partA.key, partB.key], extraParts: [], move: null }
				}
			}
		};

		expect(sheet.getData().astir.partsFull).toBe(true);
	});

	it("leaves partsFull false while the regular Parts pool is under ASTIR_MAX_PARTS", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [partKey], move: null }
				}
			}
		};

		expect(sheet.getData().astir.partsFull).toBe(false);
	});

	it("defaults an extraPart's tier to ASTIR_TIER_MIN when the Astir has none set", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", power: 4, parts: [], extraParts: [partKey], move: null }
				}
			}
		};

		expect(sheet.getData().astir.extraParts[0].tier).toBe(ASTIR_TIER_MIN);
	});

	it("splits astir.weapons/astir.extraWeapons by the extra flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [], move: null },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", astir: true, extra: true, name: "Spare Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.astir.extraWeapons.map((w) => w.id)).toEqual(["2"]);
	});

	it("counts an Extra Part's Power cost and an Extra Weapon's Drain toward Power max, same as the regular loadout", () => {
		const sheet = new PlaybookActorSheet();
		const partKey = ASTIR_PART_CATALOG[0].key;
		const equipment = [
			{ id: "1", kind: "weapon", astir: true, extra: true, tags: ["drain-1"], name: "x", description: "", spent: [] }
		];
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [], extraParts: [partKey], move: null },
					equipment
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.power.max).toBe(astirMaxPower([partKey], equipment));
	});

	it("triggers the Potions gate from an Extra Part, same as a regular one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					astir: { id: "a1", tier: 3, power: 4, parts: [], extraParts: [ALCHEMICAL_SUITE.key], move: null }
				}
			}
		};

		expect(sheet.getData().astir.potions).toEqual({ red: 0, blue: 0, yellow: 0 });
	});
});
