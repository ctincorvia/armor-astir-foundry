import { EQUIPMENT_CATALOG } from "../equipment/equipment-catalog.js";
import { ASTIR_WEAPON_CATALOG } from "../frames/astir-weapons.js";
// Imported from the owning files directly, not a barrel — ARDENT_PART_CATALOG and ALL_MOVES are
// both fixed one-time array spreads computed once at module load (see ardent.js/all-moves.js's own
// comments on this), and several tests partially vi.mock() the barrels those spreads sit behind
// with an async importOriginal() factory, which can intermittently make the spread see undefined.
// Following the same direct-import pattern astir-parts.js's own consumers already use sidesteps
// that hazard entirely — see docs/domains/reflavor.md's "Adding brand-new catalog entries" section.
import { ASTIR_PART_CATALOG } from "../frames/astir-parts.js";
import { ARDENT_PART_CATALOG } from "../frames/ardent.js";
import { ALL_MOVES } from "../moves/all-moves.js";
import { ALL_PLAYBOOK_MOVES } from "../moves/playbook-moves.js";
import { ASTIR_MOVE_CATALOG } from "../frames/astir-moves.js";
import { CUSTOM_MOVE_CATALOG } from "../moves/custom-move-catalog.js";
import { CUSTOM_MOVE_ALLOWED_FIELDS, CUSTOM_MOVE_REQUIRED_FIELDS } from "./custom-content-moves-schema.js";

// Every addition's key must carry this prefix — see docs/domains/reflavor.md for the rationale
// (namespacing custom Director content separately from every built-in catalog key, so a collision
// with a future rulebook entry can never happen).
export const CUSTOM_KEY_PREFIX = "custom:";

// The allowlisted Astir/Ardent Part behavior flags a Director may set on a custom Part — every one
// of these is already a generic declarative flag read by PlaybookActorSheet mixins (see
// astir-parts.js's own file-level comment), not hardcoded to specific part keys, so authoring a new
// one onto a custom Part activates real behavior with zero new sheet code. An addition field not on
// this list (or not on a section's own allowedFields below) is dropped with a warning rather than
// rejected outright — see custom-content-apply.js.
export const ASTIR_PART_BEHAVIOR_FLAGS = [
	"powerCost",
	"weaponPowerBonus",
	"uses",
	"showsReadTheRoomQuestions",
	"regainPowerOnDoubles",
	"grantsGuided",
	"promptsApproachOverride",
	"grantsPotionsOnRefreshSortie",
	"grantsRollModifier",
	"grantsChannelOnAnyMove",
	"bonusDowntimeTokens",
	"numericTrackers"
];

// Per-section config for the custom-content engine — parallel in spirit to reflavor-schema.js's
// REFLAVOR_SECTIONS, but for brand-new entries rather than overrides of existing ones. `catalogs`
// lists every live array a section's injected entry must be pushed into (see
// docs/domains/reflavor.md's "the verified three-array requirement" for why astirParts alone needs
// three) — EQUIPMENT_CATALOG and ASTIR_WEAPON_CATALOG are themselves the live source arrays (not a
// derived spread), so a single push into either is enough for every other derivation
// (ardentWeapons(), pickers, etc.) to see it immediately.
//
// `requiredFields` excludes "key" deliberately — its own format (the custom: prefix) is validated
// separately in custom-content-apply.js's validateKey, so a missing/malformed key is reported once,
// not twice.
export const CUSTOM_CONTENT_SECTIONS = {
	equipment: {
		catalogs: [EQUIPMENT_CATALOG],
		requiredFields: ["name", "kind", "description"],
		allowedFields: ["key", "name", "kind", "description", "tags", "scale"],
		behaviorFlags: []
	},
	astirWeapons: {
		catalogs: [ASTIR_WEAPON_CATALOG],
		requiredFields: ["name", "description"],
		allowedFields: ["key", "name", "description", "tags", "familiar", "requiresParts"],
		behaviorFlags: []
	},
	astirParts: {
		catalogs: [ASTIR_PART_CATALOG, ARDENT_PART_CATALOG, ALL_MOVES],
		requiredFields: ["name", "partType", "description"],
		allowedFields: ["key", "name", "partType", "traits", "description", ...ASTIR_PART_BEHAVIOR_FLAGS],
		behaviorFlags: ASTIR_PART_BEHAVIOR_FLAGS
	},
	// A brand-new custom Move must reach four arrays, not astirParts' three — see
	// docs/domains/reflavor.md's "the verified four-array requirement for Moves". CUSTOM_MOVE_CATALOG
	// is a dedicated, dependency-free bookkeeping/picker-visibility array (moves/custom-move-
	// catalog.js); ALL_MOVES/ALL_PLAYBOOK_MOVES/ASTIR_MOVE_CATALOG are the three catalogs the two
	// pickers and every Roll/Activate/Description lookup actually resolve a move key against.
	moves: {
		catalogs: [CUSTOM_MOVE_CATALOG, ALL_MOVES, ALL_PLAYBOOK_MOVES, ASTIR_MOVE_CATALOG],
		requiredFields: CUSTOM_MOVE_REQUIRED_FIELDS,
		allowedFields: CUSTOM_MOVE_ALLOWED_FIELDS,
		behaviorFlags: []
	}
};
