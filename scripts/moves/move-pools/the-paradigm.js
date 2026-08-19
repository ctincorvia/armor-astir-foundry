export const THE_PARADIGM_POOL = {
	key: "the-paradigm",
	label: "The Paradigm",
	playbookName: "The Paradigm",
	moves: [
		{
			key: "the-paradigm:tenets",
			name: "Tenets",
			// Unconditionally granted via starting-moves.js's grantedKeys (every Paradigm starts with
			// this), so no `starting: true` — that flag is reserved for a pick-one starting choice (see
			// Field Scout/Giant Slayer's own comment).
			//
			// None of this move's own consequences are tracked or enforced: this module has no Hooks
			// data model (Hooks are referenced only as fiction elsewhere, e.g. bite-the-dust's own text
			// above), no risk/peril counter beyond the freeform Dangers panel, and no Downtime-Scene
			// counter anywhere (Downtime Tokens track a spendable resource, not how many Scenes a
			// character gets — see The Commander's Debrief). The permanent CHANNEL reduction and forced
			// playbook change are one-time narrated events, the same "choose a new playbook" treatment
			// bite-the-dust's own failure text already gets. Left fully descriptive rather than adding a
			// forced-Desperation flag or a tracked tenet/broken-flag structure.
			traits: ["channel"],
			results: { success: null, mixed: null, failure: null },
			downtimeAbility:
				"Gain an extra Social Space or Private Quarters Scene during Downtime to tend to your " +
				"crew's spiritual well-being.",
			description:
				"<p>Instead of Hooks, write three tenets that represent your deity's will. When you break " +
				"or lose faith in a tenet, your deity will ask something of you. Roll +CHANNEL with " +
				"desperation until you resolve this: once you have, take an Advancement and replace that " +
				"tenet with a Hook representing how your faith has changed or grown.</p>" +
				"<p>If you refuse or resolve it in a way that angers or disappoints the divine, reduce " +
				"your CHANNEL by 1 permanently. If your CHANNEL reaches 0 in this way, immediately change " +
				"playbooks and take an additional Advancement.</p>" +
				"<p>You are responsible for the spiritual well-being of your crew: you gain an extra " +
				"Social Space or Private Quarters Scene during Downtime to attend to it.</p>"
		},
		{
			key: "the-paradigm:divine-guidance",
			name: "Divine Guidance",
			traits: ["channel"],
			// Standalone rather than an addsTraitToMove onto Dispel Uncertainties: that move's own 7-9
			// makes usefulness itself uncertain, while this one keeps the information useful but makes
			// its divine origin uncertain instead — a meaningfully different mixed-success text, not
			// just an extra Trait option on the existing move.
			results: {
				success: "Your deity tells you something directly useful about the situation or subject " +
					"at hand.",
				mixed: "The information is still directly useful, but it is difficult to discern if your " +
					"answer came from the intended deity.",
				failure: null
			},
			description:
				"<p>When you consult your deity for information or guidance, you may dispel uncertainties " +
				"with +CHANNEL.</p>" +
				"<p>On a 10+, your deity tells you something directly useful about the situation or " +
				"subject at hand.</p>" +
				"<p>On a 7-9, the information is still directly useful, but it is difficult to discern if " +
				"your answer came from the intended deity. People know you can literally contact the " +
				"divine.</p>"
		},
		{
			key: "the-paradigm:avenger",
			name: "Avenger",
			// No roll — traits is empty and there are no conditions, so the sheet's `rollable` flag
			// stays false and only a Description button renders, same treatment as Bullheaded. The
			// extra-Scene cost references the same untracked Downtime-Scene concept as Tenets above, so
			// this stays descriptive too.
			traits: [],
			downtimeAbility:
				"If you ignored risks to pursue a target, Tenets' extra Scene is lost next Downtime — " +
				"spend it on yourself instead.",
			description:
				"<p>When an ally or yourself is put in peril, you may declare the responsible party (you " +
				"are the judge of who is responsible in this context) your target. You may freely ignore " +
				"any risks you would be forced to take in direct pursuit of your target during a " +
				"Sortie.</p>" +
				"<p>If you do so, the extra Scene from tenets is lost during your next Downtime: you must " +
				"use it to tend to yourself instead.</p>"
		},
		{
			key: "the-paradigm:inspire-focus",
			name: "Inspire Focus",
			traits: [],
			uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
			description:
				"<p>Once per Sortie, you may take a visible position over the battlefield and inspire " +
				"confidence and clarity in your allies that see you: they each clear a risk and take " +
				"advantage to their next roll.</p>"
		},
		{
			key: "the-paradigm:safeguard",
			name: "Safeguard",
			// Pure fiction — no roll, no tracked resource. Both halves of this move are narrated
			// exchanges of harm between the two participants in an existing exchange-blows/help-or-hinder
			// pairing, with nothing further to track beyond the Dangers panel either party already has.
			traits: [],
			description:
				"<p>When you exchange blows and someone helps or hinders you, you can protect them from " +
				"any harm they might suffer as a result. When you help or hinder someone who is exchanging " +
				"blows, you can suffer any harm taken in their place.</p>"
		},
		{
			key: "the-paradigm:turn-unearthly",
			name: "Turn Unearthly",
			// Doesn't roll on its own — it adds CHANNEL as an option to two other moves' trait choice
			// (see PlaybookActorSheet#_moveTraits' addsTraitToMove handling, generalized below to accept
			// a `moveKeys` array alongside Facilitator/Ascension's existing singular `moveKey`).
			traits: [],
			addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "channel" },
			description:
				"<p>You may exchange blows and strike decisively using +CHANNEL against creatures and " +
				"entities that are not of our mortal plane. You can sense such creatures, and make them " +
				"uncomfortable.</p>"
		},
		{
			key: "the-paradigm:firebrand",
			name: "Firebrand",
			// "Roll the highest of +TALK or +CHANNEL" is the existing plain choice-of-2 dropdown, the
			// same treatment Exchange Blows already gives "+CLASH or +TALK, whichever is more
			// appropriate" — no auto-select-the-higher-trait logic is built for either move.
			traits: ["talk", "channel"],
			results: {
				success: "<p>Choose 2:</p>" +
					"<ul>" +
					"<li>Your words reach people far beyond where your voice is heard.</li>" +
					"<li>Even those not of your faith connect to your message.</li>" +
					"<li>You are not targeted immediately for what you preach.</li>" +
					"</ul>",
				mixed: "<p>Choose 1:</p>" +
					"<ul>" +
					"<li>Your words reach people far beyond where your voice is heard.</li>" +
					"<li>Even those not of your faith connect to your message.</li>" +
					"<li>You are not targeted immediately for what you preach.</li>" +
					"</ul>",
				failure: "Your words are misinterpreted, co-opted, or misrepresented in a terrible way."
			},
			description:
				"<p>When you openly and loudly advocate for something related to one of your tenets, roll " +
				"the highest of +TALK or +CHANNEL.</p>" +
				"<p>On a 10+, choose 2. On a 7-9, choose 1;</p>" +
				"<ul>" +
				"<li>Your words reach people far beyond where your voice is heard.</li>" +
				"<li>Even those not of your faith connect to your message.</li>" +
				"<li>You are not targeted immediately for what you preach.</li>" +
				"</ul>" +
				"<p>On a 6 or below, your words are misinterpreted, co-opted, or misrepresented in a " +
				"terrible way.</p>"
		},
		{
			key: "the-paradigm:consecrate-ground",
			name: "Consecrate Ground",
			traits: ["channel"],
			results: {
				success: "<p>Choose 2:</p>" +
					"<ul>" +
					"<li>Creatures opposed by your deity or faith cannot enter the consecrated area.</li>" +
					"<li>Creatures within your consecrated area cannot take violent action against each " +
					"other.</li>" +
					"<li>Creatures within the consecrated area cool off with advantage.</li>" +
					"<li>Creatures within your consecrated area cannot knowingly lie.</li>" +
					"</ul>",
				mixed: "<p>Choose 1:</p>" +
					"<ul>" +
					"<li>Creatures opposed by your deity or faith cannot enter the consecrated area.</li>" +
					"<li>Creatures within your consecrated area cannot take violent action against each " +
					"other.</li>" +
					"<li>Creatures within the consecrated area cool off with advantage.</li>" +
					"<li>Creatures within your consecrated area cannot knowingly lie.</li>" +
					"</ul>",
				failure: null
			},
			description:
				"<p>When you attempt to imbue an area or building with your divine power and presence, " +
				"roll +CHANNEL.</p>" +
				"<p>On a 10+, choose 2. On a 7-9, choose 1;</p>" +
				"<ul>" +
				"<li>Creatures opposed by your deity or faith cannot enter the consecrated area.</li>" +
				"<li>Creatures within your consecrated area cannot take violent action against each " +
				"other.</li>" +
				"<li>Creatures within the consecrated area cool off with advantage.</li>" +
				"<li>Creatures within your consecrated area cannot knowingly lie.</li>" +
				"</ul>"
		},
		{
			key: "the-paradigm:ascension",
			name: "Ascension",
			// Doesn't roll on its own — it adds CHANNEL as an option to bite-the-dust's trait choice
			// (see the addsTraitToMove singular-moveKey path, same as Facilitator's). "Clear all risks on
			// a 10+ rather than one" is surfaced as a reminder on bite-the-dust's own success instead of
			// enforced — risk-clearing isn't a counted mechanic anywhere in this module (Dangers are a
			// freeform panel, not a tally), and bite-the-dust's own results.success text (moves.js) is
			// deliberately left untouched by this move.
			traits: [],
			addsTraitToMove: { moveKey: "bite-the-dust", trait: "channel" },
			addsSuccessReminderToMove: {
				moveKeys: ["bite-the-dust"],
				reminder: "Clear all risks, rather than just one"
			},
			description:
				"<p>By divine decree you become something beyond the person you were. You may bite the " +
				"dust with +CHANNEL, and clear all risks on a 10+ rather than one.</p>"
		}
	]
};
