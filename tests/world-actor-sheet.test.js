import { describe, expect, it, vi } from "vitest";
import { WorldActorSheet } from "../scripts/world-actor-sheet.js";

describe("WorldActorSheet.defaultOptions", () => {
	it("sets the shared world-actor sheet classes and sizing", () => {
		expect(WorldActorSheet.defaultOptions).toEqual({
			classes: ["armor-astir", "sheet", "actor", "world-actor"],
			width: 640,
			height: "auto"
		});
	});
});

describe("WorldActorSheet#_entryDefaults", () => {
	it("defaults to a blank name/description entry", () => {
		const sheet = new WorldActorSheet();

		expect(sheet._entryDefaults()).toEqual({ name: "", description: "" });
	});
});

describe("WorldActorSheet#_list", () => {
	it("reads the named list off system.attributes", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = { system: { attributes: { assets: [{ id: "a" }] } } };

		expect(sheet._list("assets")).toEqual([{ id: "a" }]);
	});

	it("treats a missing list as empty", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = { system: { attributes: {} } };

		expect(sheet._list("assets")).toEqual([]);
	});

	it("treats missing attributes entirely as empty", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = { system: {} };

		expect(sheet._list("assets")).toEqual([]);
	});
});

describe("WorldActorSheet#activateListeners", () => {
	it("binds the generic entry-list handlers", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".entry-list-add");
		expect(html.find).toHaveBeenCalledWith(".entry-list-remove");
		expect(html.find).toHaveBeenCalledWith(".entry-list-field");
		expect(html.find).toHaveBeenCalledWith(".entry-list-counter-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("WorldActorSheet#_onEntryAdd", () => {
	it("appends a new entry built from _entryDefaults, keyed by the clicked button's list", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = { system: { attributes: { assets: [{ id: "existing" }] } }, update: vi.fn() };

		sheet._onEntryAdd({ currentTarget: { dataset: { list: "assets" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.assets": [{ id: "existing" }, { id: "test-id", name: "", description: "" }]
		});
	});

	it("uses an overridden _entryDefaults, e.g. for lists needing extra seeded fields", () => {
		class FactionSheet extends WorldActorSheet {
			_entryDefaults() {
				return { name: "", description: "", exhausted: false };
			}
		}
		const sheet = new FactionSheet();
		sheet.actor = { system: { attributes: { factions: [] } }, update: vi.fn() };

		sheet._onEntryAdd({ currentTarget: { dataset: { list: "factions" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.factions": [{ id: "test-id", name: "", description: "", exhausted: false }]
		});
	});
});

describe("WorldActorSheet#_onEntryRemove", () => {
	it("removes the entry matching the clicked button's id, scoped to its list", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { assets: [{ id: "a" }, { id: "b" }] } },
			update: vi.fn()
		};

		sheet._onEntryRemove({ currentTarget: { dataset: { list: "assets", entryId: "a" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.assets": [{ id: "b" }] });
	});
});

describe("WorldActorSheet#_onEntryFieldChange", () => {
	it("writes a text input's value to the matching entry's field", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { assets: [{ id: "a", name: "Old" }] } },
			update: vi.fn()
		};

		sheet._onEntryFieldChange({
			currentTarget: { type: "text", value: "New", dataset: { list: "assets", entryId: "a", field: "name" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.assets": [{ id: "a", name: "New" }]
		});
	});

	it("writes a checkbox's checked state to the matching entry's field", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "a", exhausted: false }] } },
			update: vi.fn()
		};

		sheet._onEntryFieldChange({
			currentTarget: { type: "checkbox", checked: true, dataset: { list: "factions", entryId: "a", field: "exhausted" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.factions": [{ id: "a", exhausted: true }]
		});
	});
});

describe("WorldActorSheet#_onEntryCounterStep", () => {
	it("increments the matching entry's field", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 2 }] } },
			update: vi.fn()
		};

		sheet._onEntryCounterStep({
			currentTarget: { dataset: { list: "divisions", entryId: "d1", field: "strength", delta: "1", min: "0", max: "5" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.divisions": [{ id: "d1", strength: 3 }]
		});
	});

	it("clamps at the given maximum", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 5 }] } },
			update: vi.fn()
		};

		sheet._onEntryCounterStep({
			currentTarget: { dataset: { list: "divisions", entryId: "d1", field: "strength", delta: "1", min: "0", max: "5" } }
		});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the given minimum", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "f1", grip: 0 }] } },
			update: vi.fn()
		};

		sheet._onEntryCounterStep({
			currentTarget: { dataset: { list: "factions", entryId: "f1", field: "grip", delta: "-1", min: "0", max: "3" } }
		});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing field value as the minimum", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { factions: [{ id: "f1" }] } },
			update: vi.fn()
		};

		sheet._onEntryCounterStep({
			currentTarget: { dataset: { list: "factions", entryId: "f1", field: "grip", delta: "1", min: "0", max: "3" } }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.factions": [{ id: "f1", grip: 1 }]
		});
	});

	it("does nothing when no entry matches the given id", () => {
		const sheet = new WorldActorSheet();
		sheet.actor = {
			system: { attributes: { divisions: [{ id: "d1", strength: 2 }] } },
			update: vi.fn()
		};

		sheet._onEntryCounterStep({
			currentTarget: { dataset: { list: "divisions", entryId: "missing", field: "strength", delta: "1", min: "0", max: "5" } }
		});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});
