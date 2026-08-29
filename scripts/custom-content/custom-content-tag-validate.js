// The equipment-tag shape checks shared by every custom-content section that carries a tags array
// on a weapon-shaped entry: equipment/astirWeapons (custom-content-apply.js) and the moves
// section's own grantsEquipment field (custom-content-moves-validate.js). Split out into its own
// leaf file rather than left private to custom-content-apply.js so custom-content-moves-validate.js
// can import it directly without the two files importing each other (custom-content-apply.js's own
// SECTION_VALIDATORS dispatch already needs to import validateMoveFields from the other direction).
import { EQUIPMENT_TAGS } from "../equipment/equipment-tags.js";
import { findEquipmentTag } from "../equipment/equipment-helpers.js";
import { MAX_TAGS, WEAPON_RANGE_GROUP } from "../equipment/equipment-constants.js";

// Melee/Ranged/Sniper never count against MAX_TAGS — see equipment-constants.js's own doc comment
// ("a pure classifier, not a regular tag pick") and configureEquipment's identical exclusion at
// Save time (equipment-dialogs.js's invalidReason). A plain `tags.length > MAX_TAGS` here would
// wrongly reject a weapon carrying exactly MAX_TAGS real tags plus its one required range tag.
export function validateTagKeys(tags, errors, context) {
	const nonRangeCount = tags.filter((tagKey) => findEquipmentTag(tagKey, EQUIPMENT_TAGS)?.exclusiveGroup !== WEAPON_RANGE_GROUP).length;
	if (nonRangeCount > MAX_TAGS) {
		errors.push(`${context} can have at most ${MAX_TAGS} tags, not counting melee/ranged/sniper.`);
	}
	for (const tagKey of tags) {
		if (!findEquipmentTag(tagKey, EQUIPMENT_TAGS)) {
			errors.push(`${context} references unknown tag "${tagKey}".`);
		}
	}
}

export function validateWeaponRangeTag(tags, errors, context) {
	const rangeCount = tags.filter((tagKey) => findEquipmentTag(tagKey, EQUIPMENT_TAGS)?.exclusiveGroup === WEAPON_RANGE_GROUP).length;
	if (rangeCount !== 1) {
		errors.push(`${context} needs exactly one of the melee, ranged or sniper tags.`);
	}
}
