import { describe, expect, it, vi } from "vitest";

import { PLAYBOOKS } from "../scripts/actor-creation.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

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

	it("keeps starting gear available when the actor only has an Astir weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Astir Blade", description: "", tags: [], spent: [], astir: true }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: true });
	});

	it("keeps starting gear available when the actor only has an Ardent weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Ardent Weapon", description: "", tags: [], spent: [], ardent: "some-id" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: true });
	});

	it("hides starting gear when plain equipment coexists with an Astir weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { name: "The Scout" },
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Astir Blade", description: "", tags: [], spent: [], astir: true },
						{ id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }
					]
				}
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
				commanderFeature: false,
				extra: false,
				disabled: false
			}
		]);
	});

	it("surfaces the extra flag on an Astir weapon entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], piloted: true },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, extra: true, name: "Spare Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		expect(sheet.getData().equipment.astirWeapons[0].extra).toBe(true);
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

	it("hides an Astir weapon from the Equipment tab while the Astir isn't piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", tier: 3, parts: [] },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		expect(sheet.getData().equipment.astirWeapons).toEqual([]);
	});

	it("surfaces an Astir weapon on the Equipment tab once the Astir is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], piloted: true },
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		expect(sheet.getData().equipment.astirWeapons.map((w) => w.id)).toEqual(["1"]);
	});

	it("hides an Ardent's weapon from the Equipment tab while that Ardent isn't piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", tier: 2, parts: [] }],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		expect(sheet.getData().equipment.ardentWeapons).toEqual([]);
	});

	it("surfaces an Ardent's weapon on the Equipment tab once that Ardent is piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					ardents: [{ id: "ar1", tier: 2, parts: [], piloted: true }],
					equipment: [
						{ id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		expect(sheet.getData().equipment.ardentWeapons.map((w) => w.id)).toEqual(["1"]);
	});

	it("mounting one frame hides another frame's weapons from the Equipment tab, in both directions", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					astir: { id: "a1", tier: 3, parts: [], piloted: true },
					ardents: [{ id: "ar1", tier: 2, parts: [], piloted: false }],
					equipment: [
						{ id: "1", kind: "weapon", astir: true, name: "Lance", description: "", tags: [], spent: [] },
						{ id: "2", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const astirMountedData = sheet.getData();

		expect(astirMountedData.equipment.astirWeapons.map((w) => w.id)).toEqual(["1"]);
		expect(astirMountedData.equipment.ardentWeapons).toEqual([]);

		sheet.actor.system.attributes.astir.piloted = false;
		sheet.actor.system.attributes.ardents[0].piloted = true;

		const ardentMountedData = sheet.getData();

		expect(ardentMountedData.equipment.astirWeapons).toEqual([]);
		expect(ardentMountedData.equipment.ardentWeapons.map((w) => w.id)).toEqual(["2"]);
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
		expect(html.find).toHaveBeenCalledWith(".equipment-disabled-checkbox");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});
