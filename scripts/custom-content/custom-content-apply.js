import { CUSTOM_CONTENT_SECTIONS, CUSTOM_KEY_PREFIX } from "./custom-content-schema.js";
import { captureBaseline } from "../reflavor/reflavor-apply.js";
import { WEAPON_SCALES } from "../equipment/equipment-constants.js";
import { validateTagKeys, validateWeaponRangeTag } from "./custom-content-tag-validate.js";
import { validateMoveFields } from "./custom-content-moves-validate.js";

// Tracks every entry this engine has injected, keyed by `${sectionName}::${key}` (not by key alone
// — the same key string is never ambiguous across sections since each section owns an independent
// namespace, but scoping the map key this way keeps that guarantee explicit rather than assumed).
// Each value records the constructed entry object itself (so a re-upload can mutate it in place and
// keep its identity stable — see applyEntry below) and the exact array of catalogs it was pushed
// into, so resetCustomContent/retraction can splice it back out of every one of them.
const injected = new Map();

function trackedKey(sectionName, key) {
	return `${sectionName}::${key}`;
}

// Pre-existing (non-Director-added) keys currently live in a section's catalogs — used both to
// reject a collision and, by exclusion, to recognize "this key is one of ours, update it in place"
// rather than "this key already belongs to built-in content."
function existingKeysForSection(sectionName, sectionConfig) {
	const keys = new Set();
	for (const catalog of sectionConfig.catalogs) {
		for (const entry of catalog) {
			if (!injected.has(trackedKey(sectionName, entry.key))) keys.add(entry.key);
		}
	}
	return keys;
}

function validateKey(raw, errors, context) {
	const key = raw.key;
	if (typeof key !== "string" || !key.startsWith(CUSTOM_KEY_PREFIX)) {
		errors.push(`${context} must have a "key" starting with "${CUSTOM_KEY_PREFIX}".`);
		return false;
	}
	return true;
}

function validateRequiredFields(sectionConfig, raw, errors, context) {
	for (const field of sectionConfig.requiredFields) {
		const value = raw[field];
		if (value === undefined || value === null || value === "") {
			errors.push(`${context} is missing required field "${field}".`);
		}
	}
}

// Mutates `entry` (the normalized field set already filtered to the section's allowedFields) to
// default a missing tags/traits array to [], mirroring every hand-authored catalog entry's own
// shape (see equipment-catalog.js/astir-weapons.js/astir-parts.js, which never omit these arrays).
function validateEquipmentFields(entry, errors, context) {
	if (entry.kind !== "weapon" && entry.kind !== "gear") {
		errors.push(`${context} has an invalid kind "${entry.kind}" — must be "weapon" or "gear".`);
		return;
	}
	entry.tags = Array.isArray(entry.tags) ? entry.tags : [];
	validateTagKeys(entry.tags, errors, context);
	if (entry.kind === "weapon") {
		validateWeaponRangeTag(entry.tags, errors, context);
		if (!WEAPON_SCALES.some((scale) => scale.key === entry.scale)) {
			errors.push(`${context} is a weapon and needs a "scale" of "foot" or "astir".`);
		}
	}
}

// An Astir-weapon addition is implicitly always a weapon (see docs/domains/reflavor.md) — no kind
// field to check, but the same tag/range rules as an equipment weapon apply.
function validateAstirWeaponFields(entry, errors, context) {
	entry.tags = Array.isArray(entry.tags) ? entry.tags : [];
	validateTagKeys(entry.tags, errors, context);
	validateWeaponRangeTag(entry.tags, errors, context);
}

function validatePartFields(entry, errors, context) {
	entry.traits = Array.isArray(entry.traits) ? entry.traits : [];
	if (entry.partType !== "Active" && entry.partType !== "Passive") {
		errors.push(`${context} has an invalid partType "${entry.partType}" — must be "Active" or "Passive".`);
	}
}

const SECTION_VALIDATORS = {
	equipment: validateEquipmentFields,
	astirWeapons: validateAstirWeaponFields,
	astirParts: validatePartFields,
	moves: validateMoveFields
};

// Updates an already-injected entry's own fields in place (stable object identity — see
// docs/domains/reflavor.md) by clearing every field but `key` and reassigning from the freshly
// validated `normalized` set, or constructs and pushes a brand-new entry into every catalog the
// section lists. Only ever called when `apply` is true.
function applyEntry(sectionName, sectionConfig, key, normalized) {
	const mapKey = trackedKey(sectionName, key);
	const tracked = injected.get(mapKey);
	if (tracked) {
		for (const field of Object.keys(tracked.entry)) {
			if (field !== "key") delete tracked.entry[field];
		}
		Object.assign(tracked.entry, normalized);
		return;
	}

	const entry = { ...normalized };
	for (const catalog of sectionConfig.catalogs) catalog.push(entry);
	injected.set(mapKey, { entry, catalogs: sectionConfig.catalogs });
}

// Splices every tracked entry for this section whose key isn't in `survivingKeys` (the keys that
// validated cleanly in this pass) out of every catalog it was pushed into, and drops it from
// `injected`. Called with an empty `survivingKeys` when a section is entirely absent from an
// upload, retracting everything previously added under that section — additions are a complete
// desired-state upload, same reset-first idempotency contract reflavor's own overrides have (see
// docs/domains/reflavor.md).
function retractMissingEntries(sectionName, survivingKeys) {
	const prefix = `${sectionName}::`;
	for (const [mapKey, tracked] of [...injected.entries()]) {
		if (!mapKey.startsWith(prefix)) continue;
		const key = mapKey.slice(prefix.length);
		if (survivingKeys.has(key)) continue;

		for (const catalog of tracked.catalogs) {
			const index = catalog.indexOf(tracked.entry);
			if (index !== -1) catalog.splice(index, 1);
		}
		injected.delete(mapKey);
	}
}

// The shared walk behind both validateCustomContent (apply: false, a pure dry run) and
// applyCustomContent (apply: true) — the same "one walk, apply flag decides whether to mutate"
// contract reflavor-apply.js's own walkOverrides uses, so a dry-run preview can never disagree with
// what a real apply would do. Malformed/missing-required-field/bad-enum/key-format/collision
// problems are collected as errors (block Save); an unrecognized field or behavior-flag name is a
// warning (dropped, not applied) — mirroring reflavor's own "never throws, just warns and drops"
// philosophy (see docs/domains/reflavor.md).
function walkAdditions(rawAdditions, apply) {
	const errors = [];
	const warnings = [];

	const isPlainObject = rawAdditions && typeof rawAdditions === "object" && !Array.isArray(rawAdditions);
	if (rawAdditions !== undefined && rawAdditions !== null && !isPlainObject) {
		errors.push("\"additions\" must be an object keyed by section name.");
	}
	const additions = isPlainObject ? rawAdditions : {};

	for (const [sectionName, sectionConfig] of Object.entries(CUSTOM_CONTENT_SECTIONS)) {
		const rawList = additions[sectionName];

		if (rawList === undefined) {
			if (apply) retractMissingEntries(sectionName, new Set());
			continue;
		}
		if (!Array.isArray(rawList)) {
			errors.push(`"${sectionName}" additions must be an array.`);
			continue;
		}

		const existingKeys = existingKeysForSection(sectionName, sectionConfig);
		const seenThisUpload = new Set();
		const survivingKeys = new Set();

		rawList.forEach((raw, index) => {
			if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
				errors.push(`${sectionName} addition #${index + 1} must be an object.`);
				return;
			}

			const context = `${sectionName} addition ${raw.key ? `"${raw.key}"` : `#${index + 1}`}`;
			const entryErrors = [];

			if (!validateKey(raw, entryErrors, context)) {
				errors.push(...entryErrors);
				return;
			}
			const key = raw.key;

			if (seenThisUpload.has(key)) {
				errors.push(`${context} duplicates key "${key}" already used earlier in this upload.`);
				return;
			}
			seenThisUpload.add(key);

			if (existingKeys.has(key)) {
				errors.push(`${context}'s key collides with an existing ${sectionName} catalog entry.`);
				return;
			}

			validateRequiredFields(sectionConfig, raw, entryErrors, context);

			const normalized = {};
			for (const [field, value] of Object.entries(raw)) {
				if (sectionConfig.allowedFields.includes(field)) {
					normalized[field] = value;
				} else {
					warnings.push(`Unknown field "${field}" on ${context} was ignored.`);
				}
			}

			SECTION_VALIDATORS[sectionName](normalized, entryErrors, context);

			if (entryErrors.length) {
				errors.push(...entryErrors);
				return;
			}

			survivingKeys.add(key);
			if (apply) applyEntry(sectionName, sectionConfig, key, normalized);
		});

		if (apply) retractMissingEntries(sectionName, survivingKeys);
	}

	if (apply) captureBaseline();

	return { errors, warnings };
}

// Dry-run validation, no mutation — same {errors, warnings} contract shape as reflavor-apply.js's
// validateReflavor, so the config UI can gate Save on `errors` while still previewing `warnings`.
export function validateCustomContent(additions) {
	return walkAdditions(additions, false);
}

// Injects/updates/retracts every addition per section, then re-captures reflavor's baseline (see
// reflavor-apply.js's captureBaseline — idempotent) so any brand-new entry landing in a catalog
// reflavor also targets immediately becomes reflavor-overridable too. Returns only the warnings
// array, same "never throws" contract as applyReflavor — an entry with a blocking error is simply
// skipped (not pushed/updated), since the config UI is expected to have already gated Save on
// validateCustomContent reporting zero errors.
export function applyCustomContent(additions) {
	const { warnings } = walkAdditions(additions, true);
	return warnings;
}

// Splices every currently-injected entry back out of every catalog it was pushed into, clears the
// tracking map, then re-captures the baseline. Used by "Clear Reflavor" alongside
// reflavor-apply.js's own resetToBaseline.
export function resetCustomContent() {
	for (const tracked of injected.values()) {
		for (const catalog of tracked.catalogs) {
			const index = catalog.indexOf(tracked.entry);
			if (index !== -1) catalog.splice(index, 1);
		}
	}
	injected.clear();
	captureBaseline();
}
