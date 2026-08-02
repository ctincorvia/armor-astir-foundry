// LOOK prompts and Consider questions for each playbook — chargen flavor text seeded as the
// starting content of the Cosmetic tab's Look/Consider editors (see defaultLookText/
// defaultConsiderText below). Keyed by system.playbook.slug, the exact same convention
// gravity-triggers.js already uses.
export const PLAYBOOK_FLAVOR = {
	"the-scout": {
		look: [
			{ label: "You look:", text: "wild, cold, sharp, cocky or brash" },
			{ label: "You wear:", text: "gleaming plate, well-worn uniform, survivalist's gear or rugged leathers" },
			{ label: "You fight with:", text: "brute strength, dexterous moves, practised discipline or raw tenacity" }
		],
		consider: [
			"Are Scouts common, or are you an exception?",
			"Do you have a tool or ability that helps you be mobile, or are you just agile?",
			"What kind of reputation do Scouts have? Is fighting an Astir considered risky for you?",
			"Who didn't want you to fight?",
			"Who encouraged you to fight?",
			"How long have you been a soldier?",
			"Were you trained or are you a natural fighter?",
			"Where did you get your equipment?",
			"What drives you to work on foot in a world of mechs?",
			"Do you have a better relationship with regular soldiers due to not being a pilot?"
		]
	}
};

// A playbook with no entry here yields null — same missing-entry-is-null fallback as
// gravityTriggerForPlaybook.
export function flavorForPlaybook(playbookSlug) {
	return PLAYBOOK_FLAVOR[playbookSlug] ?? null;
}

// Only used the first time a character opens the Look/Consider editors, before they've saved any
// text of their own — PlaybookActorSheet#getData falls back to these only when the actor has no
// stored system.details.look/consider value yet. A playbook with no PLAYBOOK_FLAVOR entry (every
// playbook but The Scout, currently) yields an empty starting editor rather than throwing.
export function defaultLookText(playbookSlug) {
	const flavor = flavorForPlaybook(playbookSlug);
	if (!flavor) return "";
	return `<ul>${flavor.look.map(({ label, text }) => `<li><strong>${label}</strong> ${text}</li>`).join("")}</ul>`;
}

export function defaultConsiderText(playbookSlug) {
	const flavor = flavorForPlaybook(playbookSlug);
	if (!flavor) return "";
	return `<ul>${flavor.consider.map((question) => `<li>${question}</li>`).join("")}</ul>`;
}
