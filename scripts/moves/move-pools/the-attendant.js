export const THE_ATTENDANT_POOL = {
	key: "the-attendant",
	label: "The Attendant",
	playbookName: "The Attendant",
	moves: [
		{
			key: "the-attendant:master-servant",
			name: "Master & Servant",
			traits: [],
			bonusDowntimeTokens: { max: 1, description: "Must be spent on your Employer's needs and whims." },
			description:
				"<p>You are the head butler and servant to someone of prestige, possibly another member of " +
				"the party: you are responsible for attending to their every need, from their dress to " +
				"their security. Any guests of theirs also fall under your purview, of course.</p>" +
				"<p>If your Employer—as they are referred to—ever releases you from your service, you must " +
				"find a new one as quickly as possible. To be unemployed would imply your services are not " +
				"worthwhile, after all.</p>" +
				"<p>Whenever you help or hinder or cool off your Employer or a guest of theirs, do so with " +
				"advantage. Additionally, you gain +1 token during Downtime: though you must spend your " +
				"tokens on your Employer's needs and whims where asked (or demanded).</p>"
		},
		{
			key: "the-attendant:a-drink-sir",
			name: "A Drink, Sir?",
			traits: [],
			description:
				"<p>If you can gain access to a kitchen, you can slip anything you want into anyone's meal " +
				"or drink without being caught, no rolls required. If you get the blame after they drop " +
				"dead (or when magic reveals the poison, etc), any attempt to shift the blame or escape the " +
				"scene is done in confidence.</p>" +
				"<p>At a glance, you can tell what someone's beverage of choice is.</p>"
		},
		{
			key: "the-attendant:signed-sealed",
			name: "Signed & Sealed",
			traits: [],
			grantsApproachOverride: "profane",
			grantsWeaponTags: ["messy", "decisive"],
			description:
				"<p>Your contract is one signed in darker stuff than ink. Your approach on foot becomes " +
				"profane, and any weapon you wield gains the messy and decisive tags.</p>" +
				"<p>At a glance, you can tell someone's darkest desire.</p>"
		},
		{
			key: "the-attendant:in-blood-terror",
			name: "In Blood & Terror",
			// "Requires: Signed & Sealed" is enforced via requiresMoves (see docs/domains/moves.md's "Adding move
			// content") — disables this move in the picker until Signed & Sealed is picked, and
			// re-gates it live on the sheet if Signed & Sealed is ever removed afterward.
			requiresMoves: ["the-attendant:signed-sealed"],
			traits: [],
			description:
				"<p><em>Requires: Signed &amp; Sealed.</em></p>" +
				"<p>When you exchange blows you may opt to roll with disadvantage: if you do, on a 7-9 or " +
				"10+ result you also cause any other foes who witness it to immediately take a risk.</p>" +
				"<p>At a glance, you can tell someone's deepest fear.</p>"
		},
		{
			key: "the-attendant:smiling-politely",
			name: "Smiling Politely",
			traits: [],
			numericTrackers: [
				{ key: "hold", label: "Hold", min: 0, max: 10 }
			],
			description:
				"<p>Whenever you suggest a course of action or a solution to something and your Employer " +
				"forbids it, hold 1. Nothing bad will ever happen to you as a direct consequence of not " +
				"taking action your Employer forbade you from. You may spend 10 hold to kill your Employer, " +
				"no questions asked.</p>" +
				"<p>At a glance, you can tell if someone is hiding something.</p>"
		},
		{
			key: "the-attendant:man-of-many-manners",
			name: "Man Of Many Manners",
			traits: [],
			description:
				"<p>You have a deep knowledge of the manners and etiquette required wherever you go, and " +
				"any attempts to cover for the missteps or failings of your Employer or their guests in " +
				"matters of etiquette are done in confidence.</p>" +
				"<p>At a glance, you can tell someone's social standing.</p>"
		},
		{
			key: "the-attendant:dilettante",
			name: "Dilettante",
			traits: [],
			description:
				"<p>Your Employer has ever-changing needs, and your skills must change to meet them. During " +
				"Downtime, you may spend your Scene dedicating yourself to learning a new skill. At the end " +
				"of it, you are skilled enough to perform it at an average level: more advanced tasks that " +
				"might require a roll come to you at disadvantage, however. For every additional token you " +
				"spend when playing a dilettante Scene, you can ignore this disadvantage once.</p>" +
				"<p>At a glance, you can tell someone's most honed skill.</p>"
		},
		{
			key: "the-attendant:the-utmost-care",
			name: "The Utmost Care",
			traits: [],
			description:
				"<p>The Carrier and anywhere your Employer and their guests spend the night are completely " +
				"under your scrutiny. You dispel uncertainties and read the room with advantage when " +
				"overhearing gossip, observing the movement and events of servant quarters and kitchens, " +
				"etc—anything that might happen in earshot of a talented butler.</p>" +
				"<p>At a glance, you can tell someone's greatest comfort.</p>"
		},
		{
			key: "the-attendant:on-your-feet",
			name: "On Your Feet",
			traits: [],
			uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
			description:
				"<p>Once per Sortie, you may cool off to reduce a peril another player has taken to a " +
				"risk.</p>" +
				"<p>At a glance, you can tell if someone is prepared to die.</p>"
		}
	]
};
