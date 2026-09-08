import { MODULE_ID } from "../module-id.js";
import { ALL_PLAYBOOK_MOVES } from "./playbook-moves.js";
// Imported from the owning file directly, not the astir.js barrel — see all-moves.js's own comment
// on the identical hazard for ASTIR_MOVE_CATALOG/ARDENT_PART_CATALOG with partially-vi.mock()ed
// barrels.
import { ASTIR_PART_CATALOG } from "../frames/astir-parts.js";

export const ENABLE_MOVE_CUSTOMIZATION_SETTING = "enableMoveCustomization";

// Eligibility is by catalog membership, not ALL_MOVES — Basic/Special Moves, the Astir's unique
// move (ASTIR_MOVE_CATALOG) and true Ardent Features (ARDENT_FEATURE_PARTS) are deliberately never
// customizable (see docs/domains/moves.md).
const CUSTOMIZABLE_MOVE_KEYS = new Set([...ALL_PLAYBOOK_MOVES, ...ASTIR_PART_CATALOG].map((entry) => entry.key));

export function isMoveCustomizationEnabled() {
	return Boolean(game.settings.get(MODULE_ID, ENABLE_MOVE_CUSTOMIZATION_SETTING));
}

export function isCustomizableMoveKey(key) {
	return CUSTOMIZABLE_MOVE_KEYS.has(key);
}

// The setting check must come before any actor.getFlag call — no code in this repo uses actor
// flags today, and dozens of tests build sheet.actor as a bare object literal with no getFlag
// method (see claude.md's Foundry module notes).
export function moveCustomizationOverrides(actor, enabled = isMoveCustomizationEnabled()) {
	if (!enabled) return {};
	return actor.getFlag(MODULE_ID, "moveCustomizations") ?? {};
}

// Returns `move` unchanged by reference unless it's both eligible and actually overridden —
// letting every caller freely re-derive this every render (see claude.md's "Derive fresh every
// render" convention) with no risk of a stray identity check downstream ever noticing.
export function customizedMove(move, overrides) {
	if (!isCustomizableMoveKey(move.key)) return move;
	const override = overrides[move.key];
	if (!override) return move;
	return { ...move, name: override.name, description: override.description };
}

export function saveMoveCustomization(actor, key, { name, description }) {
	const current = actor.getFlag(MODULE_ID, "moveCustomizations") ?? {};
	return actor.update({
		[`flags.${MODULE_ID}.moveCustomizations`]: { ...current, [key]: { name, description } }
	});
}
