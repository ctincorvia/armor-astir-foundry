import { createTextEditor, renderTemplate, serializeEditorContent } from "../compat.js";

export const MOVE_CUSTOMIZATION_EDITOR_TEMPLATE = "modules/armor-astir/templates/move-customization-editor.hbs";

// Opens the rename/rewrite-description dialog and resolves { name, description }, or null if
// dismissed or confirmed with no name. Mirrors configureEquipment's Promise/Dialog/resolve(null)
// shape (equipment-dialogs.js), but for just two fields — no live Save-button-disable machinery.
// `move` is expected to already be the current effective display (post-reflavor, post-override —
// see move-roll-mixin.js's _resolveAnyMove), so re-opening shows the player's last edit. The
// description is edited via a standalone ProseMirror editor (mounted in `render`, serialized on
// Save) rather than a plain textarea, since the description is stored/rendered as HTML.
export async function configureMoveCustomization(move) {
	const content = await renderTemplate(MOVE_CUSTOMIZATION_EDITOR_TEMPLATE, {
		name: move.name
	});

	return new Promise((resolve) => {
		let editor = null;

		new Dialog({
			title: `Edit ${move.name}`,
			content,
			render: async (html) => {
				editor = await createTextEditor({ target: html.find(".move-customization-description-editor .editor-content")[0] }, move.description ?? "");
			},
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
						const description = editor ? serializeEditorContent(editor).trim() : move.description;
						resolve({ name, description });
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			close: () => {
				editor?.destroy();
				resolve(null);
			},
			default: "save"
		}, { classes: ["armor-astir", "move-customization-editor"], width: 480 }).render(true);
	});
}
