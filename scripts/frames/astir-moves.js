// The dedicated catalog for an Astir's one unique move (see astirMoveSections in
// astir-pickers.js). Most entries are pure prose (traits: [], no other flags — see
// docs/domains/moves.md's "Adding move content" table); a handful reuse existing declarative flags
// exactly as playbook moves already do, resolved for an Astir Move the same way via
// moves-mixin.js's _grantingMoves (see that file's own comment for why the Astir's move needed its
// own resolver alongside resolvePlaybookMoves).
export const ASTIR_MOVE_CATALOG = [
	{
		key: "astir:goliath-shield",
		name: "Goliath Shield",
		traits: [],
		grantsRollModifier: [{ moveKeys: ["help-or-hinder"], advantage: "advantage" }],
		description:
			"<p>An Astir built to take a hit is an Astir that keeps its allies standing.</p>" +
			"<p>Take advantage when you help or hinder to protect others.</p>"
	},
	{
		key: "astir:legacy",
		name: "Legacy",
		traits: [],
		// "Lead a Sortie with advantage while piloting this Astir" — same grantsAdvantageOnMove
		// shape as the-captain:born-leader (playbook-moves.js), resolved here through
		// _grantingMoves rather than resolvePlaybookMoves alone, since this is an Astir Move, not a
		// playbook move.
		grantsAdvantageOnMove: { moveKey: "lead-a-sortie", advantage: "advantage" },
		description:
			"<p>An Astir with a storied history commands respect—and inspires confidence—in whoever " +
			"takes the controls.</p>" +
			"<p>Lead a Sortie with advantage while piloting this Astir.</p>"
	},
	{
		key: "astir:refresh-matrix",
		name: "Refresh Matrix",
		traits: [],
		// "+blitz, -limited to Familiars" — Familiar weapons are ordinary equipment entries (see
		// ASTIR_WEAPON_CATALOG's familiar: true entries in astir-weapons.js); their tags stay
		// player-editable via the existing equipment editor, so no code is needed here — the player
		// just edits their Familiar weapon's own tags directly. Only Wisp Familiar carries "limited"
		// today.
		description:
			"<p>This Astir's Familiar Matrix runs on a tighter, more efficient cycle, letting each " +
			"Familiar re-arm faster than most.</p>" +
			"<p>Your Familiars gain the Blitz tag, and lose the Limited tag if they carry it (today, " +
			"only Wisp Familiar does).</p>"
	},
	{
		key: "astir:mana-devourer",
		name: "Mana Devourer",
		traits: [],
		// "+1 Power" against another Astir with physical harm specifically — an unenforceable
		// precondition folded into the reminder text itself, same technique the-captain:coordinator's
		// own addsSuccessReminderToMove already uses. Strike Decisively's own results.mixed text
		// ("you succeed as above, but choose 1") means its 7-9 is a success too, not just its 10+ —
		// so this needs both addsSuccessReminderToMove and its addsMixedReminderToMove sibling, not
		// just the one.
		addsSuccessReminderToMove: {
			moveKeys: ["strike-decisively"],
			reminder: "+1 Power (against another Astir, with physical harm)"
		},
		addsMixedReminderToMove: {
			moveKeys: ["strike-decisively"],
			reminder: "+1 Power (against another Astir, with physical harm)"
		},
		description:
			"<p>Some Astirs are built to feed on the very magic that threatens to tear them apart.</p>" +
			"<p>When you successfully strike decisively against another Astir with physical harm, gain " +
			"1 Power.</p>"
	},
	{
		key: "astir:inertia-drive",
		name: "Inertia Drive",
		traits: [],
		// Same shape as the-soldier:indomitable/cantrips:truth-making/the-advocate:a-greener-world's
		// own addsCriticalReminderToMove — a 12+ reminder on a specific move.
		addsCriticalReminderToMove: { moveKeys: ["weather-the-storm"], reminder: "Regain 1 Power" },
		description:
			"<p>Momentum becomes fuel in an Astir built around an inertia drive—the faster it moves, " +
			"the more it has to spare.</p>" +
			"<p>When you roll a 12+ to weather the storm to outpace, rush or dodge, regain 1 Power.</p>"
	},
	{
		key: "astir:generic-parts",
		name: "Generic Parts",
		traits: [],
		description:
			"<p>Cheap, common, and everywhere—an Astir built from generic parts is never far from a " +
			"spare.</p>" +
			"<p>Cool off with confidence when repairing or maintaining this Astir.</p>"
	},
	{
		key: "astir:manawheels",
		name: "Manawheels",
		traits: [],
		grantsRollModifier: [{ advantage: "advantage", requiresOverheating: true }],
		description:
			"<p>Wheels laced with restless motes of speed magic, always straining to be let loose.</p>" +
			"<p>While overheating, take advantage when making a move that relies on your speed.</p>"
	},
	{
		key: "astir:lev-spells",
		name: "Lev-Spells",
		// The exact the-scout:mobility shape (playbook-moves.js), transplanted wholesale — "you may
		// use the mobility Move from the Scout Playbook while piloting this Astir" is, mechanically,
		// just Mobility itself under a new key, with its own separateHold pool so it can't collide
		// with an actual Scout's own Mobility if a Scout ever takes this move too.
		traits: ["defy"],
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
			"<p>This Astir channels the Scout's own knack for mobility through its own systems, " +
			"translating fast reflexes into faster movement.</p>" +
			"<p>When you're piloting this Astir somewhere with the room to be acrobatic and mobile, " +
			"roll +DEFY;</p>" +
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
		key: "astir:pursuit-bond",
		name: "Pursuit-Bond",
		traits: [],
		description:
			"<p>Some Astirs are built to hunt one target and one target alone, come hell or high " +
			"water.</p>" +
			"<p>You may designate another Astir you can see as your target. You are supernaturally " +
			"aware of its location at all times.</p>"
	},
	{
		key: "astir:binding-rituals",
		name: "Binding Rituals",
		traits: [],
		// "Requires an artifact part" — same requiresParts shape the Familiar weapons use in
		// astir-weapons.js. The "clear a risk" effect itself stays prose: Subsystems (the move it
		// references) has no roll to hook a chat-card reminder onto, the same reasoning
		// astir-part:arcane-forge/astir:cutting-arms/astir:hyperlight-manifold leave their own
		// Subsystems-adjacent effects as prose.
		requiresParts: ["astir-part:artifact"],
		description:
			"<p>A ritual laced directly into the Astir's own systems, binding its power tighter to a " +
			"single artifact.</p>" +
			"<p>Requires an Artifact Astir Part.</p>" +
			"<p>When you use subsystems to activate your Artifact part, you may clear a risk related to " +
			"it.</p>"
	},
	{
		key: "astir:branded-blades",
		name: "Branded Blades",
		traits: [],
		// The trigger ("you untick overheating") is a past fictional event, and this module doesn't
		// track roll ordering -- same shape as Run Them Down! below: a free, fiction-gated checkbox,
		// not a resource spend.
		grantsRollModifier: [{ moveKeys: ["exchange-blows", "strike-decisively"], advantage: "advantage" }],
		description:
			"<p>Sigils burned into an Astir's own weapons flare brighter the hotter its core runs.</p>" +
			"<p>When you untick 'overheating' on your Astir, your next exchange blows or strike " +
			"decisively roll gains advantage.</p>"
	},
	{
		key: "astir:petrifier-core",
		name: "Petrifier Core",
		traits: [],
		// Same shape as the-adrift:walk-on-part-in-the-war's own addsFailureReminderToMove — a
		// consequence this module has no automatic tracker for (see claude.md's "Manual trackers, not
		// enforcement"), surfaced as a chat-card reminder on a 6- instead.
		addsFailureReminderToMove: {
			moveKeys: ["exchange-blows"],
			reminder: "If you took disadvantage, your opponent takes the risk (restrained)"
		},
		description:
			"<p>A core humming with petrifying energy, ready to lash out the moment its pilot opens " +
			"themself up.</p>" +
			"<p>When you exchange blows, you may take disadvantage to have your opponent take the risk " +
			"(restrained) on a 6-.</p>"
	},
	{
		key: "astir:cutting-arms",
		name: "Cutting Arms",
		traits: [],
		description:
			"<p>Built-in cutting tools make short work of whatever's in the way.</p>" +
			"<p>You may use the subsystems move to remove an environmental hazard of your choice.</p>"
	},
	{
		key: "astir:foe-eye",
		name: "Foe Eye",
		traits: [],
		description:
			"<p>A targeting system attuned to threat above all else.</p>" +
			"<p>You can always assess which foe before you is the most dangerous.</p>"
	},
	{
		key: "astir:future-sight",
		name: "Future Sight",
		traits: [],
		// "Requires Complex Spellwork 1" — same requiresParts shape as Binding Rituals above.
		requiresParts: ["astir-part:complex-spellwork"],
		// Same shape as the-captain:human-resources' own addsQuestionsToMove — an additive question
		// list layered onto Read the Room's own, not a replacement.
		addsQuestionsToMove: {
			moveKey: "read-the-room",
			questions: [
				"What's about to happen here?",
				"Who's about to make a move against us?",
				"What will go wrong if we do nothing?",
				"What opportunity is about to slip away?"
			]
		},
		description:
			"<p>Complex Spellwork's enchantments bend just far enough to offer a glimpse a few moments " +
			"ahead.</p>" +
			"<p>Requires Complex Spellwork.</p>" +
			"<p>When you read the room, you may also choose from the following questions about the " +
			"immediate future;</p>" +
			"<ul>" +
			"<li>What's about to happen here?</li>" +
			"<li>Who's about to make a move against us?</li>" +
			"<li>What will go wrong if we do nothing?</li>" +
			"<li>What opportunity is about to slip away?</li>" +
			"</ul>"
	},
	{
		key: "astir:featherlight",
		name: "Featherlight",
		traits: [],
		description:
			"<p>An Astir so precisely balanced it barely feels its own weight.</p>" +
			"<p>You never lose your footing or balance as a result of a fall or manoeuvre.</p>"
	},
	{
		key: "astir:hyperlight-manifold",
		name: "Hyperlight Manifold",
		traits: [],
		description:
			"<p>A manifold that folds space just enough to put an Astir somewhere else before anyone " +
			"notices it moved.</p>" +
			"<p>You may use subsystems to be in another place at the same time.</p>"
	},
	{
		key: "astir:palimpsest-system",
		name: "Palimpsest System",
		traits: [],
		grantsRollModifier: [{ moveKeys: ["weave-magic"], advantage: "advantage" }],
		description:
			"<p>Layer upon layer of recorded magic, ready to be traced back over the moment it's " +
			"needed.</p>" +
			"<p>You may weave magic with advantage to duplicate any magic or weapon recently utilised " +
			"against this Astir.</p>"
	},
	{
		key: "astir:never-surrender",
		name: "Never Surrender",
		traits: [],
		grantsRollModifier: [{ moveKeys: ["weather-the-storm"], advantage: "advantage" }],
		description:
			"<p>Some Astirs are built to keep fighting long after the numbers say they should have " +
			"gone down.</p>" +
			"<p>Take advantage when you weather the storm while outnumbered.</p>"
	},
	{
		key: "astir:run-them-down",
		name: "Run Them Down!",
		traits: [],
		grantsRollModifier: [{ moveKeys: ["strike-decisively"], advantage: "advantage" }],
		description:
			"<p>An Astir built to close distance fast hits twice as hard once it arrives.</p>" +
			"<p>Strike decisively with advantage when striking from a running start.</p>"
	}
];

// Some playbooks' Astir Move isn't a free pick — the Summoner's own rules text says "you start
// with eidolon drive as your Astir Move." Keyed by playbook name like
// playbookGrantsHomeInsteadOfChannel (starting-moves.js), so a future playbook needing the same
// treatment just adds an entry here.
const REQUIRED_ASTIR_MOVE_BY_PLAYBOOK = {
	"The Summoner": "the-summoner:eidolon-drive"
};

export function requiredAstirMoveKey(playbookName) {
	return REQUIRED_ASTIR_MOVE_BY_PLAYBOOK[playbookName] ?? null;
}
