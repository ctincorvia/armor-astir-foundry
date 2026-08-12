import { TRAITS } from "../core/traits.js";

export const PLAYBOOK_MOVE_PICKER_TEMPLATE = "modules/armor-astir/templates/playbook-move-picker.hbs";

// Unlike basic/special moves (which every playbook gets automatically — see moves.js), playbook
// moves start empty on every actor and are picked one at a time via the sheet's "+" button. The
// picked keys live on the actor (system.attributes.playbookMoves); the definitions live here, so
// two Scouts can carry completely different sets and later text edits reach both.
//
// Move objects use the exact same shape as BASIC_MOVES (see claude.md, "Basic moves") — they're
// rendered by the same _moveGroupMoves/rollMove/postMoveDescription path, so anything a basic
// move can express (traits, hold, conditions, intents, uses) works here unchanged.
//
// Pool membership is *not* enforced anywhere: the picker shows every pool to every actor, with a
// `note` explaining when each one normally applies. The rules around Soldier Moves and reaching
// into another playbook's pool are loose enough ("under specific circumstances", "in rare
// circumstances") that policing them in code would get in the table's way more than it'd help —
// the Advancement checklist (advancements.js) is where that bookkeeping lives.
//
// Every move key is prefixed with its pool key (`the-scout:bullheaded`), because the sheet looks
// moves up in one flat list across all three sources — two playbooks are very likely to name a
// move the same thing eventually.
export const MOVE_POOLS = [
	{
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
				// would need to here (see claude.md's "systems that do not exist yet"; group moves
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
				// claude.md's "systems that do not exist yet"). Prose only.
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
	},
	{
		key: "the-commander",
		label: "The Commander",
		playbookName: "The Commander",
		moves: [
			// Ace Crew and Debrief are the two Starting Moves ("you start with... as well as one
			// other from your Additional Moves") — see starting-moves.js, which reads their own
			// grantedKeys rather than this pool's starting flag. Every move below them is an
			// Additional Move.
			{
				key: "the-commander:ace-crew",
				name: "Ace Crew",
				starting: true,
				traits: [],
				// The named-crew-with-adjectives roster this move's own text asks for lives at
				// system.attributes.aceCrew (see PlaybookActorSheet#getData's aceCrew, its own
				// section on the Social tab) — reuses entry-list.js's CRUD helpers, same pattern
				// Carrier's Crew Members already establish. tierBonus is the other half ("counts as
				// one tier higher"): summed across picked moves by _conflictTier, on top of both the
				// foot-combat base and whatever frame is currently mounted.
				tierBonus: 1,
				description:
					"<p>You have a team of 3-5 well-trained individuals who work with you as a " +
					"coordinated team. Give each of them a name, and an adjective or two to describe " +
					"them.</p>" +
					"<p>Your tier and that of whatever weaponry you use counts as one higher than " +
					"whatever it would normally be for your situation: on foot together you count as " +
					"tier II, crewing an Ardent you count as tier III, and so on. You can pilot " +
					"separate Ardents if desired, but must be acting together as one consistent unit " +
					"to gain these benefits, and are always treated as a single unit rather than " +
					"individual actors.</p>"
			},
			{
				key: "the-commander:debrief",
				name: "Debrief",
				starting: true,
				traits: [],
				// See PlaybookActorSheet#_downtimeTokensMax, summed across picked moves the same way
				// _conflictTier sums tierBonus above.
				downtimeTokensMax: 4,
				description:
					"<p>You exist within a structure, and must report up. During Downtime, instead of " +
					"leading a Scene as usual, you must report to your superiors, marking a point of " +
					"Spotlight. Additionally, you have a total of 4 tokens to spend instead of 2, as " +
					"your Ace Crew works hard to support you.</p>"
			},
			{
				key: "the-commander:withdraw",
				name: "Withdraw",
				traits: ["talk"],
				results: {
					success: "You manage to justify your actions.",
					mixed: "Give up 1 token next Downtime as you are reprimanded for your 'cowardice'.",
					failure: "Start or advance a 4-step clock titled 'court-martialled'."
				},
				description:
					"<p>You may retreat with your crew safely from any situation. When you do so, " +
					"roll +TALK; on a 10+, you manage to justify your actions. On a 7-9, give up 1 " +
					"token next Downtime as you are reprimanded for your 'cowardice'. On a 6-, start " +
					"or advance a 4-step clock titled 'court-martialled'.</p>" +
					"<p>Track 'court-martialled' yourself in the Clocks section (Social tab) — " +
					"nothing here starts or advances it automatically.</p>"
			},
			{
				key: "the-commander:retrofit",
				name: "Retrofit",
				traits: [],
				description:
					"<p>During Downtime, your crew may spend 1 token to swap out one of your Ardent " +
					"Features for another from the list. Alternatively, you may spend 2 tokens to " +
					"swap all of them.</p>" +
					"<p>Remove the old Feature and add the new one from the Custom Ardent's own " +
					"controls, then spend the token(s) yourself on the Downtime tab.</p>"
			},
			{
				key: "the-commander:requisitions",
				name: "Requisitions",
				traits: [],
				// Raises the Ardent Feature pool's own cap by 2 — see ardent.js's ardentFeatureMax,
				// summed across picked moves.
				ardentFeatureBonus: 2,
				description:
					"<p>Choose an additional 2 Ardent Features, as your Custom Ardent is upgraded " +
					"with new weaponry and equipment. If any members of your Ace Crew have died, you " +
					"may also replace them.</p>"
			},
			{
				key: "the-commander:watch-this",
				name: "Watch This",
				traits: [],
				description:
					"<p>You may spend 3 Spotlight to quickly manoeuvre your crew or an Ardent they " +
					"are crewing to any location within sight, even if the path there would be " +
					"dangerous or difficult. If your Director insists that it would be impossible or " +
					"completely deadly, take advantage on the weather the storm required to prove " +
					"them wrong.</p>"
			},
			{
				key: "the-commander:bail-out",
				name: "Bail Out",
				traits: [],
				description:
					"<p>You may, at any point, declare that your Custom Ardent is about to explode. " +
					"Replace all your current dangers with one peril (Bailed Out) as everyone escapes " +
					"just in time, leaving you without it until you repair it during Downtime " +
					"(costing 3 tokens, and removing the 'bailed out' peril). At the Director's " +
					"discretion, the explosion might also affect other things in the Scene.</p>" +
					"<p>Clear your Dangers and add 'Bailed Out' as a Peril yourself from the Dangers " +
					"panel; later, remove it and spend the 3 tokens yourself on the Downtime tab.</p>"
			},
			{
				key: "the-commander:tactical-entry",
				name: "Tactical Entry",
				traits: [],
				description:
					"<p>When you drive or fly your Custom Ardent through the side of a building, you " +
					"can be certain it will remain structurally sound for exactly as long as you need " +
					"it to be.</p>"
			},
			{
				key: "the-commander:support-company",
				name: "Support Company",
				traits: [],
				// 7 candidate tags, each a manual per-Sortie checkbox reusing the existing uses
				// mechanism — "an additional two... per Sortie" isn't enforced as a hard cap here,
				// matching this module's existing non-enforcement stance elsewhere (pool
				// restrictions, MAX_TAGS only enforced in configureEquipment's own dialog).
				uses: [
					{ key: "bane", label: "Bane", period: "Sortie" },
					{ key: "ranged", label: "Ranged", period: "Sortie" },
					{ key: "sniper", label: "Sniper", period: "Sortie" },
					{ key: "blitz", label: "Blitz", period: "Sortie" },
					{ key: "defensive", label: "Defensive", period: "Sortie" },
					{ key: "decisive", label: "Decisive", period: "Sortie" },
					{ key: "adapted", label: "Adapted", period: "Sortie" }
				],
				description:
					"<p>You also have a squad of footsoldiers that you lead into battle. The exact " +
					"amount of men depends on the scale of your campaign. Treat them as a Tier I " +
					"squad under your command, with one danger slot and melee weapons by default.</p>" +
					"<p>They are also kitted out with an additional two of the following tags per " +
					"Sortie: bane, ranged, sniper, blitz, defensive, decisive, adapted.</p>"
			}
		]
	},
	{
		key: "the-impostor",
		label: "The Impostor",
		playbookName: "The Impostor",
		moves: [
			{
				key: "the-impostor:arcane-augments",
				name: "Arcane Augments",
				starting: true,
				// No roll of its own — traits is empty and there are no conditions, so the sheet's
				// `rollable` flag stays false and only a Description button renders (same treatment
				// as Bullheaded below). Its actual mechanical effect is traitBonus (see
				// trait-bonuses.js): +1 CHANNEL per Danger this actor has, capped at +3, resolved
				// generically by PlaybookActorSheet#_traitBonuses and folded into both the Traits
				// panel's display and every roll that spends CHANNEL — no per-move code needed here
				// beyond this declarative flag.
				traits: [],
				traitBonus: { trait: "channel", per: "danger", max: 3 },
				description:
					"<p>Impostors control their Astir using magical augmentations, like artificial limbs or " +
					"organs. These augmentations allow a non-magic user to power and control an Astir, but " +
					"otherwise do not interfere with your life unless you (the player) decide so. Being bonded " +
					"to magic in this way often leads to it affecting the body and vice versa, irreversibly " +
					"tying their magic to their emotional and physical state.</p>" +
					"<p>Your CHANNEL is increased by 1 for each danger you have (up to a max of +3).</p>"
			},
			{
				key: "the-impostor:hot-blooded",
				name: "Hot-blooded",
				traits: [],
				// A flat, roll-less hold grant like B-Plot/Get Out of My Way! (moves.js/
				// playbook-moves.js) — "when you heat up" isn't a tracked trigger anywhere in this
				// module (Overheating is a plain checkbox, not an event), so the Activate button is
				// the player's own call for when that's happened. No `period`: unlike those two
				// moves, nothing in this move's own text scopes the hold to a Sortie or Scene, so it
				// isn't cleared by either Refresh button — same treatment as Path-finding's hold.
				flatHold: 1,
				// "Succeed at a move as if you had rolled a 10+" — the automatic-success chat-card
				// button (see PlaybookActorSheet#_availableAutomaticSuccess/moves.js#rollMove),
				// spending 3 from this move's own moveHold pool. The move's other spend option
				// ("attempt something uncanny...") has no mechanical effect to hook, so it stays
				// descriptive only.
				grantsAutomaticSuccess: { cost: 3 },
				description:
					"<p>When you heat up, hold 1. You may spend 3 hold gained in this way to;</p>" +
					"<ul>" +
					"<li>Succeed at a move as if you had rolled a 10+.</li>" +
					"<li>Attempt something uncanny, superhuman, or unbelievable.</li>" +
					"</ul>"
			},
			{
				key: "the-impostor:troublemaker",
				name: "Troublemaker",
				// Downtime Tokens themselves are tracked (see PlaybookActorSheet's downtimeTokens),
				// but only as a plain counter — this move's actual condition ("whenever you fail a
				// Downtime Scene") and its multiplayer effect (2 for yourself instead of passing 1
				// to another player) depend on Downtime Scenes existing as discrete, resolvable
				// events with pass/fail outcomes and other players to pass to, neither of which this
				// module models. Stays prose only — see claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>Whenever you fail a Downtime Scene, you may give yourself 2 tokens instead of passing 1 " +
					"to another player.</p>"
			},
			{
				key: "the-impostor:dont-follow-me",
				name: "Don't Follow Me",
				traits: [],
				// "Lead a Sortie with +DEFY & advantage" is a real, standing lock — see
				// PlaybookActorSheet#_grantedTraitForMove/_grantedAdvantageForMove, the Trait/
				// Advantage-axis counterparts to Field Scout's own grantsEffectOnMove (which locks
				// the Effect axis the same way). Applied whenever Lead a Sortie is rolled with this
				// move picked, same "always" treatment Field Scout's own unconditional grant gets —
				// the move's own "during any Downtime Scene, without spending a token" framing isn't
				// separately enforced, since neither Downtime Scenes nor tokens are tracked anywhere
				// in this module (see claude.md's "systems that do not exist yet").
				grantsTraitOnMove: { moveKey: "lead-a-sortie", trait: "defy" },
				grantsAdvantageOnMove: { moveKey: "lead-a-sortie", advantage: "advantage" },
				description:
					"<p>During any Downtime Scene, you may do the below without spending a token:</p>" +
					"<ul>" +
					"<li>Take your Astir and rush ahead: you'll lead a Sortie with +DEFY & advantage.</li>" +
					"</ul>"
			},
			{
				key: "the-impostor:resonance",
				name: "Resonance",
				// A choose-1-instead-of-rolling menu with no base stat and nothing tracked
				// afterward — same shape as Cantrips' All In or Soldier Moves' Fisher of Men, prose
				// only.
				traits: [],
				description:
					"<p>When you would weave magic to form a clear empathetic bond with another, sharing your " +
					"true feelings and clearly communicating your Hooks, choose 1 instead of rolling;</p>" +
					"<ul>" +
					"<li>Your connection lasts a single, precious moment—time for little more than a short " +
					"exchange.</li>" +
					"<li>They or someone else view it as a breach of trust or some kind of trick, and will hold " +
					"it against you.</li>" +
					"<li>You miss something important while you're together.</li>" +
					"</ul>"
			},
			{
				key: "the-impostor:let-loose",
				name: "Let Loose",
				traits: [],
				// Per-burden bonus to a player-chosen Trait (see trait-bonuses.js's chooseTrait and
				// PlaybookActorSheet's traitBonusChoosable/traitBonusChoice) — uncapped (no `max`),
				// since this move's own text explicitly overrides the usual +3 Trait ceiling.
				traitBonus: { per: "burden", chooseTrait: true },
				description:
					"<p>For every burden you have, you may increase one of your Traits by +1. The usual max of " +
					"+3 does not apply to increases earned through let loose.</p>"
			},
			{
				key: "the-impostor:bullheaded",
				name: "Bullheaded",
				// No roll — traits is empty and there are no conditions, so the sheet's `rollable`
				// flag stays false and only a Description button renders (same treatment as
				// Subsystems in SPECIAL_MOVES). Taking the risk and claiming the advantage are both
				// narrated, not rolled: the risk becomes a Danger and the advantage is picked in the
				// next roll's dialog.
				traits: [],
				description:
					"<p>You may take a risk to take advantage on your next roll. People know that you are brash " +
					"and liable to put yourself—and maybe them—in danger to get the job done.</p>"
			},
			{
				key: "the-impostor:face-to-face",
				name: "Face To Face",
				// Reuses the questionPrompts/questions rendering Read the Room/Guerrilla already use —
				// Face To Face's own 7-9 menu isn't literally a question list, but the shape (a
				// per-tier prompt plus a spend-style option list) is identical, so this rides the same
				// chat template section rather than needing one of its own. The multi-part fictional
				// consequence of a 10+/PC's own choice not to leave their Astir is narrated at the
				// table, same non-enforcement stance every other move in this module takes toward
				// fiction the dice can't resolve on their own.
				traits: ["talk"],
				questionPrompts: {
					success: "They will leave their Astir to face you.",
					mixed: "They will leave their Astir to face you, but choose one.",
					failure: null
				},
				questions: [
					"Take the risk (entangled).",
					"You have disadvantage to moves against the other Channeler.",
					"You are separated from your Astirs temporarily."
				],
				results: {
					success: "They will leave their Astir to face you. Player characters may weather the storm to " +
						"refuse.",
					mixed: null,
					failure: null
				},
				description:
					"<p>When you leave your Astir in the hopes another will do the same to meet you face to " +
					"face, roll +TALK.</p>" +
					"<p>On a 10+, They will leave their Astir to face you. Player characters may weather the " +
					"storm to refuse.</p>" +
					"<p>On a 7-9, They will leave their Astir to face you, but choose one;</p>" +
					"<ul>" +
					"<li>Take the risk (entangled).</li>" +
					"<li>You have disadvantage to moves against the other Channeler.</li>" +
					"<li>You are separated from your Astirs temporarily.</li>" +
					"</ul>" +
					"<p>Player characters may choose whether to leave their Astir or not—if they do, they pick " +
					"one of the above for you.</p>"
			},
			{
				key: "the-impostor:realignment",
				name: "Realignment",
				// A one-time, Director-collaborative swap of this move itself for another playbook's
				// move (or an invented one) — the picker already offers every other playbook's pool
				// with no enforcement of when that's appropriate (see this file's own top comment),
				// so there's nothing further to build; prose only.
				traits: [],
				description:
					"<p>You undergo deeper alteration and adjustments to your body. Discuss what it is with " +
					"your Director, and either choose a move from another playbook to represent its effects, " +
					"or work with your Director to create a new one.</p>"
			}
		]
	},
	{
		key: "the-diplomat",
		label: "The Diplomat",
		playbookName: "The Diplomat",
		moves: [
			{
				key: "the-diplomat:facilitator",
				name: "Facilitator",
				// Granted unconditionally via starting-moves.js's grantedKeys (every Diplomat starts
				// with this), so no `starting: true` — that flag is reserved for a pick-one starting
				// choice (see Field Scout/Giant Slayer), which this isn't.
				traits: [],
				// "You may read the room with +TALK" adds a trait option to Read the Room rather than
				// locking one — see PlaybookActorSheet#_moveTraits' addsTraitToMove handling, the
				// deliberate opposite of Field Scout's grantsEffectOnMove/Don't Follow Me's
				// grantsTraitOnMove (both of which only ever narrow a move's existing options).
				addsTraitToMove: { moveKey: "read-the-room", trait: "talk" },
				// A roll-less "choose 2" menu — see PlaybookActorSheet#_onMoveActivate's
				// activateChoices branch. Posts the prompt and all 3 options to chat on Activate; the
				// rulebook's "choose 2" isn't separately enforced there, same non-enforcement stance
				// every other choice list in this module takes (Guerrilla, Stir The Crowd, ...).
				activateChoices: {
					prompt: "When you set up a clandestine meeting, choose 2.",
					options: [
						"There's no risk of an ambush or interference.",
						"Third parties aren't privy to the contents of the meeting.",
						"All parties are willing to discuss in good faith."
					]
				},
				description:
					"<p>You may read the room with +TALK when mediating or taking part in a " +
					"conversation/discussion.</p>" +
					"<p>When you set up a clandestine meeting, choose 2;</p>" +
					"<ul>" +
					"<li>There's no risk of an ambush or interference.</li>" +
					"<li>Third parties aren't privy to the contents of the meeting.</li>" +
					"<li>All parties are willing to discuss in good faith.</li>" +
					"</ul>"
			},
			{
				key: "the-diplomat:sharp-tongue",
				name: "Sharp Tongue",
				// "On a roll of 12+" has no tier to hook into — moveResultTier has exactly three
				// (success/mixed/failure), the same wall Cantrips' Truth-making and Soldier Moves'
				// Indomitable already sit on (see claude.md's "systems that do not exist yet"). Prose
				// only.
				traits: [],
				description:
					"<p>When you exchange blows with +TALK, on a roll of 12+ your opponent is put in " +
					"peril.</p>"
			},
			{
				key: "the-diplomat:sharper-knives",
				name: "Sharper Knives",
				// Two things this needs don't exist: opt-in fictional advantage tied to a specific
				// fictional condition ("while attempting to remain undetected or unseen" — advantage
				// today is only ever a Dice-select choice offered uniformly on every roll, see
				// roll-effects.js) and a notion of a risk "counting as two" (risks are freeform
				// Danger-panel entries with no weighting). Prose only.
				traits: [],
				description:
					"<p>You're trained in the arts of assassination and stealth. Take advantage while " +
					"attempting to remain undetected or unseen, and being unaware of your presence " +
					"counts as two risks.</p>"
			},
			{
				key: "the-diplomat:stir-the-crowd",
				name: "Stir The Crowd",
				// Same questionPrompts/questions shape as Guerrilla/Face To Face — a per-tier prompt
				// plus an option list, rendered through the chat template's existing questions section
				// rather than needing one of its own.
				traits: ["talk"],
				questionPrompts: {
					success: "Choose 1.",
					mixed: "Choose 2, or let your Director choose 1.",
					failure: null
				},
				questions: [
					"It takes a tragedy to truly galvanise people.",
					"In doing so, you become known and targeted.",
					"You have no control or influence over any acts of protest.",
					"You are unable to spark wider resistance than the local area."
				],
				results: { success: null, mixed: null, failure: null },
				description:
					"<p>When you attempt to inspire dissent against the Authority, roll +TALK. On a 10+, " +
					"choose 1. On a 7-9, choose 2, or let your Director choose 1.</p>" +
					"<ul>" +
					"<li>It takes a tragedy to truly galvanise people.</li>" +
					"<li>In doing so, you become known and targeted.</li>" +
					"<li>You have no control or influence over any acts of protest.</li>" +
					"<li>You are unable to spark wider resistance than the local area.</li>" +
					"</ul>"
			},
			{
				key: "the-diplomat:bureaucrat",
				name: "Bureaucrat",
				// A "choose 2, even on a fail" menu with no roll of its own — the move text piggybacks
				// on exchanging blows with +TALK, but the choice itself isn't conditioned on that
				// roll's result (it applies "even on a fail"), so this is its own Activate button
				// rather than something threaded into Exchange Blows' own chat card.
				traits: [],
				activateChoices: {
					prompt: "When you exchange blows with +TALK to slow someone down or distract them " +
						"with regulations, bylaws, or whatever piece of red tape you can think of, you " +
						"also choose two from the below even on a fail.",
					options: [
						"You're not lying—they'll really be in trouble if they don't listen to you.",
						"They're invested in what you're saying: act in confidence against them for the " +
							"rest of the Scene.",
						"They won't remember or recognise you.",
						"You don't need to take a risk."
					]
				},
				description:
					"<p>When you would exchange blows with +TALK to slow someone down or distract them " +
					"with regulations, bylaws, or whatever piece of red tape you can think of, you also " +
					"choose two from the below even on a fail.</p>" +
					"<ul>" +
					"<li>You're not lying—they'll really be in trouble if they don't listen to you.</li>" +
					"<li>They're invested in what you're saying: act in confidence against them for the " +
					"rest of the Scene.</li>" +
					"<li>They won't remember or recognise you.</li>" +
					"<li>You don't need to take a risk.</li>" +
					"</ul>"
			},
			{
				key: "the-diplomat:irrefutable",
				name: "Irrefutable",
				// A flat, roll-less hold grant like B-Plot/Hot-blooded — "when you argue or advocate...
				// with hard evidence" isn't a tracked trigger anywhere in this module, so Activate is
				// the player's own call for when that's happened. No `period`: nothing in this move's
				// text scopes the hold to a Sortie or Scene, same treatment as Path-finding/Hot-blooded.
				// HOLD_MAX is already exactly 3 (see playbook-actor-sheet.js), so "when you reach 3
				// hold" caps itself with no extra code; spending them on Strike Decisively stays manual,
				// same as every other flatHold move's spend text.
				traits: [],
				flatHold: 1,
				description:
					"<p>When you argue or advocate for something and back up your point of view with hard " +
					"evidence or facts, hold 1. When you reach 3 hold, you may spend them to strike " +
					"decisively with +TALK against someone who isn't defenceless.</p>"
			},
			{
				key: "the-diplomat:connected",
				name: "Connected",
				traits: ["talk"],
				results: {
					success: "You're familiar with them, and you may choose whether their view of you is " +
						"positive or negative.",
					mixed: "As previous, but the Director decides how they think of you.",
					failure: "Things are bad: act in desperation against them for the rest of the Scene."
				},
				description:
					"<p>When you meet someone of note, roll +TALK. On a 10+, you're familiar with them, and " +
					"you may choose whether their view of you is positive or negative. On a 7-9, as " +
					"previous, but the Director decides how they think of you. On a 6-, things are bad: " +
					"act in desperation against them for the rest of the Scene.</p>"
			},
			{
				key: "the-diplomat:shree-klime",
				name: "Shree Klime",
				// A roll-less "secure 2 of 3" Downtime menu — same activateChoices treatment as
				// Facilitator/Bureaucrat above. The alias/disguise-belief text ahead of the list has no
				// mechanical hook (nothing tracks NPC belief or identity checks anywhere in this
				// module) and stays prose, per claude.md's "systems that do not exist yet".
				traits: [],
				activateChoices: {
					prompt: "During Downtime, instead of the usual benefit for a Scene, you may secure 2 " +
						"of the following.",
					options: [
						"You have ID that is either legitimate or so well faked it is impossible for " +
							"anyone short of an expert to tell the difference.",
						"There's a reason or expectation for someone fitting your disguise to show up.",
						"You've had something useful planted ahead of time—select a weapon or piece of " +
							"equipment (one you have access to) to be hidden just where you'll need it."
					]
				},
				description:
					"<p>During Downtime, you may also prepare an alias or disguise. Most people will " +
					"believe you are who you say you are, unless you're disguised as someone they're very " +
					"familiar with, or they are given reason to thoroughly check your person or any " +
					"identification. During Downtime, instead of the usual benefit for a Scene, you may " +
					"secure 2 of the following;</p>" +
					"<ul>" +
					"<li>You have ID that is either legitimate or so well faked it is impossible for " +
					"anyone short of an expert to tell the difference.</li>" +
					"<li>There's a reason or expectation for someone fitting your disguise to show up.</li>" +
					"<li>You've had something useful planted ahead of time—select a weapon or piece of " +
					"equipment (one you have access to) to be hidden just where you'll need it.</li>" +
					"</ul>"
			}
		]
	},
	{
		key: "the-arcanist",
		label: "The Arcanist",
		playbookName: "The Arcanist",
		moves: [
			{
				key: "the-arcanist:prepare-rituals",
				name: "Prepare Rituals",
				// Unconditionally granted ("You start with the prepare rituals move") — no `starting: true`
				// marker on the move itself. That flag is reserved for a pick-one starting choice (see
				// Field Scout/Giant Slayer's own comment, and Facilitator's identical reasoning for The
				// Diplomat) — this is a plain grantedKeys entry in starting-moves.js instead.
				traits: [],
				// The effect choice per ritual (make a move in confidence / change the Astir's approach for
				// the Sortie / a nested "hold 2, spend 1-for-1 to ignore a disadvantage" option) isn't
				// mechanically enforced — nothing in this module tracks a set of independently-configurable
				// slots like this. As a middle ground, these three checkboxes track only which of the 3
				// rituals prepared for the current Sortie have already been spent; the player narrates which
				// effect each one represents. `period: "Sortie"` ties them to the existing Refresh Sortie
				// button, the closest existing proxy for "expire when you prepare new ones."
				uses: [
					{ key: "ritual-1", label: "Ritual 1 Spent", period: "Sortie" },
					{ key: "ritual-2", label: "Ritual 2 Spent", period: "Sortie" },
					{ key: "ritual-3", label: "Ritual 3 Spent", period: "Sortie" }
				],
				description:
					"<p>Before every Sortie, you prepare a set of complex rituals to bolster your magical " +
					"potential. When someone leads a Sortie, describe to your Director 3 magical rituals you " +
					"prepare, and choose an effect for each from below. Any remaining rituals expire when you " +
					"prepare new ones.</p>" +
					"<ul>" +
					"<li>You may spend the ritual to make a specified move in confidence.</li>" +
					"<li>Your Astir's approach becomes a different one of your choosing for this Sortie.</li>" +
					"<li>Hold 2: you may spend this 1-for-1 to ignore a disadvantage.</li>" +
					"</ul>"
			},
			{
				key: "the-arcanist:adaptive-rituals",
				name: "Adaptive Rituals",
				// References re-choosing prepare rituals' own (unmodeled) effect choice — prose only, same
				// treatment claude.md's "systems that do not exist yet" gives every move like this.
				traits: [],
				description:
					"<p>When you fail a move on a 6-, you may re-choose any rituals you have remaining.</p>"
			},
			{
				key: "the-arcanist:pre-ordained",
				name: "Pre-ordained",
				// TODO: real mechanic not built — auto-swapping the kept d6 into a future roll needs a
				// hook into roll-effects.js's kept/discarded die tracking (see applyRollEffects).
				// Deliberately scoped out for now, per claude.md's "systems that do not exist yet". The
				// numericTrackers entry below is just a manual reminder of which face is currently held
				// (0 = not holding one), not an implementation of the swap itself.
				traits: [],
				numericTrackers: [
					{ key: "kept-die", label: "Kept d6", min: 0, max: 6 }
				],
				description:
					"<p>When you make a move with advantage or disadvantage, you may hold onto one unkept d6 " +
					"for the rest of the Scene. During that Scene, you may replace any rolled d6 with that kept " +
					"one. You may only keep one d6 at a time in this way, and must use it before you can keep " +
					"another.</p>"
			},
			{
				key: "the-arcanist:consult-literature",
				name: "Consult Literature",
				// A pure chargen flavor pick (1 near-perfect + 2 extensive subjects) with no mechanical
				// effect — prose only.
				traits: [],
				description:
					"<p>You have a store of books and scrolls on various subjects that you can consult for " +
					"information when given time. Choose 1 subject you have almost perfect records of, and 2 " +
					"you have extensive information on:</p>" +
					"<ul>" +
					"<li>Construct models and design</li>" +
					"<li>Magical beasts and monsters</li>" +
					"<li>Enchantment and spell-craft</li>" +
					"<li>Mundane craft and building</li>" +
					"<li>Natural flora and fauna</li>" +
					"<li>Military tactics</li>" +
					"<li>A specific nation/faction</li>" +
					"<li>General world history</li>" +
					"</ul>"
			},
			{
				key: "the-arcanist:tactical-illusions",
				name: "Tactical Illusions",
				traits: ["channel"],
				// Same questionPrompts/questions shape as Guerrilla/Stir The Crowd — a per-tier
				// prompt plus an option list, rendered through the chat template's existing questions
				// section rather than needing one of its own.
				questionPrompts: {
					success: "Choose 2 of the illusion effects below.",
					mixed: "Choose 1, but your illusions also distract an unintended audience.",
					failure: null
				},
				questions: [
					"The illusions last until you stop sustaining them (otherwise they last up to a " +
						"minute).",
					"Your illusions affect anyone you intend to perceive them, rather than a single " +
						"person.",
					"You can create illusions that affect all the senses, rather than just sight."
				],
				results: { success: null, mixed: null, failure: null },
				description:
					"<p>When you distract your foes with magic, roll +CHANNEL. On a 10+, choose 2. On a 7-9, " +
					"choose 1, but your illusions also distract an unintended audience.</p>" +
					"<ul>" +
					"<li>The illusions last until you stop sustaining them (otherwise they last up to a " +
					"minute).</li>" +
					"<li>Your illusions affect anyone you intend to perceive them, rather than a single " +
					"person.</li>" +
					"<li>You can create illusions that affect all the senses, rather than just sight.</li>" +
					"</ul>"
			},
			{
				key: "the-arcanist:identify",
				name: "Identify",
				// References spending 1 hold from read-the-room (a basic move's own shared hold pool,
				// already spendable via the existing hold stepper) to grant Advantage on a specific future
				// task — cross-move hold consumption for a purpose like this isn't generalized anywhere in
				// this module (contrast grantsAutomaticSuccess, which is specifically an auto-succeed
				// offer). The player spends Read the Room's hold and applies Advantage manually via the
				// roll dialog's own Dice select, same as New Perspective's identical non-enforcement.
				traits: [],
				description:
					"<p>You may spend 1 hold from read the room to identify an Astir, learning its approach, " +
					"source and general capabilities. When attempting to recreate elements of an identified " +
					"Astir or help someone else do the same, take advantage.</p>"
			},
			{
				key: "the-arcanist:reshape",
				name: "Reshape",
				// Rolls the same trait and carries the same 7-9 consequence as the basic move Weave Magic
				// (moves.js) — confirmed directly with the design owner, since the sourcebook excerpt for
				// this move didn't restate the trait. "Hold 2" (not tiered by success/mixed in the source
				// text) is modeled via the existing roll-tiered separateHold mechanism (see Mobility in this
				// same file for the precedent), granting 2 hold on both success and mixed.
				traits: ["channel"],
				hold: { success: 2, mixed: 2, failure: 0 },
				separateHold: true,
				results: {
					success: "You manage to channel power the way you desired without ill effect.",
					mixed: "You succeed, but your invocation is twisted in an unexpected and dangerous way.",
					failure: null
				},
				description:
					"<p>When you weave magic to reshape a battlefield to your liking, roll +CHANNEL — the same " +
					"roll and 7-9 consequence as weave magic.</p>" +
					"<p>Hold 2. You may spend your hold 1-for-1 to do the following;</p>" +
					"<ul>" +
					"<li>Prevent a foe from leaving the battlefield.</li>" +
					"<li>Delay others from joining the battle.</li>" +
					"<li>Provide someone with the cover they need to cool off.</li>" +
					"<li>Create a spectacle that will be difficult to suppress or cover up.</li>" +
					"</ul>"
			},
			{
				key: "the-arcanist:transmute-self",
				name: "Transmute Self",
				// This module has no chargen stat-priority/array system to model "select two more sets of
				// Trait values" against — every playbook starts all five Traits at 0, hand-entered directly
				// on the sheet (see claude.md). As a middle ground (confirmed with the design owner), two
				// generic clamped counters (-3 to +3) stand in for the two alternate sets — see the new
				// `numericTrackers` move field/mechanic below. The player records each alternate set's full
				// Trait values in Notes; these trackers are just an at-a-glance reminder of the currently
				// active set's key modifier. Swapping itself, and updating the real Traits panel value,
				// stays a manual, narrated action.
				traits: [],
				numericTrackers: [
					{ key: "set-1", label: "Alternate Set 1", min: -3, max: 3 },
					{ key: "set-2", label: "Alternate Set 2", min: -3, max: 3 }
				],
				description:
					"<p>Arcanists are well-educated in many things, and the good ones learn to augment their " +
					"natural abilities to better suit different situations—or just to pursue different " +
					"interests. You may select two more sets of Trait values, using the same conditions used " +
					"during character creation. With a magical flourish you swap between any of these sets of " +
					"Traits—though doing it under pressure or unnoticed might require a move.</p>" +
					"<p>When you increase a Trait as an advancement, apply this to your transmute self Traits " +
					"too.</p>" +
					"<p>Record each alternate set's full Trait values in your Notes; the two trackers below " +
					"are a quick reminder of which set is currently active and its key modifier.</p>"
			},
			{
				key: "the-arcanist:new-perspective",
				name: "New Perspective",
				// "Read the room with confidence & advantage" needs no new plumbing — the player sets those
				// two states themselves in the roll dialog before rolling Read the Room, same as any other
				// move referencing a specific Effect/Advantage combination elsewhere in this module.
				traits: [],
				description:
					"<p>When you are put in peril, you may read the room with confidence & advantage in " +
					"response.</p>"
			}
		]
	},
	{
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
				// a 10+ rather than one" is prose only: risk-clearing isn't a counted mechanic anywhere in
				// this module (Dangers are a freeform panel, not a tally), and bite-the-dust's own
				// results.success text (moves.js) is deliberately left untouched by this move.
				traits: [],
				addsTraitToMove: { moveKey: "bite-the-dust", trait: "channel" },
				description:
					"<p>By divine decree you become something beyond the person you were. You may bite the " +
					"dust with +CHANNEL, and clear all risks on a 10+ rather than one.</p>"
			}
		]
	},
	{
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
					"<p>If you complete it, you may choose your boons instead of rolling next time, using the " +
					"\"Choose 2 Boons\" button in the Patron section. If you don't, give your patron 1 " +
					"Influence.</p>"
			},
			{
				key: "the-witch:embrace-chaos",
				name: "Embrace Chaos",
				// Retroactively converting an already-rolled 10+ into a banked 7-9, later spent to upgrade a
				// *different* move's result tier (or flip a disadvantage to an advantage), isn't modeled
				// anywhere in this module — the closest existing shape, a move's own tiered `hold`, only ever
				// grants hold as a consequence of the tier actually rolled, it can't rewrite that tier after
				// the fact or bank a choice to spend later against an unrelated roll. Prose only, per
				// claude.md's "systems that do not exist yet".
				traits: [],
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
				// (see claude.md's "systems that do not exist yet" — weapon tags/profiles). Prose only;
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
					"part and losing the peril. You cannot re-roll relinquished boons.</p>" +
					"<p>Clear your boons yourself with the \"Relinquish Boons\" button in the Patron section " +
					"— fixing the part and removing the peril are narrated at the table.</p>"
			},
			{
				key: "the-witch:bearer-of-curses",
				name: "Bearer Of Curses",
				// Pure fiction — no roll, no tracked resource, and the three options are adjudicated at the
				// table (whether someone can use subsystems, a lasting mark, advantage on a future move
				// against them) rather than posted as a chat prompt, unlike Facilitator/Bureaucrat's own
				// activateChoices menus.
				traits: [],
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
				// definition). Prose only, per claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>When you request help from your patron, roll +CHANNEL and give your patron 1 " +
					"Influence. On a 10+, hold 3. On a 7-9, hold 1, or be in peril and hold 3.</p>" +
					"<p>You may spend your hold at any point during the Sortie 1-for-1 to use any boon you " +
					"don't currently have, or you may spend 2 hold to make any move from another playbook.</p>"
			}
		]
	},
	{
		key: "the-wither",
		label: "The Wither",
		playbookName: "The Wither",
		moves: [
			{
				key: "the-wither:born-to-die",
				name: "Born To Die",
				// Unconditionally granted (see starting-moves.js's grantedKeys) — mirrors Tenets/Prepare
				// Rituals/Patron's own unconditional-grant treatment, no `starting: true` marker needed on
				// the move itself.
				traits: [],
				// Prose only — subsystems (moves.js SPECIAL_MOVES) has no enforced Power-spend mechanic to
				// override today (traits: [], no flatHold), so there's nothing here to hook a "risk instead
				// of Power" override into. See claude.md's "systems that do not exist yet".
				description:
					"<p>You may use the subsystems move by taking a risk instead of spending Power.</p>"
			},
			{
				key: "the-wither:dark-rebirth",
				name: "Dark Rebirth",
				traits: [],
				// A new variant of the existing grantsAutomaticSuccess mechanism (Hot-blooded/Once the War's
				// Over/The Arity Method): instead of spending this move's own hold/uses pool, the "cost" is
				// adding a Danger of type peril to the actor, gated on the actor currently holding zero
				// peril-type Dangers (see PlaybookActorSheet#_availableAutomaticSuccess). Scoped to
				// bite-the-dust only, same `moves` restriction The Arity Method already uses.
				grantsAutomaticSuccess: { moves: ["bite-the-dust"], costsPeril: true },
				description:
					"<p>If you are forced to bite the dust and have no perils, you may put yourself in peril to " +
					"succeed as if you rolled a 10+. Say what dark rite or power saves you.</p>"
			},
			{
				key: "the-wither:number-of-the-beast",
				name: "Number Of The Beast",
				traits: [],
				// A standing effect on every roll this actor makes (see moves.js#explodeSixes and
				// PlaybookActorSheet#_hasExplodingSixes), not scoped to one target move key — the same
				// "actor-wide, not move-scoped" shape Cold Company's own grantsHauntedStandingRoll needs
				// below, rather than the single-move grantsAdvantageOnMove/grantsEffectOnMove/
				// addsTraitToMove trio.
				grantsExplodingSixes: true,
				description:
					"<p>Whenever you roll a 6, roll an additional die and add it to the total for that roll. " +
					"If you ever roll three 6's during one move, you are killed in a spectacular fashion at " +
					"the nearest suitable moment.</p>"
			},
			{
				key: "the-wither:cold-company",
				name: "Cold Company",
				traits: [],
				// Reuses the existing generic `uses` checkbox (system.attributes.moveUses.<key>.dispelled),
				// rendered and manually toggleable via the existing _onMoveUseToggle handler with zero new
				// code — but also read/written automatically: see PlaybookActorSheet#_coldCompanyAdvantage
				// (every roll's Dice-select lock) and #_onMoveResolved (auto-flip on 10+/6-).
				uses: [{
					key: "dispelled",
					label: "Dispelled"
				}],
				grantsHauntedStandingRoll: { useKey: "dispelled" },
				description:
					"<p>You are constantly followed by one or more spectres/ghosts/ghouls from your past. " +
					"Make all rolls with disadvantage until you succeed on a move with a 10+ (dispels the " +
					"haunting for a while: roll with advantage until you fail on a move with a 6-, at which " +
					"point disadvantage returns and the cycle begins anew).</p>"
			},
			{
				key: "the-wither:the-old-blood",
				name: "The Old Blood",
				traits: [],
				// Real: +CHANNEL becomes an offered rollable trait on Exchange Blows/Strike Decisively,
				// additive not replacing — same addsTraitToMove shape Turn Unearthly (the-paradigm:
				// turn-unearthly) uses, but gated `requiresUnmounted: true` since this move's own text
				// ("if you are outside your Astir and fighting on foot") restricts the grant to when no
				// frame is mounted, unlike Turn Unearthly's unconditional text. Resolved generically by
				// moves-mixin.js#_moveTraits (no new code needed beyond this declaration).
				addsTraitToMove: {
					moveKeys: ["exchange-blows", "strike-decisively"],
					trait: "channel",
					requiresUnmounted: true
				},
				description:
					"<p>If you are outside your Astir and fighting on foot, you can exchange blows and strike " +
					"decisively with +CHANNEL when attempting to cause physical harm. When appropriate, you will " +
					"obtain a tier I melee weapon with bane and one of the following tags of your choice: " +
					"concealable, area, impact, blitz, ruin/reloading.</p>"
				// The weapon-grant half has no grant mechanism anywhere in the codebase (Soldier's Nightmare of
				// Solomon/Field Scout/Giant Slayer all leave this manual) — player builds it via the Equipment
				// tab's configureEquipment editor, matching every existing precedent. No code needed.
			},
			{
				key: "the-wither:wretched-visage",
				name: "Wretched Visage",
				traits: [],
				description:
					"<p>Nobody can look directly at you without taking a risk, friend or foe. People shy " +
					"from your presence, and turn to avoid your gaze.</p>"
			},
			{
				key: "the-wither:fresh-hells",
				name: "Fresh Hells",
				traits: [],
				description:
					"<p>When you weave magic to terrify, sicken or disgust, you can affect even the most jaded " +
					"or strong-willed individuals, regardless of their experience with the profane.</p>"
			},
			{
				key: "the-wither:abyssal-summons",
				name: "Abyssal Summons",
				traits: [],
				description:
					"<p>When you weave magic, you are capable of disrupting that which anchors us in place and " +
					"time, and can reach out to wrest a person free of their current location and conjure them " +
					"to yours, regardless of distance. To do so, you must either have a strong bond with them " +
					"(i.e a GRAVITY clock), possession of something of deep personal importance to them, or for " +
					"them to have a peril you have inflicted.</p>"
			},
			{
				key: "the-wither:dark-guarantees",
				name: "Dark Guarantees",
				// "Act with confidence and advantage on that move" has no roll to hook into: both born-to-die
				// (this same pool, above) and the subsystems move it triggers are traits: [] with no results
				// or flatHold — neither is ever rollable, so there is no move-roll for roll-effects.js to lock
				// Confidence/Advantage onto. "Take a peril instead of a risk" needs no code either — Dangers
				// are already manually typed risk/peril by the player (tracking-mixin.js). Stays descriptive,
				// see claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>When you use born to die, you may take a peril instead of a risk. If you do, act with " +
					"confidence and advantage on that move.</p>"
			}
		]
	},
	{
		key: "the-adrift",
		label: "The Adrift",
		playbookName: "The Adrift",
		moves: [
			{
				key: "the-adrift:love-love-love",
				name: "Love, Love, Love",
				traits: [],
				// Drives the generic HOME-instead-of-CHANNEL substitution in moves-mixin.js's _moveTraits —
				// see that file's own comment for the full mechanic. Gated on this specific move being picked
				// (not on playbook slug), per claude.md's "a flag read generically across all actors must
				// still verify the acting actor has actually picked the move that grants it" caution.
				grantsHomeInsteadOfChannel: true,
				description:
					"<p>Instead of a +CHANNEL trait, you have an additional GRAVITY clock with wherever (and/or " +
					"whenever) you came from. It is treated as your +CHANNEL trait in all circumstances, and " +
					"referred to as +HOME. It starts at +1.</p>"
			},
			{
				key: "the-adrift:snakes-in-the-grass",
				name: "Snakes In The Grass",
				// The "hold 1" resource itself is a plain flatHold pool like B-Plot's own (Activate adds 1,
				// plus the usual manual stepper) — "make your next move with advantage" is the one piece
				// this module can't mechanize (a bank-for-next-roll system — roll-modifier stacking, see
				// claude.md's "systems that do not exist yet"), and the payoff at 3 hold is a Director-
				// facing narrative beat, not something the player spends. Both stay prose in the
				// description; only the counter itself is tracked.
				traits: [],
				flatHold: 1,
				description:
					"<p>When you are cowed or guilted into something you have no stake in, hold 1 and make your " +
					"next move with advantage. Once you have 3 hold, the Authority or another third party will " +
					"soon reach out to you with an unexpected offer or request.</p>"
			},
			{
				key: "the-adrift:walk-on-part-in-the-war",
				name: "Walk-on Part In The War",
				traits: [],
				// "While piloting your Astir" — requiresAstirMounted mirrors The Old Blood's own
				// requiresUnmounted (see moves-mixin.js's addsTraitToMove resolution), but the opposite
				// polarity and specifically the Astir, not any mounted frame: an Ardent doesn't count,
				// since this move's text names the Astir by name, not "your frame" generically.
				addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "home", requiresAstirMounted: true },
				// Nothing in this module auto-applies a roll consequence beyond writing hold (see
				// claude.md's "Manual trackers, not enforcement") — Overheating is always a checkbox the
				// player ticks by hand. Rather than leave the reminder only in this move's own
				// description (easy to miss, since this move is never itself rolled), it also surfaces on
				// Exchange Blows/Strike Decisively's own chat card on a 6- — see moves-mixin.js's
				// _grantedFailureReminderForMove and moves.js#rollMove's extraFailureReminder handling.
				// Same requiresAstirMounted gate as the trait grant above — no reminder to tick a box
				// that was never offered as an option in the first place.
				addsFailureReminderToMove: {
					moveKeys: ["exchange-blows", "strike-decisively"],
					reminder: "Tick 'overheating' on your Astir",
					requiresAstirMounted: true
				},
				description:
					"<p>You can exchange blows and strike decisively with +HOME when attempting to cause physical " +
					"harm while piloting your Astir. On a 6-, tick 'overheating' on your Astir in addition to any " +
					"other consequences.</p>"
			},
			{
				key: "the-adrift:lead-role-in-a-cage",
				name: "Lead Role In A Cage",
				traits: [],
				// "Roll with +HOME instead of the listed traits" reads like a hard lock, but the trigger
				// ("when you're pressured into leading a Sortie") is a fictional judgment call, not every
				// Lead a Sortie roll — so this only makes +HOME available as an option (unlike Don't Follow
				// Me's real DEFY grant, which locks unconditionally because its own trigger, a Downtime
				// Scene, has no in-between case to leave up to the table). "Home" isn't offered on Lead a
				// Sortie at all until this move adds it (see moves-mixin.js's _moveTraits).
				addsTraitToMove: { moveKey: "lead-a-sortie", trait: "home" },
				description:
					"<p>When you're pressured into leading a Sortie, roll with +HOME instead of the listed " +
					"traits.</p>"
			},
			{
				key: "the-adrift:wish-you-were-here",
				// Downtime Scenes aren't modeled anywhere in this module (see the-impostor:troublemaker's own
				// comment). Clearing a Peril and advancing the Home clock are both already manual sheet
				// controls (Dangers' own remove button, the Home clock's own progress-step control) — nothing
				// new needed here.
				name: "Wish You Were Here",
				traits: [],
				description:
					"<p>You may spend Social Space Or Private Quarters scenes alone during Downtime, " +
					"contemplating your home and the people you left behind. When you do so, you may clear a " +
					"peril from yourself instead of another, and advance your HOME clock.</p>"
			},
			{
				key: "the-adrift:if-i-go-there-will-be-trouble",
				name: "If I Go There Will Be Trouble",
				traits: [],
				description:
					"<p>You have decided to stay, no matter what. Swap to a new playbook, and take an extra move " +
					"in addition to those you should start with. You may also rewrite as many of your Hooks as " +
					"you want.</p>"
			},
			{
				key: "the-adrift:if-i-stay-it-will-be-double",
				name: "If I Stay It Will Be Double",
				// Unlike Field Scout's grantsEffectOnMove (a single named move key), this triggers on a
				// fictional judgment call ("act selfishly in pursuit of return home") that could apply to any
				// roll — nothing in this module can detect that condition. Prose only.
				traits: [],
				description:
					"<p>You are resigned to leaving, no matter what. When you act selfishly in pursuit of your " +
					"permanent return home, do so with confidence.</p>"
			},
			{
				key: "the-adrift:draw-your-bath-and-load-your-gun",
				name: "Draw Your Bath And Load Your Gun",
				// Deliberately traits: [] rather than ["home"] — "home" is not a real TRAITS key, and an
				// existing generic test (tests/playbook-moves.test.js) asserts every playbook move's own
				// traits array only ever names real TRAITS keys. Self-targeting addsTraitToMove reuses the
				// exact same generic HOME-injection machinery instead (see moves-mixin.js's _moveTraits).
				traits: [],
				addsTraitToMove: { moveKey: "the-adrift:draw-your-bath-and-load-your-gun", trait: "home" },
				results: {
					success: "You are able to keep up with any obligations or duties from your old life " +
						"smoothly: gain +1 Spotlight.",
					mixed: "You are able to keep up, but people grow more suspicious about your strange " +
						"absences: start or advance a 6-step clock titled 'Someone Else Gets Involved'.",
					failure: null
				},
				description:
					"<p>You have some method of travelling or returning back to where you came from temporarily. " +
					"You may spend your Downtimes there, away from the party.</p>" +
					"<p>When you do so, also roll +HOME.</p>"
			},
			{
				key: "the-adrift:hope-so-bad-that-youll-bathe-and-hunt",
				name: "Hope So Bad That You'll Bathe And Hunt",
				// Affects another actor's future roll based on this actor's own action — nothing in this
				// module can reach across actors that way (every grantsEffectOnMove/grantsTraitOnMove/
				// grantsAdvantageOnMove/addsTraitToMove flag above only ever locks the *acting* actor's own
				// next roll). Prose only, per claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>When you clear a peril from another character or their Astir, they make their next bite " +
					"the dust with either confidence or desperation: their choice, at the time.</p>"
			}
		]
	},
	{
		key: "the-advocate",
		label: "The Advocate",
		playbookName: "The Advocate",
		moves: [
			{
				key: "the-advocate:earthly-ally",
				name: "Earthly Ally",
				// Earthly Ally and Titanic are alternate identities ("pick either"), not merely
				// alternate skill picks — exclusiveGroup keeps both the "+" picker and the Astir's own
				// bonus-move picker from ever offering the sibling once one is picked (see
				// pickerSection in this file). The chargen picker already enforces this via
				// pickOneKeys (starting-moves.js); this closes the same gap in every other picker
				// drawing from this pool.
				exclusiveGroup: "the-advocate:starting-move",
				// The location-conditional CHANNEL variance ("+1 in areas where nature has been destroyed,
				// +3 in areas of unmarked natural beauty") can't be mechanized — there's no location-state
				// system anywhere in this module (see claude.md's "systems that do not exist yet"). Prose only.
				traits: [],
				description:
					"<p>You are person-sized, and pilot an Astir as usual—though your Astir is likely a " +
					"natural work, grown through magical rituals or built using sustainable materials. Your " +
					"CHANNEL is treated as +1 in areas where nature has been destroyed, and +3 in areas of " +
					"unmarked natural beauty. When you teach someone a truth about the natural world, advance " +
					"a GRAVITY clock if you have one with them.</p>"
			},
			{
				key: "the-advocate:titanic",
				name: "Titanic",
				exclusiveGroup: "the-advocate:starting-move",
				traits: [],
				// "You may use subsystems even while not in your Astir form" needs zero code: subsystems
				// (moves.js SPECIAL_MOVES) is never gated on the mounted frame at all — only the Astir Moves
				// group (Parts + the Astir's own unique Move) forces `gated: mountedFrame?.id !== "astir"`
				// in getData, and the per-Part Expended `uses` checkbox in playbook-actor-sheet.hbs
				// (.move-use-checkbox) renders with no gated/disabled binding regardless of mounted state.
				// This clause is already true today with no changes needed anywhere.
				description:
					"<p>You yourself are a force of nature, capable of taking a form as mighty as any dragon, " +
					"giant or war machine. Your Astir is this secondary form, and you may shift between it and " +
					"whatever your usual appearance is at will. You may use subsystems even while not in your " +
					"Astir form, temporarily manifesting parts of its power. When you destroy something that " +
					"threatens nature directly, advance a GRAVITY clock with someone surprised by your power.</p>"
			},
			{
				key: "the-advocate:woodland-whispers",
				name: "Woodland Whispers",
				traits: [],
				description:
					"<p>When the world is suffering, it whispers to you. You know where it is hurting, and who " +
					"is to blame.</p>"
			},
			{
				key: "the-advocate:all-things-great-and-small",
				name: "All Things Great And Small",
				traits: [],
				description:
					"<p>You have a deep and broad knowledge of all living creatures (either through study or " +
					"your magic) and can easily identify their habitats, natural predators, food sources and " +
					"common illnesses among other things.</p>"
			},
			{
				key: "the-advocate:a-greener-world",
				name: "A Greener World",
				traits: [],
				// "12+" is a result tier above 10+, which doesn't exist in this module — moveResultTier has
				// exactly three tiers (success/mixed/failure). Per claude.md's "systems that do not exist
				// yet", this stays descriptive.
				description:
					"<p>When you roll +CHANNEL and get a result of 12+, new flora and fauna starts to spring " +
					"to life in the area, even in ruined places. Wildlife that had been forced out begins to " +
					"return, and infertile ground is made fertile once again.</p>"
			},
			{
				key: "the-advocate:built-different",
				name: "Built Different",
				traits: [],
				// The "Requires: Titanic" prerequisite is unenforced, consistent with every other
				// move-level prerequisite in this module. "You become tier IV" needs no mechanic either —
				// Tier is already a freely player-editable field within the Astir's existing 3-4 range
				// (ASTIR_TIER_MIN/ASTIR_TIER_MAX in astir.js already allow 4) — this move just narrates
				// picking the top of that existing range.
				description:
					"<p>Your Astir-sized form is your only one: you have no other shape you can take. This is " +
					"inconvenient in many situations, on account of you being very very large. As a " +
					"trade-off, you become tier IV.</p>"
			},
			{
				key: "the-advocate:natures-bounty",
				name: "Nature's Bounty",
				traits: ["channel"],
				results: {
					success: "Everyone gains an additional token during the next Downtime if they spend it " +
						"here.",
					mixed: "As above, but you must either give up leading a Scene yourself, or your usual 2 " +
						"tokens.",
					failure: null
				},
				description:
					"<p>When you imbue a place with life, using your connections to the natural world to " +
					"support and bolster it, roll +CHANNEL.</p>" +
					"<p>On a 10+, everyone gains an additional token during the next Downtime if they spend " +
					"it here. On a 7-9, as above, but you must either give up;</p>" +
					"<ul>" +
					"<li>Leading a Scene yourself.</li>" +
					"<li>Your usual 2 tokens.</li>" +
					"</ul>" +
					"<p>You may freely roll this before Downtime begins if you don't get chance to during the " +
					"Sortie, though your Director might impose disadvantage, desperation, or even rule that " +
					"the move is impossible based on your location. It's hard to invoke the life and force of " +
					"nature in the middle of a completely man-made structure, for example.</p>"
			},
			{
				key: "the-advocate:chimaeric",
				name: "Chimaeric",
				traits: [],
				// No creature-shapeshifting/"form" tracking system exists anywhere in this module (see
				// claude.md's "systems that do not exist yet"). The Titanic branch's "choose a Part or
				// Weapon to take as an Extra every Sortie" needs no new mechanism either — Astir Parts/
				// Weapons are already freely added/removed at any time via the existing Astir tab controls,
				// with no per-Sortie cap to swap around (unlike Ardents' own ARDENT_MAX_LOADOUT — the Astir
				// itself has no such cap, per astir.js and the Astir mixin). Prose only.
				description:
					"<p>You are able to freely invoke and weave together the power of different parts of " +
					"nature. If you have Earthly Ally, you may temporarily take the form of any creature you " +
					"have seen (though you must weave magic to turn into something notably larger than " +
					"yourself). Being put in peril undoes your shapeshifting. If you have Titanic, your " +
					"secondary form becomes mutable: you may choose a Part or Weapon to take as an Extra " +
					"every Sortie. You may choose a different one every time.</p>"
			},
			{
				key: "the-advocate:lay-down-roots",
				name: "Lay Down Roots",
				traits: [],
				// No death/incapacitation system exists anywhere in this module — "when you die" is
				// narrative flavor text describing what happens, the same treatment the-wither:
				// number-of-the-beast's own "killed in a spectacular fashion" text gets above (see
				// claude.md's "systems that do not exist yet"). The "Requires: Nature's Bounty"
				// prerequisite is unenforced, like every other move-level prerequisite in this module.
				description:
					"<p>When you die, you become one with the earth. Life springs forth in the brightest of " +
					"hues, flourishing in your wake: nature's bounty applies permanently here, and can never " +
					"be undone or removed.</p>"
			}
		]
	},
	{
		key: "the-revenant",
		label: "The Revenant",
		playbookName: "The Revenant",
		moves: [
			{
				key: "the-revenant:never-quite-free",
				name: "Never Quite Free",
				// Unconditionally granted (see starting-moves.js's grantedKeys) — same no-`starting`-
				// marker-needed treatment every other unconditional starting move gets.
				traits: ["channel"],
				// "This move replaces bite the dust for you" is now mechanically enforced via
				// disablesMove: picking this move disables bite-the-dust's Roll button (see
				// moves-mixin.js's _moveGroupMoves), rather than leaving the player expected to
				// simply not roll it. No forcesDesperationAtMaxPerils either — unlike bite-the-dust,
				// this move's own rules text never restates that clause, so it isn't backfilled here.
				// The 6- result's CHANNEL reduction and "you pass on" consequence stays prose only,
				// manually executed by the player — the same manual-tracker convention Once the War's
				// Over's identical "you will perish" text gets.
				disablesMove: { moveKey: "bite-the-dust" },
				description:
					"<p>This move replaces bite the dust for you. You have already died once, and it is " +
					"incredibly difficult to vanquish what has remained of you: when you are defenceless " +
					"or risk harm so severe it might destroy you outright, roll +CHANNEL;</p>" +
					"<p>On a 10+, your spirit lashes out at those that would try to strike you down: they " +
					"are forced to take a risk and you may clear one if you have any.</p>" +
					"<p>On a 7-9, you struggle to keep it together: take disadvantage on your next " +
					"move.</p>" +
					"<p>On a 6-, you survive at the cost of weakening your remaining tie to this world. " +
					"Reduce your CHANNEL by 1—if this would reduce it below 0, you are no longer able to " +
					"hold yourself and your Astir together. You pass on, leaving it and this world " +
					"behind.</p>",
				results: {
					success: "Your spirit lashes out at those that would try to strike you down: they " +
						"are forced to take a risk and you may clear one if you have any.",
					mixed: "You struggle to keep it together: take disadvantage on your next move.",
					failure: "You survive at the cost of weakening your remaining tie to this world. " +
						"Reduce your CHANNEL by 1—if this would reduce it below 0, you are no longer " +
						"able to hold yourself and your Astir together. You pass on, leaving it and this " +
						"world behind."
				}
			},
			{
				key: "the-revenant:unfettered",
				name: "Unfettered",
				traits: [],
				description:
					"<p>You are, broadly speaking, unaffected by toxins, diseases, hunger, thirst, or any " +
					"other typical biological or material concerns you were bound by in life. Ignore " +
					"them entirely. Additionally, any magic or device that tracks or detects the living " +
					"does not function on you, and any magic that would specifically kill rather than " +
					"causing harm that might result in death is ineffective on you also. You're already " +
					"dead.</p>"
			},
			{
				key: "the-revenant:joyride",
				name: "Joyride",
				traits: ["channel"],
				// Two consequences here have no mechanical hook and stay narrated: (a) "your old Astir
				// falls quiet and you take control of this one instead" — system.attributes.astir is a
				// hard 1:1 singleton on the actor with zero cross-actor transfer architecture, so
				// there's nowhere in the data model to move this Astir's state to; (b) "act in
				// desperation until you roll a 10+" — no "locked in Desperation until a specific future
				// roll" mechanism exists anywhere (Confidence/Desperation is a per-roll dialog choice,
				// not standing state). Both are per claude.md's "systems that do not exist yet".
				description:
					"<p>You may transfer your spectral being into another Astir. Take disadvantage if " +
					"there is already a Channeler controlling it, and roll +CHANNEL;</p>" +
					"<p>On a 10+, your old Astir falls quiet and you take control of this one instead. " +
					"Your mark transfers to it, also.</p>" +
					"<p>On a 7-9, as above, but you struggle to control this new form: act in " +
					"desperation until you roll a 10+.</p>",
				results: {
					success: "Your old Astir falls quiet and you take control of this one instead. Your " +
						"mark transfers to it, also.",
					mixed: "As above, but you struggle to control this new form: act in desperation " +
						"until you roll a 10+.",
					failure: null
				}
			},
			{
				key: "the-revenant:knower-of-ruin",
				name: "Knower Of Ruin",
				traits: [],
				description:
					"<p>When you look over the remains of a battle, you can easily piece together how it " +
					"went and who took part. You can bring forth the spirits of anyone who perished there " +
					"for a short time to talk to them, though they remember little beyond the battle " +
					"itself.</p>"
			},
			{
				key: "the-revenant:aint-no-grave",
				name: "Ain't No Grave",
				traits: [],
				// The literal rules text ("roll never quite free ... to upgrade THAT [separate,
				// already-posted] result") has no precedent anywhere in this codebase — every existing
				// grantsAutomaticSuccess source only ever flags the *current* roll, never a different,
				// earlier one already posted to chat (see claude.md's "systems that do not exist
				// yet"). Confirmed with the design owner: rather than build that, this reuses
				// grantsAutomaticSuccess as an offer on the *current* roll of any other qualifying
				// move, spending nothing — no hold/uses/peril, since the source object below carries
				// none of `cost`/`useKey`/`costsPeril` (see _availableAutomaticSuccess's costless
				// fallback branch). The move's own precondition ("you separately rolled never quite
				// free in desperation") is a manual, self-enforced narrative requirement the player
				// handles before clicking, the same non-enforcement stance every other unmodeled
				// precondition in this module already takes. excludeMoves keeps the offer from ever
				// applying to Never Quite Free's own roll, since upgrading that roll with itself makes
				// no sense.
				grantsAutomaticSuccess: { excludeMoves: ["the-revenant:never-quite-free"] },
				description:
					"<p>When you make a move (other than never quite free) and roll a 6-, you may roll " +
					"never quite free in desperation to, regardless of outcome, upgrade that result to a " +
					"10+.</p>"
			},
			{
				key: "the-revenant:ravenous-spectre",
				name: "Ravenous Spectre",
				traits: [],
				// A deferred, one-shot Advantage grant consumed by a future cool-off roll has no
				// precedent (the existing grantsAdvantageOnMove family is a standing/permanent lock, not
				// single-use), and "causing a living being to be in peril" isn't tracked actor state
				// anywhere. Left descriptive per claude.md's "systems that do not exist yet"; apply
				// Advantage by hand via the roll dialog's own Dice select when it comes up.
				description:
					"<p>When you cause a living being to be in peril, take advantage when you next cool " +
					"off as you draw momentum or vigour from them.</p>"
			},
			{
				key: "the-revenant:i-know-you",
				name: "I Know You",
				traits: [],
				// "Roll +3" with no trait/stat selection — a hardcoded fixedTraits entry, the same
				// shape Lead a Sortie's own CREW uses (moves.js), except the static value here is a
				// placeholder: grantsFamiliarityTrait (below) makes it a real actor stat instead,
				// overridden dynamically the same way CREW's own static entry is (see
				// moves-mixin.js's _moveTraits/_familiarityValue). This is what makes the move
				// rollable at all — see moves-mixin.js's `rollable` gate, which now also checks
				// fixedTraits.length.
				//
				// grantsFamiliarityTrait adds a real "familiarity" trait row (stepper, -3..3) to the
				// Traits panel, but only while this move is picked (see progression-mixin.js's
				// _traitsData) — never folded into the shared TRAITS catalog, since that would wrongly
				// surface FAMILIARITY for every non-Revenant actor too. The described "-1 per future
				// use" diminishing bonus is now automated via that stepper: the player decrements it
				// by hand after a 10+, the same manual-tracker convention every other stepped trait
				// already follows (_onTraitStep has no dependency on the TRAITS catalog, so it works
				// for familiarity unchanged).
				grantsFamiliarityTrait: true,
				fixedTraits: [{ key: "familiarity", label: "FAMILIARITY", value: 3 }],
				description:
					"<p>At any time, you or the Director may declare that a character had some " +
					"familiarity with you before you died. Roll +3;</p>" +
					"<p>On a 10+, they were intimately familiar with you: choose one of your Hooks that " +
					"you still share. They will help you follow it where they can, unless forced to do " +
					"otherwise. Reduce the amount you add to this roll in the future by 1.</p>" +
					"<p>On a 7-9, they were loosely familiar with you: choose one of your Hooks that they " +
					"are still undecided about. They might not help you, but they will not stop you " +
					"following it unless forced to.</p>",
				results: {
					success: "They were intimately familiar with you: choose one of your Hooks that you " +
						"still share. They will help you follow it where they can, unless forced to do " +
						"otherwise. Reduce the amount you add to this roll in the future by 1.",
					mixed: "They were loosely familiar with you: choose one of your Hooks that they are " +
						"still undecided about. They might not help you, but they will not stop you " +
						"following it unless forced to.",
					failure: null
				}
			},
			{
				key: "the-revenant:ancient-recall",
				name: "Ancient Recall",
				traits: [],
				flatHold: 3,
				// Mirrors Once the War's Over's own cost-per-spend shape, restricted via The Arity
				// Method's `moves` field to exactly the two moves named in the rules text. No `period`:
				// nothing in this move's own text scopes the hold to a Sortie or Scene, so it isn't
				// cleared by either Refresh button — same treatment Hot-blooded's own hold gets. "When
				// you run out of hold, you lose this move" is a prose reminder only — nothing in this
				// codebase ever auto-revokes a picked move.
				grantsAutomaticSuccess: { cost: 1, moves: ["dispel-uncertainties", "read-the-room"] },
				description:
					"<p>Hold 3. You may spend a point of this hold to succeed on a dispel uncertainties " +
					"or a read the room as per a 10+, describing how your past life gave you familiarity " +
					"with the situation or subject at hand. When you run out of hold, you lose this " +
					"move.</p>"
			},
			{
				key: "the-revenant:rioting-souls",
				name: "Rioting Souls",
				traits: [],
				description:
					"<p>Wherever you go, vengeful spirits of the deceased rise up to join you. They can " +
					"do little by their own, but their presence is very capable of drowning out magic " +
					"used to communicate or observe/listen from a distance. They can also be directed to " +
					"act as a distraction, though they cannot do both at the same time.</p>"
			}
		]
	},
	{
		key: "the-summoner",
		label: "The Summoner",
		playbookName: "The Summoner",
		moves: [
			{
				key: "the-summoner:eidolon-drive",
				name: "Eidolon Drive",
				// This is the Summoner's Astir Move, picked like any other via the Astir tab's own "+
				// Astir Move" picker (chooseAstirMove/_onAstirMoveAdd — see astir-mixin.js), not a
				// forced grant — no playbook has ever needed a bespoke mechanism to pre-grant an Astir
				// Move, and Eidolon Drive is Summoner's only Astir-move-shaped pick anyway.
				traits: [],
				// Renders a Summon button in place of Roll/Activate (see moves-mixin.js's
				// _moveGroupMoves) — its own roll options come from whatever move the player rolls
				// next (see the unconditional eidolon-drive-ally trait push in _moveTraits), not from
				// a roll of its own.
				summonsAlly: true,
				// The "once per Scene" grant is tracked entirely via system.attributes.eidolonDrive
				// (see summoner-mixin.js's _onEidolonDriveSummon/_eidolonDrive) — its summonedAllyId/
				// bonusUsed shape, not a uses checkbox — and cleared by Refresh Scene (the real rules
				// boundary), with Refresh Sortie clearing it too as a defensive superset (see
				// frames-mixin.js). There's no uses entry for this move at all.
				description:
					"<p>This is your Astir Move—if you ever get a new Astir, it can be transferred into the " +
					"new one during Downtime, replacing any Astir Move it might have had. Once per Scene, " +
					"you may power up your eidolon drive to summon an ally from binding. When you do so, " +
					"you may immediately make a move using their approach and trait at +3. They remain by " +
					"your side for the rest of the Scene, giving you access to their trait at +1. Their " +
					"tier is equal to your Astir's.</p>"
			},
			{
				key: "the-summoner:binding",
				name: "Binding",
				// Granted unconditionally via starting-moves.js's grantedKeys (every Summoner starts
				// with this), so no `starting: true` — that flag is reserved for a pick-one starting
				// choice (see Field Scout/Giant Slayer's own comment), which this isn't.
				traits: [],
				// Renders the Bound Allies roster (Social tab — see summoner-mixin.js's
				// _boundAlliesData) once picked. A declarative flag, evaluated generically, rather
				// than a hardcoded move-key check — the same "behaviour that depends on actor state
				// goes in the sheet" pattern grantsHomeInsteadOfChannel (home-mixin.js) already
				// establishes for Adrift's own single-mandatory-move mechanic.
				grantsBoundAlliesRoster: true,
				description:
					"<p>You may magically bind powerful creatures (or groups of weaker ones) to you, " +
					"allowing you to draw them through time and space to your location to aid you " +
					"temporarily. You might do this through force, or you might acquire willing aid " +
					"through other means. However you do it, give them an amount of your Astir's Power " +
					"to perform the binding. This Power is returned 1 point at a time each time that " +
					"ally is summoned via eidolon drive, or all at once if they are released or leave " +
					"your service otherwise. Write down your ally's name, their approach, and a " +
					"trait.</p>" +
					"<p>Manage your bound allies from the Bound Allies roster on the Social tab: name, " +
					"approach, trait, and a running Power Invested total per ally, with Invest Power and " +
					"Release controls.</p>"
			},
			{
				key: "the-summoner:enduring-support",
				name: "Enduring Support",
				// "Use their approach instead of your own" — the same manual, non-enforced
				// substitution the Arcane/Divine/Elemental/Mundane/Profane equipment tags already
				// model (see equipment.js: system.attributes.approach is a single persistent field
				// with no "actively equipped" state, so a temporary override stays descriptive).
				// Prose only.
				traits: [],
				description:
					"<p>After you summon an ally with your eidolon drive, you may use their approach " +
					"instead of your own for the rest of the Sortie.</p>"
			},
			{
				key: "the-summoner:bonded-in-blood",
				name: "Bonded In Blood",
				// Taking a peril is already the existing Danger "Add" controls
				// (system.attributes.dangers), same reasoning as Cantrips' Fire-Eater/Selfless. "Act
				// with advantage on your next roll" is the grant-Advantage-to-literally-the-next-roll
				// pattern repeatedly left unmechanized elsewhere (Dark Guarantees, If I Go There Will
				// Be Trouble — both cite claude.md's "systems that do not exist yet"); applied by hand
				// at the table via the roll dialog's own Dice select. Allies "won't (or can't) abandon
				// your service" is pure fiction with no tracked state to hook — Release already
				// requires an explicit player click regardless of how an ally was bound.
				traits: [],
				description:
					"<p>You may voluntarily take a peril as part of binding an ally: this counts as an " +
					"extra 1 Power's worth of binding, on top of any you choose to give. If you do so, " +
					"make your first move after summoning them with advantage. Allies bound with bonded " +
					"in blood won't (or can't) abandon your service until all their Power is returned " +
					"point-by-point.</p>"
			},
			{
				key: "the-summoner:spritecraft",
				name: "Spritecraft",
				// Identical in shape to Commander's Withdraw ("start or advance a 4-step clock") —
				// prose only; the player manually adds a 4-step Clock via the existing Clocks section
				// (Social tab) and manages the resulting ally through the ordinary Bound Allies roster
				// once it's ready.
				traits: [],
				description:
					"<p>You may magically create allies for yourself during Downtime as long-term " +
					"projects, requiring a 4-step clock to be filled. They can only sustain themselves " +
					"for a single Sortie's worth of aid, but you may choose what approach they are, and " +
					"they reserve none of your Astir's Power.</p>"
			},
			{
				key: "the-summoner:dynamic-entry",
				name: "Dynamic Entry",
				// Conditionally applying a weapon tag (bane) to a specific triggered attack — weapon
				// tags are static, actor-authored data (see equipment.js's EQUIPMENT_TAGS), not
				// something a move can attach on the fly; no analogous mechanism exists anywhere in
				// this module. Prose only, per claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>When you summon an ally and immediately exchange blows or strike decisively via " +
					"them, that attack is considered to have the bane tag.</p>"
			},
			{
				key: "the-summoner:helping-hands",
				name: "Helping Hands",
				traits: [],
				// Renders the single-slot Downtime Ally control (Downtime tab — see
				// summoner-mixin.js's _downtimeAllyData) once picked, and raises the Downtime Tokens
				// cap by 1 while an ally is bound there (see progression-mixin.js's
				// _downtimeTokensMax) — both a declarative flag, generically evaluated, the same
				// pattern grantsBoundAlliesRoster establishes for Binding above.
				grantsDowntimeAllySlot: true,
				description:
					"<p>You may also bind an ally to help you in Downtime instead of on Sorties. When " +
					"you do so, instead of writing a trait and their approach, take +1 token during " +
					"Downtime. You may only have one ally bound to you for Downtimes, but 1 Power's " +
					"worth of binding will sustain them for as long as they are in your service.</p>"
			},
			{
				key: "the-summoner:conveyance",
				name: "Conveyance",
				// Cross-actor Astir linking/portals between two players' own Astirs — no analogous
				// mechanism exists anywhere in this module (every roll/state change is scoped to one
				// actor's own sheet). Prose only, per claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>When another Channeler lays a hand on your eidolon drive, they may link their " +
					"Astir to yours. During Downtime, or when you weave magic, you may open a portal " +
					"between your Astirs. If you wove magic to do this, it closes at the end of the " +
					"Scene or potentially earlier as a consequence of another move.</p>"
			},
			{
				key: "the-summoner:living-drive",
				name: "Living Drive",
				traits: [],
				// "You may use it outside of an Astir" — ungates Eidolon Drive's Summon button (and
				// Roll/Activate generally, were it ever to gain one) from the Astir Moves group's
				// mounted-frame check specifically (see moves-mixin.js's
				// _grantsUnpilotedAstirMove/_movesData). The rest of the text needs no code: bound
				// allies already always display the Astir's own tier regardless of piloted state (see
				// _moveTraits' unconditional eidolon-drive-ally push), and this character's own
				// on-foot Tier already defaults to tier I with nothing here that would raise it.
				grantsUnpilotedAstirMove: { moveKey: "the-summoner:eidolon-drive" },
				description:
					"<p>You are your eidolon drive. You may use it outside of an Astir, and your " +
					"binding allies are still considered to be the same tier as your Astir: though you " +
					"yourself are tier I as usual. If you have the conveyance move, you may open a " +
					"portal between an Astir and you.</p>"
			}
		]
	},
	{
		key: "the-icon",
		label: "The Icon",
		playbookName: "The Icon",
		moves: [
			{
				key: "the-icon:performance",
				name: "Performance",
				// Unconditionally granted (see starting-moves.js's grantedKeys) — same no-`starting`-
				// marker-needed treatment every other unconditional starting move gets.
				//
				// "This move replaces b-plot for you" is table/fiction guidance only — same treatment
				// Never Quite Free's own "replaces bite the dust" text gets (playbook-moves.js's
				// the-revenant pool above): b-plot stays rollable/activatable on the sheet as normal, an
				// Icon player is simply expected not to use it. The three spend options are all narrated
				// consequences with nothing in this codebase to hook into (one actor's move affecting
				// another actor's already-made roll, Hooks as tracked data, a "distracted/interrupted"
				// status) — per claude.md's "systems that do not exist yet", only the flatHold pool
				// itself is coded; the spends stay prose.
				traits: [],
				flatHold: 3,
				description:
					"<p>This move replaces b-plot for you. When you lead a grand performance rather than " +
					"being directly involved in a Sortie — broadcast far and wide through magical means — " +
					"name one or two actors that attend in person, and hold 3. During the Sortie, you may " +
					"spend it 1-for-1 to do the following;</p>" +
					"<ul>" +
					"<li>Increase another player's level of success on a move one step, before or after " +
					"they roll.</li>" +
					"<li>Name an actor present—they are deeply affected by your performance, either " +
					"taking one of your Hooks to heart, or taking the direct opposite (your choice).</li>" +
					"<li>Hit a crescendo that gives time for your allies to think, as everyone listening " +
					"is distracted/interrupted by your performance.</li>" +
					"</ul>"
			},
			{
				key: "the-icon:power",
				name: "Power",
				// "They gain a point of Spotlight" needs one actor's move to grant Spotlight to a
				// different actor entirely — Spotlight is tracked per-sheet with no cross-actor grant
				// mechanism anywhere in this module. Prose only, per claude.md's "systems that do not
				// exist yet".
				traits: [],
				description:
					"<p>When someone does something notable and dangerous on your behalf, whether you " +
					"ordered them to or not, they gain a point of Spotlight.</p>"
			},
			{
				key: "the-icon:bardic-inspiration",
				name: "Bardic Inspiration",
				// Same flat, roll-less hold shape as B-Plot/Hot-blooded — "at the beginning of a Sortie"
				// isn't a tracked trigger, so Activate is the player's own call for when that's happened.
				// "Add a d4 to any roll, before or after it is made" has no hook to a specific die-face
				// mechanic anywhere in this module (roll-modifier stacking doesn't exist — see claude.md's
				// "systems that do not exist yet"), so only the hold pool itself is coded; applying the d4
				// stays a manual, narrated adjustment.
				traits: [],
				flatHold: 3,
				description:
					"<p>At the beginning of a Sortie, hold 3. You may spend this hold 1-for-1 to add a d4 " +
					"to any roll, before or after it is made.</p>"
			},
			{
				key: "the-icon:change-of-heart",
				name: "Change Of Heart",
				traits: [],
				description:
					"<p>Whenever you give a performance, other players may loosen or deepen any of their " +
					"Hooks as they please.</p>"
			},
			{
				key: "the-icon:touchstone",
				name: "Touchstone",
				traits: [],
				description:
					"<p>You have your finger on the pulse of the Carrier and the people on it; you " +
					"understand them as well as the Captain, and have a good feel for how they might view " +
					"any given situation.</p>"
			},
			{
				key: "the-icon:you-should-see-me-in-a-crown",
				name: "You Should See Me In A Crown",
				// "Requires: Touchstone" is descriptive only — consistent with pool membership not being
				// enforced, move prerequisites stay prose (see claude.md's "Adding move content"); the
				// picker never checks whether Touchstone is also picked.
				traits: [],
				description:
					"<p>Requires: Touchstone</p>" +
					"<p>When you talk, people listen. Unless someone already intends to harm you (or you're " +
					"actively putting them in danger), people will always at least stop and consider your " +
					"words. You do not need to roll to convince people to do something that is in their own " +
					"best interests or that you have a convincing case for, and your attempts to do " +
					"anything beyond that are made in confidence.</p>"
			},
			{
				key: "the-icon:mechanical-aria",
				name: "Mechanical Aria",
				traits: [],
				// The one real mechanic in this pool — see astir-mixin.js's _astirData `available`
				// field, which now also checks for this flag among the actor's picked playbook moves
				// (the same move-scoped route grantsHomeInsteadOfChannel takes for The Adrift, except
				// that one is a guaranteed playbook-wide substitution while this only applies once an
				// Icon has actually picked Mechanical Aria as an advancement). "Cannot pilot other
				// Astirs" needs no code — an actor can only ever have one Astir at all (see claude.md's
				// Astir section). "May use subsystems" needs no code either — Subsystems (an Astir Part)
				// has never checked CHANNEL.
				grantsAstirAccessWithoutChannel: true,
				description:
					"<p>You acquire an Astir III specially designed and calibrated to be piloted by you, " +
					"built as per the usual custom Astir rules. It's likely equipped with equipment that " +
					"is very flashy and loud.</p>" +
					"<p>You cannot pilot other Astirs, and do not have a +CHANNEL trait, though you may " +
					"use subsystems.</p>"
			},
			{
				key: "the-icon:showstopper",
				name: "Showstopper",
				// "Requires: Bardic Inspiration" is descriptive only, same treatment You Should See Me In
				// A Crown's own Touchstone requirement gets above. Both upgrades reference mechanics
				// Bardic Inspiration itself never coded (the d4 application) or that don't exist anywhere
				// in this module (advancing a GRAVITY clock as a move side-effect), so this stays prose
				// too, per claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>Requires: Bardic Inspiration</p>" +
					"<p>When you use bardic inspiration, you may increase a roll by a d6 instead of a d4. " +
					"When you use bardic inspiration on a roll made by someone you have a GRAVITY clock " +
					"with, advance it.</p>"
			},
			{
				key: "the-icon:perspective",
				name: "Perspective",
				traits: [],
				description:
					"<p>When you look at an incomplete work—whether a piece of art or something far " +
					"simpler—you can always envision what was intended to complete it and exactly what " +
					"would be needed to finish the work, and also something grander and far more " +
					"difficult.</p>"
			}
		]
	},
	{
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
	},
	{
		key: "the-captain",
		label: "The Captain",
		playbookName: "The Captain",
		moves: [
			{
				key: "the-captain:in-command",
				name: "In Command",
				traits: [],
				// "You are defenceless at 4 dangers ... rather than 3" is the one mechanized part of
				// this move — see tracking-mixin.js's _dangerMax, keyed off the playbook slug plus the
				// At the Helm checkbox (system.attributes.atHelm), not off this move being picked:
				// every Captain starts with In Command via starting-moves.js's grantedKeys, so there's
				// no "picked or not" case to separately gate on. Everything else here — ordering the
				// crew, "you are responsible for their lives" — is pure fiction with nothing to track
				// (see claude.md's "Manual trackers, not enforcement": Dangers themselves already
				// cover the "if things go bad" consequence).
				description:
					"<p>You are the Carrier's captain, and naturally have command of its crew. While at " +
					"the helm of the Carrier, you may order the crew to perform moves on your behalf: " +
					"unlike when other playbooks use +CREW, you may do this any number of times. " +
					"Increase your Carrier's +CREW by 1.</p>" +
					"<p>When you do so, explain how the crew helps you do this thing—they share in the " +
					"consequences of your move, good and bad. You are responsible for their lives. If " +
					"things go bad rolling your Traits, things go bad for you. If things go bad rolling " +
					"+CREW, you endanger everyone.</p>" +
					"<p>Additionally, both Carrier and crew are part of your character as far as risks " +
					"and perils are concerned, just like an Astir is an extension of its channeler. To " +
					"reflect the many minds and hands at work for you, you are defenceless at 4 dangers " +
					"while at the helm of your Carrier, rather than 3. You go down with it, and it goes " +
					"down with you.</p>"
			},
			{
				key: "the-captain:tactical-genius",
				name: "Tactical Genius",
				traits: [],
				// Every spend option below is a cross-actor effect (removing another character's own
				// risk, giving them advantage, moving them into the scene) — the same "nothing in this
				// module can reach across actors that way" stance every other cross-actor grant here
				// takes (see e.g. Hope So Bad That You'll Bathe And Hunt below). Applying any of the
				// three effects it pays for still stays prose-only for that reason — but the hold
				// pool's own size is worth tracking regardless, via the same generic numericTrackers
				// mechanic Transmute Self/Smiling Politely use (see playbook-sheet/moves-mixin.js).
				// max: 6 is deliberately generous headroom for "1+KNOW", since Traits in this module
				// are hand-entered and uncapped (mirrors Smiling Politely's own max: 10). period:
				// "Sortie" matches the move's own "at the start of a Sortie" text, so Refresh Sortie
				// resets it back to 0 (see frames-mixin.js's _refreshPeriod).
				numericTrackers: [
					{ key: "hold", label: "Hold", min: 0, max: 6, period: "Sortie" }
				],
				description:
					"<p>When you're supervising allies from afar during a Sortie, you can lever your " +
					"tactical know-how into better positioning. Take 1+KNOW hold at the start of a " +
					"Sortie, and spend it 1-for-1 to do the following;</p>" +
					"<ul>" +
					"<li>Remove one risk from an ally.</li>" +
					"<li>Give an ally advantage to their next move, describing how you advise or support " +
					"them.</li>" +
					"<li>Have an ally appear somehow in a place they are needed.</li>" +
					"</ul>"
			},
			{
				key: "the-captain:force-multiplier",
				name: "Force Multiplier",
				traits: [],
				// A manual counter, same generic numericTrackers mechanic as Tactical Genius above —
				// but deliberately with no `period`, since "once per Sortie you may act with
				// confidence" per drawback taken isn't a pool that refills at the start of each
				// Sortie the way Tactical Genius's hold does; it's capped by how many drawbacks were
				// taken (up to 3) and the player manages when a use is spent themselves. Refresh
				// Sortie/Scene only ever touch trackers that declare a period (see
				// frames-mixin.js's _refreshPeriod), so this one is untouched by both.
				numericTrackers: [
					{ key: "confidence", label: "Confidence rolls available", min: 0, max: 3 }
				],
				description:
					"<p>You acquire something—a tool, ship upgrade, a caged malevolent sentience, " +
					"etc—that allows the Carrier and it's staff to operate far better than usual, but it " +
					"has a downside. For each of the below drawbacks you give it, once per Sortie you " +
					"may act with confidence.</p>" +
					"<ul>" +
					"<li>It whispers in your ear—change one of your Hooks to represent its demands.</li>" +
					"<li>It's fragile and needs protecting. It grants no benefit while damaged or " +
					"destroyed.</li>" +
					"<li>It is physically taxing or requires upkeep of some kind: gain a burden. If you " +
					"gain this move at the same time as you would gain a burden from another source, you " +
					"take this one instead.</li>" +
					"</ul>"
			},
			{
				key: "the-captain:surprise-requisition",
				name: "Surprise Requisition",
				traits: [],
				// "Roll +CREW" with no trait/stat selection — reuses Lead a Sortie's own fixedTraits
				// CREW resolution verbatim (see moves.js's SPECIAL_MOVES/moves-mixin.js's
				// _crewFixedTraitValue/_rollMove): the static value here is only a placeholder,
				// overwritten with a live Carrier read the same way Lead a Sortie's own is.
				fixedTraits: [{ key: "crew", label: "CREW", value: 0 }],
				// The 10+/7-9 option lists below are a descriptive menu, not a deeper tracked
				// mechanic — no weapon-tag-profile system exists to actually grant a temporary tag,
				// and no Approach-swap system exists either (see claude.md's "systems that do not
				// exist yet"), so both tiers are prose only, same treatment Stir The Crowd's own
				// choose-N option list gets.
				results: {
					success: "Choose 1 for free;" +
						"<ul>" +
						"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
						"(clearing a related peril, if applicable).</li>" +
						"<li>A weapon gains the bane tag until the end of the scene.</li>" +
						"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
						"<li>An Astir changes it's approach until the end of the scene.</li>" +
						"</ul>",
					mixed: "You had to requisition that gear personally; tap a Faction as they spread " +
						"themselves thin to help you, then choose 1;" +
						"<ul>" +
						"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
						"(clearing a related peril, if applicable).</li>" +
						"<li>A weapon gains the bane tag until the end of the scene.</li>" +
						"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
						"<li>An Astir changes it's approach until the end of the scene.</li>" +
						"</ul>",
					failure: null
				},
				description:
					"<p>When you dispatch supplies to another character or reveal something extra you " +
					"had them deployed with all along, roll +CREW. On a 10+, choose 1 for free. On a " +
					"7-9, you had to requisition that gear personally; tap a Faction as they spread " +
					"themselves thin to help you.</p>" +
					"<ul>" +
					"<li>A weapon rendered unusable by damage or lack of ammo is replaced/rearmed " +
					"(clearing a related peril, if applicable).</li>" +
					"<li>A weapon gains the bane tag until the end of the scene.</li>" +
					"<li>A weapon gains the ruin tag for one shot or strike.</li>" +
					"<li>An Astir changes it's approach until the end of the scene.</li>" +
					"</ul>"
			},
			{
				key: "the-captain:fire-support",
				name: "Fire Support",
				traits: [],
				// "using +KNOW" — adds KNOW as a rollable option to Exchange Blows/Strike Decisively,
				// the same addsTraitToMove shape Turn Unearthly (the-paradigm:turn-unearthly) uses.
				addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "know" },
				// "...and the Carrier's weaponry" — see moves-mixin.js's _grantsCarrierWeaponAccess/
				// _onMoveRoll, which folds the world's Carrier's own weapons into Exchange Blows/
				// Strike Decisively's weapon choice (only when exactly one Carrier exists in the
				// world — see that method's own comment for why).
				grantsCarrierWeaponAccess: { moveKeys: ["exchange-blows", "strike-decisively"] },
				description:
					"<p>When you provide instruction and call shots for the Carrier's crew, you may " +
					"exchange blows and strike decisively using +KNOW and the Carrier's weaponry.</p>"
			},
			{
				key: "the-captain:information-network",
				name: "Information Network",
				traits: [],
				// "you may dispel uncertainties with +TALK" — the single-target-moveKey form of
				// addsTraitToMove, same shape Facilitator/Ascension use.
				addsTraitToMove: { moveKey: "dispel-uncertainties", trait: "talk" },
				bonusDowntimeTokens: { max: 1, description: "Any info-gathering efforts or projects." },
				description:
					"<p>When you contact your superiors or an appropriate source for relevant intel, " +
					"you may dispel uncertainties with +TALK.</p>" +
					"<p>Take +1 token during Downtime to spend on any info-gathering efforts or " +
					"projects.</p>"
			},
			{
				key: "the-captain:born-leader",
				name: "Born Leader",
				traits: [],
				// "You lead a Sortie with advantage" — grantsAdvantageOnMove, same shape Don't Follow
				// Me uses. "give the crew confidence when they plan & prepare" and the Cause/Conflict
				// Turn paragraph both stay prose: neither a "Plan & Prepare" move nor a Conflict Turn
				// system exists anywhere in this module (see claude.md's "systems that do not exist
				// yet", and compare That's Dialectics' own comment on its similarly-unbuilt "plan and
				// prepare" reference).
				grantsAdvantageOnMove: { moveKey: "lead-a-sortie", advantage: "advantage" },
				description:
					"<p>You lead a Sortie with advantage and give the crew confidence when they plan " +
					"&amp; prepare.</p>" +
					"<p>Figures within the Cause lean on you for strategic advice: to some degree, their " +
					"successes and failures during the Conflict Turn can be attributed to your " +
					"guidance.</p>"
			},
			{
				key: "the-captain:human-resources",
				name: "Human Resources",
				traits: [],
				// "you may also choose from the following questions" — a second, additive question
				// list layered onto Read the Room's own (see moves-mixin.js's
				// _grantedQuestionsForMove/moves.js#rollMove's extraQuestions merge), rather than
				// replacing it.
				addsQuestionsToMove: {
					moveKey: "read-the-room",
					questions: [
						"What is the crew's mood like?",
						"Who is responsible for a problem on-board the Carrier?",
						"What could be a problem for the crew in the immediate future?"
					]
				},
				description:
					"<p>When you read the room, you may also choose from the following questions;</p>" +
					"<ul>" +
					"<li>What is the crew's mood like?</li>" +
					"<li>Who is responsible for a problem on-board the Carrier?</li>" +
					"<li>What could be a problem for the crew in the immediate future?</li>" +
					"</ul>"
			},
			{
				key: "the-captain:coordinator",
				name: "Coordinator",
				// Grants another character (the helped ally) Confidence — a cross-actor effect nothing
				// in this module can reach (every grantsEffectOnMove/grantsTraitOnMove/
				// grantsAdvantageOnMove/addsTraitToMove flag above only ever locks the *acting*
				// actor's own next roll — see e.g. Hope So Bad That You'll Bathe And Hunt/Team Player).
				// Still can't actually apply the Confidence itself, per claude.md's "systems that do
				// not exist yet" — but the reminder to do so can at least surface on Help or Hinder's
				// own chat card, the success-tier mirror of Walk-on Part In The War's
				// addsFailureReminderToMove (see moves-mixin.js's _grantedSuccessReminderForMove).
				// intents (help vs. hinder) are flavor-only with no mechanical branch anywhere in this
				// module (see help-or-hinder's own comment in moves.js), so the reminder text states
				// the "if you chose to help" condition in prose rather than being conditionally gated
				// on which intent was picked.
				addsSuccessReminderToMove: {
					moveKeys: ["help-or-hinder"],
					reminder: "If you chose to help, your ally may act with confidence in addition to " +
						"advantage."
				},
				traits: [],
				description:
					"<p>When you roll a 10+ to help or hinder and choose to help, your ally may act " +
					"with confidence in addition to advantage.</p>"
			}
		]
	},
	{
		key: "cantrips",
		label: "Cantrips",
		note: "Any playbook may take these in place of a move from their own pool.",
		moves: [
			{
				key: "cantrips:classical-spellcasting",
				name: "Classical Spellcasting",
				// No roll of its own — it's a standing permission to reroll a Basic Move with
				// +CHANNEL instead of its usual Trait, which would mean offering CHANNEL as an
				// extra option on every Basic Move's own roll dialog. That cross-cutting change
				// isn't built; a player with this Cantrip applies it themselves when picking a
				// trait to roll. The move's own violent-use profile ("Hand-casting II") references
				// weapon profiles/tags, which also don't exist yet — see Advanced Evocation below.
				traits: [],
				description:
					"<p>Choose a Basic Move: while out of your Astir, you may roll it with +CHANNEL instead of " +
					"the usual Trait. If things go wrong, your magic backfires. Using magic to exploit people's " +
					"emotions and minds is as bad as using magic to hurt them, and will be remembered as such. " +
					"If you do use magic violently, use the following profile:</p>" +
					"<ul><li>Hand-casting II (ranged / area)</li></ul>"
			},
			{
				key: "cantrips:advanced-evocation",
				name: "Advanced Evocation",
				// Requires Classical Spellcasting in the fiction, but — same as every other pool
				// restriction in this picker (see MOVE_POOLS' top comment) — that's not enforced
				// here; it stays selectable regardless of what else the actor has picked. The tag
				// choice itself is blocked on the same not-yet-built weapon profiles/tags system
				// as Classical Spellcasting's profile.
				traits: [],
				description:
					"<p><em>Requires: Classical Spellcasting.</em></p>" +
					"<p>Choose one of the following tags (defensive, decisive, restraining, impact); when you " +
					"use classical spellcasting violently, add that tag to the above profile. At your " +
					"Director's discretion, you may choose a tag not on the above list or create a new one " +
					"entirely.</p>"
			},
			{
				key: "cantrips:dont-die-yet",
				name: "Don't Die Yet",
				// No stated usage cap (contrast Seek Allies/Personal Familiar below), so nothing to
				// track — the grant is narrated each time it comes up.
				traits: [],
				description:
					"<p>When you enter battle with a group of allies, give up to four people (including " +
					"yourself) advantage when they next bite the dust.</p>"
			},
			{
				key: "cantrips:seek-allies",
				name: "Seek Allies",
				traits: [],
				uses: [{ key: "sortie", label: "Used this Sortie", period: "Sortie" }],
				description:
					"<p>Once per Sortie, you may summon a cadre of creatures, spirits, elementals or otherwise " +
					"to assist you in combat. When you do so, you may act as a squad until the end of the " +
					"scene.</p>"
			},
			{
				key: "cantrips:haste",
				name: "Haste",
				traits: [],
				description:
					"<p>If there is a question of who acts first in a situation, the answer is you. If multiple " +
					"characters with haste are all attempting to be the quickest, they act simultaneously.</p>"
			},
			{
				key: "cantrips:deny",
				name: "Deny",
				traits: ["channel"],
				description:
					"<p>When you use magic to temporarily restrict the actions of another, roll +CHANNEL.</p>" +
					"<p>On a 10+, you prevent them from taking a single action or move.</p>" +
					"<p>On a 7-9, as above, but you or someone else rushes to act against them in " +
					"desperation.</p>",
				results: {
					success: "You prevent them from taking a single action or move.",
					mixed: "As above, but you or someone else rushes to act against them in desperation.",
					failure: null
				}
			},
			{
				key: "cantrips:fire-eater",
				name: "Fire-Eater",
				// No new plumbing needed: taking a peril is already the existing Danger "Add"
				// controls (system.attributes.dangers), and acting with confidence is already the
				// Effect select in the roll dialog (roll-effects.js) — this move just combines two
				// controls that already exist, rather than needing one of its own.
				traits: [],
				description:
					"<p>You may take a peril (seared, volatile, overcharged) to untick 'overheating' from your " +
					"Astir and act with confidence.</p>"
			},
			{
				key: "cantrips:all-in",
				name: "All In",
				// The extra-Advantage-for-Desperation trade would mean stacking a second Advantage
				// state on top of whatever a roll already has, which roll-effects.js's
				// ADVANTAGE_STATES/EFFECT_STATES don't model (each roll picks exactly one of
				// each) — not built; applied by hand at the table for now.
				traits: [],
				description:
					"<p>When you have advantage on a move, you may take an additional advantage at the cost of " +
					"also acting in desperation.</p>"
			},
			{
				key: "cantrips:lifesense",
				name: "Lifesense",
				traits: [],
				description:
					"<p>You have a keen sense of where all living creatures around you up to sniper distance " +
					"are, as well as roughly how strong their life force is—living things close to death, for " +
					"example, seem more faint and difficult to conceive of in this way.</p>"
			},
			{
				key: "cantrips:truth-making",
				name: "Truth-making",
				// Read the Room's own roll (BASIC_MOVES in moves.js) only distinguishes
				// success/mixed/failure via moveResultTier — there's no 12+ super-tier to hook a
				// bonus effect onto, so this stays descriptive; the player self-applies it when
				// their Read the Room roll comes up 12 or higher.
				traits: [],
				description:
					"<p>When you read the room, on a 12+ you may answer one of your questions yourself—though " +
					"your answer must be within the relative realm of possibility.</p>"
			},
			{
				key: "cantrips:personal-familiar",
				name: "Personal Familiar",
				traits: [],
				uses: [
					{ key: "sortie", label: "Ignored a disadvantage this Sortie", period: "Sortie" },
					// No period — Downtime isn't a resettable button in this module (see
					// PlaybookActorSheet#_refreshPeriod), so this stays purely manual.
					{ key: "downtime", label: "Reported back this Downtime" }
				],
				description:
					"<p>You have a small familiar that aids you, like an animal companion or spirit or summoned " +
					"creature. Once per Sortie, you can ignore a single disadvantage as they help you out of " +
					"trouble. Once per Downtime, they can report back to you about the events of a Scene you " +
					"weren't present for.</p>"
			}
		]
	},
	{
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
				// moveResultTier only has three tiers (success/mixed/failure) — there's no 12+ super-tier
				// to hook a bonus effect onto (see claude.md's "result tiers above 10+" exception, same
				// reasoning as Cantrips' Truth-making), so this stays descriptive.
				traits: [],
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
				// has no hook for yet, so it stays descriptive only — see claude.md's "systems that do
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
				// claude.md's "systems that do not exist yet" guidance, transcribed as prose rather than
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
	},
	{
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
				// anywhere in this module (see claude.md's "systems that do not exist yet", and
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
				// module to hook into (see claude.md's "systems that do not exist yet"), so the spend
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
	}
];

// Advisory text for the grouping section the other playbooks' pools are nested under — the
// counterpart to each universal pool's own `note`.
export const OTHER_PLAYBOOKS_NOTE = "Only in rare circumstances, and with your Director's agreement.";

// Flat list of every playbook move, for the sheet's key lookup (see ALL_MOVES in
// playbook-actor-sheet.js) and for resolving the keys stored on an actor.
export const ALL_PLAYBOOK_MOVES = MOVE_POOLS.flatMap((pool) => pool.moves);

export function findPlaybookMove(key) {
	return ALL_PLAYBOOK_MOVES.find((move) => move.key === key) ?? null;
}

// Resolves an actor's stored keys to move definitions, dropping any that no longer exist — a key
// can outlive its move whenever pool content is edited or renamed, and a stale entry should
// quietly disappear from the sheet rather than break rendering.
export function resolvePlaybookMoves(keys = []) {
	return keys.map(findPlaybookMove).filter(Boolean);
}

// The picker's display shape for one move. Trait labels come straight from the move's definition
// rather than being filtered against the actor (unlike _moveTraits on the sheet): the picker shows
// what a move rolls, not whether this particular character can currently roll it.
//
// Exported so astir.js's astirMoveSections can build its own (differently-shaped) picker tree
// from the same pool/catalog data without duplicating this or pickerSection below.
export function pickerMove(move) {
	return {
		key: move.key,
		name: move.name,
		traitLabels: move.traits.map((key) => TRAITS.find((trait) => trait.key === key)?.label).filter(Boolean),
		description: move.description
	};
}

// Moves sharing an `exclusiveGroup` can never both be offered — generalizes equipment.js's own
// `exclusiveGroup` concept (there: an exclusive checkbox group; here: a picker-time filter, since
// moves are added one at a time through modal pickers rather than toggled in place). Only Field
// Scout/Giant Slayer and Earthly Ally/Titanic use this today — their own rules text presents each
// pair as alternate identities, not merely alternate skill picks, unlike every other pool's moves
// (deliberately unpoliced elsewhere, see claude.md's "Pool restrictions are deliberately not
// enforced").
function selectedExclusiveGroups(selectedKeys) {
	return new Set(selectedKeys.map((key) => findPlaybookMove(key)?.exclusiveGroup).filter(Boolean));
}

// Filters a pool down to the picker's offered moves: already-selected moves are dropped (so
// nothing can be taken twice) and, on top of that, any move whose exclusiveGroup is already
// covered by a selected move is dropped too (see selectedExclusiveGroups above).
export function pickerSection(pool, selectedKeys, { note = pool.note, open = false } = {}) {
	const excludedGroups = selectedExclusiveGroups(selectedKeys);
	const moves = pool.moves.filter((move) =>
		!selectedKeys.includes(move.key) && !(move.exclusiveGroup && excludedGroups.has(move.exclusiveGroup))
	);
	if (!moves.length) return null;
	return { key: pool.key, label: pool.label, note, open, moves: moves.map(pickerMove) };
}

// Builds the picker's accordion tree, ordered by how likely a player is to want each pool: their
// own playbook (expanded by default), then Cantrips, then Soldier Moves, then every other
// playbook's pool nested one level down under "Other Playbooks".
//
// Moves the actor already has are filtered out so the same move can't be taken twice, and any
// section left empty by that filtering — or empty to begin with, like the not-yet-written
// Commander and Impostor pools — is dropped rather than rendered as an empty heading.
//
// `pools` is injectable for testing the ordering/nesting/emptiness rules against fixtures, so
// those tests don't quietly change meaning as real move content fills the pools in (same reason
// choosePlaybook takes its playbooks in actor-creation.js).
export function playbookMoveSections(playbookName, selectedKeys = [], pools = MOVE_POOLS) {
	const sections = [];

	const own = pools.find((pool) => pool.playbookName && pool.playbookName === playbookName);
	if (own) {
		const section = pickerSection(own, selectedKeys, { note: "Your playbook.", open: true });
		if (section) sections.push(section);
	}

	for (const pool of pools.filter((p) => !p.playbookName)) {
		const section = pickerSection(pool, selectedKeys);
		if (section) sections.push(section);
	}

	const others = pools
		.filter((pool) => pool.playbookName && pool !== own)
		.map((pool) => pickerSection(pool, selectedKeys))
		.filter(Boolean);
	if (others.length) {
		sections.push({
			key: "other-playbooks",
			label: "Other Playbooks",
			note: OTHER_PLAYBOOKS_NOTE,
			open: false,
			sections: others
		});
	}

	return sections;
}

// Opens the "+" picker and resolves the chosen move's key, or null if the dialog was dismissed or
// nothing was selected. Mirrors configureMoveRoll (moves.js) and choosePlaybook
// (actor-creation.js) for the promise/Dialog shape.
export async function choosePlaybookMove(playbookName, selectedKeys = []) {
	const sections = playbookMoveSections(playbookName, selectedKeys);
	const content = await renderTemplate(PLAYBOOK_MOVE_PICKER_TEMPLATE, { sections });

	return new Promise((resolve) => {
		new Dialog({
			title: "Add a Playbook Move",
			content,
			buttons: {
				add: {
					label: "Add",
					// No radio checked (including when every pool is empty) leaves .val() undefined —
					// treated the same as cancelling.
					callback: (html) => resolve(html.find("[name='playbook-move']:checked").val() ?? null)
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "playbook-move-picker"],
			// Dialog's own default (400x"auto") is too cramped for an accordion of up to a dozen
			// moves with full description text — start it roomier and let the player resize
			// further. resizable needs a numeric height, not "auto" (Foundry only renders the
			// drag handle and tracks a height to resize from when one's given); the picker's
			// content scrolls within that height via core's own .window-content overflow rule
			// rather than growing the window, so a still-too-small height degrades to a scrollbar,
			// not clipped content.
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}
