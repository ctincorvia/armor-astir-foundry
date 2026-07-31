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

// Both groups share one flat list for key lookup (_onMoveRoll/_onMoveDescription) since a move's
// section (Basic vs Special) is purely a sheet-display grouping, not part of its identity.
const ALL_MOVES = [...BASIC_MOVES, ...SPECIAL_MOVES];

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
		// Grouped (rather than a flat list) so playbook-specific moves can join basic/special
		// moves as their own group later without restructuring this data.
		data.moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES) },
			{ label: "Special Moves", moves: this._moveGroupMoves(SPECIAL_MOVES) }
		];
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
		return data;
	}

	_dangers() {
		return this.actor.system.attributes?.dangers ?? [];
	}

	_gravityClocks() {
		return this.actor.system.attributes?.gravityClocks ?? [];
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
				hold
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
		html.find(".danger-add").on("click", this._onDangerAdd.bind(this));
		html.find(".danger-remove").on("click", this._onDangerRemove.bind(this));
		html.find(".gravity-clock-add").on("click", this._onGravityClockAdd.bind(this));
		html.find(".gravity-clock-remove").on("click", this._onGravityClockRemove.bind(this));
		html.find(".gravity-clock-label-input").on("change", this._onGravityClockLabelChange.bind(this));
		html.find(".gravity-clock-value-step").on("click", this._onGravityClockValueStep.bind(this));
		html.find(".gravity-clock-step").on("click", this._onGravityClockStep.bind(this));
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
		html.find(".move-activate").on("click", this._onMoveActivate.bind(this));
		html.find(".move-description").on("click", this._onMoveDescription.bind(this));
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

	async _onMoveRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		const traits = this._moveTraits(move);
		if (!traits.length && !move.conditions) return;

		// Only bite-the-dust declares forcesDesperationAtMaxPerils (see moves.js) — every other
		// move resolves lockedEffect to null and configureMoveRoll's Effect select behaves exactly
		// as before.
		const lockedEffect = move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null;
		const config = await configureMoveRoll(move, traits, { lockedEffect });
		if (!config) return;

		await rollMove(this.actor, move, config.trait, config);
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
