import { WorldActorSheet } from "./world-actor-sheet.js";
import { FACTION_KINDS, findFactionKind } from "./faction-kinds.js";

export const CAUSE_SHEET_TEMPLATE = "modules/armor-astir/templates/cause-actor-sheet.hbs";

// The Cause represents the loosely organized factions opposing the Authority (see claude.md,
// "Domain conventions"): two independent freeform rosters — Factions (system.attributes.factions)
// and Wayward Factions (system.attributes.waywardFactions, a Faction that's broken from the
// Authority's control) — sharing one _entryDefaults/_factionsData shape: a name, description, an
// exhausted/refreshed checkbox, a seized/unseized checkbox, and a Grip counter (0-3). Each
// Faction also carries a `kind` key (unset "" until the GM picks one, same convention as
// Division's kind), resolved fresh per render against faction-kinds.js's FACTION_KINDS catalog —
// never persisted derived data. Entirely generic WorldActorSheet behavior otherwise — checkboxes
// go through _onEntryFieldChange, Grip through _onEntryCounterStep — the only reason this class
// exists rather than using WorldActorSheet directly is _entryDefaults seeding
// `exhausted`/`seized`/`grip`/`kind`.
export class CauseActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "cause"],
			template: CAUSE_SHEET_TEMPLATE
		});
	}

	_entryDefaults() {
		return { name: "", description: "", exhausted: false, seized: false, grip: 0, kind: "" };
	}

	// Resolves one Faction list's entries for display: defaults a missing grip to 0 (Factions
	// created before Grip existed have no `grip` field at all, same reasoning Authority's
	// Stability/Division counters already default a missing value before building their own
	// display data) and attaches the resolved kind's opposesText/outcomeText alongside the full
	// FACTION_KINDS catalog as kindOptions, for the template's {{selectOptions}} call.
	_factionsData(listKey) {
		return this._list(listKey).map((faction) => {
			const kind = findFactionKind(faction.kind);
			return {
				...faction,
				grip: faction.grip ?? 0,
				kindOptions: FACTION_KINDS,
				opposesText: kind?.opposes ?? "",
				outcomeText: kind?.outcome ?? ""
			};
		});
	}

	getData(options) {
		const data = super.getData(options);
		data.factions = this._factionsData("factions");
		data.waywardFactions = this._factionsData("waywardFactions");
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
