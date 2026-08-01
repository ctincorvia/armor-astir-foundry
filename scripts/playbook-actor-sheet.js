import { PLAYBOOKS, swapActorPlaybook } from "./actor-creation.js";
import {
	BASIC_MOVES,
	SPECIAL_MOVES,
	availableMoveTraits,
	configureMoveRoll,
	postMoveDescription,
	rollMove
} from "./moves.js";
import { TRAITS } from "./traits.js";
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

export const PLAYBOOK_SHEET_TEMPLATE = "modules/armor-astir/templates/playbook-actor-sheet.hbs";

export { TRAITS };

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

// Matches the highest per-tier hold any basic move currently grants (read-the-room's 3 on a
// 10+); also reused as b-plot's flat hold cap (its own separately-tracked pool — see
// _moveGroupMoves) since both cap at 3. Revisit if a future move grants more.
const HOLD_MIN = 0;
const HOLD_MAX = 3;

const POWER_MIN = 0;
const POWER_MAX = 4;

const SPOTLIGHT_MIN = 0;
const SPOTLIGHT_MAX = 6;

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

// All three groups share one flat list for key lookup (_onMoveRoll/_onMoveDescription) since a
// move's section (Basic vs Special vs Playbook) is purely a sheet-display grouping, not part of
// its identity. Playbook move keys are pool-prefixed (see playbook-moves.js) so this stays
// collision-free as pools fill in.
const ALL_MOVES = [...BASIC_MOVES, ...SPECIAL_MOVES, ...ALL_PLAYBOOK_MOVES];

// Moves that represent attacking with a weapon (see moves.js's usesWeapon). Drives both
// _onMoveRoll's weapon-choice prompt and the per-weapon quick-roll buttons in the Equipment tab
// (see _equipmentEntry).
const WEAPON_MOVES = ALL_MOVES.filter((move) => move.usesWeapon);

// All playbook actors are "character" type (see claude.md, "Domain conventions"). Every
// playbook shares the same name/callsign/photo header, so one sheet class and template
// serves all of them; a playbook that needs its own fields can extend this later.
export class PlaybookActorSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: PLAYBOOK_SHEET_TEMPLATE,
			width: 620,
			height: "auto",
			tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "moves" }]
		});
	}

	getData(options) {
		const data = super.getData(options);
		data.playbooks = PLAYBOOKS;
		data.currentPlaybookId = PLAYBOOKS.find((p) => p.name === this.actor.system.playbook?.name)?.packId ?? null;
		data.traits = TRAITS.map(({ key, label }) => {
			const stat = this.actor.system.stats?.[key];
			return { key, label, value: stat?.value ?? 0, disabled: stat?.disabled ?? false };
		});
		// Astirs' overheating status lives on the character sheet for now (Astirs aren't their own
		// documents yet — see Cool Off in moves.js) and only matters once CHANNEL is enabled, same
		// gating as weave-magic's traits (missing stat entry reads as enabled, not disabled).
		data.overheating = {
			visible: !this.actor.system.stats?.channel?.disabled,
			value: this.actor.system.attributes?.overheating?.value ?? false
		};
		// Power is another Channel/Astir-linked resource (spent by Subsystems to re-activate a
		// part), so it's gated identically to overheating rather than always shown.
		data.power = {
			visible: !this.actor.system.stats?.channel?.disabled,
			value: this.actor.system.attributes?.power?.value ?? 0
		};
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
		// Roll/Activate/Description buttons with no extra handling.
		data.moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES) },
			{ label: "Special Moves", moves: this._moveGroupMoves(SPECIAL_MOVES) },
			{
				label: "Playbook Moves",
				moves: this._moveGroupMoves(resolvePlaybookMoves(this._playbookMoves())),
				addable: true,
				removable: true
			}
		];
		// Custom-made equipment (see claude.md, "Domain conventions") — never picked from a list,
		// so unlike moves there's no shared catalog of equipment itself, only of the Tags that can
		// be attached to it (see equipment.js). One array partitioned by `kind` into weapons and
		// gear rather than two separate arrays, since add/edit/remove and tag resolution are
		// identical either way and only the render needs to tell them apart. Weapons get their own
		// header per claude.md; tierMin/tierMax feed the tab's Tier stepper bounds.
		const equipment = this._equipment();
		// The Equipment tab's per-weapon quick-roll buttons (see _onWeaponMoveRoll) — computed once
		// and attached to every weapon entry below, rather than living once under data.equipment
		// and cross-referenced from inside the weapons {{#each}}, which would need a riskier
		// `../equipment.weaponMoves` template lookup. Reusing _moveGroupMoves (rather than
		// hand-rolling gating) means these buttons inherit the exact same, already-tested `gated`
		// semantics as the Moves tab's own Roll buttons for free.
		const weaponMoves = this._moveGroupMoves(WEAPON_MOVES).map(({ key, name, gated }) => ({ key, name, gated }));
		data.equipment = {
			tierMin: TIER_MIN,
			tierMax: TIER_MAX,
			weapons: equipment.filter((item) => item.kind === "weapon").map((item) => this._equipmentEntry(item, weaponMoves)),
			gear: equipment.filter((item) => item.kind !== "weapon").map((item) => this._equipmentEntry(item))
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
			canAdd: dangers.length < DANGER_MAX
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

	// Shared by getData (render shape) and _equipmentSpends (roll dialog offers) so a tag's
	// current definition is only ever resolved from the catalog in one place. Value is always the
	// live sum of the entry's current tags (see equipmentValue in equipment.js), never stored, so
	// it can't drift out of sync after a tag is added or removed. scale/tier/weaponMoves are only
	// present for weapons — gear never carries them. weaponMoves is precomputed once in getData
	// and passed in here rather than recomputed per entry — see getData's own comment.
	_equipmentEntry(entry, weaponMoves = []) {
		const tags = resolveEquipmentTags(entry.tags ?? []).map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			spendable: Boolean(tag.spend),
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
				scale: entry.scale,
				scaleLabel: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
				tier: entry.tier,
				weaponMoves
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
		const spends = [];
		for (const entry of this._equipment()) {
			if (scoped && entry.kind === "weapon" && entry.id !== weapon?.id) continue;
			const spent = entry.spent ?? [];
			for (const tagKey of entry.tags ?? []) {
				if (spent.includes(tagKey)) continue;
				const tag = findEquipmentTag(tagKey);
				if (!tag?.spend) continue;
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

	_advancements() {
		return this.actor.system.attributes?.advancements ?? {};
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
			// field; b-plot's flat, roll-less hold is tracked separately in
			// system.attributes.bplotHold (an ObjectField, unlike the strictly-schemed
			// system.resources) so the two pools can't collide on one actor.
			const hold = move.flatHold
				? this.actor.system.attributes?.bplotHold?.value ?? 0
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
				// see the template's rollable/activatable branch and _onMoveActivate.
				activatable: Boolean(move.flatHold),
				// Weave Magic's description stays readable even while its Roll button is gated —
				// you can still learn what the move does. B-Plot is different: being "in the
				// b-plot" isn't something a Channel-enabled character can do at all, so its
				// Description button greys out too, alongside Roll/Activate and the hold stepper.
				descriptionGated: channelGated,
				trackHold: Boolean(move.hold) || Boolean(move.flatHold),
				// Which stepper/handler the template wires up (_onHoldStep vs
				// _onBplotHoldStep) — see the hold comment above.
				separateHoldPool: Boolean(move.flatHold),
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
	// correspond to any TRAITS entry or system.stats key.
	_moveTraits(move) {
		const actorTraits = availableMoveTraits(this.actor, move).map((trait) => ({
			key: trait.key,
			label: trait.label,
			value: this.actor.system.stats?.[trait.key]?.value ?? 0
		}));
		return [...actorTraits, ...(move.fixedTraits ?? [])];
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".playbook-select").on("change", this._onPlaybookChange.bind(this));
		html.find(".trait-step").on("click", this._onTraitStep.bind(this));
		html.find(".hold-step").on("click", this._onHoldStep.bind(this));
		html.find(".bplot-hold-step").on("click", this._onBplotHoldStep.bind(this));
		html.find(".power-step").on("click", this._onPowerStep.bind(this));
		html.find(".spotlight-step").on("click", this._onSpotlightStep.bind(this));
		html.find(".overheating-checkbox").on("change", this._onOverheatingToggle.bind(this));
		html.find(".advancement-checkbox").on("change", this._onAdvancementToggle.bind(this));
		html.find(".danger-add").on("click", this._onDangerAdd.bind(this));
		html.find(".danger-remove").on("click", this._onDangerRemove.bind(this));
		html.find(".gravity-clock-add").on("click", this._onGravityClockAdd.bind(this));
		html.find(".gravity-clock-remove").on("click", this._onGravityClockRemove.bind(this));
		html.find(".gravity-clock-label-input").on("change", this._onGravityClockLabelChange.bind(this));
		html.find(".gravity-clock-value-step").on("click", this._onGravityClockValueStep.bind(this));
		html.find(".gravity-clock-step").on("click", this._onGravityClockStep.bind(this));
		html.find(".playbook-move-add").on("click", this._onPlaybookMoveAdd.bind(this));
		html.find(".playbook-move-remove").on("click", this._onPlaybookMoveRemove.bind(this));
		html.find(".move-use-checkbox").on("change", this._onMoveUseToggle.bind(this));
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
		html.find(".move-activate").on("click", this._onMoveActivate.bind(this));
		html.find(".move-description").on("click", this._onMoveDescription.bind(this));
		html.find(".equipment-add").on("click", this._onEquipmentAdd.bind(this));
		html.find(".equipment-catalog-add").on("click", this._onEquipmentCatalogAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onEquipmentEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onEquipmentRemove.bind(this));
		html.find(".equipment-tier-step").on("click", this._onEquipmentTierStep.bind(this));
		html.find(".equipment-tag-spent-checkbox").on("change", this._onEquipmentTagSpentToggle.bind(this));
		html.find(".weapon-move-roll").on("click", this._onWeaponMoveRoll.bind(this));
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

	_onBplotHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.bplotHold?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.bplotHold.value": next });
	}

	_onOverheatingToggle(event) {
		this.actor.update({ "system.attributes.overheating.value": event.currentTarget.checked });
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

	_onPowerStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.power?.value ?? 0;
		const next = Math.min(POWER_MAX, Math.max(POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.power.value": next });
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

		const result = await configureEquipment(entry);
		if (!result) return;

		// Replaces the entry wholesale (keeping only id/spent) rather than merging onto the old
		// one — editing a weapon down to Gear should drop its stale scale/tier, not leave them
		// dangling unrendered.
		await this.actor.update({
			"system.attributes.equipment": current.map((item) => (
				item.id === equipmentId ? { id: item.id, spent: item.spent ?? [], ...result } : item
			))
		});
	}

	_onEquipmentRemove(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		this.actor.update({ "system.attributes.equipment": current.filter((item) => item.id !== equipmentId) });
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
		let weapon;
		if (move.usesWeapon) {
			const weapons = this._weapons();
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

	// Shared by _onMoveRoll (weapon resolved via chooseWeapon, or left undefined for a move that
	// isn't usesWeapon) and _onWeaponMoveRoll (weapon already known from the clicked button).
	async _rollMove(move, weapon) {
		const traits = this._moveTraits(move);
		if (!traits.length && !move.conditions) return;

		// Only bite-the-dust declares forcesDesperationAtMaxPerils (see moves.js) — every other
		// move resolves lockedEffect to null and configureMoveRoll's Effect select behaves exactly
		// as before.
		const lockedEffect = move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null;
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const config = await configureMoveRoll(move, traits, { lockedEffect, equipmentSpends });
		if (!config) return;

		if (config.spentTags?.length) await this._spendEquipmentTags(config.spentTags);

		// weapon undefined (not a usesWeapon move) leaves rollMove's options untouched, same as
		// today, for every move except Exchange Blows/Strike Decisively. null (Unarmed) or a real
		// weapon entry both add a weaponLabel, recorded on the chat card even when nothing was
		// spent (see rollMove in moves.js).
		const options = weapon !== undefined ? { ...config, weaponLabel: weapon ? weapon.name : "Unarmed" } : config;
		await rollMove(this.actor, move, config.trait, options);
	}

	// Marks each checked equipment spend (see configureMoveRoll's Equipment section) as spent on
	// its entry, before the roll itself is posted — same write-then-roll order as read-the-room's
	// hold in rollMove, so the sheet reflects a spend even if the chat render that follows fails.
	async _spendEquipmentTags(spentTags) {
		const current = this._equipment();
		await this.actor.update({
			"system.attributes.equipment": current.map((item) => {
				const additions = spentTags.filter((spend) => spend.equipmentId === item.id).map((spend) => spend.tagKey);
				if (!additions.length) return item;
				return { ...item, spent: [...new Set([...(item.spent ?? []), ...additions])] };
			})
		});
	}

	// Stands in for a roll on moves with a flat hold grant (B-Plot) — there's no dice to roll, so
	// clicking Activate just adds the move's flatHold to its (separately-tracked) pool, same
	// field _onBplotHoldStep writes to, clamped the same way.
	async _onMoveActivate(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move || !move.flatHold) return;

		const current = this.actor.system.attributes?.bplotHold?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + move.flatHold));
		if (next === current) return;
		await this.actor.update({ "system.attributes.bplotHold.value": next });
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
