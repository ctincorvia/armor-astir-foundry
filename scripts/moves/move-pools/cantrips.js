export const CANTRIPS_POOL = {
	key: "cantrips",
	label: "Cantrips",
	note: "Any playbook may take these in place of a move from their own pool.",
	moves: [
		{
			key: "cantrips:classical-spellcasting",
			name: "Classical Spellcasting",
			// No roll of its own — it's a standing permission to reroll a Basic Move with
			// +CHANNEL instead of its usual Trait, which would mean offering CHANNEL as an
			// extra option on every Basic Move's own roll dialog. That cross-cutting change
			// isn't built; a player with this Cantrip applies it themselves when picking a
			// trait to roll. The move's own violent-use profile ("Hand-casting II") references
			// weapon profiles/tags, which also don't exist yet — see Advanced Evocation below.
			traits: [],
			description:
				"<p>Choose a Basic Move: while out of your Astir, you may roll it with +CHANNEL instead of " +
				"the usual Trait. If things go wrong, your magic backfires. Using magic to exploit people's " +
				"emotions and minds is as bad as using magic to hurt them, and will be remembered as such. " +
				"If you do use magic violently, use the following profile:</p>" +
				"<ul><li>Hand-casting II (ranged / area)</li></ul>"
		},
		{
			key: "cantrips:advanced-evocation",
			name: "Advanced Evocation",
			// "Requires: Classical Spellcasting" is enforced via requiresMoves (see docs/domains/moves.md's
			// "Adding move content") — disabled in the picker until Classical Spellcasting is
			// picked, and re-gated live on the sheet if it's ever removed afterward. The tag choice
			// itself is still blocked on the same not-yet-built weapon profiles/tags system as
			// Classical Spellcasting's own profile.
			requiresMoves: ["cantrips:classical-spellcasting"],
			traits: [],
			description:
				"<p><em>Requires: Classical Spellcasting.</em></p>" +
				"<p>Choose one of the following tags (defensive, decisive, restraining, impact); when you " +
				"use classical spellcasting violently, add that tag to the above profile. At your " +
				"Director's discretion, you may choose a tag not on the above list or create a new one " +
				"entirely.</p>"
		},
		{
			key: "cantrips:dont-die-yet",
			name: "Don't Die Yet",
			// No stated usage cap (contrast Seek Allies/Personal Familiar below), so nothing to
			// track — the grant is narrated each time it comes up.
			traits: [],
			description:
				"<p>When you enter battle with a group of allies, give up to four people (including " +
				"yourself) advantage when they next bite the dust.</p>"
		},
		{
			key: "cantrips:seek-allies",
			name: "Seek Allies",
			traits: [],
			uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
			description:
				"<p>Once per Sortie, you may summon a cadre of creatures, spirits, elementals or otherwise " +
				"to assist you in combat. When you do so, you may act as a squad until the end of the " +
				"scene.</p>"
		},
		{
			key: "cantrips:haste",
			name: "Haste",
			traits: [],
			description:
				"<p>If there is a question of who acts first in a situation, the answer is you. If multiple " +
				"characters with haste are all attempting to be the quickest, they act simultaneously.</p>"
		},
		{
			key: "cantrips:deny",
			name: "Deny",
			traits: ["channel"],
			description:
				"<p>When you use magic to temporarily restrict the actions of another, roll +CHANNEL.</p>" +
				"<p>On a 10+, you prevent them from taking a single action or move.</p>" +
				"<p>On a 7-9, you still prevent them, but only because you or someone else rushes to act " +
				"against them — whoever does, acts in desperation.</p>",
			results: {
				success: "You prevent them from taking a single action or move.",
				mixed: "You still prevent them, but only because you or someone else rushes to act " +
					"against them — whoever does, acts in desperation.",
				failure: null
			}
		},
		{
			key: "cantrips:fire-eater",
			name: "Fire-Eater",
			// No new plumbing needed: taking a peril is already the existing Danger "Add"
			// controls (system.attributes.dangers), and acting with confidence is already the
			// Effect select in the roll dialog (roll-effects.js) — this move just combines two
			// controls that already exist, rather than needing one of its own.
			traits: [],
			description:
				"<p>You may take a peril (seared, volatile, overcharged) to untick 'overheating' from your " +
				"Astir and act with confidence.</p>"
		},
		{
			key: "cantrips:all-in",
			name: "All In",
			// The extra-Advantage-for-Desperation trade would mean stacking a second Advantage
			// state on top of whatever a roll already has, which roll-effects.js's
			// ADVANTAGE_STATES/EFFECT_STATES don't model (each roll picks exactly one of
			// each) — not built; applied by hand at the table for now.
			traits: [],
			description:
				"<p>When you have advantage on a move, you may take an additional advantage at the cost of " +
				"also acting in desperation.</p>"
		},
		{
			key: "cantrips:lifesense",
			name: "Lifesense",
			traits: [],
			description:
				"<p>You have a keen sense of where all living creatures around you up to sniper distance " +
				"are, as well as roughly how strong their life force is—living things close to death, for " +
				"example, seem more faint and difficult to conceive of in this way.</p>"
		},
		{
			key: "cantrips:truth-making",
			name: "Truth-making",
			// "When you read the room, on a 12+ ..." targets Read the Room specifically — see
			// moves.js#isCriticalResult/PlaybookActorSheet#_grantedCriticalReminderForMove.
			traits: [],
			addsCriticalReminderToMove: {
				moveKeys: ["read-the-room"],
				reminder: "You may answer one of your questions yourself"
			},
			description:
				"<p>When you read the room, on a 12+ you may answer one of your questions yourself—though " +
				"your answer must be within the relative realm of possibility.</p>"
		},
		{
			key: "cantrips:personal-familiar",
			name: "Personal Familiar",
			traits: [],
			uses: [
				{ key: "sortie", label: "Ignored a disadvantage this Sortie", period: "Sortie" },
				// No period — Downtime isn't a resettable button in this module (see
				// PlaybookActorSheet#_refreshPeriod), so this stays purely manual.
				{ key: "downtime", label: "Reported back this Downtime" }
			],
			downtimeAbility: "Once per Downtime, your familiar reports back on a Scene you weren't present for.",
			description:
				"<p>You have a small familiar that aids you, like an animal companion or spirit or summoned " +
				"creature. Once per Sortie, you can ignore a single disadvantage as they help you out of " +
				"trouble. Once per Downtime, they can report back to you about the events of a Scene you " +
				"weren't present for.</p>"
		}
	]
};
