import { choosePlaybookMove, resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { HOLD_MAX, HOLD_MIN } from "../../moves/moves.js";
import { chooseStartingMoves, findStartingMovePool, startingMoveKeysByPlaybook } from "../../moves/starting-moves.js";

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
	// checkbox has no min/max to clamp, unlike Hold or Spotlight's stepped tracks. The checkbox's own
	// data-move attribute is always the *rendered* move's key (moves-mixin.js's template, `{{../key}}`)
	// — for a synthesized Arcanist ritual slot (arcanist-mixin.js) that's the slot's own key, not the
	// real Prepare Rituals move its Spent flag actually lives on, so this resolves the clicked move
	// (the same fallback chain move-roll-mixin.js's _resolveAnyMove uses) to find its usesMoveKey
	// before writing, the same substitution _nextUnusedMoveUseKey/_promptsApproachOverrideSpend/the
	// uses-checked mapping in _moveGroupMoves already apply on the read side.
	_onMoveUseToggle(event) {
		const { move: moveKey, use: useKey } = event.currentTarget.dataset;
		const targetKey = this._resolveAnyMove(moveKey)?.usesMoveKey ?? moveKey;
		this.actor.update({ [`system.attributes.moveUses.${targetKey}.${useKey}`]: event.currentTarget.checked });
	},
	// Let Loose's per-actor trait pick (see _moveGroupMoves' traitBonusChoosable/traitBonusChoice
	// and trait-bonuses.js's chooseTrait) — every option in the select is a real TRAITS key or the
	// blank "—" option, so nothing here needs to validate the value before writing it.
	_onTraitBonusChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.traitBonusChoices.${moveKey}`]: event.currentTarget.value });
	},
	// Classical Spellcasting's own per-actor Basic Move pick (see moves-mixin.js's
	// addsTraitToMoveChoosable/addsTraitToMoveChoice and move-traits-mixin.js's addsTraitToMove
	// chooseMove resolution) — mirrors _onTraitBonusChoiceChange's shape exactly, just keyed by
	// the granting move instead of the trait-bonus move.
	_onAddsTraitToMoveChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.addsTraitToMoveChoices.${moveKey}`]: event.currentTarget.value });
	},
	// Advanced Evocation's own per-actor tag pick (see moves-mixin.js's weaponTagChoiceChoosable/
	// weaponTagChoiceOptions and equipment-mixin.js's _grantedWeaponTagChoiceKeys) — mirrors
	// _onAddsTraitToMoveChoiceChange's shape exactly, just keyed into weaponTagChoices instead.
	_onWeaponTagChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.weaponTagChoices.${moveKey}`]: event.currentTarget.value });
	},
	// Classical Spellcasting's own grantsEquipment (cantrips.js) — a fixed equipment template
	// snapshotted onto the actor the moment a move carrying it is newly picked, via
	// equipment-mixin.js's _startingGearEntry (the same treatment a starting-gear grant already
	// gets, just triggered by a move pick instead of character creation). Matched by name rather
	// than a stored link back to the granting move: removing then re-adding the move grants it
	// back exactly once rather than leaving stale provenance to track, and equipment is never
	// auto-removed when its granting move is (see docs/domains/equipment.md — equipment is the
	// character's, not tied to what's currently picked). Returns an empty patch (safe to spread
	// into any actor.update) when the move grants nothing or the actor already has a same-named
	// entry — e.g. from renaming a duplicate back, or picking the move a second time after removal.
	_grantedMoveEquipmentUpdate(moveKey) {
		const grant = resolvePlaybookMoves([moveKey])[0]?.grantsEquipment;
		if (!grant) return {};
		const current = this._equipment();
		if (current.some((item) => item.name === grant.name)) return {};
		return { "system.attributes.equipment": [...current, this._startingGearEntry(grant)] };
	},
	// The "+" on the Playbook Moves section. The picker is passed the actor's playbook name (so it
	// knows which pool is "yours") and its current picks (so an already-taken move isn't offered
	// again) — see playbookMoveSections. It resolves null on cancel, on close, and when the dialog
	// was confirmed with nothing selected.
	async _onPlaybookMoveAdd() {
		const current = this._playbookMoves();
		const key = await choosePlaybookMove(this.actor.system.playbook?.name, current, startingMoveKeysByPlaybook());
		if (!key || current.includes(key)) return;

		await this.actor.update({
			"system.attributes.playbookMoves": [...current, key],
			...this._grantedMoveEquipmentUpdate(key)
		});
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
