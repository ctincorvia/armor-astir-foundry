export const THE_ARTIFICER_POOL = {
	key: "the-artificer",
	label: "The Artificer",
	playbookName: "The Artificer",
	moves: [
		{
			key: "the-artificer:expertise",
			name: "Expertise",
			// Extra Infirmary/Hangar Scenes during Downtime, and long-term project clocks (build/
			// dismantle/modify) advancing twice instead of once, both need Downtime Scenes and
			// long-term projects to exist as discrete, resolvable game structures — neither does
			// anywhere in this module (see docs/domains/moves.md's "systems that do not exist yet", and
			// Troublemaker's/That's Dialectics' own comments for the same Downtime-Scene gap).
			// Prose only.
			traits: [],
			description:
				"<p>You're an expert at making and mending, and may perform an extra Infirmary or " +
				"Hangar Scene during Downtime, as you repair and mend the things around you. Whenever " +
				"you advance a long-term project to build, dismantle or modify something, advance it " +
				"twice.</p>"
		},
		{
			key: "the-artificer:field-testing",
			name: "Field Testing",
			traits: [],
			description:
				"<p>You're used to testing out new equipment, and can easily get to grips with new " +
				"tech. You have advantage when trying to use, analyse, or figure out something about " +
				"unfamiliar equipment, constructs, or similar magical machinery.</p>"
		},
		{
			key: "the-artificer:experimenter",
			name: "Experimenter",
			// Two cross-actor Downtime-flavored effects, neither with anything in this module to
			// hook into: passing extra tokens to other players on a failed Downtime Scene
			// (Downtime Scenes aren't modeled — same gap as Troublemaker/Expertise above), and a
			// d6-then-conditional-Trait-adjustment triggered by removing another character's peril
			// (peril-removal isn't itself a tracked trigger point, and the "adjust one Trait +1,
			// another -1, to a max of +3/min of -2" sub-mechanic has no roll-a-d6-then-branch
			// machinery anywhere else in this module — see On Your Feet's own once-per-Sortie
			// peril-clearing move, which stays similarly prose-only for its own effect). Prose only.
			traits: [],
			description:
				"<p>When you fail a Downtime Scene, you may pass 2 tokens to other players instead of " +
				"1.</p>" +
				"<p>When you remove a peril from someone, roll a d6. On a 5 or 6, they may adjust one " +
				"of their Traits by +1 and another by -1 if they wish, to a maximum of +3 and minimum " +
				"of -2.</p>"
		},
		{
			key: "the-artificer:combat-engineer",
			name: "Combat Engineer",
			traits: [],
			// tierBonus (see PlaybookActorSheet#_conflictTier) is the mechanized half ("counts as
			// tier II rather than I" for physical conflict), summed the same way Ace Crew's own
			// tierBonus is. The granted Custom Scout Weapon is purely descriptive — the player adds
			// it by hand via the Equipment tab and sets its own Tier to match, same "no
			// auto-equipment-creation" treatment Field Scout's own granted custom weapon gets.
			tierBonus: 1,
			description:
				"<p>You supplement your Artificer expertise with advanced combat training: for all " +
				"purposes related to physical conflict, you are considered tier II rather than I. " +
				"This includes wielding weapons, fighting, avoiding harm, and so on. Take a Custom " +
				"Scout Weapon: it is tier II, and is either too heavy or requires too specific " +
				"training for other people to use without taking disadvantage.</p>"
		},
		{
			key: "the-artificer:jury-rigger",
			name: "Jury-Rigger",
			traits: ["know"],
			results: {
				success:
					"Choose 3:" +
					"<ul>" +
					"<li>It fits the purpose you had in mind.</li>" +
					"<li>It stops working after hours, not minutes.</li>" +
					"<li>It doesn't explode when it stops working.</li>" +
					"<li>It doesn't look like garbage stuck together.</li>" +
					"</ul>",
				mixed:
					"Choose 2:" +
					"<ul>" +
					"<li>It fits the purpose you had in mind.</li>" +
					"<li>It stops working after hours, not minutes.</li>" +
					"<li>It doesn't explode when it stops working.</li>" +
					"<li>It doesn't look like garbage stuck together.</li>" +
					"</ul>",
				failure: null
			},
			description:
				"<p>When you take random parts or objects and attempt to create something useful out " +
				"of them, roll +KNOW. On a 10+, choose 3. On a 7-9, choose 2:</p>" +
				"<ul>" +
				"<li>It fits the purpose you had in mind.</li>" +
				"<li>It stops working after hours, not minutes.</li>" +
				"<li>It doesn't explode when it stops working.</li>" +
				"<li>It doesn't look like garbage stuck together.</li>" +
				"</ul>"
		},
		{
			key: "the-artificer:refined-rituals",
			name: "Refined Rituals",
			// Same shape as the-icon:performance — a flat, roll-less hold grant in its own
			// system.attributes.moveHold pool (keyed by this move's own key, no `period` since it's
			// purely manually tracked). Only the hold pool itself is coded; letting an ally make
			// the subsystems move for free is a cross-actor free-move grant with nothing in this
			// module to hook into (see docs/domains/moves.md's "systems that do not exist yet"), so the spend
			// stays prose.
			traits: [],
			flatHold: 3,
			description:
				"<p>When someone leads a Sortie, hold 3. You may spend this hold 1-for-1 to let an " +
				"ally make the subsystems move for free.</p>"
		},
		{
			key: "the-artificer:arcane-generator",
			name: "Arcane Generator",
			// "You effectively have a CHANNEL of +1" is mechanized generically in _moveTraits
			// (moves-mixin.js) alongside Input Channel's own any-move +CHANNEL push — see that
			// method's own doc comment for why this one is gated to the Astir specifically (this
			// move's own text is Astir-only, unlike Input Channel, which is installed hardware that
			// works from any mounted frame). The create-a-long-lasting-object roll below is a real
			// roll with real result tiers, so it's mechanized as a normal +KNOW roll rather than
			// prose.
			grantsChannelOnAnyMove: true,
			traits: ["know"],
			results: {
				success:
					"You can create a single object as large as it is simple (i.e. small and complex " +
					"like a clock, or large and simple like a wall), and it takes but a few minutes of " +
					"work.",
				mixed:
					"Choose 1:" +
					"<ul>" +
					"<li>What you create is fragile and will not stand up to attack well.</li>" +
					"<li>Your device creates an unnatural magical feedback: the next person to roll " +
					"+CHANNEL does so with disadvantage.</li>" +
					"<li>The work is taxing—take the peril (exhausted).</li>" +
					"</ul>",
				failure: null
			},
			description:
				"<p>You've built a remarkable artifact, small enough to be worn on your back or at " +
				"your hip, that generates and sustains its own magical energy. You may power and " +
				"control an Astir while it is working: you effectively have a CHANNEL of +1.</p>" +
				"<p>Additionally, when you tap into it to create something long-lasting, roll +KNOW. " +
				"On a 10+, you can create a single object as large as it is simple (i.e. small and " +
				"complex like a clock, or large and simple like a wall), and it takes but a few " +
				"minutes of work. On a 7-9, choose 1:</p>" +
				"<ul>" +
				"<li>What you create is fragile and will not stand up to attack well.</li>" +
				"<li>Your device creates an unnatural magical feedback: the next person to roll " +
				"+CHANNEL does so with disadvantage.</li>" +
				"<li>The work is taxing—take the peril (exhausted).</li>" +
				"</ul>"
		},
		{
			key: "the-artificer:its-a-prototype",
			name: "It's A Prototype",
			traits: [],
			uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
			description:
				"<p>Once per Sortie, you may reveal what prototype upgrade you've made to an Astir " +
				"that you reasonably had access to recently. When you do so, choose 2:</p>" +
				"<ul>" +
				"<li>You didn't have to disassemble anything else for parts.</li>" +
				"<li>Your invention doesn't draw unwanted attention to you.</li>" +
				"<li>The upgrade burns out at the end of the Sortie, rather than after one use.</li>" +
				"<li>Using the upgrade isn't dangerous in any way.</li>" +
				"</ul>"
		},
		{
			key: "the-artificer:counterspell",
			name: "Counterspell",
			// Same shape as Turn Unearthly — adds KNOW as a rollable option to Exchange Blows/
			// Strike Decisively. Unconditional once picked, same non-enforcement convention every
			// other addsTraitToMove grant in this module already follows (e.g. it isn't scoped to
			// "only when fighting a magical construct"). The granted Counterspell III weapon
			// profile is purely descriptive — the player adds it by hand via the Equipment tab; its
			// three tags (set-up, slow, ruin) already exist in EQUIPMENT_TAGS.
			traits: [],
			addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "know" },
			description:
				"<p>When you get close and use your expertise in magical machinery to try and disrupt " +
				"or damage a magical ritual, enchantment or construct, you may exchange blows and " +
				"strike decisively with +KNOW using the following profile:</p>" +
				"<ul>" +
				"<li>Counterspell III (melee / set-up, slow, ruin)</li>" +
				"</ul>"
		}
	]
};
