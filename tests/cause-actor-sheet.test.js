import { describe, expect, it } from "vitest";
import { CauseActorSheet, CAUSE_SHEET_TEMPLATE, registerCauseActorSheet } from "../scripts/world-actors/cause-actor-sheet.js";
import { FACTION_KINDS } from "../scripts/world-actors/faction-kinds.js";

describe("CauseActorSheet.defaultOptions", () => {
	it("merges the cause sheet's classes/template onto the base world-actor options", () => {
		expect(CauseActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "cause"],
			template: CAUSE_SHEET_TEMPLATE,
			width: 640,
			scrollY: [".window-content"]
		});
	});
});

describe("CauseActorSheet#_entryDefaults", () => {
	it("seeds a faction with name/description/exhausted/seized/grip/kind", () => {
		const sheet = new CauseActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", description: "", exhausted: false, seized: false, grip: 0, kind: "" });
	});
});

describe("CauseActorSheet#_factionsData", () => {
	it("resolves opposesText/outcomeText from the catalog for a faction with a valid kind", () => {
		const sheet = new CauseActorSheet();
		const realKind = FACTION_KINDS[0];
		sheet.actor = {
			system: {
				attributes: {
					factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 0, kind: realKind.key }]
				}
			}
		};

		const data = sheet._factionsData("factions");

		expect(data[0].opposesText).toBe(realKind.opposes);
		expect(data[0].outcomeText).toBe(realKind.outcome);
	});

	it("defaults opposesText/outcomeText to empty for a faction with an unknown kind", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 0, kind: "not-a-real-kind" }]
				}
			}
		};

		const data = sheet._factionsData("factions");

		expect(data[0].opposesText).toBe("");
		expect(data[0].outcomeText).toBe("");
	});

	it("defaults opposesText/outcomeText to empty for a faction with an unset (empty string) kind", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 0, kind: "" }]
				}
			}
		};

		const data = sheet._factionsData("factions");

		expect(data[0].opposesText).toBe("");
		expect(data[0].outcomeText).toBe("");
	});

	it("attaches the full FACTION_KINDS catalog as kindOptions on every faction", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					factions: [
						{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 0, kind: "" },
						{ id: "2", name: "The Watch", description: "", exhausted: false, seized: false, grip: 0, kind: "" }
					]
				}
			}
		};

		const data = sheet._factionsData("factions");

		expect(data[0].kindOptions).toBe(FACTION_KINDS);
		expect(data[1].kindOptions).toBe(FACTION_KINDS);
	});
});

describe("CauseActorSheet#getData", () => {
	it("reads factions off the actor", () => {
		const sheet = new CauseActorSheet();
		const realKind = FACTION_KINDS[0];
		sheet.actor = {
			system: {
				attributes: {
					factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 2, kind: realKind.key }]
				}
			}
		};

		const data = sheet.getData({});

		expect(data.factions).toEqual([
			{
				id: "1",
				name: "The Free Hands",
				description: "",
				exhausted: false,
				seized: false,
				grip: 2,
				kind: realKind.key,
				kindOptions: FACTION_KINDS,
				opposesText: realKind.opposes,
				outcomeText: realKind.outcome
			}
		]);
	});

	it("defaults a faction's missing grip to 0, for factions created before Grip existed", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false }] } }
		};

		const data = sheet.getData({});

		expect(data.factions[0]).toEqual({
			id: "1",
			name: "The Free Hands",
			description: "",
			exhausted: false,
			grip: 0,
			kindOptions: FACTION_KINDS,
			opposesText: "",
			outcomeText: ""
		});
	});

	it("defaults factions and waywardFactions to empty when unset", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.factions).toEqual([]);
		expect(data.waywardFactions).toEqual([]);
	});

	it("keeps factions and waywardFactions independent when only factions is set", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "1", name: "The Free Hands", description: "", exhausted: false, seized: false, grip: 0, kind: "" }] } }
		};

		const data = sheet.getData({});

		expect(data.factions).toHaveLength(1);
		expect(data.waywardFactions).toEqual([]);
	});

	it("keeps factions and waywardFactions independent when only waywardFactions is set", () => {
		const sheet = new CauseActorSheet();
		sheet.actor = {
			system: { attributes: { waywardFactions: [{ id: "1", name: "The Broken Hands", description: "", exhausted: false, seized: false, grip: 0, kind: "" }] } }
		};

		const data = sheet.getData({});

		expect(data.factions).toEqual([]);
		expect(data.waywardFactions).toHaveLength(1);
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
