import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { TRAITS } from "../../core/traits.js";
import { findCarrierActors } from "../../world-actors/carrier-actor-sheet.js";
import { availableMoveTraits } from "../../moves/moves.js";

// Resolving which traits a given move can actually roll for this actor — see moves-mixin.js's file
// comment for how this file relates to its siblings in this directory.
export const MoveTraitsSheetMixin = {
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
		// Eidolon Drive's summoned ally (Summoner) — offered on every move, not scoped to this move's
		// own declared traits, mirroring the rules text ("you may immediately make a move using their
		// approach and trait at +3 [then] access to their trait at +1 ... for the rest of the
		// Scene"). Unconditional, like the Input Channel/Love Love Love pushes below, but placed
		// first since it isn't gated on this move rolling any particular trait at all — see
		// summoner-mixin.js for the write side (_onEidolonDriveSummon/_consumeEidolonDriveBonus).
		const eidolonDrive = this._eidolonDrive();
		const summonedAlly = this._summonedAlly();
		if (summonedAlly) {
			const traitLabel = TRAITS.find((trait) => trait.key === summonedAlly.trait)?.label ?? summonedAlly.trait;
			actorTraits.push({
				key: "eidolon-drive-ally",
				label: `${summonedAlly.name || "Summoned Ally"} (${traitLabel})`,
				value: eidolonDrive.bonusUsed ? 1 : 3
			});
		}
		// Input Channel (see astir.js) offers +CHANNEL on any move, bypassing both that move's own
		// traits list and Channel's disabled gate — only while installed on the currently mounted
		// frame (Astir or Ardent alike — see _mountedParts), and only added once (a move that
		// already rolls +CHANNEL, e.g. Weave Magic, isn't given a second entry). Arcane Generator
		// (see playbook-moves.js) grants the same push from a picked playbook move rather than
		// installed hardware, but its own rules text is Astir-specific ("you may power and control
		// an Astir ... you effectively have a CHANNEL of +1") — unlike Input Channel, which works
		// from any mounted frame, Arcane Generator only applies while the Astir itself is mounted.
		if (!actorTraits.some((trait) => trait.key === "channel")
			&& (this._mountedParts().some((part) => part.grantsChannelOnAnyMove)
				|| (this._mountedFrame()?.kind === "astir"
					&& resolvePlaybookMoves(this._playbookMoves()).some((m) => m.grantsChannelOnAnyMove)))) {
			// TRAITS is a fixed, six-entry constant (see traits.js) that always includes channel —
			// no fallback needed for a lookup that can't fail.
			const channel = TRAITS.find((trait) => trait.key === "channel");
			actorTraits.push({
				key: channel.key,
				label: channel.label,
				value: (this.actor.system.stats?.channel?.value ?? 0) + (traitBonuses.channel ?? 0)
			});
		}
		// Love, Love, Love — "instead of a +CHANNEL trait ... treated as your +CHANNEL trait in all
		// circumstances" (see playbook-moves.js). Adrift's own CHANNEL stat is always disabled, so
		// this generically fills the resulting gap on any move that already lists channel among its
		// traits — no per-move addsTraitToMove grant needed on every existing channel-using move.
		if (move.traits.includes("channel")
				&& !actorTraits.some((trait) => trait.key === "home")
				&& this._homeMove()) {
			actorTraits.push(this._homeTraitOption());
		}
		// Facilitator's "you may read the room with +TALK" (see playbook-moves.js's addsTraitToMove).
		// Deliberately the opposite operation from Field Scout's grantsEffectOnMove (see
		// _grantedEffectForMove): that flag *locks* the roll dialog to a value the target move already
		// offers, so it can only ever narrow an existing choice; this *adds* an option the move never
		// had, matching the rulebook's "you may" framing. Same resolve-off-picked-moves shape,
		// and the same add-once guard the Input Channel block above uses. `moveKey` (a single target,
		// e.g. Ascension's own bite-the-dust grant) and `moveKeys` (an array, e.g. Turn Unearthly
		// adding CHANNEL to both Exchange Blows and Strike Decisively at once) are both accepted —
		// the two forms only ever differ in whether one move's trait grant reaches one or several
		// target moves, so this is a single find matching either shape rather than two separate paths.
		// `requiresUnmounted` (The Old Blood only, whose own text restricts the grant to "outside your
		// Astir") drops a candidate whenever a frame is currently mounted — Turn Unearthly's identical
		// shape has no such restriction in its text, so it omits the flag and is unaffected.
		// `requiresAstirMounted` (Walk-on Part In The War — "while piloting your Astir") is the
		// opposite polarity, and specifically the Astir: an Ardent mounted instead doesn't count.
		// `chooseMove` (Classical Spellcasting — "choose a Basic Move") is a third target form
		// alongside `moveKey`/`moveKeys`, matching against a per-actor stored choice
		// (system.attributes.addsTraitToMoveChoices.<grantingMoveKey>, written by
		// _onAddsTraitToMoveChoiceChange — move-tracking-mixin.js) instead of a static catalog key,
		// the same "declare a choosable field, resolve generically" shape trait-bonuses.js's own
		// chooseTrait already uses for traitBonus.
		const addedTraitKey = resolvePlaybookMoves(this._playbookMoves())
			.find((m) => {
				const grant = m.addsTraitToMove;
				if (!grant) return false;
				if (grant.requiresUnmounted && this._mountedFrame()) return false;
				if (grant.requiresAstirMounted && this._mountedFrame()?.kind !== "astir") return false;
				if (grant.chooseMove) return this.actor.system.attributes?.addsTraitToMoveChoices?.[m.key] === move.key;
				return grant.moveKey === move.key || grant.moveKeys?.includes(move.key);
			})?.addsTraitToMove.trait ?? null;
		if (addedTraitKey && !actorTraits.some((trait) => trait.key === addedTraitKey)) {
			// "home" is the one addsTraitToMove target that isn't a real TRAITS key — see home-mixin.js's
			// file-level comment: it's a virtual trait with a dynamically-computed value (this actor's own
			// +HOME clock), not a real actor stat backed by TRAITS/system.stats, so it can't go through the
			// TRAITS.find lookup below (Walk-on Part In The War, Lead Role In A Cage, Draw Your Bath And
			// Load Your Gun — see playbook-moves.js).
			if (addedTraitKey === "home") {
				actorTraits.push(this._homeTraitOption());
			} else {
				// TRAITS is a fixed, six-entry constant (see traits.js), and playbook-moves.test.js
				// asserts every addsTraitToMove names a real key — no fallback needed here.
				const added = TRAITS.find((trait) => trait.key === addedTraitKey);
				actorTraits.push({
					key: added.key,
					label: added.label,
					value: (this.actor.system.stats?.[added.key]?.value ?? 0) + (traitBonuses[added.key] ?? 0)
				});
			}
		}
		const fixedTraits = (move.fixedTraits ?? []).map((trait) => {
			if (trait.key === "crew") return { ...trait, value: this._crewFixedTraitValue() };
			if (trait.key === "familiarity") return { ...trait, value: this._familiarityValue() };
			return trait;
		});
		// Crew Support's own hold-gated universal CREW option (see special-moves.js/moves-mixin.js's
		// _crewSupportHold) — runs for every move (basic, special, playbook, Astir/Ardent alike)
		// since this is the one shared resolver all of them go through, which is intentional: the
		// move's own text is "spend it 1-for-1 to roll ANY move with +CREW." A distinct key
		// (crew-support-crew, not crew) lets move-roll-mixin.js's _finishMoveRoll tell "this roll
		// spent Crew Support's hold" apart from a move that already always offers CREW for free
		// (Lead a Sortie's own fixedTraits entry, guarded against here via the !fixedTraits.some(...)
		// check below so the two options never both appear on the same roll). There's no equivalent
		// actorTraits-side guard: "crew" is never a real TRAITS entry (see traits.js), so
		// availableMoveTraits/the addsTraitToMove paths above can never populate actorTraits with one.
		// The Captain's own In Command move grants this same substitution with no hold cost at all
		// ("you may do this any number of times" — see moves-mixin.js's _hasUnlimitedCrewSupport),
		// so a Captain sees the option regardless of banked hold, labeled for the ability that's
		// actually granting it rather than implying a spend that never happens.
		const unlimitedCrew = this._hasUnlimitedCrewSupport();
		if ((this._crewSupportHold() > 0 || unlimitedCrew) && !fixedTraits.some((trait) => trait.key === "crew")) {
			return [...actorTraits, ...fixedTraits, {
				key: "crew-support-crew",
				label: unlimitedCrew ? "CREW (In Command)" : "CREW (Crew Support)",
				value: this._crewFixedTraitValue()
			}];
		}
		return [...actorTraits, ...fixedTraits];
	},
	// The single-Carrier case _moveTraits needs for display, and _rollMove's starting point
	// before it decides whether the multi-Carrier prompt is even necessary.
	_crewFixedTraitValue() {
		const carriers = findCarrierActors();
		return carriers.length === 1 ? carriers[0].system.stats?.crew?.value ?? 0 : 0;
	},
	// I Know You's FAMILIARITY (see playbook-moves.js's grantsFamiliarityTrait) — overrides the
	// move's static +3 fixedTraits placeholder with a live read off the actor's own familiarity
	// stat, the same override _moveTraits already applies for CREW above. 3 is the same starting
	// value the static placeholder carried, so an actor who hasn't touched the new stepper yet
	// still rolls exactly what they always did.
	_familiarityValue() {
		return this.actor.system.stats?.familiarity?.value ?? 3;
	}
};
