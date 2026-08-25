// Astir Parts read as moves (see PlaybookActorSheet's Astir Moves group) — same shape as
// BASIC_MOVES (traits/description/results), plus powerCost: how much of the Astir's base Power
// this part permanently spends (see astirMaxPower). partType ("Active"/"Passive") is display-only,
// rendered as a badge in the Astir tab's Parts list. Every part-specific mechanic (Weapon Conduit's
// weaponPowerBonus, Flourish Component's regainPowerOnDoubles, etc.) is a declarative flag read
// generically by PlaybookActorSheet — the same "boolean on the object, evaluated in the sheet"
// convention moves.js already uses for usesWeapon/forcesDesperationAtMaxPerils/
// requiresChannelDisabled (see claude.md, "Anything that depends on actor state..."). Every Active
// part gets a manual uses: [{key: "expended", ...}] checkbox — Subsystems' own rules text
// ("re-activate an expended [Active] Astir part") already assumes every Active part can become
// expended, and this reuses the existing generic uses mechanism with no new rendering code.
// period: "Sortie" — cleared by the Controls tab's Refresh Sortie button (see
// PlaybookActorSheet#_onRefreshSortie); Subsystems' own "spend 1 Power to re-activate" text is a
// separate, unaffected mid-Sortie option, not a substitute for the periodic refresh.
// Exported so ardent.js's own Commander-exclusive Ardent Feature catalog (see ARDENT_FEATURE_PARTS)
// can reuse the identical checkbox shape rather than redefining it.
export const EXPENDED_USE = [{ key: "expended", label: "Expended", period: "Sortie" }];

export const ASTIR_PART_CATALOG = [
	{
		key: "astir-part:extra-arms",
		name: "Extra Arms",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		description:
			"<p>While adding extra arms to an Astir is child's play, properly coordinating them is much " +
			"more complex.</p>" +
			"<p>Two extra arms and hands.</p>"
	},
	{
		key: "astir-part:weapon-conduit",
		name: "Weapon Conduit",
		partType: "Passive",
		traits: [],
		// See ASTIR_WEAPON_POWER_BASE above — a second, separate Power pool, not a reduction of
		// the normal one, so this carries no powerCost.
		weaponPowerBonus: 2,
		description:
			"<p>A magical conduit that compensates for the heavy magical load of certain weaponry, " +
			"trading utility for output.</p>" +
			"<p>+2 Power towards weapons only — tracked as its own, separate Weapon Power pool.</p>"
	},
	{
		key: "astir-part:divination-codex",
		name: "Divination Codex",
		partType: "Active",
		traits: [],
		// See PlaybookActorSheet#_onMoveActivate: posts Read the Room's real question list to
		// chat and checks Expended, rather than granting hold of its own.
		showsReadTheRoomQuestions: true,
		uses: EXPENDED_USE,
		description:
			"<p>A cross-referenced record of countless common omens, signs and prophecies, easily " +
			"perused by an attuned Channeler in a flash.</p>" +
			"<p>Ask 1 question from the Read the Room list.</p>"
	},
	{
		key: "astir-part:arcane-forge",
		name: "Arcane Forge",
		partType: "Passive",
		traits: [],
		// Extends Cool Off's own outcome menu — Cool Off's outcomes are already narrated rather
		// than enforced, so this is prose only.
		description:
			"<p>A magically-powered forge, capable of casting common Astir supplies and munitions from " +
			"magical energy and a local stock of raw materials.</p>" +
			"<p>You may cool off to resupply an expended weapon.</p>"
	},
	{
		key: "astir-part:flourish-component",
		name: "Flourish Component",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		// See PlaybookActorSheet#_onMoveResolved/roll-effects.js#rolledDoubles.
		regainPowerOnDoubles: true,
		description:
			"<p>Like traditional spellcasting relies on strange gestures, chanting and complex foci to " +
			"provide power, an Astir's design can be complicated in similar ways to achieve much the " +
			"same.</p>" +
			"<p>Regain 1 Power when you roll doubles (once per roll).</p>"
	},
	{
		key: "astir-part:spell-routines",
		name: "Spell Routines",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		// Reuses the existing Guided mechanism (moves.js#postGuidedResult), scoped to exactly one
		// move the player picks on the Astir tab (system.attributes.guidedMoveChoices, keyed by
		// this part's own key) rather than every move — see PlaybookActorSheet#_rollMove/
		// _guidedMoveOptions.
		grantsGuided: true,
		description:
			"<p>The battlefield is a busy place, full of countless distractions. It can be helpful to " +
			"let the magic take over sometimes.</p>" +
			"<p>Choose to take a result of 7-9 on a move of your choice, before rolling.</p>"
	},
	{
		key: "astir-part:familiar-matrix",
		name: "Familiar Matrix",
		partType: "Passive",
		traits: [],
		powerCost: 2,
		// Familiars aren't a modeled system in this module (see claude.md, "systems that do not
		// exist yet") — prose only.
		description:
			"<p>Matrices store and coordinate Familiars, making it possible for one Channeler to guide " +
			"many at a time.</p>" +
			"<p>Holds and comes with one set of Familiars of your choice.</p>"
	},
	{
		key: "astir-part:chromatic-focus",
		name: "Chromatic Focus",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		// Activate -> chooseApproachOverride (core/approaches.js) picker, excluding the actor's
		// current Approach -> writes system.attributes.approachOverride as { approach, period:
		// "Scene" } and checks this part's own Expended checkbox (its own `uses` pool, shared with
		// the generic "spend 1 Power to re-activate an expended Astir part" mechanism every other
		// Active part already has) in a single actor.update, then posts the description — see
		// moves-mixin.js's promptsApproachOverride/_nextUnusedMoveUseKey and move-roll-mixin.js's
		// _onMoveActivate branch. Gated (button disabled) once nothing's left to spend, via the same
		// shared "any use left?" helper. Resolved into effective Approach by progression-mixin.js's
		// _effectiveApproach, but only while the Astir specifically is the mounted frame — see
		// _mountedParts()'s own gating, which _effectiveApproach reads off. Cleared automatically by
		// Refresh Scene (frames-mixin.js's _onRefreshScene), since it's scoped to a single Scene
		// rather than Enduring Support's Sortie-scoped override.
		promptsApproachOverride: true,
		description:
			"<p>A device capable of twisting and re-aspecting magic. For Channelers that don't like to " +
			"ever be at a disadvantage.</p>" +
			"<p>Swap to any other Approach for a single Scene.</p>"
	},
	{
		key: "astir-part:alchemical-suite",
		name: "Alchemical Suite",
		partType: "Passive",
		traits: [],
		powerCost: 2,
		// See FramesSheetMixin#_onRefreshSortie — grants 1 of each Potion (all three become
		// available) whenever the Controls tab's Refresh Sortie button is clicked.
		grantsPotionsOnRefreshSortie: true,
		grantsRollModifier: [
			{ key: "blue", moveKeys: ["weave-magic"], advantage: "advantage", costsPotion: "blue",
				label: "Blue Potion", description: "Take advantage when you weave magic." },
			{ key: "yellow", moveKeys: ["exchange-blows", "strike-decisively"], effect: "confidence",
				costsPotion: "yellow",
				label: "Yellow Potion", description: "Take a risk. Act with confidence when you exchange blows or strike decisively." }
		],
		description:
			"<p>A selection of alchemical equipment, capable of storing and mixing useful potions " +
			"before venting them into the cockpit as a vapour to save time.</p>" +
			"<ul>" +
			"<li>Red: Remove a peril related to physical injury or wounds. Metallic.</li>" +
			"<li>Blue: Take advantage when you weave magic. Fruity.</li>" +
			"<li>Yellow: Take a risk. Act with confidence when you exchange blows or strike " +
			"decisively. Tangy and sharp.</li>" +
			"</ul>" +
			"<p>Take 1 of each Potion when someone leads a Sortie.</p>"
	},
	{
		key: "astir-part:input-channel",
		name: "Input Channel",
		partType: "Passive",
		traits: [],
		// See PlaybookActorSheet#_moveTraits — offers CHANNEL on any move, bypassing both that
		// move's own traits list and Channel's disabled gate.
		grantsChannelOnAnyMove: true,
		description:
			"<p>Conduit channels running directly from a component to the Channeler allow them to " +
			"assert more direct magical control over it in times of need.</p>" +
			"<p>Make a chosen move with +CHANNEL.</p>"
	},
	{
		key: "astir-part:chameleon-cloak",
		name: "Chameleon Cloak",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		description:
			"<p>They can't hit what they can't see.</p>" +
			"<p>Become invisible for a Scene. The next risk you take is 'revealed'.</p>"
	},
	{
		key: "astir-part:standardised-parts",
		name: "Standardised Parts",
		partType: "Passive",
		traits: [],
		// Grants a restricted Bonus Downtime Tokens pool like any other source (moves/parts/
		// equipment) — see progression-mixin.js's _bonusDowntimeTokensData.
		bonusDowntimeTokens: { max: 1, description: "Repairs only." },
		description:
			"<p>This Astir uses a large amount of common, easy-to-find parts shared with similar " +
			"models. This makes it easy to repair, lightening the load on everyone else.</p>" +
			"<p>Gain +1 token during Downtime to spend on repairs only.</p>"
	},
	{
		key: "astir-part:warding",
		name: "Warding",
		partType: "Active",
		traits: [],
		// No `spend` — this has no `effect`/`advantage` to offer a roll, so (like Ward's own
		// equipment tag) it never appears in the roll dialog at all, regardless of which move is
		// being rolled or what weapon/scale is involved. Its only interaction point is the
		// `uses: EXPENDED_USE` checkbox below, which _moveGroupMoves renders unconditionally (not
		// gated on the Astir being piloted — see move-use-checkbox in the template), so it can be
		// marked used any time.
		uses: EXPENDED_USE,
		description:
			"<p>Anything that helps an Astir not explode is a worthwhile investment.</p>" +
			"<p>You may use this once per Sortie to reduce an incoming source of harm from a peril to " +
			"a risk, or from a risk to nothing (+ward).</p>"
	},
	{
		key: "astir-part:transmutation-link",
		name: "Transmutation Link",
		partType: "Passive",
		traits: [],
		// Aerial/aquatic tags don't exist yet in this module (see claude.md, "systems that do not
		// exist yet") — prose only.
		description:
			"<p>A frame endowed with the ability to shift between two forms quickly, making for a " +
			"versatile Astir.</p>" +
			"<p>+aerial OR +aquatic.</p>"
	},
	{
		key: "astir-part:resistance-charms",
		name: "Resistance Charms",
		partType: "Passive",
		traits: [],
		// Left descriptive — the source a character picks is freeform, and no Danger-source
		// tagging/downgrade system exists in this module.
		description:
			"<p>While it is difficult to offer a broad blanket of protection against damage and " +
			"difficulty, more specific avenues of harm are relatively simple to protect an Astir " +
			"against.</p>" +
			"<p>Examples:</p>" +
			"<ul>" +
			"<li>Replication Rituals (lowers dangers from limb loss). Crawl. Climb. Rip. Tear. Many " +
			"hands make light work.</li>" +
			"<li>Failsafe Channels (lowers dangers from comms disruption). Hear you loud and clear, " +
			"9th. Everyone else went quiet.</li>" +
			"<li>Lightningrod Spines (lowers dangers from electricity). Don't be the fool caught out " +
			"in a storm. Plan ahead.</li>" +
			"</ul>" +
			"<p>Lowers dangers from one chosen source: Peril becomes a Risk, Risk becomes Nothing.</p>"
	},
	{
		key: "astir-part:artifact",
		name: "Artifact",
		partType: "Active",
		traits: [],
		// Grants advantage towards a task the Artifact is designed for, unrestricted by which task
		// it's "designed for" (matching this module's existing non-enforcement of similar scope text
		// elsewhere) — no moveKeys, so it's offered in every move's Roll Modifiers section.
		// costsUse: "expended" reads/writes the same moveUses.<partKey>.expended field the Astir
		// Moves group's own manual checkbox toggles (see move-grants-mixin.js's
		// _rollModifierAvailability/_spendRollModifiers costsUse branches).
		grantsRollModifier: [{
			advantage: "advantage",
			label: "Advantage from Artifact",
			description: "Grants advantage towards a task this Artifact is designed for.",
			costsUse: "expended"
		}],
		uses: EXPENDED_USE,
		description:
			"<p>High-quality artifice provides an edge when it is needed most.</p>" +
			"<p>Examples:</p>" +
			"<ul>" +
			"<li>Familiar Sync Rituals — Co-ordination rituals allow a Channeler to better direct " +
			"their familiars, cutting down on the 'attunement drift' common in most matrices.</li>" +
			"<li>Dragonscales — For decades before Astirs became a possibility, craftsmen put " +
			"bartered dragon scales to work as a protective material, never understanding why it " +
			"seemed less durable wrapped around a man than it did around a dragon. Those profitable " +
			"wyrms never let slip quite how much magic ran in their blood.</li>" +
			"<li>Afterburners — An injection of volatile alchemical substances paired with a burst of " +
			"magic can provide a substantial, if short lived, increase in speed. Not for those on a " +
			"shoestring alchemicals budget.</li>" +
			"</ul>" +
			"<p>Grants advantage towards tasks the Artifact is designed for, before or after the " +
			"roll.</p>"
	},
	{
		key: "astir-part:heat-condensers",
		name: "Heat Condensers",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		// Untick Overheating is already a manual checkbox on the Astir tab — no new code needed
		// for the effect itself.
		description:
			"<p>Stopping to vent heat during a fight can make you a sitting duck—it makes sense then, " +
			"that many Channelers who could care less about managing it carefully opt to invest in " +
			"heat condensers.</p>" +
			"<p>Untick 'overheating' from your Astir.</p>"
	},
	{
		key: "astir-part:complex-spellwork",
		name: "Complex Spellwork",
		partType: "Passive",
		traits: [],
		// The rulebook's cost is Director-assigned (-1 to -4) per pick; this catalog can only
		// carry one fixed number, so it's pinned to the low end and left descriptive about the
		// rest — see docs/domains/moves.md's "Adding move content" table for this project's default stance on
		// effects that don't map onto existing mechanics.
		powerCost: 1,
		description:
			"<p>Sometimes, the key magical functions of an Astir require sacrifice, their complex " +
			"enchantments or rituals taking up power and space.</p>" +
			"<p>Your Director might ask you to take Complex Spellwork to offset a particularly " +
			"powerful or rule-bending Astir Move. This tracks the minimum cost, 1 Power — your " +
			"Director may rule that a given Move costs more (up to 4).</p>"
	}
];
