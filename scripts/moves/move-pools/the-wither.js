export const THE_WITHER_POOL = {
	key: "the-wither",
	label: "The Wither",
	playbookName: "The Wither",
	moves: [
		{
			key: "the-wither:born-to-die",
			name: "Born To Die",
			// Unconditionally granted (see starting-moves.js's grantedKeys) — mirrors Tenets/Prepare
			// Rituals/Patron's own unconditional-grant treatment, no `starting: true` marker needed on
			// the move itself.
			traits: [],
			// Prose only — subsystems (moves.js SPECIAL_MOVES) has no enforced Power-spend mechanic to
			// override today (traits: [], no flatHold), so there's nothing here to hook a "risk instead
			// of Power" override into. See docs/domains/moves.md's "systems that do not exist yet".
			description:
				"<p>You may use the subsystems move by taking a risk instead of spending Power.</p>"
		},
		{
			key: "the-wither:dark-rebirth",
			name: "Dark Rebirth",
			traits: [],
			// A new variant of the existing grantsAutomaticSuccess mechanism (Hot-blooded/Once the War's
			// Over/The Arity Method): instead of spending this move's own hold/uses pool, the "cost" is
			// adding a Danger of type peril to the actor, gated on the actor currently holding zero
			// peril-type Dangers (see PlaybookActorSheet#_availableAutomaticSuccess). Scoped to
			// bite-the-dust only, same `moves` restriction The Arity Method already uses.
			grantsAutomaticSuccess: { moves: ["bite-the-dust"], costsPeril: true },
			description:
				"<p>If you are forced to bite the dust and have no perils, you may put yourself in peril to " +
				"succeed as if you rolled a 10+. Say what dark rite or power saves you.</p>"
		},
		{
			key: "the-wither:number-of-the-beast",
			name: "Number Of The Beast",
			traits: [],
			// A standing effect on every roll this actor makes (see moves.js#explodeSixes and
			// PlaybookActorSheet#_hasExplodingSixes), not scoped to one target move key — the same
			// "actor-wide, not move-scoped" shape Cold Company's own grantsHauntedStandingRoll needs
			// below, rather than the single-move grantsAdvantageOnMove/grantsEffectOnMove/
			// addsTraitToMove trio.
			grantsExplodingSixes: true,
			description:
				"<p>Whenever you roll a 6, roll an additional die and add it to the total for that roll. " +
				"If you ever roll three 6's during one move, you are killed in a spectacular fashion at " +
				"the nearest suitable moment.</p>"
		},
		{
			key: "the-wither:cold-company",
			name: "Cold Company",
			traits: [],
			// Reuses the existing generic `uses` checkbox (system.attributes.moveUses.<key>.dispelled),
			// rendered and manually toggleable via the existing _onMoveUseToggle handler with zero new
			// code — but also read/written automatically: see PlaybookActorSheet#_coldCompanyAdvantage
			// (every roll's Dice-select lock) and #_onMoveResolved (auto-flip on 10+/6-).
			uses: [{
				key: "dispelled",
				label: "Dispelled"
			}],
			grantsHauntedStandingRoll: { useKey: "dispelled" },
			description:
				"<p>You are constantly followed by one or more spectres/ghosts/ghouls from your past. " +
				"Make all rolls with disadvantage until you succeed on a move with a 10+ (dispels the " +
				"haunting for a while: roll with advantage until you fail on a move with a 6-, at which " +
				"point disadvantage returns and the cycle begins anew).</p>"
		},
		{
			key: "the-wither:the-old-blood",
			name: "The Old Blood",
			traits: [],
			// Real: +CHANNEL becomes an offered rollable trait on Exchange Blows/Strike Decisively,
			// additive not replacing — same addsTraitToMove shape Turn Unearthly (the-paradigm:
			// turn-unearthly) uses, but gated `requiresUnmounted: true` since this move's own text
			// ("if you are outside your Astir and fighting on foot") restricts the grant to when no
			// frame is mounted, unlike Turn Unearthly's unconditional text. Resolved generically by
			// moves-mixin.js#_moveTraits (no new code needed beyond this declaration).
			addsTraitToMove: {
				moveKeys: ["exchange-blows", "strike-decisively"],
				trait: "channel",
				requiresUnmounted: true
			},
			description:
				"<p>If you are outside your Astir and fighting on foot, you can exchange blows and strike " +
				"decisively with +CHANNEL when attempting to cause physical harm. When appropriate, you will " +
				"obtain a tier I melee weapon with bane and one of the following tags of your choice: " +
				"concealable, area, impact, blitz, ruin/reloading.</p>"
			// The weapon-grant half has no grant mechanism anywhere in the codebase (Soldier's Nightmare of
			// Solomon/Field Scout/Giant Slayer all leave this manual) — player builds it via the Equipment
			// tab's configureEquipment editor, matching every existing precedent. No code needed.
		},
		{
			key: "the-wither:wretched-visage",
			name: "Wretched Visage",
			traits: [],
			description:
				"<p>Nobody can look directly at you without taking a risk, friend or foe. People shy " +
				"from your presence, and turn to avoid your gaze.</p>"
		},
		{
			key: "the-wither:fresh-hells",
			name: "Fresh Hells",
			traits: [],
			description:
				"<p>When you weave magic to terrify, sicken or disgust, you can affect even the most jaded " +
				"or strong-willed individuals, regardless of their experience with the profane.</p>"
		},
		{
			key: "the-wither:abyssal-summons",
			name: "Abyssal Summons",
			traits: [],
			description:
				"<p>When you weave magic, you are capable of disrupting that which anchors us in place and " +
				"time, and can reach out to wrest a person free of their current location and conjure them " +
				"to yours, regardless of distance. To do so, you must either have a strong bond with them " +
				"(i.e a GRAVITY clock), possession of something of deep personal importance to them, or for " +
				"them to have a peril you have inflicted.</p>"
		},
		{
			key: "the-wither:dark-guarantees",
			name: "Dark Guarantees",
			// "Act with confidence and advantage on that move" has no roll to hook into: both born-to-die
			// (this same pool, above) and the subsystems move it triggers are traits: [] with no results
			// or flatHold -- neither is ever rollable, so there is no move-roll dialog to attach a real
			// grantsRollModifier entry to. Per the project owner: shown in every OTHER move's Roll
			// Modifiers section as a reminder-only entry instead (reminderOnly: true) -- description text,
			// no Activate control, no state mutation. "Take a peril instead of a risk" needs no code
			// either -- Dangers are already manually typed risk/peril by the player (tracking-mixin.js).
			traits: [],
			grantsRollModifier: [{ reminderOnly: true }],
			description:
				"<p>When you use born to die, you may take a peril instead of a risk. If you do, act with " +
				"confidence and advantage on that move.</p>"
		}
	]
};
