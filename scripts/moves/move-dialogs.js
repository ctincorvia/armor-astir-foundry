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
// belt-and-suspenders way, though a checked Roll Modifier's own advantage (Artifact included)
// still wins over it — a reactive, player-chosen spend outranks a standing grant, the same
// precedence a checked Roll Modifier's effect already takes over lockedEffect.
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
// riders (see PlaybookActorSheet#_ridersForMove) is a read-only preview of the move's passive
// on-roll bonuses — reuses the same four _grantedXReminderForMove resolvers the post-roll chat
// card already calls, just surfaced before the player commits to rolling. Unlike rollModifiers,
// there's nothing to check here (no key/disabled/deferred concept, just label/text pairs), and
// unlike weaponBundles' own per-weapon fields, it's unscoped by weapon — passed once at the top
// level rather than duplicated into every weaponBundles entry, since none of the four resolvers
// it calls take a weapon.
//
// rollModifiers (see PlaybookActorSheet#_rollModifiersForMove) is the Roll Modifiers section —
// every grantsRollModifier entry offered for this specific move (Category B/C entries), each
// carrying its own resolved advantage/effect/deferred/disabled shape. rollStack (see
// PlaybookActorSheet#_rollStackModifier) is the separate, single Category D entry (All In) —
// a live Dice-select-reactive stack rather than a gated actor-state spend, so it's wired through
// the Dialog's own `render` callback below instead of a checked-box lookup at Roll time alone.
// disadvantageConversion (see PlaybookActorSheet#_disadvantageConversionModifier) is Embrace
// Chaos's own second Category D entry — live-reactive the same way, but keyed off a `transform`
// lookup table (Disadvantage -> Advantage, Disadvantage x2 -> flat) rather than rollStack's single
// fixed setAdvantage/setEffect pair, since which state it resolves to depends on which
// Disadvantage state is currently selected.
//
// guided (see PlaybookActorSheet#_rollMove) is the *source's* own label — "Guided" for the weapon
// tag, or the granting Astir Part's name (e.g. "Spell Routines") — rather than a bare boolean.
// The template's own move-roll-guided-note already names the source ("Spell Routines: use the
// 'Take 7-9' button below..."), so the button itself just says "Take 7-9" rather than repeating
// it. Guided's "take a 7-9 rather than rolling, if you wish" is the player's choice at the moment
// of rolling, not a pre-filtered option, so every field above stays exactly as offered; picking
// it just resolves without ever reading any of them.
//
// weaponBundles (see PlaybookActorSheet#_rollMoveWithWeaponChoice/_weaponRollBundle) merges the
// old separate "which weapon" chooseWeapon prompt into this dialog for a usesWeapon move: one
// entry per candidate weapon (plus a leading null entry for Unarmed), each carrying its own
// Trait/weapon-card/Equipment/Roll-Modifiers/lockedEffect/guided — everything downstream of
// *which* weapon is selected. When present, the template renders a weapon <select> plus one
// hidden/shown panel *pair* per bundle, split across both grid columns (Trait in Column 1
// alongside the select; weapon card/Equipment/Roll Modifiers in Column 2 — see move-roll-dialog.hbs's
// own {{#if weaponBundles}} split and its move-roll-weapon-panel comment in dialogs.css). Both
// halves of a pair share the same data-weapon-panel key, so the render callback below can toggle
// .active on every matching element in one query without needing to know which column it's in.
// This function's own render/Roll-button wiring below reads every weapon-dependent field (Trait,
// Equipment, Roll Modifiers) from the *active* panel instead of the dialog's single top-level
// copy — Dice/Effect/Stack/Convert/lockedAdvantage stay top-level and unscoped either way, since
// none of those vary by weapon (see _rollMoveWithWeaponChoice's own weapon-independent/-dependent
// split). Left null (the default) for every non-usesWeapon move, and for _onWeaponMoveRoll's own
// quick-roll path (the weapon is already known there, so there's nothing to choose) — both keep
// rendering and resolving through the exact same single-column path as before this option existed.
export async function configureMoveRoll(
	move,
	traits,
	{
		lockedEffect = null,
		lockedAdvantage = null,
		lockedTrait = null,
		equipmentSpends = [],
		rollModifiers = [],
		rollStack = null,
		disadvantageConversion = null,
		riders = [],
		guided = null,
		weaponBundles = null
	} = {}
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
		rollModifiers,
		rollStack,
		disadvantageConversion,
		riders,
		guided,
		// Each bundle's own lockedEffectLabel is resolved here, the same effectState lookup as the
		// top-level lockedEffect above — kept out of PlaybookActorSheet#_weaponRollBundle so that
		// method (and every test asserting its return shape) doesn't need its own roll-effects.js
		// import just for display text.
		weaponBundles: weaponBundles?.map((bundle) => ({
			...bundle,
			lockedEffectLabel: bundle.lockedEffect ? effectState(bundle.lockedEffect).label : null
		})) ?? null
	});

	return new Promise((resolve) => {
		new Dialog({
			title: `Roll ${move.name}`,
			content,
			// All In's own live-reactive checkbox (Category D — see cantrips.js's grantsRollStack):
			// enabled only while Advantage is currently selected, and unchecked the moment Advantage
			// is changed away from it. Must be a field on this Dialog's first argument (DialogData),
			// not the options object below — Foundry's Dialog only ever invokes `this.data.render`,
			// not `options.render` (see client/ui/dialog.js; confirmed against the existing precedent
			// at equipment-dialogs.js's chooseEquipmentCatalogItem, whose own `render` field sits in
			// this same spot for the same reason).
			render: (html) => {
				// The weapon <select> that switches which weaponBundles panel is visible (see
				// move-roll-dialog.hbs's own {{#if weaponBundles}} markup) — a plain synchronous
				// class toggle, no re-render, mirroring wirePickerTabs' own tab-switch wiring
				// (equipment-helpers.js) for the same "no TabsV2 controller inside a bare Foundry
				// Dialog" reason.
				if (weaponBundles) {
					html.find("[name='weapon-select']").on("change", (event) => {
						html.find("[data-weapon-panel]").removeClass("active");
						html.find(`[data-weapon-panel="${event.target.value}"]`).addClass("active");
					});
				}

				if (rollStack) {
					const updateRollStackState = () => {
						const enabled = html.find("[name='advantage']").val() === "advantage";
						html.find("[name='roll-stack']").prop("disabled", !enabled).prop("checked", (i, v) => enabled && v);
					};
					html.find("[name='advantage']").on("change", updateRollStackState);
					updateRollStackState();
				}

				// Embrace Chaos's own live-reactive checkbox (Category D â€” see
				// grantsDisadvantageConversion's own doc comment above): enabled only while the
				// currently selected Dice state has a transform entry (Disadvantage or Disadvantage
				// x2), unchecked the moment the Dice select changes to a state with none. A separate
				// `if` block, not an `else`/early-return chained off rollStack above â€” the two grants
				// are independent, and a move could in principle offer either alone.
				if (disadvantageConversion) {
					const updateDisadvantageConversionState = () => {
						const enabled = Boolean(disadvantageConversion.transform[html.find("[name='advantage']").val()]);
						html.find("[name='disadvantage-conversion']").prop("disabled", !enabled).prop("checked", (i, v) => enabled && v);
					};
					html.find("[name='advantage']").on("change", updateDisadvantageConversionState);
					updateDisadvantageConversionState();
				}
			},
			buttons: {
				roll: {
					label: "Roll",
					// intent/conditions keys are only added for moves that define them (Help or
					// Hinder); spentTags is only added when there was equipment to offer in the
					// first place — every other roll's resolved shape is untouched.
					callback: (html) => {
						// weaponBundles' own weapon-dependent fields (Trait, Equipment, Roll
						// Modifiers) are read from the *active* panel instead of this dialog's
						// single top-level copy — see configureMoveRoll's own weaponBundles doc
						// comment. Every selector below stays exactly as it was, unscoped, when
						// weaponBundles wasn't passed (activeBundle stays null, so each `active*`
						// fallback resolves to the same closure variable the pre-weaponBundles code
						// already read) — this is the guarantee every non-usesWeapon move's test
						// coverage relies on to keep passing unmodified.
						const activeWeaponKey = weaponBundles ? html.find("[name='weapon-select']").val() : null;
						const activeBundle = weaponBundles
							? weaponBundles.find((bundle) => bundle.weaponKey === activeWeaponKey)
							: null;
						const activeTraits = activeBundle ? activeBundle.traits : traits;
						const activeLockedEffect = activeBundle ? activeBundle.lockedEffect : lockedEffect;
						const activeEquipmentSpends = activeBundle ? activeBundle.equipmentSpends : equipmentSpends;
						const activeRollModifiers = activeBundle ? activeBundle.rollModifiers : rollModifiers;
						const traitSelector = weaponBundles ? "[data-weapon-panel].active [name='trait']" : "[name='trait']";
						const equipmentTagSelector = weaponBundles
							? "[data-weapon-panel].active [name='equipment-tag']:checked"
							: "[name='equipment-tag']:checked";
						const rollModifierSelector = weaponBundles
							? "[data-weapon-panel].active [name='roll-modifier']:checked"
							: "[name='roll-modifier']:checked";
						const pendingRollModifierSelector = weaponBundles
							? "[data-weapon-panel].active [name='pending-roll-modifier']:checked"
							: "[name='pending-roll-modifier']:checked";

						const spentTags = activeEquipmentSpends.length
							? html.find(equipmentTagSelector).map((_, el) => el.value).get()
								.map((value) => {
									const [equipmentId, tagKey] = value.split("::");
									return { equipmentId, tagKey };
								})
							: [];
						// A checked spend's effect (e.g. Blitz -> confidence) sets the roll's
						// Effect directly, the same way lockedEffect does — checking the tag IS
						// the player choosing to act with confidence, so it can't require also
						// separately matching the Effect select. lockedEffect still wins over a
						// spend the same way it already wins over the select (bite-the-dust at
						// max Perils's offered spends render disabled for exactly this reason —
						// see PlaybookActorSheet#_equipmentSpends). On a spend collision (two
						// checked tags both setting Effect) the later one wins.
						const spentEffect = spentTags
							.map(({ equipmentId, tagKey }) => activeEquipmentSpends.find(
								(spend) => spend.equipmentId === equipmentId && spend.tagKey === tagKey
							))
							.filter(Boolean)
							.at(-1)?.effect;
						// Roll Modifiers (see PlaybookActorSheet#_rollModifiersForMove) split into two
						// checkbox names by the template: non-deferred [name='roll-modifier'] entries
						// apply to THIS roll (folded into rollModifierAdvantage/rollModifierEffect
						// below, same "checked IS the choice"/.at(-1) collision rule as the equipment
						// spend above); deferred [name='pending-roll-modifier'] entries
						// never touch this roll's own Advantage/Effect, only its resource cost — both
						// lists feed spentRollModifiers below, for
						// PlaybookActorSheet#_spendRollModifiers to actually consume.
						const checkedRollModifierKeys = activeRollModifiers.length
							? html.find(rollModifierSelector).map((_, el) => el.value).get()
							: [];
						const checkedPendingRollModifierKeys = activeRollModifiers.length
							? html.find(pendingRollModifierSelector).map((_, el) => el.value).get()
							: [];
						const checkedRollModifierEntries = checkedRollModifierKeys
							.map((key) => activeRollModifiers.find((entry) => entry.key === key))
							.filter(Boolean);
						const rollModifierAdvantage = checkedRollModifierEntries.filter((entry) => entry.advantage).at(-1)?.advantage;
						const rollModifierEffect = checkedRollModifierEntries.filter((entry) => entry.effect).at(-1)?.effect;
						const spentRollModifiers = [...checkedRollModifierKeys, ...checkedPendingRollModifierKeys];
						// All In (see cantrips.js's grantsRollStack) — a live Dice-select-reactive
						// stack rather than a gated actor-state spend, so it's read directly off the
						// checkbox rather than through _rollModifierAvailability/_spendRollModifiers.
						// Only ever meaningfully checked while the render callback above has already
						// enabled it (Advantage selected), so no separate "is Advantage selected"
						// re-check is needed here.
						const allInChecked = Boolean(rollStack) && Boolean(html.find("[name='roll-stack']").prop("checked"));
						// Embrace Chaos's own checkbox — same "only meaningfully checked while the
						// render callback above already enabled it" reasoning as allInChecked, just
						// keyed off the disadvantage-conversion checkbox name instead of roll-stack.
						const disadvantageConversionChecked = Boolean(disadvantageConversion)
							&& Boolean(html.find("[name='disadvantage-conversion']").prop("checked"));

						resolve({
							trait: lockedTrait ?? activeTraits.find((t) => t.key === html.find(traitSelector).val()),
							// A resource-spending, in-the-moment click at Roll time (disadvantageConversionChecked)
							// outranks a standing/passive grant — same precedence a checked Roll
							// Modifier's own advantage (Artifact included) already takes over
							// lockedAdvantage — but All In's own stack still wins outright,
							// since Advantage x2 always resolves it away from a Disadvantage state entirely.
							advantage: (allInChecked ? rollStack.setAdvantage : null)
								?? (disadvantageConversionChecked ? disadvantageConversion.transform[html.find("[name='advantage']").val()] : null)
								?? rollModifierAdvantage
								?? lockedAdvantage
								?? html.find("[name='advantage']").val(),
							effect: (allInChecked ? rollStack.setEffect : null)
								?? activeLockedEffect
								?? spentEffect
								?? rollModifierEffect
								?? html.find("[name='effect']").val(),
							...(move.intents && {
								intent: move.intents.find((i) => i.key === html.find("[name='intent']").val())
							}),
							...(move.conditions && {
								conditions: html.find("[name='condition']:checked").map((_, el) => el.value).get()
							}),
							...(activeEquipmentSpends.length && { spentTags }),
							...(activeRollModifiers.length && { spentRollModifiers }),
							...(disadvantageConversionChecked && { spentDisadvantageConversion: true }),
							...(weaponBundles && { weaponId: activeWeaponKey })
						});
					}
				},
				...((weaponBundles ? weaponBundles.some((bundle) => bundle.guided) : guided) && {
					takeSeven: {
						label: "Take 7-9",
						// weaponId is only meaningful (and only ever read) when weaponBundles was
						// passed — PlaybookActorSheet#_rollMoveWithWeaponChoice resolves the chosen
						// weapon's own bundle from it to know which source's name to attribute the
						// Guided result to, mirroring how the Roll button's own callback resolves it.
						callback: (html) => resolve({
							takeSeven: true,
							...(weaponBundles && { weaponId: html.find("[name='weapon-select']").val() })
						})
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
			// move-roll-equipment-spend-option in styles/dialogs.css) — a little extra width gives
			// that text room without needing to shrink or truncate it. Bumped again, from 480 to 560,
			// once Roll Modifiers joined the dialog, then 560 to 640 once weaponBundles' own 2-column
			// grid (.move-roll-grid) went asymmetric — column 2 (weapon select, weapon card, Equipment,
			// Roll Modifiers) needs roughly twice column 1's width, and 560 total left column 1 too
			// narrow for its own selects.
			width: 640,
			// height/resizable follow the same precedent as playbook-moves.js's choosePlaybookMove and
			// equipment-dialogs.js's chooseEquipmentCatalogItem/configureEquipment: resizable needs a
			// numeric height, not "auto" (Foundry only renders the drag handle and tracks a height to
			// resize from when one's given). A weaponBundles roll (a heavily-tagged weapon plus several
			// active Roll Modifiers) can run taller than a plain single-column roll — a fixed default
			// covers the common case, and resizable:true lets the player grow it for the heavy case
			// instead of being stuck scrolling a small fixed box.
			height: 560,
			resizable: true
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
// Promise-wrapped Dialog helpers (e.g. chooseEquipmentCatalogItem in equipment.js).
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
