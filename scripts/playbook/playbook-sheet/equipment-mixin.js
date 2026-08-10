import {
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	configureEquipment,
	equipmentValue,
	findEquipmentTag,
	mergeSpentTags,
	resolveEquipmentTags
} from "../../equipment/equipment.js";
import {
	CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
	DEFAULT_CUSTOM_WEAPON_MAX_VALUE,
	chooseStartingGear,
	findStartingGearPool
} from "../../equipment/starting-gear.js";
import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";

// Custom-made equipment (see claude.md's Domain conventions) — weapons and gear share one array,
// distinguished by `kind`, with tags as the separate catalog (see equipment.js). Owns every
// weapon-specific helper (guided, reroll, forced effect, tag labels) alongside the plain CRUD.
export const EquipmentSheetMixin = {
	_equipment() {
		return this.actor.system.attributes?.equipment ?? [];
	},
	_weapons() {
		return this._equipment().filter((item) => item.kind === "weapon");
	},
	// Signed & Sealed (The Attendant): "any weapon you wield gains the messy and decisive tags" —
	// every picked move's own grantsWeaponTags flag, unioned and deduped, the same declarative-
	// flag-evaluated-generically convention every other cross-cutting move flag in this codebase
	// follows. A read-time union only, never persisted onto the equipment entry itself.
	_grantedWeaponTagKeys() {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		return [...new Set(picked.flatMap((move) => move.grantsWeaponTags ?? []))];
	},
	// A weapon entry's effective tag-key list: its own stored tags plus any move-granted ones,
	// deduped. Gear is untouched — grantsWeaponTags only ever applies to weapons.
	_weaponTagKeys(entry) {
		if (entry.kind !== "weapon") return entry.tags ?? [];
		return [...new Set([...(entry.tags ?? []), ...this._grantedWeaponTagKeys()])];
	},
	// getData's Equipment tab shape. weaponMoves/astirWeapons/ardentWeaponEntriesById are all
	// computed once in getData (shared with the Astir/Ardent data methods, which render the same
	// Astir/Ardent weapon entries read-only on their own tab) and passed in here rather than
	// recomputed — see getData's own comment on why. Weapons get their own header per claude.md;
	// gear is everything that isn't a weapon.
	_equipmentData(equipment, weaponMoves, astirWeapons, ardentWeaponEntriesById, ardents, startingGearPool) {
		return {
			weapons: equipment
				.filter((item) => item.kind === "weapon" && !item.astir && !item.ardent)
				.map((item) => this._equipmentEntry(item, weaponMoves)),
			astirWeapons,
			ardentWeapons: ardents.flatMap((ardent) => ardentWeaponEntriesById.get(ardent.id)),
			gear: equipment.filter((item) => item.kind !== "weapon").map((item) => this._equipmentEntry(item)),
			// The "+ Choose Starting Gear" button (see PlaybookActorSheet#_onStartingGearAdd) only
			// shows up once its playbook's pool actually has something to offer AND the actor's
			// equipment is currently empty — same "drop when empty" treatment moveGroups gives an
			// empty playbook move pool, so The Commander stays hidden until its pool is filled in
			// (see starting-gear.js). This is a live emptiness check, not a one-time flag: cancelling
			// every dialog it opens leaves the button available to retry, and removing every
			// equipment entry brings it back — unlike "+ Add Playbook Move"/"+ Add Weapon"/"+ Add
			// Gear", which are always offered regardless.
			startingGear: {
				available: Boolean(
					startingGearPool?.grantedItems?.length
						|| startingGearPool?.groups?.some((group) => group.items.length)
						|| startingGearPool?.customWeaponNote
				) && equipment.length === 0
			}
		};
	},
	// Shared by getData (render shape) and _equipmentSpends (roll dialog offers) so a tag's
	// current definition is only ever resolved from the catalog in one place. Value is always the
	// live sum of the entry's current tags (see equipmentValue in equipment.js), never stored, so
	// it can't drift out of sync after a tag is added or removed. scale/tier/weaponMoves are only
	// present for weapons — gear never carries them. weaponMoves is precomputed once in getData
	// and passed in here rather than recomputed per entry — see getData's own comment.
	//
	// `frame` (the owning Astir's raw data, or an Ardent's — either just needs a `.tier` — or null)
	// is only ever needed for an entry flagged astir: true or ardent: "<id>" (see astir.js/
	// ardent.js) — such an entry never stores its own scale/tier, inheriting its frame's Tier and
	// the "astir" WEAPON_SCALES entry instead (an Ardent weapon is Astir-scale too — see claude.md's
	// Ardents section), so isAstir tells the template to render that as read-only text rather than
	// a stepper/select. A mundane weapon likewise never stores its own tier — it derives from
	// _conflictTier().base, the character's own on-foot Tier, rather than the frame's (`.effective`
	// would read as whichever frame is currently mounted, which is meaningless here: a mundane
	// weapon is already gated off entirely while mounted — see _weaponGateTooltip).
	_equipmentEntry(entry, weaponMoves = [], frame = null) {
		const tags = resolveEquipmentTags(this._weaponTagKeys(entry)).map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			// A forcesEffect tag (Unreliable) shows the same "used this period" checkbox as a
			// player-opted spend, even though checking it happens automatically after a roll rather
			// than by the player's own choice — see _forcedWeaponEffect/_rollMove. A reroll tag
			// (Decisive/Defensive/Versatile) gets marked spent the same way, by handleReroll — without
			// this, its checkbox would never render at all, leaving a spent reroll tag with no way to
			// clear it back for a new Scene (the same manual-reset gap _onEquipmentTagSpentToggle's
			// comment already covers for the other two).
			spendable: Boolean(tag.spend || tag.forcesEffect || tag.reroll),
			spent: Boolean(entry.spent?.includes(tag.key))
		}));
		return {
			id: entry.id,
			kind: entry.kind,
			name: entry.name,
			description: entry.description,
			tags,
			value: equipmentValue(this._weaponTagKeys(entry)),
			...(entry.kind === "weapon" && {
				scale: (entry.astir || entry.ardent) ? "astir" : entry.scale,
				scaleLabel: (entry.astir || entry.ardent)
					? WEAPON_SCALES.find((s) => s.key === "astir")?.label
					: WEAPON_SCALES.find((s) => s.key === entry.scale)?.label ?? entry.scale,
				tier: (entry.astir || entry.ardent) ? frame?.tier : this._conflictTier().base,
				weaponMoves,
				isAstir: Boolean(entry.astir),
				// Commander-exclusive (see ardent.js's ardentFeatureLoadoutCount) — surfaced here so
				// getData's per-Ardent split into baseline vs. Feature weapons can read it off the
				// already-mapped entry rather than re-filtering the raw equipment array a second time.
				commanderFeature: Boolean(entry.commanderFeature)
			})
		};
	},
	// The unspent, spendable tags across the actor's equipment, offered as checkboxes in the roll
	// dialog's Equipment section (see _rollMove/configureMoveRoll). Not filtered by move or trait
	// otherwise — every unspent spendable tag on an offerable entry is offered, same
	// non-enforcement stance as move pool membership (see playbook-moves.js). `disabled` is true
	// whenever the roll already has a locked Effect (bite-the-dust at max Perils): every spend
	// today only ever sets the Effect axis, so honoring the lock means refusing to let a tag be
	// spent for nothing, rather than silently consuming it.
	//
	// `weapon` is the "which weapon" distinction _rollMove already carries: left `undefined` for a
	// move that doesn't care (every current move except Exchange Blows/Strike Decisively), every
	// entry is offered exactly as before. Passed explicitly — an actual weapon entry, or `null` for
	// Unarmed — every *other* weapon's entries are excluded; gear is never filtered, since a
	// character can plausibly have more than one relevant piece of gear active at once, just not
	// more than one weapon in hand.
	_equipmentSpends(lockedEffect, weapon) {
		const scoped = weapon !== undefined;
		const mountedFrameId = this._mountedFrame()?.id ?? null;
		const spends = [];
		for (const entry of this._equipment()) {
			// A weapon belonging to a frame other than the one currently mounted (or, for a mundane
			// weapon, any frame being mounted at all — see claude.md's Piloted note) never offers its
			// tags, regardless of `weapon`/scoped (this is the one spot that isn't already reached
			// through _onMoveRoll's own frame filter, since a non-usesWeapon move leaves `weapon`
			// undefined and scoped false). Gear is untouched.
			if (entry.kind === "weapon" && this._weaponFrameId(entry) !== mountedFrameId) continue;
			if (scoped && entry.kind === "weapon" && entry.id !== weapon?.id) continue;
			const spent = entry.spent ?? [];
			for (const tagKey of this._weaponTagKeys(entry)) {
				if (spent.includes(tagKey)) continue;
				const tag = findEquipmentTag(tagKey);
				// A spend with no `effect` (Ward, Vorpal, One-Use, Refresh, Dangerous) only tracks
				// "used this period" via the Equipment tab's own checkbox (see _equipmentEntry) —
				// its effect happens outside any one roll, so it's never offered here.
				if (!tag?.spend?.effect) continue;
				spends.push({
					equipmentId: entry.id,
					equipmentName: entry.name,
					tagKey: tag.key,
					tagLabel: tag.label,
					description: tag.description,
					effect: tag.spend.effect,
					disabled: Boolean(lockedEffect)
				});
			}
		}
		return spends;
	},
	// Turns a starting-gear pool entry (granted or picked — see starting-gear.js) into a real
	// equipment.js-shaped entry, the same snapshot treatment a catalog pick already gets. Only a
	// weapon-kind item carries scale at all (mirrors _equipmentEntry's own weapon-only spread) —
	// scale defaults to "foot", since none of these are Astir-scale (those are only ever added
	// from the Astir tab). tier is never stored — it derives from the wielding character (see
	// _equipmentEntry), same as every other mundane weapon.
	_startingGearEntry(item) {
		return {
			id: foundry.utils.randomID(),
			spent: [],
			kind: item.kind ?? "gear",
			name: item.name,
			description: item.description,
			tags: item.tags ?? [],
			...(item.kind === "weapon" && { scale: item.scale ?? "foot" })
		};
	},
	// Shared tail of _onEquipmentAdd and _onEquipmentCatalogAdd: appends a resolved
	// configureEquipment result as a brand-new entry, generating its id and starting spent empty.
	async _saveNewEquipment(result) {
		const current = this._equipment();
		await this.actor.update({
			"system.attributes.equipment": [...current, { id: foundry.utils.randomID(), spent: [], ...result }]
		});
	},
	// The chosen weapon's still-live (unspent) forcesEffect tag, if any — e.g. Unreliable, which
	// forces Desperation on its first roll each Scene rather than being player-opted like `spend`
	// (see equipment.js's EQUIPMENT_TAGS comment). Returns the tag key alongside the effect so the
	// caller can mark it spent afterward the same way a player's own spend is marked. Only a
	// usesWeapon move ever passes a real weapon (or null for Unarmed) here — every other move's
	// `weapon` stays undefined and short-circuits to null via the falsy check.
	_forcedWeaponEffect(weapon) {
		if (!weapon) return null;
		const spent = weapon.spent ?? [];
		for (const tagKey of this._weaponTagKeys(weapon)) {
			if (spent.includes(tagKey)) continue;
			const tag = findEquipmentTag(tagKey);
			if (tag?.forcesEffect) return { tagKey, effect: tag.forcesEffect.effect };
		}
		return null;
	},
	// The chosen weapon's still-live (unspent) reroll tag matching this move, if any (Decisive,
	// Defensive, Versatile — see equipment.js's EQUIPMENT_TAGS comment). Same shape/short-circuit
	// as _forcedWeaponEffect, but keyed off the move rather than always-applicable: Decisive only
	// lists strike-decisively, Defensive only exchange-blows, so a weapon's Decisive tag offers
	// nothing when rolling Exchange Blows.
	_availableReroll(move, weapon) {
		if (!weapon) return null;
		const spent = weapon.spent ?? [];
		for (const tagKey of this._weaponTagKeys(weapon)) {
			if (spent.includes(tagKey)) continue;
			const tag = findEquipmentTag(tagKey);
			if (tag?.reroll?.moves.includes(move.key)) return { equipmentId: weapon.id, tagKey };
		}
		return null;
	},
	// Whether the chosen weapon has a live Guided tag (see equipment.js's EQUIPMENT_TAGS comment).
	// Unlike a spend or a reroll, Guided has no "once per period" limit and nothing to mark spent
	// — it's just always offerable as long as the weapon carries the tag.
	_weaponIsGuided(weapon) {
		if (!weapon) return false;
		return this._weaponTagKeys(weapon).some((tagKey) => findEquipmentTag(tagKey)?.guided);
	},
	// The chosen weapon's full tag list, comma-joined for the chat card (see moves.js#rollMove's
	// weaponTags doc) — unlike _equipmentSpends this isn't limited to spendable tags or gated by
	// lockedEffect, it's just descriptive: every tag currently on the weapon, spent or not. null
	// for Unarmed/no weapon and for a weapon with no tags, matching weaponLabel's own null cases.
	_weaponTagLabels(weapon) {
		if (!weapon) return null;
		const labels = resolveEquipmentTags(this._weaponTagKeys(weapon)).map((tag) => tag.label);
		return labels.length ? labels.join(", ") : null;
	},
	// Marks each checked equipment spend (see configureMoveRoll's Equipment section) as spent on
	// its entry, before the roll itself is posted — same write-then-roll order as read-the-room's
	// hold in rollMove, so the sheet reflects a spend even if the chat render that follows fails.
	async _spendEquipmentTags(spentTags) {
		await this.actor.update({ "system.attributes.equipment": mergeSpentTags(this._equipment(), spentTags) });
	},
	// Opens the create dialog, defaulting Kind to whichever "+ Add" button was clicked (Weapons vs
	// Gear section — see the template) — still changeable in the dialog itself, since the Kind
	// select there is the actual source of truth at submit time. Equipment is custom-made every
	// time (see claude.md, "Domain conventions"), so there's no catalog entry to append, only a
	// freshly authored one.
	async _onEquipmentAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const result = await configureEquipment({ kind });
		if (!result) return;

		await this._saveNewEquipment(result);
	},
	// The "+ Pick ... from Catalog" button. Chains two dialogs: chooseEquipmentCatalogItem picks
	// which template to start from, then the exact same editor _onEquipmentAdd uses opens
	// pre-filled with it — the player can still rename it, add/drop tags, or adjust tier before
	// saving, same as any custom entry. A catalog pick is a snapshot, not a reference (see
	// claude.md, "Equipment"): nothing about the saved entry records which catalog item it came
	// from, so it's indistinguishable from hand-authored equipment from this point on.
	async _onEquipmentCatalogAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const template = await chooseEquipmentCatalogItem(kind);
		if (!template) return;

		const result = await configureEquipment(template);
		if (!result) return;

		await this._saveNewEquipment(result);
	},
	// The "+ Choose Starting Gear" button (see getData's startingGear.available). Chains two
	// independent dialogs the same way _onEquipmentCatalogAdd and _onMoveRoll already chain
	// theirs: chooseStartingGear's hard-capped subset pick (see starting-gear.js), then
	// configureEquipment for the pool's custom weapon (skipped entirely for a pool with no
	// customWeaponNote, e.g. The Commander before its pool is filled in). Each half resolves null
	// independently on cancel — cancelling one still saves the other if it was completed — and
	// picked gear items are saved as ordinary snapshot equipment entries, same treatment as a
	// catalog pick (see claude.md, "Equipment").
	//
	// Availability is a live emptiness check (see getData's startingGear.available), not a
	// one-time flag — so a fully-cancelled run leaves the actor untouched and the button available
	// to try again next render. Granted items (Augments I) are still added unconditionally,
	// regardless of what chooseStartingGear resolves — same treatment starting-moves.js's own
	// grantedKeys get from _onStartingMovesAdd.
	async _onStartingGearAdd() {
		const playbookName = this.actor.system.playbook?.name;
		const pool = findStartingGearPool(playbookName);
		// Mirrors getData's startingGear.available gate — a pool with nothing to offer (e.g. The
		// Commander today) never reaches the button in the first place, but guarding here too
		// keeps this a true no-op.
		const hasPickableItems = Boolean(pool?.groups?.some((group) => group.items.length));
		if (!pool || (!pool.grantedItems.length && !hasPickableItems && !pool.customWeaponNote)) return;

		const newEntries = pool.grantedItems.map((item) => this._startingGearEntry(item));

		// The dialog opens whenever there's anything to show — items to pick from, or just the
		// granted items' own read-only "You start with" block (see starting-gear-picker.hbs) — the
		// same "always confirm, even with nothing to pick" treatment _onStartingMovesAdd gives
		// Arcane Augments.
		if (pool.grantedItems.length || hasPickableItems) {
			const picked = await chooseStartingGear(playbookName);
			if (picked) newEntries.push(...picked.map((item) => this._startingGearEntry(item)));
		}

		if (pool.customWeaponNote) {
			const weapon = await configureEquipment({ kind: "weapon" }, undefined, {
				note: pool.customWeaponNote,
				excludedTagKeys: CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
				maxTagValue: pool.customWeaponMaxValue ?? DEFAULT_CUSTOM_WEAPON_MAX_VALUE
			});
			if (weapon) newEntries.push({ id: foundry.utils.randomID(), spent: [], ...weapon });
		}

		// Nothing was granted and every dialog was cancelled — leave the actor untouched so the
		// button stays available (equipment is still empty) rather than writing a no-op update.
		if (!newEntries.length) return;
		await this.actor.update({ "system.attributes.equipment": [...this._equipment(), ...newEntries] });
	},
	async _onEquipmentEdit(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		if (!entry) return;

		// An Astir or Ardent weapon reopens with the matching option that hid its Kind/Scale/Tier
		// fields when it was first added (see _onAstirWeaponAdd/_onArdentWeaponAdd/
		// configureEquipment) — it's never possible to edit one into a mundane weapon or into Gear,
		// or from one frame's ownership into another's. Every other entry's call is left byte-for-
		// byte as it was before this option existed.
		const result = entry.astir
			? await configureEquipment(entry, undefined, { astirWeapon: true })
			: entry.ardent
				? await configureEquipment(entry, undefined, { ardentWeapon: true })
				: await configureEquipment(entry);
		if (!result) return;

		// Replaces the entry wholesale (keeping only id/spent/astir/ardent/familiar) rather than
		// merging onto the old one — editing a weapon down to Gear should drop its stale scale/tier,
		// not leave them dangling unrendered. astir/ardent/familiar are carried forward explicitly,
		// last, since result never includes any of them (configureEquipment has no concept of them,
		// only of hiding fields for astirWeapon/ardentWeapon).
		const equipment = current.map((item) => (
			item.id === equipmentId
				? {
					id: item.id,
					spent: item.spent ?? [],
					...result,
					...(item.astir && { astir: true }),
					...(item.ardent && { ardent: item.ardent }),
					...(item.familiar && { familiar: true })
				}
				: item
		));
		const updates = { "system.attributes.equipment": equipment };
		// Only an Astir weapon's own tags can move the Weapon Drain total (see astir.js's
		// astirWeaponDrainTotal) — every other edit (gear, mundane weapons, Ardent weapons — an
		// Ardent weapon can never carry Drain, see ardent.js's ardentWeapons) leaves Power untouched,
		// so this stays keyed off the pre-edit entry rather than always recomputing.
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
	// The manual "new Scene" reset for a spent tag — same manual-tracking model as
	// _onMoveUseToggle and the Advancement checklist; nothing in this module knows when a Scene
	// starts, so a spent tag stays spent until the player unchecks it themselves (here, or by
	// spending it again through the roll dialog — see _onMoveRoll).
	_onEquipmentTagSpentToggle(event) {
		const { equipmentId, tag: tagKey } = event.currentTarget.dataset;
		const checked = event.currentTarget.checked;
		const current = this._equipment();
		this.actor.update({
			"system.attributes.equipment": current.map((item) => {
				if (item.id !== equipmentId) return item;
				const spent = item.spent ?? [];
				const nextSpent = checked ? [...new Set([...spent, tagKey])] : spent.filter((key) => key !== tagKey);
				return { ...item, spent: nextSpent };
			})
		});
	}
};
