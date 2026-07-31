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
			width: 420,
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
		return data;
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
			return {
				key: move.key,
				name: move.name,
				traits,
				// True when a move normally rolls a stat trait but every one of those traits is
				// currently disabled for this actor (e.g. Weave Magic without Channel — a move
				// with no traits by design, like Help or Hinder, is never gated this way), OR
				// when the move is explicitly gated the opposite way, off Channel being enabled
				// (b-plot, via requiresChannelDisabled).
				gated: (move.traits.length > 0 && traits.length === 0)
					|| (Boolean(move.requiresChannelDisabled) && !channelDisabled),
				// Whether this move rolls anything at all, based on its static definition rather
				// than the actor-filtered trait list above — a gated move (e.g. Weave Magic with
				// Channel disabled) still shows a disabled Roll button, but a move with no traits or
				// conditions by design (Subsystems, B-Plot) shows no Roll button at all.
				rollable: move.traits.length > 0 || Boolean(move.conditions),
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
		html.find(".move-roll").on("click", this._onMoveRoll.bind(this));
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

	async _onMoveRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		const traits = this._moveTraits(move);
		if (!traits.length && !move.conditions) return;

		const config = await configureMoveRoll(move, traits);
		if (!config) return;

		await rollMove(this.actor, move, config.trait, config);
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
