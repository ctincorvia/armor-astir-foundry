import { describe, expect, it, vi } from "vitest";
import { APPROACHES } from "../scripts/core/approaches.js";
import { TIER_MIN, TIER_MAX } from "../scripts/equipment/equipment.js";
import { NpcActorSheet, NPC_SHEET_TEMPLATE, registerNpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

describe("NpcActorSheet.defaultOptions", () => {
	it("merges the npc sheet's classes/template/tabs onto the base actor-sheet options", () => {
		expect(NpcActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "npc"],
			template: NPC_SHEET_TEMPLATE,
			width: 480,
			height: "auto",
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "rival" }]
		});
	});
});

describe("NpcActorSheet#getData", () => {
	it("reads description, approach, tier, and rival off the actor", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			name: "Cinder Baron",
			system: {
				details: { description: { value: "A hardened Authority enforcer." } },
				attributes: {
					approach: "profane",
					tier: 3,
					rival: { active: true, target: "The Cinder Baron", need: "Control", want: "Respect", hold: 2 }
				}
			}
		};

		const data = sheet.getData({});

		expect(data.description).toBe("A hardened Authority enforcer.");
		expect(data.approach).toBe("profane");
		expect(data.approachOptions).toBe(APPROACHES);
		expect(data.tier).toEqual({ value: 3, min: TIER_MIN, max: TIER_MAX });
		expect(data.rival).toEqual({ active: true, target: "The Cinder Baron", need: "Control", want: "Respect", hold: 2 });
	});

	it("defaults description/approach/tier/rival when unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Unnamed", system: {} };

		const data = sheet.getData({});

		expect(data.description).toBe("");
		expect(data.approach).toBe("");
		expect(data.tier).toEqual({ value: TIER_MIN, min: TIER_MIN, max: TIER_MAX });
		expect(data.rival).toEqual({ active: false, target: "", need: "", want: "", hold: 0 });
	});

	it("also computes equipment/astir/ardents (see the domain-specific test files for their own shape)", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { name: "Unnamed", system: {} };

		const data = sheet.getData({});

		expect(data.equipment).toEqual({ weapons: [], astirWeapons: [], ardentWeapons: [], gear: [] });
		expect(data.astir).toEqual({ exists: false, cores: expect.any(Array), tierMin: 3, tierMax: 4 });
		expect(data.ardents).toEqual([]);
	});
});

describe("NpcActorSheet#activateListeners", () => {
	it("binds the approach select, tier stepper, and rival controls", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".npc-approach-select");
		expect(html.find).toHaveBeenCalledWith(".tier-step");
		expect(html.find).toHaveBeenCalledWith(".rival-active-checkbox");
		expect(html.find).toHaveBeenCalledWith(".rival-hold-step");
	});

	it("binds every Equipment/Astir/Ardent control to its handler", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		const bound = [
			".equipment-add", ".equipment-catalog-add", ".equipment-edit", ".equipment-remove",
			".equipment-disabled-checkbox", ".move-info",
			".astir-create", ".astir-delete", ".astir-core-select", ".astir-approach-select",
			".astir-tier-step", ".astir-power-step", ".astir-weapon-power-step",
			".astir-overheating-checkbox", ".astir-piloted-checkbox", ".astir-part-add",
			".astir-part-remove", ".part-disabled-checkbox", ".astir-move-add", ".astir-move-remove",
			".astir-weapon-catalog-add", ".astir-weapon-add",
			".ardent-create", ".ardent-delete", ".ardent-name-input", ".ardent-approach-select",
			".ardent-tier-step", ".ardent-piloted-checkbox", ".ardent-part-add", ".ardent-part-remove",
			".ardent-weapon-catalog-add", ".ardent-weapon-add"
		];
		for (const selector of bound) {
			expect(html.find).toHaveBeenCalledWith(selector);
		}
	});
});

describe("NpcActorSheet#_onApproachChange", () => {
	it("writes the selected approach key to the actor", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onApproachChange({ currentTarget: { value: "elemental" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.approach": "elemental" });
	});
});

describe("NpcActorSheet#_onTierStep", () => {
	it("increments tier by the clicked delta", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { tier: 2 } }, update: vi.fn() };

		sheet._onTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.tier": 3 });
	});

	it("clamps at the maximum", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { tier: TIER_MAX } }, update: vi.fn() };

		sheet._onTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { tier: TIER_MIN } }, update: vi.fn() };

		sheet._onTierStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing tier value as TIER_MIN", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onTierStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.tier": TIER_MIN + 1 });
	});
});

describe("NpcActorSheet#_onRivalActiveToggle", () => {
	it("writes the checked state to the actor", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRivalActiveToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.rival.active": true });
	});

	it("writes false when unchecked", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRivalActiveToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.rival.active": false });
	});
});

describe("NpcActorSheet#_onRivalHoldStep", () => {
	it("increments hold by the clicked delta", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { rival: { hold: 2 } } }, update: vi.fn() };

		sheet._onRivalHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.rival.hold": 3 });
	});

	it("floor-clamps at 0", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: { rival: { hold: 0 } } }, update: vi.fn() };

		sheet._onRivalHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing hold value as 0", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onRivalHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.rival.hold": 1 });
	});
});

describe("NpcActorSheet#_onPartDisabledToggle", () => {
	it("writes the checked state keyed by part", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onPartDisabledToggle({ currentTarget: { dataset: { part: "astir-part:warding" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveUses.astir-part:warding.disabled": true });
	});
});

describe("registerNpcActorSheet", () => {
	it("registers the sheet as the default sheet for the npc actor type", () => {
		registerNpcActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("armor-astir", NpcActorSheet, {
			types: ["armor-astir.npc"],
			makeDefault: true,
			label: "NPC"
		});
	});
});
