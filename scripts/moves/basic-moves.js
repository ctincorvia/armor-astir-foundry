// Basic moves are available to every playbook actor by default (see claude.md, "Domain
// conventions") — they're rendered directly by PlaybookActorSheet rather than stored as
// embedded items, so every playbook (current and future) gets them automatically and they
// survive swapActorPlaybook's item wipe (see actor-creation.js) with no per-pack setup.
export const BASIC_MOVES = [
	{
		key: "exchange-blows",
		name: "Exchange Blows",
		// Sheet display order only (see moves-mixin.js's Basic Moves sort) — does not reflect this
		// array's own declaration order, which stays independent.
		displayOrder: 5,
		traits: ["clash", "talk"],
		// Evaluated in PlaybookActorSheet (mirrors requiresChannelDisabled/forcesDesperationAtMaxPerils):
		// _onMoveRoll prompts the player to choose which weapon (or Unarmed — both this move and Strike
		// Decisively cover unarmed/verbal conflict too) they're engaging with, and only that weapon's
		// tags are offered as spends — a two-Blitz-weapons character can't stack both on one swing.
		usesWeapon: true,
		description:
			"<p>When you charge at a foe with your blade, engage someone in debate or try to provoke them, or " +
			"otherwise act against someone able to defend themselves, you are attempting to exchange blows.</p>" +
			"<p>When you do so, advance a GRAVITY clock if you have one, and roll +CLASH or +TALK—whichever is " +
			"more appropriate;</p>" +
			"<p>On a 10+, either your opponent takes a risk, or you take a risk and put your opponent in peril.</p>" +
			"<p>On a 7-9, both you and your target are forced to take a risk.</p>",
		results: {
			success: "Either your opponent takes a risk, or you take a risk and put your opponent in peril.",
			mixed: "Both you and your target are forced to take a risk.",
			failure: null
		}
	},
	{
		key: "weather-the-storm",
		name: "Weather the Storm",
		displayOrder: 2,
		traits: ["defy", "know", "sense"],
		description:
			"<p>When you attempt to ignore the 'witty' barbs of ambitious politicians, try and walk across a thin " +
			"wet beam as thunder booms overhead, or otherwise do something under significant pressure, you're " +
			"attempting to weather the storm.</p>" +
			"<p>When you do so, roll +DEFY to dodge, tough it out or strong-arm your way through; +KNOW to make " +
			"it through with quick thinking or the ace up your sleeve; or +SENSE to notice quiet cues, signs of " +
			"danger or bad vibes before it's too late.</p>" +
			"<p>On a 10+, you manage to make it to safety.</p>" +
			"<p>On a 7-9, you succeed but at some cost: it'll keep you occupied longer than you thought, the " +
			"Director will ask you to make a difficult choice, or you'll burn a point of Spotlight as you take " +
			"dramatic action.</p>",
		results: {
			success: "You manage to make it to safety.",
			mixed: "You succeed but at some cost: it'll keep you occupied longer than you thought, the Director " +
				"will ask you to make a difficult choice, or you'll burn a point of Spotlight as you take " +
				"dramatic action.",
			failure: null
		}
	},
	{
		key: "read-the-room",
		name: "Read the Room",
		displayOrder: 1,
		traits: ["sense"],
		description:
			"<p>When you're trying to figure out which side a battle is in favour of, whether or not a holding " +
			"is defend-able, or are otherwise trying to get insight on your situation, you're trying to read the " +
			"room.</p>" +
			"<p>When you do so, roll +SENSE;</p>" +
			"<p>On a 10+, hold 3. On a 7-9, hold 1, and spend it 1-for-1 to ask the Director the following " +
			"questions; they must answer truthfully. Your hold lasts until you leave the current situation or it " +
			"changes significantly.</p>" +
			"<p>On a failure, you may ask one of the above questions immediately, but the answer creates a " +
			"problem or puts you in danger.</p>" +
			"<p>Roll with advantage when you act on the answers to what you've asked.</p>",
		// Success/mixed hold grants a fresh, sheet-tracked point pool (see rollMove); failure's 0
		// is never written back — a failure grants an immediate question, not stored hold.
		hold: { success: 3, mixed: 1, failure: 0 },
		// Unlike every other questionPrompts/questions move (Mobility, Guerrilla, Stir The Crowd,
		// Face To Face, Tactical Illusions), Read the Room's own failure text still grants an
		// immediate question to ask — so its question list stays visible in chat on a miss too. See
		// rollMove's questions gating in move-roll.js.
		questionsOnFailure: true,
		// Shown above the question list in chat so the questions read as something to be paid for
		// rather than a freebie — on a hit the hold has to be spent, on a miss it doesn't exist.
		questionPrompts: {
			success: "Spend hold 1-for-1 to ask the Director any of these questions; they must answer " +
				"truthfully. Your hold lasts until you leave the situation or it changes significantly.",
			mixed: "Spend hold 1-for-1 to ask the Director any of these questions; they must answer " +
				"truthfully. Your hold lasts until you leave the situation or it changes significantly.",
			failure: "You hold nothing — pick one question to ask the Director immediately."
		},
		questions: [
			"Who has the upper hand here?",
			"What is being overlooked or obscured here?",
			"Where do my Hooks pull me here?",
			"How does ________ really feel?",
			"What is ________'s approach?",
			"How is ________ at risk or in peril?",
			"Where can I find ________?"
		],
		// success/mixed leave resultText unset: the hold count (bold) and questionPrompt already
		// say everything there is to say, so a plain-text "Hold 3."/"Hold 1." would just repeat it.
		results: {
			success: null,
			mixed: null,
			failure: "The answer to your question creates a problem or puts you in danger."
		}
	},
	{
		key: "dispel-uncertainties",
		name: "Dispel Uncertainties",
		displayOrder: 3,
		traits: ["know"],
		description:
			"<p>When you offer an answer to a difficult question, rack your brains for what you know about a " +
			"topic, or explain to everyone what mysterious thing you've encountered is, you are dispelling " +
			"uncertainties.</p>" +
			"<p>When you do so, roll +KNOW;</p>" +
			"<p>On a 10+, your Director will tell you something directly useful you know about the situation or " +
			"subject at hand.</p>" +
			"<p>On a 7-9, your Director will tell you something potentially useful, but it is up to you to " +
			"discern how. Your Director might ask you to explain how you know that information, or where you " +
			"learned it.</p>",
		results: {
			success: "Your Director will tell you something directly useful you know about the situation or " +
				"subject at hand.",
			mixed: "Your Director will tell you something potentially useful, but it is up to you to discern " +
				"how. Your Director might ask you to explain how you know that information, or where you " +
				"learned it.",
			failure: null
		}
	},
	{
		key: "help-or-hinder",
		name: "Help or Hinder",
		displayOrder: 4,
		traits: [],
		// Flavor-only: which side of the roll the player is on doesn't change the math, since the
		// rules text below already covers both outcomes in one sentence per tier.
		intents: [
			{ key: "help", label: "Help" },
			{ key: "hinder", label: "Hinder" }
		],
		// Each checked condition is worth +1 on the roll (see rollMove) — there's no base stat to
		// roll +, unlike every other basic move.
		conditions: [
			{ key: "downtime", label: "Spent meaningful time together during Downtime" },
			{ key: "prior-help", label: "They've helped or hindered you previously this Sortie" },
			{ key: "hook", label: "They're part of one of your Hooks" }
		],
		downtimeAbility:
			"Spending meaningful time with someone during Downtime gives +1 when you help or hinder them afterward.",
		description:
			"<p>When you attempt to lend aid to someone or interfere with their ability to make a roll, you are " +
			"trying to help or hinder.</p>" +
			"<p>When you do so, roll:</p>" +
			"<ul>" +
			"<li>+1 if you spent meaningful time together during Downtime</li>" +
			"<li>+1 if they've helped or hindered you previously this Sortie</li>" +
			"<li>+1 if they're part of one of your Hooks</li>" +
			"</ul>" +
			"<p>On a 10+, they take advantage (help) or disadvantage (hinder) on their roll. On a 7-9, as " +
			"above, but you become entangled in the consequences of their actions, and possibly cause them.</p>",
		results: {
			success: "They take advantage (help) or disadvantage (hinder) on their roll.",
			mixed: "As above, but you become entangled in the consequences of their actions, and possibly " +
				"cause them.",
			failure: null
		}
	},
	{
		key: "weave-magic",
		name: "Weave Magic",
		displayOrder: 7,
		traits: ["channel"],
		// Actor-state-dependent, evaluated in PlaybookActorSheet (mirrors bite-the-dust's
		// forcesDesperationAtMaxPerils above): Paradigm's own Tenets move ("roll +CHANNEL with
		// desperation until you resolve this") is mechanized here rather than on that move itself,
		// since Weave Magic is the actual +CHANNEL roll a Shaken Tenet forces to Desperation. Only
		// ever true for a Paradigm character in practice — see PlaybookActorSheet#_hasShakenTenet.
		forcesDesperationOnShakenTenet: true,
		description:
			"<p>When you invoke your magic to crumble a bridge, attune to mystical orbs at the centre of the " +
			"galaxy, or otherwise do something taxing with your power, you're attempting to weave magic.</p>" +
			"<p>When you do so, roll +CHANNEL;</p>" +
			"<p>On a 10+, you manage to channel power the way you desired without ill effect.</p>" +
			"<p>On a 7-9, you succeed, but your invocation is twisted in an unexpected and dangerous way.</p>",
		results: {
			success: "You manage to channel power the way you desired without ill effect.",
			mixed: "You succeed, but your invocation is twisted in an unexpected and dangerous way.",
			failure: null
		}
	},
	{
		key: "cool-off",
		name: "Cool Off",
		displayOrder: 9,
		traits: ["defy", "sense", "clash", "talk", "know", "channel"],
		description:
			"<p>When you attempt to vent heat from an Astir, to calm yourself from spiralling emotions, or to " +
			"otherwise take a few minutes to fix something about your or someone else's situation, you're trying " +
			"to cool off. When you do so, declare a risk you want to get rid of and roll whatever Trait seems most " +
			"appropriate;</p>" +
			"<p>On a 10+, you/they erase a risk or untick 'overheating' from an Astir.</p>" +
			"<p>On a 7-9, you/they erase a risk or untick 'overheating' from an Astir, but your moment of " +
			"safety is interrupted.</p>",
		results: {
			success: "You/they erase a risk or untick 'overheating' from an Astir.",
			mixed: "You/they erase a risk or untick 'overheating' from an Astir, but your moment of safety is " +
				"interrupted.",
			failure: null
		}
	},
	{
		key: "strike-decisively",
		name: "Strike Decisively",
		displayOrder: 6,
		traits: ["clash", "talk"],
		// See exchange-blows above — same weapon-choice treatment.
		usesWeapon: true,
		description:
			"<p>When you're lining up the perfect shot against an opponent who can't defend themselves, delivering " +
			"a scathing dismissal of their character using irrefutable fact, or otherwise engaging someone who is " +
			"defenceless, you are striking decisively. When you do so, roll +CLASH or +TALK, whichever is more " +
			"appropriate;</p>" +
			"<p>On a 10+, you strike true. Director characters are killed, forced to retreat or otherwise removed " +
			"as a threat as per the fiction. Player characters should bite the dust.</p>" +
			"<p>On a 7-9, you succeed as above, but choose 1;</p>" +
			"<ul>" +
			"<li>You overreach or underestimate—take a risk.</li>" +
			"<li>You waste ammo or words, losing use a weapon until you can re-arm, or losing the weight of some " +
			"bargaining chip or piece of leverage.</li>" +
			"<li>You strike carelessly, causing collateral damage beyond your expectations.</li>" +
			"</ul>",
		results: {
			success: "You strike true. Director characters are killed, forced to retreat or otherwise removed as " +
				"a threat as per the fiction. Player characters should bite the dust.",
			mixed: "<p>You strike true, but choose 1:</p>" +
				"<ul>" +
				"<li>You overreach or underestimate—take a risk.</li>" +
				"<li>You waste ammo or words, losing use a weapon until you can re-arm, or losing the weight " +
				"of some bargaining chip or piece of leverage.</li>" +
				"<li>You strike carelessly, causing collateral damage beyond your expectations.</li>" +
				"</ul>",
			failure: null
		}
	},
	{
		key: "heat-up",
		name: "Heat Up",
		displayOrder: 8,
		traits: [],
		// No roll of its own — see PlaybookActorSheet#_availableHeatUp and rollMove's heatUpOffer
		// in move-roll.js. The actual mechanic is a button offered on every OTHER roll's chat card.
		description:
			"<p>When you push your Astir to its limits and start to heat up, you may tick 'overheating' to retry " +
			"a roll. The original results are discarded, and you must take the second roll even if it's worse.</p>"
	},
	{
		key: "bite-the-dust",
		name: "Bite the Dust",
		displayOrder: 10,
		traits: ["defy"],
		// Actor-state-dependent, evaluated in PlaybookActorSheet (mirrors b-plot's
		// requiresChannelDisabled above) rather than here: once a character is DEFENSELESS (at max
		// Dangers) and every one of those Dangers is a Peril, this move's Effect is forced to
		// Desperation and the roll dialog's Effect select is locked so it can't be changed away.
		forcesDesperationAtMaxPerils: true,
		description:
			"<p>When something dangerous slips through your defences, you're caught off-guard, or someone " +
			"delivers those perfect words to tear you down, you're at risk of biting the dust. When you do so, " +
			"roll +DEFY;</p>" +
			"<p>On a 10+, they miss, hesitate, or you're saved by sheer luck—you rally, and clear a risk if you " +
			"have one.</p>" +
			"<p>On a 7-9, retreat from the Sortie safely, or be put in peril.</p>" +
			"<p>On a fail, that strike sure was decisive. Decide with your Director the consequences of what has " +
			"happened to you—what was damaged? What have you lost? Who and what is changed by your defeat? If you " +
			"survive, you are changed by your defeat. As well as the above, choose one;</p>" +
			"<ul>" +
			"<li>Deepen all of your Hooks, as you clutch your ideals tighter and tighter.</li>" +
			"<li>Loosen all of your Hooks, as you lose faith in that which drives you.</li>" +
			"<li>Take a burden, as you are saddled with some lingering injury, duty or obligation.</li>" +
			"<li>Choose a new playbook. Keep what moves you and your Director agree are truly part of your " +
			"character, and discard the others. Replace them with the starting moves for your new playbook. You " +
			"do not gain its starting equipment.</li>" +
			"</ul>",
		results: {
			success: "They miss, hesitate, or you're saved by sheer luck—you rally, and clear a risk if you have " +
				"one.",
			mixed: "Retreat from the Sortie safely, or be put in peril.",
			failure: "<p>Decide with your Director the consequences of what has happened to you—what was " +
				"damaged? What have you lost? Who and what is changed by your defeat? If you survive, you are " +
				"changed by your defeat. As well as the above, choose one:</p>" +
				"<ul>" +
				"<li>Deepen all of your Hooks, as you clutch your ideals tighter and tighter.</li>" +
				"<li>Loosen all of your Hooks, as you lose faith in that which drives you.</li>" +
				"<li>Take a burden, as you are saddled with some lingering injury, duty or obligation.</li>" +
				"<li>Choose a new playbook. Keep what moves you and your Director agree are truly part of " +
				"your character, and discard the others. Replace them with the starting moves for your new " +
				"playbook. You do not gain its starting equipment.</li>" +
				"</ul>"
		}
	}
];
