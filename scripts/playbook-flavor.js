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
	},
	"the-commander": {
		look: [
			{ label: "You look:", text: "scarred, formal, out of your depth, decorated or wry" },
			{ label: "You wear:", text: "lightweight clothing, military uniform, officer's dress, tough overalls" },
			{ label: "Your squad is:", text: "fresh rookies, getting too old for this, a motley crew, the rank-and-file" }
		],
		intro: [
			"Not everyone on the battlefield is lucky enough to have enough magic at their fingertips to " +
				"pilot an Astir, or to have the time and training to be a Scout. The rest of you wade " +
				"through the mud and dirt, clutching spark-rifles, or spears, or whatever you're given, " +
				"hoping you don't get stepped on. If you do find yourself a little sliver of that luck " +
				"though, you might find yourself part of an Ardent crew. Prove yourself, and you might even " +
				"end up in charge.",
			"To play the Commander is to draw into the spotlight those not fortunate enough to be " +
				"Channelers, and to look into the bureaucracy and logistics of military operation. Ace crew " +
				"provides you with your squad, and moves like retrofit and support company allow you to " +
				"reinforce them with a little extra firepower. Consider;"
		],
		consider: [
			"Does your custom Ardent have a name?",
			"What is your squad or the part of the military you belong to called?",
			"Are you a formally trained soldier, or something more informal?",
			"Were you always part of the Cause, or did you defect?",
			"What's your relationship like with those that pilot Astirs?",
			"Have you always fought in Ardents?",
			"When was the first time you saw an Astir?",
			"What kind of vehicle exactly is your Ardent?"
		]
	},
	"the-impostor": {
		look: [
			{ label: "You look:", text: "wild, cold, sharp, cocky or brash" },
			{ label: "You wear:", text: "custom-made jumpsuit, modified uniform, ill-suited dress, casual attire" },
			{ label: "Your magic is like:", text: "smoke and industry, neon beams, firey outbursts, arcing bolts" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		// The rulebook's own two framing paragraphs, shown before the Consider questions — see
		// defaultConsiderText below. Optional: a playbook with no intro (every playbook but The
		// Impostor, currently) renders its Consider list exactly as before this field existed.
		intro: [
			"You have no magic of your own, and control an Astir through enchanted augmentations or " +
				"alterations to your body. They say what you do is fake. They call you an Impostor—but " +
				"what you do is real, and you've made yourself exactly who you needed to be. The Impostor " +
				"has a diverse skill set with lots of ability to play with risks and perils.",
			"To play an Impostor is to, depending on what your arcane augments are and why you got " +
				"them, invite questions about the body: about disability, transhumanism, being " +
				"transgender, loss of bodily autonomy to the Authority or otherwise and so on. It might " +
				"not be the focus of your campaign or even your character to tackle this in-depth, but " +
				"you should be actively thinking about the place of these things and the people affected " +
				"by them in your world. It's also the playbook most indulged in mecha anime tropes, with " +
				"moves like face to face, resonance, bullheaded and let loose all lending themselves to " +
				"various kinds of hot-blooded action. Consider;"
		],
		consider: [
			"Where and how did you get your augments?",
			"How are they made, and of what material? How rare are such things in your world? How " +
				"noticeable are they?",
			"Do people use a word other than 'augment'?",
			"Why did you choose to undergo augmentation? Did you choose?",
			"How does the existence of Impostors relate to disability in your world?",
			"How do your augments impact your daily life and routines?",
			"What kind of reactions do people have to your augments?",
			"Are your augments heavy or uncomfortable? Can they be removed?",
			"How do your augments help your control an Astir? Do you use controls with them like " +
				"usual, or do they interface directly into it somehow?",
			"How often is the term Impostor used, if at all? Is it formal or informal? Do you have " +
				"another word for yourself? Are there others who control Astirs in a similar way?"
		]
	},
	"the-diplomat": {
		look: [
			{ label: "You look:", text: "noble, refined, experienced, naive or slick" },
			{ label: "You wear:", text: "military dress, mostly disguises, luxury fashion, recognisable uniform" },
			{ label: "You have a reputation for being:", text: "fair and trustworthy, sly and wily, unpredictable, bold and pushy" }
		],
		consider: [
			"Are you actually a diplomat? Do you hold any official office?",
			"How long have you been with the Cause? Were you part of it before joining this crew?",
			"What's your stance on violence?",
			"What is your network of connections like? Do you have one?",
			"What motivates you during this conflict? What are your goals?",
			"What's the most danger you've been in before?",
			"What does diplomacy mean to you? How do you go about it?",
			"Have you ever negotiated with the Authority before?"
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
	// intro (The Impostor's own two framing paragraphs) renders as plain <p>s ahead of the
	// question list — absent for every playbook without one, so their own output is unchanged.
	const intro = (flavor.intro ?? []).map((paragraph) => `<p>${paragraph}</p>`).join("");
	return `${intro}<ul>${flavor.consider.map((question) => `<li>${question}</li>`).join("")}</ul>`;
}
