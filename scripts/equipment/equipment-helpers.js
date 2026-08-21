import { DRAIN_GROUP, TAG_VALUE_GROUPS } from "./equipment-constants.js";
import { EQUIPMENT_TAGS } from "./equipment-tags.js";
import { EQUIPMENT_CATALOG } from "./equipment-catalog.js";

export function findCatalogEquipment(key, catalog = EQUIPMENT_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

export function findEquipmentTag(key, tags = EQUIPMENT_TAGS) {
	return tags.find((tag) => tag.key === key) ?? null;
}

// Resolves an equipment entry's stored tag keys to tag definitions, dropping any that no longer
// exist — a key can outlive its tag whenever the catalog is edited, and a stale entry should
// quietly disappear rather than break rendering (mirrors resolvePlaybookMoves).
export function resolveEquipmentTags(keys = [], tags = EQUIPMENT_TAGS) {
	return keys.map((key) => findEquipmentTag(key, tags)).filter(Boolean);
}

// An equipment entry's overall Value is always the sum of its current tags, derived on read
// rather than stored — same as advancements.topCount in playbook-actor-sheet.js#getData — so it
// can never drift out of sync with the tags actually on the entry.
export function equipmentValue(keys = [], tags = EQUIPMENT_TAGS) {
	return resolveEquipmentTags(keys, tags).reduce((sum, tag) => sum + tag.value, 0);
}

// Merges a batch of {equipmentId, tagKey} spends into an equipment array's per-entry `spent`
// list. Shared by PlaybookActorSheet#_spendEquipmentTags (a player-chosen or forced spend, ahead
// of the roll it modifies) and move-chat-listeners.js's handleReroll (a reroll tag, spent after
// the fact — from outside any PlaybookActorSheet instance, since a chat-card click isn't tied to
// one).
export function mergeSpentTags(equipment, spentTags) {
	return equipment.map((item) => {
		const additions = spentTags.filter((spend) => spend.equipmentId === item.id).map((spend) => spend.tagKey);
		if (!additions.length) return item;
		return { ...item, spent: [...new Set([...(item.spent ?? []), ...additions])] };
	});
}

// A reroll tag naming more than one move (Versatile) tracks each move's use independently,
// rather than one shared spend that exhausts on first use regardless of which move triggered
// it — see PlaybookActorSheet#_availableReroll/_equipmentEntry and move-chat-listeners.js's
// handleReroll. A single-move reroll tag (Decisive, Defensive) keeps storing its bare key
// exactly as before — this only ever produces a compound key when there's more than one move
// to distinguish between.
export function rerollSpendKey(tag, moveKey) {
	return tag.reroll.moves.length > 1 ? `${tag.key}:${moveKey}` : tag.key;
}

// Every possible spend key for a reroll tag — one per move it can reroll when multi-move,
// else just its own bare key. Used to build/clear all of a multi-move tag's independent flags
// together (see _equipmentEntry's per-move row rendering).
export function rerollSpendKeys(tag) {
	return tag.reroll.moves.length > 1 ? tag.reroll.moves.map((moveKey) => rerollSpendKey(tag, moveKey)) : [tag.key];
}

// Strips a compound reroll spend key back to its catalog tag key (e.g. "versatile:exchange-blows"
// -> "versatile") so a spent-key string can still be resolved via findEquipmentTag — see
// PlaybookActorSheet#_refreshPeriod, which needs a tag's period regardless of which move's use
// a spent entry represents. A no-op (returns the input unchanged) for a plain, non-compound key.
export function baseEquipmentTagKey(spentKey) {
	return spentKey.split(":")[0];
}

// Groups a tag list (either the raw catalog or configureEquipment's checked-annotated shape) by
// its own value banding — see EQUIPMENT_TAGS' -2/-1/+1/+2 comment groups above — rather than a
// second, hand-maintained category scheme, so the editor's groups can never drift out of sync with
// what a tag is actually worth. A group with nothing in it (e.g. a fixture catalog with no -2
// entries) is dropped, same "don't render an empty section" treatment playbookMoveSections gives
// an empty pool (playbook-moves.js).
export function groupEquipmentTags(tagList) {
	return TAG_VALUE_GROUPS
		.map(({ value, label }) => ({ label, tags: tagList.filter((tag) => tag.value === value) }))
		.filter((group) => group.tags.length > 0);
}

// Adds a tagLabels array (possibly empty) to an equipment-catalog-shaped item for chip display —
// shared by every equipment-catalog-picker.hbs consumer so the renderTemplate data shape never
// diverges based on whether the item actually carries tags.
export function withTagLabels(item, tags = EQUIPMENT_TAGS) {
	return { ...item, tagLabels: resolveEquipmentTags(item.tags ?? [], tags).map((tag) => tag.label) };
}

// Collects the union of tag keys referenced across a list of items (each optionally carrying a
// .tags array — some, like Astir Parts, never do), resolves + groups them via the existing
// groupEquipmentTags, and reports whether there's anything to show. Feeds the "Tags" reference
// tab shared by every picker below — hasTags is false whenever every item's tags resolve to
// nothing (e.g. chooseAstirPart's Parts), so that picker's template renders with no tab nav at all.
export function buildTagReference(items, tags = EQUIPMENT_TAGS) {
	const keys = [...new Set(items.flatMap((item) => item.tags ?? []))];
	const tagGroups = groupEquipmentTags(resolveEquipmentTags(keys, tags));
	return { tagGroups, hasTags: tagGroups.length > 0 };
}

// Wires the click-to-switch-tab behavior shared by equipment-catalog-picker.hbs /
// starting-gear-picker.hbs's own [data-picker-tab]/[data-picker-tab-panel] markup — a bare Foundry
// Dialog has no TabsV2 controller of its own. Safe to pass unconditionally as every affected
// Dialog's `render`: when a template only rendered the tab-less single panel (hasTags false),
// [data-picker-tab] simply matches nothing.
export function wirePickerTabs(html) {
	html.find("[data-picker-tab]").on("click", (event) => {
		const target = event.currentTarget.dataset.pickerTab;
		html.find("[data-picker-tab]").removeClass("active");
		html.find(`[data-picker-tab='${target}']`).addClass("active");
		html.find("[data-picker-tab-panel]").removeClass("active");
		html.find(`[data-picker-tab-panel='${target}']`).addClass("active");
	});
}

// Weapon-roll resolvers shared by PlaybookActorSheet's own equipment-mixin.js (_equipmentSpends/
// _narrativeWeaponTags/_forcedWeaponEffect/_availableReroll/_availableRerollTag/_weaponIsGuided)
// and CarrierActorSheet (the same six, wrapping these directly) — pulled out here as pure
// functions of (tagKeys, entry[, ...]) rather than living only as actor-sheet instance methods, so
// a Carrier weapon rolled either from the Carrier's own sheet or "borrowed" via Fire Support (see
// move-roll-mixin.js's _onMoveRoll) gets identical treatment without either sheet needing to reach
// into the other's own equipment array. Each playbook-sheet method above resolves its own
// `this._weaponTagKeys(entry)` (its own union-with-grants variant) or, for a fromCarrier weapon,
// carrierWeaponTagKeys' pre-merged keys, and passes that resolved list in here as `tagKeys`.

// Mirrors equipment-mixin.js#_equipmentSpends' inner per-entry loop for a single already-resolved
// entry — the frame/disabled/scoped filtering that loop also does happens one level up, since only
// a playbook actor has a mounted frame or multiple weapons to filter between at all.
export function resolveEquipmentSpends(tagKeys, entry, lockedEffect) {
	const spent = entry.spent ?? [];
	const spends = [];
	for (const tagKey of tagKeys) {
		if (spent.includes(tagKey)) continue;
		const tag = findEquipmentTag(tagKey);
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
	return spends;
}

// Mirrors equipment-mixin.js#_narrativeWeaponTags' inner per-entry loop for a single
// already-resolved entry.
export function resolveNarrativeWeaponTags(tagKeys, entry) {
	return resolveEquipmentTags(tagKeys)
		.filter((tag) => !tag.spend && !tag.forcesEffect && !tag.reroll && !tag.guided && tag.exclusiveGroup !== DRAIN_GROUP)
		.map((tag) => ({
			equipmentId: entry.id,
			equipmentName: entry.name,
			tagKey: tag.key,
			tagLabel: tag.label,
			value: tag.value,
			showValue: true,
			description: tag.description
		}));
}

// Mirrors equipment-mixin.js#_forcedWeaponEffect's body.
export function resolveForcedWeaponEffect(tagKeys, entry) {
	const spent = entry.spent ?? [];
	for (const tagKey of tagKeys) {
		if (spent.includes(tagKey)) continue;
		const tag = findEquipmentTag(tagKey);
		if (tag?.forcesEffect) return { tagKey, effect: tag.forcesEffect.effect };
	}
	return null;
}

// Mirrors equipment-mixin.js#_availableReroll's body, plus a spendActorId — present only when
// `entry` is a fromCarrier-shaped weapon (see move-roll-mixin.js's _onMoveRoll), so a Fire
// Support reroll's spend routes to the Carrier that actually owns the weapon rather than the
// rolling playbook actor (see move-roll.js's rerollOffer/move-chat-listeners.js's handleReroll).
export function resolveAvailableReroll(tagKeys, entry, moveKey) {
	const spent = entry.spent ?? [];
	for (const tagKey of tagKeys) {
		const tag = findEquipmentTag(tagKey);
		if (!tag?.reroll?.moves.includes(moveKey)) continue;
		const spendKey = rerollSpendKey(tag, moveKey);
		if (spent.includes(spendKey)) continue;
		return { equipmentId: entry.id, tagKey, spendKey, ...(entry.fromCarrier && { spendActorId: entry.carrierActorId }) };
	}
	return null;
}

// Mirrors equipment-mixin.js#_availableRerollTag's body.
export function resolveAvailableRerollTag(tagKeys, entry, moveKey) {
	const available = resolveAvailableReroll(tagKeys, entry, moveKey);
	if (!available) return null;
	const tag = findEquipmentTag(available.tagKey);
	return { tagLabel: tag.label, description: tag.description };
}

// Mirrors equipment-mixin.js#_weaponIsGuided's body.
export function weaponTagsAreGuided(tagKeys) {
	return tagKeys.some((tagKey) => findEquipmentTag(tagKey)?.guided);
}

// Folds a batch of {equipmentId, tagKey} spends into a Carrier's slot-keyed weapons object (see
// docs/domains/world-actors.md's "The Carrier carries two named, fixed-role weapon slots") —
// the slot-keyed counterpart to mergeSpentTags' array-shaped equipment, since a Carrier's weapons
// live one per named slot rather than in a flat list. Only spendEquipmentTagsOnActor below calls
// this directly.
export function mergeSpentWeaponSlotTags(weapons, spentTags) {
	const entries = Object.entries(weapons).map(([slotKey, entry]) => {
		if (!entry) return [slotKey, entry];
		const additions = spentTags.filter((spend) => spend.equipmentId === entry.id).map((spend) => spend.tagKey);
		if (!additions.length) return [slotKey, entry];
		return [slotKey, { ...entry, spent: [...new Set([...(entry.spent ?? []), ...additions])] }];
	});
	return Object.fromEntries(entries);
}

// Spends a batch of {equipmentId, tagKey} tags on whichever actor actually owns them — a
// playbook actor's flat equipment array (mergeSpentTags) or a Carrier's slot-keyed weapons object
// (mergeSpentWeaponSlotTags immediately above), branching on which shape the actor stores. Lets
// move-chat-listeners.js's handleReroll and CarrierActorSheet's own roll handler spend against
// either an ordinary rolling actor or a Carrier a weapon was borrowed from, without either caller
// needing to know which shape it's writing to.
export function spendEquipmentTagsOnActor(actor, spentTags) {
	const weapons = actor.system.attributes?.weapons;
	if (weapons) return actor.update({ "system.attributes.weapons": mergeSpentWeaponSlotTags(weapons, spentTags) });
	const equipment = actor.system.attributes?.equipment ?? [];
	return actor.update({ "system.attributes.equipment": mergeSpentTags(equipment, spentTags) });
}
