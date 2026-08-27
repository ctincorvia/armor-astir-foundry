import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOWNTIME_SCENE_CHAT_TEMPLATE, postDowntimeSceneDetails } from "../scripts/playbook/downtime-scene-chat.js";
import { DOWNTIME_SCENE_KINDS } from "../scripts/playbook/downtime-scenes.js";

const FADE = DOWNTIME_SCENE_KINDS.find((kind) => kind.key === "fade");

beforeEach(() => {
	vi.resetAllMocks();
	renderTemplate.mockResolvedValue("");
});

describe("postDowntimeSceneDetails", () => {
	it("renders the scene kind's details and posts them to chat", async () => {
		const actor = { system: { stats: {} } };
		ChatMessage.getSpeaker.mockReturnValue({ actor: "speaker" });
		renderTemplate.mockResolvedValue("<div>scene content</div>");

		await postDowntimeSceneDetails(actor, FADE);

		expect(renderTemplate).toHaveBeenCalledWith(DOWNTIME_SCENE_CHAT_TEMPLATE, FADE);
		expect(ChatMessage.getSpeaker).toHaveBeenCalledWith({ actor });
		expect(ChatMessage.create).toHaveBeenCalledWith({
			speaker: { actor: "speaker" },
			content: "<div>scene content</div>"
		});
	});
});
