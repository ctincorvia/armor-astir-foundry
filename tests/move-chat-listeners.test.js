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
	// Restored here in case the registerMoveChatListeners describe block's own generation-13 case
	// ran first and left it overridden.
	game.release.generation = 12;
});

function fakeChatHtml() {
	const state = {
		handler: null,
		automaticSuccessHandler: null,
		downgradeHandler: null,
		heatUpHandler: null,
		addAdvantageHandler: null,
		addDisadvantageHandler: null,
		rollBonusHandler: null,
		appended: [],
		removed: []
	};
	state.html = {
		find: (selector) => {
			if (selector === ".move-reroll") return { on: (event, handler) => { state.handler = handler; } };
			if (selector === ".move-automatic-success") {
				return { on: (event, handler) => { state.automaticSuccessHandler = handler; } };
			}
			if (selector === ".move-downgrade") {
				return { on: (event, handler) => { state.downgradeHandler = handler; } };
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
			if (selector === ".armor-astir-move-chat") {
				return { append: (markup) => { state.appended.push(markup); } };
			}
			if (selector === ".move-roll-bonus") {
				return { on: (event, handler) => { state.rollBonusHandler = handler; } };
			}
			return {};
		}
	};
	return state;
}

describe("registerMoveChatListeners", () => {
	it("defers hook-name resolution to init, then wires renderChatMessage to onRenderMoveChat via toJQuery at generation 12", () => {
		registerMoveChatListeners();

		expect(Hooks.once).toHaveBeenCalledWith("init", expect.any(Function));
		// game.release may not be populated at the module-import time this function itself runs at
		// (see main.js), so the hook name is only resolved once the captured init callback fires.
		const initCallback = Hooks.once.mock.calls.at(-1)[1];
		initCallback();

		expect(Hooks.on).toHaveBeenCalledWith("renderChatMessage", expect.any(Function));

		// Exercises the wiring itself, not just the hook name: the registered callback runs
		// onRenderMoveChat through toJQuery, which passes fakeChatHtml()'s plain-object html straight
		// through (it isn't an HTMLElement) — a message with no offer flags at all is a safe, inert
		// input for this.
		const hookCallback = Hooks.on.mock.calls.at(-1)[1];
		const fake = fakeChatHtml();
		hookCallback({ flags: {} }, fake.html);

		expect(fake.handler).toBeNull();
	});

	it("wires renderChatMessageHTML instead at generation 13", () => {
		game.release.generation = 13;

		registerMoveChatListeners();
		const initCallback = Hooks.once.mock.calls.at(-1)[1];
		initCallback();

		expect(Hooks.on).toHaveBeenCalledWith("renderChatMessageHTML", expect.any(Function));
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
			spendKey: "defensive",
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

	it("records the compound spendKey (not the plain tagKey) for a Versatile reroll, tracking each move independently", async () => {
		const rifle = { id: "eq1", kind: "weapon", name: "Rifle", tags: ["versatile"], spent: [] };
		const actor = { id: "actor1", system: { attributes: { equipment: [rifle] } }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const reroll = {
			actorId: "actor1",
			moveKey: "strike-decisively",
			trait: { key: "clash", label: "CLASH", value: 0 },
			equipmentId: "eq1",
			tagKey: "versatile",
			spendKey: "versatile:strike-decisively",
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle" },
			flavorArgs: { tier: "failure", conditions: [] }
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.equipment": [{ ...rifle, spent: ["versatile:strike-decisively"] }]
		});
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

	it("spends against reroll.spendActorId (a borrowed Carrier weapon) rather than reroll.actorId, writing to that actor's system.attributes.weapons", async () => {
		const playbookActor = { id: "actor1", system: { attributes: { equipment: [] } }, update: vi.fn() };
		const carrier = {
			id: "carrier1",
			system: { attributes: { weapons: { primary: { id: "eq1", spent: [] }, secondary: null } } },
			update: vi.fn()
		};
		game.actors.get.mockImplementation((id) => (id === "actor1" ? playbookActor : id === "carrier1" ? carrier : undefined));
		const reroll = {
			actorId: "actor1",
			spendActorId: "carrier1",
			moveKey: "exchange-blows",
			trait: { key: "crew", label: "CREW", value: 0 },
			equipmentId: "eq1",
			tagKey: "defensive",
			spendKey: "defensive",
			options: { advantage: "none", effect: "none", weaponLabel: "Carrier Cannon" },
			flavorArgs: { tier: "failure", conditions: [] }
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(carrier.update).toHaveBeenCalledWith({
			"system.attributes.weapons": { primary: { id: "eq1", spent: ["defensive"] }, secondary: null }
		});
		expect(playbookActor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(playbookActor, EXCHANGE_BLOWS, reroll.trait, reroll.options);
	});

	it("still rerolls when the borrowed weapon's own Carrier no longer exists, just without marking anything spent", async () => {
		const playbookActor = { id: "actor1", system: { attributes: { equipment: [] } }, update: vi.fn() };
		game.actors.get.mockImplementation((id) => (id === "actor1" ? playbookActor : undefined));
		const reroll = {
			actorId: "actor1",
			spendActorId: "gone-carrier",
			moveKey: "exchange-blows",
			trait: { key: "crew", label: "CREW", value: 0 },
			equipmentId: "eq1",
			tagKey: "defensive",
			spendKey: "defensive",
			options: { advantage: "none", effect: "none", weaponLabel: "Carrier Cannon" },
			flavorArgs: { tier: "failure", conditions: [] }
		};
		const message = { flags: { "armor-astir": { reroll } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.handler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		expect(playbookActor.update).not.toHaveBeenCalled();
		expect(rollMove).toHaveBeenCalledWith(playbookActor, EXCHANGE_BLOWS, reroll.trait, reroll.options);
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
			options: { advantage: "none", effect: "none", weaponLabel: "Rifle", narrativeTags: [] },
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
			critical: false,
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
			critical: false,
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

describe("onRenderMoveChat/handleDowngrade (Embrace Chaos)", () => {
	const EMBRACE_CHAOS_SOURCE = { key: "the-witch:embrace-chaos", name: "Embrace Chaos", amount: 1 };

	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>updated</div>");
	});

	it("does nothing for a message with no downgrade offer", () => {
		const fake = fakeChatHtml();

		onRenderMoveChat({ flags: {} }, fake.html);

		expect(fake.downgradeHandler).toBeNull();
	});

	it("does nothing for a message with no flags at all", () => {
		const fake = fakeChatHtml();

		expect(() => onRenderMoveChat({}, fake.html)).not.toThrow();
		expect(fake.downgradeHandler).toBeNull();
	});

	it("wires the button, disabling it on click, granting hold, and updating the message flavor", async () => {
		const actor = {
			id: "actor1",
			system: { attributes: { moveHold: { "the-witch:embrace-chaos": { value: 0 } } } },
			update: vi.fn()
		};
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "success", critical: false, conditions: [{ key: "advantage", label: "Advantage" }] },
			sources: [EMBRACE_CHAOS_SOURCE]
		};
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false, dataset: { source: "the-witch:embrace-chaos" } };
		fake.downgradeHandler({ currentTarget: button });
		await Promise.resolve();
		await Promise.resolve();

		expect(button.disabled).toBe(true);
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-witch:embrace-chaos.value": 1 });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			tier: "mixed",
			critical: false,
			conditions: [
				{ key: "advantage", label: "Advantage" },
				{ key: "downgrade", label: "Downgraded (Embrace Chaos)" }
			],
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed,
			downgrade: []
		});
		expect(message.update).toHaveBeenCalledWith({ flavor: "<div>updated</div>" });
	});

	it("clamps the granted hold at HOLD_MAX rather than exceeding it", async () => {
		const actor = {
			id: "actor1",
			system: { attributes: { moveHold: { "the-witch:embrace-chaos": { value: 3 } } } },
			update: vi.fn()
		};
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "success", critical: false, conditions: [] },
			sources: [EMBRACE_CHAOS_SOURCE]
		};
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.downgradeHandler({ currentTarget: { disabled: false, dataset: { source: "the-witch:embrace-chaos" } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-witch:embrace-chaos.value": 3 });
	});

	it("treats a missing moveHold pool as 0 when granting", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = {
			actorId: "actor1",
			moveKey: "exchange-blows",
			flavorArgs: { tier: "success", critical: false, conditions: [] },
			sources: [EMBRACE_CHAOS_SOURCE]
		};
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.downgradeHandler({ currentTarget: { disabled: false, dataset: { source: "the-witch:embrace-chaos" } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-witch:embrace-chaos.value": 1 });
	});

	it("does nothing when the actor no longer exists", async () => {
		game.actors.get.mockReturnValue(undefined);
		const offer = { actorId: "gone", moveKey: "exchange-blows", flavorArgs: {}, sources: [EMBRACE_CHAOS_SOURCE] };
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.downgradeHandler({ currentTarget: { disabled: false, dataset: { source: "the-witch:embrace-chaos" } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(renderTemplate).not.toHaveBeenCalled();
		expect(message.update).not.toHaveBeenCalled();
	});

	it("does nothing when the rolled move no longer resolves", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = { actorId: "actor1", moveKey: "not-a-real-move", flavorArgs: {}, sources: [EMBRACE_CHAOS_SOURCE] };
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.downgradeHandler({ currentTarget: { disabled: false, dataset: { source: "the-witch:embrace-chaos" } } });
		await Promise.resolve();
		await Promise.resolve();

		expect(actor.update).not.toHaveBeenCalled();
		expect(renderTemplate).not.toHaveBeenCalled();
	});

	it("does nothing when the clicked source key no longer matches any offered source", async () => {
		const actor = { id: "actor1", system: { attributes: {} }, update: vi.fn() };
		game.actors.get.mockReturnValue(actor);
		const offer = { actorId: "actor1", moveKey: "exchange-blows", flavorArgs: {}, sources: [EMBRACE_CHAOS_SOURCE] };
		const message = { flags: { "armor-astir": { downgrade: offer } }, update: vi.fn() };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		fake.downgradeHandler({ currentTarget: { disabled: false, dataset: { source: "not-a-real-source" } } });
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

	it("recomputes critical (not just tier) when adding a die pushes the total from 10-11 into 12+", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const reminder = "Your opponent is put in peril";
		const offer = baseOffer({ value: 4, extraCriticalReminder: reminder });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(6);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// [2, 2] kept-highest-2 with a freshly rolled 6 added -> keeps 2 and 6 -> 8, +4 value -> 12 (critical).
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			critical: true,
			tierLabel: MOVE_RESULT_LABELS.critical,
			resultText: EXCHANGE_BLOWS.results.success,
			reminders: [reminder]
		}));
	});

	it("also rebuilds a stored extraReminders (Bureaucrat's own unconditional reminders) after a retroactive Advantage add, regardless of the tier it lands on", async () => {
		game.actors.get.mockReturnValue({ id: "actor1" });
		const offer = baseOffer({ value: 3, extraReminders: ["Choose 2, even on a fail:", "Some reminder"] });
		const message = { flags: { "armor-astir": { advantageOffer: offer } }, author: "author1", update: vi.fn() };
		const fake = fakeChatHtml();
		mockDieRoll(6);

		onRenderMoveChat(message, fake.html);
		fake.addAdvantageHandler({ currentTarget: { disabled: false } });
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();

		// Same die push as the extraSuccessReminder test above -> success tier, with no tier-specific
		// reminder text of its own here, but Bureaucrat's own reminders still apply unconditionally.
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({
			tier: "success",
			reminders: ["Choose 2, even on a fail:", "Some reminder"]
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

describe("onRenderMoveChat/handleExternalRollBonus (Spend Inspiration)", () => {
	const BARDIC_INSPIRATION_KEY = "the-icon:bardic-inspiration";
	const SHOWSTOPPER_KEY = "the-icon:showstopper";

	beforeEach(() => {
		renderTemplate.mockClear();
		renderTemplate.mockResolvedValue("<div>bonus</div>");
		game.actors.filter.mockReset();
		game.actors.filter.mockImplementation(() => []);
	});

	// handleExternalRollBonus chains several awaits (actor.update, dieRoll.evaluate, renderTemplate,
	// dieRoll.toMessage) before its own caller's finally block re-enables the button — more
	// microtask ticks than this file's other, shallower handlers need to settle, so a fixed handful
	// of bare `await Promise.resolve()` calls isn't reliably enough. This flushes generously instead.
	async function flushMicrotasks() {
		for (let i = 0; i < 10; i += 1) {
			await Promise.resolve();
		}
	}

	// Overrides the global Roll stub's own default (see tests/setup.js) for exactly the next
	// `new Roll(...)` call, i.e. handleExternalRollBonus's own bonus-die roll — mirrors the
	// mockDieRoll helper in the Add Advantage/Add Disadvantage describe block above (local to that
	// scope, so not reusable here), plus a toMessage stub since — unlike handleAdvantage's die roll,
	// which only ever reads .total — this one is posted as its own chat message.
	function mockBonusDieRoll(total) {
		Roll.mockImplementationOnce(function (formula) {
			this.formula = formula;
			this.evaluate = vi.fn().mockResolvedValue(this);
			this.toMessage = vi.fn().mockResolvedValue(undefined);
			Object.defineProperty(this, "total", { get: () => total, configurable: true });
		});
	}

	function iconActor(overrides = {}) {
		return {
			id: "icon1",
			name: "Icon Player",
			isOwner: true,
			system: {
				attributes: {
					playbookMoves: [BARDIC_INSPIRATION_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 3 } }
				}
			},
			update: vi.fn(),
			...overrides
		};
	}

	function baseAdvantageOffer(overrides = {}) {
		return {
			actorId: "roller1",
			moveKey: "exchange-blows",
			value: 0,
			effectKey: "none",
			advantageKey: "none",
			dice: [],
			extraConditions: [],
			flavorArgs: { name: "Exchange Blows", tier: "failure", conditions: [] },
			...overrides
		};
	}

	it("appends and wires the Spend Inspiration button when the user owns an eligible non-roller Icon actor with hold", () => {
		const icon = iconActor();
		game.actors.filter.mockImplementation((fn) => [icon].filter(fn));
		const message = { flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.appended).toEqual(['<button type="button" class="move-roll-bonus">Spend Inspiration</button>']);
		expect(fake.rollBonusHandler).toBeTypeOf("function");
	});

	it("does not append the button when every candidate is ineligible (the roller themself, a non-owned actor, an actor whose only flagged move is out of hold)", () => {
		const rollerIcon = iconActor({ id: "roller1" });
		const notOwned = iconActor({ id: "gm-owned-elsewhere", isOwner: false });
		const mixedNoHold = iconActor({
			id: "no-hold",
			system: {
				attributes: {
					playbookMoves: ["the-icon:touchstone", BARDIC_INSPIRATION_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 0 } }
				}
			}
		});
		game.actors.filter.mockImplementation((fn) => [rollerIcon, notOwned, mixedNoHold].filter(fn));
		const message = { flags: { "armor-astir": { advantageOffer: baseAdvantageOffer({ actorId: "roller1" }) } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.appended).toEqual([]);
		expect(fake.rollBonusHandler).toBeNull();
	});

	it("treats a missing playbookMoves array and a missing moveHold pool entry as ineligible rather than throwing", () => {
		const noPlaybookMoves = iconActor({ id: "no-moves", system: { attributes: {} } });
		const noMoveHoldEntry = iconActor({
			id: "no-hold-entry",
			system: { attributes: { playbookMoves: [BARDIC_INSPIRATION_KEY], moveHold: {} } }
		});
		game.actors.filter.mockImplementation((fn) => [noPlaybookMoves, noMoveHoldEntry].filter(fn));
		const message = { flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } }, author: "author1" };
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);

		expect(fake.appended).toEqual([]);
		expect(fake.rollBonusHandler).toBeNull();
	});

	it("treats a missing playbookMoves array as empty when resolving a spend for a (bypassed) stale-click actor", async () => {
		const renderTimeIcon = iconActor();
		game.actors.filter.mockReturnValueOnce([renderTimeIcon]);
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		expect(fake.rollBonusHandler).toBeTypeOf("function");

		const noMovesIcon = iconActor({ id: "no-moves", system: { attributes: {} } });
		game.actors.filter.mockReturnValueOnce([noMovesIcon]);
		const rollCallsBefore = Roll.mock.calls.length;

		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		expect(noMovesIcon.update).not.toHaveBeenCalled();
		expect(Roll.mock.calls.length).toBe(rollCallsBefore);
	});

	it("spends the chosen actor's hold 1-for-1, rolls the bonus die, and posts the result as its own announcement mirroring the original roll's whisper/blind", async () => {
		const icon = iconActor();
		game.actors.filter.mockImplementation((fn) => [icon].filter(fn));
		const offer = baseAdvantageOffer();
		const message = {
			flags: { "armor-astir": { advantageOffer: offer } },
			author: "author1",
			whisper: ["gm1"],
			blind: true
		};
		const fake = fakeChatHtml();
		mockBonusDieRoll(3);

		onRenderMoveChat(message, fake.html);
		const button = { disabled: false };
		fake.rollBonusHandler({ currentTarget: button });
		await flushMicrotasks();

		// Re-enabled once the async handler finishes — unlike every other button in this file, this
		// one isn't single-use, since an Icon can spend multiple hold points across multiple clicks.
		expect(button.disabled).toBe(false);
		expect(icon.update).toHaveBeenCalledWith({ [`system.attributes.moveHold.${BARDIC_INSPIRATION_KEY}.value`]: 2 });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: "Bardic Inspiration",
			description: "<p>Icon Player spends Bardic Inspiration to add a bonus d4 to Exchange Blows.</p>"
		});
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor: icon });
		const dieRollInstance = Roll.mock.results.at(-1).value;
		expect(dieRollInstance.formula).toBe("1d4");
		expect(dieRollInstance.toMessage).toHaveBeenCalledWith({
			speaker: undefined,
			flavor: "<div>bonus</div>",
			whisper: ["gm1"],
			blind: true
		});
	});

	it("upgrades the bonus die to d6 when the spending actor has also picked Showstopper", async () => {
		const icon = iconActor({
			system: {
				attributes: {
					playbookMoves: [BARDIC_INSPIRATION_KEY, SHOWSTOPPER_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 3 } }
				}
			}
		});
		game.actors.filter.mockImplementation((fn) => [icon].filter(fn));
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();
		mockBonusDieRoll(5);

		onRenderMoveChat(message, fake.html);
		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		const dieRollInstance = Roll.mock.results.at(-1).value;
		expect(dieRollInstance.formula).toBe("1d6");
		expect(icon.update).toHaveBeenCalledWith({ [`system.attributes.moveHold.${BARDIC_INSPIRATION_KEY}.value`]: 2 });
	});

	it("clamps the spend at HOLD_MIN rather than going negative", async () => {
		const icon = iconActor({
			system: {
				attributes: {
					playbookMoves: [BARDIC_INSPIRATION_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 1 } }
				}
			}
		});
		game.actors.filter.mockImplementation((fn) => [icon].filter(fn));
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();
		mockBonusDieRoll(2);

		onRenderMoveChat(message, fake.html);
		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		expect(icon.update).toHaveBeenCalledWith({ [`system.attributes.moveHold.${BARDIC_INSPIRATION_KEY}.value`]: 0 });
	});

	it("picks randomly among 2+ eligible actors, spending only the chosen one's hold", async () => {
		const iconA = iconActor({ id: "iconA", name: "Icon A" });
		const iconB = iconActor({
			id: "iconB",
			name: "Icon B",
			system: {
				attributes: {
					playbookMoves: [BARDIC_INSPIRATION_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 2 } }
				}
			}
		});
		game.actors.filter.mockImplementation((fn) => [iconA, iconB].filter(fn));
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();
		mockBonusDieRoll(3);
		// floor(0.9 * 2) = 1 -> picks the second eligible actor (iconB).
		const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

		onRenderMoveChat(message, fake.html);
		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		expect(iconB.update).toHaveBeenCalledWith({ [`system.attributes.moveHold.${BARDIC_INSPIRATION_KEY}.value`]: 1 });
		expect(iconA.update).not.toHaveBeenCalled();

		randomSpy.mockRestore();
	});

	it("no-ops when eligibility has vanished entirely between render and click", async () => {
		const renderTimeIcon = iconActor();
		game.actors.filter.mockReturnValueOnce([renderTimeIcon]);
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		expect(fake.rollBonusHandler).toBeTypeOf("function");

		// Simulates hold running out between the card's render and the click: the handler's own
		// fresh re-check of eligibility (rather than trusting the render-time snapshot) comes back
		// empty this time.
		game.actors.filter.mockReturnValueOnce([]);
		const rollCallsBefore = Roll.mock.calls.length;

		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		expect(renderTimeIcon.update).not.toHaveBeenCalled();
		expect(Roll.mock.calls.length).toBe(rollCallsBefore);
	});

	it("no-ops a stale click when the chosen actor's own hold ran out (resolveExternalRollBonus finds nothing spendable)", async () => {
		const renderTimeIcon = iconActor();
		game.actors.filter.mockReturnValueOnce([renderTimeIcon]);
		const message = {
			flags: { "armor-astir": { advantageOffer: baseAdvantageOffer() } },
			author: "author1",
			whisper: [],
			blind: false
		};
		const fake = fakeChatHtml();

		onRenderMoveChat(message, fake.html);
		expect(fake.rollBonusHandler).toBeTypeOf("function");

		// The fresh eligibility re-check still (deliberately, for this test) reports the actor as
		// eligible, but that actor's own hold has since run out — resolveExternalRollBonus is the
		// second, per-actor guard against exactly this staleness.
		const staleIcon = iconActor({
			system: {
				attributes: {
					playbookMoves: ["the-icon:touchstone", BARDIC_INSPIRATION_KEY],
					moveHold: { [BARDIC_INSPIRATION_KEY]: { value: 0 } }
				}
			}
		});
		game.actors.filter.mockReturnValueOnce([staleIcon]);
		const rollCallsBefore = Roll.mock.calls.length;

		fake.rollBonusHandler({ currentTarget: { disabled: false } });
		await flushMicrotasks();

		expect(staleIcon.update).not.toHaveBeenCalled();
		expect(Roll.mock.calls.length).toBe(rollCallsBefore);
	});
});
