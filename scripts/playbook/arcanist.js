import { renderTemplate } from "../compat.js";

// The Arcanist's Prepare Rituals — see move-pools/the-arcanist.js's "the-arcanist:prepare-rituals"
// move for the rules text this mechanizes, and arcanist-mixin.js for the actor-facing side of this
// domain (the 3 stored slots, the Prepare/Adapt pickers, the Wardhold pool, the Moves-tab entries).
// Follows the same catalog-in-code / keys-on-actor split as witch.js's WITCH_BOONS/findWitchBoon/
// resolveWitchBoons trio, and stays free of any Foundry API the same way that file does, so the
// catalog lookups and Wardhold math are testable without stubbing an actor.
//
// Rituals differ from Boons in two ways that rule out reusing WITCH_BOONS' own shape verbatim: the
// same ritual effect can be chosen into more than one of the 3 slots (a Boon is unique — held or
// not), and the confidence ritual needs a second, per-slot choice (which move) — so a prepared
// ritual is stored per-slot as `{ ritualKey, moveKey? }`, not as a bare key list.
//
// Two of the three ritual types carry a `rollModifier` fragment — the seed for one entry in
// arcanist-mixin.js's _ritualRollModifierSource, which fills in the per-slot fields (`key`,
// `moveKeys`, `costsUse`/`costsTracker`) a static catalog grantsRollModifier entry would otherwise
// declare directly. Confidence's `effect: "confidence"` is unscoped here — moveKeys is filled in
// per-slot from that slot's own stored moveKey, the one field no other grantsRollModifier entry in
// this codebase resolves dynamically. Warding's `{ advantage: "advantage", requiresAdvantage:
// ["disadvantage", "disadvantage2"] }` is a +1 Advantage step gated to only apply while the roll is
// currently at disadvantage or worse (see roll-chain.js's signed-step model) — i.e. "ignore a
// disadvantage" — distinct from the Witch's Embrace Chaos, whose own advantage2/+2 step converts a
// disadvantage all the way to confidence-adjacent Advantage (the-witch.js). The Aspect ritual
// (Astir Approach swap) carries no rollModifier at all — it activates via the Moves tab's own
// promptsApproachOverride mechanism instead (see moves-mixin.js/move-roll-mixin.js), not a roll
// modifier.
export const ARCANIST_RITUALS = [
	{
		key: "arcanist-ritual:confidence",
		name: "Make a Move in Confidence",
		requiresMove: true,
		rollModifier: { effect: "confidence" },
		description: "You may spend this ritual to make a specified move in confidence."
	},
	{
		key: "arcanist-ritual:aspect",
		name: "Change Your Astir's Approach",
		activatesApproach: true,
		description: "Your Astir's approach becomes a different one of your choosing for this Sortie."
	},
	{
		key: "arcanist-ritual:warding",
		name: "Hold 2: Ignore a Disadvantage",
		grantsWardHold: 2,
		rollModifier: { advantage: "advantage", requiresAdvantage: ["disadvantage", "disadvantage2"] },
		description: "Hold 2. You may spend this hold 1-for-1 to ignore a disadvantage."
	}
];

export function findArcanistRitual(key, catalog = ARCANIST_RITUALS) {
	return catalog.find((ritual) => ritual.key === key) ?? null;
}

// Resolves the actor's stored 3-slot array (each `{ ritualKey, moveKey? } | null`) against the
// catalog, preserving slot position (unlike resolveWitchBoons' flat filter — a slot's index is
// meaningful here, since it's also the "ritual-N" spent-flag/roll-modifier key). A slot whose
// ritualKey no longer resolves (stale/edited catalog) drops to null, the same "never yield a hole
// pointing at a definition that no longer exists" stance resolveWitchBoons takes, just per-slot
// instead of by filtering the whole array.
export function resolveArcanistRituals(slots = [], catalog = ARCANIST_RITUALS) {
	return slots.map((slot) => {
		if (!slot) return null;
		const ritual = findArcanistRitual(slot.ritualKey, catalog);
		return ritual ? { ...ritual, moveKey: slot.moveKey ?? null } : null;
	});
}

// The Warding ritual's own additive Hold pool (see move-grants-mixin.js's docs/domains/moves.md
// entry on costsTracker) — 2 hold per prepared-and-unremoved Warding instance, capped at the
// tracker's own max (6, move-pools/the-arcanist.js), confirmed with the user as additive rather
// than a flat per-ritual amount.
export function wardHoldFor(slots = []) {
	const wardingCount = slots.filter((slot) => slot && findArcanistRitual(slot.ritualKey)?.grantsWardHold).length;
	return Math.min(6, wardingCount * 2);
}

// Adapt Rituals' own math: preserves whatever Wardhold the player has already spent across a
// re-choice, rather than resetting the pool outright (Prepare Rituals' own _writeRituals `fresh`
// branch does that flat reset instead — see arcanist-mixin.js). `alreadySpent` is derived from the
// *previous* slots' own computed max versus the actor's current value; the new value is the next
// set's own max minus that same spent amount, clamped back into the tracker's 0-6 range so removing
// a partly-spent Warding slot floors at 0 rather than going negative.
export function adaptedWardHold(previousSlots, nextSlots, currentValue) {
	const alreadySpent = wardHoldFor(previousSlots) - currentValue;
	return Math.min(6, Math.max(0, wardHoldFor(nextSlots) - alreadySpent));
}

export const ARCANIST_RITUALS_PICKER_TEMPLATE = "modules/armor-astir/templates/arcanist-rituals-picker.hbs";

// Prepare/Adapt Rituals' shared picker — mirrors chooseWitchBoons' promise/Dialog/invalidReason/
// updateSaveState/authoritative-recheck shape (witch.js), extended for what Boons never needed: 3
// fixed slots (not a variable-count checkbox list), each either `locked` (already spent this
// Sortie — Adapt's own "re-choose only rituals you have remaining," rendered as static text and
// passed through unchanged) or editable with a ritual-type <select> and a conditionally-shown
// move-target <select> for the confidence ritual, toggled live via a `hidden` class exactly the way
// equipment-dialogs.js's configureEquipment reacts to its own Kind <select>.
//
// `slots` is the picker's seed: an array of exactly 3 `{ ritualKey, moveKey?, locked? } | null`
// entries (Prepare passes 3 nulls — nothing carries over when preparing fresh; Adapt passes the
// actor's current slots, each flagged `locked` per _ritualSlotSpent). Resolves the same 3-slot
// shape stripped of `locked` (a locked slot's own `{ ritualKey, moveKey }` unchanged, an edited
// slot's newly-chosen value, or null for a slot deliberately left blank), or null on cancel/close/
// invalid.
export async function chooseArcanistRituals(catalog, slots, moveOptions, { title, buttonLabel, instructions }) {
	const content = await renderTemplate(ARCANIST_RITUALS_PICKER_TEMPLATE, {
		instructions,
		buttonLabel,
		ritualOptions: catalog.map(({ key, name }) => ({ key, name })),
		moveOptions,
		slots: slots.map((slot, index) => {
			const ritual = slot ? findArcanistRitual(slot.ritualKey, catalog) : null;
			return {
				index,
				label: `Ritual ${index + 1}`,
				locked: Boolean(slot?.locked),
				ritualKey: slot?.ritualKey ?? "",
				ritualName: ritual?.name ?? "",
				requiresMove: Boolean(ritual?.requiresMove),
				moveKey: slot?.moveKey ?? "",
				moveName: slot?.moveKey ? (moveOptions.find((m) => m.key === slot.moveKey)?.name ?? slot.moveKey) : ""
			};
		})
	});

	// The single source of truth for "why can't this be confirmed right now" — shared by the render
	// callback's live button state and the confirm callback's own authoritative recheck, mirroring
	// chooseWitchBoons'/configureEquipment's own invalidReason. Every editable (non-locked) slot
	// needs a chosen ritual type, and the confidence ritual specifically needs a chosen move too — a
	// slot left entirely blank is valid (it resolves to null, an empty slot), so only a slot with a
	// ritual type chosen but no target move set is rejected.
	const invalidReason = (html) => {
		for (let index = 0; index < slots.length; index++) {
			if (slots[index]?.locked) continue;
			const ritualKey = html.find(`[name='ritual-type-${index}']`).val();
			if (!ritualKey) continue;
			const ritual = findArcanistRitual(ritualKey, catalog);
			if (ritual?.requiresMove && !html.find(`[name='ritual-move-${index}']`).val()) {
				return "Choose a move for every ritual that makes a move in confidence.";
			}
		}
		return null;
	};

	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			render: (html) => {
				const updateSaveState = () => {
					const reason = invalidReason(html);
					const confirmButton = html.find("[data-button='confirm']");
					confirmButton.prop("disabled", Boolean(reason));
					confirmButton.toggleClass("disabled", Boolean(reason));
					if (reason) confirmButton.attr("data-gate-tooltip", reason);
					else confirmButton.removeAttr("data-gate-tooltip");
				};
				for (let index = 0; index < slots.length; index++) {
					if (slots[index]?.locked) continue;
					html.find(`[name='ritual-type-${index}']`).on("change", (event) => {
						const ritual = findArcanistRitual(event.currentTarget.value, catalog);
						html.find(`[data-move-select='${index}']`).toggleClass("hidden", !ritual?.requiresMove);
						updateSaveState();
					});
					html.find(`[name='ritual-move-${index}']`).on("change", updateSaveState);
				}
				updateSaveState();
			},
			buttons: {
				confirm: {
					label: buttonLabel,
					callback: (html) => {
						// The authoritative gate — see invalidReason's own doc comment above on why this
						// can't just trust the DOM's live disabled attribute (Enter-to-submit bypasses it).
						const reason = invalidReason(html);
						if (reason) {
							ui.notifications.warn(reason);
							resolve(null);
							return;
						}
						resolve(slots.map((slot, index) => {
							if (slot?.locked) return { ritualKey: slot.ritualKey, moveKey: slot.moveKey ?? null };
							const ritualKey = html.find(`[name='ritual-type-${index}']`).val();
							if (!ritualKey) return null;
							const ritual = findArcanistRitual(ritualKey, catalog);
							const moveKey = ritual?.requiresMove ? html.find(`[name='ritual-move-${index}']`).val() : null;
							return { ritualKey, moveKey };
						}));
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "confirm",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "arcanist-rituals-picker"] }).render(true);
	});
}
