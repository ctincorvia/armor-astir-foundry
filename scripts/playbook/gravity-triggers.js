// Keyed by system.playbook.slug, same convention as approaches.js's PLAYBOOK_APPROACHES — unlike
// MOVE_POOLS, which matches PLAYBOOKS[].name. A playbook with no entry here has no known trigger
// yet, so it renders nothing (see gravityTriggerForPlaybook). An entry is normally a single fixed
// string, but may instead be an object keyed by starting-move key when the trigger text varies by
// which starting move was picked (see The Advocate, whose trigger depends on Earthly Ally vs.
// Titanic) — gravityTriggerForPlaybook resolves either shape.
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
		"When you declare your plan to solve a problem and it works, advance a GRAVITY clock with someone who doubted you.",
	"the-paradigm":
		"When you discuss your faith with someone or learn something about how they personally relate to faith and spirituality, advance a GRAVITY clock with them if you have one.",
	"the-witch":
		"You have an extra GRAVITY clock with your patron, representing the tenuous bond between you: whenever they spend Influence, advance your GRAVITY clock with them.",
	"the-wither":
		"When you use your born to die move, advance a GRAVITY clock with someone who fears or mistrusts your magic.",
	"the-adrift":
		"Whenever you use your +HOME clock from love, love, love, advance it.",
	"the-advocate": {
		"the-advocate:earthly-ally":
			"When you teach someone a truth about the natural world, advance a GRAVITY clock if you have one with them.",
		"the-advocate:titanic":
			"When you destroy something that threatens nature directly, advance a GRAVITY clock with someone surprised by your power."
	},
	"the-revenant":
		"When you use your never quite free move, advance a GRAVITY clock with someone who doesn't want you to move on.",
	"the-summoner":
		"When you part ways with an ally from binding, advance a GRAVITY clock with someone who will remember them fondly.",
	"the-icon":
		"Whenever you act against one of your Hooks, advance a GRAVITY clock with someone who sees " +
		"you as inspirational or expects highly from you.",
	"the-attendant":
		"Whenever you put protecting your Employer ahead of the Sortie's goals, advance a GRAVITY " +
		"clock with someone who disagrees with your actions.",
	"the-captain":
		"When anyone rolls a 6 or below while rolling +CREW, advance a GRAVITY clock with someone " +
		"who has put their trust in you."
};

export function gravityTriggerForPlaybook(playbookSlug, pickedMoveKeys = []) {
	const entry = GRAVITY_TRIGGERS[playbookSlug];
	if (!entry) return null;
	if (typeof entry === "string") return entry;
	const matchKey = Object.keys(entry).find((key) => pickedMoveKeys.includes(key));
	return matchKey ? entry[matchKey] : null;
}
