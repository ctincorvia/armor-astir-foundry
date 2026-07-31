import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/actor-creation.js", async (importOriginal) => ({
	...(await importOriginal()),
	swapActorPlaybook: vi.fn()
}));

vi.mock("../scripts/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	configureMoveRoll: vi.fn(),
	postMoveDescription: vi.fn(),
	rollMove: vi.fn()
}));

import { PLAYBOOKS, swapActorPlaybook } from "../scripts/actor-creation.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postMoveDescription, rollMove } from "../scripts/moves.js";
import { PlaybookActorSheet, registerPlaybookActorSheet, TRAITS } from "../scripts/playbook-actor-sheet.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");

beforeEach(() => {
	swapActorPlaybook.mockClear();
	configureMoveRoll.mockClear();
	postMoveDescription.mockClear();
	rollMove.mockClear();
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
						trackHold: false,
						hold: 0
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
						trackHold: false,
						hold: 0
					},
					{
						key: "read-the-room",
						name: "Read the Room",
						traits: [
							{ key: "sense", label: "SENSE", value: 0 }
						],
						gated: false,
						rollable: true,
						trackHold: true,
						hold: 0
					},
					{
						key: "dispel-uncertainties",
						name: "Dispel Uncertainties",
						traits: [
							{ key: "know", label: "KNOW", value: 0 }
						],
						gated: false,
						rollable: true,
						trackHold: false,
						hold: 0
					},
					{
						key: "help-or-hinder",
						name: "Help or Hinder",
						traits: [],
						gated: false,
						rollable: true,
						trackHold: false,
						hold: 0
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
						trackHold: false,
						hold: 0
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
						trackHold: false,
						hold: 0
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
						trackHold: false,
						hold: 0
					},
					{
						key: "bite-the-dust",
						name: "Bite the Dust",
						traits: [
							{ key: "defy", label: "DEFY", value: 0 }
						],
						gated: false,
						rollable: true,
						trackHold: false,
						hold: 0
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
						trackHold: false,
						hold: 0
					},
					{
						key: "subsystems",
						name: "Subsystems",
						traits: [],
						gated: false,
						rollable: false,
						trackHold: false,
						hold: 0
					}
				]
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

describe("PlaybookActorSheet#activateListeners - moves", () => {
	it("binds click handlers to the move roll and description buttons", () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { playbook: { name: PLAYBOOKS[0].name } } };

		const on = vi.fn();
		const html = { find: vi.fn().mockReturnValue({ on }) };

		sheet.activateListeners(html);

		expect(html.find).toHaveBeenCalledWith(".move-roll");
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

	it("still opens the roll dialog for help or hinder, which has no stat traits at all", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };
		configureMoveRoll.mockResolvedValue(null);

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "help-or-hinder" } } });

		expect(configureMoveRoll).toHaveBeenCalledWith(
			BASIC_MOVES.find((m) => m.key === "help-or-hinder"),
			[]
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
			]
		);
		expect(rollMove).toHaveBeenCalledWith(sheet.actor, EXCHANGE_BLOWS, talk, config);
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
			]
		);
	});

	it("does nothing for subsystems, which has no traits, conditions, or fixed traits to roll", async () => {
		const sheet = new PlaybookActorSheet();
		sheet.actor = { system: { stats: {} } };

		await sheet._onMoveRoll({ currentTarget: { dataset: { move: "subsystems" } } });

		expect(configureMoveRoll).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
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
});
