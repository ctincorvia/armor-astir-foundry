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
	},
	"the-arcanist": {
		look: [
			{ label: "You look:", text: "smart, bookish, wily, anxious or imposing" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, fancy robes" },
			{ label: "Your magic is like:", text: "roaring elements, bright and neon, abstract and formless, formulaic and defined" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		intro: [
			"Arcanists are careful, prepared magic-users. This is most apparent in their use of " +
				"'rituals'—magical tactics and enhancements preemptively cast before they embark onto the " +
				"battlefield. Arcanists typically attain the magical mastery they have through formal " +
				"study, and while good at making plans and full of useful knowledge, they often don't deal " +
				"well with surprises.",
			"Playing an Arcanist often means calling your shot, either through your choice of rituals or " +
				"through plans you make in the heat of action. Once you have advanced and can take new " +
				"ones, other moves like expend rituals and reshape make it easier to respond to situations " +
				"you haven't prepared for. Consider;"
		],
		consider: [
			"What does formal magical study look like in your world?",
			"Is this something open and public, like an academy, or private, like training passed down " +
				"through a family lineage? Was it tied to military service?",
			"Do you have a familiar or bonded item you use to focus your magic?",
			"What does performing your rituals entail?",
			"Where did you get your Astir? Is it stolen from a military force? A family heirloom? Does it " +
				"belong to the Cause?",
			"Do all Arcanists study where you did, or are there multiple schools of thought?",
			"Are people like you openly referred to as Arcanists? If not, is there another name for what " +
				"you are?"
		]
	},
	"the-paradigm": {
		look: [
			{ label: "You look:", text: "serious, haughty, caring, wise or zealous" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, religious garb" },
			{ label: "Your magic is like:", text: "angelic choirs, blinding lights, warm embraces, blazing icons" },
			{ label: "When you launch your Astir, you say:", text: "" }
		],
		consider: [
			"Is your deity really divine in the supernatural sense, or just a godlike figure?",
			"How formal is your religion/connection to your deity?",
			"How well known is your deity?",
			"How common are people like yourself? Are they called Paradigms, or something else?",
			"What is the Cause's relationship to faith?",
			"What is the Authority's relationship to faith?",
			"What is your deity like? What do they demand, and what do they request?",
			"What does giving service or worship to your deity look like?",
			"What was your life like before the Cause?",
			"How were you introduced to your deity?"
		]
	},
	"the-witch": {
		look: [
			{ label: "You look:", text: "dark, mysterious, shrouded, unsure or haunted" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, occult robes" },
			{ label: "Your magic is like:", text: "smothering darkness, roiling chaos, striking bolts, withering curses" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		consider: [
			"What and who is your patron? Are they supernatural, or just powerful enough to seem so?",
			"What is the nature of your relationship with your patron?",
			"Are there other Witches serving your patron? Are there other Witches at all?",
			"Do people refer to you as a Witch? Is there another term they or you use?",
			"Is your bond with your patron forever, or will it expire?",
			"What other kinds of beings exist that could be patrons?",
			"Did forming this bond cost you anything now, or will it in the future?",
			"Is there a recognisable symbol of your patronage? An associated familiar?",
			"Does your patron have a direct connection to you, or do they act through agents?",
			"Are your boons an informal collection of helpful magics, or something more defined? If so, what " +
				"do you call them?"
		]
	},
	"the-wither": {
		look: [
			{ label: "You look:", text: "gaunt, sickly, spectral, feral or serene" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, funeral shrouds, tattered ritual garb" },
			{ label: "Your magic is like:", text: "grave-cold whispers, crawling shadows, wilting flowers, screaming static" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		consider: [
			"What curse, pact or affliction gave you power over death and decay?",
			"How many times have you already died, or almost died?",
			"What do people call you—Wither, or something crueler?",
			"What waits for you on the other side, and does it want you back?",
			"Who do the spectres that follow you actually used to be?",
			"What did dying, or nearly dying, cost you?",
			"How does the Cause feel about a Channeler who deals in death?",
			"Is your power something you chose, or something that chose you?"
		]
	},
	"the-adrift": {
		look: [
			{ label: "You look:", text: "lost, naïve, playful, soft or brash" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, otherworldly attire" },
			{ label: "Your magic is like:", text: "reality distortions, what you saw on tv, glowing runes, simple force" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		intro: [
			"Whether from another place or another time, you've been pulled into a life and a struggle " +
				"that isn't yours. You are Adrift, disconnected from those you hold dear, searching for a " +
				"way back. But this world isn't like yours: here, magic is real and strange, and some " +
				"stranger power still grants you control over Astirs despite never even having heard the " +
				"word before.",
			"To play an Adrift is to play a character torn from one world and thrust into the conflict of " +
				"this one. It is a common trope—one that is broadly it's own genre in anime—but doesn't need " +
				"to be supernatural in origin. The Adrift could be from another country, a traitor from the " +
				"Authority, or even just a civilian who lived a life distant from magic and fighting before " +
				"being drawn into conflict (see: a lot of mecha anime). Your starting move, love, love, love, " +
				"details your ties to your home, and moves like if I go there will be trouble and if I stay " +
				"it will be double revolve around your place in this strange new world. Consider;"
		],
		consider: [
			"Are you literally from another world, or just metaphorically?",
			"How did you end up in this world?",
			"What might getting home entail for you?",
			"What kind of technology (or lack thereof) are you used to?",
			"Did you bring any keepsakes or reminders of your home with you?",
			"How do you feel about suddenly being able to pilot Astirs?",
			"How did you run into the Cause?",
			"How were you introduced to the Authority?",
			"How did you get your Astir and gear?",
			"In what major ways is this world different to yours? In what ways is it similar?"
		]
	},
	"the-advocate": {
		look: [
			{ label: "You look:", text: "gnarled, fresh, spritely, venerable or bold" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, handmade attire" },
			{ label: "Your magic is like:", text: "swarming creatures, rays of light, toxic miasma, blooming flora" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		intro: [
			"Unlike others, who draw their magic from divine sources or unlikely patrons, pore over " +
				"arcane tomes or study forbidden rites, your magic is of the natural kind. It is drawn " +
				"from and returned to the land: a power as old and familiar as life itself. Your Astir, " +
				"then, may be of similar origin: grown or conjured from the natural realm, cast from the " +
				"artistic palettes of flora and fauna, or you may even take the form of it yourself. In " +
				"fantasy fiction, shape-shifting is often tied to 'natural' magic, but consider: you might " +
				"just be a twenty-foot tall tree person. It's allowed.",
			"To play an Advocate, then, is to play a character with deep ties to nature and " +
				"environmental concerns. It tells your group that you are interested in tackling how " +
				"conflict and it's effects (both short and longer term) damage the environment, and in " +
				"turn, threaten lives in ever more unforeseen ways. Your choice of starting moves, earthly " +
				"ally or titanic outline exactly what kind of being you are, while moves like all things " +
				"great and small and a greener world make specific your connection to different aspects of " +
				"the environment."
		],
		consider: [
			"Where are you from?",
			"How did you get so close to nature?",
			"What's your favourite animal?",
			"What's your favourite plant?",
			"How do you feel about fungus, broadly?",
			"Do you belong to any kind of order or group of people like yourself?",
			"Where did your Astir come from? If you don't have one, what is your other form like?",
			"Name a place of natural beauty that has been scarred by the conflict.",
			"Name a place of natural beauty that you still hope to preserve."
		]
	},
	"the-revenant": {
		look: [
			{ label: "You look:", text: "maimed, ethereal, stoic, tired or cruel" },
			{ label: "Your Astir is marked with:", text: "ethereal vapours, creeping mold, dark stains, deep wounds" },
			{ label: "Your magic is like:", text: "haunted echoes, chilling winds, ominous whispers, bad vibes" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		intro: [
			"For most, the heel of empire grinds you to dust once—and only once. But when you died, " +
				"your spirit didn't leave. It is stuck here, bound to the very machine you died in, until " +
				"it too crumbles into dust: or until your work is done. Revenants are unliving echoes of " +
				"Channelers, bound still to the machines they piloted in life, until their work is done.",
			"To play a Revenant is to play the spectre of a fallen Channeler, haunting the Astir they " +
				"died in. You are bound to it, holding it together and powering it even in death. If your " +
				"body remains, it is entombed within it. Unfettered outlines some of the benefits of being " +
				"deceased, while moves like I know you and ancient recall allow you to explore your old " +
				"life. Consider;"
		],
		consider: [
			"How did you die?",
			"What family did you leave behind, if any?",
			"Do you know what caused you to persist?",
			"Did you have any previous relationship with death?",
			"Who or what are you holding on for?",
			"What do you think passing on looks like?",
			"What kind of bodily autonomy have you been left with?",
			"What earthly pleasures can you still feel?"
		]
	},
	"the-summoner": {
		look: [
			{ label: "You look:", text: "noble, naive, wizened, bizarre or friendly" },
			{ label: "You wear:", text: "pilot jumpsuit, military uniform, dress uniform, traditional robes" },
			{ label: "Your magic is like:", text: "distant chimes, fireside embers, yawning portals, rushing winds" },
			{ label: "When you launch your Astir, you say:", text: "________________" }
		],
		intro: [
			"Allies are an important thing, both in life and in warfare. Few kinds of Channeler embody " +
				"this ethos better than Summoners: those capable of not just forming strong bonds with " +
				"magical creatures and spirits, but also conjuring them forth in times of need to gain " +
				"their aid. Such expertise can leave individuals vulnerable and unprotected if they have " +
				"no time to conjure a powerful ally—but more than a match for numerous foes when they do.",
			"To play a Summoner is to make allies of the powerful and strange, and to involve them in " +
				"your conflict. Eidolon drive and binding form your core skillset, and moves like " +
				"enduring support and helping hands let you get other forms of aid from your summoned " +
				"allies."
		],
		consider: [
			"Does your family have a history of being Summoners?",
			"Do you consider summoning something ordered and hermetic, or more loose and spiritual?",
			"Who or what was the first ally you ever bound?",
			"Do you call yourself a Summoner, or something else?",
			"What was your place in your community before the conflict began?",
			"Do you have any kind of traditional outfit or pieces of clothing?",
			"Is there a region in the world most associated with Summoners?"
		]
	},
	"the-icon": {
		look: [
			{ label: "You look:", text: "stylish, confusing, transgressive, glamorous or naive" },
			{ label: "You wear:", text: "cutting-edge fashions, your own designs, dress uniform, experimental looks" },
			{ label: "Your medium is:", text: "music, poetry or literature, public speech, modelling, acting" }
		],
		intro: [
			"Icons come in all kinds: from visionary artists, to firebrand public speakers, to " +
				"groundbreaking performers. They stoke the people and drive culture, becoming rally " +
				"points for public opinion and focus: especially during divisive times. Moves like " +
				"bardic inspiration and power let you support your team, whilst mechanical aria lets " +
				"you step from stage to battlefield in an Astir of your own."
		],
		consider: [
			"What do you do for a living?",
			"Do you have a brand or stage name people know more readily than your real one?",
			"What compelled you to throw in with the Cause?",
			"Are you still actively famous, or did you leave that life behind?",
			"What kind of colours and iconography do people associate with you?",
			"Has the Cause adopted any of the above?",
			"What do you want out of your role in the Cause?",
			"Do you have fans within the Authority?"
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
