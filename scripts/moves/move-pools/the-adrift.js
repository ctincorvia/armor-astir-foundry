export const THE_ADRIFT_POOL = {
	key: "the-adrift",
	label: "The Adrift",
	playbookName: "The Adrift",
	moves: [
		{
			key: "the-adrift:love-love-love",
			name: "Love, Love, Love",
			traits: [],
			// Drives the generic HOME-instead-of-CHANNEL substitution in moves-mixin.js's _moveTraits —
			// see that file's own comment for the full mechanic. Gated on this specific move being picked
			// (not on playbook slug), per claude.md's "a flag read generically across all actors must
			// still verify the acting actor has actually picked the move that grants it" caution.
			grantsHomeInsteadOfChannel: true,
			description:
				"<p>Instead of a +CHANNEL trait, you have an additional GRAVITY clock with wherever (and/or " +
				"whenever) you came from. It is treated as your +CHANNEL trait in all circumstances, and " +
				"referred to as +HOME. It starts at +1.</p>"
		},
		{
			key: "the-adrift:snakes-in-the-grass",
			name: "Snakes In The Grass",
			// The "hold 1" resource itself is a plain flatHold pool like B-Plot's own (Activate adds 1,
			// plus the usual manual stepper) — "make your next move with advantage" is the one piece
			// this module can't mechanize (a bank-for-next-roll system — roll-modifier stacking, see
			// docs/domains/moves.md's "systems that do not exist yet"), and the payoff at 3 hold is a Director-
			// facing narrative beat, not something the player spends. Both stay prose in the
			// description; only the counter itself is tracked.
			traits: [],
			flatHold: 1,
			description:
				"<p>When you are cowed or guilted into something you have no stake in, hold 1 and make your " +
				"next move with advantage. Once you have 3 hold, the Authority or another third party will " +
				"soon reach out to you with an unexpected offer or request.</p>"
		},
		{
			key: "the-adrift:walk-on-part-in-the-war",
			name: "Walk-on Part In The War",
			traits: [],
			// "While piloting your Astir" — requiresAstirMounted mirrors The Old Blood's own
			// requiresUnmounted (see moves-mixin.js's addsTraitToMove resolution), but the opposite
			// polarity and specifically the Astir, not any mounted frame: an Ardent doesn't count,
			// since this move's text names the Astir by name, not "your frame" generically.
			addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "home", requiresAstirMounted: true },
			// Nothing in this module auto-applies a roll consequence beyond writing hold (see
			// claude.md's "Manual trackers, not enforcement") — Overheating is always a checkbox the
			// player ticks by hand. Rather than leave the reminder only in this move's own
			// description (easy to miss, since this move is never itself rolled), it also surfaces on
			// Exchange Blows/Strike Decisively's own chat card on a 6- — see moves-mixin.js's
			// _grantedFailureReminderForMove and moves.js#rollMove's extraFailureReminder handling.
			// Same requiresAstirMounted gate as the trait grant above — no reminder to tick a box
			// that was never offered as an option in the first place.
			addsFailureReminderToMove: {
				moveKeys: ["exchange-blows", "strike-decisively"],
				reminder: "Tick 'overheating' on your Astir",
				requiresAstirMounted: true
			},
			description:
				"<p>You can exchange blows and strike decisively with +HOME when attempting to cause physical " +
				"harm while piloting your Astir. On a 6-, tick 'overheating' on your Astir in addition to any " +
				"other consequences.</p>"
		},
		{
			key: "the-adrift:lead-role-in-a-cage",
			name: "Lead Role In A Cage",
			traits: [],
			// "Roll with +HOME instead of the listed traits" reads like a hard lock, but the trigger
			// ("when you're pressured into leading a Sortie") is a fictional judgment call, not every
			// Lead a Sortie roll — so this only makes +HOME available as an option (unlike Don't Follow
			// Me's real DEFY grant, which locks unconditionally because its own trigger, a Downtime
			// Scene, has no in-between case to leave up to the table). "Home" isn't offered on Lead a
			// Sortie at all until this move adds it (see moves-mixin.js's _moveTraits).
			addsTraitToMove: { moveKey: "lead-a-sortie", trait: "home" },
			description:
				"<p>When you're pressured into leading a Sortie, roll with +HOME instead of the listed " +
				"traits.</p>"
		},
		{
			key: "the-adrift:wish-you-were-here",
			// Downtime Scenes aren't modeled anywhere in this module (see the-impostor:troublemaker's own
			// comment). Clearing a Peril and advancing the Home clock are both already manual sheet
			// controls (Dangers' own remove button, the Home clock's own progress-step control) — nothing
			// new needed here.
			name: "Wish You Were Here",
			traits: [],
			downtimeAbility:
				"Spend a Social Space or Private Quarters Scene alone during Downtime to clear a peril " +
				"from yourself and advance your HOME clock.",
			description:
				"<p>You may spend Social Space Or Private Quarters scenes alone during Downtime, " +
				"contemplating your home and the people you left behind. When you do so, you may clear a " +
				"peril from yourself instead of another, and advance your HOME clock.</p>"
		},
		{
			key: "the-adrift:if-i-go-there-will-be-trouble",
			name: "If I Go There Will Be Trouble",
			traits: [],
			description:
				"<p>You have decided to stay, no matter what. Swap to a new playbook, and take an extra move " +
				"in addition to those you should start with. You may also rewrite as many of your Hooks as " +
				"you want.</p>"
		},
		{
			key: "the-adrift:if-i-stay-it-will-be-double",
			name: "If I Stay It Will Be Double",
			// Unlike Field Scout's grantsEffectOnMove (a single named move key), this triggers on a
			// fictional judgment call ("act selfishly in pursuit of return home") that could apply to any
			// roll — nothing in this module can detect that condition. Prose only.
			traits: [],
			description:
				"<p>You are resigned to leaving, no matter what. When you act selfishly in pursuit of your " +
				"permanent return home, do so with confidence.</p>"
		},
		{
			key: "the-adrift:draw-your-bath-and-load-your-gun",
			name: "Draw Your Bath And Load Your Gun",
			// Deliberately traits: [] rather than ["home"] — "home" is not a real TRAITS key, and an
			// existing generic test (tests/playbook-moves.test.js) asserts every playbook move's own
			// traits array only ever names real TRAITS keys. Self-targeting addsTraitToMove reuses the
			// exact same generic HOME-injection machinery instead (see moves-mixin.js's _moveTraits).
			traits: [],
			addsTraitToMove: { moveKey: "the-adrift:draw-your-bath-and-load-your-gun", trait: "home" },
			results: {
				success: "You are able to keep up with any obligations or duties from your old life " +
					"smoothly: gain +1 Spotlight.",
				mixed: "You are able to keep up, but people grow more suspicious about your strange " +
					"absences: start or advance a 6-step clock titled 'Someone Else Gets Involved'.",
				failure: null
			},
			downtimeAbility:
				"Spend your Downtimes away from the party at your other means of return; roll +HOME when you do.",
			description:
				"<p>You have some method of travelling or returning back to where you came from temporarily. " +
				"You may spend your Downtimes there, away from the party.</p>" +
				"<p>When you do so, also roll +HOME.</p>"
		},
		{
			key: "the-adrift:hope-so-bad-that-youll-bathe-and-hunt",
			name: "Hope So Bad That You'll Bathe And Hunt",
			// Affects another actor's future roll based on this actor's own action — nothing in this
			// module can reach across actors that way (every grantsEffectOnMove/grantsTraitOnMove/
			// grantsAdvantageOnMove/addsTraitToMove flag above only ever locks the *acting* actor's own
			// next roll). Prose only, per docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			description:
				"<p>When you clear a peril from another character or their Astir, they make their next bite " +
				"the dust with either confidence or desperation: their choice, at the time.</p>"
		}
	]
};
