import { choosePlaybookMove } from "../../moves/playbook-moves.js";
import { HOLD_MAX, HOLD_MIN } from "../../moves/moves.js";
import { chooseStartingMoves, findStartingMovePool } from "../../moves/starting-moves.js";

// Hold/tracker steppers, uses checkboxes and trait-bonus choice, plus the Playbook Moves add/remove
// and starting-moves pickers — see moves-mixin.js's file comment for how this file relates to its
// siblings in this directory.
export const MoveTrackingSheetMixin = {
	_onHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.resources?.hold?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.resources.hold.value": next });
	},
	_onFlatHoldStep(event) {
		const { move: key, delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.moveHold?.[key]?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.attributes.moveHold.${key}.value`]: next });
	},
	// Generic per-move clamped numeric tracker (e.g. Transmute Self's two alternate-set trackers —
	// see playbook-moves.js's numericTrackers). Mirrors _onFlatHoldStep's clamp shape, but bounded
	// by the tracker's own min/max (from its dataset, sourced from the move definition) rather than
	// the fixed HOLD_MIN/HOLD_MAX.
	_onMoveTrackerStep(event) {
		const { move: moveKey, tracker: trackerKey, delta, min, max } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.moveTrackers?.[moveKey]?.[trackerKey] ?? 0;
		const next = Math.min(Number(max), Math.max(Number(min), current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.attributes.moveTrackers.${moveKey}.${trackerKey}`]: next });
	},
	// A plain boolean toggle, same shape as _onOverheatingToggle/_onAdvancementToggle — a "uses"
	// checkbox has no min/max to clamp, unlike Hold or Spotlight's stepped tracks.
	_onMoveUseToggle(event) {
		const { move: moveKey, use: useKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.moveUses.${moveKey}.${useKey}`]: event.currentTarget.checked });
	},
	// Let Loose's per-actor trait pick (see _moveGroupMoves' traitBonusChoosable/traitBonusChoice
	// and trait-bonuses.js's chooseTrait) — every option in the select is a real TRAITS key or the
	// blank "—" option, so nothing here needs to validate the value before writing it.
	_onTraitBonusChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.traitBonusChoices.${moveKey}`]: event.currentTarget.value });
	},
	// The "+" on the Playbook Moves section. The picker is passed the actor's playbook name (so it
	// knows which pool is "yours") and its current picks (so an already-taken move isn't offered
	// again) — see playbookMoveSections. It resolves null on cancel, on close, and when the dialog
	// was confirmed with nothing selected.
	async _onPlaybookMoveAdd() {
		const current = this._playbookMoves();
		const key = await choosePlaybookMove(this.actor.system.playbook?.name, current);
		if (!key || current.includes(key)) return;

		await this.actor.update({ "system.attributes.playbookMoves": [...current, key] });
	},
	_onPlaybookMoveRemove(event) {
		const { move: key } = event.currentTarget.dataset;
		const current = this._playbookMoves();
		if (!current.includes(key)) return;

		this.actor.update({ "system.attributes.playbookMoves": current.filter((k) => k !== key) });
	},
	// The "+ Choose Starting Moves" button (see getData's startingMovesAvailable). Availability is
	// a live emptiness check, not a one-time flag — cancelling the picker (or picking nothing)
	// leaves the actor's playbookMoves untouched, so the button stays available to try again.
	async _onStartingMovesAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingMovePool(playbookName);
		// Mirrors getData's startingMovesAvailable gate — a pool with nothing to offer at all (e.g.
		// The Commander today) never reaches the button in the first place, but guarding here too
		// keeps this a true no-op.
		if (!pool || (!pool.grantedKeys.length && !pool.pickOneKeys.length && !pool.chooseCount)) return;

		// The dialog always opens once there's anything at all to show (guarded above) — even a
		// grantedKeys-only pool (Arcane Augments) still gets a confirmation screen naming what the
		// player is receiving, rather than silently writing it the moment the button is clicked.
		// Granted moves are added unconditionally regardless of what the dialog resolves, same as
		// chooseStartingGear's own granted items above.
		const picked = await chooseStartingMoves(playbookName);
		const current = this._playbookMoves();
		const additions = [...pool.grantedKeys, ...(picked ?? [])].filter((key) => !current.includes(key));

		if (!additions.length) return;
		await this.actor.update({ "system.attributes.playbookMoves": [...current, ...additions] });
	}
};
