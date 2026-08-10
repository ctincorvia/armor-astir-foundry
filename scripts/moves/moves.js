import {
	ADVANTAGE_STATES,
	DIE_FACES,
	EFFECT_STATES,
	KEPT_DICE,
	NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS,
	advantageState,
	applyRollEffects,
	effectState,
	nextAdvantageState,
	rollConditions
} from "./roll-effects.js";
import { TRAITS } from "../core/traits.js";
import { findEquipmentTag } from "../equipment/equipment.js";

export const MOVE_CHAT_TEMPLATE = "modules/armor-astir/templates/move-chat.hbs";
export const MOVE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/move-roll-dialog.hbs";

export const MOVE_RESULT_LABELS = {
	success: "Success (10+)",
	mixed: "Mixed Success (7-9)",
	failure: "Failure (6-)"
};

// Matches the highest per-tier hold any basic move currently grants (read-the-room's 3 on a
// 10+); also reused as the cap for every flatHold move's own separately-tracked pool (see
// PlaybookActorSheet#_moveGroupMoves) since all of them cap at 3 today. Revisit if a future move
// grants more.
export const HOLD_MIN = 0;
export const HOLD_MAX = 3;

// What always happens on a full failure (6-), regardless of the move: the player banks a point
// of spotlight and the Director takes their turn. The chat card carries these as prompts because
// several basic moves have no failure text of their own, and both are easy to forget.
export const FAILURE_REMINDERS = [
	"Add a point of spotlight",
	"The Director makes a move"
];

// Bite the Dust's own failure text already references deepening/loosening Hooks as prose (see
// below); these two reminders surface the same prompt on every roll that qualifies, not just
// that one move, mirroring FAILURE_REMINDERS' own "easy to forget" rationale. Hook depth itself
// stays a manual player edit (system.attributes.hooks, see tracking-mixin.js) — this is display
// text only, not an automatic mutation.
const DESPERATION_SUCCESS_REMINDER = "You may deepen a Hook";
const CONFIDENCE_FAILURE_REMINDER = "You may loosen a Hook";

// Confidence/Desperation reminders stack with (rather than replace) the full-failure ones — a
// Confidence roll that still fails full both banks a point of spotlight and "may loosen a Hook"
// at once. Extracted out of rollMove so move-chat-listeners.js#handleAdvantage can rebuild a
// card's reminders after retroactively adding a die changes its tier (see roll-effects.js#
// nextAdvantageState), without duplicating this logic.
//
// extraFailureReminder (e.g. Walk-on Part In The War's "Tick 'overheating' on your Astir" — see
// PlaybookActorSheet#_grantedFailureReminderForMove/moves-mixin.js) is a move-specific reminder a
// picked playbook move adds to a *different* move's failure result, for a consequence this module
// has no automatic tracker for (see claude.md's "Manual trackers, not enforcement"). Only ever
// surfaced on an actual 6-, same as the universal FAILURE_REMINDERS above.
export function buildReminders(tier, effect, extraFailureReminder = null) {
	return [
		...(tier === "failure" ? FAILURE_REMINDERS : []),
		...(effect.key === "desperation" && tier === "success" ? [DESPERATION_SUCCESS_REMINDER] : []),
		...(effect.key === "confidence" && tier === "failure" ? [CONFIDENCE_FAILURE_REMINDER] : []),
		...(tier === "failure" && extraFailureReminder ? [extraFailureReminder] : [])
	];
}

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
		// Unlike every other questionPrompts/questions move (Mobility, Guerrilla, Stir The Crowd,
		// Face To Face, Tactical Illusions), Read the Room's own failure text still grants an
		// immediate question to ask — so its question list stays visible in chat on a miss too. See
		// rollMove's questions gating below.
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
		traits: [],
		// No roll of its own — see PlaybookActorSheet#_availableHeatUp and rollMove's heatUpOffer
		// below. The actual mechanic is a button offered on every OTHER roll's chat card.
		description:
			"<p>When you push your Astir to its limits and start to heat up, you may tick 'overheating' to retry " +
			"a roll. The original results are discarded, and you must take the second roll even if it's worse.</p>"
	},
	{
		key: "bite-the-dust",
		name: "Bite the Dust",
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

// Special moves sit in their own sheet section below Basic Moves (see
// PlaybookActorSheet#getData) but share the exact same shape/handling as basic moves — the only
// structural difference is where they're grouped. Some special moves are additionally
// conditional on actor state via requiresChannelDisabled (see b-plot below and
// PlaybookActorSheet's `gated` computation) rather than being available unconditionally like
// lead-a-sortie and subsystems.
export const SPECIAL_MOVES = [
	{
		key: "lead-a-sortie",
		name: "Lead a Sortie",
		traits: ["know", "defy"],
		// CREW isn't a TRAITS entry or a stat on this actor — it's the Carrier's own Crew trait
		// (see carrier-actor-sheet.js). The `value: 0` here is only a placeholder for a fresh
		// move definition; PlaybookActorSheet#_moveTraits overwrites it with a live read off
		// whichever Carrier actor exists in the world before this ever reaches a sheet or a roll.
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
	},
	{
		key: "b-plot",
		name: "B-Plot",
		traits: [],
		// Gates the move for CHANNEL-enabled actors (e.g. The Impostor) — the mirror image of
		// weave-magic's traits-based gating (disabled when CHANNEL is *disabled*). See
		// PlaybookActorSheet's `gated` computation, which ORs this in alongside the existing
		// traits-empty check. The move stays visible and its description readable either way,
		// same as any other gated move — only its hold stepper is greyed out/disabled.
		requiresChannelDisabled: true,
		// No roll — traits is empty and there are no conditions, so `rollable` in
		// PlaybookActorSheet stays false, same treatment as subsystems.
		// Hold is granted flat by narration, not by a roll tier (contrast read-the-room's
		// `hold: {success,mixed,failure}`), and tracked in its own actor field rather than the
		// shared system.resources.hold pool, since a character could plausibly hold both at
		// once — see PlaybookActorSheet.
		flatHold: 3,
		// Its own text scopes spending this hold to "During the Sortie" — cleared by the
		// Controls tab's Refresh Sortie button (see PlaybookActorSheet#_onRefreshSortie).
		period: "Sortie",
		description:
			"<p>When you head out for some solitary revenge, leave to take part in negotiations, or " +
			"otherwise take part in a secondary narrative thread to the players involved in the Sortie, " +
			"you're in the b-plot.</p>" +
			"<p>Name one or two Director characters that accompany you and hold 3. During the Sortie, you " +
			"may spend it 1-for-1 to do the following;</p>" +
			"<ul>" +
			"<li>Give another player confidence on their next move, but complicate things for yourself.</li>" +
			"<li>Deny an actor from appearing during the Sortie—they're busy, possibly with the same thing " +
			"as you.</li>" +
			"<li>Spend some time and frame a Downtime Scene.</li>" +
			"<li>Cut away from the Sortie during a moment when time is precious, giving everyone room to " +
			"think.</li>" +
			"</ul>"
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
//
// lockedEffect (e.g. "desperation" for bite-the-dust at max Perils — see
// PlaybookActorSheet#_onMoveRoll) pre-selects and disables the dialog's Effect select, and is
// forced into the resolved effect regardless of what the disabled select reports, as a
// belt-and-suspenders match to the template's disabled attribute.
//
// lockedAdvantage (e.g. "advantage" for Don't Follow Me's "lead a Sortie with +DEFY & advantage"
// — see PlaybookActorSheet#_grantedAdvantageForMove) is the same idea for the Dice select: pre-
// selects and disables it, and is forced into the resolved advantage the same
// belt-and-suspenders way, though an Astir Part's own spend.advantage (Artifact) still wins over
// it — a reactive, player-chosen spend outranks a standing grant, the same precedence a spent
// equipment/Astir Part effect already takes over lockedEffect.
//
// lockedTrait (Don't Follow Me's own +DEFY half — see PlaybookActorSheet#_grantedTraitForMove) is
// the Trait-select counterpart, but carries the full {key, label, value} option object rather
// than a bare key: unlike Effect/Advantage, whose possible values are a small fixed catalog
// (EFFECT_STATES/ADVANTAGE_STATES) this module can resolve a label from, a Trait's value is
// actor-specific, so the caller (which already resolved `traits` for display) hands over the
// exact entry to lock rather than a key this function would have to re-look-up.
//
// equipmentSpends (see PlaybookActorSheet#_equipmentSpends) is the actor's unspent, spendable
// equipment tags — not part of the move's own definition, unlike intents/conditions, so it's
// passed in rather than read off `move`. Offering it here, rather than filtering it down before
// the call, keeps this one place responsible for turning "what's offerable" into "what was
// checked".
//
// astirPartSpends (see PlaybookActorSheet#_astirPartSpends) is the same idea for an Astir Part's
// `spend` field rather than an equipment tag's — rendered in its own dialog section (see
// move-roll-dialog.hbs) since it isn't tied to any one equipment entry. A checked part can set
// either axis: `spend.effect` slots into the same precedence as an equipment tag's spend, and
// `spend.advantage` (new — nothing overrode the Advantage axis before Artifact) wins over
// whatever the Dice select reports, the same way a spent effect already wins over the Effect
// select.
//
// guided (see PlaybookActorSheet#_weaponIsGuided) adds a third "Take 7-9 (Guided)" button
// alongside Roll/Cancel — Guided's "take a 7-9 rather than rolling, if you wish" is the player's
// choice at the moment of rolling, not a pre-filtered option, so every field above stays exactly
// as offered; picking it just resolves without ever reading any of them.
export async function configureMoveRoll(
	move,
	traits,
	{ lockedEffect = null, lockedAdvantage = null, lockedTrait = null, equipmentSpends = [], astirPartSpends = [], guided = false } = {}
) {
	const content = await renderTemplate(MOVE_ROLL_DIALOG_TEMPLATE, {
		traits,
		// The Trait select's own options need each option's numeric value baked into its label
		// ("CLASH (2)") — a format selectOptions' plain valueAttr/labelAttr can't produce on its
		// own, which is why this select is hand-rolled rather than using selectOptions the way
		// Dice/Effect below do. traitOptions carries that pre-formatted label alongside the raw
		// key, purely for this <select>'s own selectOptions call (see move-roll-dialog.hbs) — kept
		// separate from `traits` itself so every existing caller reading the `traits` key back off
		// this template call is unaffected.
		traitOptions: traits.map((trait) => ({ key: trait.key, label: `${trait.label} (${trait.value})` })),
		intents: move.intents,
		conditions: move.conditions,
		advantageStates: ADVANTAGE_STATES,
		effectStates: EFFECT_STATES,
		lockedEffect,
		// Display label for the locked-note below the Effect select — resolved here rather than
		// hardcoded in the template, since lockedEffect can now be "confidence" (Field Scout's
		// grantsEffectOnMove — see PlaybookActorSheet#_grantedEffectForMove) as well as the
		// original "desperation" sources (bite-the-dust at max Perils, a forced weapon tag).
		lockedEffectLabel: lockedEffect ? effectState(lockedEffect).label : null,
		lockedAdvantage,
		lockedAdvantageLabel: lockedAdvantage ? advantageState(lockedAdvantage).label : null,
		lockedTrait,
		equipmentSpends,
		astirPartSpends,
		guided
	});

	return new Promise((resolve) => {
		new Dialog({
			title: `Roll ${move.name}`,
			content,
			buttons: {
				roll: {
					label: "Roll",
					// intent/conditions keys are only added for moves that define them (Help or
					// Hinder); spentTags/spentParts are only added when there was equipment/an
					// Astir Part to offer in the first place — every other roll's resolved shape
					// is untouched.
					callback: (html) => {
						const spentTags = equipmentSpends.length
							? html.find("[name='equipment-tag']:checked").map((_, el) => el.value).get()
								.map((value) => {
									const [equipmentId, tagKey] = value.split("::");
									return { equipmentId, tagKey };
								})
							: [];
						const spentParts = astirPartSpends.length
							? html.find("[name='astir-part-spend']:checked").map((_, el) => el.value).get()
							: [];
						const spentPartSpends = spentParts
							.map((partKey) => astirPartSpends.find((spend) => spend.partKey === partKey))
							.filter(Boolean);
						// A checked spend's effect (e.g. Blitz -> confidence) sets the roll's
						// Effect directly, the same way lockedEffect does — checking the tag IS
						// the player choosing to act with confidence, so it can't require also
						// separately matching the Effect select. lockedEffect still wins over a
						// spend the same way it already wins over the select (bite-the-dust at
						// max Perils's offered spends render disabled for exactly this reason —
						// see PlaybookActorSheet#_equipmentSpends). On a spend collision (two
						// checked tags both setting Effect) the later one wins.
						const spentEffect = spentTags
							.map(({ equipmentId, tagKey }) => equipmentSpends.find(
								(spend) => spend.equipmentId === equipmentId && spend.tagKey === tagKey
							))
							.filter(Boolean)
							.at(-1)?.effect;
						const spentPartEffect = spentPartSpends.filter((spend) => spend.effect).at(-1)?.effect;
						const spentPartAdvantage = spentPartSpends.filter((spend) => spend.advantage).at(-1)?.advantage;

						resolve({
							trait: lockedTrait ?? traits.find((t) => t.key === html.find("[name='trait']").val()),
							advantage: spentPartAdvantage ?? lockedAdvantage ?? html.find("[name='advantage']").val(),
							effect: lockedEffect ?? spentEffect ?? spentPartEffect ?? html.find("[name='effect']").val(),
							...(move.intents && {
								intent: move.intents.find((i) => i.key === html.find("[name='intent']").val())
							}),
							...(move.conditions && {
								conditions: html.find("[name='condition']:checked").map((_, el) => el.value).get()
							}),
							...(equipmentSpends.length && { spentTags }),
							...(astirPartSpends.length && { spentParts })
						});
					}
				},
				...(guided && {
					takeSeven: {
						label: "Take 7-9 (Guided)",
						callback: () => resolve({ takeSeven: true })
					}
				}),
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "roll",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "move-roll-dialog"],
			// Dialog's own default (400px) crowded the Equipment section's tag name + description
			// onto too narrow a column once the checkbox got its own row back (see
			// move-roll-equipment-spend-option in styles/playbook-actor-sheet.css) — a little extra
			// width gives that text room without needing to shrink or truncate it.
			width: 480
		}).render(true);
	});
}

// Number Of The Beast's exploding-6 mechanic (see playbook-moves.js's the-wither:number-of-the-beast
// / grantsExplodingSixes). Rolls one additional d6 for every die in `dice` (the full pool — see
// applyRollEffects — not just the two kept for the total; see the design-risk note in the plan)
// whose final, post-substitution face shows a 6, and lets a freshly-rolled exploded die that itself
// lands on a 6 explode again, up to NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS as a defensive cap. Each
// exploded die gets the same Confidence/Desperation single-face substitution the initial pool
// already got (see applyRollEffects), so a Desperation roll that turns an exploded 6 into a 1 does
// not chain-explode, and a Confidence roll that turns an exploded 1 into a 6 does.
//
// Returns { bonus, sixCount, extraDice, triggered }:
//  - bonus: sum of every exploded die's final face, added to the roll's total unconditionally
//    ("add it to the total for that roll" — not "if kept").
//  - sixCount: total 6-faces across the *entire* roll (initial pool + every exploded die).
//  - extraDice: {original, result, changed} breakdown per exploded die, same shape as
//    applyRollEffects' own return, for the chat card to render alongside the normal dice list.
//  - triggered: true once sixCount reaches 3. There is no death/incapacitation system anywhere in
//    this module to hook the "killed in a spectacular fashion" consequence into (see claude.md) —
//    this only drives an unmissable chat-card badge; narrating the consequence is left to the table.
export async function explodeSixes(dice, effect) {
	let sixCount = dice.filter((die) => die.result === DIE_FACES).length;
	let toRoll = sixCount;
	const extraDice = [];
	let bonus = 0;

	while (toRoll > 0 && extraDice.length < NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS) {
		toRoll -= 1;
		const explosionRoll = new Roll(`1d${DIE_FACES}`);
		await explosionRoll.evaluate();
		const original = explosionRoll.dice[0].results[0].result;
		const result = original === effect.from ? effect.to : original;
		extraDice.push({ original, result, changed: original !== result });
		bonus += result;
		if (result === DIE_FACES) {
			sixCount += 1;
			toRoll += 1;
		}
	}

	return { bonus, sixCount, extraDice, triggered: sixCount >= 3 };
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
	// A derived Trait bonus (Arcane Augments, Let Loose — see trait-bonuses.js), resolved by
	// PlaybookActorSheet#_rollMove for whichever trait was actually chosen and passed in as a
	// plain number — this module has no actor to derive it from itself, and the dialog's own
	// displayed trait value (see PlaybookActorSheet#_moveTraits) is display-only: an actor-trait
	// key always re-reads its live stat above rather than trusting `trait.value`, so the bonus has
	// to reach the roll through this explicit option instead.
	const value = statValue + conditionBonus + (options.traitBonus ?? 0);
	const advantage = advantageState(options.advantage);
	const effect = effectState(options.effect);

	const roll = new Roll(`${advantage.dice}d${DIE_FACES} + @mod`, { mod: value });
	await roll.evaluate();

	const dice = applyRollEffects(roll.dice[0].results, { advantage, effect });
	if (advantage.dice > KEPT_DICE) {
		roll.dice[0].modifiers.push(advantage.keepLowest ? `kl${KEPT_DICE}` : `kh${KEPT_DICE}`);
	}

	// Number Of The Beast (see playbook-moves.js) — options.explodeOnSix is set by
	// PlaybookActorSheet#_rollMove whenever the acting actor has picked that move; applies to every
	// roll they make, not just one move key. Not merged into `dice` itself — see the regression-guard
	// comment on roll-effects.js#rolledDoubles (Flourish Component's "regain Power on doubles") this
	// would otherwise break if an exploded die were appended there.
	const explosion = options.explodeOnSix ? await explodeSixes(dice, effect) : null;

	roll._formula = roll.formula;
	roll._total = dice.filter((die) => die.kept).reduce((sum, die) => sum + die.result, 0)
		+ (explosion?.bonus ?? 0)
		+ value;

	const tier = moveResultTier(roll.total);

	// Hold is a fresh per-situation pool, not a per-roll bonus, so a re-roll overwrites rather
	// than adds to it (see moves.js BASIC_MOVES comment on read-the-room). A failure's 0 is
	// never written back — it grants an immediate question, not stored hold, and writing 0 would
	// wipe hold left over from an earlier successful read.
	const hold = move.hold ? move.hold[tier] : null;
	if (move.hold && tier !== "failure") {
		// separateHold (e.g. Mobility — see playbook-moves.js) routes a roll-tiered hold grant
		// into its own per-move pool, the same field flatHold moves already use, instead of the
		// shared system.resources.hold field Read the Room writes — otherwise a second roll-tiered
		// hold move would silently overwrite Read the Room's live hold (see
		// PlaybookActorSheet#_moveGroupMoves, which reads hold back from the matching field).
		const holdField = move.separateHold
			? `system.attributes.moveHold.${move.key}.value`
			: "system.resources.hold.value";
		await actor.update({ [holdField]: hold });
	}

	// Checked conditions (e.g. Help or Hinder's Downtime/prior-help/Hook) ride alongside the
	// Advantage/Confidence badges in the same chat display — both are just "why the total is what
	// it is" tags, so they share the .move-condition rendering rather than needing their own.
	const moveConditions = (move.conditions ?? [])
		.filter((condition) => options.conditions?.includes(condition.key))
		.map(({ key, label }) => ({ key, label }));

	// A spent equipment tag (e.g. Blitz — see equipment.js) is the same kind of "why the total is
	// what it is" badge, so it rides in the same conditions list rather than getting its own
	// template section. Resolved from the catalog here (not carried on options.spentTags itself)
	// so a stale tagKey — the equipment was edited between opening the dialog and rolling —
	// quietly drops instead of rendering a blank badge.
	const equipmentConditions = (options.spentTags ?? [])
		.map(({ tagKey }) => findEquipmentTag(tagKey))
		.filter(Boolean)
		.map(({ key, label }) => ({ key, label }));

	// A spent Astir Part (Artifact — see astir.js) is the same kind of "why the total is
	// what it is" badge as a spent equipment tag, so it rides in the same conditions list. Passed
	// in pre-resolved (rather than a partKey this module would have to look up) so moves.js never
	// needs to import astir.js — see PlaybookActorSheet#_rollMove.
	const astirPartConditions = options.spentPartLabels ?? [];

	// Whether this roll can still be retroactively pushed a further step of Advantage/Disadvantage
	// (or stepped back down) after it's posted (see roll-effects.js#nextAdvantageState) — both
	// flags ride along on the chat card so its own Add Advantage/Add Disadvantage buttons know
	// whether to render, and the same check re-runs after each such change (see
	// move-chat-listeners.js#handleAdvantage) since only the x2 cap in the same direction ever
	// actually blocks a button — the opposite direction always steps down instead.
	const showAddAdvantage = nextAdvantageState(advantage.key, "advantage") !== null;
	const showAddDisadvantage = nextAdvantageState(advantage.key, "disadvantage") !== null;

	const reminders = buildReminders(tier, effect, options.extraFailureReminder);

	// options.reroll (see PlaybookActorSheet#_availableReroll) is only ever set for a usesWeapon
	// move whose chosen weapon still has an unspent Decisive/Defensive/Versatile tag matching this
	// move — but the reroll itself (Decisive: "reroll a failed strike decisively") only ever
	// applies to a 6- result, so it's only offered on the chat card, and only ever recorded on the
	// message, when the roll actually failed.
	const rerollOffer = tier === "failure" && options.reroll
		? {
			actorId: actor.id,
			moveKey: move.key,
			trait,
			equipmentId: options.reroll.equipmentId,
			tagKey: options.reroll.tagKey,
			// Re-plays the same dice conditions the original attempt used — advantage/effect were
			// the player's own choice, not something a reroll should silently change — but never
			// carries spentTags/reroll forward: any spend already landed on the failed attempt, and
			// the tag this reroll itself consumes is marked spent separately (see
			// PlaybookActorSheet#onRenderMoveChat), not through another roll-dialog spend.
			options: {
				advantage: options.advantage,
				effect: options.effect,
				weaponLabel: options.weaponLabel,
				weaponTags: options.weaponTags
			}
		}
		: null;

	// options.automaticSuccess (see PlaybookActorSheet#_availableAutomaticSuccess) is the actor's
	// full list of currently-qualifying "spend hold/a use to treat this roll as a 10+" sources
	// (Hot-blooded, Once the War's Over, The Arity Method) — offered on the chat card only when
	// there's actually room to improve the result; an already-successful roll has nothing to spend
	// toward.
	const automaticSuccessOffer = tier !== "success" ? (options.automaticSuccess ?? []) : [];

	// options.heatUp (see PlaybookActorSheet#_availableHeatUp) is unscoped by move key or weapon,
	// unlike reroll — but like reroll, and unlike automaticSuccess, the button is omitted entirely
	// (not just disabled) when unavailable, so there's nothing to click on a card where it wouldn't
	// do anything. No tier restriction either: Heat Up ("you must take the second roll even if it's
	// worse") is a gamble offered on any result, not just a failure.
	const heatUpOffer = options.heatUp
		? {
			actorId: actor.id,
			moveKey: move.key,
			trait,
			options: {
				advantage: options.advantage,
				effect: options.effect,
				weaponLabel: options.weaponLabel,
				weaponTags: options.weaponTags
			}
		}
		: null;

	// Pulled into its own variable (rather than inlined into the renderTemplate call, as before)
	// so the exact args used for this render can also ride along on the message's flags — see
	// PlaybookActorSheet#handleAutomaticSuccess, which reuses it to regenerate the flavor with only
	// the tier-dependent fields changed, instead of re-deriving every display field from scratch.
	const flavorArgs = {
		name: move.name,
		traitLabel: trait?.label ?? null,
		intentLabel: options.intent?.label ?? null,
		// Set by PlaybookActorSheet#_rollMove for a usesWeapon move — the chosen weapon's name, or
		// the literal string "Unarmed" — regardless of whether any of its tags were spent, so the
		// chat card always records which weapon (if any) the roll used. null for every other move.
		weaponLabel: options.weaponLabel ?? null,
		// The chosen weapon's full tag list (e.g. "Melee, Decisive"), as a single comma-joined
		// string rather than a further conditions-style badge list — this is descriptive info
		// about the weapon itself, not "why the total is what it is" the way a spent tag or
		// Advantage/Confidence is (see moveConditions/equipmentConditions above). null for Unarmed
		// and for every non-usesWeapon move, same as weaponLabel.
		weaponTags: options.weaponTags ?? null,
		tier,
		tierLabel: MOVE_RESULT_LABELS[tier],
		resultText: move.results[tier],
		reminders: reminders.length ? reminders : null,
		conditions: [...rollConditions(advantage, effect), ...moveConditions, ...equipmentConditions, ...astirPartConditions],
		dice,
		// Number Of The Beast (see explodeSixes above) — null/false for every actor who hasn't picked
		// it, so the chat template renders nothing extra for anyone else.
		explodedDice: explosion?.extraDice.length ? explosion.extraDice : null,
		beastTriggered: Boolean(explosion?.triggered),
		hold,
		questionPrompt: move.questionPrompts?.[tier] ?? null,
		// A choice list only makes sense in chat when this tier actually offers a choice — every
		// questionPrompts/questions move except Read the Room (questionsOnFailure) has nothing to
		// choose from on a miss, even when its failure questionPrompt still has explanatory text
		// (e.g. Mobility's "You hold nothing.").
		questions: (tier !== "failure" || move.questionsOnFailure) ? (move.questions ?? null) : null,
		reroll: Boolean(rerollOffer),
		automaticSuccess: automaticSuccessOffer,
		heatUp: Boolean(heatUpOffer),
		showAddAdvantage,
		showAddDisadvantage
	};
	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, flavorArgs);

	// Both offers ride in the same flags namespace so a single card (e.g. a failed usesWeapon roll)
	// can carry a reroll tag offer and an automatic-success spend offer at once. advantageOffer is
	// always attached (unlike reroll/automaticSuccess, which only exist when actually offered) —
	// every dice roll can potentially receive Advantage/Disadvantage after the fact, even a
	// currently-maxed one, where showAddAdvantage/showAddDisadvantage above are already both false
	// so the card simply renders no buttons for it.
	const cardFlags = {
		...(rerollOffer && { reroll: rerollOffer }),
		...(automaticSuccessOffer.length && {
			automaticSuccess: { actorId: actor.id, moveKey: move.key, flavorArgs, sources: automaticSuccessOffer }
		}),
		...(heatUpOffer && { heatUp: heatUpOffer }),
		advantageOffer: {
			actorId: actor.id,
			moveKey: move.key,
			value,
			effectKey: options.effect ?? "none",
			advantageKey: advantage.key,
			dice,
			extraConditions: [...moveConditions, ...equipmentConditions, ...astirPartConditions],
			// Carried alongside extraConditions so move-chat-listeners.js#handleAdvantage can rebuild
			// this reminder too if a retroactive Advantage/Disadvantage add flips the tier into or out
			// of failure (see buildReminders' own extraFailureReminder param).
			extraFailureReminder: options.extraFailureReminder ?? null,
			flavorArgs
		}
	};
	const message = await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor,
		...(Object.keys(cardFlags).length && { flags: { "armor-astir": cardFlags } })
	});

	// dice is returned alongside the chat message so PlaybookActorSheet#_rollMove can check for
	// Flourish Component's "regain Power on doubles" (see roll-effects.js#rolledDoubles) without
	// this module needing to know anything about Astir Parts. tier is returned so
	// PlaybookActorSheet#_onMoveResolved can flip Cold Company's haunted/dispelled state off this
	// roll's own outcome without re-deriving it — the same "extend rollMove's return shape as an
	// escape hatch" pattern dice itself was added under for Flourish Component.
	return { message, dice, tier };
}

// Guided's "take a 7-9 rather than rolling, if you wish" (see equipment.js's EQUIPMENT_TAGS
// comment) — posts the same mixed-success chat shape rollMove would, minus every dice-specific
// field (no Roll term ever gets created), when the player picks configureMoveRoll's "Take 7-9"
// button instead of rolling. Hold still gets granted exactly as rollMove would on a real 7-9 —
// Guided skips the dice, not the move's own consequences.
export async function postGuidedResult(actor, move, options = {}) {
	const tier = "mixed";
	const hold = move.hold ? move.hold[tier] : null;
	if (move.hold) {
		// Same separateHold routing as rollMove above.
		const holdField = move.separateHold
			? `system.attributes.moveHold.${move.key}.value`
			: "system.resources.hold.value";
		await actor.update({ [holdField]: hold });
	}

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		traitLabel: null,
		intentLabel: null,
		weaponLabel: options.weaponLabel ?? null,
		weaponTags: options.weaponTags ?? null,
		tier,
		tierLabel: MOVE_RESULT_LABELS[tier],
		resultText: move.results[tier],
		reminders: null,
		conditions: [{ key: "guided", label: "Guided" }],
		dice: null,
		hold,
		questionPrompt: move.questionPrompts?.[tier] ?? null,
		questions: move.questions ?? null,
		reroll: false
	});

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: flavor
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
