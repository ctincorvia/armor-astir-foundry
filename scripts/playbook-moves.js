import { TRAITS } from "./traits.js";

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
		moves: []
	},
	{
		key: "the-impostor",
		label: "The Impostor",
		playbookName: "The Impostor",
		moves: [
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
