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
	"the-impostor": ["arcane", "elemental"],
	"the-diplomat": ["mundane"],
	"the-arcanist": ["arcane", "elemental"],
	"the-paradigm": ["divine", "profane"],
	"the-witch": ["arcane", "profane"],
	"the-wither": ["profane"],
	"the-adrift": ["mundane"],
	"the-advocate": ["elemental"],
	"the-revenant": ["profane", "divine"],
	"the-summoner": ["elemental", "profane"],
	"the-icon": ["mundane"],
	"the-attendant": ["mundane"],
	"the-captain": ["mundane"],
	"the-artificer": ["mundane"]
};

export function availableApproaches(playbookSlug) {
	const keys = PLAYBOOK_APPROACHES[playbookSlug];
	return keys ? APPROACHES.filter((approach) => keys.includes(approach.key)) : APPROACHES;
}

// Chromatic Focus (astir-parts.js) / Chromatic Reserves (ardent.js's ARDENT_FEATURE_PARTS) own
// Activate flow: "swap to any other Approach for a single Scene" — offers every Approach but the
// one currently in effect. Mirrors carrier-actor-sheet.js's chooseCarrier exactly (promise/Dialog/
// resolve-null shape, one labelled button per option). `period` (default "Scene", matching every
// caller before the Arcanist's Aspect ritual — arcanist-mixin.js) only ever changes the dialog's own
// copy; the caller (move-roll-mixin.js's _onMoveActivate) decides separately whether the resolved
// approach gets written with a `period` key at all.
export function chooseApproachOverride(excludeApproach, period = "Scene") {
	return new Promise((resolve) => {
		const buttons = {};
		for (const approach of APPROACHES.filter((a) => a.key !== excludeApproach)) {
			buttons[approach.key] = { label: approach.label, callback: () => resolve(approach.key) };
		}
		new Dialog({
			title: "Swap Approach",
			content: `<p>Swap to which Approach for this ${period}?</p>`,
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}
