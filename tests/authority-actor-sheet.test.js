import { describe, expect, it, vi } from "vitest";
import { AuthorityActorSheet, AUTHORITY_SHEET_TEMPLATE, registerAuthorityActorSheet } from "../scripts/world-actors/authority-actor-sheet.js";
import { DIVISION_KINDS } from "../scripts/world-actors/division-kinds.js";
import { CLOCK_STEPS_MAX, CLOCK_STEPS_MIN } from "../scripts/core/clocks.js";

describe("AuthorityActorSheet.defaultOptions", () => {
	it("merges the authority sheet's classes/template onto the base world-actor options", () => {
		expect(AuthorityActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor", "authority"],
			template: AUTHORITY_SHEET_TEMPLATE,
			width: 1350,
			scrollY: [".window-content"]
		});
	});
});

describe("AuthorityActorSheet#_divisionsData", () => {
	it("groups pillars onto their owning division via divisionId", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [
						{ id: "d1", name: "The Wardens", description: "" },
						{ id: "d2", name: "The Watch", description: "" }
					],
					pillars: [
						{ id: "p1", divisionId: "d1", name: "Fear", description: "", grip: 1, felled: false },
						{ id: "p2", divisionId: "d1", name: "Order", description: "", grip: 0, felled: false }
					]
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].pillars).toEqual([
			{ id: "p1", divisionId: "d1", name: "Fear", description: "", grip: 1, felled: false },
			{ id: "p2", divisionId: "d1", name: "Order", description: "", grip: 0, felled: false }
		]);
	});

	it("gives a division with no matching pillars an empty pillars list", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					pillars: []
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].pillars).toEqual([]);
	});

	it("drops a pillar whose divisionId matches no division", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					pillars: [{ id: "p1", divisionId: "does-not-exist", name: "Orphan", description: "", grip: 0, felled: false }]
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].pillars).toEqual([]);
	});

	it("defaults a pillar's missing grip to 0", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					pillars: [{ id: "p1", divisionId: "d1", name: "Fear", description: "" }]
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].pillars[0].grip).toBe(0);
	});

	it("keeps a pillar's existing grip when already set", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					pillars: [{ id: "p1", divisionId: "d1", name: "Fear", description: "", grip: 2 }]
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].pillars[0].grip).toBe(2);
	});

	it("resolves passiveOutcome/activeOutcomes from the catalog for a division with a valid kind", () => {
		const sheet = new AuthorityActorSheet();
		const realKind = DIVISION_KINDS[0];
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "", kind: realKind.key }],
					pillars: []
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].passiveOutcome).toBe(realKind.passive);
		expect(data[0].activeOutcomes).toBe(realKind.active);
	});

	it("defaults passiveOutcome/activeOutcomes to empty for a division with an unknown kind", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "", kind: "not-a-real-kind" }],
					pillars: []
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].passiveOutcome).toBe("");
		expect(data[0].activeOutcomes).toEqual([]);
	});

	it("defaults passiveOutcome/activeOutcomes to empty for a division with an unset (empty string) kind", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "", kind: "" }],
					pillars: []
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].passiveOutcome).toBe("");
		expect(data[0].activeOutcomes).toEqual([]);
	});

	it("attaches the full DIVISION_KINDS catalog as kindOptions on every division", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [
						{ id: "d1", name: "The Wardens", description: "" },
						{ id: "d2", name: "The Watch", description: "" }
					],
					pillars: []
				}
			}
		};

		const data = sheet._divisionsData();

		expect(data[0].kindOptions).toBe(DIVISION_KINDS);
		expect(data[1].kindOptions).toBe(DIVISION_KINDS);
	});
});

describe("AuthorityActorSheet#getData", () => {
	it("builds a 9-step stability track filled up to the current value", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 4 } } } };

		const data = sheet.getData({});

		expect(data.stability.value).toBe(4);
		expect(data.stability.steps).toHaveLength(9);
		expect(data.stability.steps.filter((s) => s.filled)).toHaveLength(4);
		expect(data.stability.steps[0]).toEqual({ step: 1, filled: true });
		expect(data.stability.steps[8]).toEqual({ step: 9, filled: false });
	});

	it("defaults stability to 1 when unset", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.stability.value).toBe(1);
		expect(data.stability.steps.filter((s) => s.filled)).toHaveLength(1);
	});

	it("reads divisions (with nested pillars), assets, notable actors, and schemes off the actor", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					divisions: [{ id: "d1", name: "The Wardens", description: "" }],
					pillars: [{ id: "p1", divisionId: "d1", name: "Fear", description: "", grip: 0, felled: false }],
					assets: [{ id: "a1", name: "Orbital cannon", description: "" }],
					notableActors: [{ id: "n1", name: "The Warden", description: "" }],
					schemes: [{ id: "s1", label: "Cut the supply lines", progress: 2, steps: 6 }]
				}
			}
		};

		const data = sheet.getData({});

		expect(data.divisions[0].id).toBe("d1");
		expect(data.divisions[0].pillars).toEqual([
			{ id: "p1", divisionId: "d1", name: "Fear", description: "", grip: 0, felled: false }
		]);
		expect(data.assets).toEqual([{ id: "a1", name: "Orbital cannon", description: "" }]);
		expect(data.notableActors).toEqual([{ id: "n1", name: "The Warden", description: "" }]);
		expect(data.schemes.min).toBe(CLOCK_STEPS_MIN);
		expect(data.schemes.max).toBe(CLOCK_STEPS_MAX);
		expect(data.schemes.list).toEqual([
			{
				id: "s1",
				label: "Cut the supply lines",
				progress: 2,
				steps: 6,
				progressSteps: [
					{ step: 1, filled: true },
					{ step: 2, filled: true },
					{ step: 3, filled: false },
					{ step: 4, filled: false },
					{ step: 5, filled: false },
					{ step: 6, filled: false }
				]
			}
		]);
	});

	it("defaults every list to empty when unset", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData({});

		expect(data.divisions).toEqual([]);
		expect(data.assets).toEqual([]);
		expect(data.notableActors).toEqual([]);
		expect(data.schemes.list).toEqual([]);
	});
});

describe("AuthorityActorSheet#getData - schemes - branch edges", () => {
	it("treats a missing steps field as CLOCK_STEPS_DEFAULT and a missing progress field as 0", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { schemes: [{ id: "s1", label: "A" }] } } };

		const data = sheet.getData({});

		expect(data.schemes.list[0].progressSteps).toHaveLength(6);
		expect(data.schemes.list[0].progressSteps.every((step) => !step.filled)).toBe(true);
	});
});

describe("AuthorityActorSheet#activateListeners", () => {
	it("binds the stability stepper alongside the shared entry-list handlers", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".stability-step");
		// Division Strength/Disfavor and Pillar GRIP all go through WorldActorSheet's generic
		// .entry-list-counter-step handler (see world-actor-sheet.test.js) rather than a
		// bespoke Authority-only binding.
		expect(html.find).toHaveBeenCalledWith(".entry-list-counter-step");
		// Schemes reuses the player sheet's own Clocks widget classes (see authority-actor-sheet.js).
		expect(html.find).toHaveBeenCalledWith(".clock-add");
		expect(html.find).toHaveBeenCalledWith(".clock-remove");
		expect(html.find).toHaveBeenCalledWith(".clock-label-input");
		expect(html.find).toHaveBeenCalledWith(".clock-steps-input");
		expect(html.find).toHaveBeenCalledWith(".clock-step");
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

	it("clamps a step above the maximum to 9", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { stability: { value: 5 } } }, update: vi.fn() };

		sheet._onStabilityStep({ currentTarget: { dataset: { step: "15" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.stability.value": 9 });
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

describe("AuthorityActorSheet#_onSchemeAdd", () => {
	it("appends a new scheme via clocks.js's addClock", () => {
		const sheet = new AuthorityActorSheet();
		sheet.actor = { system: { attributes: { schemes: [] } }, update: vi.fn() };

		sheet._onSchemeAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.schemes": [{ id: "test-id", label: "", progress: 0, steps: 6 }]
		});
	});
});

describe("AuthorityActorSheet#_onSchemeRemove", () => {
	it("removes the matching scheme", () => {
		const sheet = new AuthorityActorSheet();
		const clock = { id: "s1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { schemes: [clock] } }, update: vi.fn() };

		sheet._onSchemeRemove({ currentTarget: { dataset: { clockId: "s1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.schemes": [] });
	});
});

describe("AuthorityActorSheet#_onSchemeLabelChange", () => {
	it("updates the matching scheme's label, trimmed", () => {
		const sheet = new AuthorityActorSheet();
		const clock = { id: "s1", label: "Old", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { schemes: [clock] } }, update: vi.fn() };

		sheet._onSchemeLabelChange({ currentTarget: { dataset: { clockId: "s1" }, value: " New " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.schemes": [{ ...clock, label: "New" }]
		});
	});
});

describe("AuthorityActorSheet#_onSchemeStepsChange", () => {
	it("updates the matching scheme's step count", () => {
		const sheet = new AuthorityActorSheet();
		const clock = { id: "s1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { schemes: [clock] } }, update: vi.fn() };

		sheet._onSchemeStepsChange({ currentTarget: { dataset: { clockId: "s1" }, value: "4" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.schemes": [{ ...clock, steps: 4 }]
		});
	});
});

describe("AuthorityActorSheet#_onSchemeStep", () => {
	it("fills up to the clicked step", () => {
		const sheet = new AuthorityActorSheet();
		const clock = { id: "s1", label: "A", progress: 0, steps: 6 };
		sheet.actor = { system: { attributes: { schemes: [clock] } }, update: vi.fn() };

		sheet._onSchemeStep({ currentTarget: { dataset: { clockId: "s1", step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.schemes": [{ ...clock, progress: 3 }]
		});
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
