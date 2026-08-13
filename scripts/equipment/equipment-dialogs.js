import {
	DRAIN_GROUP,
	EQUIPMENT_CATALOG_PICKER_TEMPLATE,
	EQUIPMENT_EDITOR_TEMPLATE,
	MAX_TAGS,
	TIER_MAX,
	TIER_MIN,
	WEAPON_PICKER_TEMPLATE,
	WEAPON_RANGE_GROUP
} from "./equipment-constants.js";
import { EQUIPMENT_TAGS } from "./equipment-tags.js";
import { EQUIPMENT_CATALOG } from "./equipment-catalog.js";
import {
	buildTagReference,
	equipmentValue,
	findCatalogEquipment,
	findEquipmentTag,
	groupEquipmentTags,
	resolveEquipmentTags,
	withTagLabels,
	wirePickerTabs
} from "./equipment-helpers.js";

// Opens the "+ Pick ... from Catalog" picker for one kind and resolves the chosen template, or
// null if dismissed or nothing was selected. Mirrors choosePlaybookMove's promise/Dialog/
// resolve-null shape (playbook-moves.js). Filtering by kind here, rather than in the template,
// keeps the Weapons and Gear buttons wired to the same function with a one-argument difference.
export async function chooseEquipmentCatalogItem(kind, catalog = EQUIPMENT_CATALOG) {
	const items = catalog.filter((item) => item.kind === kind);
	const { tagGroups, hasTags } = buildTagReference(items);
	const content = await renderTemplate(EQUIPMENT_CATALOG_PICKER_TEMPLATE, {
		items: items.map((item) => withTagLabels(item)),
		itemsTabLabel: kind === "weapon" ? "Weapons" : "Gear",
		tagGroups,
		hasTags
	});

	return new Promise((resolve) => {
		new Dialog({
			title: kind === "weapon" ? "Pick a Weapon" : "Pick Gear",
			content,
			// Foundry's Dialog only ever invokes data.render, not options.render (see
			// client/ui/dialog.js's `this.data.render(...)` call) — this is the DialogData
			// argument, same as configureEquipment's own tag-total wiring above.
			render: wirePickerTabs,
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
		}, {
			classes: ["armor-astir", "equipment-catalog-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
	});
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
	const { tagGroups, hasTags } = buildTagReference(weapons, tags);
	const content = await renderTemplate(WEAPON_PICKER_TEMPLATE, { options, tagGroups, hasTags });

	return new Promise((resolve) => {
		new Dialog({
			title: "Choose a Weapon",
			content,
			// See chooseEquipmentCatalogItem's own render comment — must be DialogData.render, not
			// an options field, for Foundry to actually invoke it.
			render: wirePickerTabs,
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
		}, {
			classes: ["armor-astir", "weapon-picker"],
			width: 560,
			height: 700,
			resizable: true
		}).render(true);
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
// scale is only ever present on the resolved object when Kind is Weapon at submit time — Gear
// never carries it, regardless of what the Kind field currently shows (Kind changing live doesn't
// hide it — the Tags total below is this dialog's only live-reactive wiring so far, kept
// intentionally narrow rather than extended to every field). tier is only ever present for a
// Carrier weapon (see `carrierWeapon` below) — every other weapon (mundane, Astir, Ardent) derives
// its Tier from whoever/whatever is wielding it (see PlaybookActorSheet#_equipmentEntry) instead
// of storing one, so the dialog never even shows a Tier field for them.
//
// `note` is optional, purely informational text rendered as a single line above the form (e.g.
// starting-gear.js's per-playbook custom weapon budget guidance) — never validated or enforced,
// same non-blocking treatment as every other soft guidance in this module.
//
// `astirWeapon` (see astir.js/PlaybookActorSheet) hides the Kind select and the Scale/Tier fields
// entirely: an Astir weapon is always a weapon, and always inherits its Astir's own tier and the
// "astir" WEAPON_SCALES entry rather than storing either — everything else (tags, MAX_TAGS, the
// required weapon-range group, the live Value readout) applies exactly as it does for any weapon.
// It's also the only flow that renders Drain's checkboxes at all (see DRAIN_GROUP's doc comment
// above) — every other caller (mundane weapons, gear, Carrier weapons) filters them out of the
// tag list before rendering.
//
// A mundane (plain foot-scale) weapon hides Tier the same way `astirWeapon`/`ardentWeapon` do —
// it inherits the wielding character's own Tier (see PlaybookActorSheet#_conflictTier) rather than
// storing one. This is the one caller with no dedicated flag: it's simply whichever weapon isn't
// astirWeapon, ardentWeapon, or carrierWeapon.
//
// `carrierWeapon` (see carrier-actor-sheet.js) is the one caller that still stores its own Tier: a
// Carrier weapon is always a weapon, always Astir scale (Carriers are never Foot scale), and
// always Tier 5 — but unlike every other weapon here, there's no wielder for it to inherit Tier
// from (the Carrier itself has no Tier of its own), so Tier stays a visible, disabled field
// (fixed at TIER_MAX) rather than being hidden outright.
//
// `ardentWeapon` (see ardent.js/PlaybookActorSheet) is the Ardent counterpart to `astirWeapon`:
// always a weapon, hides Kind and Tier the same way (an Ardent weapon inherits its owning Ardent's
// Tier rather than storing one), but — unlike `astirWeapon` — never renders Drain's checkboxes
// (`pickableTags` below stays filtered), since an Ardent has no Power for Drain to reduce.
//
// Scale itself is never a player-facing choice, for any caller: it now drives real behavior (see
// PlaybookActorSheet's Piloted mutual-exclusivity between Astir and mundane weapons), so letting a
// plain custom weapon be labeled Astir Scale without actually being flagged `astir: true` would be
// actively misleading — it would render as Astir Scale but behave as a mundane weapon. The neither-
// astirWeapon-nor-carrierWeapon-nor-ardentWeapon ("mundane") path is always resolved as `"foot"`;
// `carrierWeapon` is always `"astir"`; neither `astirWeapon` nor `ardentWeapon` ever stores a scale
// at all. There's no `<select name="scale">` left in the template for any of the four.
//
// The Range field (Melee/Ranged/Sniper — see WEAPON_RANGE_GROUP) follows the same non-reactive
// convention as Tier: always rendered when the injected `tags` catalog has range tags, regardless
// of Kind, rather than being hidden/shown live as Kind changes — kept intentionally narrow rather
// than extended to every field, same as Tier's own precedent. Its value is only read into the
// resolved result when Kind is Weapon at Save time.
//
// `excludedTagKeys` and `maxTagValue` are a second, generic budget mechanism alongside MAX_TAGS —
// not starting-gear-specific, for the same reason `note` isn't: they're options any caller could
// use, it's just starting-gear.js's custom-weapon flow (PlaybookActorSheet#_onStartingGearAdd)
// that's the one caller opting in today. `excludedTagKeys` (default `[]`, so every existing caller
// sees the exact same `pickableTags` as before) removes matching keys from the checkbox list
// entirely, the same way WEAPON_RANGE_GROUP/DRAIN_GROUP already are — this module has no economy
// system for Valuable/Treasure's claimed monetary value (see EQUIPMENT_TAGS' own doc comment), so
// starting-gear.js excludes them as free padding a player could otherwise stack for nothing.
// `maxTagValue` (default `null`, meaning "no cap") is enforced at Save the same way MAX_TAGS is:
// over the cap warns and resolves null rather than saving.
export async function configureEquipment(
	initial = null,
	tags = EQUIPMENT_TAGS,
	{ note, astirWeapon = false, carrierWeapon = false, ardentWeapon = false, excludedTagKeys = [], maxTagValue = null } = {}
) {
	// Drain only means anything on an Astir weapon (see DRAIN_GROUP's doc comment) — every other
	// flow, including ardentWeapon (an Ardent has no Power for Drain to reduce), hides its
	// checkboxes so it can't be picked somewhere it would stay permanently inert. WEAPON_RANGE_GROUP
	// is excluded unconditionally — it's never a checkbox anymore, see weaponRangeTags below.
	// excludedTagKeys (see the doc comment above) removes any further caller-specified keys, e.g.
	// starting-gear.js's custom-weapon flow excluding Valuable/Treasure.
	const pickableTags = tags.filter((tag) =>
		tag.exclusiveGroup !== WEAPON_RANGE_GROUP && (astirWeapon || tag.exclusiveGroup !== DRAIN_GROUP) &&
		!excludedTagKeys.includes(tag.key));
	// Melee/Ranged/Sniper render as their own native radio group (see equipment-editor.hbs) rather
	// than as checkboxes in the tag list — a radio group can always have a default, which a
	// checkbox trio validated only at Save time couldn't. Editing an entry pre-selects whichever
	// range tag it already has; a brand-new entry, or one with no range tag at all (a Gear item
	// being reconfigured, or stale data), falls back to the first group member ("melee").
	const weaponRangeTags = tags.filter((tag) => tag.exclusiveGroup === WEAPON_RANGE_GROUP);
	const defaultWeaponRangeKey = weaponRangeTags.find((tag) => initial?.tags?.includes(tag.key))?.key
		?? weaponRangeTags[0]?.key;
	const content = await renderTemplate(EQUIPMENT_EDITOR_TEMPLATE, {
		note,
		astirWeapon,
		carrierWeapon,
		// Kind is hidden for every caller that forces Scale/Tier — see the doc comment above.
		hideKind: astirWeapon || carrierWeapon || ardentWeapon,
		// Tier is hidden (rather than shown-disabled like carrierWeapon's) for every weapon that
		// inherits Tier from elsewhere instead of storing it — which today is every weapon except
		// carrierWeapon's — see the doc comment above.
		hideTier: !carrierWeapon,
		name: initial?.name ?? "",
		description: initial?.description ?? "",
		isWeapon: astirWeapon || carrierWeapon || ardentWeapon || (initial?.kind ?? "weapon") === "weapon",
		tier: carrierWeapon ? TIER_MAX : (initial?.tier ?? TIER_MIN),
		tierMin: TIER_MIN,
		tierMax: TIER_MAX,
		// The starting total shown before any box is touched — same equipmentValue helper the
		// Equipment tab already uses to display an entry's Value (playbook-actor-sheet.js), so the
		// number on open always matches what the sheet would show for `initial` today.
		tagTotal: equipmentValue(initial?.tags ?? [], tags),
		// hasTagValueCap is a separate boolean rather than checking maxTagValue directly in the
		// template — {{#if}} treats 0 as falsy, and a cap of 0 (starting-gear.js's default) is a
		// real, active cap that still needs to render.
		maxTagValue,
		hasTagValueCap: maxTagValue !== null,
		// Grouped (see groupEquipmentTags above) rather than one flat 40-entry list — the catalog
		// has grown too long to scan otherwise. Each group starts open only if it already holds one
		// of `initial`'s current tags, so editing a tagged item lands with the relevant group(s)
		// visibly expanded; a blank new item starts with every group collapsed.
		tagGroups: groupEquipmentTags(pickableTags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			checked: Boolean(initial?.tags?.includes(tag.key))
		}))).map((group) => ({ ...group, open: group.tags.some((tag) => tag.checked) })),
		// Always rendered, not gated by Kind — same "kept intentionally narrow rather than extended
		// to every field" non-reactivity Tier already has above. Empty when the injected `tags`
		// catalog carries no WEAPON_RANGE_GROUP entries at all (e.g. a fixture catalog in tests).
		weaponRangeOptions: weaponRangeTags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			description: tag.description,
			checked: tag.key === defaultWeaponRangeKey
		}))
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
						// None of the Astir/Carrier/Ardent weapon dialogs render the Kind select at all
						// (see the template) — all three are always weapons, so there's nothing to read
						// from the DOM here for any of them.
						const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
						const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
						const weaponRangeKey = html.find("[name='weapon-range']:checked").val();
						// Every checked key is a real regular tag — WEAPON_RANGE_GROUP keys can no longer
						// appear here at all, since they're never rendered as checkboxes (see
						// weaponRangeTags above) — so, unlike before, nothing needs filtering out of this
						// count. DRAIN_GROUP tags still count, since Drain carries a real value.
						const regularTagCount = checkedKeys.length;
						// Applies to weapons and gear alike. Feedback rather than a silent no-op, same
						// reasoning as the weapon-range check below.
						if (regularTagCount > MAX_TAGS) {
							ui.notifications.warn(`Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`);
							resolve(null);
							return;
						}
						// maxTagValue (see the doc comment above configureEquipment) is a second, opt-in
						// budget cap enforced the same way as MAX_TAGS above — null (the default) means no
						// cap, so every existing caller is unaffected. Only checked regular tags count —
						// the range radio's value is always 0 and was never in checkedKeys to begin with.
						if (maxTagValue !== null && equipmentValue(checkedKeys, tags) > maxTagValue) {
							ui.notifications.warn(`This equipment's tags can total at most ${maxTagValue}.`);
							resolve(null);
							return;
						}
						// Weapons specifically must carry one of WEAPON_RANGE_GROUP's tags (Melee/Ranged/
						// Sniper) — see the exclusiveGroup doc comment above. In practice this is a
						// defensive fallback rather than the primary safeguard now: the radio group
						// always renders with a default checked (see weaponRangeOptions above), so a
						// player can no longer reach Save with none selected through normal use.
						if (kind === "weapon" && !weaponRangeKey) {
							ui.notifications.warn("A weapon needs one of the Melee, Ranged or Sniper tags.");
							resolve(null);
							return;
						}
						resolve({
							name,
							description: html.find("[name='description']").val().trim(),
							kind,
							// Prepended to match EQUIPMENT_CATALOG's own convention of listing the range
							// tag first (e.g. tags: ["melee", "intimate", "concealable"]). Only merged in
							// for weapons — Gear never carries a range tag, even though the radio group
							// (always rendered, per weaponRangeOptions above) still has some default value
							// in the DOM regardless of Kind.
							tags: kind === "weapon" ? [weaponRangeKey, ...checkedKeys] : checkedKeys,
							// scale is never resolved for an Astir or Ardent weapon — both are always Astir
							// scale, inherited from the owning frame itself (see
							// PlaybookActorSheet#_equipmentEntry) rather than stored. A mundane weapon is
							// always Foot Scale — there's no DOM field to read either way (see the doc
							// comment above configureEquipment).
							...(kind === "weapon" && !astirWeapon && !ardentWeapon && {
								scale: carrierWeapon ? "astir" : "foot",
								// tier is likewise never resolved for a mundane weapon — it derives from the
								// wielding character instead (see the doc comment above configureEquipment).
								// Only carrierWeapon still stores its own, always fixed at TIER_MAX; the DOM
								// field carrierWeapon renders is disabled, so nothing else can reach here.
								...(carrierWeapon && { tier: TIER_MAX })
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
