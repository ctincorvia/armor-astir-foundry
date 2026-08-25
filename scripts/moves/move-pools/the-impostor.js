export const THE_IMPOSTOR_POOL = {
	key: "the-impostor",
	label: "The Impostor",
	playbookName: "The Impostor",
	moves: [
		{
			key: "the-impostor:arcane-augments",
			name: "Arcane Augments",
			starting: true,
			// No roll of its own — traits is empty and there are no conditions, so the sheet's
			// `rollable` flag stays false and only a Description button renders (same treatment
			// as Bullheaded below). Its actual mechanical effect is traitBonus (see
			// trait-bonuses.js): +1 CHANNEL per Danger this actor has, capped at +3, resolved
			// generically by PlaybookActorSheet#_traitBonuses and folded into both the Traits
			// panel's display and every roll that spends CHANNEL — no per-move code needed here
			// beyond this declarative flag.
			traits: [],
			traitBonus: { trait: "channel", per: "danger", max: 3 },
			description:
				"<p>Impostors control their Astir using magical augmentations, like artificial limbs or " +
				"organs. These augmentations allow a non-magic user to power and control an Astir, but " +
				"otherwise do not interfere with your life unless you (the player) decide so. Being bonded " +
				"to magic in this way often leads to it affecting the body and vice versa, irreversibly " +
				"tying their magic to their emotional and physical state.</p>" +
				"<p>Your CHANNEL is increased by 1 for each danger you have (up to a max of +3).</p>"
		},
		{
			key: "the-impostor:hot-blooded",
			name: "Hot-blooded",
			traits: [],
			// A flat, roll-less hold grant like B-Plot/Get Out of My Way! (moves.js/
			// playbook-moves.js) — "when you heat up" isn't a tracked trigger anywhere in this
			// module (Overheating is a plain checkbox, not an event), so the Activate button is
			// the player's own call for when that's happened. No `period`: unlike those two
			// moves, nothing in this move's own text scopes the hold to a Sortie or Scene, so it
			// isn't cleared by either Refresh button — same treatment as Path-finding's hold.
			flatHold: 1,
			// "Succeed at a move as if you had rolled a 10+" — the automatic-success chat-card
			// button (see PlaybookActorSheet#_availableAutomaticSuccess/moves.js#rollMove),
			// spending 3 from this move's own moveHold pool. The move's other spend option
			// ("attempt something uncanny...") has no mechanical effect to hook, so it stays
			// descriptive only.
			grantsAutomaticSuccess: { cost: 3 },
			description:
				"<p>When you heat up, hold 1. You may spend 3 hold gained in this way to;</p>" +
				"<ul>" +
				"<li>Succeed at a move as if you had rolled a 10+.</li>" +
				"<li>Attempt something uncanny, superhuman, or unbelievable.</li>" +
				"</ul>"
		},
		{
			key: "the-impostor:troublemaker",
			name: "Troublemaker",
			// Downtime Tokens themselves are tracked (see PlaybookActorSheet's downtimeTokens),
			// but only as a plain counter — this move's actual condition ("whenever you fail a
			// Downtime Scene") and its multiplayer effect (2 for yourself instead of passing 1
			// to another player) depend on Downtime Scenes existing as discrete, resolvable
			// events with pass/fail outcomes and other players to pass to, neither of which this
			// module models. Stays prose only — see docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			description:
				"<p>Whenever you fail a Downtime Scene, you may give yourself 2 tokens instead of passing 1 " +
				"to another player.</p>"
		},
		{
			key: "the-impostor:dont-follow-me",
			name: "Don't Follow Me",
			// Own quick-roll button that rolls the real Lead a Sortie move with DEFY & advantage
			// forced (see move-roll-mixin.js's _onMoveRoll/_rollMove quickRollsMove handling)
			// rather than a standing lock on Lead a Sortie's own button/dialog — Lead a Sortie's
			// regular Roll button stays untouched, same treatment Bureaucrat/The Diplomat gives
			// Exchange Blows. The move's own "without spending a token" framing isn't separately
			// enforced, since tokens aren't tracked anywhere in this module (see
			// docs/domains/moves.md's "systems that do not exist yet").
			traits: ["defy"],
			quickRollsMove: { moveKey: "lead-a-sortie", trait: "defy", advantage: "advantage" },
			downtimeAbility:
				"During any Downtime Scene, you may take your Astir and rush ahead to lead a Sortie " +
				"with +DEFY and advantage — without spending a token.",
			description:
				"<p>During any Downtime Scene, you may do the below without spending a token:</p>" +
				"<ul>" +
				"<li>Take your Astir and rush ahead: you'll lead a Sortie with +DEFY & advantage.</li>" +
				"</ul>"
		},
		{
			key: "the-impostor:resonance",
			name: "Resonance",
			// A choose-1-instead-of-rolling menu with no base stat and nothing tracked
			// afterward — same shape as Cantrips' All In or Soldier Moves' Fisher of Men, prose
			// only.
			traits: [],
			description:
				"<p>When you would weave magic to form a clear empathetic bond with another, sharing your " +
				"true feelings and clearly communicating your Hooks, choose 1 instead of rolling;</p>" +
				"<ul>" +
				"<li>Your connection lasts a single, precious moment—time for little more than a short " +
				"exchange.</li>" +
				"<li>They or someone else view it as a breach of trust or some kind of trick, and will hold " +
				"it against you.</li>" +
				"<li>You miss something important while you're together.</li>" +
				"</ul>"
		},
		{
			key: "the-impostor:let-loose",
			name: "Let Loose",
			traits: [],
			// Per-burden bonus to a player-chosen Trait (see trait-bonuses.js's chooseTrait and
			// PlaybookActorSheet's traitBonusChoosable/traitBonusChoice) — uncapped (no `max`),
			// since this move's own text explicitly overrides the usual +3 Trait ceiling.
			traitBonus: { per: "burden", chooseTrait: true },
			description:
				"<p>For every burden you have, you may increase one of your Traits by +1. The usual max of " +
				"+3 does not apply to increases earned through let loose.</p>"
		},
		{
			key: "the-impostor:bullheaded",
			name: "Bullheaded",
			// No roll — traits is empty and there are no conditions, so the sheet's `rollable`
			// flag stays false and only a Description button renders (same treatment as
			// Subsystems in SPECIAL_MOVES). Taking the risk is already the existing Danger "Add"
			// controls (system.attributes.dangers), same reasoning as Cantrips' Fire-Eater/Selfless.
			// "Advantage on your next roll" is now a real, deferred, unscoped grantsRollModifier
			// entry — the same shape Bonded In Blood/Ravenous Spectre use for their own untracked-
			// precondition triggers, with a manual `uses` checkbox standing in for "took a risk for
			// this" since nothing in this module tracks that condition automatically.
			traits: [],
			uses: [{ key: "took-risk", label: "Took a risk for this" }],
			grantsRollModifier: [{ advantage: "advantage", costsUse: "took-risk", deferred: true }],
			description:
				"<p>You may take a risk to take advantage on your next roll. People know that you are brash " +
				"and liable to put yourself—and maybe them—in danger to get the job done.</p>"
		},
		{
			key: "the-impostor:face-to-face",
			name: "Face To Face",
			// Reuses the questionPrompts/questions rendering Read the Room/Guerrilla already use —
			// Face To Face's own 7-9 menu isn't literally a question list, but the shape (a
			// per-tier prompt plus a spend-style option list) is identical, so this rides the same
			// chat template section rather than needing one of its own. The multi-part fictional
			// consequence of a 10+/PC's own choice not to leave their Astir is narrated at the
			// table, same non-enforcement stance every other move in this module takes toward
			// fiction the dice can't resolve on their own.
			traits: ["talk"],
			questionPrompts: {
				success: "They will leave their Astir to face you.",
				mixed: "They will leave their Astir to face you, but choose one.",
				failure: null
			},
			questions: [
				"Take the risk (entangled).",
				"You have disadvantage to moves against the other Channeler.",
				"You are separated from your Astirs temporarily."
			],
			results: {
				success: "They will leave their Astir to face you. Player characters may weather the storm to " +
					"refuse.",
				mixed: null,
				failure: null
			},
			description:
				"<p>When you leave your Astir in the hopes another will do the same to meet you face to " +
				"face, roll +TALK.</p>" +
				"<p>On a 10+, They will leave their Astir to face you. Player characters may weather the " +
				"storm to refuse.</p>" +
				"<p>On a 7-9, They will leave their Astir to face you, but choose one;</p>" +
				"<ul>" +
				"<li>Take the risk (entangled).</li>" +
				"<li>You have disadvantage to moves against the other Channeler.</li>" +
				"<li>You are separated from your Astirs temporarily.</li>" +
				"</ul>" +
				"<p>Player characters may choose whether to leave their Astir or not—if they do, they pick " +
				"one of the above for you.</p>"
		},
		{
			key: "the-impostor:realignment",
			name: "Realignment",
			// A one-time, Director-collaborative swap of this move itself for another playbook's
			// move (or an invented one) — the picker already offers every other playbook's pool
			// with no enforcement of when that's appropriate (see this file's own top comment),
			// so there's nothing further to build; prose only.
			traits: [],
			description:
				"<p>You undergo deeper alteration and adjustments to your body. Discuss what it is with " +
				"your Director, and either choose a move from another playbook to represent its effects, " +
				"or work with your Director to create a new one.</p>"
		}
	]
};
