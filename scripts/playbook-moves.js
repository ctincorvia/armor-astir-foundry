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
			{
				key: "the-scout:bullheaded",
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
		key: "the-commander",
		label: "The Commander",
		playbookName: "The Commander",
		moves: []
	},
	{
		key: "the-impostor",
		label: "The Impostor",
		playbookName: "The Impostor",
		moves: []
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
				uses: [{ key: "sortie", label: "Used this Sortie" }],
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
					{ key: "sortie", label: "Ignored a disadvantage this Sortie" },
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
		moves: [
			// Placeholder content, as above. Rollable off a trait no playbook disables, so the plain
			// (ungated) roll path is covered alongside the cantrip's gated one.
			{
				key: "soldier:placeholder-soldier-move",
				name: "Placeholder Soldier Move",
				traits: ["clash"],
				description: "<p>TODO: replace with the rulebook's Soldier Move text.</p>",
				results: {
					success: "TODO: replace with the rulebook's 10+ text.",
					mixed: "TODO: replace with the rulebook's 7-9 text.",
					failure: null
				}
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
function pickerMove(move) {
	return {
		key: move.key,
		name: move.name,
		traitLabels: move.traits.map((key) => TRAITS.find((trait) => trait.key === key)?.label).filter(Boolean),
		description: move.description
	};
}

function pickerSection(pool, selectedKeys, { note = pool.note, open = false } = {}) {
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
