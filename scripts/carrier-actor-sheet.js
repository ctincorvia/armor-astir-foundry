import { WorldActorSheet } from "./world-actor-sheet.js";

export const CARRIER_SHEET_TEMPLATE = "modules/armor-astir/templates/carrier-actor-sheet.hbs";

// Matches the playbook sheet's own trait bounds (see playbook-actor-sheet.js's TRAIT_MIN/MAX) —
// Crew is the Carrier's one trait and behaves identically to a playbook stat.
const CREW_MIN = -3;
const CREW_MAX = 3;

// The Carrier represents the players' moving base (see claude.md, "Domain conventions"): one
// trait (Crew), a free-text description, and a roster of notable crew members. Everything here
// is a thin wrapper around WorldActorSheet's generic entry-list handling plus the one Crew
// stepper, which — unlike a playbook's traits — has no move system to gate against, so it's just
// a plain clamp.
export class CarrierActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "carrier"],
			template: CARRIER_SHEET_TEMPLATE
		});
	}

	// Crew Members carry a position alongside name/description, unlike the generic {name,
	// description} default every other world-actor list uses.
	_entryDefaults() {
		return { name: "", position: "", description: "" };
	}

	getData(options) {
		const data = super.getData(options);
		data.crew = this.actor.system.stats?.crew?.value ?? 0;
		data.description = this.actor.system.details?.description?.value ?? "";
		data.crewMembers = this._list("crewMembers");
		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".crew-step").on("click", this._onCrewStep.bind(this));
	}

	_onCrewStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.stats?.crew?.value ?? 0;
		const next = Math.min(CREW_MAX, Math.max(CREW_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.stats.crew.value": next });
	}
}

export function registerCarrierActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", CarrierActorSheet, {
			types: ["armor-astir.carrier"],
			makeDefault: true,
			label: "Carrier"
		});
	});
}
