export const STARTING_GEAR_PICKER_TEMPLATE = "modules/armor-astir/templates/starting-gear-picker.hbs";

// Per-playbook starting gear allowances (see claude.md, "Domain conventions" for the general
// catalog/keys split this mirrors from MOVE_POOLS and EQUIPMENT_CATALOG). Unlike playbookMoves,
// picked items are never stored as a permanent key reference back to this file — they're turned
// straight into ordinary system.attributes.equipment entries (see
// PlaybookActorSheet#_onStartingGearAdd), the same snapshot treatment EQUIPMENT_CATALOG picks
// already get, since that array is always freely editable afterward regardless of where an entry
// came from.
//
// `chooseCount` is a hard cap enforced by chooseStartingGear below — unlike MOVE_POOLS/
// EQUIPMENT_CATALOG's deliberate non-enforcement of pool membership and prerequisites, a starting
// gear allowance is a real chargen budget, not a loose fictional guideline. `customWeaponNote` is
// shown as non-blocking guidance text on the weapon editor (see equipment.js's configureEquipment
// `note` option) — the tag-value budget it describes is never enforced. `freeformNotes` are
// narrative-only lines with no mechanical hook (e.g. "Any tier I weapons that feel appropriate"),
// transcribed as prose per claude.md's "systems that do not exist yet" guidance rather than
// modeled.
//
// `grantedItems` (The Impostor's Augments I) are equipment every character of that playbook just
// starts with — no pick involved, same "always added, shown read-only in the picker" treatment
// starting-moves.js's own grantedKeys gives Arcane Augments. Every item (granted or pickable) may
// carry `kind` ("weapon" or the default "gear"), and a weapon item may further carry `tags`
// (needs a WEAPON_RANGE_GROUP entry — see equipment.js — the same requirement configureEquipment
// enforces for a custom-made weapon), `scale` (default "foot") and `tier` (default TIER_MIN) — see
// PlaybookActorSheet#_startingGearEntry, which turns any of these into an equipment.js-shaped
// entry the same way a catalog pick already is.
export const STARTING_GEAR_POOLS = [
	{
		playbookName: "The Scout",
		chooseCount: 2,
		customWeaponNote: "Design a +2 total cost weapon using tags of your choice.",
		freeformNotes: [
			"Any tier I weapons that feel appropriate.",
			"Clothes that match your look."
		],
		grantedItems: [],
		items: [
			{
				key: "the-scout:maps-and-tools",
				name: "Maps & Tools",
				description: "You can always find a way through or past."
			},
			{
				key: "the-scout:aid-and-repair-kit",
				name: "Aid & Repair Kit",
				description: "You can tend to minor injuries or damages."
			},
			{
				key: "the-scout:traps-and-wards",
				name: "Traps & Wards",
				description: "You can always set up a defence given time."
			},
			{
				key: "the-scout:blades-and-bracers",
				name: "Blades & Bracers",
				description: "You can always produce a basic weapon, +ward.",
				// The "+ward" in the description above is a real Equipment tag (see
				// equipment.js's EQUIPMENT_TAGS), not just prose — carried here so
				// PlaybookActorSheet#_onStartingGearAdd can attach it to the picked entry.
				tags: ["ward"]
			}
		]
	},
	{ playbookName: "The Commander", chooseCount: 0, grantedItems: [], items: [] },
	{
		playbookName: "The Impostor",
		chooseCount: 2,
		freeformNotes: ["Clothes that match your look."],
		// Augments I — always melee, always Tier I, the augmentations that let an Impostor pilot
		// an Astir at all (see moves.js's Arcane Augments). No customWeaponNote: unlike The Scout,
		// every Impostor weapon here is prescribed rather than player-designed.
		grantedItems: [
			{
				key: "the-impostor:augments-i",
				name: "Augments I",
				description: "The arcane augmentations that let you control an Astir.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		items: [
			{
				key: "the-impostor:power-focus-i",
				name: "Power Focus I",
				description: "A focus that channels and directs magical energy into a ranged blast.",
				kind: "weapon",
				tags: ["ranged", "blitz"]
			},
			{
				key: "the-impostor:nullblade-i",
				name: "Nullblade I",
				description: "A plain, unenchanted blade — no different from one anybody else might carry.",
				kind: "weapon",
				tags: ["melee", "mundane"]
			},
			{
				key: "the-impostor:sidearm-i",
				name: "Sidearm I",
				description: "The typical protections afforded to Astir pilots: a reliable tool capable of " +
					"firing bursts of light arcane energy.",
				kind: "weapon",
				tags: ["ranged", "defensive"]
			},
			{
				key: "the-impostor:shield-broach-i",
				name: "Shield Broach I",
				description: "A small worn charm that flares to ward off harm.",
				// The "ward" tag is a real Equipment tag (see equipment.js) — same treatment
				// Blades & Bracers gets above.
				tags: ["ward"]
			}
		]
	}
];

export function findStartingGearPool(playbookName, pools = STARTING_GEAR_POOLS) {
	return pools.find((pool) => pool.playbookName === playbookName) ?? null;
}

// Opens the "+ Choose Starting Gear" picker for one playbook's pool and resolves the picked
// items' full definitions (not bare keys — the caller turns each straight into an equipment
// entry, same as a catalog pick), or null if the dialog was dismissed. Mirrors
// chooseEquipmentCatalogItem's promise/Dialog shape (equipment.js).
//
// The checked selection is truncated to pool.chooseCount before resolving, in checkbox order —
// the hard-cap enforcement point. This mirrors configureEquipment's existing tier-clamp idiom
// (normalize the result rather than reject the dialog) instead of blocking Add or disabling
// checkboxes live, which would need the kind of reactive-form wiring claude.md notes this
// module's Dialogs have no precedent for.
export async function chooseStartingGear(playbookName, pools = STARTING_GEAR_POOLS) {
	const pool = findStartingGearPool(playbookName, pools);
	if (!pool) return null;

	const content = await renderTemplate(STARTING_GEAR_PICKER_TEMPLATE, {
		grantedItems: pool.grantedItems,
		items: pool.items,
		chooseCount: pool.chooseCount,
		freeformNotes: pool.freeformNotes ?? []
	});

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Starting Gear",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => {
						const checkedKeys = html.find("[name='starting-gear-item']:checked").map((_, el) => el.value).get();
						const picked = checkedKeys
							.slice(0, pool.chooseCount)
							.map((key) => pool.items.find((item) => item.key === key))
							.filter(Boolean);
						resolve(picked);
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "starting-gear-picker"] }).render(true);
	});
}
