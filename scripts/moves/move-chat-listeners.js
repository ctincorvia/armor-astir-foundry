import { MOVE_CHAT_TEMPLATE, MOVE_RESULT_LABELS, HOLD_MIN, rollMove } from "./moves.js";
import { mergeSpentTags } from "../equipment/equipment.js";
import { ALL_MOVES } from "./all-moves.js";

// Marks the reroll's tag spent (the same array/checkbox PlaybookActorSheet#_onEquipmentTagSpentToggle
// drives) and reruns rollMove with the original attempt's trait/options — posts a fresh chat message
// rather than editing the failed one, avoiding the Roll re-serialization hazard rollMove's own comment
// already flags for an already-evaluated roll. Not exported: only reachable through the click
// handler onRenderMoveChat wires up below.
async function handleReroll(reroll) {
	const actor = game.actors.get(reroll.actorId);
	const move = ALL_MOVES.find((m) => m.key === reroll.moveKey);
	if (!actor || !move) return;

	const equipment = actor.system.attributes?.equipment ?? [];
	await actor.update({
		"system.attributes.equipment": mergeSpentTags(equipment, [{ equipmentId: reroll.equipmentId, tagKey: reroll.tagKey }])
	});
	await rollMove(actor, move, reroll.trait, reroll.options);
}

// Spends an automatic-success source (see PlaybookActorSheet#_availableAutomaticSuccess/
// moves.js#rollMove) and edits the already-posted card in place, rather than posting a fresh
// message the way handleReroll does — there's no re-roll here, just a display change, so there's no
// Roll to re-serialize. Roll.toMessage keeps a card's dice display in `content` and this module's
// own HTML in a separate `flavor` field (confirmed against the installed client's toMessage), so
// re-rendering only `flavor` leaves the original dice/content untouched.
async function handleAutomaticSuccess(message, offer, sourceKey) {
	const actor = game.actors.get(offer.actorId);
	const move = ALL_MOVES.find((m) => m.key === offer.moveKey);
	const source = offer.sources.find((s) => s.key === sourceKey);
	if (!actor || !move || !source) return;

	if (source.useKey) {
		await actor.update({ [`system.attributes.moveUses.${source.key}.${source.useKey}`]: true });
	} else {
		const current = actor.system.attributes?.moveHold?.[source.key]?.value ?? 0;
		await actor.update({
			[`system.attributes.moveHold.${source.key}.value`]: Math.max(HOLD_MIN, current - source.cost)
		});
	}

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...offer.flavorArgs,
		tier: "success",
		tierLabel: MOVE_RESULT_LABELS.success,
		resultText: move.results.success,
		reminders: null,
		conditions: [...offer.flavorArgs.conditions, { key: "automatic-success", label: `Automatic Success (${source.name})` }],
		automaticSuccess: []
	});
	await message.update({ flavor });
}

// Reads a rendered chat message's reroll offer (see moves.js#rollMove) and wires its Reroll
// button, if the card has one, to redo the roll. Exported as a standalone function — rather than
// only existing as an inline Hooks.on callback — so it's callable directly from tests: Hooks.on
// itself is a no-op in the test environment (see tests/setup.js), so a callback defined only
// inline there would never actually execute and would fail the coverage gate, the same reasoning
// this module's Dialog button callbacks are tested by invoking them directly rather than through
// Dialog's own (also stubbed) render.
export function onRenderMoveChat(message, html) {
	const reroll = message.flags?.["armor-astir"]?.reroll;
	if (reroll) {
		html.find(".move-reroll").on("click", (event) => {
			// Disables the button immediately so the same card can't be clicked for a second reroll —
			// the tag itself is also marked spent in handleReroll, but that only shows up on the
			// Equipment tab, not on this already-rendered card.
			event.currentTarget.disabled = true;
			handleReroll(reroll);
		});
	}

	const automaticSuccess = message.flags?.["armor-astir"]?.automaticSuccess;
	if (automaticSuccess) {
		html.find(".move-automatic-success").on("click", (event) => {
			// Same immediate-disable reasoning as the reroll button above — the regenerated card
			// (once handleAutomaticSuccess's message.update lands) has no automaticSuccess buttons
			// left at all, but that update is async.
			event.currentTarget.disabled = true;
			handleAutomaticSuccess(message, automaticSuccess, event.currentTarget.dataset.source);
		});
	}
}

export function registerMoveChatListeners() {
	Hooks.on("renderChatMessage", onRenderMoveChat);
}
