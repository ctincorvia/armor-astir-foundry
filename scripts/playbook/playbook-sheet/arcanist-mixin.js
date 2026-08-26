import {
	ARCANIST_RITUALS,
	adaptedWardHold,
	chooseArcanistRituals,
	findArcanistRitual,
	resolveArcanistRituals,
	wardHoldFor
} from "../arcanist.js";
import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../../moves/moves.js";
import { ALL_MOVES } from "../../moves/all-moves.js";

// The real catalog move both the pre-existing ritual-1/2/3 `uses` checkboxes and the new `ward-hold`
// numericTracker live on (move-pools/the-arcanist.js) — every synthesized per-slot entry below routes
// its own state through this one key's existing moveUses/moveTrackers buckets rather than any new
// field, so _refreshPeriod (frames-mixin.js) keeps clearing them for free.
const PREPARE_RITUALS_KEY = "the-arcanist:prepare-rituals";

// The Arcanist's Prepare Rituals domain (the 3 stored slots, Prepare/Adapt, the Wardhold pool, the
// Moves-tab entries) — its own file, the same "one domain, one file" treatment the Witch's Patron
// got (patron-mixin.js), since it's a self-contained domain with its own actor-state shape
// (system.attributes.arcanist) and its own catalog (arcanist.js). See arcanist.js for the ritual
// catalog itself and move-pools/the-arcanist.js's Prepare Rituals move for the rules text this
// mechanizes.
export const ArcanistSheetMixin = {
	// Just the stored slot array — the ritual definitions live in arcanist.js, so stored data never
	// goes stale against edited rules text, same convention playbookMoves/witch.boons already follow.
	_preparedRituals() {
		return this.actor.system.attributes?.arcanist?.rituals ?? [];
	},
	// Whether a given slot's own "ritual-N" Spent flag is checked — reads the real Prepare Rituals
	// move's existing moveUses bucket, the same field the pre-existing ritual-1/2/3 checkboxes
	// (Moves tab) and the roll dialog's own costsUse gate for a confidence ritual both read/write.
	_ritualSlotSpent(index) {
		return Boolean(this.actor.system.attributes?.moveUses?.[PREPARE_RITUALS_KEY]?.[`ritual-${index + 1}`]);
	},
	// The Warding ritual's shared, additive Hold pool (see arcanist.js's wardHoldFor/adaptedWardHold)
	// — reads the new ward-hold numericTracker on the real Prepare Rituals move.
	_wardHold() {
		return this.actor.system.attributes?.moveTrackers?.[PREPARE_RITUALS_KEY]?.["ward-hold"] ?? 0;
	},
	_hasAdaptiveRituals() {
		return resolvePlaybookMoves(this._playbookMoves()).some((m) => m.key === "the-arcanist:adaptive-rituals");
	},
	// The confidence ritual's own target-move dropdown — Basic, Special and this actor's picked
	// Playbook moves, filtered to the same "does this move actually roll anything" predicate
	// _moveGroupMoves already computes as `rollable`, reused directly (rather than re-derived) so
	// the two can never drift apart.
	_ritualMoveOptions() {
		const candidates = [...BASIC_MOVES, ...SPECIAL_MOVES, ...resolvePlaybookMoves(this._playbookMoves())];
		return this._moveGroupMoves(candidates)
			.filter((move) => move.rollable)
			.map(({ key, name }) => ({ key, name }));
	},
	// getData's Prepare Rituals section (Social tab, gated on isArcanist) — one entry per fixed slot
	// (always 3, whether or not it's currently filled), the Wardhold readout, and whether Adapt
	// Rituals can currently do anything (the Adaptive Rituals move picked, and at least one prepared
	// slot that isn't already spent).
	_arcanistData() {
		const resolved = resolveArcanistRituals(this._preparedRituals());
		const moveOptions = this._ritualMoveOptions();
		const slots = [0, 1, 2].map((index) => {
			const ritual = resolved[index] ?? null;
			const spent = ritual ? this._ritualSlotSpent(index) : false;
			return {
				index,
				label: `Ritual ${index + 1}`,
				prepared: Boolean(ritual),
				spent,
				name: ritual?.name ?? null,
				description: ritual?.description ?? null,
				moveName: ritual?.moveKey ? (moveOptions.find((m) => m.key === ritual.moveKey)?.name ?? ritual.moveKey) : null
			};
		});
		const canAdapt = this._hasAdaptiveRituals() && slots.some((slot) => slot.prepared && !slot.spent);
		return {
			slots,
			wardHold: this._wardHold(),
			canAdapt,
			adaptTooltip: canAdapt
				? null
				: "Requires the Adaptive Rituals move, and at least one prepared ritual you haven't spent yet."
		};
	},
	// The single write path both Prepare and Adapt go through. `fresh` (Prepare) resets Wardhold to
	// the new set's own flat total and clears all three ritual-1/2/3 spent flags in the same update
	// ("any remaining rituals expire when you prepare new ones" — move-pools/the-arcanist.js's own
	// text). Adapt instead preserves already-spent Wardhold across the re-choice (see
	// adaptedWardHold) and never touches the spent flags — a re-chosen ritual replaces an unspent
	// slot's effect, it doesn't un-spend anything.
	async _writeRituals(next, { fresh }) {
		const updates = { "system.attributes.arcanist.rituals": next };
		if (fresh) {
			updates[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`] = wardHoldFor(next);
			updates[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-1`] = false;
			updates[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-2`] = false;
			updates[`system.attributes.moveUses.${PREPARE_RITUALS_KEY}.ritual-3`] = false;
		} else {
			updates[`system.attributes.moveTrackers.${PREPARE_RITUALS_KEY}.ward-hold`] =
				adaptedWardHold(this._preparedRituals(), next, this._wardHold());
		}
		await this.actor.update(updates);
	},
	// "Before every Sortie... describe to your Director 3 magical rituals you prepare" — always
	// opens on 3 fully blank, fully editable slots; nothing carries over from whatever was prepared
	// before (that's Adapt's job below), matching "any remaining rituals expire when you prepare new
	// ones."
	async _onPrepareRituals() {
		const slots = await chooseArcanistRituals(ARCANIST_RITUALS, [null, null, null], this._ritualMoveOptions(), {
			title: "Prepare Rituals",
			buttonLabel: "Prepare",
			instructions: "Choose an effect for each of your 3 rituals."
		});
		if (!slots) return;
		await this._writeRituals(slots, { fresh: true });
	},
	// Adaptive Rituals: "you may re-choose any rituals you have remaining." No-ops with the move not
	// picked, or with nothing left to re-choose (every slot empty or already spent) — the picker
	// itself locks an already-spent slot to read-only (passed through unchanged on resolve), so this
	// guard is purely to avoid opening a dialog with nothing editable in it at all.
	async _onAdaptRituals() {
		if (!this._hasAdaptiveRituals()) return;
		const current = this._preparedRituals();
		const seed = [0, 1, 2].map((index) => {
			const slot = current[index] ?? null;
			return slot ? { ...slot, locked: this._ritualSlotSpent(index) } : null;
		});
		if (!seed.some((slot) => slot && !slot.locked)) return;

		const slots = await chooseArcanistRituals(ARCANIST_RITUALS, seed, this._ritualMoveOptions(), {
			title: "Adapt Rituals",
			buttonLabel: "Adapt",
			instructions: "Re-choose any rituals you have remaining."
		});
		if (!slots) return;
		await this._writeRituals(slots, { fresh: false });
	},
	// One synthesized move-shaped object per prepared slot, for the Moves tab's own "Prepared
	// Rituals" group (moves-mixin.js's _movesData) — mirrors a held Witch Boon's own read-only
	// treatment (traits: [], no addable/removable). Confidence and Aspect slots carry a `uses` entry
	// plus usesMoveKey pointing at the real Prepare Rituals move, so their own Spent checkbox reads/
	// writes that move's existing moveUses bucket instead of a new field. The Aspect slot also
	// carries promptsApproachOverride (Sortie-scoped), which renders its Activate button via the
	// existing activatable derivation and gates it the same way Chromatic Focus/Reserves already do.
	// A Warding slot carries neither — its own contribution is fully represented by the shared
	// Wardhold pool (see _wardHold/_arcanistData), spent per-instance via the roll dialog's own
	// costsTracker gate rather than a manual checkbox.
	_preparedRitualMoves() {
		return resolveArcanistRituals(this._preparedRituals())
			.map((ritual, index) => {
				if (!ritual) return null;
				const slotNumber = index + 1;
				const moveName = ritual.moveKey ? (ALL_MOVES.find((m) => m.key === ritual.moveKey)?.name ?? ritual.moveKey) : null;
				const base = {
					key: `arcanist-ritual-slot:${slotNumber}`,
					name: `Ritual ${slotNumber}: ${ritual.name}`,
					traits: [],
					description: moveName ? `${ritual.description} (${moveName})` : ritual.description
				};
				if (ritual.grantsWardHold) return base;
				return {
					...base,
					uses: [{ key: `ritual-${slotNumber}`, label: "Spent" }],
					usesMoveKey: PREPARE_RITUALS_KEY,
					...(ritual.activatesApproach && { promptsApproachOverride: { period: "Sortie" } })
				};
			})
			.filter(Boolean);
	},
	// Lookup by synthesized key — the fallback _resolveAnyMove reaches for once a clicked move's key
	// doesn't resolve against ALL_MOVES/findWitchBoon (move-roll-mixin.js).
	_preparedRitualEntry(key) {
		return this._preparedRitualMoves().find((move) => move.key === key) ?? null;
	},
	// The Roll Modifiers section's own actor-state-synthesized source (see move-grants-mixin.js's
	// _rollModifierSources) — keyed to the real Prepare Rituals move itself (critical: this makes
	// costsUse/costsTracker's default sourceKey land in that move's existing moveUses/moveTrackers
	// buckets with zero new fields), carrying one grantsRollModifier entry per prepared confidence/
	// Warding slot. Each entry keeps its own unique "ritual-N" key so two slots holding the same
	// ritual type never collide, and is always included regardless of whether that slot's own gate
	// (costsUse/costsTracker) currently allows spending it — same "always shown, only ever disabled"
	// stance every other grantsRollModifier entry in this module takes (see _rollModifierAvailability).
	// A confidence entry's moveKeys is filled in from that slot's own stored moveKey rather than a
	// static catalog list — the one place this differs from every other grantsRollModifier source.
	_ritualRollModifierSource() {
		const entries = [];
		this._preparedRituals().forEach((slot, index) => {
			if (!slot) return;
			const ritual = findArcanistRitual(slot.ritualKey);
			if (!ritual?.rollModifier) return;
			const key = `ritual-${index + 1}`;
			if (ritual.grantsWardHold) {
				entries.push({
					key,
					label: ritual.name,
					description: ritual.description,
					...ritual.rollModifier,
					costsTracker: { trackerKey: "ward-hold", amount: 1 }
				});
				return;
			}
			const moveName = slot.moveKey ? (ALL_MOVES.find((m) => m.key === slot.moveKey)?.name ?? slot.moveKey) : null;
			entries.push({
				key,
				label: moveName ? `${ritual.name}: ${moveName}` : ritual.name,
				description: ritual.description,
				moveKeys: slot.moveKey ? [slot.moveKey] : [],
				...ritual.rollModifier,
				costsUse: key
			});
		});
		if (!entries.length) return null;
		return {
			key: PREPARE_RITUALS_KEY,
			name: "Prepare Rituals",
			description: "Prepared ritual effects.",
			grantsRollModifier: entries
		};
	}
};
