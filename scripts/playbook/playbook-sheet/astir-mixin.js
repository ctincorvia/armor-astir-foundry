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
	requiredAstirMoveKey,
	resolveAstirParts
} from "../../frames/astir.js";
import { configureEquipment } from "../../equipment/equipment.js";
import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { playbookGrantsHomeInsteadOfChannel } from "../../moves/starting-moves.js";

// The Astir itself — its own identity/loadout fields, plus every reactive Astir Part effect
// (Potions, doubles-regen Power, spend-driven Expended) that only ever applies to the Astir
// specifically (see docs/domains/frames.md's Piloted note). Mounting is shared, generic machinery covered by
// the Frames mixin.
export const AstirSheetMixin = {
	_astir() {
		return this.actor.system.attributes?.astir ?? null;
	},
	// Every currently-installed part key — the regular loadout plus the Sortie-scoped Extra Parts
	// pool (see docs/domains/frames.md's Ardents section) — for every consumer that means "what's
	// installed" rather than "the regular-only list for editing/removal".
	_astirPartKeys(astir = this._astir()) {
		return [...(astir?.parts ?? []), ...(astir?.extraParts ?? [])];
	},
	// getData's Astir tab shape. Gated on CHANNEL exactly like the old overheating/power meters
	// were (missing stats.channel reads as enabled, not disabled) — but unlike those, "unavailable"
	// still renders a nav item and a locked note (see the template) rather than disappearing, so a
	// player can see why it's there but inert. exists is false either when no Astir has ever been
	// created, or after it's been deleted — Create/Delete are the only ways in or out.
	//
	// Adrift's own playbook substitutes +HOME for CHANNEL entirely (see playbook-moves.js's love,
	// love, love and playbookGrantsHomeInsteadOfChannel's own comment) — still an Astir-piloting
	// playbook, so it must count as available here too, or its own Astir tab would wrongly show the
	// "requires the CHANNEL trait" locked note forever.
	//
	// The Icon reaches the same outcome a second way: Mechanical Aria (playbook-moves.js) grants an
	// Astir specifically calibrated for a CHANNEL-less pilot. Unlike Adrift's playbook-wide guaranteed
	// substitution, this route is scoped to the individual actor — it only applies once this specific
	// character has picked Mechanical Aria as an advancement, so it's resolved off the actor's own
	// picked playbookMoves rather than the playbook slug.
	//
	// astirParts/astirMove/equipment/astirWeapons are all computed once in getData (shared with the
	// Moves/Equipment data methods) and passed in here rather than recomputed.
	_astirData(astir, astirParts, astirMove, equipment, astirWeapons) {
		return {
			available: !this.actor.system.stats?.channel?.disabled
				|| playbookGrantsHomeInsteadOfChannel(this.actor.system.playbook?.name)
				|| resolvePlaybookMoves(this._playbookMoves()).some((m) => m.grantsAstirAccessWithoutChannel),
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
				// Gates every part/Astir-weapon benefit (see docs/domains/frames.md's Piloted note) — unchecked
				// by default (see _onAstirCreate). Managing the loadout itself (add/remove/edit
				// Parts, the Astir Move, Astir weapons) is never gated by this.
				piloted: Boolean(astir.piloted),
				// max is always derived from the current parts and equipment, never stored — same
				// reasoning as equipmentValue/advancements.topCount — so it can't drift after a part
				// or weapon changes. negative flags Weapon Drain having outstripped max Power (see
				// docs/domains/frames.md's Piloted note) so the template can call it out visually, not just via
				// the one-time warning toast the mutation handlers raise.
				power: {
					value: astir.power ?? 0,
					max: astirMaxPower(this._astirPartKeys(astir), equipment),
					negative: (astir.power ?? 0) < 0
				},
				// A second, Weapon-Conduit-only Power pool — 0/0 (and hidden by the template) for
				// every Astir that doesn't have it.
				weaponPower: { value: astir.weaponPower ?? 0, max: astirMaxWeaponPower(this._astirPartKeys(astir), equipment) },
				// Only appears once a part actually grants it — an object (even one holding every
				// color already spent) rather than a bare boolean, so the template's {{#if}} doesn't
				// mistake "not present" for "installed but fully spent". Standardised Parts' own
				// Repair Tokens grant is now a generic Bonus Downtime Tokens pool instead (see
				// docs/domains/frames.md's Ardents section) — this Potions field is the one
				// remaining example of the pattern. Each color is a spent boolean (true = spent),
				// not a count — Refresh Sortie grants at most 1 of each (see _onRefreshSortie).
				potions: astirParts.some((part) => part.grantsPotionsOnRefreshSortie)
					? {
						red: Boolean(astir.potions?.red),
						blue: Boolean(astir.potions?.blue),
						yellow: Boolean(astir.potions?.yellow)
					}
					: null,
				// tier is derived from the Astir's own Tier, not stored on the part — every part
				// installed here is installed on this Astir specifically (see docs/domains/frames.md's Astir
				// section), so there's only ever one frame's Tier for it to reflect. Resolved separately
				// from astirParts (the regular+Extra union used for the Potions gate above) so the
				// regular loadout and the Sortie-scoped Extra Parts pool render as two distinct lists.
				parts: resolveAstirParts(astir.parts ?? []).map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType,
					tier: astir.tier ?? ASTIR_TIER_MIN,
					disabled: this._isPartDisabled(part.key),
					// Spell Routines' own dropdown (see astir-parts.js's grantsGuided comment and
					// _guidedMoveOptions below) — every other part renders this as false/blank, since
					// only grantsGuided carries a choosable target move at all.
					guidedMoveChoosable: Boolean(part.grantsGuided),
					guidedMoveChoice: this.actor.system.attributes?.guidedMoveChoices?.[part.key] ?? ""
				})),
				partsFull: (astir.parts ?? []).length >= ASTIR_MAX_PARTS,
				// A part key is unique across the regular and Extra pools, so Spell Routines can land
				// in either one — this mapping carries the same guidedMoveChoosable/guidedMoveChoice
				// fields as the regular parts mapping above for that reason.
				extraParts: resolveAstirParts(astir.extraParts ?? []).map((part) => ({
					key: part.key,
					name: part.name,
					powerCost: part.powerCost,
					partType: part.partType,
					tier: astir.tier ?? ASTIR_TIER_MIN,
					disabled: this._isPartDisabled(part.key),
					guidedMoveChoosable: Boolean(part.grantsGuided),
					guidedMoveChoice: this.actor.system.attributes?.guidedMoveChoices?.[part.key] ?? ""
				})),
				move: astirMove ? { key: astirMove.key, name: astirMove.name } : null,
				weapons: astirWeapons.filter((w) => !w.extra),
				extraWeapons: astirWeapons.filter((w) => w.extra)
			})
		};
	},
	// Every installed part, resolved from its stored keys — purely "what's installed," used for
	// display (the Parts list, Weapon Power's max) regardless of whether the Astir is currently
	// piloted. Effect sites (guided, +CHANNEL, spends, doubles regen, potions) each check
	// _mountedParts() themselves rather than this returning [] when unpiloted, since the Parts
	// list itself still needs to show installed-but-inactive parts.
	_astirParts() {
		return resolveAstirParts(this._astirPartKeys());
	},
	// Recomputes Power/Weapon Power against a prospective parts/equipment state and, when the result
	// is negative, forces Piloted off with a warning — an Astir with negative Power represents an
	// unsustainable loadout and can't be piloted (see docs/domains/frames.md's Piloted note; mirrors
	// _onAstirPilotedToggle's own guard against manually re-checking it in that state). Returns the
	// patch to spread into whatever update call triggered the recompute (a part or Astir weapon
	// add/edit/remove).
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
	// Flourish Component's "regain 1 Power when you roll doubles" — clamped to the derived max the
	// same way _onAstirPowerStep's manual stepper already is.
	async _regainAstirPower(amount) {
		const astir = this._astir();
		if (!astir) return;
		const max = astirMaxPower(this._astirPartKeys(astir));
		const current = astir.power ?? 0;
		const next = Math.min(max, current + amount);
		if (next === current) return;
		await this.actor.update({ "system.attributes.astir.power": next });
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
				// weapon benefit is inert until this is checked (see docs/domains/frames.md's Piloted note).
				piloted: false,
				parts: [],
				extraParts: [],
				move: requiredAstirMoveKey(this.actor.system.playbook?.name) ?? null
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
	// Spell Routines' own dropdown (see getData's parts/extraParts mapping) — writes the chosen
	// move's key keyed by the granting part's own key, the same per-source keying
	// bonusDowntimeTokens/moveHold already use, so two different Guided-granting parts (should one
	// ever exist) can't collide. No `_astir()` guard, mirroring _onTraitBonusChoiceChange's own
	// unguarded write for the analogous move-side control.
	_onGuidedMoveChoiceChange(event) {
		const { part: partKey } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.guidedMoveChoices.${partKey}`]: event.currentTarget.value });
	},
	// Spell Routines' dropdown options — every rollable move rendered anywhere in moveGroups
	// (Basic, Playbook, Astir, each Ardent's, Special alike), deduped by key. Guided only ever
	// takes effect inside _rollMove (move-roll-mixin.js), so an activatable/summonable move
	// (flatHold, showsReadTheRoomQuestions, Eidolon Drive's Summon, ...) or Plan & Prepare's
	// variableDiceRoll — none of which ever reach _rollMove/configureMoveRoll — would be a choice
	// that silently never fires; only rollable: true moves are offered.
	_guidedMoveOptions(moveGroups) {
		const options = new Map();
		for (const group of moveGroups) {
			for (const move of group.moves) {
				if (!move.rollable) continue;
				options.set(move.key, { key: move.key, name: move.name });
			}
		}
		return [...options.values()];
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
		const max = astirMaxPower(this._astirPartKeys(astir), this._equipment());
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
		const max = astirMaxWeaponPower(this._astirPartKeys(astir), this._equipment());
		const next = Math.min(max, Math.max(ASTIR_POWER_MIN, current + Number(delta)));
		if (next === current) return;
		this.actor.update({ "system.attributes.astir.weaponPower": next });
	},
	_onAstirOverheatingToggle(event) {
		if (!this._astir()) return;
		this.actor.update({ "system.attributes.astir.overheating": event.currentTarget.checked });
	},
	// Alchemical Suite's Potions (see getData/astir.js) — a plain, freely reversible spent
	// checkbox, the same manual-tracker shape _onEquipmentTagSpentToggle/_onMoveUseToggle already
	// give every other single-use resource in this module.
	_onAstirPotionToggle(event) {
		const astir = this._astir();
		if (!astir) return;
		const { potion: color } = event.currentTarget.dataset;
		this.actor.update({ [`system.attributes.astir.potions.${color}`]: event.currentTarget.checked });
	},
	// Adding a Part can lower max Power below the current value (and, for Weapon Conduit, raise
	// max Weapon Power above 0) — all written in the same update, via _astirPowerUpdates.
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
	// The Sortie-scoped Extra Part pool (see docs/domains/frames.md's Ardents section) — otherwise
	// identical to _onAstirPartAdd, including Power recompute, but excludes the regular parts too
	// (a key already installed either way isn't offered again) and writes extraParts instead.
	async _onAstirExtraPartAdd() {
		const astir = this._astir();
		if (!astir) return;
		const current = astir.extraParts ?? [];
		const key = await chooseAstirPart([...(astir.parts ?? []), ...current]);
		if (!key || current.includes(key)) return;
		const extraParts = [...current, key];
		this.actor.update({
			"system.attributes.astir.extraParts": extraParts,
			...this._astirPowerUpdates(astir, { parts: [...(astir.parts ?? []), ...extraParts] })
		});
	},
	_onAstirExtraPartRemove(event) {
		const astir = this._astir();
		if (!astir) return;
		const { part: key } = event.currentTarget.dataset;
		const current = astir.extraParts ?? [];
		if (!current.includes(key)) return;
		const extraParts = current.filter((k) => k !== key);
		this.actor.update({
			"system.attributes.astir.extraParts": extraParts,
			...this._astirPowerUpdates(astir, { parts: [...(astir.parts ?? []), ...extraParts] })
		});
	},
	// The Astir's one unique move, picked from the character's own playbook pool, Cantrips, or the
	// dedicated Astir Moves catalog (see astir.js#astirMoveSections) — picking a new one replaces
	// whatever was there, since only one is ever held. Also passes the actor's regular playbookMoves
	// as already-selected, alongside the Astir's own current move — both pools draw from the same
	// flat MOVE_POOLS content, so an exclusiveGroup pair (Field Scout/Giant Slayer, Earthly Ally/
	// Titanic — see playbook-moves.js#pickerSection) must be excluded here too, not just in the
	// regular "+" picker, or this picker would let a player pick the sibling as their Astir move.
	async _onAstirMoveAdd() {
		const astir = this._astir();
		if (!astir) return;
		// Some playbooks' Astir Move is fixed, not a free pick — see astir.js#requiredAstirMoveKey.
		const requiredKey = requiredAstirMoveKey(this.actor.system.playbook?.name);
		if (requiredKey) {
			this.actor.update({ "system.attributes.astir.move": requiredKey });
			return;
		}
		const key = await chooseAstirMove(
			this.actor.system.playbook?.name,
			[...this._playbookMoves(), ...(astir.move ? [astir.move] : [])],
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
	// The "O" catalog picker for an Astir weapon (see astir.js#chooseAstirWeapon), then the same
	// editor _onEquipmentCatalogAdd uses, with the astirWeapon option suppressing the fields an
	// Astir weapon doesn't need — see configureEquipment. lockTags fixes its Kind/Tier/Range/Tags
	// permanently (see docs/domains/equipment.md's "Equipment" notes); the saved entry is stamped
	// catalogSource: true so a later _onEquipmentEdit reopens it locked too.
	async _onAstirWeaponAdd() {
		const astir = this._astir();
		if (!astir) return;
		const template = await chooseAstirWeapon(undefined, this._astirParts().map((part) => part.key));
		if (!template) return;

		const result = await configureEquipment(template, undefined, { astirWeapon: true, lockTags: true });
		if (!result) return;

		// A new Astir weapon can carry Drain, which lowers max Power (see astir.js's
		// astirWeaponDrainTotal) — recompute via _astirPowerUpdates alongside saving it.
		const equipment = [
			...this._equipment(),
			// familiar: true (see astir.js's ASTIR_WEAPON_CATALOG) carries the same way astir: true
			// does — configureEquipment has no concept of either flag, only of hiding fields for
			// astirWeapon, so both are added here from the picked template rather than `result`.
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
	// The custom-creation counterpart to _onAstirWeaponAdd — no catalog step, and subject to the new
	// "tags sum to 0 or less" budget rule (maxTagValue: 0) instead of being tag-locked. Saves with
	// catalogSource: false explicitly (not just omitted) so a later _onEquipmentEdit can tell this
	// apart from a pre-existing catalog-sourced Astir weapon that never got the flag stamped at all
	// (see docs/domains/equipment.md's "Equipment" notes).
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
	// The Sortie-scoped Extra Weapon pool's own catalog picker — otherwise identical to
	// _onAstirWeaponAdd, but the saved entry additionally carries extra: true so getData/
	// _onRefreshSortie can tell it apart from a regular Astir weapon.
	async _onAstirExtraWeaponAdd() {
		const astir = this._astir();
		if (!astir) return;
		const template = await chooseAstirWeapon(undefined, this._astirParts().map((part) => part.key));
		if (!template) return;

		const result = await configureEquipment(template, undefined, { astirWeapon: true });
		if (!result) return;

		const equipment = [
			...this._equipment(),
			{
				id: foundry.utils.randomID(),
				spent: [],
				astir: true,
				extra: true,
				...(template.familiar && { familiar: true }),
				...result
			}
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	},
	// The Extra Weapon pool's custom-creation counterpart to _onAstirExtraWeaponAdd, combining
	// _onAstirWeaponCustomAdd's no-catalog/budget-rule shape with extra: true and no loadout-cap
	// guard, matching its own catalog sibling (Extra Weapons is deliberately uncapped).
	async _onAstirExtraWeaponCustomAdd() {
		const astir = this._astir();
		if (!astir) return;
		const result = await configureEquipment({ kind: "weapon" }, undefined, { astirWeapon: true, maxTagValue: 0 });
		if (!result) return;

		const equipment = [
			...this._equipment(),
			{ id: foundry.utils.randomID(), spent: [], astir: true, extra: true, catalogSource: false, ...result }
		];
		this.actor.update({
			"system.attributes.equipment": equipment,
			...this._astirPowerUpdates(astir, { equipment })
		});
	}
};
