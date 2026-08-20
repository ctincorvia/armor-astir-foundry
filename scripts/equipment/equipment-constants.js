// A true leaf module: every equipment-domain file (equipment-tags.js, equipment-catalog.js,
// equipment-helpers.js, equipment-dialogs.js, and the equipment.js barrel) may import from here,
// but this file imports nothing itself — see equipment.js's own barrel comment for the full split.

// -3 exists solely for Drain 3 (see EQUIPMENT_TAGS below) — every other tag stays within -2..+2.
export const TAG_VALUE_MIN = -3;
export const TAG_VALUE_MAX = 2;

// The classifier for Melee/Ranged/Sniper (see EQUIPMENT_TAGS' `exclusiveGroup` doc below). Unlike
// DRAIN_GROUP below, these three never render as checkboxes — configureEquipment renders them as
// their own native radio group (equipment-editor.hbs) instead, since a weapon must always carry
// exactly one and a radio group can have a default, structurally preventing "none selected". The
// exclusiveGroup marker is still used to filter them out of the checkbox tag list and to identify
// them for the default-selection logic (see configureEquipment).
export const WEAPON_RANGE_GROUP = "weapon-range";

// The second exclusiveGroup: Drain 1/2/3 (see EQUIPMENT_TAGS below) render as checkboxes with
// JS-enforced radio-button behavior — configureEquipment's render wiring unchecks every other tag
// sharing the same exclusiveGroup, the mechanism WEAPON_RANGE_GROUP used before it became a native
// radio group (see its own doc comment above). Drain stays a checkbox group rather than following
// suit because it's optional, not required — an item may carry none of the three. Unlike
// WEAPON_RANGE_GROUP, membership in this group does NOT exempt a tag from MAX_TAGS below — Drain
// still carries a real negative value (it's a drawback pick, not a pure classifier), so each tier
// costs one regular tag slot like any other tag.
//
// Drain only ever does anything on a weapon actually mounted on an Astir (astirWeapon: true — see
// astir.js#astirWeaponDrainTotal), so configureEquipment hides Drain's checkboxes from every other
// flow (mundane/foot-scale weapons, gear, Carrier weapons) rather than offering a pick that would
// stay permanently inert.
export const DRAIN_GROUP = "drain";

// A third exclusiveGroup: Mounted and Two-Handed (see EQUIPMENT_TAGS below) render as checkboxes
// with the same JS-enforced radio-button behavior as DRAIN_GROUP above, via the same generic
// toggle handler in configureEquipment — unchecking every other tag sharing the same
// exclusiveGroup when one is checked. Like DRAIN_GROUP (and unlike WEAPON_RANGE_GROUP), this
// group is optional, not required — a weapon may carry neither tag. And because it renders as
// ordinary checkboxes rather than WEAPON_RANGE_GROUP's native radio group, membership here does
// NOT exempt a tag from MAX_TAGS below — Mounted and Two-Handed each still carry a real value and
// cost one regular tag slot like any other tag.
export const MOUNTED_TWO_HANDED_GROUP = "mounted-two-handed";

// Applies to every equipment entry (weapon or gear). Melee/Ranged/Sniper never count against this
// cap — they're a classifier, not a regular tag pick — but that's now structural rather than
// something this cap has to account for: WEAPON_RANGE_GROUP tags are never rendered as checkboxes
// at all (see WEAPON_RANGE_GROUP's own doc comment), so they can never appear among the checked
// tag keys this cap counts. Enforced only at Save, same as the blank-name and weapon-range checks
// in configureEquipment. Flat across every tier (not scaled by TIER_MIN/TIER_MAX).
export const MAX_TAGS = 8;

export const TIER_MIN = 1;
export const TIER_MAX = 5;

// The flat effective cap an "Override Max" click in configureEquipment raises a weapon's tag-value
// cap to (see its own doc comment) — a Director escape hatch for the "tags sum to 0 or less" budget
// rule, not itself a per-caller option. 5 covers every custom-weapon budget in play today (the
// generic Equipment tab's 0, the Astir/Ardent custom-weapon flows' 0) with headroom, without being
// so high it stops reading as a deliberate, visible exception.
export const OVERRIDE_MAX_TAG_VALUE = 5;

export const EQUIPMENT_EDITOR_TEMPLATE = "modules/armor-astir/templates/equipment-editor.hbs";
export const EQUIPMENT_CATALOG_PICKER_TEMPLATE = "modules/armor-astir/templates/equipment-catalog-picker.hbs";

// Sentinel for "fighting unarmed" — a real, always-offered choice in the merged move-roll
// dialog's own weapon-select (see move-dialogs.js's configureMoveRoll and
// PlaybookActorSheet#_weaponRollBundle), distinct from the dialog being dismissed entirely (which
// resolves null, same as every other picker in this module). The value here must match the
// hardcoded option value move-roll-dialog.hbs's `{{#each weaponBundles}}` block renders for the
// null (Unarmed) bundle entry — a template can't reference this constant directly.
export const UNARMED = "unarmed";

// Weapons are either sized for an Astir or for the person wielding one — purely descriptive
// (see claude.md, "Domain conventions"): Astirs aren't their own documents yet, so nothing
// enforces who may wield which scale, the same deliberate non-enforcement as move pool
// membership in playbook-moves.js.
export const WEAPON_SCALES = [
	{ key: "foot", label: "Foot Scale", note: "Wielded by people." },
	{ key: "astir", label: "Astir Scale", note: "Wielded by Astirs." }
];

// The value-banding groups EQUIPMENT_TAGS is authored in (see its own -3/-2/-1/0/+1/+2 comment
// groups) — kept in this leaf file rather than alongside its only reader, groupEquipmentTags in
// equipment-helpers.js, so equipment-tags.js's EQUIPMENT_TAGS catalog and equipment-dialogs.js's
// configureEquipment can both import the other shared constants above from this one file too,
// without either of them needing anything from equipment-helpers.js.
export const TAG_VALUE_GROUPS = [
	{ value: -3, label: "Severe Drawbacks (-3)" },
	{ value: -2, label: "Heavy Drawbacks (-2)" },
	{ value: -1, label: "Minor Drawbacks (-1)" },
	{ value: 0, label: "No Effect (0)" },
	{ value: 1, label: "Strong Benefits (+1)" },
	{ value: 2, label: "Rare Benefits (+2)" }
];
