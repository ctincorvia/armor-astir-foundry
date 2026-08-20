import { APPROACHES } from "../core/approaches.js";
import { DRAIN_GROUP, MOUNTED_TWO_HANDED_GROUP, WEAPON_RANGE_GROUP } from "./equipment-constants.js";

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
// once per period (see PlaybookActorSheet's reroll chat-button handling). A reroll tag naming
// more than one move (Versatile) tracks each move's use independently — see rerollSpendKey below
// — rather than one shared spend that exhausts on first use regardless of which move triggered
// it, which would make a two-move tag strictly worse than picking the two single-move tags it's
// meant to combine. `guided` (Guided) is the "skip rolling, take a 7-9" option, offered for any
// usesWeapon move.
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
		description: "Highly valuable—and a gold, glittering target on your back."
	},
	// -1: almost entirely negative tags.
	{
		key: "two-handed",
		label: "2H",
		value: -1,
		description: "Takes both hands to use properly, though not necessarily just to carry.",
		exclusiveGroup: MOUNTED_TWO_HANDED_GROUP
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
		description: "Expensive to acquire, and fairly sought-after."
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
			"other tasks. As a result, it's also difficult to disarm a target of without breaking it.",
		exclusiveGroup: MOUNTED_TWO_HANDED_GROUP
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
	// gearOnly: not pickable on a Weapon through the equipment editor; the-icon:bodyguards-i
	// (starting-gear-pools.js) is a grandfathered weapon exception granted directly through data.
	{
		key: "ward",
		label: "Ward",
		value: 1,
		description: "You may use this tag once per Sortie to reduce an incoming source of harm from a peril " +
			"to a risk, or from a risk to nothing.",
		spend: { period: "Sortie" },
		gearOnly: true
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
