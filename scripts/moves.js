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

// On a failure the MC hands the player a point of spotlight, so the chat card carries the
// prompt — several basic moves have no failure text of their own, and this is easy to forget.
export const SPOTLIGHT_REMINDER = "Add a point of spotlight";

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
					callback: (html) => resolve({
						trait: traits.find((t) => t.key === html.find("[name='trait']").val()),
						advantage: html.find("[name='advantage']").val(),
						effect: html.find("[name='effect']").val()
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
	const value = actor.system.stats?.[trait.key]?.value ?? 0;
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
	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		traitLabel: trait.label,
		tier,
		tierLabel: MOVE_RESULT_LABELS[tier],
		resultText: move.results[tier],
		spotlight: tier === "failure" ? SPOTLIGHT_REMINDER : null,
		conditions: rollConditions(advantage, effect),
		dice
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
