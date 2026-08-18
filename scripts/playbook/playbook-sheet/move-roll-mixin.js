import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { chooseApproachOverride } from "../../core/approaches.js";
import { chooseCarrier, findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";
import { UNARMED } from "../../equipment/equipment.js";
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

// The Roll/Activate/Description/Info button handlers and the shared _rollMove pipeline every move
// source (basic, special, playbook, Astir) runs through — see moves-mixin.js's file comment for how
// this file relates to its siblings in this directory.
export const MoveRollSheetMixin = {
	async _onMoveRoll(event) {
		const clicked = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
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
			// CREW's own display value. Each Carrier weapon is shallow-copied and flagged fromCarrier
			// (never mutating the Carrier's own stored array) so _rollMove can skip every write path
			// that would otherwise try to record spend/tag/uses state onto an object living in a
			// different actor's own equipment array — see that flag's own comment there.
			if (this._grantsCarrierWeaponAccess(move)) {
				const carriers = findCarrierActors();
				if (carriers.length === 1) {
					const carrierWeapons = Object.values(carriers[0].system.attributes?.weapons ?? {})
						.filter(Boolean)
						.map((w) => ({ ...w, fromCarrier: true }));
					weapons = [...weapons, ...carrierWeapons];
				}
			}
			weapon = weapons;
		}

		await this._rollMove(move, weapon, clicked.quickRollsMove);
	},
	// The weapon's own quick-roll buttons in the Equipment tab (see getData's weaponMoves) — same
	// roll as _onMoveRoll, but the weapon is already known from which button was clicked, so
	// there's no chooseWeapon prompt.
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, equipmentId } = event.currentTarget.dataset;
		const move = ALL_MOVES.find((m) => m.key === moveKey);
		const weapon = this._equipment().find((item) => item.id === equipmentId);
		if (!move || !weapon || weapon.disabled) return;

		await this._rollMove(move, weapon);
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
	// sit at the same "reactive/emergency lock" tier, ahead of a forced weapon tag — all three only
	// ever lock to Desperation today, so there's nothing to actually conflict, but the precedence
	// keeps a future second forcesEffect value from silently overriding either actor-state read.
	// Field Scout's standing grantsEffectOnMove (see _grantedEffectForMove) sits next: it's a
	// permanent grant rather than any of the other three's emergency/reactive lock, so anything
	// already forcing an axis wins over it. The target-matchup Approach signal (_targetMatchupEffect
	// — see its own comment; Tier's own signal feeds the Advantage axis instead, independently, via
	// _lockedAdvantageFor below) sits lowest of all: it's a passive read of the current target, so
	// any of the above five sources — each a more specific or more deliberate lock — wins over it.
	// A weapon "borrowed" from the world's Carrier (Fire Support — see _onMoveRoll's
	// grantsCarrierWeaponAccess handling) lives in a different actor's own equipment array, not
	// this actor's, so its own forcesEffect tag (if any) never applies — mirrors
	// CarrierActorSheet#_onWeaponMoveRoll's own scope cut for the Carrier's own weapon rolls.
	_lockedEffectFor(move, weapon, pendingGrant) {
		const forced = weapon?.fromCarrier ? null : this._forcedWeaponEffect(weapon);
		return (move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null)
			?? (move.forcesDesperationOnShakenTenet && this._hasShakenTenet() ? "desperation" : null)
			?? forced?.effect
			?? this._grantedEffectForMove(move)
			?? pendingGrant?.effect
			?? this._targetMatchupEffect(move)
			?? null;
	},
	// Don't Follow Me's own pair — see _grantedTraitForMove/_lockedAdvantageFor. The granted trait
	// key is resolved against this roll's own final `traits` list (rather than TRAITS directly) so
	// the locked option carries the same live, bonus-inclusive value every other entry in the
	// dialog does; a key that isn't actually offered here (e.g. the trait is disabled for this
	// actor) resolves to no lock at all. An explicit forced trait from a quick-roll button
	// (Bureaucrat — see quickRollsMove) wins over any standing grantsTraitOnMove lock (Don't Follow
	// Me): it's the more specific, immediate signal from the actual button clicked, not a passive
	// standing grant.
	_lockedTraitFor(move, quickRoll, traits) {
		const grantedTraitKey = quickRoll.trait ?? this._grantedTraitForMove(move);
		return grantedTraitKey ? traits.find((t) => t.key === grantedTraitKey) ?? null : null;
	},
	// Don't Follow Me's single-target-move grant wins if it and Cold Company's standing haunted-
	// state lock somehow both apply -- in practice these two moves live on mutually exclusive
	// playbooks (Impostor / Wither), so this ordering is a defensive tie-break, not an expected
	// real-world collision. pendingGrant's own Advantage half slots in below Cold Company but above
	// the passive target-matchup Tier signal (_targetTierAdvantage -- its Approach sibling,
	// _targetMatchupEffect, feeds _lockedEffectFor above instead, independently, since the two axes
	// no longer sum into one combined stack), matching the same "more specific/deliberate lock
	// wins" ordering pendingGrant's Effect half already follows above. A checked Roll Modifier's
	// own advantage (Artifact included, an ordinary grantsRollModifier source) still wins over all
	// of this, per configureMoveRoll's own precedence.
	_lockedAdvantageFor(move, pendingGrant) {
		return this._grantedAdvantageForMove(move)
			?? this._coldCompanyAdvantage()
			?? pendingGrant?.advantage
			?? this._targetTierAdvantage(move);
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
	// — see move-dialogs.js's configureMoveRoll and move-roll.js's postGuidedResult. A weapon
	// "borrowed" from the world's Carrier (fromCarrier) never offers its own Guided tag, same scope
	// cut as _lockedEffectFor's own forced-tag read.
	_guidedFor(move, weapon) {
		const fromCarrier = Boolean(weapon?.fromCarrier);
		return (!fromCarrier && this._weaponIsGuided(weapon) && "Guided") || this._guidedFromPartFor(move) || null;
	},
	// Shared tail of both _rollMove's single-weapon path and _rollMoveWithWeaponChoice's array
	// path, once configureMoveRoll's dialog has resolved — everything from Guided's "Take 7-9"
	// early return through the final rollMove call and _onMoveResolved. `weapon` is always a
	// single, already-resolved weapon/null/undefined (never an array) — the single-weapon path
	// passes its own already-known `weapon` parameter, the array path passes chosenWeapon once the
	// weapon-select's own choice resolves. `guided`/`disadvantageConversion`/`downgrade` are each
	// the same weapon-independent (or, for guided, already-resolved-for-the-chosen-weapon) values
	// the caller already computed before calling configureMoveRoll, threaded through rather than
	// recomputed here.
	async _finishMoveRoll(move, weapon, config, { quickRoll = {}, guided = null, disadvantageConversion = null, downgrade = [] } = {}) {
		// Guided's "Take 7-9" button resolves with nothing but this flag — no trait, dice, or
		// equipment/Astir Part spend was ever read, so there's nothing to mark spent and nothing
		// left to roll. _onMoveResolved still runs below (Cold Company, Witch's Patron, ...) —
		// there's just no dice to check for Flourish Component's regain-on-doubles.
		if (config.takeSeven) {
			await postGuidedResult(this.actor, move, {
				weaponLabel: weapon ? weapon.name : "Unarmed",
				weaponTags: this._weaponTagLabels(weapon),
				guidedSource: guided
			});
			await this._onMoveResolved(move, null, "mixed");
			return;
		}

		// A weapon "borrowed" from the world's Carrier (Fire Support) lives in a different actor's
		// own equipment array, not this actor's — so none of the spend/tag/reroll machinery below,
		// which all read or write this actor's own equipment/Astir Part state, may ever be
		// evaluated against it. Mirrors CarrierActorSheet#_onWeaponMoveRoll's own scope cut for the
		// Carrier's own weapon rolls: that handler never offers equipment spends, Astir Part
		// spends, reroll or Guided either — a Carrier weapon roll is deliberately just a trait plus
		// a name on the chat card, nothing more, and a Fire Support roll using one gets exactly the
		// same treatment rather than risking a write onto an object this actor doesn't own.
		const fromCarrier = Boolean(weapon?.fromCarrier);
		// A forced tag (e.g. Unreliable) is marked spent right alongside whatever the player
		// checked in the dialog — same single update, same "used this period" checkbox on the
		// Equipment tab (see _equipmentEntry's spendable) as a player-chosen spend.
		const forced = fromCarrier ? null : this._forcedWeaponEffect(weapon);
		const spends = [...(config.spentTags ?? []), ...(forced ? [{ equipmentId: weapon.id, tagKey: forced.tagKey }] : [])];
		if (spends.length) await this._spendEquipmentTags(spends);
		// See configureMoveRoll's own spentRollModifiers doc comment -- covers both immediate
		// (checked [name='roll-modifier']) and deferred (checked [name='pending-roll-modifier'])
		// entries alike, since both need their resource cost actually consumed; only the deferred
		// ones additionally write a pendingRollModifiers marker (see _spendRollModifiers itself).
		if (config.spentRollModifiers?.length) await this._spendRollModifiers(config.spentRollModifiers);
		// Embrace Chaos's own hold spend (see _disadvantageConversionModifier/
		// _spendDisadvantageConversion) -- resolved via configureMoveRoll's own
		// spentDisadvantageConversion flag rather than a checked-keys list, since only one such
		// source is ever offered per roll (mirrors rollStack's own single-source shape, unlike the
		// list-shaped spentRollModifiers immediately above).
		if (config.spentDisadvantageConversion) {
			await this._spendDisadvantageConversion(disadvantageConversion.key, disadvantageConversion.costsHold.amount);
		}

		// weapon undefined (not a usesWeapon move) leaves rollMove's options untouched, same as
		// today, for every move except Exchange Blows/Strike Decisively. null (Unarmed) or a real
		// weapon entry both add a weaponLabel (and that weapon's tags, if any — see
		// _weaponTagLabels), recorded on the chat card even when nothing was spent (see rollMove in
		// moves.js). reroll is only ever attached for a usesWeapon move too — rollMove itself
		// decides whether to actually offer it, based on whether this attempt fails (see moves.js).
		const reroll = fromCarrier ? null : this._availableReroll(move, weapon);
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
				weaponTags: this._weaponTagLabels(weapon),
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
	// weapon-choice + move-roll dialog (see move-dialogs.js's weaponBundles) — every field reuses
	// the same shared precedence-chain helpers _rollMove's single-weapon path calls, just resolved
	// once per candidate instead of once for an already-chosen weapon. `pendingGrant` is the one
	// piece _rollMoveWithWeaponChoice below computes once and threads through rather than
	// recomputing per candidate, since it's a read-then-cleared roll-scoped value, not a
	// per-weapon one.
	_weaponRollBundle(move, weapon, { traits, pendingGrant }) {
		const bundleTraits = this._weaponTraitsFor(move, weapon, traits);
		const lockedEffect = this._lockedEffectFor(move, weapon, pendingGrant);
		const fromCarrier = Boolean(weapon?.fromCarrier);
		const equipmentSpends = fromCarrier ? [] : this._equipmentSpends(lockedEffect, weapon);
		const guided = this._guidedFor(move, weapon);
		const rollModifiers = this._rollModifiersForMove(move, lockedEffect);
		return {
			weaponKey: weapon ? weapon.id : UNARMED,
			weaponLabel: weapon ? weapon.name : "Unarmed",
			// Reuses _equipmentEntry's own shape/logic (equipment-mixin.js) so this read-only card
			// renders identically to the Equipment tab's own weapon card — the mounted frame (if
			// any) supplies Tier for an Astir/Ardent-owned candidate, ignored for a mundane one
			// (see _equipmentEntry's own tier branch).
			weaponCard: weapon ? this._equipmentEntry(weapon, [], this._mountedFrame()) : null,
			traits: bundleTraits,
			traitOptions: bundleTraits.map((trait) => ({ key: trait.key, label: `${trait.label} (${trait.value})` })),
			lockedEffect,
			equipmentSpends,
			guided,
			rollModifiers
		};
	},
	// The array-branch counterpart to the single-weapon _rollMove path below — reached only when
	// _onMoveRoll resolved `weapon` to an array of candidates (a usesWeapon move, possibly with no
	// weapons at all — "Unarmed" is still always offered). `traits` here is already the
	// weapon-independent base list (see _rollMove's own dispatch) — the per-candidate Familiar
	// +CHANNEL swap happens inside _weaponRollBundle instead, since which candidate is Familiar
	// varies per bundle.
	async _rollMoveWithWeaponChoice(move, weapons, traits, quickRoll) {
		const pendingGrant = this._pendingRollModifierGrant(move);
		const lockedTrait = this._lockedTraitFor(move, quickRoll, traits);
		const lockedAdvantage = this._lockedAdvantageFor(move, pendingGrant);
		const rollStack = this._rollStackModifier();
		// Embrace Chaos's own two hold spends -- disadvantageConversion (see
		// _disadvantageConversionModifier) is resolved unconditionally, like rollStack above, since
		// it's a Category D mechanism the dialog itself renders live-reactively; downgrade (see
		// _availableDowngrade) is resolved unconditionally too, but only ever offered on the chat
		// card after a 10+ (see moves.js#rollMove), so it's folded into baseOptions the same
		// conditional-spread way automaticSuccess already is.
		const disadvantageConversion = this._disadvantageConversionModifier();
		const downgrade = this._availableDowngrade(move);

		// "Unarmed" first (see docs/domains/equipment.md's chooseWeapon precedent this replaces).
		const weaponBundles = [null, ...weapons].map((candidate) =>
			this._weaponRollBundle(move, candidate, { traits, pendingGrant }));

		const config = await configureMoveRoll(move, traits, {
			lockedAdvantage,
			lockedTrait,
			rollStack,
			disadvantageConversion,
			weaponBundles
		});
		if (!config) return;

		// The one-shot deferred grant (see pendingGrant above) is cleared the moment this roll's own
		// config resolves -- read-then-cleared before the roll itself, so checking a deferred
		// entry's box *inside* this same dialog never grants it to this roll, only the next one
		// (see move-grants-mixin.js's _pendingRollModifierGrant doc comment for the known UX quirk
		// this implies).
		if (pendingGrant) await this._clearPendingRollModifier(pendingGrant.sourceKey, pendingGrant.specKey);

		const chosenWeapon = config.weaponId === UNARMED ? null : weapons.find((w) => w.id === config.weaponId) ?? null;
		// Always resolves: chosenWeapon is either null (Unarmed, always the first bundle) or a real
		// entry drawn from `weapons`, and every entry in `weapons` has its own bundle above.
		const bundle = weaponBundles.find((b) => b.weaponKey === (chosenWeapon ? chosenWeapon.id : UNARMED));

		await this._finishMoveRoll(move, chosenWeapon, config, {
			quickRoll, guided: bundle.guided, disadvantageConversion, downgrade
		});
	},
	// Shared by _onMoveRoll (weapon resolved via the merged dialog's own weapon-select, or left
	// undefined for a move that isn't usesWeapon) and _onWeaponMoveRoll (weapon already known from
	// the clicked button). `weapon` is an array of candidates only for _onMoveRoll's usesWeapon
	// branch — every other caller still passes a single resolved weapon/null/undefined, exactly as
	// before, and that path (below) is completely unchanged.
	async _rollMove(move, weapon, quickRoll = {}) {
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

		// _onMoveRoll's usesWeapon branch (see its own comment) — everything from here through the
		// end of this function is the single-weapon path, untouched by weaponBundles at all.
		if (Array.isArray(weapon)) {
			if (!traits.length && !move.conditions) return;
			return this._rollMoveWithWeaponChoice(move, weapon, traits, quickRoll);
		}

		traits = this._weaponTraitsFor(move, weapon, traits);
		if (!traits.length && !move.conditions) return;

		const pendingGrant = this._pendingRollModifierGrant(move);
		const lockedEffect = this._lockedEffectFor(move, weapon, pendingGrant);
		const lockedTrait = this._lockedTraitFor(move, quickRoll, traits);
		const lockedAdvantage = this._lockedAdvantageFor(move, pendingGrant);
		const fromCarrier = Boolean(weapon?.fromCarrier);
		const equipmentSpends = fromCarrier ? [] : this._equipmentSpends(lockedEffect, weapon);
		const guided = this._guidedFor(move, weapon);
		// The Roll Modifiers section (see move-grants-mixin.js's _rollModifiersForMove/
		// _rollStackModifier) -- resolved unconditionally, like automaticSuccess below, rather than
		// scoped to fromCarrier/usesWeapon: a source's own moveKeys filtering already narrows each
		// entry to the moves it actually applies to, so there's nothing frame- or weapon-specific to
		// additionally gate here.
		const rollModifiers = this._rollModifiersForMove(move, lockedEffect);
		const rollStack = this._rollStackModifier();
		// Embrace Chaos's own two hold spends -- disadvantageConversion (see
		// _disadvantageConversionModifier) is resolved unconditionally, like rollStack above, since
		// it's a Category D mechanism the dialog itself renders live-reactively; downgrade (see
		// _availableDowngrade) is resolved unconditionally too, but only ever offered on the chat
		// card after a 10+ (see moves.js#rollMove), so it's folded into baseOptions below the same
		// conditional-spread way automaticSuccess already is.
		const disadvantageConversion = this._disadvantageConversionModifier();
		const downgrade = this._availableDowngrade(move);
		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
			lockedAdvantage,
			lockedTrait,
			equipmentSpends,
			rollModifiers,
			rollStack,
			disadvantageConversion,
			...(guided && { guided })
		});
		if (!config) return;

		// The one-shot deferred grant (see pendingGrant above) is cleared the moment this roll's own
		// config resolves -- read-then-cleared before the roll itself, so checking a deferred entry's
		// box *inside* this same dialog never grants it to this roll, only the next one (see
		// move-grants-mixin.js's _pendingRollModifierGrant doc comment for the known UX quirk this
		// implies).
		if (pendingGrant) await this._clearPendingRollModifier(pendingGrant.sourceKey, pendingGrant.specKey);

		await this._finishMoveRoll(move, weapon, config, { quickRoll, guided, disadvantageConversion, downgrade });
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
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
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

		// Chromatic Focus/Chromatic Reserves (astir-parts.js/ardent.js's promptsApproachOverride).
		// No-ops with nothing left to spend — a `uses` checkbox (Chromatic Focus) or a numericTrackers
		// countdown at 0 (Chromatic Reserves), same as move.activatesApproachOverride's own "nothing
		// to snapshot" guard above — so a fully-Expended part never even opens the dialog. Cancelling
		// the dialog also no-ops entirely — no actor.update call at all, unlike a real pick, which
		// writes the override and the spend in one update so the two can never land out of sync.
		// moves-mixin.js's _promptsApproachOverrideAvailable/_promptsApproachOverrideSpend resolve
		// both storage shapes generically, so this branch doesn't need to know which one it's got.
		if (move.promptsApproachOverride) {
			if (!this._promptsApproachOverrideAvailable(move)) return;
			const chosen = await chooseApproachOverride(this.actor.system.attributes?.approach ?? "");
			if (!chosen) return;
			await this.actor.update({
				"system.attributes.approachOverride": { approach: chosen, period: "Scene" },
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
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		await postMoveDescription(this.actor, move);
	},
	async _onMoveInfo(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		await showMoveDescription(move);
	}
};
