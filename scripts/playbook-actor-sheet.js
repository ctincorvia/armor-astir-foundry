import { PLAYBOOKS, swapActorPlaybook } from "./actor-creation.js";
import { availableApproaches } from "./approaches.js";
import { gravityTriggerForPlaybook } from "./gravity-triggers.js";
import { defaultConsiderText, defaultLookText } from "./playbook-flavor.js";
import {
	BASIC_MOVES,
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
	TIER_MAX,
	TIER_MIN,
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
import { chooseCarrier, findCarrierActors } from "./carrier-actor-sheet.js";

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

// All groups share one flat list for key lookup (_onMoveRoll/_onMoveDescription) since a move's
// section (Basic vs Special vs Playbook vs Astir) is purely a sheet-display grouping, not part of
// its identity. Playbook/Astir move keys are pool-prefixed (see playbook-moves.js/astir.js) so
// this stays collision-free as pools fill in. ASTIR_PART_CATALOG and ASTIR_MOVE_CATALOG are
// flattened in whole, the same "every possible entry, not just what's picked" treatment
// ALL_PLAYBOOK_MOVES already gives MOVE_POOLS — an individual actor's picked subset is resolved
// separately (see resolveAstirParts/findAstirMove in getData).
const ALL_MOVES = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES, ...ASTIR_PART_CATALOG, ...ASTIR_MOVE_CATALOG];

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
		// Rendered next to the Approach select in the header — see claude.md's Character Tier
		// notes: on-foot Tier and Approach are the same kind of "how you fight outside your Astir"
		// property. Derived fresh every render, not stored — see _conflictTier.
		data.tier = this._conflictTier();
		data.traits = TRAITS.map(({ key, label }) => {
			const stat = this.actor.system.stats?.[key];
			return { key, label, value: stat?.value ?? 0, disabled: stat?.disabled ?? false };
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
		// Basic and Special moves are the same fixed list for every actor; Playbook Moves is the
		// per-actor set picked via the "+" button, so it's the only group that renders add/remove
		// controls (see the template's addable/removable branches). All three run through the same
		// _moveGroupMoves, so a picked move gets trait filtering, gating, hold tracking and its
		// Roll/Activate/Description buttons with no extra handling. Display order is basic, then
		// playbook, then Astir (if any), then special — the character's own moves read before the
		// fixed reference lists, moveGroups[0] staying Basic for existing tests.
		// The "+ Choose Starting Moves" button (see _onStartingMovesAdd) — same "drop when empty,
		// disappear for good once clicked" treatment equipment's startingGear.available already
		// gets, so Commander/Impostor stay hidden until their pools are filled in (see
		// starting-moves.js).
		const startingMovePool = findStartingMovePool(this.actor.system.playbook?.name);
		data.moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES) },
			{
				label: "Playbook Moves",
				moves: this._moveGroupMoves(resolvePlaybookMoves(this._playbookMoves())),
				addable: true,
				removable: true,
				startingMovesAvailable: Boolean(startingMovePool?.pickOneKeys?.length || startingMovePool?.chooseCount)
					&& !this._startingMovesChosen()
			}
		];
		// Astir Parts read as moves, and the Astir's one unique move joins them under the same
		// group — both are picked/removed only from the Astir tab (see _onAstirPartAdd/
		// _onAstirMoveAdd), so unlike Playbook Moves this group renders no add/remove controls of
		// its own. Inserted here (rather than always pushed) so it lands between Playbook and
		// Special per the ordering above, and only when there's something to show — a character
		// with no Astir (or an empty one) leaves moveGroups exactly as it was before this feature
		// existed.
		const astirParts = this._astirParts();
		const astirMove = astir?.move ? findAstirMove(astir.move) : null;
		const astirMoves = [...astirParts, ...(astirMove ? [astirMove] : [])];
		const piloted = this._astirPiloted();
		if (astirMoves.length) {
			// Every entry in this group — parts and the Astir's own unique move alike — only does
			// anything while piloted (see claude.md's Piloted note), so `gated` is forced on top of
			// whatever gating a part already has, the same disabled-Roll/Activate treatment
			// channelGated already gives b-plot.
			data.moveGroups.push({
				label: "Astir Moves",
				moves: this._moveGroupMoves(astirMoves).map((move) => ({ ...move, gated: move.gated || !piloted }))
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
		// Astir and mundane weapons are mutually exclusive by Piloted state (see claude.md's Piloted
		// note): while piloted, only Astir weapons' quick-roll buttons work; while not, only mundane
		// weapons' do. Both are derived independently from the same ungated base — deriving one from
		// the other (e.g. astirWeaponMoves as weaponMoves.map(... || !piloted)) would compound both
		// conditions together and leave it permanently gated, since `piloted || !piloted` is always
		// true.
		const baseWeaponMoves = this._moveGroupMoves(WEAPON_MOVES).map(({ key, name, gated }) => ({ key, name, gated }));
		const weaponMoves = baseWeaponMoves.map((move) => ({ ...move, gated: move.gated || piloted }));
		const astirWeaponMoves = baseWeaponMoves.map((move) => ({ ...move, gated: move.gated || !piloted }));
		// The "+ Choose Starting Gear" button (see _onStartingGearAdd) only shows up once its
		// playbook's pool actually has something to offer — same "drop when empty" treatment
		// playbookMoveSections gives an empty pool, so Commander/Impostor stay hidden until their
		// pools are filled in (see starting-gear.js) — and disappears for good, on this actor,
		// the first time it's clicked (system.attributes.startingGearChosen), even if every dialog
		// it opens is cancelled: it's a one-time chargen step, not a repeatable picker like "+ Add
		// Playbook Move".
		const startingGearPool = findStartingGearPool(this.actor.system.playbook?.name);
		// Astir weapons (equipment entries flagged astir: true — see astir.js) are only ever
		// added/edited/removed from the Astir tab, but still surface here, read-only, per
		// claude.md — same computed entries feed both data.equipment.astirWeapons (Equipment tab)
		// and data.astir.weapons (Astir tab) below, so there's only one place resolving them.
		const astirWeapons = equipment
			.filter((item) => item.kind === "weapon" && item.astir)
			.map((item) => this._equipmentEntry(item, astirWeaponMoves, astir));
		data.equipment = {
			tierMin: TIER_MIN,
			tierMax: TIER_MAX,
			weapons: equipment
				.filter((item) => item.kind === "weapon" && !item.astir)
				.map((item) => this._equipmentEntry(item, weaponMoves)),
			astirWeapons,
			gear: equipment.filter((item) => item.kind !== "weapon").map((item) => this._equipmentEntry(item)),
			startingGear: {
				available: Boolean(startingGearPool?.items?.length || startingGearPool?.customWeaponNote)
					&& !this._startingGearChosen()
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
				piloted,
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
				parts: astirParts.map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType
				})),
				move: astirMove ? { key: astirMove.key, name: astirMove.name } : null,
				weapons: astirWeapons
			})
		};
		// The Controls section (see the template's dangers-column) — Mount Up/Dismount just drive
		// the same piloted flag the Astir tab's own checkbox does (see _setAstirPiloted), so their
		// disabled state mirrors exactly what claude.md's Piloted note and the feature ask require:
		// no Astir at all, or already in the target state.
		data.controls = {
			mountUpDisabled: !astir || piloted,
			dismountDisabled: !astir || !piloted
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

	_gravityClocks() {
		return this.actor.system.attributes?.gravityClocks ?? [];
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
	// _astirPiloted() themselves rather than this returning [] when unpiloted, since the Parts
	// list itself still needs to show installed-but-inactive parts.
	_astirParts() {
		return resolveAstirParts(this._astir()?.parts ?? []);
	}

	// Whether a part's/Astir weapon's benefits currently apply at all — see claude.md's "A part's
	// benefits only apply while the Astir is actually being piloted."
	_astirPiloted() {
		return Boolean(this._astir()?.piloted);
	}

	// This character's Tier for all physical-conflict purposes (see claude.md's Character Tier
	// notes) — derived fresh every call, never stored, so Mount Up/Dismount and the Astir tab's
	// own Piloted checkbox all move it for free through the single _setAstirPiloted write path,
	// with nothing to re-sync (same reasoning equipmentValue/advancements.topCount already
	// establish for other always-derived numbers). `base` is CHARACTER_TIER_DEFAULT unless a
	// picked playbook move raises it via conflictTier (Field Scout II, Giant Slayer III) — max
	// wins if somehow both are picked, since "pick either" is exactly as unenforced as every other
	// pool restriction in this module (see playbook-moves.js's own top comment). While piloting an
	// Astir, `effective` is the Astir's own Tier instead of `base` — on dismount it reverts.
	_conflictTier() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		const base = picked.reduce((max, move) => Math.max(max, move.conflictTier ?? 0), CHARACTER_TIER_DEFAULT);
		const astir = this._astir();
		if (this._astirPiloted() && astir) {
			return { base, effective: astir.tier ?? ASTIR_TIER_MIN, fromAstir: true };
		}
		return { base, effective: base, fromAstir: false };
	}

	// Shared by getData (render shape) and _equipmentSpends (roll dialog offers) so a tag's
	// current definition is only ever resolved from the catalog in one place. Value is always the
	// live sum of the entry's current tags (see equipmentValue in equipment.js), never stored, so
	// it can't drift out of sync after a tag is added or removed. scale/tier/weaponMoves are only
	// present for weapons — gear never carries them. weaponMoves is precomputed once in getData
	// and passed in here rather than recomputed per entry — see getData's own comment.
	//
	// `astir` (the actor's raw Astir data, or null) is only ever needed for an entry flagged
	// astir: true (see astir.js) — such an entry never stores its own scale/tier, inheriting the
	// Astir's Tier and the "astir" WEAPON_SCALES entry instead, so isAstir tells the template to
	// render that as read-only text rather than a stepper/select.
	_equipmentEntry(entry, weaponMoves = [], astir = null) {
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
				scale: entry.astir ? "astir" : entry.scale,
				scaleLabel: entry.astir
					? WEAPON_SCALES.find((s) => s.key === "astir")?.label
					: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
				tier: entry.astir ? astir?.tier : entry.tier,
				weaponMoves,
				isAstir: Boolean(entry.astir)
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
		const piloted = this._astirPiloted();
		const spends = [];
		for (const entry of this._equipment()) {
			// Astir/mundane weapons are mutually exclusive by Piloted state (see claude.md's Piloted
			// note) — a weapon on the wrong side never offers its tags, regardless of `weapon`/scoped
			// (this is the one spot that isn't already reached through _onMoveRoll's own piloted
			// filter, since a non-usesWeapon move leaves `weapon` undefined and scoped false). Gear
			// is untouched.
			if (entry.kind === "weapon" && Boolean(entry.astir) !== piloted) continue;
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

	// The Astir Parts equivalent of _equipmentSpends above — every installed part with a `spend`
	// field (Warding, Artifact — see astir.js) that isn't already Expended, offered in the roll
	// dialog's own Astir Parts section (see configureMoveRoll/move-roll-dialog.hbs). Returns []
	// outright when not piloted (see claude.md's Piloted note) — unlike _equipmentSpends, parts
	// aren't scoped by weapon, since none of them are weapon-specific.
	_astirPartSpends(lockedEffect) {
		if (!this._astirPiloted()) return [];
		const spends = [];
		for (const part of this._astirParts()) {
			if (!part.spend) continue;
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

	// Whether "+ Choose Starting Gear" has already been clicked on this actor (see getData's
	// startingGear.available and _onStartingGearAdd) — resets naturally on a playbook swap, since
	// swapActorPlaybook (actor-creation.js) replaces system.attributes wholesale from the new
	// playbook's compendium source, same as playbookMoves.
	_startingGearChosen() {
		return Boolean(this.actor.system.attributes?.startingGearChosen);
	}

	// Same one-shot treatment as _startingGearChosen above, for the "+ Choose Starting Moves"
	// button (see getData's startingMovesAvailable and _onStartingMovesAdd).
	_startingMovesChosen() {
		return Boolean(this.actor.system.attributes?.startingMovesChosen);
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
				// Codex's showsReadTheRoomQuestions gets the same button, for the same reason: no
				// dice, just an action to take.
				activatable: Boolean(move.flatHold) || Boolean(move.showsReadTheRoomQuestions),
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
				}))
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
		const actorTraits = availableMoveTraits(this.actor, move).map((trait) => ({
			key: trait.key,
			label: trait.label,
			value: this.actor.system.stats?.[trait.key]?.value ?? 0
		}));
		// Input Channel (see astir.js) offers +CHANNEL on any move, bypassing both that move's own
		// traits list and Channel's disabled gate — only while piloted, and only added once (a
		// move that already rolls +CHANNEL, e.g. Weave Magic, isn't given a second entry).
		if (this._astirPiloted() && !actorTraits.some((trait) => trait.key === "channel")
			&& this._astirParts().some((part) => part.grantsChannelOnAnyMove)) {
			// TRAITS is a fixed, six-entry constant (see traits.js) that always includes channel —
			// no fallback needed for a lookup that can't fail.
			const channel = TRAITS.find((trait) => trait.key === "channel");
			actorTraits.push({
				key: channel.key,
				label: channel.label,
				value: this.actor.system.stats?.channel?.value ?? 0
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
		html.find(".advancement-checkbox").on("change", this._onAdvancementToggle.bind(this));
		html.find(".danger-add-toggle").on("click", this._onDangerAddToggle.bind(this));
		html.find(".danger-add").on("click", this._onDangerAdd.bind(this));
		html.find(".danger-remove").on("click", this._onDangerRemove.bind(this));
		html.find(".gravity-clock-add").on("click", this._onGravityClockAdd.bind(this));
		html.find(".gravity-clock-remove").on("click", this._onGravityClockRemove.bind(this));
		html.find(".gravity-clock-label-input").on("change", this._onGravityClockLabelChange.bind(this));
		html.find(".gravity-clock-value-step").on("click", this._onGravityClockValueStep.bind(this));
		html.find(".gravity-clock-step").on("click", this._onGravityClockStep.bind(this));
		html.find(".starting-moves-add").on("click", this._onStartingMovesAdd.bind(this));
		html.find(".playbook-move-add").on("click", this._onPlaybookMoveAdd.bind(this));
		html.find(".playbook-move-remove").on("click", this._onPlaybookMoveRemove.bind(this));
		html.find(".move-use-checkbox").on("change", this._onMoveUseToggle.bind(this));
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
		html.find(".move-activate").on("click", this._onMoveActivate.bind(this));
		html.find(".move-description").on("click", this._onMoveDescription.bind(this));
		html.find(".equipment-add").on("click", this._onEquipmentAdd.bind(this));
		html.find(".equipment-catalog-add").on("click", this._onEquipmentCatalogAdd.bind(this));
		html.find(".starting-gear-add").on("click", this._onStartingGearAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onEquipmentEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onEquipmentRemove.bind(this));
		html.find(".equipment-tier-step").on("click", this._onEquipmentTierStep.bind(this));
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

	// Shared by the Astir tab's own Piloted checkbox and the Controls section's Mount Up/Dismount
	// buttons — blocks setting Piloted true while Power is negative (see claude.md's Piloted note),
	// mirroring _astirPowerUpdates' own auto-uncheck-on-mutation guard. Returns whether the update
	// actually applied, so a caller with something to revert (the checkbox) can do so. Every caller
	// already checks for an Astir before reaching this (see _onAstirPilotedToggle/_onMountUp/
	// _onDismount), so this doesn't re-check.
	_setAstirPiloted(checked) {
		const astir = this._astir();
		if (checked && (astir.power ?? 0) < 0) {
			ui.notifications.warn("This Astir's Power is negative — it can't be piloted until the loadout changes.");
			return false;
		}
		this.actor.update({ "system.attributes.astir.piloted": checked });
		return true;
	}

	_onAstirPilotedToggle(event) {
		if (!this._astir()) return;
		const checked = event.currentTarget.checked;
		if (!this._setAstirPiloted(checked)) {
			event.currentTarget.checked = !checked;
		}
	}

	// Disabled in the template whenever there's no Astir or it's already piloted (see getData's
	// data.controls), but guarded here too in case a click still lands.
	_onMountUp() {
		const astir = this._astir();
		if (!astir || astir.piloted) return;
		this._setAstirPiloted(true);
	}

	_onDismount() {
		const astir = this._astir();
		if (!astir || !astir.piloted) return;
		this._setAstirPiloted(false);
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

	// The "+ Choose Starting Gear" button (see getData's startingGear.available). Chains two
	// independent dialogs the same way _onEquipmentCatalogAdd and _onMoveRoll already chain
	// theirs: chooseStartingGear's hard-capped subset pick (see starting-gear.js), then
	// configureEquipment for the pool's custom weapon (skipped entirely for a pool with no
	// customWeaponNote, e.g. Commander/Impostor before their pools are filled in). Each half
	// resolves null independently on cancel — cancelling one still saves the other if it was
	// completed — and picked gear items are saved as ordinary snapshot equipment entries, same
	// treatment as a catalog pick (see claude.md, "Equipment").
	//
	// startingGearChosen is always set, even if both dialogs are cancelled — clicking the button
	// is what spends the one-time allowance, not what gets picked from it, so the button
	// disappears for good (see getData) whether or not anything was actually added.
	async _onStartingGearAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingGearPool(playbookName);
		// Mirrors getData's startingGear.available gate — a pool with nothing to offer (e.g.
		// Commander/Impostor today) never reaches the button in the first place, but guarding
		// here too keeps this a true no-op rather than spending the one-time flag for nothing.
		if (!pool || (!pool.items.length && !pool.customWeaponNote)) return;

		const newEntries = [];

		if (pool.items.length) {
			const picked = await chooseStartingGear(playbookName);
			if (picked) {
				newEntries.push(...picked.map((item) => ({
					id: foundry.utils.randomID(),
					spent: [],
					kind: "gear",
					name: item.name,
					description: item.description,
					tags: item.tags ?? []
				})));
			}
		}

		if (pool.customWeaponNote) {
			const weapon = await configureEquipment({ kind: "weapon" }, undefined, { note: pool.customWeaponNote });
			if (weapon) newEntries.push({ id: foundry.utils.randomID(), spent: [], ...weapon });
		}

		const updates = { "system.attributes.startingGearChosen": true };
		if (newEntries.length) updates["system.attributes.equipment"] = [...this._equipment(), ...newEntries];

		await this.actor.update(updates);
	}

	// The "+ Choose Starting Moves" button (see getData's startingMovesAvailable). Same one-time
	// allowance shape as _onStartingGearAdd: startingMovesChosen is always set, even if the dialog
	// is cancelled or nothing was picked, since clicking the button is what spends the allowance —
	// the button disappears for good either way.
	async _onStartingMovesAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingMovePool(playbookName);
		// Mirrors getData's startingMovesAvailable gate — a pool with nothing to offer (e.g.
		// Commander/Impostor today) never reaches the button in the first place, but guarding here
		// too keeps this a true no-op rather than spending the one-time flag for nothing.
		if (!pool || (!pool.pickOneKeys.length && !pool.chooseCount)) return;

		const picked = await chooseStartingMoves(playbookName);

		const updates = { "system.attributes.startingMovesChosen": true };
		if (picked?.length) {
			const current = this._playbookMoves();
			const additions = picked.filter((key) => !current.includes(key));
			if (additions.length) updates["system.attributes.playbookMoves"] = [...current, ...additions];
		}

		await this.actor.update(updates);
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

		// An Astir weapon reopens with the same astirWeapon option that hid its Kind/Scale/Tier
		// fields when it was first added (see _onAstirWeaponAdd/configureEquipment) — it's never
		// possible to edit one into a non-Astir weapon or into Gear. Every other entry's call is
		// left byte-for-byte as it was before this option existed.
		const result = entry.astir
			? await configureEquipment(entry, undefined, { astirWeapon: true })
			: await configureEquipment(entry);
		if (!result) return;

		// Replaces the entry wholesale (keeping only id/spent/astir/familiar) rather than merging onto
		// the old one — editing a weapon down to Gear should drop its stale scale/tier, not leave
		// them dangling unrendered. astir/familiar are carried forward explicitly, last, since result
		// never includes either (configureEquipment has no concept of them, only of hiding fields for
		// astirWeapon).
		const equipment = current.map((item) => (
			item.id === equipmentId
				? {
					id: item.id,
					spent: item.spent ?? [],
					...result,
					...(item.astir && { astir: true }),
					...(item.familiar && { familiar: true })
				}
				: item
		));
		const updates = { "system.attributes.equipment": equipment };
		// Only an Astir weapon's own tags can move the Weapon Drain total (see astir.js's
		// astirWeaponDrainTotal) — every other edit (gear, mundane weapons) leaves Power untouched,
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

	_onEquipmentTierStep(event) {
		const { equipmentId, delta } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		if (!entry) return;
		const tier = entry.tier ?? TIER_MIN;
		const next = Math.min(TIER_MAX, Math.max(TIER_MIN, tier + Number(delta)));
		if (next === tier) return;
		this.actor.update({
			"system.attributes.equipment": current.map((item) => (item.id === equipmentId ? { ...item, tier: next } : item))
		});
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

	async _onMoveRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		// usesWeapon (Exchange Blows, Strike Decisively — see moves.js) prompts which weapon (or
		// Unarmed) before rolling, so _rollMove's equipment spends can be scoped to it. `weapon`
		// stays undefined for every other move — the same "not applicable" signal
		// _equipmentSpends already reads. Skipped entirely when the actor has no weapons at all:
		// there's nothing to choose between, so Unarmed is simply true.
		//
		// Only weapons matching the current Piloted state are offered (see claude.md's Piloted
		// note): Astir weapons while piloted, mundane weapons while not — never both. A weapon on
		// the wrong side can never become `weapon` here, so nothing downstream (including the
		// Familiar +CHANNEL override below) needs to re-check piloted state itself.
		let weapon;
		if (move.usesWeapon) {
			const weapons = this._weapons().filter((w) => Boolean(w.astir) === this._astirPiloted());
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
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const astirPartSpends = this._astirPartSpends(lockedEffect);
		// Omitted entirely rather than passed as `false` when not guided — configureMoveRoll
		// already defaults it to false itself, and this keeps every non-Guided call's options
		// shape exactly as it was before Guided existed, same treatment `reroll` gets below. Spell
		// Routines (see astir.js) grants the same "Take 7-9" option for any move, not just a
		// weapon carrying the Guided tag — but only while piloted (see claude.md's Piloted note).
		const guided = this._weaponIsGuided(weapon)
			|| (this._astirPiloted() && this._astirParts().some((part) => part.grantsGuided));
		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
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
		const baseOptions = { ...config, ...(spentPartLabels.length && { spentPartLabels }) };
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
	// spend (Warding, Artifact) Expended, the same field the Astir Moves group's own manual
	// checkbox toggles (see _onMoveUseToggle), so either entry point lands on one shared state.
	async _spendAstirParts(partKeys) {
		const updates = {};
		for (const key of partKeys) updates[`system.attributes.moveUses.${key}.expended`] = true;
		await this.actor.update(updates);
	}

	// Runs after a move resolves — whether via a real roll (dice present) or Guided's "Take 7-9"
	// (dice null) — for the two Astir Part effects that react to a move's outcome rather than
	// being offered as part of setting it up. Both are scoped to piloted (see claude.md's Piloted
	// note): a part contributes nothing when the Astir isn't currently being flown.
	async _onMoveResolved(move, dice) {
		if (!this._astirPiloted()) return;
		const parts = this._astirParts();
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

// Reads a rendered chat message's reroll offer (see moves.js#rollMove) and wires its Reroll
// button, if the card has one, to redo the roll. Exported as a standalone function — rather than
// only existing as an inline Hooks.on callback — so it's callable directly from tests: Hooks.on
// itself is a no-op in the test environment (see tests/setup.js), so a callback defined only
// inline there would never actually execute and would fail the coverage gate, the same reasoning
// this module's Dialog button callbacks are tested by invoking them directly rather than through
// Dialog's own (also stubbed) render.
export function onRenderMoveChat(message, html) {
	const reroll = message.flags?.["armor-astir"]?.reroll;
	if (!reroll) return;

	html.find(".move-reroll").on("click", (event) => {
		// Disables the button immediately so the same card can't be clicked for a second reroll —
		// the tag itself is also marked spent in handleReroll, but that only shows up on the
		// Equipment tab, not on this already-rendered card.
		event.currentTarget.disabled = true;
		handleReroll(reroll);
	});
}

export function registerMoveChatListeners() {
	Hooks.on("renderChatMessage", onRenderMoveChat);
}
