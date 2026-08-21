import {
	advantageState,
	effectState
} from "./roll-effects.js";
import {
	ADVANTAGE_DISPLAY_ORDER,
	EFFECT_DISPLAY_ORDER,
	chainEntryResult,
	reverseChainStep
} from "./roll-chain.js";

export const MOVE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/move-roll-dialog.hbs";
export const VARIABLE_DICE_ROLL_DIALOG_TEMPLATE = "modules/armor-astir/templates/variable-dice-roll-dialog.hbs";

// Shapes one ADVANTAGE_DISPLAY_ORDER/EFFECT_DISPLAY_ORDER list into the {states, selectedKey,
// selectedLabel} the notched-slider partial needs — every stop disabled together when locked,
// matching the old <select disabled> behavior.
function buildNotchedSlider(displayOrder, resolveState, lockedKey) {
	const selectedKey = lockedKey ?? "none";
	return {
		states: displayOrder.map((key) => {
			const state = resolveState(key);
			return { key: state.key, label: state.label, selected: state.key === selectedKey, disabled: Boolean(lockedKey) };
		}),
		selectedKey,
		selectedLabel: resolveState(selectedKey).label
	};
}

// Display text for a failed requiresAdvantage gate (see the render callback's own
// repaintAvailability()) — built from the gate's own listed states via advantageState rather than
// a hardcoded "Requires Advantage", since a gate can name any subset of ADVANTAGE_STATES (Embrace
// Chaos's own gate is ["disadvantage", "disadvantage2"], not advantage at all).
const requiresAdvantageReason = (entry) =>
	`Requires ${entry.requiresAdvantage.map((key) => advantageState(key).label).join(" or ")}`;

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
// selects and disables it, and seeds the render callback's own currentAdvantage — a checked Roll
// Modifier nudges *from* the locked value the one time it's checked, rather than overriding it
// outright, the same nudge-from-current treatment lockedEffect's own currentEffect gets.
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
// narrativeTags (see PlaybookActorSheet#_narrativeWeaponTags) is the same weapon-tag scoping,
// but for tags with no codified mechanic — purely a read-only display list, nothing to check or
// resolve back out of the dialog.
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
// every grantsRollModifier entry offered for this specific move, each carrying its own resolved
// advantage/effect/requiresAdvantage/deferred/disabled shape. Checking one nudges the roll's own
// Dice/Effect pick once, at the moment it's checked, and unchecking it steps that same nudge back
// off (see roll-chain.js's chainEntryResult/reverseChainStep) — see that module and
// docs/domains/moves.md for the step-offset model this replaced All In's and Embrace Chaos's old
// bespoke Category D mechanisms with. Between check and uncheck the player has full manual control
// of the Dice/Effect steppers, including moving them somewhere the entry's own step/reverse-step
// can no longer reach — see the render callback's own currentAdvantage/currentEffect below.
//
// guided (see PlaybookActorSheet#_rollMove) is the *source's* own label — "Guided" for the weapon
// tag, or the granting Astir Part's name (e.g. "Spell Routines") — rather than a bare boolean.
// The template's own move-roll-guided-note already names the source ("Spell Routines: use the
// 'Take 7-9' button below..."), so the button itself just says "Take 7-9" rather than repeating
// it. Guided's "take a 7-9 rather than rolling, if you wish" is the player's choice at the moment
// of rolling, not a pre-filtered option, so every field above stays exactly as offered; picking
// it just resolves without ever reading any of them.
//
// rerollTag (see PlaybookActorSheet#_availableRerollTag) is a read-only preview of the chosen
// weapon's still-live Decisive/Defensive/Versatile reroll, if any — informational only, nothing
// to check or resolve back out of the dialog, the same shape narrativeTags/riders already are.
// Distinct from the *different-shaped* `reroll` PlaybookActorSheet#_finishMoveRoll attaches to
// rollMove's own options after a failed roll (see move-roll-mixin.js) — same underlying tag,
// two different consumers, so two different names/shapes to avoid conflating them.
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
// copy — Dice/Effect/lockedAdvantage stay top-level and unscoped either way, since none of those
// vary by weapon (see _rollMoveWithWeaponChoice's own weapon-independent/-dependent split).
// _onWeaponMoveRoll's own quick-roll path now passes a single-entry weaponBundles too (its already-
// known weapon, no Unarmed option — the <select> is hidden via CSS rather than skipped, see
// move-roll-dialog.hbs's move-roll-select-group-hidden), so it renders the same weapon-card
// column as the Moves tab's own picker. Left null (the default) only for a move that isn't
// usesWeapon at all, which keeps rendering through the single-column path below.
export async function configureMoveRoll(
	move,
	traits,
	{
		lockedEffect = null,
		lockedAdvantage = null,
		lockedTrait = null,
		equipmentSpends = [],
		narrativeTags = [],
		rollModifiers = [],
		riders = [],
		guided = null,
		rerollTag = null,
		weaponBundles = null
	} = {}
) {
	const advantageSlider = buildNotchedSlider(ADVANTAGE_DISPLAY_ORDER, advantageState, lockedAdvantage);
	const effectSlider = buildNotchedSlider(EFFECT_DISPLAY_ORDER, effectState, lockedEffect);

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
		advantageStates: advantageSlider.states,
		advantageSelectedKey: advantageSlider.selectedKey,
		advantageSelectedLabel: advantageSlider.selectedLabel,
		effectStates: effectSlider.states,
		effectSelectedKey: effectSlider.selectedKey,
		effectSelectedLabel: effectSlider.selectedLabel,
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
		narrativeTags,
		rollModifiers,
		riders,
		guided,
		rerollTag,
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
			// Must be a field on this Dialog's first argument (DialogData), not the options object
			// below — Foundry's Dialog only ever invokes `this.data.render`, not `options.render`
			// (see client/ui/dialog.js; confirmed against the existing precedent at
			// equipment-dialogs.js's chooseEquipmentCatalogItem, whose own `render` field sits in
			// this same spot for the same reason).
			render: (html) => {
				// The weapon <select> that switches which weaponBundles panel is visible (see
				// move-roll-dialog.hbs's own {{#if weaponBundles}} markup) — a plain synchronous
				// class toggle, no re-render, mirroring wirePickerTabs' own tab-switch wiring
				// (equipment-helpers.js) for the same "no TabsV2 controller inside a bare Foundry
				// Dialog" reason. Also re-runs repaintAvailability() below — the active weapon panel
				// is what activeRollModifiers() reads, so switching weapons can change which Roll
				// Modifiers are offered — but never perturbs currentAdvantage/currentEffect, since
				// switching panels isn't itself a player choice about the roll's Dice/Effect.
				if (weaponBundles) {
					html.find("[name='weapon-select']").on("change", (event) => {
						html.find("[data-weapon-panel]").removeClass("active");
						html.find(`[data-weapon-panel="${event.target.value}"]`).addClass("active");
						repaintAvailability();
					});
				}

				// Live Dice/Effect state (see roll-chain.js's chainEntryResult/reverseChainStep) —
				// currentAdvantage/currentEffect start at whatever a lock forces them to, or "none"
				// otherwise, and from there are under the player's full manual control via the notch
				// sliders. Checking a Roll Modifier nudges them once, at the moment it's checked;
				// unchecking it steps them back the other way, per axis, clamped to a no-op on
				// whichever axis has since been pushed out of that step's reach (e.g. the player
				// manually moved it to the axis's own extreme, or another checked entry already has)
				// — never a hard failure, and never touches the *other* axis or any other checked
				// entry. Between check and uncheck the player can freely move the steppers however
				// the fiction demands, including stacking a countervailing disadvantage on top of a
				// still-checked advantage grant; nothing here ever re-derives a value from scratch,
				// and a checked modifier is never auto-unchecked regardless of whether its own gate
				// still holds. This is what replaced All In's/Embrace Chaos's old bespoke Category D
				// wiring (rollStack/disadvantageConversion) with an ordinary, composable
				// grantsRollModifier entry apiece. See docs/domains/moves.md for the full model.
				let currentAdvantage = lockedAdvantage ?? "none";
				let currentEffect = lockedEffect ?? "none";

				const rollModifierScope = () => (weaponBundles ? "[data-weapon-panel].active " : "");
				// weaponBundles' own Roll Modifiers live one copy per panel (see this function's own
				// weaponBundles doc comment) — resolved from the currently active panel's own bundle
				// rather than the dialog's single top-level `rollModifiers`, mirroring every other
				// weapon-dependent read the Roll button's callback below already makes.
				const activeRollModifiers = () => {
					if (!weaponBundles) return rollModifiers;
					const activeWeaponKey = html.find("[name='weapon-select']").val();
					return weaponBundles.find((bundle) => bundle.weaponKey === activeWeaponKey)?.rollModifiers ?? [];
				};

				// Writes the hidden [name='advantage']/[name='effect'] input, checks the matching
				// notch, and sets the readout — showing a "from → to" arrow only when fromValue
				// differs from value. A direct notch click always reads plainly (it's the player's
				// own unambiguous choice, never a transition); a Roll Modifier's check-nudge or
				// uncheck-reverse shows the transition it just made, or reads plainly when that step
				// was clamped to a no-op (nowhere left for that axis to go).
				const paintAdvantage = (value, fromValue = value) => {
					const label = advantageState(value).label;
					html.find("[name='advantage']").val(value);
					html.find(`[name='advantage-notch'][value='${value}']`).prop("checked", true);
					html.find("[data-notched-slider='advantage'] [data-notched-slider-readout]").text(
						fromValue !== value ? `${advantageState(fromValue).label} → ${label}` : label
					);
				};
				const paintEffect = (value, fromValue = value) => {
					const label = effectState(value).label;
					html.find("[name='effect']").val(value);
					html.find(`[name='effect-notch'][value='${value}']`).prop("checked", true);
					html.find("[data-notched-slider='effect'] [data-notched-slider-readout]").text(
						fromValue !== value ? `${effectState(fromValue).label} → ${label}` : label
					);
				};

				// Re-evaluates disabled/reason state for every *unchecked*, non-reminder,
				// non-statically-disabled Roll Modifier row against the live currentAdvantage/
				// currentEffect — enabling a row the moment the current state makes it newly
				// reachable (e.g. All In once Advantage is picked), and disabling one the current
				// state makes unreachable. A *checked* row is never touched by this loop, so it
				// stays clickable to uncheck regardless of whether its step still "applies" to
				// wherever the player has since moved the steppers.
				const repaintAvailability = () => {
					const scope = rollModifierScope();
					for (const entry of activeRollModifiers()) {
						if (entry.reminderOnly || entry.disabled) continue;
						const checkboxName = entry.deferred ? "pending-roll-modifier" : "roll-modifier";
						const rowSelector = `${scope}[data-roll-modifier-row="${entry.key}"]`;
						const checkbox = html.find(`${rowSelector} [name='${checkboxName}']`);
						if (checkbox.prop("checked")) continue;
						const applicable = Boolean(chainEntryResult({ advantage: currentAdvantage, effect: currentEffect }, entry));
						checkbox.prop("disabled", !applicable);
						html.find(rowSelector).toggleClass("disabled", !applicable);
						const requiresAdvantageGateFailed = !applicable
							&& entry.requiresAdvantage && !entry.requiresAdvantage.includes(currentAdvantage);
						html.find(`${rowSelector} [data-roll-modifier-reason]`).text(
							requiresAdvantageGateFailed ? requiresAdvantageReason(entry) : ""
						);
					}
				};

				html.find("[name='advantage-notch']").on("change", (event) => {
					currentAdvantage = event.target.value;
					paintAdvantage(currentAdvantage);
					repaintAvailability();
				});
				html.find("[name='effect-notch']").on("change", (event) => {
					currentEffect = event.target.value;
					paintEffect(currentEffect);
					repaintAvailability();
				});
				html.find("[name='roll-modifier']").on("change", (event) => {
					const fromAdvantage = currentAdvantage;
					const fromEffect = currentEffect;
					const entry = activeRollModifiers().find((modifier) => modifier.key === event.target.value);
					if (entry && event.target.checked) {
						const result = chainEntryResult({ advantage: currentAdvantage, effect: currentEffect }, entry);
						if (result) {
							currentAdvantage = result.advantage;
							currentEffect = result.effect;
						}
					} else if (entry) {
						// Uncheck: step the entry's own grant back off, per axis, clamped to a no-op
						// on whichever axis has nowhere left to go — see reverseChainStep's own doc
						// comment in roll-chain.js.
						const result = reverseChainStep({ advantage: currentAdvantage, effect: currentEffect }, entry);
						currentAdvantage = result.advantage;
						currentEffect = result.effect;
					}
					paintAdvantage(currentAdvantage, fromAdvantage);
					paintEffect(currentEffect, fromEffect);
					repaintAvailability();
				});

				paintAdvantage(currentAdvantage);
				paintEffect(currentEffect);
				repaintAvailability();
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
						// Effect directly, the same way a lockedEffect does — checking the tag IS
						// the player choosing to act with confidence, so equipment spends stay
						// outside the Roll Modifiers' own currentAdvantage/currentEffect nudging
						// (see the render callback above) rather than composing through it. On a
						// spend collision (two checked tags both setting Effect) the later one wins.
						const spentEffect = spentTags
							.map(({ equipmentId, tagKey }) => activeEquipmentSpends.find(
								(spend) => spend.equipmentId === equipmentId && spend.tagKey === tagKey
							))
							.filter(Boolean)
							.at(-1)?.effect;
						// Roll Modifiers (see PlaybookActorSheet#_rollModifiersForMove) split into two
						// checkbox names by the template: non-deferred [name='roll-modifier'] entries
						// apply to THIS roll — checking one already nudged the hidden advantage/effect
						// inputs once, in the render callback above, so nothing needs re-reading here
						// beyond the checked keys themselves. A modifier is never auto-unchecked, so
						// its resource is spent even if the player has since moved the steppers away
						// from what its nudge granted (see the render callback's own doc comment).
						// Deferred [name='pending-roll-modifier'] entries never touch this roll's own
						// Advantage/Effect, only its resource cost — both lists feed spentRollModifiers
						// below, for PlaybookActorSheet#_spendRollModifiers to actually consume.
						const checkedRollModifierKeys = activeRollModifiers.length
							? html.find(rollModifierSelector).map((_, el) => el.value).get()
							: [];
						const checkedPendingRollModifierKeys = activeRollModifiers.length
							? html.find(pendingRollModifierSelector).map((_, el) => el.value).get()
							: [];
						const spentRollModifiers = [...checkedRollModifierKeys, ...checkedPendingRollModifierKeys];

						resolve({
							trait: lockedTrait ?? activeTraits.find((t) => t.key === html.find(traitSelector).val()),
							// The render callback's own paintAdvantage/paintEffect (see chainEntryResult
							// in roll-chain.js) already wrote these two hidden inputs — from
							// lockedAdvantage/lockedEffect, any one-time Roll Modifier nudge, and
							// whatever manual notch clicks the player made afterward — so reading them
							// back here resolves the roll's final Advantage/Effect directly.
							advantage: html.find("[name='advantage']").val(),
							// activeLockedEffect wins outright, not just as a fallback: unlike
							// lockedAdvantage (which a checked Roll Modifier can legitimately step the
							// chain away from), any grantsRollModifier entry with its own `effect` is
							// unconditionally disabled whenever lockedEffect is set (see
							// _rollModifiersForMove's own effectLocked gate), so the Effect axis can
							// never actually diverge from a lock through the chain — this is
							// belt-and-suspenders against the disabled Effect select/spend rows
							// reporting anything else, the same guarantee lockedEffect has always had.
							// A checked equipment spend's own effect wins over the chain-painted value
							// otherwise (see spentEffect above).
							effect: activeLockedEffect ?? spentEffect ?? html.find("[name='effect']").val(),
							...(move.intents && {
								intent: move.intents.find((i) => i.key === html.find("[name='intent']").val())
							}),
							...(move.conditions && {
								conditions: html.find("[name='condition']:checked").map((_, el) => el.value).get()
							}),
							...(activeEquipmentSpends.length && { spentTags }),
							...(activeRollModifiers.length && { spentRollModifiers }),
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
