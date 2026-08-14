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
		key: "clothes-i",
		name: "Clothes",
		kind: "gear",
		description: "Clothes that match your look.",
		tags: []
	},
	{
		key: "bloodletter-i",
		name: "Bloodletter",
		kind: "weapon",
		description: "The rank-and-file of the Faces Of Progress carry these sinister spears, mundane in " +
			"nature but by design capable of drawing the blood of their victims. Those not of the " +
			"rank-and-file, it turns out, have an unquenchable thirst.",
		tags: ["melee", "distinct", "defensive"],
		scale: "foot"
	},
	{
		key: "ashmaker-bow-i",
		name: "Ashmaker Bow",
		kind: "weapon",
		description: "Ashmakers were just a theory until the invasion began: one the New Hunt have taken " +
			"pleasure in putting into practice. Immensely dangerous alchemical arrows paired with a bow " +
			"ritually treated with the protections needed to withstand them, Ashmakers are the prized " +
			"possession of any resistance cell.",
		tags: ["ranged", "ruin", "decisive", "dangerous", "two-handed"],
		scale: "foot"
	},
	{
		key: "little-shark-ii",
		name: "Little Shark",
		kind: "weapon",
		description: "When the first mariner's ardent team was dispatched to interfere with Progress " +
			"reinforcements, they found their equipment lacking for undersea use. Dubbed Little Sharks, " +
			"these ardent-fit wands stacked with short-range frost magic provided an easy way of ruining " +
			"ship hulls. Descriptive tags: Freezing.",
		tags: ["melee", "intimate"],
		scale: "astir"
	},
	{
		key: "decanting-staff-iii",
		name: "Decanting Staff",
		kind: "weapon",
		description: "A long staff, held in both hands of an Astir. A series of alchemical processes " +
			"purify and extract magical energy from stolen blood, before turning it to violent ends.",
		tags: ["ranged", "bane", "two-handed"],
		scale: "astir"
	},
	{
		key: "hewer-iii",
		name: "Hewer",
		kind: "weapon",
		description: "A circular saw, spun at lightning speeds by the volatile reaction between distilled " +
			"alchemical fire and permafrost from the deep heart of Repose.",
		tags: ["melee", "bane", "drain-1"],
		scale: "astir"
	},
	{
		key: "simplified-codex-i",
		name: "Simplified Codex",
		kind: "weapon",
		description: "Most arcane codices are useless in mundane hands. Thankfully, this edition has been " +
			"heavily edited and simplified to allow even total novices to cast a few basic destructive " +
			"spells.",
		tags: ["ranged", "dangerous", "arcane", "bane"],
		scale: "foot"
	},
	{
		key: "colour-spray-i",
		name: "Colour Spray",
		kind: "weapon",
		description: "A staple of any academy prankster: small glass bottles, full of enchanted water that " +
			"dyes any surface it touches an illusory colour. It wears off… after a few days.",
		tags: ["ranged", "area", "weak"],
		scale: "foot"
	},
	{
		key: "cannon-ii",
		name: "Cannon",
		kind: "weapon",
		description: "Most have little interest in non-magical weaponry, especially given the prestige of " +
			"the Academy. That said, the cannoneers of the west have steadily been making a name for " +
			"themselves in recent years.",
		tags: ["sniper", "huge", "vorpal"],
		scale: "astir"
	},
	{
		key: "colossus-repeater-iii",
		name: "Colossus Repeater",
		kind: "weapon",
		description: "Using the same mechanism as a common crossbow, Colossus Repeaters are designed to " +
			"fire magically-charged bolts for maximum armour penetration. In a pinch, a talented Channeler " +
			"can work the reloading mechanism quickly enough for multiple follow-up shots.",
		tags: ["ranged", "blitz", "impact", "two-handed", "drain-1"],
		scale: "astir"
	},
	{
		key: "contact-runes-iii",
		name: "Contact Runes",
		kind: "weapon",
		description: "Heavily charged magical runes engraved on an Astir's hands and arms make for " +
			"volatile, if difficult to use, close-combat weaponry.",
		tags: ["melee", "reload", "unreliable", "ruin"],
		scale: "astir"
	},
	{
		key: "wayward-skull-i",
		name: "Wayward Skull",
		kind: "gear",
		description: "Skulls are easier to find than ever on the Moon, and are often a great source of " +
			"information and advice. Befriend one, and all the newest rumours will find your ear. " +
			"Descriptive tags: Sturdy, Whispering, Autonomous.",
		tags: []
	},
	{
		key: "projection-vat-ii",
		name: "Projection Vat",
		kind: "gear",
		description: "Much of the Moon's surface is unsafe for people to be on. To sidestep this issue, " +
			"people sometimes dip themselves in sense-depriving projection vats to astrally project " +
			"themselves across moderate distances. Descriptive tags: Enormous, Sealed.",
		tags: ["set-up", "huge"]
	},
	{
		key: "bestiary-array-ii",
		name: "Bestiary Array",
		kind: "weapon",
		description: "A popular weapon among the Living Dead, the Bestiary Array projects words of power " +
			"into acrid smoky shapes of beasts, hard to catch and irritatingly effective at unravelling " +
			"Astir enchantments.",
		tags: ["ranged", "bane", "versatile", "messy", "dangerous"],
		scale: "astir"
	},
	// gearOnly Ward on a weapon: grandfathered exception granted directly through data, same as
	// the-icon:bodyguards-i in starting-gear-pools.js (see equipment-tags.js's Ward comment).
	{
		key: "strange-shield-iii",
		name: "Strange-Shield",
		kind: "weapon",
		description: "A luminous, semi-permeable cage surrounds this piece of cursed matter, acting as a " +
			"shield for the Astir that would hold it. Indiscriminately devouring and compacting any matter " +
			"and most energy caught within, they are a tool best used with great care.",
		tags: ["melee", "defensive", "ward", "infinite", "dangerous", "two-handed"],
		scale: "astir"
	},
	{
		key: "paracausal-hook-iii",
		name: "Paracausal Hook",
		kind: "weapon",
		description: "Devised as a latch for hyperlight applications, the paracausal hook, if carefully " +
			"aimed, also turned out to be remarkably effective at twisting physical matter in a way that " +
			"displaces it into undiscovered dimensions, and vice versa. Stand well back.",
		tags: ["melee", "ruin", "decisive", "messy", "drain-2"],
		scale: "astir"
	}
];
