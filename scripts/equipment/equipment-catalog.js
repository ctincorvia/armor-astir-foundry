// Reusable equipment templates, distinct from EQUIPMENT_TAGS (equipment-tags.js — which catalogs
// Tags, not whole items). Picking one is a snapshot, not a reference — see configureEquipment's
// caller in PlaybookActorSheet#_onEquipmentCatalogAdd — so there's no key stored on the resulting
// entry and no "diverged from catalog" state to track. Shape matches configureEquipment's `initial`
// param exactly (minus `id`), so a picked item can be passed straight through unmodified. Grows one
// item at a time as rulebook equipment is transcribed, same restraint as EQUIPMENT_TAGS and
// MOVE_POOLS. Keys carry a tier suffix (`-i`) since the rulebook's own weapon/gear lists are
// organized by tier and higher-tier versions of the same name are expected to follow later.
//
// These are the rulebook's generic, not-Astir-exclusive Tier I weapons and gear — usable by any
// character, unlike Astir-specific loadout (see astir.js).
export const EQUIPMENT_CATALOG = [
	{
		key: "infantry-weapon-i",
		name: "Infantry Weapon",
		kind: "weapon",
		description: "Simple, sturdy weapons like blades and clubs.",
		tags: ["melee"],
		scale: "foot"
	},
	{
		key: "dagger-i",
		name: "Dagger",
		kind: "weapon",
		description: "A concealable dagger, easily worn beneath clothing and thrown if needed.",
		tags: ["melee", "intimate", "concealable"],
		scale: "foot"
	},
	{
		key: "greatsword-i",
		name: "Greatsword",
		kind: "weapon",
		description: "A large weapon, with good reach and weight, perfect for taking heads. Praxis.",
		tags: ["melee", "area", "two-handed"],
		scale: "foot"
	},
	{
		key: "armourbane-i",
		name: "Armourbane",
		kind: "weapon",
		description: "A thin, pretty blade, good for slipping between armour plates.",
		tags: ["melee", "fragile", "decisive"],
		scale: "foot"
	},
	{
		key: "enchanted-blade-i",
		name: "Enchanted Blade",
		kind: "weapon",
		description: "What was once simple steel now carries the unmistakable sheen of ritual.",
		tags: ["melee", "distinct", "bane"],
		scale: "foot"
	},
	{
		key: "partisan-i",
		name: "Partisan",
		kind: "weapon",
		description: "A long spear, perfect for keeping your friends safe and your enemies at a very specific " +
			"distance, as the saying goes.",
		tags: ["melee", "defensive", "two-handed"],
		scale: "foot"
	},
	{
		key: "bow-i",
		name: "Bow",
		kind: "weapon",
		description: "For when you don't need anything fancy, a bow is perfectly capable of doing the job for " +
			"as long as you have arrows.",
		tags: ["ranged", "decisive", "two-handed"],
		scale: "foot"
	},
	{
		key: "sidearm-i",
		name: "Sidearm",
		kind: "weapon",
		description: "The typical protections afforded to Astir pilots: a reliable tool capable of firing " +
			"bursts of light arcane energy.",
		tags: ["ranged", "defensive", "weak"],
		scale: "foot"
	},
	{
		key: "raypistol-i",
		name: "Raypistol",
		kind: "weapon",
		description: "A powerful but short-lived firebolt wand, fitted with a comfortable grip.",
		tags: ["ranged", "limited", "bane"],
		scale: "foot"
	},
	{
		key: "boltrifle-i",
		name: "Boltrifle",
		kind: "weapon",
		description: "Effectively repeating crossbows fed by lightweight 'barrels' of ammunition, bolt rifles " +
			"are a common sight among troops of any real armed force.",
		tags: ["ranged", "blitz", "two-handed"],
		scale: "foot"
	},
	{
		key: "rayrifle-i",
		name: "Rayrifle",
		kind: "weapon",
		description: "A heavy rifle, often using magical crystals or wands as charge for a single shot. Their " +
			"bulk, heavy recoil and cost makes them highly uncommon, but not overly so: after all, little " +
			"else hand-held will put a hole through an Astir.",
		tags: ["sniper", "reload", "ruin", "two-handed"],
		scale: "foot"
	},
	{
		key: "ashstaff-i",
		name: "Ashstaff",
		kind: "weapon",
		description: "A large, shoulder-carried staff charged with incendiary magic. A little lighter and " +
			"easier to use than a rayrifle, but still fairly bulky and lacking in the ability to pierce the " +
			"protective wards of Astirs.",
		// 4 regular tags (area, bane, unreliable, two-handed) despite being Tier I — this is what
		// pushed MAX_TAGS from 3 to 4 (see its doc comment).
		tags: ["ranged", "area", "bane", "unreliable", "two-handed"],
		scale: "foot"
	},
	{
		key: "luxury-gift-i",
		name: "Luxury Gift I",
		kind: "gear",
		description: "For good first impressions, making up for bad ones, or just plain bribery.",
		tags: []
	},
	{
		key: "farspeech-stone-i",
		name: "Farspeech Stone I",
		kind: "gear",
		description: "Stones of Farspeech allow you to communicate over great distances with the holder of a " +
			"linked stone. Most are enchanted to be linked only to one other stone, but more expensive " +
			"versions can be linked to as many as the owner requires.",
		tags: []
	},
	{
		key: "construct-sensor-i",
		name: "Construct Sensor I",
		kind: "gear",
		description: "Circular tables with a surface constructed of an array of enchanted steel pins. The pins " +
			"independently slide up and down when unregistered Constructs are detected in a certain radius, " +
			"creating a rough three-dimensional relief of oncoming forces. The height of raised pins " +
			"correspond to the size of a detected constructs, and larger tables with denser arrays allow for " +
			"more precise reliefs.",
		tags: []
	},
	{
		key: "latch-i",
		name: "Latch I",
		kind: "gear",
		description: "Basically handles enchanted to lock into place when pushed against something magical, " +
			"Latches are typically used by ground forces to hitch a ride on constructs that don't have room " +
			"for them to ride inside of. Also available as a pair of weaker Latches, built into a glove and " +
			"boot, so that the wearer may simply hold a hand and foot against a construct to attach to it.",
		tags: []
	},
	{
		key: "grappling-hook-i",
		name: "Grappling Hook I",
		kind: "gear",
		description: "Allows you to climb or grapple. A small sturdy grip attached to a barrel loaded with an " +
			"steel hook, which is propelled by forceful magic. An attached cord can then be reeled in, " +
			"allowing the holder to quickly relocate.",
		tags: []
	},
	{
		key: "invisibility-cloak-i",
		name: "Invisibility Cloak I",
		kind: "gear",
		description: "Lets you be invisible. Generally speaking, doing just about anything is cooler whilst " +
			"invisible.",
		tags: ["fragile", "valuable"]
	},
	{
		key: "arcane-charge-i",
		name: "Arcane Charge I",
		kind: "gear",
		description: "A destructive spell delayed by a wax timer. Stick it on an Astir, light the wick, and run " +
			"for your life.",
		tags: ["ruin", "one-use"]
	},
	{
		key: "saber-sidearm-i",
		name: "Saber & Sidearm",
		kind: "weapon",
		description: "The standard-issue pairing carried by Ardent crews: a reliable sidearm backed up by a " +
			"blade for when the fight closes in.",
		tags: ["ranged", "versatile"],
		scale: "foot"
	},
	{
		key: "clothes-i",
		name: "Clothes",
		kind: "gear",
		description: "Clothes that match your look.",
		tags: []
	}
];
