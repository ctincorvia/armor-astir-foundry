import {
	MOVE_CHAT_TEMPLATE,
	MOVE_RESULT_LABELS,
	HOLD_MIN,
	buildReminders,
	isCriticalResult,
	moveResultTier,
	resolveTierValue,
	rollMove
} from "./moves.js";
import { addDie, effectState, nextAdvantageState, removeDie, rollConditions } from "./roll-effects.js";
import { mergeSpentTags } from "../equipment/equipment.js";
import { ALL_MOVES } from "./all-moves.js";

// Marks the reroll's tag spent (the same array/checkbox PlaybookActorSheet#_onEquipmentTagSpentToggle
// drives), strikes through the original card's flavor in place to mark it superseded (see
// templates/move-chat.hbs/styles/playbook-actor-sheet.css's `.superseded` rule), then reruns rollMove
// with the original attempt's trait/options. The reroll itself is still a genuine second Roll posted
// as its own fresh chat message, not a re-serialization of the original — see rollMove's own comment
// on the Roll re-serialization hazard, which is why the original message's `content` (its dice) is
// left untouched even though its `flavor` is edited. Not exported: only reachable through the click
// handler onRenderMoveChat wires up below.
async function handleReroll(message, reroll) {
	const actor = game.actors.get(reroll.actorId);
	const move = ALL_MOVES.find((m) => m.key === reroll.moveKey);
	if (!actor || !move) return;

	const equipment = actor.system.attributes?.equipment ?? [];
	await actor.update({
		"system.attributes.equipment": mergeSpentTags(equipment, [{ equipmentId: reroll.equipmentId, tagKey: reroll.spendKey }])
	});

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...reroll.flavorArgs,
		reroll: false,
		superseded: true
	});
	await message.update({ flavor });

	await rollMove(actor, move, reroll.trait, reroll.options);
}

// Spends Heat Up's cost — ticking the Astir's own Overheating checkbox (see
// PlaybookActorSheet#_availableHeatUp/_onAstirOverheatingToggle) rather than an equipment tag —
// strikes through the original card's flavor in place to mark it superseded (same mechanism as
// handleReroll above), then re-rolls: a genuine second Roll, posted as its own fresh chat message
// rather than editing the original's `content`, since the rules text says results are "discarded,"
// not revised.
async function handleHeatUp(message, offer) {
	const actor = game.actors.get(offer.actorId);
	const move = ALL_MOVES.find((m) => m.key === offer.moveKey);
	if (!actor || !move) return;

	await actor.update({ "system.attributes.astir.overheating": true });

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...offer.flavorArgs,
		heatUp: false,
		superseded: true
	});
	await message.update({ flavor });

	await rollMove(actor, move, offer.trait, offer.options);
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

	if (source.costsPeril) {
		// Dark Rebirth's "cost" (see playbook-moves.js/PlaybookActorSheet#_availableAutomaticSuccess)
		// is a fresh Danger, appended the same way tracking-mixin.js#_onDangerAdd does, rather than
		// spending an existing hold/uses pool.
		const dangers = actor.system.attributes?.dangers ?? [];
		await actor.update({
			"system.attributes.dangers": [
				...dangers,
				{ id: foundry.utils.randomID(), type: "peril", label: source.name }
			]
		});
	} else if (source.useKey) {
		await actor.update({ [`system.attributes.moveUses.${source.key}.${source.useKey}`]: true });
	} else if (source.cost != null) {
		const current = actor.system.attributes?.moveHold?.[source.key]?.value ?? 0;
		await actor.update({
			[`system.attributes.moveHold.${source.key}.value`]: Math.max(HOLD_MIN, current - source.cost)
		});
	}
	// Ain't No Grave (see playbook-moves.js/PlaybookActorSheet#_availableAutomaticSuccess) — a
	// costless source (none of costsPeril/useKey/cost set) has nothing to spend at all, so there's
	// no actor.update for the spend itself; it falls straight through to the flavor re-render below,
	// same as every other source.

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...offer.flavorArgs,
		tier: "success",
		// Explicit and defensive, not just inherited from offer.flavorArgs — this path always forces
		// a flat 10+ ("as if you'd rolled a 10+"), never a 12+, regardless of what the original roll
		// actually was (see moves.js#isCriticalResult/claude.md's "Adding move content").
		critical: false,
		tierLabel: MOVE_RESULT_LABELS.success,
		resultText: move.results.success,
		reminders: null,
		conditions: [...offer.flavorArgs.conditions, { key: "automatic-success", label: `Automatic Success (${source.name})` }],
		automaticSuccess: []
	});
	await message.update({ flavor });
}

// Retroactively adds or removes one die on an already-posted roll and re-applies the
// keep-highest/keep-lowest rule (see roll-effects.js#nextAdvantageState/addDie/removeDie),
// potentially flipping the result tier — a GM or the roller granting or walking back
// Advantage/Disadvantage after the fact, not something any move triggers itself (see
// moves.js#rollMove's showAddAdvantage/showAddDisadvantage). A step up (stacking further in the
// same direction) rolls a fresh die; a step down (the opposite direction, per
// nextAdvantageState's own stepping rules) only discards one, no roll needed. Like
// handleAutomaticSuccess above, this does not retroactively regrant hold or recompute
// questionPrompt/questions for the new tier — those stay exactly as originally rolled; it reframes
// the outcome rather than re-resolving the roll. Unlike handleAutomaticSuccess, it also updates
// `content`: for these rolls `content` is just the bare total (Foundry's own `String(roll.total)`
// default — see rollMove's own doc comment), and that number genuinely changed, whereas automatic
// success only reframes an unchanged roll's flavor. Foundry's own native per-die dice tooltip
// (driven by the message's stored `rolls` array) is deliberately left showing the original dice,
// for the same Roll-re-serialization hazard rollMove's own doc comment already flags.
async function handleAdvantage(message, offer, direction) {
	const actor = game.actors.get(offer.actorId);
	const move = ALL_MOVES.find((m) => m.key === offer.moveKey);
	if (!actor || !move) return;

	const nextState = nextAdvantageState(offer.advantageKey, direction);
	if (!nextState) return;

	const effect = effectState(offer.effectKey);

	let dice;
	if (nextState.dice > offer.dice.length) {
		const dieRoll = new Roll("1d6");
		await dieRoll.evaluate();
		dice = addDie(offer.dice, nextState.keepLowest, dieRoll.total, effect);
	} else {
		dice = removeDie(offer.dice, nextState.keepLowest);
	}
	const total = dice.filter((d) => d.kept).reduce((sum, d) => sum + d.result, 0) + offer.value;
	const tier = moveResultTier(total);
	// Same orthogonal signal rollMove itself computes (see moves.js#isCriticalResult) — a
	// retroactive Advantage/Disadvantage add can push the total across the 12+ line just as easily
	// as the 10+ one, so this needs recomputing here rather than trusting whatever the original
	// roll carried in offer.flavorArgs.
	const critical = isCriticalResult(total);
	const conditions = [...rollConditions(nextState, effect), ...offer.extraConditions];
	const reminders = buildReminders(tier, effect, offer.extraFailureReminder, offer.extraSuccessReminder, critical, offer.extraCriticalReminder);

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		...offer.flavorArgs,
		tier,
		critical,
		tierLabel: critical ? MOVE_RESULT_LABELS.critical : MOVE_RESULT_LABELS[tier],
		resultText: resolveTierValue(move.results, tier, critical),
		dice,
		conditions,
		reminders: reminders.length ? reminders : null,
		showAddAdvantage: nextAdvantageState(nextState.key, "advantage") !== null,
		showAddDisadvantage: nextAdvantageState(nextState.key, "disadvantage") !== null
	});

	await message.update({
		flavor,
		content: String(total),
		flags: { "armor-astir": { ...message.flags["armor-astir"], advantageOffer: { ...offer, advantageKey: nextState.key, dice } } }
	});
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
			handleReroll(message, reroll);
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

	const heatUp = message.flags?.["armor-astir"]?.heatUp;
	if (heatUp) {
		html.find(".move-heatup").on("click", (event) => {
			event.currentTarget.disabled = true;
			handleHeatUp(message, heatUp);
		});
	}

	const advantageOffer = message.flags?.["armor-astir"]?.advantageOffer;
	if (advantageOffer) {
		// Foundry's own ChatMessage#canUpdate only allows the message's GM or its author to call
		// .update() — everyone else gets the buttons removed outright rather than left visible as
		// dead controls that would throw if clicked.
		const canAct = game.user.isGM || game.user.id === message.author;
		if (canAct) {
			html.find(".move-add-advantage").on("click", (event) => {
				// Same immediate-disable reasoning as the reroll/automatic-success buttons above.
				event.currentTarget.disabled = true;
				handleAdvantage(message, advantageOffer, "advantage");
			});
			html.find(".move-add-disadvantage").on("click", (event) => {
				event.currentTarget.disabled = true;
				handleAdvantage(message, advantageOffer, "disadvantage");
			});
		} else {
			html.find(".move-add-advantage, .move-add-disadvantage").remove();
		}
	}
}

export function registerMoveChatListeners() {
	Hooks.on("renderChatMessage", onRenderMoveChat);
}
