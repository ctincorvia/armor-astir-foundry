import { ASTIR_TIER_MIN, resolveAstirParts } from "../../frames/astir.js";
import { ARDENT_DEFAULT_NAME, ARDENT_PART_CATALOG, ARDENT_TIER_DEFAULT, chooseFrame } from "../../frames/ardent.js";
import { findEquipmentTag } from "../../equipment/equipment.js";
import { HOLD_MIN } from "../../moves/moves.js";
import { ALL_MOVES } from "../../moves/all-moves.js";

// The Astir/Ardent "which frame is mounted" machinery (see claude.md's Piloted note) — generic
// across both frame kinds, so neither the Astir nor Ardent mixins need their own mounting logic.
export const FramesSheetMixin = {
	// Every pilotable frame this character has — the Astir (if created) first, then each Ardent in
	// stored order — normalized to one shape so Mount Up/Dismount, weapon ownership (see
	// _weaponFrameId), and per-frame move gating (see getData) can all be generic rather than
	// special-casing the Astir. `id` is the literal string "astir" for the Astir, since there's
	// only ever one; an Ardent's own stored id otherwise. `name` mirrors getData's own Astir naming
	// (the character's Callsign, falling back to its own name) for the Astir, or the Ardent's own
	// stored name (falling back to ARDENT_DEFAULT_NAME) for an Ardent.
	_frames() {
		const frames = [];
		const astir = this._astir();
		if (astir) {
			frames.push({
				kind: "astir",
				id: "astir",
				name: this.actor.system.details?.callsign?.value || this.actor.name,
				tier: astir.tier ?? ASTIR_TIER_MIN,
				approach: astir.approach ?? "",
				piloted: Boolean(astir.piloted),
				parts: astir.parts ?? []
			});
		}
		for (const ardent of this._ardents()) {
			frames.push({
				kind: "ardent",
				id: ardent.id,
				name: ardent.name || ARDENT_DEFAULT_NAME,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				approach: ardent.approach ?? "",
				piloted: Boolean(ardent.piloted),
				parts: ardent.parts ?? []
			});
		}
		return frames;
	},
	// The single currently-mounted frame (the Astir or one Ardent), or null when nothing is —
	// _setMountedFrame is the only write path, so at most one frame's `piloted` is ever true.
	_mountedFrame() {
		return this._frames().find((frame) => frame.piloted) ?? null;
	},
	// The mounted frame's installed parts, resolved to definitions — [] when nothing is mounted.
	// Every reactive part effect (guided, +CHANNEL, spends, doubles regen, potions) reads this
	// rather than checking piloted state and _astirParts() separately, since an Ardent's own parts
	// (drawn from the same catalog — see ardent.js) work identically to the Astir's once mounted.
	_mountedParts() {
		return resolveAstirParts(this._mountedFrame()?.parts ?? [], ARDENT_PART_CATALOG);
	},
	// The Controls section (see the template's dangers-column) — Mount Up/Dismount just drive the
	// same mounted-frame state every frame's own Piloted checkbox does (see _setMountedFrame), so
	// their disabled state mirrors exactly what claude.md's Piloted note and the feature ask
	// require: no frame at all to mount, or one already mounted.
	_controlsData(frames, mountedFrame) {
		return {
			mountUpDisabled: !frames.length || Boolean(mountedFrame),
			dismountDisabled: !mountedFrame
		};
	},
	// Which frame (by _frames' own id shape) an equipment entry belongs to, or null for a mundane
	// weapon that belongs to none — the generalization of the old Astir/mundane piloted-boolean
	// split (see claude.md's Piloted note) to cover Ardent-owned weapons too.
	_weaponFrameId(entry) {
		if (entry.astir) return "astir";
		if (entry.ardent) return entry.ardent;
		return null;
	},
	// Explains why a weapon's quick-roll buttons are gated by frame mismatch (see
	// frameWeaponMoves in getData) — only called once a mismatch is already known to exist, so
	// frameId and mountedFrameId are never equal here.
	_weaponGateTooltip(frameId, mountedFrameId) {
		if (frameId === null) {
			return "Personal weapons are disabled when mounted. Dismount to use this weapon.";
		}
		if (mountedFrameId === null) {
			return "Astir and Ardent weapons are disabled while unmounted. Mount up to use this weapon.";
		}
		return "This weapon's frame isn't mounted. Dismount your current frame and mount this one to use this weapon.";
	},
	// The single write path enforcing "only one frame mounted at a time" (see claude.md's Piloted
	// note) — every frame's own Piloted checkbox (_onAstirPilotedToggle/_onArdentPilotedToggle) and
	// Mount Up/Dismount all funnel through this. `kind`/`id` name the frame to mount (see _frames'
	// own id shape, "astir" or an Ardent's stored id); pass kind: null (id ignored) to dismount
	// whatever's currently mounted. Blocks mounting the Astir while its Power is negative (see
	// claude.md's Piloted note, mirroring _astirPowerUpdates' own auto-uncheck-on-mutation guard) —
	// an Ardent has no Power to gate on, so mounting one always succeeds. Returns whether the
	// update actually applied, so a caller with something to revert (a checkbox) can do so.
	_setMountedFrame(kind, id) {
		const astir = this._astir();
		if (kind === "astir" && (astir?.power ?? 0) < 0) {
			ui.notifications.warn("This Astir's Power is negative — it can't be piloted until the loadout changes.");
			return false;
		}
		const updates = {};
		if (astir) updates["system.attributes.astir.piloted"] = kind === "astir";
		const ardents = this._ardents();
		if (ardents.length) {
			updates["system.attributes.ardents"] = ardents.map((ardent) => (
				{ ...ardent, piloted: kind === "ardent" && ardent.id === id }
			));
		}
		this.actor.update(updates);
		return true;
	},
	_onAstirPilotedToggle(event) {
		if (!this._astir()) return;
		const checked = event.currentTarget.checked;
		const applied = checked ? this._setMountedFrame("astir", "astir") : this._setMountedFrame(null, null);
		if (!applied) event.currentTarget.checked = !checked;
	},
	// Mounting an Ardent never fails (no Power to gate on — see _setMountedFrame), so unlike
	// _onAstirPilotedToggle there's no revert case to handle.
	_onArdentPilotedToggle(event) {
		const { ardentId } = event.currentTarget.dataset;
		if (!this._ardents().some((ardent) => ardent.id === ardentId)) return;
		const checked = event.currentTarget.checked;
		this._setMountedFrame(checked ? "ardent" : null, checked ? ardentId : null);
	},
	// Disabled in the template whenever there's no frame to mount or one's already mounted (see
	// getData's data.controls), but guarded here too in case a click still lands. Prompts via
	// chooseFrame only when there's a real choice to make; mounts directly with exactly one.
	async _onMountUp() {
		const frames = this._frames().filter((frame) => !frame.piloted);
		if (!frames.length) return;
		if (frames.length === 1) {
			this._setMountedFrame(frames[0].kind, frames[0].id);
			return;
		}
		const chosen = await chooseFrame(frames);
		if (!chosen) return;
		this._setMountedFrame(chosen.kind, chosen.id);
	},
	_onDismount() {
		if (!this._mountedFrame()) return;
		this._setMountedFrame(null, null);
	},
	// The generic, data-driven half of both Refresh buttons (see _onRefreshScene/_onRefreshSortie)
	// — walks ALL_MOVES for every `uses` entry whose `period` matches (playbook moves and Astir
	// parts share one pass, since ALL_MOVES already flattens both catalogs together — see its own
	// comment), and filters `entry.spent` on every equipment item against each tag's own
	// spend/forcesEffect/reroll period (see equipment.js). Returns a plain update patch rather than
	// calling actor.update itself, so each button can layer its own period-specific extras on top.
	_refreshPeriod(period) {
		const updates = {};
		for (const move of ALL_MOVES) {
			for (const use of move.uses ?? []) {
				if (use.period !== period) continue;
				if (this.actor.system.attributes?.moveUses?.[move.key]?.[use.key]) {
					updates[`system.attributes.moveUses.${move.key}.${use.key}`] = false;
				}
			}
			// Sortie/Scene-scoped numericTrackers (e.g. Tactical Genius's own "start of a Sortie"
			// hold pool — see playbook-moves.js) reset to their own min the same way a `uses`
			// checkbox above resets to false. Most numericTrackers (Transmute Self, Smiling
			// Politely, Force Multiplier) declare no period at all and are untouched by either
			// Refresh button — this only ever fires for one that opts in.
			for (const tracker of move.numericTrackers ?? []) {
				if (tracker.period !== period) continue;
				// tracker.min is always present (every numericTrackers entry declares one — see
				// playbook-moves.js's own generic invariant test), unlike the actor's stored value
				// below, which is genuinely absent until the player first steps the counter.
				const resetTo = tracker.min;
				const current = this.actor.system.attributes?.moveTrackers?.[move.key]?.[tracker.key] ?? 0;
				if (current !== resetTo) {
					updates[`system.attributes.moveTrackers.${move.key}.${tracker.key}`] = resetTo;
				}
			}
		}
		const equipment = this._equipment();
		const nextEquipment = equipment.map((item) => {
			const spent = item.spent ?? [];
			if (!spent.length) return item;
			const kept = spent.filter((tagKey) => {
				const tag = findEquipmentTag(tagKey);
				const tagPeriod = tag?.spend?.period ?? tag?.forcesEffect?.period ?? tag?.reroll?.period;
				return tagPeriod !== period;
			});
			return kept.length === spent.length ? item : { ...item, spent: kept };
		});
		if (nextEquipment.some((item, i) => item !== equipment[i])) {
			updates["system.attributes.equipment"] = nextEquipment;
		}
		return updates;
	},
	// Clears every Scene-scoped spend/uses checkbox, plus Read the Room's shared hold — its own
	// text ties expiry to "the current situation," which this module treats as roughly a Scene
	// boundary for this button. Every separateHold move's own per-move pool (Mobility) is cleared
	// alongside it, the same "walk ALL_MOVES for a shared field" treatment _onRefreshSortie
	// already gives Sortie-scoped flatHold pools below.
	_onRefreshScene() {
		const updates = this._refreshPeriod("Scene");
		for (const move of ALL_MOVES) {
			if (move.separateHold) {
				updates[`system.attributes.moveHold.${move.key}.value`] = HOLD_MIN;
			}
		}
		updates["system.resources.hold.value"] = HOLD_MIN;
		// Eidolon Drive's active summon (see summoner-mixin.js) is scoped "for the rest of the
		// Scene" by its own text, so this is the real rules boundary for it — the primary clear
		// point, not the generic ALL_MOVES uses walk above (Eidolon Drive has no uses entry at all,
		// see playbook-moves.js). _onRefreshSortie below clears the same field again as a defensive
		// superset, since ending a Sortie always also ends its current Scene.
		updates["system.attributes.eidolonDrive"] = { summonedAllyId: null, bonusUsed: false };
		this.actor.update(updates);
	},
	// Clears every Sortie-scoped spend/uses checkbox, plus the flat hold pools (B-Plot, Get Out of
	// My Way!, Once the War's Over — all scoped to "the Sortie" by their own text, see moves.js/
	// playbook-moves.js), Alchemical Suite's Potions when installed (mirrors getData's own
	// grantsPotionsOnLeadASortie gating so an Astir without the part never gains a stray potions
	// field), and Tactical Genius's hold tracker, which resets to its computed 1+KNOW value rather
	// than a flat min (see the in-loop comment below).
	_onRefreshSortie() {
		const updates = this._refreshPeriod("Sortie");
		for (const move of ALL_MOVES) {
			if (move.flatHold && move.period === "Sortie") {
				updates[`system.attributes.moveHold.${move.key}.value`] = HOLD_MIN;
			}
			// Bonus Downtime Tokens (Master & Servant, Information Network — see progression-mixin.js's
			// _bonusDowntimeTokensData) are the same per-Sortie resource as the main Downtime Tokens
			// counter below, so they reset alongside it here rather than gating on period like the
			// flatHold branch above — walks all of ALL_MOVES, not just picked moves, matching that
			// branch's own unconditional-reset behavior.
			if (move.bonusDowntimeTokens) {
				updates[`system.attributes.bonusDowntimeTokens.${move.key}.value`] = move.bonusDowntimeTokens.max;
			}
			// Tactical Genius's own text isn't a flat reset-to-min like every other Sortie-period
			// numericTracker _refreshPeriod already handled above — it's "take 1+KNOW hold at the
			// start of a Sortie" (see playbook-moves.js), so this overwrites _refreshPeriod's own
			// reset-to-0 for this one key with the computed value instead, the same "computed, not
			// just cleared" treatment this method already gives Alchemical Suite's Potions and
			// Downtime Tokens below. Folds in _traitBonuses() the same way _moveTraits does, so a
			// Let Loose KNOW pick is reflected here too. Clamped against the tracker's own min/max
			// (currently 0/6) rather than hardcoding those numbers again.
			if (move.key === "the-captain:tactical-genius") {
				const tracker = move.numericTrackers[0];
				const know = (this.actor.system.stats?.know?.value ?? 0) + (this._traitBonuses()?.know ?? 0);
				updates[`system.attributes.moveTrackers.${move.key}.${tracker.key}`] =
					Math.min(tracker.max, Math.max(tracker.min, 1 + know));
			}
		}
		if (this._astirParts().some((part) => part.grantsPotionsOnLeadASortie)) {
			updates["system.attributes.astir.potions"] = { red: 0, blue: 0, yellow: 0 };
		}
		// Eidolon Drive's active summon (see summoner-mixin.js) is primarily cleared by Refresh
		// Scene above, the actual rules boundary ("for the rest of the Scene"). This is a defensive
		// superset of that: ending a Sortie always also ends its current (last) Scene, so a player
		// who clicks Refresh Sortie without first clicking Refresh Scene shouldn't carry a stale
		// summon into the next Sortie.
		updates["system.attributes.eidolonDrive"] = { summonedAllyId: null, bonusUsed: false };
		updates["system.attributes.downtimeTokens.value"] = this._downtimeTokensMax();
		this.actor.update(updates);
	}
};
