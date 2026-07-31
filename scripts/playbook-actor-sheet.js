import { PLAYBOOKS, swapActorPlaybook } from "./actor-creation.js";
import { BASIC_MOVES, availableMoveTraits, configureMoveRoll, postMoveDescription, rollMove } from "./moves.js";
import { TRAITS } from "./traits.js";

export const PLAYBOOK_SHEET_TEMPLATE = "modules/armor-astir/templates/playbook-actor-sheet.hbs";

export { TRAITS };

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

// Matches the highest per-tier hold any basic move currently grants (read-the-room's 3 on a
// 10+); revisit if a future move grants more.
const HOLD_MIN = 0;
const HOLD_MAX = 3;

// All playbook actors are "character" type (see claude.md, "Domain conventions"). Every
// playbook shares the same name/callsign/photo header, so one sheet class and template
// serves all of them; a playbook that needs its own fields can extend this later.
export class PlaybookActorSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "playbook"],
			template: PLAYBOOK_SHEET_TEMPLATE,
			width: 420,
			height: "auto"
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
		// Grouped (rather than a flat list) so playbook-specific moves can join basic moves as
		// their own group later without restructuring this data.
		data.moveGroups = [
			{
				label: "Basic Moves",
				moves: BASIC_MOVES.map((move) => {
					const traits = this._moveTraits(move);
					return {
						key: move.key,
						name: move.name,
						traits,
						// True only when a move normally rolls a stat trait but every one of those
						// traits is currently disabled for this actor (e.g. Weave Magic without
						// Channel) — a move with no traits by design (Help or Hinder) is never gated.
						gated: move.traits.length > 0 && traits.length === 0,
						// Hold is one shared actor field (pbta's system.resources.hold), not per-move
						// state — fine while read-the-room is the only source; a second hold-granting
						// move would need per-move tracking instead.
						trackHold: Boolean(move.hold),
						hold: this.actor.system.resources?.hold?.value ?? 0
					};
				})
			}
		];
		return data;
	}

	// Shared by getData (for sheet rendering) and _onMoveRoll (for the roll dialog) so a
	// trait's current value is only ever read from the actor in one place.
	_moveTraits(move) {
		return availableMoveTraits(this.actor, move).map((trait) => ({
			key: trait.key,
			label: trait.label,
			value: this.actor.system.stats?.[trait.key]?.value ?? 0
		}));
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".playbook-select").on("change", this._onPlaybookChange.bind(this));
		html.find(".trait-step").on("click", this._onTraitStep.bind(this));
		html.find(".hold-step").on("click", this._onHoldStep.bind(this));
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

	_onOverheatingToggle(event) {
		this.actor.update({ "system.attributes.overheating.value": event.currentTarget.checked });
	}

	async _onMoveRoll(event) {
		const move = BASIC_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		const traits = this._moveTraits(move);
		if (!traits.length && !move.conditions) return;

		const config = await configureMoveRoll(move, traits);
		if (!config) return;

		await rollMove(this.actor, move, config.trait, config);
	}

	async _onMoveDescription(event) {
		const move = BASIC_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
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
