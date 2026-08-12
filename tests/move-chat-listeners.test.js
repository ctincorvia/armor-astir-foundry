import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../scripts/moves/moves.js", async (importOriginal) => ({
	...(await importOriginal()),
	rollMove: vi.fn()
}));

import { BASIC_MOVES, MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, rollMove } from "../scripts/moves/moves.js";
import { registerMoveChatListeners, onRenderMoveChat } from "../scripts/moves/move-chat-listeners.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const BITE_THE_DUST = BASIC_MOVES.find((m) => m.key === "bite-the-dust");

beforeEach(() => {
	rollMove.mockClear();
	// rollMove resolves { message, dice } (see moves.js) — a bare default so every existing test
	// that doesn't care about the roll's dice (most of them) doesn't have to configure this itself.
	// Tests that do care (Flourish Component's doubles regen) override this per-test.
	rollMove.mockResolvedValue({ message: undefined, dice: null });
	// tests/setup.js defaults game.user to a GM so every test not specifically exercising the
	// Add Advantage/Disadvantage permission check exercises the "allowed" path with no per-test
	// setup of its own — restored here in case an earlier test in this file overrode it.
	game.user.isGM = true;
	game.user.id = "test-user";
});

function fakeChatHtml() {
	const state = {
		handler: null, automaticSuccessHandler: null, heatUpHandler: null, addAdvantageHandler: null, addDisadvantageHandler: null, removed: []
	};
	state.html = {
		find: (selector) => {
			if (selector === ".move-reroll") return { on: (event, handler) => { state.handler = handler; } };
			if (selector === ".move-automatic-success") {
				return { on: (event, handler) => { state.automaticSuccessHandler = handler; } };
			}
			if (selector === ".move-heatup") return { on: (event, handler) => { state.heatUpHandler = handler; } };
			if (selector === ".move-add-advantage") {
				return { on: (event, handler) => { state.addAdvantageHandler = handler; } };
			}
			if (selector === ".move-add-disadvantage") {
				return { on: (event, handler) => { state.addDisadvantageHandler = handler; } };
			}
			if (selector === ".move-add-advantage, .move-add-disadvantage") {
				return { remove: () => { state.removed.push(selector); } };
			}
			return {};
		}
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
	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>updated</div>");
	});

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

	it("wires the Reroll button, disabling it on click, striking through the original card, and rerunning the move", async () => {
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", tags: ["defensive"], spent: [] };
		const actor = { id: "actor1", system: { attributes: { equipment: [rifle] } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: { key: "clash", label: "CLASH", value: 0 },
			equipmentId: "eq1",
			tagKey: "defensive",
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle" },
			flavorArgs: { tier: "failure", conditions: [] }
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false };
		fake.handler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["defensive"] }]
		});
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ reroll: false, superseded: true }));
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
		expect(rollMove).toHaveBeenCalledWith(actor, EXCHANGE_BLOWS, reroll.trait, reroll.options);
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const reroll = {
			actorId: "gone", moveKey: "exchange-blows", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1", moveKey: "not-a-real-move", trait: {}, equipmentId: "eq1", tagKey: "defensive", options: {}
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("treats a missing equipment array as empty when marking the reroll tag spent", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: {},
			equipmentId: "eq1",
			tagKey: "defensive",
			options: {},
			flavorArgs: { tier: "failure", conditions: [] }
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.equipment": [] });
	});
});

describe("onRenderMoveChat (Heat Up)", () => {
	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>updated</div>");
	});

	it("does nothing for a message with no heat up offer", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.heatUpHandler).toBeNull();
	});

	it("does nothing for a message with no flags at all", () => {
		const fake = fakeChatHtml();

		expect(() => onRenderMoveChat({}, fake.html)).not.toThrow();
		expect(fake.heatUpHandler).toBeNull();
	});

	it("wires the Heat Up button, disabling it on click, ticking Overheating, striking through the original card, and rerunning the move", async () => {
		const actor = { id: "actor1", system: { attributes: { astir: { id: "a1", piloted: true } } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const heatUp = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			trait: { key: "clash", label: "CLASH", value: 0 },
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle", weaponTags: null },
			flavorArgs: { tier: "mixed", conditions: [] }
		};
		const message = { flags: { "armor-astir": { heatUp } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false };
		fake.heatUpHandler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.astir.overheating": true });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ heatUp: false, superseded: true }));
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
		expect(rollMove).toHaveBeenCalledWith(actor, EXCHANGE_BLOWS, heatUp.trait, heatUp.options);
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const heatUp = { actorId: "gone", moveKey: "exchange-blows", trait: {}, options: {} };
		const message = { flags: { "armor-astir": { heatUp } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.heatUpHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});

	it("does nothing when the move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const heatUp = { actorId: "actor1", moveKey: "not-a-real-move", trait: {}, options: {} };
		const message = { flags: { "armor-astir": { heatUp } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.heatUpHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
		expect(rollMove).not.toHaveBeenCalled();
	});
});

describe("onRenderMoveChat/handleAutomaticSuccess (Hot-blooded/Once the War's Over/The Arity Method)", () => {
	const HOT_BLOODED_SOURCE = { key: "the-impostor:hot-blooded", name: "Hot-blooded", cost: 3 };
	const ARITY_METHOD_SOURCE = { key: "soldier:the-arity-method", name: "The Arity Method", useKey: "sortie", moves: ["bite-the-dust"] };

	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>updated</div>");
	});

	it("does nothing for a message with no automatic success offer", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.automaticSuccessHandler).toBeNull();
	});

	it("wires the button, disabling it on click, spending hold, and updating the message flavor", async () => {
		const actor = {
			id: "actor1",
			system: { attributes: { moveHold: { "the-impostor:hot-blooded": { value: 3 } } } },
			update: vi.fn()
		};
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "mixed", conditions: [{ key: "confidence", label: "Confidence" }] },
			sources: [HOT_BLOODED_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false, dataset: { source: "the-impostor:hot-blooded" } };
		fake.automaticSuccessHandler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-impostor:hot-blooded.value": 0 });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			tier: "success",
			conditions: [
				{ key: "confidence", label: "Confidence" },
				{ key: "automatic-success", label: "Automatic Success (Hot-blooded)" }
			],
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: EXCHANGE_BLOWS.results.success,
			reminders: null,
			automaticSuccess: []
		});
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
	});

	it("clamps the spend at HOLD_MIN rather than going negative", async () => {
		const actor = {
			id: "actor1",
			system: { attributes: { moveHold: { "soldier:once-the-wars-over": { value: 1 } } } },
			update: vi.fn()
		};
		game.actors.get.mockReturnValue(actor);
		const source = { key: "soldier:once-the-wars-over", name: "Once the War's Over", cost: 1 };
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "failure", conditions: [] },
			sources: [source]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: source.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.soldier:once-the-wars-over.value": 0 });
	});

	it("treats a missing moveHold pool as 0 when spending a cost-based source", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "failure", conditions: [] },
			sources: [HOT_BLOODED_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: HOT_BLOODED_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-impostor:hot-blooded.value": 0 });
	});

	it("spends a useKey source via its own moveUses checkbox instead of hold", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "bite-the-dust",
			flavorArgs: { tier: "mixed", conditions: [] },
			sources: [ARITY_METHOD_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: ARITY_METHOD_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveUses.soldier:the-arity-method.sortie": true });
		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ resultText: BITE_THE_DUST.results.success })
		);
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
	});

	it("spends a costsPeril source (Dark Rebirth) by appending a fresh peril Danger, instead of hold or uses", async () => {
		const DARK_REBIRTH_SOURCE = { key: "the-wither:dark-rebirth", name: "Dark Rebirth", moves: ["bite-the-dust"], costsPeril: true };
		const actor = { id: "actor1", system: { attributes: { dangers: [{ id: "d1", type: "risk", label: "existing" }] } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "bite-the-dust",
			flavorArgs: { tier: "failure", conditions: [] },
			sources: [DARK_REBIRTH_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: DARK_REBIRTH_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [
				{ id: "d1", type: "risk", label: "existing" },
				{ id: "test-id", type: "peril", label: "Dark Rebirth" }
			]
		});
		expect(renderTemplate).toHaveBeenCalledWith(
			MOVE_CHAT_TEMPLATE,
			expect.objectContaining({ resultText: BITE_THE_DUST.results.success })
		);
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
	});

	it("treats a missing dangers array as empty when a costsPeril source is spent", async () => {
		const DARK_REBIRTH_SOURCE = { key: "the-wither:dark-rebirth", name: "Dark Rebirth", moves: ["bite-the-dust"], costsPeril: true };
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "bite-the-dust",
			flavorArgs: { tier: "failure", conditions: [] },
			sources: [DARK_REBIRTH_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: DARK_REBIRTH_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.dangers": [{ id: "test-id", type: "peril", label: "Dark Rebirth" }]
		});
	});

	it("spends a costless source (Ain't No Grave) with no actor.update for the spend, only re-rendering the flavor", async () => {
		const COSTLESS_SOURCE = { key: "the-revenant:aint-no-grave", name: "Ain't No Grave" };
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "failure", conditions: [] },
			sources: [COSTLESS_SOURCE]
		};
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: COSTLESS_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			tier: "success",
			conditions: [{ key: "automatic-success", label: "Automatic Success (Ain't No Grave)" }],
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: EXCHANGE_BLOWS.results.success,
			reminders: null,
			automaticSuccess: []
		});
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const offer = { actorId: "gone", moveKey: "exchange-blows", flavorArgs: {}, sources: [HOT_BLOODED_SOURCE] };
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: HOT_BLOODED_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it("does nothing when the rolled move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = { actorId: "actor1", moveKey: "not-a-real-move", flavorArgs: {}, sources: [HOT_BLOODED_SOURCE] };
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: HOT_BLOODED_SOURCE.key } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
	});

	it("does nothing when the clicked source key no longer matches any offered source", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = { actorId: "actor1", moveKey: "exchange-blows", flavorArgs: {}, sources: [HOT_BLOODED_SOURCE] };
		const message = { flags: { "armor-astir": { automaticSuccess: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.automaticSuccessHandler({ currentTarget: { disabled: false, dataset: { source: "not-a-real-source" } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
	});
});

describe("onRenderMoveChat/handleAdvantage (Add Advantage/Add Disadvantage)", () => {
	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>updated</div>");
	});

	// Overrides the global Roll stub's own default (total always 0 — see tests/setup.js) for
	// exactly the next `new Roll(...)` call, i.e. handleAdvantage's own "1d6" die.
	function mockDieRoll(total) {
		Roll.mockImplementationOnce(function () {
			this.evaluate = vi.fn().mockResolvedValue(this);
			Object.defineProperty(this, "total", { get: () => total, configurable: true });
		});
	}

	function baseOffer(overrides = {}) {
		return {
			actorId: "actor1",
			moveKey: "exchange-blows",
			value: 0,
			effectKey: "none",
			advantageKey: "none",
			dice: [
				{ original: 2, result: 2, changed: false, kept: true },
				{ original: 2, result: 2, changed: false, kept: true }
			],
			extraConditions: [],
			flavorArgs: { tier: "failure", conditions: [] },
			...overrides
		};
	}

	it("does nothing for a message with no advantageOffer flag", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.addAdvantageHandler).toBeNull();
		expect(fake.addDisadvantageHandler).toBeNull();
	});

	it("wires both buttons for a GM, even when they aren't the message's author", () => {
		game.user.isGM = true;
		game.user.id = "gm-user";
		const message = { flags: { "armor-astir": { advantageOffer: baseOffer() } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.addAdvantageHandler).toBeTypeOf("function");
		expect(fake.addDisadvantageHandler).toBeTypeOf("function");
		expect(fake.removed).toEqual([]);
	});

	it("wires both buttons for a non-GM who is the message's own author", () => {
		game.user.isGM = false;
		game.user.id = "author1";
		const message = { flags: { "armor-astir": { advantageOffer: baseOffer() } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.addAdvantageHandler).toBeTypeOf("function");
		expect(fake.addDisadvantageHandler).toBeTypeOf("function");
	});

	it("removes both buttons for a non-GM who is not the message's author", () => {
		game.user.isGM = false;
		game.user.id = "someone-else";
		const message = { flags: { "armor-astir": { advantageOffer: baseOffer() } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.addAdvantageHandler).toBeNull();
		expect(fake.addDisadvantageHandler).toBeNull();
		expect(fake.removed).toEqual([".move-add-advantage, .move-add-disadvantage"]);
	});

	it("disables the clicked button synchronously, before the die roll resolves", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const message = { flags: { "armor-astir": { advantageOffer: baseOffer() } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(4);

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false };
		fake.addAdvantageHandler({ currentTarget: button });

		expect(button.disabled).toBe(true);
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	});

	it("adds a die, re-applies keep-highest, and can flip a failure into a mixed success", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({ value: 1 });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(6);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// [2, 2] kept-highest-2 with a freshly rolled 6 added -> keeps 2 and 6 -> 8, +1 value -> 9 (mixed).
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed
		}));
		expect(message.update).toHaveBeenCalledWith({
			flavor: "<div>updated</div>",
			content: "9",
			flags: {
				"armor-astir": {
					advantageOffer: expect.objectContaining({ advantageKey: "advantage", dice: expect.any(Array) })
				}
			}
		});
	});

	it("substitutes the added die's face under Confidence, mirroring the original roll's own effect", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({ value: 0, effectKey: "confidence" });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(1);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// [2, 2] kept-highest-2 with a rolled 1 that Confidence substitutes to 6 -> keeps 2 and 6 -> 8 (mixed).
		expect(message.update).toHaveBeenCalledWith(expect.objectContaining({
			content: "8",
			flags: {
				"armor-astir": {
					advantageOffer: expect.objectContaining({
						dice: expect.arrayContaining([expect.objectContaining({ original: 1, result: 6, changed: true, kept: true })])
					})
				}
			}
		}));
	});

	it("substitutes the added die's face under Desperation, mirroring the original roll's own effect", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({ value: 0, effectKey: "desperation" });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(6);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// [2, 2] kept-highest-2 with a rolled 6 that Desperation substitutes to 1 -> keeps 2 and 2 -> 4 (failure).
		expect(message.update).toHaveBeenCalledWith(expect.objectContaining({
			content: "4",
			flags: {
				"armor-astir": {
					advantageOffer: expect.objectContaining({
						dice: expect.arrayContaining([expect.objectContaining({ original: 6, result: 1, changed: true, kept: false })])
					})
				}
			}
		}));
	});

	it("rebuilds a stored extraSuccessReminder (e.g. Captain's Coordinator) once the flipped tier lands on a 10+", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const reminder = "If you chose to help, your ally may act with confidence in addition to advantage.";
		const offer = baseOffer({ value: 3, extraSuccessReminder: reminder });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(6);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// [2, 2] kept-highest-2 with a freshly rolled 6 added -> keeps 2 and 6 -> 8, +3 value -> 11 (success).
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			tierLabel: MOVE_RESULT_LABELS.success,
			resultText: EXCHANGE_BLOWS.results.success,
			reminders: [reminder]
		}));
	});

	it("steps advantage back down to none when disadvantage is clicked, without rolling a new die", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({
			advantageKey: "advantage",
			dice: [
				{ original: 2, result: 2, changed: false, kept: false },
				{ original: 2, result: 2, changed: false, kept: true },
				{ original: 5, result: 5, changed: false, kept: true }
			]
		});
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		const rollCallsBefore = Roll.mock.calls.length;

		onRenderMoveChat(message, fake.html);
		fake.addDisadvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// Stepping down only discards a die, it never rolls a fresh one — [2, 5] kept-highest-2
		// loses its top die, leaving the flat [2, 2] pair -> 4.
		expect(Roll.mock.calls.length).toBe(rollCallsBefore);
		expect(message.update).toHaveBeenCalledWith({
			flavor: "<div>updated</div>",
			content: "4",
			flags: {
				"armor-astir": {
					advantageOffer: expect.objectContaining({ advantageKey: "none", dice: expect.any(Array) })
				}
			}
		});
	});

	it("steps advantage x2 back down to advantage x1 when disadvantage is clicked", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({
			advantageKey: "advantage2",
			dice: [
				{ original: 2, result: 2, changed: false, kept: false },
				{ original: 2, result: 2, changed: false, kept: false },
				{ original: 4, result: 4, changed: false, kept: true },
				{ original: 5, result: 5, changed: false, kept: true }
			]
		});
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		const rollCallsBefore = Roll.mock.calls.length;

		onRenderMoveChat(message, fake.html);
		fake.addDisadvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// Dropping the most-recently-added die (the second 4->5 stack-up) leaves [2, 2, 4]
		// keep-highest-2 -> 2 and 4 kept -> 6.
		expect(Roll.mock.calls.length).toBe(rollCallsBefore);
		expect(message.update).toHaveBeenCalledWith({
			flavor: "<div>updated</div>",
			content: "6",
			flags: {
				"armor-astir": {
					advantageOffer: expect.objectContaining({ advantageKey: "advantage", dice: expect.any(Array) })
				}
			}
		});
	});

	it("does nothing once already maxed at advantage x2 and advantage is clicked again", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const message = {
			flags: { "armor-astir": { advantageOffer: baseOffer({ advantageKey: "advantage2" }) } },
			author: "author1",
			update: vi.fn()
		};
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(message.update).not.toHaveBeenCalled();
	});

	it("showAddAdvantage flips false once the x2 cap is reached, but showAddDisadvantage stays true so the stack can still be stepped down", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const message = {
			flags: { "armor-astir": { advantageOffer: baseOffer({ advantageKey: "advantage" }) } },
			author: "author1",
			update: vi.fn()
		};
		const fake = fakeChatHtml();
		mockDieRoll(5);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			showAddAdvantage: false,
			showAddDisadvantage: true
		}));
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const message = { flags: { "armor-astir": { advantageOffer: baseOffer() } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(message.update).not.toHaveBeenCalled();
	});

	it("does nothing when the rolled move no longer resolves", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const message = {
			flags: { "armor-astir": { advantageOffer: baseOffer({ moveKey: "not-a-real-move" }) } },
			author: "author1",
			update: vi.fn()
		};
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();

		expect(message.update).not.toHaveBeenCalled();
	});
});
