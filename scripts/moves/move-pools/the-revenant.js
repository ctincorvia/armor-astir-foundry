export const THE_REVENANT_POOL = {
	key: "the-revenant",
	label: "The Revenant",
	playbookName: "The Revenant",
	moves: [
		{
			key: "the-revenant:never-quite-free",
			name: "Never Quite Free",
			// Unconditionally granted (see starting-moves.js's grantedKeys) — same no-`starting`-
			// marker-needed treatment every other unconditional starting move gets.
			traits: ["channel"],
			// "This move replaces bite the dust for you" is now mechanically enforced via
			// disablesMove: picking this move disables bite-the-dust's Roll button (see
			// moves-mixin.js's _moveGroupMoves), rather than leaving the player expected to
			// simply not roll it. No forcesDesperationAtMaxPerils either — unlike bite-the-dust,
			// this move's own rules text never restates that clause, so it isn't backfilled here.
			// The 6- result's CHANNEL reduction and "you pass on" consequence stays prose only,
			// manually executed by the player — the same manual-tracker convention Once the War's
			// Over's identical "you will perish" text gets.
			disablesMove: { moveKey: "bite-the-dust" },
			description:
				"<p>This move replaces bite the dust for you. You have already died once, and it is " +
				"incredibly difficult to vanquish what has remained of you: when you are defenceless " +
				"or risk harm so severe it might destroy you outright, roll +CHANNEL;</p>" +
				"<p>On a 10+, your spirit lashes out at those that would try to strike you down: they " +
				"are forced to take a risk and you may clear one if you have any.</p>" +
				"<p>On a 7-9, you struggle to keep it together: take disadvantage on your next " +
				"move.</p>" +
				"<p>On a 6-, you survive at the cost of weakening your remaining tie to this world. " +
				"Reduce your CHANNEL by 1—if this would reduce it below 0, you are no longer able to " +
				"hold yourself and your Astir together. You pass on, leaving it and this world " +
				"behind.</p>",
			results: {
				success: "Your spirit lashes out at those that would try to strike you down: they " +
					"are forced to take a risk and you may clear one if you have any.",
				mixed: "You struggle to keep it together: take disadvantage on your next move.",
				failure: "You survive at the cost of weakening your remaining tie to this world. " +
					"Reduce your CHANNEL by 1—if this would reduce it below 0, you are no longer " +
					"able to hold yourself and your Astir together. You pass on, leaving it and this " +
					"world behind."
			}
		},
		{
			key: "the-revenant:unfettered",
			name: "Unfettered",
			traits: [],
			description:
				"<p>You are, broadly speaking, unaffected by toxins, diseases, hunger, thirst, or any " +
				"other typical biological or material concerns you were bound by in life. Ignore " +
				"them entirely. Additionally, any magic or device that tracks or detects the living " +
				"does not function on you, and any magic that would specifically kill rather than " +
				"causing harm that might result in death is ineffective on you also. You're already " +
				"dead.</p>"
		},
		{
			key: "the-revenant:joyride",
			name: "Joyride",
			traits: ["channel"],
			// Two consequences here have no mechanical hook and stay narrated: (a) "your old Astir
			// falls quiet and you take control of this one instead" — system.attributes.astir is a
			// hard 1:1 singleton on the actor with zero cross-actor transfer architecture, so
			// there's nowhere in the data model to move this Astir's state to; (b) "act in
			// desperation until you roll a 10+" — no "locked in Desperation until a specific future
			// roll" mechanism exists anywhere (Confidence/Desperation is a per-roll dialog choice,
			// not standing state). Both are per docs/domains/moves.md's "systems that do not exist yet".
			description:
				"<p>You may transfer your spectral being into another Astir. Take disadvantage if " +
				"there is already a Channeler controlling it, and roll +CHANNEL;</p>" +
				"<p>On a 10+, your old Astir falls quiet and you take control of this one instead. " +
				"Your mark transfers to it, also.</p>" +
				"<p>On a 7-9, as above, but you struggle to control this new form: act in " +
				"desperation until you roll a 10+.</p>",
			results: {
				success: "Your old Astir falls quiet and you take control of this one instead. Your " +
					"mark transfers to it, also.",
				mixed: "As above, but you struggle to control this new form: act in desperation " +
					"until you roll a 10+.",
				failure: null
			}
		},
		{
			key: "the-revenant:knower-of-ruin",
			name: "Knower Of Ruin",
			traits: [],
			description:
				"<p>When you look over the remains of a battle, you can easily piece together how it " +
				"went and who took part. You can bring forth the spirits of anyone who perished there " +
				"for a short time to talk to them, though they remember little beyond the battle " +
				"itself.</p>"
		},
		{
			key: "the-revenant:aint-no-grave",
			name: "Ain't No Grave",
			traits: [],
			// The literal rules text ("roll never quite free ... to upgrade THAT [separate,
			// already-posted] result") has no precedent anywhere in this codebase — every existing
			// grantsAutomaticSuccess source only ever flags the *current* roll, never a different,
			// earlier one already posted to chat (see docs/domains/moves.md's "systems that do not exist
			// yet"). Confirmed with the design owner: rather than build that, this reuses
			// grantsAutomaticSuccess as an offer on the *current* roll of any other qualifying
			// move, spending nothing — no hold/uses/peril, since the source object below carries
			// none of `cost`/`useKey`/`costsPeril` (see _availableAutomaticSuccess's costless
			// fallback branch). The move's own precondition ("you separately rolled never quite
			// free in desperation") is a manual, self-enforced narrative requirement the player
			// handles before clicking, the same non-enforcement stance every other unmodeled
			// precondition in this module already takes. excludeMoves keeps the offer from ever
			// applying to Never Quite Free's own roll, since upgrading that roll with itself makes
			// no sense.
			grantsAutomaticSuccess: { excludeMoves: ["the-revenant:never-quite-free"] },
			description:
				"<p>When you make a move (other than never quite free) and roll a 6-, you may roll " +
				"never quite free in desperation to, regardless of outcome, upgrade that result to a " +
				"10+.</p>"
		},
		{
			key: "the-revenant:ravenous-spectre",
			name: "Ravenous Spectre",
			traits: [],
			// A manual `uses` checkbox stands in for "caused a living being to be in peril" as the
			// trigger -- nothing in this module tracks that condition automatically -- and checking it
			// off is what the deferred grantsRollModifier entry below reads as its costsUse gate,
			// granting Advantage to the actor's next Cool Off once spent (see
			// move-grants-mixin.js's _pendingRollModifierGrant).
			uses: [{ key: "triggered", label: "Caused a living being to be in peril" }],
			grantsRollModifier: [{ moveKeys: ["cool-off"], advantage: "advantage", costsUse: "triggered", deferred: true }],
			description:
				"<p>When you cause a living being to be in peril, take advantage when you next cool " +
				"off as you draw momentum or vigour from them.</p>"
		},
		{
			key: "the-revenant:i-know-you",
			name: "I Know You",
			traits: [],
			// "Roll +3" with no trait/stat selection — a hardcoded fixedTraits entry, the same
			// shape Lead a Sortie's own CREW uses (moves.js), except the static value here is a
			// placeholder: grantsFamiliarityTrait (below) makes it a real actor stat instead,
			// overridden dynamically the same way CREW's own static entry is (see
			// moves-mixin.js's _moveTraits/_familiarityValue). This is what makes the move
			// rollable at all — see moves-mixin.js's `rollable` gate, which now also checks
			// fixedTraits.length.
			//
			// grantsFamiliarityTrait adds a real "familiarity" trait row (stepper, -3..3) to the
			// Traits panel, but only while this move is picked (see progression-mixin.js's
			// _traitsData) — never folded into the shared TRAITS catalog, since that would wrongly
			// surface FAMILIARITY for every non-Revenant actor too. The described "-1 per future
			// use" diminishing bonus is now automated via that stepper: the player decrements it
			// by hand after a 10+, the same manual-tracker convention every other stepped trait
			// already follows (_onTraitStep has no dependency on the TRAITS catalog, so it works
			// for familiarity unchanged).
			grantsFamiliarityTrait: true,
			fixedTraits: [{ key: "familiarity", label: "FAMILIARITY", value: 3 }],
			description:
				"<p>At any time, you or the Director may declare that a character had some " +
				"familiarity with you before you died. Roll +3;</p>" +
				"<p>On a 10+, they were intimately familiar with you: choose one of your Hooks that " +
				"you still share. They will help you follow it where they can, unless forced to do " +
				"otherwise. Reduce the amount you add to this roll in the future by 1.</p>" +
				"<p>On a 7-9, they were loosely familiar with you: choose one of your Hooks that they " +
				"are still undecided about. They might not help you, but they will not stop you " +
				"following it unless forced to.</p>",
			results: {
				success: "They were intimately familiar with you: choose one of your Hooks that you " +
					"still share. They will help you follow it where they can, unless forced to do " +
					"otherwise. Reduce the amount you add to this roll in the future by 1.",
				mixed: "They were loosely familiar with you: choose one of your Hooks that they are " +
					"still undecided about. They might not help you, but they will not stop you " +
					"following it unless forced to.",
				failure: null
			}
		},
		{
			key: "the-revenant:ancient-recall",
			name: "Ancient Recall",
			traits: [],
			flatHold: 3,
			// Mirrors Once the War's Over's own cost-per-spend shape, restricted via The Arity
			// Method's `moves` field to exactly the two moves named in the rules text. No `period`:
			// nothing in this move's own text scopes the hold to a Sortie or Scene, so it isn't
			// cleared by either Refresh button — same treatment Hot-blooded's own hold gets. "When
			// you run out of hold, you lose this move" is a prose reminder only — nothing in this
			// codebase ever auto-revokes a picked move.
			grantsAutomaticSuccess: { cost: 1, moves: ["dispel-uncertainties", "read-the-room"] },
			description:
				"<p>Hold 3. You may spend a point of this hold to succeed on a dispel uncertainties " +
				"or a read the room as per a 10+, describing how your past life gave you familiarity " +
				"with the situation or subject at hand. When you run out of hold, you lose this " +
				"move.</p>"
		},
		{
			key: "the-revenant:rioting-souls",
			name: "Rioting Souls",
			traits: [],
			description:
				"<p>Wherever you go, vengeful spirits of the deceased rise up to join you. They can " +
				"do little by their own, but their presence is very capable of drowning out magic " +
				"used to communicate or observe/listen from a distance. They can also be directed to " +
				"act as a distraction, though they cannot do both at the same time.</p>"
		}
	]
};
