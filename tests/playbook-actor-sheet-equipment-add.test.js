import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the editor and catalog picker dialogs are mocked — the tag catalog, item catalog, and
// resolve helpers stay real, so the sheet is exercised against the actual Blitz/placeholder
// content.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseEquipmentCatalogItem: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions stay real, same reasoning as
// equipment.js above. findStartingGearPool is wrapped (not replaced) rather than left untouched:
// it delegates to the real implementation by default, so every existing test is unaffected, but
// the one _onStartingGearAdd test covering DEFAULT_CUSTOM_WEAPON_MAX_VALUE's fallback branch
// needs a pool shaped like The Scout's but without customWeaponMaxValue, which no real
// STARTING_GEAR_POOLS entry provides (The Scout is the only pool with a customWeaponNote at all,
// and it always sets its own cap).
vi.mock("../scripts/equipment/starting-gear.js", async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		chooseStartingGear: vi.fn(),
		findStartingGearPool: vi.fn(actual.findStartingGearPool)
	};
});

import { chooseEquipmentCatalogItem, configureEquipment } from "../scripts/equipment/equipment.js";
import {
	CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
	DEFAULT_CUSTOM_WEAPON_MAX_VALUE,
	STARTING_GEAR_POOLS,
	chooseStartingGear,
	findStartingGearPool
} from "../scripts/equipment/starting-gear.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	configureEquipment.mockClear();
	chooseEquipmentCatalogItem.mockClear();
	chooseStartingGear.mockClear();
});

describe("PlaybookActorSheet#_onEquipmentAdd", () => {
	it("appends a new entry, generating its id and starting spent empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rope", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], name: "Rope", description: "", kind: "gear", tags: [] }
			]
		});
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onEquipmentCatalogAdd", () => {
	const template = { name: "Halberd", description: "A long blade.", kind: "weapon", tags: [], scale: "foot", tier: 2 };

	it("opens the catalog picker for the clicked section's kind, then the editor pre-filled with the pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ ...template, name: "Halberd (renamed)" });

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(chooseEquipmentCatalogItem).toHaveBeenCalledWith("weapon");
		expect(configureEquipment).toHaveBeenCalledWith(template);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...template, name: "Halberd (renamed)" }]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(template);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [existing, { id: "test-id", spent: [], ...template }]
		});
	});

	it("does not open the editor, and does not update the actor, when the catalog picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the pre-filled editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onStartingGearAdd", () => {
	const scoutPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");
	const scoutItems = scoutPool.groups.flatMap((group) => group.items);
	const [firstItem, secondItem] = scoutItems;
	const weaponResult = { name: "Custom Blade", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 };

	it("does nothing for a playbook with no starting gear pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not a Real Playbook" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a playbook with no pool at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not A Real Playbook" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the gear picker, then the custom weapon editor with the pool's guidance note", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).toHaveBeenCalledWith("The Scout");
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, {
			note: scoutPool.customWeaponNote,
			excludedTagKeys: CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
			maxTagValue: 2
		});
	});

	it("falls back to DEFAULT_CUSTOM_WEAPON_MAX_VALUE for a pool with a customWeaponNote but no customWeaponMaxValue of its own", async () => {
		// No real STARTING_GEAR_POOLS entry has a customWeaponNote without also setting its own
		// customWeaponMaxValue (The Scout is the only one with a note at all) — findStartingGearPool
		// is overridden just this once (see its vi.mock comment above) to exercise that fallback.
		const { customWeaponMaxValue, ...poolWithoutCap } = scoutPool;
		findStartingGearPool.mockReturnValueOnce(poolWithoutCap);
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, {
			note: scoutPool.customWeaponNote,
			excludedTagKeys: CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
			maxTagValue: DEFAULT_CUSTOM_WEAPON_MAX_VALUE
		});
	});

	it("appends picked pool items as new gear entries when the weapon editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem, secondItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], kind: "gear", name: secondItem.name, description: secondItem.description, tags: [] }
			]
		});
	});

	it("carries a picked item's own tags onto the new gear entry, e.g. Blades & Bracers' ward", async () => {
		const bladesAndBracers = scoutItems.find((item) => item.key === "the-scout:blades-and-bracers");
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([bladesAndBracers]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "test-id",
					spent: [],
					kind: "gear",
					name: bladesAndBracers.name,
					description: bladesAndBracers.description,
					tags: ["ward"]
				}
			]
		});
	});

	it("appends the custom weapon when the gear picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...weaponResult }]
		});
	});

	it("appends both the picked gear and the custom weapon in a single update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], ...weaponResult }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] }
			]
		});
	});

	it("does nothing, leaving the button available to retry, when both dialogs are cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	describe("granted items and weapon-kind items (The Impostor)", () => {
		const impostorPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Impostor");
		const impostorItems = impostorPool.groups.flatMap((group) => group.items);
		const augmentsI = impostorPool.grantedItems.find((item) => item.key === "the-impostor:augments-i");
		const powerFocusI = impostorItems.find((item) => item.key === "the-impostor:power-focus-i");
		const shieldBroachI = impostorItems.find((item) => item.key === "the-impostor:shield-broach-i");

		it("adds Augments I unconditionally, as a foot-scale weapon with no stored tier", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([]);

			await sheet._onStartingGearAdd();

			expect(chooseStartingGear).toHaveBeenCalledWith("The Impostor");
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [{
					id: "test-id",
					spent: [],
					kind: "weapon",
					name: augmentsI.name,
					description: augmentsI.description,
					tags: augmentsI.tags,
					scale: "foot"
				}]
			});
		});

		it("still adds Augments I even if the gear picker is cancelled", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue(null);

			await sheet._onStartingGearAdd();

			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [expect.objectContaining({ name: "Augments" })]
			});
		});

		it("saves a picked weapon-kind item (Power Focus I) with its own scale default and no stored tier", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([powerFocusI]);

			await sheet._onStartingGearAdd();

			const equipment = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
			expect(equipment.find((e) => e.name === "Power Focus")).toEqual({
				id: "test-id",
				spent: [],
				kind: "weapon",
				name: powerFocusI.name,
				description: powerFocusI.description,
				tags: powerFocusI.tags,
				scale: "foot"
			});
		});

		it("saves a picked gear-kind item (Shield Broach I) with no scale/tier at all", async () => {
			const sheet = new PlaybookActorSheet();
			sheet.actor = { system: { playbook: { name: "The Impostor" }, attributes: { equipment: [] } }, update: vi.fn() };
			chooseStartingGear.mockResolvedValue([shieldBroachI]);

			await sheet._onStartingGearAdd();

			const equipment = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
			expect(equipment.find((e) => e.name === "Shield Broach I")).toEqual({
				id: "test-id",
				spent: [],
				kind: "gear",
				name: shieldBroachI.name,
				description: shieldBroachI.description,
				tags: shieldBroachI.tags
			});
		});
	});

	it("carries a picked item's bonusDowntimeTokens flag through the starting-gear snapshot (Artificers)", async () => {
		const attendantPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Attendant");
		const artificers = attendantPool.groups.flatMap((group) => group.items).find((item) => item.key === "the-attendant:artificers");
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Attendant" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([artificers]);

		await sheet._onStartingGearAdd();

		const equipment = sheet.actor.update.mock.calls[0][0]["system.attributes.equipment"];
		expect(equipment.find((e) => e.name === "Artificers")).toEqual({
			id: "test-id",
			spent: [],
			kind: "gear",
			name: artificers.name,
			description: artificers.description,
			tags: [],
			bonusDowntimeTokens: artificers.bonusDowntimeTokens
		});
	});
});
