import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
	ASTIR_MAX_PARTS,
	ASTIR_POWER_BASE,
	ASTIR_POWER_MIN,
	ASTIR_TIER_MAX,
	ASTIR_TIER_MIN,
	astirCoreApproaches,
	astirMaxPower,
	astirMaxWeaponPower,
	chooseAstirMove,
	chooseAstirPart,
	chooseAstirWeapon,
	findAstirMove,
	findAstirPart,
	resolveAstirParts
} from "../../frames/astir.js";
import { configureEquipment } from "../../equipment/equipment.js";
import { showMoveDescription } from "../../moves/move-dialogs.js";

// The Astir itself, ported from playbook/playbook-sheet/astir-mixin.js for an NPC actor. Trimmed
// to a baseline per claude.md: no CHANNEL-availability gate (an NPC has no traits — the tab is
// always either "Create Astir" or the created Astir), no Sortie-scoped Extra Parts/Extra Weapons
// pools, no Potions tracking, no guided-move dropdown, and the unique Move is always freely
// pickable (no required-move-by-playbook rule, since an NPC has no playbook).
export const NpcAstirSheetMixin = {
	_astir() {
		return this.actor.system.attributes?.astir ?? null;
	},
	_astirPartKeys(astir = this._astir()) {
		return astir?.parts ?? [];
	},
	_astirData(astir, astirParts, astirMove, equipment, astirWeapons) {
		return {
			exists: Boolean(astir),
			cores: ASTIR_CORES,
			tierMin: ASTIR_TIER_MIN,
			tierMax: ASTIR_TIER_MAX,
			...(astir && {
				name: this.actor.name,
				img: astir.img || ASTIR_DEFAULT_IMG,
				core: astir.core ?? "",
				approachOptions: astirCoreApproaches(astir.core),
				approach: astir.approach ?? "",
				tier: astir.tier ?? ASTIR_TIER_MIN,
				overheating: astir.overheating ?? false,
				piloted: Boolean(astir.piloted),
				power: {
					value: astir.power ?? 0,
					max: astirMaxPower(this._astirPartKeys(astir), equipment),
					negative: (astir.power ?? 0) < 0
				},
				weaponPower: { value: astir.weaponPower ?? 0, max: astirMaxWeaponPower(this._astirPartKeys(astir), equipment) },
				parts: resolveAstirParts(astir.parts ?? []).map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType,
					tier: astir.tier ?? ASTIR_TIER_MIN,
					disabled: this._isPartDisabled(part.key)
				})),
				partsFull: (astir.parts ?? []).length >= ASTIR_MAX_PARTS,
				move: astirMove ? { key: astirMove.key, name: astirMove.name } : null,
				weapons: astirWeapons
			})
		};
	},
	_astirParts() {
		return resolveAstirParts(this._astirPartKeys());
	},
	_isPartDisabled(key) {
		return Boolean(this.actor.system.attributes?.moveUses?.[key]?.disabled);
	},
	_astirPowerUpdates(astir, { parts = this._astirPartKeys(astir), equipment = this._equipment() } = {}) {
		const power = Math.min(astir.power ?? 0, astirMaxPower(parts, equipment));
		const weaponPower = Math.min(astir.weaponPower ?? 0, astirMaxWeaponPower(parts, equipment));
		const updates = {
			"system.attributes.astir.power": power,
			"system.attributes.astir.weaponPower": weaponPower
		};
		if (power < 0 && astir.piloted) {
			updates["system.attributes.astir.piloted"] = false;
			ui.notifications.warn("This Astir's Power is negative — Piloted has been turned off.");
		}
		return updates;
	},
	_onAstirCreate() {
		if (this._astir()) return;
		this.actor.update({
			"system.attributes.astir": {
				id: foundry.utils.randomID(),
				img: ASTIR_DEFAULT_IMG,
				core: "",
				approach: "",
				tier: ASTIR_TIER_MIN,
				power: ASTIR_POWER_BASE,
				overheating: false,
				piloted: false,
				parts: [],
				move: null
			}
		});
	},
	_onAstirDelete() {
		if (!this._astir()) return;
		this.actor.update({
			"system.attributes.astir": null,
			"system.attributes.equipment": this._equipment().filter((item) => !item.astir)
		});
	},
	_onAstirCoreChange(event) {
		const astir = this._astir();
		if (!astir) return;
		const core = event.currentTarget.value;
		const updates = { "system.attributes.astir.core": core };
		if (!astirCoreApproaches(core).some((approach) => approach.key === astir.approach)) {
			updates["system.attributes.astir.approach"] = "";
		}
		this.actor.update(updates);
	},
	_onAstirApproachChange(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.approach": event.currentTarget.value });
	},
	_onAstirTierStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.tier ?? ASTIR_TIER_MIN;
		const next = Math.min(ASTIR_TIER_MAX, Math.max(ASTIR_TIER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.tier": next });
	},
	_onAstirPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.power ?? 0;
		const max = astirMaxPower(this._astirPartKeys(astir), this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.power": next });
	},
	_onAstirWeaponPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.weaponPower ?? 0;
		const max = astirMaxWeaponPower(this._astirPartKeys(astir), this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.weaponPower": next });
	},
	_onAstirOverheatingToggle(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.overheating": event.currentTarget.checked });
	},
	// Piloted is an independent checkbox here (see claude.md's trimmed-baseline scope) — no
	// mount-exclusivity or revert-on-failure logic, unlike the player sheet's own Mount Up/Dismount.
	_onAstirPilotedToggle(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.piloted": event.currentTarget.checked });
	},
	async _onAstirPartAdd() {
		const astir = this._astir();
		if (!astir) return;
		const current = astir.parts ?? [];
		if (current.length >= ASTIR_MAX_PARTS) {
			ui.notifications.warn(`An Astir can carry at most ${ASTIR_MAX_PARTS} Parts.`);
			return;
		}
		const key = await chooseAstirPart(current);
		if (!key || current.includes(key)) return;
		const parts = [...current, key];
		this.actor.update({
			"system.attributes.astir.parts": parts,
			...this._astirPowerUpdates(astir, { parts })
		});
	},
	_onAstirPartRemove(event) {
		const astir = this._astir();
		if (!astir) return;
		const { part: key } = event.currentTarget.dataset;
		const current = astir.parts ?? [];
		if (!current.includes(key)) return;
		const parts = current.filter((k) => k !== key);
		this.actor.update({
			"system.attributes.astir.parts": parts,
			...this._astirPowerUpdates(astir, { parts })
		});
	},
	// No required-Astir-move-by-playbook rule (an NPC has no playbook) — the "+" always opens the
	// free picker.
	async _onAstirMoveAdd() {
		const astir = this._astir();
		if (!astir) return;
		const key = await chooseAstirMove(
			undefined,
			astir.move ? [astir.move] : [],
			undefined,
			undefined,
			this._astirParts().map((part) => part.key)
		);
		if (!key) return;
		this.actor.update({ "system.attributes.astir.move": key });
	},
	_onAstirMoveRemove() {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.move": null });
	},
	async _onAstirWeaponAdd() {
		const astir = this._astir();
		if (!astir) return;
		const template = await chooseAstirWeapon(undefined, this._astirParts().map((part) => part.key));
		if (!template) return;

		const result = await configureEquipment(template, undefined, { astirWeapon: true, lockTags: true });
		if (!result) return;

		const equipment = [
			...this._equipment(),
			{
				id: foundry.utils.randomID(),
				spent: [],
				astir: true,
				catalogSource: true,
				...(template.familiar && { familiar: true }),
				...result
			}
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	},
	async _onAstirWeaponCustomAdd() {
		const astir = this._astir();
		if (!astir) return;
		const result = await configureEquipment({ kind: "weapon" }, undefined, { astirWeapon: true, maxTagValue: 0 });
		if (!result) return;

		const equipment = [
			...this._equipment(),
			{ id: foundry.utils.randomID(), spent: [], astir: true, catalogSource: false, ...result }
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	},
	// The "?" info button shared by the Astir/Ardent Parts lists and the Astir Move row — resolves
	// against the Astir Part catalog first, then the Astir/playbook Move catalogs (see
	// astir.js#findAstirMove), since a clicked key could be either.
	async _onMoveInfo(event) {
		const { move: key } = event.currentTarget.dataset;
		const entry = findAstirPart(key) ?? findAstirMove(key);
		if (!entry) return;

		await showMoveDescription(entry);
	}
};
