import { renderTemplate } from "../compat.js";

export const DOWNTIME_SCENE_DIALOG_TEMPLATE = "modules/armor-astir/templates/downtime-scene-dialog.hbs";

// The "?" button's dialog for a Downtime Scene Kind (see downtime-scenes.js) — mirrors
// move-dialogs.js's showMoveDescription (same open-instance tracking, same Promise-wrapped Dialog
// shape) but renders a structured template instead of a raw description string, since a Scene
// Kind's content is two headers plus bullets/sub-bullets/an optional note rather than one block of
// rules text.
let openDowntimeSceneDialog = null;

export async function showDowntimeSceneDetails(sceneKind) {
	openDowntimeSceneDialog?.close();

	const content = await renderTemplate(DOWNTIME_SCENE_DIALOG_TEMPLATE, sceneKind);

	return new Promise((resolve) => {
		const dialog = new Dialog({
			title: sceneKind.name,
			content,
			buttons: {
				close: {
					label: "Close",
					callback: () => resolve()
				}
			},
			default: "close",
			close: () => {
				if (openDowntimeSceneDialog === dialog) {
					openDowntimeSceneDialog = null;
				}
				resolve();
			}
		}, {
			classes: ["armor-astir", "downtime-scene-dialog"]
		});
		openDowntimeSceneDialog = dialog;
		dialog.render(true);
	});
}
