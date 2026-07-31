import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { PlaybookActorSheet, registerPlaybookActorSheet } from "../scripts/playbook-actor-sheet.js";

beforeEach(() => {
	swapActorPlaybook.mockClear();
});

describe("PlaybookActorSheet", () => {
	it("extends the core ActorSheet", () => {
		expect(PlaybookActorSheet.prototype instanceof ActorSheet).toBe(true);
	});
});

describe("PlaybookActorSheet.defaultOptions", () => {
	it("merges the playbook sheet's classes/template/size onto the base options", () => {
		const options = PlaybookActorSheet.defaultOptions;

		expect(options).toEqual({
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: "modules/armor-astir/templates/playbook-actor-sheet.hbs",
			width: 420,
			height: "auto"
		});
	});
});

describe("registerPlaybookActorSheet", () => {
	it("registers the sheet as the default character sheet on init", () => {
		registerPlaybookActorSheet();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));

		const callback = Hooks.once.mock.calls.at(-1)[1];
		callback();

		expect(Actors.registerSheet).toHaveBeenCalledWith("pbta", PlaybookActorSheet, {
			types: ["character"],
			makeDefault: true
		});
	});
});

describe("PlaybookActorSheet#getData", () => {
	it("adds the playbook list and the actor's current playbook id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[1].name } } };

		const data = sheet.getData();

		expect(data.playbooks).toBe(PLAYBOOKS);
		expect(data.currentPlaybookId).toBe(PLAYBOOKS[1].packId);
	});

	it("falls back to null when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.currentPlaybookId).toBeNull();
	});
});

describe("PlaybookActorSheet#activateListeners", () => {
	it("binds a change handler to the playbook select", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-select");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPlaybookChange", () => {
	it("swaps the actor to the selected playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		sheet._onPlaybookChange({ currentTarget: { value: PLAYBOOKS[1].packId } });

		expect(swapActorPlaybook).toHaveBeenCalledWith(sheet.actor, PLAYBOOKS[1]);
	});

	it("does nothing for an unrecognized value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: {} } };

		sheet._onPlaybookChange({ currentTarget: { value: "not-a-real-pack" } });

		expect(swapActorPlaybook).not.toHaveBeenCalled();
	});
});
