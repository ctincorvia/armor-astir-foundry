import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { APPROACHES } from "../../core/approaches.js";
import { chooseAstirPart, chooseAstirWeapon, resolveAstirParts } from "../../frames/astir.js";
import { configureEquipment } from "../../equipment/equipment.js";
import {
	ARDENT_DEFAULT_NAME,
	ARDENT_FEATURE_PARTS,
	ARDENT_FEATURE_WEAPONS,
	ARDENT_MAX_LOADOUT,
	ARDENT_PART_CATALOG,
	ARDENT_TIER_DEFAULT,
	ARDENT_TIER_MAX,
	ARDENT_TIER_MIN,
	ardentBaselineLoadoutCount,
	ardentFeatureLoadoutCount,
	ardentFeatureMax,
	ardentParts,
	ardentWeapons,
	buildArdent,
	isAceFeaturePart
} from "../../frames/ardent.js";

// Ardents (see docs/domains/frames.md's Ardents section) — a cheaper, more limited pilotable frame than the
// Astir, and unlike it a character may have any number. Mounting (Piloted) is shared, generic
// machinery covered by the Frames mixin (_setMountedFrame/_onArdentPilotedToggle); this mixin owns
// only an Ardent's own identity/loadout fields.
export const ArdentSheetMixin = {
	_ardents() {
		return this.actor.system.attributes?.ardents ?? [];
	},
	// getData's per-Ardent shape (see docs/domains/frames.md's Ardents section) — never gated on CHANNEL, and
	// there can be several. Each one's approachOptions is the full APPROACHES list (not narrowed by
	// a Core — Ardents have none), its parts read the same way the Astir's own do (drawn from the
	// same catalog — see ardentParts), and loadoutFull disables both the Parts and Weapons "+"
	// buttons at once, since the two combine into one cap.
	//
	// Commander's Custom Ardent additionally has a second, independent Ardent Feature pool (see
	// ardent.js's ARDENT_FEATURE_PARTS/ARDENT_FEATURE_WEAPONS/ardentFeatureMax) — parts/weapons from
	// that pool are split out of the baseline parts/weapons lists above (via isAceFeaturePart / the
	// commanderFeature flag) into their own featureParts/featureWeapons, with their own
	// featureLoadoutFull, so the two "+"-button pairs never interfere with each other's cap.
	// Computed for every actor regardless of playbook — an actor with no Feature-flagged items just
	// gets an empty featureParts/featureWeapons and featureLoadoutFull: false — the template gates
	// the section itself on isCommander.
	//
	// equipment/ardentWeaponEntriesById are computed once in getData (shared with the Equipment
	// data method, which renders the same Ardent weapon entries flattened on its own tab) and
	// passed in here rather than recomputed.
	_ardentsData(ardents, equipment, ardentWeaponEntriesById) {
		const ardentFeatureCap = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		return ardents.map((ardent) => {
			const allParts = resolveAstirParts(ardent.parts ?? [], ARDENT_PART_CATALOG);
			const parts = allParts.filter((part) => !isAceFeaturePart(part.key));
			const featureParts = allParts.filter((part) => isAceFeaturePart(part.key));
			const allWeapons = ardentWeaponEntriesById.get(ardent.id);
			const weapons = allWeapons.filter((weapon) => !weapon.commanderFeature);
			const featureWeapons = allWeapons.filter((weapon) => weapon.commanderFeature);
			return {
				id: ardent.id,
				name: ardent.name || ARDENT_DEFAULT_NAME,
				approach: ardent.approach ?? "",
				approachOptions: APPROACHES,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				piloted: Boolean(ardent.piloted),
				// tier is derived from this Ardent's own Tier, not stored on the part — same
				// reasoning as the Astir's own parts mapping gives its own, just per-Ardent instead.
				parts: parts.map((part) => ({
					key: part.key,
					name: part.name,
					partType: part.partType,
					tier: ardent.tier ?? ARDENT_TIER_DEFAULT
				})),
				weapons,
				loadoutFull: ardentBaselineLoadoutCount(ardent, equipment) >= ARDENT_MAX_LOADOUT,
				featureParts: featureParts.map((part) => ({
					key: part.key,
					name: part.name,
					partType: part.partType,
					tier: ardent.tier ?? ARDENT_TIER_DEFAULT
				})),
				featureWeapons,
				featureMax: ardentFeatureCap,
				featureLoadoutFull: ardentFeatureLoadoutCount(ardent, equipment) >= ardentFeatureCap
			};
		});
	},
	// "+ Add Ardent" — unlike the Astir, a character may have any number of Ardents, so this always
	// appends rather than being a one-shot Create/Delete pair.
	_onArdentCreate() {
		this.actor.update({ "system.attributes.ardents": [...this._ardents(), buildArdent()] });
	},
	// Also drops every equipment entry this Ardent owns (see _onAstirDelete's own equivalent
	// cascade) — an orphaned ardent: "<id>" weapon with no Ardent to inherit Tier from would have
	// nothing to render.
	_onArdentDelete(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		this.actor.update({
			"system.attributes.ardents": current.filter((ardent) => ardent.id !== ardentId),
			"system.attributes.equipment": this._equipment().filter((item) => item.ardent !== ardentId)
		});
	},
	_onArdentNameChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const name = event.currentTarget.value.trim();
		this.actor.update({
			"system.attributes.ardents": current.map((ardent) => (ardent.id === ardentId ? { ...ardent, name } : ardent))
		});
	},
	// Unlike the Astir's Core-narrowed pair, an Ardent picks freely from the full Approach list
	// (see docs/domains/frames.md's Ardents section) — no dependent field to clear alongside this one.
	_onArdentApproachChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const approach = event.currentTarget.value;
		this.actor.update({
			"system.attributes.ardents": current.map((ardent) => (ardent.id === ardentId ? { ...ardent, approach } : ardent))
		});
	},
	// Ardents run Tier 2-4, defaulting to 2 — its own band, distinct from both the Astir's 3-4 and
	// equipment's 1-5 (see ardent.js).
	_onArdentTierStep(event) {
		const { ardentId, delta } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const tier = ardent.tier ?? ARDENT_TIER_DEFAULT;
		const next = Math.min(ARDENT_TIER_MAX, Math.max(ARDENT_TIER_MIN, tier + Number(delta)));
		if (next === tier) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (a.id === ardentId ? { ...a, tier: next } : a))
		});
	},
	// The "+" on an Ardent's own Parts section — offers only the Astir catalog's Ardent-eligible
	// subset (see ardent.js's ardentParts: no Power cost, no Weapon Power bonus), and refuses once
	// this Ardent's baseline parts+weapons loadout is already at ARDENT_MAX_LOADOUT. Uses
	// ardentBaselineLoadoutCount rather than the old ardentLoadoutCount so Commander's separately-
	// capped Ardent Features (see _onArdentFeaturePartAdd) never count against this cap — identical
	// to ardentLoadoutCount for every other playbook, which never has a Feature-flagged entry at all.
	async _onArdentPartAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentBaselineLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		const picked = ardent.parts ?? [];
		const key = await chooseAstirPart(picked, ardentParts(), { title: "Add an Ardent Part" });
		if (!key || picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: [...picked, key] } : a
			))
		});
	},
	_onArdentPartRemove(event) {
		const { ardentId, part: key } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const picked = ardent.parts ?? [];
		if (!picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: picked.filter((k) => k !== key) } : a
			))
		});
	},
	// The "O" catalog picker for an Ardent weapon (see ardent.js's ardentWeapons: no Drain-tagged
	// entries — an Ardent has no Power for Drain to reduce), then the same editor _onAstirWeaponAdd
	// uses, with the ardentWeapon option suppressing the fields an Ardent weapon doesn't need — see
	// configureEquipment. Refuses once this Ardent's baseline loadout is already at
	// ARDENT_MAX_LOADOUT, same guard _onArdentPartAdd applies to its own half of the same cap (see
	// its own comment on why this reads ardentBaselineLoadoutCount rather than ardentLoadoutCount).
	async _onArdentWeaponAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentBaselineLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		// No Ardent-eligible catalog entry carries requiresParts (see ardentWeapons' own
		// powerCost/DRAIN_GROUP exclusion), and an Ardent has no installed-parts concept requiresParts
		// could check against anyway — [] gates nothing here, same no-op default chooseAstirWeapon
		// documents for a caller like this one.
		const template = await chooseAstirWeapon(ardentWeapons(), [], { title: "Pick an Ardent Weapon" });
		if (!template) return;

		const result = await configureEquipment(template, undefined, { ardentWeapon: true });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, ...result }
			]
		});
	},
	// Commander-exclusive counterpart to _onArdentPartAdd, drawing from ARDENT_FEATURE_PARTS (see
	// ardent.js) instead of the generic Astir-derived catalog, and capped against the separate
	// Ardent Feature pool (ardentFeatureLoadoutCount/ardentFeatureMax) rather than ARDENT_MAX_LOADOUT
	// — the two pools are independent, so filling one never blocks the other. The button itself only
	// renders for a Commander actor (see the template's isCommander gate), but the handler re-checks
	// nothing playbook-specific beyond that — an Ardent Feature part installed by any means still
	// reads back correctly through isAceFeaturePart.
	async _onArdentFeaturePartAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		const max = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		if (ardentFeatureLoadoutCount(ardent, this._equipment()) >= max) {
			ui.notifications.warn(`This Ardent can carry at most ${max} Ardent Features.`);
			return;
		}
		const picked = ardent.parts ?? [];
		const key = await chooseAstirPart(picked, ARDENT_FEATURE_PARTS, { title: "Add an Ardent Feature" });
		if (!key || picked.includes(key)) return;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (
				a.id === ardentId ? { ...a, parts: [...picked, key] } : a
			))
		});
	},
	// Commander-exclusive counterpart to _onArdentWeaponAdd — same chain (catalog picker into
	// configureEquipment's ardentWeapon flow), against ARDENT_FEATURE_WEAPONS instead of
	// ardentWeapons(), capped against the same Ardent Feature pool _onArdentFeaturePartAdd checks.
	// The saved entry carries commanderFeature: true — set here and never player-editable — since a
	// saved equipment entry is a freely-editable snapshot with no link back to its source catalog
	// (see docs/domains/equipment.md's Equipment notes), so this flag is the only way to tell it apart from a
	// baseline Ardent weapon after the fact (see ardent.js's ardentFeatureLoadoutCount).
	async _onArdentFeatureWeaponAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		const max = ardentFeatureMax(resolvePlaybookMoves(this._playbookMoves()));
		if (ardentFeatureLoadoutCount(ardent, this._equipment()) >= max) {
			ui.notifications.warn(`This Ardent can carry at most ${max} Ardent Features.`);
			return;
		}
		// See _onArdentWeaponAdd's own comment — [] gates nothing, since ARDENT_FEATURE_WEAPONS
		// carries no requiresParts entries either.
		const template = await chooseAstirWeapon(ARDENT_FEATURE_WEAPONS, [], { title: "Pick an Ardent Feature Weapon" });
		if (!template) return;

		const result = await configureEquipment(template, undefined, { ardentWeapon: true });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, commanderFeature: true, ...result }
			]
		});
	}
};
