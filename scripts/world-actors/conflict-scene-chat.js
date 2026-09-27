import { renderTemplate } from "../compat.js";

export const CONFLICT_SCENE_CHAT_TEMPLATE = "modules/armor-astir/templates/conflict-scene-chat.hbs";

export async function postConflictSceneDetails(actor, scene) {
	const content = await renderTemplate(CONFLICT_SCENE_CHAT_TEMPLATE, scene);

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content
	});
}
