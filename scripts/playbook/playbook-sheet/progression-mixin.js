import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { TRAITS } from "../../core/traits.js";
import { APPROACHES } from "../../core/approaches.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../advancements.js";
import { resolveAstirParts } from "../../frames/astir.js";
import { ARDENT_PART_CATALOG } from "../../frames/ardent.js";

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

export const SPOTLIGHT_MIN = 0;
export const SPOTLIGHT_MAX = 6;

// Downtime Tokens (Downtime tab): a per-Sortie resource refreshed to _downtimeTokensMax() by the
// Refresh Sortie control (see _onRefreshSortie). DOWNTIME_TOKENS_MAX_BASE (2) is the floor every
// character starts with; a picked move can raise it via its own declarative downtimeTokensMax flag
// (Commander's Debrief: 4 total) — see _downtimeTokensMax, which takes the max across picked moves
// the same way _conflictTier takes the max across conflictTier flags.
const DOWNTIME_TOKENS_MIN = 0;
const DOWNTIME_TOKENS_MAX_BASE = 2;

// A character's Tier for all physical-conflict purposes is 1 by default unless a picked playbook
// move raises it (Field Scout, Giant Slayer — see playbook-moves.js's conflictTier). Deliberately
// its own constant rather than reusing equipment's TIER_MIN or the Astir's own ASTIR_TIER_MIN —
// astir.js keeps those two bands from drifting into each other; a character's on-foot Tier is a
// third, independent band (see claude.md's Character Tier notes).
const CHARACTER_TIER_DEFAULT = 1;

// How many of the six top Advancement checklist items unlock the bottom four (see advancements.js).
export const ADVANCEMENT_UNLOCK_THRESHOLD = 3;

// Character Tier, Downtime Tokens, and Advancement — the character-progression trackers (see
// claude.md's Character Tier notes and Advancement checklist).
export const ProgressionSheetMixin = {
	// This character's Tier for all physical-conflict purposes (see claude.md's Character Tier
	// notes) — derived fresh every call, never stored, so Mount Up/Dismount and every frame's own
	// Piloted checkbox all move it for free through the single _setMountedFrame write path, with
	// nothing to re-sync (same reasoning equipmentValue/advancements.topCount already establish for
	// other always-derived numbers). `base` is CHARACTER_TIER_DEFAULT unless a picked playbook move
	// raises it via conflictTier (Field Scout II, Giant Slayer III) — max wins if somehow both are
	// picked, since "pick either" is exactly as unenforced as every other pool restriction in this
	// module (see playbook-moves.js's own top comment). `bonus` (Commander's Ace Crew: "your tier...
	// counts as one higher than whatever it would normally be") is a flat +N added on top of
	// whichever of base/frame Tier is currently active, summed across picked moves rather than
	// maxed like conflictTier — Ace Crew is the only source today, but nothing stops two sources
	// stacking the way conflictTier's "pick either" deliberately doesn't. While a frame is mounted,
	// `effective` is that frame's own Tier (plus bonus) instead of `base` — on dismount it reverts.
	_conflictTier() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		const base = picked.reduce((max, move) => Math.max(max, move.conflictTier ?? 0), CHARACTER_TIER_DEFAULT);
		const bonus = picked.reduce((sum, move) => sum + (move.tierBonus ?? 0), 0);
		const frame = this._mountedFrame();
		if (frame) {
			return { base: base + bonus, effective: frame.tier + bonus, fromFrame: true, frameName: frame.name };
		}
		return { base: base + bonus, effective: base + bonus, fromFrame: false };
	},
	// The Approach counterpart to _conflictTier's own frame-fallback pattern — while a frame is
	// mounted, `effective` is that frame's own Approach instead of the character's persisted one,
	// since a target-matchup Effect roll (see moves-mixin.js's _targetMatchupEffect) needs to
	// compare whichever Approach is actually fighting, the same reasoning that already drives Tier.
	// Unlike Tier, which always has a numeric default (CHARACTER_TIER_DEFAULT) and so never needs to
	// fall through, a frame's own Approach can be unset ("") — an Astir/Ardent doesn't require one
	// to be created — so this falls back to `base` in that case rather than reporting `fromFrame`.
	_effectiveApproach() {
		const base = this.actor.system.attributes?.approach ?? "";
		const frame = this._mountedFrame();
		if (frame?.approach) {
			return {
				base,
				effective: frame.approach,
				effectiveLabel: APPROACHES.find((a) => a.key === frame.approach)?.label ?? frame.approach,
				fromFrame: true,
				frameName: frame.name
			};
		}
		// Signed & Sealed (The Attendant): "your approach on foot becomes profane" — resolved
		// generically off any picked move's own grantsApproachOverride flag, the same declarative-
		// flag-evaluated-in-the-sheet convention every other cross-cutting move flag in this file
		// follows, rather than hardcoding the move's key. Only reached once no frame is mounted, since
		// a mounted frame's own Approach already takes precedence above.
		const picked = resolvePlaybookMoves(this._playbookMoves());
		// Enduring Support (The Summoner): a *dynamic* per-roll override, snapshotted at Activate
		// time (see moves-mixin.js's _onMoveActivate) into system.attributes.approachOverride, rather
		// than a fixed catalog value like grantsApproachOverride below — so it's checked first, off
		// the actual stored snapshot rather than the move's own static data. Still requires the
		// granting move to currently be picked, so removing Enduring Support can't leave a stale
		// override in effect — the same defensive stance _summonedAlly() already takes for a stale id.
		const dynamicOverrideMove = picked.find((move) => move.activatesApproachOverride);
		const approachOverride = this.actor.system.attributes?.approachOverride;
		if (dynamicOverrideMove && approachOverride?.approach) {
			return {
				base,
				effective: approachOverride.approach,
				effectiveLabel: APPROACHES.find((a) => a.key === approachOverride.approach)?.label ?? approachOverride.approach,
				fromFrame: false,
				fromMove: true,
				moveName: dynamicOverrideMove.name
			};
		}
		const overrideMove = picked.find((move) => move.grantsApproachOverride);
		if (overrideMove) {
			const override = overrideMove.grantsApproachOverride;
			return {
				base,
				effective: override,
				effectiveLabel: APPROACHES.find((a) => a.key === override)?.label ?? override,
				fromFrame: false,
				fromMove: true,
				moveName: overrideMove.name
			};
		}
		return { base, effective: base, effectiveLabel: APPROACHES.find((a) => a.key === base)?.label ?? base, fromFrame: false };
	},
	// Downtime Tokens' effective max (see getData's downtimeTokens, _onDowntimeTokensStep,
	// _onRefreshSortie) — DOWNTIME_TOKENS_MAX_BASE unless a picked move raises it via its own
	// declarative downtimeTokensMax flag (Commander's Debrief: 4 total), taking the max across
	// picked moves the same way _conflictTier's own base does for conflictTier.
	_downtimeTokensMax() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		return picked.reduce((max, move) => Math.max(max, move.downtimeTokensMax ?? 0), DOWNTIME_TOKENS_MAX_BASE);
	},
	_advancements() {
		return this.actor.system.attributes?.advancements ?? {};
	},
	// getData's Traits panel — value/bonus/total per TRAITS entry. traitBonuses (Arcane Augments,
	// Let Loose — see trait-bonuses.js) is recomputed fresh here rather than threaded in from
	// getData, since nothing else in getData needs this actor's trait bonuses.
	_traitsData() {
		const traitBonuses = this._traitBonuses();
		// Eidolon Drive's summoned-ally annotation (Summoner — see moves-mixin.js's identical
		// summonedAllyInfo.value computation on the move card) — the trait row matching the
		// summoned ally's own trait key additionally shows what that ally currently grants, at +3
		// before the bonus is used on a roll and +1 after. Resolved once here rather than per-trait,
		// since at most one TRAITS entry can ever match (_summonedAlly returns a single ally, if any).
		const summonedAlly = this._summonedAlly();
		const traits = TRAITS.map(({ key, label }) => {
			const stat = this.actor.system.stats?.[key];
			const value = stat?.value ?? 0;
			const bonus = traitBonuses[key] ?? 0;
			const allyBonus = summonedAlly?.trait === key ? (this._eidolonDrive().bonusUsed ? 1 : 3) : null;
			return {
				key,
				label,
				value,
				bonus,
				total: value + bonus,
				disabled: stat?.disabled ?? false,
				...(allyBonus && { allyBonus })
			};
		});
		// I Know You's FAMILIARITY (see playbook-moves.js's grantsFamiliarityTrait) — a real, stepped
		// actor stat, but deliberately not folded into the shared TRAITS catalog above (that catalog
		// is rendered for every playbook, and would wrongly surface FAMILIARITY for every non-Revenant
		// actor too). Appended only once the actor has actually picked I Know You, mirroring the same
		// "declarative flag, evaluated generically in the sheet" convention every other picked-move
		// effect in this file already follows. No trait bonus/summoned-ally annotation applies to a
		// virtual trait like this — bonus is always 0, matching fixedTraits' own no-bonus treatment
		// elsewhere.
		if (resolvePlaybookMoves(this._playbookMoves()).some((m) => m.grantsFamiliarityTrait)) {
			const value = this.actor.system.stats?.familiarity?.value ?? 3;
			traits.push({ key: "familiarity", label: "FAMILIARITY", value, bonus: 0, total: value, disabled: false });
		}
		return traits;
	},
	// Spotlight is a single 0-6 counter (system.attributes.spotlight.value) rendered as 6 steps
	// filled from the bottom up — always visible (not Channel-gated) since it tracks whose turn it
	// is in the fiction, not an Astir/Channel resource.
	_spotlightData() {
		const spotlightValue = this.actor.system.attributes?.spotlight?.value ?? 0;
		return {
			value: spotlightValue,
			steps: Array.from({ length: SPOTLIGHT_MAX }, (_, i) => ({ step: i + 1, filled: i + 1 <= spotlightValue }))
		};
	},
	// Downtime Tokens live on their own Downtime tab. max is derived from picked moves (see
	// _downtimeTokensMax, e.g. Commander's Debrief) — value defaults to a fresh max, since a new
	// character starts a Sortie with a full pool.
	_downtimeTokensData() {
		const downtimeTokensMax = this._downtimeTokensMax();
		return {
			value: this.actor.system.attributes?.downtimeTokens?.value ?? downtimeTokensMax,
			max: downtimeTokensMax
		};
	},
	// Every catalog entry that can grant a Bonus Downtime Tokens pool via a stable key reference —
	// picked playbook moves and every installed Astir/Ardent part (parts "read as moves" for lookup
	// purposes throughout this codebase — see claude.md). Deduped by key so a part installed on both
	// the Astir and an Ardent shares one entry, the same sharing its Expended checkbox already gets.
	_bonusDowntimeTokenKeyedSources() {
		const all = [
			...resolvePlaybookMoves(this._playbookMoves()),
			...this._astirParts(),
			...this._ardents().flatMap((ardent) => resolveAstirParts(ardent.parts ?? [], ARDENT_PART_CATALOG))
		];
		return [...new Map(all.map((entry) => [entry.key, entry])).values()];
	},
	// Bonus Downtime Tokens: purpose-restricted pools a move, an Astir/Ardent Part, or an equipment
	// entry can grant on top of the main Downtime Tokens counter above (Master & Servant,
	// Information Network, Standardised Parts, Artificers), each with its own value/max and its own
	// restriction text. Two independent sources, unioned: keyed ones (moves/parts, see
	// _bonusDowntimeTokenKeyedSources) store their value at system.attributes.
	// bonusDowntimeTokens.<key>.value, the same keyed-pool shape flatHold's own moveHold uses, so
	// multiple granting entries on one actor stay independently valued; equipment can't share that
	// map (equipment ids are per-actor and disposable — see claude.md's Equipment), so it stores its
	// value right on the entry itself as bonusDowntimeTokensValue instead. `moveKey` is kept as the
	// field name for the keyed rows even though it now also covers part keys, matching what the
	// template already expects. No period of its own — see _onRefreshSortie, which resets every one
	// of these alongside the main counter.
	_bonusDowntimeTokensData() {
		const fromKeyed = this._bonusDowntimeTokenKeyedSources()
			.filter((entry) => entry.bonusDowntimeTokens)
			.map((entry) => {
				const { max, description } = entry.bonusDowntimeTokens;
				const value = this.actor.system.attributes?.bonusDowntimeTokens?.[entry.key]?.value ?? max;
				return { moveKey: entry.key, name: entry.name, description, value, max };
			});
		const fromEquipment = this._equipment()
			.filter((entry) => entry.bonusDowntimeTokens)
			.map((entry) => {
				const { max, description } = entry.bonusDowntimeTokens;
				const value = entry.bonusDowntimeTokensValue ?? max;
				return { equipmentId: entry.id, name: entry.name, description, value, max };
			});
		return [...fromKeyed, ...fromEquipment];
	},
	// The bottom four Advancement options unlock once at least ADVANCEMENT_UNLOCK_THRESHOLD of the
	// top six are checked. `checked` for bottom items is always read from stored data regardless of
	// `locked` — locking only blocks new checkbox interaction in the template, it never clears data,
	// so an item checked before a re-lock stays checked.
	_advancementsData() {
		const advancements = this._advancements();
		const topCount = ADVANCEMENT_TOP.filter(({ key }) => advancements[key]).length;
		const unlocked = topCount >= ADVANCEMENT_UNLOCK_THRESHOLD;
		return {
			top: ADVANCEMENT_TOP.map(({ key, label }) => ({ key, label, checked: advancements[key] ?? false })),
			topCount,
			unlockThreshold: ADVANCEMENT_UNLOCK_THRESHOLD,
			unlocked,
			bottom: ADVANCEMENT_BOTTOM.map(({ key, label }) => ({
				key,
				label,
				checked: advancements[key] ?? false,
				locked: !unlocked
			}))
		};
	},
	_onTraitStep(event) {
		const { trait: key, delta } = event.currentTarget.dataset;
		const current = this.actor.system.stats?.[key]?.value ?? 0;
		const next = Math.min(TRAIT_MAX, Math.max(TRAIT_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ [`system.stats.${key}.value`]: next });
	},
	// Clicking a step sets the value to that step, except clicking the current top (highest
	// filled) step decrements it by one instead — the only way to reduce the track, since there's
	// no step 0 to click. Storing a single integer (rather than per-step booleans) is what
	// guarantees the track can never have a gap.
	_onSpotlightStep(event) {
		const step = Number(event.currentTarget.dataset.step);
		const current = this.actor.system.attributes?.spotlight?.value ?? 0;
		const next = step === current ? step - 1 : step;
		const clamped = Math.min(SPOTLIGHT_MAX, Math.max(SPOTLIGHT_MIN, next));
		if (clamped === current) return;
		this.actor.update({ "system.attributes.spotlight.value": clamped });
	},
	// Bounded by _downtimeTokensMax() — see getData's downtimeTokens for how a picked move (e.g.
	// Commander's Debrief) can raise this above DOWNTIME_TOKENS_MAX_BASE.
	_onDowntimeTokensStep(event) {
		const { delta } = event.currentTarget.dataset;
		const max = this._downtimeTokensMax();
		const current = this.actor.system.attributes?.downtimeTokens?.value ?? max;
		const next = Math.min(max, Math.max(DOWNTIME_TOKENS_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.downtimeTokens.value": next });
	},
	// Bounded by the granting source's own bonusDowntimeTokens.max — re-derived from the actor's
	// current picked moves/installed parts/equipment rather than trusted off the DOM, so a stale
	// button (a source that's since been dropped) can't write a stray value. Branches on which of
	// the two dataset attributes the clicked button carries (see _bonusDowntimeTokensData's own
	// moveKey/equipmentId split) — exactly one is ever non-empty per row. No-ops entirely (no
	// actor.update) when neither resolves to a currently-flagged source.
	_onBonusDowntimeTokenStep(event) {
		const { moveKey, equipmentId, delta } = event.currentTarget.dataset;
		if (moveKey) {
			const source = this._bonusDowntimeTokenKeyedSources().find((entry) => entry.key === moveKey);
			if (!source?.bonusDowntimeTokens) return;
			const { max } = source.bonusDowntimeTokens;
			const current = this.actor.system.attributes?.bonusDowntimeTokens?.[moveKey]?.value ?? max;
			const next = Math.min(max, Math.max(DOWNTIME_TOKENS_MIN, current + Number(delta)));
			if (next === current) return;
			this.actor.update({ [`system.attributes.bonusDowntimeTokens.${moveKey}.value`]: next });
			return;
		}
		if (equipmentId) {
			const entry = this._equipment().find((item) => item.id === equipmentId);
			if (!entry?.bonusDowntimeTokens) return;
			const { max } = entry.bonusDowntimeTokens;
			const current = entry.bonusDowntimeTokensValue ?? max;
			const next = Math.min(max, Math.max(DOWNTIME_TOKENS_MIN, current + Number(delta)));
			if (next === current) return;
			this.actor.update({
				"system.attributes.equipment": this._equipment().map((item) => (
					item.id === equipmentId ? { ...item, bonusDowntimeTokensValue: next } : item
				))
			});
		}
	},
	// Serves both the top and bottom Advancement groups — the key comes from the checkbox's own
	// dataset, not a hardcoded group. Bottom checkboxes render `disabled` in the template while
	// locked (see getData's `locked` field), and a disabled checkbox never dispatches `change`, so
	// this handler only ever fires for a box the player was actually allowed to toggle — no
	// lock check or revert needed here.
	_onAdvancementToggle(event) {
		const { advancementKey: key } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.advancements.${key}`]: event.currentTarget.checked });
	}
};
