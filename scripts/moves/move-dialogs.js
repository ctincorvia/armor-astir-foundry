import {
	ADVANTAGE_STATES,
	EFFECT_STATES,
	advantageState,
	effectState
} from "./roll-effects.js";

export const MOVE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/move-roll-dialog.hbs";
export const VARIABLE_DICE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/variable-dice-roll-dialog.hbs";

// Opens a dialog to pick the trait to roll with (plus any Advantage/Disadvantage and
// Confidence/Desperation) and resolves the player's choice, or null if the dialog was
// dismissed. Always shown — even for a single-trait move — since the dice/effect selection is
// still needed. Mirrors choosePlaybook in actor-creation.js for the resolve/close shape.
//
// lockedEffect (e.g. "desperation" for bite-the-dust at max Perils — see
// PlaybookActorSheet#_onMoveRoll) pre-selects and disables the dialog's Effect select, and is
// forced into the resolved effect regardless of what the disabled select reports, as a
// belt-and-suspenders match to the template's disabled attribute.
//
// lockedAdvantage (e.g. "advantage" for Don't Follow Me's "lead a Sortie with +DEFY & advantage"
// — see PlaybookActorSheet#_grantedAdvantageForMove) is the same idea for the Dice select: pre-
// selects and disables it, and is forced into the resolved advantage the same
// belt-and-suspenders way, though an Astir Part's own spend.advantage (Artifact) still wins over
// it — a reactive, player-chosen spend outranks a standing grant, the same precedence a spent
// equipment/Astir Part effect already takes over lockedEffect.
//
// lockedTrait (Don't Follow Me's own +DEFY half — see PlaybookActorSheet#_grantedTraitForMove) is
// the Trait-select counterpart, but carries the full {key, label, value} option object rather
// than a bare key: unlike Effect/Advantage, whose possible values are a small fixed catalog
// (EFFECT_STATES/ADVANTAGE_STATES) this module can resolve a label from, a Trait's value is
// actor-specific, so the caller (which already resolved `traits` for display) hands over the
// exact entry to lock rather than a key this function would have to re-look-up.
//
// equipmentSpends (see PlaybookActorSheet#_equipmentSpends) is the actor's unspent, spendable
// equipment tags — not part of the move's own definition, unlike intents/conditions, so it's
// passed in rather than read off `move`. Offering it here, rather than filtering it down before
// the call, keeps this one place responsible for turning "what's offerable" into "what was
// checked".
//
// astirPartSpends (see PlaybookActorSheet#_astirPartSpends) is the same idea for an Astir Part's
// `spend` field rather than an equipment tag's — rendered in its own dialog section (see
// move-roll-dialog.hbs) since it isn't tied to any one equipment entry. A checked part can set
// either axis: `spend.effect` slots into the same precedence as an equipment tag's spend, and
// `spend.advantage` (new — nothing overrode the Advantage axis before Artifact) wins over
// whatever the Dice select reports, the same way a spent effect already wins over the Effect
// select.
//
// guided (see PlaybookActorSheet#_rollMove) is the *source's* own label — "Guided" for the weapon
// tag, or the granting Astir Part's name (e.g. "Spell Routines") — rather than a bare boolean.
// The template's own move-roll-guided-note already names the source ("Spell Routines: use the
// 'Take 7-9' button below..."), so the button itself just says "Take 7-9" rather than repeating
// it. Guided's "take a 7-9 rather than rolling, if you wish" is the player's choice at the moment
// of rolling, not a pre-filtered option, so every field above stays exactly as offered; picking
// it just resolves without ever reading any of them.
export async function configureMoveRoll(
	move,
	traits,
	{ lockedEffect = null, lockedAdvantage = null, lockedTrait = null, equipmentSpends = [], astirPartSpends = [], guided = null } = {}
) {
	const content = await renderTemplate(MOVE_ROLL_DIALOG_TEMPLATE, {
		traits,
		// The Trait select's own options need each option's numeric value baked into its label
		// ("CLASH (2)") — a format selectOptions' plain valueAttr/labelAttr can't produce on its
		// own, which is why this select is hand-rolled rather than using selectOptions the way
		// Dice/Effect below do. traitOptions carries that pre-formatted label alongside the raw
		// key, purely for this <select>'s own selectOptions call (see move-roll-dialog.hbs) — kept
		// separate from `traits` itself so every existing caller reading the `traits` key back off
		// this template call is unaffected.
		traitOptions: traits.map((trait) => ({ key: trait.key, label: `${trait.label} (${trait.value})` })),
		intents: move.intents,
		conditions: move.conditions,
		advantageStates: ADVANTAGE_STATES,
		effectStates: EFFECT_STATES,
		lockedEffect,
		// Display label for the locked-note below the Effect select — resolved here rather than
		// hardcoded in the template, since lockedEffect can now be "confidence" (Field Scout's
		// grantsEffectOnMove — see PlaybookActorSheet#_grantedEffectForMove) as well as the
		// original "desperation" sources (bite-the-dust at max Perils, a forced weapon tag).
		lockedEffectLabel: lockedEffect ? effectState(lockedEffect).label : null,
		lockedAdvantage,
		lockedAdvantageLabel: lockedAdvantage ? advantageState(lockedAdvantage).label : null,
		lockedTrait,
		equipmentSpends,
		astirPartSpends,
		guided
	});

	return new Promise((resolve) => {
		new Dialog({
			title: `Roll ${move.name}`,
			content,
			buttons: {
				roll: {
					label: "Roll",
					// intent/conditions keys are only added for moves that define them (Help or
					// Hinder); spentTags/spentParts are only added when there was equipment/an
					// Astir Part to offer in the first place — every other roll's resolved shape
					// is untouched.
					callback: (html) => {
						const spentTags = equipmentSpends.length
							? html.find("[name='equipment-tag']:checked").map((_, el) => el.value).get()
								.map((value) => {
									const [equipmentId, tagKey] = value.split("::");
									return { equipmentId, tagKey };
								})
							: [];
						const spentParts = astirPartSpends.length
							? html.find("[name='astir-part-spend']:checked").map((_, el) => el.value).get()
							: [];
						const spentPartSpends = spentParts
							.map((partKey) => astirPartSpends.find((spend) => spend.partKey === partKey))
							.filter(Boolean);
						// A checked spend's effect (e.g. Blitz -> confidence) sets the roll's
						// Effect directly, the same way lockedEffect does — checking the tag IS
						// the player choosing to act with confidence, so it can't require also
						// separately matching the Effect select. lockedEffect still wins over a
						// spend the same way it already wins over the select (bite-the-dust at
						// max Perils's offered spends render disabled for exactly this reason —
						// see PlaybookActorSheet#_equipmentSpends). On a spend collision (two
						// checked tags both setting Effect) the later one wins.
						const spentEffect = spentTags
							.map(({ equipmentId, tagKey }) => equipmentSpends.find(
								(spend) => spend.equipmentId === equipmentId && spend.tagKey === tagKey
							))
							.filter(Boolean)
							.at(-1)?.effect;
						const spentPartEffect = spentPartSpends.filter((spend) => spend.effect).at(-1)?.effect;
						const spentPartAdvantage = spentPartSpends.filter((spend) => spend.advantage).at(-1)?.advantage;

						resolve({
							trait: lockedTrait ?? traits.find((t) => t.key === html.find("[name='trait']").val()),
							advantage: spentPartAdvantage ?? lockedAdvantage ?? html.find("[name='advantage']").val(),
							effect: lockedEffect ?? spentEffect ?? spentPartEffect ?? html.find("[name='effect']").val(),
							...(move.intents && {
								intent: move.intents.find((i) => i.key === html.find("[name='intent']").val())
							}),
							...(move.conditions && {
								conditions: html.find("[name='condition']:checked").map((_, el) => el.value).get()
							}),
							...(equipmentSpends.length && { spentTags }),
							...(astirPartSpends.length && { spentParts })
						});
					}
				},
				...(guided && {
					takeSeven: {
						label: "Take 7-9",
						callback: () => resolve({ takeSeven: true })
					}
				}),
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "roll",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "move-roll-dialog"],
			// Dialog's own default (400px) crowded the Equipment section's tag name + description
			// onto too narrow a column once the checkbox got its own row back (see
			// move-roll-equipment-spend-option in styles/playbook-actor-sheet.css) — a little extra
			// width gives that text room without needing to shrink or truncate it.
			width: 480
		}).render(true);
	});
}

// Plan & Prepare's own dialog — a wholly separate pipeline from configureMoveRoll/rollMove (see
// SPECIAL_MOVES' variableDicePool comment): no trait, no Confidence/Desperation, no
// Advantage/Disadvantage, so nothing in configureMoveRoll's form applies. Target is bounded 0-5 to
// match Division Strength's own documented range (see claude.md/authority-actor-sheet.js) — this
// module deliberately does not look the value up from an Authority actor automatically (no
// findAuthorityActors/chooseAuthority cross-actor plumbing exists, unlike Lead a Sortie's CREW/
// Carrier precedent), so the player types it in for now. Extra Dice (Downtime Scene rewards) has no
// upper bound: nothing in this module tracks a Downtime-earned-dice pool to cap it against.
export async function configureVariableDiceRoll(move) {
	const content = await renderTemplate(VARIABLE_DICE_ROLL_DIALOG_TEMPLATE, {});

	return new Promise((resolve) => {
		new Dialog({
			title: `Roll ${move.name}`,
			content,
			buttons: {
				roll: {
					label: "Roll",
					callback: (html) => resolve({
						target: Number(html.find("[name='target']").val()),
						extraDice: Number(html.find("[name='extra-dice']").val())
					})
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "roll",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "variable-dice-roll-dialog"]
		}).render(true);
	});
}

// The "?" button's private counterpart to postMoveDescription (move-roll.js) — same rules text, shown only
// to the clicking player via a Dialog rather than posted to chat. Matches this codebase's other
// Promise-wrapped Dialog helpers (e.g. chooseWeapon/chooseEquipmentCatalogItem in equipment.js).
// Tracks the currently-open instance so a second call (clicking another move's "?" before closing
// the first) closes the first dialog and resolves its promise, rather than leaving it open forever.
let openMoveDescriptionDialog = null;

export function showMoveDescription(move) {
	openMoveDescriptionDialog?.close();

	return new Promise((resolve) => {
		const dialog = new Dialog({
			title: move.name,
			content: `<div class="move-description">${move.description}</div>`,
			buttons: {
				close: {
					label: "Close",
					callback: () => resolve()
				}
			},
			default: "close",
			close: () => {
				if (openMoveDescriptionDialog === dialog) {
					openMoveDescriptionDialog = null;
				}
				resolve();
			}
		}, {
			classes: ["armor-astir", "move-description-dialog"]
		});
		openMoveDescriptionDialog = dialog;
		dialog.render(true);
	});
}
