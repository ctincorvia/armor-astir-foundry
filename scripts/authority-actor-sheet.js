import { WorldActorSheet } from "./world-actor-sheet.js";

export const AUTHORITY_SHEET_TEMPLATE = "modules/armor-astir/templates/authority-actor-sheet.hbs";

const STABILITY_MIN = 1;
const STABILITY_MAX = 10;

// The Authority represents the empire/oppressor (see claude.md, "Domain conventions"): a
// Stability rating, exactly three Pillars and three Divisions (createWorldActor seeds these at
// creation — see actor-creation.js — so the sheet always has exactly three of each to render,
// with no add/remove control for either), and freeform Assets/Actors rosters that reuse
// WorldActorSheet's generic entry-list handling unchanged. Each Division's Strength/Disfavor
// counters are stepped via WorldActorSheet's generic _onEntryCounterStep (see the template's
// data-min/data-max), so there's no bespoke stepper code left in this class.
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
