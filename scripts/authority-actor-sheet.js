import { WorldActorSheet } from "./world-actor-sheet.js";
import { updateEntryField } from "./entry-list.js";

export const AUTHORITY_SHEET_TEMPLATE = "modules/armor-astir/templates/authority-actor-sheet.hbs";

const STABILITY_MIN = 1;
const STABILITY_MAX = 10;

const DIVISION_STRENGTH_MIN = 0;
const DIVISION_STRENGTH_MAX = 5;

const DIVISION_DISFAVOR_MIN = 0;
const DIVISION_DISFAVOR_MAX = 10;

// The Authority represents the empire/oppressor (see claude.md, "Domain conventions"): a
// Stability rating, exactly three Pillars and three Divisions (createWorldActor seeds these at
// creation — see actor-creation.js — so the sheet always has exactly three of each to render,
// with no add/remove control for either), and freeform Assets/Actors rosters that reuse
// WorldActorSheet's generic entry-list handling unchanged.
export class AuthorityActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "authority"],
			template: AUTHORITY_SHEET_TEMPLATE
		});
	}

	getData(options) {
		const data = super.getData(options);
		const stabilityValue = this.actor.system.attributes?.stability?.value ?? STABILITY_MIN;
		data.stability = {
			value: stabilityValue,
			steps: Array.from({ length: STABILITY_MAX }, (_, i) => ({ step: i + 1, filled: i + 1 <= stabilityValue }))
		};
		data.pillars = this._list("pillars");
		data.divisions = this._list("divisions");
		data.assets = this._list("assets");
		data.notableActors = this._list("notableActors");
		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".stability-step").on("click", this._onStabilityStep.bind(this));
		html.find(".division-strength-step").on("click", this._onDivisionStrengthStep.bind(this));
		html.find(".division-disfavor-step").on("click", this._onDivisionDisfavorStep.bind(this));
	}

	// Unlike Spotlight/Gravity Clock progress (which bottom out at 0), Stability's floor is 1 —
	// there's no empty state to decrement into — so this is a plain click-to-set, clamped, with
	// no special handling for re-clicking the current top step.
	_onStabilityStep(event) {
		const step = Number(event.currentTarget.dataset.step);
		const current = this.actor.system.attributes?.stability?.value ?? STABILITY_MIN;
		const next = Math.min(STABILITY_MAX, Math.max(STABILITY_MIN, step));
		if (next === current) return;
		this.actor.update({ "system.attributes.stability.value": next });
	}

	// Shared by Strength and Disfavor — both are a per-division +/- counter, just with different
	// fields and bounds, so this is the one clamp-and-write and each public handler below only
	// supplies which. Unlike Pillars/Divisions' name/description (edited through
	// WorldActorSheet's generic _onEntryFieldChange), these are stepped counters, so they get
	// their own handlers rather than a text/checkbox input.
	_onDivisionCounterStep(event, field, min, max) {
		const { entryId, delta } = event.currentTarget.dataset;
		const current = this._list("divisions");
		const division = current.find((d) => d.id === entryId);
		if (!division) return;
		const value = division[field] ?? min;
		const next = Math.min(max, Math.max(min, value + Number(delta)));
		if (next === value) return;
		this.actor.update({ "system.attributes.divisions": updateEntryField(current, entryId, field, next) });
	}

	_onDivisionStrengthStep(event) {
		this._onDivisionCounterStep(event, "strength", DIVISION_STRENGTH_MIN, DIVISION_STRENGTH_MAX);
	}

	_onDivisionDisfavorStep(event) {
		this._onDivisionCounterStep(event, "disfavor", DIVISION_DISFAVOR_MIN, DIVISION_DISFAVOR_MAX);
	}
}

export function registerAuthorityActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", AuthorityActorSheet, {
			types: ["armor-astir.authority"],
			makeDefault: true,
			label: "Authority"
		});
	});
}
