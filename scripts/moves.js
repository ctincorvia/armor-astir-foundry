import {
	ADVANTAGE_STATES,
	DIE_FACES,
	EFFECT_STATES,
	KEPT_DICE,
	advantageState,
	applyRollEffects,
	effectState,
	rollConditions
} from "./roll-effects.js";
import { TRAITS } from "./traits.js";

export const MOVE_CHAT_TEMPLATE = "modules/armor-astir/templates/move-chat.hbs";
export const MOVE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/move-roll-dialog.hbs";

export const MOVE_RESULT_LABELS = {
	success: "Success (10+)",
	mixed: "Mixed Success (7-9)",
	failure: "Failure (6-)"
};

// What always happens on a full failure (6-), regardless of the move: the player banks a point
// of spotlight and the Director takes their turn. The chat card carries these as prompts because
// several basic moves have no failure text of their own, and both are easy to forget.
export const FAILURE_REMINDERS = [
	"Add a point of spotlight",
	"The Director makes a move"
];

export function moveResultTier(total) {
	if (total >= 10) return "success";
	if (total >= 7) return "mixed";
	return "failure";
}

// Basic moves are available to every playbook actor by default (see claude.md, "Domain
// conventions") — they're rendered directly by PlaybookActorSheet rather than stored as
// embedded items, so every playbook (current and future) gets them automatically and they
// survive swapActorPlaybook's item wipe (see actor-creation.js) with no per-pack setup.
export const BASIC_MOVES = [
	{
		key: "exchange-blows",
		name: "Exchange Blows",
		traits: ["clash", "talk"],
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
		traits: ["channel"],
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
		traits: ["clash", "talk"],
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
		key: "bite-the-dust",
		name: "Bite the Dust",
		traits: ["defy"],
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

// Special moves sit in their own sheet section below Basic Moves (see
// PlaybookActorSheet#getData) but share the exact same shape/handling — the only structural
// difference is where they're grouped.
export const SPECIAL_MOVES = [
	{
		key: "lead-a-sortie",
		name: "Lead a Sortie",
		traits: ["know", "defy"],
		// CREW isn't a TRAITS entry — there's no Crew mechanic/UI anywhere in this module yet, so
		// this is a fixed placeholder value (never read from actor.system.stats) rather than a
		// gated/steppable stat like the other five. Revisit once Crew has a real home on the sheet.
		fixedTraits: [{ key: "crew", label: "CREW", value: 0 }],
		description:
			"<p>When it's time for action and you lead a Sortie, decide who planned the mission and roll;</p>" +
			"<ul>" +
			"<li>+KNOW, if you're leading with wits or following a clever plan.</li>" +
			"<li>+CREW, if it was someone else aboard.</li>" +
			"<li>+DEFY, if you're heading into danger blind.</li>" +
			"</ul>" +
			"<p>On a 10+, you make it to the action unscathed.</p>" +
			"<p>On a 7-9, the crew stumbles, misses something important, or is unprepared for what they " +
			"meet.</p>",
		results: {
			success: "You make it to the action unscathed.",
			mixed: "The crew stumbles, misses something important, or is unprepared for what they meet.",
			failure: null
		}
	},
	{
		key: "subsystems",
		name: "Subsystems",
		traits: [],
		// No roll at all — see PlaybookActorSheet's `rollable` flag, which hides the Roll button
		// for moves with no traits, conditions, or fixedTraits. No `results` either, since
		// postMoveDescription (the only path that can ever fire for this move) never reads it.
		description:
			"<p>When you activate your Astir's subsystems, spend 1 Power to re-activate an expended " +
			"[Active] Astir part and use it again.</p>"
	}
];

// Traits a move can be rolled with, filtered to the ones this actor currently has enabled
// (e.g. CHANNEL stays hidden for playbooks that don't grant it — see TRAITS/stat.disabled).
export function availableMoveTraits(actor, move) {
	return move.traits
		.map((key) => TRAITS.find((trait) => trait.key === key))
		.filter((trait) => trait && !actor.system.stats?.[trait.key]?.disabled);
}

// Opens a dialog to pick the trait to roll with (plus any Advantage/Disadvantage and
// Confidence/Desperation) and resolves the player's choice, or null if the dialog was
// dismissed. Always shown — even for a single-trait move — since the dice/effect selection is
// still needed. Mirrors choosePlaybook in actor-creation.js for the resolve/close shape.
export async function configureMoveRoll(move, traits) {
	const content = await renderTemplate(MOVE_ROLL_DIALOG_TEMPLATE, {
		traits,
		intents: move.intents,
		conditions: move.conditions,
		advantageStates: ADVANTAGE_STATES,
		effectStates: EFFECT_STATES
	});

	return new Promise((resolve) => {
		new Dialog({
			title: `Roll ${move.name}`,
			content,
			buttons: {
				roll: {
					label: "Roll",
					// intent/conditions keys are only added for moves that define them (Help or
					// Hinder), so every other move's resolved shape is untouched.
					callback: (html) => resolve({
						trait: traits.find((t) => t.key === html.find("[name='trait']").val()),
						advantage: html.find("[name='advantage']").val(),
						effect: html.find("[name='effect']").val(),
						...(move.intents && {
							intent: move.intents.find((i) => i.key === html.find("[name='intent']").val())
						}),
						...(move.conditions && {
							conditions: html.find("[name='condition']:checked").map((_, el) => el.value).get()
						})
					})
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "roll",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "move-roll-dialog"] }).render(true);
	});
}

// Rebuilds the roll's total in place rather than via Roll.fromTerms: Foundry's AST-based
// evaluator (Roll#_evaluate -> CONFIG.Dice.parser.toAST) only calls .evaluate() on leaf terms
// (Die, NumericTerm), never on the "+" OperatorTerm sitting in roll.terms — so after
// roll.evaluate(), roll.terms is a genuine mix of evaluated and unevaluated terms, which
// Roll.fromTerms explicitly rejects ("either all evaluated, or none evaluated"). Every
// RollTerm#total getter is a pure computed value independent of _evaluated, so recomputing the
// total ourselves from the (already mutated) dice breakdown avoids the mismatch entirely.
export async function rollMove(actor, move, trait, options = {}) {
	// A fixed trait (e.g. Lead a Sortie's CREW placeholder — see SPECIAL_MOVES) carries its own
	// value and is never looked up on the actor, even if actor.system.stats happens to have a
	// same-keyed entry — TRAITS membership, not presence-on-actor, decides which lookup applies.
	const isActorTrait = trait && TRAITS.some((t) => t.key === trait.key);
	const statValue = trait ? (isActorTrait ? (actor.system.stats?.[trait.key]?.value ?? 0) : trait.value) : 0;
	// Conditional +1s for moves with no base stat to roll, e.g. Help or Hinder — each checked
	// condition key contributes +1, on top of (never instead of) any trait value.
	const conditionBonus = (move.conditions ?? [])
		.filter((condition) => options.conditions?.includes(condition.key))
		.length;
	const value = statValue + conditionBonus;
	const advantage = advantageState(options.advantage);
	const effect = effectState(options.effect);

	const roll = new Roll(`${advantage.dice}d${DIE_FACES} + @mod`, { mod: value });
	await roll.evaluate();

	const dice = applyRollEffects(roll.dice[0].results, { advantage, effect });
	if (advantage.dice > KEPT_DICE) {
		roll.dice[0].modifiers.push(advantage.keepLowest ? `kl${KEPT_DICE}` : `kh${KEPT_DICE}`);
	}
	roll._formula = roll.formula;
	roll._total = dice.filter((die) => die.kept).reduce((sum, die) => sum + die.result, 0) + value;

	const tier = moveResultTier(roll.total);

	// Hold is a fresh per-situation pool, not a per-roll bonus, so a re-roll overwrites rather
	// than adds to it (see moves.js BASIC_MOVES comment on read-the-room). A failure's 0 is
	// never written back — it grants an immediate question, not stored hold, and writing 0 would
	// wipe hold left over from an earlier successful read.
	const hold = move.hold ? move.hold[tier] : null;
	if (move.hold && tier !== "failure") {
		await actor.update({ "system.resources.hold.value": hold });
	}

	// Checked conditions (e.g. Help or Hinder's Downtime/prior-help/Hook) ride alongside the
	// Advantage/Confidence badges in the same chat display — both are just "why the total is what
	// it is" tags, so they share the .move-condition rendering rather than needing their own.
	const moveConditions = (move.conditions ?? [])
		.filter((condition) => options.conditions?.includes(condition.key))
		.map(({ key, label }) => ({ key, label }));

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		traitLabel: trait?.label ?? null,
		intentLabel: options.intent?.label ?? null,
		tier,
		tierLabel: MOVE_RESULT_LABELS[tier],
		resultText: move.results[tier],
		reminders: tier === "failure" ? FAILURE_REMINDERS : null,
		conditions: [...rollConditions(advantage, effect), ...moveConditions],
		dice,
		hold,
		questionPrompt: move.questionPrompts?.[tier] ?? null,
		questions: move.questions ?? null
	});

	return roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor
	});
}

export async function postMoveDescription(actor, move) {
	const content = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		description: move.description
	});

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content
	});
}
