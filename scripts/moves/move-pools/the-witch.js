export const THE_WITCH_POOL = {
	key: "the-witch",
	label: "The Witch",
	playbookName: "The Witch",
	moves: [
		{
			key: "the-witch:patron",
			name: "Patron",
			// Unconditionally granted ("You start with the patron move") — no `starting: true` marker
			// on the move itself, same treatment Prepare Rituals/Tenets give their own unconditional
			// grants (see starting-moves.js's grantedKeys instead).
			//
			// grantsChannelWhileInfluence (see trait-bonuses.js's patronChannelBonus) is the one real
			// mechanic here: +1 CHANNEL while the Patron's Influence is >= 1, reaching every place
			// PlaybookActorSheet#_traitBonuses already reaches. Influence and Boons themselves are
			// tracked on the Social tab's own Patron section (see patron-mixin.js), not per-move state —
			// this move just carries the flag that turns Influence's count into a real Trait bonus.
			// The three Influence-spend options (help/hinder as a 10+, force a move the player may
			// weather the storm against, re-roll boons) are the patron's own reactive action against the
			// player rather than something the player rolls or activates themselves, so — like Bearer Of
			// Curses below — they stay descriptive; the player raises/lowers the Influence stepper by
			// hand to reflect the patron having spent it.
			traits: [],
			grantsChannelWhileInfluence: true,
			description:
				"<p>Your patron offers you two boons at random whenever someone leads a Sortie.</p>" +
				"<p>Additionally, they may spend Influence 1-for-1 to do the following;</p>" +
				"<ul>" +
				"<li>Help or hinder you, succeeding as if they had rolled a 10+.</li>" +
				"<li>Attempt to force you to do something; you may weather the storm to resist.</li>" +
				"<li>Re-roll your boons for the day.</li>" +
				"</ul>" +
				"<p>As long as your Patron has at least 1 Influence, your CHANNEL is increased by 1.</p>" +
				"<p>The more Influence on you a Patron holds, the clearer their mark is upon you.</p>"
		},
		{
			key: "the-witch:occult-lore",
			name: "Occult Lore",
			traits: ["channel"],
			results: {
				success: null,
				mixed: "The information is still directly useful, but using it would cause some " +
					"unforeseen complication entertaining or beneficial to your patron.",
				failure: null
			},
			description:
				"<p>When you consult your patron for information, you may dispel uncertainties with " +
				"+CHANNEL. If you do so, on a 7-9 the information is still directly useful, but using it " +
				"would cause some unforeseen complication entertaining or beneficial to your patron.</p>"
		},
		{
			key: "the-witch:whims",
			name: "Whims",
			// "Choose your boons instead of rolling next time" is the manual "Choose 2 Boons" picker in
			// the Patron section (see witch.js's chooseWitchBoons/patron-mixin.js's
			// _onWitchBoonsChoose) — the same button Receive Boons' own random grant sits beside.
			// Completing (or not completing) the Director's own goal each Sortie isn't tracked anywhere
			// (no Sortie-scoped Director-prompt system exists in this module), so that half stays
			// descriptive; giving 1 Influence is the existing manual Influence stepper.
			traits: [],
			description:
				"<p>Your patron is unfathomable, and their interests obscure. Your Director should, once " +
				"per Sortie, give you some minor goal or abstract requirement your patron demands of " +
				"you—it should be doable within the session.</p>" +
				"<p>If you complete it, you may choose your boons instead of rolling next time. If you " +
				"don't, give your patron 1 Influence.</p>"
		},
		{
			key: "the-witch:embrace-chaos",
			name: "Embrace Chaos",
			// "Roll a 10+, opt to take a 7-9 instead, hold 1" is the mirror image of
			// grantsAutomaticSuccess -- grantsDowngradeHold offers a chat-card button on a 10+ that
			// *grants* hold instead of spending it (see move-grants-mixin.js's _availableDowngrade/
			// move-chat-listeners.js's handleDowngrade). The banked hold then spends 1-for-1 on either
			// listed option: grantsAutomaticSuccess (already the correct "succeed as if you'd rolled a
			// 10+" mechanism, here additionally gated by requiresTier: "mixed" so this source -- unlike
			// its five siblings -- only ever offers on a 7-9, never a failure) or an ordinary
			// grantsRollModifier entry (below) that converts a disadvantage into an advantage: +2
			// Advantage, gated to only apply while the roll's currently-resolved Advantage is
			// "disadvantage" or "disadvantage2" (disadvantage(-1)+2=advantage(+1), disadvantage2(-2)+2=
			// none(0) -- both of the rulebook's own "convert a disadvantage into an advantage"/"at
			// disadvantage x2, into a flat roll" outcomes fall out of the same uniform +2 step). Chains
			// with any other checked Roll Modifier via the roll dialog's own live chain (see
			// roll-chain.js's resolveRollChain) -- most notably All In (cantrips.js), whose own
			// requiresAdvantage gate this entry can satisfy once it's applied first.
			traits: [],
			flatHold: 1,
			suppressActivateButton: true,
			grantsDowngradeHold: { amount: 1 },
			grantsAutomaticSuccess: { cost: 1, requiresTier: "mixed", buttonLabel: "Upgrade from embrace chaos" },
			grantsRollModifier: [{
				advantage: "advantage2",
				requiresAdvantage: ["disadvantage", "disadvantage2"],
				costsHold: { amount: 1 }
			}],
			description:
				"<p>Whenever you roll a 10+, you may opt to instead take a partial success as if you had " +
				"rolled a 7-9. If you do so, hold 1, which you may spend at any point before the end of " +
				"the Sortie to do one of the following;</p>" +
				"<ul>" +
				"<li>Convert a disadvantage into an advantage.</li>" +
				"<li>Upgrade a result of 7-9 to a 10+.</li>" +
				"</ul>"
		},
		{
			key: "the-witch:re-weave-reality",
			name: "Re-Weave Reality",
			// Equipment tags are a fixed snapshot on the entry with no temporary per-roll override hook
			// (see docs/domains/moves.md's "systems that do not exist yet" — weapon tags/profiles). Prose only;
			// giving your patron 1 Influence is the existing manual Influence stepper.
			traits: [],
			description:
				"<p>When you use a piece of equipment to make a move, e.g using a weapon to strike " +
				"decisively, you can ignore one of its tags OR act as if it had an additional one of your " +
				"choice. When you do so, give your patron 1 Influence.</p>"
		},
		{
			key: "the-witch:relinquish",
			name: "Relinquish",
			// The boon-clearing half is real — see the Patron section's own "Relinquish Boons" button
			// (patron-mixin.js's _onWitchBoonsRelinquish). Fixing a damaged Astir part and losing a
			// peril as a result stays prose: no per-part damage state exists to track "this specific
			// part is damaged/destroyed" (Astir Parts are either installed or not — see astir.js), and
			// Dangers are a freeform panel rather than a tally a move could conditionally clear one of.
			traits: [],
			description:
				"<p>If a part of your Astir is damaged or destroyed and you take a peril as a result, you " +
				"may relinquish your boons; losing them until you receive boons again but fixing that " +
				"part and losing the peril. You cannot re-roll relinquished boons.</p>"
		},
		{
			key: "the-witch:bearer-of-curses",
			name: "Bearer Of Curses",
			// Pure fiction — no roll, no tracked resource, and the three options are adjudicated at the
			// table (whether someone can use subsystems, a lasting mark, advantage on a future move
			// against them) rather than posted as a chat prompt, unlike Facilitator/Bureaucrat's own
			// activateChoices menus. Surfaced as a reminder on every tier of Exchange Blows alike,
			// deliberately redundant across success/mixed/failure/critical — this move's own trigger
			// ("when you exchange blows... for the first time in a Scene") has no tier qualifier at
			// all, unlike Coordinator/Mana Devourer's tier-specific grants.
			traits: [],
			addsSuccessReminderToMove: {
				moveKeys: ["exchange-blows"],
				reminder: "First time this Scene, choose 1: they can't use subsystems this Scene; you " +
					"leave a lasting mark on them; or the next move against them is made with advantage"
			},
			addsMixedReminderToMove: {
				moveKeys: ["exchange-blows"],
				reminder: "First time this Scene, choose 1: they can't use subsystems this Scene; you " +
					"leave a lasting mark on them; or the next move against them is made with advantage"
			},
			addsFailureReminderToMove: {
				moveKeys: ["exchange-blows"],
				reminder: "First time this Scene, choose 1: they can't use subsystems this Scene; you " +
					"leave a lasting mark on them; or the next move against them is made with advantage"
			},
			addsCriticalReminderToMove: {
				moveKeys: ["exchange-blows"],
				reminder: "First time this Scene, choose 1: they can't use subsystems this Scene; you " +
					"leave a lasting mark on them; or the next move against them is made with advantage"
			},
			description:
				"<p>When you exchange blows with someone for the first time in a Scene, choose 1;</p>" +
				"<ul>" +
				"<li>They cannot use subsystems for the rest of the Scene.</li>" +
				"<li>You leave a difficult to remove brand or mark on them, according to your patron.</li>" +
				"<li>They suffer misfortune in the future: the next move against them is made with " +
				"advantage.</li>" +
				"</ul>"
		},
		{
			key: "the-witch:borrowed-power",
			name: "Borrowed Power",
			// Both halves are unbuildable within existing shapes: the roll+hold grant has a per-tier
			// player-choice-with-a-cost branch on a 7-9 ("hold 1, OR be in peril and hold 3") that plain
			// tiered `hold` (one fixed value per tier) can't express, and the actually load-bearing spend
			// — use a boon you don't currently have, or spend 2 hold to make any move from another
			// playbook — has no machinery to hook into (boons aren't moves, so ALL_MOVES' own lookup
			// can't reach one, and nothing in this module lets a roll borrow another playbook's move
			// definition). Prose only, per docs/domains/moves.md's "systems that do not exist yet".
			traits: [],
			description:
				"<p>When you request help from your patron, roll +CHANNEL and give your patron 1 " +
				"Influence. On a 10+, hold 3. On a 7-9, hold 1, or be in peril and hold 3.</p>" +
				"<p>You may spend your hold at any point during the Sortie 1-for-1 to use any boon you " +
				"don't currently have, or you may spend 2 hold to make any move from another playbook.</p>"
		}
	]
};
