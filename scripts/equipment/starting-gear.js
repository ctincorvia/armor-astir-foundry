export const STARTING_GEAR_PICKER_TEMPLATE = "modules/armor-astir/templates/starting-gear-picker.hbs";

// The default tag-value budget for a pool's custom weapon (see customWeaponNote below), and the
// tag keys excluded from that flow outright. This module has no economy/appraisal system —
// Valuable/Treasure's own EQUIPMENT_TAGS description already says as much — so letting them count
// toward (or pad out) a chargen weapon's budget would be free value with nothing behind it; simpler
// to exclude them from this flow entirely than to let a player stack them for no cost.
export const DEFAULT_CUSTOM_WEAPON_MAX_VALUE = 0;
export const CUSTOM_WEAPON_EXCLUDED_TAG_KEYS = ["valuable", "treasure"];

// Per-playbook starting gear allowances (see claude.md, "Domain conventions" for the general
// catalog/keys split this mirrors from MOVE_POOLS and EQUIPMENT_CATALOG). Unlike playbookMoves,
// picked items are never stored as a permanent key reference back to this file — they're turned
// straight into ordinary system.attributes.equipment entries (see
// PlaybookActorSheet#_onStartingGearAdd), the same snapshot treatment EQUIPMENT_CATALOG picks
// already get, since that array is always freely editable afterward regardless of where an entry
// came from.
//
// Pickable items live in `groups`, each with its own `chooseCount` — a hard cap enforced per group
// by chooseStartingGear below. Unlike MOVE_POOLS/EQUIPMENT_CATALOG's deliberate non-enforcement of
// pool membership and prerequisites, a starting gear allowance is a real chargen budget, not a
// loose fictional guideline. Most playbooks need only one group; The Diplomat has two independent
// budgets ("1 Diplomacy 'Tool'" and "3 'Diplomacy' Tools"), which a single mixed chooseCount
// couldn't express — it would let a player take four gear and no weapon.
//
// `customWeaponNote` is shown as non-blocking guidance text on the weapon editor (see equipment.js's
// configureEquipment `note` option); unlike a plain freeform note, the tag-value budget it describes
// IS enforced — configureEquipment is also passed excludedTagKeys: CUSTOM_WEAPON_EXCLUDED_TAG_KEYS
// and maxTagValue: pool.customWeaponMaxValue ?? DEFAULT_CUSTOM_WEAPON_MAX_VALUE (see
// PlaybookActorSheet#_onStartingGearAdd), so a pool need only set customWeaponMaxValue when its
// budget differs from the default (The Scout's is +2; every other pool with a customWeaponNote
// today just takes the default of +0).
// `freeformNotes` are narrative-only lines with no mechanical hook (e.g. "Any tier I weapons that
// feel appropriate"), transcribed as prose per claude.md's "systems that do not exist yet" guidance
// rather than modeled.
//
// `grantedItems` (The Impostor's Augments I) are equipment every character of that playbook just
// starts with — no pick involved, same "always added, shown read-only in the picker" treatment
// starting-moves.js's own grantedKeys gives Arcane Augments. Every item (granted or pickable) may
// carry `kind` ("weapon" or the default "gear"), and a weapon item may further carry `tags`
// (needs a WEAPON_RANGE_GROUP entry — see equipment.js — the same requirement configureEquipment
// enforces for a custom-made weapon) and `scale` (default "foot") — see
// PlaybookActorSheet#_startingGearEntry, which turns any of these into an equipment.js-shaped
// entry the same way a catalog pick already is. No item here carries `tier` — a starting weapon's
// Tier derives from the wielding character, same as any other mundane weapon (see
// _equipmentEntry).
export const STARTING_GEAR_POOLS = [
	{
		playbookName: "The Scout",
		chooseCount: 2,
		customWeaponNote: "Design a +2 total cost weapon using tags of your choice.",
		customWeaponMaxValue: 2,
		freeformNotes: [
			"Any tier I weapons that feel appropriate.",
			"Clothes that match your look."
		],
		grantedItems: [],
		groups: [
			{
				key: "the-scout:gear",
				label: "Choose 2.",
				chooseCount: 2,
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
			}
		]
	},
	{
		playbookName: "The Commander",
		// "1 Custom Ardent II" and "3 Ardent Features" aren't equipment-shaped at all — they're
		// frame-level content built through the Astir & Ardents tab's own Ardent/Ardent Feature
		// controls (see ardent.js's ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS), not something this
		// picker can grant. Only the two personal-equipment items from Commander's gear list go here.
		freeformNotes: ["1 Custom Ardent II, built on the Astir & Ardents tab.", "3 Ardent Features, added from the Custom Ardent's own controls."],
		grantedItems: [
			{
				key: "the-commander:saber-sidearm-i",
				name: "Saber & Sidearm I",
				description: "The standard-issue pairing carried by Ardent crews: a reliable sidearm backed " +
					"up by a blade for when the fight closes in.",
				kind: "weapon",
				tags: ["ranged", "versatile"]
			},
			{
				key: "the-commander:clothes",
				name: "Clothes",
				description: "Clothes that match your look."
			}
		],
		groups: []
	},
	{
		playbookName: "The Impostor",
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
		groups: [
			{
				key: "the-impostor:gear",
				label: "Choose 2.",
				chooseCount: 2,
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
						description: "A plain, unenchanted blade — no different from one anybody else might " +
							"carry.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-impostor:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
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
		]
	},
	{
		playbookName: "The Diplomat",
		grantedItems: [],
		freeformNotes: ["Clothing that matches your look."],
		groups: [
			{
				key: "the-diplomat:tools",
				label: "Choose 1 Diplomacy 'Tool'.",
				chooseCount: 1,
				items: [
					{
						key: "the-diplomat:spyglass-ray-i",
						name: "Spyglass Ray I",
						description: "A precision weapon disguised as an optic instrument.",
						kind: "weapon",
						tags: ["sniper", "bane", "elemental"]
					},
					{
						key: "the-diplomat:fencing-blade-i",
						name: "Fencing Blade I",
						description: "A light, quick blade suited to formal duels as much as self-defence.",
						kind: "weapon",
						tags: ["melee", "defensive", "blitz"]
					},
					{
						key: "the-diplomat:arcane-dagger-i",
						name: "Arcane Dagger I",
						description: "A small, concealable blade humming with destructive magic.",
						kind: "weapon",
						tags: ["melee", "ruin", "intimate", "arcane"]
					}
				]
			},
			{
				key: "the-diplomat:gear",
				label: "Choose 3 'Diplomacy' Tools.",
				chooseCount: 3,
				items: [
					{
						key: "the-diplomat:listenbugs",
						name: "Listenbugs",
						description: "Overhear anyone during Downtime near a bug you've hidden—they're fragile.",
						// The "fragile" tag is a real Equipment tag (see equipment.js's EQUIPMENT_TAGS) —
						// same treatment Blades & Bracers/Shield Broach I give their own tag reference.
						tags: ["fragile"]
					},
					{
						key: "the-diplomat:lockpicks",
						name: "Lockpicks",
						description: "Useful for picking locks, unsurprisingly."
					},
					{
						key: "the-diplomat:silencing-matrix",
						name: "Silencing Matrix",
						description: "Removes all noise from a tier I weapon."
					},
					{
						key: "the-diplomat:shimmershape-clothing",
						name: "Shimmershape Clothing",
						description: "Clothing can magically change colour and design."
					},
					{
						key: "the-diplomat:agents",
						name: "Agents",
						description: "Once per Downtime, report on intel they've gathered: the Director will " +
							"reveal something useful about the Sortie."
					},
					{
						key: "the-diplomat:transport",
						name: "Transport",
						description: "You have a mount or vehicle that's fast and quiet—probably something " +
							"tier II."
					}
				]
			}
		]
	},
	{
		playbookName: "The Arcanist",
		// "1 Astir III" isn't equipment-shaped like the rest of this list — it's built through the
		// Astir & Ardents tab's own controls (create Astir, defaults to Tier III already), same
		// treatment Commander's Custom Ardent gets here. Touch Spells I, by contrast, is an ordinary
		// personal weapon (see grantedItems below) — nothing in the rulebook says it's added from the
		// Astir's own weapon controls the way Commander's Ardent Features explicitly are, so it's
		// granted here like any other playbook's starting weapon rather than left as a freeform note.
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-arcanist:touch-spells-i",
				name: "Touch Spells I",
				description: "A focusing gesture and a whispered word, channeled straight through the caster's " +
					"own hands into whatever — or whoever — they touch.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-arcanist:gear",
				label: "Choose 2 Arcanist Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-arcanist:telescoping-staff-i",
						name: "Telescoping Staff I",
						description: "A collapsible metal staff that extends in an instant, delivering a " +
							"solid, weighty blow.",
						kind: "weapon",
						tags: ["melee", "impact"]
					},
					{
						key: "the-arcanist:reagent-knife-i",
						name: "Reagent Knife I",
						description: "A plain, unenchanted blade used to prepare reagents as readily as it " +
							"draws blood.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-arcanist:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-arcanist:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm that flares to ward off harm.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Paradigm",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-paradigm:divine-touch-i",
				name: "Divine Touch I",
				description: "A blow delivered through a hand wreathed in divine light — the caster's own " +
					"conduit for their god's power.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-paradigm:gear",
				label: "Choose 2 Paradigm Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-paradigm:holy-symbol-i",
						name: "Holy Symbol I",
						description: "A sacred icon raised high, calling down divine judgement on all who " +
							"stand against the faith.",
						kind: "weapon",
						tags: ["ranged", "area"]
					},
					{
						key: "the-paradigm:sacred-weapon-i",
						name: "Sacred Weapon I",
						description: "A blade or bludgeon consecrated in solemn ritual — ordinary steel made " +
							"holy by purpose and blessing.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-paradigm:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-paradigm:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm that flares to ward off harm.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Witch",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-witch:pact-weapon-i",
				name: "Pact Weapon I",
				description: "A weapon shaped — or granted outright — by the Witch's patron, its edge (or " +
					"its aim) always finding whatever the patron would have it strike down.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-witch:gear",
				label: "Choose 2 Witch Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-witch:patrons-icon-i",
						name: "Patron's Icon I",
						description: "A small, easily hidden token of the Witch's patron, channeling their " +
							"power into a discreet ranged strike.",
						kind: "weapon",
						tags: ["ranged", "concealable"]
					},
					{
						key: "the-witch:ritual-dagger-i",
						name: "Ritual Dagger I",
						description: "A plain, unenchanted blade used in ritual as readily as it draws blood.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-witch:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-witch:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm that flares to ward off harm.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Wither",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-wither:withering-grip-i",
				name: "Withering Grip I",
				description: "A touch that leeches vitality and warmth from whatever — or whoever — it closes " +
					"around.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-wither:gear",
				label: "Choose 2 Wither Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-wither:carved-wand-i",
						name: "Carved Wand I",
						description: "A wand carved from grave-wood, channeling a thin sliver of death magic " +
							"outward at range.",
						kind: "weapon",
						tags: ["ranged"]
					},
					{
						key: "the-wither:wicked-blade-i",
						name: "Wicked Blade I",
						description: "A plain, unenchanted blade, no different from one anybody else might " +
							"carry.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-wither:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-wither:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm that flares to ward off harm.",
						tags: ["ward"]
					}
				]
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
// Each group's checked selection is truncated to its own chooseCount before resolving, in
// checkbox order — the hard-cap enforcement point, applied independently per group so (e.g.) The
// Diplomat's 1 weapon and 3 gear budgets can't bleed into each other. Checkbox `name` is
// group-scoped (see starting-gear-picker.hbs) so one group's checked boxes never leak into
// another's count. This mirrors configureEquipment's existing tier-clamp idiom (normalize the
// result rather than reject the dialog) instead of blocking Add or disabling checkboxes live,
// which would need the kind of reactive-form wiring claude.md notes this module's Dialogs have no
// precedent for.
export async function chooseStartingGear(playbookName, pools = STARTING_GEAR_POOLS) {
	const pool = findStartingGearPool(playbookName, pools);
	if (!pool) return null;

	const content = await renderTemplate(STARTING_GEAR_PICKER_TEMPLATE, {
		grantedItems: pool.grantedItems,
		groups: pool.groups,
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
						const picked = pool.groups.flatMap((group) => {
							const checkedKeys = html.find(`[name='starting-gear-item-${group.key}']:checked`)
								.map((_, el) => el.value).get();
							return checkedKeys
								.slice(0, group.chooseCount)
								.map((key) => group.items.find((item) => item.key === key))
								.filter(Boolean);
						});
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
