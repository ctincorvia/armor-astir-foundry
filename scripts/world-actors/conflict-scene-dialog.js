import { renderTemplate } from "../compat.js";

export const CONFLICT_SCENE_DIALOG_TEMPLATE = "modules/armor-astir/templates/conflict-scene-dialog.hbs";

// Same open-instance tracking and Promise-wrapped Dialog as downtime-scene-dialog.js.
let openConflictSceneDialog = null;

export async function showConflictSceneDetails(scene) {
	openConflictSceneDialog?.close();

	const content = await renderTemplate(CONFLICT_SCENE_DIALOG_TEMPLATE, scene);

	return new Promise((resolve) => {
		const dialog = new Dialog({
			title: "Conflict Scene",
			content,
			buttons: {
				close: {
					label: "Close",
					callback: () => resolve()
				}
			},
			default: "close",
			close: () => {
				if (openConflictSceneDialog === dialog) {
					openConflictSceneDialog = null;
				}
				resolve();
			}
		}, {
			classes: ["armor-astir", "conflict-scene-dialog"]
		});
		openConflictSceneDialog = dialog;
		dialog.render(true);
	});
}
