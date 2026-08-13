import { DRAIN_GROUP, EQUIPMENT_TAGS, resolveEquipmentTags } from "../equipment/equipment.js";
import { ASTIR_PART_CATALOG } from "./astir-parts.js";
import { ASTIR_POWER_BASE, ASTIR_POWER_MIN, ASTIR_WEAPON_POWER_BASE, resolveAstirParts } from "./astir.js";

// Drain's magnitude (tags carry a negative value; this returns the positive total) across every
// weapon actually mounted on the Astir (kind: "weapon", astir: true) — a mundane (Foot-scale)
// weapon's Drain never counts, since it isn't drawing on the Astir's own Power at all, and neither
// does gear (nothing about gear is Astir-specific — see claude.md). An astir: true entry is only
// ever added/edited/removed from the Astir tab, so its presence in the equipment array already
// means "mounted" — there's no separate equipped/carried state to track.
export function astirWeaponDrainTotal(equipment = [], tags = EQUIPMENT_TAGS) {
	return equipment
		.filter((item) => item.kind === "weapon" && item.astir)
		.flatMap((item) => resolveEquipmentTags(item.tags ?? [], tags))
		.filter((tag) => tag.exclusiveGroup === DRAIN_GROUP)
		.reduce((sum, tag) => sum - tag.value, 0);
}

// Weapon Drain is paid out of the dedicated Weapon Power pool first — Weapon Conduit's whole
// purpose is funding weapon-related power draw — and only the leftover spills onto the main Power
// pool. Private: astirMaxPower/astirMaxWeaponPower are the only callers, and both need this split.
function splitWeaponDrain(partKeys, equipment, catalog) {
	const capacity = resolveAstirParts(partKeys, catalog).reduce((sum, part) => sum + (part.weaponPowerBonus ?? 0), 0);
	const drain = astirWeaponDrainTotal(equipment);
	const absorbed = Math.min(drain, capacity);
	return { capacity, absorbed, remainder: drain - absorbed };
}

// An Astir's max Power is its base minus every equipped part's cost, floored at ASTIR_POWER_MIN —
// then minus whatever Weapon Drain didn't fit in the Weapon Power pool (see splitWeaponDrain). That
// remainder is NOT floored: a heavily-Drained loadout can legitimately push max Power negative (see
// PlaybookActorSheet's Piloted guard — negative Power means the Astir can't be piloted until the
// loadout changes). Derived on read (never stored), the same equipmentValue/advancements.topCount
// precedent, so it can't drift after a part or weapon is added/edited/removed.
export function astirMaxPower(partKeys = [], equipment = [], catalog = ASTIR_PART_CATALOG) {
	const cost = resolveAstirParts(partKeys, catalog).reduce((sum, part) => sum + (part.powerCost ?? 0), 0);
	const partsOnlyMax = Math.max(ASTIR_POWER_MIN, ASTIR_POWER_BASE - cost);
	return partsOnlyMax - splitWeaponDrain(partKeys, equipment, catalog).remainder;
}

// The Astir's separate, weapon-only Power pool (see ASTIR_WEAPON_POWER_BASE in astir.js) — 0 unless
// Weapon Conduit is equipped, minus whatever Weapon Drain has already claimed from that capacity.
// Never negative by construction (absorbed is capped at capacity in splitWeaponDrain) — a
// fully-claimed pool just reads empty; excess Drain spills onto astirMaxPower instead of
// double-counting here. Same derived-on-read treatment as astirMaxPower.
export function astirMaxWeaponPower(partKeys = [], equipment = [], catalog = ASTIR_PART_CATALOG) {
	const { capacity, absorbed } = splitWeaponDrain(partKeys, equipment, catalog);
	return ASTIR_WEAPON_POWER_BASE + capacity - absorbed;
}
