import { describe, expect, it, vi } from "vitest";
import { APPROACHES } from "../scripts/core/approaches.js";
import { TIER_MIN, TIER_MAX } from "../scripts/equipment/equipment.js";
import { NpcActorSheet, NPC_SHEET_TEMPLATE, registerNpcActorSheet } from "../scripts/world-actors/npc-actor-sheet.js";

describe("NpcActorSheet.defaultOptions", () => {
	it("merges the npc sheet's classes/template onto the base actor-sheet options", () => {
		expect(NpcActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "npc"],
			template: NPC_SHEET_TEMPLATE,
			width: 480,
			height: "auto"
		});
	});
});

describe("NpcActorSheet#getData", () => {
	it("reads description, approach, and tier off the actor", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = {
			system: {
				details: { description: { value: "A hardened Authority enforcer." } },
				attributes: { approach: "profane", tier: 3 }
			}
		};

		const data = sheet.getData({});

		expect(data.description).toBe("A hardened Authority enforcer.");
		expect(data.approach).toBe("profane");
		expect(data.approachOptions).toBe(APPROACHES);
		expect(data.tier).toEqual({ value: 3, min: TIER_MIN, max: TIER_MAX });
	});

	it("defaults description/approach/tier when unset", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.description).toBe("");
		expect(data.approach).toBe("");
		expect(data.tier).toEqual({ value: TIER_MIN, min: TIER_MIN, max: TIER_MAX });
	});
});

describe("NpcActorSheet#activateListeners", () => {
	it("binds the approach select and tier stepper", () => {
		const sheet = new NpcActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".npc-approach-select");
		expect(html.find).toHaveBeenCalledWith(".tier-step");
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
