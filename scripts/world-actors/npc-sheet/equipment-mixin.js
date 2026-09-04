import {
	TIER_MIN,
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	configureEquipment,
	equipmentValue,
	resolveEquipmentTags
} from "../../equipment/equipment.js";

// Custom-made equipment (see claude.md's Domain conventions), ported from
// playbook/playbook-sheet/equipment-mixin.js for an NPC actor. An NPC never rolls, so this mixin
// omits every roll-dialog-only concept the player sheet's own equivalent carries (weaponMoves,
// spends, narrative tags, reroll/guided/forced-effect resolution, starting gear) — just the plain
// add/catalog-pick/edit/remove CRUD, matching equipment-card.hbs's own "no weaponMoves passed in,
// no tag ever marked spendable" contract for staying roll-free with zero changes to that partial.
export const NpcEquipmentSheetMixin = {
	_equipment() {
		return this.actor.system.attributes?.equipment ?? [];
	},
	// An Astir/Ardent-owned weapon has no scale/tier of its own — it inherits its frame's Tier and
	// the "astir" WEAPON_SCALES entry instead (an Ardent weapon is Astir-scale too — see
	// docs/domains/frames.md's Ardents section). A mundane weapon uses the NPC's own Tier, since
	// there's no on-foot-vs-mounted distinction to resolve here the way the player sheet's
	// _conflictTier covers.
	_equipmentEntry(entry, frame = null) {
		const tags = resolveEquipmentTags(entry.tags ?? []).map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			showValue: true,
			description: tag.description
		}));
		return {
			id: entry.id,
			kind: entry.kind,
			name: entry.name,
			description: entry.description,
			tags,
			value: equipmentValue(entry.tags ?? []),
			...(entry.kind === "weapon" && {
				scale: (entry.astir || entry.ardent) ? "astir" : entry.scale,
				scaleLabel: (entry.astir || entry.ardent)
					? WEAPON_SCALES.find((s) => s.key === "astir")?.label
					: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
				tier: (entry.astir || entry.ardent) ? frame?.tier : this.actor.system.attributes?.tier ?? TIER_MIN,
				isAstir: Boolean(entry.astir),
				extra: false,
				disabled: Boolean(entry.disabled)
			})
		};
	},
	_equipmentData(equipment, astirWeapons, ardentWeaponEntriesById, ardents) {
		return {
			weapons: equipment
				.filter((item) => item.kind === "weapon" && !item.astir && !item.ardent)
				.map((item) => this._equipmentEntry(item)),
			astirWeapons,
			ardentWeapons: ardents.flatMap((ardent) => ardentWeaponEntriesById.get(ardent.id)),
			gear: equipment.filter((item) => item.kind !== "weapon").map((item) => this._equipmentEntry(item))
		};
	},
	async _saveNewEquipment(result) {
		const current = this._equipment();
		await this.actor.update({
			"system.attributes.equipment": [...current, { id: foundry.utils.randomID(), spent: [], ...result }]
		});
	},
	async _onEquipmentAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const result = await configureEquipment({ kind }, undefined, { maxTagValue: 0 });
		if (!result) return;

		await this._saveNewEquipment(result);
	},
	async _onEquipmentCatalogAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const template = await chooseEquipmentCatalogItem(kind);
		if (!template) return;

		const result = await configureEquipment(template, undefined, { lockTags: true });
		if (!result) return;

		await this._saveNewEquipment({ ...result, catalogSource: true });
	},
	// Same provenance resolution as the player sheet's own (see equipment-mixin.js's fuller
	// comment): a catalog-sourced entry stays permanently tag-locked, everything else is subject to
	// the "tags sum to 0 or less" budget rule. An Astir/Ardent weapon's only path onto an NPC is a
	// catalog pick or an explicit custom add (see _onAstirWeaponAdd/_onAstirWeaponCustomAdd below),
	// so a missing catalogSource there defaults to locked, same as the player sheet's own.
	_equipmentEditLockState(entry) {
		if (entry.astir || entry.ardent) {
			const lockTags = entry.catalogSource !== false;
			return { lockTags, maxTagValue: lockTags ? null : 0 };
		}
		const lockTags = Boolean(entry.catalogSource);
		return { lockTags, maxTagValue: lockTags ? null : 0 };
	},
	async _onEquipmentEdit(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		if (!entry) return;

		const { lockTags, maxTagValue } = this._equipmentEditLockState(entry);
		const result = entry.astir
			? await configureEquipment(entry, undefined, { astirWeapon: true, lockTags, maxTagValue, allowOverride: true })
			: entry.ardent
				? await configureEquipment(entry, undefined, { ardentWeapon: true, lockTags, maxTagValue, allowOverride: true })
				: await configureEquipment(entry, undefined, { lockTags, maxTagValue, allowOverride: true });
		if (!result) return;

		const equipment = current.map((item) => (
			item.id === equipmentId
				? {
					id: item.id,
					spent: item.spent ?? [],
					disabled: item.disabled ?? false,
					...result,
					...(item.astir && { astir: true }),
					...(item.ardent && { ardent: item.ardent }),
					...(item.familiar && { familiar: true }),
					...(result.catalogSource === undefined && item.catalogSource !== undefined && { catalogSource: item.catalogSource })
				}
				: item
		));
		const updates = { "system.attributes.equipment": equipment };
		const astir = this._astir();
		if (entry.astir && astir) Object.assign(updates, this._astirPowerUpdates(astir, { equipment }));
		await this.actor.update(updates);
	},
	_onEquipmentRemove(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		const equipment = current.filter((item) => item.id !== equipmentId);
		const updates = { "system.attributes.equipment": equipment };
		const astir = this._astir();
		if (entry?.astir && astir) Object.assign(updates, this._astirPowerUpdates(astir, { equipment }));
		this.actor.update(updates);
	},
	_onEquipmentDisabledToggle(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const checked = event.currentTarget.checked;
		this.actor.update({
			"system.attributes.equipment": this._equipment().map((item) => (
				item.id === equipmentId ? { ...item, disabled: checked } : item
			))
		});
	}
};
