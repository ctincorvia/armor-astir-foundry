import { describe, expect, it, vi } from "vitest";
import { AuthorityActorSheet, AUTHORITY_SHEET_TEMPLATE, registerAuthorityActorSheet } from "../scripts/authority-actor-sheet.js";

describe("AuthorityActorSheet.defaultOptions", () => {
	it("merges the authority sheet's classes/template onto the base world-actor options", () => {
		expect(AuthorityActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "authority"],
			template: AUTHORITY_SHEET_TEMPLATE,
			width: 640,
			height: "auto"
		});
	});
});

describe("AuthorityActorSheet#getData", () => {
	it("builds a 10-step stability track filled up to the current value", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 4 } } } };

		const data = sheet.getData({});

		expect(data.stability.value).toBe(4);
		expect(data.stability.steps).toHaveLength(10);
		expect(data.stability.steps.filter((s) => s.filled)).toHaveLength(4);
		expect(data.stability.steps[0]).toEqual({ step: 1, filled: true });
		expect(data.stability.steps[9]).toEqual({ step: 10, filled: false });
	});

	it("defaults stability to 1 when unset", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.stability.value).toBe(1);
		expect(data.stability.steps.filter((s) => s.filled)).toHaveLength(1);
	});

	it("reads pillars, divisions, assets, and notable actors off the actor", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					pillars: [{ id: "p1", name: "Fear", description: "" }],
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					assets: [{ id: "a1", name: "Orbital cannon", description: "" }],
					notableActors: [{ id: "n1", name: "The Warden", description: "" }]
				}
			}
		};

		const data = sheet.getData({});

		expect(data.pillars).toEqual([{ id: "p1", name: "Fear", description: "" }]);
		expect(data.divisions).toEqual([{ id: "d1", name: "The Wardens", description: "" }]);
		expect(data.assets).toEqual([{ id: "a1", name: "Orbital cannon", description: "" }]);
		expect(data.notableActors).toEqual([{ id: "n1", name: "The Warden", description: "" }]);
	});

	it("defaults every list to empty when unset", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.pillars).toEqual([]);
		expect(data.divisions).toEqual([]);
		expect(data.assets).toEqual([]);
		expect(data.notableActors).toEqual([]);
	});
});

describe("AuthorityActorSheet#activateListeners", () => {
	it("binds the stability and division counter steppers alongside the shared entry-list handlers", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".stability-step");
		expect(html.find).toHaveBeenCalledWith(".division-strength-step");
		expect(html.find).toHaveBeenCalledWith(".division-disfavor-step");
	});
});

describe("AuthorityActorSheet#_onStabilityStep", () => {
	it("sets stability to the clicked step", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 3 } } }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "7" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.stability.value": 7 });
	});

	it("clamps a step below the minimum to 1", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 1 } } }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "0" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps a step above the maximum to 10", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 5 } } }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "15" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.stability.value": 10 });
	});

	it("does nothing when the clicked step matches the current value", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 5 } } }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "5" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing stability value as the minimum", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.stability.value": 3 });
	});
});

describe("AuthorityActorSheet#_onDivisionStrengthStep", () => {
	it("increments the matching division's strength", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 2 }] } },
			update: vi.fn()
		};

		sheet._onDivisionStrengthStep({ currentTarget: { dataset: { entryId: "d1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.divisions": [{ id: "d1", strength: 3 }]
		});
	});

	it("clamps at the maximum of 5", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 5 }] } },
			update: vi.fn()
		};

		sheet._onDivisionStrengthStep({ currentTarget: { dataset: { entryId: "d1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum of 0", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 0 }] } },
			update: vi.fn()
		};

		sheet._onDivisionStrengthStep({ currentTarget: { dataset: { entryId: "d1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing strength as 0", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1" }] } },
			update: vi.fn()
		};

		sheet._onDivisionStrengthStep({ currentTarget: { dataset: { entryId: "d1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.divisions": [{ id: "d1", strength: 1 }]
		});
	});

	it("does nothing when no division matches the given id", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 2 }] } },
			update: vi.fn()
		};

		sheet._onDivisionStrengthStep({ currentTarget: { dataset: { entryId: "missing", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("AuthorityActorSheet#_onDivisionDisfavorStep", () => {
	it("increments the matching division's disfavor", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", disfavor: 3 }] } },
			update: vi.fn()
		};

		sheet._onDivisionDisfavorStep({ currentTarget: { dataset: { entryId: "d1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.divisions": [{ id: "d1", disfavor: 4 }]
		});
	});

	it("clamps at the maximum of 10", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", disfavor: 10 }] } },
			update: vi.fn()
		};

		sheet._onDivisionDisfavorStep({ currentTarget: { dataset: { entryId: "d1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum of 0", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", disfavor: 0 }] } },
			update: vi.fn()
		};

		sheet._onDivisionDisfavorStep({ currentTarget: { dataset: { entryId: "d1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("registerAuthorityActorSheet", () => {
	it("registers the sheet as the default sheet for the authority actor type", () => {
		registerAuthorityActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("armor-astir", AuthorityActorSheet, {
			types: ["armor-astir.authority"],
			makeDefault: true,
			label: "Authority"
		});
	});
});
