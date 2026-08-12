import { APPROACHES } from "../core/approaches.js";
import {
	DRAIN_GROUP,
	EQUIPMENT_CATALOG_PICKER_TEMPLATE,
	EQUIPMENT_TAGS,
	buildTagReference,
	resolveEquipmentTags,
	wirePickerTabs,
	withTagLabels
} from "../equipment/equipment.js";
import { MOVE_POOLS, PLAYBOOK_MOVE_PICKER_TEMPLATE, findPlaybookMove, pickerSection } from "../moves/playbook-moves.js";

// Astirs aren't their own documents (see claude.md) — one lives at system.attributes.astir on the
// character actor itself, null/absent meaning "no Astir". Everything below follows the
// catalog-in-code / keys-on-actor split MOVE_POOLS and EQUIPMENT_TAGS already use: definitions
// live here so edited rules text reaches existing characters, and the actor stores only keys.

// An Astir's Core determines which two Approaches it may take — distinct from, and not
// necessarily matching, the character's own system.attributes.approach (see approaches.js).
export const ASTIR_CORES = [
	{ key: "alchemical", label: "Alchemical", approaches: ["mundane", "arcane"] },
	{ key: "crystalline", label: "Crystalline", approaches: ["arcane", "profane"] },
	{ key: "ancient", label: "Ancient", approaches: ["mundane", "divine"] },
	{ key: "natural", label: "Natural", approaches: ["divine", "elemental"] },
	{ key: "occult", label: "Occult", approaches: ["profane", "elemental"] }
];

// Resolves a Core's two Approaches, or an empty list when no Core is chosen yet — the empty list
// is what blanks the Approach select until a Core narrows it (see PlaybookActorSheet).
export function astirCoreApproaches(coreKey, cores = ASTIR_CORES) {
	const core = cores.find((c) => c.key === coreKey);
	return core ? APPROACHES.filter((approach) => core.approaches.includes(approach.key)) : [];
}

// Astirs sit in their own Tier band (3-4), not equipment's TIER_MIN/TIER_MAX (1-5, equipment.js) —
// kept as a separate pair of constants so the two bands can never drift into each other.
export const ASTIR_TIER_MIN = 3;
export const ASTIR_TIER_MAX = 4;

export const ASTIR_POWER_MIN = 0;
export const ASTIR_POWER_BASE = 4;

// A second, separate Power pool only Weapon Conduit unlocks (see ASTIR_PART_CATALOG's
// weaponPowerBonus below) — restricted to weapon-related spends by rules text, but nothing in
// this module spends Power on weapons yet, so this is tracked exactly like the main Power meter
// (manually stepped, clamped to its derived max) rather than actually gated to weapon use.
export const ASTIR_WEAPON_POWER_BASE = 0;

// Matches the img every compendium playbook actor already ships with (see
// src/packs/basic-playbook-*/character_*.json) — used both to seed a newly created Astir and as
// the render-time fallback for an Astir created before this field existed.
export const ASTIR_DEFAULT_IMG = "icons/svg/mystery-man.svg";

// Astir Parts read as moves (see PlaybookActorSheet's Astir Moves group) — same shape as
// BASIC_MOVES (traits/description/results), plus powerCost: how much of the Astir's base Power
// this part permanently spends (see astirMaxPower). partType ("Active"/"Passive") is display-only,
// rendered as a badge in the Astir tab's Parts list. Every part-specific mechanic (Weapon Conduit's
// weaponPowerBonus, Flourish Component's regainPowerOnDoubles, etc.) is a declarative flag read
// generically by PlaybookActorSheet — the same "boolean on the object, evaluated in the sheet"
// convention moves.js already uses for usesWeapon/forcesDesperationAtMaxPerils/
// requiresChannelDisabled (see claude.md, "Anything that depends on actor state..."). Every Active
// part gets a manual uses: [{key: "expended", ...}] checkbox — Subsystems' own rules text
// ("re-activate an expended [Active] Astir part") already assumes every Active part can become
// expended, and this reuses the existing generic uses mechanism with no new rendering code.
// period: "Sortie" — cleared by the Controls tab's Refresh Sortie button (see
// PlaybookActorSheet#_onRefreshSortie); Subsystems' own "spend 1 Power to re-activate" text is a
// separate, unaffected mid-Sortie option, not a substitute for the periodic refresh.
// Exported so ardent.js's own Commander-exclusive Ardent Feature catalog (see ARDENT_FEATURE_PARTS)
// can reuse the identical checkbox shape rather than redefining it.
export const EXPENDED_USE = [{ key: "expended", label: "Expended", period: "Sortie" }];

export const ASTIR_PART_CATALOG = [
	{
		key: "astir-part:extra-arms",
		name: "Extra Arms",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		description:
			"<p>While adding extra arms to an Astir is child's play, properly coordinating them is much " +
			"more complex.</p>" +
			"<p>Two extra arms and hands.</p>"
	},
	{
		key: "astir-part:weapon-conduit",
		name: "Weapon Conduit",
		partType: "Passive",
		traits: [],
		// See ASTIR_WEAPON_POWER_BASE above — a second, separate Power pool, not a reduction of
		// the normal one, so this carries no powerCost.
		weaponPowerBonus: 2,
		description:
			"<p>A magical conduit that compensates for the heavy magical load of certain weaponry, " +
			"trading utility for output.</p>" +
			"<p>+2 Power towards weapons only — tracked as its own Weapon Power meter on the Astir tab.</p>"
	},
	{
		key: "astir-part:divination-codex",
		name: "Divination Codex",
		partType: "Active",
		traits: [],
		// See PlaybookActorSheet#_onMoveActivate: posts Read the Room's real question list to
		// chat and checks Expended, rather than granting hold of its own.
		showsReadTheRoomQuestions: true,
		uses: EXPENDED_USE,
		description:
			"<p>A cross-referenced record of countless common omens, signs and prophecies, easily " +
			"perused by an attuned Channeler in a flash.</p>" +
			"<p>Ask 1 question from the Read the Room list.</p>"
	},
	{
		key: "astir-part:arcane-forge",
		name: "Arcane Forge",
		partType: "Passive",
		traits: [],
		// Extends Cool Off's own outcome menu — Cool Off's outcomes are already narrated rather
		// than enforced, so this is prose only.
		description:
			"<p>A magically-powered forge, capable of casting common Astir supplies and munitions from " +
			"magical energy and a local stock of raw materials.</p>" +
			"<p>You may cool off to resupply an expended weapon.</p>"
	},
	{
		key: "astir-part:flourish-component",
		name: "Flourish Component",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		// See PlaybookActorSheet#_onMoveResolved/roll-effects.js#rolledDoubles.
		regainPowerOnDoubles: true,
		description:
			"<p>Like traditional spellcasting relies on strange gestures, chanting and complex foci to " +
			"provide power, an Astir's design can be complicated in similar ways to achieve much the " +
			"same.</p>" +
			"<p>Regain 1 Power when you roll doubles (once per roll).</p>"
	},
	{
		key: "astir-part:spell-routines",
		name: "Spell Routines",
		partType: "Passive",
		traits: [],
		powerCost: 1,
		// Reuses the existing Guided mechanism (moves.js#postGuidedResult) for any move, not just
		// a usesWeapon move carrying the Guided equipment tag — see PlaybookActorSheet#_rollMove.
		grantsGuided: true,
		description:
			"<p>The battlefield is a busy place, full of countless distractions. It can be helpful to " +
			"let the magic take over sometimes.</p>" +
			"<p>Choose to take a result of 7-9 on a move of your choice, before rolling.</p>"
	},
	{
		key: "astir-part:familiar-matrix",
		name: "Familiar Matrix",
		partType: "Passive",
		traits: [],
		powerCost: 2,
		// Familiars aren't a modeled system in this module (see claude.md, "systems that do not
		// exist yet") — prose only.
		description:
			"<p>Matrices store and coordinate Familiars, making it possible for one Channeler to guide " +
			"many at a time.</p>" +
			"<p>Holds and comes with one set of Familiars of your choice.</p>"
	},
	{
		key: "astir-part:chromatic-focus",
		name: "Chromatic Focus",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		// Approach is already a plain editable dropdown on the Astir tab — swapping it for a
		// Scene needs no new code, just the player changing it and changing it back.
		description:
			"<p>A device capable of twisting and re-aspecting magic. For Channelers that don't like to " +
			"ever be at a disadvantage.</p>" +
			"<p>Swap to any other Approach for a single Scene.</p>"
	},
	{
		key: "astir-part:alchemical-suite",
		name: "Alchemical Suite",
		partType: "Passive",
		traits: [],
		powerCost: 2,
		// See PlaybookActorSheet#_onMoveResolved — grants a Potion of each color when this
		// actor rolls Lead a Sortie. Scope note: the rules text reads as party-wide ("someone
		// leads a Sortie"), but an actor sheet only ever sees its own rolls, so this is scoped to
		// this Astir's own pilot leading the Sortie.
		grantsPotionsOnLeadASortie: true,
		description:
			"<p>A selection of alchemical equipment, capable of storing and mixing useful potions " +
			"before venting them into the cockpit as a vapour to save time.</p>" +
			"<ul>" +
			"<li>Red: Remove a peril related to physical injury or wounds. Metallic.</li>" +
			"<li>Blue: Take advantage when you next weave magic. Fruity.</li>" +
			"<li>Yellow: Take a risk. Act with confidence when you next exchange blows or strike " +
			"decisively. Tangy and sharp.</li>" +
			"</ul>" +
			"<p>Take 1 of each Potion when someone leads a Sortie.</p>"
	},
	{
		key: "astir-part:input-channel",
		name: "Input Channel",
		partType: "Passive",
		traits: [],
		// See PlaybookActorSheet#_moveTraits — offers CHANNEL on any move, bypassing both that
		// move's own traits list and Channel's disabled gate.
		grantsChannelOnAnyMove: true,
		description:
			"<p>Conduit channels running directly from a component to the Channeler allow them to " +
			"assert more direct magical control over it in times of need.</p>" +
			"<p>Make a chosen move with +CHANNEL.</p>"
	},
	{
		key: "astir-part:chameleon-cloak",
		name: "Chameleon Cloak",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		description:
			"<p>They can't hit what they can't see.</p>" +
			"<p>Become invisible for a Scene. The next risk you take is 'revealed'.</p>"
	},
	{
		key: "astir-part:standardised-parts",
		name: "Standardised Parts",
		partType: "Passive",
		traits: [],
		// Grants a restricted Bonus Downtime Tokens pool like any other source (moves/parts/
		// equipment) — see progression-mixin.js's _bonusDowntimeTokensData.
		bonusDowntimeTokens: { max: 1, description: "Repairs only." },
		description:
			"<p>This Astir uses a large amount of common, easy-to-find parts shared with similar " +
			"models. This makes it easy to repair, lightening the load on everyone else.</p>" +
			"<p>Gain +1 token during Downtime to spend on repairs only.</p>"
	},
	{
		key: "astir-part:warding",
		name: "Warding",
		partType: "Active",
		traits: [],
		// No `spend` — this has no `effect`/`advantage` to offer a roll, so (like Ward's own
		// equipment tag) it never appears in the roll dialog at all, regardless of which move is
		// being rolled or what weapon/scale is involved. Its only interaction point is the
		// `uses: EXPENDED_USE` checkbox below, which _moveGroupMoves renders unconditionally (not
		// gated on the Astir being piloted — see move-use-checkbox in the template), so it can be
		// marked used any time.
		uses: EXPENDED_USE,
		description:
			"<p>Anything that helps an Astir not explode is a worthwhile investment.</p>" +
			"<p>You may use this once per Sortie to reduce an incoming source of harm from a peril to " +
			"a risk, or from a risk to nothing (+ward).</p>"
	},
	{
		key: "astir-part:transmutation-link",
		name: "Transmutation Link",
		partType: "Passive",
		traits: [],
		// Aerial/aquatic tags don't exist yet in this module (see claude.md, "systems that do not
		// exist yet") — prose only.
		description:
			"<p>A frame endowed with the ability to shift between two forms quickly, making for a " +
			"versatile Astir.</p>" +
			"<p>+aerial OR +aquatic.</p>"
	},
	{
		key: "astir-part:resistance-charms",
		name: "Resistance Charms",
		partType: "Passive",
		traits: [],
		// Left descriptive — the source a character picks is freeform, and no Danger-source
		// tagging/downgrade system exists in this module.
		description:
			"<p>While it is difficult to offer a broad blanket of protection against damage and " +
			"difficulty, more specific avenues of harm are relatively simple to protect an Astir " +
			"against.</p>" +
			"<p>Examples:</p>" +
			"<ul>" +
			"<li>Replication Rituals (lowers dangers from limb loss). Crawl. Climb. Rip. Tear. Many " +
			"hands make light work.</li>" +
			"<li>Failsafe Channels (lowers dangers from comms disruption). Hear you loud and clear, " +
			"9th. Everyone else went quiet.</li>" +
			"<li>Lightningrod Spines (lowers dangers from electricity). Don't be the fool caught out " +
			"in a storm. Plan ahead.</li>" +
			"</ul>" +
			"<p>Lowers dangers from one chosen source: Peril becomes a Risk, Risk becomes Nothing.</p>"
	},
	{
		key: "astir-part:artifact",
		name: "Artifact",
		partType: "Active",
		traits: [],
		// Offered in the roll dialog's Astir Parts section — checking it forces the roll's
		// Advantage axis to Advantage, unrestricted by which task it's "designed for" (matching
		// this module's existing non-enforcement of similar scope text elsewhere). `spend.description`
		// is a short plain-text summary for that dialog row — the part's own `description` above is
		// rich HTML flavor text, not fit for the roll dialog.
		spend: { advantage: "advantage", description: "Grants advantage towards a task this Artifact is designed for." },
		uses: EXPENDED_USE,
		description:
			"<p>High-quality artifice provides an edge when it is needed most.</p>" +
			"<p>Examples:</p>" +
			"<ul>" +
			"<li>Familiar Sync Rituals — Co-ordination rituals allow a Channeler to better direct " +
			"their familiars, cutting down on the 'attunement drift' common in most matrices.</li>" +
			"<li>Dragonscales — For decades before Astirs became a possibility, craftsmen put " +
			"bartered dragon scales to work as a protective material, never understanding why it " +
			"seemed less durable wrapped around a man than it did around a dragon. Those profitable " +
			"wyrms never let slip quite how much magic ran in their blood.</li>" +
			"<li>Afterburners — An injection of volatile alchemical substances paired with a burst of " +
			"magic can provide a substantial, if short lived, increase in speed. Not for those on a " +
			"shoestring alchemicals budget.</li>" +
			"</ul>" +
			"<p>Grants advantage towards tasks the Artifact is designed for, before or after the " +
			"roll.</p>"
	},
	{
		key: "astir-part:heat-condensers",
		name: "Heat Condensers",
		partType: "Active",
		traits: [],
		uses: EXPENDED_USE,
		// Untick Overheating is already a manual checkbox on the Astir tab — no new code needed
		// for the effect itself.
		description:
			"<p>Stopping to vent heat during a fight can make you a sitting duck—it makes sense then, " +
			"that many Channelers who could care less about managing it carefully opt to invest in " +
			"heat condensers.</p>" +
			"<p>Untick 'overheating' from your Astir.</p>"
	},
	{
		key: "astir-part:complex-spellwork",
		name: "Complex Spellwork",
		partType: "Passive",
		traits: [],
		// The rulebook's cost is Director-assigned (-1 to -4) per pick; this catalog can only
		// carry one fixed number, so it's pinned to the low end and left descriptive about the
		// rest — see claude.md's "Adding move content" table for this project's default stance on
		// effects that don't map onto existing mechanics.
		powerCost: 1,
		description:
			"<p>Sometimes, the key magical functions of an Astir require sacrifice, their complex " +
			"enchantments or rituals taking up power and space.</p>" +
			"<p>Your Director might ask you to take Complex Spellwork to offset a particularly " +
			"powerful or rule-bending Astir Move. This tracks the minimum cost, 1 Power — your " +
			"Director may rule that a given Move costs more (up to 4).</p>"
	}
];

export function findAstirPart(key, catalog = ASTIR_PART_CATALOG) {
	return catalog.find((part) => part.key === key) ?? null;
}

// An Astir Move or Astir Weapon catalog entry's own requiresParts (e.g. the Familiar weapons'
// "requires a Familiar Matrix Astir Part" — see ASTIR_WEAPON_CATALOG below) resolved against a
// list of currently-installed part keys. Mirrors playbook-moves.js's unmetMoveRequirements/
// moveRequirementTooltip exactly, but for Astir Parts rather than moves — kept in this file (not
// playbook-moves.js) since only this module's catalogs know what an Astir Part is; playbook-
// moves.js must not import from astir.js (see claude.md's note on dependency direction).
export function unmetPartRequirements(entry, installedPartKeys = []) {
	return (entry.requiresParts ?? []).filter((key) => !installedPartKeys.includes(key));
}

// Turns a list of missing part keys (from unmetPartRequirements) into the hover-tooltip text, or
// null when nothing's missing — same null-not-empty-string convention as moveRequirementTooltip,
// so callers can Boolean() it directly for `disabled`/`gated`.
export function partRequirementTooltip(missingPartKeys) {
	if (!missingPartKeys.length) return null;
	const names = missingPartKeys.map((key) => findAstirPart(key)?.name ?? key);
	return `Requires ${names.join(", ")} Astir Part${names.length > 1 ? "s" : ""}`;
}

// Drops a part key that no longer resolves — mirrors resolvePlaybookMoves/resolveEquipmentTags.
export function resolveAstirParts(keys = [], catalog = ASTIR_PART_CATALOG) {
	return keys.map((key) => findAstirPart(key, catalog)).filter(Boolean);
}

// Drain's magnitude (tags carry a negative value; this returns the positive total) across every
// weapon actually mounted on the Astir (kind: "weapon", astir: true) — a mundane (Foot-scale)
// weapon's Drain never counts, since it isn't drawing on the Astir's own Power at all, and neither
// does gear (nothing about gear is Astir-specific — see claude.md). An astir: true entry is only
// ever added/edited/removed from the Astir tab, so its presence in the equipment array already
// means "mounted" — there's no separate equipped/carried state to track.
export function astirWeaponDrainTotal(equipment = [], tags = EQUIPMENT_TAGS) {
	return equipment
		.filter((item) => item.kind === "weapon" && item.astir)
		.flatMap((item) => resolveEquipmentTags(item.tags ?? [], tags))
		.filter((tag) => tag.exclusiveGroup === DRAIN_GROUP)
		.reduce((sum, tag) => sum - tag.value, 0);
}

// Weapon Drain is paid out of the dedicated Weapon Power pool first — Weapon Conduit's whole
// purpose is funding weapon-related power draw — and only the leftover spills onto the main Power
// pool. Private: astirMaxPower/astirMaxWeaponPower are the only callers, and both need this split.
function splitWeaponDrain(partKeys, equipment, catalog) {
	const capacity = resolveAstirParts(partKeys, catalog).reduce((sum, part) => sum + (part.weaponPowerBonus ?? 0), 0);
	const drain = astirWeaponDrainTotal(equipment);
	const absorbed = Math.min(drain, capacity);
	return { capacity, absorbed, remainder: drain - absorbed };
}

// An Astir's max Power is its base minus every equipped part's cost, floored at ASTIR_POWER_MIN —
// then minus whatever Weapon Drain didn't fit in the Weapon Power pool (see splitWeaponDrain). That
// remainder is NOT floored: a heavily-Drained loadout can legitimately push max Power negative (see
// PlaybookActorSheet's Piloted guard — negative Power means the Astir can't be piloted until the
// loadout changes). Derived on read (never stored), the same equipmentValue/advancements.topCount
// precedent, so it can't drift after a part or weapon is added/edited/removed.
export function astirMaxPower(partKeys = [], equipment = [], catalog = ASTIR_PART_CATALOG) {
	const cost = resolveAstirParts(partKeys, catalog).reduce((sum, part) => sum + (part.powerCost ?? 0), 0);
	const partsOnlyMax = Math.max(ASTIR_POWER_MIN, ASTIR_POWER_BASE - cost);
	return partsOnlyMax - splitWeaponDrain(partKeys, equipment, catalog).remainder;
}

// The Astir's separate, weapon-only Power pool (see ASTIR_WEAPON_POWER_BASE) — 0 unless Weapon
// Conduit is equipped, minus whatever Weapon Drain has already claimed from that capacity. Never
// negative by construction (absorbed is capped at capacity in splitWeaponDrain) — a fully-claimed
// pool just reads empty; excess Drain spills onto astirMaxPower instead of double-counting here.
// Same derived-on-read treatment as astirMaxPower.
export function astirMaxWeaponPower(partKeys = [], equipment = [], catalog = ASTIR_PART_CATALOG) {
	const { capacity, absorbed } = splitWeaponDrain(partKeys, equipment, catalog);
	return ASTIR_WEAPON_POWER_BASE + capacity - absorbed;
}

// The dedicated catalog for an Astir's one unique move (see astirMoveSections below) — same move
// shape again. Most entries are pure prose (traits: [], no other flags — see claude.md's "Adding
// move content" table); a handful reuse existing declarative flags exactly as playbook moves
// already do, resolved for an Astir Move the same way via moves-mixin.js's _grantingMoves (see
// that file's own comment for why the Astir's move needed its own resolver alongside
// resolvePlaybookMoves).
export const ASTIR_MOVE_CATALOG = [
	{
		key: "astir:goliath-shield",
		name: "Goliath Shield",
		traits: [],
		description:
			"<p>An Astir built to take a hit is an Astir that keeps its allies standing.</p>" +
			"<p>Take advantage when you help or hinder to protect others.</p>"
	},
	{
		key: "astir:legacy",
		name: "Legacy",
		traits: [],
		// "Lead a Sortie with advantage while piloting this Astir" — same grantsAdvantageOnMove
		// shape as the-impostor:dont-follow-me/the-captain:born-leader (playbook-moves.js), resolved
		// here through _grantingMoves rather than resolvePlaybookMoves alone, since this is an Astir
		// Move, not a playbook move.
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
		// ASTIR_WEAPON_CATALOG's familiar: true entries above); their tags stay player-editable via
		// the existing equipment editor, so no code is needed here — the player just edits their
		// Familiar weapon's own tags directly. Only Wisp Familiar carries "limited" today.
		description:
			"<p>This Astir's Familiar Matrix runs on a tighter, more efficient cycle, letting each " +
			"Familiar re-arm faster than most.</p>" +
			"<p>Your Familiars gain the Blitz tag, and lose the Limited tag if they carry it (today, " +
			"only Wisp Familiar does — edit its tags directly on the Equipment tab).</p>"
	},
	{
		key: "astir:mana-devourer",
		name: "Mana Devourer",
		traits: [],
		// "+1 Power" against another Astir with physical harm specifically — an unenforceable
		// precondition folded into the reminder text itself, same technique the-captain:coordinator's
		// own addsSuccessReminderToMove already uses.
		addsSuccessReminderToMove: {
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
		// "Requires an artifact part" — same requiresParts shape the Familiar weapons use above. The
		// "clear a risk" effect itself stays prose: Subsystems (the move it references) has no roll
		// to hook a chat-card reminder onto, the same reasoning astir-part:arcane-forge/astir:cutting-
		// arms/astir:hyperlight-manifold leave their own Subsystems-adjacent effects as prose.
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
		description:
			"<p>Sigils burned into an Astir's own weapons flare brighter the hotter its core runs.</p>" +
			"<p>Untick 'overheating' on your Astir to give your next exchange blows or strike " +
			"decisively advantage.</p>"
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
		description:
			"<p>Some Astirs are built to keep fighting long after the numbers say they should have " +
			"gone down.</p>" +
			"<p>Take advantage when you weather the storm while outnumbered.</p>"
	},
	{
		key: "astir:run-them-down",
		name: "Run Them Down!",
		traits: [],
		description:
			"<p>An Astir built to close distance fast hits twice as hard once it arrives.</p>" +
			"<p>Strike decisively with advantage when striking from a running start.</p>"
	}
];

// The unique Astir move can come from the dedicated catalog above, or from the character's own
// playbook/Cantrips pools (see astirMoveSections) — so resolving a stored key has to check both,
// rather than assuming it's always one of ours.
export function findAstirMove(key, catalog = ASTIR_MOVE_CATALOG) {
	return catalog.find((move) => move.key === key) ?? findPlaybookMove(key) ?? null;
}

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

// Astir weapons are ordinary equipment entries (system.attributes.equipment) flagged astir: true —
// see PlaybookActorSheet — so this catalog matches EQUIPMENT_CATALOG's weapon shape minus
// scale/tier, both of which an Astir weapon always inherits from its Astir rather than storing.
// "Also seen as ..." lines transcribe the rulebook's own re-skin flavor for each entry. Every
// entry is Tier III fiction (an Astir's own
// Tier — see ASTIR_TIER_MIN/MAX — always governs the actual roll, since tier isn't stored here).
//
// `familiar: true` (the last four entries) marks the four Familiar weapons: small constructs
// launched from an Astir, always ranged or sniper per their own rules text. Three of their rules
// are real code, not prose: PlaybookActorSheet#_rollMove rolls Exchange Blows/Strike Decisively
// with a Familiar weapon as +CHANNEL instead of the usual CLASH/TALK choice (see the `familiar`
// check there); every Familiar weapon is an Astir weapon, so it's already subject to the same
// Piloted mutual-exclusivity as any other Astir weapon; and "requires a Familiar Matrix Astir
// Part" is enforced via each entry's own requiresParts — see unmetPartRequirements/
// partRequirementTooltip above and chooseAstirWeapon below, which disable a Familiar weapon in the
// Astir weapon picker (with a tooltip) until Familiar Matrix is installed. The rest — perils from
// a lost Familiar clearing automatically during Downtime — stays descriptive, same "systems that
// don't exist yet" treatment as everywhere else in this module (no Downtime phase is tracked
// anywhere).
export const ASTIR_WEAPON_CATALOG = [
	{
		key: "astir-fists",
		name: "Astir Fists",
		description: "Every Astir can fall back on its fists, but they don't make for graceful brawlers. Also " +
			"seen as Concealed Blades, Close-Range Vulcans, or a Mining Drill.",
		tags: ["melee", "intimate", "blitz"]
	},
	{
		key: "sword-mace-axe-shield",
		name: "Sword/Mace/Axe & Shield",
		description: "An Astir-sized melee weapon paired with a shield makes for a reliable combination. Bones " +
			"and forelimbs of monstrous creatures are often used as sturdy, cheap parts. Also seen as Flame " +
			"Jets, Shielded Gauntlets, or an Energy Field.",
		tags: ["melee", "defensive", "two-handed"]
	},
	{
		key: "forceknife",
		name: "Forceknife",
		description: "Short (for an Astir) blades jacketed in a layer of magical energy, forceknives are good " +
			"for when you find yourself up close and personal. Also seen as a Throwing Glaive, Charged " +
			"Hatchet, or Enchanted Daggers.",
		tags: ["melee", "bane", "intimate"]
	},
	{
		key: "greatarm",
		name: "Greatarm",
		description: "Often almost as tall as the Astirs wielding them, 'greatarms' are the Astir equivalent " +
			"of greatswords, battleaxes, and any other kind of large, simple, 2-handed weapon. Also seen as a " +
			"Godbuster, Laser Flail, or Industrial Saw.",
		tags: ["melee", "area", "two-handed"]
	},
	{
		key: "force-repeater",
		name: "Force Repeater",
		description: "A simple mechanism that rapidly fires short blasts of magical energy, serving as an " +
			"effective reserve weapon. Also seen as a Powerpistol, Mining Laser, or Point-Defense Turret.",
		tags: ["ranged", "defensive", "weak"]
	},
	{
		key: "autoballista",
		name: "Autoballista",
		description: "One of the few non-magical weapons in active use among Channelers. Autoballistae are " +
			"popular for their fire rate, which allows for fending off groups with a spray of bolts as well " +
			"as overwhelming a single Astir with a flurry of shots. Also seen as a Heavy Bowgun, Assault " +
			"Cannon, or Flechette Launcher.",
		tags: ["ranged", "area", "blitz", "bulky", "two-handed"]
	},
	{
		key: "rayrifle",
		name: "Rayrifle",
		description: "Rayrifles are the workhorse of most armies when it comes to arming Astirs. A highly " +
			"efficient charging cycle means every cast uses an almost meaningless amount of magical energy. " +
			"Also seen as a Machine Gun, Arc Staff, or Recycler Rifle.",
		tags: ["ranged", "infinite", "two-handed"]
	},
	{
		key: "magic-missile-array",
		name: "Magic-Missile Array",
		description: "Often mounted on an Astir's shoulder to leave their hands free, magic-missile arrays " +
			"fire a dizzying cluster of magical darts that can be guided by an Astir rather than its " +
			"Channeler. Also seen as Chaser Missiles, a Lock-On Beam, or an Automortar.",
		tags: ["sniper", "guided", "weak"]
	},
	{
		key: "titan-bow",
		name: "Titan Bow",
		description: "Immense, heavily-reinforced longbows, taller than even some Astirs. While some baulk at " +
			"taking a bulky single-shot weapon into the field, others point to the ability to sink an arrow " +
			"through Carrier hulls as a valuable upside. Also seen as a Single-Cast Rifle, Beam Sniper, or " +
			"Abyss Gun.",
		tags: ["sniper", "ruin", "reload", "two-handed"]
	},
	{
		key: "baneblade",
		name: "Baneblade",
		description: "Most Astir pilots do not concern themselves with the scrambling of foot-soldiers. Some of " +
			"these pilots meet very unexpected ends. Also seen as a Blowtorch, Enchanted Broadsword, or Bolt " +
			"Gauntlets.",
		tags: ["melee", "bane", "two-handed"]
	},
	{
		key: "warp-slinger",
		name: "Warp-Slinger",
		description: "An emplaced device incorporating multiple wands linked to a simple firing ritual that can " +
			"be triggered by even those not gifted with magic. Also seen as an MG Turret, Point Laser, or " +
			"Multi-Crossbow.",
		tags: ["ranged", "blitz", "infinite", "huge"]
	},
	{
		key: "ardent-rifle",
		name: "Ardent Rifle",
		description: "A large two-handed tool that fires searing bolts of light, capable of burning through " +
			"even an Astir's defences. Typically used by ardents, due to its weight. Also seen as an " +
			"Arbalest, Flame Staff, or Greatbow.",
		tags: ["ranged", "bane", "two-handed"]
	},
	{
		key: "seeker-cluster",
		name: "Seeker Cluster",
		description: "Guided by a faint magical intelligence, this device lets loose a swarm of small magical " +
			"crystals to hound a particular target. Though they struggle to pierce armour, these crystals " +
			"shatter on impact, resulting in sharp shrapnel. Also seen as Orbiting Motes, a Shock Rod, or " +
			"Command Bracelets & Drone.",
		tags: ["ranged", "guided", "defensive", "reload", "messy"]
	},
	{
		key: "ardentpiercer",
		name: "Ardentpiercer",
		description: "Immense lances designed to punch through armour plating, ardentpiercers are heavy " +
			"enough that they must be held in place and used as a charging weapon—just swinging one around " +
			"is unlikely to deliver results. Also seen as a Ceremonial Pike, Heavy Estoc, or Pile Bunker.",
		tags: ["melee", "impact", "decisive", "set-up", "drain-1"]
	},
	{
		key: "forceblade",
		name: "Forceblade",
		description: "Your typical, garden-variety sword made out of projected magical force. It cuts well " +
			"and won't explode - what else do you want? Also seen as a Beam Saber, Thermal Cutter, or " +
			"Pneumatic Hammer.",
		tags: ["melee", "bane", "drain-1"]
	},
	{
		key: "basilisk-lance",
		name: "Basilisk Lance",
		description: "An uncommon weapon, basilisk lances house a lens composed of dozens of magically " +
			"preserved basilisk eyes. When a certain energy is passed through this lens, a petrifying beam " +
			"is produced. Also seen as a Chemical Jet, Beam Rifle, or Plasma Repeater.",
		tags: ["ranged", "bane", "restraining", "drain-1", "two-handed"]
	},
	{
		key: "blazewands",
		name: "Blazewands",
		description: "Arranged in paired racks and crafted using subdued motes of elemental fire, short-range " +
			"wands are a common and potent weapon when it comes to arming Astirs. Also seen as Grenade " +
			"Launchers, Acid Pods, or a Plasma Mortar.",
		tags: ["ranged", "versatile", "reload", "drain-1"]
	},
	{
		key: "burstcaster",
		name: "Burstcaster",
		description: "Burstcasters launch a projectile that discharges a spell on impact—typically some kind " +
			"of dramatic fireball. The wand projectile only arms past a certain distance, to prevent a " +
			"Channeler from being caught in their own fireball. Also seen as a Rocket Launcher, Fireball " +
			"Cannon, or Reactor Rifle.",
		tags: ["ranged", "area", "bane", "two-handed"]
	},
	{
		key: "novawhip",
		name: "Novawhip",
		description: "Concentrated motes of fire slumber at equal lengths along this whip, and violently " +
			"detonate on impact. A devastating weapon in skilled hands that know how to recharge the motes " +
			"mid-battle. Also seen as Chain Mines, a Plasma Cable, or Storm Gauntlet.",
		tags: ["melee", "area", "vorpal", "dangerous", "drain-1"]
	},
	{
		key: "ruinblade",
		name: "Ruinblade",
		description: "Long, slender, and fragile—ruinblades are long swords edged with arcane-charged " +
			"crystal, allowing them to cut through even Carrier hulls. Just try not to break it. Also seen " +
			"as a Decay Lance, Null-space Projector, or Hi-Beam Saber.",
		tags: ["melee", "ruin", "decisive", "fragile", "drain-2"]
	},
	{
		key: "overcharged-bolts",
		name: "Overcharged Bolts",
		description: "If in need of something punchier, you can take very standard Astir equipment—a simple " +
			"lightning bolt spell, for example—and simply feed it far, far more magical energy than " +
			"expected. Also seen as a Gatling Gun, Gauss Rifle, or Beam Rifle.",
		tags: ["sniper", "ruin", "drain-2"]
	},
	{
		key: "spellcannon",
		name: "Spellcannon",
		description: "A heavy, devastating weapon. Though it demands magic such that few Channelers can " +
			"muster more than a handful of shots, the results are easily worth the expense. Also seen as an " +
			"Assault Cannon, Heavy Beam Rifle, or Anti-Materiel Rifle.",
		tags: ["ranged", "versatile", "blitz", "drain-2", "two-handed"]
	},
	{
		key: "chaos-revolver",
		name: "Chaos Revolver",
		description: "A thick, metal wand with a pistol-style grip. The rotating chambers are filled with " +
			"overcharged and desecrated crystals, the magical output of which is immense (and volatile). " +
			"Also seen as a Fusion Pistol, Acid Thrower, or Planar Displacer.",
		tags: ["ranged", "ruin", "drain-2", "messy", "profane"]
	},
	{
		key: "storm-axe",
		name: "Storm Axe",
		description: "A handheld hatchet, insulated to protect its user and engraved with sigils that " +
			"perpetuate a constant flow of thunderous magic. Also seen as a Plasma Blade, Chainsword, or " +
			"Powered Hammer.",
		tags: ["melee", "vorpal", "drain-2"]
	},
	{
		key: "wisp-familiar",
		name: "Wisp Familiar",
		description: "Wisps are by far the most common familiar, and for most people are synonymous with the " +
			"word. Small floating constructs that pack a surprising punch for their size, wisps are limited " +
			"by the short lifespan on their magic. Also seen as an Assault Funnel, Fire Spirits, or Attack " +
			"Drones. Familiar — requires a Familiar Matrix Astir Part; rolls +CHANNEL for Exchange Blows and " +
			"Strike Decisively; perils from its loss clear automatically during Downtime (untracked by this " +
			"module — clear them yourself).",
		tags: ["ranged", "area", "limited"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "mote-familiar",
		name: "Mote Familiar",
		description: "Motes are primed with conflagration magic, and detonate in a fiery blaze when impacted " +
			"against a target. Channelers tend to use them only when needed, since if shot the explosions " +
			"tend to set off other nearby motes. Also seen as Remote Bombs, Volatile Elements, or " +
			"Lev-Grenades. Familiar — requires a Familiar Matrix Astir Part; rolls +CHANNEL for Exchange " +
			"Blows and Strike Decisively; perils from its loss clear automatically during Downtime " +
			"(untracked by this module — clear them yourself).",
		tags: ["sniper", "impact", "bane", "dangerous"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "needle-familiar",
		name: "Needle Familiar",
		description: "Needle Familiars pin their targets in place with thin, iron spikes. While lacking when " +
			"it comes to decisive blows, they excel at restraining and harassing foes. Also seen as a Glue " +
			"Turret, Labour Drones, or Medusa Heads. Familiar — requires a Familiar Matrix Astir Part; rolls " +
			"+CHANNEL for Exchange Blows and Strike Decisively; perils from its loss clear automatically " +
			"during Downtime (untracked by this module — clear them yourself).",
		tags: ["ranged", "restraining", "weak"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "claw-familiar",
		name: "Claw Familiar",
		description: "Sharp-clawed contraptions of magic and stone, in the familiar shape of a crow. Also " +
			"seen as Trained Wolves, Raven Ghosts, or Saw Drones. Familiar — requires a Familiar Matrix Astir " +
			"Part; rolls +CHANNEL for Exchange Blows and Strike Decisively; perils from its loss clear " +
			"automatically during Downtime (untracked by this module — clear them yourself).",
		tags: ["ranged", "defensive", "distinct"],
		familiar: true,
		requiresParts: ["astir-part:familiar-matrix"]
	},
	{
		key: "touch-spells",
		name: "Touch Spells",
		description: "A focusing gesture and a whispered word, channeled straight through the caster's " +
			"own hands into whatever — or whoever — they touch.",
		tags: ["melee", "bane"]
	}
];

export function findCatalogAstirWeapon(key, catalog = ASTIR_WEAPON_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

// Opens the "+" picker for an Astir Part and resolves the chosen part's key, or null if dismissed
// or nothing was selected — same promise/Dialog/resolve-null shape as choosePlaybookMove, and the
// same "already-picked options drop out" treatment (a part, like a playbook move, only makes sense
// picked once). Reuses the equipment catalog picker template: {key, name, description} is exactly
// what it renders. `title` is overridable so ardent.js can reuse this same picker (against a
// filtered catalog — see ardentParts) with Ardent-appropriate copy, rather than a second dialog.
export async function chooseAstirPart(selectedKeys = [], catalog = ASTIR_PART_CATALOG, { title = "Add an Astir Part" } = {}) {
	const items = catalog.filter((part) => !selectedKeys.includes(part.key));
	const { tagGroups, hasTags } = buildTagReference(items);
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, {
		items: items.map((item) => withTagLabels(item)),
		itemsTabLabel: "Parts",
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring (equipment.js).
			render: wirePickerTabs,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(html.find("[name='catalog-item']:checked").val() ?? null)
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}

// Opens the "O" catalog picker for an Astir weapon and resolves the chosen template (for passing
// into configureEquipment, same as chooseEquipmentCatalogItem's own callers), or null. Unlike
// chooseAstirPart, nothing is excluded — an Astir can carry more than one of the same weapon
// template, same as regular equipment. `title` is overridable for the same reason chooseAstirPart's
// is — see ardent.js's ardentWeapons. `installedPartKeys` gates any entry whose own requiresParts
// isn't fully met (the four Familiar weapons today) — visible but disabled, with a tooltip, rather
// than excluded outright (see unmetPartRequirements/partRequirementTooltip above); a caller with no
// concept of installed parts (ardent.js's own weapon flows) just passes [], which gates nothing
// since no Ardent-eligible catalog entry carries requiresParts.
export async function chooseAstirWeapon(catalog = ASTIR_WEAPON_CATALOG, installedPartKeys = [], { title = "Pick an Astir Weapon" } = {}) {
	const { tagGroups, hasTags } = buildTagReference(catalog);
	const items = catalog.map((item) => {
		const tooltip = partRequirementTooltip(unmetPartRequirements(item, installedPartKeys));
		return { ...withTagLabels(item), disabled: Boolean(tooltip), tooltip };
	});
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, {
		items,
		itemsTabLabel: "Weapons",
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			// See chooseAstirPart's own render comment — must be DialogData.render, not an options
			// field, for Foundry to actually invoke it.
			render: wirePickerTabs,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(findCatalogAstirWeapon(html.find("[name='catalog-item']:checked").val(), catalog))
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}

// Builds the picker tree for an Astir's one unique move: the character's own playbook pool, then
// Cantrips, then the dedicated Astir Moves catalog above — deliberately not playbookMoveSections'
// full tree (which would also offer Soldier Moves and every other playbook's pool). Reuses
// pickerSection/pickerMove from playbook-moves.js so a section's shape (and its "drop when empty"
// treatment) can't drift from the playbook-move picker's. `pools`/`astirCatalog` stay injectable
// for the same fixture-testing reason MOVE_POOLS/EQUIPMENT_CATALOG's own consumers do.
// `installedPartKeys` gates any move whose own requiresParts isn't fully met (mechanism only today
// — ASTIR_MOVE_CATALOG's placeholder entry carries none — but every section built here, including
// the actor's own playbook/Cantrips pools, gets the same Astir-Part gating via pickerSection's
// extraTooltip hook, for whenever real content adds one).
export function astirMoveSections(
	playbookName,
	selectedKeys = [],
	pools = MOVE_POOLS,
	astirCatalog = ASTIR_MOVE_CATALOG,
	installedPartKeys = []
) {
	const sections = [];
	const extraTooltip = (move) => partRequirementTooltip(unmetPartRequirements(move, installedPartKeys));

	const ownPool = pools.find((pool) => pool.playbookName && pool.playbookName === playbookName);
	if (ownPool) {
		const section = pickerSection(ownPool, selectedKeys, { note: "Your playbook.", open: true, extraTooltip });
		if (section) sections.push(section);
	}

	const cantrips = pools.find((pool) => pool.key === "cantrips");
	if (cantrips) {
		const section = pickerSection(cantrips, selectedKeys, { extraTooltip });
		if (section) sections.push(section);
	}

	const astirSection = pickerSection(
		{ key: "astir-moves", label: "Astir Moves", moves: astirCatalog },
		selectedKeys,
		{ extraTooltip }
	);
	if (astirSection) sections.push(astirSection);

	return sections;
}

// Opens the "+" picker for the Astir's unique move and resolves the chosen key, or null. Mirrors
// choosePlaybookMove's Dialog options (including its resizable/numeric-height note) since it
// reuses the exact same template.
export async function chooseAstirMove(
	playbookName,
	selectedKeys = [],
	pools = MOVE_POOLS,
	astirCatalog = ASTIR_MOVE_CATALOG,
	installedPartKeys = []
) {
	const sections = astirMoveSections(playbookName, selectedKeys, pools, astirCatalog, installedPartKeys);
	const content = await renderTemplate(PLAYBOOK_MOVE_PICKER_TEMPLATE, { sections });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose an Astir Move",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(html.find("[name='playbook-move']:checked").val() ?? null)
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "playbook-move-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}
