import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { chooseApproachOverride } from "../../core/approaches.js";
import { WEAPON_SLOTS, carrierWeaponTagKeys, chooseCarrier, findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";
import { UNARMED, spendEquipmentTagsOnActor } from "../../equipment/equipment.js";
import { rolledDoubles } from "../../moves/roll-effects.js";
import {
	BASIC_MOVES,
	HOLD_MAX,
	HOLD_MIN,
	configureMoveRoll,
	configureVariableDiceRoll,
	postGuidedResult,
	postMoveDescription,
	rollMove,
	rollVariableDicePool,
	showMoveDescription
} from "../../moves/moves.js";
import { ALL_MOVES } from "../../moves/all-moves.js";
import { findWitchBoon, resolveWitchBoons } from "../witch.js";

// The Roll/Activate/Description/Info button handlers and the shared _rollMove pipeline every move
// source (basic, special, playbook, Astir) runs through — see moves-mixin.js's file comment for how
// this file relates to its siblings in this directory.
export const MoveRollSheetMixin = {
	// A held Witch Boon (witch.js) renders Chat/Info buttons — and, for Masking, a Roll button — in
	// its own Patron Boons group (moves-mixin.js), so every ALL_MOVES.find lookup keyed off a
	// clicked move's data-move key needs this fallback alongside it. A synthesized Arcanist ritual
	// slot (arcanist-mixin.js's _preparedRitualMoves) gets the same treatment as a third fallback —
	// it renders Chat/Info (and, for the Aspect ritual, Activate) buttons in its own Prepared
	// Rituals group the same read-only way a Boon does.
	_resolveAnyMove(key) {
		return ALL_MOVES.find((m) => m.key === key) ?? findWitchBoon(key) ?? this._preparedRitualEntry(key);
	},
	async _onMoveRoll(event) {
		const clicked = this._resolveAnyMove(event.currentTarget.dataset.move);
		if (!clicked) return;

		// Bureaucrat's own quick-roll button (see the-diplomat.js's quickRollsMove) rolls a
		// different move (Exchange Blows) with one specific trait forced, rather than this move's
		// own (nonexistent) roll. Resolved before the weapon-choice flow below so that flow runs
		// against the real target move — Exchange Blows is usesWeapon, Bureaucrat itself never is.
		const move = clicked.quickRollsMove
			? ALL_MOVES.find((m) => m.key === clicked.quickRollsMove.moveKey)
			: clicked;
		if (!move) return;

		// usesWeapon (Exchange Blows, Strike Decisively — see moves.js) offers a choice of weapon
		// (or Unarmed) from inside the merged move-roll dialog itself (see move-dialogs.js's
		// weaponBundles) rather than a separate chooseWeapon prompt beforehand. `weapon` stays
		// undefined for every other move — the same "not applicable" signal _equipmentSpends
		// already reads. For a usesWeapon move, `weapon` is always an array (possibly empty — with
		// no weapons at all, "Unarmed" is still offered inside the dialog, there's just nothing
		// else to choose between) — _rollMove resolves the actual choice once the dialog closes.
		//
		// Only weapons belonging to the currently mounted frame are offered (see docs/domains/frames.md's Piloted
		// note): the Astir's own weapons while it's mounted, one specific Ardent's while that Ardent
		// is mounted, mundane weapons while nothing is — never more than one of the three. A weapon
		// on the wrong side can never become a candidate here, so nothing downstream (including the
		// Familiar +CHANNEL override) needs to re-check mounted state itself.
		let weapon;
		if (move.usesWeapon) {
			const mountedFrameId = this._mountedFrame()?.id ?? null;
			let weapons = this._weapons().filter((w) => this._weaponFrameId(w) === mountedFrameId && !w.disabled);
			// Fire Support (The Captain — see _grantsCarrierWeaponAccess/playbook-moves.js's
			// grantsCarrierWeaponAccess): "using ... the Carrier's weaponry" folds the world's Carrier
			// weapons into this move's own weapon choice, on top of this actor's own. Only offered
			// when exactly one Carrier exists in the world — zero or multiple is left unresolved here
			// (no prompt, no throw), the same simplification _crewFixedTraitValue already makes for
			// CREW's own display value. Each Carrier weapon is shallow-copied with its slot's locked
			// tags pre-merged into `.tags` (carrierWeaponTagKeys — see carrier-actor-sheet.js) and
			// flagged fromCarrier/carrierActorId (never mutating the Carrier's own stored array), so
			// equipment-mixin.js's own weapon-roll methods can resolve full parity for it (narrative
			// tags, spends, forced effects, reroll, Guided) while every write path still routes back
			// to the actual Carrier that owns it, not this actor's own equipment array.
			if (this._grantsCarrierWeaponAccess(move)) {
				const carriers = findCarrierActors();
				if (carriers.length === 1) {
					const carrier = carriers[0];
					const carrierWeaponsByKey = carrier.system.attributes?.weapons ?? {};
					const carrierWeapons = WEAPON_SLOTS
						.map((slot) => ({ slot, entry: carrierWeaponsByKey[slot.key] }))
						.filter(({ entry }) => Boolean(entry))
						.map(({ slot, entry }) => ({
							...entry,
							tags: carrierWeaponTagKeys(slot, entry),
							fromCarrier: true,
							carrierActorId: carrier.id
						}));
					weapons = [...weapons, ...carrierWeapons];
				}
			}
			weapon = weapons;
		}

		await this._rollMove(move, weapon, clicked.quickRollsMove);
	},
	// The weapon's own quick-roll buttons in the Equipment tab (see getData's weaponMoves) — same
	// roll as _onMoveRoll, but the weapon is already known from which button was clicked, so it's
	// passed as a single-element array with Unarmed suppressed (offerUnarmed: false) rather than a
	// choice of candidates — this still flows through weaponBundles/_weaponRollBundle, so the
	// dialog shows the same weapon info card as the Moves tab's own picker, just with no <select>
	// to choose from (see move-roll-dialog.hbs's move-roll-select-group-hidden).
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, equipmentId } = event.currentTarget.dataset;
		const move = ALL_MOVES.find((m) => m.key === moveKey);
		const weapon = this._equipment().find((item) => item.id === equipmentId);
		if (!move || !weapon || weapon.disabled) return;

		await this._rollMove(move, [weapon], {}, { offerUnarmed: false });
	},
	// Every field below is shared between _rollMove's single-weapon path and
	// _rollMoveWithWeaponChoice's array path (weaponBundles), extracted so a test reaching either
	// path exercises the same branches for the other automatically, instead of two independent,
	// textually-identical copies each needing their own dedicated test coverage. `weapon` is
	// always a single, already-resolved weapon/null/undefined here — never an array.
	//
	// A Familiar weapon (astir.js's familiar: true) rolls Exchange Blows/Strike Decisively with
	// +CHANNEL instead of the move's usual CLASH/TALK choice — replaces (not adds to) `traits`,
	// matching the rulebook's "instead," and reads CHANNEL's raw value directly rather than going
	// through availableMoveTraits/_moveTraits, since CHANNEL was never in either move's own traits
	// list to begin with. Never reached while unpiloted — a Familiar is always an Astir weapon,
	// and every caller only ever hands this a weapon matching the current Piloted state (see
	// docs/domains/frames.md's Piloted note) — so there's nothing to re-check here.
	_weaponTraitsFor(move, weapon, traits) {
		if (move.usesWeapon && weapon?.familiar) {
			return [{ key: "channel", label: "CHANNEL", value: this.actor.system.stats?.channel?.value ?? 0 }];
		}
		return traits;
	},
	// bite-the-dust's forcesDesperationAtMaxPerils and weave-magic's forcesDesperationOnShakenTenet
	// sit at the same "reactive/emergency lock" tier -- all three only ever lock to Desperation
	// today, so there's nothing to actually conflict, but the precedence keeps a future second
	// forcesEffect value from silently overriding either actor-state read. Field Scout's standing
	// grantsEffectOnMove (see _grantedEffectForMove) sits next: it's a permanent grant rather than
	// either of the other two's emergency/reactive lock, so anything already forcing an axis wins
	// over it. Everything else that used to feed this function -- a forced weapon tag (Unreliable)
	// and the target-matchup Approach signal -- is now a forced Roll Modifier entry instead (see
	// move-grants-mixin.js's _targetMatchupRollModifier/_forcedWeaponRollModifier/
	// _rollModifiersForMove), masked as a group behind whichever of the two hard locks above
	// applies, but composing freely with each other otherwise (see docs/domains/moves.md).
	// Shared by _lockedEffectFor/_lockedEffectSourceFor below so the branch logic above only lives
	// in one place — returns the effect key alongside a human-readable source label (Field Scout's
	// own move name, or a fixed "Defenseless"/"Shaken Tenet" for the two actor-state locks) for the
	// move-roll dialog's "Locked: <Effect> from <Source>" note.
	_lockedEffectEntryFor(move) {
		if (move.forcesDesperationAtMaxPerils && this._allDangersArePeril()) {
			return { effect: "desperation", source: "Defenseless" };
		}
		if (move.forcesDesperationOnShakenTenet && this._hasShakenTenet()) {
			return { effect: "desperation", source: "Shaken Tenet" };
		}
		const granting = this._grantingMoveForEffect(move);
		return granting ? { effect: granting.grantsEffectOnMove.effect, source: granting.name } : null;
	},
	_lockedEffectFor(move, weapon) {
		return this._lockedEffectEntryFor(move)?.effect ?? null;
	},
	_lockedEffectSourceFor(move) {
		return this._lockedEffectEntryFor(move)?.source ?? null;
	},
	// A quick-roll button's own forced trait (Bureaucrat/The Diplomat, Don't Follow Me/The Impostor
	// -- see quickRollsMove) locks the target move's dialog to that trait. The key is resolved
	// against this roll's own final `traits` list (rather than TRAITS directly) so the locked option
	// carries the same live, bonus-inclusive value every other entry in the dialog does; a key that
	// isn't actually offered here (e.g. the trait is disabled for this actor) resolves to no lock at
	// all.
	_lockedTraitFor(move, quickRoll, traits) {
		return quickRoll.trait ? traits.find((t) => t.key === quickRoll.trait) ?? null : null;
	},
	// Spell Routines' own mounted-part grant — the *source's* own label ("Spell Routines"), only
	// for the one move the player picked on the Astir tab (system.attributes.guidedMoveChoices,
	// keyed by the part's own key — see astir-mixin.js's _onGuidedMoveChoiceChange/
	// _guidedMoveOptions), and only while installed on the currently mounted frame (see
	// docs/domains/frames.md's Piloted note). Spell Routines carries a powerCost, so it can only
	// ever be installed on the Astir, never an Ardent (see ardent.js's ardentParts) — but this
	// reads generically off _mountedParts() rather than special-casing the Astir, the same
	// convention every other reactive part effect in this file follows.
	_guidedFromPartFor(move) {
		return this._mountedParts().find((part) =>
			part.grantsGuided && this.actor.system.attributes?.guidedMoveChoices?.[part.key] === move.key)?.name ?? null;
	},
	// Holds the *source's* own label ("Guided" for the weapon tag, a part's name for Spell
	// Routines) rather than a bare boolean, so the dialog's "Take 7-9" button and the resulting
	// chat message can both name which grant actually offered it instead of always saying "Guided"
	// — see move-dialogs.js's configureMoveRoll and move-roll.js's postGuidedResult.
	_guidedFor(move, weapon) {
		return (this._weaponIsGuided(weapon) && "Guided") || this._guidedFromPartFor(move) || null;
	},
	// Pre-roll preview of the move's passive on-roll bonuses (Roll Modifiers' post-roll reminder
	// quartet — see move-grants-mixin.js's _grantingMoveForFailureReminder/_grantingMoveForSuccessReminder/
	// _grantingMoveForMixedReminder/_grantingMoveForCriticalReminder), reusing those same four
	// finders rather than a new data model, and prefixing each row's label with the granting move's
	// own name so a rider is traceable to what granted it. traitKey is deliberately omitted from the
	// critical-reminder call — the trait isn't chosen until inside the dialog this list previews, so
	// a requiresTrait-gated critical reminder (Sharp Tongue only, today) won't preview pre-roll; it
	// still fires correctly post-roll via _finishMoveRoll's own already-trait-aware call, unaffected.
	// Two catalog combinations get collapsed into a single row when the text matches: mixed+success
	// ("On Any Success") and all four tiers ("All Rolls:"). Both merged rows are labeled from the
	// first tier's own source name (mixed's source for "On Any Success", failure's source for "All
	// Rolls:") since in the current catalog a merge only ever collapses reminders that came from the
	// same single source anyway. Every other combination stays unmerged — add a broader scheme the
	// day a catalog move actually needs one.
	_ridersForMove(move) {
		const failureSource = this._grantingMoveForFailureReminder(move);
		const mixedSource = this._grantingMoveForMixedReminder(move);
		const successSource = this._grantingMoveForSuccessReminder(move);
		const criticalSource = this._grantingMoveForCriticalReminder(move);

		const onFailure = failureSource?.addsFailureReminderToMove.reminder ?? null;
		const onMixed = mixedSource?.addsMixedReminderToMove.reminder ?? null;
		const onSuccess = successSource?.addsSuccessReminderToMove.reminder ?? null;
		const onCritical = criticalSource?.addsCriticalReminderToMove.reminder ?? null;

		// Trickster's Boon (witch.js) has no move of its own — it rides every other move's own roll,
		// so it's appended to whichever of the two shapes below actually returns.
		const boonRiders = resolveWitchBoons(this._witchBoons())
			.filter((boon) => boon.showsRollRiderOnAllRolls)
			.map((boon) => ({ label: boon.name, text: boon.description }));

		if (onFailure && onMixed && onSuccess && onCritical &&
			onFailure === onMixed && onMixed === onSuccess && onSuccess === onCritical) {
			return [{ label: `${failureSource.name} - All Rolls:`, text: onFailure }, ...boonRiders];
		}

		const anySuccess = onMixed && onSuccess && onMixed === onSuccess;

		return [
			...(onFailure ? [{ label: `${failureSource.name} - On 6-`, text: onFailure }] : []),
			...(anySuccess
				? [{ label: `${mixedSource.name} - On Any Success`, text: onMixed }]
				: [
					...(onMixed ? [{ label: `${mixedSource.name} - On 7-9`, text: onMixed }] : []),
					...(onSuccess ? [{ label: `${successSource.name} - On 10+`, text: onSuccess }] : [])
				]),
			...(onCritical ? [{ label: `${criticalSource.name} - On 12+`, text: onCritical }] : []),
			...boonRiders
		];
	},
	// Shared tail of both _rollMove's single-weapon path and _rollMoveWithWeaponChoice's array
	// path, once configureMoveRoll's dialog has resolved -- everything from Guided's "Take 7-9"
	// early return through the final rollMove call and _onMoveResolved. `weapon` is always a
	// single, already-resolved weapon/null/undefined (never an array) -- the single-weapon path
	// passes its own already-known `weapon` parameter, the array path passes chosenWeapon once the
	// weapon-select's own choice resolves. `guided`/`downgrade` are each the same weapon-independent
	// (or, for guided, already-resolved-for-the-chosen-weapon) values the caller already computed
	// before calling configureMoveRoll, threaded through rather than recomputed here.
	async _finishMoveRoll(move, weapon, config, { quickRoll = {}, guided = null, downgrade = [] } = {}) {
		// A weapon "borrowed" from the world's Carrier (Fire Support) lives in a different actor's
		// own equipment array, not this actor's -- so any spend it incurs below has to be written
		// back onto the actual Carrier that owns it, not this actor's own equipment array (see the
		// spend-writing block below).
		const fromCarrier = Boolean(weapon?.fromCarrier);
		// Guided's "Take 7-9" button resolves with nothing but this flag -- no trait, dice, or
		// equipment/Astir Part spend was ever read, so there's nothing to mark spent and nothing
		// left to roll. _onMoveResolved still runs below (Cold Company, Witch's Patron, ...) --
		// there's just no dice to check for Flourish Component's regain-on-doubles.
		if (config.takeSeven) {
			await postGuidedResult(this.actor, move, {
				weaponLabel: weapon ? weapon.name : "Unarmed",
				narrativeTags: this._narrativeWeaponTags(weapon),
				guidedSource: guided
			});
			await this._onMoveResolved(move, null, "mixed");
			return;
		}

		// A forced tag (e.g. Unreliable) is marked spent right alongside whatever the player
		// checked in the dialog -- same single update, same "used this period" checkbox on the
		// Equipment tab (see _equipmentEntry's spendable) as a player-chosen spend.
		const forced = this._forcedWeaponEffect(weapon);
		const spends = [...(config.spentTags ?? []), ...(forced ? [{ equipmentId: weapon.id, tagKey: forced.tagKey }] : [])];
		if (spends.length) {
			if (fromCarrier) {
				const carrier = game.actors.get(weapon.carrierActorId);
				if (carrier) await spendEquipmentTagsOnActor(carrier, spends);
			} else {
				await this._spendEquipmentTags(spends);
			}
		}
		// See configureMoveRoll's own spentRollModifiers doc comment -- every checked
		// [name='roll-modifier'] entry's resource cost is consumed here. A checked entry's own
		// advantage/effect grant was already folded into config.advantage/config.effect by
		// configureMoveRoll's own live chain resolution (see roll-chain.js) before this ever runs --
		// this call is purely the resource-spend side.
		if (config.spentRollModifiers?.length) await this._spendRollModifiers(config.spentRollModifiers);
		// Spends 1 Crew Support hold only when this roll actually used the Crew Support CREW
		// substitution (see move-traits-mixin.js's _moveTraits) -- not when a move's own permanent
		// CREW fixedTraits (Lead a Sortie) was used instead, since that has a different trait key
		// (crew) and costs nothing. A Captain rolling the same crew-support-crew option spends
		// nothing either -- In Command grants it to them for free, any number of times (see
		// moves-mixin.js's _hasUnlimitedCrewSupport).
		if (config.trait?.key === "crew-support-crew" && !this._hasUnlimitedCrewSupport()) {
			await this.actor.update(this._crewSupportHoldSpend());
		}

		// weapon undefined (not a usesWeapon move) leaves rollMove's options untouched, same as
		// today, for every move except Exchange Blows/Strike Decisively. null (Unarmed) or a real
		// weapon entry both add a weaponLabel (and that weapon's narrative tags, if any — see
		// _narrativeWeaponTags), recorded on the chat card even when nothing was spent (see rollMove
		// in moves.js). reroll is only ever attached for a usesWeapon move too — rollMove itself
		// decides whether to actually offer it, based on whether this attempt fails (see moves.js).
		const reroll = this._availableReroll(move, weapon);
		// The derived Trait bonus for whichever trait the player actually chose (see
		// trait-bonuses.js) — moves.js#rollMove re-reads an actor trait's live stat value directly
		// rather than trusting config.trait.value (see its own comment), so the bonus has to reach
		// it as an explicit option instead. 0 for a fixedTrait (CREW) or an actor with no
		// traitBonus moves picked, same as every other actor with nothing to contribute here.
		const traitBonus = config.trait ? this._traitBonuses()[config.trait.key] ?? 0 : 0;
		// See _availableAutomaticSuccess — unlike reroll, this isn't scoped to a usesWeapon move, so
		// it's folded into baseOptions rather than the weapon-only branch below.
		const automaticSuccess = this._availableAutomaticSuccess(move);
		// Walk-on Part In The War's overheating reminder (see _grantedFailureReminderForMove) — only
		// ever shown by moves.js#rollMove on an actual 6-, so it's harmless to always pass through.
		const extraFailureReminder = this._grantedFailureReminderForMove(move);
		// Coordinator's own reminder (see _grantedSuccessReminderForMove) — same pass-through shape
		// as extraFailureReminder immediately above, just surfaced on a 10+ instead of a 6-.
		const extraSuccessReminder = this._grantedSuccessReminderForMove(move);
		// Patch Job's own reminder (see _grantedMixedReminderForMove) — the 7-9 mirror of
		// extraSuccessReminder immediately above.
		const extraMixedReminder = this._grantedMixedReminderForMove(move);
		// Indomitable/Truth-making/A Greener World/Sharp Tongue's own reminder (see
		// _grantedCriticalReminderForMove) — the 12+ mirror of extraSuccessReminder immediately
		// above, resolved against whichever trait this roll actually used (Sharp Tongue's own
		// requiresTrait gate) rather than the move being rolled alone.
		const extraCriticalReminder = this._grantedCriticalReminderForMove(move, config.trait?.key);
		// Human Resources' extra Read the Room questions (see _grantedQuestionsForMove) — arrives
		// pre-resolved via options, exactly like weaponLabel already does, so moves.js never needs to
		// import playbook-moves.js (see claude.md's import-direction note).
		const extraQuestions = this._grantedQuestionsForMove(move);
		const baseOptions = {
			...config,
			...(traitBonus && { traitBonus }),
			...(automaticSuccess.length && { automaticSuccess }),
			...(downgrade.length && { downgrade }),
			...(extraFailureReminder && { extraFailureReminder }),
			...(extraSuccessReminder && { extraSuccessReminder }),
			...(extraMixedReminder && { extraMixedReminder }),
			...(extraCriticalReminder && { extraCriticalReminder }),
			...(extraQuestions && { extraQuestions }),
			// Bureaucrat's own always-applicable reminders (see quickRollsMove/move-roll.js's
			// options.extraReminders) — unlike the extra*Reminder trio above, unconditional across
			// every tier, since the source move's own text says "even on a fail".
			...(quickRoll.reminders && { extraReminders: quickRoll.reminders }),
			// Number Of The Beast (see playbook-moves.js) — applies to every roll this actor makes,
			// not just one move key, so this is folded in unconditionally rather than gated on `move`.
			...(this._hasExplodingSixes() && { explodeOnSix: true }),
			// See _availableHeatUp — unlike reroll, this isn't scoped to a usesWeapon move, so it's
			// folded in unconditionally here too, same as automaticSuccess above.
			heatUp: this._availableHeatUp()
		};
		const options = weapon !== undefined
			? {
				...baseOptions,
				weaponLabel: weapon ? weapon.name : "Unarmed",
				narrativeTags: this._narrativeWeaponTags(weapon),
				...(reroll && { reroll })
			}
			: baseOptions;
		const result = await rollMove(this.actor, move, config.trait, options);
		// The Adrift's own Gravity Trigger: "whenever you use your +HOME clock, advance it." Not
		// applied on the Guided "Take 7-9" early-return path above — no trait was actually rolled
		// there, so nothing to advance.
		if (config.trait?.key === "home") await this._advanceHome();
		// Eidolon Drive's one-time +3 (Summoner) flips to the ongoing +1 the moment the player
		// actually rolls with the summoned ally's trait — mirrors the +HOME hook immediately above.
		// Only fires once per summon: _consumeEidolonDriveBonus itself no-ops once bonusUsed is
		// already true, the same defensive shape _advanceHome's own clamp gives +HOME.
		if (config.trait?.key === "eidolon-drive-ally") await this._consumeEidolonDriveBonus();
		await this._onMoveResolved(move, result.dice, result.tier);
	},
	// Computes one candidate weapon's (or null, "Unarmed") full contribution to the merged
	// weapon-choice + move-roll dialog (see move-dialogs.js's weaponBundles) -- every field reuses
	// the same shared precedence-chain helpers _rollMove's single-weapon path calls, just resolved
	// once per candidate instead of once for an already-chosen weapon.
	_weaponRollBundle(move, weapon, { traits, quickRoll }) {
		const bundleTraits = this._weaponTraitsFor(move, weapon, traits);
		const lockedEffect = this._lockedEffectFor(move, weapon);
		const lockedEffectSource = this._lockedEffectSourceFor(move);
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const narrativeTags = this._narrativeWeaponTags(weapon);
		const guided = this._guidedFor(move, weapon);
		const rerollTag = this._availableRerollTag(move, weapon);
		const rollModifiers = this._rollModifiersForMove(move, lockedEffect, weapon, quickRoll);
		return {
			weaponKey: weapon ? weapon.id : UNARMED,
			weaponLabel: weapon ? weapon.name : "Unarmed",
			// Reuses _equipmentEntry's own shape/logic (equipment-mixin.js) so this read-only card
			// renders identically to the Equipment tab's own weapon card -- the mounted frame (if
			// any) supplies Tier for an Astir/Ardent-owned candidate, ignored for a mundane one
			// (see _equipmentEntry's own tier branch).
			weaponCard: weapon ? this._equipmentEntry(weapon, [], this._mountedFrame()) : null,
			traits: bundleTraits,
			traitOptions: bundleTraits.map((trait) => ({ key: trait.key, label: `${trait.label} (${trait.value})` })),
			lockedEffect,
			lockedEffectSource,
			equipmentSpends,
			narrativeTags,
			guided,
			rerollTag,
			rollModifiers
		};
	},
	// The array-branch counterpart to the single-weapon _rollMove path below -- reached whenever
	// `weapon` is an array of candidates: _onMoveRoll's usesWeapon branch (a full choice, possibly
	// with no weapons at all -- "Unarmed" is still always offered), or _onWeaponMoveRoll's own
	// single-known-weapon call with offerUnarmed: false (no Unarmed entry, nothing to choose
	// between). `traits` here is already the
	// weapon-independent base list (see _rollMove's own dispatch) -- the per-candidate Familiar
	// +CHANNEL swap happens inside _weaponRollBundle instead, since which candidate is Familiar
	// varies per bundle.
	async _rollMoveWithWeaponChoice(move, weapons, traits, quickRoll, { offerUnarmed = true } = {}) {
		const lockedTrait = this._lockedTraitFor(move, quickRoll, traits);
		// downgrade (see _availableDowngrade) is resolved unconditionally, but only ever offered on
		// the chat card after a 10+ (see moves.js#rollMove), so it's folded into baseOptions the
		// same conditional-spread way automaticSuccess already is.
		const downgrade = this._availableDowngrade(move);
		// Riders (see _ridersForMove) -- none of the three resolvers it calls take a weapon, so this
		// is computed once here rather than per weaponBundles entry, and passed at the top level of
		// configureMoveRoll below rather than folded into _weaponRollBundle.
		const riders = this._ridersForMove(move);

		// "Unarmed" first (see docs/domains/equipment.md's chooseWeapon precedent this replaces) --
		// unless offerUnarmed is false (_onWeaponMoveRoll's already-known single weapon), which
		// omits it since there's nothing to choose between.
		const weaponBundles = (offerUnarmed ? [null, ...weapons] : weapons).map((candidate) =>
			this._weaponRollBundle(move, candidate, { traits, quickRoll }));

		const config = await configureMoveRoll(move, traits, {
			lockedTrait,
			riders,
			weaponBundles,
			gravityClocks: this._availableGravityClocks()
		});
		if (!config) return;

		const chosenWeapon = config.weaponId === UNARMED ? null : weapons.find((w) => w.id === config.weaponId) ?? null;
		// Always resolves: chosenWeapon is either null (Unarmed, always the first bundle) or a real
		// entry drawn from `weapons`, and every entry in `weapons` has its own bundle above.
		const bundle = weaponBundles.find((b) => b.weaponKey === (chosenWeapon ? chosenWeapon.id : UNARMED));

		await this._finishMoveRoll(move, chosenWeapon, config, {
			quickRoll, guided: bundle.guided, downgrade
		});
	},
	// Shared by _onMoveRoll (weapon resolved via the merged dialog's own weapon-select, or left
	// undefined for a move that isn't usesWeapon) and _onWeaponMoveRoll (weapon already known from
	// the clicked button, passed as a single-element array with offerUnarmed: false). `weapon` is
	// an array of candidates for either of those usesWeapon callers -- every other caller still
	// passes a single resolved weapon/null/undefined, exactly as before, and that path (below) is
	// completely unchanged.
	async _rollMove(move, weapon, quickRoll = {}, { offerUnarmed = true } = {}) {
		let traits = this._moveTraits(move);
		// _moveTraits already resolved CREW for the single/zero-Carrier case; with more than one
		// Carrier in the world that's ambiguous, so ask which one before locking in the value this
		// roll actually uses. Cancelling aborts the whole roll, same convention the old chooseWeapon
		// prompt's own cancel already had.
		if (move.fixedTraits?.some((trait) => trait.key === "crew")) {
			const carriers = findCarrierActors();
			if (carriers.length > 1) {
				const carrierId = await chooseCarrier(carriers);
				if (!carrierId) return;
				const crewValue = carriers.find((c) => c.id === carrierId)?.system.stats?.crew?.value ?? 0;
				traits = traits.map((trait) => (trait.key === "crew" ? { ...trait, value: crewValue } : trait));
			}
		}

		// _onMoveRoll's usesWeapon branch (see its own comment) -- everything from here through the
		// end of this function is the single-weapon path, untouched by weaponBundles at all.
		if (Array.isArray(weapon)) {
			if (!traits.length && !move.conditions) return;
			return this._rollMoveWithWeaponChoice(move, weapon, traits, quickRoll, { offerUnarmed });
		}

		traits = this._weaponTraitsFor(move, weapon, traits);
		if (!traits.length && !move.conditions) return;

		const lockedEffect = this._lockedEffectFor(move, weapon);
		const lockedEffectSource = this._lockedEffectSourceFor(move);
		const lockedTrait = this._lockedTraitFor(move, quickRoll, traits);
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const narrativeTags = this._narrativeWeaponTags(weapon);
		const guided = this._guidedFor(move, weapon);
		const rerollTag = this._availableRerollTag(move, weapon);
		// The Roll Modifiers section (see move-grants-mixin.js's _rollModifiersForMove) -- resolved
		// unconditionally, like automaticSuccess below, rather than scoped to fromCarrier/usesWeapon:
		// a source's own moveKeys filtering already narrows each entry to the moves it actually
		// applies to, so there's nothing frame- or weapon-specific to additionally gate here.
		const rollModifiers = this._rollModifiersForMove(move, lockedEffect, weapon, quickRoll);
		// downgrade (see _availableDowngrade) is resolved unconditionally, but only ever offered on
		// the chat card after a 10+ (see moves.js#rollMove), so it's folded into baseOptions below
		// the same conditional-spread way automaticSuccess already is.
		const downgrade = this._availableDowngrade(move);
		const riders = this._ridersForMove(move);
		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
			lockedEffectSource,
			lockedTrait,
			equipmentSpends,
			narrativeTags,
			rollModifiers,
			riders,
			gravityClocks: this._availableGravityClocks(),
			...(guided && { guided }),
			...(rerollTag && { rerollTag })
		});
		if (!config) return;

		await this._finishMoveRoll(move, weapon, config, { quickRoll, guided, downgrade });
	},
	// Runs after a move resolves — whether via a real roll (dice present) or Guided's "Take 7-9"
	// (dice null). The Witch's Patron ("offers you two boons at random whenever someone leads a
	// Sortie") is checked first and unconditionally, before the mounted-frame early-return below —
	// unlike doubles-regen (an Astir Part effect, gated on the Astir specifically being mounted),
	// Patron is a base playbook feature that doesn't care whether — or which — frame is mounted.
	async _onMoveResolved(move, dice, tier) {
		if (move.key === "lead-a-sortie"
				&& resolvePlaybookMoves(this._playbookMoves()).some((m) => m.key === "the-witch:patron")) {
			await this._grantRandomWitchBoons();
		}
		// Trickster's Boon (witch.js) — "whenever you roll doubles, something helpful but unexpected
		// happens" applies to every move this actor rolls, not just an Astir Part's own
		// regainPowerOnDoubles effect below, so it's checked here unconditionally like Patron above.
		if (dice && rolledDoubles(dice)) {
			for (const boon of resolveWitchBoons(this._witchBoons()).filter((b) => b.activatesOnDoubles)) {
				await ChatMessage.create({
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: `<p><strong>${boon.name}</strong> activates — ${boon.description}</p>`
				});
			}
		}
		// Cold Company (see _coldCompanyMove/_coldCompanyAdvantage) — flips the haunted/dispelled
		// state based on THIS roll's own outcome tier, for every move this actor rolls. A 7-9 is a
		// no-op either way (Cold Company's own text only reacts to 10+/6-); already-dispelled staying
		// dispelled on another 10+, or already-haunted staying haunted on another 6-, are also no-ops
		// — the checkbox only ever flips, never redundantly re-writes the same value. Checked ahead of
		// the mounted-frame early-return below for the same reason the Patron check above is: this is
		// a base playbook feature, not an Astir Part effect, so it must not be skipped when unpiloted.
		const coldCompany = this._coldCompanyMove();
		if (coldCompany) {
			const { useKey } = coldCompany.grantsHauntedStandingRoll;
			const dispelled = Boolean(this.actor.system.attributes?.moveUses?.[coldCompany.key]?.[useKey]);
			if (tier === "success" && !dispelled) {
				await this.actor.update({ [`system.attributes.moveUses.${coldCompany.key}.${useKey}`]: true });
			} else if (tier === "failure" && dispelled) {
				await this.actor.update({ [`system.attributes.moveUses.${coldCompany.key}.${useKey}`]: false });
			}
		}
		// Flourish Component's regain-Power-on-doubles reacts to a move's outcome rather than being
		// offered as part of setting it up, and is scoped to the mounted frame's own parts (see
		// docs/domains/frames.md's Piloted note): a part contributes nothing when no frame is
		// currently mounted. regainPowerOnDoubles carries a powerCost, so — like grantsGuided above —
		// it can never be installed on an Ardent; this still reads generically off _mountedParts()
		// rather than special-casing the Astir.
		if (!this._mountedFrame()) return;
		const parts = this._mountedParts();
		if (dice && parts.some((part) => part.regainPowerOnDoubles) && rolledDoubles(dice)) {
			await this._regainAstirPower(1);
		}
	},
	// Stands in for a roll on moves with a flat hold grant (B-Plot, or a flatHold Soldier Move) —
	// there's no dice to roll, so clicking Activate just adds the move's flatHold to its own
	// (separately-tracked, per-move-key) pool, the same field _onFlatHoldStep writes to, clamped
	// the same way. Divination Codex's showsReadTheRoomQuestions gets a different Activate
	// behavior — no hold to grant, just Read the Room's real question list posted to chat — but
	// shares the same button per _moveGroupMoves' `activatable`. Either way, Activate also posts
	// the move's own description to chat, the same as the Description button (postMoveDescription)
	// — unlike that button, this fires even when the mechanical effect itself is a no-op (e.g.
	// hold already at HOLD_MAX), since the player still asked to see the move's text.
	async _onMoveActivate(event) {
		const move = this._resolveAnyMove(event.currentTarget.dataset.move);
		if (!move) return;

		if (move.flatHold) {
			const current = this.actor.system.attributes?.moveHold?.[move.key]?.value ?? 0;
			const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + move.flatHold));
			if (next !== current) {
				await this.actor.update({ [`system.attributes.moveHold.${move.key}.value`]: next });
			}
			await postMoveDescription(this.actor, move);
			return;
		}

		if (move.showsReadTheRoomQuestions) {
			// BASIC_MOVES is fixed, hardcoded content that always includes read-the-room — no
			// fallback needed for a lookup that can't fail.
			const readTheRoom = BASIC_MOVES.find((m) => m.key === "read-the-room");
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: `<h3>${move.name}</h3>`,
				content: `<ul>${readTheRoom.questions.map((question) => `<li>${question}</li>`).join("")}</ul>`
			});
			await this.actor.update({ [`system.attributes.moveUses.${move.key}.expended`]: true });
			await postMoveDescription(this.actor, move);
			return;
		}

		// A roll-less "choose N" menu (Facilitator's clandestine meeting, Bureaucrat, Shree Klime —
		// see playbook-moves.js's activateChoices). Same post-a-list-to-chat shape as
		// showsReadTheRoomQuestions above, but carrying the move's own prompt and options rather
		// than borrowing Read the Room's questions, and with no moveUses write: none of these moves
		// is capped per period, so there's nothing to expend.
		if (move.activateChoices) {
			const { prompt, options } = move.activateChoices;
			await ChatMessage.create({
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				flavor: `<h3>${move.name}</h3>`,
				content: `<p>${prompt}</p><ul>${options.map((option) => `<li>${option}</li>`).join("")}</ul>`
			});
			await postMoveDescription(this.actor, move);
			return;
		}

		// Enduring Support (Summoner — see playbook-moves.js's activatesApproachOverride). Snapshots
		// the currently-summoned ally's own Approach into its own persisted field rather than storing
		// a live reference, since the summon itself can clear on Refresh Scene while this effect
		// persists through Refresh Sortie (see frames-mixin.js) — a stale reference would silently
		// lose the override the moment the Scene ends. No-ops (same defensive stance _summonedAlly()
		// itself already takes) if nothing is summoned or the summoned ally has no Approach set.
		if (move.activatesApproachOverride) {
			const summoned = this._summonedAlly();
			if (!summoned?.approach) return;
			await this.actor.update({ "system.attributes.approachOverride": { approach: summoned.approach } });
			await postMoveDescription(this.actor, move);
			return;
		}

		// Chromatic Focus/Chromatic Reserves (astir-parts.js/ardent.js's promptsApproachOverride),
		// and the Arcanist's Aspect ritual (arcanist-mixin.js's _preparedRitualMoves). No-ops with
		// nothing left to spend — a `uses` checkbox (Chromatic Focus, the Aspect ritual) or a
		// numericTrackers countdown at 0 (Chromatic Reserves), same as move.activatesApproachOverride's
		// own "nothing to snapshot" guard above — so a fully-spent source never even opens the dialog.
		// Cancelling the dialog also no-ops entirely — no actor.update call at all, unlike a real
		// pick, which writes the override and the spend in one update so the two can never land out
		// of sync. moves-mixin.js's _promptsApproachOverrideAvailable/_promptsApproachOverrideSpend
		// resolve both storage shapes generically, so this branch doesn't need to know which one it's
		// got. `promptsApproachOverride` is either bare `true` (Chromatic Focus/Reserves, Scene-
		// scoped) or `{period}` (the Aspect ritual, Sortie-scoped) — the written approachOverride
		// object only ever carries a `period` key when it's "Scene", exactly matching Enduring
		// Support's own Sortie-scoped shape (no `period` key at all) and _onRefreshSortie's
		// unconditional clear.
		if (move.promptsApproachOverride) {
			if (!this._promptsApproachOverrideAvailable(move)) return;
			// No `?? "Scene"` fallback on the object form's own `.period` -- every real catalog entry
			// that passes `{period}` (the Aspect ritual, below) always sets it; add the fallback back
			// only once a real grant actually needs it (see move-grants-mixin.js's own precedent for
			// this same "don't carry a branch the 100%-coverage gate can never legitimately exercise"
			// stance).
			const period = move.promptsApproachOverride === true ? "Scene" : move.promptsApproachOverride.period;
			const chosen = await chooseApproachOverride(this.actor.system.attributes?.approach ?? "", period);
			if (!chosen) return;
			await this.actor.update({
				"system.attributes.approachOverride": { approach: chosen, ...(period === "Scene" && { period }) },
				...this._promptsApproachOverrideSpend(move)
			});
			await postMoveDescription(this.actor, move);
		}
	},
	// Plan & Prepare's own roll button (see SPECIAL_MOVES' variableDicePool / moves.js's
	// configureVariableDiceRoll/rollVariableDicePool) — a wholly separate pipeline from
	// _onMoveRoll/_rollMove: no trait, no dialog-driven Effect/Advantage, no chooseWeapon.
	async _onVariableDiceRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		const config = await configureVariableDiceRoll(move);
		if (!config) return;

		await rollVariableDicePool(this.actor, move, config);
	},
	async _onMoveDescription(event) {
		const move = this._resolveAnyMove(event.currentTarget.dataset.move);
		if (!move) return;

		await postMoveDescription(this.actor, move);
	},
	async _onMoveInfo(event) {
		const move = this._resolveAnyMove(event.currentTarget.dataset.move);
		if (!move) return;

		await showMoveDescription(move);
	}
};
