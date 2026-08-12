import { buildTagReference, wirePickerTabs, withTagLabels } from "./equipment.js";

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
	},
	{
		playbookName: "The Adrift",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-adrift:strange-touch-i",
				name: "Strange Touch I",
				description: "A blow delivered through hands touched by power that was never meant to be theirs.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-adrift:curios",
				label: "Choose 2 Adrift Curios.",
				chooseCount: 2,
				items: [
					{
						key: "the-adrift:it-like-shoots-you-know-i",
						name: "It Like, Shoots? You Know? I",
						description: "You're not entirely sure how it works. It shoots things, though.",
						kind: "weapon",
						tags: ["ranged"]
					},
					{
						key: "the-adrift:for-hitting-people-with-i",
						name: "For Hitting People With I",
						// The rulebook parenthetical for this item also lists "arcane", which is not a real
						// EQUIPMENT_TAGS key anywhere in this module (grep equipment.js's EQUIPMENT_TAGS —
						// only melee/ranged/sniper/bane/defensive/ward/etc. exist, no "arcane"). Per
						// claude.md's "systems that do not exist yet" guidance, only the real tag is kept.
						description: "You're fairly sure it used to be something else. Now it's for hitting people with.",
						kind: "weapon",
						tags: ["melee"]
					},
					{
						key: "the-adrift:hard-to-explain-i",
						name: "Hard To Explain I",
						description: "You genuinely cannot explain how or why this works.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-adrift:this-its-just-a-keepsake-i",
						name: "This? It's Just A Keepsake I",
						description: "Something you brought with you. It wards off harm, somehow.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Advocate",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-advocate:withertouch-i",
				name: "Withertouch I",
				description: "A touch that draws on the slow, patient hunger of rot and reclamation.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-advocate:gear",
				label: "Choose 2 Advocate Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-advocate:oaken-staff-i",
						name: "Oaken Staff I",
						description: "A staff of living wood that channels natural force outward at range.",
						kind: "weapon",
						tags: ["ranged"]
					},
					{
						key: "the-advocate:sharp-sickle-i",
						name: "Sharp Sickle I",
						// The "mundane" tag key is not a real EQUIPMENT_TAGS entry (see equipment.js) —
						// resolveEquipmentTags silently drops it. Mirrors the-wither's Wicked Blade I
						// precedent, which already ships this exact same inert tag.
						description: "A plain, well-worn sickle, no different from the tools of any harvest.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-advocate:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of concentrated natural energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-advocate:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm, grown rather than forged, that flares to ward off " +
							"harm.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Revenant",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"A keepsake or souvenir."
		],
		grantedItems: [
			{
				key: "the-revenant:deathly-grip-i",
				name: "Deathly Grip I",
				description: "A touch that closes around the living with the cold, patient grip of the " +
					"grave.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-revenant:spectral-aspect",
				label: "Choose 1 Spectral Aspect.",
				chooseCount: 1,
				items: [
					{
						key: "the-revenant:ethereal-form",
						name: "Ethereal Form",
						description: "Your spirit may separate itself from the Astir, and float freely."
					},
					{
						key: "the-revenant:kinship",
						name: "Kinship",
						description: "Other ghosts regard you as a friend."
					},
					{
						key: "the-revenant:puppeteer",
						name: "Puppeteer",
						description: "You can possess corpses."
					}
				]
			}
		]
	},
	{
		playbookName: "The Summoner",
		freeformNotes: [
			"1 Astir III, built on the Astir & Ardents tab.",
			"Clothes that match your look."
		],
		grantedItems: [
			{
				key: "the-summoner:conjured-blade-i",
				name: "Conjured Blade I",
				description: "A blade of pure magical force, given shape and edge for exactly as long as " +
					"it's needed.",
				kind: "weapon",
				tags: ["melee", "bane"]
			}
		],
		groups: [
			{
				key: "the-summoner:gear",
				label: "Choose 2 Summoner Gear.",
				chooseCount: 2,
				items: [
					{
						key: "the-summoner:ribboned-staff-i",
						name: "Ribboned Staff I",
						description: "A staff trailing enchanted ribbons that lash out to strike at range.",
						kind: "weapon",
						tags: ["ranged"]
					},
					{
						key: "the-summoner:gifted-dagger-i",
						name: "Gifted Dagger I",
						// The "mundane" tag key is not a real EQUIPMENT_TAGS entry (see equipment.js) -
						// resolveEquipmentTags silently drops it. Mirrors the-wither's Wicked Blade I/
						// the-advocate's Sharp Sickle I precedent, which already ship this exact same
						// inert tag.
						description: "A plain blade, a gift from the first ally ever bound.",
						kind: "weapon",
						tags: ["melee", "mundane"]
					},
					{
						key: "the-summoner:sidearm-i",
						name: "Sidearm I",
						description: "The typical protections afforded to Astir pilots: a reliable tool " +
							"capable of firing bursts of light arcane energy.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					},
					{
						key: "the-summoner:shield-broach-i",
						name: "Shield Broach I",
						description: "A small worn charm that flares to ward off harm.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Icon",
		freeformNotes: [
			"A magical instrument or other artistic tool.",
			"Multiple sets of clothes that match your look."
		],
		grantedItems: [],
		groups: [
			{
				key: "the-icon:iconic-perks",
				label: "Choose 2 Iconic Perks.",
				chooseCount: 2,
				items: [
					{
						key: "the-icon:bodyguards-i",
						name: "Bodyguards I",
						description: "Conjured protectors that flare into being around you, striking at " +
							"anyone who threatens you.",
						kind: "weapon",
						tags: ["melee", "area", "ward"]
					},
					{
						key: "the-icon:broad-appeal",
						name: "Broad Appeal",
						description: "Everybody recognises you."
					},
					{
						key: "the-icon:personal-fortune",
						name: "Personal Fortune",
						description: "Act with advantage anywhere money makes a difference."
					},
					{
						key: "the-icon:influencer",
						name: "Influencer",
						description: "Nobody turns down your counsel or input on the basis of position/rank."
					},
					{
						key: "the-icon:personalised-sidearm-i",
						name: "Personalised Sidearm I",
						description: "A sidearm made to match your look, as recognisable as it is functional.",
						kind: "weapon",
						tags: ["ranged", "defensive"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Attendant",
		freeformNotes: ["Clothing that matches your look."],
		grantedItems: [],
		groups: [
			{
				key: "the-attendant:defensive-weapon",
				label: "Choose 1 Defensive Weapon.",
				chooseCount: 1,
				items: [
					{
						key: "the-attendant:sword-cane-i",
						name: "Sword Cane I",
						description: "A cane that conceals a slender blade, drawn in an instant.",
						kind: "weapon",
						tags: ["melee", "defensive", "concealable"]
					},
					{
						key: "the-attendant:fan-of-knives",
						name: "Fan Of Knives",
						description: "An ornamental fan that flicks outward in a spray of hidden blades.",
						kind: "weapon",
						tags: ["ranged", "defensive", "area"]
					},
					{
						key: "the-attendant:wand-rifle-i",
						name: "Wand-rifle I",
						description: "A slender rifle disguised as a walking cane's counterpart, firing with precise, forceful impact.",
						kind: "weapon",
						tags: ["sniper", "defensive", "impact"]
					}
				]
			},
			{
				key: "the-attendant:retinue-staff",
				label: "Choose 2 Retinue Staff.",
				chooseCount: 2,
				items: [
					{
						key: "the-attendant:artificers",
						name: "Artificers",
						description: "+1 token towards repairs & magic or mechanical long-term projects.",
						bonusDowntimeTokens: { max: 1, description: "Repairs, or magic or mechanical long-term projects." }
					},
					{
						key: "the-attendant:maids",
						name: "Maids",
						description: "Everything is kept clean and orderly: anything lost or hidden is always found."
					},
					{
						key: "the-attendant:cooks",
						name: "Cooks",
						description: "Everyone makes their first roll during a Sortie in confidence after a good meal."
					},
					{
						key: "the-attendant:watchdogs",
						name: "Watchdogs",
						description: "Never surprised by attackers on foot.",
						tags: ["ward"]
					}
				]
			}
		]
	},
	{
		playbookName: "The Captain",
		// "Clothes that match your look" is narrative-only (see this file's own freeformNotes doc
		// comment) — mirrors The Scout's own "Any tier I weapons that feel appropriate" treatment
		// above. The Crew/Carrier Bonuses are modeled as their own choose-2 group below instead,
		// since they're a fixed catalog of four named options rather than freeform flavor text.
		freeformNotes: ["Clothes that match your look."],
		grantedItems: [],
		groups: [
			{
				key: "the-captain:ornate-gear",
				label: "Choose 1 Ornate Gear.",
				chooseCount: 1,
				items: [
					{
						key: "the-captain:gilded-sidearm-i",
						name: "Gilded Sidearm I",
						description: "An ornately engraved sidearm, built as much for ceremony as for combat.",
						kind: "weapon",
						tags: ["ranged", "versatile"]
					},
					{
						key: "the-captain:ruinlock-i",
						name: "Ruinlock I",
						description: "A ritually-fouled firearm that spits caustic, corroding shot.",
						kind: "weapon",
						// "reload, ruin, profane" — profane is a real EQUIPMENT_TAGS entry (see
						// equipment.js's APPROACHES.map spread), not just flavor text.
						tags: ["ranged", "reload", "ruin", "profane"]
					},
					{
						key: "the-captain:duelists-blade-i",
						name: "Duelist's Blade I",
						description: "A slender, well-balanced blade built for a fast, decisive duel.",
						kind: "weapon",
						tags: ["melee", "bane", "decisive"]
					},
					{
						key: "the-captain:arcane-mantle-i",
						name: "Arcane Mantle I",
						description: "A woven mantle humming with faint wardings, deflecting harm.",
						kind: "weapon",
						// "defensive, arcane" — arcane is a real EQUIPMENT_TAGS entry, same as profane
						// above.
						tags: ["ranged", "defensive", "arcane"]
					}
				]
			},
			{
				key: "the-captain:carrier-bonuses",
				label: "Choose 2 Crew/Carrier Bonuses.",
				chooseCount: 2,
				items: [
					{
						key: "the-captain:marine-infantry",
						name: "Marine Infantry",
						description: "They'll fight tooth and nail to defend the Carrier."
					},
					{
						key: "the-captain:civilian-quarters",
						name: "Civilian Quarters",
						description: "Can safely accommodate refugees."
					},
					{
						key: "the-captain:construct-bay",
						name: "Construct Bay",
						description: "Steed Ardents for everyone."
					},
					{
						key: "the-captain:cloaking-rituals",
						name: "Cloaking Rituals",
						description: "Can hide the Carrier from sight."
					}
				]
			}
		]
	},
	{
		playbookName: "The Artificer",
		// "1 Transport or Service Ardent II" mirrors the "1 Astir III, built on the Astir & Ardents
		// tab." phrasing convention used throughout this file — narrative-only, built via the
		// existing Astir & Ardents tab rather than a modeled equipment item. "Clothing that matches
		// your look" mirrors The Captain's own trailing freeform note above.
		freeformNotes: [
			"1 Transport or Service Ardent II, built on the Astir & Ardents tab.",
			"Clothing that matches your look."
		],
		grantedItems: [
			{
				key: "the-artificer:construct-manuals",
				name: "Construct Manuals",
				description: "Dispels uncertainties regarding construct & Astir design with advantage."
			}
		],
		groups: [
			{
				key: "the-artificer:artificer-tools",
				label: "Choose 2 Artificer Tools.",
				chooseCount: 2,
				items: [
					{
						key: "the-artificer:heavy-wrench-i",
						name: "Heavy Wrench I",
						description: "A hefty wrench, as useful for repairs as it is for a fight.",
						kind: "weapon",
						tags: ["melee", "bane", "impact"]
					},
					{
						key: "the-artificer:beam-cutter-i",
						name: "Beam Cutter I",
						description: "A focused cutting beam, meant for slicing through plating and armour.",
						kind: "weapon",
						tags: ["melee", "reload", "ruin", "decisive"]
					},
					{
						key: "the-artificer:steelfuser-i",
						name: "Steelfuser I",
						description: "A device that fires a bolt of restraining, fused metal.",
						kind: "weapon",
						// "elemental" is a real EQUIPMENT_TAGS entry (one of the APPROACHES-derived
						// tags — see equipment.js's APPROACHES.map spread), not a new catalog entry.
						tags: ["ranged", "restraining", "elemental"]
					},
					{
						key: "the-artificer:alchemical-gel-i",
						name: "Alchemical Gel I",
						description: "Advantage when cooling off to repair something.",
						kind: "gear"
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

	// buildTagReference and the per-item tagLabels annotations below are both computed off the
	// raw pool data — pool.grantedItems/pool.groups themselves are never reassigned, so the Add
	// callback's own truncation/clamping logic (which reads pool.groups directly) can't
	// accidentally resolve against a tag-labeled clone.
	const { tagGroups, hasTags } = buildTagReference([...pool.grantedItems, ...pool.groups.flatMap((group) => group.items)]);
	const content = await renderTemplate(STARTING_GEAR_PICKER_TEMPLATE, {
		grantedItems: pool.grantedItems.map((item) => withTagLabels(item)),
		groups: pool.groups.map((group) => ({ ...group, items: group.items.map((item) => withTagLabels(item)) })),
		freeformNotes: pool.freeformNotes ?? [],
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Starting Gear",
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring (equipment.js).
			render: wirePickerTabs,
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
		}, {
			classes: ["armor-astir", "starting-gear-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}
