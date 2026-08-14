import { WorldActorSheet } from "./world-actor-sheet.js";
import { BASIC_MOVES, configureMoveRoll, rollMove } from "../moves/moves.js";
import { TIER_MAX, configureEquipment, equipmentValue, resolveEquipmentTags, WEAPON_SCALES } from "../equipment/equipment.js";
import { SUPPORT_PLAYBOOK_SLUGS, resolveQuartersBenefits } from "../playbook/quarters.js";

export const CARRIER_SHEET_TEMPLATE = "modules/armor-astir/templates/carrier-actor-sheet.hbs";
export const CARRIER_ACTOR_TYPE = "armor-astir.carrier";

// Matches the playbook sheet's own trait bounds (see playbook-actor-sheet.js's TRAIT_MIN/MAX) —
// Crew is the Carrier's one trait and behaves identically to a playbook stat.
const CREW_MIN = -3;
const CREW_MAX = 3;

// The Carrier carries exactly two named, fixed-role weapon slots (see
// docs/domains/world-actors.md, "World actors") rather than a flat add/remove list — each has its
// own Tier, its own tag budget, and its own always-on locked tags (mirrors the "locked tag"
// mechanism playbook-sheet/equipment-mixin.js uses for move-granted weapon tags, keyed here by
// slot instead of by picked move — see _weaponTagKeys below). `key` addresses the slot in
// `system.attributes.weapons`/dataset attributes; `tier`/`maxTagValue` feed configureEquipment's
// carrierWeaponTier/maxTagValue options; `lockedTagKeys` feeds both configureEquipment's
// excludedTagKeys (so the player can never pick them as a regular tag) and _weaponTagKeys (so
// they're always unioned back in when the slot is read).
const WEAPON_SLOTS = [
	{ key: "primary", tier: TIER_MAX, label: "Tier V Weapon", lockedTagKeys: ["set-up", "mounted"], maxTagValue: 2 },
	{ key: "secondary", tier: 3, label: "Tier III Weapon", lockedTagKeys: ["mounted"], maxTagValue: 1 }
];

// The only two moves that use a weapon at all (Exchange Blows, Strike Decisively — see
// moves.js's usesWeapon) — both are always-available basic moves, so filtering BASIC_MOVES is
// enough; there's no playbook-move equivalent that uses a weapon.
const CARRIER_WEAPON_MOVES = BASIC_MOVES.filter((move) => move.usesWeapon);

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

	// Mirrors playbook-sheet/equipment-mixin.js's _grantedWeaponTagKeys/_weaponTagKeys pair
	// exactly, except the union is keyed by slot (a static list) instead of by whichever moves are
	// currently picked. Never written into entry.tags itself — computed fresh every read — so
	// there's no checkbox for set-up/mounted in configureEquipment's editor and no way to uncheck
	// them; that's the entire lock.
	_weaponTagKeys(slot, entry) {
		return [...new Set([...(entry.tags ?? []), ...slot.lockedTagKeys])];
	}

	// Deliberately pared down from PlaybookActorSheet#_equipmentEntry — no spendable/spent tag
	// tracking (see _onWeaponAdd's comment: Carrier weapons don't offer equipment spends in the
	// roll dialog yet, so a "spent" checkbox would have nothing to drive), and scale is always
	// "Astir Scale" (configureEquipment's carrierWeapon option never lets it be anything else).
	// Tier comes from the slot, not the entry — a Carrier weapon's Tier is fixed by which slot it
	// occupies, not something the entry itself needs to store (see configureEquipment's
	// carrierWeaponTier option and _onWeaponAdd/_onWeaponEdit's forced-tier save below).
	_weaponEntry(slot, entry) {
		const tagKeys = this._weaponTagKeys(slot, entry);
		const tags = resolveEquipmentTags(tagKeys).map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description
		}));
		return {
			id: entry.id,
			name: entry.name,
			description: entry.description,
			tags,
			value: equipmentValue(tagKeys),
			scaleLabel: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
			tier: slot.tier,
			moves: CARRIER_WEAPON_MOVES.map(({ key, name }) => ({ key, name }))
		};
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
		html.find(".weapon-add").on("click", this._onWeaponAdd.bind(this));
		html.find(".weapon-edit").on("click", this._onWeaponEdit.bind(this));
		html.find(".weapon-remove").on("click", this._onWeaponRemove.bind(this));
		html.find(".weapon-move-roll").on("click", this._onWeaponMoveRoll.bind(this));
	}

	_onCrewStep(event) {
		const { delta } = event.currentTarget.dataset;
		const current = this.actor.system.stats?.crew?.value ?? 0;
		const next = Math.min(CREW_MAX, Math.max(CREW_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.stats.crew.value": next });
	}

	// Carrier weapons are always custom (never picked from a catalog — see claude.md) and always
	// go through configureEquipment's carrierWeapon option, which hides Kind/Scale and locks Tier
	// to the slot's own tier — forced again here regardless of what configureEquipment resolved,
	// so a bug in that dialog can't leak a non-weapon or off-tier entry into the slot.
	// excludedTagKeys/maxTagValue keep the slot's locked tags (set-up/mounted) off the checkbox
	// list entirely and cap the player-pickable tag budget per slot (see WEAPON_SLOTS above) —
	// the locked tags themselves are unioned back in only at read time, by _weaponTagKeys.
	async _onWeaponAdd(event) {
		const { slot: slotKey } = event.currentTarget.dataset;
		const slot = WEAPON_SLOTS.find((s) => s.key === slotKey);
		if (!slot || this._weapons()[slot.key]) return;

		const result = await configureEquipment(null, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: slot.tier,
			excludedTagKeys: slot.lockedTagKeys,
			maxTagValue: slot.maxTagValue
		});
		if (!result) return;

		await this.actor.update({
			[`system.attributes.weapons.${slot.key}`]: { id: foundry.utils.randomID(), spent: [], ...result, kind: "weapon", tier: slot.tier }
		});
	}

	async _onWeaponEdit(event) {
		const { slot: slotKey } = event.currentTarget.dataset;
		const slot = WEAPON_SLOTS.find((s) => s.key === slotKey);
		const entry = slot ? this._weapons()[slot.key] : null;
		if (!entry) return;

		const result = await configureEquipment(entry, undefined, {
			carrierWeapon: true,
			carrierWeaponTier: slot.tier,
			excludedTagKeys: slot.lockedTagKeys,
			maxTagValue: slot.maxTagValue
		});
		if (!result) return;

		await this.actor.update({
			[`system.attributes.weapons.${slot.key}`]: { id: entry.id, spent: entry.spent ?? [], ...result, kind: "weapon", tier: slot.tier }
		});
	}

	_onWeaponRemove(event) {
		const { slot: slotKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.weapons.${slotKey}`]: null });
	}

	// Exchange Blows/Strike Decisively always roll +CREW when a Carrier uses them (see
	// claude.md) — no trait choice, no chooseWeapon prompt (clicking a specific weapon's button
	// is the weapon choice, same as PlaybookActorSheet's per-weapon quick-roll buttons), and no
	// Unarmed option, since a Carrier "must use the carrier weapons" — with none, there's simply
	// no button to click. Deliberately skips equipment spends/forced-effects/reroll/Guided, all
	// of which PlaybookActorSheet's weapon rolls support — see claude.md for that scope cut.
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, slot: slotKey } = event.currentTarget.dataset;
		const move = CARRIER_WEAPON_MOVES.find((m) => m.key === moveKey);
		const weapon = this._weapons()[slotKey];
		if (!move || !weapon) return;

		const traits = [{ key: "crew", label: "CREW", value: this.actor.system.stats?.crew?.value ?? 0 }];
		const config = await configureMoveRoll(move, traits, {});
		if (!config) return;

		await rollMove(this.actor, move, config.trait, { weaponLabel: weapon.name });
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
