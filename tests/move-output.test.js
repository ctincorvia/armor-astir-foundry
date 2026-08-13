import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASIC_MOVES, MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, SPECIAL_MOVES, postGuidedResult, postMoveDescription, showMoveDescription } from "../scripts/moves/moves.js";
import { ALL_PLAYBOOK_MOVES } from "../scripts/moves/playbook-moves.js";
import { mockRoll } from "./helpers/move-test-helpers.js";

const EXCHANGE_BLOWS = BASIC_MOVES.find((m) => m.key === "exchange-blows");
const READ_THE_ROOM = BASIC_MOVES.find((m) => m.key === "read-the-room");
// The one real move carrying separateHold — a roll-tiered hold grant routed into its own
// per-move pool instead of the shared system.resources.hold field (see playbook-moves.js).
const MOBILITY = ALL_PLAYBOOK_MOVES.find((m) => m.key === "the-scout:mobility");
const SUBSYSTEMS = SPECIAL_MOVES.find((m) => m.key === "subsystems");

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

describe("postGuidedResult", () => {
	it("posts the move's mixed-success text as chat content, with no dice", async () => {
		const actor = { system: {} };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>guided</div>");

		await postGuidedResult(actor, EXCHANGE_BLOWS, { weaponLabel: "Rifle" });

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, {
			name: "Exchange Blows",
			traitLabel: null,
			intentLabel: null,
			weaponLabel: "Rifle",
			weaponTags: null,
			tier: "mixed",
			tierLabel: MOVE_RESULT_LABELS.mixed,
			resultText: EXCHANGE_BLOWS.results.mixed,
			reminders: null,
			conditions: [{ key: "guided", label: "Guided" }],
			dice: null,
			hold: null,
			questionPrompt: null,
			questions: null,
			reroll: false
		});
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>guided</div>"
		});
	});

	it("defaults weaponLabel to null when no options are given", async () => {
		const actor = { system: {} };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, EXCHANGE_BLOWS);

		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ weaponLabel: null }));
	});

	it("grants a move's flat hold tier the same way a real roll would", async () => {
		const actor = { system: {}, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, READ_THE_ROOM, {});

		expect(actor.update).toHaveBeenCalledWith({ "system.resources.hold.value": READ_THE_ROOM.hold.mixed });
		expect(renderTemplate).toHaveBeenCalledWith(MOVE_CHAT_TEMPLATE, expect.objectContaining({ hold: READ_THE_ROOM.hold.mixed }));
	});

	it("routes a separateHold move's Guided hold into its own per-move pool", async () => {
		const actor = { system: {}, update: vi.fn() };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });

		await postGuidedResult(actor, MOBILITY, {});

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.moveHold.the-scout:mobility.value": MOBILITY.hold.mixed });
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

describe("showMoveDescription", () => {
	it("opens a Dialog with the move's name and description, without posting to chat or rendering a template", async () => {
		const promise = showMoveDescription(EXCHANGE_BLOWS);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		expect(dialogData.title).toBe(EXCHANGE_BLOWS.name);
		expect(dialogData.content).toContain(EXCHANGE_BLOWS.description);
		expect(Dialog.mock.calls.at(-1)[1]).toEqual({ classes: ["armor-astir", "move-description-dialog"] });
		expect(renderTemplate).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();

		dialogData.close();

		await expect(promise).resolves.toBeUndefined();
	});

	it("resolves when the Close button's callback is invoked, same as closing the dialog", async () => {
		const promise = showMoveDescription(SUBSYSTEMS);

		const dialogData = Dialog.mock.calls.at(-1)[0];
		dialogData.buttons.close.callback();

		await expect(promise).resolves.toBeUndefined();
	});

	it("closes the first dialog and resolves its promise when a second call supersedes it", async () => {
		const firstPromise = showMoveDescription(EXCHANGE_BLOWS);
		const firstDialog = Dialog.mock.instances.at(-1);

		const secondPromise = showMoveDescription(SUBSYSTEMS);

		expect(firstDialog.close).toHaveBeenCalled();
		await expect(firstPromise).resolves.toBeUndefined();

		expect(Dialog.mock.calls.length).toBe(2);
		const secondDialogData = Dialog.mock.calls.at(-1)[0];
		expect(secondDialogData.title).toBe(SUBSYSTEMS.name);
		expect(secondDialogData.content).toContain(SUBSYSTEMS.description);

		secondDialogData.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});

	it("does not re-close the first dialog once it has already closed itself", async () => {
		const firstPromise = showMoveDescription(EXCHANGE_BLOWS);
		const firstDialog = Dialog.mock.instances.at(-1);
		Dialog.mock.calls.at(-1)[0].close();
		await firstPromise;

		const secondPromise = showMoveDescription(SUBSYSTEMS);
		const secondDialog = Dialog.mock.instances.at(-1);

		expect(firstDialog.close).not.toHaveBeenCalled();
		expect(secondDialog.close).not.toHaveBeenCalled();

		secondDialog.close();
		await expect(secondPromise).resolves.toBeUndefined();
	});
});
