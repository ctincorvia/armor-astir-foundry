import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIE_FACES } from "../scripts/moves/roll-effects.js";
import { TRAITS } from "../scripts/core/traits.js";
import { BASIC_MOVES, FAILURE_REMINDERS, MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, rollMove } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
// The one real move carrying separateHold — a roll-tiered hold grant routed into its own
// per-move pool instead of the shared system.resources.hold field (see playbook-moves.js).
const MOBILITY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-scout:mobility");

beforeEach(() => {
	vi.resetAllMocks();
	// resetAllMocks wipes the default Dialog/Roll implementations stubbed in tests/setup.js.
	Dialog.mockImplementation(function (data) {
		this.data = data;
		this.render = vi.fn();
		this.close = vi.fn(() => this.data.close?.());
	});
	mockRoll();
	renderTemplate.mockResolvedValue("");
});

describe("rollMove - return value", () => {
	it("returns the roll's outcome tier alongside the message and dice", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("success");

		mockRoll({ dice: [4, 4] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("mixed");

		mockRoll({ dice: [1, 1] });
		expect((await rollMove(actor, EXCHANGE_BLOWS, clash)).tier).toBe("failure");
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

	it("adds a derived trait bonus (Arcane Augments, Let Loose) on top of the trait's own value", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { traitBonus: 3 });

		expect(Roll).toHaveBeenCalledWith(`2d${DIE_FACES} + @mod`, { mod: 5 });
	});

	it("defaults the trait bonus to 0 when omitted", async () => {
		const actor = { system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {});

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

	it("adds the deepen-a-Hook reminder for a Desperation roll that succeeds, but not for mixed or failure", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		// No 6s in these dice, so Desperation's 6->1 substitution never fires — only the effect
		// tag itself (not the substitution) is what the reminder keys off.
		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: ["You may deepen a Hook"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "desperation" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: FAILURE_REMINDERS
		}));
	});

	it("adds the loosen-a-Hook reminder for a Confidence roll that fails, but not for success or mixed", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		// No 1s in these dice, so Confidence's 1->6 substitution never fires and the roll stays a
		// genuine failure.
		mockRoll({ dice: [2, 2] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: [...FAILURE_REMINDERS, "You may loosen a Hook"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { effect: "confidence" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: null
		}));
	});

	it("adds an extraFailureReminder (e.g. Adrift's Walk-on Part In The War) only on an actual 6-", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [1, 1] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraFailureReminder: "Tick 'overheating' on your Astir" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "failure",
			reminders: [...FAILURE_REMINDERS, "Tick 'overheating' on your Astir"]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraFailureReminder: "Tick 'overheating' on your Astir" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
		}));
	});

	it("adds an extraSuccessReminder (e.g. Captain's Coordinator) only on an actual 10+", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		const reminder = "If you chose to help, your ally may act with confidence in addition to advantage.";

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraSuccessReminder: reminder });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: [reminder]
		}));

		mockRoll({ dice: [4, 3] });
		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraSuccessReminder: reminder });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			reminders: null
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
			flavor: "<div>flavor</div>",
			flags: { "armor-astir": { advantageOffer: expect.any(Object) } }
		});
	});

	it("shows Add Advantage/Add Disadvantage based on how far the current advantage state can still move", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await rollMove(actor, EXCHANGE_BLOWS, clash);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			showAddAdvantage: true,
			showAddDisadvantage: true
		}));

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			showAddAdvantage: true,
			// Disadvantage can still be clicked here — it steps back down to a flat roll rather
			// than being locked out (see roll-effects.js#nextAdvantageState).
			showAddDisadvantage: true
		}));

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage2" });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			// Maxed in the same direction, so Advantage is blocked...
			showAddAdvantage: false,
			// ...but Disadvantage still steps the stack down to advantage x1.
			showAddDisadvantage: true
		}));
	});

	it("attaches an advantageOffer card flag carrying everything needed to add a die later", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4, 2] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", effect: "confidence" });

		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.advantageOffer).toEqual({
			actorId: "actor1",
			moveKey: "exchange-blows",
			value: 2,
			effectKey: "confidence",
			advantageKey: "advantage",
			dice: expect.any(Array),
			extraConditions: [],
			extraFailureReminder: null,
			extraSuccessReminder: null,
			extraCriticalReminder: null,
			extraReminders: null,
			flavorArgs: expect.any(Object)
		});
	});

	it("carries options.extraReminders through into the advantageOffer flag, for handleAdvantage to reattach later", async () => {
		const actor = { id: "actor1", system: { stats: { clash: { value: 2 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [3, 4, 2] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, {
			advantage: "advantage",
			effect: "confidence",
			extraReminders: ["Choose 2, even on a fail:", "Some reminder"]
		});

		const rollInstance = Roll.mock.results.at(-1).value;
		const flags = rollInstance.toMessage.mock.calls.at(-1)[0].flags["armor-astir"];
		expect(flags.advantageOffer.extraReminders).toEqual(["Choose 2, even on a fail:", "Some reminder"]);
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

	it("suppresses the question list on a failure for a move without questionsOnFailure (Mobility)", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, MOBILITY, defy);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			hold: 0,
			questionPrompt: MOBILITY.questionPrompts.failure,
			questions: null
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

	// The Captain's Human Resources (see playbook-moves.js's addsQuestionsToMove) merges its own
	// extra question list onto whichever move actually rolls, arriving pre-resolved via
	// options.extraQuestions (see PlaybookActorSheet#_grantedQuestionsForMove) so this module never
	// needs to import playbook-moves.js.
	it("merges options.extraQuestions onto the move's own question list on a hit", async () => {
		const actor = { system: { stats: { sense: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, READ_THE_ROOM, sense, { extraQuestions: ["What is the crew's mood like?"] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			questions: [...READ_THE_ROOM.questions, "What is the crew's mood like?"]
		}));
	});

	it("offers only options.extraQuestions when the move itself defines no questions", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraQuestions: ["An extra question."] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			questions: ["An extra question."]
		}));
	});

	it("still suppresses questions (including extraQuestions) on a failure for a move without questionsOnFailure", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, MOBILITY, defy, { extraQuestions: ["An extra question."] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			questions: null
		}));
	});
});

// Bureaucrat's own always-applicable reminders (see the-diplomat.js's quickRollsMove /
// PlaybookActorSheet#_rollMove) — unlike options.extraQuestions above (which the failure-tier
// test just above proves gets suppressed on a 6-), the source move's own text applies "even on a
// fail," so extraReminders must land on every tier's reminders unconditionally.
describe("rollMove - options.extraReminders (Bureaucrat)", () => {
	it("merges options.extraReminders onto the move's own reminders on a 10+ success", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraReminders: ["Choose 2, even on a fail:", "Some reminder"] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			reminders: ["Choose 2, even on a fail:", "Some reminder"]
		}));
	});

	it("merges options.extraReminders onto the move's own reminders on a 7-9 mixed success", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 4] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraReminders: ["Choose 2, even on a fail:", "Some reminder"] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			reminders: ["Choose 2, even on a fail:", "Some reminder"]
		}));
	});

	it("merges options.extraReminders onto FAILURE_REMINDERS on a 6- failure, unlike extraQuestions", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 1] });

		await rollMove(actor, EXCHANGE_BLOWS, clash, { extraReminders: ["Choose 2, even on a fail:", "Some reminder"] });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			reminders: [...FAILURE_REMINDERS, "Choose 2, even on a fail:", "Some reminder"]
		}));
	});
});

describe("rollMove - separateHold (Mobility)", () => {
	it("writes a hit's hold to the move's own per-move pool, not the shared hold field", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [5, 5] });

		await rollMove(actor, MOBILITY, defy);

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": 3 });
	});

	it("does not touch the shared hold field at all", async () => {
		const actor = { system: { stats: { defy: { value: 0 } } }, update: vi.fn() };
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 4] });

		await rollMove(actor, MOBILITY, defy);

		expect(actor.update).not.toHaveBeenCalledWith(expect.objectContaining({
			"system.resources.hold.value": expect.anything()
		}));
	});

	it("does not overwrite Read the Room's hold when Mobility is rolled right after", async () => {
		const actor = { system: { stats: { sense: { value: 0 }, defy: { value: 0 } } }, update: vi.fn() };
		const sense = TRAITS.find((t) => t.key === "sense");
		const defy = TRAITS.find((t) => t.key === "defy");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		mockRoll({ dice: [5, 5] });
		await rollMove(actor, READ_THE_ROOM, sense);
		expect(actor.update).toHaveBeenLastCalledWith({ "system.resources.hold.value": 3 });

		mockRoll({ dice: [4, 4] });
		await rollMove(actor, MOBILITY, defy);
		expect(actor.update).toHaveBeenLastCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": 1 });
	});
});
