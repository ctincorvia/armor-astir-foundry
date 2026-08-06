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
					label: "Dispelled (advantage on every roll, until you fail a move with a 6-) — unchecked: " +
						"haunted (disadvantage on every roll, until you succeed with a 10+)"
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
				// additive not replacing — exact shape Turn Unearthly (the-paradigm:turn-unearthly) already
				// uses, resolved generically by moves-mixin.js#_moveTraits (no new code needed beyond this
				// declaration).
				addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "channel" },
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
					"<p>Your death-touched nature is impossible to fully hide. When you reveal what you truly " +
					"are, or let your wretched visage show through, anyone who sees it and isn't already " +
					"accustomed to horrors like you takes the risk (horrified) before they can act against " +
					"you.</p>"
			},
			{
				key: "the-wither:fresh-hells",
				name: "Fresh Hells",
				traits: [],
				description:
					"<p>You have seen, and continue to see, more of what waits beyond death than anyone should. " +
					"Whenever a Sortie threatens to escalate into deeper danger, you may reveal a fresh hell " +
					"drawn from your own expertise—some worse threat was already there, waiting, and you're " +
					"the only one who noticed in time to say so.</p>"
			},
			{
				key: "the-wither:abyssal-summons",
				name: "Abyssal Summons",
				traits: [],
				description:
					"<p>You may call upon lesser spirits, wraiths, or the unquiet dead already lingering nearby " +
					"to fight alongside you for the rest of the Scene. They ask for something in return—only " +
					"you and your Director know what.</p>"
			},
			{
				key: "the-wither:dark-guarantees",
				name: "Dark Guarantees",
				// A conditional future-roll buff sealed by a promise, same "no hook yet" shape The Arity
				// Method's own second sentence (confidence + advantage on a future roll) leaves descriptive —
				// see claude.md's "systems that do not exist yet".
				traits: [],
				description:
					"<p>You may offer someone a guarantee, sealed in blood, shadow, or breath. If they accept, " +
					"they act with confidence on their next move. The price of breaking a guarantee you've " +
					"made is yours to decide, and it is never small.</p>"
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
				// "Hold 1... make your next move with advantage" is a bank-for-next-roll system this module
				// doesn't have anywhere (roll-modifier stacking — see claude.md's "systems that do not exist
				// yet"), and the payoff at 3 hold is a Director-facing narrative beat, not something the player
				// spends. Prose only.
				traits: [],
				description:
					"<p>When you are cowed or guilted into something you have no stake in, hold 1 and make your " +
					"next move with advantage. Once you have 3 hold, the Authority or another third party will " +
					"soon reach out to you with an unexpected offer or request.</p>"
			},
			{
				key: "the-adrift:walk-on-part-in-the-war",
				name: "Walk-on Part In The War",
				traits: [],
				addsTraitToMove: { moveKeys: ["exchange-blows", "strike-decisively"], trait: "home" },
				description:
					"<p>You can exchange blows and strike decisively with +HOME when attempting to cause physical " +
					"harm while piloting your Astir. On a 6-, tick 'overheating' on your Astir in addition to any " +
					"other consequences.</p>"
			},
			{
				key: "the-adrift:lead-role-in-a-cage",
				name: "Lead Role In A Cage",
				traits: [],
				// Unlike Don't Follow Me's real DEFY trait (never in Lead a Sortie's base traits/fixedTraits),
				// "home" isn't offered on Lead a Sortie at all until this move adds it, so it needs BOTH
				// addsTraitToMove (to make "home" available as an option) AND grantsTraitOnMove (to lock the
				// move to it) — without the former, the latter's lock would resolve against a traits list
				// that never contains "home" and silently fail (see moves-mixin.js#_grantedTraitForMove's own
				// comment about a key that isn't actually offered resolving to no lock at all).
				addsTraitToMove: { moveKey: "lead-a-sortie", trait: "home" },
				grantsTraitOnMove: { moveKey: "lead-a-sortie", trait: "home" },
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

export function pickerSection(pool, selectedKeys, { note = pool.note, open = false } = {}) {
	const moves = pool.moves.filter((move) => !selectedKeys.includes(move.key));
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
