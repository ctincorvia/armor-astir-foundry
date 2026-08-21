import {
	EQUIPMENT_CATALOG_PICKER_TEMPLATE,
	buildTagReference,
	wirePickerTabs,
	withTagLabels
} from "../equipment/equipment.js";
import { MOVE_POOLS, PLAYBOOK_MOVE_PICKER_TEMPLATE, pickerSection } from "../moves/playbook-moves.js";
import { ASTIR_PART_CATALOG } from "./astir-parts.js";
import { ASTIR_MOVE_CATALOG } from "./astir-moves.js";
import { ASTIR_WEAPON_CATALOG } from "./astir-weapons.js";
import { findCatalogAstirWeapon, partRequirementTooltip, unmetPartRequirements } from "./astir.js";
import { renderTemplate } from "../compat.js";

// Opens the "+" picker for an Astir Part and resolves the chosen part's key, or null if dismissed
// or nothing was selected — same promise/Dialog/resolve-null shape as choosePlaybookMove, and the
// same "already-picked options drop out" treatment (a part, like a playbook move, only makes sense
// picked once). Reuses the equipment catalog picker template: {key, name, description} is exactly
// what it renders. `title` is overridable so ardent.js can reuse this same picker (against a
// filtered catalog — see ardentParts) with Ardent-appropriate copy, rather than a second dialog.
export async function chooseAstirPart(selectedKeys = [], catalog = ASTIR_PART_CATALOG, { title = "Add an Astir Part" } = {}) {
	const items = catalog.filter((part) => !selectedKeys.includes(part.key));
	const { tagGroups, hasTags } = buildTagReference(items);
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, {
		items: items.map((item) => withTagLabels(item)),
		itemsTabLabel: "Parts",
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring (equipment.js).
			render: wirePickerTabs,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(html.find("[name='catalog-item']:checked").val() ?? null)
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}

// Opens the "O" catalog picker for an Astir weapon and resolves the chosen template (for passing
// into configureEquipment, same as chooseEquipmentCatalogItem's own callers), or null. Unlike
// chooseAstirPart, nothing is excluded — an Astir can carry more than one of the same weapon
// template, same as regular equipment. `title` is overridable for the same reason chooseAstirPart's
// is — see ardent.js's ardentWeapons. `installedPartKeys` gates any entry whose own requiresParts
// isn't fully met (the four Familiar weapons today) — visible but disabled, with a tooltip, rather
// than excluded outright (see unmetPartRequirements/partRequirementTooltip in astir.js); a caller
// with no concept of installed parts (ardent.js's own weapon flows) just passes [], which gates
// nothing since no Ardent-eligible catalog entry carries requiresParts.
export async function chooseAstirWeapon(catalog = ASTIR_WEAPON_CATALOG, installedPartKeys = [], { title = "Pick an Astir Weapon" } = {}) {
	const { tagGroups, hasTags } = buildTagReference(catalog);
	const items = catalog.map((item) => {
		const tooltip = partRequirementTooltip(unmetPartRequirements(item, installedPartKeys));
		return { ...withTagLabels(item), disabled: Boolean(tooltip), tooltip };
	});
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, {
		items,
		itemsTabLabel: "Weapons",
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title,
			content,
			// See chooseAstirPart's own render comment — must be DialogData.render, not an options
			// field, for Foundry to actually invoke it.
			render: wirePickerTabs,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(findCatalogAstirWeapon(html.find("[name='catalog-item']:checked").val(), catalog))
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}

// Builds the picker tree for an Astir's one unique move: the character's own playbook pool, then
// Cantrips, then the dedicated Astir Moves catalog (astir-moves.js) — deliberately not
// playbookMoveSections' full tree (which would also offer Soldier Moves and every other playbook's
// pool). Reuses pickerSection/pickerMove from playbook-moves.js so a section's shape (and its "drop
// when empty" treatment) can't drift from the playbook-move picker's. `pools`/`astirCatalog` stay
// injectable for the same fixture-testing reason MOVE_POOLS/EQUIPMENT_CATALOG's own consumers do.
// `installedPartKeys` gates any move whose own requiresParts isn't fully met (mechanism only today
// — ASTIR_MOVE_CATALOG's placeholder entry carries none — but every section built here, including
// the actor's own playbook/Cantrips pools, gets the same Astir-Part gating via pickerSection's
// extraTooltip hook, for whenever real content adds one).
export function astirMoveSections(
	playbookName,
	selectedKeys = [],
	pools = MOVE_POOLS,
	astirCatalog = ASTIR_MOVE_CATALOG,
	installedPartKeys = []
) {
	const sections = [];
	const extraTooltip = (move) => partRequirementTooltip(unmetPartRequirements(move, installedPartKeys));

	const ownPool = pools.find((pool) => pool.playbookName && pool.playbookName === playbookName);
	if (ownPool) {
		const section = pickerSection(ownPool, selectedKeys, { note: "Your playbook.", extraTooltip });
		if (section) sections.push(section);
	}

	const cantrips = pools.find((pool) => pool.key === "cantrips");
	if (cantrips) {
		const section = pickerSection(cantrips, selectedKeys, { extraTooltip });
		if (section) sections.push(section);
	}

	const astirSection = pickerSection(
		{ key: "astir-moves", label: "Astir Moves", moves: astirCatalog },
		selectedKeys,
		{ extraTooltip }
	);
	if (astirSection) sections.push(astirSection);

	return sections;
}

// Opens the "+" picker for the Astir's unique move and resolves the chosen key, or null. Mirrors
// choosePlaybookMove's Dialog options (including its resizable/numeric-height note) since it
// reuses the exact same template.
export async function chooseAstirMove(
	playbookName,
	selectedKeys = [],
	pools = MOVE_POOLS,
	astirCatalog = ASTIR_MOVE_CATALOG,
	installedPartKeys = []
) {
	const sections = astirMoveSections(playbookName, selectedKeys, pools, astirCatalog, installedPartKeys);
	const content = await renderTemplate(PLAYBOOK_MOVE_PICKER_TEMPLATE, { sections });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose an Astir Move",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(html.find("[name='playbook-move']:checked").val() ?? null)
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, {
			classes: ["armor-astir", "playbook-move-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
}
