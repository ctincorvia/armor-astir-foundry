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

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { chooseEquipmentCatalogItem, configureEquipment } from "../scripts/equipment/equipment.js";
import {
	CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
	DEFAULT_CUSTOM_WEAPON_MAX_VALUE,
	STARTING_GEAR_POOLS,
	chooseStartingGear,
	findStartingGearPool
} from "../scripts/equipment/starting-gear.js";
import { astirMaxPower } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	configureEquipment.mockClear();
	chooseEquipmentCatalogItem.mockClear();
	chooseStartingGear.mockClear();
});

describe("PlaybookActorSheet#getData - equipment", () => {
	it("defaults to empty weapons/gear lists when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment).toEqual({
			weapons: [],
			astirWeapons: [],
			ardentWeapons: [],
			gear: [],
			startingGear: { available: false }
		});
	});

	it("makes starting gear available for a playbook whose pool has items or a custom weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: true });
	});

	it("hides starting gear for a playbook with no pool at all", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not A Real Playbook" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("hides starting gear while the actor already has equipment, even if the pool still has content", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: { equipment: [{ id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }] }
			}
		};

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("partitions equipment into weapons and gear by kind", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 2 },
						{ id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.equipment.gear.map((g) => g.id)).toEqual(["2"]);
	});

	it("resolves a weapon's tags, value, scale label, and the wielding character's own tier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{
							id: "1",
							kind: "weapon",
							name: "Halberd",
							description: "A long blade.",
							tags: ["blitz"],
							spent: [],
							scale: "astir"
						}
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons).toEqual([
			{
				id: "1",
				kind: "weapon",
				name: "Halberd",
				description: "A long blade.",
				tags: [
					{
						key: "blitz",
						label: "Blitz",
						value: 1,
						showValue: true,
						description: "You may spend this tag once per Scene to make a move with confidence.",
						spendable: true,
						spent: false
					}
				],
				value: 1,
				scale: "astir",
				scaleLabel: "Astir Scale",
				// Not an astir/ardent-flagged entry, so tier derives from _conflictTier().base — the
				// character's own on-foot Tier, CHARACTER_TIER_DEFAULT (1) here since no playbook move
				// raises it and no frame is mounted.
				tier: 1,
				weaponMoves: [
					{ key: "exchange-blows", name: "Exchange Blows", gated: false, tooltip: null },
					{ key: "strike-decisively", name: "Strike Decisively", gated: false, tooltip: null }
				],
				isAstir: false,
				commanderFeature: false
			}
		]);
	});

	it("marks a forcesEffect-only tag (e.g. Unreliable) spendable, same as a player-opted spend", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spendable).toBe(true);
	});

	it("marks a reroll-only tag (e.g. Defensive) spendable, so a spent one can be cleared", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spendable).toBe(true);
	});

	it("marks a tag spent when its key is in the entry's spent array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spent).toBe(true);
	});

	it("omits scale, scaleLabel, and tier for gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0]).toEqual({
			id: "1",
			kind: "gear",
			name: "Rations",
			description: "",
			tags: [],
			value: 0
		});
	});

	it("falls back to the raw scale key when it doesn't match a known WEAPON_SCALES entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [{ id: "1", kind: "weapon", name: "Odd", description: "", tags: [], spent: [], scale: "orbital", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].scaleLabel).toBe("orbital");
	});

	it("treats a missing tags array as having no tags", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Odd", description: "", spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags).toEqual([]);
		expect(data.equipment.gear[0].value).toBe(0);
	});

	it("renders Versatile as two independent reroll rows, one per move it covers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags).toEqual([
			{
				key: "versatile:exchange-blows",
				label: "Versatile — Exchange Blows",
				value: 2,
				showValue: true,
				description: "This tag combines the effects of decisive and defensive.",
				spendable: true,
				spent: false
			},
			{
				key: "versatile:strike-decisively",
				label: "Versatile — Strike Decisively",
				value: 2,
				showValue: false,
				description: "This tag combines the effects of decisive and defensive.",
				spendable: true,
				spent: false
			}
		]);
	});

	it("marks only the spent Versatile move's own row as spent, leaving the other row available", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{
							id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"],
							spent: ["versatile:exchange-blows"], scale: "foot", tier: 1
						}
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags.map((t) => ({ key: t.key, spent: t.spent }))).toEqual([
			{ key: "versatile:exchange-blows", spent: true },
			{ key: "versatile:strike-decisively", spent: false }
		]);
	});

	it("still renders exactly one row each for single-move reroll tags (Decisive, Defensive)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["decisive", "defensive"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags.map((t) => ({ key: t.key, label: t.label, showValue: t.showValue }))).toEqual([
			{ key: "decisive", label: "Decisive", showValue: true },
			{ key: "defensive", label: "Defensive", showValue: true }
		]);
	});

	it("drops a tag key that no longer resolves in the catalog", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "gear", name: "Odd", description: "", tags: ["blitz", "stale-key"], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags.map((t) => t.key)).toEqual(["blitz"]);
		expect(data.equipment.gear[0].value).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - equipment", () => {
	it("binds handlers to the add, catalog add, edit, remove, and tag spent controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".equipment-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-catalog-add");
		expect(html.find).toHaveBeenCalledWith(".starting-gear-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-edit");
		expect(html.find).toHaveBeenCalledWith(".equipment-remove");
		expect(html.find).toHaveBeenCalledWith(".equipment-tag-spent-checkbox");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
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

describe("PlaybookActorSheet#_onEquipmentEdit", () => {
	it("replaces the matching entry wholesale, keeping only its id and spent array, leaving other entries untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: ["blitz"], name: "Rations", description: "", kind: "gear", tags: [] },
				other
			]
		});
	});

	it("reopens an Astir weapon with the astirWeapon option and carries the astir flag forward", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["melee"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Lance II", description: "", kind: "weapon", tags: ["melee"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { astirWeapon: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Lance II", description: "", kind: "weapon", tags: ["melee"], astir: true }
			]
		});
	});

	it("carries the familiar flag forward on a Familiar weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, familiar: true, name: "Wisp Familiar", description: "", tags: ["ranged"], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Wisp Familiar", description: "", kind: "weapon", tags: ["ranged"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "1",
					spent: [],
					name: "Wisp Familiar",
					description: "",
					kind: "weapon",
					tags: ["ranged"],
					astir: true,
					familiar: true
				}
			]
		});
	});

	it("carries a bonusDowntimeTokens flag and its current value forward through an edit", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "gear",
			name: "Artificers",
			description: "",
			tags: [],
			spent: [],
			bonusDowntimeTokens: { max: 1, description: "Repairs, or magic or mechanical long-term projects." },
			bonusDowntimeTokensValue: 0
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Artificers", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "1",
					spent: [],
					name: "Artificers",
					description: "",
					kind: "gear",
					tags: [],
					bonusDowntimeTokens: entry.bonusDowntimeTokens,
					bonusDowntimeTokensValue: 0
				}
			]
		});
	});

	it("carries a bonusDowntimeTokens flag forward without a bonusDowntimeTokensValue when none was ever stepped", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1",
			kind: "gear",
			name: "Artificers",
			description: "",
			tags: [],
			spent: [],
			bonusDowntimeTokens: { max: 1, description: "Repairs, or magic or mechanical long-term projects." }
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Artificers", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{
					id: "1",
					spent: [],
					name: "Artificers",
					description: "",
					kind: "gear",
					tags: [],
					bonusDowntimeTokens: entry.bonusDowntimeTokens
				}
			]
		});
	});

	it("treats a missing spent array on the edited entry as empty", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Odd", description: "", tags: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "1", spent: [], name: "Rations", description: "", kind: "gear", tags: [] }]
		});
	});

	it("does nothing for an id that doesn't match any entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("recomputes Power when editing an Astir weapon's tags changes its Drain, with an Astir present", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: ["melee"], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, piloted: true, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Lance II", description: "", kind: "weapon", tags: ["drain-2"] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		const edited = { id: "1", spent: [], name: "Lance II", description: "", kind: "weapon", tags: ["drain-2"], astir: true };
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [edited],
			"system.attributes.astir.power": astirMaxPower([], [edited]),
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("leaves Power untouched when editing a mundane weapon even with an Astir present", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Sword", description: "", tags: ["melee"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [entry] } },
			update: vi.fn()
		};
		configureEquipment.mockResolvedValue({ name: "Sword+1", description: "", kind: "weapon", tags: ["drain-2"], scale: "foot", tier: 1 });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], name: "Sword+1", description: "", kind: "weapon", tags: ["drain-2"], scale: "foot", tier: 1 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentRemove", () => {
	it("removes the entry matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		const b = { id: "2", kind: "gear", name: "b", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a, b] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [b] });
	});

	it("leaves the list untouched when the id doesn't match any entry", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [a] });
	});

	it("recomputes Power (freeing it back up) when removing a Drain-tagged Astir weapon, with an Astir present", () => {
		const sheet = new PlaybookActorSheet();
		const weapon = { id: "1", kind: "weapon", astir: true, tags: ["drain-2"] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 1, parts: [] }, equipment: [weapon] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [],
			"system.attributes.astir.power": 1,
			"system.attributes.astir.weaponPower": 0
		});
	});

	it("leaves Power untouched when removing gear even with an Astir present", () => {
		const sheet = new PlaybookActorSheet();
		const gear = { id: "1", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { attributes: { astir: { id: "a1", power: 4, parts: [] }, equipment: [gear] } },
			update: vi.fn()
		};

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("PlaybookActorSheet#_onEquipmentTagSpentToggle", () => {
	it("adds the tag key to the entry's spent array when checked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("treats a missing spent array as empty when checking a tag", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not duplicate an already-spent tag key", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("removes the tag key from the entry's spent array when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: [] }]
		});
	});

	it("leaves entries that don't match the toggled id untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }, other]
		});
	});

	it("toggling one of Versatile's two compound-key rows leaves the other untouched", () => {
		const sheet = new PlaybookActorSheet();
		const entry = {
			id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"],
			spent: ["versatile:strike-decisively"], scale: "foot", tier: 1
		};
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({
			currentTarget: { dataset: { equipmentId: "1", tag: "versatile:exchange-blows" }, checked: true }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["versatile:strike-decisively", "versatile:exchange-blows"] }]
		});
	});
});

describe("PlaybookActorSheet#getData - weaponMoves", () => {
	it("lists exchange-blows and strike-decisively on every weapon entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false, tooltip: null }
		]);
	});

	it("gates weaponMoves the same way the Moves tab gates them", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0, disabled: true }, talk: { value: 0, disabled: true } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: null }
		]);
	});

	it("gates a mundane weapon's weaponMoves once the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "Personal weapons are disabled when mounted. Dismount to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "Personal weapons are disabled when mounted. Dismount to use this weapon." }
		]);
	});

	it("does not attach weaponMoves to gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].weaponMoves).toBeUndefined();
	});

	it("gates an Astir weapon's weaponMoves when the Astir isn't piloted, regardless of its own gating", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: false },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon." }
		]);
	});

	it("leaves an Astir weapon's weaponMoves gating to its own logic once piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					equipment: [
						{ id: "eq1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.astir.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false, tooltip: null },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false, tooltip: null }
		]);
	});

	it("explains cross-frame gating when an Ardent weapon is disabled because the Astir is piloted instead", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], move: null, piloted: true },
					ardents: [{ id: "ar1", tier: 3, parts: [], piloted: false }],
					equipment: [
						{ id: "eq1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.ardentWeapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true, tooltip: "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon." },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true, tooltip: "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon." }
		]);
	});
});
