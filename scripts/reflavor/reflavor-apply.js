import { REFLAVOR_SECTIONS, resolveSectionCatalog } from "./reflavor-schema.js";

// Keyed by object identity (a catalog entry reference), not by its `key` string — `astirParts`'s
// catalog and `moves`'s catalog share the same Part objects (see reflavor-schema.js), so walking
// both catalogs during captureBaseline would otherwise try to snapshot the same object twice under
// two different Maps; identity-keying makes that walk naturally idempotent (see the `has` guard in
// captureBaseline below) instead of something each caller has to worry about.
const baseline = new Map();

// Pulls every overridable field's *current* value off a live catalog entry, per the field's own
// shape (see reflavor-schema.js's own comment on the four shapes). Used both to snapshot the
// pristine baseline (captureBaseline) and to read an entry's current values for the downloadable
// template (reflavor-export.js) — the same "read the writable fields off an entry" operation
// either way, just at different points in the entry's mutation history.
export function readOverridableFields(entry, fields) {
	const snapshot = {};

	for (const field of fields.simpleFields) {
		snapshot[field] = entry[field];
	}
	for (const field of fields.tieredFields) {
		snapshot[field] = entry[field] ? { ...entry[field] } : entry[field];
	}
	for (const field of fields.arrayFields) {
		snapshot[field] = entry[field] ? [...entry[field]] : entry[field];
	}
	for (const field of fields.labeledSubArrays) {
		snapshot[field] = entry[field]
			? Object.fromEntries(entry[field].map((item) => [item.key, item.label]))
			: entry[field];
	}
	if (fields.activateChoices && entry.activateChoices) {
		snapshot.activateChoices = {
			prompt: entry.activateChoices.prompt,
			options: [...entry.activateChoices.options]
		};
	}

	return snapshot;
}

function restoreEntry(entry, fields, snapshot) {
	for (const field of fields.simpleFields) {
		entry[field] = snapshot[field];
	}
	for (const field of fields.tieredFields) {
		entry[field] = snapshot[field] ? { ...snapshot[field] } : snapshot[field];
	}
	for (const field of fields.arrayFields) {
		entry[field] = snapshot[field] ? [...snapshot[field]] : snapshot[field];
	}
	for (const field of fields.labeledSubArrays) {
		if (!entry[field]) continue;
		// Unlike writeField's own lookup below (which reads a GM-authored map that may legitimately
		// cover only some item keys), this `labels` map was built from every item this exact array
		// had at baseline-capture time (see readOverridableFields), and entry[field] never gains or
		// loses items at runtime — only a writeField-driven relabel — so every current item's key is
		// guaranteed present here.
		const labels = snapshot[field];
		entry[field] = entry[field].map((item) => ({ ...item, label: labels[item.key] }));
	}
	if (fields.activateChoices && entry.activateChoices && snapshot.activateChoices) {
		entry.activateChoices = {
			...entry.activateChoices,
			prompt: snapshot.activateChoices.prompt,
			options: [...snapshot.activateChoices.options]
		};
	}
}

// Snapshots the pristine overridable-field values of every entry across all 5 catalogs, once. This
// is what makes applyReflavor idempotent (see resetToBaseline/applyReflavor below): every apply
// resets to this untouched text before layering the new upload on top, so re-uploading never
// compounds onto already-reflavored text. Exported so a test can force a fresh capture (e.g. after
// swapping in a fixture catalog is never needed here — see docs/domains/reflavor.md's testing note
// on why this module deliberately has no injectable-catalog escape hatch), but real callers never
// need to call this themselves — the module-load call below runs before applyReflavor can ever run.
export function captureBaseline() {
	for (const section of Object.values(REFLAVOR_SECTIONS)) {
		for (const entry of resolveSectionCatalog(section)) {
			if (!baseline.has(entry)) {
				baseline.set(entry, readOverridableFields(entry, section.fields));
			}
		}
	}
}

// Runs at module load, before any other module can call applyReflavor — see this file's own
// captureBaseline doc comment.
captureBaseline();

// Resets every catalog entry's overridable fields back to their captured baseline, discarding any
// currently-applied reflavor. Used directly by "Clear reflavor" and as applyReflavor's own
// idempotency mechanism below.
export function resetToBaseline() {
	for (const section of Object.values(REFLAVOR_SECTIONS)) {
		for (const entry of resolveSectionCatalog(section)) {
			restoreEntry(entry, section.fields, baseline.get(entry));
		}
	}
}

function isWritableField(fields, fieldName) {
	return fields.simpleFields.includes(fieldName)
		|| fields.tieredFields.includes(fieldName)
		|| fields.arrayFields.includes(fieldName)
		|| fields.labeledSubArrays.includes(fieldName)
		|| (fields.activateChoices && fieldName === "activateChoices");
}

function writeField(entry, fields, fieldName, value) {
	if (fields.simpleFields.includes(fieldName)) {
		entry[fieldName] = value;
		return;
	}
	if (fields.tieredFields.includes(fieldName)) {
		entry[fieldName] = { ...(entry[fieldName] ?? {}), ...value };
		return;
	}
	if (fields.arrayFields.includes(fieldName)) {
		entry[fieldName] = [...value];
		return;
	}
	if (fields.labeledSubArrays.includes(fieldName)) {
		if (!entry[fieldName]) return;
		entry[fieldName] = entry[fieldName].map((item) => (
			Object.prototype.hasOwnProperty.call(value, item.key) ? { ...item, label: value[item.key] } : item
		));
		return;
	}
	// The only remaining allowlisted shape is activateChoices (see isWritableField above) — a move
	// with no activateChoices of its own has nothing to merge onto, so it's silently skipped rather
	// than fabricating one.
	if (!entry.activateChoices) return;
	entry.activateChoices = {
		...entry.activateChoices,
		...(value.prompt !== undefined ? { prompt: value.prompt } : {}),
		...(value.options !== undefined ? { options: [...value.options] } : {})
	};
}

// Walks a parsed overrides object against REFLAVOR_SECTIONS, collecting a warning (never throwing)
// for anything that doesn't resolve: an unrecognized section name, a catalog key not found in that
// section's live catalog, or a field name not on that section's own allowlist. When `apply` is
// true, every override that *does* resolve is written to the live catalog entry; when false
// (validateReflavor's own dry run, so the upload dialog can preview counts/warnings before Save is
// even enabled) nothing is mutated — the same walk either way, so the dry run can never disagree
// with what a real apply would do.
function walkOverrides(overrides, apply) {
	const warnings = [];

	for (const [sectionName, entries] of Object.entries(overrides)) {
		// "additions" is a sibling top-level key (see scripts/custom-content/) handled entirely by
		// validateCustomContent/applyCustomContent — not an unrecognized section, so it's silently
		// skipped here rather than producing a spurious "Unknown reflavor section" warning.
		if (sectionName === "additions") continue;

		const section = REFLAVOR_SECTIONS[sectionName];
		if (!section) {
			warnings.push(`Unknown reflavor section "${sectionName}" was ignored.`);
			continue;
		}

		for (const [entryKey, fieldOverrides] of Object.entries(entries)) {
			const entry = resolveSectionCatalog(section).find((candidate) => candidate.key === entryKey);
			if (!entry) {
				warnings.push(`Unknown ${sectionName} key "${entryKey}" was ignored.`);
				continue;
			}

			for (const [fieldName, value] of Object.entries(fieldOverrides)) {
				if (!isWritableField(section.fields, fieldName)) {
					warnings.push(`Unknown field "${fieldName}" on ${sectionName} entry "${entryKey}" was ignored.`);
					continue;
				}
				if (apply) writeField(entry, section.fields, fieldName, value);
			}
		}
	}

	return warnings;
}

// Resets to baseline, then applies `overrides` on top (see reflavor-schema.js's REFLAVOR_SECTIONS
// for the allowlist). The reset-first order is what makes re-applying idempotent: uploading file B
// after file A replaces A's text entirely rather than compounding onto it. Returns the warnings
// collected along the way (unknown sections/keys/fields) — never throws.
export function applyReflavor(overrides) {
	resetToBaseline();
	return walkOverrides(overrides ?? {}, true);
}

// Parses and validates a raw JSON upload without mutating any catalog. Malformed JSON and a
// non-object root are errors (overrides comes back null/unusable); everything else this function's
// own dry-run walk finds is a warning (see walkOverrides above), never an error — an unknown
// section/key/field is dropped, not fatal, so the rest of a mostly-valid file still lands on Save.
export function validateReflavor(jsonText) {
	let parsed;
	try {
		parsed = JSON.parse(jsonText);
	} catch (error) {
		return { overrides: null, warnings: [], errors: [`Malformed JSON: ${error.message}`] };
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return { overrides: null, warnings: [], errors: ["Reflavor JSON must be an object keyed by section name."] };
	}

	const warnings = walkOverrides(parsed, false);
	return { overrides: parsed, warnings, errors: [] };
}
