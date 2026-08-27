import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the dialog is mocked — BASIC_MOVES/configureMoveRoll's real trait-building stays untouched
// elsewhere, same reasoning playbook-actor-sheet.test.js already uses for these modules.
vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	rollMove: vi.fn()
}));

vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn()
}));

import { BASIC_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../scripts/moves/moves.js";
import { TIER_MAX, configureEquipment, findEquipmentTag } from "../scripts/equipment/equipment.js";
import { QUARTERS_BENEFITS } from "../scripts/playbook/quarters.js";
import {
	CarrierActorSheet,
	CARRIER_SHEET_TEMPLATE,
	findCarrierActors,
	findAssignedPlaybookActors,
	chooseCarrier,
	registerCarrierActorSheet
} from "../scripts/world-actors/carrier-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");

beforeEach(() => {
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	rollMove.mockClear();
	configureEquipment.mockClear();
});

describe("CarrierActorSheet.defaultOptions", () => {
	it("merges the carrier sheet's classes/template onto the base world-actor options", () => {
		expect(CarrierActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "carrier"],
			template: CARRIER_SHEET_TEMPLATE,
			width: 640,
			scrollY: [".window-content"]
		});
	});
});

describe("CarrierActorSheet#_entryDefaults", () => {
	it("seeds a crew member with name/position/description", () => {
		const sheet = new CarrierActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", position: "", description: "" });
	});
});

describe("CarrierActorSheet#_weaponTagKeys", () => {
	it("unions the slot's locked tags into whatever the entry itself stores", () => {
		const sheet = new CarrierActorSheet();
		const slot = { key: "primary", lockedTagKeys: ["set-up", "mounted"] };

		expect(sheet._weaponTagKeys(slot, { tags: ["melee"] })).toEqual(["melee", "set-up", "mounted"]);
	});

	it("de-duplicates when the entry already stores a key that's also locked", () => {
		const sheet = new CarrierActorSheet();
		const slot = { key: "secondary", lockedTagKeys: ["mounted"] };

		expect(sheet._weaponTagKeys(slot, { tags: ["melee", "mounted"] })).toEqual(["melee", "mounted"]);
	});

	it("treats a missing tags array as empty, still carrying the locked tags", () => {
		const sheet = new CarrierActorSheet();
		const slot = { key: "secondary", lockedTagKeys: ["mounted"] };

		expect(sheet._weaponTagKeys(slot, {})).toEqual(["mounted"]);
	});
});

describe("CarrierActorSheet#getData", () => {
	it("reads crew, crewSupportHold, description, and crew members off the actor", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 2 } },
				details: { description: { value: "A sturdy old freighter." } },
				attributes: {
					crewMembers: [{ id: "1", name: "Vex", position: "Pilot", description: "" }],
					crewSupportHold: 3
				}
			}
		};

		const data = sheet.getData({});

		expect(data.crew).toBe(2);
		expect(data.crewSupportHold).toBe(3);
		expect(data.description).toBe("A sturdy old freighter.");
		expect(data.crewMembers).toEqual([{ id: "1", name: "Vex", position: "Pilot", description: "" }]);
	});

	it("defaults crew/crewSupportHold/description/crewMembers when unset", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.crew).toBe(0);
		expect(data.crewSupportHold).toBe(0);
		expect(data.description).toBe("");
		expect(data.crewMembers).toEqual([]);
	});

	it("builds both weapon slots, empty, when unset", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.weaponSlots).toEqual([
			{ key: "primary", label: "Tier V Weapon", entry: null },
			{ key: "secondary", label: "Tier III Weapon", entry: null }
		]);
	});

	it("builds a populated primary slot's entry, unioning its locked tags (set-up, mounted) into value/tags even though the entry itself never stored them, and forcing Tier to the slot's own", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					weapons: {
						primary: { id: "w1", name: "Ram Cannon", description: "A hull-mounted cannon.", kind: "weapon", tags: ["melee"], scale: "astir", tier: 1 },
						secondary: null
					}
				}
			}
		};

		const data = sheet.getData({});
		const primary = data.weaponSlots.find((slot) => slot.key === "primary").entry;

		expect(primary).toMatchObject({
			id: "w1",
			name: "Ram Cannon",
			description: "A hull-mounted cannon.",
			scaleLabel: "Astir Scale",
			// Forced to the slot's own Tier (TIER_MAX), not the (stale/bogus) tier: 1 stored on the entry.
			tier: TIER_MAX
		});
		const tagKeys = primary.tags.map((tag) => tag.key);
		expect(tagKeys).toEqual(expect.arrayContaining(["melee", "set-up", "mounted"]));
		// 0 (melee) + -1 (set-up) + 1 (mounted) = 0, proving the locked tags' values are folded
		// into the displayed total even though the player never picked them.
		expect(primary.value).toBe(0);
		// showValue: true so the shared equipment-card.hbs partial renders each tag's value inline.
		expect(primary.tags.every((tag) => tag.showValue === true)).toBe(true);
		expect(primary.weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows" },
			{ key: "strike-decisively", name: "Strike Decisively" }
		]);

		expect(data.weaponSlots.find((slot) => slot.key === "secondary").entry).toBeNull();
	});

	it("builds a populated secondary slot's entry with only Mounted locked in, at the slot's Tier III", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					weapons: { secondary: { id: "w2", name: "Boarding Claw", kind: "weapon", tags: ["melee"], scale: "astir" } }
				}
			}
		};

		const data = sheet.getData({});
		const secondary = data.weaponSlots.find((slot) => slot.key === "secondary").entry;

		expect(secondary.tier).toBe(3);
		expect(secondary.tags.map((tag) => tag.key)).toEqual(expect.arrayContaining(["melee", "mounted"]));
		expect(secondary.tags.map((tag) => tag.key)).not.toContain("set-up");
	});

	it("treats a missing tags array as carrying only the slot's locked tags, and falls back to the raw scale key if unrecognized", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { secondary: { id: "w1", name: "Ram Cannon", scale: "unknown-scale" } } } }
		};

		const data = sheet.getData({});
		const secondary = data.weaponSlots.find((slot) => slot.key === "secondary").entry;

		expect(secondary.tags.map((tag) => tag.key)).toEqual(["mounted"]);
		expect(secondary.value).toBe(1);
		expect(secondary.scaleLabel).toBe("unknown-scale");
	});

	it("marks each tag spendable/spent (mirroring equipment-mixin.js#_equipmentEntry), splitting a multi-move reroll tag (Versatile) into one row per move", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					weapons: {
						primary: {
							id: "w1", name: "Ram Cannon", description: "", kind: "weapon",
							tags: ["one-use", "versatile"], scale: "astir", spent: ["one-use"]
						},
						secondary: null
					}
				}
			}
		};

		const data = sheet.getData({});
		const tags = data.weaponSlots.find((slot) => slot.key === "primary").entry.tags;

		expect(tags.find((tag) => tag.key === "one-use")).toMatchObject({ spendable: true, spent: true });

		const versatileRows = tags.filter((tag) => tag.key.startsWith("versatile"));
		expect(versatileRows.map((tag) => tag.key)).toEqual(["versatile:exchange-blows", "versatile:strike-decisively"]);
		expect(versatileRows.map((tag) => tag.label)).toEqual(["Versatile — Exchange Blows", "Versatile — Strike Decisively"]);
		expect(versatileRows.map((tag) => tag.showValue)).toEqual([true, false]);
		expect(versatileRows.every((tag) => tag.spendable)).toBe(true);
		expect(versatileRows.every((tag) => tag.spent === false)).toBe(true);

		// A tag with no spend/forcesEffect/reroll (a slot-locked narrative tag here) is never spendable.
		expect(tags.find((tag) => tag.key === "set-up")).toMatchObject({ spendable: false, spent: false });
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
		expect(html.find).toHaveBeenCalledWith(".crew-support-hold-step");
		expect(html.find).toHaveBeenCalledWith(".weapon-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-edit");
		expect(html.find).toHaveBeenCalledWith(".equipment-remove");
		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
		expect(html.find).toHaveBeenCalledWith(".equipment-tag-spent-checkbox");
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

describe("CarrierActorSheet#_onCrewSupportHoldStep", () => {
	it("increments crewSupportHold by the clicked delta", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { crewSupportHold: 0 } }, update: vi.fn() };

		sheet._onCrewSupportHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.crewSupportHold": 1 });
	});

	it("clamps at the maximum (3)", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { crewSupportHold: 3 } }, update: vi.fn() };

		sheet._onCrewSupportHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum (0)", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { crewSupportHold: 0 } }, update: vi.fn() };

		sheet._onCrewSupportHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing crewSupportHold value as 0", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onCrewSupportHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.crewSupportHold": 1 });
	});
});

describe("CarrierActorSheet#_onWeaponAdd", () => {
	it("saves a new primary weapon, forcing kind/tier and passing the primary slot's tier/excluded tags/tag cap", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Ram Cannon", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: 1 });

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "primary" } } });

		expect(configureEquipment).toHaveBeenCalledWith(null, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: TIER_MAX,
			excludedTagKeys: ["set-up", "mounted", "two-handed"],
			maxTagValue: 2
		});
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons.primary": {
				id: "test-id", spent: [], name: "Ram Cannon", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: TIER_MAX
			}
		});
	});

	it("saves a new secondary weapon, passing the secondary slot's own tier/excluded tags/tag cap", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Boarding Claw", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: 1 });

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "secondary" } } });

		expect(configureEquipment).toHaveBeenCalledWith(null, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: 3,
			excludedTagKeys: ["mounted", "two-handed"],
			maxTagValue: 1
		});
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons.secondary": {
				id: "test-id", spent: [], name: "Boarding Claw", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: 3
			}
		});
	});

	it("does nothing once the targeted slot is already filled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1" } } } },
			update: vi.fn()
		};

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "primary" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a slot key that doesn't match any WEAPON_SLOTS entry", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "tertiary" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "primary" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("never passes allowOverride -- Override Max only ever reaches an existing weapon via Edit, never on first creation", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Ram Cannon", description: "", kind: "weapon", tags: ["melee"], scale: "astir", tier: 1 });

		await sheet._onWeaponAdd({ currentTarget: { dataset: { slot: "primary" } } });

		expect(configureEquipment.mock.calls.at(-1)[2]).not.toHaveProperty("allowOverride");
	});
});

describe("CarrierActorSheet#_onWeaponEdit", () => {
	it("saves over the matching slot, keeping its id/spent and forcing kind/tier", async () => {
		const sheet = new CarrierActorSheet();
		const existing = { id: "w1", spent: ["blitz"], name: "Old Name", kind: "weapon", tags: [], scale: "astir" };
		sheet.actor = { system: { attributes: { weapons: { primary: existing } } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: 1 });

		await sheet._onWeaponEdit({ currentTarget: { dataset: { equipmentId: "w1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(existing, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: TIER_MAX,
			excludedTagKeys: ["set-up", "mounted", "two-handed"],
			maxTagValue: 2,
			allowOverride: true
		});
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons.primary": {
				id: "w1", spent: ["blitz"], name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: TIER_MAX
			}
		});
	});

	it("treats a missing spent array as empty", async () => {
		const sheet = new CarrierActorSheet();
		const existing = { id: "w2", name: "Old Name", kind: "weapon", tags: [], scale: "astir" };
		sheet.actor = { system: { attributes: { weapons: { secondary: existing } } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: 1 });

		await sheet._onWeaponEdit({ currentTarget: { dataset: { equipmentId: "w2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons.secondary": {
				id: "w2", spent: [], name: "New Name", description: "", kind: "weapon", tags: [], scale: "astir", tier: 3
			}
		});
	});

	it("does nothing for an unknown id", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: { primary: { id: "w1" } } } }, update: vi.fn() };

		await sheet._onWeaponEdit({ currentTarget: { dataset: { equipmentId: "unknown" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: { primary: { id: "w1" } } } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onWeaponEdit({ currentTarget: { dataset: { equipmentId: "w1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("CarrierActorSheet#_onWeaponRemove", () => {
	it("sets the matching slot to null", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1" }, secondary: { id: "w2" } } } },
			update: vi.fn()
		};

		sheet._onWeaponRemove({ currentTarget: { dataset: { equipmentId: "w1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.weapons.primary": null });
	});

	it("does nothing for an unknown id", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1" }, secondary: { id: "w2" } } } },
			update: vi.fn()
		};

		sheet._onWeaponRemove({ currentTarget: { dataset: { equipmentId: "unknown" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("CarrierActorSheet#_onWeaponMoveRoll", () => {
	it("rolls +CREW with the clicked slot's weapon, offering the slot's locked tags as narrative tags and no spends/lockedEffect/guided/rerollTag", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 2 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: [], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 2 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		const call = configureMoveRoll.mock.calls.at(-1);
		expect(call[0]).toBe(EXCHANGE_BLOWS);
		expect(call[1]).toEqual([{ key: "crew", label: "CREW", value: 2 }]);
		expect(call[2].lockedEffect).toBeNull();
		expect(call[2].lockedEffectSource).toBeNull();
		expect(call[2].equipmentSpends).toEqual([]);
		// The primary slot's own locked tags (set-up, mounted — see WEAPON_SLOTS) are narrative,
		// so they're offered even though the entry itself never stored them.
		expect(call[2].narrativeTags.map((tag) => tag.tagKey)).toEqual(["set-up", "mounted"]);
		expect(call[2]).not.toHaveProperty("guided");
		expect(call[2]).not.toHaveProperty("rerollTag");

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			{ key: "crew", label: "CREW", value: 2 },
			expect.objectContaining({ weaponLabel: "Ram Cannon", narrativeTags: call[2].narrativeTags })
		);
	});

	it("works for strike-decisively too", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: [], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 0 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "w1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(STRIKE_DECISIVELY, expect.any(Array), expect.any(Object));
	});

	it("works for the secondary slot too, offering only Mounted (not Set-Up) as a locked narrative tag", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 1 } },
				attributes: { weapons: { secondary: { id: "w2", name: "Boarding Claw", tags: [], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 1 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w2" } } });

		const narrativeTags = configureMoveRoll.mock.calls.at(-1)[2].narrativeTags;
		expect(narrativeTags.map((tag) => tag.tagKey)).toEqual(["mounted"]);
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			{ key: "crew", label: "CREW", value: 1 },
			expect.objectContaining({ weaponLabel: "Boarding Claw" })
		);
	});

	it("does nothing when the dialog is cancelled", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: [], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an unknown id", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { stats: { crew: { value: 0 } }, attributes: { weapons: {} } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: { crew: { value: 0 } }, attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon" } } } }
		};

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", equipmentId: "w1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("treats a missing crew value as 0", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { stats: {}, attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: [], spent: [] } } } }
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(configureMoveRoll.mock.calls.at(-1)[1]).toEqual([{ key: "crew", label: "CREW", value: 0 }]);
	});

	it("shows a weapon's narrative-only tag (Impact) in narrativeTags", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["impact"], spent: [] } } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		const narrativeTags = configureMoveRoll.mock.calls.at(-1)[2].narrativeTags;
		expect(narrativeTags.map((tag) => tag.tagKey)).toEqual(expect.arrayContaining(["impact"]));
	});

	it("offers Blitz as an equipment spend, persists it via spendEquipmentTagsOnActor once checked, and carries the resulting effect into the roll", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: {
					weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["blitz"], spent: [] }, secondary: null }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({
			trait: { key: "crew", label: "CREW", value: 0 },
			effect: "confidence",
			spentTags: [{ equipmentId: "w1", tagKey: "blitz" }]
		});

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		const equipmentSpends = configureMoveRoll.mock.calls.at(-1)[2].equipmentSpends;
		expect(equipmentSpends.map((spend) => spend.tagKey)).toEqual(["blitz"]);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons": {
				primary: { id: "w1", name: "Ram Cannon", tags: ["blitz"], spent: ["blitz"] },
				secondary: null
			}
		});
		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			EXCHANGE_BLOWS,
			{ key: "crew", label: "CREW", value: 0 },
			expect.objectContaining({ effect: "confidence", weaponLabel: "Ram Cannon" })
		);
	});

	it("locks Effect to desperation for an unspent Unreliable tag, and marks it spent after the roll", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: {
					weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["unreliable"], spent: [] }, secondary: null }
				}
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 0 }, effect: "desperation" });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(configureMoveRoll.mock.calls.at(-1)[2].lockedEffect).toBe("desperation");
		expect(configureMoveRoll.mock.calls.at(-1)[2].lockedEffectSource).toBe("Unreliable");
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.weapons": {
				primary: { id: "w1", name: "Ram Cannon", tags: ["unreliable"], spent: ["unreliable"] },
				secondary: null
			}
		});
	});

	it("offers a rerollTag for a weapon carrying Decisive, scoped to the matching move", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["decisive"], spent: [] } } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "w1" } } });

		expect(configureMoveRoll.mock.calls.at(-1)[2].rerollTag).toEqual({
			tagLabel: "Decisive",
			description: findEquipmentTag("decisive").description
		});
	});

	it("omits rerollTag when the weapon's reroll tag doesn't cover the rolled move", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["decisive"], spent: [] } } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(configureMoveRoll.mock.calls.at(-1)[2]).not.toHaveProperty("rerollTag");
	});

	it("attaches a reroll option to the rollMove call for a weapon carrying a matching reroll tag", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["decisive"], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ trait: { key: "crew", label: "CREW", value: 0 } });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "w1" } } });

		expect(rollMove).toHaveBeenCalledWith(
			sheet.actor,
			STRIKE_DECISIVELY,
			{ key: "crew", label: "CREW", value: 0 },
			expect.objectContaining({ reroll: { equipmentId: "w1", tagKey: "decisive", spendKey: "decisive" } })
		);
	});

	it("offers guided for a weapon carrying the Guided tag", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["guided"], spent: [] } } }
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(configureMoveRoll.mock.calls.at(-1)[2].guided).toBe("Guided");
	});

	it("posts a Guided result instead of rolling when the dialog resolves takeSeven", async () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 0 } },
				attributes: { weapons: { primary: { id: "w1", name: "Ram Cannon", tags: ["guided"], spent: [] } } }
			},
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "w1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, {
			weaponLabel: "Ram Cannon",
			narrativeTags: expect.any(Array),
			guidedSource: "Guided"
		});
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("CarrierActorSheet#_onWeaponTagSpentToggle", () => {
	it("adds the tag key to the matching slot's spent array when checked", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1", spent: [] }, secondary: null } } },
			update: vi.fn()
		};

		sheet._onWeaponTagSpentToggle({ currentTarget: { dataset: { equipmentId: "w1", tag: "one-use" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.weapons.primary.spent": ["one-use"] });
	});

	it("removes the tag key from the matching slot's spent array when unchecked", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1", spent: ["one-use"] } } } },
			update: vi.fn()
		};

		sheet._onWeaponTagSpentToggle({ currentTarget: { dataset: { equipmentId: "w1", tag: "one-use" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.weapons.primary.spent": [] });
	});

	it("does nothing for an id that doesn't match any slot", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: { attributes: { weapons: {} } }, update: vi.fn() };

		sheet._onWeaponTagSpentToggle({ currentTarget: { dataset: { equipmentId: "unknown", tag: "one-use" }, checked: true } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing spent array as empty when checking a tag", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: { attributes: { weapons: { primary: { id: "w1" } } } },
			update: vi.fn()
		};

		sheet._onWeaponTagSpentToggle({ currentTarget: { dataset: { equipmentId: "w1", tag: "one-use" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.weapons.primary.spent": ["one-use"] });
	});
});

describe("findCarrierActors", () => {
	it("filters game.actors down to carrier-type actors", () => {
		const carrier = { id: "c1", type: "armor-astir.carrier" };
		game.actors.filter.mockImplementation((fn) => [carrier, { id: "other", type: "armor-astir.cause" }].filter(fn));

		expect(findCarrierActors()).toEqual([carrier]);
	});
});

describe("CarrierActorSheet#_quartersEntry", () => {
	it("falls back to empty name/description and an empty benefit list when Quarters is entirely unset", () => {
		const sheet = new CarrierActorSheet();
		const actor = { name: "Reyes", system: { attributes: {} } };

		expect(sheet._quartersEntry(actor)).toEqual({
			actorName: "Reyes",
			name: "",
			description: "",
			benefitLabels: []
		});
	});

	it("falls back to empty name/description when Quarters is stored with only a benefits field", () => {
		const sheet = new CarrierActorSheet();
		const actor = { name: "Reyes", system: { attributes: { quarters: { benefits: ["extra-token"] } } } };

		const entry = sheet._quartersEntry(actor);

		expect(entry.name).toBe("");
		expect(entry.description).toBe("");
		expect(entry.benefitLabels).toEqual([QUARTERS_BENEFITS[0].label]);
	});

	it("defaults benefitLabels to empty when Quarters is stored with only a name field", () => {
		const sheet = new CarrierActorSheet();
		const actor = { name: "Reyes", system: { attributes: { quarters: { name: "The Nook" } } } };

		expect(sheet._quartersEntry(actor).benefitLabels).toEqual([]);
	});
});

describe("findAssignedPlaybookActors", () => {
	const supportA = {
		id: "a1",
		type: "character",
		system: { playbook: { slug: "the-icon" }, attributes: { quarters: { name: "Nook" }, carrierId: "c1" } }
	};
	const supportB = {
		id: "a2",
		type: "character",
		system: { playbook: { slug: "the-scout" }, attributes: { quarters: { description: "desc" }, carrierId: "c2" } }
	};
	const nonSupport = {
		id: "a3",
		type: "character",
		system: { playbook: { slug: "the-witch" }, attributes: { quarters: { name: "x" } } }
	};
	const emptyQuarters = {
		id: "a4",
		type: "character",
		system: { playbook: { slug: "the-icon" }, attributes: {} }
	};
	const benefitsOnly = {
		id: "a5",
		type: "character",
		system: { playbook: { slug: "the-icon" }, attributes: { quarters: { benefits: ["extra-token"] } } }
	};
	const noPlaybook = { id: "a6", type: "character", system: { attributes: {} } };
	const carrier1 = { id: "c1", type: "armor-astir.carrier" };
	const carrier2 = { id: "c2", type: "armor-astir.carrier" };

	it("returns every Support actor with non-empty Quarters regardless of carrierId, with 0 Carriers in the world", () => {
		game.actors.filter.mockImplementation((fn) => [supportA, supportB, nonSupport, emptyQuarters].filter(fn));

		expect(findAssignedPlaybookActors("anything").map((a) => a.id)).toEqual(["a1", "a2"]);
	});

	it("returns every Support actor with non-empty Quarters regardless of carrierId, with exactly 1 Carrier", () => {
		game.actors.filter.mockImplementation((fn) => [carrier1, supportA, supportB, nonSupport, emptyQuarters].filter(fn));

		expect(findAssignedPlaybookActors("c1").map((a) => a.id)).toEqual(["a1", "a2"]);
	});

	it("filters strictly by carrierId match once there are 2+ Carriers", () => {
		game.actors.filter.mockImplementation((fn) => [carrier1, carrier2, supportA, supportB].filter(fn));

		expect(findAssignedPlaybookActors("c1").map((a) => a.id)).toEqual(["a1"]);
		expect(findAssignedPlaybookActors("c2").map((a) => a.id)).toEqual(["a2"]);
	});

	it("excludes non-Support playbook actors even with 2+ Carriers", () => {
		game.actors.filter.mockImplementation((fn) => [carrier1, carrier2, nonSupport].filter(fn));

		expect(findAssignedPlaybookActors("c1")).toEqual([]);
	});

	it("excludes Support actors with empty Quarters, both below and at/above 2 Carriers", () => {
		game.actors.filter.mockImplementation((fn) => [emptyQuarters].filter(fn));
		expect(findAssignedPlaybookActors("anything")).toEqual([]);

		game.actors.filter.mockImplementation((fn) => [carrier1, carrier2, emptyQuarters].filter(fn));
		expect(findAssignedPlaybookActors("c1")).toEqual([]);
	});

	it("includes a Support actor whose Quarters carries only benefits (no name/description)", () => {
		game.actors.filter.mockImplementation((fn) => [benefitsOnly].filter(fn));

		expect(findAssignedPlaybookActors("anything").map((a) => a.id)).toEqual(["a5"]);
	});

	it("excludes a character actor with no playbook set at all, without throwing", () => {
		game.actors.filter.mockImplementation((fn) => [noPlaybook].filter(fn));

		expect(findAssignedPlaybookActors("anything")).toEqual([]);
	});
});

describe("CarrierActorSheet#getData - Quarters", () => {
	it("maps each assigned Support actor's Quarters to actorName/name/description/benefitLabels", () => {
		const supportActor = {
			id: "a1",
			name: "Reyes",
			type: "character",
			system: {
				playbook: { slug: "the-icon" },
				attributes: {
					quarters: { name: "The Nook", description: "A quiet corner.", benefits: ["extra-token"] }
				}
			}
		};
		game.actors.filter.mockImplementation((fn) => [supportActor].filter(fn));
		const sheet = new CarrierActorSheet();
		sheet.actor = { id: "c1", system: {} };

		const data = sheet.getData({});

		expect(data.quarters).toEqual([
			{
				actorName: "Reyes",
				name: "The Nook",
				description: "A quiet corner.",
				benefitLabels: [QUARTERS_BENEFITS[0].label]
			}
		]);
	});

	it("defaults to an empty list when no Support actor is assigned", () => {
		game.actors.filter.mockImplementation(() => []);
		const sheet = new CarrierActorSheet();
		sheet.actor = { id: "c1", system: {} };

		expect(sheet.getData({}).quarters).toEqual([]);
	});

	it("falls back to an empty benefit list for an assigned actor whose Quarters carries no benefits field", () => {
		const supportActor = {
			id: "a1",
			name: "Reyes",
			type: "character",
			system: { playbook: { slug: "the-icon" }, attributes: { quarters: { name: "The Nook" } } }
		};
		game.actors.filter.mockImplementation((fn) => [supportActor].filter(fn));
		const sheet = new CarrierActorSheet();
		sheet.actor = { id: "c1", system: {} };

		expect(sheet.getData({}).quarters).toEqual([
			{ actorName: "Reyes", name: "The Nook", description: "", benefitLabels: [] }
		]);
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
