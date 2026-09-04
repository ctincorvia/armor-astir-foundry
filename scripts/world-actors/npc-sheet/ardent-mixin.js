import { APPROACHES } from "../../core/approaches.js";
import { chooseAstirPart, chooseAstirWeapon, resolveAstirParts } from "../../frames/astir.js";
import { configureEquipment } from "../../equipment/equipment.js";
import {
	ARDENT_DEFAULT_NAME,
	ARDENT_MAX_LOADOUT,
	ARDENT_TIER_DEFAULT,
	ARDENT_TIER_MAX,
	ARDENT_TIER_MIN,
	ardentLoadoutCount,
	ardentParts,
	ardentWeapons,
	buildArdent
} from "../../frames/ardent.js";

// Ardents, ported from playbook/playbook-sheet/ardent-mixin.js for an NPC actor. Trimmed to a
// baseline per claude.md: no Sortie-scoped Extra Parts/Extra Weapons pool, no Commander "Ardent
// Features" carve-out (so ardentLoadoutCount is the one count to check, not the
// baseline/Feature split ardentBaselineLoadoutCount exists for), and Piloted is an independent
// checkbox with no Mount Up/Dismount mutual-exclusion machinery.
export const NpcArdentSheetMixin = {
	_ardents() {
		return this.actor.system.attributes?.ardents ?? [];
	},
	_ardentsData(ardents, equipment) {
		return ardents.map((ardent) => {
			const parts = resolveAstirParts(ardent.parts ?? []).map((part) => ({
				key: part.key,
				name: part.name,
				partType: part.partType,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				disabled: this._isPartDisabled(part.key)
			}));
			const weapons = equipment
				.filter((item) => item.kind === "weapon" && item.ardent === ardent.id)
				.map((item) => this._equipmentEntry(item, ardent));
			return {
				id: ardent.id,
				name: ardent.name || ARDENT_DEFAULT_NAME,
				approach: ardent.approach ?? "",
				approachOptions: APPROACHES,
				tier: ardent.tier ?? ARDENT_TIER_DEFAULT,
				piloted: Boolean(ardent.piloted),
				parts,
				weapons,
				loadoutFull: ardentLoadoutCount(ardent, equipment) >= ARDENT_MAX_LOADOUT
			};
		});
	},
	_onArdentCreate() {
		this.actor.update({ "system.attributes.ardents": [...this._ardents(), buildArdent()] });
	},
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
	_onArdentApproachChange(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const approach = event.currentTarget.value;
		this.actor.update({
			"system.attributes.ardents": current.map((ardent) => (ardent.id === ardentId ? { ...ardent, approach } : ardent))
		});
	},
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
	_onArdentPilotedToggle(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		if (!current.some((ardent) => ardent.id === ardentId)) return;
		const piloted = event.currentTarget.checked;
		this.actor.update({
			"system.attributes.ardents": current.map((a) => (a.id === ardentId ? { ...a, piloted } : a))
		});
	},
	async _onArdentPartAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const current = this._ardents();
		const ardent = current.find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
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
	async _onArdentWeaponAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		const template = await chooseAstirWeapon(ardentWeapons(), [], { title: "Pick an Ardent Weapon" });
		if (!template) return;

		const result = await configureEquipment(template, undefined, { ardentWeapon: true, lockTags: true });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, catalogSource: true, ...result }
			]
		});
	},
	async _onArdentWeaponCustomAdd(event) {
		const { ardentId } = event.currentTarget.dataset;
		const ardent = this._ardents().find((a) => a.id === ardentId);
		if (!ardent) return;
		if (ardentLoadoutCount(ardent, this._equipment()) >= ARDENT_MAX_LOADOUT) {
			ui.notifications.warn(`An Ardent can carry at most ${ARDENT_MAX_LOADOUT} parts and weapons combined.`);
			return;
		}
		const result = await configureEquipment({ kind: "weapon" }, undefined, { ardentWeapon: true, maxTagValue: 0 });
		if (!result) return;

		this.actor.update({
			"system.attributes.equipment": [
				...this._equipment(),
				{ id: foundry.utils.randomID(), spent: [], ardent: ardentId, catalogSource: false, ...result }
			]
		});
	}
};
