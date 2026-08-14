// Special moves sit in their own sheet section below Basic Moves (see
// PlaybookActorSheet#getData) but share the exact same shape/handling as basic moves — the only
// structural difference is where they're grouped. Some special moves are additionally
// conditional on actor state via requiresChannelDisabled (see b-plot below and
// PlaybookActorSheet's `gated` computation) rather than being available unconditionally like
// lead-a-sortie and subsystems.
export const SPECIAL_MOVES = [
	{
		key: "lead-a-sortie",
		name: "Lead a Sortie",
		traits: ["know", "defy"],
		// CREW isn't a TRAITS entry or a stat on this actor — it's the Carrier's own Crew trait
		// (see carrier-actor-sheet.js). The `value: 0` here is only a placeholder for a fresh
		// move definition; PlaybookActorSheet#_moveTraits overwrites it with a live read off
		// whichever Carrier actor exists in the world before this ever reaches a sheet or a roll.
		fixedTraits: [{ key: "crew", label: "CREW", value: 0 }],
		description:
			"<p>When it's time for action and you lead a Sortie, decide who planned the mission and roll;</p>" +
			"<ul>" +
			"<li>+KNOW, if you're leading with wits or following a clever plan.</li>" +
			"<li>+CREW, if it was someone else aboard.</li>" +
			"<li>+DEFY, if you're heading into danger blind.</li>" +
			"</ul>" +
			"<p>On a 10+, you make it to the action unscathed.</p>" +
			"<p>On a 7-9, the crew stumbles, misses something important, or is unprepared for what they " +
			"meet.</p>",
		results: {
			success: "You make it to the action unscathed.",
			mixed: "The crew stumbles, misses something important, or is unprepared for what they meet.",
			failure: null
		}
	},
	{
		key: "subsystems",
		name: "Subsystems",
		traits: [],
		// No roll at all — see PlaybookActorSheet's `rollable` flag, which hides the Roll button
		// for moves with no traits, conditions, or fixedTraits. No `results` either, since
		// postMoveDescription (the only path that can ever fire for this move) never reads it.
		description:
			"<p>When you activate your Astir's subsystems, spend 1 Power to re-activate an expended " +
			"[Active] Astir part and use it again.</p>"
	},
	{
		key: "b-plot",
		name: "B-Plot",
		traits: [],
		// Gates the move for CHANNEL-enabled actors (e.g. The Impostor) — the mirror image of
		// weave-magic's traits-based gating (disabled when CHANNEL is *disabled*). See
		// PlaybookActorSheet's `gated` computation, which ORs this in alongside the existing
		// traits-empty check. The move stays visible and its description readable either way,
		// same as any other gated move — only its hold stepper is greyed out/disabled.
		requiresChannelDisabled: true,
		// No roll — traits is empty and there are no conditions, so `rollable` in
		// PlaybookActorSheet stays false, same treatment as subsystems.
		// Hold is granted flat by narration, not by a roll tier (contrast read-the-room's
		// `hold: {success,mixed,failure}`), and tracked in its own actor field rather than the
		// shared system.resources.hold pool, since a character could plausibly hold both at
		// once — see PlaybookActorSheet.
		flatHold: 3,
		// Its own text scopes spending this hold to "During the Sortie" — cleared by the
		// Controls tab's Refresh Sortie button (see PlaybookActorSheet#_onRefreshSortie).
		period: "Sortie",
		downtimeAbility: "Spend a point of B-Plot hold to frame a Downtime Scene.",
		description:
			"<p>When you head out for some solitary revenge, leave to take part in negotiations, or " +
			"otherwise take part in a secondary narrative thread to the players involved in the Sortie, " +
			"you're in the b-plot.</p>" +
			"<p>Name one or two Director characters that accompany you and hold 3. During the Sortie, you " +
			"may spend it 1-for-1 to do the following;</p>" +
			"<ul>" +
			"<li>Give another player confidence on their next move, but complicate things for yourself.</li>" +
			"<li>Deny an actor from appearing during the Sortie—they're busy, possibly with the same thing " +
			"as you.</li>" +
			"<li>Spend some time and frame a Downtime Scene.</li>" +
			"<li>Cut away from the Sortie during a moment when time is precious, giving everyone room to " +
			"think.</li>" +
			"</ul>"
	},
	{
		key: "plan-and-prepare",
		name: "Plan & Prepare",
		traits: [],
		// Declarative flag read by _moveGroupMoves/the template's fourth dispatch branch — this move's
		// roll pipeline is structurally incompatible with rollMove (no trait, no Confidence/Desperation,
		// no Advantage/Disadvantage, no tiers; a player-chosen variable dice pool, each die scored
		// independently against a manually-entered target). See configureVariableDiceRoll
		// (move-dialogs.js) and rollVariableDicePool (move-roll.js).
		variableDicePool: true,
		downtimeAbility: "Roll extra dice on Plan & Prepare for each die earned during Downtime Scenes.",
		description:
			"<p>When you review orders for the next Sortie, go over scouting reports and maps, or otherwise " +
			"attempt to prepare the crew for what comes next, you're trying to plan & prepare.</p>" +
			"<p>Roll a d6, plus any extra dice earned during Downtime Scenes, and compare the results to " +
			"the Strength of the Division that your next Sortie will target. For every result that is " +
			"equal to or above the Division's Strength, choose one:</p>" +
			"<ul>" +
			"<li>During the Sortie, you will have an opportunity to: Untap a Faction of the Cause—" +
			"securing supplies, freeing captives, etc; Reduce a Division's Strength by 1 during the next " +
			"Conflict Turn—interfering with supply routes, undermining their operations, etc; Reduce the " +
			"GRIP on a Faction or Pillar by 1—rooting out agents, destroying fortifications, etc; Expose " +
			"or make vulnerable an asset or actor</li>" +
			"<li>During the Sortie, you will have a risky opportunity to: Fell a Pillar with 0 GRIP—" +
			"winning a decisive battle, capturing a position, etc; Destroy or capture an exposed asset or " +
			"actor; Reduce a Division's Strength by 2 during the next Conflict Turn—disrupting a key " +
			"shipment, assassinating important staff, etc</li>" +
			"<li>The next lead a Sortie roll is made with advantage.</li>" +
			"<li>All players hold 1. You may spend your hold during the next Sortie as if it were hold " +
			"gained through one of your basic or playbook moves.</li>" +
			"</ul>",
		// The four-option choice menu, offered once per success (not once per roll) — rendered under a
		// dynamically-built "Choose N..." prompt in rollVariableDicePool rather than baked into static
		// text, so the count isn't duplicated. Mirrors the dynamic questionPrompt / static questions
		// split BASIC_MOVES' read-the-room already uses.
		successOptions:
		"<ul>" +
		"<li>During the Sortie, you will have an opportunity to: Untap a Faction of the Cause—" +
		"securing supplies, freeing captives, etc; Reduce a Division's Strength by 1 during the " +
		"next Conflict Turn—interfering with supply routes, undermining their operations, etc; " +
		"Reduce the GRIP on a Faction or Pillar by 1—rooting out agents, destroying fortifications, " +
		"etc; Expose or make vulnerable an asset or actor</li>" +
		"<li>During the Sortie, you will have a risky opportunity to: Fell a Pillar with 0 GRIP—" +
		"winning a decisive battle, capturing a position, etc; Destroy or capture an exposed asset " +
		"or actor; Reduce a Division's Strength by 2 during the next Conflict Turn—disrupting a key " +
		"shipment, assassinating important staff, etc</li>" +
		"<li>The next lead a Sortie roll is made with advantage.</li>" +
		"<li>All players hold 1. You may spend your hold during the next Sortie as if it were hold " +
		"gained through one of your basic or playbook moves.</li>" +
		"</ul>"
	}
];
