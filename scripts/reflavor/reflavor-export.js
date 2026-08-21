import { REFLAVOR_SECTIONS } from "./reflavor-schema.js";
import { readOverridableFields } from "./reflavor-apply.js";
import { saveDataToFile } from "../compat.js";

const REFLAVOR_TEMPLATE_FILENAME = "armor-astir-reflavor-template.json";

// Builds the starter-template object a GM downloads, edits, and re-uploads — every current catalog
// entry's own writable fields (see reflavor-schema.js), keyed the same way an upload's own JSON is
// (section name -> entry key -> field overrides). Reads whatever the catalogs currently hold, which
// may already be reflavored from an earlier upload — this button is a "here's every key and every
// writable field, go fill in your own text" starting point, not a pristine-baseline export.
export function buildReflavorTemplate() {
	const template = {};

	for (const [sectionName, section] of Object.entries(REFLAVOR_SECTIONS)) {
		const sectionTemplate = {};

		for (const entry of section.catalog) {
			const fields = readOverridableFields(entry, section.fields);
			const entryTemplate = {};
			for (const [fieldName, value] of Object.entries(fields)) {
				if (value !== undefined) entryTemplate[fieldName] = value;
			}
			sectionTemplate[entry.key] = entryTemplate;
		}

		template[sectionName] = sectionTemplate;
	}

	return template;
}

// Triggers the browser download via Foundry's own saveDataToFile global (see docs/domains/
// reflavor.md) — the counterpart to readTextFromFile on the upload side (reflavor-config.js).
export function downloadReflavorTemplate() {
	saveDataToFile(JSON.stringify(buildReflavorTemplate(), null, 2), "text/json", REFLAVOR_TEMPLATE_FILENAME);
}
