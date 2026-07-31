// The rulebook's Advancement checklist, rendered on the sheet as a pure tracking checklist — no
// entry here grants a move/trait mechanically (there's no Cantrips list or Soldier playbook
// implemented in this module yet); checking a box only records that the player did this in the
// fiction. The two "Additional Move" lines and the two "Soldier Move" lines are literal verbatim
// duplicates in the rulebook, each an independent pick, so each gets its own uniquely-keyed entry.
export const ADVANCEMENT_TOP = [
	{ key: "additional-move-1", label: "Choose an Additional Move from your playbook or from the Cantrips list." },
	{ key: "additional-move-2", label: "Choose an Additional Move from your playbook or from the Cantrips list." },
	{ key: "additional-move-3", label: "Choose an Additional Move from your playbook or from the Cantrips list." },
	{
		key: "additional-move-other-playbook",
		label: "Choose an Additional Move from another playbook or from the Cantrips list."
	},
	{ key: "increase-trait-1", label: "Increase a Trait by 1, to a max of +3." },
	{ key: "increase-trait-2", label: "Increase a Trait by 1, to a max of +3." }
];

// Unlocked once at least ADVANCEMENT_UNLOCK_THRESHOLD (see playbook-actor-sheet.js) of the top
// six are checked.
export const ADVANCEMENT_BOTTOM = [
	{ key: "soldier-move-1", label: "Choose a new Move from the Soldier Moves." },
	{ key: "soldier-move-2", label: "Choose a new Move from the Soldier Moves." },
	{
		key: "new-playbook",
		label:
			"Choose a new playbook. Keep what moves you and your Director agree are truly part of your character, and discard the others. Replace them with the starting moves for your new playbook. You do not gain its starting equipment."
	},
	{
		key: "new-character",
		label:
			"Choose a new character: your old one retires from play according to their Hooks, and passes one of their Moves onto your new one."
	}
];
