import { getRoute } from "../compat.js";
import { MODULE_ID } from "../module-id.js";

// Converts the fetched docs/custom-moves.md markdown into HTML via showdown when it's loaded
// (Foundry core bundles it, but nothing guarantees it's actually present at runtime), falling back
// to a <pre>-wrapped raw-text render rather than throwing — same graceful-degradation philosophy as
// custom-content-apply.js's own "never throws, just warns and drops" treatment of an unrecognized
// field. Options mirror this codebase's one other rich-text need (move descriptions are plain HTML
// already, so this is genuinely new): tables/strikethrough for a reference doc's own field tables,
// noHeaderId/tablesHeaderId off since no anchor links are needed inside a Dialog.
function markdownToHtml(markdownText) {
	if (!window.showdown) return `<pre>${markdownText}</pre>`;

	const converter = new window.showdown.Converter({
		disableForced4SpacesIndentedSublists: true,
		noHeaderId: true,
		parseImgDimensions: true,
		strikethrough: true,
		tables: true,
		tablesHeaderId: true
	});
	return converter.makeHtml(markdownText);
}

// The "?" button's counterpart to showMoveDescription (move-dialogs.js), fetching docs/custom-moves.md
// out of the installed module folder instead of reading a move's own description field — see
// docs/custom-moves.md's own doc comment for why this file is both the GitHub-readable dev reference
// and the raw source rendered here. Tracks the currently-open instance the same way
// showMoveDescription does, so a second call closes the first dialog and resolves its promise rather
// than leaving it open forever.
let openCustomMoveReferenceDialog = null;

export async function showCustomMoveFieldReference() {
	openCustomMoveReferenceDialog?.close();

	let html;
	try {
		const response = await fetch(getRoute(`modules/${MODULE_ID}/docs/custom-moves.md`));
		if (!response.ok) throw new Error(`Unexpected response status ${response.status}`);
		const markdownText = await response.text();
		html = markdownToHtml(markdownText);
	} catch {
		// Network failure, a non-ok response, or a missing docs/custom-moves.md (e.g. an old release
		// zip built before docs was added to the packaged files) all degrade to the same message
		// rather than crashing the panel — mirrors custom-content-apply.js's own warn-and-continue
		// philosophy.
		html = "<p>Couldn't load the reference doc. It should be at docs/custom-moves.md in the module folder.</p>";
	}

	return new Promise((resolve) => {
		const dialog = new Dialog({
			title: "Custom Move Field Reference",
			content: `<div class="custom-move-reference-content">${html}</div>`,
			buttons: {
				close: {
					label: "Close",
					callback: () => resolve()
				}
			},
			default: "close",
			close: () => {
				if (openCustomMoveReferenceDialog === dialog) {
					openCustomMoveReferenceDialog = null;
				}
				resolve();
			}
		}, {
			classes: ["armor-astir", "custom-move-reference-dialog"],
			// Default Dialog width is 400 (dialog-v1.mjs) — 3x that, since this content is a whole
			// Markdown doc with tables, not a single move's rules text.
			width: 1200
		});
		openCustomMoveReferenceDialog = dialog;
		dialog.render(true);
	});
}
