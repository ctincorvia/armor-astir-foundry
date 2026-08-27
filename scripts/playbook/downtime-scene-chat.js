import { renderTemplate } from "../compat.js";

export const DOWNTIME_SCENE_CHAT_TEMPLATE = "modules/armor-astir/templates/downtime-scene-chat.hbs";

export async function postDowntimeSceneDetails(actor, sceneKind) {
	const content = await renderTemplate(DOWNTIME_SCENE_CHAT_TEMPLATE, sceneKind);

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content
	});
}
