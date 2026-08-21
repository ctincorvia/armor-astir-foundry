export const MOVE_RESULT_LABELS = {
	success: "Success (10+)",
	mixed: "Mixed Success (7-9)",
	failure: "Failure (6-)",
	critical: "Critical Success (12+)"
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
// basic-moves.js); these two reminders surface the same prompt on every roll that qualifies, not
// just that one move, mirroring FAILURE_REMINDERS' own "easy to forget" rationale. Hook depth
// itself stays a manual player edit (system.attributes.hooks, see tracking-mixin.js) — this is
// display text only, not an automatic mutation.
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
// surfaced on an actual 6-, same as the universal FAILURE_REMINDERS above. extraSuccessReminder
// (e.g. Captain's Coordinator — see PlaybookActorSheet#_grantedSuccessReminderForMove) is the same
// idea mirrored onto the 10+ tier. extraMixedReminder (e.g. The Scout's Patch Job — see
// PlaybookActorSheet#_grantedMixedReminderForMove) is the same idea again, on the 7-9 tier.
// extraCriticalReminder (e.g. Soldier's Indomitable, Cantrips' Truth-making, The Advocate's A
// Greener World, The Diplomat's Sharp Tongue — see
// PlaybookActorSheet#_grantedCriticalReminderForMove/moves-mixin.js) is the same idea again, but
// layered on top of a 12+ result (`critical`, see isCriticalResult below) rather than replacing
// the success tier's own reminder — a 12+ that also happens to carry an extraSuccessReminder shows
// both, since `critical` is orthogonal to `tier` by design (see docs/domains/moves.md's "Adding move
// content"). The one exception: if extraCriticalReminder's text is identical to a reminder tierReminders
// already carries (only ever extraSuccessReminder in practice, since critical implies tier ===
// "success"), it's skipped rather than shown twice — The Witch's Bearer Of Curses grants the *same*
// text via addsSuccessReminderToMove/addsMixedReminderToMove/addsFailureReminderToMove/
// addsCriticalReminderToMove alike (its own trigger has no tier qualifier), and without this check a
// 12+ would post that text twice. Mirrors the pre-roll dialog's own collapse of the identical case
// (see PlaybookActorSheet#_ridersForMove's "All Rolls:" row).
export function buildReminders(tier, effect, extraFailureReminder = null, extraSuccessReminder = null, critical = false, extraCriticalReminder = null, extraMixedReminder = null) {
	const tierReminders = [
		...(tier === "failure" ? FAILURE_REMINDERS : []),
		...(effect.key === "desperation" && tier === "success" ? [DESPERATION_SUCCESS_REMINDER] : []),
		...(effect.key === "confidence" && tier === "failure" ? [CONFIDENCE_FAILURE_REMINDER] : []),
		...(tier === "failure" && extraFailureReminder ? [extraFailureReminder] : []),
		...(tier === "success" && extraSuccessReminder ? [extraSuccessReminder] : []),
		...(tier === "mixed" && extraMixedReminder ? [extraMixedReminder] : [])
	];
	return [
		...tierReminders,
		...(critical && extraCriticalReminder && !tierReminders.includes(extraCriticalReminder) ? [extraCriticalReminder] : [])
	];
}

export function moveResultTier(total) {
	if (total >= 10) return "success";
	if (total >= 7) return "mixed";
	return "failure";
}

// An orthogonal signal on top of moveResultTier, not a fourth tier — a 12+ total still resolves to
// tier "success" (moveResultTier itself is unchanged), so every existing `tier === "success"` check
// in this codebase (the desperation/confidence branches above, _availableAutomaticSuccess's own
// gate, Cold Company's dispel flip) keeps working unmodified. This is what makes a 12+ "identical
// to 10+ by default": `critical` only ever drives the chat card's badge/label (see rollMove's
// flavorArgs) and the two extension points below (resolveTierValue, addsCriticalReminderToMove —
// see docs/domains/moves.md's "Adding move content").
export function isCriticalResult(total) {
	return total >= 12;
}

// The override mechanism for a move's own tier-keyed data (`results`, `hold`, `questionPrompts`):
// a move may optionally define a `critical` key alongside its usual `success`/`mixed`/`failure`
// ones, consulted only when the roll actually cleared 12+; every other move (the overwhelming
// majority, including every catalog move that references "12+" as prose today — see
// playbook-moves.js) has no `critical` key at all and silently falls back to its own `success`
// entry, so this is purely additive. Named `source` rather than `move` since it's called against
// three different sub-objects (move.results, move.hold, move.questionPrompts), not the move itself.
export function resolveTierValue(source, tier, critical) {
	if (!source) return undefined;
	if (critical && source.critical !== undefined) return source.critical;
	return source[tier];
}
