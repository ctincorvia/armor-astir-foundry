import { MODULE_ID } from "../module-id.js";
import { applyReflavor, resetToBaseline, validateReflavor } from "./reflavor-apply.js";
import { downloadReflavorTemplate } from "./reflavor-export.js";
import { readTextFromFile } from "../compat.js";

export const REFLAVOR_CONFIG_TEMPLATE = "modules/armor-astir/templates/reflavor-config.hbs";

function summaryLines(overrides, warnings, errors) {
	const entryCount = overrides
		? Object.values(overrides).reduce((sum, entries) => sum + Object.keys(entries).length, 0)
		: 0;

	return [
		...(errors.length ? errors.map((error) => `Error: ${error}`) : [`${entryCount} entr${entryCount === 1 ? "y" : "ies"} parsed.`]),
		...warnings.map((warning) => `Warning: ${warning}`)
	];
}

// The repo's first FormApplication — a deliberate, justified departure from the Dialog convention
// every other picker in this module uses (see docs/domains/reflavor.md): this is a persistent
// GM-only world config, not a transient picker launched from a sheet, which is exactly what
// FormApplication + registerMenu's restricted: true is for.
export class ReflavorConfig extends FormApplication {
	// Matches pbta's own sheets — silences AppV1's v13+ deprecation warning with no behaviour change.
	static _warnedAppV1 = true;

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "armor-astir-reflavor-config",
			title: "Armor Astir — Reflavor",
			template: REFLAVOR_CONFIG_TEMPLATE,
			classes: ["armor-astir"],
			width: 480
		});
	}

	getData() {
		return { warnings: [], errors: [] };
	}

	activateListeners(html) {
		super.activateListeners(html);

		this._pendingOverrides = null;
		this._pendingRawText = null;

		const summary = html.find("[data-reflavor-summary]");
		const saveButton = html.find("[data-reflavor-save]");

		// Validated (never applied) the moment a file is picked, per docs/domains/equipment.md's own
		// lesson about not waiting for Save to discover a problem — Foundry's Dialog closes on any
		// button click regardless of what the callback does, and while a FormApplication's own Save
		// doesn't close the window on its own, catching a malformed file only at submit would still
		// mean the player has no idea anything is wrong until they click it.
		html.find("[name='reflavor-file']").on("change", async (event) => {
			const file = event.target.files?.[0];
			if (!file) return;

			const text = await readTextFromFile(file);
			const { overrides, warnings, errors } = validateReflavor(text);

			this._pendingOverrides = errors.length ? null : overrides;
			this._pendingRawText = errors.length ? null : text;

			summary.html(summaryLines(overrides, warnings, errors).map((line) => `<p>${line}</p>`).join(""));
			saveButton.prop("disabled", Boolean(errors.length));
		});

		html.find("[data-reflavor-download]").on("click", (event) => {
			event.preventDefault();
			downloadReflavorTemplate();
		});

		html.find("[data-reflavor-clear]").on("click", async (event) => {
			event.preventDefault();
			resetToBaseline();
			await game.settings.set(MODULE_ID, "reflavorData", "");
			this.render();
		});
	}

	async _updateObject() {
		if (!this._pendingOverrides) return;

		applyReflavor(this._pendingOverrides);
		await game.settings.set(MODULE_ID, "reflavorData", this._pendingRawText);
	}
}
