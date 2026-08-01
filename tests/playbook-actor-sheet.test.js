import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

vi.mock("../scripts/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postGuidedResult: vi.fn(),
	postMoveDescription: vi.fn(),
	rollMove: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and resolvePlaybookMoves stay real, so
// the sheet is exercised against the actual move content.
vi.mock("../scripts/playbook-moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	choosePlaybookMove: vi.fn()
}));

// Only the editor and catalog picker dialogs are mocked — the tag catalog, item catalog, and
// resolve helpers stay real, so the sheet is exercised against the actual Blitz/placeholder
// content, same reasoning as playbook-moves.js above.
vi.mock("../scripts/equipment.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureEquipment: vi.fn(),
	chooseEquipmentCatalogItem: vi.fn(),
	chooseWeapon: vi.fn()
}));

// Only the picker dialog is mocked — the pool definitions and findStartingGearPool stay real, same
// reasoning as playbook-moves.js above.
vi.mock("../scripts/starting-gear.js", async (importOriginal) => ({
	...(await importOriginal()),
	chooseStartingGear: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postGuidedResult, postMoveDescription, rollMove } from "../scripts/moves.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../scripts/advancements.js";
import { ALL_PLAYBOOK_MOVES, choosePlaybookMove } from "../scripts/playbook-moves.js";
import { UNARMED, chooseEquipmentCatalogItem, chooseWeapon, configureEquipment } from "../scripts/equipment.js";
import { STARTING_GEAR_POOLS, chooseStartingGear } from "../scripts/starting-gear.js";
import { GRAVITY_TRIGGERS } from "../scripts/gravity-triggers.js";
import {
	PlaybookActorSheet,
	registerPlaybookActorSheet,
	registerMoveChatListeners,
	onRenderMoveChat,
	mergeSpentTags,
	TRAITS
} from "../scripts/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const STRIKE_DECISIVELY = BASIC_MOVES.find((m) => m.key === "strike-decisively");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");
const BULLHEADED = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-scout:bullheaded");
const DENY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:deny");
const SEEK_ALLIES = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:seek-allies");
const PERSONAL_FAMILIAR = ALL_PLAYBOOK_MOVES.find((m) => m.key === "cantrips:personal-familiar");

beforeEach(() => {
	swapActorPlaybook.mockClear();
	configureMoveRoll.mockClear();
	postGuidedResult.mockClear();
	postMoveDescription.mockClear();
	rollMove.mockClear();
	choosePlaybookMove.mockClear();
	configureEquipment.mockClear();
	chooseEquipmentCatalogItem.mockClear();
	chooseWeapon.mockClear();
	chooseStartingGear.mockClear();
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
			width: 720,
			height: "auto",
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
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

function fakeChatHtml() {
	const state = { handler: null };
	state.html = {
		find: (selector) => (selector === ".move-reroll"
			? { on: (event, handler) => { state.handler = handler; } }
			: {})
	};
	return state;
}

describe("registerMoveChatListeners", () => {
	it("registers a renderChatMessage hook wired to onRenderMoveChat", () => {
		registerMoveChatListeners();

		expect(Hooks.on).toHaveBeenCalledWith("renderChatMessage", onRenderMoveChat);
	});
});

describe("onRenderMoveChat (Decisive/Defensive/Versatile reroll)", () => {
	it("does nothing for a message with no reroll offer", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.handler).toBeNull();
	});

	it("does nothing for a message with no flags at all", () => {
		const fake = fakeChatHtml();

		expect(() => onRenderMoveChat({}, fake.html)).not.toThrow();
		expect(fake.handler).toBeNull();
	});

	it("wires the Reroll button, disabling it on click and rerunning the move", async () => {
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", tags: ["defensive"], spent: [] };
		const actor = { id: "actor1", system: { attributes: { equipment: [rifle] } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: { key: "clash", label: "CLASH", value: 0 },
			equipmentId: "eq1",
			tagKey: "defensive",
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle" }
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		const button = { disabled: false };
		fake.handler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["defensive"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(actor, EXCHANGE_BLOWS, reroll.trait, reroll.options);
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const reroll = {
			actorId: "gone", moveKey: "exchange-blows", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1", moveKey: "not-a-real-move", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("treats a missing equipment array as empty when marking the reroll tag spent", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1", moveKey: "exchange-blows", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: { "armor-astir": { reroll } } }, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
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

describe("PlaybookActorSheet#getData - traits", () => {
	it("defaults every trait to value 0 and enabled when system.stats is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.traits).toEqual(TRAITS.map(({ key, label }) => ({ key, label, value: 0, disabled: false })));
	});

	it("reflects each trait's stored value and disabled flag", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {
					defy: { value: 2 },
					channel: { value: 0, disabled: true }
				}
			}
		};

		const data = sheet.getData();

		expect(data.traits.find((t) => t.key === "defy")).toEqual({ key: "defy", label: "DEFY", value: 2, disabled: false });
		expect(data.traits.find((t) => t.key === "channel")).toEqual({ key: "channel", label: "CHANNEL", value: 0, disabled: true });
	});
});

describe("PlaybookActorSheet#getData - overheating", () => {
	it("is visible when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.overheating).toEqual({ visible: true, value: false });
	});

	it("is visible when channel is explicitly enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.overheating.visible).toBe(true);
	});

	it("is hidden when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.overheating.visible).toBe(false);
	});

	it("reflects the actor's stored overheating value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { overheating: { value: true } } } };

		const data = sheet.getData();

		expect(data.overheating.value).toBe(true);
	});
});

describe("PlaybookActorSheet#activateListeners - overheating", () => {
	it("binds a change handler to the overheating checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".overheating-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onOverheatingToggle", () => {
	it("writes the checkbox's checked state to the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onOverheatingToggle({ currentTarget: { checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.overheating.value": true });
	});

	it("writes false when the checkbox is unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { overheating: { value: true } } }, update: vi.fn() };

		sheet._onOverheatingToggle({ currentTarget: { checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.overheating.value": false });
	});
});

describe("PlaybookActorSheet#getData - advancements", () => {
	it("defaults every top and bottom item to unchecked when attributes are missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.top.every((item) => item.checked === false)).toBe(true);
		expect(data.advancements.bottom.every((item) => item.checked === false)).toBe(true);
	});

	it("defaults topCount to 0 and unlocked to false when nothing is checked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(0);
		expect(data.advancements.unlocked).toBe(false);
	});

	it("reflects a stored true value on the matching top item only", () => {
		const key = ADVANCEMENT_TOP[1].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [key]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.top.find((item) => item.key === key).checked).toBe(true);
		expect(
			data.advancements.top.filter((item) => item.key !== key).every((item) => item.checked === false)
		).toBe(true);
	});

	it("counts exactly the checked top keys", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = { [ADVANCEMENT_TOP[0].key]: true, [ADVANCEMENT_TOP[1].key]: true };
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
	});

	it("keeps the bottom group locked when topCount is one below the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 2).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(2);
		expect(data.advancements.unlocked).toBe(false);
		expect(data.advancements.bottom.every((item) => item.locked === true)).toBe(true);
	});

	it("unlocks the bottom group once topCount reaches the threshold", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.slice(0, 3).forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(3);
		expect(data.advancements.unlocked).toBe(true);
		expect(data.advancements.bottom.every((item) => item.locked === false)).toBe(true);
	});

	it("stays unlocked when every top item is checked", () => {
		const sheet = new PlaybookActorSheet();
		const advancements = {};
		ADVANCEMENT_TOP.forEach((item) => {
			advancements[item.key] = true;
		});
		sheet.actor = { system: { stats: {}, attributes: { advancements } } };

		const data = sheet.getData();

		expect(data.advancements.topCount).toBe(ADVANCEMENT_TOP.length);
		expect(data.advancements.unlocked).toBe(true);
	});

	it("keeps a bottom item's stored checked state even while its row is locked", () => {
		const bottomKey = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { advancements: { [bottomKey]: true } } } };

		const data = sheet.getData();

		expect(data.advancements.unlocked).toBe(false);
		const item = data.advancements.bottom.find((entry) => entry.key === bottomKey);
		expect(item.checked).toBe(true);
		expect(item.locked).toBe(true);
	});

	it("exposes the unlock threshold", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.advancements.unlockThreshold).toBe(3);
	});
});

describe("PlaybookActorSheet#activateListeners - advancements", () => {
	it("binds a change handler to the advancement checkboxes", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".advancement-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onAdvancementToggle", () => {
	it("writes true to the matching top advancement key when checked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});

	it("writes false to the matching top advancement key when unchecked", () => {
		const key = ADVANCEMENT_TOP[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { advancements: { [key]: true } } }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: false, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: false });
	});

	it("writes to the matching bottom advancement key", () => {
		const key = ADVANCEMENT_BOTTOM[0].key;
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onAdvancementToggle({ currentTarget: { checked: true, dataset: { advancementKey: key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ [`system.attributes.advancements.${key}`]: true });
	});
});

describe("PlaybookActorSheet#getData - power", () => {
	it("is visible when channel is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.power).toEqual({ visible: true, value: 0 });
	});

	it("is hidden when channel is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.power.visible).toBe(false);
	});

	it("reflects the actor's stored power value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, attributes: { power: { value: 3 } } } };

		const data = sheet.getData();

		expect(data.power.value).toBe(3);
	});
});

describe("PlaybookActorSheet#activateListeners - power step", () => {
	it("binds a click handler to the power step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".power-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPowerStep", () => {
	it("increments the power value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 1 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 2 });
	});

	it("decrements the power value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 1 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 0 });
	});

	it("treats a missing power value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.power.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 4 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { power: { value: 0 } } }, update: vi.fn() };

		sheet._onPowerStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - spotlight", () => {
	it("defaults to value 0 with every step unfilled when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 0,
			steps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
		});
	});

	it("reflects the actor's stored spotlight value, filling steps up to it", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } } };

		const data = sheet.getData();

		expect(data.spotlight).toEqual({
			value: 3,
			steps: [
				{ step: 1, filled: true },
				{ step: 2, filled: true },
				{ step: 3, filled: true },
				{ step: 4, filled: false },
				{ step: 5, filled: false },
				{ step: 6, filled: false }
			]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - spotlight step", () => {
	it("binds a click handler to the spotlight step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".spotlight-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onSpotlightStep", () => {
	it("fills the track up to a clicked step above the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 4 });
	});

	it("empties the track down to a clicked step below the current value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 5 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 3 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clears to 0 when clicking step 1 while it's the only filled step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 1 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 0 });
	});

	it("treats a missing spotlight value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.spotlight.value": 2 });
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { spotlight: { value: 6 } } }, update: vi.fn() };

		sheet._onSpotlightStep({ currentTarget: { dataset: { step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - dangers", () => {
	it("defaults to an empty list, not at max, and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.dangers).toEqual({ max: 3, list: [], atMax: false, canAdd: true });
	});

	it("marks each danger as a peril or a risk based on its stored type", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "Exposed position" },
						{ id: "2", type: "risk", label: "Low on ammo" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.list).toEqual([
			{ id: "1", type: "peril", label: "Exposed position", isPeril: true },
			{ id: "2", type: "risk", label: "Low on ammo", isPeril: false }
		]);
	});

	it("reports atMax and hides canAdd once the actor has 3 dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.dangers.atMax).toBe(true);
		expect(data.dangers.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - dangers", () => {
	it("binds click handlers to the danger add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".danger-add");
		expect(html.find).toHaveBeenCalledWith(".danger-remove");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

// Fakes the DOM traversal _onDangerAdd uses to read the label/type inputs sitting next to the
// clicked Add button (closest(".danger-add-controls") -> querySelector(...)), since there's no
// single value to encode on the button's own dataset the way every other control on this sheet
// does.
function fakeDangerAddEvent({ label, type = "risk" }) {
	const labelInput = { value: label };
	const typeSelect = { value: type };
	return {
		currentTarget: {
			closest: () => ({
				querySelector: (selector) => (selector === ".danger-label-input" ? labelInput : typeSelect)
			})
		},
		labelInput
	};
}

describe("PlaybookActorSheet#_onDangerAdd", () => {
	it("appends a new danger with a generated id and clears the label input", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { labelInput, ...event } = fakeDangerAddEvent({ label: "Exposed position", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "peril", label: "Exposed position" }]
		});
		expect(labelInput.value).toBe("");
	});

	it("appends to, rather than replaces, existing dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "existing", type: "risk", label: "Low on ammo" }] } },
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "Losing blood", type: "peril" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [
				{ id: "existing", type: "risk", label: "Low on ammo" },
				{ id: "test-id", type: "peril", label: "Losing blood" }
			]
		});
	});

	it("trims the label and does nothing when it's blank", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { dangers: [] } }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "   " });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing once the actor already has the maximum dangers", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "risk", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			},
			update: vi.fn()
		};
		const { ...event } = fakeDangerAddEvent({ label: "One more" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing dangers array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };
		const { ...event } = fakeDangerAddEvent({ label: "First danger", type: "risk" });

		sheet._onDangerAdd(event);

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "risk", label: "First danger" }]
		});
	});
});

describe("PlaybookActorSheet#_onDangerRemove", () => {
	it("removes the danger matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					dangers: [
						{ id: "1", type: "risk", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "2", type: "peril", label: "b" }]
		});
	});

	it("leaves the list untouched when the id doesn't match any danger", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { dangers: [{ id: "1", type: "risk", label: "a" }] } },
			update: vi.fn()
		};

		sheet._onDangerRemove({ currentTarget: { dataset: { dangerId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "1", type: "risk", label: "a" }]
		});
	});
});

describe("PlaybookActorSheet#getData - gravity clocks", () => {
	it("defaults to an empty list and able to add when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.gravityClocks).toEqual({ max: 5, canAdd: true, list: [] });
	});

	it("expands each clock's stored progress into a Spotlight-style steps array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "The Council Turns", progress: 2, value: 1 },
						{ id: "2", label: "Fuel Runs Out", progress: 0, value: 3 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list).toEqual([
			{
				id: "1",
				label: "The Council Turns",
				progress: 2,
				value: 1,
				progressSteps: [
					{ step: 1, filled: true },
					{ step: 2, filled: true },
					{ step: 3, filled: false },
					{ step: 4, filled: false },
					{ step: 5, filled: false },
					{ step: 6, filled: false }
				]
			},
			{
				id: "2",
				label: "Fuel Runs Out",
				progress: 0,
				value: 3,
				progressSteps: [1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false }))
			}
		]);
	});

	it("treats a clock with no stored progress as starting at 0 when expanding steps", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "New clock", value: 1 }] } }
		};

		const data = sheet.getData();

		expect(data.gravityClocks.list[0].progressSteps).toEqual([1, 2, 3, 4, 5, 6].map((step) => ({ step, filled: false })));
	});

	it("hides canAdd once the actor has 5 gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			}
		};

		const data = sheet.getData();

		expect(data.gravityClocks.canAdd).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - gravity clocks", () => {
	it("binds handlers to the add, remove, label, value step, and progress step controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".gravity-clock-add");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-remove");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-label-input");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-value-step");
		expect(html.find).toHaveBeenCalledWith(".gravity-clock-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onGravityClockAdd", () => {
	it("appends a new clock with a generated id and default progress/value", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { gravityClocks: [] } }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("appends to, rather than replaces, existing clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "existing", label: "Existing", progress: 3, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "existing", label: "Existing", progress: 3, value: 2 },
				{ id: "test-id", label: "", progress: 0, value: 1 }
			]
		});
	});

	it("treats a missing gravityClocks array as starting empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "test-id", label: "", progress: 0, value: 1 }]
		});
	});

	it("does nothing once the actor already has the maximum gravity clocks", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, label: "", progress: 0, value: 1 }))
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockAdd({});

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onGravityClockRemove", () => {
	it("removes the clock matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "2", label: "b", progress: 0, value: 1 }]
		});
	});

	it("leaves the list untouched when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockRemove({ currentTarget: { dataset: { clockId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockLabelChange", () => {
	it("trims and updates only the matching clock's label", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "Old label", progress: 0, value: 1 },
						{ id: "2", label: "Untouched", progress: 0, value: 1 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockLabelChange({ currentTarget: { dataset: { clockId: "1" }, value: "  New label  " } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "New label", progress: 0, value: 1 },
				{ id: "2", label: "Untouched", progress: 0, value: 1 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockValueStep", () => {
	it("increments the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("decrements the matching clock's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 2 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 1 }]
		});
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 3 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "not-a-real-id", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing value as starting at the minimum", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 0, value: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 0, value: 1 },
						{ id: "2", label: "b", progress: 0, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockValueStep({ currentTarget: { dataset: { clockId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 0, value: 2 },
				{ id: "2", label: "b", progress: 0, value: 2 }
			]
		});
	});
});

describe("PlaybookActorSheet#_onGravityClockStep", () => {
	it("fills the matching clock's track up to a clicked step above the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 1, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 4, value: 1 }]
		});
	});

	it("empties the matching clock's track down to a clicked step below the current progress", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 5, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("decrements by one when clicking the current top (highest filled) step", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 3, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "3" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", progress: 2, value: 1 }]
		});
	});

	it("clamps a step beyond the track's max and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 6, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "7" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing progress value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "2" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [{ id: "1", label: "a", value: 1, progress: 2 }]
		});
	});

	it("does not affect other clocks in the list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					gravityClocks: [
						{ id: "1", label: "a", progress: 1, value: 1 },
						{ id: "2", label: "b", progress: 3, value: 2 }
					]
				}
			},
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "1", step: "4" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.gravityClocks": [
				{ id: "1", label: "a", progress: 4, value: 1 },
				{ id: "2", label: "b", progress: 3, value: 2 }
			]
		});
	});

	it("does nothing when the id doesn't match any clock", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { gravityClocks: [{ id: "1", label: "a", progress: 0, value: 1 }] } },
			update: vi.fn()
		};

		sheet._onGravityClockStep({ currentTarget: { dataset: { clockId: "not-a-real-id", step: "2" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - equipment", () => {
	it("defaults to empty weapons/gear lists, with tierMin/tierMax, when attributes is empty", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment).toEqual({
			tierMin: 1,
			tierMax: 5,
			weapons: [],
			gear: [],
			startingGear: { available: false }
		});
	});

	it("makes starting gear available for a playbook whose pool has items or a custom weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: true });
	});

	it("hides starting gear for a playbook whose pool has neither items nor a custom weapon", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" }, attributes: {} } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("hides starting gear for good once startingGearChosen is set, even if the pool still has content", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { startingGearChosen: true } } };

		const data = sheet.getData();

		expect(data.equipment.startingGear).toEqual({ available: false });
	});

	it("partitions equipment into weapons and gear by kind", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 2 },
						{ id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons.map((w) => w.id)).toEqual(["1"]);
		expect(data.equipment.gear.map((g) => g.id)).toEqual(["2"]);
	});

	it("resolves a weapon's tags, value, scale label, and tier", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{
							id: "1",
							kind: "weapon",
							name: "Halberd",
							description: "A long blade.",
							tags: ["blitz"],
							spent: [],
							scale: "astir",
							tier: 3
						}
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons).toEqual([
			{
				id: "1",
				kind: "weapon",
				name: "Halberd",
				description: "A long blade.",
				tags: [
					{
						key: "blitz",
						label: "Blitz",
						value: 1,
						description: "You may spend this tag once per Scene to make a move with confidence.",
						spendable: true,
						spent: false
					}
				],
				value: 1,
				scale: "astir",
				scaleLabel: "Astir Scale",
				tier: 3,
				weaponMoves: [
					{ key: "exchange-blows", name: "Exchange Blows", gated: false },
					{ key: "strike-decisively", name: "Strike Decisively", gated: false }
				]
			}
		]);
	});

	it("marks a forcesEffect-only tag (e.g. Unreliable) spendable, same as a player-opted spend", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spendable).toBe(true);
	});

	it("marks a tag spent when its key is in the entry's spent array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].tags[0].spent).toBe(true);
	});

	it("omits scale, scaleLabel, and tier for gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0]).toEqual({
			id: "1",
			kind: "gear",
			name: "Rations",
			description: "",
			tags: [],
			value: 0
		});
	});

	it("falls back to the raw scale key when it doesn't match a known WEAPON_SCALES entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [{ id: "1", kind: "weapon", name: "Odd", description: "", tags: [], spent: [], scale: "orbital", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].scaleLabel).toBe("orbital");
	});

	it("treats a missing tags array as having no tags", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { equipment: [{ id: "1", kind: "gear", name: "Odd", description: "", spent: [] }] } }
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags).toEqual([]);
		expect(data.equipment.gear[0].value).toBe(0);
	});

	it("drops a tag key that no longer resolves in the catalog", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					equipment: [
						{ id: "1", kind: "gear", name: "Odd", description: "", tags: ["blitz", "stale-key"], spent: [] }
					]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].tags.map((t) => t.key)).toEqual(["blitz"]);
		expect(data.equipment.gear[0].value).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - equipment", () => {
	it("binds handlers to the add, catalog add, edit, remove, tier step, and tag spent controls", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".equipment-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-catalog-add");
		expect(html.find).toHaveBeenCalledWith(".starting-gear-add");
		expect(html.find).toHaveBeenCalledWith(".equipment-edit");
		expect(html.find).toHaveBeenCalledWith(".equipment-remove");
		expect(html.find).toHaveBeenCalledWith(".equipment-tier-step");
		expect(html.find).toHaveBeenCalledWith(".equipment-tag-spent-checkbox");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onEquipmentAdd", () => {
	it("appends a new entry, generating its id and starting spent empty", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" });
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], name: "Halberd", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rope", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], name: "Rope", description: "", kind: "gear", tags: [] }
			]
		});
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onEquipmentCatalogAdd", () => {
	const template = { name: "Halberd", description: "A long blade.", kind: "weapon", tags: [], scale: "foot", tier: 2 };

	it("opens the catalog picker for the clicked section's kind, then the editor pre-filled with the pick", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue({ ...template, name: "Halberd (renamed)" });

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(chooseEquipmentCatalogItem).toHaveBeenCalledWith("weapon");
		expect(configureEquipment).toHaveBeenCalledWith(template);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...template, name: "Halberd (renamed)" }]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(template);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [existing, { id: "test-id", spent: [], ...template }]
		});
	});

	it("does not open the editor, and does not update the actor, when the catalog picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "gear" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the pre-filled editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };
		chooseEquipmentCatalogItem.mockResolvedValue(template);
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentCatalogAdd({ currentTarget: { dataset: { kind: "weapon" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onStartingGearAdd", () => {
	const scoutPool = STARTING_GEAR_POOLS.find((pool) => pool.playbookName === "The Scout");
	const [firstItem, secondItem] = scoutPool.items;
	const weaponResult = { name: "Custom Blade", description: "", kind: "weapon", tags: [], scale: "foot", tier: 1 };

	it("does nothing for a playbook with no starting gear pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "Not a Real Playbook" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a pool with neither items nor a custom weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Commander" }, attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).not.toHaveBeenCalled();
		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("opens the gear picker, then the custom weapon editor with the pool's guidance note", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(chooseStartingGear).toHaveBeenCalledWith("The Scout");
		expect(configureEquipment).toHaveBeenCalledWith({ kind: "weapon" }, undefined, { note: scoutPool.customWeaponNote });
	});

	it("appends picked pool items as new gear entries when the weapon editor is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem, secondItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], kind: "gear", name: secondItem.name, description: secondItem.description, tags: [] }
			]
		});
	});

	it("appends the custom weapon when the gear picker is cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [{ id: "test-id", spent: [], ...weaponResult }]
		});
	});

	it("appends both the picked gear and the custom weapon in a single update", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(weaponResult);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledTimes(1);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] },
				{ id: "test-id", spent: [], ...weaponResult }
			]
		});
	});

	it("appends to, rather than replaces, existing equipment", async () => {
		const sheet = new PlaybookActorSheet();
		const existing = { id: "existing", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [existing] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue([firstItem]);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.startingGearChosen": true,
			"system.attributes.equipment": [
				existing,
				{ id: "test-id", spent: [], kind: "gear", name: firstItem.name, description: firstItem.description, tags: [] }
			]
		});
	});

	it("still marks startingGearChosen, without touching equipment, when both dialogs are cancelled", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" }, attributes: { equipment: [] } }, update: vi.fn() };
		chooseStartingGear.mockResolvedValue(null);
		configureEquipment.mockResolvedValue(null);

		await sheet._onStartingGearAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.startingGearChosen": true });
	});
});

describe("PlaybookActorSheet#_onEquipmentEdit", () => {
	it("replaces the matching entry wholesale, keeping only its id and spent array, leaving other entries untouched", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(configureEquipment).toHaveBeenCalledWith(entry);
		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [
				{ id: "1", spent: ["blitz"], name: "Rations", description: "", kind: "gear", tags: [] },
				other
			]
		});
	});

	it("treats a missing spent array on the edited entry as empty", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Odd", description: "", tags: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue({ name: "Rations", description: "", kind: "gear", tags: [] });

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ id: "1", spent: [], name: "Rations", description: "", kind: "gear", tags: [] }]
		});
	});

	it("does nothing for an id that doesn't match any entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(configureEquipment).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not update the actor when the dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };
		configureEquipment.mockResolvedValue(null);

		await sheet._onEquipmentEdit({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onEquipmentRemove", () => {
	it("removes the entry matching the clicked button's id", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		const b = { id: "2", kind: "gear", name: "b", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a, b] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [b] });
	});

	it("leaves the list untouched when the id doesn't match any entry", () => {
		const sheet = new PlaybookActorSheet();
		const a = { id: "1", kind: "gear", name: "a", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [a] } }, update: vi.fn() };

		sheet._onEquipmentRemove({ currentTarget: { dataset: { equipmentId: "not-a-real-id" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [a] });
	});
});

describe("PlaybookActorSheet#_onEquipmentTierStep", () => {
	it("increments the matching entry's tier, leaving other entries untouched", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 2 };
		const other = { id: "2", kind: "gear", name: "Rope", description: "", tags: [], spent: [] };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, tier: 3 }, other]
		});
	});

	it("clamps at the maximum tier and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 5 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum tier and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for an id that doesn't match any entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "not-a-real-id", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("treats a missing tier as starting at the minimum", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot" };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTierStep({ currentTarget: { dataset: { equipmentId: "1", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, tier: 2 }]
		});
	});
});

describe("PlaybookActorSheet#_onEquipmentTagSpentToggle", () => {
	it("adds the tag key to the entry's spent array when checked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("treats a missing spent array as empty when checking a tag", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not duplicate an already-spent tag key", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("removes the tag key from the entry's spent array when unchecked", () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: false } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: [] }]
		});
	});

	it("leaves entries that don't match the toggled id untouched", () => {
		const sheet = new PlaybookActorSheet();
		const other = { id: "2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		const entry = { id: "1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = { system: { attributes: { equipment: [entry, other] } }, update: vi.fn() };

		sheet._onEquipmentTagSpentToggle({ currentTarget: { dataset: { equipmentId: "1", tag: "blitz" }, checked: true } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }, other]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - trait steps", () => {
	it("binds a click handler to the trait step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".trait-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onTraitStep", () => {
	it("increments the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("decrements the trait's value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": -1 });
	});

	it("treats a missing stat as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.stats.defy.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: 3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { defy: { value: -3 } } }, update: vi.fn() };

		sheet._onTraitStep({ currentTarget: { dataset: { trait: "defy", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - moves", () => {
	it("exposes basic moves grouped, with each move's currently enabled traits and values", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: -1 } } } };

		const data = sheet.getData();

		expect(data.moveGroups).toEqual([
			{
				label: "Basic Moves",
				moves: [
					{
						key: "exchange-blows",
						name: "Exchange Blows",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "weather-the-storm",
						name: "Weather the Storm",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "read-the-room",
						name: "Read the Room",
						traits: [
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: true,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "dispel-uncertainties",
						name: "Dispel Uncertainties",
						traits: [
							{ key: "know", label: "KNOW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "help-or-hinder",
						name: "Help or Hinder",
						traits: [],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "weave-magic",
						name: "Weave Magic",
						// channel isn't in this actor's stats at all — same as any other missing stat,
						// that reads as enabled rather than gated (see availableMoveTraits).
						traits: [
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "cool-off",
						name: "Cool Off",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "sense", label: "SENSE", value: 0 },
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 },
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "channel", label: "CHANNEL", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "strike-decisively",
						name: "Strike Decisively",
						traits: [
							{ key: "clash", label: "CLASH", value: 1 },
							{ key: "talk", label: "TALK", value: -1 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "bite-the-dust",
						name: "Bite the Dust",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					}
				]
			},
			{
				label: "Special Moves",
				moves: [
					{
						key: "lead-a-sortie",
						name: "Lead a Sortie",
						traits: [
							{ key: "know", label: "KNOW", value: 0 },
							{ key: "defy", label: "DEFY", value: 0 },
							{ key: "crew", label: "CREW", value: 0 }
						],
						gated: false,
						rollable: true,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "subsystems",
						name: "Subsystems",
						traits: [],
						gated: false,
						rollable: false,
						activatable: false,
						descriptionGated: false,
						trackHold: false,
						separateHoldPool: false,
						hold: 0,
						uses: []
					},
					{
						key: "b-plot",
						name: "B-Plot",
						traits: [],
						// channel isn't in this actor's stats at all, which reads as enabled — so
						// b-plot is gated here, the mirror image of weave-magic above.
						gated: true,
						rollable: false,
						activatable: true,
						descriptionGated: true,
						trackHold: true,
						separateHoldPool: true,
						hold: 0,
						uses: []
					}
				]
			},
			// Empty until the player picks something with the "+" — no playbook starts with any
			// playbook moves. addable/removable are what render that "+" and each row's ✕.
			{
				label: "Playbook Moves",
				moves: [],
				addable: true,
				removable: true
			}
		]);
	});

	it("omits a move's disabled traits from the trait list", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 0 } } } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves[0].traits).toEqual([{ key: "talk", label: "TALK", value: 0 }]);
	});
});

describe("PlaybookActorSheet#getData - playbook moves", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("starts empty, since no playbook grants playbook moves by default", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		expect(playbookGroup(sheet.getData()).moves).toEqual([]);
	});

	it("marks only the playbook group as addable and removable", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const groups = sheet.getData().moveGroups;

		expect(groups.filter((group) => group.addable).map((group) => group.label)).toEqual(["Playbook Moves"]);
		expect(groups.filter((group) => group.removable).map((group) => group.label)).toEqual(["Playbook Moves"]);
	});

	it("renders the moves the actor has picked, in the order they were picked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 2 } },
				attributes: { playbookMoves: [DENY.key, BULLHEADED.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key))
			.toEqual([DENY.key, BULLHEADED.key]);
	});

	it("gives a picked move the same shape as a basic move, so it rolls the same way", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { channel: { value: 2 } }, attributes: { playbookMoves: [DENY.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves[0]).toEqual({
			key: DENY.key,
			name: "Deny",
			traits: [{ key: "channel", label: "CHANNEL", value: 2 }],
			gated: false,
			rollable: true,
			activatable: false,
			descriptionGated: false,
			trackHold: false,
			separateHoldPool: false,
			hold: 0,
			uses: []
		});
	});

	it("shows no Roll button for a picked move that rolls nothing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		const [move] = playbookGroup(sheet.getData()).moves;

		expect(move.rollable).toBe(false);
		expect(move.activatable).toBe(false);
		expect(move.gated).toBe(false);
	});

	it("gates a picked move whose only trait is disabled for this playbook", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { channel: { value: 0, disabled: true } },
				attributes: { playbookMoves: [DENY.key] }
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].gated).toBe(true);
	});

	it("drops a stored key whose move no longer exists rather than breaking the sheet", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: ["the-scout:deleted-move", BULLHEADED.key] } }
		};

		expect(playbookGroup(sheet.getData()).moves.map((move) => move.key)).toEqual([BULLHEADED.key]);
	});
});

describe("PlaybookActorSheet#activateListeners - playbook moves", () => {
	it("binds click handlers to the playbook move add and remove buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".playbook-move-add");
		expect(html.find).toHaveBeenCalledWith(".playbook-move-remove");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveAdd", () => {
	it("opens the picker with the actor's playbook and current picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith("The Scout", [BULLHEADED.key]);
	});

	it("appends the chosen move to the actor's picks", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(DENY.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key, DENY.key]
		});
	});

	it("adds the first move to an actor that has never picked one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [BULLHEADED.key]
		});
	});

	it("does nothing when the picker is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: "The Scout" } }, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	// The picker already filters out what the actor has, so this only guards against a stale
	// dialog left open across another window's edit — but a duplicate key would render the move
	// twice with two ✕ buttons that both remove it.
	it("does not add a move the actor already has", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { playbook: { name: "The Scout" }, attributes: { playbookMoves: [BULLHEADED.key] } },
			update: vi.fn()
		};
		choosePlaybookMove.mockResolvedValue(BULLHEADED.key);

		await sheet._onPlaybookMoveAdd();

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("passes an undefined playbook name through when the actor has no playbook set", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };
		choosePlaybookMove.mockResolvedValue(null);

		await sheet._onPlaybookMoveAdd();

		expect(choosePlaybookMove).toHaveBeenCalledWith(undefined, []);
	});
});

describe("PlaybookActorSheet#_onPlaybookMoveRemove", () => {
	it("removes just the clicked move, leaving the rest in order", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { playbookMoves: [BULLHEADED.key, DENY.key] } },
			update: vi.fn()
		};

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.playbookMoves": [DENY.key]
		});
	});

	it("does nothing for a move the actor doesn't have", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } }, update: vi.fn() };

		sheet._onPlaybookMoveRemove({ currentTarget: { dataset: { move: DENY.key } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#getData - move uses", () => {
	function playbookGroup(data) {
		return data.moveGroups.find((group) => group.label === "Playbook Moves");
	}

	it("gives a move with no uses declared an empty uses array", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [BULLHEADED.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([]);
	});

	it("reads each use entry's label and defaults to unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { playbookMoves: [SEEK_ALLIES.key] } } };

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Used this Sortie", checked: false }
		]);
	});

	it("reads each use entry's checked state independently, by move key and use key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [PERSONAL_FAMILIAR.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses).toEqual([
			{ key: "sortie", label: "Ignored a disadvantage this Sortie", checked: true },
			{ key: "downtime", label: "Reported back this Downtime", checked: false }
		]);
	});

	it("doesn't confuse one move's stored uses with another's", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					playbookMoves: [SEEK_ALLIES.key],
					moveUses: { [PERSONAL_FAMILIAR.key]: { sortie: true } }
				}
			}
		};

		expect(playbookGroup(sheet.getData()).moves[0].uses[0].checked).toBe(false);
	});
});

describe("PlaybookActorSheet#activateListeners - move uses", () => {
	it("binds a change handler to the uses checkbox", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {} };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-use-checkbox");
		expect(on).toHaveBeenCalledWith("change", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveUseToggle", () => {
	it("writes the checked state to the actor, keyed by move and use", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: SEEK_ALLIES.key, use: "sortie" }, checked: true }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${SEEK_ALLIES.key}.sortie`]: true
		});
	});

	it("writes false when the box is unchecked", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { update: vi.fn() };

		sheet._onMoveUseToggle({
			currentTarget: { dataset: { move: PERSONAL_FAMILIAR.key, use: "downtime" }, checked: false }
		});

		expect(sheet.actor.update).toHaveBeenCalledWith({
			[`system.attributes.moveUses.${PERSONAL_FAMILIAR.key}.downtime`]: false
		});
	});
});

describe("PlaybookActorSheet#getData - gated moves", () => {
	it("gates weave magic's Roll button when CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.traits).toEqual([]);
	});

	it("un-gates weave magic once CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(false);
		expect(weaveMagic.traits).toEqual([{ key: "channel", label: "CHANNEL", value: 1 }]);
	});

	it("never gates help or hinder, which has no stat traits by design", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[0].moves.find((m) => m.key === "help-or-hinder").gated).toBe(false);
	});

	it("gates b-plot when CHANNEL is enabled, the mirror image of weave magic", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("gates b-plot when CHANNEL is missing from stats (reads as enabled)", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(true);
	});

	it("un-gates b-plot once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").gated).toBe(false);
	});

	it("never gates lead a sortie or subsystems off CHANNEL, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "lead-a-sortie").gated).toBe(false);
		expect(data.moveGroups[1].moves.find((m) => m.key === "subsystems").gated).toBe(false);
	});

	it("also greys out b-plot's Description button when CHANNEL is enabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 1, disabled: false } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(true);
	});

	it("un-greys b-plot's Description button once CHANNEL is disabled", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").descriptionGated).toBe(false);
	});

	it("never greys out weave magic's Description button, unlike b-plot", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		const data = sheet.getData();

		const weaveMagic = data.moveGroups[0].moves.find((m) => m.key === "weave-magic");
		expect(weaveMagic.gated).toBe(true);
		expect(weaveMagic.descriptionGated).toBe(false);
	});
});

describe("PlaybookActorSheet#getData - hold", () => {
	it("marks trackHold true only for moves that define a hold track", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();
		const holdFlags = Object.fromEntries(data.moveGroups[0].moves.map((m) => [m.key, m.trackHold]));

		expect(holdFlags).toEqual({
			"exchange-blows": false,
			"weather-the-storm": false,
			"read-the-room": true,
			"dispel-uncertainties": false,
			"help-or-hinder": false,
			"weave-magic": false,
			"cool-off": false,
			"strike-decisively": false,
			"bite-the-dust": false
		});
	});

	it("reflects the actor's current hold value on every move, defaulting to 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {}, resources: { hold: { value: 2 } } } };

		const data = sheet.getData();

		for (const move of data.moveGroups[0].moves) {
			expect(move.hold).toBe(2);
		}
	});
});

describe("PlaybookActorSheet#getData - flatHold moves' separate hold pools", () => {
	it("reads b-plot's hold from system.attributes.moveHold, keyed by its own move key, not the shared resources.hold pool", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				resources: { hold: { value: 5 } },
				attributes: { moveHold: { "b-plot": { value: 2 } } }
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").hold).toBe(2);
		// Read the Room (a basic move) keeps reading the shared pool, unaffected by moveHold.
		expect(data.moveGroups[0].moves.find((m) => m.key === "read-the-room").hold).toBe(5);
	});

	it("defaults b-plot's hold to 0 when moveHold is missing", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").hold).toBe(0);
	});

	it("keeps two different flatHold moves' pools independent, keyed by their own move key", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					moveHold: {
						"b-plot": { value: 2 },
						"soldier:get-out-of-my-way": { value: 1 }
					},
					playbookMoves: ["soldier:get-out-of-my-way"]
				}
			}
		};

		const data = sheet.getData();

		expect(data.moveGroups[1].moves.find((m) => m.key === "b-plot").hold).toBe(2);
		expect(data.moveGroups[2].moves.find((m) => m.key === "soldier:get-out-of-my-way").hold).toBe(1);
	});
});

describe("PlaybookActorSheet#activateListeners - hold step", () => {
	it("binds a click handler to the hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onHoldStep", () => {
	it("increments the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 2 });
	});

	it("decrements the hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 1 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 3 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { resources: { hold: { value: 0 } } }, update: vi.fn() };

		sheet._onHoldStep({ currentTarget: { dataset: { delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#activateListeners - flat hold step", () => {
	it("binds a click handler to the flat hold step buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".flat-hold-step");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onFlatHoldStep", () => {
	it("increments the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
	});

	it("decrements the move's hold value and updates the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 0 });
	});

	it("treats a missing hold value as starting at 0", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: {}, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 1 });
	});

	it("clamps at the maximum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("clamps at the minimum and does not update the actor", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 0 } } } }, update: vi.fn() };

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "-1" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 1 } } }, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "b-plot", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 2 });
		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when stepping this one", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				attributes: {
					moveHold: { "b-plot": { value: 2 }, "soldier:get-out-of-my-way": { value: 1 } }
				}
			},
			update: vi.fn()
		};

		sheet._onFlatHoldStep({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way", delta: "1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 2
		});
	});
});

describe("PlaybookActorSheet#activateListeners - moves", () => {
	it("binds click handlers to the move roll and description buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-roll");
		expect(html.find).toHaveBeenCalledWith(".move-activate");
		expect(html.find).toHaveBeenCalledWith(".move-description");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move has no enabled traits to roll with", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { disabled: true }, talk: { disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does not roll when the roll dialog is dismissed without a selection", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).not.toHaveBeenCalled();
	});

	it("rolls a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 2 } } } };
		const config = { trait: { key: "channel", label: "CHANNEL", value: 2 }, advantage: "normal", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: DENY.key } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DENY, config.trait, config);
	});

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[],
			{ lockedEffect: null, equipmentSpends: [] }
		);
	});

	it("configures the roll, then rolls the move with the chosen trait and modifiers", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 1 }, talk: { value: 0 } } } };
		const talk = { key: "talk", label: "TALK", value: 0 };
		const config = { trait: talk, advantage: "advantage", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 1 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, equipmentSpends: [] }
		);
		// exchange-blows is usesWeapon (see moves.js) and the actor has no equipment at all here,
		// so the weapon-choice step is skipped straight to "Unarmed" — see
		// "PlaybookActorSheet#_onMoveRoll - weapon choice" for the chooseWeapon-driven paths.
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, talk, { ...config, weaponLabel: "Unarmed" });
	});

	it("finds a special move (lead a sortie) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { know: { value: 1 }, defy: { value: 0 } } } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			LEAD_A_SORTIE,
			[
				{ key: "know", label: "KNOW", value: 1 },
				{ key: "defy", label: "DEFY", value: 0 },
				{ key: "crew", label: "CREW", value: 0 }
			],
			{ lockedEffect: null, equipmentSpends: [] }
		);
	});

	it("does nothing for subsystems, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing for b-plot, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { channel: { value: 0, disabled: true } } } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_onMoveRoll - bite the dust's locked Desperation", () => {
	const defy = { key: "defy", label: "DEFY", value: 0 };

	it("locks Desperation when at max Dangers and every one is a Peril", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: "desperation", equipmentSpends: [] });
	});

	it("does not lock Desperation when at max Dangers but the types are mixed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "risk", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, equipmentSpends: [] });
	});

	it("does not lock Desperation when below max Dangers, even if all are Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], { lockedEffect: null, equipmentSpends: [] });
	});

	it("never locks Desperation for a move without forcesDesperationAtMaxPerils, even at max Perils", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			EXCHANGE_BLOWS,
			[
				{ key: "clash", label: "CLASH", value: 0 },
				{ key: "talk", label: "TALK", value: 0 }
			],
			{ lockedEffect: null, equipmentSpends: [] }
		);
	});
});

// dispel-uncertainties (not a usesWeapon move) stands in for "any ordinary move" here — these
// tests exercise _equipmentSpends' own unscoped behavior (offering, spent/stale filtering,
// disabling, marking), which is identical for every move except Exchange Blows/Strike Decisively.
// Weapon-scoping itself (chooseWeapon, the weaponLabel it produces) is covered separately below in
// "PlaybookActorSheet#_onMoveRoll - weapon choice" and "PlaybookActorSheet#_equipmentSpends -
// weapon scoping".
describe("PlaybookActorSheet#_onMoveRoll - equipment spends", () => {
	const know = { key: "know", label: "KNOW", value: 1 };
	const blitzSpend = {
		equipmentId: "eq1",
		equipmentName: "Halberd",
		tagKey: "blitz",
		tagLabel: "Blitz",
		description: "You may spend this tag once per Scene to make a move with confidence.",
		effect: "confidence",
		disabled: false
	};

	it("offers every unspent spendable tag across the actor's equipment", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			DISPEL_UNCERTAINTIES,
			[{ key: "know", label: "KNOW", value: 1 }],
			{ lockedEffect: null, equipmentSpends: [blitzSpend] }
		);
	});

	it("excludes a tag already marked spent on its entry", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
	});

	it("treats a missing spent array on an entry as nothing spent yet", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: [blitzSpend]
		});
	});

	it("treats a missing tags array on an entry as offering nothing", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
	});

	it("excludes a tag key that no longer resolves in the catalog", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Odd", description: "", tags: ["stale-key"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
	});

	it("excludes a spend tag with no effect (e.g. Ward) from the roll-dialog offering", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { know: { value: 1 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Charm", description: "", tags: ["ward"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(DISPEL_UNCERTAINTIES, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
	});

	it("disables offered spends when the roll's Effect is already locked (bite the dust at max Perils)", async () => {
		const sheet = new PlaybookActorSheet();
		const defy = { key: "defy", label: "DEFY", value: 0 };
		sheet.actor = {
			system: {
				stats: { defy: { value: 0 } },
				attributes: {
					dangers: [
						{ id: "1", type: "peril", label: "a" },
						{ id: "2", type: "peril", label: "b" },
						{ id: "3", type: "peril", label: "c" }
					],
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] }]
				}
			}
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "bite-the-dust" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(BITE_THE_DUST, [defy], {
			lockedEffect: "desperation",
			equipmentSpends: [{ ...blitzSpend, disabled: true }]
		});
	});

	it("marks each checked spend's tag as spent, then rolls the move", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("treats a missing spent array as empty when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const entry = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [entry] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...entry, spent: ["blitz"] }]
		});
	});

	it("does not touch equipment when nothing was spent", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "none", spentTags: [] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, DISPEL_UNCERTAINTIES, know, config);
	});

	it("leaves equipment on other entries untouched when marking a spend", async () => {
		const sheet = new PlaybookActorSheet();
		const spent = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [] };
		const untouched = { id: "eq2", kind: "gear", name: "Rations", description: "", tags: [], spent: [] };
		sheet.actor = {
			system: { stats: { know: { value: 1 } }, attributes: { equipment: [spent, untouched] } },
			update: vi.fn()
		};
		const config = { trait: know, advantage: "none", effect: "confidence", spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }] };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "dispel-uncertainties" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...spent, spent: ["blitz"] }, untouched]
		});
	});
});

describe("PlaybookActorSheet#activateListeners - weapon moves", () => {
	it("binds a click handler to the per-weapon quick-roll buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".weapon-move-roll");
		expect(on).toHaveBeenCalledWith("click", expect.any(Function));
	});
});

describe("PlaybookActorSheet#_onMoveRoll - weapon choice", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
	const sidearm = { id: "eq2", kind: "weapon", name: "Sidearm", description: "", tags: [], spent: [], scale: "foot", tier: 1 };

	it("prompts chooseWeapon with the actor's weapons when the move usesWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd, sidearm] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(chooseWeapon).toHaveBeenCalledWith([halberd, sidearm]);
	});

	it("aborts the whole roll when the weapon-choice dialog is dismissed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } } };
		chooseWeapon.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("scopes the roll to no weapon and labels it Unarmed when Unarmed is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed" });
	});

	it("scopes the roll to the chosen weapon and labels it by name", async () => {
		const sheet = new PlaybookActorSheet();
		const armed = { ...halberd, tags: ["blitz"] };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [armed, sidearm] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(armed.id);
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: [expect.objectContaining({ equipmentId: armed.id, tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd" });
	});

	it("treats an id chooseWeapon resolved that no longer matches any weapon as Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue("not-a-real-weapon-id");
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed" });
	});

	it("skips chooseWeapon entirely and rolls Unarmed when the actor has no weapons", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "strike-decisively" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, { ...config, weaponLabel: "Unarmed" });
	});
});

describe("PlaybookActorSheet#_onWeaponMoveRoll", () => {
	const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };

	it("rolls the clicked move with the clicked weapon, without prompting chooseWeapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(chooseWeapon).not.toHaveBeenCalled();
		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: [expect.objectContaining({ equipmentId: "eq1", tagKey: "blitz" })]
		});
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Halberd" });
	});

	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "not-a-real-move", equipmentId: "eq1" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});

	it("does nothing for an unrecognized equipment id", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { equipment: [halberd] } } };

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "not-a-real-id" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
	});
});

describe("PlaybookActorSheet#_rollMove - forced weapon effects (Unreliable)", () => {
	it("locks Effect to Desperation on the first roll with an unspent Unreliable weapon this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: "desperation",
			equipmentSpends: []
		});
	});

	it("does not lock Effect when the Unreliable tag is already spent this Scene", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], spent: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: []
		});
	});

	it("treats a missing spent array as nothing spent yet, for a forced tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: "desperation"
		}));
	});

	it("marks the forced tag spent after rolling, alongside any player-chosen spend, in one update", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["unreliable", "blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		const config = {
			trait: { key: "clash", label: "CLASH", value: 0 },
			advantage: "none",
			effect: "desperation",
			spentTags: [{ equipmentId: "eq1", tagKey: "blitz" }]
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["blitz", "unreliable"] }]
		});
	});

	it("does not force an effect for a weapon with no forcesEffect tag", async () => {
		const sheet = new PlaybookActorSheet();
		const halberd = { id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: ["blitz"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [halberd] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null
		}));
	});

	it("treats a missing tags array as no forced effect", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null
		}));
	});

	it("never forces an effect for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		chooseWeapon.mockResolvedValue(UNARMED);
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), expect.objectContaining({
			lockedEffect: null
		}));
	});
});

describe("PlaybookActorSheet#_rollMove - reroll offer (Decisive/Defensive/Versatile)", () => {
	const config = { trait: { key: "clash", label: "CLASH", value: 0 }, advantage: "none", effect: "none" };

	it("offers a reroll when the weapon has an unspent reroll tag matching this move", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("does not offer a reroll when the weapon's reroll tag doesn't cover this move", async () => {
		const sheet = new PlaybookActorSheet();
		// Decisive only covers strike-decisively, not exchange-blows.
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["decisive"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle" });
	});

	it("does not offer an already-spent reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], spent: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Rifle" });
	});

	it("offers Versatile's reroll for strike-decisively as well as exchange-blows", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["versatile"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "strike-decisively", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, STRIKE_DECISIVELY, config.trait, {
			...config,
			weaponLabel: "Rifle",
			reroll: { equipmentId: "eq1", tagKey: "versatile" }
		});
	});

	it("treats a missing spent array as nothing spent yet, for a reroll tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["defensive"], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, {
			...config,
			weaponLabel: "Rifle",
			reroll: { equipmentId: "eq1", tagKey: "defensive" }
		});
	});

	it("treats a missing tags array as no reroll offer", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Fists" });
	});

	it("never offers a reroll for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(config);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, config.trait, { ...config, weaponLabel: "Unarmed" });
	});
});

describe("PlaybookActorSheet#_rollMove - Guided (take 7-9)", () => {
	it("passes guided: true to configureMoveRoll when the weapon has a live Guided tag", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), {
			lockedEffect: null,
			equipmentSpends: [],
			guided: true
		});
	});

	it("omits guided from configureMoveRoll's options for a non-Guided weapon", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: [], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, equipmentSpends: [] });
	});

	it("treats a missing tags array as not Guided", async () => {
		const sheet = new PlaybookActorSheet();
		const fists = { id: "eq1", kind: "weapon", name: "Fists", description: "", spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [fists] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, equipmentSpends: [] });
	});

	it("is never Guided for Unarmed", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(EXCHANGE_BLOWS, expect.any(Array), { lockedEffect: null, equipmentSpends: [] });
	});

	it("posts a guided result and never rolls when Take 7-9 is chosen", async () => {
		const sheet = new PlaybookActorSheet();
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", description: "", tags: ["guided"], spent: [], scale: "foot", tier: 1 };
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [rifle] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onWeaponMoveRoll({ currentTarget: { dataset: { move: "exchange-blows", equipmentId: "eq1" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Rifle" });
		expect(rollMove).not.toHaveBeenCalled();
		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("labels the guided result Unarmed when taking 7-9 with no weapon", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { stats: { clash: { value: 0 }, talk: { value: 0 } }, attributes: { equipment: [] } },
			update: vi.fn()
		};
		configureMoveRoll.mockResolvedValue({ takeSeven: true });

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postGuidedResult).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, { weaponLabel: "Unarmed" });
	});
});

describe("PlaybookActorSheet#getData - weaponMoves", () => {
	it("lists exchange-blows and strike-decisively on every weapon entry", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0 }, talk: { value: 0 } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: false },
			{ key: "strike-decisively", name: "Strike Decisively", gated: false }
		]);
	});

	it("gates weaponMoves the same way the Moves tab gates them", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: { clash: { value: 0, disabled: true }, talk: { value: 0, disabled: true } },
				attributes: {
					equipment: [{ id: "eq1", kind: "weapon", name: "Halberd", description: "", tags: [], spent: [], scale: "foot", tier: 1 }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.weapons[0].weaponMoves).toEqual([
			{ key: "exchange-blows", name: "Exchange Blows", gated: true },
			{ key: "strike-decisively", name: "Strike Decisively", gated: true }
		]);
	});

	it("does not attach weaponMoves to gear", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: {
				stats: {},
				attributes: {
					equipment: [{ id: "eq1", kind: "gear", name: "Rations", description: "", tags: [], spent: [] }]
				}
			}
		};

		const data = sheet.getData();

		expect(data.equipment.gear[0].weaponMoves).toBeUndefined();
	});
});

describe("PlaybookActorSheet#_onMoveActivate", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does nothing for a move with no flat hold to grant, e.g. lead a sortie", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "lead-a-sortie" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("adds b-plot's flat hold to its own moveHold pool", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: {} }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
	});

	it("adds to, rather than replaces, an existing moveHold value", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 1 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.b-plot.value": 3 });
	});

	it("clamps at the maximum and does not update the actor", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { attributes: { moveHold: { "b-plot": { value: 3 } } } }, update: vi.fn() };

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalled();
	});

	it("does not affect the shared resources.hold field", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: {}, resources: { hold: { value: 5 } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(sheet.actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("keeps a different flatHold move's pool untouched when activating this one", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = {
			system: { attributes: { moveHold: { "b-plot": { value: 2 } } } },
			update: vi.fn()
		};

		await sheet._onMoveActivate({ currentTarget: { dataset: { move: "soldier:get-out-of-my-way" } } });

		expect(sheet.actor.update).toHaveBeenCalledWith({
			"system.attributes.moveHold.soldier:get-out-of-my-way.value": 3
		});
	});
});

describe("PlaybookActorSheet#_onMoveDescription", () => {
	it("does nothing for an unrecognized move key", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "not-a-real-move" } } });

		expect(postMoveDescription).not.toHaveBeenCalled();
	});

	it("posts the move's description to chat", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "exchange-blows" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS);
	});

	it("finds a special move (subsystems) by key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, SUBSYSTEMS);
	});

	it("finds a playbook move by its pool-prefixed key, same as a basic move", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: BULLHEADED.key } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, BULLHEADED);
	});

	it("posts b-plot's description even when it's gated (CHANNEL enabled)", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveDescription({ currentTarget: { dataset: { move: "b-plot" } } });

		expect(postMoveDescription).toHaveBeenCalledWith(sheet.actor, B_PLOT);
	});
});
