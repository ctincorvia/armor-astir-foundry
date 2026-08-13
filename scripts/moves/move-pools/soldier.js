export const SOLDIER_POOL = {
	key: "soldier",
	label: "Soldier Moves",
	note: "Any playbook may take these in place of a move from their own pool, but only under " +
		"specific circumstances — normally through Advancement.",
	// None of these roll a stat — every one is either pure fiction, a flat hold grant, or a
	// once-per-Sortie flag, so every move here has an empty `traits` (no gated/ungated roll
	// path to cover, unlike Cantrips' Deny).
	moves: [
		{
			key: "soldier:get-out-of-my-way",
			name: "Get Out of My Way!",
			traits: [],
			// Same shape as b-plot (moves.js SPECIAL_MOVES): a flat, roll-less hold grant, tracked
			// in its own system.attributes.moveHold pool (keyed by this move's own key) rather than
			// a roll-tiered one — see playbook-actor-sheet.js.
			flatHold: 3,
			// Scoped to "the Sortie" the same way b-plot is — see moves.js's b-plot comment.
			period: "Sortie",
			description:
				"<p>When you come to blows with your Rival, see someone you have a GRAVITY clock with die, " +
				"or witness the Authority commit a truly terrible act, hold 3.</p>" +
				"<p>You may spend this hold 1-for-1 to strike decisively against non-Rival or Main foes, " +
				"even if they aren't defenceless, and treat any result of 6 or below as a 7-9.</p>"
		},
		{
			key: "soldier:red-comet",
			name: "Red Comet",
			// Astir parts/Power capacity aren't their own tracked entities in this module yet (see
			// Cool Off in moves.js) — descriptive only, same treatment as Cantrips' Red Comet-style
			// passive grants.
			traits: [],
			description:
				"<p>Any Astir you channel gains an extra Artifact part called 'Uncanny Speed', and its " +
				"Power capacity is increased by 1.</p>"
		},
		{
			key: "soldier:flash",
			name: "Flash",
			traits: [],
			description:
				"<p>You may communicate with other Channelers instantly over great distances in times of " +
				"urgent need, sending words or even feelings and sensations to help or hinder faster than " +
				"anyone or anything else can act: so quickly, in fact, that you may do it after a roll has " +
				"been made.</p>" +
				"<p>Additionally, dead characters may still help or hinder you, their spirit able to speak " +
				"with you from beyond.</p>"
		},
		{
			key: "soldier:selfless",
			name: "Selfless",
			// Taking a peril is already the existing Danger "Add" controls (system.attributes.dangers)
			// — same reasoning as Cantrips' Fire-Eater — so no new plumbing is needed.
			traits: [],
			description:
				"<p>You may put yourself in peril to completely defend another from one source of incoming " +
				"harm, like a blade or a challenging statement, however severe it is.</p>" +
				"<p>You may put yourself in peril to attempt something uncanny, superhuman, or " +
				"unbelievable.</p>"
		},
		{
			key: "soldier:indomitable",
			name: "Indomitable",
			// "Whenever you make a move, on a result of 12+ ..." is universal rather than targeting
			// one move key — see moves.js#isCriticalResult/
			// PlaybookActorSheet#_grantedCriticalReminderForMove, whose omitted `moveKeys` means "any
			// move qualifies" (same convention grantsAutomaticSuccess.moves already uses for its own
			// unrestricted case).
			traits: [],
			addsCriticalReminderToMove: {
				reminder: "You may clear a risk"
			},
			description:
				"<p>Whenever you make a move, on a result of 12+ you may clear a risk.</p>"
		},
		{
			key: "soldier:white-devil",
			name: "White Devil",
			traits: [],
			description:
				"<p>Stories of your talent and your Astir have spread far and wide among your enemies: " +
				"anyone other than your Rival who would act against you whilst piloting your Astir must " +
				"take the risk (intimidated) to do so. This risk is cleared if they witness your Astir be " +
				"seriously damaged, if you flee from fighting, or if they have reason to believe you " +
				"aren't piloting it.</p>"
		},
		{
			key: "soldier:nightmare-of-solomon",
			name: "Nightmare of Solomon",
			traits: [],
			description:
				"<p>You have acquired a weapon of horrific potential. When you deploy it to destroy your " +
				"enemy with overwhelming force, you succeed. Resolve all your GRAVITY clocks as if you had " +
				"filled them, even ones that have been previously committed to and locked. No advancements " +
				"are gained for clocks resolved in this manner.</p>" +
				"<p>In the future, no matter how noble your intent or just the results, your actions will " +
				"be used to justify further violence.</p>"
		},
		{
			key: "soldier:the-arity-method",
			name: "The Arity Method",
			traits: [],
			uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
			// "Succeed as if you'd rolled a 10+" — same automatic-success button Hot-blooded/Once
			// the War's Over grant, but paid from this move's own `uses` checkbox above (via
			// useKey, rather than a hold cost) and restricted to bite-the-dust only, matching
			// "when you would bite the dust" — see PlaybookActorSheet#_availableAutomaticSuccess.
			// The second sentence (confidence + advantage on the *next* Exchange Blows/Strike
			// Decisively roll) is a distinct one-shot buff-for-a-future-roll mechanic this module
			// has no hook for yet, so it stays descriptive only — see docs/domains/moves.md's "systems that do
			// not exist yet".
			grantsAutomaticSuccess: { useKey: "sortie", moves: ["bite-the-dust"] },
			description:
				"<p>Once per Sortie, when you would bite the dust, succeed as if you'd rolled a 10+. Act " +
				"with confidence and advantage the next time you would exchange blows or strike " +
				"decisively.</p>"
		},
		{
			key: "soldier:original-video-episode",
			name: "Original Video Episode",
			traits: [],
			description:
				"<p>During Downtime, you may lead a raid or operation against the Authority to disrupt " +
				"their activities as your Downtime Scene. Tell the Director what you set out to do, and " +
				"who comes with you. If it's anyone you have GRAVITY with, advance it. During the next " +
				"Conflict Turn, the Cause may start a Conflict Scene of their choice with one success " +
				"already.</p>"
		},
		{
			key: "soldier:once-the-wars-over",
			name: "Once the War's Over",
			traits: [],
			// Same flat-hold shape as Get Out of My Way! above — its own independently-tracked pool.
			flatHold: 3,
			period: "Sortie",
			// "Spend your hold 1-for-1 to automatically succeed on any move as if you had rolled a
			// 10+" — same automatic-success button as Hot-blooded, at a 1-hold cost per use rather
			// than Hot-blooded's flat 3 — see PlaybookActorSheet#_availableAutomaticSuccess.
			grantsAutomaticSuccess: { cost: 1 },
			description:
				"<p>When you talk about what's waiting for you after the fighting's over, hold 3.</p>" +
				"<p>You may spend your hold 1-for-1 to automatically succeed on any move as if you had " +
				"rolled a 10+.</p>" +
				"<p>Whether or not you spend your hold, you will perish before the beginning of your next " +
				"Downtime. Don't roll to bite the dust as usual—instead, let your Director know when you " +
				"think it's time.</p>"
		},
		{
			key: "soldier:thats-dialectics",
			name: "That's Dialectics",
			// References a long-term project clock (distinct from the existing GRAVITY clocks —
			// different length, and decrements on neglect rather than filling toward a value) and a
			// "plan and prepare" d6 mechanic, neither of which exist anywhere in this module yet. Per
			// docs/domains/moves.md's "systems that do not exist yet" guidance, transcribed as prose rather than
			// inventing new tracking machinery.
			traits: [],
			description:
				"<p>You take over another Faction of the Cause, and steer them towards something " +
				"impressive. Start an 6-step long-term project clock. Once it's filled, on your next plan " +
				"and prepare, every d6 rolled counts as a result of 6. You also may then lead a Sortie in " +
				"confidence for as long as the Faction remains in the Cause, as they fight alongside " +
				"you.</p>" +
				"<p>You must work on this project at least once per Downtime when possible: otherwise your " +
				"influence over the other Faction dwindles, and the clock is reduced 1 step.</p>"
		},
		{
			key: "soldier:midseason-upgrade",
			name: "Midseason Upgrade",
			traits: [],
			description:
				"<p>The opportunity to acquire something of immense power and value will present itself to " +
				"you. It might be a tier IV Astir, a legendary Ardent, some other kind of powerful magical " +
				"artifact or something of more mundane importance.</p>"
		},
		{
			key: "soldier:fisher-of-men",
			name: "Fisher of Men",
			// Hooks aren't tracked anywhere in this module yet (referenced only as fiction elsewhere,
			// e.g. bite-the-dust's Hooks text in moves.js) — descriptive only.
			traits: [],
			description:
				"<p>When you strike decisively and succeed, you may impose one of your Hooks on the other " +
				"party if they survive. If that character belongs to a player, it does not count against " +
				"their usual limit of three Hooks.</p>"
		},
		{
			key: "soldier:changed-for-good",
			name: "Changed for Good",
			// Both GRAVITY clocks and Traits already have their own controls on the sheet — this is a
			// one-time narrated change the player applies by hand with those, same treatment as the
			// Advancement checklist's own Trait-increase entries.
			traits: [],
			description:
				"<p>Select a committed Gravity clock. Replace one of your Traits with its value, " +
				"describing how that relationship bettered you in one aspect.</p>"
		}
	]
};
