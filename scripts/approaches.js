// The five Approaches every character picks from (Domain conventions, claude.md). Centralized
// here the same way traits.js centralizes TRAITS, so both the sheet and any future move content
// can reference labels without duplicating the list.
export const APPROACHES = [
	{ key: "mundane", label: "Mundane" },
	{ key: "arcane", label: "Arcane" },
	{ key: "divine", label: "Divine" },
	{ key: "profane", label: "Profane" },
	{ key: "elemental", label: "Elemental" }
];

// Keyed by system.playbook.slug. A playbook with no entry here allows the full APPROACHES list —
// the same universal-fallback stance MOVE_POOLS takes for pools with no playbookName — though
// every playbook today restricts explicitly.
export const PLAYBOOK_APPROACHES = {
	"the-scout": ["mundane"],
	"the-commander": ["mundane"],
	"the-impostor": ["arcane", "elemental"]
};

export function availableApproaches(playbookSlug) {
	const keys = PLAYBOOK_APPROACHES[playbookSlug];
	return keys ? APPROACHES.filter((approach) => keys.includes(approach.key)) : APPROACHES;
}
