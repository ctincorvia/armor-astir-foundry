import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIE_FACES, EFFECT_STATES, NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS, effectState } from "../scripts/moves/roll-effects.js";
import { TRAITS } from "../scripts/core/traits.js";
import { BASIC_MOVES, MOVE_CHAT_TEMPLATE, SPECIAL_MOVES, explodeSixes, rollMove, rollVariableDicePool } from "../scripts/moves/moves.js";
import { mockRoll, mockRollSequence } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const PLAN_AND_PREPARE = SPECIAL_MOVES.find((m) => m.key === "plan-and-prepare");

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

describe("explodeSixes (Number Of The Beast)", () => {
	const NONE = EFFECT_STATES.find((e) => e.key === "none");
	const CONFIDENCE = effectState("confidence");
	const DESPERATION = effectState("desperation");

	it("does nothing when there are no 6s in the pool", async () => {
		const result = await explodeSixes([{ result: 3 }, { result: 4 }], NONE);

		expect(result).toEqual({ bonus: 0, sixCount: 0, extraDice: [], triggered: false });
		expect(Roll).not.toHaveBeenCalled();
	});

	it("explodes one initial 6 into a non-6 die, adding its face to the bonus", async () => {
		mockRollSequence([[4]]);

		const result = await explodeSixes([{ result: 6 }, { result: 2 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(Roll).toHaveBeenCalledWith(`1d${DIE_FACES}`);
		expect(result).toEqual({
			bonus: 4,
			sixCount: 1,
			extraDice: [{ original: 4, result: 4, changed: false }],
			triggered: false
		});
	});

	it("explodes once per initial 6, summing every exploded die's face into the bonus", async () => {
		mockRollSequence([[2], [5]]);

		const result = await explodeSixes([{ result: 6 }, { result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			bonus: 7,
			sixCount: 2,
			extraDice: [
				{ original: 2, result: 2, changed: false },
				{ original: 5, result: 5, changed: false }
			],
			triggered: false
		});
	});

	// Two initial 6s owe 2 explosions; the first explosion itself landing on a 6 re-chains, owing a
	// third (see explodeSixes' toRoll bookkeeping) — three rolls total, the third and fourth kept
	// deliberately non-6 so the chain terminates cleanly at exactly 3 sixes.
	it("chains explosions when an exploded die itself lands on a 6, and triggers at 3 sixes", async () => {
		mockRollSequence([[6], [2], [3]]);

		const result = await explodeSixes([{ result: 6 }, { result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(3);
		expect(result).toEqual({
			bonus: 11,
			sixCount: 3,
			extraDice: [
				{ original: 6, result: 6, changed: false },
				{ original: 2, result: 2, changed: false },
				{ original: 3, result: 3, changed: false }
			],
			triggered: true
		});
	});

	it("does not trigger below 3 total sixes", async () => {
		mockRollSequence([[2]]);

		const result = await explodeSixes([{ result: 6 }], NONE);

		expect(result.sixCount).toBe(1);
		expect(result.triggered).toBe(false);
	});

	it("stops exploding once NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS is hit, rather than looping forever", async () => {
		mockRollSequence(Array.from({ length: NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS }, () => [6]));

		const result = await explodeSixes([{ result: 6 }], NONE);

		expect(Roll).toHaveBeenCalledTimes(NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS);
		expect(result.extraDice).toHaveLength(NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS);
		expect(result.triggered).toBe(true);
	});

	it("applies the same face substitution to an exploded die, and a Desperation-substituted 6 does not re-explode", async () => {
		mockRollSequence([[6]]);

		const result = await explodeSixes([{ result: 6 }], DESPERATION);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			bonus: 1,
			sixCount: 1,
			extraDice: [{ original: 6, result: 1, changed: true }],
			triggered: false
		});
	});

	it("lets a Confidence-substituted exploded die (1 -> 6) re-explode", async () => {
		mockRollSequence([[1], [3]]);

		const result = await explodeSixes([{ result: 6 }], CONFIDENCE);

		expect(Roll).toHaveBeenCalledTimes(2);
		expect(result).toEqual({
			bonus: 9,
			sixCount: 2,
			extraDice: [
				{ original: 1, result: 6, changed: true },
				{ original: 3, result: 3, changed: false }
			],
			triggered: false
		});
	});
});

describe("rollMove - Number Of The Beast (exploding sixes)", () => {
	it("does nothing extra when options.explodeOnSix is not set, even on a roll full of 6s", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [6, 6] });

		await rollMove(actor, EXCHANGE_BLOWS, clash);

		expect(Roll).toHaveBeenCalledTimes(1);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			explodedDice: null,
			beastTriggered: false
		}));
	});

	it("adds the exploded dice's total to the roll's total, and passes them to the chat template", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 3], [4]]);

		await rollMove(actor, EXCHANGE_BLOWS, clash, { explodeOnSix: true });

		// Roll.mock.results[0] is the main "2d6 + @mod" roll — its own dice/mod total is the one
		// rollMove writes _total onto; the explosion die's own Roll instance (results[1]) never gets
		// its own _total touched, so grabbing the *last* result here (as most other tests in this
		// file do, since they never trigger a second `new Roll(...)` call) would read 0 instead.
		expect(Roll.mock.results[0].value.total).toBe(6 + 3 + 4);
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			explodedDice: [{ original: 4, result: 4, changed: false }],
			beastTriggered: false
		}));
	});

	// Three initial 6s (via an Advantage pool, so the initial roll itself has 3 dice) trigger the
	// badge outright — the three explosion rolls owed for them are all kept deliberately non-6 so
	// the chain terminates cleanly after exactly those three.
	it("sets beastTriggered once three 6s are rolled across the pool and its explosions", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 6, 6], [1], [2], [3]]);

		await rollMove(actor, EXCHANGE_BLOWS, clash, { advantage: "advantage", explodeOnSix: true });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ beastTriggered: true }));
	});

	it("does not merge exploded dice into the returned dice array, so rolledDoubles is unaffected", async () => {
		const actor = { system: { stats: { clash: { value: 0 } } } };
		const clash = TRAITS.find((t) => t.key === "clash");
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRollSequence([[6, 6], [3], [2]]);

		const result = await rollMove(actor, EXCHANGE_BLOWS, clash, { explodeOnSix: true });

		expect(result.dice).toHaveLength(2);
		expect(result.dice.every((die) => die.kept)).toBe(true);
	});
});

describe("rollVariableDicePool", () => {
	it("rolls 1d6 with no extra dice", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4] });

		await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 3, extraDice: 0 });

		expect(Roll).toHaveBeenCalledWith(`1d${DIE_FACES}`);
	});

	it("rolls 1 + extraDice d6 when extraDice is given", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4, 2, 6] });

		await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 3, extraDice: 2 });

		expect(Roll).toHaveBeenCalledWith(`3d${DIE_FACES}`);
	});

	it("scores each die independently against the target, regardless of the others", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [2, 5, 6] });

		const result = await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 5, extraDice: 2 });

		expect(result.dice).toEqual([
			{ result: 2, success: false },
			{ result: 5, success: true },
			{ result: 6, success: true }
		]);
		expect(result.successCount).toBe(2);
	});

	it("passes a dynamic success prompt and the move's successOptions to the chat template when there's at least one success", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [2, 5, 6] });

		await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 5, extraDice: 2 });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			name: PLAN_AND_PREPARE.name,
			variableDiceResult: true,
			target: 5,
			successCount: 2,
			successPrompt: "Choose 2, once per success:",
			successOptions: PLAN_AND_PREPARE.successOptions
		}));
	});

	it("passes null successPrompt and successOptions when there are no successes", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [1, 2] });

		await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 5, extraDice: 1 });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			successCount: 0,
			successPrompt: null,
			successOptions: null
		}));
	});

	it("posts via roll.toMessage with the actor's speaker and the rendered flavor, and no flags key", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [4] });
		renderTemplate.mockResolvedValue("<div>flavor</div>");

		await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 3, extraDice: 0 });

		const rollInstance = Roll.mock.results.at(-1).value;
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(rollInstance.toMessage).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			flavor: "<div>flavor</div>"
		});
	});

	it("returns the chat message, the scored dice, and the success count", async () => {
		const actor = { id: "actor1" };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		mockRoll({ dice: [2, 6] });

		const result = await rollVariableDicePool(actor, PLAN_AND_PREPARE, { target: 5, extraDice: 1 });

		// mockRoll's shared toMessage stub resolves to undefined (see its own definition above) — the
		// same value every other rollMove/rollVariableDicePool test implicitly relies on for `message`.
		expect(result).toEqual({
			message: undefined,
			dice: [
				{ result: 2, success: false },
				{ result: 6, success: true }
			],
			successCount: 1
		});
	});
});
