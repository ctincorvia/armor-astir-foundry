import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import {
	GRAVITY_CLOCK_PROGRESS_MAX,
	GRAVITY_CLOCK_PROGRESS_MIN,
	GRAVITY_CLOCK_VALUE_MAX,
	GRAVITY_CLOCK_VALUE_MIN
} from "./tracking-mixin.js";

// The Adrift's +HOME domain — its own file, the same "one domain, one file" treatment Patron got
// (patron-mixin.js), since it's a self-contained mechanic with its own actor-state shape
// (system.attributes.home) and no reusable generic mechanism to piggyback on. See
// playbook-moves.js's Love, Love, Love move for the rules text this mechanizes: "instead of a
// +CHANNEL trait, you have an additional GRAVITY clock ... treated as your +CHANNEL trait in all
// circumstances, and referred to as +HOME."
//
// +HOME is a dedicated, Adrift-only pseudo-trait, deliberately NOT a 7th entry in the shared
// TRAITS catalog (core/traits.js stays exactly six entries) — every consumer of TRAITS in this
// module assumes it's fixed-at-six. Instead, "home" behaves exactly like a fixedTraits entry (e.g.
// Lead a Sortie's CREW): moves.js#rollMove already branches on `TRAITS.some((t) => t.key ===
// trait.key)` to decide whether to re-read a live actor stat or trust `trait.value` directly —
// since "home" is never in TRAITS, it automatically takes the trust-trait.value path with zero
// changes needed to moves.js.
export const HomeSheetMixin = {
	_home() {
		return this.actor.system.attributes?.home ?? { progress: 0, value: GRAVITY_CLOCK_VALUE_MIN };
	},
	// The "has this actor picked Love, Love, Love" gate, doubling as a lookup for the move object
	// itself (see playbook-actor-sheet.js's getData, which uses truthiness to gate data.home).
	_homeMove() {
		return resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsHomeInsteadOfChannel);
	},
	// The option object injected into a move's trait list wherever +HOME applies (see
	// moves-mixin.js's _moveTraits) — deliberately not looked up against TRAITS, so it resolves at
	// roll time the same way a fixedTraits entry does (see the file-level comment above).
	_homeTraitOption() {
		return { key: "home", label: "HOME", value: this._home().value };
	},
	// getData's Social tab Home clock section — shaped like _gravityClocksData()'s per-clock entry,
	// but for the single dedicated field rather than an id-keyed list.
	_homeData() {
		const home = this._home();
		return {
			value: home.value ?? GRAVITY_CLOCK_VALUE_MIN,
			progressSteps: Array.from({ length: GRAVITY_CLOCK_PROGRESS_MAX }, (_, i) => ({
				step: i + 1,
				filled: i < (home.progress ?? 0)
			}))
		};
	},
	// Mirrors _onGravityClockValueStep exactly, minus the per-clock-id array indirection — there's
	// only ever one Home field per actor.
	_onHomeValueStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this._home().value ?? GRAVITY_CLOCK_VALUE_MIN;
		const next = Math.min(GRAVITY_CLOCK_VALUE_MAX, Math.max(GRAVITY_CLOCK_VALUE_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.home.value": next });
	},
	// Same click-to-set / click-the-filled-top-to-decrement interaction as _onGravityClockStep,
	// minus the array indirection — gives the player manual override/correction ability alongside
	// the automatic advance-on-roll below, matching this module's "manual trackers" philosophy
	// everywhere else.
	_onHomeProgressStep(event) {
		const step = Number(event.currentTarget.dataset.step);
		const progress = this._home().progress ?? 0;
		const next = step === progress ? step - 1 : step;
		const clamped = Math.min(GRAVITY_CLOCK_PROGRESS_MAX, Math.max(GRAVITY_CLOCK_PROGRESS_MIN, next));
		if (clamped === progress) return;
		this.actor.update({ "system.attributes.home.progress": clamped });
	},
	// The playbook's own Gravity Trigger: "whenever you use your +HOME clock, advance it." See
	// moves-mixin.js's _rollMove, which calls this whenever this actor's resolved trait is "home".
	async _advanceHome() {
		const current = this._home().progress ?? 0;
		const next = Math.min(GRAVITY_CLOCK_PROGRESS_MAX, current + 1);
		if (next === current) return;
		await this.actor.update({ "system.attributes.home.progress": next });
	}
};
