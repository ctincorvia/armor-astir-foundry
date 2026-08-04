import { PLAYBOOKS, swapActorPlaybook } from "./actor-creation.js";
import { APPROACHES, availableApproaches } from "./approaches.js";
import { gravityTriggerForPlaybook } from "./gravity-triggers.js";
import { defaultConsiderText, defaultLookText } from "./playbook-flavor.js";
import {
	BASIC_MOVES,
	MOVE_CHAT_TEMPLATE,
	MOVE_RESULT_LABELS,
	SPECIAL_MOVES,
	availableMoveTraits,
	configureMoveRoll,
	postGuidedResult,
	postMoveDescription,
	rollMove
} from "./moves.js";
import { TRAITS } from "./traits.js";
import { rolledDoubles } from "./roll-effects.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "./advancements.js";
import { ALL_PLAYBOOK_MOVES, choosePlaybookMove, resolvePlaybookMoves } from "./playbook-moves.js";
import {
	UNARMED,
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	chooseWeapon,
	configureEquipment,
	equipmentValue,
	findEquipmentTag,
	resolveEquipmentTags
} from "./equipment.js";
import { chooseStartingGear, findStartingGearPool } from "./starting-gear.js";
import { chooseStartingMoves, findStartingMovePool } from "./starting-moves.js";
import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MOVE_CATALOG,
	ASTIR_PART_CATALOG,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirCoreApproaches,
	astirMaxPower,
	astirMaxWeaponPower,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon,
	findAstirMove,
	findAstirPart,
	resolveAstirParts
} from "./astir.js";
import {
	ARDENT_DEFAULT_NAME,
	ARDENT_FEATURE_PARTS,
	ARDENT_FEATURE_WEAPONS,
	ARDENT_MAX_LOADOUT,
	ARDENT_TIER_DEFAULT,
	ARDENT_TIER_MAX,
	ARDENT_TIER_MIN,
	ardentBaselineLoadoutCount,
	ardentFeatureLoadoutCount,
	ardentFeatureMax,
	ardentParts,
	ardentWeapons,
	buildArdent,
	chooseFrame,
	isAceFeaturePart
} from "./ardent.js";
import { chooseCarrier, findCarrierActors } from "./carrier-actor-sheet.js";
import { traitBonusesFor } from "./trait-bonuses.js";
import { addEntry, removeEntry, updateEntryField } from "./entry-list.js";
import {
	CLOCK_STEPS_DEFAULT,
	CLOCK_STEPS_MAX,
	CLOCK_STEPS_MIN,
	addClock,
	removeClock,
	setClockProgress,
	updateClockLabel,
	updateClockSteps
} from "./clocks.js";

export const PLAYBOOK_SHEET_TEMPLATE = "modules/armor-astir/templates/playbook-actor-sheet.hbs";

export { TRAITS };

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

// Matches the highest per-tier hold any basic move currently grants (read-the-room's 3 on a
// 10+); also reused as the cap for every flatHold move's own separately-tracked pool (see
// _moveGroupMoves) since all of them cap at 3 today. Revisit if a future move grants more.
const HOLD_MIN = 0;
const HOLD_MAX = 3;

const SPOTLIGHT_MIN = 0;
const SPOTLIGHT_MAX = 6;

// Downtime Tokens (Downtime tab): a per-Sortie resource refreshed to _downtimeTokensMax() by the
// Refresh Sortie control (see _onRefreshSortie). DOWNTIME_TOKENS_MAX_BASE (3) is the floor every
// character starts with; a picked move can raise it via its own declarative downtimeTokensMax flag
// (Commander's Debrief: 4 total) — see _downtimeTokensMax, which takes the max across picked moves
// the same way _conflictTier takes the max across conflictTier flags.
const DOWNTIME_TOKENS_MIN = 0;
const DOWNTIME_TOKENS_MAX_BASE = 3;

// A character's Tier for all physical-conflict purposes is 1 by default unless a picked playbook
// move raises it (Field Scout, Giant Slayer — see playbook-moves.js's conflictTier). Deliberately
// its own constant rather than reusing equipment's TIER_MIN or the Astir's own ASTIR_TIER_MIN —
// astir.js keeps those two bands from drifting into each other; a character's on-foot Tier is a
// third, independent band (see claude.md's Character Tier notes).
const CHARACTER_TIER_DEFAULT = 1;

// Ceiling across every playbook today (see claude.md's Dangers notes) — none currently need the
// occasionally-mentioned 4, so this stays a flat constant rather than a per-playbook field until
// one actually does.
const DANGER_MAX = 3;

const GRAVITY_CLOCK_MAX = 5;
// Progress track reuses Spotlight's exact length/interaction (see _onGravityClockStep).
const GRAVITY_CLOCK_PROGRESS_MIN = 0;
const GRAVITY_CLOCK_PROGRESS_MAX = 6;
const GRAVITY_CLOCK_VALUE_MIN = 1;
const GRAVITY_CLOCK_VALUE_MAX = 3;

// How many of the six top Advancement checklist items unlock the bottom four (see advancements.js).
const ADVANCEMENT_UNLOCK_THRESHOLD = 3;

// Every catalog an Ardent's own parts array might reference — the generic Astir-derived one every
// playbook's Ardent draws from (ASTIR_PART_CATALOG, via ardentParts()) plus Commander's exclusive
// Ardent Features (ARDENT_FEATURE_PARTS, see ardent.js) — used wherever an Ardent's stored part keys
// need resolving, since a Commander's Ardent can carry keys from either catalog at once.
const ARDENT_PART_CATALOG = [...ASTIR_PART_CATALOG, ...ARDENT_FEATURE_PARTS];

// All groups share one flat list for key lookup (_onMoveRoll/_onMoveDescription) since a move's
// section (Basic vs Special vs Playbook vs Astir) is purely a sheet-display grouping, not part of
// its identity. Playbook/Astir move keys are pool-prefixed (see playbook-moves.js/astir.js) so
// this stays collision-free as pools fill in. ARDENT_PART_CATALOG (which already includes
// ASTIR_PART_CATALOG) and ASTIR_MOVE_CATALOG are flattened in whole, the same "every possible
// entry, not just what's picked" treatment ALL_PLAYBOOK_MOVES already gives MOVE_POOLS — an
// individual actor's picked subset is resolved separately (see resolveAstirParts/findAstirMove in
// getData). Ardent Features need to be in this flat list too — Roll/Activate/Description buttons,
// Refresh Sortie's uses-clearing walk, and the roll dialog all resolve a move purely by key here,
// regardless of which catalog it actually lives in.
const ALL_MOVES = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES, ...ARDENT_PART_CATALOG, ...ASTIR_MOVE_CATALOG];

// Moves that represent attacking with a weapon (see moves.js's usesWeapon). Drives both
// _onMoveRoll's weapon-choice prompt and the per-weapon quick-roll buttons in the Equipment tab
// (see _equipmentEntry).
const WEAPON_MOVES = ALL_MOVES.filter((move) => move.usesWeapon);

// Merges a batch of {equipmentId, tagKey} spends into an equipment array's per-entry `spent`
// list. Shared by PlaybookActorSheet#_spendEquipmentTags (a player-chosen or forced spend, ahead
// of the roll it modifies) and handleReroll below (a reroll tag, spent after the fact — from
// outside any PlaybookActorSheet instance, since a chat-card click isn't tied to one).
export function mergeSpentTags(equipment, spentTags) {
	return equipment.map((item) => {
		const additions = spentTags.filter((spend) => spend.equipmentId === item.id).map((spend) => spend.tagKey);
		if (!additions.length) return item;
		return { ...item, spent: [...new Set([...(item.spent ?? []), ...additions])] };
	});
}

// All playbook actors are "character" type (see claude.md, "Domain conventions"). Every
// playbook shares the same name/callsign/photo header, so one sheet class and template
// serves all of them; a playbook that needs its own fields can extend this later.
export class PlaybookActorSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: PLAYBOOK_SHEET_TEMPLATE,
			// Matches styles/playbook-actor-sheet.css's min-width floor — keeping them in sync avoids
			// Foundry's tracked position starting narrower than the CSS floor allows it to render.
			width: 760,
			// Deliberately not "auto": core Application#setPosition special-cases options.height === "auto"
			// by re-measuring content and resetting el.style.height on every position update, including
			// every mousemove while dragging the resize handle — so the window could never be dragged
			// shorter than its content. Falls back to ActorSheet's own default (720, resizable: true);
			// .sheet-body's internal scroll (see styles/playbook-actor-sheet.css) covers whatever the
			// fixed height cuts off.
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
		});
	}

	// Dangers' add-controls (label input + type select) are a mini form, not a one-click "add a
	// blank entry" action like the other header "+" buttons, so its "+" toggles the row open/shut
	// instead of opening a dialog. Transient UI state, not actor data — lives on the sheet instance
	// and resets whenever the sheet is fully closed and reopened.
	_dangerAddOpen = false;

	getData(options) {
		const data = super.getData(options);
		data.playbooks = PLAYBOOKS;
		data.currentPlaybookId = PLAYBOOKS.find((p) => p.name === this.actor.system.playbook?.name)?.packId ?? null;
		data.approachOptions = availableApproaches(this.actor.system.playbook?.slug);
		data.gravityTrigger = gravityTriggerForPlaybook(this.actor.system.playbook?.slug);
		// Look/Consider editors on the Cosmetic tab start pre-filled with the playbook's own
		// flavor prompts (see playbook-flavor.js) until the player has saved text of their own —
		// once system.details.look/consider.value is set, that stored value wins. This is only
		// the *display* fallback for the brief window before _seedCosmeticDefaults' own write
		// resolves (see activateListeners) — real editing reads straight from the actor.
		const playbookSlug = this.actor.system.playbook?.slug;
		data.lookText = this.actor.system.details?.look?.value || defaultLookText(playbookSlug);
		data.considerText = this.actor.system.details?.consider?.value || defaultConsiderText(playbookSlug);
		// Gates the Ace Crew roster (Social tab) and the Custom Ardent's own "Add Ardent Feature"
		// controls (Astir & Ardents tab) — both exclusive to Commander (see ardent.js's
		// ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS and claude.md's Commander notes). No Handlebars
		// equality helper is registered in this module, so the comparison happens here instead.
		data.isCommander = playbookSlug === "the-commander";
		// Rendered next to the Approach select in the header — see claude.md's Character Tier
		// notes: on-foot Tier and Approach are the same kind of "how you fight outside your Astir"
		// property. Derived fresh every render, not stored — see _conflictTier.
		data.tier = this._conflictTier();
		// Derived Trait bonuses (Arcane Augments, Let Loose — see trait-bonuses.js) computed once and
		// reused for both display (bonus/total below) and every roll dialog opened from this render
		// (_moveTraits), so a picked bonus move is never evaluated against two different Danger/
		// Burden counts within the same render pass.
		const traitBonuses = this._traitBonuses();
		data.traits = TRAITS.map(({ key, label }) => {
			const stat = this.actor.system.stats?.[key];
			const value = stat?.value ?? 0;
			const bonus = traitBonuses[key] ?? 0;
			return { key, label, value, bonus, total: value + bonus, disabled: stat?.disabled ?? false };
		});
		const astir = this._astir();
		// Spotlight is a single 0-6 counter (system.attributes.spotlight.value) rendered as 6
		// steps filled from the bottom up — always visible (not Channel-gated) since it tracks
		// whose turn it is in the fiction, not an Astir/Channel resource.
		const spotlightValue = this.actor.system.attributes?.spotlight?.value ?? 0;
		data.spotlight = {
			value: spotlightValue,
			steps: Array.from({ length: SPOTLIGHT_MAX }, (_, i) => ({ step: i + 1, filled: i + 1 <= spotlightValue }))
		};
		// Downtime Tokens live on their own Downtime tab. max is derived from picked moves (see
		// _downtimeTokensMax, e.g. Commander's Debrief) — value defaults to a fresh max, since a new
		// character starts a Sortie with a full pool.
		const downtimeTokensMax = this._downtimeTokensMax();
		data.downtimeTokens = {
			value: this.actor.system.attributes?.downtimeTokens?.value ?? downtimeTokensMax,
			max: downtimeTokensMax
		};
		// Basic and Special moves are the same fixed list for every actor; Playbook Moves is the
		// per-actor set picked via the "+" button, so it's the only group that renders add/remove
		// controls (see the template's addable/removable branches). All three run through the same
		// _moveGroupMoves, so a picked move gets trait filtering, gating, hold tracking and its
		// Roll/Activate/Description buttons with no extra handling. Display order is basic, then
		// playbook, then Astir (if any), then special — the character's own moves read before the
		// fixed reference lists, moveGroups[0] staying Basic for existing tests.
		// The "+ Choose Starting Moves" button (see _onStartingMovesAdd) shows up whenever its
		// playbook's pool has something to offer AND the actor currently has no playbook moves at
		// all — same "drop when empty" treatment equipment's startingGear.available already gets,
		// so Commander/Impostor stay hidden until their pools are filled in (see starting-moves.js).
		// This is a live emptiness check, not a one-time flag: cancelling the picker leaves the
		// button available to retry, and removing every playbook move via "-" brings it back.
		const startingMovePool = findStartingMovePool(this.actor.system.playbook?.name);
		data.moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES) },
			{
				label: "Playbook Moves",
				moves: this._moveGroupMoves(resolvePlaybookMoves(this._playbookMoves())),
				addable: true,
				removable: true,
				startingMovesAvailable: Boolean(
					startingMovePool?.grantedKeys?.length || startingMovePool?.pickOneKeys?.length || startingMovePool?.chooseCount
				) && this._playbookMoves().length === 0
			}
		];
		// Astir Parts read as moves, and the Astir's one unique move joins them under the same
		// group — both are picked/removed only from the Astir tab (see _onAstirPartAdd/
		// _onAstirMoveAdd), so unlike Playbook Moves this group renders no add/remove controls of
		// its own. Inserted here (rather than always pushed) so it lands between Playbook and
		// Special per the ordering above, and only when there's something to show — a character
		// with no Astir (or an empty one) leaves moveGroups exactly as it was before this feature
		// existed. Each Ardent's own installed parts get the same read-only treatment in their own
		// "<name> Moves" group, right after the Astir's — Ardents grant no unique Move (see
		// claude.md's Ardents section), so an Ardent's group is parts-only.
		const astirParts = this._astirParts();
		const astirMove = astir?.move ? findAstirMove(astir.move) : null;
		const astirMoves = [...astirParts, ...(astirMove ? [astirMove] : [])];
		const frames = this._frames();
		const mountedFrame = frames.find((frame) => frame.piloted) ?? null;
		if (astirMoves.length) {
			// Every entry in this group — parts and the Astir's own unique move alike — only does
			// anything while the Astir specifically is the mounted frame (see claude.md's Piloted
			// note), so `gated` is forced on top of whatever gating a part already has, the same
			// disabled-Roll/Activate treatment channelGated already gives b-plot.
			data.moveGroups.push({
				label: "Astir Moves",
				moves: this._moveGroupMoves(astirMoves).map((move) => ({ ...move, gated: move.gated || mountedFrame?.id !== "astir" }))
			});
		}
		const ardents = this._ardents();
		for (const ardent of ardents) {
			const parts = resolveAstirParts(ardent.parts ?? [], ARDENT_PART_CATALOG);
			if (!parts.length) continue;
			data.moveGroups.push({
				label: `${ardent.name || ARDENT_DEFAULT_NAME} Moves`,
				moves: this._moveGroupMoves(parts).map((move) => ({ ...move, gated: move.gated || mountedFrame?.id !== ardent.id }))
			});
		}
		data.moveGroups.push({ label: "Special Moves", moves: this._moveGroupMoves(SPECIAL_MOVES) });
		// Custom-made equipment (see claude.md, "Domain conventions") — never picked from a list,
		// so unlike moves there's no shared catalog of equipment itself, only of the Tags that can
		// be attached to it (see equipment.js). One array partitioned by `kind` (and, for weapons,
		// by the astir flag) rather than several separate arrays, since add/edit/remove and tag
		// resolution are identical either way and only the render needs to tell them apart. Weapons
		// get their own header per claude.md; tierMin/tierMax feed the tab's Tier stepper bounds.
		const equipment = this._equipment();
		// The Equipment tab's per-weapon quick-roll buttons (see _onWeaponMoveRoll) — computed once
		// and attached to every weapon entry below, rather than living once under data.equipment
		// and cross-referenced from inside the weapons {{#each}}, which would need a riskier
		// `../equipment.weaponMoves` template lookup. Reusing _moveGroupMoves (rather than
		// hand-rolling gating) means these buttons inherit the exact same, already-tested `gated`
		// semantics as the Moves tab's own Roll buttons for free.
		// A weapon's quick-roll buttons only work while its own owning frame is the one currently
		// mounted (see claude.md's Piloted note and _weaponFrameId) — a mundane weapon's frame id is
		// null, so `frameWeaponMoves(null)` gates it whenever anything at all is mounted. Every
		// frame's set is derived independently from the same ungated base rather than negating one
		// another, so mounting frame A can never accidentally leave frame B's buttons enabled too.
		const baseWeaponMoves = this._moveGroupMoves(WEAPON_MOVES).map(({ key, name, gated }) => ({ key, name, gated }));
		const mountedFrameId = mountedFrame?.id ?? null;
		const frameWeaponMoves = (frameId) => baseWeaponMoves.map((move) => {
			const frameMismatch = mountedFrameId !== frameId;
			return {
				...move,
				gated: move.gated || frameMismatch,
				tooltip: frameMismatch ? this._weaponGateTooltip(frameId, mountedFrameId) : null
			};
		});
		const weaponMoves = frameWeaponMoves(null);
		const astirWeaponMoves = frameWeaponMoves("astir");
		// The "+ Choose Starting Gear" button (see _onStartingGearAdd) only shows up once its
		// playbook's pool actually has something to offer AND the actor's equipment is currently
		// empty — same "drop when empty" treatment playbookMoveSections gives an empty pool, so The
		// Commander stays hidden until its pool is filled in (see starting-gear.js). This is a live
		// emptiness check, not a one-time flag: cancelling every dialog it opens leaves the button
		// available to retry, and removing every equipment entry brings it back — unlike "+ Add
		// Playbook Move"/"+ Add Weapon"/"+ Add Gear", which are always offered regardless.
		const startingGearPool = findStartingGearPool(this.actor.system.playbook?.name);
		// Astir weapons (equipment entries flagged astir: true — see astir.js) are only ever
		// added/edited/removed from the Astir tab, but still surface here, read-only, per
		// claude.md — same computed entries feed both data.equipment.astirWeapons (Equipment tab)
		// and data.astir.weapons (Astir tab) below, so there's only one place resolving them. Each
		// Ardent's own weapons (equipment entries flagged ardent: "<ardentId>") get the same
		// treatment, grouped per Ardent — see ardentWeaponEntriesById below, shared between
		// data.equipment.ardentWeapons (flattened, Equipment tab) and each entry in data.ardents'
		// own .weapons (Astir & Ardents tab).
		const astirWeapons = equipment
			.filter((item) => item.kind === "weapon" && item.astir)
			.map((item) => this._equipmentEntry(item, astirWeaponMoves, astir));
		const ardentWeaponEntriesById = new Map(ardents.map((ardent) => [
			ardent.id,
			equipment
				.filter((item) => item.kind === "weapon" && item.ardent === ardent.id)
				.map((item) => this._equipmentEntry(item, frameWeaponMoves(ardent.id), ardent))
		]));
		data.equipment = {
			weapons: equipment
				.filter((item) => item.kind === "weapon" && !item.astir && !item.ardent)
				.map((item) => this._equipmentEntry(item, weaponMoves)),
			astirWeapons,
			ardentWeapons: ardents.flatMap((ardent) => ardentWeaponEntriesById.get(ardent.id)),
			gear: equipment.filter((item) => item.kind !== "weapon").map((item) => this._equipmentEntry(item)),
			startingGear: {
				available: Boolean(
					startingGearPool?.grantedItems?.length
						|| startingGearPool?.groups?.some((group) => group.items.length)
						|| startingGearPool?.customWeaponNote
				) && equipment.length === 0
			}
		};
		// The Astir tab. Gated on CHANNEL exactly like the old overheating/power meters were
		// (missing stats.channel reads as enabled, not disabled) — but unlike those, "unavailable"
		// still renders a nav item and a locked note (see the template) rather than disappearing,
		// so a player can see why it's there but inert. exists is false either when no Astir has
		// ever been created, or after it's been deleted — Create/Delete are the only ways in or out.
		data.astir = {
			available: !this.actor.system.stats?.channel?.disabled,
			exists: Boolean(astir),
			cores: ASTIR_CORES,
			tierMin: ASTIR_TIER_MIN,
			tierMax: ASTIR_TIER_MAX,
			...(astir && {
				// Always the character's own Callsign (see claude.md, "Domain conventions") — an
				// Astir has no name of its own to set here, only to display.
				name: this.actor.system.details?.callsign?.value || this.actor.name,
				img: astir.img || ASTIR_DEFAULT_IMG,
				core: astir.core ?? "",
				approachOptions: astirCoreApproaches(astir.core),
				approach: astir.approach ?? "",
				tier: astir.tier ?? ASTIR_TIER_MIN,
				overheating: astir.overheating ?? false,
				// Gates every part/Astir-weapon benefit (see claude.md's Piloted note) — unchecked
				// by default (see _onAstirCreate). Managing the loadout itself (add/remove/edit
				// Parts, the Astir Move, Astir weapons) is never gated by this.
				piloted: Boolean(astir.piloted),
				// max is always derived from the current parts and equipment, never stored — same
				// reasoning as equipmentValue/advancements.topCount — so it can't drift after a part
				// or weapon changes. negative flags Weapon Drain having outstripped max Power (see
				// claude.md's Piloted note) so the template can call it out visually, not just via
				// the one-time warning toast the mutation handlers raise.
				power: { value: astir.power ?? 0, max: astirMaxPower(astir.parts ?? [], equipment), negative: (astir.power ?? 0) < 0 },
				// A second, Weapon-Conduit-only Power pool — 0/0 (and hidden by the template) for
				// every Astir that doesn't have it.
				weaponPower: { value: astir.weaponPower ?? 0, max: astirMaxWeaponPower(astir.parts ?? [], equipment) },
				// Both only appear once a part actually grants them — an object (even one holding
				// 0) rather than a bare number, so the template's {{#if}} doesn't mistake a
				// legitimate 0 count for "not present".
				potions: astirParts.some((part) => part.grantsPotionsOnLeadASortie)
					? {
						red: astir.potions?.red ?? 0,
						blue: astir.potions?.blue ?? 0,
						yellow: astir.potions?.yellow ?? 0
					}
					: null,
				repairTokens: astirParts.some((part) => part.grantsRepairTokens)
					? { value: astir.repairTokens ?? 0 }
					: null,
				// tier is derived from the Astir's own Tier, not stored on the part — every part
				// installed here is installed on this Astir specifically (see claude.md's Astir
				// section), so there's only ever one frame's Tier for it to reflect.
				parts: astirParts.map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType,
					tier: astir.tier ?? ASTIR_TIER_MIN
				})),
				move: astirMove ? { key: astirMove.key, name: astirMove.name } : null,
				weapons: astirWeapons
			})
		};
		// Ardents (see ardent.js/claude.md's Ardents section) — unlike the Astir, never gated on
		// CHANNEL, and there can be several. Each one's approachOptions is the full APPROACHES
		// list (not narrowed by a Core — Ardents have none), its parts read the same way the
		// Astir's own do (drawn from the same catalog — see ardentParts), and loadoutFull disables
		// both the Parts and Weapons "+" buttons at once, since the two combine into one cap.
		//
		// Commander's Custom Ardent additionally has a second, independent Ardent Feature pool (see
		// ardent.js's ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS/ardentFeatureMax) — parts/weapons
		// from that pool are split out of the baseline parts/weapons lists above (via
		// isAceFeaturePart / the commanderFeature flag) into their own featureParts/featureWeapons,
		// with their own featureLoadoutFull, so the two "+"-button pairs never interfere with each
		// other's cap. Computed for every actor regardless of playbook — an actor with no
		// Feature-flagged items just gets an empty featureParts/featureWeapons and featureLoadoutFull:
		// false — the template gates the section itself on isCommander.
		data.ardentTierMin = ARDENT_TIER_MIN;
		data.ardentTierMax = ARDENT_TIER_MAX;
		const ardentFeatureCap = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		data.ardents = ardents.map((ardent) => {
			const allParts = resolveAstirParts(ardent.parts ?? [], ARDENT_PART_CATALOG);
			const parts = allParts.filter((part) => !isAceFeaturePart(part.key));
			const featureParts = allParts.filter((part) => isAceFeaturePart(part.key));
			const allWeapons = ardentWeaponEntriesById.get(ardent.id);
			const weapons = allWeapons.filter((weapon) => !weapon.commanderFeature);
			const featureWeapons = allWeapons.filter((weapon) => weapon.commanderFeature);
			return {
				id: ardent.id,
				name: ardent.name || ARDENT_DEFAULT_NAME,
				approach: ardent.approach ?? "",
				approachOptions: APPROACHES,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				piloted: Boolean(ardent.piloted),
				// tier is derived from this Ardent's own Tier, not stored on the part — same
				// reasoning as the Astir's own parts mapping above, just per-Ardent instead.
				parts: parts.map((part) => ({
					key: part.key,
					name: part.name,
					partType: part.partType,
					tier: ardent.tier ?? ARDENT_TIER_DEFAULT
				})),
				weapons,
				// Only appears once a part actually grants it (Standardised Parts — see astir.js), same
				// object-not-bare-number treatment the Astir's own repairTokens gets in getData above.
				// Checked against every installed part (baseline + Feature) — Standardised Parts has no
				// reason to be Feature-exclusive, and isn't.
				repairTokens: allParts.some((part) => part.grantsRepairTokens) ? { value: ardent.repairTokens ?? 0 } : null,
				loadoutFull: ardentBaselineLoadoutCount(ardent, equipment) >= ARDENT_MAX_LOADOUT,
				featureParts: featureParts.map((part) => ({
					key: part.key,
					name: part.name,
					partType: part.partType,
					tier: ardent.tier ?? ARDENT_TIER_DEFAULT
				})),
				featureWeapons,
				featureMax: ardentFeatureCap,
				featureLoadoutFull: ardentFeatureLoadoutCount(ardent, equipment) >= ardentFeatureCap
			};
		});
		// The Controls section (see the template's dangers-column) — Mount Up/Dismount just drive
		// the same mounted-frame state every frame's own Piloted checkbox does (see
		// _setMountedFrame), so their disabled state mirrors exactly what claude.md's Piloted note
		// and the feature ask require: no frame at all to mount, or one already mounted.
		data.controls = {
			mountUpDisabled: !frames.length || Boolean(mountedFrame),
			dismountDisabled: !mountedFrame
		};
		// Dangers sit in their own left column beside the tab area (see the template) rather than
		// inside a tab, since DEFENSELESS and the Danger list matter regardless of which tab is
		// open. atMax drives both the DEFENSELESS label and hiding the add-danger controls once
		// the actor is full.
		const dangers = this._dangers();
		data.dangers = {
			max: DANGER_MAX,
			list: dangers.map((danger) => ({ ...danger, isPeril: danger.type === "peril" })),
			atMax: dangers.length >= DANGER_MAX,
			canAdd: dangers.length < DANGER_MAX,
			addOpen: this._dangerAddOpen && dangers.length < DANGER_MAX
		};
		// Gravity Clocks live in the Social tab: up to 5 independent progress tracks, each with
		// its own label, a Spotlight-style fill track, and a separate 1-3 value. Unlike Spotlight
		// (one actor-wide counter), progress is per-clock, so each list entry gets its own
		// expanded steps array.
		const gravityClocks = this._gravityClocks();
		data.gravityClocks = {
			max: GRAVITY_CLOCK_MAX,
			canAdd: gravityClocks.length < GRAVITY_CLOCK_MAX,
			list: gravityClocks.map((clock) => ({
				...clock,
				progressSteps: Array.from({ length: GRAVITY_CLOCK_PROGRESS_MAX }, (_, i) => ({
					step: i + 1,
					filled: i + 1 <= (clock.progress ?? 0)
				}))
			}))
		};
		// Burdens (see claude.md's Social tab notes) — a plain, uncapped text list (unlike Dangers'
		// DANGER_MAX/type select), so getData just exposes the stored list as-is; there's no derived
		// per-entry shape to build the way Gravity Clocks' progressSteps needs.
		data.burdens = { list: this._burdens() };
		// Generic narrative clocks (see clocks.js) — universal, unlike Gravity Clocks above, so this
		// section renders on every playbook's sheet regardless of isCommander. Same per-clock
		// progressSteps expansion Gravity Clocks' own list already does, just sized to each clock's
		// own `steps` rather than one shared constant.
		data.clocks = {
			min: CLOCK_STEPS_MIN,
			max: CLOCK_STEPS_MAX,
			list: this._clocks().map((clock) => ({
				...clock,
				progressSteps: Array.from({ length: clock.steps ?? CLOCK_STEPS_DEFAULT }, (_, i) => ({
					step: i + 1,
					filled: i + 1 <= (clock.progress ?? 0)
				}))
			}))
		};
		// Commander's Ace Crew roster (see playbook-moves.js's Ace Crew move) — gated to Commander by
		// the template (isCommander above), same "compute regardless, gate the render" treatment
		// gravityTrigger already gets from a missing GRAVITY_TRIGGERS entry.
		data.aceCrew = { list: this._aceCrew() };
		// The bottom four Advancement options unlock once at least ADVANCEMENT_UNLOCK_THRESHOLD of
		// the top six are checked. `checked` for bottom items is always read from stored data
		// regardless of `locked` — locking only blocks new checkbox interaction in the template,
		// it never clears data, so an item checked before a re-lock stays checked.
		const advancements = this._advancements();
		const topCount = ADVANCEMENT_TOP.filter(({ key }) => advancements[key]).length;
		const unlocked = topCount >= ADVANCEMENT_UNLOCK_THRESHOLD;
		data.advancements = {
			top: ADVANCEMENT_TOP.map(({ key, label }) => ({ key, label, checked: advancements[key] ?? false })),
			topCount,
			unlockThreshold: ADVANCEMENT_UNLOCK_THRESHOLD,
			unlocked,
			bottom: ADVANCEMENT_BOTTOM.map(({ key, label }) => ({
				key,
				label,
				checked: advancements[key] ?? false,
				locked: !unlocked
			}))
		};
		return data;
	}

	_dangers() {
		return this.actor.system.attributes?.dangers ?? [];
	}

	// Plain-text entries (see claude.md's Social tab notes) — bite-the-dust's own text is the only
	// thing that ever grants one ("take a burden..."), and nothing in this module auto-clears them,
	// same manual-tracking model as Dangers/Advancement. No max, unlike Dangers' DANGER_MAX —
	// nothing in the rulebook caps how many a character can carry.
	_burdens() {
		return this.actor.system.attributes?.burdens ?? [];
	}

	// Sums every picked playbook move's declarative traitBonus (Arcane Augments, Let Loose) against
	// this actor's current Danger/Burden counts and stored per-move trait choices — see
	// trait-bonuses.js. Derived fresh every call, never stored, same stance as
	// equipmentValue/_conflictTier, so it can't drift after a Danger/Burden/choice changes.
	_traitBonuses() {
		const moves = resolvePlaybookMoves(this._playbookMoves());
		return traitBonusesFor(moves, {
			dangerCount: this._dangers().length,
			burdenCount: this._burdens().length,
			choices: this.actor.system.attributes?.traitBonusChoices ?? {}
		});
	}

	_gravityClocks() {
		return this.actor.system.attributes?.gravityClocks ?? [];
	}

	// Generic narrative clocks (see clocks.js) — universal, not gated to any playbook, unlike
	// Gravity Clocks above (fixed-6-step, tied to the Social tab's Gravity Trigger section).
	_clocks() {
		return this.actor.system.attributes?.clocks ?? [];
	}

	// Commander's Ace Crew roster: 3-5 named individuals with an adjective or two each (see
	// playbook-moves.js's Ace Crew move). Reuses entry-list.js's CRUD helpers, the same pattern
	// Carrier's Crew Members already establish for a plain id-keyed list of {name, ...} entries.
	_aceCrew() {
		return this.actor.system.attributes?.aceCrew ?? [];
	}

	_equipment() {
		return this.actor.system.attributes?.equipment ?? [];
	}

	_weapons() {
		return this._equipment().filter((item) => item.kind === "weapon");
	}

	_astir() {
		return this.actor.system.attributes?.astir ?? null;
	}

	// Every installed part, resolved from its stored keys — purely "what's installed," used for
	// display (the Parts list, Weapon Power's max) regardless of whether the Astir is currently
	// piloted. Effect sites (guided, +CHANNEL, spends, doubles regen, potions) each check
	// _mountedParts() themselves rather than this returning [] when unpiloted, since the Parts
	// list itself still needs to show installed-but-inactive parts.
	_astirParts() {
		return resolveAstirParts(this._astir()?.parts ?? []);
	}

	_ardents() {
		return this.actor.system.attributes?.ardents ?? [];
	}

	// Every pilotable frame this character has — the Astir (if created) first, then each Ardent in
	// stored order — normalized to one shape so Mount Up/Dismount, weapon ownership (see
	// _weaponFrameId), and per-frame move gating (see getData) can all be generic rather than
	// special-casing the Astir. `id` is the literal string "astir" for the Astir, since there's
	// only ever one; an Ardent's own stored id otherwise. `name` mirrors getData's own Astir naming
	// (the character's Callsign, falling back to its own name) for the Astir, or the Ardent's own
	// stored name (falling back to ARDENT_DEFAULT_NAME) for an Ardent.
	_frames() {
		const frames = [];
		const astir = this._astir();
		if (astir) {
			frames.push({
				kind: "astir",
				id: "astir",
				name: this.actor.system.details?.callsign?.value || this.actor.name,
				tier: astir.tier ?? ASTIR_TIER_MIN,
				piloted: Boolean(astir.piloted),
				parts: astir.parts ?? []
			});
		}
		for (const ardent of this._ardents()) {
			frames.push({
				kind: "ardent",
				id: ardent.id,
				name: ardent.name || ARDENT_DEFAULT_NAME,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				piloted: Boolean(ardent.piloted),
				parts: ardent.parts ?? []
			});
		}
		return frames;
	}

	// The single currently-mounted frame (the Astir or one Ardent), or null when nothing is —
	// _setMountedFrame is the only write path, so at most one frame's `piloted` is ever true.
	_mountedFrame() {
		return this._frames().find((frame) => frame.piloted) ?? null;
	}

	// The mounted frame's installed parts, resolved to definitions — [] when nothing is mounted.
	// Every reactive part effect (guided, +CHANNEL, spends, doubles regen, potions) reads this
	// rather than checking piloted state and _astirParts() separately, since an Ardent's own parts
	// (drawn from the same catalog — see ardent.js) work identically to the Astir's once mounted.
	_mountedParts() {
		return resolveAstirParts(this._mountedFrame()?.parts ?? [], ARDENT_PART_CATALOG);
	}

	// Which frame (by _frames' own id shape) an equipment entry belongs to, or null for a mundane
	// weapon that belongs to none — the generalization of the old Astir/mundane piloted-boolean
	// split (see claude.md's Piloted note) to cover Ardent-owned weapons too.
	_weaponFrameId(entry) {
		if (entry.astir) return "astir";
		if (entry.ardent) return entry.ardent;
		return null;
	}

	// Explains why a weapon's quick-roll buttons are gated by frame mismatch (see
	// frameWeaponMoves in getData) — only called once a mismatch is already known to exist, so
	// frameId and mountedFrameId are never equal here.
	_weaponGateTooltip(frameId, mountedFrameId) {
		if (frameId === null) {
			return "Personal weapons are disabled when mounted. Dismount to use this weapon.";
		}
		if (mountedFrameId === null) {
			return "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon.";
		}
		return "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon.";
	}

	// This character's Tier for all physical-conflict purposes (see claude.md's Character Tier
	// notes) — derived fresh every call, never stored, so Mount Up/Dismount and every frame's own
	// Piloted checkbox all move it for free through the single _setMountedFrame write path, with
	// nothing to re-sync (same reasoning equipmentValue/advancements.topCount already establish for
	// other always-derived numbers). `base` is CHARACTER_TIER_DEFAULT unless a picked playbook move
	// raises it via conflictTier (Field Scout II, Giant Slayer III) — max wins if somehow both are
	// picked, since "pick either" is exactly as unenforced as every other pool restriction in this
	// module (see playbook-moves.js's own top comment). `bonus` (Commander's Ace Crew: "your tier...
	// counts as one higher than whatever it would normally be") is a flat +N added on top of
	// whichever of base/frame Tier is currently active, summed across picked moves rather than
	// maxed like conflictTier — Ace Crew is the only source today, but nothing stops two sources
	// stacking the way conflictTier's "pick either" deliberately doesn't. While a frame is mounted,
	// `effective` is that frame's own Tier (plus bonus) instead of `base` — on dismount it reverts.
	_conflictTier() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		const base = picked.reduce((max, move) => Math.max(max, move.conflictTier ?? 0), CHARACTER_TIER_DEFAULT);
		const bonus = picked.reduce((sum, move) => sum + (move.tierBonus ?? 0), 0);
		const frame = this._mountedFrame();
		if (frame) {
			return { base: base + bonus, effective: frame.tier + bonus, fromFrame: true, frameName: frame.name };
		}
		return { base: base + bonus, effective: base + bonus, fromFrame: false };
	}

	// Downtime Tokens' effective max (see getData's downtimeTokens, _onDowntimeTokensStep,
	// _onRefreshSortie) — DOWNTIME_TOKENS_MAX_BASE unless a picked move raises it via its own
	// declarative downtimeTokensMax flag (Commander's Debrief: 4 total), taking the max across
	// picked moves the same way _conflictTier's own base does for conflictTier.
	_downtimeTokensMax() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		return picked.reduce((max, move) => Math.max(max, move.downtimeTokensMax ?? 0), DOWNTIME_TOKENS_MAX_BASE);
	}

	// Shared by getData (render shape) and _equipmentSpends (roll dialog offers) so a tag's
	// current definition is only ever resolved from the catalog in one place. Value is always the
	// live sum of the entry's current tags (see equipmentValue in equipment.js), never stored, so
	// it can't drift out of sync after a tag is added or removed. scale/tier/weaponMoves are only
	// present for weapons — gear never carries them. weaponMoves is precomputed once in getData
	// and passed in here rather than recomputed per entry — see getData's own comment.
	//
	// `frame` (the owning Astir's raw data, or an Ardent's — either just needs a `.tier` — or null)
	// is only ever needed for an entry flagged astir: true or ardent: "<id>" (see astir.js/
	// ardent.js) — such an entry never stores its own scale/tier, inheriting its frame's Tier and
	// the "astir" WEAPON_SCALES entry instead (an Ardent weapon is Astir-scale too — see claude.md's
	// Ardents section), so isAstir tells the template to render that as read-only text rather than
	// a stepper/select. A mundane weapon likewise never stores its own tier — it derives from
	// _conflictTier().base, the character's own on-foot Tier, rather than the frame's (`.effective`
	// would read as whichever frame is currently mounted, which is meaningless here: a mundane
	// weapon is already gated off entirely while mounted — see _weaponGateTooltip).
	_equipmentEntry(entry, weaponMoves = [], frame = null) {
		const tags = resolveEquipmentTags(entry.tags ?? []).map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			// A forcesEffect tag (Unreliable) shows the same "used this period" checkbox as a
			// player-opted spend, even though checking it happens automatically after a roll rather
			// than by the player's own choice — see _forcedWeaponEffect/_rollMove. A reroll tag
			// (Decisive/Defensive/Versatile) gets marked spent the same way, by handleReroll — without
			// this, its checkbox would never render at all, leaving a spent reroll tag with no way to
			// clear it back for a new Scene (the same manual-reset gap _onEquipmentTagSpentToggle's
			// comment already covers for the other two).
			spendable: Boolean(tag.spend || tag.forcesEffect || tag.reroll),
			spent: Boolean(entry.spent?.includes(tag.key))
		}));
		return {
			id: entry.id,
			kind: entry.kind,
			name: entry.name,
			description: entry.description,
			tags,
			value: equipmentValue(entry.tags ?? []),
			...(entry.kind === "weapon" && {
				scale: (entry.astir || entry.ardent) ? "astir" : entry.scale,
				scaleLabel: (entry.astir || entry.ardent)
					? WEAPON_SCALES.find((s) => s.key === "astir")?.label
					: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
				tier: (entry.astir || entry.ardent) ? frame?.tier : this._conflictTier().base,
				weaponMoves,
				isAstir: Boolean(entry.astir),
				// Commander-exclusive (see ardent.js's ardentFeatureLoadoutCount) — surfaced here so
				// getData's per-Ardent split into baseline vs. Feature weapons can read it off the
				// already-mapped entry rather than re-filtering the raw equipment array a second time.
				commanderFeature: Boolean(entry.commanderFeature)
			})
		};
	}

	// The unspent, spendable tags across the actor's equipment, offered as checkboxes in the roll
	// dialog's Equipment section (see _rollMove/configureMoveRoll). Not filtered by move or trait
	// otherwise — every unspent spendable tag on an offerable entry is offered, same
	// non-enforcement stance as move pool membership (see playbook-moves.js). `disabled` is true
	// whenever the roll already has a locked Effect (bite-the-dust at max Perils): every spend
	// today only ever sets the Effect axis, so honoring the lock means refusing to let a tag be
	// spent for nothing, rather than silently consuming it.
	//
	// `weapon` is the "which weapon" distinction _rollMove already carries: left `undefined` for a
	// move that doesn't care (every current move except Exchange Blows/Strike Decisively), every
	// entry is offered exactly as before. Passed explicitly — an actual weapon entry, or `null` for
	// Unarmed — every *other* weapon's entries are excluded; gear is never filtered, since a
	// character can plausibly have more than one relevant piece of gear active at once, just not
	// more than one weapon in hand.
	_equipmentSpends(lockedEffect, weapon) {
		const scoped = weapon !== undefined;
		const mountedFrameId = this._mountedFrame()?.id ?? null;
		const spends = [];
		for (const entry of this._equipment()) {
			// A weapon belonging to a frame other than the one currently mounted (or, for a mundane
			// weapon, any frame being mounted at all — see claude.md's Piloted note) never offers its
			// tags, regardless of `weapon`/scoped (this is the one spot that isn't already reached
			// through _onMoveRoll's own frame filter, since a non-usesWeapon move leaves `weapon`
			// undefined and scoped false). Gear is untouched.
			if (entry.kind === "weapon" && this._weaponFrameId(entry) !== mountedFrameId) continue;
			if (scoped && entry.kind === "weapon" && entry.id !== weapon?.id) continue;
			const spent = entry.spent ?? [];
			for (const tagKey of entry.tags ?? []) {
				if (spent.includes(tagKey)) continue;
				const tag = findEquipmentTag(tagKey);
				// A spend with no `effect` (Ward, Vorpal, One-Use, Refresh, Dangerous) only tracks
				// "used this period" via the Equipment tab's own checkbox (see _equipmentEntry) —
				// its effect happens outside any one roll, so it's never offered here.
				if (!tag?.spend?.effect) continue;
				spends.push({
					equipmentId: entry.id,
					equipmentName: entry.name,
					tagKey: tag.key,
					tagLabel: tag.label,
					description: tag.description,
					effect: tag.spend.effect,
					disabled: Boolean(lockedEffect)
				});
			}
		}
		return spends;
	}

	// The Astir/Ardent Parts equivalent of _equipmentSpends above — every part installed on the
	// currently mounted frame with a `spend.effect` or `spend.advantage` (Artifact — see astir.js)
	// that isn't already Expended, offered in the roll dialog's own Astir Parts section (see
	// configureMoveRoll/move-roll-dialog.hbs). Empty when nothing is mounted (see claude.md's
	// Piloted note) — unlike _equipmentSpends, parts aren't scoped by weapon, since none of them
	// are weapon-specific. A part whose `spend` sets neither (Warding, formerly) doesn't actually
	// modify a roll, so it's excluded here the same way _equipmentSpends excludes an effect-less
	// equipment tag (Ward, Vorpal, Refresh, ...) — its only interaction point is its own
	// `uses`/Expended checkbox, not this dialog.
	_astirPartSpends(lockedEffect) {
		const spends = [];
		for (const part of this._mountedParts()) {
			if (!part.spend?.effect && !part.spend?.advantage) continue;
			if (this.actor.system.attributes?.moveUses?.[part.key]?.expended) continue;
			spends.push({
				partKey: part.key,
				partName: part.name,
				description: part.spend.description,
				effect: part.spend.effect ?? null,
				advantage: part.spend.advantage ?? null,
				disabled: Boolean(lockedEffect && part.spend.effect)
			});
		}
		return spends;
	}

	_advancements() {
		return this.actor.system.attributes?.advancements ?? {};
	}

	// Field Scout's "read the room with confidence, always" (see playbook-moves.js's
	// grantsEffectOnMove) — locks a specific *other* move's Effect regardless of which move is
	// actually being rolled, so this is resolved off the actor's picked playbook moves rather than
	// a flag on `move` itself (contrast forcesDesperationAtMaxPerils/requiresChannelDisabled, which
	// are read straight off the move being rolled). Returns null when no picked move grants
	// anything for this particular move key.
	_grantedEffectForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsEffectOnMove?.moveKey === move.key);
		return granting?.grantsEffectOnMove.effect ?? null;
	}

	// Don't Follow Me's "lead a Sortie with +DEFY & advantage" (see playbook-moves.js's
	// grantsTraitOnMove) — the trait-key half of the same pair _grantedEffectForMove already
	// resolves for Effect. Returns a bare key (mirroring _grantedEffectForMove/
	// _grantedAdvantageForMove's own return shape); _rollMove resolves it against this move's own
	// already-computed `traits` list to get a real {key, label, value} option to lock, rather than
	// duplicating that lookup here. Applied unconditionally whenever the granting move is picked
	// and the target move is rolled — same "always" treatment grantsEffectOnMove already gives
	// Field Scout, rather than gating on the move's own "you may" framing (Downtime Scenes and
	// their tokens aren't tracked anywhere in this module — see claude.md's "systems that do not
	// exist yet").
	_grantedTraitForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsTraitOnMove?.moveKey === move.key);
		return granting?.grantsTraitOnMove.trait ?? null;
	}

	// The Advantage-axis counterpart to _grantedEffectForMove — Don't Follow Me additionally locks
	// the roll dialog's Dice select the same way a lockedEffect locks Effect (see
	// PlaybookActorSheet#_rollMove/moves.js#configureMoveRoll), though an Astir Part's own reactive
	// spend.advantage (Artifact) still wins over it.
	_grantedAdvantageForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsAdvantageOnMove?.moveKey === move.key);
		return granting?.grantsAdvantageOnMove.advantage ?? null;
	}

	// Just the picked keys — the move definitions live in playbook-moves.js, so stored data never
	// goes stale against edited rules text. resolvePlaybookMoves drops keys that no longer match
	// a definition.
	_playbookMoves() {
		return this.actor.system.attributes?.playbookMoves ?? [];
	}

	// bite-the-dust's forcesDesperationAtMaxPerils reads this to decide whether the roll dialog's
	// Effect is locked to Desperation (see _onMoveRoll) — true only when every Danger slot is
	// full AND every one of those Dangers is a Peril, not just any Peril present.
	_allDangersArePeril() {
		const dangers = this._dangers();
		return dangers.length >= DANGER_MAX && dangers.every((danger) => danger.type === "peril");
	}

	_moveGroupMoves(moves) {
		const channelDisabled = Boolean(this.actor.system.stats?.channel?.disabled);
		return moves.map((move) => {
			const traits = this._moveTraits(move);
			// Read-the-room's roll-tiered hold lives in pbta's shared system.resources.hold
			// field; every flatHold move's roll-less hold is tracked separately, one pool per
			// move key, at system.attributes.moveHold.<moveKey> (an ObjectField, unlike the
			// strictly-schemed system.resources) — keyed the same way system.attributes.moveUses
			// already is, so two different flatHold moves (e.g. b-plot and a Soldier Move) on the
			// same actor can't collide and overwrite each other's count. separateHold (Mobility)
			// is the same per-move pool, but for a move that's still roll-tiered rather than flat —
			// see moves.js#rollMove for the matching write side.
			const hold = (move.flatHold || move.separateHold)
				? this.actor.system.attributes?.moveHold?.[move.key]?.value ?? 0
				: this.actor.system.resources?.hold?.value ?? 0;
			// True only for moves gated off Channel being enabled (b-plot, via
			// requiresChannelDisabled) — distinct from the traits-empty gating below (Weave
			// Magic), which never blocks reading a move's own description.
			const channelGated = Boolean(move.requiresChannelDisabled) && !channelDisabled;
			return {
				key: move.key,
				name: move.name,
				traits,
				// True when a move normally rolls a stat trait but every one of those traits is
				// currently disabled for this actor (e.g. Weave Magic without Channel — a move
				// with no traits by design, like Help or Hinder, is never gated this way), OR
				// when the move is explicitly gated the opposite way, off Channel being enabled
				// (b-plot, via channelGated above).
				gated: (move.traits.length > 0 && traits.length === 0) || channelGated,
				// Whether this move rolls anything at all, based on its static definition rather
				// than the actor-filtered trait list above — a gated move (e.g. Weave Magic with
				// Channel disabled) still shows a disabled Roll button, but a move with no traits or
				// conditions by design (Subsystems, B-Plot) shows no Roll button at all.
				rollable: move.traits.length > 0 || Boolean(move.conditions),
				// Moves with a flat hold grant (B-Plot) show an Activate button in place of Roll —
				// see the template's rollable/activatable branch and _onMoveActivate. Divination
				// Codex's showsReadTheRoomQuestions and a move's own activateChoices (Bureaucrat,
				// Shree Klime) get the same button, for the same reason: no dice, just an action to
				// take.
				activatable: Boolean(move.flatHold)
					|| Boolean(move.showsReadTheRoomQuestions)
					|| Boolean(move.activateChoices),
				// Weave Magic's description stays readable even while its Roll button is gated —
				// you can still learn what the move does. B-Plot is different: being "in the
				// b-plot" isn't something a Channel-enabled character can do at all, so its
				// Description button greys out too, alongside Roll/Activate and the hold stepper.
				descriptionGated: channelGated,
				trackHold: Boolean(move.hold) || Boolean(move.flatHold),
				// Which stepper/handler the template wires up (_onHoldStep vs
				// _onFlatHoldStep) — see the hold comment above. separateHold routes to the same
				// per-move stepper as flatHold, even though it's still a roll-tiered grant.
				separateHoldPool: Boolean(move.flatHold) || Boolean(move.separateHold),
				hold,
				// Generic, per-move-key checkboxes for a "once per Sortie"/"once per Downtime" cap
				// (e.g. Cantrips' Seek Allies, Personal Familiar — see playbook-moves.js). Not
				// scoped to playbook moves: any move source can declare `uses` the same way `hold`
				// or `conditions` already work uniformly across all three. Stored separately from
				// hold/dangers/etc at system.attributes.moveUses, keyed by the move's own key, so
				// adding this never touches existing fields. Nothing ever clears these
				// automatically — there's no "start a new Sortie/Downtime" concept anywhere in this
				// module, so a checked box stays checked until the player unchecks it themselves,
				// same manual-tracking model as the Advancement checklist.
				uses: (move.uses ?? []).map((use) => ({
					key: use.key,
					label: use.label,
					checked: Boolean(this.actor.system.attributes?.moveUses?.[move.key]?.[use.key])
				})),
				// Let Loose's per-actor trait pick (see trait-bonuses.js's chooseTrait) — a small
				// select rendered on the move's own row (see the template) rather than a separate
				// dialog, the same "plain bound field, no picker" treatment the Cosmetic tab's
				// freeform fields get. Stored at system.attributes.traitBonusChoices.<moveKey>, kept
				// distinct from moveUses/moveHold the same way those two stay distinct from each
				// other — a different kind of per-move state.
				traitBonusChoosable: Boolean(move.traitBonus?.chooseTrait),
				traitBonusChoice: this.actor.system.attributes?.traitBonusChoices?.[move.key] ?? ""
			};
		});
	}

	// Shared by getData (for sheet rendering) and _onMoveRoll (for the roll dialog) so a
	// trait's current value is only ever read from the actor in one place. fixedTraits (e.g. Lead
	// a Sortie's CREW) are appended as-is — never looked up on the actor — since they don't
	// correspond to any TRAITS entry or system.stats key. CREW is the one exception: its static
	// placeholder value gets overwritten with a live read off whichever Carrier actor exists in
	// the world (see _crewFixedTraitValue) — with zero or more than one Carrier, this resolves to
	// 0 for display purposes; a roll in progress resolves the ambiguous multiple-Carrier case for
	// real via a prompt (see _rollMove).
	_moveTraits(move) {
		// Folded straight into each entry's `value` (rather than a separate field) so the roll
		// dialog's own trait select shows the real, bonus-inclusive number a player would actually
		// roll with — the same total getData's own Traits panel displays (see "Trait bonus
		// display"). An actor with no traitBonus moves picked resolves every bonus to 0, leaving
		// this identical to before the feature existed.
		const traitBonuses = this._traitBonuses();
		const actorTraits = availableMoveTraits(this.actor, move).map((trait) => ({
			key: trait.key,
			label: trait.label,
			value: (this.actor.system.stats?.[trait.key]?.value ?? 0) + (traitBonuses[trait.key] ?? 0)
		}));
		// Input Channel (see astir.js) offers +CHANNEL on any move, bypassing both that move's own
		// traits list and Channel's disabled gate — only while installed on the currently mounted
		// frame (Astir or Ardent alike — see _mountedParts), and only added once (a move that
		// already rolls +CHANNEL, e.g. Weave Magic, isn't given a second entry).
		if (!actorTraits.some((trait) => trait.key === "channel")
			&& this._mountedParts().some((part) => part.grantsChannelOnAnyMove)) {
			// TRAITS is a fixed, six-entry constant (see traits.js) that always includes channel —
			// no fallback needed for a lookup that can't fail.
			const channel = TRAITS.find((trait) => trait.key === "channel");
			actorTraits.push({
				key: channel.key,
				label: channel.label,
				value: (this.actor.system.stats?.channel?.value ?? 0) + (traitBonuses.channel ?? 0)
			});
		}
		// Facilitator's "you may read the room with +TALK" (see playbook-moves.js's addsTraitToMove).
		// The counterpart to _grantedTraitForMove, and deliberately the opposite operation:
		// grantsTraitOnMove *locks* the roll dialog to a trait the target move already offers, so it
		// can only ever narrow an existing choice; this *adds* an option the move never had, matching
		// the rulebook's "you may" framing. Same resolve-off-picked-moves shape as the grants* trio,
		// and the same add-once guard the Input Channel block above uses.
		const addedTraitKey = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.addsTraitToMove?.moveKey === move.key)?.addsTraitToMove.trait ?? null;
		if (addedTraitKey && !actorTraits.some((trait) => trait.key === addedTraitKey)) {
			// TRAITS is a fixed, six-entry constant (see traits.js), and playbook-moves.test.js
			// asserts every addsTraitToMove names a real key — no fallback needed here.
			const added = TRAITS.find((trait) => trait.key === addedTraitKey);
			actorTraits.push({
				key: added.key,
				label: added.label,
				value: (this.actor.system.stats?.[added.key]?.value ?? 0) + (traitBonuses[added.key] ?? 0)
			});
		}
		const fixedTraits = (move.fixedTraits ?? []).map((trait) => (
			trait.key === "crew" ? { ...trait, value: this._crewFixedTraitValue() } : trait
		));
		return [...actorTraits, ...fixedTraits];
	}

	// The single-Carrier case _moveTraits needs for display, and _rollMove's starting point
	// before it decides whether the multi-Carrier prompt is even necessary.
	_crewFixedTraitValue() {
		const carriers = findCarrierActors();
		return carriers.length === 1 ? carriers[0].system.stats?.crew?.value ?? 0 : 0;
	}

	// Foundry's {{editor}} helper only uses getData's lookText/considerText for the read-only
	// preview shown before the player clicks to edit — the moment they do, FormApplication's own
	// _activateEditor re-reads system.details.look/consider.value straight off the real actor
	// document (client/apps/form.js), bypassing whatever getData computed. So the flavor-prompt
	// default has to actually be written to the actor the first time its sheet renders with
	// nothing stored there yet; after that, the editor's own save takes over and this never fires
	// again for that field. Checked against undefined rather than falsy so a player who
	// deliberately clears a field to "" doesn't have the prompt text resurrected on the next
	// render. Gated on isOwner so a GM or observer opening someone else's sheet never attempts a
	// write they don't have permission for.
	_seedCosmeticDefaults() {
		if (!this.actor.isOwner) return;
		const playbookSlug = this.actor.system.playbook?.slug;
		const updates = {};
		if (this.actor.system.details?.look?.value === undefined) {
			const look = defaultLookText(playbookSlug);
			if (look) updates["system.details.look.value"] = look;
		}
		if (this.actor.system.details?.consider?.value === undefined) {
			const consider = defaultConsiderText(playbookSlug);
			if (consider) updates["system.details.consider.value"] = consider;
		}
		if (Object.keys(updates).length) this.actor.update(updates);
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._seedCosmeticDefaults();
		html.find(".playbook-select").on("change", this._onPlaybookChange.bind(this));
		html.find(".trait-step").on("click", this._onTraitStep.bind(this));
		html.find(".hold-step").on("click", this._onHoldStep.bind(this));
		html.find(".flat-hold-step").on("click", this._onFlatHoldStep.bind(this));
		html.find(".spotlight-step").on("click", this._onSpotlightStep.bind(this));
		html.find(".downtime-tokens-step").on("click", this._onDowntimeTokensStep.bind(this));
		html.find(".advancement-checkbox").on("change", this._onAdvancementToggle.bind(this));
		html.find(".danger-add-toggle").on("click", this._onDangerAddToggle.bind(this));
		html.find(".danger-add").on("click", this._onDangerAdd.bind(this));
		html.find(".danger-remove").on("click", this._onDangerRemove.bind(this));
		html.find(".burden-add").on("click", this._onBurdenAdd.bind(this));
		html.find(".burden-remove").on("click", this._onBurdenRemove.bind(this));
		html.find(".burden-label-input").on("change", this._onBurdenLabelChange.bind(this));
		html.find(".gravity-clock-add").on("click", this._onGravityClockAdd.bind(this));
		html.find(".gravity-clock-remove").on("click", this._onGravityClockRemove.bind(this));
		html.find(".gravity-clock-label-input").on("change", this._onGravityClockLabelChange.bind(this));
		html.find(".gravity-clock-value-step").on("click", this._onGravityClockValueStep.bind(this));
		html.find(".gravity-clock-step").on("click", this._onGravityClockStep.bind(this));
		html.find(".clock-add").on("click", this._onClockAdd.bind(this));
		html.find(".clock-remove").on("click", this._onClockRemove.bind(this));
		html.find(".clock-label-input").on("change", this._onClockLabelChange.bind(this));
		html.find(".clock-steps-input").on("change", this._onClockStepsChange.bind(this));
		html.find(".clock-step").on("click", this._onClockStep.bind(this));
		html.find(".ace-crew-add").on("click", this._onAceCrewAdd.bind(this));
		html.find(".ace-crew-remove").on("click", this._onAceCrewRemove.bind(this));
		html.find(".ace-crew-field").on("change", this._onAceCrewFieldChange.bind(this));
		html.find(".starting-moves-add").on("click", this._onStartingMovesAdd.bind(this));
		html.find(".playbook-move-add").on("click", this._onPlaybookMoveAdd.bind(this));
		html.find(".playbook-move-remove").on("click", this._onPlaybookMoveRemove.bind(this));
		html.find(".move-use-checkbox").on("change", this._onMoveUseToggle.bind(this));
		html.find(".trait-bonus-select").on("change", this._onTraitBonusChoiceChange.bind(this));
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
		html.find(".move-activate").on("click", this._onMoveActivate.bind(this));
		html.find(".move-description").on("click", this._onMoveDescription.bind(this));
		html.find(".equipment-add").on("click", this._onEquipmentAdd.bind(this));
		html.find(".equipment-catalog-add").on("click", this._onEquipmentCatalogAdd.bind(this));
		html.find(".starting-gear-add").on("click", this._onStartingGearAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onEquipmentEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onEquipmentRemove.bind(this));
		html.find(".equipment-tag-spent-checkbox").on("change", this._onEquipmentTagSpentToggle.bind(this));
		html.find(".weapon-move-roll").on("click", this._onWeaponMoveRoll.bind(this));
		html.find(".astir-create").on("click", this._onAstirCreate.bind(this));
		html.find(".astir-delete").on("click", this._onAstirDelete.bind(this));
		html.find(".astir-core-select").on("change", this._onAstirCoreChange.bind(this));
		html.find(".astir-approach-select").on("change", this._onAstirApproachChange.bind(this));
		html.find(".astir-tier-step").on("click", this._onAstirTierStep.bind(this));
		html.find(".astir-power-step").on("click", this._onAstirPowerStep.bind(this));
		html.find(".astir-weapon-power-step").on("click", this._onAstirWeaponPowerStep.bind(this));
		html.find(".astir-overheating-checkbox").on("change", this._onAstirOverheatingToggle.bind(this));
		html.find(".astir-piloted-checkbox").on("change", this._onAstirPilotedToggle.bind(this));
		html.find(".astir-potion-use").on("click", this._onAstirPotionUse.bind(this));
		html.find(".astir-part-add").on("click", this._onAstirPartAdd.bind(this));
		html.find(".astir-part-remove").on("click", this._onAstirPartRemove.bind(this));
		html.find(".astir-move-add").on("click", this._onAstirMoveAdd.bind(this));
		html.find(".astir-move-remove").on("click", this._onAstirMoveRemove.bind(this));
		html.find(".astir-weapon-catalog-add").on("click", this._onAstirWeaponAdd.bind(this));
		html.find(".ardent-create").on("click", this._onArdentCreate.bind(this));
		html.find(".ardent-delete").on("click", this._onArdentDelete.bind(this));
		html.find(".ardent-name-input").on("change", this._onArdentNameChange.bind(this));
		html.find(".ardent-approach-select").on("change", this._onArdentApproachChange.bind(this));
		html.find(".ardent-tier-step").on("click", this._onArdentTierStep.bind(this));
		html.find(".ardent-piloted-checkbox").on("change", this._onArdentPilotedToggle.bind(this));
		html.find(".ardent-repair-tokens-input").on("change", this._onArdentRepairTokensChange.bind(this));
		html.find(".ardent-part-add").on("click", this._onArdentPartAdd.bind(this));
		html.find(".ardent-part-remove").on("click", this._onArdentPartRemove.bind(this));
		html.find(".ardent-weapon-catalog-add").on("click", this._onArdentWeaponAdd.bind(this));
		html.find(".ardent-feature-part-add").on("click", this._onArdentFeaturePartAdd.bind(this));
		html.find(".ardent-feature-weapon-add").on("click", this._onArdentFeatureWeaponAdd.bind(this));
		html.find(".controls-mount-up").on("click", this._onMountUp.bind(this));
		html.find(".controls-dismount").on("click", this._onDismount.bind(this));
		html.find(".controls-refresh-scene").on("click", this._onRefreshScene.bind(this));
		html.find(".controls-refresh-sortie").on("click", this._onRefreshSortie.bind(this));
	}

	_onPlaybookChange(event) {
		const playbook = PLAYBOOKS.find((p) => p.packId === event.currentTarget.value);
		if (!playbook) return;
		swapActorPlaybook(this.actor, playbook);
	}

	_onTraitStep(event) {
		const { trait: key, delta } = event.currentTarget.dataset;
		const current = this.actor.system.stats?.[key]?.value ?? 0;
		const next = Math.min(TRAIT_MAX, Math.max(TRAIT_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.stats.${key}.value`]: next });
	}

	_onHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.resources?.hold?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.resources.hold.value": next });
	}

	_onFlatHoldStep(event) {
		const { move: key, delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.moveHold?.[key]?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.attributes.moveHold.${key}.value`]: next });
	}

	// Serves both the top and bottom Advancement groups — the key comes from the checkbox's own
	// dataset, not a hardcoded group. Bottom checkboxes render `disabled` in the template while
	// locked (see getData's `locked` field), and a disabled checkbox never dispatches `change`, so
	// this handler only ever fires for a box the player was actually allowed to toggle — no
	// lock check or revert needed here.
	_onAdvancementToggle(event) {
		const { advancementKey: key } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.advancements.${key}`]: event.currentTarget.checked });
	}

	// Clicking a step sets the value to that step, except clicking the current top (highest
	// filled) step decrements it by one instead — the only way to reduce the track, since there's
	// no step 0 to click. Storing a single integer (rather than per-step booleans) is what
	// guarantees the track can never have a gap.
	_onSpotlightStep(event) {
		const step = Number(event.currentTarget.dataset.step);
		const current = this.actor.system.attributes?.spotlight?.value ?? 0;
		const next = step === current ? step - 1 : step;
		const clamped = Math.min(SPOTLIGHT_MAX, Math.max(SPOTLIGHT_MIN, next));
		if (clamped === current) return;
		this.actor.update({ "system.attributes.spotlight.value": clamped });
	}

	// Bounded by _downtimeTokensMax() — see getData's downtimeTokens for how a picked move (e.g.
	// Commander's Debrief) can raise this above DOWNTIME_TOKENS_MAX_BASE.
	_onDowntimeTokensStep(event) {
		const { delta } = event.currentTarget.dataset;
		const max = this._downtimeTokensMax();
		const current = this.actor.system.attributes?.downtimeTokens?.value ?? max;
		const next = Math.min(max, Math.max(DOWNTIME_TOKENS_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.downtimeTokens.value": next });
	}

	// "+ Create Astir" on an available-but-empty Astir tab. Every player may have at most one —
	// Create/Delete are the only ways in or out (see _onAstirDelete), there's no picker here.
	_onAstirCreate() {
		if (this._astir()) return;
		this.actor.update({
			"system.attributes.astir": {
				id: foundry.utils.randomID(),
				img: ASTIR_DEFAULT_IMG,
				core: "",
				approach: "",
				tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE,
				overheating: false,
				// Unchecked by default — a player isn't always in their Astir, and every part/Astir
				// weapon benefit is inert until this is checked (see claude.md's Piloted note).
				piloted: false,
				parts: [],
				move: null
			}
		});
	}

	// Deleting an Astir also drops every equipment entry it owns (see astir.js) — an orphaned
	// astir: true weapon with no Astir to inherit Tier/Scale from would have nothing to render.
	_onAstirDelete() {
		if (!this._astir()) return;
		this.actor.update({
			"system.attributes.astir": null,
			"system.attributes.equipment": this._equipment().filter((item) => !item.astir)
		});
	}

	// Changing Core narrows which Approaches are valid (see astirCoreApproaches) — a currently-set
	// Approach that the new Core doesn't offer is cleared rather than left dangling unrendered.
	_onAstirCoreChange(event) {
		const astir = this._astir();
		if (!astir) return;
		const core = event.currentTarget.value;
		const updates = { "system.attributes.astir.core": core };
		if (!astirCoreApproaches(core).some((approach) => approach.key === astir.approach)) {
			updates["system.attributes.astir.approach"] = "";
		}
		this.actor.update(updates);
	}

	_onAstirApproachChange(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.approach": event.currentTarget.value });
	}

	_onAstirTierStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.tier ?? ASTIR_TIER_MIN;
		const next = Math.min(ASTIR_TIER_MAX, Math.max(ASTIR_TIER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.tier": next });
	}

	// Bounded by astirMaxPower rather than a fixed constant, since Parts can reduce the ceiling —
	// see getData's power.max.
	_onAstirPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.power ?? 0;
		const max = astirMaxPower(astir.parts ?? [], this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.power": next });
	}

	// Bounded by astirMaxWeaponPower rather than a fixed constant, since only Weapon Conduit grants
	// this pool at all — see getData's weaponPower.max.
	_onAstirWeaponPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.weaponPower ?? 0;
		const max = astirMaxWeaponPower(astir.parts ?? [], this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.weaponPower": next });
	}

	_onAstirOverheatingToggle(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.overheating": event.currentTarget.checked });
	}

	// The single write path enforcing "only one frame mounted at a time" (see claude.md's Piloted
	// note) — every frame's own Piloted checkbox (_onAstirPilotedToggle/_onArdentPilotedToggle) and
	// Mount Up/Dismount all funnel through this. `kind`/`id` name the frame to mount (see _frames'
	// own id shape, "astir" or an Ardent's stored id); pass kind: null (id ignored) to dismount
	// whatever's currently mounted. Blocks mounting the Astir while its Power is negative (see
	// claude.md's Piloted note, mirroring _astirPowerUpdates' own auto-uncheck-on-mutation guard) —
	// an Ardent has no Power to gate on, so mounting one always succeeds. Returns whether the
	// update actually applied, so a caller with something to revert (a checkbox) can do so.
	_setMountedFrame(kind, id) {
		const astir = this._astir();
		if (kind === "astir" && (astir?.power ?? 0) < 0) {
			ui.notifications.warn("This Astir's Power is negative — it can't be piloted until the loadout changes.");
			return false;
		}
		const updates = {};
		if (astir) updates["system.attributes.astir.piloted"] = kind === "astir";
		const ardents = this._ardents();
		if (ardents.length) {
			updates["system.attributes.ardents"] = ardents.map((ardent) => (
				{ ...ardent, piloted: kind === "ardent" && ardent.id === id }
			));
		}
		this.actor.update(updates);
		return true;
	}

	_onAstirPilotedToggle(event) {
		if (!this._astir()) return;
		const checked = event.currentTarget.checked;
		const applied = checked ? this._setMountedFrame("astir", "astir") : this._setMountedFrame(null, null);
		if (!applied) event.currentTarget.checked = !checked;
	}

	// Mounting an Ardent never fails (no Power to gate on — see _setMountedFrame), so unlike
	// _onAstirPilotedToggle there's no revert case to handle.
	_onArdentPilotedToggle(event) {
		const { ardentId } = event.currentTarget.dataset;
		if (!this._ardents().some((ardent) => ardent.id === ardentId)) return;
		const checked = event.currentTarget.checked;
		this._setMountedFrame(checked ? "ardent" : null, checked ? ardentId : null);
	}

	// Disabled in the template whenever there's no frame to mount or one's already mounted (see
	// getData's data.controls), but guarded here too in case a click still lands. Prompts via
	// chooseFrame only when there's a real choice to make; mounts directly with exactly one.
	async _onMountUp() {
		const frames = this._frames().filter((frame) => !frame.piloted);
		if (!frames.length) return;
		if (frames.length === 1) {
			this._setMountedFrame(frames[0].kind, frames[0].id);
			return;
		}
		const chosen = await chooseFrame(frames);
		if (!chosen) return;
		this._setMountedFrame(chosen.kind, chosen.id);
	}

	_onDismount() {
		if (!this._mountedFrame()) return;
		this._setMountedFrame(null, null);
	}

	// The generic, data-driven half of both Refresh buttons (see _onRefreshScene/_onRefreshSortie)
	// — walks ALL_MOVES for every `uses` entry whose `period` matches (playbook moves and Astir
	// parts share one pass, since ALL_MOVES already flattens both catalogs together — see its own
	// comment), and filters `entry.spent` on every equipment item against each tag's own
	// spend/forcesEffect/reroll period (see equipment.js). Returns a plain update patch rather than
	// calling actor.update itself, so each button can layer its own period-specific extras on top.
	_refreshPeriod(period) {
		const updates = {};
		for (const move of ALL_MOVES) {
			for (const use of move.uses ?? []) {
				if (use.period !== period) continue;
				if (this.actor.system.attributes?.moveUses?.[move.key]?.[use.key]) {
					updates[`system.attributes.moveUses.${move.key}.${use.key}`] = false;
				}
			}
		}
		const equipment = this._equipment();
		const nextEquipment = equipment.map((item) => {
			const spent = item.spent ?? [];
			if (!spent.length) return item;
			const kept = spent.filter((tagKey) => {
				const tag = findEquipmentTag(tagKey);
				const tagPeriod = tag?.spend?.period ?? tag?.forcesEffect?.period ?? tag?.reroll?.period;
				return tagPeriod !== period;
			});
			return kept.length === spent.length ? item : { ...item, spent: kept };
		});
		if (nextEquipment.some((item, i) => item !== equipment[i])) {
			updates["system.attributes.equipment"] = nextEquipment;
		}
		return updates;
	}

	// Clears every Scene-scoped spend/uses checkbox, plus Read the Room's shared hold — its own
	// text ties expiry to "the current situation," which this module treats as roughly a Scene
	// boundary for this button. Every separateHold move's own per-move pool (Mobility) is cleared
	// alongside it, the same "walk ALL_MOVES for a shared field" treatment _onRefreshSortie
	// already gives Sortie-scoped flatHold pools below.
	_onRefreshScene() {
		const updates = this._refreshPeriod("Scene");
		for (const move of ALL_MOVES) {
			if (move.separateHold) {
				updates[`system.attributes.moveHold.${move.key}.value`] = HOLD_MIN;
			}
		}
		updates["system.resources.hold.value"] = HOLD_MIN;
		this.actor.update(updates);
	}

	// Clears every Sortie-scoped spend/uses checkbox, plus the flat hold pools (B-Plot, Get Out of
	// My Way!, Once the War's Over — all scoped to "the Sortie" by their own text, see moves.js/
	// playbook-moves.js) and Alchemical Suite's Potions when installed (mirrors getData's own
	// grantsPotionsOnLeadASortie gating so an Astir without the part never gains a stray potions
	// field).
	_onRefreshSortie() {
		const updates = this._refreshPeriod("Sortie");
		for (const move of ALL_MOVES) {
			if (move.flatHold && move.period === "Sortie") {
				updates[`system.attributes.moveHold.${move.key}.value`] = HOLD_MIN;
			}
		}
		if (this._astirParts().some((part) => part.grantsPotionsOnLeadASortie)) {
			updates["system.attributes.astir.potions"] = { red: 0, blue: 0, yellow: 0 };
		}
		updates["system.attributes.downtimeTokens.value"] = this._downtimeTokensMax();
		this.actor.update(updates);
	}

	// Alchemical Suite's Potions (see getData/astir.js) — a plain decrement-only "Use" button, min
	// 0, the same manual-spend model this module gives every other consumable resource.
	_onAstirPotionUse(event) {
		const astir = this._astir();
		if (!astir) return;
		const { potion: color } = event.currentTarget.dataset;
		const current = astir.potions?.[color] ?? 0;
		if (current <= 0) return;
		this.actor.update({ [`system.attributes.astir.potions.${color}`]: current - 1 });
	}

	// Recomputes Power/Weapon Power against a prospective parts/equipment state and, when the result
	// is negative, forces Piloted off with a warning — an Astir with negative Power represents an
	// unsustainable loadout and can't be piloted (see claude.md's Piloted note; mirrors
	// _onAstirPilotedToggle's own guard against manually re-checking it in that state). Returns the
	// patch to spread into whatever update call triggered the recompute (a part or Astir weapon
	// add/edit/remove).
	_astirPowerUpdates(astir, { parts = astir.parts ?? [], equipment = this._equipment() } = {}) {
		const power = Math.min(astir.power ?? 0, astirMaxPower(parts, equipment));
		const weaponPower = Math.min(astir.weaponPower ?? 0, astirMaxWeaponPower(parts, equipment));
		const updates = {
			"system.attributes.astir.power": power,
			"system.attributes.astir.weaponPower": weaponPower
		};
		if (power < 0 && astir.piloted) {
			updates["system.attributes.astir.piloted"] = false;
			ui.notifications.warn("This Astir's Power is negative — Piloted has been turned off.");
		}
		return updates;
	}

	// Adding a Part can lower max Power below the current value (and, for Weapon Conduit, raise
	// max Weapon Power above 0) — all written in the same update, via _astirPowerUpdates.
	async _onAstirPartAdd() {
		const astir = this._astir();
		if (!astir) return;
		const current = astir.parts ?? [];
		const key = await chooseAstirPart(current);
		if (!key || current.includes(key)) return;
		const parts = [...current, key];
		this.actor.update({
			"system.attributes.astir.parts": parts,
			...this._astirPowerUpdates(astir, { parts })
		});
	}

	_onAstirPartRemove(event) {
		const astir = this._astir();
		if (!astir) return;
		const { part: key } = event.currentTarget.dataset;
		const current = astir.parts ?? [];
		if (!current.includes(key)) return;
		const parts = current.filter((k) => k !== key);
		this.actor.update({
			"system.attributes.astir.parts": parts,
			...this._astirPowerUpdates(astir, { parts })
		});
	}

	// The Astir's one unique move, picked from the character's own playbook pool, Cantrips, or the
	// dedicated Astir Moves catalog (see astir.js#astirMoveSections) — picking a new one replaces
	// whatever was there, since only one is ever held.
	async _onAstirMoveAdd() {
		const astir = this._astir();
		if (!astir) return;
		const key = await chooseAstirMove(this.actor.system.playbook?.name, astir.move ? [astir.move] : []);
		if (!key) return;
		this.actor.update({ "system.attributes.astir.move": key });
	}

	_onAstirMoveRemove() {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.move": null });
	}

	// The "O" catalog picker for an Astir weapon (see astir.js#chooseAstirWeapon), then the same
	// editor _onEquipmentCatalogAdd uses, with the astirWeapon option suppressing the fields an
	// Astir weapon doesn't need — see configureEquipment.
	async _onAstirWeaponAdd() {
		const astir = this._astir();
		if (!astir) return;
		const template = await chooseAstirWeapon();
		if (!template) return;

		const result = await configureEquipment(template, undefined, { astirWeapon: true });
		if (!result) return;

		// A new Astir weapon can carry Drain, which lowers max Power (see astir.js's
		// astirWeaponDrainTotal) — recompute via _astirPowerUpdates alongside saving it.
		const equipment = [
			...this._equipment(),
			// familiar: true (see astir.js's ASTIR_WEAPON_CATALOG) carries the same way astir: true
			// does — configureEquipment has no concept of either flag, only of hiding fields for
			// astirWeapon, so both are added here from the picked template rather than `result`.
			{ id: foundry.utils.randomID(), spent: [], astir: true, ...(template.familiar && { familiar: true }), ...result }
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	}

	// "+ Add Ardent" — unlike the Astir, a character may have any number of Ardents, so this always
	// appends rather than being a one-shot Create/Delete pair.
	_onArdentCreate() {
		this.actor.update({ "system.attributes.ardents": [...this._ardents(), buildArdent()] });
	}

	// Also drops every equipment entry this Ardent owns (see _onAstirDelete's own equivalent
	// cascade) — an orphaned ardent: "<id>" weapon with no Ardent to inherit Tier from would have
	// nothing to render.
	_onArdentDelete(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		this.actor.update({
			"system.attributes.ardents": current.filter((ardent) => ardent.id !== ardentId),
			"system.attributes.equipment": this._equipment().filter((item) => item.ardent !== ardentId)
		});
	}

	_onArdentNameChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const name = event.currentTarget.value.trim();
		this.actor.update({
			"system.attributes.ardents": current.map((ardent) => (ardent.id === ardentId ? { ...ardent, name } : ardent))
		});
	}

	// Unlike the Astir's Core-narrowed pair, an Ardent picks freely from the full Approach list
	// (see claude.md's Ardents section) — no dependent field to clear alongside this one.
	_onArdentApproachChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const approach = event.currentTarget.value;
		this.actor.update({
			"system.attributes.ardents": current.map((ardent) => (ardent.id === ardentId ? { ...ardent, approach } : ardent))
		});
	}

	// Ardents run Tier 2-4, defaulting to 2 — its own band, distinct from both the Astir's 3-4 and
	// equipment's 1-5 (see ardent.js).
	_onArdentTierStep(event) {
		const { ardentId, delta } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const tier = ardent.tier ?? ARDENT_TIER_DEFAULT;
		const next = Math.min(ARDENT_TIER_MAX, Math.max(ARDENT_TIER_MIN, tier + Number(delta)));
		if (next === tier) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (a.id === ardentId ? { ...a, tier: next } : a))
		});
	}

	// The "+" on an Ardent's own Parts section — offers only the Astir catalog's Ardent-eligible
	// subset (see ardent.js's ardentParts: no Power cost, no Weapon Power bonus), and refuses once
	// this Ardent's baseline parts+weapons loadout is already at ARDENT_MAX_LOADOUT. Uses
	// ardentBaselineLoadoutCount rather than the old ardentLoadoutCount so Commander's separately-
	// capped Ardent Features (see _onArdentFeaturePartAdd) never count against this cap — identical
	// to ardentLoadoutCount for every other playbook, which never has a Feature-flagged entry at all.
	async _onArdentPartAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentBaselineLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		const picked = ardent.parts ?? [];
		const key = await chooseAstirPart(picked, ardentParts(), { title: "Add an Ardent Part" });
		if (!key || picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: [...picked, key] } : a
			))
		});
	}

	// Repair Tokens (Standardised Parts — see astir.js) is a plain number input, same treatment the
	// Astir's own gets — Downtime isn't a tracked phase anywhere in this module, so the player edits
	// the count themselves. Handled manually, rather than a plain name-bound field, since Ardents
	// live in an array (see claude.md's Ardents section) the same way Dangers/Gravity Clocks do —
	// consistent with how every other per-entry field in one of those lists is wired.
	_onArdentRepairTokensChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const value = Math.max(0, Number(event.currentTarget.value) || 0);
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (a.id === ardentId ? { ...a, repairTokens: value } : a))
		});
	}

	_onArdentPartRemove(event) {
		const { ardentId, part: key } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const picked = ardent.parts ?? [];
		if (!picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: picked.filter((k) => k !== key) } : a
			))
		});
	}

	// The "O" catalog picker for an Ardent weapon (see ardent.js's ardentWeapons: no Drain-tagged
	// entries — an Ardent has no Power for Drain to reduce), then the same editor _onAstirWeaponAdd
	// uses, with the ardentWeapon option suppressing the fields an Ardent weapon doesn't need — see
	// configureEquipment. Refuses once this Ardent's baseline loadout is already at
	// ARDENT_MAX_LOADOUT, same guard _onArdentPartAdd applies to its own half of the same cap (see
	// its own comment on why this reads ardentBaselineLoadoutCount rather than ardentLoadoutCount).
	async _onArdentWeaponAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentBaselineLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		const template = await chooseAstirWeapon(ardentWeapons(), { title: "Pick an Ardent Weapon" });
		if (!template) return;

		const result = await configureEquipment(template, undefined, { ardentWeapon: true });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, ...result }
			]
		});
	}

	// Commander-exclusive counterpart to _onArdentPartAdd, drawing from ARDENT_FEATURE_PARTS (see
	// ardent.js) instead of the generic Astir-derived catalog, and capped against the separate
	// Ardent Feature pool (ardentFeatureLoadoutCount/ardentFeatureMax) rather than ARDENT_MAX_LOADOUT
	// — the two pools are independent, so filling one never blocks the other. The button itself only
	// renders for a Commander actor (see the template's isCommander gate), but the handler re-checks
	// nothing playbook-specific beyond that — an Ardent Feature part installed by any means still
	// reads back correctly through isAceFeaturePart.
	async _onArdentFeaturePartAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const max = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		if (ardentFeatureLoadoutCount(ardent, this._equipment()) >= max) {
			ui.notifications.warn(`This Ardent can carry at most ${max} Ardent Features.`);
			return;
		}
		const picked = ardent.parts ?? [];
		const key = await chooseAstirPart(picked, ARDENT_FEATURE_PARTS, { title: "Add an Ardent Feature" });
		if (!key || picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: [...picked, key] } : a
			))
		});
	}

	// Commander-exclusive counterpart to _onArdentWeaponAdd — same chain (catalog picker into
	// configureEquipment's ardentWeapon flow), against ARDENT_FEATURE_WEAPONS instead of
	// ardentWeapons(), capped against the same Ardent Feature pool _onArdentFeaturePartAdd checks.
	// The saved entry carries commanderFeature: true — set here and never player-editable — since a
	// saved equipment entry is a freely-editable snapshot with no link back to its source catalog
	// (see claude.md's Equipment notes), so this flag is the only way to tell it apart from a
	// baseline Ardent weapon after the fact (see ardent.js's ardentFeatureLoadoutCount).
	async _onArdentFeatureWeaponAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		const max = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		if (ardentFeatureLoadoutCount(ardent, this._equipment()) >= max) {
			ui.notifications.warn(`This Ardent can carry at most ${max} Ardent Features.`);
			return;
		}
		const template = await chooseAstirWeapon(ARDENT_FEATURE_WEAPONS, { title: "Pick an Ardent Feature Weapon" });
		if (!template) return;

		const result = await configureEquipment(template, undefined, { ardentWeapon: true });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, commanderFeature: true, ...result }
			]
		});
	}

	// The header "+" for Dangers just shows/hides the add-controls row (see _dangerAddOpen) rather
	// than opening a dialog — there's a label and a type to fill in first, so a single click can't
	// add anything on its own the way the other header "+" buttons do.
	_onDangerAddToggle() {
		this._dangerAddOpen = !this._dangerAddOpen;
		this.render();
	}

	// Reads the sibling label/type inputs out of the add-danger controls the clicked button lives
	// in, rather than off the button's own dataset — unlike every other control on this sheet,
	// there's no single value to encode as a data-* attribute on the button itself.
	_onDangerAdd(event) {
		const controls = event.currentTarget.closest(".danger-add-controls");
		const labelInput = controls.querySelector(".danger-label-input");
		const typeSelect = controls.querySelector(".danger-type-select");
		const label = labelInput.value.trim();

		const current = this._dangers();
		if (!label || current.length >= DANGER_MAX) return;

		this.actor.update({
			"system.attributes.dangers": [...current, { id: foundry.utils.randomID(), type: typeSelect.value, label }]
		});
		labelInput.value = "";
		// Players add dangers one at a time in practice, so close the row back up rather than
		// leaving it open for a second entry — same one-at-a-time assumption as _onDangerAddToggle
		// opening it fresh each time. The actor update above already triggers Foundry's own
		// re-render, so this just needs to flip the flag _onDangerAddToggle also uses.
		this._dangerAddOpen = false;
	}

	_onDangerRemove(event) {
		const { dangerId } = event.currentTarget.dataset;
		const current = this._dangers();
		this.actor.update({ "system.attributes.dangers": current.filter((danger) => danger.id !== dangerId) });
	}

	// Burdens (see claude.md's Social tab notes, _burdens above) — plain text entries, no max, no
	// type select: a blank one is appended immediately (unlike Dangers' add-controls row, which
	// collects a label first) since there's nothing else to configure.
	_onBurdenAdd() {
		this.actor.update({
			"system.attributes.burdens": [...this._burdens(), { id: foundry.utils.randomID(), label: "" }]
		});
	}

	_onBurdenRemove(event) {
		const { burdenId } = event.currentTarget.dataset;
		const current = this._burdens();
		this.actor.update({ "system.attributes.burdens": current.filter((burden) => burden.id !== burdenId) });
	}

	_onBurdenLabelChange(event) {
		const { burdenId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		const current = this._burdens();
		this.actor.update({
			"system.attributes.burdens": current.map((burden) => (burden.id === burdenId ? { ...burden, label } : burden))
		});
	}

	// Commander's Ace Crew roster (see _aceCrew, playbook-moves.js's Ace Crew move) — reuses
	// entry-list.js's generic CRUD helpers directly, the same pattern Carrier's Crew Members
	// establish via WorldActorSheet, just wired by hand here since PlaybookActorSheet doesn't
	// extend that base class.
	_onAceCrewAdd() {
		this.actor.update({
			"system.attributes.aceCrew": addEntry(this._aceCrew(), { name: "", adjective: "" })
		});
	}

	_onAceCrewRemove(event) {
		const { entryId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.aceCrew": removeEntry(this._aceCrew(), entryId) });
	}

	_onAceCrewFieldChange(event) {
		const { entryId, field } = event.currentTarget.dataset;
		this.actor.update({
			"system.attributes.aceCrew": updateEntryField(this._aceCrew(), entryId, field, event.currentTarget.value)
		});
	}

	_onGravityClockAdd(event) {
		const current = this._gravityClocks();
		if (current.length >= GRAVITY_CLOCK_MAX) return;
		this.actor.update({
			"system.attributes.gravityClocks": [
				...current,
				{ id: foundry.utils.randomID(), label: "", progress: 0, value: GRAVITY_CLOCK_VALUE_MIN }
			]
		});
	}

	_onGravityClockRemove(event) {
		const { clockId } = event.currentTarget.dataset;
		const current = this._gravityClocks();
		this.actor.update({ "system.attributes.gravityClocks": current.filter((clock) => clock.id !== clockId) });
	}

	_onGravityClockLabelChange(event) {
		const { clockId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		const current = this._gravityClocks();
		this.actor.update({
			"system.attributes.gravityClocks": current.map((clock) => (clock.id === clockId ? { ...clock, label } : clock))
		});
	}

	_onGravityClockValueStep(event) {
		const { clockId, delta } = event.currentTarget.dataset;
		const current = this._gravityClocks();
		const clock = current.find((c) => c.id === clockId);
		if (!clock) return;
		const value = clock.value ?? GRAVITY_CLOCK_VALUE_MIN;
		const next = Math.min(GRAVITY_CLOCK_VALUE_MAX, Math.max(GRAVITY_CLOCK_VALUE_MIN, value + Number(delta)));
		if (next === value) return;
		this.actor.update({
			"system.attributes.gravityClocks": current.map((c) => (c.id === clockId ? { ...c, value: next } : c))
		});
	}

	// Same click-to-set / click-top-to-decrement logic as _onSpotlightStep, but scoped to one
	// clock in the array via clockId instead of one actor-wide field.
	_onGravityClockStep(event) {
		const { clockId } = event.currentTarget.dataset;
		const step = Number(event.currentTarget.dataset.step);
		const current = this._gravityClocks();
		const clock = current.find((c) => c.id === clockId);
		if (!clock) return;
		const progress = clock.progress ?? 0;
		const next = step === progress ? step - 1 : step;
		const clamped = Math.min(GRAVITY_CLOCK_PROGRESS_MAX, Math.max(GRAVITY_CLOCK_PROGRESS_MIN, next));
		if (clamped === progress) return;
		this.actor.update({
			"system.attributes.gravityClocks": current.map((c) => (c.id === clockId ? { ...c, progress: clamped } : c))
		});
	}

	// Generic narrative clocks (see clocks.js) — universal, always-visible section, unlike Gravity
	// Clocks above. Each handler is a thin wrapper around clocks.js's own pure functions, the same
	// "thin sheet wiring over a pure helper" split entry-list.js/WorldActorSheet already establish.
	_onClockAdd() {
		this.actor.update({ "system.attributes.clocks": addClock(this._clocks(), {}) });
	}

	_onClockRemove(event) {
		const { clockId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.clocks": removeClock(this._clocks(), clockId) });
	}

	_onClockLabelChange(event) {
		const { clockId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		this.actor.update({ "system.attributes.clocks": updateClockLabel(this._clocks(), clockId, label) });
	}

	_onClockStepsChange(event) {
		const { clockId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.clocks": updateClockSteps(this._clocks(), clockId, event.currentTarget.value) });
	}

	// Same click-to-set / click-top-to-decrement interaction as _onGravityClockStep, delegated to
	// clocks.js's own setClockProgress since each clock here carries its own step count rather than
	// one shared constant.
	_onClockStep(event) {
		const { clockId } = event.currentTarget.dataset;
		const step = Number(event.currentTarget.dataset.step);
		this.actor.update({ "system.attributes.clocks": setClockProgress(this._clocks(), clockId, step) });
	}

	// Opens the create dialog, defaulting Kind to whichever "+ Add" button was clicked (Weapons vs
	// Gear section — see the template) — still changeable in the dialog itself, since the Kind
	// select there is the actual source of truth at submit time. Equipment is custom-made every
	// time (see claude.md, "Domain conventions"), so there's no catalog entry to append, only a
	// freshly authored one.
	async _onEquipmentAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const result = await configureEquipment({ kind });
		if (!result) return;

		await this._saveNewEquipment(result);
	}

	// The "+ Pick ... from Catalog" button. Chains two dialogs: chooseEquipmentCatalogItem picks
	// which template to start from, then the exact same editor _onEquipmentAdd uses opens
	// pre-filled with it — the player can still rename it, add/drop tags, or adjust tier before
	// saving, same as any custom entry. A catalog pick is a snapshot, not a reference (see
	// claude.md, "Equipment"): nothing about the saved entry records which catalog item it came
	// from, so it's indistinguishable from hand-authored equipment from this point on.
	async _onEquipmentCatalogAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const template = await chooseEquipmentCatalogItem(kind);
		if (!template) return;

		const result = await configureEquipment(template);
		if (!result) return;

		await this._saveNewEquipment(result);
	}

	// Turns a starting-gear pool entry (granted or picked — see starting-gear.js) into a real
	// equipment.js-shaped entry, the same snapshot treatment a catalog pick already gets. Only a
	// weapon-kind item carries scale at all (mirrors _equipmentEntry's own weapon-only spread) —
	// scale defaults to "foot", since none of these are Astir-scale (those are only ever added
	// from the Astir tab). tier is never stored — it derives from the wielding character (see
	// _equipmentEntry), same as every other mundane weapon.
	_startingGearEntry(item) {
		return {
			id: foundry.utils.randomID(),
			spent: [],
			kind: item.kind ?? "gear",
			name: item.name,
			description: item.description,
			tags: item.tags ?? [],
			...(item.kind === "weapon" && { scale: item.scale ?? "foot" })
		};
	}

	// The "+ Choose Starting Gear" button (see getData's startingGear.available). Chains two
	// independent dialogs the same way _onEquipmentCatalogAdd and _onMoveRoll already chain
	// theirs: chooseStartingGear's hard-capped subset pick (see starting-gear.js), then
	// configureEquipment for the pool's custom weapon (skipped entirely for a pool with no
	// customWeaponNote, e.g. The Commander before its pool is filled in). Each half resolves null
	// independently on cancel — cancelling one still saves the other if it was completed — and
	// picked gear items are saved as ordinary snapshot equipment entries, same treatment as a
	// catalog pick (see claude.md, "Equipment").
	//
	// Availability is a live emptiness check (see getData's startingGear.available), not a
	// one-time flag — so a fully-cancelled run leaves the actor untouched and the button available
	// to try again next render. Granted items (Augments I) are still added unconditionally,
	// regardless of what chooseStartingGear resolves — same treatment starting-moves.js's own
	// grantedKeys get from _onStartingMovesAdd.
	async _onStartingGearAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingGearPool(playbookName);
		// Mirrors getData's startingGear.available gate — a pool with nothing to offer (e.g. The
		// Commander today) never reaches the button in the first place, but guarding here too
		// keeps this a true no-op.
		const hasPickableItems = Boolean(pool?.groups?.some((group) => group.items.length));
		if (!pool || (!pool.grantedItems.length && !hasPickableItems && !pool.customWeaponNote)) return;

		const newEntries = pool.grantedItems.map((item) => this._startingGearEntry(item));

		// The dialog opens whenever there's anything to show — items to pick from, or just the
		// granted items' own read-only "You start with" block (see starting-gear-picker.hbs) — the
		// same "always confirm, even with nothing to pick" treatment _onStartingMovesAdd gives
		// Arcane Augments.
		if (pool.grantedItems.length || hasPickableItems) {
			const picked = await chooseStartingGear(playbookName);
			if (picked) newEntries.push(...picked.map((item) => this._startingGearEntry(item)));
		}

		if (pool.customWeaponNote) {
			const weapon = await configureEquipment({ kind: "weapon" }, undefined, { note: pool.customWeaponNote });
			if (weapon) newEntries.push({ id: foundry.utils.randomID(), spent: [], ...weapon });
		}

		// Nothing was granted and every dialog was cancelled — leave the actor untouched so the
		// button stays available (equipment is still empty) rather than writing a no-op update.
		if (!newEntries.length) return;
		await this.actor.update({ "system.attributes.equipment": [...this._equipment(), ...newEntries] });
	}

	// The "+ Choose Starting Moves" button (see getData's startingMovesAvailable). Availability is
	// a live emptiness check, not a one-time flag — cancelling the picker (or picking nothing)
	// leaves the actor's playbookMoves untouched, so the button stays available to try again.
	async _onStartingMovesAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingMovePool(playbookName);
		// Mirrors getData's startingMovesAvailable gate — a pool with nothing to offer at all (e.g.
		// The Commander today) never reaches the button in the first place, but guarding here too
		// keeps this a true no-op.
		if (!pool || (!pool.grantedKeys.length && !pool.pickOneKeys.length && !pool.chooseCount)) return;

		// The dialog always opens once there's anything at all to show (guarded above) — even a
		// grantedKeys-only pool (Arcane Augments) still gets a confirmation screen naming what the
		// player is receiving, rather than silently writing it the moment the button is clicked.
		// Granted moves are added unconditionally regardless of what the dialog resolves, same as
		// chooseStartingGear's own granted items above.
		const picked = await chooseStartingMoves(playbookName);
		const current = this._playbookMoves();
		const additions = [...pool.grantedKeys, ...(picked ?? [])].filter((key) => !current.includes(key));

		if (!additions.length) return;
		await this.actor.update({ "system.attributes.playbookMoves": [...current, ...additions] });
	}

	// Shared tail of _onEquipmentAdd and _onEquipmentCatalogAdd: appends a resolved
	// configureEquipment result as a brand-new entry, generating its id and starting spent empty.
	async _saveNewEquipment(result) {
		const current = this._equipment();
		await this.actor.update({
			"system.attributes.equipment": [...current, { id: foundry.utils.randomID(), spent: [], ...result }]
		});
	}

	async _onEquipmentEdit(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		if (!entry) return;

		// An Astir or Ardent weapon reopens with the matching option that hid its Kind/Scale/Tier
		// fields when it was first added (see _onAstirWeaponAdd/_onArdentWeaponAdd/
		// configureEquipment) — it's never possible to edit one into a mundane weapon or into Gear,
		// or from one frame's ownership into another's. Every other entry's call is left byte-for-
		// byte as it was before this option existed.
		const result = entry.astir
			? await configureEquipment(entry, undefined, { astirWeapon: true })
			: entry.ardent
				? await configureEquipment(entry, undefined, { ardentWeapon: true })
				: await configureEquipment(entry);
		if (!result) return;

		// Replaces the entry wholesale (keeping only id/spent/astir/ardent/familiar) rather than
		// merging onto the old one — editing a weapon down to Gear should drop its stale scale/tier,
		// not leave them dangling unrendered. astir/ardent/familiar are carried forward explicitly,
		// last, since result never includes any of them (configureEquipment has no concept of them,
		// only of hiding fields for astirWeapon/ardentWeapon).
		const equipment = current.map((item) => (
			item.id === equipmentId
				? {
					id: item.id,
					spent: item.spent ?? [],
					...result,
					...(item.astir && { astir: true }),
					...(item.ardent && { ardent: item.ardent }),
					...(item.familiar && { familiar: true })
				}
				: item
		));
		const updates = { "system.attributes.equipment": equipment };
		// Only an Astir weapon's own tags can move the Weapon Drain total (see astir.js's
		// astirWeaponDrainTotal) — every other edit (gear, mundane weapons, Ardent weapons — an
		// Ardent weapon can never carry Drain, see ardent.js's ardentWeapons) leaves Power untouched,
		// so this stays keyed off the pre-edit entry rather than always recomputing.
		const astir = this._astir();
		if (entry.astir && astir) Object.assign(updates, this._astirPowerUpdates(astir, { equipment }));
		await this.actor.update(updates);
	}

	_onEquipmentRemove(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		const equipment = current.filter((item) => item.id !== equipmentId);
		const updates = { "system.attributes.equipment": equipment };
		const astir = this._astir();
		if (entry?.astir && astir) Object.assign(updates, this._astirPowerUpdates(astir, { equipment }));
		this.actor.update(updates);
	}

	// The manual "new Scene" reset for a spent tag — same manual-tracking model as
	// _onMoveUseToggle and the Advancement checklist; nothing in this module knows when a Scene
	// starts, so a spent tag stays spent until the player unchecks it themselves (here, or by
	// spending it again through the roll dialog — see _onMoveRoll).
	_onEquipmentTagSpentToggle(event) {
		const { equipmentId, tag: tagKey } = event.currentTarget.dataset;
		const checked = event.currentTarget.checked;
		const current = this._equipment();
		this.actor.update({
			"system.attributes.equipment": current.map((item) => {
				if (item.id !== equipmentId) return item;
				const spent = item.spent ?? [];
				const nextSpent = checked ? [...new Set([...spent, tagKey])] : spent.filter((key) => key !== tagKey);
				return { ...item, spent: nextSpent };
			})
		});
	}

	// The "+" on the Playbook Moves section. The picker is passed the actor's playbook name (so it
	// knows which pool is "yours") and its current picks (so an already-taken move isn't offered
	// again) — see playbookMoveSections. It resolves null on cancel, on close, and when the dialog
	// was confirmed with nothing selected.
	async _onPlaybookMoveAdd() {
		const current = this._playbookMoves();
		const key = await choosePlaybookMove(this.actor.system.playbook?.name, current);
		if (!key || current.includes(key)) return;

		await this.actor.update({ "system.attributes.playbookMoves": [...current, key] });
	}

	_onPlaybookMoveRemove(event) {
		const { move: key } = event.currentTarget.dataset;
		const current = this._playbookMoves();
		if (!current.includes(key)) return;

		this.actor.update({ "system.attributes.playbookMoves": current.filter((k) => k !== key) });
	}

	// A plain boolean toggle, same shape as _onOverheatingToggle/_onAdvancementToggle — a "uses"
	// checkbox has no min/max to clamp, unlike Hold or Spotlight's stepped tracks.
	_onMoveUseToggle(event) {
		const { move: moveKey, use: useKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.moveUses.${moveKey}.${useKey}`]: event.currentTarget.checked });
	}

	// Let Loose's per-actor trait pick (see _moveGroupMoves' traitBonusChoosable/traitBonusChoice
	// and trait-bonuses.js's chooseTrait) — every option in the select is a real TRAITS key or the
	// blank "—" option, so nothing here needs to validate the value before writing it.
	_onTraitBonusChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.traitBonusChoices.${moveKey}`]: event.currentTarget.value });
	}

	async _onMoveRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		// usesWeapon (Exchange Blows, Strike Decisively — see moves.js) prompts which weapon (or
		// Unarmed) before rolling, so _rollMove's equipment spends can be scoped to it. `weapon`
		// stays undefined for every other move — the same "not applicable" signal
		// _equipmentSpends already reads. Skipped entirely when the actor has no weapons at all:
		// there's nothing to choose between, so Unarmed is simply true.
		//
		// Only weapons belonging to the currently mounted frame are offered (see claude.md's Piloted
		// note): the Astir's own weapons while it's mounted, one specific Ardent's while that Ardent
		// is mounted, mundane weapons while nothing is — never more than one of the three. A weapon
		// on the wrong side can never become `weapon` here, so nothing downstream (including the
		// Familiar +CHANNEL override below) needs to re-check mounted state itself.
		let weapon;
		if (move.usesWeapon) {
			const mountedFrameId = this._mountedFrame()?.id ?? null;
			const weapons = this._weapons().filter((w) => this._weaponFrameId(w) === mountedFrameId);
			if (weapons.length) {
				const weaponId = await chooseWeapon(weapons);
				if (weaponId === null) return;
				weapon = weaponId === UNARMED ? null : weapons.find((w) => w.id === weaponId) ?? null;
			} else {
				weapon = null;
			}
		}

		await this._rollMove(move, weapon);
	}

	// The weapon's own quick-roll buttons in the Equipment tab (see getData's weaponMoves) — same
	// roll as _onMoveRoll, but the weapon is already known from which button was clicked, so
	// there's no chooseWeapon prompt.
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, equipmentId } = event.currentTarget.dataset;
		const move = ALL_MOVES.find((m) => m.key === moveKey);
		const weapon = this._equipment().find((item) => item.id === equipmentId);
		if (!move || !weapon) return;

		await this._rollMove(move, weapon);
	}

	// The chosen weapon's still-live (unspent) forcesEffect tag, if any — e.g. Unreliable, which
	// forces Desperation on its first roll each Scene rather than being player-opted like `spend`
	// (see equipment.js's EQUIPMENT_TAGS comment). Returns the tag key alongside the effect so the
	// caller can mark it spent afterward the same way a player's own spend is marked. Only a
	// usesWeapon move ever passes a real weapon (or null for Unarmed) here — every other move's
	// `weapon` stays undefined and short-circuits to null via the falsy check.
	_forcedWeaponEffect(weapon) {
		if (!weapon) return null;
		const spent = weapon.spent ?? [];
		for (const tagKey of weapon.tags ?? []) {
			if (spent.includes(tagKey)) continue;
			const tag = findEquipmentTag(tagKey);
			if (tag?.forcesEffect) return { tagKey, effect: tag.forcesEffect.effect };
		}
		return null;
	}

	// The chosen weapon's still-live (unspent) reroll tag matching this move, if any (Decisive,
	// Defensive, Versatile — see equipment.js's EQUIPMENT_TAGS comment). Same shape/short-circuit
	// as _forcedWeaponEffect, but keyed off the move rather than always-applicable: Decisive only
	// lists strike-decisively, Defensive only exchange-blows, so a weapon's Decisive tag offers
	// nothing when rolling Exchange Blows.
	_availableReroll(move, weapon) {
		if (!weapon) return null;
		const spent = weapon.spent ?? [];
		for (const tagKey of weapon.tags ?? []) {
			if (spent.includes(tagKey)) continue;
			const tag = findEquipmentTag(tagKey);
			if (tag?.reroll?.moves.includes(move.key)) return { equipmentId: weapon.id, tagKey };
		}
		return null;
	}

	// Every move flagged grantsAutomaticSuccess (Hot-blooded, Once the War's Over, The Arity
	// Method — see playbook-moves.js) can spend its own hold pool or `uses` checkbox to treat the
	// move currently being rolled as a success, matching each move's own "succeed as if you'd
	// rolled a 10+" text. Unlike a reroll tag or an equipment spend, this isn't tied to the weapon
	// being used — it's actor-wide, so every flagged move (not just ones on this actor's picked
	// pools — a hold/uses value can only be non-zero if the move was actually picked and activated,
	// so there's nothing to additionally check there) is considered fresh for every roll. `moves`
	// (The Arity Method) restricts the offer to specific move keys, the same field/meaning as
	// equipment.js's own reroll.moves.
	_availableAutomaticSuccess(move) {
		return ALL_MOVES
			.filter((m) => m.grantsAutomaticSuccess)
			.filter((m) => !m.grantsAutomaticSuccess.moves || m.grantsAutomaticSuccess.moves.includes(move.key))
			.filter((m) => {
				const { cost, useKey } = m.grantsAutomaticSuccess;
				return useKey
					? !this.actor.system.attributes?.moveUses?.[m.key]?.[useKey]
					: (this.actor.system.attributes?.moveHold?.[m.key]?.value ?? 0) >= cost;
			})
			.map((m) => ({ key: m.key, name: m.name, ...m.grantsAutomaticSuccess }));
	}

	// Whether the chosen weapon has a live Guided tag (see equipment.js's EQUIPMENT_TAGS comment).
	// Unlike a spend or a reroll, Guided has no "once per period" limit and nothing to mark spent
	// — it's just always offerable as long as the weapon carries the tag.
	_weaponIsGuided(weapon) {
		if (!weapon) return false;
		return (weapon.tags ?? []).some((tagKey) => findEquipmentTag(tagKey)?.guided);
	}

	// The chosen weapon's full tag list, comma-joined for the chat card (see moves.js#rollMove's
	// weaponTags doc) — unlike _equipmentSpends this isn't limited to spendable tags or gated by
	// lockedEffect, it's just descriptive: every tag currently on the weapon, spent or not. null
	// for Unarmed/no weapon and for a weapon with no tags, matching weaponLabel's own null cases.
	_weaponTagLabels(weapon) {
		if (!weapon) return null;
		const labels = resolveEquipmentTags(weapon.tags ?? []).map((tag) => tag.label);
		return labels.length ? labels.join(", ") : null;
	}

	// Shared by _onMoveRoll (weapon resolved via chooseWeapon, or left undefined for a move that
	// isn't usesWeapon) and _onWeaponMoveRoll (weapon already known from the clicked button).
	async _rollMove(move, weapon) {
		let traits = this._moveTraits(move);
		// _moveTraits already resolved CREW for the single/zero-Carrier case; with more than one
		// Carrier in the world that's ambiguous, so ask which one before locking in the value this
		// roll actually uses. Cancelling aborts the whole roll, same convention chooseWeapon's own
		// cancel already has.
		if (move.fixedTraits?.some((trait) => trait.key === "crew")) {
			const carriers = findCarrierActors();
			if (carriers.length > 1) {
				const carrierId = await chooseCarrier(carriers);
				if (!carrierId) return;
				const crewValue = carriers.find((c) => c.id === carrierId)?.system.stats?.crew?.value ?? 0;
				traits = traits.map((trait) => (trait.key === "crew" ? { ...trait, value: crewValue } : trait));
			}
		}
		// A Familiar weapon (astir.js's familiar: true) rolls Exchange Blows/Strike Decisively with
		// +CHANNEL instead of the move's usual CLASH/TALK choice — replaces (not adds to) `traits`,
		// matching the rulebook's "instead," and reads CHANNEL's raw value directly rather than
		// going through availableMoveTraits/_moveTraits, since CHANNEL was never in either move's own
		// traits list to begin with. Never reached while unpiloted — a Familiar is always an Astir
		// weapon, and _onMoveRoll/_onWeaponMoveRoll only ever hand this a weapon matching the current
		// Piloted state (see claude.md's Piloted note) — so there's nothing to re-check here.
		if (move.usesWeapon && weapon?.familiar) {
			traits = [{ key: "channel", label: "CHANNEL", value: this.actor.system.stats?.channel?.value ?? 0 }];
		}
		if (!traits.length && !move.conditions) return;

		// bite-the-dust's forcesDesperationAtMaxPerils wins ties over a forced weapon tag — both
		// only ever lock to Desperation today, so there's nothing to actually conflict, but the
		// precedence keeps a future second forcesEffect value from silently overriding
		// bite-the-dust's danger-state read. Field Scout's standing grantsEffectOnMove (see
		// _grantedEffectForMove) sits last: it's a permanent grant rather than either of the other
		// two's emergency/reactive lock, so anything already forcing an axis wins over it.
		const forced = this._forcedWeaponEffect(weapon);
		const lockedEffect = (move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null)
			?? forced?.effect
			?? this._grantedEffectForMove(move)
			?? null;
		// Don't Follow Me's own pair — see _grantedTraitForMove/_grantedAdvantageForMove. The
		// granted trait key is resolved against this roll's own final `traits` list (rather than
		// TRAITS directly) so the locked option carries the same live, bonus-inclusive value every
		// other entry in the dialog does; a key that isn't actually offered here (e.g. the trait is
		// disabled for this actor) resolves to no lock at all.
		const grantedTraitKey = this._grantedTraitForMove(move);
		const lockedTrait = grantedTraitKey ? traits.find((t) => t.key === grantedTraitKey) ?? null : null;
		const lockedAdvantage = this._grantedAdvantageForMove(move);
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const astirPartSpends = this._astirPartSpends(lockedEffect);
		// Omitted entirely rather than passed as `false` when not guided — configureMoveRoll
		// already defaults it to false itself, and this keeps every non-Guided call's options
		// shape exactly as it was before Guided existed, same treatment `reroll` gets below. Spell
		// Routines (see astir.js) grants the same "Take 7-9" option for any move, not just a
		// weapon carrying the Guided tag — but only while installed on the currently mounted frame
		// (see claude.md's Piloted note). Spell Routines carries a powerCost, so it can only ever
		// be installed on the Astir, never an Ardent (see ardent.js's ardentParts) — but this reads
		// generically off _mountedParts() rather than special-casing the Astir, the same convention
		// every other reactive part effect in this file follows.
		const guided = this._weaponIsGuided(weapon) || this._mountedParts().some((part) => part.grantsGuided);
		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
			lockedAdvantage,
			lockedTrait,
			equipmentSpends,
			astirPartSpends,
			...(guided && { guided })
		});
		if (!config) return;

		// Guided's "Take 7-9" button resolves with nothing but this flag — no trait, dice, or
		// equipment/Astir Part spend was ever read, so there's nothing to mark spent and nothing
		// left to roll. Lead a Sortie's Potion grant (see _onMoveResolved) still applies — the
		// Sortie was led either way — but there's no dice to check for Flourish Component.
		if (config.takeSeven) {
			await postGuidedResult(this.actor, move, {
				weaponLabel: weapon ? weapon.name : "Unarmed",
				weaponTags: this._weaponTagLabels(weapon)
			});
			await this._onMoveResolved(move, null);
			return;
		}

		// A forced tag (e.g. Unreliable) is marked spent right alongside whatever the player
		// checked in the dialog — same single update, same "used this period" checkbox on the
		// Equipment tab (see _equipmentEntry's spendable) as a player-chosen spend.
		const spends = [...(config.spentTags ?? []), ...(forced ? [{ equipmentId: weapon.id, tagKey: forced.tagKey }] : [])];
		if (spends.length) await this._spendEquipmentTags(spends);
		if (config.spentParts?.length) await this._spendAstirParts(config.spentParts);

		// Pre-resolved to a plain {key, label} badge here (rather than passing partKeys into
		// moves.js) so that module never needs to import astir.js — see moves.js#rollMove.
		const spentPartLabels = (config.spentParts ?? [])
			.map((key) => findAstirPart(key))
			.filter(Boolean)
			.map((part) => ({ key: part.key, label: part.name }));

		// weapon undefined (not a usesWeapon move) leaves rollMove's options untouched, same as
		// today, for every move except Exchange Blows/Strike Decisively. null (Unarmed) or a real
		// weapon entry both add a weaponLabel (and that weapon's tags, if any — see
		// _weaponTagLabels), recorded on the chat card even when nothing was spent (see rollMove in
		// moves.js). reroll is only ever attached for a usesWeapon move too — rollMove itself
		// decides whether to actually offer it, based on whether this attempt fails (see moves.js).
		const reroll = this._availableReroll(move, weapon);
		// The derived Trait bonus for whichever trait the player actually chose (see
		// trait-bonuses.js) — moves.js#rollMove re-reads an actor trait's live stat value directly
		// rather than trusting config.trait.value (see its own comment), so the bonus has to reach
		// it as an explicit option instead. 0 for a fixedTrait (CREW) or an actor with no
		// traitBonus moves picked, same as every other actor with nothing to contribute here.
		const traitBonus = config.trait ? this._traitBonuses()[config.trait.key] ?? 0 : 0;
		// See _availableAutomaticSuccess — unlike reroll, this isn't scoped to a usesWeapon move, so
		// it's folded into baseOptions rather than the weapon-only branch below.
		const automaticSuccess = this._availableAutomaticSuccess(move);
		const baseOptions = {
			...config,
			...(traitBonus && { traitBonus }),
			...(spentPartLabels.length && { spentPartLabels }),
			...(automaticSuccess.length && { automaticSuccess })
		};
		const options = weapon !== undefined
			? {
				...baseOptions,
				weaponLabel: weapon ? weapon.name : "Unarmed",
				weaponTags: this._weaponTagLabels(weapon),
				...(reroll && { reroll })
			}
			: baseOptions;
		const result = await rollMove(this.actor, move, config.trait, options);
		await this._onMoveResolved(move, result.dice);
	}

	// Marks each checked equipment spend (see configureMoveRoll's Equipment section) as spent on
	// its entry, before the roll itself is posted — same write-then-roll order as read-the-room's
	// hold in rollMove, so the sheet reflects a spend even if the chat render that follows fails.
	async _spendEquipmentTags(spentTags) {
		await this.actor.update({ "system.attributes.equipment": mergeSpentTags(this._equipment(), spentTags) });
	}

	// The Astir Parts equivalent of _spendEquipmentTags above — marks each checked Astir Part
	// spend (Artifact) Expended, the same field the Astir Moves group's own manual checkbox
	// toggles (see _onMoveUseToggle), so either entry point lands on one shared state.
	async _spendAstirParts(partKeys) {
		const updates = {};
		for (const key of partKeys) updates[`system.attributes.moveUses.${key}.expended`] = true;
		await this.actor.update(updates);
	}

	// Runs after a move resolves — whether via a real roll (dice present) or Guided's "Take 7-9"
	// (dice null) — for the two Astir Part effects that react to a move's outcome rather than
	// being offered as part of setting it up. Both are scoped to the mounted frame's own parts (see
	// claude.md's Piloted note): a part contributes nothing when no frame is currently mounted.
	// Both grantsPotionsOnLeadASortie and regainPowerOnDoubles carry a powerCost, so — like
	// grantsGuided above — neither can ever be installed on an Ardent; this still reads generically
	// off _mountedParts() rather than special-casing the Astir.
	async _onMoveResolved(move, dice) {
		if (!this._mountedFrame()) return;
		const parts = this._mountedParts();
		if (move.key === "lead-a-sortie" && parts.some((part) => part.grantsPotionsOnLeadASortie)) {
			await this._grantPotions();
		}
		if (dice && parts.some((part) => part.regainPowerOnDoubles) && rolledDoubles(dice)) {
			await this._regainAstirPower(1);
		}
	}

	// Alchemical Suite's "Take 1 of each Potion when someone leads a Sortie" — scoped to this
	// actor's own Lead a Sortie roll (see astir.js's grantsPotionsOnLeadASortie comment). No cap:
	// the rules text never limits how many can stack.
	async _grantPotions() {
		const astir = this._astir();
		if (!astir) return;
		const potions = astir.potions ?? {};
		await this.actor.update({
			"system.attributes.astir.potions": {
				red: (potions.red ?? 0) + 1,
				blue: (potions.blue ?? 0) + 1,
				yellow: (potions.yellow ?? 0) + 1
			}
		});
	}

	// Flourish Component's "regain 1 Power when you roll doubles" — clamped to the derived max the
	// same way _onAstirPowerStep's manual stepper already is.
	async _regainAstirPower(amount) {
		const astir = this._astir();
		if (!astir) return;
		const max = astirMaxPower(astir.parts ?? []);
		const current = astir.power ?? 0;
		const next = Math.min(max, current + amount);
		if (next === current) return;
		await this.actor.update({ "system.attributes.astir.power": next });
	}

	// Stands in for a roll on moves with a flat hold grant (B-Plot, or a flatHold Soldier Move) —
	// there's no dice to roll, so clicking Activate just adds the move's flatHold to its own
	// (separately-tracked, per-move-key) pool, the same field _onFlatHoldStep writes to, clamped
	// the same way. Divination Codex's showsReadTheRoomQuestions gets a different Activate
	// behavior — no hold to grant, just Read the Room's real question list posted to chat — but
	// shares the same button per _moveGroupMoves' `activatable`. Either way, Activate also posts
	// the move's own description to chat, the same as the Description button (postMoveDescription)
	// — unlike that button, this fires even when the mechanical effect itself is a no-op (e.g.
	// hold already at HOLD_MAX), since the player still asked to see the move's text.
	async _onMoveActivate(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		if (move.flatHold) {
			const current = this.actor.system.attributes?.moveHold?.[move.key]?.value ?? 0;
			const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + move.flatHold));
			if (next !== current) {
				await this.actor.update({ [`system.attributes.moveHold.${move.key}.value`]: next });
			}
			await postMoveDescription(this.actor, move);
			return;
		}

		if (move.showsReadTheRoomQuestions) {
			// BASIC_MOVES is fixed, hardcoded content that always includes read-the-room — no
			// fallback needed for a lookup that can't fail.
			const readTheRoom = BASIC_MOVES.find((m) => m.key === "read-the-room");
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: `<h3>${move.name}</h3>`,
				content: `<ul>${readTheRoom.questions.map((question) => `<li>${question}</li>`).join("")}</ul>`
			});
			await this.actor.update({ [`system.attributes.moveUses.${move.key}.expended`]: true });
			await postMoveDescription(this.actor, move);
			return;
		}

		// A roll-less "choose N" menu (Facilitator's clandestine meeting, Bureaucrat, Shree Klime —
		// see playbook-moves.js's activateChoices). Same post-a-list-to-chat shape as
		// showsReadTheRoomQuestions above, but carrying the move's own prompt and options rather
		// than borrowing Read the Room's questions, and with no moveUses write: none of these moves
		// is capped per period, so there's nothing to expend.
		if (move.activateChoices) {
			const { prompt, options } = move.activateChoices;
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: `<h3>${move.name}</h3>`,
				content: `<p>${prompt}</p><ul>${options.map((option) => `<li>${option}</li>`).join("")}</ul>`
			});
			await postMoveDescription(this.actor, move);
		}
	}

	async _onMoveDescription(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		await postMoveDescription(this.actor, move);
	}
}

export function registerPlaybookActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("pbta", PlaybookActorSheet, {
			types: ["character"],
			makeDefault: true
		});
	});
}

// Marks the reroll's tag spent (the same array/checkbox _onEquipmentTagSpentToggle drives) and
// reruns rollMove with the original attempt's trait/options — posts a fresh chat message rather
// than editing the failed one, avoiding the Roll re-serialization hazard rollMove's own comment
// already flags for an already-evaluated roll. Not exported: only reachable through the click
// handler onRenderMoveChat wires up below.
async function handleReroll(reroll) {
	const actor = game.actors.get(reroll.actorId);
	const move = ALL_MOVES.find((m) => m.key === reroll.moveKey);
	if (!actor || !move) return;

	const equipment = actor.system.attributes?.equipment ?? [];
	await actor.update({
		"system.attributes.equipment": mergeSpentTags(equipment, [{ equipmentId: reroll.equipmentId, tagKey: reroll.tagKey }])
	});
	await rollMove(actor, move, reroll.trait, reroll.options);
}

// Spends an automatic-success source (see _availableAutomaticSuccess/moves.js#rollMove) and edits
// the already-posted card in place, rather than posting a fresh message the way handleReroll does
// — there's no re-roll here, just a display change, so there's no Roll to re-serialize.
// Roll.toMessage keeps a card's dice display in `content` and this module's own HTML in a separate
// `flavor` field (confirmed against the installed client's toMessage), so re-rendering only
// `flavor` leaves the original dice/content untouched.
async function handleAutomaticSuccess(message, offer, sourceKey) {
	const actor = game.actors.get(offer.actorId);
	const move = ALL_MOVES.find((m) => m.key === offer.moveKey);
	const source = offer.sources.find((s) => s.key === sourceKey);
	if (!actor || !move || !source) return;

	if (source.useKey) {
		await actor.update({ [`system.attributes.moveUses.${source.key}.${source.useKey}`]: true });
	} else {
		const current = actor.system.attributes?.moveHold?.[source.key]?.value ?? 0;
		await actor.update({
			[`system.attributes.moveHold.${source.key}.value`]: Math.max(HOLD_MIN, current - source.cost)
		});
	}

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...offer.flavorArgs,
		tier: "success",
		tierLabel: MOVE_RESULT_LABELS.success,
		resultText: move.results.success,
		reminders: null,
		conditions: [...offer.flavorArgs.conditions, { key: "automatic-success", label: `Automatic Success (${source.name})` }],
		automaticSuccess: []
	});
	await message.update({ flavor });
}

// Reads a rendered chat message's reroll offer (see moves.js#rollMove) and wires its Reroll
// button, if the card has one, to redo the roll. Exported as a standalone function — rather than
// only existing as an inline Hooks.on callback — so it's callable directly from tests: Hooks.on
// itself is a no-op in the test environment (see tests/setup.js), so a callback defined only
// inline there would never actually execute and would fail the coverage gate, the same reasoning
// this module's Dialog button callbacks are tested by invoking them directly rather than through
// Dialog's own (also stubbed) render.
export function onRenderMoveChat(message, html) {
	const reroll = message.flags?.["armor-astir"]?.reroll;
	if (reroll) {
		html.find(".move-reroll").on("click", (event) => {
			// Disables the button immediately so the same card can't be clicked for a second reroll —
			// the tag itself is also marked spent in handleReroll, but that only shows up on the
			// Equipment tab, not on this already-rendered card.
			event.currentTarget.disabled = true;
			handleReroll(reroll);
		});
	}

	const automaticSuccess = message.flags?.["armor-astir"]?.automaticSuccess;
	if (automaticSuccess) {
		html.find(".move-automatic-success").on("click", (event) => {
			// Same immediate-disable reasoning as the reroll button above — the regenerated card
			// (once handleAutomaticSuccess's message.update lands) has no automaticSuccess buttons
			// left at all, but that update is async.
			event.currentTarget.disabled = true;
			handleAutomaticSuccess(message, automaticSuccess, event.currentTarget.dataset.source);
		});
	}
}

export function registerMoveChatListeners() {
	Hooks.on("renderChatMessage", onRenderMoveChat);
}
