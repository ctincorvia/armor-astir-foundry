import { APPROACHES } from "../core/approaches.js";
import { findPlaybookMove } from "../moves/playbook-moves.js";
import { ASTIR_PART_CATALOG, EXPENDED_USE } from "./astir-parts.js";
import { ASTIR_MOVE_CATALOG, requiredAstirMoveKey } from "./astir-moves.js";
import { ASTIR_WEAPON_CATALOG } from "./astir-weapons.js";

// Astirs aren't their own documents (see claude.md) — one lives at system.attributes.astir on the
// character actor itself, null/absent meaning "no Astir". Everything below follows the
// catalog-in-code / keys-on-actor split MOVE_POOLS and EQUIPMENT_TAGS already use: definitions
// live here (and in this file's astir-parts.js/astir-moves.js/astir-weapons.js/astir-power.js/
// astir-pickers.js siblings) so edited rules text reaches existing characters, and the actor stores
// only keys. This file is the barrel: it re-exports every one of those siblings' public names
// alongside the cross-cutting logic (Cores/Approaches, catalog lookups, requirement checks) that
// doesn't belong in any single one of them, so every existing importer keeps working unchanged
// (see playbook-moves.js's own `export { MOVE_POOLS };` for the precedent this follows).

// An Astir's Core determines which two Approaches it may take — distinct from, and not
// necessarily matching, the character's own system.attributes.approach (see approaches.js).
export const ASTIR_CORES = [
	{ key: "alchemical", label: "Alchemical", approaches: ["mundane", "arcane"] },
	{ key: "crystalline", label: "Crystalline", approaches: ["arcane", "profane"] },
	{ key: "ancient", label: "Ancient", approaches: ["mundane", "divine"] },
	{ key: "natural", label: "Natural", approaches: ["divine", "elemental"] },
	{ key: "occult", label: "Occult", approaches: ["profane", "elemental"] }
];

// Resolves a Core's two Approaches, or an empty list when no Core is chosen yet — the empty list
// is what blanks the Approach select until a Core narrows it (see PlaybookActorSheet).
export function astirCoreApproaches(coreKey, cores = ASTIR_CORES) {
	const core = cores.find((c) => c.key === coreKey);
	return core ? APPROACHES.filter((approach) => core.approaches.includes(approach.key)) : [];
}

// Astirs sit in their own Tier band (3-4), not equipment's TIER_MIN/TIER_MAX (1-5, equipment.js) —
// kept as a separate pair of constants so the two bands can never drift into each other.
export const ASTIR_TIER_MIN = 3;
export const ASTIR_TIER_MAX = 4;

// Caps the Astir's regular Parts pool (see astir-mixin.js's _onAstirPartAdd) — Extra Parts
// (system.attributes.astir.extraParts) are a separate, uncapped Sortie-scoped pool and must never
// be counted against this.
export const ASTIR_MAX_PARTS = 2;

export const ASTIR_POWER_MIN = 0;
export const ASTIR_POWER_BASE = 4;

// A second, separate Power pool only Weapon Conduit unlocks (see ASTIR_PART_CATALOG's
// weaponPowerBonus in astir-parts.js) — restricted to weapon-related spends by rules text, but
// nothing in this module spends Power on weapons yet, so this is tracked exactly like the main
// Power meter (manually stepped, clamped to its derived max) rather than actually gated to weapon
// use.
export const ASTIR_WEAPON_POWER_BASE = 0;

// Matches the img every compendium playbook actor already ships with (see
// src/packs/basic-playbook-*/character_*.json) — used both to seed a newly created Astir and as
// the render-time fallback for an Astir created before this field existed.
export const ASTIR_DEFAULT_IMG = "icons/svg/mystery-man.svg";

// EXPENDED_USE/ASTIR_PART_CATALOG live in astir-parts.js; re-exported here so every existing
// importer of astir.js keeps working unchanged.
export { ASTIR_PART_CATALOG, EXPENDED_USE };

export function findAstirPart(key, catalog = ASTIR_PART_CATALOG) {
	return catalog.find((part) => part.key === key) ?? null;
}

// An Astir Move or Astir Weapon catalog entry's own requiresParts (e.g. the Familiar weapons'
// "requires a Familiar Matrix Astir Part" — see astir-weapons.js's ASTIR_WEAPON_CATALOG) resolved
// against a list of currently-installed part keys. Mirrors playbook-moves.js's
// unmetMoveRequirements/moveRequirementTooltip exactly, but for Astir Parts rather than moves —
// kept in this file (not playbook-moves.js) since only this module's catalogs know what an Astir
// Part is; playbook-moves.js must not import from astir.js (see claude.md's note on dependency
// direction).
export function unmetPartRequirements(entry, installedPartKeys = []) {
	return (entry.requiresParts ?? []).filter((key) => !installedPartKeys.includes(key));
}

// Turns a list of missing part keys (from unmetPartRequirements) into the hover-tooltip text, or
// null when nothing's missing — same null-not-empty-string convention as moveRequirementTooltip,
// so callers can Boolean() it directly for `disabled`/`gated`.
export function partRequirementTooltip(missingPartKeys) {
	if (!missingPartKeys.length) return null;
	const names = missingPartKeys.map((key) => findAstirPart(key)?.name ?? key);
	return `Requires ${names.join(", ")} Astir Part${names.length > 1 ? "s" : ""}`;
}

// Drops a part key that no longer resolves — mirrors resolvePlaybookMoves/resolveEquipmentTags.
export function resolveAstirParts(keys = [], catalog = ASTIR_PART_CATALOG) {
	return keys.map((key) => findAstirPart(key, catalog)).filter(Boolean);
}

// astirWeaponDrainTotal/astirMaxPower/astirMaxWeaponPower live in astir-power.js (they read
// ASTIR_PART_CATALOG above plus equipment tag data); re-exported here so every existing importer
// of astir.js keeps working unchanged.
export { astirMaxPower, astirMaxWeaponPower, astirWeaponDrainTotal } from "./astir-power.js";

// ASTIR_MOVE_CATALOG/requiredAstirMoveKey live in astir-moves.js; re-exported here so every
// existing importer of astir.js keeps working unchanged.
export { ASTIR_MOVE_CATALOG, requiredAstirMoveKey };

// The unique Astir move can come from the dedicated catalog above, or from the character's own
// playbook/Cantrips pools (see astirMoveSections in astir-pickers.js) — so resolving a stored key
// has to check both, rather than assuming it's always one of ours.
export function findAstirMove(key, catalog = ASTIR_MOVE_CATALOG) {
	return catalog.find((move) => move.key === key) ?? findPlaybookMove(key) ?? null;
}

// ASTIR_WEAPON_CATALOG lives in astir-weapons.js; re-exported here so every existing importer of
// astir.js keeps working unchanged.
export { ASTIR_WEAPON_CATALOG };

export function findCatalogAstirWeapon(key, catalog = ASTIR_WEAPON_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

// chooseAstirPart/chooseAstirWeapon/astirMoveSections/chooseAstirMove (the async-dialog pickers)
// live in astir-pickers.js; re-exported here so every existing importer of astir.js keeps working
// unchanged.
export { astirMoveSections, chooseAstirMove, chooseAstirPart, chooseAstirWeapon } from "./astir-pickers.js";
