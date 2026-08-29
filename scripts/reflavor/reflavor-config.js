import { MODULE_ID } from "../module-id.js";
import { applyReflavor, resetToBaseline, validateReflavor } from "./reflavor-apply.js";
import { applyCustomContent, resetCustomContent, validateCustomContent } from "../custom-content/custom-content-apply.js";
import { downloadReflavorTemplate } from "./reflavor-export.js";
import { readTextFromFile } from "../compat.js";

export const REFLAVOR_CONFIG_TEMPLATE = "modules/armor-astir/templates/reflavor-config.hbs";

// Counts override entries only — `overrides` is the whole parsed upload, which now also carries the
// sibling "additions" key (see custom-content-schema.js); that key is counted separately by
// additionEntryCount below, not folded into this total. Only ever called from summaryLines once
// `errors` is already known to be empty, so `overrides` is always a real parsed object here (never
// the `null` validateReflavor returns alongside a non-empty `errors`) — no falsy-input guard needed.
function overrideEntryCount(overrides) {
	return Object.entries(overrides)
		.filter(([sectionName]) => sectionName !== "additions")
		.reduce((sum, [, entries]) => sum + Object.keys(entries).length, 0);
}

// `additions` (the uploaded JSON's own optional "additions" key) is commonly absent, unlike
// `overrides` above — a plain reflavor-only upload never has one, so the `!additions` guard here is
// genuinely reachable and stays. Each section's own value, once present, is already guaranteed to be
// an array by validateCustomContent (a non-array section value is an error, which blocks Save before
// summaryLines ever reaches this function), so no further shape-checking is needed on `entries`.
function additionEntryCount(additions) {
	if (!additions) return 0;
	return Object.values(additions).reduce((sum, entries) => sum + entries.length, 0);
}

function summaryLines(overrides, additions, warnings, errors) {
	if (errors.length) return errors.map((error) => `Error: ${error}`);

	const overrideCount = overrideEntryCount(overrides);
	const additionCount = additionEntryCount(additions);

	return [
		`${overrideCount} overrid${overrideCount === 1 ? "e" : "es"} parsed.`,
		`${additionCount} new entr${additionCount === 1 ? "y" : "ies"} parsed.`,
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
		this._pendingAdditions = null;
		this._pendingRawText = null;

		const summary = html.find("[data-reflavor-summary]");
		const saveButton = html.find("[data-reflavor-save]");

		// Validated (never applied) the moment a file is picked, per docs/domains/equipment.md's own
		// lesson about not waiting for Save to discover a problem — Foundry's Dialog closes on any
		// button click regardless of what the callback does, and while a FormApplication's own Save
		// doesn't close the window on its own, catching a malformed file only at submit would still
		// mean the player has no idea anything is wrong until they click it. `additions` is a sibling
		// top-level key on the same parsed JSON (see custom-content-schema.js) — validateReflavor
		// itself now ignores it (see reflavor-apply.js's walkOverrides), so it's validated separately
		// here and both results are folded into one combined summary/error gate.
		html.find("[name='reflavor-file']").on("change", async (event) => {
			const file = event.target.files?.[0];
			if (!file) return;

			const text = await readTextFromFile(file);
			const { overrides, warnings: overrideWarnings, errors: overrideErrors } = validateReflavor(text);
			const additions = overrides?.additions;
			const { warnings: additionWarnings, errors: additionErrors } = validateCustomContent(additions);

			const errors = [...overrideErrors, ...additionErrors];
			const warnings = [...overrideWarnings, ...additionWarnings];

			this._pendingOverrides = errors.length ? null : overrides;
			this._pendingAdditions = errors.length ? null : additions;
			this._pendingRawText = errors.length ? null : text;

			summary.html(summaryLines(overrides, additions, warnings, errors).map((line) => `<p>${line}</p>`).join(""));
			saveButton.prop("disabled", Boolean(errors.length));
		});

		html.find("[data-reflavor-download]").on("click", (event) => {
			event.preventDefault();
			downloadReflavorTemplate();
		});

		html.find("[data-reflavor-clear]").on("click", async (event) => {
			event.preventDefault();
			resetToBaseline();
			resetCustomContent();
			await game.settings.set(MODULE_ID, "reflavorData", "");
			this.render();
		});
	}

	async _updateObject() {
		if (!this._pendingOverrides) return;

		applyReflavor(this._pendingOverrides);
		applyCustomContent(this._pendingAdditions);
		await game.settings.set(MODULE_ID, "reflavorData", this._pendingRawText);
	}
}
