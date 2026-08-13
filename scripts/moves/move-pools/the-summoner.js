export const THE_SUMMONER_POOL = {
	key: "the-summoner",
	label: "The Summoner",
	playbookName: "The Summoner",
	moves: [
		{
			key: "the-summoner:eidolon-drive",
			name: "Eidolon Drive",
			// This is the Summoner's Astir Move — forced, not a free pick (see astir.js's
			// requiredAstirMoveKey, wired into astir-mixin.js's _onAstirCreate/_onAstirMoveAdd). A
			// fresh Astir starts with this already set; the picker skips straight to it too.
			traits: [],
			// Renders a Summon button in place of Roll/Activate (see moves-mixin.js's
			// _moveGroupMoves) — its own roll options come from whatever move the player rolls
			// next (see the unconditional eidolon-drive-ally trait push in _moveTraits), not from
			// a roll of its own.
			summonsAlly: true,
			// The "once per Scene" grant is tracked entirely via system.attributes.eidolonDrive
			// (see summoner-mixin.js's _onEidolonDriveSummon/_eidolonDrive) — its summonedAllyId/
			// bonusUsed shape, not a uses checkbox — and cleared by Refresh Scene (the real rules
			// boundary), with Refresh Sortie clearing it too as a defensive superset (see
			// frames-mixin.js). There's no uses entry for this move at all.
			description:
				"<p>This is your Astir Move—if you ever get a new Astir, it can be transferred into the " +
				"new one during Downtime, replacing any Astir Move it might have had. Once per Scene, " +
				"you may power up your eidolon drive to summon an ally from binding. When you do so, " +
				"you may immediately make a move using their approach and trait at +3. They remain by " +
				"your side for the rest of the Scene, giving you access to their trait at +1. Their " +
				"tier is equal to your Astir's.</p>"
		},
		{
			key: "the-summoner:binding",
			name: "Binding",
			// Granted unconditionally via starting-moves.js's grantedKeys (every Summoner starts
			// with this), so no `starting: true` — that flag is reserved for a pick-one starting
			// choice (see Field Scout/Giant Slayer's own comment), which this isn't.
			traits: [],
			// Renders the Bound Allies roster (Social tab — see summoner-mixin.js's
			// _boundAlliesData) once picked. A declarative flag, evaluated generically, rather
			// than a hardcoded move-key check — the same "behaviour that depends on actor state
			// goes in the sheet" pattern grantsHomeInsteadOfChannel (home-mixin.js) already
			// establishes for Adrift's own single-mandatory-move mechanic.
			grantsBoundAlliesRoster: true,
			description:
				"<p>You may magically bind powerful creatures (or groups of weaker ones) to you, " +
				"allowing you to draw them through time and space to your location to aid you " +
				"temporarily. You might do this through force, or you might acquire willing aid " +
				"through other means. However you do it, give them an amount of your Astir's Power " +
				"to perform the binding. This Power is returned 1 point at a time each time that " +
				"ally is summoned via eidolon drive, or all at once if they are released or leave " +
				"your service otherwise. Write down your ally's name, their approach, and a " +
				"trait.</p>"
		},
		{
			key: "the-summoner:enduring-support",
			name: "Enduring Support",
			// "After you summon an ally ... you may use their approach instead of your own for
			// the rest of the Sortie." activatesApproachOverride: true drives an Activate button
			// (see moves-mixin.js's _onMoveActivate) that snapshots the *summoned* ally's own
			// approach into its own persisted field, system.attributes.approachOverride — not a
			// live reference to the summon, since Eidolon Drive's own summon is Scene-scoped (see
			// frames-mixin.js's _onRefreshScene) while this move's own text extends the effect
			// through the rest of the Sortie, so the two need independent lifetimes. Gated (see
			// moves-mixin.js's approachOverrideGated) on the actor currently having a summoned
			// ally with a real approach set — nothing meaningful to snapshot otherwise. Cleared
			// only by Refresh Sortie (see frames-mixin.js's _onRefreshSortie), matching the move's
			// own Sortie-long duration. Resolved into _effectiveApproach (progression-mixin.js)
			// alongside the Attendant's static grantsApproachOverride, but as a dynamic per-roll
			// snapshot rather than a fixed catalog value.
			traits: [],
			activatesApproachOverride: true,
			description:
				"<p>After you summon an ally with your eidolon drive, you may use their approach " +
				"instead of your own for the rest of the Sortie.</p>"
		},
		{
			key: "the-summoner:bonded-in-blood",
			name: "Bonded In Blood",
			// Taking a peril is already the existing Danger "Add" controls
			// (system.attributes.dangers), same reasoning as Cantrips' Fire-Eater/Selfless. "Act
			// with advantage on your next roll" is the grant-Advantage-to-literally-the-next-roll
			// pattern repeatedly left unmechanized elsewhere (Dark Guarantees, If I Go There Will
			// Be Trouble — both cite docs/domains/moves.md's "systems that do not exist yet"); applied by hand
			// at the table via the roll dialog's own Dice select. Allies "won't (or can't) abandon
			// your service" is pure fiction with no tracked state to hook — Release already
			// requires an explicit player click regardless of how an ally was bound.
			traits: [],
			description:
				"<p>You may voluntarily take a peril as part of binding an ally: this counts as an " +
				"extra 1 Power's worth of binding, on top of any you choose to give. If you do so, " +
				"make your first move after summoning them with advantage. Allies bound with bonded " +
				"in blood won't (or can't) abandon your service until all their Power is returned " +
				"point-by-point.</p>"
		},
		{
			key: "the-summoner:spritecraft",
			name: "Spritecraft",
			// Identical in shape to Commander's Withdraw ("start or advance a 4-step clock") —
			// prose only; the player manually adds a 4-step Clock via the existing Clocks section
			// (Social tab) and manages the resulting ally through the ordinary Bound Allies roster
			// once it's ready.
			traits: [],
			description:
				"<p>You may magically create allies for yourself during Downtime as long-term " +
				"projects, requiring a 4-step clock to be filled. They can only sustain themselves " +
				"for a single Sortie's worth of aid, but you may choose what approach they are, and " +
				"they reserve none of your Astir's Power.</p>"
		},
		{
			key: "the-summoner:dynamic-entry",
			name: "Dynamic Entry",
			// Conditionally applying a weapon tag (bane) to a specific triggered attack — weapon
			// tags are static, actor-authored data (see equipment.js's EQUIPMENT_TAGS), not
			// something a move can attach on the fly; no analogous mechanism exists anywhere in
			// this module. Prose only, per docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			description:
				"<p>When you summon an ally and immediately exchange blows or strike decisively via " +
				"them, that attack is considered to have the bane tag.</p>"
		},
		{
			key: "the-summoner:helping-hands",
			name: "Helping Hands",
			traits: [],
			// Renders the single-slot Downtime Ally control (Downtime tab — see
			// summoner-mixin.js's _downtimeAllyData) once picked — a declarative flag,
			// generically evaluated, the same pattern grantsBoundAlliesRoster establishes for
			// Binding above.
			grantsDowntimeAllySlot: true,
			// The "+1 token during Downtime" grant is a restricted Bonus Downtime Tokens pool
			// like any other source (moves/parts/equipment) — see progression-mixin.js's
			// _bonusDowntimeTokensData. A separate flag from grantsDowntimeAllySlot above, which
			// only ever gates the Downtime Ally UI section, not the token grant.
			bonusDowntimeTokens: { max: 1, description: "Only while a Downtime Ally is bound." },
			description:
				"<p>You may also bind an ally to help you in Downtime instead of on Sorties. When " +
				"you do so, instead of writing a trait and their approach, take +1 token during " +
				"Downtime. You may only have one ally bound to you for Downtimes, but 1 Power's " +
				"worth of binding will sustain them for as long as they are in your service.</p>"
		},
		{
			key: "the-summoner:conveyance",
			name: "Conveyance",
			// Cross-actor Astir linking/portals between two players' own Astirs — no analogous
			// mechanism exists anywhere in this module (every roll/state change is scoped to one
			// actor's own sheet). Prose only, per docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			description:
				"<p>When another Channeler lays a hand on your eidolon drive, they may link their " +
				"Astir to yours. During Downtime, or when you weave magic, you may open a portal " +
				"between your Astirs. If you wove magic to do this, it closes at the end of the " +
				"Scene or potentially earlier as a consequence of another move.</p>"
		},
		{
			key: "the-summoner:living-drive",
			name: "Living Drive",
			traits: [],
			// "You may use it outside of an Astir" — ungates Eidolon Drive's Summon button (and
			// Roll/Activate generally, were it ever to gain one) from the Astir Moves group's
			// mounted-frame check specifically (see moves-mixin.js's
			// _grantsUnpilotedAstirMove/_movesData). The rest of the text needs no code: bound
			// allies already always display the Astir's own tier regardless of piloted state (see
			// _moveTraits' unconditional eidolon-drive-ally push), and this character's own
			// on-foot Tier already defaults to tier I with nothing here that would raise it.
			grantsUnpilotedAstirMove: { moveKey: "the-summoner:eidolon-drive" },
			description:
				"<p>You are your eidolon drive. You may use it outside of an Astir, and your " +
				"binding allies are still considered to be the same tier as your Astir: though you " +
				"yourself are tier I as usual. If you have the conveyance move, you may open a " +
				"portal between an Astir and you.</p>"
		}
	]
};
