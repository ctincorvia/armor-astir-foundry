export const THE_ARCANIST_POOL = {
	key: "the-arcanist",
	label: "The Arcanist",
	playbookName: "The Arcanist",
	moves: [
		{
			key: "the-arcanist:prepare-rituals",
			name: "Prepare Rituals",
			// Unconditionally granted ("You start with the prepare rituals move") — no `starting: true`
			// marker on the move itself. That flag is reserved for a pick-one starting choice (see
			// Field Scout/Giant Slayer's own comment, and Facilitator's identical reasoning for The
			// Diplomat) — this is a plain grantedKeys entry in starting-moves.js instead.
			traits: [],
			// The effect choice per ritual (make a move in confidence / change the Astir's approach for
			// the Sortie / a nested "hold 2, spend 1-for-1 to ignore a disadvantage" option) isn't
			// mechanically enforced — nothing in this module tracks a set of independently-configurable
			// slots like this. As a middle ground, these three checkboxes track only which of the 3
			// rituals prepared for the current Sortie have already been spent; the player narrates which
			// effect each one represents. `period: "Sortie"` ties them to the existing Refresh Sortie
			// button, the closest existing proxy for "expire when you prepare new ones."
			uses: [
				{ key: "ritual-1", label: "Ritual 1 Spent", period: "Sortie" },
				{ key: "ritual-2", label: "Ritual 2 Spent", period: "Sortie" },
				{ key: "ritual-3", label: "Ritual 3 Spent", period: "Sortie" }
			],
			description:
				"<p>Before every Sortie, you prepare a set of complex rituals to bolster your magical " +
				"potential. When someone leads a Sortie, describe to your Director 3 magical rituals you " +
				"prepare, and choose an effect for each from below. Any remaining rituals expire when you " +
				"prepare new ones.</p>" +
				"<ul>" +
				"<li>You may spend the ritual to make a specified move in confidence.</li>" +
				"<li>Your Astir's approach becomes a different one of your choosing for this Sortie.</li>" +
				"<li>Hold 2: you may spend this 1-for-1 to ignore a disadvantage.</li>" +
				"</ul>"
		},
		{
			key: "the-arcanist:adaptive-rituals",
			name: "Adaptive Rituals",
			// References re-choosing prepare rituals' own (unmodeled) effect choice — prose only, same
			// treatment docs/domains/moves.md's "systems that do not exist yet" gives every move like this.
			traits: [],
			description:
				"<p>When you fail a move on a 6-, you may re-choose any rituals you have remaining.</p>"
		},
		{
			key: "the-arcanist:pre-ordained",
			name: "Pre-ordained",
			// TODO: real mechanic not built — auto-swapping the kept d6 into a future roll needs a
			// hook into roll-effects.js's kept/discarded die tracking (see applyRollEffects).
			// Deliberately scoped out for now, per docs/domains/moves.md's "systems that do not exist yet". The
			// numericTrackers entry below is just a manual reminder of which face is currently held
			// (0 = not holding one), not an implementation of the swap itself.
			traits: [],
			numericTrackers: [
				{ key: "kept-die", label: "Kept d6", min: 0, max: 6 }
			],
			description:
				"<p>When you make a move with advantage or disadvantage, you may hold onto one unkept d6 " +
				"for the rest of the Scene. During that Scene, you may replace any rolled d6 with that kept " +
				"one. You may only keep one d6 at a time in this way, and must use it before you can keep " +
				"another.</p>"
		},
		{
			key: "the-arcanist:consult-literature",
			name: "Consult Literature",
			// A pure chargen flavor pick (1 near-perfect + 2 extensive subjects) with no mechanical
			// effect — prose only.
			traits: [],
			description:
				"<p>You have a store of books and scrolls on various subjects that you can consult for " +
				"information when given time. Choose 1 subject you have almost perfect records of, and 2 " +
				"you have extensive information on:</p>" +
				"<ul>" +
				"<li>Construct models and design</li>" +
				"<li>Magical beasts and monsters</li>" +
				"<li>Enchantment and spell-craft</li>" +
				"<li>Mundane craft and building</li>" +
				"<li>Natural flora and fauna</li>" +
				"<li>Military tactics</li>" +
				"<li>A specific nation/faction</li>" +
				"<li>General world history</li>" +
				"</ul>"
		},
		{
			key: "the-arcanist:tactical-illusions",
			name: "Tactical Illusions",
			traits: ["channel"],
			// Same questionPrompts/questions shape as Guerrilla/Stir The Crowd — a per-tier
			// prompt plus an option list, rendered through the chat template's existing questions
			// section rather than needing one of its own.
			questionPrompts: {
				success: "Choose 2 of the illusion effects below.",
				mixed: "Choose 1, but your illusions also distract an unintended audience.",
				failure: null
			},
			questions: [
				"The illusions last until you stop sustaining them (otherwise they last up to a " +
					"minute).",
				"Your illusions affect anyone you intend to perceive them, rather than a single " +
					"person.",
				"You can create illusions that affect all the senses, rather than just sight."
			],
			results: { success: null, mixed: null, failure: null },
			description:
				"<p>When you distract your foes with magic, roll +CHANNEL. On a 10+, choose 2. On a 7-9, " +
				"choose 1, but your illusions also distract an unintended audience.</p>" +
				"<ul>" +
				"<li>The illusions last until you stop sustaining them (otherwise they last up to a " +
				"minute).</li>" +
				"<li>Your illusions affect anyone you intend to perceive them, rather than a single " +
				"person.</li>" +
				"<li>You can create illusions that affect all the senses, rather than just sight.</li>" +
				"</ul>"
		},
		{
			key: "the-arcanist:identify",
			name: "Identify",
			// References spending 1 hold from read-the-room (a basic move's own shared hold pool,
			// already spendable via the existing hold stepper) to grant Advantage on a specific future
			// task — cross-move hold consumption for a purpose like this isn't generalized anywhere in
			// this module (contrast grantsAutomaticSuccess, which is specifically an auto-succeed
			// offer). The player spends Read the Room's hold and applies Advantage manually via the
			// roll dialog's own Dice select, same as New Perspective's identical non-enforcement.
			traits: [],
			description:
				"<p>You may spend 1 hold from read the room to identify an Astir, learning its approach, " +
				"source and general capabilities. When attempting to recreate elements of an identified " +
				"Astir or help someone else do the same, take advantage.</p>"
		},
		{
			key: "the-arcanist:reshape",
			name: "Reshape",
			// Rolls the same trait and carries the same 7-9 consequence as the basic move Weave Magic
			// (moves.js) — confirmed directly with the design owner, since the sourcebook excerpt for
			// this move didn't restate the trait. "Hold 2" (not tiered by success/mixed in the source
			// text) is modeled via the existing roll-tiered separateHold mechanism (see Mobility in this
			// same file for the precedent), granting 2 hold on both success and mixed.
			traits: ["channel"],
			hold: { success: 2, mixed: 2, failure: 0 },
			separateHold: true,
			results: {
				success: "You manage to channel power the way you desired without ill effect.",
				mixed: "You succeed, but your invocation is twisted in an unexpected and dangerous way.",
				failure: null
			},
			description:
				"<p>When you weave magic to reshape a battlefield to your liking, roll +CHANNEL — the same " +
				"roll and 7-9 consequence as weave magic.</p>" +
				"<p>Hold 2. You may spend your hold 1-for-1 to do the following;</p>" +
				"<ul>" +
				"<li>Prevent a foe from leaving the battlefield.</li>" +
				"<li>Delay others from joining the battle.</li>" +
				"<li>Provide someone with the cover they need to cool off.</li>" +
				"<li>Create a spectacle that will be difficult to suppress or cover up.</li>" +
				"</ul>"
		},
		{
			key: "the-arcanist:transmute-self",
			name: "Transmute Self",
			// This module has no chargen stat-priority/array system to model "select two more sets of
			// Trait values" against — every playbook starts all five Traits at 0, hand-entered directly
			// on the sheet (see claude.md). As a middle ground (confirmed with the design owner), two
			// generic clamped counters (-3 to +3) stand in for the two alternate sets — see the new
			// `numericTrackers` move field/mechanic below. The player records each alternate set's full
			// Trait values in Notes; these trackers are just an at-a-glance reminder of the currently
			// active set's key modifier. Swapping itself, and updating the real Traits panel value,
			// stays a manual, narrated action.
			traits: [],
			numericTrackers: [
				{ key: "set-1", label: "Alternate Set 1", min: -3, max: 3 },
				{ key: "set-2", label: "Alternate Set 2", min: -3, max: 3 }
			],
			description:
				"<p>Arcanists are well-educated in many things, and the good ones learn to augment their " +
				"natural abilities to better suit different situations—or just to pursue different " +
				"interests. You may select two more sets of Trait values, using the same conditions used " +
				"during character creation. With a magical flourish you swap between any of these sets of " +
				"Traits—though doing it under pressure or unnoticed might require a move.</p>" +
				"<p>When you increase a Trait as an advancement, apply this to your transmute self Traits " +
				"too.</p>" +
				"<p>Record each alternate set's full Trait values in your Notes; the two trackers below " +
				"are a quick reminder of which set is currently active and its key modifier.</p>"
		},
		{
			key: "the-arcanist:new-perspective",
			name: "New Perspective",
			// "Read the room with confidence & advantage" needs no new plumbing — the player sets those
			// two states themselves in the roll dialog before rolling Read the Room, same as any other
			// move referencing a specific Effect/Advantage combination elsewhere in this module.
			traits: [],
			description:
				"<p>When you are put in peril, you may read the room with confidence & advantage in " +
				"response.</p>"
		}
	]
};
