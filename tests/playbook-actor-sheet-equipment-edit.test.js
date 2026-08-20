import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the editor and catalog picker dialogs are mocked — the tag catalog, item catalog, and
// resolve helpers stay real, so the sheet is exercised against the actual Blitz/placeholder
// content.
vi.mock("../scripts/equipment/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseEquipmentCatalogItem: vi.fn()
}));

import { configureEquipment } from "../scripts/equipment/equipment.js";
import { astirMaxPower } from "../scripts/frames/astir.js";
import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	configureEquipment.mockClear();
});

describe("PlaybookActorSheet#_onEquipmentEdit", () => {
	it("replaces the matching entry wholesale, keeping only its id and spent array, leaving other entries untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		// No astir/ardent/startingGear/catalogSource flag on this entry — a plain entry with no
		// provenance flag defaults to unlocked but now budget-capped (see docs/domains/equipment.md's
		// "Equipment" notes).
		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { lockTags: false, maxTagValue: 0, allowOverride: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: ["blitz"], disabled: false, name: "Rations", description: "", kind: "gear", tags: [] },
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

		// No catalogSource on this pre-existing Astir weapon — defaults to locked (its only prior
		// path was a catalog pick — see docs/domains/equipment.md's "Equipment" notes).
		expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { astirWeapon: true, lockTags: true, maxTagValue: null, allowOverride: true });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: false, name: "Lance II", description: "", kind: "weapon", tags: ["melee"], astir: true }
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
					disabled: false,
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
					disabled: false,
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
					disabled: false,
					name: "Artificers",
					description: "",
					kind: "gear",
					tags: [],
					bonusDowntimeTokens: entry.bonusDowntimeTokens
				}
			]
		});
	});

	it("carries the disabled flag forward through an edit", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", disabled: true, name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Halberd+1", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: true, name: "Halberd+1", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 }
			]
		});
	});

	it("defaults disabled to false on an edit when the entry never had it set", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Halberd+1", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: [], disabled: false, name: "Halberd+1", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 }
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
			"system.attributes.equipment": [{ id: "1", spent: [], disabled: false, name: "Rations", description: "", kind: "gear", tags: [] }]
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

		const edited = { id: "1", spent: [], disabled: false, name: "Lance II", description: "", kind: "weapon", tags: ["drain-2"], astir: true };
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
				{ id: "1", spent: [], disabled: false, name: "Sword+1", description: "", kind: "weapon", tags: ["drain-2"], scale: "foot", tier: 1 }
			]
		});
	});

	describe("provenance resolution (lockTags/maxTagValue/catalogSource/startingGear)", () => {
		it("locks a plain entry with catalogSource: true, and carries catalogSource forward", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "gear", name: "Rope", description: "", tags: [], spent: [], catalogSource: true
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Rope", description: "", kind: "gear", tags: [] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { lockTags: true, maxTagValue: null, allowOverride: true });
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{ id: "1", spent: [], disabled: false, name: "Rope", description: "", kind: "gear", tags: [], catalogSource: true }
				]
			});
		});

		it("budget-caps a plain entry with catalogSource: false", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "gear", name: "Custom Rope", description: "", tags: [], spent: [], catalogSource: false
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Custom Rope", description: "", kind: "gear", tags: [] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { lockTags: false, maxTagValue: 0, allowOverride: true });
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{
						id: "1", spent: [], disabled: false, name: "Custom Rope", description: "", kind: "gear", tags: [],
						catalogSource: false
					}
				]
			});
		});

		it("exempts a startingGear entry from both rules regardless of catalogSource, and carries startingGear forward", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [], startingGear: true
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { lockTags: false, maxTagValue: null, allowOverride: true });
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{
						id: "1", spent: [], disabled: false, name: "Rations", description: "", kind: "gear", tags: [],
						startingGear: true
					}
				]
			});
		});

		it("budget-caps (rather than locks) a custom Astir weapon stamped catalogSource: false", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "weapon", astir: true, catalogSource: false, name: "Custom Lance", description: "",
				tags: ["melee"], spent: []
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Custom Lance", description: "", kind: "weapon", tags: ["melee"] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { astirWeapon: true, lockTags: false, maxTagValue: 0, allowOverride: true });
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{
						id: "1", spent: [], disabled: false, name: "Custom Lance", description: "", kind: "weapon",
						tags: ["melee"], astir: true, catalogSource: false
					}
				]
			});
		});

		it("locks a pre-existing Ardent weapon with no catalogSource flag at all", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = { id: "1", kind: "weapon", ardent: "ar1", name: "Spear", description: "", tags: ["melee"], spent: [] };
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Spear", description: "", kind: "weapon", tags: ["melee"] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(configureEquipment).toHaveBeenCalledWith(entry, undefined, { ardentWeapon: true, lockTags: true, maxTagValue: null, allowOverride: true });
		});

		it("persists configureEquipment's own catalogSource: false (an Override-Max catalog unlock) instead of carrying the old entry's catalogSource: true forward", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "weapon", astir: true, catalogSource: true, name: "Lance", description: "",
				tags: ["melee"], spent: []
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			// Simulates configureEquipment's own catalog-unlock resolution (see equipment-dialogs.js's
			// "Unlock a permanently-locked catalog pick" mechanism) -- the entry was Override-Max
			// unlocked and saved, so the resolved result carries an explicit catalogSource: false.
			configureEquipment.mockResolvedValue({
				name: "Lance", description: "", kind: "weapon", tags: ["melee", "blitz"],
				maxTagValueOverride: 1, catalogSource: false
			});

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			// Without the fix, the old entry's catalogSource: true (spread in after ...result) would
			// clobber this back to true -- asserting catalogSource: false here is what proves the fix.
			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{
						id: "1", spent: [], disabled: false, name: "Lance", description: "", kind: "weapon",
						tags: ["melee", "blitz"], astir: true, maxTagValueOverride: 1, catalogSource: false
					}
				]
			});
		});

		it("still carries the old entry's catalogSource forward when configureEquipment's result has no catalogSource of its own (every pre-existing case, unaffected)", async () => {
			const sheet = new PlaybookActorSheet();
			const entry = {
				id: "1", kind: "weapon", astir: true, catalogSource: false, name: "Custom Lance", description: "",
				tags: ["melee"], spent: []
			};
			sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
			configureEquipment.mockResolvedValue({ name: "Custom Lance II", description: "", kind: "weapon", tags: ["melee"] });

			await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

			expect(sheet.actor.update).toHaveBeenCalledWith({
				"system.attributes.equipment": [
					{
						id: "1", spent: [], disabled: false, name: "Custom Lance II", description: "", kind: "weapon",
						tags: ["melee"], astir: true, catalogSource: false
					}
				]
			});
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

describe("PlaybookActorSheet#_onEquipmentDisabledToggle", () => {
	it("sets disabled: true on the matching entry when checked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentDisabledToggle({ currentTarget: { dataset: { equipmentId: "1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, disabled: true }]
		});
	});

	it("sets disabled: false on the matching entry when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", disabled: true, name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentDisabledToggle({ currentTarget: { dataset: { equipmentId: "1" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, disabled: false }]
		});
	});

	it("leaves entries that don't match the toggled id untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentDisabledToggle({ currentTarget: { dataset: { equipmentId: "1" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, disabled: true }, other]
		});
	});
});
