import { describe, expect, it } from "vitest";
import { CauseActorSheet, CAUSE_SHEET_TEMPLATE, registerCauseActorSheet } from "../scripts/cause-actor-sheet.js";

describe("CauseActorSheet.defaultOptions", () => {
	it("merges the cause sheet's classes/template onto the base world-actor options", () => {
		expect(CauseActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "cause"],
			template: CAUSE_SHEET_TEMPLATE,
			width: 640,
			height: "auto"
		});
	});
});

describe("CauseActorSheet#_entryDefaults", () => {
	it("seeds a faction with name/description/exhausted", () => {
		const sheet = new CauseActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", description: "", exhausted: false });
	});
});

describe("CauseActorSheet#getData", () => {
	it("reads factions off the actor", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false }] } }
		};

		const data = sheet.getData({});

		expect(data.factions).toEqual([{ id: "1", name: "The Free Hands", description: "", exhausted: false }]);
	});

	it("defaults factions to empty when unset", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.factions).toEqual([]);
	});
});

describe("registerCauseActorSheet", () => {
	it("registers the sheet as the default sheet for the cause actor type", () => {
		registerCauseActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("armor-astir", CauseActorSheet, {
			types: ["armor-astir.cause"],
			makeDefault: true,
			label: "Cause"
		});
	});
});
