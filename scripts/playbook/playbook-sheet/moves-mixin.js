import { choosePlaybookMove, resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { patronChannelBonus, traitBonusesFor } from "../../moves/trait-bonuses.js";
import { TRAITS } from "../../core/traits.js";
import { chooseCarrier, findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";
import { UNARMED, chooseWeapon } from "../../equipment/equipment.js";
import { findAstirPart } from "../../frames/astir.js";
import { rolledDoubles } from "../../moves/roll-effects.js";
import { chooseStartingMoves, findStartingMovePool } from "../../moves/starting-moves.js";
import {
	BASIC_MOVES,
	HOLD_MAX,
	HOLD_MIN,
	SPECIAL_MOVES,
	availableMoveTraits,
	configureMoveRoll,
	postGuidedResult,
	postMoveDescription,
	rollMove
} from "../../moves/moves.js";
import { resolveAstirParts } from "../../frames/astir.js";
import { ARDENT_DEFAULT_NAME, ARDENT_PART_CATALOG } from "../../frames/ardent.js";
import { ALL_MOVES } from "../../moves/all-moves.js";
import { DANGER_MAX } from "./tracking-mixin.js";

// Basic, Special and Playbook moves' shared roll pipeline (see claude.md's Moves sections) — move
// definitions themselves live in moves.js/playbook-moves.js/astir.js/ardent.js; this mixin owns
// resolving an actor's picked moves, deriving each move's render shape, and the Roll/Activate/
// Description handlers every move source shares.
export const MovesSheetMixin = {
	// Just the picked keys — the move definitions live in playbook-moves.js, so stored data never
	// goes stale against edited rules text. resolvePlaybookMoves drops keys that no longer match
	// a definition.
	_playbookMoves() {
		return this.actor.system.attributes?.playbookMoves ?? [];
	},
	// bite-the-dust's forcesDesperationAtMaxPerils reads this to decide whether the roll dialog's
	// Effect is locked to Desperation (see _onMoveRoll) — true only when every Danger slot is
	// full AND every one of those Dangers is a Peril, not just any Peril present.
	_allDangersArePeril() {
		const dangers = this._dangers();
		return dangers.length >= DANGER_MAX && dangers.every((danger) => danger.type === "peril");
	},
	// getData's moveGroups — Basic and Special moves are the same fixed list for every actor;
	// Playbook Moves is the per-actor set picked via the "+" button, so it's the only group that
	// renders add/remove controls (see the template's addable/removable branches). All three run
	// through the same _moveGroupMoves, so a picked move gets trait filtering, gating, hold tracking
	// and its Roll/Activate/Description buttons with no extra handling. Display order is basic,
	// then playbook, then Astir (if any), then each Ardent's own, then special — the character's own
	// moves read before the fixed reference lists, moveGroups[0] staying Basic for existing tests.
	//
	// astirParts/astirMove/frames/mountedFrame/ardents are computed once in getData (shared with the
	// Astir/Ardent/Equipment data methods) and passed in here rather than recomputed. The "+ Choose
	// Starting Moves" button (see PlaybookActorSheet#_onStartingMovesAdd) shows up whenever its
	// playbook's pool has something to offer AND the actor currently has no playbook moves at all —
	// same "drop when empty" treatment equipment's startingGear.available already gets, so Commander/
	// Impostor stay hidden until their pools are filled in (see starting-moves.js). This is a live
	// emptiness check, not a one-time flag: cancelling the picker leaves the button available to
	// retry, and removing every playbook move via "-" brings it back.
	_movesData(astirParts, astirMove, mountedFrame, ardents, startingMovePool) {
		const moveGroups = [
			{ label: "Basic Moves", moves: this._moveGroupMoves(BASIC_MOVES) },
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
		// group renders no add/remove controls of its own. Inserted here (rather than always
		// pushed) so it lands between Playbook and Special per the ordering above, and only when
		// there's something to show — a character with no Astir (or an empty one) leaves moveGroups
		// exactly as it was before this feature existed. Each Ardent's own installed parts get the
		// same read-only treatment in their own "<name> Moves" group, right after the Astir's —
		// Ardents grant no unique Move (see claude.md's Ardents section), so an Ardent's group is
		// parts-only.
		const astirMoves = [...astirParts, ...(astirMove ? [astirMove] : [])];
		if (astirMoves.length) {
			// Every entry in this group — parts and the Astir's own unique move alike — only does
			// anything while the Astir specifically is the mounted frame (see claude.md's Piloted
			// note), so `gated` is forced on top of whatever gating a part already has, the same
			// disabled-Roll/Activate treatment channelGated already gives b-plot.
			moveGroups.push({
				label: "Astir Moves",
				moves: this._moveGroupMoves(astirMoves).map((move) => ({ ...move, gated: move.gated || mountedFrame?.id !== "astir" }))
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
		moveGroups.push({ label: "Special Moves", moves: this._moveGroupMoves(SPECIAL_MOVES) });
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
		const channelDisabled = Boolean(this.actor.system.stats?.channel?.disabled);
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
			return {
				key: move.key,
				name: move.name,
				traits,
				// True when a move normally rolls a stat trait but every one of those traits is
				// currently disabled for this actor (e.g. Weave Magic without Channel — a move
				// with no traits by design, like Help or Hinder, is never gated this way), OR
				// when the move is explicitly gated the opposite way, off Channel being enabled
				// (b-plot, via channelGated above).
				gated: (move.traits.length > 0 && traits.length === 0) || channelGated,
				// Whether this move rolls anything at all, based on its static definition rather
				// than the actor-filtered trait list above — a gated move (e.g. Weave Magic with
				// Channel disabled) still shows a disabled Roll button, but a move with no traits or
				// conditions by design (Subsystems, B-Plot) shows no Roll button at all.
				rollable: move.traits.length > 0 || Boolean(move.conditions),
				// Moves with a flat hold grant (B-Plot) show an Activate button in place of Roll —
				// see the template's rollable/activatable branch and _onMoveActivate. Divination
				// Codex's showsReadTheRoomQuestions and a move's own activateChoices (Bureaucrat,
				// Shree Klime) get the same button, for the same reason: no dice, just an action to
				// take.
				activatable: Boolean(move.flatHold)
					|| Boolean(move.showsReadTheRoomQuestions)
					|| Boolean(move.activateChoices),
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
				trackers: (move.numericTrackers ?? []).map((tracker) => ({
					key: tracker.key,
					label: tracker.label,
					min: tracker.min,
					max: tracker.max,
					value: this.actor.system.attributes?.moveTrackers?.[move.key]?.[tracker.key] ?? 0
				}))
			};
		});
	},
	// Shared by getData (for sheet rendering) and _onMoveRoll (for the roll dialog) so a
	// trait's current value is only ever read from the actor in one place. fixedTraits (e.g. Lead
	// a Sortie's CREW) are appended as-is — never looked up on the actor — since they don't
	// correspond to any TRAITS entry or system.stats key. CREW is the one exception: its static
	// placeholder value gets overwritten with a live read off whichever Carrier actor exists in
	// the world (see _crewFixedTraitValue) — with zero or more than one Carrier, this resolves to
	// 0 for display purposes; a roll in progress resolves the ambiguous multiple-Carrier case for
	// real via a prompt (see _rollMove).
	_moveTraits(move) {
		// Folded straight into each entry's `value` (rather than a separate field) so the roll
		// dialog's own trait select shows the real, bonus-inclusive number a player would actually
		// roll with — the same total getData's own Traits panel displays (see "Trait bonus
		// display"). An actor with no traitBonus moves picked resolves every bonus to 0, leaving
		// this identical to before the feature existed.
		const traitBonuses = this._traitBonuses();
		const actorTraits = availableMoveTraits(this.actor, move).map((trait) => ({
			key: trait.key,
			label: trait.label,
			value: (this.actor.system.stats?.[trait.key]?.value ?? 0) + (traitBonuses[trait.key] ?? 0)
		}));
		// Input Channel (see astir.js) offers +CHANNEL on any move, bypassing both that move's own
		// traits list and Channel's disabled gate — only while installed on the currently mounted
		// frame (Astir or Ardent alike — see _mountedParts), and only added once (a move that
		// already rolls +CHANNEL, e.g. Weave Magic, isn't given a second entry).
		if (!actorTraits.some((trait) => trait.key === "channel")
			&& this._mountedParts().some((part) => part.grantsChannelOnAnyMove)) {
			// TRAITS is a fixed, six-entry constant (see traits.js) that always includes channel —
			// no fallback needed for a lookup that can't fail.
			const channel = TRAITS.find((trait) => trait.key === "channel");
			actorTraits.push({
				key: channel.key,
				label: channel.label,
				value: (this.actor.system.stats?.channel?.value ?? 0) + (traitBonuses.channel ?? 0)
			});
		}
		// Facilitator's "you may read the room with +TALK" (see playbook-moves.js's addsTraitToMove).
		// The counterpart to _grantedTraitForMove, and deliberately the opposite operation:
		// grantsTraitOnMove *locks* the roll dialog to a trait the target move already offers, so it
		// can only ever narrow an existing choice; this *adds* an option the move never had, matching
		// the rulebook's "you may" framing. Same resolve-off-picked-moves shape as the grants* trio,
		// and the same add-once guard the Input Channel block above uses. `moveKey` (a single target,
		// e.g. Ascension's own bite-the-dust grant) and `moveKeys` (an array, e.g. Turn Unearthly
		// adding CHANNEL to both Exchange Blows and Strike Decisively at once) are both accepted —
		// the two forms only ever differ in whether one move's trait grant reaches one or several
		// target moves, so this is a single find matching either shape rather than two separate paths.
		const addedTraitKey = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => {
				const grant = m.addsTraitToMove;
				return grant?.moveKey === move.key || grant?.moveKeys?.includes(move.key);
			})?.addsTraitToMove.trait ?? null;
		if (addedTraitKey && !actorTraits.some((trait) => trait.key === addedTraitKey)) {
			// TRAITS is a fixed, six-entry constant (see traits.js), and playbook-moves.test.js
			// asserts every addsTraitToMove names a real key — no fallback needed here.
			const added = TRAITS.find((trait) => trait.key === addedTraitKey);
			actorTraits.push({
				key: added.key,
				label: added.label,
				value: (this.actor.system.stats?.[added.key]?.value ?? 0) + (traitBonuses[added.key] ?? 0)
			});
		}
		const fixedTraits = (move.fixedTraits ?? []).map((trait) => (
			trait.key === "crew" ? { ...trait, value: this._crewFixedTraitValue() } : trait
		));
		return [...actorTraits, ...fixedTraits];
	},
	// The single-Carrier case _moveTraits needs for display, and _rollMove's starting point
	// before it decides whether the multi-Carrier prompt is even necessary.
	_crewFixedTraitValue() {
		const carriers = findCarrierActors();
		return carriers.length === 1 ? carriers[0].system.stats?.crew?.value ?? 0 : 0;
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
	// their tokens aren't tracked anywhere in this module — see claude.md's "systems that do not
	// exist yet").
	_grantedTraitForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsTraitOnMove?.moveKey === move.key);
		return granting?.grantsTraitOnMove.trait ?? null;
	},
	// The Advantage-axis counterpart to _grantedEffectForMove — Don't Follow Me additionally locks
	// the roll dialog's Dice select the same way a lockedEffect locks Effect (see
	// PlaybookActorSheet#_rollMove/moves.js#configureMoveRoll), though an Astir Part's own reactive
	// spend.advantage (Artifact) still wins over it.
	_grantedAdvantageForMove(move) {
		const granting = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => m.grantsAdvantageOnMove?.moveKey === move.key);
		return granting?.grantsAdvantageOnMove.advantage ?? null;
	},
	// Every move flagged grantsAutomaticSuccess (Hot-blooded, Once the War's Over, The Arity
	// Method — see playbook-moves.js) can spend its own hold pool or `uses` checkbox to treat the
	// move currently being rolled as a success, matching each move's own "succeed as if you'd
	// rolled a 10+" text. Unlike a reroll tag or an equipment spend, this isn't tied to the weapon
	// being used — it's actor-wide, so every flagged move (not just ones on this actor's picked
	// pools — a hold/uses value can only be non-zero if the move was actually picked and activated,
	// so there's nothing to additionally check there) is considered fresh for every roll. `moves`
	// (The Arity Method) restricts the offer to specific move keys, the same field/meaning as
	// equipment.js's own reroll.moves.
	_availableAutomaticSuccess(move) {
		return ALL_MOVES
			.filter((m) => m.grantsAutomaticSuccess)
			.filter((m) => !m.grantsAutomaticSuccess.moves || m.grantsAutomaticSuccess.moves.includes(move.key))
			.filter((m) => {
				const { cost, useKey } = m.grantsAutomaticSuccess;
				return useKey
					? !this.actor.system.attributes?.moveUses?.[m.key]?.[useKey]
					: (this.actor.system.attributes?.moveHold?.[m.key]?.value ?? 0) >= cost;
			})
			.map((m) => ({ key: m.key, name: m.name, ...m.grantsAutomaticSuccess }));
	},
	_onHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.resources?.hold?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.resources.hold.value": next });
	},
	_onFlatHoldStep(event) {
		const { move: key, delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.moveHold?.[key]?.value ?? 0;
		const next = Math.min(HOLD_MAX, Math.max(HOLD_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.attributes.moveHold.${key}.value`]: next });
	},
	// Generic per-move clamped numeric tracker (e.g. Transmute Self's two alternate-set trackers —
	// see playbook-moves.js's numericTrackers). Mirrors _onFlatHoldStep's clamp shape, but bounded
	// by the tracker's own min/max (from its dataset, sourced from the move definition) rather than
	// the fixed HOLD_MIN/HOLD_MAX.
	_onMoveTrackerStep(event) {
		const { move: moveKey, tracker: trackerKey, delta, min, max } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.moveTrackers?.[moveKey]?.[trackerKey] ?? 0;
		const next = Math.min(Number(max), Math.max(Number(min), current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.attributes.moveTrackers.${moveKey}.${trackerKey}`]: next });
	},
	// A plain boolean toggle, same shape as _onOverheatingToggle/_onAdvancementToggle — a "uses"
	// checkbox has no min/max to clamp, unlike Hold or Spotlight's stepped tracks.
	_onMoveUseToggle(event) {
		const { move: moveKey, use: useKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.moveUses.${moveKey}.${useKey}`]: event.currentTarget.checked });
	},
	// Let Loose's per-actor trait pick (see _moveGroupMoves' traitBonusChoosable/traitBonusChoice
	// and trait-bonuses.js's chooseTrait) — every option in the select is a real TRAITS key or the
	// blank "—" option, so nothing here needs to validate the value before writing it.
	_onTraitBonusChoiceChange(event) {
		const { move: moveKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.traitBonusChoices.${moveKey}`]: event.currentTarget.value });
	},
	// The "+" on the Playbook Moves section. The picker is passed the actor's playbook name (so it
	// knows which pool is "yours") and its current picks (so an already-taken move isn't offered
	// again) — see playbookMoveSections. It resolves null on cancel, on close, and when the dialog
	// was confirmed with nothing selected.
	async _onPlaybookMoveAdd() {
		const current = this._playbookMoves();
		const key = await choosePlaybookMove(this.actor.system.playbook?.name, current);
		if (!key || current.includes(key)) return;

		await this.actor.update({ "system.attributes.playbookMoves": [...current, key] });
	},
	_onPlaybookMoveRemove(event) {
		const { move: key } = event.currentTarget.dataset;
		const current = this._playbookMoves();
		if (!current.includes(key)) return;

		this.actor.update({ "system.attributes.playbookMoves": current.filter((k) => k !== key) });
	},
	// The "+ Choose Starting Moves" button (see getData's startingMovesAvailable). Availability is
	// a live emptiness check, not a one-time flag — cancelling the picker (or picking nothing)
	// leaves the actor's playbookMoves untouched, so the button stays available to try again.
	async _onStartingMovesAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingMovePool(playbookName);
		// Mirrors getData's startingMovesAvailable gate — a pool with nothing to offer at all (e.g.
		// The Commander today) never reaches the button in the first place, but guarding here too
		// keeps this a true no-op.
		if (!pool || (!pool.grantedKeys.length && !pool.pickOneKeys.length && !pool.chooseCount)) return;

		// The dialog always opens once there's anything at all to show (guarded above) — even a
		// grantedKeys-only pool (Arcane Augments) still gets a confirmation screen naming what the
		// player is receiving, rather than silently writing it the moment the button is clicked.
		// Granted moves are added unconditionally regardless of what the dialog resolves, same as
		// chooseStartingGear's own granted items above.
		const picked = await chooseStartingMoves(playbookName);
		const current = this._playbookMoves();
		const additions = [...pool.grantedKeys, ...(picked ?? [])].filter((key) => !current.includes(key));

		if (!additions.length) return;
		await this.actor.update({ "system.attributes.playbookMoves": [...current, ...additions] });
	},
	async _onMoveRoll(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		// usesWeapon (Exchange Blows, Strike Decisively — see moves.js) prompts which weapon (or
		// Unarmed) before rolling, so _rollMove's equipment spends can be scoped to it. `weapon`
		// stays undefined for every other move — the same "not applicable" signal
		// _equipmentSpends already reads. Skipped entirely when the actor has no weapons at all:
		// there's nothing to choose between, so Unarmed is simply true.
		//
		// Only weapons belonging to the currently mounted frame are offered (see claude.md's Piloted
		// note): the Astir's own weapons while it's mounted, one specific Ardent's while that Ardent
		// is mounted, mundane weapons while nothing is — never more than one of the three. A weapon
		// on the wrong side can never become `weapon` here, so nothing downstream (including the
		// Familiar +CHANNEL override below) needs to re-check mounted state itself.
		let weapon;
		if (move.usesWeapon) {
			const mountedFrameId = this._mountedFrame()?.id ?? null;
			const weapons = this._weapons().filter((w) => this._weaponFrameId(w) === mountedFrameId);
			if (weapons.length) {
				const weaponId = await chooseWeapon(weapons);
				if (weaponId === null) return;
				weapon = weaponId === UNARMED ? null : weapons.find((w) => w.id === weaponId) ?? null;
			} else {
				weapon = null;
			}
		}

		await this._rollMove(move, weapon);
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
	async _rollMove(move, weapon) {
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
		// Piloted state (see claude.md's Piloted note) — so there's nothing to re-check here.
		if (move.usesWeapon && weapon?.familiar) {
			traits = [{ key: "channel", label: "CHANNEL", value: this.actor.system.stats?.channel?.value ?? 0 }];
		}
		if (!traits.length && !move.conditions) return;

		// bite-the-dust's forcesDesperationAtMaxPerils wins ties over a forced weapon tag — both
		// only ever lock to Desperation today, so there's nothing to actually conflict, but the
		// precedence keeps a future second forcesEffect value from silently overriding
		// bite-the-dust's danger-state read. Field Scout's standing grantsEffectOnMove (see
		// _grantedEffectForMove) sits last: it's a permanent grant rather than either of the other
		// two's emergency/reactive lock, so anything already forcing an axis wins over it.
		const forced = this._forcedWeaponEffect(weapon);
		const lockedEffect = (move.forcesDesperationAtMaxPerils && this._allDangersArePeril() ? "desperation" : null)
			?? forced?.effect
			?? this._grantedEffectForMove(move)
			?? null;
		// Don't Follow Me's own pair — see _grantedTraitForMove/_grantedAdvantageForMove. The
		// granted trait key is resolved against this roll's own final `traits` list (rather than
		// TRAITS directly) so the locked option carries the same live, bonus-inclusive value every
		// other entry in the dialog does; a key that isn't actually offered here (e.g. the trait is
		// disabled for this actor) resolves to no lock at all.
		const grantedTraitKey = this._grantedTraitForMove(move);
		const lockedTrait = grantedTraitKey ? traits.find((t) => t.key === grantedTraitKey) ?? null : null;
		const lockedAdvantage = this._grantedAdvantageForMove(move);
		const equipmentSpends = this._equipmentSpends(lockedEffect, weapon);
		const astirPartSpends = this._astirPartSpends(lockedEffect);
		// Omitted entirely rather than passed as `false` when not guided — configureMoveRoll
		// already defaults it to false itself, and this keeps every non-Guided call's options
		// shape exactly as it was before Guided existed, same treatment `reroll` gets below. Spell
		// Routines (see astir.js) grants the same "Take 7-9" option for any move, not just a
		// weapon carrying the Guided tag — but only while installed on the currently mounted frame
		// (see claude.md's Piloted note). Spell Routines carries a powerCost, so it can only ever
		// be installed on the Astir, never an Ardent (see ardent.js's ardentParts) — but this reads
		// generically off _mountedParts() rather than special-casing the Astir, the same convention
		// every other reactive part effect in this file follows.
		const guided = this._weaponIsGuided(weapon) || this._mountedParts().some((part) => part.grantsGuided);
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
			await this._onMoveResolved(move, null);
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
		const baseOptions = {
			...config,
			...(traitBonus && { traitBonus }),
			...(spentPartLabels.length && { spentPartLabels }),
			...(automaticSuccess.length && { automaticSuccess })
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
		await this._onMoveResolved(move, result.dice);
	},
	// Runs after a move resolves — whether via a real roll (dice present) or Guided's "Take 7-9"
	// (dice null). The Witch's Patron ("offers you two boons at random whenever someone leads a
	// Sortie") is checked first and unconditionally, before the mounted-frame early-return below —
	// unlike Potions/doubles-regen (Astir Part effects, gated on the Astir specifically being
	// mounted), Patron is a base playbook feature that doesn't care whether — or which — frame is
	// mounted.
	async _onMoveResolved(move, dice) {
		if (move.key === "lead-a-sortie"
				&& resolvePlaybookMoves(this._playbookMoves()).some((m) => m.key === "the-witch:patron")) {
			await this._grantRandomWitchBoons();
		}
		// The two Astir Part effects below react to a move's outcome rather than being offered as part
		// of setting it up. Both are scoped to the mounted frame's own parts (see claude.md's Piloted
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
		}
	},
	async _onMoveDescription(event) {
		const move = ALL_MOVES.find((m) => m.key === event.currentTarget.dataset.move);
		if (!move) return;

		await postMoveDescription(this.actor, move);
	}
};
