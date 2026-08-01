import { describe, expect, it, vi } from "vitest";
import { CarrierActorSheet, CARRIER_SHEET_TEMPLATE, registerCarrierActorSheet } from "../scripts/carrier-actor-sheet.js";

describe("CarrierActorSheet.defaultOptions", () => {
	it("merges the carrier sheet's classes/template onto the base world-actor options", () => {
		expect(CarrierActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "carrier"],
			template: CARRIER_SHEET_TEMPLATE,
			width: 640,
			height: "auto"
		});
	});
});

describe("CarrierActorSheet#_entryDefaults", () => {
	it("seeds a crew member with name/position/description", () => {
		const sheet = new CarrierActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", position: "", description: "" });
	});
});

describe("CarrierActorSheet#getData", () => {
	it("reads crew, description, and crew members off the actor", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = {
			system: {
				stats: { crew: { value: 2 } },
				details: { description: { value: "A sturdy old freighter." } },
				attributes: { crewMembers: [{ id: "1", name: "Vex", position: "Pilot", description: "" }] }
			}
		};

		const data = sheet.getData({});

		expect(data.crew).toBe(2);
		expect(data.description).toBe("A sturdy old freighter.");
		expect(data.crewMembers).toEqual([{ id: "1", name: "Vex", position: "Pilot", description: "" }]);
	});

	it("defaults crew/description/crewMembers when unset", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.crew).toBe(0);
		expect(data.description).toBe("");
		expect(data.crewMembers).toEqual([]);
	});
});

describe("CarrierActorSheet#activateListeners", () => {
	it("binds the crew stepper alongside the shared entry-list handlers", () => {
		const sheet = new CarrierActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".crew-step");
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
