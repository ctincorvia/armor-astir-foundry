import { WorldActorSheet } from "./world-actor-sheet.js";
import { BASIC_MOVES, SPECIAL_MOVES, configureMoveRoll, postGuidedResult, rollMove } from "../moves/moves.js";
import {
	TIER_MAX,
	configureEquipment,
	equipmentValue,
	findEquipmentTag,
	rerollSpendKey,
	resolveAvailableReroll,
	resolveAvailableRerollTag,
	resolveEquipmentSpends,
	resolveEquipmentTags,
	resolveForcedWeaponEffect,
	resolveNarrativeWeaponTags,
	spendEquipmentTagsOnActor,
	weaponTagsAreGuided,
	WEAPON_SCALES
} from "../equipment/equipment.js";
import { SUPPORT_PLAYBOOK_SLUGS, resolveQuartersBenefits } from "../playbook/quarters.js";

export const CARRIER_SHEET_TEMPLATE = "modules/armor-astir/templates/carrier-actor-sheet.hbs";
export const CARRIER_ACTOR_TYPE = "armor-astir.carrier";

// Matches the playbook sheet's own trait bounds (see playbook-actor-sheet.js's TRAIT_MIN/MAX) —
// Crew is the Carrier's one trait and behaves identically to a playbook stat.
const CREW_MIN = -3;
const CREW_MAX = 3;

// see docs/domains/world-actors.md, "The Carrier carries two named, fixed-role weapon slots"
export const WEAPON_SLOTS = [
	{ key: "primary", tier: TIER_MAX, label: "Tier V Weapon", lockedTagKeys: ["set-up", "mounted"], maxTagValue: 2 },
	{ key: "secondary", tier: 3, label: "Tier III Weapon", lockedTagKeys: ["mounted"], maxTagValue: 1 }
];

// The only two moves that use a weapon at all (Exchange Blows, Strike Decisively — see
// moves.js's usesWeapon) — both are always-available basic moves, so filtering BASIC_MOVES is
// enough; there's no playbook-move equivalent that uses a weapon.
const CARRIER_WEAPON_MOVES = BASIC_MOVES.filter((move) => move.usesWeapon);

// Crew Support's hold pool (see special-moves.js) is a single Carrier-wide counter, not a
// per-character copy (see playbook-sheet/moves-mixin.js's _crewSupportHold) — its min/max are
// sourced from the one place the tracker itself is declared instead of duplicating 0/3 here as
// new magic numbers.
const CREW_SUPPORT_HOLD_TRACKER = SPECIAL_MOVES.find((m) => m.key === "crew-support").numericTrackers[0];

// A weapon entry's effective tag-key list: its own stored tags plus its slot's locked tags (see
// WEAPON_SLOTS above). Exported as a standalone function (rather than only living as
// CarrierActorSheet#_weaponTagKeys below) so move-roll-mixin.js's _onMoveRoll can pre-merge a
// borrowed Carrier weapon's locked tags into its own weaponBundles offer for Fire Support (see
// docs/domains/world-actors.md).
export function carrierWeaponTagKeys(slot, entry) {
	return [...new Set([...(entry.tags ?? []), ...slot.lockedTagKeys])];
}

// The Carrier represents the players' moving base (see claude.md, "Domain conventions"): one
// trait (Crew), a free-text description, a roster of notable crew members, and its two weapon
// slots. Everything here is a thin wrapper around WorldActorSheet's generic entry-list handling
// plus the Crew stepper and the weapons section, neither of which fit that generic entry-list
// shape (Crew is a top-level stat, not a list; weapons go through configureEquipment's dialog,
// not a plain text/checkbox field).
export class CarrierActorSheet extends WorldActorSheet {
	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			classes: ["armor-astir", "sheet", "actor", "world-actor", "carrier"],
			template: CARRIER_SHEET_TEMPLATE
		});
	}

	// Crew Members carry a position alongside name/description, unlike the generic {name,
	// description} default every other world-actor list uses.
	_entryDefaults() {
		return { name: "", position: "", description: "" };
	}

	_weapons() {
		return this.actor.system.attributes?.weapons ?? {};
	}

	// see docs/domains/world-actors.md, "The Carrier carries two named, fixed-role weapon slots"
	_weaponTagKeys(slot, entry) {
		return carrierWeaponTagKeys(slot, entry);
	}

	// see docs/domains/world-actors.md, "The Carrier carries two named, fixed-role weapon slots".
	// Tag mapping mirrors equipment-mixin.js#_equipmentEntry's own flatMap — spendable/spent so the
	// weapon card renders a "Spent" checkbox for a spend-without-effect tag (One-Use, Dangerous,
	// Refresh, Vorpal), and a multi-move reroll tag (Versatile) splits into one row per move it can
	// reroll, resolved against CARRIER_WEAPON_MOVES (the only two moves a Carrier weapon ever offers)
	// rather than ALL_MOVES.
	_weaponEntry(slot, entry) {
		const tagKeys = this._weaponTagKeys(slot, entry);
		const tags = resolveEquipmentTags(tagKeys).flatMap((tag) => {
			const spendable = Boolean(tag.spend || tag.forcesEffect || tag.reroll);
			if (tag.reroll && tag.reroll.moves.length > 1) {
				return tag.reroll.moves.map((moveKey, index) => {
					const spendKey = rerollSpendKey(tag, moveKey);
					return {
						key: spendKey,
						label: `${tag.label} — ${CARRIER_WEAPON_MOVES.find((m) => m.key === moveKey).name}`,
						value: tag.value,
						showValue: index === 0,
						description: tag.description,
						spendable,
						spent: Boolean(entry.spent?.includes(spendKey))
					};
				});
			}
			return [{
				key: tag.key,
				label: tag.label,
				value: tag.value,
				showValue: true,
				description: tag.description,
				spendable,
				spent: Boolean(entry.spent?.includes(tag.key))
			}];
		});
		return {
			id: entry.id,
			name: entry.name,
			description: entry.description,
			tags,
			value: equipmentValue(tagKeys),
			scaleLabel: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
			tier: slot.tier,
			weaponMoves: CARRIER_WEAPON_MOVES.map(({ key, name }) => ({ key, name }))
		};
	}

	_narrativeWeaponTags(slot, entry) {
		return resolveNarrativeWeaponTags(this._weaponTagKeys(slot, entry), entry);
	}

	_equipmentSpends(slot, entry, lockedEffect) {
		return resolveEquipmentSpends(this._weaponTagKeys(slot, entry), entry, lockedEffect);
	}

	_forcedWeaponEffect(slot, entry) {
		return resolveForcedWeaponEffect(this._weaponTagKeys(slot, entry), entry);
	}

	_availableReroll(move, slot, entry) {
		return resolveAvailableReroll(this._weaponTagKeys(slot, entry), entry, move.key);
	}

	_availableRerollTag(move, slot, entry) {
		return resolveAvailableRerollTag(this._weaponTagKeys(slot, entry), entry, move.key);
	}

	_weaponIsGuided(slot, entry) {
		return weaponTagsAreGuided(this._weaponTagKeys(slot, entry));
	}

	// Resolves an in-card button's data-equipment-id (the shared equipment-card.hbs partial
	// addresses by id, not by slot key) back to the slot that holds it.
	_weaponSlotForId(id) {
		const weapons = this._weapons();
		return WEAPON_SLOTS.find((slot) => weapons[slot.key]?.id === id) ?? null;
	}

	// One row per assigned Support actor's Quarters (Quarters section, read-only — see
	// findAssignedPlaybookActors and claude.md's Quarters notes). Editing only ever happens on the
	// owning playbook actor's own sheet.
	_quartersEntry(actor) {
		const quarters = actor.system.attributes?.quarters ?? {};
		return {
			actorName: actor.name,
			name: quarters.name || "",
			description: quarters.description || "",
			benefitLabels: resolveQuartersBenefits(quarters.benefits ?? []).map((b) => b.label)
		};
	}

	getData(options) {
		const data = super.getData(options);
		data.crew = this.actor.system.stats?.crew?.value ?? 0;
		data.crewSupportHold = this.actor.system.attributes?.crewSupportHold ?? 0;
		data.description = this.actor.system.details?.description?.value ?? "";
		data.crewMembers = this._list("crewMembers");
		const weapons = this._weapons();
		data.weaponSlots = WEAPON_SLOTS.map((slot) => {
			const entry = weapons[slot.key] ?? null;
			return { key: slot.key, label: slot.label, entry: entry ? this._weaponEntry(slot, entry) : null };
		});
		data.quarters = findAssignedPlaybookActors(this.actor.id).map((actor) => this._quartersEntry(actor));
		return data;
	}

	activateListeners(html) {
		super.activateListeners(html);
		html.find(".crew-step").on("click", this._onCrewStep.bind(this));
		html.find(".crew-support-hold-step").on("click", this._onCrewSupportHoldStep.bind(this));
		html.find(".weapon-add").on("click", this._onWeaponAdd.bind(this));
		html.find(".equipment-edit").on("click", this._onWeaponEdit.bind(this));
		html.find(".equipment-remove").on("click", this._onWeaponRemove.bind(this));
		html.find(".weapon-move-roll").on("click", this._onWeaponMoveRoll.bind(this));
		html.find(".equipment-tag-spent-checkbox").on("change", this._onWeaponTagSpentToggle.bind(this));
	}

	_onCrewStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.stats?.crew?.value ?? 0;
		const next = Math.min(CREW_MAX, Math.max(CREW_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.stats.crew.value": next });
	}

	// The shared Crew Support hold pool's own stepper — mirrors _onCrewStep exactly, but bounded by
	// CREW_SUPPORT_HOLD_TRACKER's own min/max instead of CREW_MIN/CREW_MAX. See
	// playbook-sheet/moves-mixin.js's _crewSupportHold/_crewSupportHoldSpend and
	// playbook-sheet/move-tracking-mixin.js's _onMoveTrackerStep for the other read/write paths onto
	// this same field, driven from a playbook character's own Crew Support move card.
	_onCrewSupportHoldStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.attributes?.crewSupportHold ?? 0;
		const next = Math.min(CREW_SUPPORT_HOLD_TRACKER.max, Math.max(CREW_SUPPORT_HOLD_TRACKER.min, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.crewSupportHold": next });
	}

	// see docs/domains/world-actors.md, "The Carrier carries two named, fixed-role weapon slots"
	async _onWeaponAdd(event) {
		const { slot: slotKey } = event.currentTarget.dataset;
		const slot = WEAPON_SLOTS.find((s) => s.key === slotKey);
		if (!slot || this._weapons()[slot.key]) return;

		const result = await configureEquipment(null, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: slot.tier,
			excludedTagKeys: [...slot.lockedTagKeys, "two-handed"],
			maxTagValue: slot.maxTagValue
		});
		if (!result) return;

		await this.actor.update({
			[`system.attributes.weapons.${slot.key}`]: { id: foundry.utils.randomID(), spent: [], ...result, kind: "weapon", tier: slot.tier }
		});
	}

	async _onWeaponEdit(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const slot = this._weaponSlotForId(equipmentId);
		if (!slot) return;
		const entry = this._weapons()[slot.key];

		const result = await configureEquipment(entry, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: slot.tier,
			excludedTagKeys: [...slot.lockedTagKeys, "two-handed"],
			maxTagValue: slot.maxTagValue,
			allowOverride: true
		});
		if (!result) return;

		await this.actor.update({
			[`system.attributes.weapons.${slot.key}`]: { id: entry.id, spent: entry.spent ?? [], ...result, kind: "weapon", tier: slot.tier }
		});
	}

	_onWeaponRemove(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const slot = this._weaponSlotForId(equipmentId);
		if (!slot) return;
		this.actor.update({ [`system.attributes.weapons.${slot.key}`]: null });
	}

	// Exchange Blows/Strike Decisively always roll +CREW when a Carrier uses them (see
	// claude.md) — no trait choice, no chooseWeapon prompt (clicking a specific weapon's button
	// is the weapon choice, same as PlaybookActorSheet's per-weapon quick-roll buttons), and no
	// Unarmed option, since a Carrier "must use the carrier weapons" — with none, there's simply
	// no button to click. Full parity otherwise with PlaybookActorSheet's own weapon rolls:
	// narrative tags, equipment spends, forced effects, reroll offers, and Guided all apply.
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, equipmentId } = event.currentTarget.dataset;
		const move = CARRIER_WEAPON_MOVES.find((m) => m.key === moveKey);
		const slot = this._weaponSlotForId(equipmentId);
		if (!move || !slot) return;
		const weapon = this._weapons()[slot.key];

		const traits = [{ key: "crew", label: "CREW", value: this.actor.system.stats?.crew?.value ?? 0 }];
		const forced = this._forcedWeaponEffect(slot, weapon);
		const lockedEffect = forced?.effect ?? null;
		const lockedEffectSource = forced ? findEquipmentTag(forced.tagKey).label : null;
		const equipmentSpends = this._equipmentSpends(slot, weapon, lockedEffect);
		const narrativeTags = this._narrativeWeaponTags(slot, weapon);
		const guided = this._weaponIsGuided(slot, weapon) ? "Guided" : null;
		const rerollTag = this._availableRerollTag(move, slot, weapon);

		const config = await configureMoveRoll(move, traits, {
			lockedEffect,
			lockedEffectSource,
			equipmentSpends,
			narrativeTags,
			...(guided && { guided }),
			...(rerollTag && { rerollTag })
		});
		if (!config) return;

		if (config.takeSeven) {
			await postGuidedResult(this.actor, move, { weaponLabel: weapon.name, narrativeTags, guidedSource: guided });
			return;
		}

		const spends = [...(config.spentTags ?? []), ...(forced ? [{ equipmentId: weapon.id, tagKey: forced.tagKey }] : [])];
		if (spends.length) await spendEquipmentTagsOnActor(this.actor, spends);

		const reroll = this._availableReroll(move, slot, weapon);
		await rollMove(this.actor, move, config.trait, {
			...config,
			weaponLabel: weapon.name,
			narrativeTags,
			...(reroll && { reroll })
		});
	}

	// The Carrier's own "Spent" checkbox toggle (see _weaponEntry's spendable/spent tag shape) —
	// mirrors equipment-mixin.js#_onEquipmentTagSpentToggle, writing to the slot-keyed weapons
	// object instead of a flat equipment array.
	_onWeaponTagSpentToggle(event) {
		const { equipmentId, tag: tagKey } = event.currentTarget.dataset;
		const checked = event.currentTarget.checked;
		const slot = this._weaponSlotForId(equipmentId);
		if (!slot) return;
		const entry = this._weapons()[slot.key];
		const spent = entry.spent ?? [];
		const nextSpent = checked ? [...new Set([...spent, tagKey])] : spent.filter((key) => key !== tagKey);
		this.actor.update({ [`system.attributes.weapons.${slot.key}.spent`]: nextSpent });
	}
}

// Every Carrier actor currently in the world — used by PlaybookActorSheet to resolve a "roll
// +crew" move's real value (see moves.js's lead-a-sortie fixedTraits) rather than the static
// placeholder it used to be stuck with.
export function findCarrierActors() {
	return game.actors.filter((actor) => actor.type === CARRIER_ACTOR_TYPE);
}

// Whether a Support actor has actually filled in any part of its Quarters — an untouched Quarters
// section (never named, described, or given a benefit) shouldn't clutter every Carrier's roster.
function hasQuarters(actor) {
	const quarters = actor.system.attributes?.quarters;
	return Boolean(quarters?.name || quarters?.description || quarters?.benefits?.length);
}

// Every Support-playbook actor whose Quarters is assigned to this Carrier (see quarters.js's
// Carrier-assignment dropdown) — feeds CarrierActorSheet#getData's read-only Quarters section.
// With 0 or 1 Carrier in the world there's nothing to choose between, so every Support actor with
// non-empty Quarters is shown regardless of its own carrierId (mirroring how PlaybookActorSheet's
// own +CREW roll only prompts chooseCarrier once findCarrierActors().length > 1).
export function findAssignedPlaybookActors(carrierId) {
	const supportActors = game.actors.filter((actor) =>
		actor.type === "character" && SUPPORT_PLAYBOOK_SLUGS.includes(actor.system.playbook?.slug) && hasQuarters(actor));
	if (findCarrierActors().length <= 1) return supportActors;
	return supportActors.filter((actor) => actor.system.attributes?.carrierId === carrierId);
}

// Prompts which Carrier's Crew to roll with when more than one exists — mirrors
// actor-creation.js's choosePlaybook exactly (promise/Dialog/resolve-null shape), only ever
// called by PlaybookActorSheet when findCarrierActors().length > 1, so `carriers` is never empty
// here.
export function chooseCarrier(carriers) {
	return new Promise((resolve) => {
		const buttons = {};
		for (const carrier of carriers) {
			buttons[carrier.id] = { label: carrier.name, callback: () => resolve(carrier.id) };
		}

		new Dialog({
			title: "Choose a Carrier",
			content: "<p>Which Carrier's Crew are you rolling with?</p>",
			buttons,
			close: () => resolve(null)
		}, { classes: ["armor-astir"] }).render(true);
	});
}

export function registerCarrierActorSheet() {
	Hooks.once("init", () => {
		Actors.registerSheet("armor-astir", CarrierActorSheet, {
			types: ["armor-astir.carrier"],
			makeDefault: true,
			label: "Carrier"
		});
	});
}
