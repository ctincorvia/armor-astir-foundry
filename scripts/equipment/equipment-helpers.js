import { TAG_VALUE_GROUPS } from "./equipment-constants.js";
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
