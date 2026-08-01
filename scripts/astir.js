import { APPROACHES } from "./approaches.js";
import { EQUIPMENT_CATALOG_PICKER_TEMPLATE } from "./equipment.js";
import { MOVE_POOLS, PLAYBOOK_MOVE_PICKER_TEMPLATE, findPlaybookMove, pickerSection } from "./playbook-moves.js";

// Astirs aren't their own documents (see claude.md) — one lives at system.attributes.astir on the
// character actor itself, null/absent meaning "no Astir". Everything below follows the
// catalog-in-code / keys-on-actor split MOVE_POOLS and EQUIPMENT_TAGS already use: definitions
// live here so edited rules text reaches existing characters, and the actor stores only keys.

// An Astir's Core determines which two Approaches it may take — distinct from, and not
// necessarily matching, the character's own system.attributes.approach (see approaches.js).
export const ASTIR_CORES = [
	{ key: "alchemical", label: "Alchemical", approaches: ["mundane", "arcane"] },
	{ key: "crystalline", label: "Crystalline", approaches: ["arcane", "profane"] },
	{ key: "ancient", label: "Ancient", approaches: ["mundane", "divine"] },
	{ key: "natural", label: "Natural", approaches: ["divine", "elemental"] },
	{ key: "occult", label: "Occult", approaches: ["profane", "elemental"] }
];

// Resolves a Core's two Approaches, or an empty list when no Core is chosen yet — the empty list
// is what blanks the Approach select until a Core narrows it (see PlaybookActorSheet).
export function astirCoreApproaches(coreKey, cores = ASTIR_CORES) {
	const core = cores.find((c) => c.key === coreKey);
	return core ? APPROACHES.filter((approach) => core.approaches.includes(approach.key)) : [];
}

// Astirs sit in their own Tier band (3-4), not equipment's TIER_MIN/TIER_MAX (1-5, equipment.js) —
// kept as a separate pair of constants so the two bands can never drift into each other.
export const ASTIR_TIER_MIN = 3;
export const ASTIR_TIER_MAX = 4;

export const ASTIR_POWER_MIN = 0;
export const ASTIR_POWER_BASE = 4;

// Astir Parts read as moves (see PlaybookActorSheet's Astir Moves group) — same shape as
// BASIC_MOVES (traits/description/results), plus powerCost: how much of the Astir's base Power
// this part permanently spends (see astirMaxPower). A placeholder until real Parts are
// transcribed from the rulebook, mirroring EQUIPMENT_CATALOG's placeholder-weapon.
export const ASTIR_PART_CATALOG = [
	{
		key: "astir-part:placeholder-part",
		name: "Placeholder Part",
		traits: [],
		description: "TODO: replace with a real catalog Astir part.",
		powerCost: 1
	}
];

export function findAstirPart(key, catalog = ASTIR_PART_CATALOG) {
	return catalog.find((part) => part.key === key) ?? null;
}

// Drops a part key that no longer resolves — mirrors resolvePlaybookMoves/resolveEquipmentTags.
export function resolveAstirParts(keys = [], catalog = ASTIR_PART_CATALOG) {
	return keys.map((key) => findAstirPart(key, catalog)).filter(Boolean);
}

// An Astir's max Power is its base minus every equipped part's cost, floored at
// ASTIR_POWER_MIN — derived on read (never stored), the same equipmentValue/advancements.topCount
// precedent, so it can't drift after a part is added or removed.
export function astirMaxPower(partKeys = [], catalog = ASTIR_PART_CATALOG) {
	const cost = resolveAstirParts(partKeys, catalog).reduce((sum, part) => sum + (part.powerCost ?? 0), 0);
	return Math.max(ASTIR_POWER_MIN, ASTIR_POWER_BASE - cost);
}

// The dedicated catalog for an Astir's one unique move (see astirMoveSections below) — same move
// shape again. A placeholder until real Astir Moves are transcribed.
export const ASTIR_MOVE_CATALOG = [
	{
		key: "astir:placeholder-move",
		name: "Placeholder Astir Move",
		traits: [],
		description: "TODO: replace with a real catalog Astir move."
	}
];

// The unique Astir move can come from the dedicated catalog above, or from the character's own
// playbook/Cantrips pools (see astirMoveSections) — so resolving a stored key has to check both,
// rather than assuming it's always one of ours.
export function findAstirMove(key, catalog = ASTIR_MOVE_CATALOG) {
	return catalog.find((move) => move.key === key) ?? findPlaybookMove(key) ?? null;
}

// Astir weapons are ordinary equipment entries (system.attributes.equipment) flagged astir: true —
// see PlaybookActorSheet — so this catalog matches EQUIPMENT_CATALOG's weapon shape minus
// scale/tier, both of which an Astir weapon always inherits from its Astir rather than storing.
export const ASTIR_WEAPON_CATALOG = [
	{
		key: "placeholder-astir-weapon",
		name: "Placeholder Astir Weapon",
		description: "TODO: replace with a real catalog Astir weapon.",
		tags: ["melee"]
	}
];

export function findCatalogAstirWeapon(key, catalog = ASTIR_WEAPON_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

// Opens the "+" picker for an Astir Part and resolves the chosen part's key, or null if dismissed
// or nothing was selected — same promise/Dialog/resolve-null shape as choosePlaybookMove, and the
// same "already-picked options drop out" treatment (a part, like a playbook move, only makes sense
// picked once). Reuses the equipment catalog picker template: {key, name, description} is exactly
// what it renders.
export async function chooseAstirPart(selectedKeys = [], catalog = ASTIR_PART_CATALOG) {
	const items = catalog.filter((part) => !selectedKeys.includes(part.key));
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, { items });

	return new Promise((resolve) => {
		new Dialog({
			title: "Add an Astir Part",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(html.find("[name='catalog-item']:checked").val() ?? null)
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-catalog-picker"] }).render(true);
	});
}

// Opens the "O" catalog picker for an Astir weapon and resolves the chosen template (for passing
// into configureEquipment, same as chooseEquipmentCatalogItem's own callers), or null. Unlike
// chooseAstirPart, nothing is excluded — an Astir can carry more than one of the same weapon
// template, same as regular equipment.
export async function chooseAstirWeapon(catalog = ASTIR_WEAPON_CATALOG) {
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, { items: catalog });

	return new Promise((resolve) => {
		new Dialog({
			title: "Pick an Astir Weapon",
			content,
			buttons: {
				add: {
					label: "Add",
					callback: (html) => resolve(findCatalogAstirWeapon(html.find("[name='catalog-item']:checked").val(), catalog))
				},
				cancel: { label: "Cancel", callback: () => resolve(null) }
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-catalog-picker"] }).render(true);
	});
}

// Builds the picker tree for an Astir's one unique move: the character's own playbook pool, then
// Cantrips, then the dedicated Astir Moves catalog above — deliberately not playbookMoveSections'
// full tree (which would also offer Soldier Moves and every other playbook's pool). Reuses
// pickerSection/pickerMove from playbook-moves.js so a section's shape (and its "drop when empty"
// treatment) can't drift from the playbook-move picker's. `pools`/`astirCatalog` stay injectable
// for the same fixture-testing reason MOVE_POOLS/EQUIPMENT_CATALOG's own consumers do.
export function astirMoveSections(playbookName, selectedKeys = [], pools = MOVE_POOLS, astirCatalog = ASTIR_MOVE_CATALOG) {
	const sections = [];

	const ownPool = pools.find((pool) => pool.playbookName && pool.playbookName === playbookName);
	if (ownPool) {
		const section = pickerSection(ownPool, selectedKeys, { note: "Your playbook.", open: true });
		if (section) sections.push(section);
	}

	const cantrips = pools.find((pool) => pool.key === "cantrips");
	if (cantrips) {
		const section = pickerSection(cantrips, selectedKeys);
		if (section) sections.push(section);
	}

	const astirSection = pickerSection({ key: "astir-moves", label: "Astir Moves", moves: astirCatalog }, selectedKeys);
	if (astirSection) sections.push(astirSection);

	return sections;
}

// Opens the "+" picker for the Astir's unique move and resolves the chosen key, or null. Mirrors
// choosePlaybookMove's Dialog options (including its resizable/numeric-height note) since it
// reuses the exact same template.
export async function chooseAstirMove(playbookName, selectedKeys = [], pools = MOVE_POOLS, astirCatalog = ASTIR_MOVE_CATALOG) {
	const sections = astirMoveSections(playbookName, selectedKeys, pools, astirCatalog);
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
