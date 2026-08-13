// This file is the barrel for scripts/equipment/: the leaf constants (TAG_VALUE_MIN/MAX,
// WEAPON_RANGE_GROUP, DRAIN_GROUP, MAX_TAGS, TIER_MIN/MAX, the three template path constants,
// UNARMED, WEAPON_SCALES) live in equipment-constants.js, the EQUIPMENT_TAGS catalog lives in
// equipment-tags.js, the EQUIPMENT_CATALOG catalog lives in equipment-catalog.js, the small pure
// helper functions (findCatalogEquipment, findEquipmentTag, resolveEquipmentTags, equipmentValue,
// mergeSpentTags, rerollSpendKey(s), baseEquipmentTagKey, groupEquipmentTags, withTagLabels,
// buildTagReference, wirePickerTabs) live in equipment-helpers.js, and the roll-configuration
// dialogs (chooseEquipmentCatalogItem, chooseWeapon, configureEquipment) live in
// equipment-dialogs.js. Everything below is re-exported so every existing importer of
// equipment.js keeps working unchanged (see playbook-moves.js's own `export { MOVE_POOLS };` for
// the precedent this follows, and astir.js/moves.js for two more splits along the same lines,
// including moves.js's own precedent of letting each sibling own the constant(s) only it needs,
// rather than declaring them here and creating a barrel<->sibling import cycle).
export {
	TAG_VALUE_MIN,
	TAG_VALUE_MAX,
	WEAPON_RANGE_GROUP,
	DRAIN_GROUP,
	MAX_TAGS,
	TIER_MIN,
	TIER_MAX,
	EQUIPMENT_EDITOR_TEMPLATE,
	EQUIPMENT_CATALOG_PICKER_TEMPLATE,
	WEAPON_PICKER_TEMPLATE,
	UNARMED,
	WEAPON_SCALES
} from "./equipment-constants.js";
export { EQUIPMENT_TAGS } from "./equipment-tags.js";
export { EQUIPMENT_CATALOG } from "./equipment-catalog.js";
export {
	findCatalogEquipment,
	findEquipmentTag,
	resolveEquipmentTags,
	equipmentValue,
	mergeSpentTags,
	rerollSpendKey,
	rerollSpendKeys,
	baseEquipmentTagKey,
	groupEquipmentTags,
	withTagLabels,
	buildTagReference,
	wirePickerTabs
} from "./equipment-helpers.js";
export {
	chooseEquipmentCatalogItem,
	chooseWeapon,
	configureEquipment
} from "./equipment-dialogs.js";
