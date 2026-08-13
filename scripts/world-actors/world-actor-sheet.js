import { addEntry, removeEntry, updateEntryField } from "./entry-list.js";

// Shared by CarrierActorSheet/AuthorityActorSheet/CauseActorSheet (see docs/domains/world-actors.md, "World
// actors"): each renders one or more id-keyed lists under system.attributes, all edited through
// the same three data-attributes (data-list/data-entry-id/data-field) rather than per-list
// handlers, so a new list on any of the three sheets needs no new JS — only template markup.
// Fixed-slot lists (Authority's Pillars/Divisions) reuse the same field-edit handler as freeform
// ones (Carrier's Crew Members, Cause's Factions); they just never render an add/remove control.
export class WorldActorSheet extends ActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor"],
			width: 640,
			height: "auto"
		});
	}

	// Overridable per concrete sheet so _onEntryAdd can seed list-specific fields (Crew Members'
	// `position`, Factions' `exhausted`) without the base class needing to know every list's shape.
	_entryDefaults() {
		return { name: "", description: "" };
	}

	_list(key) {
		return this.actor.system.attributes?.[key] ?? [];
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".entry-list-add").on("click", this._onEntryAdd.bind(this));
		html.find(".entry-list-remove").on("click", this._onEntryRemove.bind(this));
		html.find(".entry-list-field").on("change", this._onEntryFieldChange.bind(this));
		html.find(".entry-list-counter-step").on("click", this._onEntryCounterStep.bind(this));
	}

	_onEntryAdd(event) {
		const { list: key } = event.currentTarget.dataset;
		const current = this._list(key);
		this.actor.update({ [`system.attributes.${key}`]: addEntry(current, this._entryDefaults(key)) });
	}

	_onEntryRemove(event) {
		const { list: key, entryId } = event.currentTarget.dataset;
		const current = this._list(key);
		this.actor.update({ [`system.attributes.${key}`]: removeEntry(current, entryId) });
	}

	// Covers every editable field on every list — text/textarea inputs (name, position,
	// description, ...) and the checkbox fields (Factions' exhausted) alike, keyed off the
	// changed element's own type rather than needing a second, near-identical handler.
	_onEntryFieldChange(event) {
		const { list: key, entryId, field } = event.currentTarget.dataset;
		const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
		const current = this._list(key);
		this.actor.update({ [`system.attributes.${key}`]: updateEntryField(current, entryId, field, value) });
	}

	// A clamped +/- counter on one entry's field (Authority's Division Strength/Disfavor, Cause's
	// Faction Grip) — fully dataset-driven (list/entryId/field/delta/min/max all read off the
	// clicked button) rather than a per-sheet handler, the same generalization _onEntryFieldChange
	// already is for text/checkbox editing. A sheet with a counter like this needs new template
	// markup only, no new JS.
	_onEntryCounterStep(event) {
		const { list: key, entryId, field, delta, min, max } = event.currentTarget.dataset;
		const current = this._list(key);
		const entry = current.find((e) => e.id === entryId);
		if (!entry) return;
		const value = entry[field] ?? Number(min);
		const next = Math.min(Number(max), Math.max(Number(min), value + Number(delta)));
		if (next === value) return;
		this.actor.update({ [`system.attributes.${key}`]: updateEntryField(current, entryId, field, next) });
	}
}
