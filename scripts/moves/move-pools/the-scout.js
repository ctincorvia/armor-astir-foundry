export const THE_SCOUT_POOL = {
	key: "the-scout",
	label: "The Scout",
	// Matches a PLAYBOOKS entry's name in actor-creation.js — that's how the picker knows which
	// pool is "yours". A pool with no playbookName is universal (Cantrips, Soldier Moves).
	playbookName: "The Scout",
	moves: [
		// Field Scout and Giant Slayer are the two Starting Moves ("pick either...") — see
		// starting-moves.js, which reads their `starting: true` flag rather than duplicating
		// this pool's key list. Every move below them is an Additional Move ("...as well as two
		// others from your Additional Moves").
		{
			key: "the-scout:field-scout",
			name: "Field Scout",
			starting: true,
			// Field Scout and Giant Slayer are alternate identities ("pick either"), not merely
			// alternate skill picks — exclusiveGroup keeps both the "+" picker and the Astir's own
			// bonus-move picker from ever offering the sibling once one is picked (see
			// pickerSection above). The chargen picker already enforces this via pickOneKeys
			// (starting-moves.js); this closes the same gap in every picker drawing from this pool.
			exclusiveGroup: "the-scout:starting-move",
			traits: [],
			// conflictTier (see PlaybookActorSheet#_conflictTier) raises this actor's Tier for
			// all physical-conflict purposes while not piloting an Astir — see claude.md's
			// Character Tier notes. Max wins if Giant Slayer is somehow picked too, since pool
			// restrictions (including "pick either") are deliberately unenforced everywhere
			// else in this module.
			conflictTier: 2,
			// grantsEffectOnMove (see PlaybookActorSheet#_rollMove) locks Read the Room's Effect
			// to Confidence, the same precedence slot a forced weapon tag or bite-the-dust's max
			// Perils lock already occupies.
			grantsEffectOnMove: { moveKey: "read-the-room", effect: "confidence" },
			description:
				"<p>You're an expert at managing operations in the field and supporting your allies. You're " +
				"agile and strong, you tend to notice things those in Astirs don't, and your size allows you " +
				"access to spaces too small for them. Read the room with confidence, always.</p>" +
				"<p>Your skill at combat is above and beyond that of other fighters, too: for all purposes " +
				"related to physical conflict, you are considered tier II rather than I. This includes " +
				"wielding weapons, fighting, avoiding harm, and so on. Your custom weapon is tier II (set its " +
				"own Tier to match on the Equipment tab), and is either too heavy or requires too specific " +
				"training for other people to use without taking disadvantage.</p>"
		},
		{
			key: "the-scout:giant-slayer",
			name: "Giant Slayer",
			starting: true,
			exclusiveGroup: "the-scout:starting-move",
			traits: [],
			conflictTier: 3,
			description:
				"<p>You have trained and honed your fighting skill to the point that you can easily go " +
				"toe-to-toe with giants, Astirs and other huge creatures: for all purposes related to " +
				"physical conflict, you are considered tier III rather than I. This includes wielding " +
				"weapons, fighting, avoiding harm, and so on, though Astir-sized weapons might still present " +
				"you some difficulty (given their sheer weight and size) unless the Astir was particularly " +
				"small or you have a clever solution for leverage.</p>" +
				"<p>Your custom weapon is tier III (set its own Tier to match on the Equipment tab), and is " +
				"a huge, unique armament that you alone can wield as easily as any other. No other person " +
				"can hope to use it well with just their mere hands.</p>"
		},
		{
			key: "the-scout:team-player",
			name: "Team Player",
			traits: [],
			// References passing Read the Room's held information to an ally and having them
			// roll +GRAVITY on a move involving you — no move can currently affect another
			// actor's roll or read a value off a relationship the way GRAVITY's own 1-3 value
			// would need to here (see docs/domains/moves.md's "systems that do not exist yet"; group moves
			// are the same missing system Natural Leader below needs). Prose only.
			description:
				"<p>When you read the room, you may pass the information you gain along and allow an ally to " +
				"act with advantage instead of you. This counts as them making a move involving you, and " +
				"they may roll with +GRAVITY as appropriate.</p>"
		},
		{
			key: "the-scout:mobility",
			name: "Mobility",
			traits: ["defy"],
			// A second roll-tiered hold grant alongside Read the Room's — separateHold (see
			// PlaybookActorSheet#_moveGroupMoves/moves.js#rollMove) routes this into its own
			// per-move pool (system.attributes.moveHold.the-scout:mobility) instead of the
			// shared system.resources.hold field Read the Room writes, so rolling one never
			// silently overwrites the other's live hold.
			hold: { success: 3, mixed: 1, failure: 0 },
			separateHold: true,
			questionPrompts: {
				success: "Spend hold 1-for-1, at any time, to do one of the following.",
				mixed: "Spend hold 1-for-1, at any time, to do one of the following.",
				failure: "You hold nothing."
			},
			questions: [
				"Escape from something that binds, traps or impedes you.",
				"Acquire high ground or a defensible position.",
				"Get to somewhere or something before others can.",
				"Avoid an incoming source of physical harm."
			],
			results: { success: null, mixed: null, failure: null },
			description:
				"<p>When you're fighting somewhere with the room to be acrobatic and mobile, roll +DEFY;</p>" +
				"<p>On a 10+, hold 3. On a 7-9, hold 1. You can spend 1 hold at any time to do one of the " +
				"following;</p>" +
				"<ul>" +
				"<li>Escape from something that binds, traps or impedes you</li>" +
				"<li>Acquire high ground or a defensible position</li>" +
				"<li>Get to somewhere or something before others can</li>" +
				"<li>Avoid an incoming source of physical harm</li>" +
				"</ul>"
		},
		{
			key: "the-scout:improvisation",
			name: "Improvisation",
			traits: [],
			// Same flat, roll-less hold shape as b-plot/Get Out of My Way! — its own
			// independently-tracked pool, scoped to the Sortie by its own text.
			flatHold: 3,
			period: "Sortie",
			description:
				"<p>At the beginning of a Sortie, hold 3. You may spend 1 hold to change your approach for a " +
				"single move — explain to your Director " +
				"what you did or used to do this.</p>"
		},
		{
			key: "the-scout:natural-leader",
			name: "Natural Leader",
			traits: [],
			// Group moves (rolling in place of whoever in a group has the lowest relevant
			// trait) don't exist anywhere in this module — every roll is one actor's own (see
			// docs/domains/moves.md's "systems that do not exist yet"). Prose only.
			description:
				"<p>When participating in a group move, you can always make the roll in place of whoever has " +
				"the lowest relevant trait.</p>"
		},
		{
			key: "the-scout:patch-job",
			name: "Patch Job",
			traits: [],
			// Extends Cool Off's own result menu with a faster/different 7-9 outcome — Cool
			// Off's own outcomes are narrated rather than enforced, so this is prose only, the
			// same treatment Arcane Forge (astir.js) gives the identical situation.
			description:
				"<p>When you cool off to remove a risk or the 'overheating' tick from an Astir, you can do " +
				"it in a few moments rather than minutes, even while the Astir is still moving. Instead of " +
				"the usual result, on a 7-9 you attract unwanted attention.</p>"
		},
		{
			key: "the-scout:guerrilla",
			name: "Guerrilla",
			traits: ["know"],
			// Reuses the questionPrompts/questions rendering Read the Room introduced — Guerrilla's
			// own options aren't literally questions to ask a Director, but the shape (a per-tier
			// prompt plus a spend-style option list) is identical, so this rides the same chat
			// template section rather than needing one of its own.
			questionPrompts: {
				success: "Choose 2.",
				mixed: "Choose 1, or choose 2 and take a risk.",
				failure: null
			},
			questions: [
				"You avoid detection.",
				"You find something hidden or forgotten.",
				"You can set up for an ambush.",
				"You find a way to allow others to follow you without being detected."
			],
			results: { success: null, mixed: null, failure: null },
			description:
				"<p>When you attempt to evade detection or sneak past others, roll +KNOW;</p>" +
				"<p>On a 10+, choose 2. On a 7-9, choose 1, or choose 2 and take a risk.</p>" +
				"<ul>" +
				"<li>You avoid detection.</li>" +
				"<li>You find something hidden or forgotten.</li>" +
				"<li>You can set up for an ambush.</li>" +
				"<li>You find a way to allow others to follow you without being detected.</li>" +
				"</ul>"
		},
		{
			key: "the-scout:path-finding",
			name: "Path-finding",
			traits: [],
			// Same flat, roll-less hold shape as Improvisation above, but "while you travel" is
			// not a tracked phase in this module (no period), same treatment as Personal
			// Familiar's Downtime use.
			flatHold: 3,
			description:
				"<p>When you're leading a group that is travelling a long distance, hold 3, and spend it " +
				"1-for-1 on the following options while you travel;</p>" +
				"<ul>" +
				"<li>You lead the group past an area of difficult terrain without issue.</li>" +
				"<li>You find a comfortable, sheltered place to set up camp.</li>" +
				"<li>You're familiar with the area; dispel uncertainties regarding it or the things in it " +
				"with advantage during the journey.</li>" +
				"<li>You find a shortcut, reducing the length of your journey but adding complications.</li>" +
				"</ul>"
		}
	]
};
