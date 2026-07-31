import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIE_FACES } from "../scripts/roll-effects.js";
import { TRAITS } from "../scripts/traits.js";
import {
	BASIC_MOVES,
	FAILURE_REMINDERS,
	MOVE_CHAT_TEMPLATE,
	MOVE_RESULT_LABELS,
	SPECIAL_MOVES,
	availableMoveTraits,
	configureMoveRoll,
	moveResultTier,
	postMoveDescription,
	rollMove
} from "../scripts/moves.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const WEATHER_THE_STORM = BASIC_MOVES.find((m) => m.key === "weather-the-storm");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
const DISPEL_UNCERTAINTIES = BASIC_MOVES.find((m) => m.key === "dispel-uncertainties");
const HELP_OR_HINDER = BASIC_MOVES.find((m) => m.key === "help-or-hinder");
const WEAVE_MAGIC = BASIC_MOVES.find((m) => m.key === "weave-magic");
const LEAD_A_SORTIE = SPECIAL_MOVES.find((m) => m.key === "lead-a-sortie");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");
const B_PLOT = SPECIAL_MOVES.find((m) => m.key === "b-plot");

// checkedConditions fakes the jQuery `.find("[name='condition']:checked").map(...).get()` chain
// configureMoveRoll uses to collect Help or Hinder's checkbox values.
function fakeRollHtml(values, checkedConditions = []) {
	return {
		find: (selector) => {
			if (selector === "[name='condition']:checked") {
				return { map: (fn) => ({ get: () => checkedConditions.map((value, index) => fn(index, { value })) }) };
			}
			return { val: () => values[selector] };
		}
	};
}

// Seeds the die's raw results (pre-substitution/keep) so rollMove's real, unmocked
// applyRollEffects computes the total exactly as it would in production — there is no `total`
// to inject directly any more, since rollMove derives it from the dice breakdown + trait value.
function mockRoll({ dice = [3, 3] } = {}) {
	Roll.mockImplementation(function (formula, data) {
		this.formula = formula;
		this.data = data;
		this._total = 0;
		this.terms = [];
		this.dice = [{ results: dice.map((value) => ({ result: value, active: true })), modifiers: [] }];
		this.evaluate = vi.fn().mockImplementation(async () => this);
		this.toMessage = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(this, "total", { get: () => this._total, configurable: true });
	});
}

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/Roll implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
	});
	mockRoll();
	renderTemplate.mockResolvedValue("");
});

describe("moveResultTier", () => {
	it("treats 10 and above as a success", () => {
		expect(moveResultTier(10)).toBe("success");
		expect(moveResultTier(12)).toBe("success");
	});

	it("treats 7-9 as a mixed success", () => {
		expect(moveResultTier(7)).toBe("mixed");
		expect(moveResultTier(9)).toBe("mixed");
	});

	it("treats 6 and below as a failure", () => {
		expect(moveResultTier(6)).toBe("failure");
		expect(moveResultTier(2)).toBe("failure");
	});
});

describe("availableMoveTraits", () => {
	it("resolves each trait key to its TRAITS entry", () => {
		const actor = { system: { stats: { clash: { value: 1 }, talk: { value: 2 } } } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "clash"), TRAITS.find((t) => t.key === "talk")]);
	});

	it("excludes traits disabled on the actor's stats", () => {
		const actor = { system: { stats: { clash: { value: 1, disabled: true }, talk: { value: 2 } } } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "talk")]);
	});

	it("excludes traits missing from the actor's stats entirely", () => {
		const actor = { system: { stats: {} } };

		const traits = availableMoveTraits(actor, EXCHANGE_BLOWS);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "clash"), TRAITS.find((t) => t.key === "talk")]);
	});

	it("resolves all three traits for weather-the-storm", () => {
		const actor = { system: { stats: { defy: { value: 1 }, know: { value: 2 }, sense: { value: 3 } } } };

		const traits = availableMoveTraits(actor, WEATHER_THE_STORM);

		expect(traits).toEqual([
			TRAITS.find((t) => t.key === "defy"),
			TRAITS.find((t) => t.key === "know"),
			TRAITS.find((t) => t.key === "sense")
		]);
	});

	it("resolves no traits for b-plot, which rolls nothing by design", () => {
		const actor = { system: { stats: {} } };

		const traits = availableMoveTraits(actor, B_PLOT);

		expect(traits).toEqual([]);
	});
});

describe("configureMoveRoll", () => {
	const clash = { key: "clash", label: "CLASH", value: 1 };
	const talk = { key: "talk", label: "TALK", value: 2 };

	it("renders the roll dialog template with the given traits and modifier states", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			traits: [clash],
			advantageStates: expect.any(Array),
			effectStates: expect.any(Array)
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the selected trait, advantage, and effect when Roll is clicked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash, talk]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "talk",
			"[name='advantage']": "advantage",
			"[name='effect']": "confidence"
		}));

		expect(await promise).toEqual({ trait: talk, advantage: "advantage", effect: "confidence" });
	});

	it("resolves null when Cancel is clicked", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.cancel.callback();

		expect(await promise).toBeNull();
	});

	it("resolves null when the dialog is closed without a selection", async () => {
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.close();

		expect(await promise).toBeNull();
	});
});

describe("configureMoveRoll - intents and conditions", () => {
	it("passes the move's intents and conditions to the dialog template", async () => {
		const promise = configureMoveRoll(HELP_OR_HINDER, []);
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(expect.stringContaining("move-roll-dialog"), expect.objectContaining({
			traits: [],
			intents: HELP_OR_HINDER.intents,
			conditions: HELP_OR_HINDER.conditions
		}));

		Dialog.mock.calls.at(-1)[0].close();
		await promise;
	});

	it("resolves the chosen intent and checked conditions when Roll is clicked", async () => {
		const promise = configureMoveRoll(HELP_OR_HINDER, []);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='intent']": "help",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}, ["downtime", "hook"]));

		expect(await promise).toEqual({
			intent: HELP_OR_HINDER.intents.find((i) => i.key === "help"),
			conditions: ["downtime", "hook"],
			advantage: "none",
			effect: "none"
		});
	});

	it("does not add intent or conditions keys for moves that don't define them", async () => {
		const clash = { key: "clash", label: "CLASH", value: 1 };
		const promise = configureMoveRoll(EXCHANGE_BLOWS, [clash]);
		await Promise.resolve();
		await Promise.resolve();

		const dialogOptions = Dialog.mock.calls.at(-1)[0];
		dialogOptions.buttons.roll.callback(fakeRollHtml({
			"[name='trait']": "clash",
			"[name='advantage']": "none",
			"[name='effect']": "none"
		}));

		expect(await promise).toEqual({ trait: clash, advantage: "none", effect: "none" });
	});
});

describe("rollMove", () => {
	it("rolls 2d6 plus the chosen trait's value with no modifiers", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("rolls extra dice for advantage and disadvantage stacks", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(Roll).toHaveBeenLastCalledWith(`3d${DIE_FACES} + @mod`, { mod: 0 });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage2" });
		expect(Roll).toHaveBeenLastCalledWith(`4d${DIE_FACES} + @mod`, { mod: 0 });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage2" });
		expect(Roll).toHaveBeenLastCalledWith(`4d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("substitutes faces via Confidence before computing the total", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });

		const rollInstance = Roll.mock.results.at(-1).value;
		expect(rollInstance.dice[0].results[0].result).toBe(DIE_FACES);
		expect(rollInstance.total).toBe(DIE_FACES + 4);
	});

	it("computes the final total from the kept dice plus the trait value", async () => {
		const actor = { system: { stats: { clash: { value: 3 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 6, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });

		expect(Roll.mock.results.at(-1).value.total).toBe(6 + 4 + 3);
	});

	it("pushes a keep-highest modifier onto the die term under advantage, keep-lowest under disadvantage", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [4, 3, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual(["kh2"]);

		mockRoll({ dice: [4, 3, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage" });
		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual(["kl2"]);
	});

	it("leaves the die term's modifiers untouched with no advantage or disadvantage", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll.mock.results.at(-1).value.dice[0].modifiers).toEqual([]);
	});

	it("passes the per-die breakdown to the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 6, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", effect: "confidence" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			dice: [
				{ original: 1, result: DIE_FACES, changed: true, kept: true },
				{ original: 6, result: 6, changed: false, kept: true },
				{ original: 4, result: 4, changed: false, kept: false }
			]
		}));
	});

	it("reports success for a 10+, mixed for 7-9, and failure for 6-, with matching result text", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			name: EXCHANGE_BLOWS.name,
			traitLabel: clash.label,
			tier: "success",
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: EXCHANGE_BLOWS.results.success,
			conditions: []
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed
		}));

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			tierLabel: MOVE_RESULT_LABELS.failure,
			resultText: null
		}));
	});

	it("adds the failure reminders on a full failure only", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: ["Add a point of spotlight", "The Director makes a move"]
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: null
		}));
	});

	it("adds the failure reminders even for moves with their own failure text", async () => {
		const actor = { system: { stats: { sense: { value: 0 } }, resources: { hold: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, READ_THE_ROOM, sense);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			resultText: READ_THE_ROOM.results.failure,
			reminders: FAILURE_REMINDERS
		}));
	});

	it("includes the active conditions in the chat template data", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "disadvantage2", effect: "desperation" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [
				{ key: "disadvantage2", label: "Disadvantage x2" },
				{ key: "desperation", label: "Desperation" }
			]
		}));
	});

	it("treats a missing stat value as 0", async () => {
		const actor = { system: { stats: {} } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("posts the rendered flavor to chat with the actor's speaker", async () => {
		const actor = { system: { stats: { clash: { value: 1 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>flavor</div>");

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		const rollInstance = Roll.mock.results.at(-1).value;
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<div>flavor</div>"
		});
	});
});

describe("rollMove - dispel uncertainties and weave magic", () => {
	it("rolls 2d6 plus the KNOW value for dispel uncertainties", async () => {
		const actor = { system: { stats: { know: { value: 2 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, DISPEL_UNCERTAINTIES, know);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("rolls 2d6 plus the CHANNEL value for weave magic", async () => {
		const actor = { system: { stats: { channel: { value: 1 } } } };
		const channel = TRAITS.find((t) => t.key === "channel");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, WEAVE_MAGIC, channel);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 1 });
	});
});

describe("rollMove - lead a sortie", () => {
	it("resolves KNOW and DEFY as normal, actor-backed traits", () => {
		const actor = { system: { stats: { know: { value: 1 }, defy: { value: 2 } } } };

		const traits = availableMoveTraits(actor, LEAD_A_SORTIE);

		expect(traits).toEqual([TRAITS.find((t) => t.key === "know"), TRAITS.find((t) => t.key === "defy")]);
	});

	it("rolls 2d6 plus the KNOW or DEFY value like any other trait", async () => {
		const actor = { system: { stats: { know: { value: 2 }, defy: { value: -1 } } } };
		const know = TRAITS.find((t) => t.key === "know");
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, LEAD_A_SORTIE, know);
		expect(Roll).toHaveBeenLastCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });

		await rollMove(actor, LEAD_A_SORTIE, defy);
		expect(Roll).toHaveBeenLastCalledWith(`2d${DIE_FACES} + @mod`, { mod: -1 });
	});

	it("rolls the CREW fixed trait's own value rather than any actor stat", async () => {
		// crew is deliberately set on the actor's stats to prove it's ignored — CREW is a fixed
		// placeholder (see SPECIAL_MOVES), never looked up on the actor.
		const actor = { system: { stats: { crew: { value: 99 } } } };
		const crew = { key: "crew", label: "CREW", value: 0 };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, LEAD_A_SORTIE, crew);

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});
});

describe("rollMove - help or hinder", () => {
	it("rolls with no base value when no conditions are checked", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, {});

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 0 });
	});

	it("adds +1 per checked condition", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, { conditions: ["downtime", "hook"] });

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 2 });
	});

	it("passes no trait label but the chosen intent's label to the chat template", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		const help = HELP_OR_HINDER.intents.find((i) => i.key === "help");

		await rollMove(actor, HELP_OR_HINDER, undefined, { intent: help });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			traitLabel: null,
			intentLabel: "Help"
		}));
	});

	it("includes the checked condition labels alongside advantage/effect conditions in the chat template", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, HELP_OR_HINDER, undefined, { conditions: ["hook"], advantage: "advantage" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			conditions: [
				{ key: "advantage", label: "Advantage" },
				{ key: "hook", label: "They're part of one of your Hooks" }
			]
		}));
	});
});

describe("rollMove - hold", () => {
	it("writes hold 3 to the actor on a 10+", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 3 });
	});

	it("writes hold 1 to the actor on a 7-9", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 4] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": 1 });
	});

	it("does not update the actor's hold on a failure, so prior hold survives", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("does not call actor.update for moves with no hold track", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } }, update: vi.fn() };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("passes hold and the question list to the chat template on success and mixed success", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 3,
			questionPrompt: READ_THE_ROOM.questionPrompts.success,
			questions: READ_THE_ROOM.questions
		}));

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 1,
			questionPrompt: READ_THE_ROOM.questionPrompts.mixed,
			questions: READ_THE_ROOM.questions
		}));
	});

	it("tells the player to spend hold on the questions after a hit, and that they have none on a miss", () => {
		expect(READ_THE_ROOM.questionPrompts.success).toMatch(/spend hold/i);
		expect(READ_THE_ROOM.questionPrompts.mixed).toMatch(/spend hold/i);
		expect(READ_THE_ROOM.questionPrompts.failure).not.toMatch(/spend hold/i);
	});

	it("passes the question list with hold 0 on a failure", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, READ_THE_ROOM, sense);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 0,
			questionPrompt: READ_THE_ROOM.questionPrompts.failure,
			questions: READ_THE_ROOM.questions
		}));
	});

	it("passes a null hold and null questions for moves without a hold track", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: null,
			questionPrompt: null,
			questions: null
		}));
	});
});

describe("postMoveDescription", () => {
	it("renders the move's description and posts it to chat", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>description</div>");

		await postMoveDescription(actor, EXCHANGE_BLOWS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: EXCHANGE_BLOWS.name,
			description: EXCHANGE_BLOWS.description
		});
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>description</div>"
		});
	});

	it("renders subsystems' description too, despite it having no results/roll", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>description</div>");

		await postMoveDescription(actor, SUBSYSTEMS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: SUBSYSTEMS.name,
			description: SUBSYSTEMS.description
		});
	});
});
