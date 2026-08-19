import { WorldActorSheet } from "./world-actor-sheet.js";
import { DIVISION_KINDS, findDivisionKind } from "./division-kinds.js";

export const AUTHORITY_SHEET_TEMPLATE = "modules/armor-astir/templates/authority-actor-sheet.hbs";

const STABILITY_MIN = 1;
export const STABILITY_MAX = 9;
export const PILLARS_PER_DIVISION = 3;

// The Authority represents the empire/oppressor (see docs/domains/world-actors.md, "World
// actors"): a Stability rating, exactly three Divisions, and exactly three Pillars per Division
// (nine total) — createWorldActor seeds all of these at creation (see actor-creation.js), so the
// sheet always has exactly three Divisions and nine Pillars to render, with no add/remove control
// for either. Pillars are stored as a flat list under system.attributes.pillars with a
// divisionId foreign key back to their owning Division, rather than nested inside each Division
// object — this is what lets GRIP/Felled/kind-select all ride WorldActorSheet's existing generic
// _onEntryFieldChange/_onEntryCounterStep handlers unchanged (those handlers only know how to
// read/write one flat list at a time), the same flat-list shape Cause's Factions already use.
// Each Division also carries a `kind` key (chosen by the GM, unset at creation) resolved against
// the DIVISION_KINDS catalog in _divisionsData to attach its passive/active outcome text fresh on
// every render — catalog-in-code, key-on-actor, same convention as astir-parts.js's partType.
// Division Strength/Disfavor and Pillar GRIP are all stepped via WorldActorSheet's generic
// _onEntryCounterStep (see the template's data-min/data-max), so there's no bespoke stepper code
// left in this class.
export class AuthorityActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "authority"],
			template: AUTHORITY_SHEET_TEMPLATE
		});
	}

	// Groups the flat pillars list onto its owning Division by divisionId, and resolves each
	// Division's kind against the DIVISION_KINDS catalog for display. kindOptions is attached per
	// division (rather than once at the top of getData's return value) specifically so the
	// template's {{selectOptions kindOptions ...}} needs no {{../}} hop — it's called from inside
	// a {{#each divisions}}.
	_divisionsData() {
		const pillars = this._list("pillars");
		return this._list("divisions").map((division) => {
			const kind = findDivisionKind(division.kind);
			return {
				...division,
				kindOptions: DIVISION_KINDS,
				passiveOutcome: kind?.passive ?? "",
				activeOutcomes: kind?.active ?? [],
				pillars: pillars
					.filter((pillar) => pillar.divisionId === division.id)
					.map((pillar) => ({ ...pillar, grip: pillar.grip ?? 0 }))
			};
		});
	}

	getData(options) {
		const data = super.getData(options);
		const stabilityValue = this.actor.system.attributes?.stability?.value ?? STABILITY_MIN;
		data.stability = {
			value: stabilityValue,
			steps: Array.from({ length: STABILITY_MAX }, (_, i) => ({ step: i + 1, filled: i + 1 <= stabilityValue }))
		};
		data.divisions = this._divisionsData();
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
