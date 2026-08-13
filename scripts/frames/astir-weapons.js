// Astir weapons are ordinary equipment entries (system.attributes.equipment) flagged astir: true —
// see PlaybookActorSheet — so this catalog matches EQUIPMENT_CATALOG's weapon shape minus
// scale/tier, both of which an Astir weapon always inherits from its Astir rather than storing.
// "Also seen as ..." lines transcribe the rulebook's own re-skin flavor for each entry. Every
// entry is Tier III fiction (an Astir's own
// Tier — see ASTIR_TIER_MIN/MAX in astir.js — always governs the actual roll, since tier isn't
// stored here).
//
// `familiar: true` (the last four entries) marks the four Familiar weapons: small constructs
// launched from an Astir, always ranged or sniper per their own rules text. Three of their rules
// are real code, not prose: PlaybookActorSheet#_rollMove rolls Exchange Blows/Strike Decisively
// with a Familiar weapon as +CHANNEL instead of the usual CLASH/TALK choice (see the `familiar`
// check there); every Familiar weapon is an Astir weapon, so it's already subject to the same
// Piloted mutual-exclusivity as any other Astir weapon; and "requires a Familiar Matrix Astir
// Part" is enforced via each entry's own requiresParts — see unmetPartRequirements/
// partRequirementTooltip (astir.js) and chooseAstirWeapon (astir-pickers.js), which disable a
// Familiar weapon in the Astir weapon picker (with a tooltip) until Familiar Matrix is installed.
// The rest — perils from a lost Familiar clearing automatically during Downtime — stays
// descriptive, same "systems that don't exist yet" treatment as everywhere else in this module (no
// Downtime phase is tracked anywhere).
export const ASTIR_WEAPON_CATALOG = [
	{
		key: "astir-fists",
		name: "Astir Fists",
		description: "Every Astir can fall back on its fists, but they don't make for graceful brawlers. Also " +
			"seen as Concealed Blades, Close-Range Vulcans, or a Mining Drill.",
		tags: ["melee", "intimate", "blitz"]
	},
	{
		key: "sword-mace-axe-shield",
		name: "Sword/Mace/Axe & Shield",
		description: "An Astir-sized melee weapon paired with a shield makes for a reliable combination. Bones " +
			"and forelimbs of monstrous creatures are often used as sturdy, cheap parts. Also seen as Flame " +
			"Jets, Shielded Gauntlets, or an Energy Field.",
		tags: ["melee", "defensive", "two-handed"]
	},
	{
		key: "forceknife",
		name: "Forceknife",
		description: "Short (for an Astir) blades jacketed in a layer of magical energy, forceknives are good " +
			"for when you find yourself up close and personal. Also seen as a Throwing Glaive, Charged " +
			"Hatchet, or Enchanted Daggers.",
		tags: ["melee", "bane", "intimate"]
	},
	{
		key: "greatarm",
		name: "Greatarm",
		description: "Often almost as tall as the Astirs wielding them, 'greatarms' are the Astir equivalent " +
			"of greatswords, battleaxes, and any other kind of large, simple, 2-handed weapon. Also seen as a " +
			"Godbuster, Laser Flail, or Industrial Saw.",
		tags: ["melee", "area", "two-handed"]
	},
	{
		key: "force-repeater",
		name: "Force Repeater",
		description: "A simple mechanism that rapidly fires short blasts of magical energy, serving as an " +
			"effective reserve weapon. Also seen as a Powerpistol, Mining Laser, or Point-Defense Turret.",
		tags: ["ranged", "defensive", "weak"]
	},
	{
		key: "autoballista",
		name: "Autoballista",
		description: "One of the few non-magical weapons in active use among Channelers. Autoballistae are " +
			"popular for their fire rate, which allows for fending off groups with a spray of bolts as well " +
			"as overwhelming a single Astir with a flurry of shots. Also seen as a Heavy Bowgun, Assault " +
			"Cannon, or Flechette Launcher.",
		tags: ["ranged", "area", "blitz", "bulky", "two-handed"]
	},
	{
		key: "rayrifle",
		name: "Rayrifle",
		description: "Rayrifles are the workhorse of most armies when it comes to arming Astirs. A highly " +
			"efficient charging cycle means every cast uses an almost meaningless amount of magical energy. " +
			"Also seen as a Machine Gun, Arc Staff, or Recycler Rifle.",
		tags: ["ranged", "infinite", "two-handed"]
	},
	{
		key: "magic-missile-array",
		name: "Magic-Missile Array",
		description: "Often mounted on an Astir's shoulder to leave their hands free, magic-missile arrays " +
			"fire a dizzying cluster of magical darts that can be guided by an Astir rather than its " +
			"Channeler. Also seen as Chaser Missiles, a Lock-On Beam, or an Automortar.",
		tags: ["sniper", "guided", "weak"]
	},
	{
		key: "titan-bow",
		name: "Titan Bow",
		description: "Immense, heavily-reinforced longbows, taller than even some Astirs. While some baulk at " +
			"taking a bulky single-shot weapon into the field, others point to the ability to sink an arrow " +
			"through Carrier hulls as a valuable upside. Also seen as a Single-Cast Rifle, Beam Sniper, or " +
			"Abyss Gun.",
		tags: ["sniper", "ruin", "reload", "two-handed"]
	},
	{
		key: "baneblade",
		name: "Baneblade",
		description: "Most Astir pilots do not concern themselves with the scrambling of foot-soldiers. Some of " +
			"these pilots meet very unexpected ends. Also seen as a Blowtorch, Enchanted Broadsword, or Bolt " +
			"Gauntlets.",
		tags: ["melee", "bane", "two-handed"]
	},
	{
		key: "warp-slinger",
		name: "Warp-Slinger",
		description: "An emplaced device incorporating multiple wands linked to a simple firing ritual that can " +
			"be triggered by even those not gifted with magic. Also seen as an MG Turret, Point Laser, or " +
			"Multi-Crossbow.",
		tags: ["ranged", "blitz", "infinite", "huge"]
	},
	{
		key: "ardent-rifle",
		name: "Ardent Rifle",
		description: "A large two-handed tool that fires searing bolts of light, capable of burning through " +
			"even an Astir's defences. Typically used by ardents, due to its weight. Also seen as an " +
			"Arbalest, Flame Staff, or Greatbow.",
		tags: ["ranged", "bane", "two-handed"]
	},
	{
		key: "seeker-cluster",
		name: "Seeker Cluster",
		description: "Guided by a faint magical intelligence, this device lets loose a swarm of small magical " +
			"crystals to hound a particular target. Though they struggle to pierce armour, these crystals " +
			"shatter on impact, resulting in sharp shrapnel. Also seen as Orbiting Motes, a Shock Rod, or " +
			"Command Bracelets & Drone.",
		tags: ["ranged", "guided", "defensive", "reload", "messy"]
	},
	{
		key: "ardentpiercer",
		name: "Ardentpiercer",
		description: "Immense lances designed to punch through armour plating, ardentpiercers are heavy " +
			"enough that they must be held in place and used as a charging weapon—just swinging one around " +
			"is unlikely to deliver results. Also seen as a Ceremonial Pike, Heavy Estoc, or Pile Bunker.",
		tags: ["melee", "impact", "decisive", "set-up", "drain-1"]
	},
	{
		key: "forceblade",
		name: "Forceblade",
		description: "Your typical, garden-variety sword made out of projected magical force. It cuts well " +
			"and won't explode - what else do you want? Also seen as a Beam Saber, Thermal Cutter, or " +
			"Pneumatic Hammer.",
		tags: ["melee", "bane", "drain-1"]
	},
	{
		key: "basilisk-lance",
		name: "Basilisk Lance",
		description: "An uncommon weapon, basilisk lances house a lens composed of dozens of magically " +
			"preserved basilisk eyes. When a certain energy is passed through this lens, a petrifying beam " +
			"is produced. Also seen as a Chemical Jet, Beam Rifle, or Plasma Repeater.",
		tags: ["ranged", "bane", "restraining", "drain-1", "two-handed"]
	},
	{
		key: "blazewands",
		name: "Blazewands",
		description: "Arranged in paired racks and crafted using subdued motes of elemental fire, short-range " +
			"wands are a common and potent weapon when it comes to arming Astirs. Also seen as Grenade " +
			"Launchers, Acid Pods, or a Plasma Mortar.",
		tags: ["ranged", "versatile", "reload", "drain-1"]
	},
	{
		key: "burstcaster",
		name: "Burstcaster",
		description: "Burstcasters launch a projectile that discharges a spell on impact—typically some kind " +
			"of dramatic fireball. The wand projectile only arms past a certain distance, to prevent a " +
			"Channeler from being caught in their own fireball. Also seen as a Rocket Launcher, Fireball " +
			"Cannon, or Reactor Rifle.",
		tags: ["ranged", "area", "bane", "two-handed"]
	},
	{
		key: "novawhip",
		name: "Novawhip",
		description: "Concentrated motes of fire slumber at equal lengths along this whip, and violently " +
			"detonate on impact. A devastating weapon in skilled hands that know how to recharge the motes " +
			"mid-battle. Also seen as Chain Mines, a Plasma Cable, or Storm Gauntlet.",
		tags: ["melee", "area", "vorpal", "dangerous", "drain-1"]
	},
	{
		key: "ruinblade",
		name: "Ruinblade",
		description: "Long, slender, and fragile—ruinblades are long swords edged with arcane-charged " +
			"crystal, allowing them to cut through even Carrier hulls. Just try not to break it. Also seen " +
			"as a Decay Lance, Null-space Projector, or Hi-Beam Saber.",
		tags: ["melee", "ruin", "decisive", "fragile", "drain-2"]
	},
	{
		key: "overcharged-bolts",
		name: "Overcharged Bolts",
		description: "If in need of something punchier, you can take very standard Astir equipment—a simple " +
			"lightning bolt spell, for example—and simply feed it far, far more magical energy than " +
			"expected. Also seen as a Gatling Gun, Gauss Rifle, or Beam Rifle.",
		tags: ["sniper", "ruin", "drain-2"]
	},
	{
		key: "spellcannon",
		name: "Spellcannon",
		description: "A heavy, devastating weapon. Though it demands magic such that few Channelers can " +
			"muster more than a handful of shots, the results are easily worth the expense. Also seen as an " +
			"Assault Cannon, Heavy Beam Rifle, or Anti-Materiel Rifle.",
		tags: ["ranged", "versatile", "blitz", "drain-2", "two-handed"]
	},
	{
		key: "chaos-revolver",
		name: "Chaos Revolver",
		description: "A thick, metal wand with a pistol-style grip. The rotating chambers are filled with " +
			"overcharged and desecrated crystals, the magical output of which is immense (and volatile). " +
			"Also seen as a Fusion Pistol, Acid Thrower, or Planar Displacer.",
		tags: ["ranged", "ruin", "drain-2", "messy", "profane"]
	},
	{
		key: "storm-axe",
		name: "Storm Axe",
		description: "A handheld hatchet, insulated to protect its user and engraved with sigils that " +
			"perpetuate a constant flow of thunderous magic. Also seen as a Plasma Blade, Chainsword, or " +
			"Powered Hammer.",
		tags: ["melee", "vorpal", "drain-2"]
	},
	{
		key: "wisp-familiar",
		name: "Wisp Familiar",
		description: "Wisps are by far the most common familiar, and for most people are synonymous with the " +
			"word. Small floating constructs that pack a surprising punch for their size, wisps are limited " +
			"by the short lifespan on their magic. Also seen as an Assault Funnel, Fire Spirits, or Attack " +
			"Drones. Familiar — requires a Familiar Matrix Astir Part; rolls +CHANNEL for Exchange Blows and " +
			"Strike Decisively; perils from its loss clear automatically during Downtime (untracked by this " +
			"module — clear them yourself).",
		tags: ["ranged", "area", "limited"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "mote-familiar",
		name: "Mote Familiar",
		description: "Motes are primed with conflagration magic, and detonate in a fiery blaze when impacted " +
			"against a target. Channelers tend to use them only when needed, since if shot the explosions " +
			"tend to set off other nearby motes. Also seen as Remote Bombs, Volatile Elements, or " +
			"Lev-Grenades. Familiar — requires a Familiar Matrix Astir Part; rolls +CHANNEL for Exchange " +
			"Blows and Strike Decisively; perils from its loss clear automatically during Downtime " +
			"(untracked by this module — clear them yourself).",
		tags: ["sniper", "impact", "bane", "dangerous"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "needle-familiar",
		name: "Needle Familiar",
		description: "Needle Familiars pin their targets in place with thin, iron spikes. While lacking when " +
			"it comes to decisive blows, they excel at restraining and harassing foes. Also seen as a Glue " +
			"Turret, Labour Drones, or Medusa Heads. Familiar — requires a Familiar Matrix Astir Part; rolls " +
			"+CHANNEL for Exchange Blows and Strike Decisively; perils from its loss clear automatically " +
			"during Downtime (untracked by this module — clear them yourself).",
		tags: ["ranged", "restraining", "weak"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "claw-familiar",
		name: "Claw Familiar",
		description: "Sharp-clawed contraptions of magic and stone, in the familiar shape of a crow. Also " +
			"seen as Trained Wolves, Raven Ghosts, or Saw Drones. Familiar — requires a Familiar Matrix Astir " +
			"Part; rolls +CHANNEL for Exchange Blows and Strike Decisively; perils from its loss clear " +
			"automatically during Downtime (untracked by this module — clear them yourself).",
		tags: ["ranged", "defensive", "distinct"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "touch-spells",
		name: "Touch Spells",
		description: "A focusing gesture and a whispered word, channeled straight through the caster's " +
			"own hands into whatever — or whoever — they touch.",
		tags: ["melee", "bane"]
	}
];
