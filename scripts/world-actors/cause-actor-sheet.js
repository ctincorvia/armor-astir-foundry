import { WorldActorSheet } from "./world-actor-sheet.js";

export const CAUSE_SHEET_TEMPLATE = "modules/armor-astir/templates/cause-actor-sheet.hbs";

// The Cause represents the loosely organized factions opposing the Authority (see claude.md,
// "Domain conventions"): just a freeform Factions roster, each with a name, description, an
// exhausted/refreshed checkbox, a seized/unseized checkbox, and a Grip counter (0-3). Entirely
// generic WorldActorSheet behavior — checkboxes go through _onEntryFieldChange, Grip through
// _onEntryCounterStep — the only reason this class exists rather than using WorldActorSheet
// directly is _entryDefaults seeding `exhausted`/`seized`/`grip`.
export class CauseActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "cause"],
			template: CAUSE_SHEET_TEMPLATE
		});
	}

	_entryDefaults() {
		return { name: "", description: "", exhausted: false, seized: false, grip: 0 };
	}

	getData(options) {
		const data = super.getData(options);
		// Factions created before Grip existed have no `grip` field at all — default it to 0 for
		// display so the counter never renders blank, same reasoning Authority's Stability/Division
		// counters already default a missing value before building their own display data.
		data.factions = this._list("factions").map((faction) => ({ ...faction, grip: faction.grip ?? 0 }));
		return data;
	}
}

export function registerCauseActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", CauseActorSheet, {
			types: ["armor-astir.cause"],
			makeDefault: true,
			label: "Cause"
		});
	});
}
