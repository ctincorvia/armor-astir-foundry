import { APPROACHES } from "./approaches.js";

export const TAG_VALUE_MIN = -2;
export const TAG_VALUE_MAX = 2;

// The one group of mutually-exclusive tags this module currently has (Melee/Ranged/Sniper —
// see EQUIPMENT_TAGS' `exclusiveGroup` doc below). Weapons additionally require one of these
// specifically; this is a single hardcoded check rather than a generic "required groups" system,
// since it's the only group that needs one.
export const WEAPON_RANGE_GROUP = "weapon-range";

// Applies to every equipment entry (weapon or gear), and — like WEAPON_RANGE_GROUP above — never
// counts a tag's `exclusiveGroup` membership (Melee/Ranged/Sniper) against the cap, since those
// are a classifier rather than a regular tag pick. Enforced only at Save, same as the blank-name
// and weapon-range checks in configureEquipment.
export const MAX_TAGS = 3;

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
// playbook-moves.js). `value` mirrors the rulebook's own -2/-1/+1/+2 grouping and must stay
// within TAG_VALUE_MIN/MAX; where a tag's own text (Treasure, Valuable) separately claims to
// change "value" by a different number, that's the rulebook's narrative/monetary sense of the
// word, not this field or equipmentValue — this module has no separate economy/appraisal system,
// so it's left as flavor in the description rather than wired to anything.
//
// `spend` makes a tag show a manual "used" checkbox on the Equipment tab (see
// PlaybookActorSheet#_equipmentEntry / _onEquipmentTagSpentToggle). Only when it also carries an
// `effect` (matching a real EFFECT_STATES key — roll-effects.js) does it additionally get offered
// as a roll-dialog checkbox (see moves.js#configureMoveRoll, PlaybookActorSheet#_equipmentSpends)
// — a spend with no `effect` (Ward, Vorpal, One-Use, Refresh, Dangerous) only ever tracks "has
// this been used this period", since its effect (softening a Danger, capping uses) happens
// outside of any one roll and isn't something to offer mid-dialog.
//
// `forcesEffect` (Unreliable) is the inverse of `spend`: not opt-in, automatically locks a roll's
// Effect the first time a weapon carrying it is used each period (see
// PlaybookActorSheet#_rollMove, mirroring bite-the-dust's forcesDesperationAtMaxPerils).
//
// `reroll` (Decisive, Defensive, Versatile) lists which move key(s) it can reroll a failure on,
// once per period (see PlaybookActorSheet's reroll chat-button handling). `guided` (Guided) is
// the "skip rolling, take a 7-9" option, offered for any usesWeapon move.
//
// `exclusiveGroup` makes a tag's checkbox behave like a radio button within that group value —
// configureEquipment's render wiring unchecks every other tag sharing the same `exclusiveGroup`
// the moment one is checked, resolved off the `tags` array already in scope rather than new
// template data attributes. WEAPON_RANGE_GROUP (Melee/Ranged/Sniper, all `value: 0` — a pure
// classifier, not a Value modifier) is the only group so far, and is additionally *required*:
// configureEquipment's Save blocks (via ui.notifications.warn) when Kind is Weapon and none of
// that group is checked. That's a single hardcoded weapon-only check, not a generic "required
// groups" system, since it's the only group that needs one.
export const EQUIPMENT_TAGS = [
	// -2: heavy drawbacks that largely restrict an object's usefulness or availability.
	{
		key: "cursed",
		label: "Cursed",
		value: -2,
		// Equip-exclusivity ("cannot wield anything else") and a death consequence aren't systems
		// this module models (Astirs aren't their own documents yet — see claude.md); left as
		// prose, same treatment as weapon profiles under "Systems that do not exist yet".
		description: "You cannot wield anything else once you raise a cursed weapon, and it becomes bound to " +
			"you until the curse is broken. When you die it will consume your essence, probably."
	},
	{
		key: "dangerous",
		label: "Dangerous",
		value: -2,
		description: "Once per Sortie, the director may upgrade a risk you acquire while using this to a peril.",
		spend: { period: "Sortie" }
	},
	{
		key: "dreaded",
		label: "Dreaded",
		value: -2,
		description: "This weapon has a history and a reputation that stains it, and stains you as long as " +
			"you're carrying it. People will treat you with fear and apprehension."
	},
	{
		key: "huge",
		label: "Huge",
		value: -2,
		description: "Basically impossible to move around without help. Absolutely not something you are " +
			"ever going to hide, either."
	},
	{
		key: "junk",
		label: "Junk",
		value: -2,
		// "Remove with a 6-step long-term project" references a project-tracking system this
		// module doesn't have; left as prose.
		description: "In such a terrible condition it cannot be used. You may remove this tag with a 6-step " +
			"long-term project."
	},
	{
		key: "one-use",
		label: "One-Use",
		value: -2,
		description: "Can only be used a single time per Sortie—perhaps it needs time to recharge, or uses " +
			"rare ammo, or explodes.",
		spend: { period: "Sortie" }
	},
	{
		key: "treasure",
		label: "Treasure",
		value: -2,
		description: "Highly valuable—and a gold, glittering target on your back. Said to increase an item's " +
			"appraised value by 4, though this module has no separate economy to reflect that in."
	},
	// -1: almost entirely negative tags.
	{
		key: "two-handed",
		label: "2H",
		value: -1,
		description: "Takes both hands to use properly, though not necessarily just to carry."
	},
	{
		key: "bulky",
		label: "Bulky",
		value: -1,
		description: "Large (relative to tier) and difficult or awkward to move around."
	},
	{
		key: "drain",
		label: "Drain",
		value: -1,
		// "Reduces Power by 1 while equipped" needs an equipped/unequipped state this module
		// doesn't track (Power is a plain stepper with no computed max — see claude.md). Left as
		// prose; the player adjusts the Power stepper themselves. "Multiple times" already works
		// with no extra code: a repeated key in one entry's tags array resolves to duplicate tag
		// objects and sums normally (see equipmentValue), so stacking Drain just means listing the
		// key more than once.
		description: "This object draws excessive power from an Astir, and reduces the Astir's Power by 1 " +
			"while equipped. Objects can have this tag multiple times, increasing the reduction."
	},
	{
		key: "distinct",
		label: "Distinct",
		value: -1,
		description: "Impressive, loud, or just particularly memorable, distinct equipment is hard to be " +
			"subtle with. Might make you easy to track or follow, or ruin your attempts at stealth."
	},
	{
		key: "slow",
		label: "Slow",
		value: -1,
		description: "There is a delay involved in this object's use, like the travel time of a projectile, " +
			"or the low speed of a construct. Might, for example, impose disadvantage where speed matters."
	},
	{
		key: "limited",
		label: "Limited",
		value: -1,
		description: "You have a particularly limited supply or use of this thing—it always seems to run out " +
			"at the most perilous moments."
	},
	{
		key: "messy",
		label: "Messy",
		value: -1,
		description: "Something messy is imprecise (or indiscriminate), and could have excessive (or " +
			"intimidating), unwanted results."
	},
	{
		key: "intimate",
		label: "Intimate",
		value: -1,
		description: "Requires you to get up close and personal, making it hard to use against anyone " +
			"wielding something with better reach—or anyone just trying to keep their distance."
	},
	{
		key: "fragile",
		label: "Fragile",
		value: -1,
		description: "Easily broken, either by shoddy design or frail materials."
	},
	{
		key: "forbidden",
		label: "Forbidden",
		value: -1,
		description: "Forbidden objects are banned by the Authority, and possession of them or suspicion of " +
			"such carries a heavy price."
	},
	{
		key: "set-up",
		label: "Set-Up",
		value: -1,
		description: "Make moves using this item at disadvantage unless you spend time to prepare or arm it " +
			"in some way. In battle this might only be a few moments, but it can make all the difference."
	},
	{
		key: "reload",
		label: "Reload",
		value: -1,
		description: "After firing, this weapon requires you to manually reload it or perform some other " +
			"action to ready it for use."
	},
	{
		key: "unreliable",
		label: "Unreliable",
		value: -1,
		description: "This object is prone to failure and breakdowns—make your first move with it each Scene " +
			"in desperation.",
		forcesEffect: { period: "Scene", effect: "desperation" }
	},
	{
		key: "weak",
		label: "Weak",
		value: -1,
		description: "Lacking in physical impact, and generally useless for piercing armour or cover."
	},
	{
		key: "valuable",
		label: "Valuable",
		value: -1,
		description: "Expensive to acquire, and fairly sought-after. Said to increase an item's appraised " +
			"value by 2, though this module has no separate economy to reflect that in."
	},
	// 0: purely descriptive weapon-range classification, mutually exclusive with one another and
	// required on every weapon (see WEAPON_RANGE_GROUP and the exclusiveGroup doc above).
	{
		key: "melee",
		label: "Melee",
		value: 0,
		description: "This weapon is used up close, in melee range.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	{
		key: "ranged",
		label: "Ranged",
		value: 0,
		description: "This weapon strikes from a distance, well outside of melee range.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	{
		key: "sniper",
		label: "Sniper",
		value: 0,
		description: "This weapon excels at very long range, precision attacks over anything closer.",
		exclusiveGroup: WEAPON_RANGE_GROUP
	},
	// +1: strong beneficial effects.
	{
		key: "adapted",
		label: "Adapted",
		value: 1,
		description: "This object has been modified or designed to let it overcome the difficulties of " +
			"certain environments—it might be an amphibious Astir with an air supply, an Ardent designed to " +
			"keep its occupants cool in searing-hot terrains, etc."
	},
	// Arcane/Divine/Elemental/Mundane/Profane mirror APPROACHES (approaches.js) one-for-one, so
	// their labels can't drift from the sheet's own Approach dropdown. "Changes your approach
	// while actively using it" isn't auto-applied — system.attributes.approach is a single
	// persistent field with no "actively equipped" state to hang a temporary override off, so
	// this stays descriptive.
	...APPROACHES.map((approach) => ({
		key: approach.key,
		label: approach.label,
		value: 1,
		description: `This tag changes your approach to ${approach.label} while you're actively using it.`
	})),
	{
		key: "area",
		label: "Area",
		value: 1,
		description: "This weapon affects a large area: while any melee weapon might hit multiple people " +
			"stood right next to each other, an area weapon might slice through an entire crowd or several " +
			"spread-out foes."
	},
	{
		key: "bane",
		label: "Bane",
		value: 1,
		// References an NPC/enemy tier-opposition system this module doesn't model yet (no NPC
		// documents — see claude.md); left as prose.
		description: "You suffer no penalty against opponents one tier above you when attacking with bane."
	},
	{
		key: "blitz",
		label: "Blitz",
		value: 1,
		description: "You may spend this tag once per Scene to make a move with confidence.",
		spend: { period: "Scene", effect: "confidence" }
	},
	{
		key: "concealable",
		label: "Concealable",
		value: 1,
		description: "Easily hidden—a casual inspection will rarely if ever find it."
	},
	{
		key: "decisive",
		label: "Decisive",
		value: 1,
		description: "Decisive weaponry is precise and powerful, excellent for ending fights. Once per " +
			"Scene, you may reroll a failed strike decisively when using it.",
		reroll: { moves: ["strike-decisively"], period: "Scene" }
	},
	{
		key: "defensive",
		label: "Defensive",
		value: 1,
		description: "Defensive weaponry is excellent for keeping foes at a distance, parrying their blows, " +
			"or suppressing them. Once per Scene, you may reroll a failed exchange blows when using it.",
		reroll: { moves: ["exchange-blows"], period: "Scene" }
	},
	{
		key: "guided",
		label: "Guided",
		value: 1,
		description: "This weapon has guided strikes or projectiles, allowing you to take a 7-9 result when " +
			"you exchange blows and strike decisively rather than rolling if you wish. Guided projectiles " +
			"are reliable, but leave little room for finesse.",
		guided: true
	},
	{
		key: "impact",
		label: "Impact",
		value: 1,
		description: "This weapon packs a heavy physical punch, capable of knocking foes down or away " +
			"easily, and will dent or break through surfaces."
	},
	{
		key: "infinite",
		label: "Infinite",
		value: 1,
		description: "This thing either doesn't use ammo or power to function, or uses such small amounts " +
			"relative to your supply that it is practically endless. You're never in danger of running out " +
			"as a result of a roll."
	},
	{
		key: "mounted",
		label: "Mounted",
		value: 1,
		description: "This weapon is mounted or worn in some way that frees up the hands of the user for " +
			"other tasks. As a result, it's also difficult to disarm a target of without breaking it."
	},
	{
		key: "restraining",
		label: "Restraining",
		value: 1,
		description: "Can restrict or slow targets down in some way, making it hard for them to escape or " +
			"move without expending a lot of effort."
	},
	{
		key: "refresh",
		label: "Refresh",
		value: 1,
		description: "Objects that refresh can only be used once per Scene, but automatically replenish or " +
			"restore themselves even if they are destroyed or wasted (they cannot be taken away from you by " +
			"a peril).",
		spend: { period: "Scene" }
	},
	{
		key: "ward",
		label: "Ward",
		value: 1,
		description: "You may use this tag once per Sortie to reduce an incoming source of harm from a peril " +
			"to a risk, or from a risk to nothing.",
		spend: { period: "Sortie" }
	},
	// +2: uncommon, strong effects.
	{
		key: "ruin",
		label: "Ruin",
		value: 2,
		// Same not-yet-modeled tier-opposition system as Bane; left as prose.
		description: "As per bane, but up to two tiers higher rather than one."
	},
	{
		key: "versatile",
		label: "Versatile",
		value: 2,
		description: "This tag combines the effects of decisive and defensive.",
		reroll: { moves: ["exchange-blows", "strike-decisively"], period: "Scene" }
	},
	{
		key: "vorpal",
		label: "Vorpal",
		value: 2,
		description: "Vorpal weaponry is exceedingly lethal: you may use this tag once per Sortie to upgrade " +
			"a risk you'd inflict to a peril instead.",
		spend: { period: "Sortie" }
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
		tags: ["melee"],
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

const TAG_VALUE_GROUPS = [
	{ value: -2, label: "Heavy Drawbacks (-2)" },
	{ value: -1, label: "Minor Drawbacks (-1)" },
	{ value: 0, label: "No Effect (0)" },
	{ value: 1, label: "Strong Benefits (+1)" },
	{ value: 2, label: "Rare Benefits (+2)" }
];

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
// Gear never carries them, regardless of what the Scale/Tier fields currently show (Kind changing
// live doesn't hide them — the Tags total below is this dialog's only live-reactive wiring so
// far, kept intentionally narrow rather than extended to every field).
//
// `note` is optional, purely informational text rendered as a single line above the form (e.g.
// starting-gear.js's per-playbook custom weapon budget guidance) — never validated or enforced,
// same non-blocking treatment as every other soft guidance in this module.
export async function configureEquipment(initial = null, tags = EQUIPMENT_TAGS, { note } = {}) {
	const content = await renderTemplate(EQUIPMENT_EDITOR_TEMPLATE, {
		note,
		name: initial?.name ?? "",
		description: initial?.description ?? "",
		isWeapon: (initial?.kind ?? "weapon") === "weapon",
		scale: initial?.scale ?? WEAPON_SCALES[0].key,
		scales: WEAPON_SCALES,
		tier: initial?.tier ?? TIER_MIN,
		tierMin: TIER_MIN,
		tierMax: TIER_MAX,
		// The starting total shown before any box is touched — same equipmentValue helper the
		// Equipment tab already uses to display an entry's Value (playbook-actor-sheet.js), so the
		// number on open always matches what the sheet would show for `initial` today.
		tagTotal: equipmentValue(initial?.tags ?? [], tags),
		// Grouped (see groupEquipmentTags above) rather than one flat 40-entry list — the catalog
		// has grown too long to scan otherwise. Each group starts open only if it already holds one
		// of `initial`'s current tags, so editing a tagged item lands with the relevant group(s)
		// visibly expanded; a blank new item starts with every group collapsed.
		tagGroups: groupEquipmentTags(tags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			checked: Boolean(initial?.tags?.includes(tag.key))
		}))).map((group) => ({ ...group, open: group.tags.some((tag) => tag.checked) }))
	});

	return new Promise((resolve) => {
		new Dialog({
			title: initial?.id ? "Edit Equipment" : "Add Equipment",
			content,
			// Recomputes the running Tags total as boxes are checked/unchecked, so a player designing
			// a weapon to a budget (e.g. starting-gear.js's custom-weapon note) can see it without
			// re-opening the dialog. Reads each checked box's key straight back through `tags` via
			// equipmentValue, the same lookup every other total in this module already goes through,
			// rather than a separate data-value attribute.
			render: (html) => {
				const updateTotal = () => {
					const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
					html.find(".equipment-editor-tag-total-value").text(equipmentValue(checkedKeys, tags));
				};
				// A tag with an `exclusiveGroup` (see EQUIPMENT_TAGS' doc comment) behaves like a radio
				// button within that group: checking it unchecks every other tag sharing the same group,
				// looked up off `tags` (already in closure) rather than new template data attributes.
				html.find("[name='tag']").on("change", (event) => {
					// The changed checkbox's value is always a real tag key — it was rendered from
					// `tags` in the first place — so this lookup can never miss.
					const changed = findEquipmentTag(event.target.value, tags);
					if (changed.exclusiveGroup && event.target.checked) {
						for (const other of tags.filter((tag) => tag.exclusiveGroup === changed.exclusiveGroup && tag.key !== changed.key)) {
							html.find(`[name='tag'][value='${other.key}']`).prop("checked", false);
						}
					}
					updateTotal();
				});
			},
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
						const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
						// Every checked key is a real tag — it was rendered from `tags` in the first
						// place — so findEquipmentTag can't miss in either check below.
						const regularTagCount = checkedKeys.filter((key) => !findEquipmentTag(key, tags).exclusiveGroup).length;
						// Applies to weapons and gear alike, and never counts an exclusiveGroup tag
						// (Melee/Ranged/Sniper) against the cap — see MAX_TAGS. Feedback rather than a
						// silent no-op, same reasoning as the weapon-range check below.
						if (regularTagCount > MAX_TAGS) {
							ui.notifications.warn(`Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`);
							resolve(null);
							return;
						}
						// Weapons specifically must carry one of WEAPON_RANGE_GROUP's tags (Melee/Ranged/
						// Sniper) — see the exclusiveGroup doc comment above.
						if (kind === "weapon" && !checkedKeys.some((key) => findEquipmentTag(key, tags).exclusiveGroup === WEAPON_RANGE_GROUP)) {
							ui.notifications.warn("A weapon needs one of the Melee, Ranged or Sniper tags.");
							resolve(null);
							return;
						}
						resolve({
							name,
							description: html.find("[name='description']").val().trim(),
							kind,
							tags: checkedKeys,
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
