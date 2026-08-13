import { TRAITS } from "../core/traits.js";

// This file is the barrel for scripts/moves/: BASIC_MOVES/SPECIAL_MOVES (the two catalogs) live in
// basic-moves.js/special-moves.js, the tier/result helpers (MOVE_RESULT_LABELS, HOLD_MIN/HOLD_MAX,
// FAILURE_REMINDERS, buildReminders, moveResultTier, isCriticalResult, resolveTierValue) live in
// move-results.js, the roll-configuration dialogs (configureMoveRoll, configureVariableDiceRoll,
// showMoveDescription, plus their own MOVE_ROLL_DIALOG_TEMPLATE/VARIABLE_DICE_ROLL_DIALOG_TEMPLATE)
// live in move-dialogs.js, and the actual roll pipeline (explodeSixes, rollVariableDicePool,
// rollMove, postGuidedResult, postMoveDescription, plus their own MOVE_CHAT_TEMPLATE) live in
// move-roll.js. Everything below is re-exported so every existing importer of moves.js keeps
// working unchanged (see playbook-moves.js's own `export { MOVE_POOLS };` for the precedent this
// follows, and astir.js for a second split along the same lines — including its own precedent of
// letting each sibling own the constant(s) only it needs, rather than declaring them here and
// creating a barrel<->sibling import cycle). Only availableMoveTraits — genuinely cross-cutting,
// since it reads TRAITS directly rather than through any one sibling's catalog — stays declared in
// this file itself.
export { BASIC_MOVES } from "./basic-moves.js";
export { SPECIAL_MOVES } from "./special-moves.js";
export {
	MOVE_RESULT_LABELS,
	HOLD_MIN,
	HOLD_MAX,
	FAILURE_REMINDERS,
	buildReminders,
	moveResultTier,
	isCriticalResult,
	resolveTierValue
} from "./move-results.js";
export {
	MOVE_ROLL_DIALOG_TEMPLATE,
	VARIABLE_DICE_ROLL_DIALOG_TEMPLATE,
	configureMoveRoll,
	configureVariableDiceRoll,
	showMoveDescription
} from "./move-dialogs.js";
export {
	MOVE_CHAT_TEMPLATE,
	explodeSixes,
	rollVariableDicePool,
	rollMove,
	postGuidedResult,
	postMoveDescription
} from "./move-roll.js";

// Traits a move can be rolled with, filtered to the ones this actor currently has enabled
// (e.g. CHANNEL stays hidden for playbooks that don't grant it — see TRAITS/stat.disabled).
export function availableMoveTraits(actor, move) {
	return move.traits
		.map((key) => TRAITS.find((trait) => trait.key === key))
		.filter((trait) => trait && !actor.system.stats?.[trait.key]?.disabled);
}
