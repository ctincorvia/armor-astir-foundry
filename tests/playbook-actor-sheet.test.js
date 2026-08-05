import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { GRAVITY_TRIGGERS } from "../scripts/playbook/gravity-triggers.js";
import { PLAYBOOK_FLAVOR, defaultConsiderText, defaultLookText } from "../scripts/playbook/playbook-flavor.js";
import { PlaybookActorSheet, registerPlaybookActorSheet } from "../scripts/playbook/playbook-actor-sheet.js";

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
			width: 760,
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }],
			scrollY: [".sheet-body"]
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

	it("scopes the approach options to the actor's playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-impostor" } } };

		const data = sheet.getData();

		expect(data.approachOptions.map((a) => a.key)).toEqual(["arcane", "elemental"]);
	});

	it("gives the actor's playbook its gravity trigger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-commander" } } };

		const data = sheet.getData();

		expect(data.gravityTrigger).toBe(GRAVITY_TRIGGERS["the-commander"]);
	});

	it("falls back to null gravity trigger when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.gravityTrigger).toBeNull();
	});

	it("seeds Look/Consider with the playbook's flavor prompts when the actor has none saved", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { slug: "the-scout" } } };

		const data = sheet.getData();

		expect(data.lookText).toBe(defaultLookText("the-scout"));
		expect(data.considerText).toBe(defaultConsiderText("the-scout"));
		expect(PLAYBOOK_FLAVOR["the-scout"].look.length).toBeGreaterThan(0);
	});

	it("falls back to empty Look/Consider text when the actor has no playbook set", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.lookText).toBe("");
		expect(data.considerText).toBe("");
	});

	it("prefers the actor's own saved Look/Consider text over the playbook's flavor prompts", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				playbook: { slug: "the-scout" },
				details: { look: { value: "<p>My own look</p>" }, consider: { value: "<p>My own answer</p>" } }
			}
		};

		const data = sheet.getData();

		expect(data.lookText).toBe("<p>My own look</p>");
		expect(data.considerText).toBe("<p>My own answer</p>");
	});

	it("defaults an actor with no picked moves and no Astir to Tier 1", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 1, effective: 1, fromFrame: false });
	});

	it("raises base Tier off a picked move's conflictTier, e.g. Field Scout", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: ["the-scout:field-scout"] } } };

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 2, fromFrame: false });
	});

	it("takes the higher of two conflictTier moves rather than the last one picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-scout:field-scout", "the-scout:giant-slayer"] } }
		};

		const data = sheet.getData();

		expect(data.tier.base).toBe(3);
	});

	it("reads Tier off the Astir instead of base while piloted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					astir: { tier: 4, piloted: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 4, fromFrame: true, frameName: "Vanguard" });
	});

	it("reads Tier off an Ardent instead of base while it's the mounted frame", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			name: "Vanguard",
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					ardents: [{ id: "ar1", name: "Warhound", tier: 3, piloted: true }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 3, fromFrame: true, frameName: "Warhound" });
	});

	it("reverts to base Tier once dismounted", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: ["the-scout:field-scout"],
					astir: { tier: 4, piloted: false }
				}
			}
		};

		const data = sheet.getData();

		expect(data.tier).toEqual({ base: 2, effective: 2, fromFrame: false });
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

describe("PlaybookActorSheet#_seedCosmeticDefaults", () => {
	it("writes both Look and Consider defaults for an owned actor with neither stored", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: true, system: { playbook: { slug: "the-scout" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).toHaveBeenCalledWith({
			"system.details.look.value": defaultLookText("the-scout"),
			"system.details.consider.value": defaultConsiderText("the-scout")
		});
	});

	it("does nothing for an actor the current user doesn't own", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: false, system: { playbook: { slug: "the-scout" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
	});

	it("does not resurrect a field the player deliberately cleared to an empty string", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = {
			isOwner: true,
			system: { playbook: { slug: "the-scout" }, details: { look: { value: "" }, consider: { value: "" } } },
			update
		};

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
	});

	it("only seeds the one field still missing when the other is already stored", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = {
			isOwner: true,
			system: { playbook: { slug: "the-scout" }, details: { look: { value: "<p>Mine</p>" } } },
			update
		};

		sheet._seedCosmeticDefaults();

		expect(update).toHaveBeenCalledWith({ "system.details.consider.value": defaultConsiderText("the-scout") });
	});

	it("does nothing for a playbook with no flavor prompts to seed", () => {
		const sheet = new PlaybookActorSheet();
		const update = vi.fn();
		sheet.actor = { isOwner: true, system: { playbook: { slug: "not-a-real-playbook" } }, update };

		sheet._seedCosmeticDefaults();

		expect(update).not.toHaveBeenCalled();
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
