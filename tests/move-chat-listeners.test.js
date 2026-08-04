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
});

function fakeChatHtml() {
	const state = { handler: null, automaticSuccessHandler: null };
	state.html = {
		find: (selector) => {
			if (selector === ".move-reroll") return { on: (event, handler) => { state.handler = handler; } };
			if (selector === ".move-automatic-success") {
				return { on: (event, handler) => { state.automaticSuccessHandler = handler; } };
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
