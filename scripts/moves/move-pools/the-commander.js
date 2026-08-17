export const THE_COMMANDER_POOL = {
	key: "the-commander",
	label: "The Commander",
	playbookName: "The Commander",
	moves: [
		// Ace Crew and Debrief are the two Starting Moves ("you start with... as well as one
		// other from your Additional Moves") — see starting-moves.js, which reads their own
		// grantedKeys rather than this pool's starting flag. Every move below them is an
		// Additional Move.
		{
			key: "the-commander:ace-crew",
			name: "Ace Crew",
			starting: true,
			traits: [],
			// The named-crew-with-adjectives roster this move's own text asks for lives at
			// system.attributes.aceCrew (see PlaybookActorSheet#getData's aceCrew, its own
			// section on the Social tab) — reuses entry-list.js's CRUD helpers, same pattern
			// Carrier's Crew Members already establish. tierBonus is the other half ("counts as
			// one tier higher"): summed across picked moves by _conflictTier, on top of both the
			// foot-combat base and whatever frame is currently mounted.
			tierBonus: 1,
			description:
				"<p>You have a team of 3-5 well-trained individuals who work with you as a " +
				"coordinated team. Give each of them a name, and an adjective or two to describe " +
				"them.</p>" +
				"<p>Your tier and that of whatever weaponry you use counts as one higher than " +
				"whatever it would normally be for your situation: on foot together you count as " +
				"tier II, crewing an Ardent you count as tier III, and so on. You can pilot " +
				"separate Ardents if desired, but must be acting together as one consistent unit " +
				"to gain these benefits, and are always treated as a single unit rather than " +
				"individual actors.</p>"
		},
		{
			key: "the-commander:debrief",
			name: "Debrief",
			starting: true,
			traits: [],
			// See PlaybookActorSheet#_downtimeTokensMax, summed across picked moves the same way
			// _conflictTier sums tierBonus above.
			downtimeTokensMax: 4,
			description:
				"<p>You exist within a structure, and must report up. During Downtime, instead of " +
				"leading a Scene as usual, you must report to your superiors, marking a point of " +
				"Spotlight. Additionally, you have a total of 4 tokens to spend instead of 2, as " +
				"your Ace Crew works hard to support you.</p>"
		},
		{
			key: "the-commander:withdraw",
			name: "Withdraw",
			traits: ["talk"],
			results: {
				success: "You manage to justify your actions.",
				mixed: "Give up 1 token next Downtime as you are reprimanded for your 'cowardice'.",
				failure: "Start or advance a 4-step clock titled 'court-martialled'."
			},
			description:
				"<p>You may retreat with your crew safely from any situation. When you do so, " +
				"roll +TALK; on a 10+, you manage to justify your actions. On a 7-9, give up 1 " +
				"token next Downtime as you are reprimanded for your 'cowardice'. On a 6-, start " +
				"or advance a 4-step clock titled 'court-martialled'.</p>"
		},
		{
			key: "the-commander:retrofit",
			name: "Retrofit",
			traits: [],
			description:
				"<p>During Downtime, your crew may spend 1 token to swap out one of your Ardent " +
				"Features for another from the list. Alternatively, you may spend 2 tokens to " +
				"swap all of them.</p>"
		},
		{
			key: "the-commander:requisitions",
			name: "Requisitions",
			traits: [],
			// Raises the Ardent Feature pool's own cap by 2 — see ardent.js's ardentFeatureMax,
			// summed across picked moves.
			ardentFeatureBonus: 2,
			description:
				"<p>Choose an additional 2 Ardent Features, as your Custom Ardent is upgraded " +
				"with new weaponry and equipment. If any members of your Ace Crew have died, you " +
				"may also replace them.</p>"
		},
		{
			key: "the-commander:watch-this",
			name: "Watch This",
			traits: [],
			grantsRollModifier: [{ moveKeys: ["weather-the-storm"], advantage: "advantage", costsSpotlight: 3 }],
			description:
				"<p>You may spend 3 Spotlight to quickly manoeuvre your crew or an Ardent they " +
				"are crewing to any location within sight, even if the path there would be " +
				"dangerous or difficult. If your Director insists that it would be impossible or " +
				"completely deadly, take advantage on the weather the storm required to prove " +
				"them wrong.</p>"
		},
		{
			key: "the-commander:bail-out",
			name: "Bail Out",
			traits: [],
			description:
				"<p>You may, at any point, declare that your Custom Ardent is about to explode. " +
				"Replace all your current dangers with one peril (Bailed Out) as everyone escapes " +
				"just in time, leaving you without it until you repair it during Downtime " +
				"(costing 3 tokens, and removing the 'bailed out' peril). At the Director's " +
				"discretion, the explosion might also affect other things in the Scene.</p>"
		},
		{
			key: "the-commander:tactical-entry",
			name: "Tactical Entry",
			traits: [],
			description:
				"<p>When you drive or fly your Custom Ardent through the side of a building, you " +
				"can be certain it will remain structurally sound for exactly as long as you need " +
				"it to be.</p>"
		},
		{
			key: "the-commander:support-company",
			name: "Support Company",
			traits: [],
			// 7 candidate tags, each a manual per-Sortie checkbox reusing the existing uses
			// mechanism — "an additional two... per Sortie" isn't enforced as a hard cap here,
			// matching this module's existing non-enforcement stance elsewhere (pool
			// restrictions, MAX_TAGS only enforced in configureEquipment's own dialog).
			uses: [
				{ key: "bane", label: "Bane", period: "Sortie" },
				{ key: "ranged", label: "Ranged", period: "Sortie" },
				{ key: "sniper", label: "Sniper", period: "Sortie" },
				{ key: "blitz", label: "Blitz", period: "Sortie" },
				{ key: "defensive", label: "Defensive", period: "Sortie" },
				{ key: "decisive", label: "Decisive", period: "Sortie" },
				{ key: "adapted", label: "Adapted", period: "Sortie" }
			],
			description:
				"<p>You also have a squad of footsoldiers that you lead into battle. The exact " +
				"amount of men depends on the scale of your campaign. Treat them as a Tier I " +
				"squad under your command, with one danger slot and melee weapons by default.</p>" +
				"<p>They are also kitted out with an additional two of the following tags per " +
				"Sortie: bane, ranged, sniper, blitz, defensive, decisive, adapted.</p>"
		}
	]
};
