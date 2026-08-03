import { DRAIN_GROUP, resolveEquipmentTags } from "./equipment.js";
import { ASTIR_PART_CATALOG, ASTIR_WEAPON_CATALOG } from "./astir.js";

// Ardents are a cheaper, more limited pilotable frame than the Astir (see claude.md's Domain
// conventions): no Power, no Core, no unique Move, and a hard combined parts+weapons loadout cap.
// A character may have several; only the Astir or one Ardent may be piloted ("mounted") at a
// time — see PlaybookActorSheet#_setMountedFrame. Unlike the Astir, an Ardent picks freely from
// the full Approach list rather than a Core-narrowed pair.

// Ardents sit in their own Tier band (2-4, defaulting to 2) — distinct from both the Astir's 3-4
// band (astir.js) and equipment's 1-5 (equipment.js), so none of the three can drift into another.
export const ARDENT_TIER_MIN = 2;
export const ARDENT_TIER_MAX = 4;
export const ARDENT_TIER_DEFAULT = 2;

// Parts and weapons together, combined — see claude.md's Ardents section.
export const ARDENT_MAX_LOADOUT = 2;

export const ARDENT_DEFAULT_NAME = "Ardent";

// Derived on read from the Astir's own part catalog — never a parallel list of Ardent-specific
// content, so a new Astir part reaches every Ardent automatically, and is excluded automatically
// the moment it carries a Power cost. An Ardent has no Power (see claude.md), so a part that costs
// Power (powerCost) or grants the Astir-only Weapon Power pool (weaponPowerBonus) has nothing to
// act on — filtered out rather than offered inert. `catalog` stays injectable for fixture tests,
// the same reason astirMoveSections' own catalog params do.
export function ardentParts(catalog = ASTIR_PART_CATALOG) {
	return catalog.filter((part) => !part.powerCost && !part.weaponPowerBonus);
}

// Same derived-view treatment as ardentParts above, for the Astir's weapon catalog — a Drain-
// tagged weapon draws on Power an Ardent doesn't have (see equipment.js's DRAIN_GROUP), so it's
// filtered out rather than offered inert.
export function ardentWeapons(catalog = ASTIR_WEAPON_CATALOG) {
	return catalog.filter((weapon) => !resolveEquipmentTags(weapon.tags ?? [])
		.some((tag) => tag.exclusiveGroup === DRAIN_GROUP));
}

// A fresh default object per call, so array fields are never accidentally shared between Ardents
// created from the same click — mirrors actor-creation.js's WORLD_ACTOR_KINDS.buildSystem
// convention. No core, power, weaponPower, overheating, img or move — see claude.md's Ardents
// section for what an Ardent deliberately doesn't carry.
export function buildArdent(name = ARDENT_DEFAULT_NAME) {
	return {
		id: foundry.utils.randomID(),
		name,
		approach: "",
		tier: ARDENT_TIER_DEFAULT,
		piloted: false,
		parts: [],
		repairTokens: 0
	};
}

// Installed parts plus every weapon flagged for this Ardent (system.attributes.equipment entries
// with ardent === this Ardent's id) — the single count ARDENT_MAX_LOADOUT caps, combined per
// claude.md's Ardents section.
export function ardentLoadoutCount(ardent, equipment = []) {
	const parts = ardent?.parts?.length ?? 0;
	const weapons = equipment.filter((item) => item.kind === "weapon" && item.ardent === ardent?.id).length;
	return parts + weapons;
}

// Opens the Mount Up picker when a character has more than one frame to choose between, and
// resolves the chosen frame (see PlaybookActorSheet#_frames), or null if dismissed. Mirrors
// carrier-actor-sheet.js's chooseCarrier exactly — a labelled button per option, promise/Dialog/
// resolve-null shape — only ever called by PlaybookActorSheet when there's more than one unmounted
// frame, so `frames` is never empty here.
export function chooseFrame(frames) {
	return new Promise((resolve) => {
		const buttons = {};
		for (const frame of frames) {
			buttons[frame.id] = { label: frame.name, callback: () => resolve(frame) };
		}

		new Dialog({
			title: "Mount Up",
			content: "<p>Which frame are you mounting?</p>",
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}
