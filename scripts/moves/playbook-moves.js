import { TRAITS } from "../core/traits.js";
import { MOVE_POOLS } from "./move-pools/index.js";
import { CUSTOM_MOVE_CATALOG } from "./custom-move-catalog.js";
import { renderTemplate } from "../compat.js";

export const PLAYBOOK_MOVE_PICKER_TEMPLATE = "modules/armor-astir/templates/playbook-move-picker.hbs";

// Unlike basic/special moves (which every playbook gets automatically — see moves.js), playbook
// moves start empty on every actor and are picked one at a time via the sheet's "+" button. The
// picked keys live on the actor (system.attributes.playbookMoves); the definitions live here, so
// two Scouts can carry completely different sets and later text edits reach both.
//
// Move objects use the exact same shape as BASIC_MOVES (see docs/domains/moves.md, "Basic moves") — they're
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
export { MOVE_POOLS };

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

// A move's own requiresMoves (e.g. You Should See Me In A Crown requiring Touchstone — see
// docs/domains/moves.md's "Adding move content" table) resolved against a list of currently-picked move keys.
// Returns the keys still missing, empty when every requirement is met (or the move has none) —
// mirrors resolvePlaybookMoves/resolveEquipmentTags's own "resolve keys against catalog data"
// shape. Used both by pickerMove below (gating the "+" picker) and _moveGroupMoves
// (moves-mixin.js, gating an already-picked move's Roll button live if the prerequisite is later
// removed).
export function unmetMoveRequirements(move, pickedMoveKeys = []) {
	return (move.requiresMoves ?? []).filter((key) => !pickedMoveKeys.includes(key));
}

// Turns a list of missing move keys (from unmetMoveRequirements) into the hover-tooltip text, or
// null when nothing's missing — null (not "") so callers can Boolean() it directly for `disabled`/
// `gated`. Resolves each key to its move's display name, falling back to the raw key for a stale
// reference rather than throwing.
export function moveRequirementTooltip(missingMoveKeys) {
	if (!missingMoveKeys.length) return null;
	const names = missingMoveKeys.map((key) => findPlaybookMove(key)?.name ?? key);
	return `Requires ${names.join(", ")}`;
}

// The picker's display shape for one move. Trait labels come straight from the move's definition
// rather than being filtered against the actor (unlike _moveTraits on the sheet): the picker shows
// what a move rolls, not whether this particular character can currently roll it.
//
// A move whose requiresMoves isn't fully satisfied stays in the list (unlike the already-
// selected/exclusiveGroup filtering pickerSection does below, which drops a move entirely) but is
// marked disabled with an explanatory tooltip, so a player can see what they're missing rather than
// the option silently never appearing. `extraTooltip` is an injectable callback so astir.js's
// astirMoveSections can layer Astir-Part gating on top without this module importing anything from
// astir.js (this module must not depend upward on astir.js/ardent.js — see claude.md).
//
// Exported so astir.js's astirMoveSections can build its own (differently-shaped) picker tree
// from the same pool/catalog data without duplicating this or pickerSection below.
export function pickerMove(move, pickedMoveKeys = [], { extraTooltip } = {}) {
	let tooltip = moveRequirementTooltip(unmetMoveRequirements(move, pickedMoveKeys));
	const extra = extraTooltip?.(move);
	if (extra) tooltip = tooltip ? `${tooltip}; ${extra}` : extra;
	return {
		key: move.key,
		name: move.name,
		traitLabels: move.traits.map((key) => TRAITS.find((trait) => trait.key === key)?.label).filter(Boolean),
		description: move.description,
		disabled: Boolean(tooltip),
		tooltip
	};
}

// Moves sharing an `exclusiveGroup` can never both be offered — generalizes equipment.js's own
// `exclusiveGroup` concept (there: an exclusive checkbox group; here: a picker-time filter, since
// moves are added one at a time through modal pickers rather than toggled in place). Only Field
// Scout/Giant Slayer and Earthly Ally/Titanic use this today — their own rules text presents each
// pair as alternate identities, not merely alternate skill picks, unlike every other pool's moves
// (deliberately unpoliced elsewhere, see docs/domains/moves.md's "Pool restrictions are deliberately not
// enforced").
function selectedExclusiveGroups(selectedKeys) {
	return new Set(selectedKeys.map((key) => findPlaybookMove(key)?.exclusiveGroup).filter(Boolean));
}

// Filters a pool down to the picker's offered moves: already-selected moves are dropped (so
// nothing can be taken twice) and, on top of that, any move whose exclusiveGroup is already
// covered by a selected move is dropped too (see selectedExclusiveGroups above). A move whose
// requiresMoves isn't met is a different kind of "can't have" — see pickerMove above — so it stays
// in the list, just disabled. `excludeKeys` (an optional Set) additionally drops moves by key
// outright — used by playbookMoveSections below to hide another playbook's starting moves (see
// starting-moves.js's startingMoveKeysByPlaybook) from its "Other Playbooks" listing.
// `extraTooltip` is threaded straight through to pickerMove.
export function pickerSection(pool, selectedKeys, { note = pool.note, open = false, extraTooltip, excludeKeys } = {}) {
	const excludedGroups = selectedExclusiveGroups(selectedKeys);
	const moves = pool.moves.filter((move) =>
		!selectedKeys.includes(move.key) && !(move.exclusiveGroup && excludedGroups.has(move.exclusiveGroup)) && !excludeKeys?.has(move.key)
	);
	if (!moves.length) return null;
	return {
		key: pool.key,
		label: pool.label,
		note,
		open,
		moves: moves.map((move) => pickerMove(move, selectedKeys, { extraTooltip }))
	};
}

// Builds the picker's accordion tree, ordered by how likely a player is to want each pool: their
// own playbook, then Cantrips, then Soldier Moves, then every other playbook's pool nested one
// level down under "Other Playbooks". Every section starts collapsed so the ordering itself — not
// an expanded first section pushing the rest offscreen — is what signals the other pools exist.
//
// Moves the actor already has are filtered out so the same move can't be taken twice, and any
// section left empty by that filtering — or empty to begin with, like the not-yet-written
// Commander and Impostor pools — is dropped rather than rendered as an empty heading.
//
// `pools` is injectable for testing the ordering/nesting/emptiness rules against fixtures, so
// those tests don't quietly change meaning as real move content fills the pools in (same reason
// choosePlaybook takes its playbooks in actor-creation.js).
//
// `startingMoveKeys` (a Map from playbookName to a Set of that playbook's grantedKeys/pickOneKeys
// starting moves — see starting-moves.js's startingMoveKeysByPlaybook) excludes those keys from
// each *other* playbook's pool under "Other Playbooks", so e.g. a Scout can't pick up The
// Commander's unconditional Ace Crew/Debrief grants from the picker. A playbook's own starting
// moves stay pickable in its own pool section (the `own` computation below), unaffected. Defaults
// to an empty Map so omitting it reproduces today's exact (unfiltered) behavior.
export function playbookMoveSections(
	playbookName,
	selectedKeys = [],
	pools = MOVE_POOLS,
	startingMoveKeys = new Map(),
	customMoves = CUSTOM_MOVE_CATALOG
) {
	const sections = [];

	const own = pools.find((pool) => pool.playbookName && pool.playbookName === playbookName);
	if (own) {
		const section = pickerSection(own, selectedKeys, { note: "Your playbook." });
		if (section) sections.push(section);
	}

	for (const pool of pools.filter((p) => !p.playbookName)) {
		const section = pickerSection(pool, selectedKeys);
		if (section) sections.push(section);
	}

	const others = pools
		.filter((pool) => pool.playbookName && pool !== own)
		.map((pool) => pickerSection(pool, selectedKeys, { excludeKeys: startingMoveKeys.get(pool.playbookName) }))
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

	// Every custom move added via the reflavor Config screen's custom-content system appears in its
	// own "Custom Moves" section, unconditionally — see docs/domains/reflavor.md's moves subsection.
	// pickerSection's existing "drop when empty" treatment (already relied on for Cantrips/Soldier
	// Moves) means this section simply never renders while CUSTOM_MOVE_CATALOG is empty.
	const customSection = pickerSection({ key: "custom-moves", label: "Custom Moves", moves: customMoves }, selectedKeys);
	if (customSection) sections.push(customSection);

	return sections;
}

// Opens the "+" picker and resolves the chosen move's key, or null if the dialog was dismissed or
// nothing was selected. Mirrors configureMoveRoll (moves.js) and choosePlaybook
// (actor-creation.js) for the promise/Dialog shape. `startingMoveKeys` is threaded straight
// through to playbookMoveSections (see its own comment) — callers pass
// starting-moves.js's startingMoveKeysByPlaybook() in practice.
export async function choosePlaybookMove(playbookName, selectedKeys = [], startingMoveKeys = new Map()) {
	const sections = playbookMoveSections(playbookName, selectedKeys, MOVE_POOLS, startingMoveKeys);
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
