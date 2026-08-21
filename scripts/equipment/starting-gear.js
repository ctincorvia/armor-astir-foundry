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
// entry, same as a catalog pick), or null if the dialog was dismissed or Add was clicked over
// budget. Mirrors chooseEquipmentCatalogItem's promise/Dialog shape (equipment.js).
//
// Each group's checked count is validated against its own chooseCount independently — so (e.g.)
// The Diplomat's 1 weapon and 3 gear budgets can't bleed into each other — via the same
// invalidReason/updateSaveState/authoritative-recheck idiom configureEquipment's Save button uses
// (equipment-dialogs.js): Add is disabled live with a CSS gate-tooltip explaining which group is
// over, and the callback re-checks and warns rather than trusting the DOM's disabled attribute,
// which Enter-to-submit can bypass. Checkbox `name` is group-scoped (see starting-gear-picker.hbs)
// so one group's checked boxes never leak into another's count.
export async function chooseStartingGear(playbookName, pools = STARTING_GEAR_POOLS) {
	const pool = findStartingGearPool(playbookName, pools);
	if (!pool) return null;

	// buildTagReference and the per-item tagLabels annotations below are both computed off the
	// raw pool data — pool.grantedItems/pool.groups themselves are never reassigned, so the Add
	// callback's own picked-items lookup (which reads pool.groups directly) can't accidentally
	// resolve against a tag-labeled clone.
	const { tagGroups, hasTags } = buildTagReference([...pool.grantedItems, ...pool.groups.flatMap((group) => group.items)]);
	const content = await renderTemplate(STARTING_GEAR_PICKER_TEMPLATE, {
		grantedItems: pool.grantedItems.map((item) => withTagLabels(item)),
		groups: pool.groups.map((group) => ({ ...group, items: group.items.map((item) => withTagLabels(item)) })),
		freeformNotes: pool.freeformNotes ?? [],
		tagGroups,
		hasTags
	});

	// The single source of truth for "why can't this be added right now" — shared by the render
	// callback's live Add-button state and the Add button's own authoritative recheck, mirroring
	// configureEquipment's own invalidReason (equipment-dialogs.js).
	const invalidReason = (html) => {
		for (const group of pool.groups) {
			const checkedCount = html.find(`[name='starting-gear-item-${group.key}']:checked`)
				.map((_, el) => el.value).get().length;
			if (checkedCount > group.chooseCount) {
				return `You can pick at most ${group.chooseCount} for "${group.label}" (currently ${checkedCount} selected).`;
			}
		}
		return null;
	};

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose Starting Gear",
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring (equipment.js).
			render: (html) => {
				wirePickerTabs(html);
				const updateSaveState = () => {
					const reason = invalidReason(html);
					const addButton = html.find("[data-button='add']");
					addButton.prop("disabled", Boolean(reason));
					addButton.toggleClass("disabled", Boolean(reason));
					if (reason) addButton.attr("data-gate-tooltip", reason);
					else addButton.removeAttr("data-gate-tooltip");
				};
				for (const group of pool.groups) {
					html.find(`[name='starting-gear-item-${group.key}']`).on("change", updateSaveState);
				}
				updateSaveState();
			},
			buttons: {
				add: {
					label: "Add",
					callback: (html) => {
						// The authoritative gate — see invalidReason's own doc comment above on why this
						// can't just trust the DOM's live disabled attribute (Enter-to-submit bypasses it).
						const reason = invalidReason(html);
						if (reason) {
							ui.notifications.warn(reason);
							resolve(null);
							return;
						}
						const picked = pool.groups.flatMap((group) => {
							const checkedKeys = html.find(`[name='starting-gear-item-${group.key}']:checked`)
								.map((_, el) => el.value).get();
							return checkedKeys
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
