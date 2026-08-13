import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { chooseApproachOverride } from "../../core/approaches.js";
import { chooseCarrier, findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";
import { UNARMED, chooseWeapon } from "../../equipment/equipment.js";
import { findAstirPart } from "../../frames/astir.js";
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

		// usesWeapon (Exchange Blows, Strike Decisively — see moves.js) prompts which weapon (or
		// Unarmed) before rolling, so _rollMove's equipment spends can be scoped to it. `weapon`
		// stays undefined for every other move — the same "not applicable" signal
		// _equipmentSpends already reads. Skipped entirely when the actor has no weapons at all:
		// there's nothing to choose between, so Unarmed is simply true.
		//
		// Only weapons belonging to the currently mounted frame are offered (see docs/domains/frames.md's Piloted
		// note): the Astir's own weapons while it's mounted, one specific Ardent's while that Ardent
		// is mounted, mundane weapons while nothing is — never more than one of the three. A weapon
		// on the wrong side can never become `weapon` here, so nothing downstream (including the
		// Familiar +CHANNEL override below) needs to re-check mounted state itself.
		let weapon;
		if (move.usesWeapon) {
			const mountedFrameId = this._mountedFrame()?.id ?? null;
			let weapons = this._weapons().filter((w) => this._weaponFrameId(w) === mountedFrameId);
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
					const carrierWeapons = (carriers[0].system.attributes?.weapons ?? [])
						.map((w) => ({ ...w, fromCarrier: true }));
					weapons = [...weapons, ...carrierWeapons];
				}
			}
			if (weapons.length) {
				const weaponId = await chooseWeapon(weapons);
				if (weaponId === null) return;
				weapon = weaponId === UNARMED ? null : weapons.find((w) => w.id === weaponId) ?? null;
			} else {
				weapon = null;
			}
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
		if (!move || !weapon) return;

		await this._rollMove(move, weapon);
	},
	// Shared by _onMoveRoll (weapon resolved via chooseWeapon, or left undefined for a move that
	// isn't usesWeapon) and _onWeaponMoveRoll (weapon already known from the clicked button).
	async _rollMove(move, weapon, quickRoll = {}) {
		let traits = this._moveTraits(move);
		// _moveTraits already resolved CREW for the single/zero-Carrier case; with more than one
		// Carrier in the world that's ambiguous, so ask which one before locking in the value this
		// roll actually uses. Cancelling aborts the whole roll, same convention chooseWeapon's own
		// cancel already has.
		if (move.fixedTraits?.some((trait) => trait.key === "crew")) {
			const carriers = findCarrierActors();
			if (carriers.length > 1) {
				const carrierId = await chooseCarrier(carriers);
				if (!carrierId) return;
				const crewValue = carriers.find((c) => c.id === carrierId)?.system.stats?.crew?.value ?? 0;
				traits = traits.map((trait) => (trait.key === "crew" ? { ...trait, value: crewValue } : trait));
			}
		}
		// A Familiar weapon (astir.js's familiar: true) rolls Exchange Blows/Strike Decisively with
		// +CHANNEL instead of the move's usual CLASH/TALK choice — replaces (not adds to) `traits`,
		// matching the rulebook's "instead," and reads CHANNEL's raw value directly rather than
		// going through availableMoveTraits/_moveTraits, since CHANNEL was never in either move's own
		// traits list to begin with. Never reached while unpiloted — a Familiar is always an Astir
		// weapon, and _onMoveRoll/_onWeaponMoveRoll only ever hand this a weapon matching the current
		// Piloted state (see docs/domains/frames.md's Piloted note) — so there's nothing to re-check here.
		if (move.usesWeapon && weapon?.familiar) {
			traits = [{ key: "channel", label: "CHANNEL", value: this.actor.system.stats?.channel?.value ?? 0 }];
		}
		if (!traits.length && !move.conditions) return;

		// bite-the-dust's forcesDesperationAtMaxPerils and weave-magic's forcesDesperationOnShakenTenet
		// sit at the same "reactive/emergency lock" tier, ahead of a forced weapon tag — all three only
		// ever lock to Desperation today, so there's nothing to actually conflict, but the precedence
		// keeps a future second forcesEffect value from silently overriding either actor-state read.
		// Field Scout's standing grantsEffectOnMove (see _grantedEffectForMove) sits next: it's a
		// permanent grant rather than any of the other three's emergency/reactive lock, so anything
		// already forcing an axis wins over it. The target-matchup Approach signal (_targetMatchupEffect
		// — see its own comment; Tier's own signal feeds the Advantage axis instead, independently, via
		// lockedAdvantage below) sits lowest of all: it's a passive read of the current target, so any
		// of the above five sources — each a more specific or more deliberate lock — wins over it.
		// A weapon "borrowed" from the world's Carrier (Fire Support — see _onMoveRoll's
		// grantsCarrierWeaponAccess handling) lives in a different actor's own equipment array, not
		// this actor's — so none of the spend/tag/reroll/Guided machinery below, which all read or
		// write this actor's own equipment/Astir Part state, may ever be evaluated against it.
		// Mirrors CarrierActorSheet#_onWeaponMoveRoll's own scope cut for the Carrier's own weapon
		// rolls (carrier-actor-sheet.js): that handler never offers equipment spends, Astir Part
		// spends, reroll or Guided either — a Carrier weapon roll is deliberately just a trait plus
		// a name on the chat card, nothing more, and a Fire Support roll using one gets exactly the
		// same treatment rather than risking a write onto an object this actor doesn't own.
		const fromCarrier = Boolean(weapon?.fromCarrier);
		const forced = fromCarrier ? null : this._forcedWeaponEffect(weapon);
		const lockedEffect = (move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null)
			?? (move.forcesDesperationOnShakenTenet && this._hasShakenTenet() ? "desperation" : null)
			?? forced?.effect
			?? this._grantedEffectForMove(move)
			?? this._targetMatchupEffect(move)
			?? null;
		// Don't Follow Me's own pair — see _grantedTraitForMove/_grantedAdvantageForMove. The
		// granted trait key is resolved against this roll's own final `traits` list (rather than
		// TRAITS directly) so the locked option carries the same live, bonus-inclusive value every
		// other entry in the dialog does; a key that isn't actually offered here (e.g. the trait is
		// disabled for this actor) resolves to no lock at all.
		// An explicit forced trait from a quick-roll button (Bureaucrat — see quickRollsMove) wins
		// over any standing grantsTraitOnMove lock (Don't Follow Me): it's the more specific,
		// immediate signal from the actual button clicked, not a passive standing grant.
		const grantedTraitKey = quickRoll.trait ?? this._grantedTraitForMove(move);
		const lockedTrait = grantedTraitKey ? traits.find((t) => t.key === grantedTraitKey) ?? null : null;
		// Don't Follow Me's single-target-move grant wins if it and Cold Company's standing haunted-
		// state lock somehow both apply — in practice these two moves live on mutually exclusive
		// playbooks (Impostor / Wither), so this ordering is a defensive tie-break, not an expected
		// real-world collision. The target-matchup Tier signal (_targetTierAdvantage — its Approach
		// sibling, _targetMatchupEffect, feeds lockedEffect above instead, independently, since the two
		// axes no longer sum into one combined stack) sits lowest in this chain — it only ever fires
		// when nothing else has already forced the Advantage axis. An Astir Part's own reactive
		// spend.advantage (Artifact) still wins over all three, per configureMoveRoll's own precedence —
		// untouched by this change.
		const lockedAdvantage = this._grantedAdvantageForMove(move) ?? this._coldCompanyAdvantage() ?? this._targetTierAdvantage(move);
		const equipmentSpends = fromCarrier ? [] : this._equipmentSpends(lockedEffect, weapon);
		const astirPartSpends = fromCarrier ? [] : this._astirPartSpends(lockedEffect);
		// Omitted entirely rather than passed as `false` when not guided — configureMoveRoll
		// already defaults it to false itself, and this keeps every non-Guided call's options
		// shape exactly as it was before Guided existed, same treatment `reroll` gets below. Spell
		// Routines (see astir.js) grants the same "Take 7-9" option for any move, not just a
		// weapon carrying the Guided tag — but only while installed on the currently mounted frame
		// (see docs/domains/frames.md's Piloted note). Spell Routines carries a powerCost, so it can only ever
		// be installed on the Astir, never an Ardent (see ardent.js's ardentParts) — but this reads
		// generically off _mountedParts() rather than special-casing the Astir, the same convention
		// every other reactive part effect in this file follows.
		const guided = (!fromCarrier && this._weaponIsGuided(weapon)) || this._mountedParts().some((part) => part.grantsGuided);
		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
			lockedAdvantage,
			lockedTrait,
			equipmentSpends,
			astirPartSpends,
			...(guided && { guided })
		});
		if (!config) return;

		// Guided's "Take 7-9" button resolves with nothing but this flag — no trait, dice, or
		// equipment/Astir Part spend was ever read, so there's nothing to mark spent and nothing
		// left to roll. Lead a Sortie's Potion grant (see _onMoveResolved) still applies — the
		// Sortie was led either way — but there's no dice to check for Flourish Component.
		if (config.takeSeven) {
			await postGuidedResult(this.actor, move, {
				weaponLabel: weapon ? weapon.name : "Unarmed",
				weaponTags: this._weaponTagLabels(weapon)
			});
			await this._onMoveResolved(move, null, "mixed");
			return;
		}

		// A forced tag (e.g. Unreliable) is marked spent right alongside whatever the player
		// checked in the dialog — same single update, same "used this period" checkbox on the
		// Equipment tab (see _equipmentEntry's spendable) as a player-chosen spend.
		const spends = [...(config.spentTags ?? []), ...(forced ? [{ equipmentId: weapon.id, tagKey: forced.tagKey }] : [])];
		if (spends.length) await this._spendEquipmentTags(spends);
		if (config.spentParts?.length) await this._spendAstirParts(config.spentParts);

		// Pre-resolved to a plain {key, label} badge here (rather than passing partKeys into
		// moves.js) so that module never needs to import astir.js — see moves.js#rollMove.
		const spentPartLabels = (config.spentParts ?? [])
			.map((key) => findAstirPart(key))
			.filter(Boolean)
			.map((part) => ({ key: part.key, label: part.name }));

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
		// pre-resolved via options, exactly like spentPartLabels/weaponLabel already do, so moves.js
		// never needs to import playbook-moves.js (see claude.md's import-direction note).
		const extraQuestions = this._grantedQuestionsForMove(move);
		const baseOptions = {
			...config,
			...(traitBonus && { traitBonus }),
			...(spentPartLabels.length && { spentPartLabels }),
			...(automaticSuccess.length && { automaticSuccess }),
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
	// Runs after a move resolves — whether via a real roll (dice present) or Guided's "Take 7-9"
	// (dice null). The Witch's Patron ("offers you two boons at random whenever someone leads a
	// Sortie") is checked first and unconditionally, before the mounted-frame early-return below —
	// unlike Potions/doubles-regen (Astir Part effects, gated on the Astir specifically being
	// mounted), Patron is a base playbook feature that doesn't care whether — or which — frame is
	// mounted.
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
		// The two Astir Part effects below react to a move's outcome rather than being offered as part
		// of setting it up. Both are scoped to the mounted frame's own parts (see docs/domains/frames.md's Piloted
		// note): a part contributes nothing when no frame is currently mounted. Both
		// grantsPotionsOnLeadASortie and regainPowerOnDoubles carry a powerCost, so — like grantsGuided
		// above — neither can ever be installed on an Ardent; this still reads generically off
		// _mountedParts() rather than special-casing the Astir.
		if (!this._mountedFrame()) return;
		const parts = this._mountedParts();
		if (move.key === "lead-a-sortie" && parts.some((part) => part.grantsPotionsOnLeadASortie)) {
			await this._grantPotions();
		}
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
		// No-ops with no `uses` checkbox left to spend, same as move.activatesApproachOverride's own
		// "nothing to snapshot" guard above, so a fully-Expended/all-three-Uses-checked part never
		// even opens the dialog. Cancelling the dialog also no-ops entirely — no actor.update call at
		// all, unlike a real pick, which writes the override and the spend in one update so the two
		// can never land out of sync.
		if (move.promptsApproachOverride) {
			const nextUseKey = this._nextUnusedMoveUseKey(move);
			if (!nextUseKey) return;
			const chosen = await chooseApproachOverride(this.actor.system.attributes?.approach ?? "");
			if (!chosen) return;
			await this.actor.update({
				"system.attributes.approachOverride": { approach: chosen, period: "Scene" },
				[`system.attributes.moveUses.${move.key}.${nextUseKey}`]: true
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
