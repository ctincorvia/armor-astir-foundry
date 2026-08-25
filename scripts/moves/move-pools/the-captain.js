export const THE_CAPTAIN_POOL = {
	key: "the-captain",
	label: "The Captain",
	playbookName: "The Captain",
	moves: [
		{
			key: "the-captain:in-command",
			name: "In Command",
			traits: [],
			// "You are defenceless at 4 dangers ... rather than 3" is the one mechanized part of
			// this move — see tracking-mixin.js's _dangerMax, keyed off the playbook slug plus the
			// At the Helm checkbox (system.attributes.atHelm), not off this move being picked:
			// every Captain starts with In Command via starting-moves.js's grantedKeys, so there's
			// no "picked or not" case to separately gate on. Everything else here — ordering the
			// crew, "you are responsible for their lives" — is pure fiction with nothing to track
			// (see claude.md's "Manual trackers, not enforcement": Dangers themselves already
			// cover the "if things go bad" consequence).
			description:
				"<p>You are the Carrier's captain, and naturally have command of its crew. While at " +
				"the helm of the Carrier, you may order the crew to perform moves on your behalf: " +
				"unlike when other playbooks use +CREW, you may do this any number of times. " +
				"Increase your Carrier's +CREW by 1.</p>" +
				"<p>When you do so, explain how the crew helps you do this thing—they share in the " +
				"consequences of your move, good and bad. You are responsible for their lives. If " +
				"things go bad rolling your Traits, things go bad for you. If things go bad rolling " +
				"+CREW, you endanger everyone.</p>" +
				"<p>Additionally, both Carrier and crew are part of your character as far as risks " +
				"and perils are concerned, just like an Astir is an extension of its channeler. To " +
				"reflect the many minds and hands at work for you, you are defenceless at 4 dangers " +
				"while at the helm of your Carrier, rather than 3. You go down with it, and it goes " +
				"down with you.</p>"
		},
		{
			key: "the-captain:tactical-genius",
			name: "Tactical Genius",
			traits: [],
			// Every spend option below is a cross-actor effect (removing another character's own
			// risk, giving them advantage, moving them into the scene) — the same "nothing in this
			// module can reach across actors that way" stance every other cross-actor grant here
			// takes (see e.g. Hope So Bad That You'll Bathe And Hunt below). Applying any of the
			// three effects it pays for still stays prose-only for that reason — but the hold
			// pool's own size is worth tracking regardless, via the same generic numericTrackers
			// mechanic Transmute Self/Smiling Politely use (see playbook-sheet/moves-mixin.js).
			// max: 6 is deliberately generous headroom for "1+KNOW", since Traits in this module
			// are hand-entered and uncapped (mirrors Smiling Politely's own max: 10). period:
			// "Sortie" matches the move's own "at the start of a Sortie" text, so Refresh Sortie
			// resets it back to 0 (see frames-mixin.js's _refreshPeriod).
			numericTrackers: [
				{ key: "hold", label: "Hold", min: 0, max: 6, period: "Sortie" }
			],
			description:
				"<p>When you're supervising allies from afar during a Sortie, you can lever your " +
				"tactical know-how into better positioning. Take 1+KNOW hold at the start of a " +
				"Sortie, and spend it 1-for-1 to do the following;</p>" +
				"<ul>" +
				"<li>Remove one risk from an ally.</li>" +
				"<li>Give an ally advantage to their next move, describing how you advise or support " +
				"them.</li>" +
				"<li>Have an ally appear somehow in a place they are needed.</li>" +
				"</ul>"
		},
		{
			key: "the-captain:force-multiplier",
			name: "Force Multiplier",
			traits: [],
			// A manual counter, same generic numericTrackers mechanic as Tactical Genius above —
			// but deliberately with no `period`, since "once per Sortie you may act with
			// confidence" per drawback taken isn't a pool that refills at the start of each
			// Sortie the way Tactical Genius's hold does; it's capped by how many drawbacks were
			// taken (up to 3) and the player manages when a use is spent themselves. Refresh
			// Sortie/Scene only ever touch trackers that declare a period (see
			// frames-mixin.js's _refreshPeriod), so this one is untouched by both.
			numericTrackers: [
				{ key: "confidence", label: "Confidence rolls available", min: 0, max: 3 }
			],
			description:
				"<p>You acquire something—a tool, ship upgrade, a caged malevolent sentience, " +
				"etc—that allows the Carrier and it's staff to operate far better than usual, but it " +
				"has a downside. For each of the below drawbacks you give it, once per Sortie you " +
				"may act with confidence.</p>" +
				"<ul>" +
				"<li>It whispers in your ear—change one of your Hooks to represent its demands.</li>" +
				"<li>It's fragile and needs protecting. It grants no benefit while damaged or " +
				"destroyed.</li>" +
				"<li>It is physically taxing or requires upkeep of some kind: gain a burden. If you " +
				"gain this move at the same time as you would gain a burden from another source, you " +
				"take this one instead.</li>" +
				"</ul>"
		},
		{
			key: "the-captain:surprise-requisition",
			name: "Surprise Requisition",
			traits: [],
			// "Roll +CREW" with no trait/stat selection — reuses Lead a Sortie's own fixedTraits
			// CREW resolution verbatim (see moves.js's SPECIAL_MOVES/moves-mixin.js's
			// _crewFixedTraitValue/_rollMove): the static value here is only a placeholder,
			// overwritten with a live Carrier read the same way Lead a Sortie's own is.
			fixedTraits: [{ key: "crew", label: "CREW", value: 0 }],
			// The 10+/7-9 option lists below are a descriptive menu, not a deeper tracked
			// mechanic — no weapon-tag-profile system exists to actually grant a temporary tag,
			// and no Approach-swap system exists either (see docs/domains/moves.md's "systems that do not
			// exist yet"), so both tiers are prose only, same treatment Stir The Crowd's own
			// choose-N option list gets.
			results: {
				success: "Choose 1 for free;" +
					"<ul>" +
					"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
					"(clearing a related peril, if applicable).</li>" +
					"<li>A weapon gains the bane tag until the end of the scene.</li>" +
					"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
					"<li>An Astir changes it's approach until the end of the scene.</li>" +
					"</ul>",
				mixed: "You had to requisition that gear personally; tap a Faction as they spread " +
					"themselves thin to help you, then choose 1;" +
					"<ul>" +
					"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
					"(clearing a related peril, if applicable).</li>" +
					"<li>A weapon gains the bane tag until the end of the scene.</li>" +
					"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
					"<li>An Astir changes it's approach until the end of the scene.</li>" +
					"</ul>",
				failure: null
			},
			description:
				"<p>When you dispatch supplies to another character or reveal something extra you " +
				"had them deployed with all along, roll +CREW. On a 10+, choose 1 for free. On a " +
				"7-9, you had to requisition that gear personally; tap a Faction as they spread " +
				"themselves thin to help you.</p>" +
				"<ul>" +
				"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
				"(clearing a related peril, if applicable).</li>" +
				"<li>A weapon gains the bane tag until the end of the scene.</li>" +
				"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
				"<li>An Astir changes it's approach until the end of the scene.</li>" +
				"</ul>"
		},
		{
			key: "the-captain:fire-support",
			name: "Fire Support",
			traits: [],
			// "using +KNOW" — adds KNOW as a rollable option to Exchange Blows/Strike Decisively,
			// the same addsTraitToMove shape Turn Unearthly (the-paradigm:turn-unearthly) uses.
			addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "know" },
			// "...and the Carrier's weaponry" — see moves-mixin.js's _grantsCarrierWeaponAccess/
			// _onMoveRoll, which folds the world's Carrier's own weapons into Exchange Blows/
			// Strike Decisively's weapon choice (only when exactly one Carrier exists in the
			// world — see that method's own comment for why).
			grantsCarrierWeaponAccess: { moveKeys: ["exchange-blows", "strike-decisively"] },
			description:
				"<p>When you provide instruction and call shots for the Carrier's crew, you may " +
				"exchange blows and strike decisively using +KNOW and the Carrier's weaponry.</p>"
		},
		{
			key: "the-captain:information-network",
			name: "Information Network",
			traits: [],
			// "you may dispel uncertainties with +TALK" — the single-target-moveKey form of
			// addsTraitToMove, same shape Facilitator/Ascension use.
			addsTraitToMove: { moveKey: "dispel-uncertainties", trait: "talk" },
			bonusDowntimeTokens: { max: 1, description: "Any info-gathering efforts or projects." },
			description:
				"<p>When you contact your superiors or an appropriate source for relevant intel, " +
				"you may dispel uncertainties with +TALK.</p>" +
				"<p>Take +1 token during Downtime to spend on any info-gathering efforts or " +
				"projects.</p>"
		},
		{
			key: "the-captain:born-leader",
			name: "Born Leader",
			traits: [],
			// "You lead a Sortie with advantage" — a standing grantsAdvantageOnMove lock on Lead a
			// Sortie's own dialog. "give the crew confidence when they plan & prepare" and the Cause/Conflict
			// Turn paragraph both stay prose: neither a "Plan & Prepare" move nor a Conflict Turn
			// system exists anywhere in this module (see docs/domains/moves.md's "systems that do not exist
			// yet", and compare That's Dialectics' own comment on its similarly-unbuilt "plan and
			// prepare" reference).
			grantsAdvantageOnMove: { moveKey: "lead-a-sortie", advantage: "advantage" },
			description:
				"<p>You lead a Sortie with advantage and give the crew confidence when they plan " +
				"&amp; prepare.</p>" +
				"<p>Figures within the Cause lean on you for strategic advice: to some degree, their " +
				"successes and failures during the Conflict Turn can be attributed to your " +
				"guidance.</p>"
		},
		{
			key: "the-captain:human-resources",
			name: "Human Resources",
			traits: [],
			// "you may also choose from the following questions" — a second, additive question
			// list layered onto Read the Room's own (see moves-mixin.js's
			// _grantedQuestionsForMove/moves.js#rollMove's extraQuestions merge), rather than
			// replacing it.
			addsQuestionsToMove: {
				moveKey: "read-the-room",
				questions: [
					"What is the crew's mood like?",
					"Who is responsible for a problem on-board the Carrier?",
					"What could be a problem for the crew in the immediate future?"
				]
			},
			description:
				"<p>When you read the room, you may also choose from the following questions;</p>" +
				"<ul>" +
				"<li>What is the crew's mood like?</li>" +
				"<li>Who is responsible for a problem on-board the Carrier?</li>" +
				"<li>What could be a problem for the crew in the immediate future?</li>" +
				"</ul>"
		},
		{
			key: "the-captain:coordinator",
			name: "Coordinator",
			// Grants another character (the helped ally) Confidence — a cross-actor effect nothing
			// in this module can reach (every grantsEffectOnMove/grantsAdvantageOnMove/addsTraitToMove
			// flag above only ever locks the *acting* actor's own next roll — see e.g. Hope So Bad
			// That You'll Bathe And Hunt/Team Player).
			// Still can't actually apply the Confidence itself, per docs/domains/moves.md's "systems that do
			// not exist yet" — but the reminder to do so can at least surface on Help or Hinder's
			// own chat card, the success-tier mirror of Walk-on Part In The War's
			// addsFailureReminderToMove (see moves-mixin.js's _grantedSuccessReminderForMove).
			// intents (help vs. hinder) are flavor-only with no mechanical branch anywhere in this
			// module (see help-or-hinder's own comment in moves.js), so the reminder text states
			// the "if you chose to help" condition in prose rather than being conditionally gated
			// on which intent was picked.
			addsSuccessReminderToMove: {
				moveKeys: ["help-or-hinder"],
				reminder: "If you chose to help, your ally may act with confidence in addition to " +
					"advantage."
			},
			traits: [],
			description:
				"<p>When you roll a 10+ to help or hinder and choose to help, your ally may act " +
				"with confidence in addition to advantage.</p>"
		}
	]
};
