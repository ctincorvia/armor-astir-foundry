import {
	DRAIN_GROUP,
	WEAPON_SCALES,
	chooseEquipmentCatalogItem,
	configureEquipment,
	equipmentValue,
	findEquipmentTag,
	mergeSpentTags,
	rerollSpendKey,
	resolveEquipmentTags
} from "../../equipment/equipment.js";
import {
	CUSTOM_WEAPON_EXCLUDED_TAG_KEYS,
	DEFAULT_CUSTOM_WEAPON_MAX_VALUE,
	chooseStartingGear,
	findStartingGearPool
} from "../../equipment/starting-gear.js";
import { resolvePlaybookMoves } from "../../moves/playbook-moves.js";
import { ALL_MOVES } from "../../moves/all-moves.js";

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
	// Advanced Evocation (Cantrips): grantsWeaponTagChoice's own per-actor pick — unlike
	// grantsWeaponTags above, which applies to every weapon uniformly, this only ever applies to
	// the one specific weapon it names (matched by `name`, the same link grantsEquipment's own
	// dedupe already relies on — see docs/domains/equipment.md/moves.md), and the tag itself is
	// player-chosen rather than fixed in the catalog. No stored choice yet, or a choice naming a
	// tag key that's no longer real, both resolve to nothing rather than throwing.
	_grantedWeaponTagChoiceKeys(entry) {
		const picked = resolvePlaybookMoves(this._playbookMoves());
		const choices = this.actor.system.attributes?.weaponTagChoices ?? {};
		return picked
			.filter((move) => move.grantsWeaponTagChoice?.targetEquipmentName === entry.name)
			.map((move) => choices[move.key])
			.filter(Boolean);
	},
	// A weapon entry's effective tag-key list: its own stored tags plus any move-granted ones
	// (fixed or chosen), deduped. Gear is untouched — neither grant ever applies to it.
	_weaponTagKeys(entry) {
		if (entry.kind !== "weapon") return entry.tags ?? [];
		return [...new Set([
			...(entry.tags ?? []),
			...this._grantedWeaponTagKeys(),
			...this._grantedWeaponTagChoiceKeys(entry)
		])];
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
	// the "astir" WEAPON_SCALES entry instead (an Ardent weapon is Astir-scale too — see docs/domains/frames.md's
	// Ardents section), so isAstir tells the template to render that as read-only text rather than
	// a stepper/select. A mundane weapon likewise never stores its own tier — it derives from
	// _conflictTier().base, the character's own on-foot Tier, rather than the frame's (`.effective`
	// would read as whichever frame is currently mounted, which is meaningless here: a mundane
	// weapon is already gated off entirely while mounted — see _weaponGateTooltip).
	_equipmentEntry(entry, weaponMoves = [], frame = null) {
		// A forcesEffect tag (Unreliable) shows the same "used this period" checkbox as a
		// player-opted spend, even though checking it happens automatically after a roll rather
		// than by the player's own choice — see _forcedWeaponEffect/_rollMove. A reroll tag
		// (Decisive/Defensive/Versatile) gets marked spent the same way, by handleReroll — without
		// this, its checkbox would never render at all, leaving a spent reroll tag with no way to
		// clear it back for a new Scene (the same manual-reset gap _onEquipmentTagSpentToggle's
		// comment already covers for the other two). A multi-move reroll tag (Versatile) renders one
		// row per move it can reroll instead of one combined row, each independently spendable/spent
		// via its own compound spendKey (see equipment.js#rerollSpendKey) — showValue suppresses the
		// value badge on every row after the first, so a split tag's Value only prints once.
		const tags = resolveEquipmentTags(this._weaponTagKeys(entry)).flatMap((tag) => {
			const spendable = Boolean(tag.spend || tag.forcesEffect || tag.reroll);
			if (tag.reroll && tag.reroll.moves.length > 1) {
				return tag.reroll.moves.map((moveKey, index) => {
					const spendKey = rerollSpendKey(tag, moveKey);
					return {
						key: spendKey,
						// Every reroll.moves entry is real catalog data authored alongside the move it
						// names (see the EQUIPMENT_TAGS invariant test in tests/equipment.test.js) — no
						// stale-key fallback here, the same trust findEquipmentTag(rerollOffer.tagKey)
						// already places in a reroll offer's own tagKey (moves.js's rerollLabel).
						label: `${tag.label} — ${ALL_MOVES.find((m) => m.key === moveKey).name}`,
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
				weaponMoves: weaponMoves.map((move) => (
					entry.disabled ? { ...move, gated: true, tooltip: move.tooltip ?? "This weapon is disabled." } : move
				)),
				isAstir: Boolean(entry.astir),
				// Commander-exclusive (see ardent.js's ardentFeatureLoadoutCount) — surfaced here so
				// getData's per-Ardent split into baseline vs. Feature weapons can read it off the
				// already-mapped entry rather than re-filtering the raw equipment array a second time.
				commanderFeature: Boolean(entry.commanderFeature),
				// The Extra Weapon pool's own flag (see docs/domains/frames.md's Ardents section) —
				// surfaced here so getData's Astir/Ardent weapons/extraWeapons split can read it off
				// the already-mapped entry rather than re-filtering the raw equipment array again.
				extra: Boolean(entry.extra),
				// Manual "in-fiction consequence" tracker (weapon damaged) — same manual-tracker
				// convention as astir.overheating/piloted (see claude.md's Recurring conventions).
				// Excludes the weapon from being chosen for a roll (see move-roll-mixin.js's
				// _onMoveRoll/_onWeaponMoveRoll) and gates its own quick-roll buttons above, but does
				// NOT affect Drain/Power math — a disabled weapon is still installed, just unusable.
				disabled: Boolean(entry.disabled)
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
			// weapon, any frame being mounted at all — see docs/domains/frames.md's Piloted note) never offers its
			// tags, regardless of `weapon`/scoped (this is the one spot that isn't already reached
			// through _onMoveRoll's own frame filter, since a non-usesWeapon move leaves `weapon`
			// undefined and scoped false). Gear is untouched.
			if (entry.kind === "weapon" && this._weaponFrameId(entry) !== mountedFrameId) continue;
			// A disabled weapon (see _equipmentEntry's own comment) offers none of its tags either —
			// same "can't currently act" treatment its gated weaponMoves buttons already get.
			if (entry.kind === "weapon" && entry.disabled) continue;
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
	// The actor's narrative (no codified mechanic) weapon/gear tags, offered read-only in the
	// roll dialog's own Tags section — see docs/domains/equipment.md's "narrative tag" definition.
	// Same frame/disabled/scoped filtering as _equipmentSpends immediately above, plus one
	// difference: unscoped (weapon undefined — every non-usesWeapon move) drops every weapon-kind
	// entry outright rather than leaving them unfiltered. Unlike a spend (an actionable resource a
	// player might use on any roll, per _equipmentSpends' own comment), a weapon's narrative tag is
	// pure flavor about that weapon — it has nothing to say about a roll that never involves one.
	// Gear stays unfiltered either way, same as _equipmentSpends.
	_narrativeWeaponTags(weapon) {
		const scoped = weapon !== undefined;
		const mountedFrameId = this._mountedFrame()?.id ?? null;
		const tags = [];
		for (const entry of this._equipment()) {
			if (!scoped && entry.kind === "weapon") continue;
			if (entry.kind === "weapon" && this._weaponFrameId(entry) !== mountedFrameId) continue;
			if (entry.kind === "weapon" && entry.disabled) continue;
			if (scoped && entry.kind === "weapon" && entry.id !== weapon?.id) continue;
			for (const tagKey of this._weaponTagKeys(entry)) {
				const tag = findEquipmentTag(tagKey);
				if (!tag || tag.spend || tag.forcesEffect || tag.reroll || tag.guided || tag.exclusiveGroup === DRAIN_GROUP) continue;
				tags.push({
					equipmentId: entry.id,
					equipmentName: entry.name,
					tagKey: tag.key,
					tagLabel: tag.label,
					value: tag.value,
					showValue: true,
					description: tag.description
				});
			}
		}
		return tags;
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
			...(item.kind === "weapon" && { scale: item.scale ?? "foot" }),
			// Artificers (The Attendant) — a Bonus Downtime Tokens grant carried through the
			// snapshot the same way any other starting-gear-picked field is (see docs/domains/equipment.md,
			// "Equipment").
			...(item.bonusDowntimeTokens && { bonusDowntimeTokens: item.bonusDowntimeTokens }),
			// Marks this entry permanently exempt from the new budget rule and never tag-locked (see
			// docs/domains/equipment.md's "Equipment" notes) — starting equipment doesn't need to
			// follow either rule, with no time-boxing.
			startingGear: true
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
	// nothing when rolling Exchange Blows. A multi-move tag (Versatile) tracks each move's spend
	// independently via a compound spendKey (see equipment.js#rerollSpendKey) — the tag lookup
	// has to happen first so that key can be computed before checking whether it's already spent.
	_availableReroll(move, weapon) {
		if (!weapon) return null;
		const spent = weapon.spent ?? [];
		for (const tagKey of this._weaponTagKeys(weapon)) {
			const tag = findEquipmentTag(tagKey);
			if (!tag?.reroll?.moves.includes(move.key)) continue;
			const spendKey = rerollSpendKey(tag, move.key);
			if (spent.includes(spendKey)) continue;
			return { equipmentId: weapon.id, tagKey, spendKey };
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
	// freshly authored one. maxTagValue: 0 (see docs/domains/equipment.md's "Equipment" notes) is
	// the new "tags must sum to 0 or less" budget rule — no provenance flag is saved alongside it,
	// since a brand-new custom entry has nothing to distinguish it from.
	async _onEquipmentAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const result = await configureEquipment({ kind }, undefined, { maxTagValue: 0 });
		if (!result) return;

		await this._saveNewEquipment(result);
	},
	// The "+ Pick ... from Catalog" button. Chains two dialogs: chooseEquipmentCatalogItem picks
	// which template to start from, then the exact same editor _onEquipmentAdd uses opens
	// pre-filled with it, with its Kind/Tier/Range/Tags locked (see docs/domains/equipment.md's
	// "Equipment" notes) — only Name and Description stay editable, before or after saving. The
	// saved entry is stamped catalogSource: true so a later _onEquipmentEdit reopens it locked too.
	async _onEquipmentCatalogAdd(event) {
		const { kind } = event.currentTarget.dataset;
		const template = await chooseEquipmentCatalogItem(kind);
		if (!template) return;

		const result = await configureEquipment(template, undefined, { lockTags: true });
		if (!result) return;

		await this._saveNewEquipment({ ...result, catalogSource: true });
	},
	// The "+ Choose Starting Gear" button (see getData's startingGear.available). Chains two
	// independent dialogs the same way _onEquipmentCatalogAdd and _onMoveRoll already chain
	// theirs: chooseStartingGear's hard-capped subset pick (see starting-gear.js), then
	// configureEquipment for the pool's custom weapon (skipped entirely for a pool with no
	// customWeaponNote, e.g. The Commander before its pool is filled in). Each half resolves null
	// independently on cancel — cancelling one still saves the other if it was completed — and
	// picked gear items are saved as ordinary snapshot equipment entries, same treatment as a
	// catalog pick (see docs/domains/equipment.md, "Equipment").
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
			if (weapon) newEntries.push({ id: foundry.utils.randomID(), spent: [], ...weapon, startingGear: true });
		}

		// Nothing was granted and every dialog was cancelled — leave the actor untouched so the
		// button stays available (equipment is still empty) rather than writing a no-op update.
		if (!newEntries.length) return;
		await this.actor.update({ "system.attributes.equipment": [...this._equipment(), ...newEntries] });
	},
	// Provenance resolution (see docs/domains/equipment.md's "Equipment" notes): a catalog-sourced
	// entry (catalogSource: true) stays permanently tag-locked; a starting-gear entry
	// (startingGear: true) stays permanently exempt from the "tags sum to 0 or less" budget rule and
	// is never locked; everything else is subject to that budget rule. Pre-existing entries (from
	// before this change) carry neither flag, so the default has to differ by domain: an
	// Astir/Ardent weapon's *only* prior path was a catalog pick, so a missing catalogSource there
	// defaults to locked (a new custom Astir/Ardent weapon persists catalogSource: false explicitly
	// to opt out); plain equipment/gear could always have been either catalog-picked or
	// hand-authored, genuinely indistinguishable after the fact, so a missing catalogSource there
	// defaults to unlocked instead, preserving pre-change behavior for old data (at the accepted
	// cost that an old plain custom weapon becomes newly budget-capped on its next edit — there's no
	// way to tell it apart from a catalog pick).
	_equipmentEditLockState(entry) {
		if (entry.astir || entry.ardent) {
			const lockTags = entry.catalogSource !== false;
			return { lockTags, maxTagValue: lockTags ? null : 0 };
		}
		if (entry.startingGear) return { lockTags: false, maxTagValue: null };
		const lockTags = Boolean(entry.catalogSource);
		return { lockTags, maxTagValue: lockTags ? null : 0 };
	},
	async _onEquipmentEdit(event) {
		const { equipmentId } = event.currentTarget.dataset;
		const current = this._equipment();
		const entry = current.find((item) => item.id === equipmentId);
		if (!entry) return;

		const { lockTags, maxTagValue } = this._equipmentEditLockState(entry);
		// An Astir or Ardent weapon reopens with the matching option that hid its Kind/Scale/Tier
		// fields when it was first added (see _onAstirWeaponAdd/_onArdentWeaponAdd/
		// configureEquipment) — it's never possible to edit one into a mundane weapon or into Gear,
		// or from one frame's ownership into another's. Every other entry's call is left byte-for-
		// byte as it was before this option existed, aside from the new lockTags/maxTagValue.
		const result = entry.astir
			? await configureEquipment(entry, undefined, { astirWeapon: true, lockTags, maxTagValue })
			: entry.ardent
				? await configureEquipment(entry, undefined, { ardentWeapon: true, lockTags, maxTagValue })
				: await configureEquipment(entry, undefined, { lockTags, maxTagValue });
		if (!result) return;

		// Replaces the entry wholesale (keeping only id/spent/astir/ardent/familiar/catalogSource/
		// startingGear/bonusDowntimeTokens) rather than merging onto the old one — editing a weapon
		// down to Gear should drop its stale scale/tier, not leave them dangling unrendered. All of
		// these are carried forward explicitly, last, since result never includes any of them
		// (configureEquipment has no concept of them, only of hiding/locking fields). catalogSource
		// is carried by presence, not truthiness — a custom Astir/Ardent weapon's explicit
		// catalogSource: false (see _onAstirWeaponCustomAdd/_onArdentWeaponCustomAdd) must survive an
		// edit too, not just catalogSource: true.
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
					...(item.catalogSource !== undefined && { catalogSource: item.catalogSource }),
					...(item.startingGear && { startingGear: true }),
					...(item.bonusDowntimeTokens && {
						bonusDowntimeTokens: item.bonusDowntimeTokens,
						...(item.bonusDowntimeTokensValue !== undefined && { bonusDowntimeTokensValue: item.bonusDowntimeTokensValue })
					})
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
	},
	// The Disabled checkbox's own write path — same manual-tracker shape as
	// _onEquipmentTagSpentToggle immediately above; nothing auto-clears it (see claude.md's
	// Recurring conventions).
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
