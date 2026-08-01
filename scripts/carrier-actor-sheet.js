import { WorldActorSheet } from "./world-actor-sheet.js";
import { BASIC_MOVES, configureMoveRoll, rollMove } from "./moves.js";
import { TIER_MAX, configureEquipment, equipmentValue, resolveEquipmentTags, WEAPON_SCALES } from "./equipment.js";

export const CARRIER_SHEET_TEMPLATE = "modules/armor-astir/templates/carrier-actor-sheet.hbs";
export const CARRIER_ACTOR_TYPE = "armor-astir.carrier";

// Matches the playbook sheet's own trait bounds (see playbook-actor-sheet.js's TRAIT_MIN/MAX) —
// Crew is the Carrier's one trait and behaves identically to a playbook stat.
const CREW_MIN = -3;
const CREW_MAX = 3;

// Carriers can carry at most two weapons (see claude.md, "World actors").
const MAX_WEAPONS = 2;

// The only two moves that use a weapon at all (Exchange Blows, Strike Decisively — see
// moves.js's usesWeapon) — both are always-available basic moves, so filtering BASIC_MOVES is
// enough; there's no playbook-move equivalent that uses a weapon.
const CARRIER_WEAPON_MOVES = BASIC_MOVES.filter((move) => move.usesWeapon);

// The Carrier represents the players' moving base (see claude.md, "Domain conventions"): one
// trait (Crew), a free-text description, a roster of notable crew members, and up to two
// weapons. Everything here is a thin wrapper around WorldActorSheet's generic entry-list
// handling plus the Crew stepper and the weapons section, neither of which fit that generic
// entry-list shape (Crew is a top-level stat, not a list; weapons go through configureEquipment's
// dialog, not a plain text/checkbox field).
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
		return this.actor.system.attributes?.weapons ?? [];
	}

	// Deliberately pared down from PlaybookActorSheet#_equipmentEntry — no spendable/spent tag
	// tracking (see _onWeaponAdd's comment: Carrier weapons don't offer equipment spends in the
	// roll dialog yet, so a "spent" checkbox would have nothing to drive), and scale is always
	// "Astir Scale" (configureEquipment's carrierWeapon option never lets it be anything else).
	_weaponEntry(entry) {
		const tags = resolveEquipmentTags(entry.tags ?? []).map((tag) => ({
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
			value: equipmentValue(entry.tags ?? []),
			scaleLabel: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
			tier: entry.tier,
			moves: CARRIER_WEAPON_MOVES.map(({ key, name }) => ({ key, name }))
		};
	}

	getData(options) {
		const data = super.getData(options);
		data.crew = this.actor.system.stats?.crew?.value ?? 0;
		data.description = this.actor.system.details?.description?.value ?? "";
		data.crewMembers = this._list("crewMembers");
		const weapons = this._weapons();
		data.weapons = weapons.map((weapon) => this._weaponEntry(weapon));
		data.canAddWeapon = weapons.length < MAX_WEAPONS;
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
	// to TIER_MAX — forced again here regardless of what configureEquipment resolved, so a bug in
	// that dialog can't leak a non-weapon or off-tier entry into the array.
	async _onWeaponAdd() {
		if (this._weapons().length >= MAX_WEAPONS) return;
		const result = await configureEquipment(null, undefined, { carrierWeapon: true });
		if (!result) return;

		await this.actor.update({
			"system.attributes.weapons": [
				...this._weapons(),
				{ id: foundry.utils.randomID(), spent: [], ...result, kind: "weapon", tier: TIER_MAX }
			]
		});
	}

	async _onWeaponEdit(event) {
		const { weaponId } = event.currentTarget.dataset;
		const current = this._weapons();
		const entry = current.find((weapon) => weapon.id === weaponId);
		if (!entry) return;

		const result = await configureEquipment(entry, undefined, { carrierWeapon: true });
		if (!result) return;

		await this.actor.update({
			"system.attributes.weapons": current.map((weapon) => (
				weapon.id === weaponId ? { id: weapon.id, spent: weapon.spent ?? [], ...result, kind: "weapon", tier: TIER_MAX } : weapon
			))
		});
	}

	_onWeaponRemove(event) {
		const { weaponId } = event.currentTarget.dataset;
		this.actor.update({ "system.attributes.weapons": this._weapons().filter((weapon) => weapon.id !== weaponId) });
	}

	// Exchange Blows/Strike Decisively always roll +CREW when a Carrier uses them (see
	// claude.md) — no trait choice, no chooseWeapon prompt (clicking a specific weapon's button
	// is the weapon choice, same as PlaybookActorSheet's per-weapon quick-roll buttons), and no
	// Unarmed option, since a Carrier "must use the carrier weapons" — with none, there's simply
	// no button to click. Deliberately skips equipment spends/forced-effects/reroll/Guided, all
	// of which PlaybookActorSheet's weapon rolls support — see claude.md for that scope cut.
	async _onWeaponMoveRoll(event) {
		const { move: moveKey, weaponId } = event.currentTarget.dataset;
		const move = CARRIER_WEAPON_MOVES.find((m) => m.key === moveKey);
		const weapon = this._weapons().find((w) => w.id === weaponId);
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
		}).render(true);
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
