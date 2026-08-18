import {
	DIE_FACES,
	KEPT_DICE,
	NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS,
	advantageState,
	applyRollEffects,
	effectState,
	nextAdvantageState,
	rollConditions
} from "./roll-effects.js";
import { TRAITS } from "../core/traits.js";
import { findEquipmentTag } from "../equipment/equipment.js";
import {
	MOVE_RESULT_LABELS,
	buildReminders,
	isCriticalResult,
	moveResultTier,
	resolveTierValue
} from "./move-results.js";

export const MOVE_CHAT_TEMPLATE = "modules/armor-astir/templates/move-chat.hbs";

// Rolls 1 + extraDice d6 and scores each die independently against `target` — no keep-highest/
// lowest (every die counts, unlike rollMove's KEPT_DICE=2) and no Confidence/Desperation
// substitution, so roll.total is already correct with no recompute needed (contrast rollMove's own
// comment on why it can't trust Roll.fromTerms). successCount drives how many of successOptions'
// four choices the player gets — "for every result equal to or above [target], choose one," not a
// single pass/fail tier the way every other move resolves.
export async function rollVariableDicePool(actor, move, { target, extraDice }) {
	const roll = new Roll(`${1 + extraDice}d${DIE_FACES}`);
	await roll.evaluate();

	const dice = roll.dice[0].results.map((die) => ({ result: die.result, success: die.result >= target }));
	const successCount = dice.filter((die) => die.success).length;

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		variableDiceResult: true,
		target,
		dice,
		successCount,
		// A prompt only makes sense once there's at least one success to spend — a 0-success roll
		// shows the dice and count with nothing further to choose.
		successPrompt: successCount ? `Choose ${successCount}, once per success:` : null,
		successOptions: successCount ? move.successOptions : null
	});

	const message = await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor });
	return { message, dice, successCount };
}

// Number Of The Beast's exploding-6 mechanic (see playbook-moves.js's the-wither:number-of-the-beast
// / grantsExplodingSixes). Rolls one additional d6 for every die in `dice` (the full pool — see
// applyRollEffects — not just the two kept for the total; see the design-risk note in the plan)
// whose final, post-substitution face shows a 6, and lets a freshly-rolled exploded die that itself
// lands on a 6 explode again, up to NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS as a defensive cap. Each
// exploded die gets the same Confidence/Desperation single-face substitution the initial pool
// already got (see applyRollEffects), so a Desperation roll that turns an exploded 6 into a 1 does
// not chain-explode, and a Confidence roll that turns an exploded 1 into a 6 does.
//
// Returns { bonus, sixCount, extraDice, triggered }:
//  - bonus: sum of every exploded die's final face, added to the roll's total unconditionally
//    ("add it to the total for that roll" — not "if kept").
//  - sixCount: total 6-faces across the *entire* roll (initial pool + every exploded die).
//  - extraDice: {original, result, changed} breakdown per exploded die, same shape as
//    applyRollEffects' own return, for the chat card to render alongside the normal dice list.
//  - triggered: true once sixCount reaches 3. There is no death/incapacitation system anywhere in
//    this module to hook the "killed in a spectacular fashion" consequence into (see claude.md) —
//    this only drives an unmissable chat-card badge; narrating the consequence is left to the table.
export async function explodeSixes(dice, effect) {
	let sixCount = dice.filter((die) => die.result === DIE_FACES).length;
	let toRoll = sixCount;
	const extraDice = [];
	let bonus = 0;

	while (toRoll > 0 && extraDice.length < NUMBER_OF_THE_BEAST_MAX_EXPLOSIONS) {
		toRoll -= 1;
		const explosionRoll = new Roll(`1d${DIE_FACES}`);
		await explosionRoll.evaluate();
		const original = explosionRoll.dice[0].results[0].result;
		const result = original === effect.from ? effect.to : original;
		extraDice.push({ original, result, changed: original !== result });
		bonus += result;
		if (result === DIE_FACES) {
			sixCount += 1;
			toRoll += 1;
		}
	}

	return { bonus, sixCount, extraDice, triggered: sixCount >= 3 };
}

// Rebuilds the roll's total in place rather than via Roll.fromTerms: Foundry's AST-based
// evaluator (Roll#_evaluate -> CONFIG.Dice.parser.toAST) only calls .evaluate() on leaf terms
// (Die, NumericTerm), never on the "+" OperatorTerm sitting in roll.terms — so after
// roll.evaluate(), roll.terms is a genuine mix of evaluated and unevaluated terms, which
// Roll.fromTerms explicitly rejects ("either all evaluated, or none evaluated"). Every
// RollTerm#total getter is a pure computed value independent of _evaluated, so recomputing the
// total ourselves from the (already mutated) dice breakdown avoids the mismatch entirely.
export async function rollMove(actor, move, trait, options = {}) {
	// A fixed trait (e.g. Lead a Sortie's CREW placeholder — see SPECIAL_MOVES) carries its own
	// value and is never looked up on the actor, even if actor.system.stats happens to have a
	// same-keyed entry — TRAITS membership, not presence-on-actor, decides which lookup applies.
	const isActorTrait = trait && TRAITS.some((t) => t.key === trait.key);
	const statValue = trait ? (isActorTrait ? (actor.system.stats?.[trait.key]?.value ?? 0) : trait.value) : 0;
	// Conditional +1s for moves with no base stat to roll, e.g. Help or Hinder — each checked
	// condition key contributes +1, on top of (never instead of) any trait value.
	const conditionBonus = (move.conditions ?? [])
		.filter((condition) => options.conditions?.includes(condition.key))
		.length;
	// A derived Trait bonus (Arcane Augments, Let Loose — see trait-bonuses.js), resolved by
	// PlaybookActorSheet#_rollMove for whichever trait was actually chosen and passed in as a
	// plain number — this module has no actor to derive it from itself, and the dialog's own
	// displayed trait value (see PlaybookActorSheet#_moveTraits) is display-only: an actor-trait
	// key always re-reads its live stat above rather than trusting `trait.value`, so the bonus has
	// to reach the roll through this explicit option instead.
	const value = statValue + conditionBonus + (options.traitBonus ?? 0);
	const advantage = advantageState(options.advantage);
	const effect = effectState(options.effect);

	const roll = new Roll(`${advantage.dice}d${DIE_FACES} + @mod`, { mod: value });
	await roll.evaluate();

	const dice = applyRollEffects(roll.dice[0].results, { advantage, effect });
	if (advantage.dice > KEPT_DICE) {
		roll.dice[0].modifiers.push(advantage.keepLowest ? `kl${KEPT_DICE}` : `kh${KEPT_DICE}`);
	}

	// Number Of The Beast (see playbook-moves.js) — options.explodeOnSix is set by
	// PlaybookActorSheet#_rollMove whenever the acting actor has picked that move; applies to every
	// roll they make, not just one move key. Not merged into `dice` itself — see the regression-guard
	// comment on roll-effects.js#rolledDoubles (Flourish Component's "regain Power on doubles") this
	// would otherwise break if an exploded die were appended there.
	const explosion = options.explodeOnSix ? await explodeSixes(dice, effect) : null;

	roll._formula = roll.formula;
	roll._total = dice.filter((die) => die.kept).reduce((sum, die) => sum + die.result, 0)
		+ (explosion?.bonus ?? 0)
		+ value;

	const tier = moveResultTier(roll.total);
	// Orthogonal to tier — see isCriticalResult's own comment. A 12+ still resolves tier ===
	// "success" above; this only feeds resolveTierValue's override lookups and the chat card badge.
	const critical = isCriticalResult(roll.total);

	// Hold is a fresh per-situation pool, not a per-roll bonus, so a re-roll overwrites rather
	// than adds to it (see moves.js BASIC_MOVES comment on read-the-room). A failure's 0 is
	// never written back — it grants an immediate question, not stored hold, and writing 0 would
	// wipe hold left over from an earlier successful read.
	const hold = move.hold ? resolveTierValue(move.hold, tier, critical) : null;
	if (move.hold && tier !== "failure") {
		// separateHold (e.g. Mobility — see playbook-moves.js) routes a roll-tiered hold grant
		// into its own per-move pool, the same field flatHold moves already use, instead of the
		// shared system.resources.hold field Read the Room writes — otherwise a second roll-tiered
		// hold move would silently overwrite Read the Room's live hold (see
		// PlaybookActorSheet#_moveGroupMoves, which reads hold back from the matching field).
		const holdField = move.separateHold
			? `system.attributes.moveHold.${move.key}.value`
			: "system.resources.hold.value";
		await actor.update({ [holdField]: hold });
	}

	// Checked conditions (e.g. Help or Hinder's Downtime/prior-help/Hook) ride alongside the
	// Advantage/Confidence badges in the same chat display — both are just "why the total is what
	// it is" tags, so they share the .move-condition rendering rather than needing their own.
	const moveConditions = (move.conditions ?? [])
		.filter((condition) => options.conditions?.includes(condition.key))
		.map(({ key, label }) => ({ key, label }));

	// A spent equipment tag (e.g. Blitz — see equipment.js) is the same kind of "why the total is
	// what it is" badge, so it rides in the same conditions list rather than getting its own
	// template section. Resolved from the catalog here (not carried on options.spentTags itself)
	// so a stale tagKey — the equipment was edited between opening the dialog and rolling —
	// quietly drops instead of rendering a blank badge.
	const equipmentConditions = (options.spentTags ?? [])
		.map(({ tagKey }) => findEquipmentTag(tagKey))
		.filter(Boolean)
		.map(({ key, label }) => ({ key, label }));

	// A spent Astir Part (Artifact — see astir.js) is the same kind of "why the total is
	// what it is" badge as a spent equipment tag, so it rides in the same conditions list. Passed
	// in pre-resolved (rather than a partKey this module would have to look up) so moves.js never
	// needs to import astir.js — see PlaybookActorSheet#_rollMove.
	const astirPartConditions = options.spentPartLabels ?? [];

	// Whether this roll can still be retroactively pushed a further step of Advantage/Disadvantage
	// (or stepped back down) after it's posted (see roll-effects.js#nextAdvantageState) — both
	// flags ride along on the chat card so its own Add Advantage/Add Disadvantage buttons know
	// whether to render, and the same check re-runs after each such change (see
	// move-chat-listeners.js#handleAdvantage) since only the x2 cap in the same direction ever
	// actually blocks a button — the opposite direction always steps down instead.
	const showAddAdvantage = nextAdvantageState(advantage.key, "advantage") !== null;
	const showAddDisadvantage = nextAdvantageState(advantage.key, "disadvantage") !== null;

	const reminders = buildReminders(
		tier, effect, options.extraFailureReminder, options.extraSuccessReminder, critical, options.extraCriticalReminder
	);
	// Bureaucrat's own always-applicable reminders (see the-diplomat.js's quickRollsMove /
	// PlaybookActorSheet#_rollMove) — unlike buildReminders' own extra*Reminder params, these
	// aren't tier-gated: the rules text applies "even on a fail," so they're appended to every
	// tier's reminders unconditionally, the same unconditional-merge treatment combinedQuestions
	// below gives move.questions/options.extraQuestions.
	const combinedReminders = [...reminders, ...(options.extraReminders ?? [])];

	// Human Resources' extra questions (see PlaybookActorSheet#_grantedQuestionsForMove) merge onto
	// the move's own question list, if any — this module never imports playbook-moves.js (see
	// claude.md's import-direction note), so the extra list arrives pre-resolved via
	// options.extraQuestions exactly like weaponLabel/spentPartLabels already do, rather than
	// resolving playbook moves here itself.
	const combinedQuestions = [...(move.questions ?? []), ...(options.extraQuestions ?? [])];

	// options.reroll (see PlaybookActorSheet#_availableReroll) is only ever set for a usesWeapon
	// move whose chosen weapon still has an unspent Decisive/Defensive/Versatile tag matching this
	// move — but the reroll itself (Decisive: "reroll a failed strike decisively") only ever
	// applies to a 6- result, so it's only offered on the chat card, and only ever recorded on the
	// message, when the roll actually failed.
	const rerollOffer = tier === "failure" && options.reroll
		? {
			actorId: actor.id,
			moveKey: move.key,
			trait,
			equipmentId: options.reroll.equipmentId,
			tagKey: options.reroll.tagKey,
			// Re-plays the same dice conditions the original attempt used — advantage/effect were
			// the player's own choice, not something a reroll should silently change — but never
			// carries spentTags/reroll forward: any spend already landed on the failed attempt, and
			// the tag this reroll itself consumes is marked spent separately (see
			// PlaybookActorSheet#onRenderMoveChat), not through another roll-dialog spend.
			options: {
				advantage: options.advantage,
				effect: options.effect,
				weaponLabel: options.weaponLabel,
				weaponTags: options.weaponTags
			},
			// The exact key this reroll's spend should be recorded under (see
			// equipment.js#rerollSpendKey) — compound for a multi-move tag like Versatile so its two
			// moves' rerolls track independently, plain for a single-move tag like Decisive/Defensive.
			spendKey: options.reroll.spendKey
		}
		: null;

	// options.automaticSuccess (see PlaybookActorSheet#_availableAutomaticSuccess) is the actor's
	// full list of currently-qualifying "spend hold/a use to treat this roll as a 10+" sources
	// (Hot-blooded, Once the War's Over, The Arity Method, Embrace Chaos's own Upgrade) — offered on
	// the chat card only when there's actually room to improve the result; an already-successful
	// roll has nothing to spend toward. A source's own optional requiresTier (Embrace Chaos only —
	// see the-witch.js) additionally restricts *that* source to one specific non-success tier, on
	// top of the shared tier !== "success" gate every source is already subject to: three of this
	// flag's other five sources (Dark Rebirth, Ancient Recall, Ain't No Grave) intentionally fire on
	// a failure, so this filter has to be additive/per-source rather than tightening the shared gate
	// itself, which would silently break them.
	const automaticSuccessOffer = tier === "success"
		? []
		: (options.automaticSuccess ?? []).filter((source) => !source.requiresTier || source.requiresTier === tier);

	// options.downgrade (see PlaybookActorSheet#_availableDowngrade) is Embrace Chaos's own mirror
	// offer — "roll a 10+, opt to take a 7-9 instead, hold 1" — so unlike automaticSuccessOffer
	// above, it's only ever relevant on a genuine 10+/12+ (tier === "success"), the one case
	// automaticSuccessOffer explicitly excludes.
	const downgradeOffer = tier === "success" ? (options.downgrade ?? []) : [];

	// options.heatUp (see PlaybookActorSheet#_availableHeatUp) is unscoped by move key or weapon,
	// unlike reroll — but like reroll, and unlike automaticSuccess, the button is omitted entirely
	// (not just disabled) when unavailable, so there's nothing to click on a card where it wouldn't
	// do anything. No tier restriction either: Heat Up ("you must take the second roll even if it's
	// worse") is a gamble offered on any result, not just a failure.
	const heatUpOffer = options.heatUp
		? {
			actorId: actor.id,
			moveKey: move.key,
			trait,
			options: {
				advantage: options.advantage,
				effect: options.effect,
				weaponLabel: options.weaponLabel,
				weaponTags: options.weaponTags
			}
		}
		: null;

	// The reroll button's label — pulled into its own variable (matching automaticSuccessOffer/
	// heatUpOffer's own consts above) rather than left inline in flavorArgs, since it now needs a
	// multi-move branch: a multi-move reroll tag (Versatile) names which move it's for, since the
	// tag alone ("Versatile") no longer identifies a single spend the way it does for a single-move
	// tag (Decisive, Defensive) — see equipment.js#rerollSpendKey.
	const rerollLabel = rerollOffer
		? (() => {
			const tag = findEquipmentTag(rerollOffer.tagKey);
			return tag.reroll.moves.length > 1 ? `${tag.label} — ${move.name}` : tag.label;
		})()
		: null;

	// Pulled into its own variable (rather than inlined into the renderTemplate call, as before)
	// so the exact args used for this render can also ride along on the message's flags — see
	// PlaybookActorSheet#handleAutomaticSuccess, which reuses it to regenerate the flavor with only
	// the tier-dependent fields changed, instead of re-deriving every display field from scratch.
	const flavorArgs = {
		name: move.name,
		traitLabel: trait?.label ?? null,
		intentLabel: options.intent?.label ?? null,
		// Set by PlaybookActorSheet#_rollMove for a usesWeapon move — the chosen weapon's name, or
		// the literal string "Unarmed" — regardless of whether any of its tags were spent, so the
		// chat card always records which weapon (if any) the roll used. null for every other move.
		weaponLabel: options.weaponLabel ?? null,
		// The chosen weapon's full tag list (e.g. "Melee, Decisive"), as a single comma-joined
		// string rather than a further conditions-style badge list — this is descriptive info
		// about the weapon itself, not "why the total is what it is" the way a spent tag or
		// Advantage/Confidence is (see moveConditions/equipmentConditions above). null for Unarmed
		// and for every non-usesWeapon move, same as weaponLabel.
		weaponTags: options.weaponTags ?? null,
		tier,
		critical,
		tierLabel: critical ? MOVE_RESULT_LABELS.critical : MOVE_RESULT_LABELS[tier],
		resultText: resolveTierValue(move.results, tier, critical),
		reminders: combinedReminders.length ? combinedReminders : null,
		conditions: [...rollConditions(advantage, effect), ...moveConditions, ...equipmentConditions, ...astirPartConditions],
		dice,
		// Number Of The Beast (see explodeSixes above) — null/false for every actor who hasn't picked
		// it, so the chat template renders nothing extra for anyone else.
		explodedDice: explosion?.extraDice.length ? explosion.extraDice : null,
		beastTriggered: Boolean(explosion?.triggered),
		hold,
		questionPrompt: resolveTierValue(move.questionPrompts, tier, critical) ?? null,
		// A choice list only makes sense in chat when this tier actually offers a choice — every
		// questionPrompts/questions move except Read the Room (questionsOnFailure) has nothing to
		// choose from on a miss, even when its failure questionPrompt still has explanatory text
		// (e.g. Mobility's "You hold nothing.").
		questions: (tier !== "failure" || move.questionsOnFailure) ? (combinedQuestions.length ? combinedQuestions : null) : null,
		reroll: Boolean(rerollOffer),
		// The specific tag (Decisive/Defensive/Versatile) this reroll offer is coming from, so the
		// chat card's button can name just that one tag rather than listing all three.
		rerollLabel,
		automaticSuccess: automaticSuccessOffer,
		downgrade: downgradeOffer,
		heatUp: Boolean(heatUpOffer),
		showAddAdvantage,
		showAddDisadvantage
	};
	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, flavorArgs);

	// Both offers ride in the same flags namespace so a single card (e.g. a failed usesWeapon roll)
	// can carry a reroll tag offer and an automatic-success spend offer at once. advantageOffer is
	// always attached (unlike reroll/automaticSuccess, which only exist when actually offered) —
	// every dice roll can potentially receive Advantage/Disadvantage after the fact, even a
	// currently-maxed one, where showAddAdvantage/showAddDisadvantage above are already both false
	// so the card simply renders no buttons for it.
	const cardFlags = {
		...(rerollOffer && { reroll: { ...rerollOffer, flavorArgs } }),
		...(automaticSuccessOffer.length && {
			automaticSuccess: { actorId: actor.id, moveKey: move.key, flavorArgs, sources: automaticSuccessOffer }
		}),
		...(downgradeOffer.length && {
			downgrade: { actorId: actor.id, moveKey: move.key, flavorArgs, sources: downgradeOffer }
		}),
		...(heatUpOffer && { heatUp: { ...heatUpOffer, flavorArgs } }),
		advantageOffer: {
			actorId: actor.id,
			moveKey: move.key,
			value,
			effectKey: options.effect ?? "none",
			advantageKey: advantage.key,
			dice,
			extraConditions: [...moveConditions, ...equipmentConditions, ...astirPartConditions],
			// Carried alongside extraConditions so move-chat-listeners.js#handleAdvantage can rebuild
			// this reminder too if a retroactive Advantage/Disadvantage add flips the tier into or out
			// of failure (see buildReminders' own extraFailureReminder param).
			extraFailureReminder: options.extraFailureReminder ?? null,
			// Same idea, mirrored onto a tier flip into or out of success (Captain's Coordinator).
			extraSuccessReminder: options.extraSuccessReminder ?? null,
			// Same idea again, mirrored onto a tier flip into or out of a 12+ critical (Soldier's
			// Indomitable, Cantrips' Truth-making, The Advocate's A Greener World, The Diplomat's
			// Sharp Tongue — see buildReminders' own comment).
			extraCriticalReminder: options.extraCriticalReminder ?? null,
			// Bureaucrat's own unconditional reminders (see combinedReminders above) — carried
			// through so move-chat-listeners.js#handleAdvantage can still include them after a
			// retroactive Advantage/Disadvantage add changes the tier.
			extraReminders: options.extraReminders ?? null,
			flavorArgs
		}
	};
	const message = await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor,
		...(Object.keys(cardFlags).length && { flags: { "armor-astir": cardFlags } })
	});

	// dice is returned alongside the chat message so PlaybookActorSheet#_rollMove can check for
	// Flourish Component's "regain Power on doubles" (see roll-effects.js#rolledDoubles) without
	// this module needing to know anything about Astir Parts. tier is returned so
	// PlaybookActorSheet#_onMoveResolved can flip Cold Company's haunted/dispelled state off this
	// roll's own outcome without re-deriving it — the same "extend rollMove's return shape as an
	// escape hatch" pattern dice itself was added under for Flourish Component.
	return { message, dice, tier };
}

// Guided's "take a 7-9 rather than rolling, if you wish" (see equipment.js's EQUIPMENT_TAGS
// comment) — posts the same mixed-success chat shape rollMove would, minus every dice-specific
// field (no Roll term ever gets created), when the player picks configureMoveRoll's "Take 7-9"
// button instead of rolling. Hold still gets granted exactly as rollMove would on a real 7-9 —
// Guided skips the dice, not the move's own consequences. options.guidedSource (the same label
// configureMoveRoll's button used — "Guided" for a weapon tag, an Astir Part's name for Spell
// Routines) names the actual source on the condition badge, falling back to "Guided" since it's
// only ever missing for a caller that predates this option.
export async function postGuidedResult(actor, move, options = {}) {
	const tier = "mixed";
	const hold = move.hold ? move.hold[tier] : null;
	if (move.hold) {
		// Same separateHold routing as rollMove above.
		const holdField = move.separateHold
			? `system.attributes.moveHold.${move.key}.value`
			: "system.resources.hold.value";
		await actor.update({ [holdField]: hold });
	}

	const flavor = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		traitLabel: null,
		intentLabel: null,
		weaponLabel: options.weaponLabel ?? null,
		weaponTags: options.weaponTags ?? null,
		tier,
		tierLabel: MOVE_RESULT_LABELS[tier],
		resultText: move.results[tier],
		reminders: null,
		conditions: [{ key: "guided", label: options.guidedSource ?? "Guided" }],
		dice: null,
		hold,
		questionPrompt: move.questionPrompts?.[tier] ?? null,
		questions: move.questions ?? null,
		reroll: false
	});

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content: flavor
	});
}

export async function postMoveDescription(actor, move) {
	const content = await renderTemplate(MOVE_CHAT_TEMPLATE, {
		name: move.name,
		description: move.description
	});

	return ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content
	});
}
