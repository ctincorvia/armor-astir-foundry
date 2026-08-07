import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { TRAITS } from "../../core/traits.js";
import { ADVANCEMENT_TOP, ADVANCEMENT_BOTTOM } from "../advancements.js";

const TRAIT_MIN = -3;
const TRAIT_MAX = 3;

export const SPOTLIGHT_MIN = 0;
export const SPOTLIGHT_MAX = 6;

// Downtime Tokens (Downtime tab): a per-Sortie resource refreshed to _downtimeTokensMax() by the
// Refresh Sortie control (see _onRefreshSortie). DOWNTIME_TOKENS_MAX_BASE (3) is the floor every
// character starts with; a picked move can raise it via its own declarative downtimeTokensMax flag
// (Commander's Debrief: 4 total) — see _downtimeTokensMax, which takes the max across picked moves
// the same way _conflictTier takes the max across conflictTier flags.
const DOWNTIME_TOKENS_MIN = 0;
const DOWNTIME_TOKENS_MAX_BASE = 3;

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
	// Downtime Tokens' effective max (see getData's downtimeTokens, _onDowntimeTokensStep,
	// _onRefreshSortie) — DOWNTIME_TOKENS_MAX_BASE unless a picked move raises it via its own
	// declarative downtimeTokensMax flag (Commander's Debrief: 4 total), taking the max across
	// picked moves the same way _conflictTier's own base does for conflictTier.
	_downtimeTokensMax() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		const base = picked.reduce((max, move) => Math.max(max, move.downtimeTokensMax ?? 0), DOWNTIME_TOKENS_MAX_BASE);
		// Helping Hands (Summoner — see playbook-moves.js's grantsDowntimeAllySlot): "take +1 token
		// during Downtime" while a Downtime Ally is bound. An additive, conditionally-active bonus
		// rather than a per-move ceiling like downtimeTokensMax above, so it's summed on top of the
		// existing reduce rather than folded into it — see summoner-mixin.js's _downtimeAllyData.
		const helpingHandsBonus = picked.some((move) => move.grantsDowntimeAllySlot)
			&& this.actor.system.attributes?.downtimeAlly ? 1 : 0;
		return base + helpingHandsBonus;
	},
	_advancements() {
		return this.actor.system.attributes?.advancements ?? {};
	},
	// getData's Traits panel — value/bonus/total per TRAITS entry. traitBonuses (Arcane Augments,
	// Let Loose — see trait-bonuses.js) is recomputed fresh here rather than threaded in from
	// getData, since nothing else in getData needs this actor's trait bonuses.
	_traitsData() {
		const traitBonuses = this._traitBonuses();
		return TRAITS.map(({ key, label }) => {
			const stat = this.actor.system.stats?.[key];
			const value = stat?.value ?? 0;
			const bonus = traitBonuses[key] ?? 0;
			return { key, label, value, bonus, total: value + bonus, disabled: stat?.disabled ?? false };
		});
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
