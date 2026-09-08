import { renderTemplate } from "../compat.js";

export const MOVE_CUSTOMIZATION_EDITOR_TEMPLATE = "modules/armor-astir/templates/move-customization-editor.hbs";

// Opens the rename/rewrite-description dialog and resolves { name, description }, or null if
// dismissed or confirmed with no name. Mirrors configureEquipment's Promise/Dialog/resolve(null)
// shape (equipment-dialogs.js), but for just two fields — no live Save-button-disable machinery.
// `move` is expected to already be the current effective display (post-reflavor, post-override —
// see move-roll-mixin.js's _resolveAnyMove), so re-opening shows the player's last edit.
export async function configureMoveCustomization(move) {
	const content = await renderTemplate(MOVE_CUSTOMIZATION_EDITOR_TEMPLATE, {
		name: move.name,
		description: move.description
	});

	return new Promise((resolve) => {
		new Dialog({
			title: `Edit ${move.name}`,
			content,
			buttons: {
				save: {
					label: "Save",
					callback: (html) => {
						const name = html.find("[name='name']").val().trim();
						if (!name) {
							ui.notifications.warn("This needs a name.");
							resolve(null);
							return;
						}
						resolve({ name, description: html.find("[name='description']").val().trim() });
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "save",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "move-customization-editor"], width: 480 }).render(true);
	});
}
