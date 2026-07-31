import { PLAYBOOKS, swapActorPlaybook } from "./actor-creation.js";
import { BASIC_MOVES, availableMoveTraits, configureMoveRoll, postMoveDescription, rollMove } from "./moves.js";
import { TRAITS } from "./traits.js";

export const PLAYBOOK_SHEET_TEMPLATE = "modules/armor-astir/templates/playbook-actor-sheet.hbs";

export { TRAITS };

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

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
		// Grouped (rather than a flat list) so playbook-specific moves can join basic moves as
		// their own group later without restructuring this data.
		data.moveGroups = [
			{
				label: "Basic Moves",
				moves: BASIC_MOVES.map((move) => ({
					key: move.key,
					name: move.name,
					traits: this._moveTraits(move)
				}))
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

	async _onMoveRoll(event) {
		const move = BASIC_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		const traits = this._moveTraits(move);
		if (!traits.length) return;

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
