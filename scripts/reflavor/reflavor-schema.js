import { ALL_MOVES } from "../moves/all-moves.js";
import { EQUIPMENT_CATALOG, EQUIPMENT_TAGS } from "../equipment/equipment.js";
import { ARDENT_PART_CATALOG, ARDENT_FEATURE_WEAPONS } from "../frames/ardent.js";
import { ASTIR_WEAPON_CATALOG } from "../frames/astir-weapons.js";

// The allowlist a reflavor upload is checked against — see docs/domains/reflavor.md for the full
// rationale. Pure data: which fields a "move-shaped" catalog entry (a move or an Astir/Ardent Part
// — see astir-parts.js's own comment that a Part is "the same shape as BASIC_MOVES") may have
// overridden, split by how each field is written (see reflavor-apply.js):
//   - simpleFields: read/written as-is.
//   - tieredFields: an object keyed success/mixed/failure/critical, merged key-by-key so
//     overriding one tier never clobbers the others (see resolveTierValue, move-results.js).
//   - arrayFields: a plain array (e.g. Read the Room's questions), replaced wholesale — there's no
//     per-entry key to merge against.
//   - labeledSubArrays: an array of `{key, label, ...}` objects (uses/conditions/intents/
//     numericTrackers/fixedTraits). Only `label` is display text — every other field on these
//     objects (period, min/max, value, ...) is mechanical — so an override is a plain
//     `{itemKey: newLabel}` map rather than a replacement array, keeping the mechanical fields
//     completely out of reach of the JSON.
//   - activateChoices: `{prompt, options}` — prompt is a simple string, options is a plain array of
//     strings (not objects, so nothing to key against) and is replaced wholesale like an arrayField.
const MOVE_FIELDS = {
	simpleFields: ["name", "description", "successOptions", "downtimeAbility"],
	tieredFields: ["results", "questionPrompts"],
	arrayFields: ["questions"],
	labeledSubArrays: ["uses", "conditions", "intents", "numericTrackers", "fixedTraits"],
	activateChoices: true
};

// Equipment/weapons/tags carry no results/questions/etc. of their own — just the two (or, for
// tags, the label/description pair) plain display fields.
const EQUIPMENT_FIELDS = {
	simpleFields: ["name", "description"],
	tieredFields: [],
	arrayFields: [],
	labeledSubArrays: [],
	activateChoices: false
};

const TAG_FIELDS = {
	simpleFields: ["label", "description"],
	tieredFields: [],
	arrayFields: [],
	labeledSubArrays: [],
	activateChoices: false
};

// Astir/Ardent weapons only ever concatenate at load — see ardent.js's own comment on
// ARDENT_FEATURE_WEAPONS being deliberately excluded from ASTIR_WEAPON_CATALOG. The concatenated
// array is a fresh wrapper, but every entry inside it is still the same shared object every other
// derivation (ardentWeapons(), etc.) reaches — mutating one mutates all of them, per this domain's
// core architectural finding (see docs/domains/reflavor.md).
const ASTIR_AND_ARDENT_FEATURE_WEAPONS = [...ASTIR_WEAPON_CATALOG, ...ARDENT_FEATURE_WEAPONS];

// Maps each JSON upload's top-level section name to the live catalog it targets and the fields
// writable on that catalog's entries. `astirParts`'s catalog (ARDENT_PART_CATALOG) already
// includes every entry `moves`'s catalog (ALL_MOVES) also spreads in — see all-moves.js and
// ardent.js — so a Part can equally be reflavored under either JSON section; both reach the same
// shared object.
export const REFLAVOR_SECTIONS = {
	moves: { catalog: ALL_MOVES, fields: MOVE_FIELDS },
	equipment: { catalog: EQUIPMENT_CATALOG, fields: EQUIPMENT_FIELDS },
	equipmentTags: { catalog: EQUIPMENT_TAGS, fields: TAG_FIELDS },
	astirParts: { catalog: ARDENT_PART_CATALOG, fields: MOVE_FIELDS },
	astirWeapons: { catalog: ASTIR_AND_ARDENT_FEATURE_WEAPONS, fields: EQUIPMENT_FIELDS }
};
