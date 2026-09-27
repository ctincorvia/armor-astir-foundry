import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONFLICT_SCENE_CHAT_TEMPLATE, postConflictSceneDetails } from "../scripts/world-actors/conflict-scene-chat.js";
import { CONFLICT_SCENES } from "../scripts/world-actors/conflict-scenes.js";

const UNFURLING_PLAN = CONFLICT_SCENES.find((scene) => scene.key === "an-unfurling-plan");

beforeEach(() => {
	vi.resetAllMocks();
	renderTemplate.mockResolvedValue("");
});

describe("postConflictSceneDetails", () => {
	it("renders the scene's details and posts them to chat", async () => {
		const actor = { system: {} };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>scene content</div>");

		await postConflictSceneDetails(actor, UNFURLING_PLAN);

		expect(renderTemplate).toHaveBeenCalledWith(CONFLICT_SCENE_CHAT_TEMPLATE, UNFURLING_PLAN);
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>scene content</div>"
		});
	});
});
