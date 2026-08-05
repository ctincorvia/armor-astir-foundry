import { addEntry, removeEntry, updateEntryField } from "../../world-actors/entry-list.js";
import {
	CLOCK_STEPS_DEFAULT,
	CLOCK_STEPS_MAX,
	CLOCK_STEPS_MIN,
	addClock,
	removeClock,
	setClockProgress,
	updateClockLabel,
	updateClockSteps
} from "../clocks.js";

// Ceiling across every playbook today (see claude.md's Dangers notes) — none currently need the
// occasionally-mentioned 4, so this stays a flat constant rather than a per-playbook field until
// one actually does.
export const DANGER_MAX = 3;

export const GRAVITY_CLOCK_MAX = 5;
// Progress track reuses Spotlight's exact length/interaction (see _onGravityClockStep).
export const GRAVITY_CLOCK_PROGRESS_MIN = 0;
export const GRAVITY_CLOCK_PROGRESS_MAX = 6;
export const GRAVITY_CLOCK_VALUE_MIN = 1;
export const GRAVITY_CLOCK_VALUE_MAX = 3;

// Hooks (Social tab) — a free-text description plus a fixed three-value depth select. Universal,
// unlike Ace Crew below, so this renders on every playbook's sheet regardless of isCommander.
export const HOOK_DEPTHS = [
	{ key: "loose", label: "Loose" },
	{ key: "normal", label: "Normal" },
	{ key: "deep", label: "Deep" }
];

// Dangers, Burdens, Gravity Clocks, generic Clocks and Commander's Ace Crew roster — the Social/
// Dangers-column trackers (see claude.md's Social tab and Dangers notes). Each is a plain id-keyed
// (or, for Dangers/Burdens, actor-attributes-scoped) list with its own thin CRUD handlers; nothing
// here derives from any other domain.
export const TrackingSheetMixin = {
	_dangers() {
		return this.actor.system.attributes?.dangers ?? [];
	},
	// Plain-text entries (see claude.md's Social tab notes) — bite-the-dust's own text is the only
	// thing that ever grants one ("take a burden..."), and nothing in this module auto-clears them,
	// same manual-tracking model as Dangers/Advancement. No max, unlike Dangers' DANGER_MAX —
	// nothing in the rulebook caps how many a character can carry.
	_burdens() {
		return this.actor.system.attributes?.burdens ?? [];
	},
	_gravityClocks() {
		return this.actor.system.attributes?.gravityClocks ?? [];
	},
	// Generic narrative clocks (see clocks.js) — universal, not gated to any playbook, unlike
	// Gravity Clocks above (fixed-6-step, tied to the Social tab's Gravity Trigger section).
	_clocks() {
		return this.actor.system.attributes?.clocks ?? [];
	},
	// Commander's Ace Crew roster: 3-5 named individuals with an adjective or two each (see
	// playbook-moves.js's Ace Crew move). Reuses entry-list.js's CRUD helpers, the same pattern
	// Carrier's Crew Members already establish for a plain id-keyed list of {name, ...} entries.
	_aceCrew() {
		return this.actor.system.attributes?.aceCrew ?? [];
	},
	// Hooks (see HOOK_DEPTHS above) — reuses entry-list.js's CRUD helpers exactly like Ace Crew
	// above, but universal/always-visible on the Social tab rather than Commander-gated.
	_hooks() {
		return this.actor.system.attributes?.hooks ?? [];
	},
	// Dangers sit in their own left column beside the tab area (see the template) rather than
	// inside a tab, since DEFENSELESS and the Danger list matter regardless of which tab is open.
	// atMax drives both the DEFENSELESS label and hiding the add-danger controls once the actor is
	// full.
	_dangersData() {
		const dangers = this._dangers();
		return {
			max: DANGER_MAX,
			list: dangers.map((danger) => ({ ...danger, isPeril: danger.type === "peril" })),
			atMax: dangers.length >= DANGER_MAX,
			canAdd: dangers.length < DANGER_MAX,
			addOpen: this._dangerAddOpen && dangers.length < DANGER_MAX
		};
	},
	// Gravity Clocks live in the Social tab: up to 5 independent progress tracks, each with its own
	// label, a Spotlight-style fill track, and a separate 1-3 value. Unlike Spotlight (one
	// actor-wide counter), progress is per-clock, so each list entry gets its own expanded steps
	// array.
	_gravityClocksData() {
		const gravityClocks = this._gravityClocks();
		return {
			max: GRAVITY_CLOCK_MAX,
			canAdd: gravityClocks.length < GRAVITY_CLOCK_MAX,
			list: gravityClocks.map((clock) => ({
				...clock,
				progressSteps: Array.from({ length: GRAVITY_CLOCK_PROGRESS_MAX }, (_, i) => ({
					step: i + 1,
					filled: i + 1 <= (clock.progress ?? 0)
				}))
			}))
		};
	},
	// Burdens (see claude.md's Social tab notes) — a plain, uncapped text list (unlike Dangers'
	// DANGER_MAX/type select), so this just exposes the stored list as-is; there's no derived
	// per-entry shape to build the way Gravity Clocks' progressSteps needs.
	_burdensData() {
		return { list: this._burdens() };
	},
	// Generic narrative clocks (see clocks.js) — universal, unlike Gravity Clocks above, so this
	// section renders on every playbook's sheet regardless of isCommander. Same per-clock
	// progressSteps expansion Gravity Clocks' own list already does, just sized to each clock's own
	// `steps` rather than one shared constant.
	_clocksData() {
		return {
			min: CLOCK_STEPS_MIN,
			max: CLOCK_STEPS_MAX,
			list: this._clocks().map((clock) => ({
				...clock,
				progressSteps: Array.from({ length: clock.steps ?? CLOCK_STEPS_DEFAULT }, (_, i) => ({
					step: i + 1,
					filled: i + 1 <= (clock.progress ?? 0)
				}))
			}))
		};
	},
	// Commander's Ace Crew roster (see playbook-moves.js's Ace Crew move) — gated to Commander by
	// the template, same "compute regardless, gate the render" treatment gravityTrigger already
	// gets from a missing GRAVITY_TRIGGERS entry.
	_aceCrewData() {
		return { list: this._aceCrew() };
	},
	// Hooks — universal Social-tab list, same "compute regardless, gate the render" non-issue as
	// Burdens/Clocks above (there's nothing to gate, since Hooks isn't playbook-exclusive at all).
	_hooksData() {
		return { depths: HOOK_DEPTHS, list: this._hooks() };
	},
	// The header "+" for Dangers just shows/hides the add-controls row (see _dangerAddOpen) rather
	// than opening a dialog — there's a label and a type to fill in first, so a single click can't
	// add anything on its own the way the other header "+" buttons do.
	_onDangerAddToggle() {
		this._dangerAddOpen = !this._dangerAddOpen;
		this.render();
	},
	// Reads the sibling label/type inputs out of the add-danger controls the clicked button lives
	// in, rather than off the button's own dataset — unlike every other control on this sheet,
	// there's no single value to encode as a data-* attribute on the button itself.
	_onDangerAdd(event) {
		const controls = event.currentTarget.closest(".danger-add-controls");
		const labelInput = controls.querySelector(".danger-label-input");
		const typeSelect = controls.querySelector(".danger-type-select");
		const label = labelInput.value.trim();

		const current = this._dangers();
		if (!label || current.length >= DANGER_MAX) return;

		this.actor.update({
			"system.attributes.dangers": [...current, { id: foundry.utils.randomID(), type: typeSelect.value, label }]
		});
		labelInput.value = "";
		// Players add dangers one at a time in practice, so close the row back up rather than
		// leaving it open for a second entry — same one-at-a-time assumption as _onDangerAddToggle
		// opening it fresh each time. The actor update above already triggers Foundry's own
		// re-render, so this just needs to flip the flag _onDangerAddToggle also uses.
		this._dangerAddOpen = false;
	},
	_onDangerRemove(event) {
		const { dangerId } = event.currentTarget.dataset;
		const current = this._dangers();
		this.actor.update({ "system.attributes.dangers": current.filter((danger) => danger.id !== dangerId) });
	},
	// Burdens (see claude.md's Social tab notes, _burdens above) — plain text entries, no max, no
	// type select: a blank one is appended immediately (unlike Dangers' add-controls row, which
	// collects a label first) since there's nothing else to configure.
	_onBurdenAdd() {
		this.actor.update({
			"system.attributes.burdens": [...this._burdens(), { id: foundry.utils.randomID(), label: "" }]
		});
	},
	_onBurdenRemove(event) {
		const { burdenId } = event.currentTarget.dataset;
		const current = this._burdens();
		this.actor.update({ "system.attributes.burdens": current.filter((burden) => burden.id !== burdenId) });
	},
	_onBurdenLabelChange(event) {
		const { burdenId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		const current = this._burdens();
		this.actor.update({
			"system.attributes.burdens": current.map((burden) => (burden.id === burdenId ? { ...burden, label } : burden))
		});
	},
	// Commander's Ace Crew roster (see _aceCrew, playbook-moves.js's Ace Crew move) — reuses
	// entry-list.js's generic CRUD helpers directly, the same pattern Carrier's Crew Members
	// establish via WorldActorSheet, just wired by hand here since PlaybookActorSheet doesn't
	// extend that base class.
	_onAceCrewAdd() {
		this.actor.update({
			"system.attributes.aceCrew": addEntry(this._aceCrew(), { name: "", adjective: "" })
		});
	},
	_onAceCrewRemove(event) {
		const { entryId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.aceCrew": removeEntry(this._aceCrew(), entryId) });
	},
	_onAceCrewFieldChange(event) {
		const { entryId, field } = event.currentTarget.dataset;
		this.actor.update({
			"system.attributes.aceCrew": updateEntryField(this._aceCrew(), entryId, field, event.currentTarget.value)
		});
	},
	// Hooks — same thin entry-list.js wiring as Ace Crew immediately above, just targeting
	// system.attributes.hooks instead. _onHookFieldChange is shared between the description text
	// input and the depth select, same "no trimming" stance Ace Crew's own field handler takes.
	_onHookAdd() {
		this.actor.update({
			"system.attributes.hooks": addEntry(this._hooks(), { description: "", depth: "normal" })
		});
	},
	_onHookRemove(event) {
		const { entryId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.hooks": removeEntry(this._hooks(), entryId) });
	},
	// Covers the description/depth text fields and, for a Paradigm actor, the Shaken checkbox (see
	// the template's isParadigm-gated markup) alike — same checkbox-vs-value branch
	// WorldActorSheet#_onEntryFieldChange already establishes for Cause Faction's Exhausted/Seized
	// flags.
	_onHookFieldChange(event) {
		const { entryId, field } = event.currentTarget.dataset;
		const value = event.currentTarget.type === "checkbox" ? event.currentTarget.checked : event.currentTarget.value;
		this.actor.update({
			"system.attributes.hooks": updateEntryField(this._hooks(), entryId, field, value)
		});
	},
	_onGravityClockAdd(event) {
		const current = this._gravityClocks();
		if (current.length >= GRAVITY_CLOCK_MAX) return;
		this.actor.update({
			"system.attributes.gravityClocks": [
				...current,
				{ id: foundry.utils.randomID(), label: "", progress: 0, value: GRAVITY_CLOCK_VALUE_MIN }
			]
		});
	},
	_onGravityClockRemove(event) {
		const { clockId } = event.currentTarget.dataset;
		const current = this._gravityClocks();
		this.actor.update({ "system.attributes.gravityClocks": current.filter((clock) => clock.id !== clockId) });
	},
	_onGravityClockLabelChange(event) {
		const { clockId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		const current = this._gravityClocks();
		this.actor.update({
			"system.attributes.gravityClocks": current.map((clock) => (clock.id === clockId ? { ...clock, label } : clock))
		});
	},
	_onGravityClockValueStep(event) {
		const { clockId, delta } = event.currentTarget.dataset;
		const current = this._gravityClocks();
		const clock = current.find((c) => c.id === clockId);
		if (!clock) return;
		const value = clock.value ?? GRAVITY_CLOCK_VALUE_MIN;
		const next = Math.min(GRAVITY_CLOCK_VALUE_MAX, Math.max(GRAVITY_CLOCK_VALUE_MIN, value + Number(delta)));
		if (next === value) return;
		this.actor.update({
			"system.attributes.gravityClocks": current.map((c) => (c.id === clockId ? { ...c, value: next } : c))
		});
	},
	// Same click-to-set / click-top-to-decrement logic as _onSpotlightStep, but scoped to one
	// clock in the array via clockId instead of one actor-wide field.
	_onGravityClockStep(event) {
		const { clockId } = event.currentTarget.dataset;
		const step = Number(event.currentTarget.dataset.step);
		const current = this._gravityClocks();
		const clock = current.find((c) => c.id === clockId);
		if (!clock) return;
		const progress = clock.progress ?? 0;
		const next = step === progress ? step - 1 : step;
		const clamped = Math.min(GRAVITY_CLOCK_PROGRESS_MAX, Math.max(GRAVITY_CLOCK_PROGRESS_MIN, next));
		if (clamped === progress) return;
		this.actor.update({
			"system.attributes.gravityClocks": current.map((c) => (c.id === clockId ? { ...c, progress: clamped } : c))
		});
	},
	// Generic narrative clocks (see clocks.js) — universal, always-visible section, unlike Gravity
	// Clocks above. Each handler is a thin wrapper around clocks.js's own pure functions, the same
	// "thin sheet wiring over a pure helper" split entry-list.js/WorldActorSheet already establish.
	_onClockAdd() {
		this.actor.update({ "system.attributes.clocks": addClock(this._clocks(), {}) });
	},
	_onClockRemove(event) {
		const { clockId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.clocks": removeClock(this._clocks(), clockId) });
	},
	_onClockLabelChange(event) {
		const { clockId } = event.currentTarget.dataset;
		const label = event.currentTarget.value.trim();
		this.actor.update({ "system.attributes.clocks": updateClockLabel(this._clocks(), clockId, label) });
	},
	_onClockStepsChange(event) {
		const { clockId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.clocks": updateClockSteps(this._clocks(), clockId, event.currentTarget.value) });
	},
	// Same click-to-set / click-top-to-decrement interaction as _onGravityClockStep, delegated to
	// clocks.js's own setClockProgress since each clock here carries its own step count rather than
	// one shared constant.
	_onClockStep(event) {
		const { clockId } = event.currentTarget.dataset;
		const step = Number(event.currentTarget.dataset.step);
		this.actor.update({ "system.attributes.clocks": setClockProgress(this._clocks(), clockId, step) });
	}
};
