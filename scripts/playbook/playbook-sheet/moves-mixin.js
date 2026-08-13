import { moveRequirementTooltip, resolvePlaybookMoves, unmetMoveRequirements } from "../../moves/playbook-moves.js";
import { patronChannelBonus, traitBonusesFor } from "../../moves/trait-bonuses.js";
import { TRAITS } from "../../core/traits.js";
import { APPROACHES } from "../../core/approaches.js";
import { partRequirementTooltip, resolveAstirParts, unmetPartRequirements } from "../../frames/astir.js";
import { playbookGrantsHomeInsteadOfChannel } from "../../moves/starting-moves.js";
import { BASIC_MOVES, SPECIAL_MOVES } from "../../moves/moves.js";
import { ARDENT_DEFAULT_NAME, ARDENT_PART_CATALOG } from "../../frames/ardent.js";

// Basic, Special and Playbook moves' shared roll pipeline (see claude.md's Moves sections) — move
// definitions themselves live in moves.js/playbook-moves.js/astir.js/ardent.js; this mixin owns
// resolving an actor's picked moves, deriving each move's render shape, and the Roll/Activate/
// Description handlers every move source shares. Standing-effect predicates, grant resolvers, the
// hold/tracker/pick handlers and the roll/activate pipeline itself live in this directory's
// move-grants-mixin.js, move-traits-mixin.js, move-tracking-mixin.js and move-roll-mixin.js
// siblings — split out of this file, but merged onto the same PlaybookActorSheet.prototype.
export const MovesSheetMixin = {
	// Just the picked keys — the move definitions live in playbook-moves.js, so stored data never
	// goes stale against edited rules text. resolvePlaybookMoves drops keys that no longer match
	// a definition.
	_playbookMoves() {
		return this.actor.system.attributes?.playbookMoves ?? [];
	},
	// Chromatic Focus's own "any use left?" check (astir-parts.js's promptsApproachOverride) — the
	// first `uses` entry not yet checked in this move/part's own moveUses pool, or null once every
	// entry is spent. Chromatic Focus has one entry (Expended). Shared by _moveGroupMoves' gating
	// below and move-roll-mixin.js's _onMoveActivate, so both always agree on what's spendable.
	// Chromatic Reserves (ardent.js) now spends a numericTrackers countdown instead of a `uses`
	// pool — see _promptsApproachOverrideAvailable/_promptsApproachOverrideSpend below, which
	// resolve "is there anything left"/"spend one" across both storage shapes generically.
	_nextUnusedMoveUseKey(move) {
		return (move.uses ?? []).find((use) => !this.actor.system.attributes?.moveUses?.[move.key]?.[use.key])?.key ?? null;
	},
	// Chromatic Focus (a `uses` checkbox) and Chromatic Reserves (a `numericTrackers` countdown
	// stepper) back promptsApproachOverride with two different storage shapes — this resolves "is
	// there anything left to spend" generically across both, shared with
	// _promptsApproachOverrideSpend's actual write below so the two can't drift.
	_promptsApproachOverrideAvailable(move) {
		if (move.numericTrackers?.length) {
			const tracker = move.numericTrackers[0];
			const current = this.actor.system.attributes?.moveTrackers?.[move.key]?.[tracker.key]
				?? (tracker.resetTo === "max" ? tracker.max : 0);
			return current > tracker.min;
		}
		return Boolean(this._nextUnusedMoveUseKey(move));
	},
	// The actor.update fragment for spending one charge — checks the next `uses` box (Chromatic
	// Focus) or decrements the tracker by 1 (Chromatic Reserves). Only ever called after
	// _promptsApproachOverrideAvailable confirms there's something to spend.
	_promptsApproachOverrideSpend(move) {
		if (move.numericTrackers?.length) {
			const tracker = move.numericTrackers[0];
			const current = this.actor.system.attributes?.moveTrackers?.[move.key]?.[tracker.key]
				?? (tracker.resetTo === "max" ? tracker.max : 0);
			return { [`system.attributes.moveTrackers.${move.key}.${tracker.key}`]: current - 1 };
		}
		return { [`system.attributes.moveUses.${move.key}.${this._nextUnusedMoveUseKey(move)}`]: true };
	},
	// getData's moveGroups — Basic and Special moves are the same fixed list for every actor;
	// Playbook Moves is the per-actor set picked via the "+" button, so it's the only group that
	// renders add/remove controls (see the template's addable/removable branches). All three run
	// through the same _moveGroupMoves, so a picked move gets trait filtering, gating, hold tracking
	// and its Roll/Activate/Description buttons with no extra handling. Display order is basic,
	// then playbook, then Astir, then each Ardent's own, then special — the character's own moves
	// read before the fixed reference lists, moveGroups[0] staying Basic for existing tests.
	//
	// astirParts/astirMove/frames/mountedFrame/ardents are computed once in getData (shared with the
	// Astir/Ardent/Equipment data methods) and passed in here rather than recomputed. The "+ Choose
	// Starting Moves" button (see PlaybookActorSheet#_onStartingMovesAdd) shows up whenever its
	// playbook's pool has something to offer AND the actor currently has no playbook moves at all —
	// same "drop when empty" treatment equipment's startingGear.available already gets, so Commander/
	// Impostor stay hidden until their pools are filled in (see starting-moves.js). This is a live
	// emptiness check, not a one-time flag: cancelling the picker leaves the button available to
	// retry, and removing every playbook move via "-" brings it back.
	_movesData(astir, astirParts, astirMove, mountedFrame, ardents, startingMovePool) {
		// Heat Up and Subsystems (see moves.js) are basic/special moves by definition — every
		// playbook gets them, with no per-actor picking — but both only ever matter to an Astir
		// pilot, so they render in the Astir Moves group instead of Basic/Special Moves. Still
		// resolved off BASIC_MOVES/SPECIAL_MOVES (their canonical list, and what ALL_MOVES's flat
		// lookup and existing key-based tests key off of — see all-moves.js's own comment: "a move's
		// section... is purely a sheet-display grouping, not part of its identity") rather than
		// moved into a new list.
		const heatUp = BASIC_MOVES.find((m) => m.key === "heat-up");
		const subsystems = SPECIAL_MOVES.find((m) => m.key === "subsystems");
		const moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES.filter((m) => m !== heatUp)) },
			{
				label: "Playbook Moves",
				moves: this._moveGroupMoves(resolvePlaybookMoves(this._playbookMoves())),
				addable: true,
				removable: true,
				startingMovesAvailable: Boolean(
					startingMovePool?.grantedKeys?.length || startingMovePool?.pickOneKeys?.length || startingMovePool?.chooseCount
				) && this._playbookMoves().length === 0
			}
		];
		// Astir Parts read as moves, and the Astir's one unique move joins them under the same
		// group — both are picked/removed only from the Astir tab, so unlike Playbook Moves this
		// group renders no add/remove controls of its own. Each Ardent's own installed parts get
		// the same read-only treatment in their own "<name> Moves" group, right after the Astir's —
		// Ardents grant no unique Move (see docs/domains/frames.md's Ardents section), so an Ardent's group is
		// parts-only. This whole group is conditional on `astir` existing at all, not on
		// astirParts/astirMove specifically — a character who's never taken an Astir has no use for
		// Heat Up, Subsystems, any part, or a unique move, so the entire section is omitted from
		// moveGroups rather than shown permanently disabled. Once an Astir exists, the group always
		// renders (heatUp/subsystems mean it's never empty), even before that Astir is ever mounted —
		// see the mount-based gating below, which is unaffected by this check.
		if (astir) {
			const astirMoves = [heatUp, subsystems, ...astirParts, ...(astirMove ? [astirMove] : [])];
			// Every entry in this group — Heat Up, Subsystems, parts, and the Astir's own unique move
			// alike — only does anything while the Astir specifically is the mounted frame (see
			// docs/domains/frames.md's Piloted note), so `gated` is forced on top of whatever gating an entry already
			// has, the same disabled-Roll/Activate treatment channelGated already gives b-plot. Living
			// Drive (Summoner — see _grantsUnpilotedAstirMove) is the one exception: it ungates Eidolon
			// Drive specifically from the mounted-frame half of this check, so a picked move's own
			// gating (summonGated, e.g.) still applies even then.
			moveGroups.push({
				label: "Astir Moves",
				moves: this._moveGroupMoves(astirMoves).map((move) => ({
					...move,
					gated: move.gated || (mountedFrame?.id !== "astir" && !this._grantsUnpilotedAstirMove(move))
				}))
			});
		}
		for (const ardent of ardents) {
			const parts = resolveAstirParts(ardent.parts ?? [], ARDENT_PART_CATALOG);
			if (!parts.length) continue;
			moveGroups.push({
				label: `${ardent.name || ARDENT_DEFAULT_NAME} Moves`,
				moves: this._moveGroupMoves(parts).map((move) => ({ ...move, gated: move.gated || mountedFrame?.id !== ardent.id }))
			});
		}
		moveGroups.push({ label: "Special Moves", moves: this._moveGroupMoves(SPECIAL_MOVES.filter((m) => m !== subsystems)) });
		return moveGroups;
	},
	// Sums every picked playbook move's declarative traitBonus (Arcane Augments, Let Loose) against
	// this actor's current Danger/Burden counts and stored per-move trait choices — see
	// trait-bonuses.js. Derived fresh every call, never stored, same stance as
	// equipmentValue/_conflictTier, so it can't drift after a Danger/Burden/choice changes.
	_traitBonuses() {
		const moves = resolvePlaybookMoves(this._playbookMoves());
		const bonuses = traitBonusesFor(moves, {
			dangerCount: this._dangers().length,
			burdenCount: this._burdens().length,
			choices: this.actor.system.attributes?.traitBonusChoices ?? {}
		});
		// The Witch's Patron ("as long as your Patron has at least 1 Influence, your CHANNEL is
		// increased by 1" — see trait-bonuses.js's patronChannelBonus). A separate boolean-threshold
		// bonus rather than a third traitBonusesFor source, folded in on top since it can stack with a
		// hypothetical trait-scaling bonus on the same trait. this._witchInfluence() comes from the
		// Patron mixin (patron-mixin.js) via the shared prototype, the same cross-mixin call
		// convention _dangers()/_burdens() above already rely on in this method.
		const patronBonus = patronChannelBonus(moves, this._witchInfluence());
		if (patronBonus) bonuses.channel = (bonuses.channel ?? 0) + patronBonus;
		return bonuses;
	},
	_moveGroupMoves(moves) {
		// Adrift's own playbook substitutes +HOME for CHANNEL entirely (see playbook-moves.js's love,
		// love, love and playbookGrantsHomeInsteadOfChannel's own comment) — b-plot's own text is for
		// characters with no Channel-equivalent at all, so Adrift must read as Channel-enabled here
		// too, or b-plot would wrongly stay available to a playbook that's meant to lose access to it.
		const channelDisabled = Boolean(this.actor.system.stats?.channel?.disabled)
			&& !playbookGrantsHomeInsteadOfChannel(this.actor.system.playbook?.name);
		// Never Quite Free (see playbook-moves.js's disablesMove) — the inverse of
		// grantsUnpilotedAstirMove: a picked move can explicitly gate a different move rather
		// than ungate one. Resolved once here, same shape channelDisabled already establishes,
		// then matched per-move below.
		const disablingMoves = resolvePlaybookMoves(this._playbookMoves()).filter((m) => m.disablesMove);
		// requiresMoves/requiresParts (see playbook-moves.js/astir.js's "Adding move content"/Astir
		// notes) re-gate an already-picked move live if its prerequisite is later removed — not just
		// at picker time. playbookMoveKeys stays raw (unmetMoveRequirements just needs keys to compare
		// against); installedPartKeys resolves _astirParts() the same way chooseAstirWeapon's own
		// caller does, down to just the keys.
		const playbookMoveKeys = this._playbookMoves();
		const installedPartKeys = this._astirParts().map((part) => part.key);
		return moves.map((move) => {
			const traits = this._moveTraits(move);
			// Read-the-room's roll-tiered hold lives in pbta's shared system.resources.hold
			// field; every flatHold move's roll-less hold is tracked separately, one pool per
			// move key, at system.attributes.moveHold.<moveKey> (an ObjectField, unlike the
			// strictly-schemed system.resources) — keyed the same way system.attributes.moveUses
			// already is, so two different flatHold moves (e.g. b-plot and a Soldier Move) on the
			// same actor can't collide and overwrite each other's count. separateHold (Mobility)
			// is the same per-move pool, but for a move that's still roll-tiered rather than flat —
			// see moves.js#rollMove for the matching write side.
			const hold = (move.flatHold || move.separateHold)
				? this.actor.system.attributes?.moveHold?.[move.key]?.value ?? 0
				: this.actor.system.resources?.hold?.value ?? 0;
			// True only for moves gated off Channel being enabled (b-plot, via
			// requiresChannelDisabled) — distinct from the traits-empty gating below (Weave
			// Magic), which never blocks reading a move's own description.
			const channelGated = Boolean(move.requiresChannelDisabled) && !channelDisabled;
			// Eidolon Drive's Summon button (Summoner — see playbook-moves.js's summonsAlly) has
			// nothing to summon with zero bound allies, so it's disabled the same way every other
			// gated action button in this module is, rather than left to _onEidolonDriveSummon's
			// own defensive no-op guard alone. Also gated once an ally is already active this Scene
			// (a second Summon would silently overwrite the current one, since the data model only
			// ever holds one summonedAllyId at a time) — Refresh Scene (which already clears
			// eidolonDrive) is what re-enables the button.
			const summonGated = Boolean(move.summonsAlly)
				&& (this._boundAllies().length === 0 || Boolean(this._eidolonDrive().summonedAllyId));
			// Enduring Support's Activate button (Summoner — see playbook-moves.js's
			// activatesApproachOverride) has nothing to snapshot with no ally currently summoned, or
			// a summoned ally whose own Approach was never set — mirrors summonGated's own "nothing
			// to act on" stance for Eidolon Drive's Summon button.
			const approachOverrideGated = Boolean(move.activatesApproachOverride) && !this._summonedAlly()?.approach;
			// Chromatic Focus/Chromatic Reserves' own Activate button (see astir-parts.js/ardent.js's
			// promptsApproachOverride) has nothing left to spend once its `uses` checkbox (Chromatic
			// Focus) or numericTrackers countdown (Chromatic Reserves) is exhausted — same "nothing to
			// act on" stance approachOverrideGated above already takes for Enduring Support, via the
			// shared _promptsApproachOverrideAvailable helper.
			const promptsApproachOverrideGated = Boolean(move.promptsApproachOverride) && !this._promptsApproachOverrideAvailable(move);
			// Bite the Dust, disabled by Never Quite Free (see disablingMoves above) — finds the
			// picked move, if any, whose disablesMove.moveKey targets this move.
			const disabledBy = disablingMoves.find((m) => m.disablesMove.moveKey === move.key);
			// requiresMoves/requiresParts gating, live — see unmetMoveRequirements/unmetPartRequirements'
			// own comments. Empty for a move that declares neither, which is every move but the four
			// real requiresMoves cases and the (currently placeholder-only) requiresParts mechanism.
			const missingMoveKeys = unmetMoveRequirements(move, playbookMoveKeys);
			const missingPartKeys = unmetPartRequirements(move, installedPartKeys);
			const requirementTooltip = [moveRequirementTooltip(missingMoveKeys), partRequirementTooltip(missingPartKeys)]
				.filter(Boolean)
				.join("; ") || null;
			// The move-card "who's summoned" info line (Summoner) — only for the move that actually
			// grants the summon, and only once something real is summoned; every other move (and
			// Eidolon Drive itself with nothing summoned) omits the key entirely below rather than
			// setting it to null/undefined, so the large moveGroups toEqual snapshot in
			// tests/playbook-actor-sheet-moves.test.js never needs to gain a new field for moves that
			// aren't Eidolon Drive.
			const summonedAlly = move.summonsAlly ? this._summonedAlly() : null;
			const summonedAllyInfo = summonedAlly
				? {
					name: summonedAlly.name || "Summoned Ally",
					traitLabel: TRAITS.find((t) => t.key === summonedAlly.trait)?.label ?? summonedAlly.trait,
					value: this._eidolonDrive().bonusUsed ? 1 : 3
				}
				: null;
			// Enduring Support's own move-card info line — mirrors summonedAllyInfo's own
			// omit-when-empty treatment: only for the move that grants the override, and only once
			// an override is actually active, so no other move's own object literal in the
			// moveGroups toEqual snapshot needs to change.
			// Generalized to cover Chromatic Focus/Chromatic Reserves' own promptsApproachOverride
			// alongside Enduring Support's activatesApproachOverride - both write the same
			// system.attributes.approachOverride field, just with a different `period` (see
			// move-roll-mixin.js's _onMoveActivate). periodLabel surfaces which Refresh button
			// actually clears this override: Enduring Support's carries no `period` at all
			// (Sortie-scoped, cleared only by Refresh Sortie), Chromatic Focus/Reserves' always
			// carries "Scene" (cleared by Refresh Scene - see frames-mixin.js's _onRefreshScene).
			const approachOverride = this.actor.system.attributes?.approachOverride;
			const showsApproachOverrideInfo = move.activatesApproachOverride || move.promptsApproachOverride;
			const approachOverrideInfo = (showsApproachOverrideInfo && approachOverride?.approach)
				? {
					approachLabel: APPROACHES.find((a) => a.key === approachOverride.approach)?.label ?? approachOverride.approach,
					periodLabel: approachOverride.period === "Scene" ? "Refresh Scene" : "Refresh Sortie"
				}
				: null;
			return {
				key: move.key,
				name: move.name,
				traits,
				// True when a move normally rolls a stat trait but every one of those traits is
				// currently disabled for this actor (e.g. Weave Magic without Channel — a move
				// with no traits by design, like Help or Hinder, is never gated this way), OR
				// when the move is explicitly gated the opposite way, off Channel being enabled
				// (b-plot, via channelGated above), OR (Eidolon Drive) there's no bound ally to
				// summon at all (summonGated above), OR a different picked move explicitly disables
				// this one (Never Quite Free disabling Bite the Dust, via disabledBy above), OR
				// Chromatic Focus/Chromatic Reserves have nothing left to spend
				// (promptsApproachOverrideGated above), OR this move's own requiresMoves/requiresParts
				// isn't (or is no longer) satisfied (requirementTooltip above).
				gated: (move.traits.length > 0 && traits.length === 0) || channelGated || summonGated || approachOverrideGated
					|| promptsApproachOverrideGated || Boolean(disabledBy) || Boolean(requirementTooltip),
				// Whether this move rolls anything at all, based on its static definition rather
				// than the actor-filtered trait list above — a gated move (e.g. Weave Magic with
				// Channel disabled) still shows a disabled Roll button, but a move with no traits or
				// conditions by design (Subsystems, B-Plot) shows no Roll button at all. Draw Your
				// Bath And Load Your Gun (see playbook-moves.js) is the one exception: its own
				// `traits` is deliberately empty (see that move's own comment on why "home" can't
				// live there) and it grants itself +HOME via a self-targeting addsTraitToMove, so
				// rollable also checks for that grant — a real trait to roll, just not one recorded
				// on the move's own static traits array. A move with a non-empty fixedTraits (e.g.
				// I Know You's flat +3 FAMILIARITY, see playbook-moves.js) is likewise rollable
				// purely off that hardcoded entry — _moveTraits already merges fixedTraits into its
				// returned array unconditionally, so there's a real trait to roll here too, just
				// never one read off the actor.
				rollable: move.traits.length > 0
					|| Boolean(move.conditions)
					|| Boolean(move.fixedTraits?.length)
					|| resolvePlaybookMoves(this._playbookMoves())
						.some((m) => m.addsTraitToMove?.moveKey === move.key || m.addsTraitToMove?.moveKeys?.includes(move.key)),
				// Moves with a flat hold grant (B-Plot) show an Activate button in place of Roll —
				// see the template's rollable/activatable branch and _onMoveActivate. Divination
				// Codex's showsReadTheRoomQuestions and a move's own activateChoices (Bureaucrat,
				// Shree Klime) get the same button, for the same reason: no dice, just an action to
				// take.
				activatable: Boolean(move.flatHold)
					|| Boolean(move.showsReadTheRoomQuestions)
					|| Boolean(move.activateChoices)
					|| Boolean(move.activatesApproachOverride)
					|| Boolean(move.promptsApproachOverride),
				// Eidolon Drive's Summon button (Summoner) — replaces Roll/Activate in the template
				// exactly the way flatHold replaces Roll with Activate above; see summoner-mixin.js's
				// _onEidolonDriveSummon for the handler, and summonGated above for why it's disabled
				// with no bound ally.
				summonable: Boolean(move.summonsAlly),
				// See summonedAllyInfo above — omitted entirely (not `null`/`undefined`) for every
				// move but Eidolon Drive with a real summon active, so no other move's object
				// literal in the moveGroups toEqual snapshot needs to change.
				...(summonedAllyInfo && { summonedAllyInfo }),
				// See approachOverrideInfo above — same omit-when-empty treatment as summonedAllyInfo.
				...(approachOverrideInfo && { approachOverrideInfo }),
				// Hover explanation for why this move's Roll button is disabled — Bite the Dust's
				// "Replaced by Never Quite Free" (disabledBy above) and/or an unmet requiresMoves/
				// requiresParts (requirementTooltip above); a move could in principle hit both at
				// once, so both fragments are joined rather than one silently winning. Drives the
				// template's data-gate-tooltip attribute, the same CSS-only tooltip mechanism weapon
				// quick-roll buttons and the Witch's "Choose 2 Boons" button already use. Omitted
				// entirely (not `null`/`undefined`) for every other move, same conditional-spread
				// reasoning summonedAllyInfo above already follows.
				...((disabledBy || requirementTooltip) && {
					gatedTooltip: [disabledBy && `Replaced by ${disabledBy.name}`, requirementTooltip].filter(Boolean).join("; ")
				}),
				// Weave Magic's description stays readable even while its Roll button is gated —
				// you can still learn what the move does. B-Plot is different: being "in the
				// b-plot" isn't something a Channel-enabled character can do at all, so its
				// Description button greys out too, alongside Roll/Activate and the hold stepper.
				descriptionGated: channelGated,
				trackHold: Boolean(move.hold) || Boolean(move.flatHold),
				// Which stepper/handler the template wires up (_onHoldStep vs
				// _onFlatHoldStep) — see the hold comment above. separateHold routes to the same
				// per-move stepper as flatHold, even though it's still a roll-tiered grant.
				separateHoldPool: Boolean(move.flatHold) || Boolean(move.separateHold),
				hold,
				// Generic, per-move-key checkboxes for a "once per Sortie"/"once per Downtime" cap
				// (e.g. Cantrips' Seek Allies, Personal Familiar — see playbook-moves.js). Not
				// scoped to playbook moves: any move source can declare `uses` the same way `hold`
				// or `conditions` already work uniformly across all three. Stored separately from
				// hold/dangers/etc at system.attributes.moveUses, keyed by the move's own key, so
				// adding this never touches existing fields. Nothing ever clears these
				// automatically — there's no "start a new Sortie/Downtime" concept anywhere in this
				// module, so a checked box stays checked until the player unchecks it themselves,
				// same manual-tracking model as the Advancement checklist.
				uses: (move.uses ?? []).map((use) => ({
					key: use.key,
					label: use.label,
					checked: Boolean(this.actor.system.attributes?.moveUses?.[move.key]?.[use.key])
				})),
				// Let Loose's per-actor trait pick (see trait-bonuses.js's chooseTrait) — a small
				// select rendered on the move's own row (see the template) rather than a separate
				// dialog, the same "plain bound field, no picker" treatment the Cosmetic tab's
				// freeform fields get. Stored at system.attributes.traitBonusChoices.<moveKey>, kept
				// distinct from moveUses/moveHold the same way those two stay distinct from each
				// other — a different kind of per-move state.
				traitBonusChoosable: Boolean(move.traitBonus?.chooseTrait),
				traitBonusChoice: this.actor.system.attributes?.traitBonusChoices?.[move.key] ?? "",
				// Generic, per-move clamped numeric counters (e.g. Transmute Self's two alternate-set
				// trackers — see playbook-moves.js). Mirrors `uses`' per-move-key storage shape, but as a
				// bounded number rather than a boolean, at system.attributes.moveTrackers.<moveKey>.<trackerKey>.
				// The display fallback is usually 0 (starts-empty-and-fills, like every tracker except
				// Chromatic Reserves), but a `resetTo: "max"` tracker (ardent.js) starts full and
				// depletes, so a freshly-installed one with no stored value yet displays its max instead
				// of a misleading 0 before the player ever clicks Refresh Sortie.
				trackers: (move.numericTrackers ?? []).map((tracker) => ({
					key: tracker.key,
					label: tracker.label,
					min: tracker.min,
					max: tracker.max,
					value: this.actor.system.attributes?.moveTrackers?.[move.key]?.[tracker.key]
						?? (tracker.resetTo === "max" ? tracker.max : 0)
				})),
				// Plan & Prepare's own roll button (see SPECIAL_MOVES' variableDicePool) — omitted (not
				// `false`) for every other move, same reasoning as summonedAllyInfo/gatedTooltip above:
				// avoids touching every other move's entry in the moveGroups toEqual test for a flag
				// that, structurally, only one move in the game's content will ever set.
				...(move.variableDicePool && { variableDiceRoll: true })
			};
		});
	}
};
