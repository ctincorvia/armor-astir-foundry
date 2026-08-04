import { APPROACHES } from "./approaches.js";

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

// Applies to every equipment entry (weapon or gear). Melee/Ranged/Sniper never count against this
// cap — they're a classifier, not a regular tag pick — but that's now structural rather than
// something this cap has to account for: WEAPON_RANGE_GROUP tags are never rendered as checkboxes
// at all (see WEAPON_RANGE_GROUP's own doc comment), so they can never appear among the checked
// tag keys this cap counts. Enforced only at Save, same as the blank-name and weapon-range checks
// in configureEquipment. Flat across every tier (not scaled by TIER_MIN/TIER_MAX) — Ashstaff I in
// EQUIPMENT_CATALOG needs 4 regular tags despite being Tier I, which is what pushed this cap to 4.
export const MAX_TAGS = 4;

export const TIER_MIN = 1;
export const TIER_MAX = 5;

export const EQUIPMENT_EDITOR_TEMPLATE = "modules/armor-astir/templates/equipment-editor.hbs";
export const EQUIPMENT_CATALOG_PICKER_TEMPLATE = "modules/armor-astir/templates/equipment-catalog-picker.hbs";
export const WEAPON_PICKER_TEMPLATE = "modules/armor-astir/templates/weapon-picker.hbs";

// Sentinel for "fighting unarmed" — a real, always-offered choice (see chooseWeapon below),
// distinct from the dialog being dismissed (which resolves null, same as every other picker in
// this module). The value here must match the hardcoded radio value in weapon-picker.hbs — a
// template can't reference this constant directly.
export const UNARMED = "unarmed";

// Weapons are either sized for an Astir or for the person wielding one — purely descriptive
// (see claude.md, "Domain conventions"): Astirs aren't their own documents yet, so nothing
// enforces who may wield which scale, the same deliberate non-enforcement as move pool
// membership in playbook-moves.js.
export const WEAPON_SCALES = [
	{ key: "foot", label: "Foot Scale", note: "Wielded by people." },
	{ key: "astir", label: "Astir Scale", note: "Wielded by Astirs." }
];

// The tag catalog: definitions live in code and equipment stores only tag keys, so edited rules
// text reaches existing equipment — the same split MOVE_POOLS uses for playbook moves (see
// playbook-moves.js). `value` mirrors the rulebook's own -2/-1/+1/+2 grouping and must stay
// within TAG_VALUE_MIN/MAX; where a tag's own text (Treasure, Valuable) separately claims to
// change "value" by a different number, that's the rulebook's narrative/monetary sense of the
// word, not this field or equipmentValue — this module has no separate economy/appraisal system,
// so it's left as flavor in the description rather than wired to anything.
//
// `spend` makes a tag show a manual "used" checkbox on the Equipment tab (see
// PlaybookActorSheet#_equipmentEntry / _onEquipmentTagSpentToggle). Only when it also carries an
// `effect` (matching a real EFFECT_STATES key — roll-effects.js) does it additionally get offered
// as a roll-dialog checkbox (see moves.js#configureMoveRoll, PlaybookActorSheet#_equipmentSpends)
// — a spend with no `effect` (Ward, Vorpal, One-Use, Refresh, Dangerous) only ever tracks "has
// this been used this period", since its effect (softening a Danger, capping uses) happens
// outside of any one roll and isn't something to offer mid-dialog.
//
// `forcesEffect` (Unreliable) is the inverse of `spend`: not opt-in, automatically locks a roll's
// Effect the first time a weapon carrying it is used each period (see
// PlaybookActorSheet#_rollMove, mirroring bite-the-dust's forcesDesperationAtMaxPerils).
//
// `reroll` (Decisive, Defensive, Versatile) lists which move key(s) it can reroll a failure on,
// once per period (see PlaybookActorSheet's reroll chat-button handling). `guided` (Guided) is
// the "skip rolling, take a 7-9" option, offered for any usesWeapon move.
//
// `exclusiveGroup` marks a tag as belonging to a mutually-exclusive set. DRAIN_GROUP renders as
// checkboxes with JS-enforced radio-button behavior — configureEquipment's render wiring unchecks
// every other tag sharing the same `exclusiveGroup` the moment one is checked, resolved off the
// `tags` array already in scope rather than new template data attributes. WEAPON_RANGE_GROUP
// (Melee/Ranged/Sniper, all `value: 0` — a pure classifier, not a Value modifier) instead renders
// as its own native radio group, since — unlike Drain — a weapon must always have exactly one:
// a checkbox trio validated only at Save time meant a player who forgot to check one got a warning
// toast after the dialog had already closed, discarding everything else they'd entered (Foundry's
// Dialog always closes after a button callback runs, regardless of what the callback does). A
// native radio group with a default selected (see configureEquipment) can't end up with nothing
// checked through normal use, so configureEquipment's Save-time weapon-range check is now a
// defensive fallback rather than the primary safeguard. That's still a single hardcoded
// weapon-only check, not a generic "required groups" system, since it's the only group that needs
// one.
export const EQUIPMENT_TAGS = [
	// -3: Drain 3, the most severe Drain tier — see the Drain 1/2/3 trio below (-1 and -2 bands)
	// for the shared exclusiveGroup/MAX_TAGS explanation. No other tag currently needs this band.
	{
		key: "drain-3",
		label: "Drain 3",
		value: -3,
		exclusiveGroup: DRAIN_GROUP,
		// "Reduces Power by N while equipped" is wired for real, but only for a weapon actually
		// mounted on an Astir (kind: "weapon", astir: true — see astir.js#astirWeaponDrainTotal/
		// astirMaxPower). configureEquipment only offers Drain's checkboxes on the astirWeapon
		// flow (see DRAIN_GROUP's doc comment above) — gear and mundane (Foot-scale) weapons can
		// never pick it up in the first place.
		description: "This object draws excessive power from an Astir, and reduces the Astir's Power by 3 " +
			"while equipped."
	},
	// -2: heavy drawbacks that largely restrict an object's usefulness or availability.
	{
		key: "drain-2",
		label: "Drain 2",
		value: -2,
		exclusiveGroup: DRAIN_GROUP,
		description: "This object draws excessive power from an Astir, and reduces the Astir's Power by 2 " +
			"while equipped."
	},
	{
		key: "cursed",
		label: "Cursed",
		value: -2,
		// Equip-exclusivity ("cannot wield anything else") and a death consequence aren't systems
		// this module models (Astirs aren't their own documents yet — see claude.md); left as
		// prose, same treatment as weapon profiles under "Systems that do not exist yet".
		description: "You cannot wield anything else once you raise a cursed weapon, and it becomes bound to " +
			"you until the curse is broken. When you die it will consume your essence, probably."
	},
	{
		key: "dangerous",
		label: "Dangerous",
		value: -2,
		description: "Once per Sortie, the director may upgrade a risk you acquire while using this to a peril.",
		spend: { period: "Sortie" }
	},
	{
		key: "dreaded",
		label: "Dreaded",
		value: -2,
		description: "This weapon has a history and a reputation that stains it, and stains you as long as " +
			"you're carrying it. People will treat you with fear and apprehension."
	},
	{
		key: "huge",
		label: "Huge",
		value: -2,
		description: "Basically impossible to move around without help. Absolutely not something you are " +
			"ever going to hide, either."
	},
	{
		key: "junk",
		label: "Junk",
		value: -2,
		// "Remove with a 6-step long-term project" references a project-tracking system this
		// module doesn't have; left as prose.
		description: "In such a terrible condition it cannot be used. You may remove this tag with a 6-step " +
			"long-term project."
	},
	{
		key: "one-use",
		label: "One-Use",
		value: -2,
		description: "Can only be used a single time per Sortie—perhaps it needs time to recharge, or uses " +
			"rare ammo, or explodes.",
		spend: { period: "Sortie" }
	},
	{
		key: "treasure",
		label: "Treasure",
		value: -2,
		description: "Highly valuable—and a gold, glittering target on your back. Said to increase an item's " +
			"appraised value by 4, though this module has no separate economy to reflect that in."
	},
	// -1: almost entirely negative tags.
	{
		key: "two-handed",
		label: "2H",
		value: -1,
		description: "Takes both hands to use properly, though not necessarily just to carry."
	},
	{
		key: "bulky",
		label: "Bulky",
		value: -1,
		description: "Large (relative to tier) and difficult or awkward to move around."
	},
	{
		key: "drain-1",
		label: "Drain 1",
		value: -1,
		exclusiveGroup: DRAIN_GROUP,
		description: "This object draws excessive power from an Astir, and reduces the Astir's Power by 1 " +
			"while equipped."
	},
	{
		key: "distinct",
		label: "Distinct",
		value: -1,
		description: "Impressive, loud, or just particularly memorable, distinct equipment is hard to be " +
			"subtle with. Might make you easy to track or follow, or ruin your attempts at stealth."
	},
	{
		key: "slow",
		label: "Slow",
		value: -1,
		description: "There is a delay involved in this object's use, like the travel time of a projectile, " +
			"or the low speed of a construct. Might, for example, impose disadvantage where speed matters."
	},
	{
		key: "limited",
		label: "Limited",
		value: -1,
		description: "You have a particularly limited supply or use of this thing—it always seems to run out " +
			"at the most perilous moments."
	},
	{
		key: "messy",
		label: "Messy",
		value: -1,
		description: "Something messy is imprecise (or indiscriminate), and could have excessive (or " +
			"intimidating), unwanted results."
	},
	{
		key: "intimate",
		label: "Intimate",
		value: -1,
		description: "Requires you to get up close and personal, making it hard to use against anyone " +
			"wielding something with better reach—or anyone just trying to keep their distance."
	},
	{
		key: "fragile",
		label: "Fragile",
		value: -1,
		description: "Easily broken, either by shoddy design or frail materials."
	},
	{
		key: "forbidden",
		label: "Forbidden",
		value: -1,
		description: "Forbidden objects are banned by the Authority, and possession of them or suspicion of " +
			"such carries a heavy price."
	},
	{
		key: "set-up",
		label: "Set-Up",
		value: -1,
		description: "Make moves using this item at disadvantage unless you spend time to prepare or arm it " +
			"in some way. In battle this might only be a few moments, but it can make all the difference."
	},
	{
		key: "reload",
		label: "Reload",
		value: -1,
		description: "After firing, this weapon requires you to manually reload it or perform some other " +
			"action to ready it for use."
	},
	{
		key: "unreliable",
		label: "Unreliable",
		value: -1,
		description: "This object is prone to failure and breakdowns—make your first move with it each Scene " +
			"in desperation.",
		forcesEffect: { period: "Scene", effect: "desperation" }
	},
	{
		key: "weak",
		label: "Weak",
		value: -1,
		description: "Lacking in physical impact, and generally useless for piercing armour or cover."
	},
	{
		key: "valuable",
		label: "Valuable",
		value: -1,
		description: "Expensive to acquire, and fairly sought-after. Said to increase an item's appraised " +
			"value by 2, though this module has no separate economy to reflect that in."
	},
	// 0: purely descriptive weapon-range classification, mutually exclusive with one another and
	// required on every weapon (see WEAPON_RANGE_GROUP and the exclusiveGroup doc above).
	{
		key: "melee",
		label: "Melee",
		value: 0,
		description: "This weapon is used up close, in melee range.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	{
		key: "ranged",
		label: "Ranged",
		value: 0,
		description: "This weapon strikes from a distance, well outside of melee range.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	{
		key: "sniper",
		label: "Sniper",
		value: 0,
		description: "This weapon excels at very long range, precision attacks over anything closer.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	// +1: strong beneficial effects.
	{
		key: "adapted",
		label: "Adapted",
		value: 1,
		description: "This object has been modified or designed to let it overcome the difficulties of " +
			"certain environments—it might be an amphibious Astir with an air supply, an Ardent designed to " +
			"keep its occupants cool in searing-hot terrains, etc."
	},
	// Arcane/Divine/Elemental/Mundane/Profane mirror APPROACHES (approaches.js) one-for-one, so
	// their labels can't drift from the sheet's own Approach dropdown. "Changes your approach
	// while actively using it" isn't auto-applied — system.attributes.approach is a single
	// persistent field with no "actively equipped" state to hang a temporary override off, so
	// this stays descriptive.
	...APPROACHES.map((approach) => ({
		key: approach.key,
		label: approach.label,
		value: 1,
		description: `This tag changes your approach to ${approach.label} while you're actively using it.`
	})),
	{
		key: "area",
		label: "Area",
		value: 1,
		description: "This weapon affects a large area: while any melee weapon might hit multiple people " +
			"stood right next to each other, an area weapon might slice through an entire crowd or several " +
			"spread-out foes."
	},
	{
		key: "bane",
		label: "Bane",
		value: 1,
		// References an NPC/enemy tier-opposition system this module doesn't model yet (no NPC
		// documents — see claude.md); left as prose.
		description: "You suffer no penalty against opponents one tier above you when attacking with bane."
	},
	{
		key: "blitz",
		label: "Blitz",
		value: 1,
		description: "You may spend this tag once per Scene to make a move with confidence.",
		spend: { period: "Scene", effect: "confidence" }
	},
	{
		key: "concealable",
		label: "Concealable",
		value: 1,
		description: "Easily hidden—a casual inspection will rarely if ever find it."
	},
	{
		key: "decisive",
		label: "Decisive",
		value: 1,
		description: "Decisive weaponry is precise and powerful, excellent for ending fights. Once per " +
			"Scene, you may reroll a failed strike decisively when using it.",
		reroll: { moves: ["strike-decisively"], period: "Scene" }
	},
	{
		key: "defensive",
		label: "Defensive",
		value: 1,
		description: "Defensive weaponry is excellent for keeping foes at a distance, parrying their blows, " +
			"or suppressing them. Once per Scene, you may reroll a failed exchange blows when using it.",
		reroll: { moves: ["exchange-blows"], period: "Scene" }
	},
	{
		key: "guided",
		label: "Guided",
		value: 1,
		description: "This weapon has guided strikes or projectiles, allowing you to take a 7-9 result when " +
			"you exchange blows and strike decisively rather than rolling if you wish. Guided projectiles " +
			"are reliable, but leave little room for finesse.",
		guided: true
	},
	{
		key: "impact",
		label: "Impact",
		value: 1,
		description: "This weapon packs a heavy physical punch, capable of knocking foes down or away " +
			"easily, and will dent or break through surfaces."
	},
	{
		key: "infinite",
		label: "Infinite",
		value: 1,
		description: "This thing either doesn't use ammo or power to function, or uses such small amounts " +
			"relative to your supply that it is practically endless. You're never in danger of running out " +
			"as a result of a roll."
	},
	{
		key: "mounted",
		label: "Mounted",
		value: 1,
		description: "This weapon is mounted or worn in some way that frees up the hands of the user for " +
			"other tasks. As a result, it's also difficult to disarm a target of without breaking it."
	},
	{
		key: "restraining",
		label: "Restraining",
		value: 1,
		description: "Can restrict or slow targets down in some way, making it hard for them to escape or " +
			"move without expending a lot of effort."
	},
	{
		key: "refresh",
		label: "Refresh",
		value: 1,
		description: "Objects that refresh can only be used once per Scene, but automatically replenish or " +
			"restore themselves even if they are destroyed or wasted (they cannot be taken away from you by " +
			"a peril).",
		spend: { period: "Scene" }
	},
	{
		key: "ward",
		label: "Ward",
		value: 1,
		description: "You may use this tag once per Sortie to reduce an incoming source of harm from a peril " +
			"to a risk, or from a risk to nothing.",
		spend: { period: "Sortie" }
	},
	// +2: uncommon, strong effects.
	{
		key: "ruin",
		label: "Ruin",
		value: 2,
		// Same not-yet-modeled tier-opposition system as Bane; left as prose.
		description: "You suffer no penalty against opponents up to two tiers above you when attacking " +
			"with ruin, rather than one tier as with bane."
	},
	{
		key: "versatile",
		label: "Versatile",
		value: 2,
		description: "This tag combines the effects of decisive and defensive.",
		reroll: { moves: ["exchange-blows", "strike-decisively"], period: "Scene" }
	},
	{
		key: "vorpal",
		label: "Vorpal",
		value: 2,
		description: "Vorpal weaponry is exceedingly lethal: you may use this tag once per Sortie to upgrade " +
			"a risk you'd inflict to a peril instead.",
		spend: { period: "Sortie" }
	}
];

// Reusable equipment templates, distinct from EQUIPMENT_TAGS above (which catalogs Tags, not
// whole items). Picking one is a snapshot, not a reference — see configureEquipment's caller in
// PlaybookActorSheet#_onEquipmentCatalogAdd — so there's no key stored on the resulting entry and
// no "diverged from catalog" state to track. Shape matches configureEquipment's `initial` param
// exactly (minus `id`), so a picked item can be passed straight through unmodified. Grows one
// item at a time as rulebook equipment is transcribed, same restraint as EQUIPMENT_TAGS and
// MOVE_POOLS. Keys carry a tier suffix (`-i`) since the rulebook's own weapon/gear lists are
// organized by tier and higher-tier versions of the same name are expected to follow later.
//
// These are the rulebook's generic, not-Astir-exclusive Tier I weapons and gear — usable by any
// character, unlike Astir-specific loadout (see astir.js).
export const EQUIPMENT_CATALOG = [
	{
		key: "infantry-weapon-i",
		name: "Infantry Weapon I",
		kind: "weapon",
		description: "Simple, sturdy weapons like blades and clubs.",
		tags: ["melee"],
		scale: "foot"
	},
	{
		key: "dagger-i",
		name: "Dagger I",
		kind: "weapon",
		description: "A concealable dagger, easily worn beneath clothing and thrown if needed.",
		tags: ["melee", "intimate", "concealable"],
		scale: "foot"
	},
	{
		key: "greatsword-i",
		name: "Greatsword I",
		kind: "weapon",
		description: "A large weapon, with good reach and weight, perfect for taking heads. Praxis.",
		tags: ["melee", "area", "two-handed"],
		scale: "foot"
	},
	{
		key: "armourbane-i",
		name: "Armourbane I",
		kind: "weapon",
		description: "A thin, pretty blade, good for slipping between armour plates.",
		tags: ["melee", "fragile", "decisive"],
		scale: "foot"
	},
	{
		key: "enchanted-blade-i",
		name: "Enchanted Blade I",
		kind: "weapon",
		description: "What was once simple steel now carries the unmistakable sheen of ritual.",
		tags: ["melee", "distinct", "bane"],
		scale: "foot"
	},
	{
		key: "partisan-i",
		name: "Partisan I",
		kind: "weapon",
		description: "A long spear, perfect for keeping your friends safe and your enemies at a very specific " +
			"distance, as the saying goes.",
		tags: ["melee", "defensive", "two-handed"],
		scale: "foot"
	},
	{
		key: "bow-i",
		name: "Bow I",
		kind: "weapon",
		description: "For when you don't need anything fancy, a bow is perfectly capable of doing the job for " +
			"as long as you have arrows.",
		tags: ["ranged", "decisive", "two-handed"],
		scale: "foot"
	},
	{
		key: "sidearm-i",
		name: "Sidearm I",
		kind: "weapon",
		description: "The typical protections afforded to Astir pilots: a reliable tool capable of firing " +
			"bursts of light arcane energy.",
		tags: ["ranged", "defensive", "weak"],
		scale: "foot"
	},
	{
		key: "raypistol-i",
		name: "Raypistol I",
		kind: "weapon",
		description: "A powerful but short-lived firebolt wand, fitted with a comfortable grip.",
		tags: ["ranged", "limited", "bane"],
		scale: "foot"
	},
	{
		key: "boltrifle-i",
		name: "Boltrifle I",
		kind: "weapon",
		description: "Effectively repeating crossbows fed by lightweight 'barrels' of ammunition, bolt rifles " +
			"are a common sight among troops of any real armed force.",
		tags: ["ranged", "blitz", "two-handed"],
		scale: "foot"
	},
	{
		key: "rayrifle-i",
		name: "Rayrifle I",
		kind: "weapon",
		description: "A heavy rifle, often using magical crystals or wands as charge for a single shot. Their " +
			"bulk, heavy recoil and cost makes them highly uncommon, but not overly so: after all, little " +
			"else hand-held will put a hole through an Astir.",
		tags: ["sniper", "reload", "ruin", "two-handed"],
		scale: "foot"
	},
	{
		key: "ashstaff-i",
		name: "Ashstaff I",
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
		key: "baneblade-ii",
		name: "Baneblade II",
		kind: "weapon",
		description: "Most Astir pilots do not concern themselves with the scrambling of foot-soldiers. Some of " +
			"these pilots meet very unexpected ends. Also seen as a Blowtorch, Enchanted Broadsword, or Bolt " +
			"Gauntlets.",
		tags: ["melee", "bane", "two-handed"],
		scale: "foot"
	},
	{
		key: "warp-slinger-ii",
		name: "Warp-Slinger II",
		kind: "weapon",
		description: "An emplaced device incorporating multiple wands linked to a simple firing ritual that can " +
			"be triggered by even those not gifted with magic. Also seen as an MG Turret, Point Laser, or " +
			"Multi-Crossbow.",
		tags: ["ranged", "blitz", "infinite", "huge"],
		scale: "foot"
	},
	{
		key: "ardent-rifle-ii",
		name: "Ardent Rifle II",
		kind: "weapon",
		description: "A large two-handed tool that fires searing bolts of light, capable of burning through " +
			"even an Astir's defences. Typically used by ardents, due to its weight. Also seen as an " +
			"Arbalest, Flame Staff, or Greatbow.",
		tags: ["ranged", "bane", "two-handed"],
		scale: "foot"
	},
	{
		key: "seeker-cluster-ii",
		name: "Seeker Cluster II",
		kind: "weapon",
		description: "Guided by a faint magical intelligence, this device lets loose a swarm of small magical " +
			"crystals to hound a particular target. Though they struggle to pierce armour, these crystals " +
			"shatter on impact, resulting in sharp shrapnel. Also seen as Orbiting Motes, a Shock Rod, or " +
			"Command Bracelets & Drone.",
		tags: ["ranged", "guided", "defensive", "reload", "messy"],
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
		name: "Saber & Sidearm I",
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

export function findCatalogEquipment(key, catalog = EQUIPMENT_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

// Opens the "+ Pick ... from Catalog" picker for one kind and resolves the chosen template, or
// null if dismissed or nothing was selected. Mirrors choosePlaybookMove's promise/Dialog/
// resolve-null shape (playbook-moves.js). Filtering by kind here, rather than in the template,
// keeps the Weapons and Gear buttons wired to the same function with a one-argument difference.
export async function chooseEquipmentCatalogItem(kind, catalog = EQUIPMENT_CATALOG) {
	const items = catalog.filter((item) => item.kind === kind);
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, { items });

	return new Promise((resolve) => {
		new Dialog({
			title: kind === "weapon" ? "Pick a Weapon" : "Pick Gear",
			content,
			buttons: {
				add: {
					label: "Add",
					// No radio checked (including when the catalog is empty for this kind) leaves
					// .val() undefined, so findCatalogEquipment resolves null — same "nothing
					// selected reads as cancel" contract choosePlaybookMove uses.
					callback: (html) => resolve(findCatalogEquipment(html.find("[name='catalog-item']:checked").val(), catalog))
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-catalog-picker"] }).render(true);
	});
}

export function findEquipmentTag(key, tags = EQUIPMENT_TAGS) {
	return tags.find((tag) => tag.key === key) ?? null;
}

// Resolves an equipment entry's stored tag keys to tag definitions, dropping any that no longer
// exist — a key can outlive its tag whenever the catalog is edited, and a stale entry should
// quietly disappear rather than break rendering (mirrors resolvePlaybookMoves).
export function resolveEquipmentTags(keys = [], tags = EQUIPMENT_TAGS) {
	return keys.map((key) => findEquipmentTag(key, tags)).filter(Boolean);
}

// An equipment entry's overall Value is always the sum of its current tags, derived on read
// rather than stored — same as advancements.topCount in playbook-actor-sheet.js#getData — so it
// can never drift out of sync with the tags actually on the entry.
export function equipmentValue(keys = [], tags = EQUIPMENT_TAGS) {
	return resolveEquipmentTags(keys, tags).reduce((sum, tag) => sum + tag.value, 0);
}

const TAG_VALUE_GROUPS = [
	{ value: -3, label: "Severe Drawbacks (-3)" },
	{ value: -2, label: "Heavy Drawbacks (-2)" },
	{ value: -1, label: "Minor Drawbacks (-1)" },
	{ value: 0, label: "No Effect (0)" },
	{ value: 1, label: "Strong Benefits (+1)" },
	{ value: 2, label: "Rare Benefits (+2)" }
];

// Groups a tag list (either the raw catalog or configureEquipment's checked-annotated shape) by
// its own value banding — see EQUIPMENT_TAGS' -2/-1/+1/+2 comment groups above — rather than a
// second, hand-maintained category scheme, so the editor's groups can never drift out of sync with
// what a tag is actually worth. A group with nothing in it (e.g. a fixture catalog with no -2
// entries) is dropped, same "don't render an empty section" treatment playbookMoveSections gives
// an empty pool (playbook-moves.js).
export function groupEquipmentTags(tagList) {
	return TAG_VALUE_GROUPS
		.map(({ value, label }) => ({ label, tags: tagList.filter((tag) => tag.value === value) }))
		.filter((group) => group.tags.length > 0);
}

// Opens the "which weapon" prompt for a usesWeapon move (see moves.js,
// PlaybookActorSheet#_onMoveRoll) and resolves the chosen weapon's id, UNARMED, or null if
// dismissed. Mirrors chooseEquipmentCatalogItem's promise/Dialog/resolve-null shape. Assumes
// `weapons` is non-empty — the caller only invokes this when the actor actually has a weapon to
// choose between; with none, "unarmed" is simply true and there's nothing to ask.
export async function chooseWeapon(weapons, tags = EQUIPMENT_TAGS) {
	const options = weapons.map((weapon) => ({
		key: weapon.id,
		name: weapon.name,
		value: equipmentValue(weapon.tags ?? [], tags),
		tagLabels: resolveEquipmentTags(weapon.tags ?? [], tags).map((tag) => tag.label)
	}));
	const content = await renderTemplate(WEAPON_PICKER_TEMPLATE, { options });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose a Weapon",
			content,
			buttons: {
				choose: {
					label: "Choose",
					// The template pre-checks Unarmed, so .val() always resolves to something as
					// long as Choose (rather than Cancel/close) was clicked.
					callback: (html) => resolve(html.find("[name='weapon']:checked").val() ?? null)
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "choose",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "weapon-picker"] }).render(true);
	});
}

// Opens the create/edit dialog and resolves the entered equipment fields, or null if the dialog
// was dismissed, or if it was confirmed with no name. Mirrors choosePlaybookMove /
// configureMoveRoll / choosePlaybook for the promise/Dialog shape.
//
// Passing `initial` (an existing equipment entry) pre-fills the form and titles the dialog for
// editing; omitting it starts blank, for creating. Only `initial.id` decides which — a caller
// pre-selecting a kind for a fresh entry (see PlaybookActorSheet#_onEquipmentAdd) passes
// `{ kind }` with no `id`, and that still reads as "Add".
//
// scale is only ever present on the resolved object when Kind is Weapon at submit time — Gear
// never carries it, regardless of what the Kind field currently shows (Kind changing live doesn't
// hide it — the Tags total below is this dialog's only live-reactive wiring so far, kept
// intentionally narrow rather than extended to every field). tier is only ever present for a
// Carrier weapon (see `carrierWeapon` below) — every other weapon (mundane, Astir, Ardent) derives
// its Tier from whoever/whatever is wielding it (see PlaybookActorSheet#_equipmentEntry) instead
// of storing one, so the dialog never even shows a Tier field for them.
//
// `note` is optional, purely informational text rendered as a single line above the form (e.g.
// starting-gear.js's per-playbook custom weapon budget guidance) — never validated or enforced,
// same non-blocking treatment as every other soft guidance in this module.
//
// `astirWeapon` (see astir.js/PlaybookActorSheet) hides the Kind select and the Scale/Tier fields
// entirely: an Astir weapon is always a weapon, and always inherits its Astir's own tier and the
// "astir" WEAPON_SCALES entry rather than storing either — everything else (tags, MAX_TAGS, the
// required weapon-range group, the live Value readout) applies exactly as it does for any weapon.
// It's also the only flow that renders Drain's checkboxes at all (see DRAIN_GROUP's doc comment
// above) — every other caller (mundane weapons, gear, Carrier weapons) filters them out of the
// tag list before rendering.
//
// A mundane (plain foot-scale) weapon hides Tier the same way `astirWeapon`/`ardentWeapon` do —
// it inherits the wielding character's own Tier (see PlaybookActorSheet#_conflictTier) rather than
// storing one. This is the one caller with no dedicated flag: it's simply whichever weapon isn't
// astirWeapon, ardentWeapon, or carrierWeapon.
//
// `carrierWeapon` (see carrier-actor-sheet.js) is the one caller that still stores its own Tier: a
// Carrier weapon is always a weapon, always Astir scale (Carriers are never Foot scale), and
// always Tier 5 — but unlike every other weapon here, there's no wielder for it to inherit Tier
// from (the Carrier itself has no Tier of its own), so Tier stays a visible, disabled field
// (fixed at TIER_MAX) rather than being hidden outright.
//
// `ardentWeapon` (see ardent.js/PlaybookActorSheet) is the Ardent counterpart to `astirWeapon`:
// always a weapon, hides Kind and Tier the same way (an Ardent weapon inherits its owning Ardent's
// Tier rather than storing one), but — unlike `astirWeapon` — never renders Drain's checkboxes
// (`pickableTags` below stays filtered), since an Ardent has no Power for Drain to reduce.
//
// Scale itself is never a player-facing choice, for any caller: it now drives real behavior (see
// PlaybookActorSheet's Piloted mutual-exclusivity between Astir and mundane weapons), so letting a
// plain custom weapon be labeled Astir Scale without actually being flagged `astir: true` would be
// actively misleading — it would render as Astir Scale but behave as a mundane weapon. The neither-
// astirWeapon-nor-carrierWeapon-nor-ardentWeapon ("mundane") path is always resolved as `"foot"`;
// `carrierWeapon` is always `"astir"`; neither `astirWeapon` nor `ardentWeapon` ever stores a scale
// at all. There's no `<select name="scale">` left in the template for any of the four.
//
// The Range field (Melee/Ranged/Sniper — see WEAPON_RANGE_GROUP) follows the same non-reactive
// convention as Tier: always rendered when the injected `tags` catalog has range tags, regardless
// of Kind, rather than being hidden/shown live as Kind changes — kept intentionally narrow rather
// than extended to every field, same as Tier's own precedent. Its value is only read into the
// resolved result when Kind is Weapon at Save time.
//
// `excludedTagKeys` and `maxTagValue` are a second, generic budget mechanism alongside MAX_TAGS —
// not starting-gear-specific, for the same reason `note` isn't: they're options any caller could
// use, it's just starting-gear.js's custom-weapon flow (PlaybookActorSheet#_onStartingGearAdd)
// that's the one caller opting in today. `excludedTagKeys` (default `[]`, so every existing caller
// sees the exact same `pickableTags` as before) removes matching keys from the checkbox list
// entirely, the same way WEAPON_RANGE_GROUP/DRAIN_GROUP already are — this module has no economy
// system for Valuable/Treasure's claimed monetary value (see EQUIPMENT_TAGS' own doc comment), so
// starting-gear.js excludes them as free padding a player could otherwise stack for nothing.
// `maxTagValue` (default `null`, meaning "no cap") is enforced at Save the same way MAX_TAGS is:
// over the cap warns and resolves null rather than saving.
export async function configureEquipment(
	initial = null,
	tags = EQUIPMENT_TAGS,
	{ note, astirWeapon = false, carrierWeapon = false, ardentWeapon = false, excludedTagKeys = [], maxTagValue = null } = {}
) {
	// Drain only means anything on an Astir weapon (see DRAIN_GROUP's doc comment) — every other
	// flow, including ardentWeapon (an Ardent has no Power for Drain to reduce), hides its
	// checkboxes so it can't be picked somewhere it would stay permanently inert. WEAPON_RANGE_GROUP
	// is excluded unconditionally — it's never a checkbox anymore, see weaponRangeTags below.
	// excludedTagKeys (see the doc comment above) removes any further caller-specified keys, e.g.
	// starting-gear.js's custom-weapon flow excluding Valuable/Treasure.
	const pickableTags = tags.filter((tag) =>
		tag.exclusiveGroup !== WEAPON_RANGE_GROUP && (astirWeapon || tag.exclusiveGroup !== DRAIN_GROUP) &&
		!excludedTagKeys.includes(tag.key));
	// Melee/Ranged/Sniper render as their own native radio group (see equipment-editor.hbs) rather
	// than as checkboxes in the tag list — a radio group can always have a default, which a
	// checkbox trio validated only at Save time couldn't. Editing an entry pre-selects whichever
	// range tag it already has; a brand-new entry, or one with no range tag at all (a Gear item
	// being reconfigured, or stale data), falls back to the first group member ("melee").
	const weaponRangeTags = tags.filter((tag) => tag.exclusiveGroup === WEAPON_RANGE_GROUP);
	const defaultWeaponRangeKey = weaponRangeTags.find((tag) => initial?.tags?.includes(tag.key))?.key
		?? weaponRangeTags[0]?.key;
	const content = await renderTemplate(EQUIPMENT_EDITOR_TEMPLATE, {
		note,
		astirWeapon,
		carrierWeapon,
		// Kind is hidden for every caller that forces Scale/Tier — see the doc comment above.
		hideKind: astirWeapon || carrierWeapon || ardentWeapon,
		// Tier is hidden (rather than shown-disabled like carrierWeapon's) for every weapon that
		// inherits Tier from elsewhere instead of storing it — which today is every weapon except
		// carrierWeapon's — see the doc comment above.
		hideTier: !carrierWeapon,
		name: initial?.name ?? "",
		description: initial?.description ?? "",
		isWeapon: astirWeapon || carrierWeapon || ardentWeapon || (initial?.kind ?? "weapon") === "weapon",
		tier: carrierWeapon ? TIER_MAX : (initial?.tier ?? TIER_MIN),
		tierMin: TIER_MIN,
		tierMax: TIER_MAX,
		// The starting total shown before any box is touched — same equipmentValue helper the
		// Equipment tab already uses to display an entry's Value (playbook-actor-sheet.js), so the
		// number on open always matches what the sheet would show for `initial` today.
		tagTotal: equipmentValue(initial?.tags ?? [], tags),
		// hasTagValueCap is a separate boolean rather than checking maxTagValue directly in the
		// template — {{#if}} treats 0 as falsy, and a cap of 0 (starting-gear.js's default) is a
		// real, active cap that still needs to render.
		maxTagValue,
		hasTagValueCap: maxTagValue !== null,
		// Grouped (see groupEquipmentTags above) rather than one flat 40-entry list — the catalog
		// has grown too long to scan otherwise. Each group starts open only if it already holds one
		// of `initial`'s current tags, so editing a tagged item lands with the relevant group(s)
		// visibly expanded; a blank new item starts with every group collapsed.
		tagGroups: groupEquipmentTags(pickableTags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			checked: Boolean(initial?.tags?.includes(tag.key))
		}))).map((group) => ({ ...group, open: group.tags.some((tag) => tag.checked) })),
		// Always rendered, not gated by Kind — same "kept intentionally narrow rather than extended
		// to every field" non-reactivity Tier already has above. Empty when the injected `tags`
		// catalog carries no WEAPON_RANGE_GROUP entries at all (e.g. a fixture catalog in tests).
		weaponRangeOptions: weaponRangeTags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			description: tag.description,
			checked: tag.key === defaultWeaponRangeKey
		}))
	});

	return new Promise((resolve) => {
		new Dialog({
			title: initial?.id ? "Edit Equipment" : "Add Equipment",
			content,
			// Recomputes the running Tags total as boxes are checked/unchecked, so a player designing
			// a weapon to a budget (e.g. starting-gear.js's custom-weapon note) can see it without
			// re-opening the dialog. Reads each checked box's key straight back through `tags` via
			// equipmentValue, the same lookup every other total in this module already goes through,
			// rather than a separate data-value attribute.
			render: (html) => {
				const updateTotal = () => {
					const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
					html.find(".equipment-editor-tag-total-value").text(equipmentValue(checkedKeys, tags));
				};
				// A tag with an `exclusiveGroup` (see EQUIPMENT_TAGS' doc comment) behaves like a radio
				// button within that group: checking it unchecks every other tag sharing the same group,
				// looked up off `tags` (already in closure) rather than new template data attributes.
				html.find("[name='tag']").on("change", (event) => {
					// The changed checkbox's value is always a real tag key — it was rendered from
					// `tags` in the first place — so this lookup can never miss.
					const changed = findEquipmentTag(event.target.value, tags);
					if (changed.exclusiveGroup && event.target.checked) {
						for (const other of tags.filter((tag) => tag.exclusiveGroup === changed.exclusiveGroup && tag.key !== changed.key)) {
							html.find(`[name='tag'][value='${other.key}']`).prop("checked", false);
						}
					}
					updateTotal();
				});
			},
			buttons: {
				save: {
					label: "Save",
					callback: (html) => {
						const name = html.find("[name='name']").val().trim();
						if (!name) {
							resolve(null);
							return;
						}
						// None of the Astir/Carrier/Ardent weapon dialogs render the Kind select at all
						// (see the template) — all three are always weapons, so there's nothing to read
						// from the DOM here for any of them.
						const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
						const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
						const weaponRangeKey = html.find("[name='weapon-range']:checked").val();
						// Every checked key is a real regular tag — WEAPON_RANGE_GROUP keys can no longer
						// appear here at all, since they're never rendered as checkboxes (see
						// weaponRangeTags above) — so, unlike before, nothing needs filtering out of this
						// count. DRAIN_GROUP tags still count, since Drain carries a real value.
						const regularTagCount = checkedKeys.length;
						// Applies to weapons and gear alike. Feedback rather than a silent no-op, same
						// reasoning as the weapon-range check below.
						if (regularTagCount > MAX_TAGS) {
							ui.notifications.warn(`Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`);
							resolve(null);
							return;
						}
						// maxTagValue (see the doc comment above configureEquipment) is a second, opt-in
						// budget cap enforced the same way as MAX_TAGS above — null (the default) means no
						// cap, so every existing caller is unaffected. Only checked regular tags count —
						// the range radio's value is always 0 and was never in checkedKeys to begin with.
						if (maxTagValue !== null && equipmentValue(checkedKeys, tags) > maxTagValue) {
							ui.notifications.warn(`This equipment's tags can total at most ${maxTagValue}.`);
							resolve(null);
							return;
						}
						// Weapons specifically must carry one of WEAPON_RANGE_GROUP's tags (Melee/Ranged/
						// Sniper) — see the exclusiveGroup doc comment above. In practice this is a
						// defensive fallback rather than the primary safeguard now: the radio group
						// always renders with a default checked (see weaponRangeOptions above), so a
						// player can no longer reach Save with none selected through normal use.
						if (kind === "weapon" && !weaponRangeKey) {
							ui.notifications.warn("A weapon needs one of the Melee, Ranged or Sniper tags.");
							resolve(null);
							return;
						}
						resolve({
							name,
							description: html.find("[name='description']").val().trim(),
							kind,
							// Prepended to match EQUIPMENT_CATALOG's own convention of listing the range
							// tag first (e.g. tags: ["melee", "intimate", "concealable"]). Only merged in
							// for weapons — Gear never carries a range tag, even though the radio group
							// (always rendered, per weaponRangeOptions above) still has some default value
							// in the DOM regardless of Kind.
							tags: kind === "weapon" ? [weaponRangeKey, ...checkedKeys] : checkedKeys,
							// scale is never resolved for an Astir or Ardent weapon — both are always Astir
							// scale, inherited from the owning frame itself (see
							// PlaybookActorSheet#_equipmentEntry) rather than stored. A mundane weapon is
							// always Foot Scale — there's no DOM field to read either way (see the doc
							// comment above configureEquipment).
							...(kind === "weapon" && !astirWeapon && !ardentWeapon && {
								scale: carrierWeapon ? "astir" : "foot",
								// tier is likewise never resolved for a mundane weapon — it derives from the
								// wielding character instead (see the doc comment above configureEquipment).
								// Only carrierWeapon still stores its own, always fixed at TIER_MAX; the DOM
								// field carrierWeapon renders is disabled, so nothing else can reach here.
								...(carrierWeapon && { tier: TIER_MAX })
							})
						});
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "save",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-editor"] }).render(true);
	});
}
