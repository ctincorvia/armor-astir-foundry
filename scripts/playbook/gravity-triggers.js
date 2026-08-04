// Keyed by system.playbook.slug, same convention as approaches.js's PLAYBOOK_APPROACHES — unlike
// MOVE_POOLS, which matches PLAYBOOKS[].name. A playbook with no entry here has no known trigger
// yet, so it renders nothing (see gravityTriggerForPlaybook).
export const GRAVITY_TRIGGERS = {
	"the-scout":
		"When you hold your own against something bigger than you or help someone in an Astir out of a tight spot, advance a GRAVITY clock with someone who sees you and is impressed.",
	"the-commander":
		"Whenever you or your crew are physically injured in service of someone else, advance a GRAVITY clock with them if you have one.",
	"the-impostor":
		"When someone you have GRAVITY with sees you be put in peril, advance it.",
	"the-diplomat":
		"When you successfully negotiate or advocate for something important to you, advance a GRAVITY clock of your choice.",
	"the-arcanist":
		"When you declare your plan to solve a problem and it works, advance a GRAVITY clock with someone who doubted you."
};

export function gravityTriggerForPlaybook(playbookSlug) {
	return GRAVITY_TRIGGERS[playbookSlug] ?? null;
}
