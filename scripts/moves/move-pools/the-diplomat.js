export const THE_DIPLOMAT_POOL = {
	key: "the-diplomat",
	label: "The Diplomat",
	playbookName: "The Diplomat",
	moves: [
		{
			key: "the-diplomat:facilitator",
			name: "Facilitator",
			// Granted unconditionally via starting-moves.js's grantedKeys (every Diplomat starts
			// with this), so no `starting: true` — that flag is reserved for a pick-one starting
			// choice (see Field Scout/Giant Slayer), which this isn't.
			traits: [],
			// "You may read the room with +TALK" adds a trait option to Read the Room rather than
			// locking one — see PlaybookActorSheet#_moveTraits' addsTraitToMove handling, the
			// deliberate opposite of Field Scout's grantsEffectOnMove/Don't Follow Me's
			// grantsTraitOnMove (both of which only ever narrow a move's existing options).
			addsTraitToMove: { moveKey: "read-the-room", trait: "talk" },
			// A roll-less "choose 2" menu — see PlaybookActorSheet#_onMoveActivate's
			// activateChoices branch. Posts the prompt and all 3 options to chat on Activate; the
			// rulebook's "choose 2" isn't separately enforced there, same non-enforcement stance
			// every other choice list in this module takes (Guerrilla, Stir The Crowd, ...).
			activateChoices: {
				prompt: "When you set up a clandestine meeting, choose 2.",
				options: [
					"There's no risk of an ambush or interference.",
					"Third parties aren't privy to the contents of the meeting.",
					"All parties are willing to discuss in good faith."
				]
			},
			description:
				"<p>You may read the room with +TALK when mediating or taking part in a " +
				"conversation/discussion.</p>" +
				"<p>When you set up a clandestine meeting, choose 2;</p>" +
				"<ul>" +
				"<li>There's no risk of an ambush or interference.</li>" +
				"<li>Third parties aren't privy to the contents of the meeting.</li>" +
				"<li>All parties are willing to discuss in good faith.</li>" +
				"</ul>"
		},
		{
			key: "the-diplomat:sharp-tongue",
			name: "Sharp Tongue",
			// "On a roll of 12+ ... put in peril" is a chat-card reminder on Exchange Blows itself
			// (see moves.js#isCriticalResult/PlaybookActorSheet#_grantedCriticalReminderForMove) —
			// requiresTrait restricts the grant to a TALK-rolled Exchange Blows specifically, since
			// this move's own text only ever fires "when you exchange blows with +TALK", not with
			// +CLASH.
			traits: [],
			addsCriticalReminderToMove: {
				moveKeys: ["exchange-blows"],
				reminder: "Your opponent is put in peril",
				requiresTrait: "talk"
			},
			description:
				"<p>When you exchange blows with +TALK, on a roll of 12+ your opponent is put in " +
				"peril.</p>"
		},
		{
			key: "the-diplomat:sharper-knives",
			name: "Sharper Knives",
			traits: [],
			// The risk-counts-as-two half of this move's text has no weighting system to hook (risks
			// are freeform Danger-panel entries) and stays prose only.
			grantsRollModifier: [{ advantage: "advantage" }],
			description:
				"<p>You're trained in the arts of assassination and stealth. Take advantage while " +
				"attempting to remain undetected or unseen, and being unaware of your presence " +
				"counts as two risks.</p>"
		},
		{
			key: "the-diplomat:stir-the-crowd",
			name: "Stir The Crowd",
			// Same questionPrompts/questions shape as Guerrilla/Face To Face — a per-tier prompt
			// plus an option list, rendered through the chat template's existing questions section
			// rather than needing one of its own.
			traits: ["talk"],
			questionPrompts: {
				success: "Choose 1.",
				mixed: "Choose 2, or let your Director choose 1.",
				failure: null
			},
			questions: [
				"It takes a tragedy to truly galvanise people.",
				"In doing so, you become known and targeted.",
				"You have no control or influence over any acts of protest.",
				"You are unable to spark wider resistance than the local area."
			],
			results: { success: null, mixed: null, failure: null },
			description:
				"<p>When you attempt to inspire dissent against the Authority, roll +TALK. On a 10+, " +
				"choose 1. On a 7-9, choose 2, or let your Director choose 1.</p>" +
				"<ul>" +
				"<li>It takes a tragedy to truly galvanise people.</li>" +
				"<li>In doing so, you become known and targeted.</li>" +
				"<li>You have no control or influence over any acts of protest.</li>" +
				"<li>You are unable to spark wider resistance than the local area.</li>" +
				"</ul>"
		},
		{
			key: "the-diplomat:bureaucrat",
			name: "Bureaucrat",
			// Own quick-roll button that rolls the real Exchange Blows move with TALK forced (see
			// move-roll-mixin.js's _onMoveRoll/_rollMove quickRollsMove handling) rather than a
			// duplicate roll of its own — so weapon choice, Sharp Tongue's own reminder, equipment tag
			// spends etc. all apply exactly as they would rolling Exchange Blows directly. Its own
			// "choose 2, even on a fail" options ride along as unconditional (all-tier) reminders on
			// that roll's chat card (see move-roll.js's rollMove/options.extraReminders) rather than a
			// separate Activate button, since the choice isn't conditioned on the roll's result.
			traits: ["talk"],
			quickRollsMove: {
				moveKey: "exchange-blows",
				trait: "talk",
				reminders: [
					"Choose 2, even on a fail:",
					"You're not lying—they'll really be in trouble if they don't listen to you.",
					"They're invested in what you're saying: act in confidence against them for the rest of the Scene.",
					"They won't remember or recognise you.",
					"You don't need to take a risk."
				]
			},
			description:
				"<p>When you would exchange blows with +TALK to slow someone down or distract them " +
				"with regulations, bylaws, or whatever piece of red tape you can think of, you also " +
				"choose two from the below even on a fail.</p>" +
				"<ul>" +
				"<li>You're not lying—they'll really be in trouble if they don't listen to you.</li>" +
				"<li>They're invested in what you're saying: act in confidence against them for the " +
				"rest of the Scene.</li>" +
				"<li>They won't remember or recognise you.</li>" +
				"<li>You don't need to take a risk.</li>" +
				"</ul>"
		},
		{
			key: "the-diplomat:irrefutable",
			name: "Irrefutable",
			// A flat, roll-less hold grant like B-Plot/Hot-blooded — "when you argue or advocate...
			// with hard evidence" isn't a tracked trigger anywhere in this module, so Activate is
			// the player's own call for when that's happened. No `period`: nothing in this move's
			// text scopes the hold to a Sortie or Scene, same treatment as Path-finding/Hot-blooded.
			// HOLD_MAX is already exactly 3 (see playbook-actor-sheet.js), so "when you reach 3
			// hold" caps itself with no extra code; spending them on Strike Decisively stays manual,
			// same as every other flatHold move's spend text.
			traits: [],
			flatHold: 1,
			description:
				"<p>When you argue or advocate for something and back up your point of view with hard " +
				"evidence or facts, hold 1. When you reach 3 hold, you may spend them to strike " +
				"decisively with +TALK against someone who isn't defenceless.</p>"
		},
		{
			key: "the-diplomat:connected",
			name: "Connected",
			traits: ["talk"],
			results: {
				success: "You're familiar with them, and you may choose whether their view of you is " +
					"positive or negative.",
				mixed: "As previous, but the Director decides how they think of you.",
				failure: "Things are bad: act in desperation against them for the rest of the Scene."
			},
			description:
				"<p>When you meet someone of note, roll +TALK. On a 10+, you're familiar with them, and " +
				"you may choose whether their view of you is positive or negative. On a 7-9, as " +
				"previous, but the Director decides how they think of you. On a 6-, things are bad: " +
				"act in desperation against them for the rest of the Scene.</p>"
		},
		{
			key: "the-diplomat:shree-klime",
			name: "Shree Klime",
			// A roll-less "secure 2 of 3" Downtime menu — same activateChoices treatment as
			// Facilitator/Bureaucrat above. The alias/disguise-belief text ahead of the list has no
			// mechanical hook (nothing tracks NPC belief or identity checks anywhere in this
			// module) and stays prose, per docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			activateChoices: {
				prompt: "During Downtime, instead of the usual benefit for a Scene, you may secure 2 " +
					"of the following.",
				options: [
					"You have ID that is either legitimate or so well faked it is impossible for " +
						"anyone short of an expert to tell the difference.",
					"There's a reason or expectation for someone fitting your disguise to show up.",
					"You've had something useful planted ahead of time—select a weapon or piece of " +
						"equipment (one you have access to) to be hidden just where you'll need it."
				]
			},
			downtimeAbility:
				"During Downtime, prepare an alias or disguise, securing 2 of Shree Klime's listed " +
				"benefits instead of a Scene's usual one.",
			description:
				"<p>During Downtime, you may also prepare an alias or disguise. Most people will " +
				"believe you are who you say you are, unless you're disguised as someone they're very " +
				"familiar with, or they are given reason to thoroughly check your person or any " +
				"identification. During Downtime, instead of the usual benefit for a Scene, you may " +
				"secure 2 of the following;</p>" +
				"<ul>" +
				"<li>You have ID that is either legitimate or so well faked it is impossible for " +
				"anyone short of an expert to tell the difference.</li>" +
				"<li>There's a reason or expectation for someone fitting your disguise to show up.</li>" +
				"<li>You've had something useful planted ahead of time—select a weapon or piece of " +
				"equipment (one you have access to) to be hidden just where you'll need it.</li>" +
				"</ul>"
		}
	]
};
