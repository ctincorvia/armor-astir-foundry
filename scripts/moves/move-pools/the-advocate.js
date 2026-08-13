export const THE_ADVOCATE_POOL = {
	key: "the-advocate",
	label: "The Advocate",
	playbookName: "The Advocate",
	moves: [
		{
			key: "the-advocate:earthly-ally",
			name: "Earthly Ally",
			// Earthly Ally and Titanic are alternate identities ("pick either"), not merely
			// alternate skill picks — exclusiveGroup keeps both the "+" picker and the Astir's own
			// bonus-move picker from ever offering the sibling once one is picked (see
			// pickerSection in this file). The chargen picker already enforces this via
			// pickOneKeys (starting-moves.js); this closes the same gap in every other picker
			// drawing from this pool.
			exclusiveGroup: "the-advocate:starting-move",
			// The location-conditional CHANNEL variance ("+1 in areas where nature has been destroyed,
			// +3 in areas of unmarked natural beauty") can't be mechanized — there's no location-state
			// system anywhere in this module (see docs/domains/moves.md's "systems that do not exist yet"). Prose only.
			traits: [],
			description:
				"<p>You are person-sized, and pilot an Astir as usual—though your Astir is likely a " +
				"natural work, grown through magical rituals or built using sustainable materials. Your " +
				"CHANNEL is treated as +1 in areas where nature has been destroyed, and +3 in areas of " +
				"unmarked natural beauty. When you teach someone a truth about the natural world, advance " +
				"a GRAVITY clock if you have one with them.</p>"
		},
		{
			key: "the-advocate:titanic",
			name: "Titanic",
			exclusiveGroup: "the-advocate:starting-move",
			traits: [],
			// "You may use subsystems even while not in your Astir form" needs zero code: subsystems
			// (moves.js SPECIAL_MOVES) is never gated on the mounted frame at all — only the Astir Moves
			// group (Parts + the Astir's own unique Move) forces `gated: mountedFrame?.id !== "astir"`
			// in getData, and the per-Part Expended `uses` checkbox in playbook-actor-sheet.hbs
			// (.move-use-checkbox) renders with no gated/disabled binding regardless of mounted state.
			// This clause is already true today with no changes needed anywhere.
			description:
				"<p>You yourself are a force of nature, capable of taking a form as mighty as any dragon, " +
				"giant or war machine. Your Astir is this secondary form, and you may shift between it and " +
				"whatever your usual appearance is at will. You may use subsystems even while not in your " +
				"Astir form, temporarily manifesting parts of its power. When you destroy something that " +
				"threatens nature directly, advance a GRAVITY clock with someone surprised by your power.</p>"
		},
		{
			key: "the-advocate:woodland-whispers",
			name: "Woodland Whispers",
			traits: [],
			description:
				"<p>When the world is suffering, it whispers to you. You know where it is hurting, and who " +
				"is to blame.</p>"
		},
		{
			key: "the-advocate:all-things-great-and-small",
			name: "All Things Great And Small",
			traits: [],
			description:
				"<p>You have a deep and broad knowledge of all living creatures (either through study or " +
				"your magic) and can easily identify their habitats, natural predators, food sources and " +
				"common illnesses among other things.</p>"
		},
		{
			key: "the-advocate:a-greener-world",
			name: "A Greener World",
			traits: [],
			// "When you roll +CHANNEL and get a result of 12+" targets Weave Magic specifically (the
			// only +CHANNEL basic move) — see moves.js#isCriticalResult/
			// PlaybookActorSheet#_grantedCriticalReminderForMove.
			addsCriticalReminderToMove: {
				moveKeys: ["weave-magic"],
				reminder: "New flora and fauna spring to life nearby"
			},
			description:
				"<p>When you roll +CHANNEL and get a result of 12+, new flora and fauna starts to spring " +
				"to life in the area, even in ruined places. Wildlife that had been forced out begins to " +
				"return, and infertile ground is made fertile once again.</p>"
		},
		{
			key: "the-advocate:built-different",
			name: "Built Different",
			traits: [],
			// "Requires: Titanic" is enforced via requiresMoves (see docs/domains/moves.md's "Adding move
			// content") — unmetMoveRequirements/moveRequirementTooltip disable this move in the
			// picker (and re-gate it on the sheet) until Titanic is picked. "You become tier IV"
			// still needs no mechanic — Tier is already a freely player-editable field within the
			// Astir's existing 3-4 range (ASTIR_TIER_MIN/ASTIR_TIER_MAX in astir.js already allow
			// 4), so this move just narrates picking the top of that existing range.
			requiresMoves: ["the-advocate:titanic"],
			description:
				"<p>Your Astir-sized form is your only one: you have no other shape you can take. This is " +
				"inconvenient in many situations, on account of you being very very large. As a " +
				"trade-off, you become tier IV.</p>"
		},
		{
			key: "the-advocate:natures-bounty",
			name: "Nature's Bounty",
			traits: ["channel"],
			results: {
				success: "Everyone gains an additional token during the next Downtime if they spend it " +
					"here.",
				mixed: "As above, but you must either give up leading a Scene yourself, or your usual 2 " +
					"tokens.",
				failure: null
			},
			// The grant is party-wide ("everyone gains a token") and conditional on spending it
			// "here," neither of which this actor-scoped mechanic can express — prose only, per
			// docs/domains/moves.md's "systems that do not exist yet".
			description:
				"<p>When you imbue a place with life, using your connections to the natural world to " +
				"support and bolster it, roll +CHANNEL.</p>" +
				"<p>On a 10+, everyone gains an additional token during the next Downtime if they spend " +
				"it here. On a 7-9, as above, but you must either give up;</p>" +
				"<ul>" +
				"<li>Leading a Scene yourself.</li>" +
				"<li>Your usual 2 tokens.</li>" +
				"</ul>" +
				"<p>You may freely roll this before Downtime begins if you don't get chance to during the " +
				"Sortie, though your Director might impose disadvantage, desperation, or even rule that " +
				"the move is impossible based on your location. It's hard to invoke the life and force of " +
				"nature in the middle of a completely man-made structure, for example.</p>"
		},
		{
			key: "the-advocate:chimaeric",
			name: "Chimaeric",
			traits: [],
			// No creature-shapeshifting/"form" tracking system exists anywhere in this module (see
			// docs/domains/moves.md's "systems that do not exist yet"). The Titanic branch's "choose a Part or
			// Weapon to take as an Extra every Sortie" needs no new mechanism either — Astir Parts/
			// Weapons are already freely added/removed at any time via the existing Astir tab controls,
			// with no per-Sortie cap to swap around (unlike Ardents' own ARDENT_MAX_LOADOUT — the Astir
			// itself has no such cap, per astir.js and the Astir mixin). Prose only.
			description:
				"<p>You are able to freely invoke and weave together the power of different parts of " +
				"nature. If you have Earthly Ally, you may temporarily take the form of any creature you " +
				"have seen (though you must weave magic to turn into something notably larger than " +
				"yourself). Being put in peril undoes your shapeshifting. If you have Titanic, your " +
				"secondary form becomes mutable: you may choose a Part or Weapon to take as an Extra " +
				"every Sortie. You may choose a different one every time.</p>"
		},
		{
			key: "the-advocate:lay-down-roots",
			name: "Lay Down Roots",
			traits: [],
			// No death/incapacitation system exists anywhere in this module — "when you die" is
			// narrative flavor text describing what happens, the same treatment the-wither:
			// number-of-the-beast's own "killed in a spectacular fashion" text gets above (see
			// docs/domains/moves.md's "systems that do not exist yet"). "Requires: Nature's Bounty" is
			// enforced via requiresMoves, same treatment the other module prerequisites get.
			requiresMoves: ["the-advocate:natures-bounty"],
			description:
				"<p>When you die, you become one with the earth. Life springs forth in the brightest of " +
				"hues, flourishing in your wake: nature's bounty applies permanently here, and can never " +
				"be undone or removed.</p>"
		}
	]
};
