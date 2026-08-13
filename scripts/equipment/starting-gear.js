import { buildTagReference, wirePickerTabs, withTagLabels } from "./equipment.js";
import { STARTING_GEAR_POOLS } from "./starting-gear-pools.js";

export const STARTING_GEAR_PICKER_TEMPLATE = "modules/armor-astir/templates/starting-gear-picker.hbs";

// The default tag-value budget for a pool's custom weapon (see customWeaponNote below), and the
// tag keys excluded from that flow outright. This module has no economy/appraisal system —
// Valuable/Treasure's own EQUIPMENT_TAGS description already says as much — so letting them count
// toward (or pad out) a chargen weapon's budget would be free value with nothing behind it; simpler
// to exclude them from this flow entirely than to let a player stack them for no cost.
export const DEFAULT_CUSTOM_WEAPON_MAX_VALUE = 0;
export const CUSTOM_WEAPON_EXCLUDED_TAG_KEYS = ["valuable", "treasure"];

export { STARTING_GEAR_POOLS };

export function findStartingGearPool(playbookName, pools = STARTING_GEAR_POOLS) {
	return pools.find((pool) => pool.playbookName === playbookName) ?? null;
}

// Opens the "+ Choose Starting Gear" picker for one playbook's pool and resolves the picked
// items' full definitions (not bare keys — the caller turns each straight into an equipment
// entry, same as a catalog pick), or null if the dialog was dismissed. Mirrors
// chooseEquipmentCatalogItem's promise/Dialog shape (equipment.js).
//
// Each group's checked selection is truncated to its own chooseCount before resolving, in
// checkbox order — the hard-cap enforcement point, applied independently per group so (e.g.) The
// Diplomat's 1 weapon and 3 gear budgets can't bleed into each other. Checkbox `name` is
// group-scoped (see starting-gear-picker.hbs) so one group's checked boxes never leak into
// another's count. This mirrors configureEquipment's existing tier-clamp idiom (normalize the
// result rather than reject the dialog) instead of blocking Add or disabling checkboxes live,
// which would need the kind of reactive-form wiring claude.md notes this module's Dialogs have no
// precedent for.
export async function chooseStartingGear(playbookName, pools = STARTING_GEAR_POOLS) {
	const pool = findStartingGearPool(playbookName, pools);
	if (!pool) return null;

	// buildTagReference and the per-item tagLabels annotations below are both computed off the
	// raw pool data — pool.grantedItems/pool.groups themselves are never reassigned, so the Add
	// callback's own truncation/clamping logic (which reads pool.groups directly) can't
	// accidentally resolve against a tag-labeled clone.
	const { tagGroups, hasTags } = buildTagReference([...pool.grantedItems, ...pool.groups.flatMap((group) => group.items)]);
	const content = await renderTemplate(STARTING_GEAR_PICKER_TEMPLATE, {
		grantedItems: pool.grantedItems.map((item) => withTagLabels(item)),
		groups: pool.groups.map((group) => ({ ...group, items: group.items.map((item) => withTagLabels(item)) })),
		freeformNotes: pool.freeformNotes ?? [],
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Starting Gear",
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring (equipment.js).
			render: wirePickerTabs,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => {
						const picked = pool.groups.flatMap((group) => {
							const checkedKeys = html.find(`[name='starting-gear-item-${group.key}']:checked`)
								.map((_, el) => el.value).get();
							return checkedKeys
								.slice(0, group.chooseCount)
								.map((key) => group.items.find((item) => item.key === key))
								.filter(Boolean);
						});
						resolve(picked);
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "starting-gear-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}
