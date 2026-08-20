export const CANTRIPS_POOL = {
	key: "cantrips",
	label: "Cantrips",
	note: "Any playbook may take these in place of a move from their own pool.",
	moves: [
		{
			key: "cantrips:classical-spellcasting",
			name: "Classical Spellcasting",
			// addsTraitToMove.chooseMove offers +CHANNEL as an extra option on whichever Basic Move the
			// player picks (dropdown on this move's own row), additive not replacing — same shape The Old
			// Blood's requiresUnmounted uses, just with the target move chosen per-actor instead of fixed
			// in the catalog (mirrors trait-bonuses.js's own chooseTrait).
			//
			// grantsEquipment snapshots the rulebook's own violent-use profile onto the actor the moment
			// this move is newly picked (see move-tracking-mixin.js's _onPlaybookMoveAdd/
			// _grantedMoveEquipmentUpdate) — the same _startingGearEntry treatment a starting-gear grant
			// already gets (equipment-mixin.js), just triggered by picking this move instead of character
			// creation. Named "Hand-casting" without the "II" — no equipment stores its own Tier in this
			// module (see docs/domains/equipment.md's Tier note); it's derived from the wielder like
			// every other mundane weapon. Advanced Evocation's own tag choice below extends this same
			// Hand-casting profile once picked.
			traits: [],
			addsTraitToMove: { chooseMove: true, trait: "channel", requiresUnmounted: true },
			grantsEquipment: {
				kind: "weapon",
				name: "Hand-casting",
				tags: ["ranged", "area"],
				scale: "foot"
			},
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
			// picked, and re-gated live on the sheet if it's ever removed afterward.
			//
			// grantsWeaponTagChoice mirrors grantsWeaponTags (Signed & Sealed, equipment-mixin.js) but
			// scoped to one specific granted weapon by name, rather than every weapon uniformly, and with
			// a per-actor *chosen* tag rather than a fixed set — the same chooseMove/chooseTrait shape
			// this pool's own Classical Spellcasting and trait-bonuses.js already use for "the rulebook
			// picks the mechanism, the player picks the value." Resolved by equipment-mixin.js's
			// _weaponTagKeys, never persisted onto Hand-casting's own stored tags — dropped instantly if
			// Advanced Evocation is ever removed. The list is only the four named tags; "or create a new
			// one entirely" is Director's-discretion prose, deliberately left unbuilt (same call already
			// made for Complex Spellwork's variable Power cost — see astir-parts.js).
			requiresMoves: ["cantrips:classical-spellcasting"],
			traits: [],
			grantsWeaponTagChoice: {
				targetEquipmentName: "Hand-casting",
				options: ["defensive", "decisive", "restraining", "impact"]
			},
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
				"<p>On a 7-9, you prevent them from taking a single action or move. You or someone else " +
				"immediately moves to act against them in desperation.</p>",
			results: {
				success: "You prevent them from taking a single action or move.",
				mixed: "You prevent them from taking a single action or move. You or someone else " +
					"immediately moves to act against them in desperation.",
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
			// An ordinary grantsRollModifier entry, composable with any other checked Roll Modifier
			// via the roll dialog's own live chain (see roll-chain.js's resolveRollChain): +1
			// Advantage and -1 Effect, gated to only apply while the roll's currently-resolved
			// Advantage is exactly "advantage" — the rulebook's own "when you have advantage"
			// condition. requiresAdvantage is re-checked against the chain's *running* state each
			// time it's this entry's turn, so checking All In after something else has already
			// pushed Advantage past "advantage" (e.g. to "advantage2") correctly makes it
			// inapplicable, and checking it before Advantage reaches "advantage" is inapplicable too.
			traits: [],
			grantsRollModifier: [{ advantage: "advantage", effect: "desperation", requiresAdvantage: ["advantage"] }],
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
			uses: [{ key: "sortie", label: "Ignored a disadvantage this Sortie", period: "Sortie" }],
			downtimeAbility: "Once per Downtime, your familiar reports back on a Scene you weren't present for.",
			description:
				"<p>You have a small familiar that aids you, like an animal companion or spirit or summoned " +
				"creature. Once per Sortie, you can ignore a single disadvantage as they help you out of " +
				"trouble. Once per Downtime, they can report back to you about the events of a Scene you " +
				"weren't present for.</p>"
		}
	]
};
