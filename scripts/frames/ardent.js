import { DRAIN_GROUP, resolveEquipmentTags } from "../equipment/equipment.js";
import { ASTIR_PART_CATALOG, ASTIR_WEAPON_CATALOG, EXPENDED_USE } from "./astir.js";

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

// The Commander playbook's own "Ardent Features" — a dedicated catalog exclusive to Commander's
// Custom Ardent, deliberately NOT merged into ASTIR_PART_CATALOG/ASTIR_WEAPON_CATALOG (astir.js).
// Two reasons: (1) they must never appear on any other playbook's Ardent, and mixing them into the
// shared Astir catalogs would leak them into ardentParts()/ardentWeapons() for every playbook, and
// into the Astir tab's own part/weapon pickers besides; (2) they're mundane military hardware, not
// Channeler Astir tech, so they don't belong in a Channeler's own catalog at all. Same entry shapes
// as their Astir counterparts (partType/traits/uses/description for parts; tags for weapons) so
// they render through the identical existing part/weapon UI with no new rendering code. None carry
// powerCost, weaponPowerBonus, or a Drain tag — authored Ardent-safe directly, unlike
// ardentParts()/ardentWeapons() there's no filtering to do before offering them.
export const ARDENT_FEATURE_PARTS = [
	{
		key: "ardent-feature:armour-plating",
		name: "Armour Plating II",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		description:
			"<p>Layered plating bolted directly onto the frame, thick enough to matter without slowing " +
			"the Ardent down too badly.</p>" +
			"<p>You may use this once per Sortie to reduce an incoming source of harm from a peril to " +
			"a risk, or from a risk to nothing (+ward).</p>"
	},
	{
		key: "ardent-feature:internal-seals",
		name: "Internal Seals II",
		partType: "Passive",
		traits: [],
		description:
			"<p>A sealed cockpit and reinforced joints let this Ardent shrug off conditions that would " +
			"ground a less hardened frame.</p>" +
			"<p>+adapted.</p>"
	},
	{
		key: "ardent-feature:chromatic-reserves",
		name: "Chromatic Reserves II",
		partType: "Active",
		traits: [],
		// Three checkboxes rather than Chromatic Focus's single EXPENDED_USE — "3x per Sortie" reuses
		// the same generic uses mechanism (_moveGroupMoves/_onMoveUseToggle) at a longer length, no
		// new rendering code. Approach is already a plain editable dropdown on the Astir & Ardents
		// tab — swapping it needs no new code, just the player changing it and changing it back.
		uses: [
			{ key: "use-1", label: "Use 1", period: "Sortie" },
			{ key: "use-2", label: "Use 2", period: "Sortie" },
			{ key: "use-3", label: "Use 3", period: "Sortie" }
		],
		description:
			"<p>A store of reserve reagents lets this Ardent's pilot re-aspect its output on the fly.</p>" +
			"<p>Swap to any other Approach for a single Scene. Usable up to 3 times per Sortie.</p>"
	},
	{
		key: "ardent-feature:bane-reserves",
		name: "Bane Reserves II",
		partType: "Active",
		traits: [],
		// "Upgrade to ruin" has no existing tag-upgrade mechanism to hook into (see claude.md's
		// "systems that do not exist yet") — stays descriptive, tracked with the same 3x-per-Sortie
		// checkbox shape Chromatic Reserves above uses.
		uses: [
			{ key: "use-1", label: "Use 1", period: "Sortie" },
			{ key: "use-2", label: "Use 2", period: "Sortie" },
			{ key: "use-3", label: "Use 3", period: "Sortie" }
		],
		description:
			"<p>A reservoir feeding this Ardent's weaponry with concentrated, hostile-to-magic reagents.</p>" +
			"<p>+bane. Up to 3 times per Sortie, you may upgrade a risk you'd inflict to a peril instead.</p>"
	}
];

export const ARDENT_FEATURE_WEAPONS = [
	{
		key: "ardent-feature:antipersonnel-turret",
		name: "Antipersonnel Turret II",
		description: "A mounted turret meant for thinning out infantry rather than trading blows with " +
			"another frame.",
		tags: ["ranged", "defensive"]
	},
	{
		key: "ardent-feature:bolt-sigils",
		name: "Bolt Sigils II",
		description: "Etched sigils along a melee weapon's edge, primed to discharge a hostile-to-magic " +
			"jolt on impact.",
		tags: ["melee", "bane"]
	},
	{
		key: "ardent-feature:blasting-stave",
		name: "Blasting Stave II",
		description: "A shoulder-braced stave charged for a single devastating, indiscriminate blast.",
		tags: ["sniper", "messy", "limited", "area", "impact"]
	},
	{
		key: "ardent-feature:brimstone-pods",
		name: "Brimstone Pods",
		description: "Pods of volatile, sulfurous charges, lobbed to cover a wide area — better rationed " +
			"than relied on.",
		tags: ["ranged", "limited", "area"]
	},
	{
		key: "ardent-feature:lancing-stave",
		name: "Lancing Stave II",
		description: "A precise, reload-heavy stave built to punch clean through a single target from range.",
		tags: ["sniper", "reload", "decisive"]
	}
];

// Every catalog an Ardent's own parts array might reference — the generic Astir-derived one every
// playbook's Ardent draws from (ASTIR_PART_CATALOG, via ardentParts()) plus Commander's exclusive
// Ardent Features (ARDENT_FEATURE_PARTS above) — used wherever an Ardent's stored part keys need
// resolving, since a Commander's Ardent can carry keys from either catalog at once.
export const ARDENT_PART_CATALOG = [...ASTIR_PART_CATALOG, ...ARDENT_FEATURE_PARTS];

// True when a stored part key belongs to the Commander-exclusive catalog above rather than the
// generic Astir-derived one — parts are stored on ardent.parts as plain catalog-key references
// (never freely edited, unlike equipment), so catalog membership alone reliably classifies them.
export function isAceFeaturePart(key, catalog = ARDENT_FEATURE_PARTS) {
	return catalog.some((part) => part.key === key);
}

// Commander's Custom Ardent fills its normal baseline loadout (parts/weapons from the generic
// Astir-derived catalog, ardentParts()/ardentWeapons() above) exactly like any other playbook's
// Ardent, capped at ARDENT_MAX_LOADOUT — and separately gets its own Ardent Feature slots (see
// ardentFeatureLoadoutCount/ardentFeatureMax below). The two pools are counted independently, so
// this excludes anything classified as a Commander Feature rather than reusing the old
// ardentLoadoutCount, which counted everything combined — for every other playbook (which never has
// a Commander-Feature-flagged item at all) the two functions return identical counts.
export function ardentBaselineLoadoutCount(ardent, equipment = []) {
	const parts = (ardent?.parts ?? []).filter((key) => !isAceFeaturePart(key)).length;
	const weapons = equipment.filter((item) => item.kind === "weapon" && item.ardent === ardent?.id && !item.commanderFeature).length;
	return parts + weapons;
}

// The separate Commander Feature pool's own count — parts classified by catalog-key membership
// (see isAceFeaturePart), weapons by the commanderFeature: true flag equipment carries at add-time
// (see PlaybookActorSheet#_onArdentFeatureWeaponAdd) — a weapon entry is a freely-editable snapshot
// once saved (see claude.md's Equipment notes), so unlike a part it can't be traced back to its
// source catalog by key alone.
export function ardentFeatureLoadoutCount(ardent, equipment = []) {
	const parts = (ardent?.parts ?? []).filter((key) => isAceFeaturePart(key)).length;
	const weapons = equipment.filter((item) => item.kind === "weapon" && item.ardent === ardent?.id && item.commanderFeature).length;
	return parts + weapons;
}

// Commander's gear starts with 3 Ardent Features; Requisitions (see playbook-moves.js) grants 2
// more via its own ardentFeatureBonus flag, summed across picked moves the same way
// PlaybookActorSheet#_conflictTier sums conflictTier/tierBonus and _downtimeTokensMax sums
// downtimeTokensMax.
export const ARDENT_FEATURE_MAX_BASE = 3;

export function ardentFeatureMax(pickedMoves = []) {
	return ARDENT_FEATURE_MAX_BASE + pickedMoves.reduce((sum, move) => sum + (move.ardentFeatureBonus ?? 0), 0);
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
