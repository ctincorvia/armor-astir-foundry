import {
	ASTIR_CORES,
	ASTIR_DEFAULT_IMG,
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
	resolveAstirParts
} from "../../frames/astir.js";
import { configureEquipment } from "../../equipment/equipment.js";

// The Astir itself — its own identity/loadout fields, plus every reactive Astir Part effect
// (Potions, doubles-regen Power, spend-driven Expended) that only ever applies to the Astir
// specifically (see claude.md's Piloted note). Mounting is shared, generic machinery covered by
// the Frames mixin.
export const AstirSheetMixin = {
	_astir() {
		return this.actor.system.attributes?.astir ?? null;
	},
	// getData's Astir tab shape. Gated on CHANNEL exactly like the old overheating/power meters
	// were (missing stats.channel reads as enabled, not disabled) — but unlike those, "unavailable"
	// still renders a nav item and a locked note (see the template) rather than disappearing, so a
	// player can see why it's there but inert. exists is false either when no Astir has ever been
	// created, or after it's been deleted — Create/Delete are the only ways in or out.
	//
	// astirParts/astirMove/equipment/astirWeapons are all computed once in getData (shared with the
	// Moves/Equipment data methods) and passed in here rather than recomputed.
	_astirData(astir, astirParts, astirMove, equipment, astirWeapons) {
		return {
			available: !this.actor.system.stats?.channel?.disabled,
			exists: Boolean(astir),
			cores: ASTIR_CORES,
			tierMin: ASTIR_TIER_MIN,
			tierMax: ASTIR_TIER_MAX,
			...(astir && {
				// Always the character's own Callsign (see claude.md, "Domain conventions") — an
				// Astir has no name of its own to set here, only to display.
				name: this.actor.system.details?.callsign?.value || this.actor.name,
				img: astir.img || ASTIR_DEFAULT_IMG,
				core: astir.core ?? "",
				approachOptions: astirCoreApproaches(astir.core),
				approach: astir.approach ?? "",
				tier: astir.tier ?? ASTIR_TIER_MIN,
				overheating: astir.overheating ?? false,
				// Gates every part/Astir-weapon benefit (see claude.md's Piloted note) — unchecked
				// by default (see _onAstirCreate). Managing the loadout itself (add/remove/edit
				// Parts, the Astir Move, Astir weapons) is never gated by this.
				piloted: Boolean(astir.piloted),
				// max is always derived from the current parts and equipment, never stored — same
				// reasoning as equipmentValue/advancements.topCount — so it can't drift after a part
				// or weapon changes. negative flags Weapon Drain having outstripped max Power (see
				// claude.md's Piloted note) so the template can call it out visually, not just via
				// the one-time warning toast the mutation handlers raise.
				power: { value: astir.power ?? 0, max: astirMaxPower(astir.parts ?? [], equipment), negative: (astir.power ?? 0) < 0 },
				// A second, Weapon-Conduit-only Power pool — 0/0 (and hidden by the template) for
				// every Astir that doesn't have it.
				weaponPower: { value: astir.weaponPower ?? 0, max: astirMaxWeaponPower(astir.parts ?? [], equipment) },
				// Both only appear once a part actually grants them — an object (even one holding
				// 0) rather than a bare number, so the template's {{#if}} doesn't mistake a
				// legitimate 0 count for "not present".
				potions: astirParts.some((part) => part.grantsPotionsOnLeadASortie)
					? {
						red: astir.potions?.red ?? 0,
						blue: astir.potions?.blue ?? 0,
						yellow: astir.potions?.yellow ?? 0
					}
					: null,
				repairTokens: astirParts.some((part) => part.grantsRepairTokens)
					? { value: astir.repairTokens ?? 0 }
					: null,
				// tier is derived from the Astir's own Tier, not stored on the part — every part
				// installed here is installed on this Astir specifically (see claude.md's Astir
				// section), so there's only ever one frame's Tier for it to reflect.
				parts: astirParts.map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType,
					tier: astir.tier ?? ASTIR_TIER_MIN
				})),
				move: astirMove ? { key: astirMove.key, name: astirMove.name } : null,
				weapons: astirWeapons
			})
		};
	},
	// Every installed part, resolved from its stored keys — purely "what's installed," used for
	// display (the Parts list, Weapon Power's max) regardless of whether the Astir is currently
	// piloted. Effect sites (guided, +CHANNEL, spends, doubles regen, potions) each check
	// _mountedParts() themselves rather than this returning [] when unpiloted, since the Parts
	// list itself still needs to show installed-but-inactive parts.
	_astirParts() {
		return resolveAstirParts(this._astir()?.parts ?? []);
	},
	// The Astir/Ardent Parts equivalent of _equipmentSpends above — every part installed on the
	// currently mounted frame with a `spend.effect` or `spend.advantage` (Artifact — see astir.js)
	// that isn't already Expended, offered in the roll dialog's own Astir Parts section (see
	// configureMoveRoll/move-roll-dialog.hbs). Empty when nothing is mounted (see claude.md's
	// Piloted note) — unlike _equipmentSpends, parts aren't scoped by weapon, since none of them
	// are weapon-specific. A part whose `spend` sets neither (Warding, formerly) doesn't actually
	// modify a roll, so it's excluded here the same way _equipmentSpends excludes an effect-less
	// equipment tag (Ward, Vorpal, Refresh, ...) — its only interaction point is its own
	// `uses`/Expended checkbox, not this dialog.
	_astirPartSpends(lockedEffect) {
		const spends = [];
		for (const part of this._mountedParts()) {
			if (!part.spend?.effect && !part.spend?.advantage) continue;
			if (this.actor.system.attributes?.moveUses?.[part.key]?.expended) continue;
			spends.push({
				partKey: part.key,
				partName: part.name,
				description: part.spend.description,
				effect: part.spend.effect ?? null,
				advantage: part.spend.advantage ?? null,
				disabled: Boolean(lockedEffect && part.spend.effect)
			});
		}
		return spends;
	},
	// Recomputes Power/Weapon Power against a prospective parts/equipment state and, when the result
	// is negative, forces Piloted off with a warning — an Astir with negative Power represents an
	// unsustainable loadout and can't be piloted (see claude.md's Piloted note; mirrors
	// _onAstirPilotedToggle's own guard against manually re-checking it in that state). Returns the
	// patch to spread into whatever update call triggered the recompute (a part or Astir weapon
	// add/edit/remove).
	_astirPowerUpdates(astir, { parts = astir.parts ?? [], equipment = this._equipment() } = {}) {
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
	// Alchemical Suite's "Take 1 of each Potion when someone leads a Sortie" — scoped to this
	// actor's own Lead a Sortie roll (see astir.js's grantsPotionsOnLeadASortie comment). No cap:
	// the rules text never limits how many can stack.
	async _grantPotions() {
		const astir = this._astir();
		if (!astir) return;
		const potions = astir.potions ?? {};
		await this.actor.update({
			"system.attributes.astir.potions": {
				red: (potions.red ?? 0) + 1,
				blue: (potions.blue ?? 0) + 1,
				yellow: (potions.yellow ?? 0) + 1
			}
		});
	},
	// Flourish Component's "regain 1 Power when you roll doubles" — clamped to the derived max the
	// same way _onAstirPowerStep's manual stepper already is.
	async _regainAstirPower(amount) {
		const astir = this._astir();
		if (!astir) return;
		const max = astirMaxPower(astir.parts ?? []);
		const current = astir.power ?? 0;
		const next = Math.min(max, current + amount);
		if (next === current) return;
		await this.actor.update({ "system.attributes.astir.power": next });
	},
	// The Astir Parts equivalent of _spendEquipmentTags above — marks each checked Astir Part
	// spend (Artifact) Expended, the same field the Astir Moves group's own manual checkbox
	// toggles (see _onMoveUseToggle), so either entry point lands on one shared state.
	async _spendAstirParts(partKeys) {
		const updates = {};
		for (const key of partKeys) updates[`system.attributes.moveUses.${key}.expended`] = true;
		await this.actor.update(updates);
	},
	// "+ Create Astir" on an available-but-empty Astir tab. Every player may have at most one —
	// Create/Delete are the only ways in or out (see _onAstirDelete), there's no picker here.
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
				// Unchecked by default — a player isn't always in their Astir, and every part/Astir
				// weapon benefit is inert until this is checked (see claude.md's Piloted note).
				piloted: false,
				parts: [],
				move: null
			}
		});
	},
	// Deleting an Astir also drops every equipment entry it owns (see astir.js) — an orphaned
	// astir: true weapon with no Astir to inherit Tier/Scale from would have nothing to render.
	_onAstirDelete() {
		if (!this._astir()) return;
		this.actor.update({
			"system.attributes.astir": null,
			"system.attributes.equipment": this._equipment().filter((item) => !item.astir)
		});
	},
	// Changing Core narrows which Approaches are valid (see astirCoreApproaches) — a currently-set
	// Approach that the new Core doesn't offer is cleared rather than left dangling unrendered.
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
	// Bounded by astirMaxPower rather than a fixed constant, since Parts can reduce the ceiling —
	// see getData's power.max.
	_onAstirPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.power ?? 0;
		const max = astirMaxPower(astir.parts ?? [], this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.power": next });
	},
	// Bounded by astirMaxWeaponPower rather than a fixed constant, since only Weapon Conduit grants
	// this pool at all — see getData's weaponPower.max.
	_onAstirWeaponPowerStep(event) {
		const astir = this._astir();
		if (!astir) return;
		const { delta } = event.currentTarget.dataset;
		const current = astir.weaponPower ?? 0;
		const max = astirMaxWeaponPower(astir.parts ?? [], this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.weaponPower": next });
	},
	_onAstirOverheatingToggle(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.overheating": event.currentTarget.checked });
	},
	// Alchemical Suite's Potions (see getData/astir.js) — a plain decrement-only "Use" button, min
	// 0, the same manual-spend model this module gives every other consumable resource.
	_onAstirPotionUse(event) {
		const astir = this._astir();
		if (!astir) return;
		const { potion: color } = event.currentTarget.dataset;
		const current = astir.potions?.[color] ?? 0;
		if (current <= 0) return;
		this.actor.update({ [`system.attributes.astir.potions.${color}`]: current - 1 });
	},
	// Adding a Part can lower max Power below the current value (and, for Weapon Conduit, raise
	// max Weapon Power above 0) — all written in the same update, via _astirPowerUpdates.
	async _onAstirPartAdd() {
		const astir = this._astir();
		if (!astir) return;
		const current = astir.parts ?? [];
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
	// The Astir's one unique move, picked from the character's own playbook pool, Cantrips, or the
	// dedicated Astir Moves catalog (see astir.js#astirMoveSections) — picking a new one replaces
	// whatever was there, since only one is ever held.
	async _onAstirMoveAdd() {
		const astir = this._astir();
		if (!astir) return;
		const key = await chooseAstirMove(this.actor.system.playbook?.name, astir.move ? [astir.move] : []);
		if (!key) return;
		this.actor.update({ "system.attributes.astir.move": key });
	},
	_onAstirMoveRemove() {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.move": null });
	},
	// The "O" catalog picker for an Astir weapon (see astir.js#chooseAstirWeapon), then the same
	// editor _onEquipmentCatalogAdd uses, with the astirWeapon option suppressing the fields an
	// Astir weapon doesn't need — see configureEquipment.
	async _onAstirWeaponAdd() {
		const astir = this._astir();
		if (!astir) return;
		const template = await chooseAstirWeapon();
		if (!template) return;

		const result = await configureEquipment(template, undefined, { astirWeapon: true });
		if (!result) return;

		// A new Astir weapon can carry Drain, which lowers max Power (see astir.js's
		// astirWeaponDrainTotal) — recompute via _astirPowerUpdates alongside saving it.
		const equipment = [
			...this._equipment(),
			// familiar: true (see astir.js's ASTIR_WEAPON_CATALOG) carries the same way astir: true
			// does — configureEquipment has no concept of either flag, only of hiding fields for
			// astirWeapon, so both are added here from the picked template rather than `result`.
			{ id: foundry.utils.randomID(), spent: [], astir: true, ...(template.familiar && { familiar: true }), ...result }
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	}
};
