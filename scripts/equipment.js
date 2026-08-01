export const TAG_VALUE_MIN = -2;
export const TAG_VALUE_MAX = 2;

export const TIER_MIN = 1;
export const TIER_MAX = 5;

export const EQUIPMENT_EDITOR_TEMPLATE = "modules/armor-astir/templates/equipment-editor.hbs";
export const EQUIPMENT_CATALOG_PICKER_TEMPLATE = "modules/armor-astir/templates/equipment-catalog-picker.hbs";
export const WEAPON_PICKER_TEMPLATE = "modules/armor-astir/templates/weapon-picker.hbs";

// Sentinel for "fighting unarmed" — a real, always-offered choice (see chooseWeapon below),
// distinct from the dialog being dismissed (which resolves null, same as every other picker in
// this module). The value here must match the hardcoded radio value in weapon-picker.hbs — a
// template can't reference this constant directly.
export const UNARMED = "unarmed";

// Weapons are either sized for an Astir or for the person wielding one — purely descriptive
// (see claude.md, "Domain conventions"): Astirs aren't their own documents yet, so nothing
// enforces who may wield which scale, the same deliberate non-enforcement as move pool
// membership in playbook-moves.js.
export const WEAPON_SCALES = [
	{ key: "foot", label: "Foot Scale", note: "Wielded by people." },
	{ key: "astir", label: "Astir Scale", note: "Wielded by Astirs." }
];

// The tag catalog: definitions live in code and equipment stores only tag keys, so edited rules
// text reaches existing equipment — the same split MOVE_POOLS uses for playbook moves (see
// playbook-moves.js). Grows one tag at a time as rulebook text is transcribed (see claude.md,
// "Adding move content" for the same restraint applied to moves); Blitz is the only confirmed
// entry so far.
//
// `spend` is what makes a tag offerable in the roll dialog (see moves.js#configureMoveRoll):
// its `effect` key must match a real EFFECT_STATES key (roll-effects.js) — spending a tag only
// ever sets one of the two axes a roll already has, never a new one.
export const EQUIPMENT_TAGS = [
	{
		key: "blitz",
		label: "Blitz",
		value: 1,
		description: "You may spend this tag once per Scene to make a move with confidence.",
		spend: { period: "Scene", effect: "confidence" }
	}
];

// Reusable equipment templates, distinct from EQUIPMENT_TAGS above (which catalogs Tags, not
// whole items). Picking one is a snapshot, not a reference — see configureEquipment's caller in
// PlaybookActorSheet#_onEquipmentCatalogAdd — so there's no key stored on the resulting entry and
// no "diverged from catalog" state to track. Shape matches configureEquipment's `initial` param
// exactly (minus `id`), so a picked item can be passed straight through unmodified. Grows one
// item at a time as rulebook equipment is transcribed, same restraint as EQUIPMENT_TAGS and
// MOVE_POOLS; both entries below are placeholders, mirroring
// soldier:placeholder-soldier-move in playbook-moves.js.
export const EQUIPMENT_CATALOG = [
	{
		key: "placeholder-weapon",
		name: "Placeholder Weapon",
		kind: "weapon",
		description: "TODO: replace with a real catalog weapon.",
		tags: [],
		scale: "foot",
		tier: TIER_MIN
	},
	{
		key: "placeholder-gear",
		name: "Placeholder Gear",
		kind: "gear",
		description: "TODO: replace with real catalog gear.",
		tags: []
	}
];

export function findCatalogEquipment(key, catalog = EQUIPMENT_CATALOG) {
	return catalog.find((item) => item.key === key) ?? null;
}

// Opens the "+ Pick ... from Catalog" picker for one kind and resolves the chosen template, or
// null if dismissed or nothing was selected. Mirrors choosePlaybookMove's promise/Dialog/
// resolve-null shape (playbook-moves.js). Filtering by kind here, rather than in the template,
// keeps the Weapons and Gear buttons wired to the same function with a one-argument difference.
export async function chooseEquipmentCatalogItem(kind, catalog = EQUIPMENT_CATALOG) {
	const items = catalog.filter((item) => item.kind === kind);
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, { items });

	return new Promise((resolve) => {
		new Dialog({
			title: kind === "weapon" ? "Pick a Weapon" : "Pick Gear",
			content,
			buttons: {
				add: {
					label: "Add",
					// No radio checked (including when the catalog is empty for this kind) leaves
					// .val() undefined, so findCatalogEquipment resolves null — same "nothing
					// selected reads as cancel" contract choosePlaybookMove uses.
					callback: (html) => resolve(findCatalogEquipment(html.find("[name='catalog-item']:checked").val(), catalog))
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "add",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-catalog-picker"] }).render(true);
	});
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

// Opens the "which weapon" prompt for a usesWeapon move (see moves.js,
// PlaybookActorSheet#_onMoveRoll) and resolves the chosen weapon's id, UNARMED, or null if
// dismissed. Mirrors chooseEquipmentCatalogItem's promise/Dialog/resolve-null shape. Assumes
// `weapons` is non-empty — the caller only invokes this when the actor actually has a weapon to
// choose between; with none, "unarmed" is simply true and there's nothing to ask.
export async function chooseWeapon(weapons, tags = EQUIPMENT_TAGS) {
	const options = weapons.map((weapon) => ({
		key: weapon.id,
		name: weapon.name,
		value: equipmentValue(weapon.tags ?? [], tags),
		tagLabels: resolveEquipmentTags(weapon.tags ?? [], tags).map((tag) => tag.label)
	}));
	const content = await renderTemplate(WEAPON_PICKER_TEMPLATE, { options });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose a Weapon",
			content,
			buttons: {
				choose: {
					label: "Choose",
					// The template pre-checks Unarmed, so .val() always resolves to something as
					// long as Choose (rather than Cancel/close) was clicked.
					callback: (html) => resolve(html.find("[name='weapon']:checked").val() ?? null)
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "choose",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "weapon-picker"] }).render(true);
	});
}

// Opens the create/edit dialog and resolves the entered equipment fields, or null if the dialog
// was dismissed, or if it was confirmed with no name. Mirrors choosePlaybookMove /
// configureMoveRoll / choosePlaybook for the promise/Dialog shape.
//
// Passing `initial` (an existing equipment entry) pre-fills the form and titles the dialog for
// editing; omitting it starts blank, for creating. Only `initial.id` decides which — a caller
// pre-selecting a kind for a fresh entry (see PlaybookActorSheet#_onEquipmentAdd) passes
// `{ kind }` with no `id`, and that still reads as "Add".
//
// scale/tier are only ever present on the resolved object when Kind is Weapon at submit time —
// Gear never carries them, regardless of what the (always-rendered, since this module has no
// precedent for a Dialog reacting live to its own form) Scale/Tier fields currently show.
export async function configureEquipment(initial = null, tags = EQUIPMENT_TAGS) {
	const content = await renderTemplate(EQUIPMENT_EDITOR_TEMPLATE, {
		name: initial?.name ?? "",
		description: initial?.description ?? "",
		isWeapon: (initial?.kind ?? "weapon") === "weapon",
		scale: initial?.scale ?? WEAPON_SCALES[0].key,
		scales: WEAPON_SCALES,
		tier: initial?.tier ?? TIER_MIN,
		tierMin: TIER_MIN,
		tierMax: TIER_MAX,
		tags: tags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			checked: Boolean(initial?.tags?.includes(tag.key))
		}))
	});

	return new Promise((resolve) => {
		new Dialog({
			title: initial?.id ? "Edit Equipment" : "Add Equipment",
			content,
			buttons: {
				save: {
					label: "Save",
					callback: (html) => {
						const name = html.find("[name='name']").val().trim();
						if (!name) {
							resolve(null);
							return;
						}
						const kind = html.find("[name='kind']").val();
						resolve({
							name,
							description: html.find("[name='description']").val().trim(),
							kind,
							tags: html.find("[name='tag']:checked").map((_, el) => el.value).get(),
							...(kind === "weapon" && {
								scale: html.find("[name='scale']").val(),
								tier: Math.min(TIER_MAX, Math.max(TIER_MIN, Number(html.find("[name='tier']").val()) || TIER_MIN))
							})
						});
					}
				},
				cancel: {
					label: "Cancel",
					callback: () => resolve(null)
				}
			},
			default: "save",
			close: () => resolve(null)
		}, { classes: ["armor-astir", "equipment-editor"] }).render(true);
	});
}
