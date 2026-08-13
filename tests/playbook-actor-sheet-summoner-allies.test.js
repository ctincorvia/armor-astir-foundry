import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

beforeEach(() => {
	foundry.utils.randomID.mockReturnValue("test-id");
});

describe("PlaybookActorSheet#_onBoundAllyAdd/_onBoundAllyFieldChange", () => {
	it("appends a blank ally entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		sheet._onBoundAllyAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "test-id", name: "", approach: "", trait: "", powerInvested: 0 }]
		});
	});

	it("updates a single field on the matching entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", name: "" }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyFieldChange({ currentTarget: { dataset: { entryId: "a1", field: "name" }, value: "Vex" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", name: "Vex" }]
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyInvestPower", () => {
	it("no-ops without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the Astir's Power is already 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: { power: 0 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the entry can't be found", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "nope" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("moves 1 Power from the Astir to the ally's own powerInvested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 1 }], astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onBoundAllyInvestPower({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [{ id: "a1", powerInvested: 2 }],
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onBoundAllyRelease", () => {
	it("no-ops when the entry can't be found", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { boundAllies: [] } }, update: vi.fn() };

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "nope" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("removes the entry without touching Power when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 2 }] } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.boundAllies": [] });
	});

	it("removes the entry without touching Power when nothing was invested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { boundAllies: [{ id: "a1", powerInvested: 0 }], astir: { power: 2, parts: [] } } },
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.boundAllies": [] });
	});

	it("refunds the ally's full Power investment to the Astir, clamped to its derived max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 3 }],
					astir: { power: 3, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			// Base Astir Power (4) is the clamp ceiling with no parts/equipment — 3 + 3 would be 6,
			// clamped to 4.
			"system.attributes.astir.power": 4
		});
	});

	it("clears the active summon when releasing the currently-summoned ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 0 }],
					eidolonDrive: { summonedAllyId: "a1", bonusUsed: true }
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.boundAllies": [],
			"system.attributes.eidolonDrive": { summonedAllyId: null, bonusUsed: false }
		});
	});

	it("leaves the active summon untouched when releasing a different ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					boundAllies: [{ id: "a1", powerInvested: 0 }, { id: "a2", powerInvested: 0 }],
					eidolonDrive: { summonedAllyId: "a2", bonusUsed: false }
				}
			},
			update: vi.fn()
		};

		sheet._onBoundAllyRelease({ currentTarget: { dataset: { entryId: "a1" } } });

		const updates = sheet.actor.update.mock.calls.at(-1)[0];
		expect(updates["system.attributes.eidolonDrive"]).toBeUndefined();
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyAdd", () => {
	it("creates a blank Downtime Ally slot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": { name: "", powerInvested: 0 }
		});
	});

	it("no-ops when one is already bound", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyNameChange", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyNameChange({ currentTarget: { value: "Pip" } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("updates the name once bound", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyNameChange({ currentTarget: { value: "Pip" } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeAlly.name": "Pip" });
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyInvestPower", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { astir: { power: 2 } } }, update: vi.fn() };

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops without an Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("no-ops when the Astir's Power is already 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: { power: 0 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("moves 1 Power from the Astir to the Downtime Ally's own powerInvested", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 0 }, astir: { power: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyInvestPower();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly.powerInvested": 1,
			"system.attributes.astir.power": 1
		});
	});
});

describe("PlaybookActorSheet#_onDowntimeAllyRelease", () => {
	it("no-ops without a bound Downtime Ally", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clears the slot without touching Power when there is no Astir", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { downtimeAlly: { name: "Pip", powerInvested: 2 } } },
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.downtimeAlly": null });
	});

	it("refunds the full Power investment to the Astir, clamped to its derived max", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					downtimeAlly: { name: "Pip", powerInvested: 3 },
					astir: { power: 3, parts: [] },
					equipment: []
				}
			},
			update: vi.fn()
		};

		sheet._onDowntimeAllyRelease();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.downtimeAlly": null,
			"system.attributes.astir.power": 4
		});
	});
});
