export const THE_ICON_POOL = {
	key: "the-icon",
	label: "The Icon",
	playbookName: "The Icon",
	moves: [
		{
			key: "the-icon:performance",
			name: "Performance",
			// Unconditionally granted (see starting-moves.js's grantedKeys) — same no-`starting`-
			// marker-needed treatment every other unconditional starting move gets.
			//
			// "This move replaces b-plot for you" is table/fiction guidance only — same treatment
			// Never Quite Free's own "replaces bite the dust" text gets (playbook-moves.js's
			// the-revenant pool above): b-plot stays rollable/activatable on the sheet as normal, an
			// Icon player is simply expected not to use it. The three spend options are all narrated
			// consequences with nothing in this codebase to hook into (one actor's move affecting
			// another actor's already-made roll, Hooks as tracked data, a "distracted/interrupted"
			// status) — per docs/domains/moves.md's "systems that do not exist yet", only the flatHold pool
			// itself is coded; the spends stay prose.
			traits: [],
			flatHold: 3,
			description:
				"<p>This move replaces b-plot for you. When you lead a grand performance rather than " +
				"being directly involved in a Sortie — broadcast far and wide through magical means — " +
				"name one or two actors that attend in person, and hold 3. During the Sortie, you may " +
				"spend it 1-for-1 to do the following;</p>" +
				"<ul>" +
				"<li>Increase another player's level of success on a move one step, before or after " +
				"they roll.</li>" +
				"<li>Name an actor present—they are deeply affected by your performance, either " +
				"taking one of your Hooks to heart, or taking the direct opposite (your choice).</li>" +
				"<li>Hit a crescendo that gives time for your allies to think, as everyone listening " +
				"is distracted/interrupted by your performance.</li>" +
				"</ul>"
		},
		{
			key: "the-icon:power",
			name: "Power",
			// "They gain a point of Spotlight" needs one actor's move to grant Spotlight to a
			// different actor entirely — Spotlight is tracked per-sheet with no cross-actor grant
			// mechanism anywhere in this module. Prose only, per docs/domains/moves.md's "systems that do not
			// exist yet".
			traits: [],
			description:
				"<p>When someone does something notable and dangerous on your behalf, whether you " +
				"ordered them to or not, they gain a point of Spotlight.</p>"
		},
		{
			key: "the-icon:bardic-inspiration",
			name: "Bardic Inspiration",
			// Same flat, roll-less hold shape as B-Plot/Hot-blooded — "at the beginning of a Sortie"
			// isn't a tracked trigger, so Activate is the player's own call for when that's happened.
			// "Add a d4 to any roll, before or after it is made" has no hook to a specific die-face
			// mechanic anywhere in this module (roll-modifier stacking doesn't exist — see docs/domains/moves.md's
			// "systems that do not exist yet"), so only the hold pool itself is coded; applying the d4
			// stays a manual, narrated adjustment.
			traits: [],
			flatHold: 3,
			description:
				"<p>At the beginning of a Sortie, hold 3. You may spend this hold 1-for-1 to add a d4 " +
				"to any roll, before or after it is made.</p>"
		},
		{
			key: "the-icon:change-of-heart",
			name: "Change Of Heart",
			traits: [],
			description:
				"<p>Whenever you give a performance, other players may loosen or deepen any of their " +
				"Hooks as they please.</p>"
		},
		{
			key: "the-icon:touchstone",
			name: "Touchstone",
			traits: [],
			description:
				"<p>You have your finger on the pulse of the Carrier and the people on it; you " +
				"understand them as well as the Captain, and have a good feel for how they might view " +
				"any given situation.</p>"
		},
		{
			key: "the-icon:you-should-see-me-in-a-crown",
			name: "You Should See Me In A Crown",
			// "Requires: Touchstone" is enforced via requiresMoves (see docs/domains/moves.md's "Adding move
			// content") — unmetMoveRequirements/moveRequirementTooltip disable this move in the
			// picker (with a tooltip) until Touchstone is picked, and re-gate its Roll button live
			// on the sheet if Touchstone is ever removed afterward.
			requiresMoves: ["the-icon:touchstone"],
			traits: [],
			description:
				"<p>Requires: Touchstone</p>" +
				"<p>When you talk, people listen. Unless someone already intends to harm you (or you're " +
				"actively putting them in danger), people will always at least stop and consider your " +
				"words. You do not need to roll to convince people to do something that is in their own " +
				"best interests or that you have a convincing case for, and your attempts to do " +
				"anything beyond that are made in confidence.</p>"
		},
		{
			key: "the-icon:mechanical-aria",
			name: "Mechanical Aria",
			traits: [],
			// The one real mechanic in this pool — see astir-mixin.js's _astirData `available`
			// field, which now also checks for this flag among the actor's picked playbook moves
			// (the same move-scoped route grantsHomeInsteadOfChannel takes for The Adrift, except
			// that one is a guaranteed playbook-wide substitution while this only applies once an
			// Icon has actually picked Mechanical Aria as an advancement). "Cannot pilot other
			// Astirs" needs no code — an actor can only ever have one Astir at all (see docs/domains/frames.md's
			// Astir section). "May use subsystems" needs no code either — Subsystems (an Astir Part)
			// has never checked CHANNEL.
			grantsAstirAccessWithoutChannel: true,
			description:
				"<p>You acquire an Astir III specially designed and calibrated to be piloted by you, " +
				"built as per the usual custom Astir rules. It's likely equipped with equipment that " +
				"is very flashy and loud.</p>" +
				"<p>You cannot pilot other Astirs, and do not have a +CHANNEL trait, though you may " +
				"use subsystems.</p>"
		},
		{
			key: "the-icon:showstopper",
			name: "Showstopper",
			// "Requires: Bardic Inspiration" is enforced via requiresMoves, same treatment You Should
			// See Me In A Crown's own Touchstone requirement gets above. The upgrades themselves still
			// reference mechanics Bardic Inspiration never coded (the d4 application) or that don't
			// exist anywhere in this module (advancing a GRAVITY clock as a move side-effect), so
			// *those* stay prose, per docs/domains/moves.md's "systems that do not exist yet" — only the
			// prerequisite itself is now enforced.
			requiresMoves: ["the-icon:bardic-inspiration"],
			traits: [],
			description:
				"<p>Requires: Bardic Inspiration</p>" +
				"<p>When you use bardic inspiration, you may increase a roll by a d6 instead of a d4. " +
				"When you use bardic inspiration on a roll made by someone you have a GRAVITY clock " +
				"with, advance it.</p>"
		},
		{
			key: "the-icon:perspective",
			name: "Perspective",
			traits: [],
			description:
				"<p>When you look at an incomplete work—whether a piece of art or something far " +
				"simpler—you can always envision what was intended to complete it and exactly what " +
				"would be needed to finish the work, and also something grander and far more " +
				"difficult.</p>"
		}
	]
};
