import { WorldActorSheet } from "./world-actor-sheet.js";

export const CAUSE_SHEET_TEMPLATE = "modules/armor-astir/templates/cause-actor-sheet.hbs";

// The Cause represents the loosely organized factions opposing the Authority (see claude.md,
// "Domain conventions"): just a freeform Factions roster, each with a name, description, and an
// exhausted/refreshed checkbox. Entirely generic WorldActorSheet behavior — the only reason this
// class exists rather than using WorldActorSheet directly is _entryDefaults seeding `exhausted`.
export class CauseActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "cause"],
			template: CAUSE_SHEET_TEMPLATE
		});
	}

	_entryDefaults() {
		return { name: "", description: "", exhausted: false };
	}

	getData(options) {
		const data = super.getData(options);
		data.factions = this._list("factions");
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
