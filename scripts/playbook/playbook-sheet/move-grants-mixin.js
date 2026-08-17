import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { findAstirMove } from "../../frames/astir.js";
import { getTargetedNpc } from "../../moves/target-tier.js";
import { TIER_MIN } from "../../equipment/equipment.js";
import { approachMatchupStack } from "../../moves/approach-matchup.js";
import { ALL_MOVES } from "../../moves/all-moves.js";
import { HOLD_MIN } from "../../moves/moves.js";
import { SPOTLIGHT_MIN } from "./progression-mixin.js";

// Standing, actor-wide roll effects (Number Of The Beast, Cold Company) and every "does a picked
// move grant something to a different move" resolver — see moves-mixin.js's file comment for how
// this file relates to its siblings in this directory.
export const MoveGrantsSheetMixin = {
	// bite-the-dust's forcesDesperationAtMaxPerils reads this to decide whether the roll dialog's
	// Effect is locked to Desperation (see _onMoveRoll) — true only when every Danger slot is
	// full AND every one of those Dangers is a Peril, not just any Peril present.
	_allDangersArePeril() {
		const dangers = this._dangers();
		return dangers.length >= this._dangerMax() && dangers.every((danger) => danger.type === "peril");
	},
	// weave-magic's forcesDesperationOnShakenTenet reads this the same way bite-the-dust's
	// forcesDesperationAtMaxPerils reads _allDangersArePeril above — evaluated generically off any
	// Hook's shaken flag (see tracking-mixin.js's _hooks) rather than gated on isParadigm itself,
	// since a non-Paradigm actor's hooks never get a Shaken checkbox to check in the first place
	// (see the template's isParadigm-gated markup), so this only ever fires for a Paradigm
	// character in practice.
	_hasShakenTenet() {
		return this._hooks().some((hook) => hook.shaken);
	},
	// Number Of The Beast (see playbook-moves.js's grantsExplodingSixes) — a standing, actor-wide
	// effect on every roll, not scoped to any one move key, so this reads the actor's picked moves
	// directly rather than going through _grantedXOnMove's single-target-move resolvers.
	_hasExplodingSixes() {
		return resolvePlaybookMoves(this._playbookMoves()).some((m) => m.grantsExplodingSixes);
	},
	// Cold Company (see playbook-moves.js's grantsHauntedStandingRoll) — finds the actor's picked
	// Cold Company move, if any. Shared by _coldCompanyAdvantage (read, every roll) and
	// _onMoveResolved's flip (write, after every roll) so the useKey string only lives in one place.
	_coldCompanyMove() {
		return resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsHauntedStandingRoll);
	},
	// The Advantage-axis standing lock every roll this actor makes gets — unlike
	// _grantedAdvantageForMove (Don't Follow Me), which only ever locks one specific target move,
	// this applies unconditionally to every roll, so it isn't resolved through that single-target-
	// move lookup. Returns null when the actor hasn't picked Cold Company at all — a true no-op for
	// every other actor, same "compute regardless, resolves to nothing" stance _grantedEffectForMove
	// etc. already take.
	_coldCompanyAdvantage() {
		const coldCompany = this._coldCompanyMove();
		if (!coldCompany) return null;
		const { useKey } = coldCompany.grantsHauntedStandingRoll;
		const dispelled = Boolean(this.actor.system.attributes?.moveUses?.[coldCompany.key]?.[useKey]);
		return dispelled ? "advantage" : "disadvantage";
	},
	// Field Scout's "read the room with confidence, always" (see playbook-moves.js's
	// grantsEffectOnMove) — locks a specific *other* move's Effect regardless of which move is
	// actually being rolled, so this is resolved off the actor's picked playbook moves rather than
	// a flag on `move` itself (contrast forcesDesperationAtMaxPerils/requiresChannelDisabled, which
	// are read straight off the move being rolled). Returns null when no picked move grants
	// anything for this particular move key.
	_grantedEffectForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsEffectOnMove?.moveKey === move.key);
		return granting?.grantsEffectOnMove.effect ?? null;
	},
	// Don't Follow Me's "lead a Sortie with +DEFY & advantage" (see playbook-moves.js's
	// grantsTraitOnMove) — the trait-key half of the same pair _grantedEffectForMove already
	// resolves for Effect. Returns a bare key (mirroring _grantedEffectForMove/
	// _grantedAdvantageForMove's own return shape); _rollMove resolves it against this move's own
	// already-computed `traits` list to get a real {key, label, value} option to lock, rather than
	// duplicating that lookup here. Applied unconditionally whenever the granting move is picked
	// and the target move is rolled — same "always" treatment grantsEffectOnMove already gives
	// Field Scout, rather than gating on the move's own "you may" framing (Downtime Scenes and
	// their tokens aren't tracked anywhere in this module — see docs/domains/moves.md's "systems that do not
	// exist yet").
	_grantedTraitForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsTraitOnMove?.moveKey === move.key);
		return granting?.grantsTraitOnMove.trait ?? null;
	},
	// Every move source that can carry the grantsAdvantageOnMove/addsSuccessReminderToMove/
	// addsCriticalReminderToMove/addsFailureReminderToMove/addsQuestionsToMove family of flags — the
	// actor's picked playbook moves, plus (Legacy, Mana Devourer, etc. — see astir.js's
	// ASTIR_MOVE_CATALOG) the Astir's own unique move, but only while the Astir specifically is the
	// mounted frame. Mirrors the mounted-vs-installed distinction every other Astir Part effect
	// already draws (see docs/domains/frames.md's Piloted note/_mountedParts) — an Astir Move picked but not
	// currently mounted grants nothing, the same as an installed-but-unmounted Part. Shared by every
	// _granted*ForMove resolver below that can be sourced from an Astir Move; the ones that can't
	// (_grantedEffectForMove, _grantedTraitForMove, _grantsUnpilotedAstirMove,
	// _grantsCarrierWeaponAccess) keep reading resolvePlaybookMoves directly, since none of the 20
	// catalog Astir Moves use those flags.
	_grantingMoves() {
		const astir = this._astir();
		const astirMove = astir?.move ? findAstirMove(astir.move) : null;
		const mounted = this._mountedFrame()?.kind === "astir";
		return [
			...resolvePlaybookMoves(this._playbookMoves()),
			...(astirMove && mounted ? [astirMove] : [])
		];
	},
	// The Advantage-axis counterpart to _grantedEffectForMove — Don't Follow Me additionally locks
	// the roll dialog's Dice select the same way a lockedEffect locks Effect (see
	// PlaybookActorSheet#_rollMove/moves.js#configureMoveRoll), though an Astir Part's own reactive
	// spend.advantage (Artifact) still wins over it.
	_grantedAdvantageForMove(move) {
		const granting = this._grantingMoves()
			.find((m) => m.grantsAdvantageOnMove?.moveKey === move.key);
		return granting?.grantsAdvantageOnMove.advantage ?? null;
	},
	// Tier-vs-Tier against a single targeted NPC (see docs/domains/world-actors.md's World actors / target-tier.js's
	// getTargetedNpc) — the Advantage-axis half of the target-matchup pair, independent of Approach
	// (see _targetMatchupEffect below, its Effect-axis sibling): the two signals no longer sum, so
	// this alone never reaches a x2 state. +1 higher / -1 lower / 0 equal, resolved to Advantage/
	// Disadvantage. Gated on the move's existing usesWeapon flag rather than hardcoded move keys —
	// true for exactly Exchange Blows/Strike Decisively today, but any future usesWeapon move picks
	// this up automatically, matching the module's "declarative flag, evaluated generically"
	// convention.
	_targetTierAdvantage(move) {
		if (!move.usesWeapon) return null;
		const target = getTargetedNpc();
		if (!target) return null;
		const targetTier = target.system.attributes?.tier ?? TIER_MIN;
		const tierStack = Math.sign(this._conflictTier().effective - targetTier);
		if (tierStack === 1) return "advantage";
		if (tierStack === -1) return "disadvantage";
		return null;
	},
	// Approach-vs-Approach against a single targeted NPC — the Effect-axis half of the target-
	// matchup pair, independent of Tier (see _targetTierAdvantage above). Countering a foe's
	// Approach (the type wheel — see approach-matchup.js) grants Confidence; being countered grants
	// Desperation; a tie, an unknown Approach on either side, or a non-adjacent pairing grants
	// neither. Same usesWeapon gating as _targetTierAdvantage, for the same "declarative flag,
	// evaluated generically" reason.
	_targetMatchupEffect(move) {
		if (!move.usesWeapon) return null;
		const target = getTargetedNpc();
		if (!target) return null;
		const attackerApproach = this._effectiveApproach().effective;
		const targetApproach = target.system.attributes?.approach ?? "";
		const stack = approachMatchupStack(attackerApproach, targetApproach);
		if (stack === 1) return "confidence";
		if (stack === -1) return "desperation";
		return null;
	},
	// Living Drive's "you may use [eidolon drive] outside of an Astir" (Summoner — see
	// playbook-moves.js's grantsUnpilotedAstirMove) — the single-target-move shape
	// _grantedTraitForMove/_grantedAdvantageForMove already use, checked by _movesData's Astir
	// Moves group to skip the mounted-frame half of its own gating for Eidolon Drive specifically.
	_grantsUnpilotedAstirMove(move) {
		return resolvePlaybookMoves(this._playbookMoves())
			.some((m) => m.grantsUnpilotedAstirMove?.moveKey === move.key);
	},
	// Fire Support (The Captain): "you may exchange blows and strike decisively ... using ... the
	// Carrier's weaponry" (see playbook-moves.js's grantsCarrierWeaponAccess) — the same single-
	// target-move-list shape addsTraitToMove's moveKeys form uses, checked by _onMoveRoll to decide
	// whether to fold the world's Carrier weapons into this roll's weapon choice.
	_grantsCarrierWeaponAccess(move) {
		return resolvePlaybookMoves(this._playbookMoves())
			.some((m) => m.grantsCarrierWeaponAccess?.moveKeys?.includes(move.key));
	},
	// Human Resources (The Captain): "when you read the room, you may also choose from the
	// following questions" (see playbook-moves.js's addsQuestionsToMove) — the single-target-move
	// shape _grantedTraitForMove/_grantedAdvantageForMove already use, but returning a whole
	// question list rather than one key/value, since there's nothing on the target move itself to
	// resolve against (contrast addsTraitToMove, which locks/offers one of the target move's own
	// real trait options).
	_grantedQuestionsForMove(move) {
		const granting = this._grantingMoves()
			.find((m) => m.addsQuestionsToMove?.moveKey === move.key);
		return granting?.addsQuestionsToMove.questions ?? null;
	},
	// Walk-on Part In The War's "tick 'overheating' on a 6-" (see playbook-moves.js's
	// addsFailureReminderToMove) — a move-specific reminder text appended to a *different* move's
	// chat card on failure, for a consequence this module has no automatic tracker for (see
	// claude.md's "Manual trackers, not enforcement"). Always an array of target keys (unlike
	// addsTraitToMove's moveKey/moveKeys pair) since nothing needs a single-target form yet — only
	// ever surfaced by moves.js#rollMove on an actual 6-. requiresAstirMounted mirrors the same
	// flag on this move's own addsTraitToMove grant above — no reminder to tick a box that was
	// never offered as a roll option in the first place while unmounted or in an Ardent.
	_grantedFailureReminderForMove(move) {
		const granting = this._grantingMoves()
			.find((m) => {
				const grant = m.addsFailureReminderToMove;
				if (!grant?.moveKeys?.includes(move.key)) return false;
				return !grant.requiresAstirMounted || this._mountedFrame()?.kind === "astir";
			});
		return granting?.addsFailureReminderToMove.reminder ?? null;
	},
	// Coordinator's "your ally may act with confidence in addition to advantage" (see
	// playbook-moves.js's addsSuccessReminderToMove) — the success-tier mirror of
	// _grantedFailureReminderForMove above, minus its requiresAstirMounted gate: no
	// addsSuccessReminderToMove grant needs one today, and carrying an always-true branch just to
	// mirror the failure version's shape would leave a branch this module's 100%-coverage gate can
	// never legitimately exercise. Add the gate back (matching _grantedFailureReminderForMove's own
	// `!grant.requiresAstirMounted || this._mountedFrame()?.kind === "astir"` line) the day a grant
	// actually needs it — same shape _grantedQuestionsForMove already uses for the same reason.
	_grantedSuccessReminderForMove(move) {
		const granting = this._grantingMoves()
			.find((m) => m.addsSuccessReminderToMove?.moveKeys?.includes(move.key));
		return granting?.addsSuccessReminderToMove.reminder ?? null;
	},
	// The 12+ mirror of _grantedSuccessReminderForMove above, backing addsCriticalReminderToMove
	// (Soldier's Indomitable, Cantrips' Truth-making, The Advocate's A Greener World, The
	// Diplomat's Sharp Tongue — see playbook-moves.js/docs/domains/moves.md's "Adding move content"). Unlike
	// addsSuccessReminderToMove/addsFailureReminderToMove, `moveKeys` is optional here: omitting it
	// means "any move qualifies" — the same unrestricted convention grantsAutomaticSuccess.moves
	// already uses in _availableAutomaticSuccess for its own no-`moves`-set case — which is what
	// lets Indomitable's universal "whenever you make a move, on a 12+..." grant reuse this
	// single-target-move-shaped mechanism instead of a second, list-wide one. `requiresTrait`
	// (Sharp Tongue only, "when you exchange blows with +TALK") further restricts the grant to
	// whichever trait was actually rolled, since Exchange Blows itself offers a choice of CLASH or
	// TALK and the move's own text cares which one was used.
	_grantedCriticalReminderForMove(move, traitKey) {
		const granting = this._grantingMoves()
			.find((m) => {
				const grant = m.addsCriticalReminderToMove;
				if (!grant) return false;
				if (grant.moveKeys && !grant.moveKeys.includes(move.key)) return false;
				if (grant.requiresTrait && grant.requiresTrait !== traitKey) return false;
				return true;
			});
		return granting?.addsCriticalReminderToMove.reminder ?? null;
	},
	// Every move flagged grantsAutomaticSuccess (Hot-blooded, Once the War's Over, The Arity
	// Method, Dark Rebirth, Ancient Recall, Ain't No Grave — see playbook-moves.js) can spend its
	// own hold pool, `uses` checkbox, (Dark Rebirth) put the actor in peril, or (Ain't No Grave)
	// spend nothing at all to treat the move currently being rolled as a success, matching each
	// move's own "succeed as if you'd rolled a 10+" text. Unlike a reroll tag or an equipment
	// spend, this isn't tied to the weapon being used — it's actor-wide, so every flagged move
	// (not just ones on this actor's picked pools — a hold/uses value can only be non-zero if the
	// move was actually picked and activated, so there's nothing to additionally check there) is
	// considered fresh for every roll. `moves` (The Arity Method, Dark Rebirth) restricts the offer
	// to specific move keys, the same field/meaning as equipment.js's own reroll.moves — the
	// inverse, `excludeMoves` (Ain't No Grave), drops one specific move key from an otherwise
	// unrestricted offer (excluding its own source move, Never Quite Free, from being upgraded by
	// itself).
	_availableAutomaticSuccess(move) {
		// A hold-cost source (Hot-blooded, Once the War's Over) is naturally excluded for an actor
		// who never picked it: moveHold reads 0, and cost is always positive. A useKey source (The
		// Arity Method) has no such natural floor — an unset uses checkbox (never picked) reads
		// exactly the same as an unchecked one (picked, not yet spent) — and Dark Rebirth's costsPeril
		// reads actor-wide Danger state with no per-move field at all. Ain't No Grave's costless
		// source (none of cost/useKey/costsPeril set) has the same "never picked" ambiguity a useKey
		// source does — nothing to read that's zero by default — so it needs the same explicit check.
		// Picked moves are resolved once here rather than per-source.
		const pickedKeys = resolvePlaybookMoves(this._playbookMoves()).map((m) => m.key);
		return ALL_MOVES
			.filter((m) => m.grantsAutomaticSuccess)
			.filter((m) => !m.grantsAutomaticSuccess.moves || m.grantsAutomaticSuccess.moves.includes(move.key))
			.filter((m) => !m.grantsAutomaticSuccess.excludeMoves?.includes(move.key))
			.filter((m) => {
				const { cost, useKey, costsPeril } = m.grantsAutomaticSuccess;
				// Dark Rebirth's "cost" (see playbook-moves.js) is a fresh Danger of type peril rather
				// than spending an existing hold/uses pool — gated on the actor currently holding zero
				// peril-type Dangers (its own "if you ... have no perils" text) and, defensively, not
				// already at DANGER_MAX, since a Danger can't be added to a full list.
				if (costsPeril) {
					if (!pickedKeys.includes(m.key)) return false;
					const dangers = this._dangers();
					return dangers.length < this._dangerMax() && dangers.every((danger) => danger.type !== "peril");
				}
				if (useKey) {
					return pickedKeys.includes(m.key) && !this.actor.system.attributes?.moveUses?.[m.key]?.[useKey];
				}
				if (cost != null) {
					return (this.actor.system.attributes?.moveHold?.[m.key]?.value ?? 0) >= cost;
				}
				// Ain't No Grave (see playbook-moves.js) — no hold/uses/peril spend at all, so the only
				// gate is whether the actor picked the granting move in the first place, the same
				// pickedKeys check costsPeril/useKey already make above.
				return pickedKeys.includes(m.key);
			})
			.map((m) => ({ key: m.key, name: m.name, ...m.grantsAutomaticSuccess }));
	},
	// Heat Up's own gate (see moves.js — the rules text has the player tick their Astir's existing
	// Overheating checkbox, system.attributes.astir.overheating, to retry a roll). Requires the Astir
	// specifically to be the mounted frame, same as every other Astir-conditioned effect in this
	// module (see docs/domains/frames.md's Piloted note) — "pushing your Astir to its limits" only makes sense
	// while piloting it. A plain boolean, like _availableReroll's own gate check — unlike the Astir
	// Moves group's own entries (always shown, disabled+tooltipped when ungated), the chat-card
	// button this drives is only ever rendered when clickable, so there's no unavailable reason to
	// surface.
	_availableHeatUp() {
		const astir = this._astir();
		if (!astir) return false;
		if (this._mountedFrame()?.id !== "astir") return false;
		return !astir.overheating;
	},
	// The Roll Modifiers mechanism (see astir-moves.js's §1 grantsRollModifier doc comment) — every
	// move source that can carry a spec, unioned across the two shapes that can grant one: the
	// actor's picked playbook moves / mounted Astir Move (_grantingMoves, already the shared
	// resolver every other single-target-move grant above uses) and every part installed on the
	// currently mounted frame (_mountedParts) — needed on top of _grantingMoves since Alchemical
	// Suite is a Part, not a move, and _grantingMoves never resolves those.
	_rollModifierSources() {
		return [...this._grantingMoves(), ...this._mountedParts()];
	},
	// Read the Room's shared hold pool vs a per-move flatHold/separateHold pool — replicates
	// moves-mixin.js:202-204's existing `(move.flatHold || move.separateHold) ? moveHold[key] :
	// resources.hold` branch (confirmed verbatim against source) so a grantsRollModifier's costsHold
	// can read/write either kind through one call. Needed for Identify's cross-move spend on Read
	// the Room's own hold — costsHold.moveKey there names a *different* move than the one carrying
	// the grant, so this can't just reuse a move's own already-resolved `hold` field from
	// _moveGroupMoves.
	_moveHoldValue(moveKey) {
		const move = ALL_MOVES.find((m) => m.key === moveKey);
		if (move?.flatHold || move?.separateHold) {
			return this.actor.system.attributes?.moveHold?.[moveKey]?.value ?? 0;
		}
		return this.actor.system.resources?.hold?.value ?? 0;
	},
	_moveHoldUpdatePath(moveKey) {
		const move = ALL_MOVES.find((m) => m.key === moveKey);
		if (move?.flatHold || move?.separateHold) {
			return `system.attributes.moveHold.${moveKey}.value`;
		}
		return "system.resources.hold.value";
	},
	// The resource-kind dispatcher for a single grantsRollModifier spec (see astir-moves.js's §1 doc
	// comment for the full field list) — one branch per gate kind, mirroring
	// _availableAutomaticSuccess's own cost/useKey/costsPeril dispatch above. Returns
	// {available, reason} rather than a plain boolean, so a disabled row in the dialog can show why
	// (see _rollModifiersForMove/move-roll-dialog.hbs's disabledReason).
	_rollModifierAvailability(spec, source) {
		if (spec.requiresOverheating || spec.costsOverheating) {
			const available = Boolean(this._astir()?.overheating);
			return { available, reason: available ? null : "Not overheating" };
		}
		if (spec.costsSpotlight) {
			const value = this.actor.system.attributes?.spotlight?.value ?? 0;
			const available = value >= spec.costsSpotlight;
			return { available, reason: available ? null : `Needs ${spec.costsSpotlight} Spotlight` };
		}
		if (spec.costsHold) {
			const moveKey = spec.costsHold.moveKey ?? source.key;
			const available = this._moveHoldValue(moveKey) >= spec.costsHold.amount;
			return { available, reason: available ? null : `Needs ${spec.costsHold.amount} hold` };
		}
		if (spec.costsPotion) {
			const available = (this._astir()?.potions?.[spec.costsPotion] ?? 0) > 0;
			return { available, reason: available ? null : `No ${spec.costsPotion} Potion left` };
		}
		if (spec.costsUse) {
			const available = !this.actor.system.attributes?.moveUses?.[source.key]?.[spec.costsUse];
			return { available, reason: available ? null : "Already used" };
		}
		return { available: true, reason: null };
	},
	// The move-roll dialog's own Roll Modifiers section (see move-dialogs.js's configureMoveRoll) —
	// mirrors _astirPartSpends' shape: every entry whose moveKeys is absent or matches the move about
	// to be rolled is always included, never hidden, only ever `disabled` — when its own gate fails,
	// or (for an effect-setting spec specifically, mirroring _astirPartSpends' own
	// `Boolean(lockedEffect && part.spend.effect)`) this roll's Effect is already locked elsewhere.
	// Dark Guarantees' reminderOnly entry (the-wither.js) is never gated or disabled — it renders as
	// description text only, with no checkbox at all (see the template).
	_rollModifiersForMove(move, lockedEffect) {
		const entries = [];
		for (const source of this._rollModifierSources()) {
			for (const spec of source.grantsRollModifier ?? []) {
				if (spec.moveKeys && !spec.moveKeys.includes(move.key)) continue;
				const key = spec.key ?? source.key;
				const label = spec.label ?? source.name;
				const description = spec.description ?? source.description;
				if (spec.reminderOnly) {
					entries.push({
						key,
						label,
						description,
						advantage: null,
						effect: null,
						reminderOnly: true,
						deferred: false,
						disabled: false,
						disabledReason: null
					});
					continue;
				}
				const { available, reason } = this._rollModifierAvailability(spec, source);
				const effectLocked = Boolean(spec.effect) && Boolean(lockedEffect);
				const disabled = !available || effectLocked;
				entries.push({
					key,
					label,
					description,
					advantage: spec.advantage ?? null,
					effect: spec.effect ?? null,
					reminderOnly: false,
					deferred: Boolean(spec.deferred),
					disabled,
					disabledReason: disabled ? (available ? "Effect already set" : reason) : null
				});
			}
		}
		return entries;
	},
	// All In's own single grantsRollStack entry (cantrips.js), if picked — the same {key, name,
	// ...grant} mapping shape _availableAutomaticSuccess's own map() uses above, just resolved once
	// (this dialog offers at most one grantsRollStack source, unlike automatic success's
	// every-qualifying-source list).
	_rollStackModifier() {
		const source = resolvePlaybookMoves(this._playbookMoves()).find((m) => m.grantsRollStack);
		if (!source) return null;
		return { key: source.key, label: source.name, ...source.grantsRollStack };
	},
	// The write side of the Roll Modifiers section — mirrors _spendAstirParts/_spendEquipmentTags/
	// handleAutomaticSuccess's own per-kind write branches, one actor.update batch for every checked
	// entry regardless of source. A deferred entry (Snakes in the Grass, Bonded in Blood, Alchemical
	// Suite's two Potions) additionally writes a pendingRollModifiers marker instead of applying to
	// this roll — see _pendingRollModifierGrant/_clearPendingRollModifier below for the read/clear
	// side.
	async _spendRollModifiers(keys) {
		if (!keys?.length) return;
		const updates = {};
		for (const source of this._rollModifierSources()) {
			for (const spec of source.grantsRollModifier ?? []) {
				const key = spec.key ?? source.key;
				if (!keys.includes(key)) continue;
				if (spec.costsOverheating) {
					updates["system.attributes.astir.overheating"] = false;
				} else if (spec.costsSpotlight) {
					const current = this.actor.system.attributes?.spotlight?.value ?? 0;
					updates["system.attributes.spotlight.value"] = Math.max(SPOTLIGHT_MIN, current - spec.costsSpotlight);
				} else if (spec.costsHold) {
					const moveKey = spec.costsHold.moveKey ?? source.key;
					updates[this._moveHoldUpdatePath(moveKey)] =
						Math.max(HOLD_MIN, this._moveHoldValue(moveKey) - spec.costsHold.amount);
				} else if (spec.costsPotion) {
					const current = this._astir()?.potions?.[spec.costsPotion] ?? 0;
					updates[`system.attributes.astir.potions.${spec.costsPotion}`] = Math.max(0, current - 1);
				} else if (spec.costsUse) {
					updates[`system.attributes.moveUses.${source.key}.${spec.costsUse}`] = true;
				}
				if (spec.deferred) {
					updates[`system.attributes.pendingRollModifiers.${source.key}.${spec.key ?? "default"}`] = true;
				}
			}
		}
		if (Object.keys(updates).length) await this.actor.update(updates);
	},
	// The read half of the one-shot deferred mechanism (see move-roll-mixin.js's _rollMove) — the
	// first still-pending deferred grant (across every roll-modifier source) whose moveKeys is absent
	// or matches the move about to be rolled. Re-resolves advantage/effect fresh from the catalog
	// every read, per claude.md's "catalog in code, keys on the actor" convention — only the boolean
	// marker itself is persisted.
	_pendingRollModifierGrant(move) {
		for (const source of this._rollModifierSources()) {
			for (const spec of source.grantsRollModifier ?? []) {
				if (!spec.deferred) continue;
				if (spec.moveKeys && !spec.moveKeys.includes(move.key)) continue;
				const specKey = spec.key ?? "default";
				const pending = Boolean(this.actor.system.attributes?.pendingRollModifiers?.[source.key]?.[specKey]);
				if (!pending) continue;
				return { advantage: spec.advantage ?? null, effect: spec.effect ?? null, sourceKey: source.key, specKey };
			}
		}
		return null;
	},
	// Clears a pending grant once _rollMove has applied it to a roll — the one-shot half of the
	// mechanism, so the same grant can't silently re-apply to a later roll too.
	async _clearPendingRollModifier(sourceKey, specKey) {
		await this.actor.update({ [`system.attributes.pendingRollModifiers.${sourceKey}.${specKey}`]: false });
	}
};
