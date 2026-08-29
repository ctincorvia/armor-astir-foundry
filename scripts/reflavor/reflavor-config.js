import { MODULE_ID } from "../module-id.js";
import { applyReflavor, resetToBaseline, validateReflavor } from "./reflavor-apply.js";
import { applyCustomContent, resetCustomContent, validateCustomContent } from "../custom-content/custom-content-apply.js";
import { downloadReflavorTemplate } from "./reflavor-export.js";
import { readTextFromFile } from "../compat.js";
import { REFLAVOR_SECTIONS, resolveSectionCatalog } from "./reflavor-schema.js";
import { CUSTOM_CONTENT_SECTIONS } from "../custom-content/custom-content-schema.js";

export const REFLAVOR_CONFIG_TEMPLATE = "modules/armor-astir/templates/reflavor-config.hbs";

// Friendly labels for the entry-management UI's section pickers/rows — REFLAVOR_SECTIONS/
// CUSTOM_CONTENT_SECTIONS are keyed by camelCase JSON section names, not display text.
const REFLAVOR_SECTION_LABELS = {
	moves: "Moves",
	equipment: "Equipment",
	equipmentTags: "Equipment Tags",
	astirParts: "Astir Parts",
	astirWeapons: "Astir Weapons"
};

const ADDITION_SECTION_LABELS = {
	equipment: "Equipment",
	astirWeapons: "Astir Weapons",
	astirParts: "Astir Parts",
	moves: "Moves"
};

// Reads and parses the persisted "reflavorData" world setting for the entry-management UI (view/
// add/remove) below — distinct from the whole-file upload flow's own this._pendingRawText, which
// tracks an unsaved file pick. Malformed JSON or a non-object root (mirroring validateReflavor's own
// root-shape check) both fall back to an empty state rather than throwing, since an empty/never-set
// setting is the common case this function must also handle cleanly.
export function currentReflavorState() {
	const raw = game.settings.get(MODULE_ID, "reflavorData");
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

// One row per overridden catalog entry, across every section in `state` except "additions". The
// display text is read live off the catalog (not off the override itself), so a row always shows
// the entry's *current* name/label — falling back to the raw key when the override references an
// entry that no longer resolves (e.g. after a stale upload).
function buildOverrideRows(state) {
	const rows = [];
	for (const [section, entries] of Object.entries(state)) {
		if (section === "additions") continue;
		const sectionDef = REFLAVOR_SECTIONS[section];
		if (!sectionDef || typeof entries !== "object" || entries === null) continue;
		const catalog = resolveSectionCatalog(sectionDef);
		// No `?? section` fallback on the label lookup: section is already a validated REFLAVOR_SECTIONS
		// key at this point (see the sectionDef guard above), so REFLAVOR_SECTION_LABELS always has it.
		// Likewise entry.name ?? entry.label has no further `?? key` fallback: every hand-authored
		// catalog entry across all 5 sections always carries one or the other (see reflavor-schema.js),
		// so that third fallback could never be reached — the outer ternary's `: key` already covers
		// the one real "not found" case.
		for (const key of Object.keys(entries)) {
			const entry = catalog.find((candidate) => candidate.key === key);
			const display = entry ? (entry.name ?? entry.label) : key;
			rows.push({ section, sectionLabel: REFLAVOR_SECTION_LABELS[section], key, display });
		}
	}
	return rows;
}

// One row per custom addition, across every section in state.additions. Unlike an override row,
// there is no separate live catalog to read display text from — the addition entry itself already
// carries its own current name (see custom-content-apply.js's update-in-place-by-key semantics).
function buildAdditionRows(state) {
	const rows = [];
	const additions = state.additions;
	if (!additions || typeof additions !== "object") return rows;
	for (const [section, list] of Object.entries(additions)) {
		if (!Array.isArray(list)) continue;
		for (const entry of list) {
			rows.push({ section, sectionLabel: ADDITION_SECTION_LABELS[section] ?? section, key: entry.key, display: entry.name });
		}
	}
	return rows;
}

// No `?? section` fallback here: sectionKeys is always Object.keys() of the same map `labels` is,
// so every key always resolves — unlike buildOverrideRows/buildAdditionRows below, which read a
// GM-authored section name that may not be a real one.
function sectionOptions(sectionKeys, labels) {
	return sectionKeys.map((section) => ({ value: section, label: labels[section] }));
}

// Comma-separated free text -> a trimmed, empty-string-filtered array (never `[""]` for a blank
// input) — how every tags/traits input on the custom-addition form is read. `value` is always a
// string here (jQuery's `.val()` on a text input never returns null/undefined), so no `?? ""` guard.
function splitList(value) {
	return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

// One reader per addition section, keyed the same way CUSTOM_CONTENT_SECTIONS is — dispatched by
// lookup rather than an if/else-if chain so an unrecognized section (defensively) just reads no
// section-specific fields instead of needing an explicit final `else` branch.
const ADDITION_SECTION_FIELD_READERS = {
	equipment: (group) => ({
		kind: group.find("[data-addition-kind]").val(),
		scale: group.find("[data-addition-scale]").val(),
		tags: splitList(group.find("[data-addition-tags]").val())
	}),
	astirWeapons: (group) => ({
		tags: splitList(group.find("[data-addition-tags]").val())
	}),
	astirParts: (group) => ({
		partType: group.find("[data-addition-parttype]").val(),
		traits: splitList(group.find("[data-addition-traits]").val())
	}),
	moves: (group) => ({
		traits: splitList(group.find("[data-addition-traits]").val())
	})
};

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
			title: "Armor Astir — Reflavor & Custom Content",
			template: REFLAVOR_CONFIG_TEMPLATE,
			classes: ["armor-astir"],
			width: 560,
			resizable: true
		});
	}

	getData() {
		const state = currentReflavorState();
		return {
			warnings: [],
			errors: [],
			entryError: this._entryError ?? null,
			overrideRows: buildOverrideRows(state),
			additionRows: buildAdditionRows(state),
			reflavorSectionOptions: sectionOptions(Object.keys(REFLAVOR_SECTIONS), REFLAVOR_SECTION_LABELS),
			additionSectionOptions: sectionOptions(Object.keys(CUSTOM_CONTENT_SECTIONS), ADDITION_SECTION_LABELS)
		};
	}

	// The only path any add/remove action in the entry-management UI ever mutates state through —
	// always read currentReflavorState(), mutate a plain object, then call this. Re-validates the
	// whole state (same engines the whole-file upload flow uses) before persisting, so a hand-built
	// mutation can never bypass validation the way a raw game.settings.set call could.
	async _persistState(state) {
		const jsonText = JSON.stringify(state);
		const { overrides, errors: overrideErrors } = validateReflavor(jsonText);
		const { errors: additionErrors } = validateCustomContent(overrides?.additions);
		const errors = [...overrideErrors, ...additionErrors];

		if (errors.length) {
			this._entryError = errors.join(" ");
			this.render();
			return false;
		}

		applyReflavor(overrides);
		applyCustomContent(overrides?.additions);
		await game.settings.set(MODULE_ID, "reflavorData", jsonText);
		this._entryError = null;
		this.render();
		return true;
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

		// Entry-management UI below — view/add/remove against the currently *persisted* setting,
		// always through this._persistState (see its own doc comment). Immediate-effect, like Clear
		// Reflavor above, not gated behind the file-upload form's own Save button.
		html.find("[data-remove-override]").on("click", async (event) => {
			const { section, key } = event.currentTarget.dataset;
			const state = currentReflavorState();
			if (state[section]) {
				delete state[section][key];
				if (Object.keys(state[section]).length === 0) delete state[section];
			}
			await this._persistState(state);
		});

		html.find("[data-remove-addition]").on("click", async (event) => {
			const { section, key } = event.currentTarget.dataset;
			const state = currentReflavorState();
			if (state.additions?.[section]) {
				state.additions[section] = state.additions[section].filter((entry) => entry.key !== key);
				if (state.additions[section].length === 0) delete state.additions[section];
				if (Object.keys(state.additions).length === 0) delete state.additions;
			}
			await this._persistState(state);
		});

		// Repopulates the entry dropdown and the primary-field label whenever the override section
		// changes, and once up front so both are correct on first render too.
		const refreshOverrideKeyOptions = () => {
			const section = html.find("[data-override-section]").val();
			const sectionDef = REFLAVOR_SECTIONS[section];
			const options = sectionDef
				? resolveSectionCatalog(sectionDef).map((entry) => {
					const label = entry.name ?? entry.label;
					return `<option value="${entry.key}">${label} — ${entry.key}</option>`;
				}).join("")
				: "";
			html.find("[data-override-key]").html(options);
			const primaryField = sectionDef ? sectionDef.fields.simpleFields[0] : "name";
			html.find("[data-override-primary-label]").text(primaryField === "label" ? "Label" : "Name");
		};
		html.find("[data-override-section]").on("change", refreshOverrideKeyOptions);
		refreshOverrideKeyOptions();

		html.find("[data-override-add]").on("click", async () => {
			const section = html.find("[data-override-section]").val();
			const key = html.find("[data-override-key]").val();
			const primaryValue = html.find("[data-override-primary]").val().trim();
			const descriptionValue = html.find("[data-override-description]").val().trim();
			const advancedText = html.find("[data-override-advanced]").val().trim();

			let fieldOverrides = {};
			if (advancedText) {
				try {
					fieldOverrides = JSON.parse(advancedText);
				} catch (error) {
					this._entryError = `Advanced fields must be valid JSON: ${error.message}`;
					this.render();
					return;
				}
			}

			const sectionDef = REFLAVOR_SECTIONS[section];
			const primaryField = sectionDef ? sectionDef.fields.simpleFields[0] : "name";
			if (primaryValue) fieldOverrides[primaryField] = primaryValue;
			if (descriptionValue) fieldOverrides.description = descriptionValue;

			if (!section || !key || Object.keys(fieldOverrides).length === 0) {
				this._entryError = "Choose a section, an entry, and at least one field to override.";
				this.render();
				return;
			}

			const state = currentReflavorState();
			state[section] = state[section] ?? {};
			state[section][key] = { ...(state[section][key] ?? {}), ...fieldOverrides };
			await this._persistState(state);
		});

		// Shows only the section-specific field group matching the currently-selected addition
		// section, and once up front so the default section's group is visible on first render too.
		const refreshAdditionGroups = () => {
			const section = html.find("[data-addition-section]").val();
			html.find("[data-addition-group]").hide();
			html.find(`[data-addition-group="${section}"]`).show();
		};
		html.find("[data-addition-section]").on("change", refreshAdditionGroups);
		refreshAdditionGroups();

		html.find("[data-addition-add]").on("click", async () => {
			const section = html.find("[data-addition-section]").val();
			const key = html.find("[data-addition-key]").val().trim();
			const name = html.find("[data-addition-name]").val().trim();
			const description = html.find("[data-addition-description]").val().trim();
			const advancedText = html.find("[data-addition-advanced]").val().trim();

			let advanced = {};
			if (advancedText) {
				try {
					advanced = JSON.parse(advancedText);
				} catch (error) {
					this._entryError = `Advanced fields must be valid JSON: ${error.message}`;
					this.render();
					return;
				}
			}

			const group = html.find(`[data-addition-group="${section}"]`);
			const sectionFields = ADDITION_SECTION_FIELD_READERS[section]?.(group) ?? {};

			const raw = { key, name, description, ...sectionFields, ...advanced };

			const state = currentReflavorState();
			state.additions = state.additions ?? {};
			state.additions[section] = state.additions[section] ?? [];
			const index = state.additions[section].findIndex((entry) => entry.key === raw.key);
			if (index === -1) state.additions[section].push(raw);
			else state.additions[section][index] = raw;

			await this._persistState(state);
		});
	}

	async _updateObject() {
		if (!this._pendingOverrides) return;

		applyReflavor(this._pendingOverrides);
		applyCustomContent(this._pendingAdditions);
		await game.settings.set(MODULE_ID, "reflavorData", this._pendingRawText);
	}
}
