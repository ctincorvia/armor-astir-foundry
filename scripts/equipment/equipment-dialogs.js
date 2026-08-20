import {
	DRAIN_GROUP,
	EQUIPMENT_CATALOG_PICKER_TEMPLATE,
	EQUIPMENT_EDITOR_TEMPLATE,
	MAX_TAGS,
	OVERRIDE_MAX_TAG_VALUE,
	TIER_MAX,
	TIER_MIN,
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
// always a fixed Tier — but unlike every other weapon here, there's no wielder for it to inherit
// Tier from (the Carrier itself has no Tier of its own), so Tier stays a visible, disabled field
// rather than being hidden outright. `carrierWeaponTier` (default TIER_MAX, so every existing
// caller sees the exact same behavior as before) is that fixed value — the Carrier's own two
// weapon slots (primary/secondary) each carry a different one, unlike astirWeapon/ardentWeapon
// where a single tier concept covers every caller.
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
//
// `lockTags` (default `false`, see docs/domains/equipment.md's "Equipment" notes) permanently fixes
// Kind/Tier/Range/Tags the moment an entry was picked from any catalog — the template renders all
// four disabled rather than omitting them, so a locked entry's design stays visible but unclickable
// through every future edit too, while Name and Description stay live. `invalidReason` below
// short-circuits to only the blank-name check when true, since nothing else can be invalid if
// nothing else is editable.
//
// "Override Max" is a Director escape hatch, gated by `allowOverride` (default
// `!carrierWeapon && !lockTags`) on top of the pre-existing `hasTagValueCap`/weapon-only gates.
// That default means every caller that already showed the button before `allowOverride` existed
// (the unlocked custom-weapon flows: plain Equipment-tab weapons, Astir/Ardent custom weapons —
// none of them pass `carrierWeapon` or `lockTags`) keeps showing it with zero call-site changes,
// while every Add-flow-shaped call for a `carrierWeapon` or a `lockTags` catalog pick is excluded
// automatically, also with no call-site change. Only the two Edit paths for those excluded flows
// (carrier-actor-sheet.js's `_onWeaponEdit`, and `equipment-mixin.js`'s `_onEquipmentEdit` for a
// catalog-sourced entry) need one explicit `allowOverride: true` each to opt back in — their Add
// counterparts (`_onWeaponAdd`, the catalog-pick flow) never pass it, so the button never appears
// on first creation, only once there's an existing entry to edit. Starting Gear's own custom-
// weapon flow is untouched either way — it was never `carrierWeapon` or `lockTags` to begin with.
//
// There are two distinct mechanisms behind the same button and label, chosen by whether the entry
// is `lockTags` (i.e. a catalog pick) or not:
//
// 1. "Raise an existing numeric cap" — the original mechanism, used by unlocked custom weapons
// (`maxTagValue: 0` today) and now also by Carrier weapons on Edit (`maxTagValue: 2`/`1` per
// slot). `maxTagValue` (the parameter above) never changes once the dialog opens — it's what
// "Lock Max" locks back down *to* headroom over, and what every `maxTagValueOverride` comparison
// below is relative to. `effectiveMaxTagValue` is the *live* cap `invalidReason` and the Save
// button actually enforce; clicking "Override Max" raises it to a flat `OVERRIDE_MAX_TAG_VALUE`,
// and clicking the button again (now reading "Lock Max") commits it back down to whatever the
// currently-checked tags actually total, floored at 0 — never back to the original `maxTagValue`
// outright, since the player may have deliberately settled on something between the base cap and
// the flat override ceiling.
//
// 2. "Unlock a permanently-locked catalog pick" — new, `lockTags`-only. A catalog entry has no
// numeric `maxTagValue` at all (it's `null` — the lock, not a cap, is what makes it uneditable),
// so raising a cap means nothing until the fields are actually unlocked first. Clicking
// "Override Max" on such an entry both raises `effectiveMaxTagValue` to `OVERRIDE_MAX_TAG_VALUE`
// (mechanism 1, reused) *and* flips `catalogUnlocked` from `false` to `true` (a `let`, alongside
// `effectiveMaxTagValue`, mutated by the same click handler) and removes `disabled` from every
// Kind/Tier/Range/Tag field this caller actually rendered. `catalogUnlocked` exists as separate
// state from `effectiveMaxTagValue` because two different things need to happen together here —
// "the cap is raised" and "the fields are unlocked" — where mechanism 1 alone only ever needed
// the former. It also changes what `invalidReason` and the resting (non-override) baseline mean:
// once true, `lockTags`'s "nothing else can be invalid" short-circuit stops applying (real
// validation has to run, same as any other weapon), and the resting baseline effective cap becomes
// `0` rather than the original `null` — `0` is what `_equipmentEditLockState` will hand back as
// this entry's new base `maxTagValue` on its *next* edit, once Save persists `catalogSource:
// false` below, converting it into an ordinary custom weapon from then on. `overrideBaseline` in
// the Save callback captures this same `catalogUnlocked ? 0 : maxTagValue` distinction for the
// `maxTagValueOverride` comparison there, mirroring `updateOverrideBlockVisibility`'s own resting-
// baseline reset.
//
// The button always rests at "Override Max" on open (even re-editing an already-overridden entry)
// rather than remembering "Lock Max" was last shown — it only ever reads "Lock Max" transiently,
// between an Override-Max click and the next Lock-Max click (or Save, which performs the same lock
// implicitly) — so a Director is never stuck mid-workflow unable to jump straight back to the flat
// ceiling on a fresh edit.
//
// Persistence needs no caller-side change at all beyond the `allowOverride: true` flags above: when
// the Save button's resolved lock value (`Math.max(currentTagTotal, 0)`) differs from
// `overrideBaseline`, the resolved object gets a `maxTagValueOverride` field carrying that value —
// set implicitly on Save even if "Lock Max" was never clicked, since Save already performs the same
// lock. A catalog entry that was actually unlocked this session (`catalogUnlocked`) additionally
// resolves `catalogSource: false`, independent of whether `maxTagValueOverride` is also present —
// see equipment-mixin.js's `_onEquipmentEdit` for why that field has to win over the old entry's
// `catalogSource: true` rather than being clobbered by it. Every caller that saves an edited entry
// already spreads `...result` from this function wholesale onto the saved entry, so a present
// `maxTagValueOverride`/`catalogSource` carries forward automatically and an absent one is dropped
// automatically, exactly like every other field this function resolves conditionally (`scale`,
// `tier`). Re-opening such an entry reads `initial.maxTagValueOverride` back out (see
// `effectiveMaxTagValue`'s own initialization below) so the dialog starts already in the overridden
// state — raised effective cap, "(max N)" showing it, the reminder visible — without the player
// needing to click "Override Max" again just to see where they left off.
export async function configureEquipment(
	initial = null,
	tags = EQUIPMENT_TAGS,
	{
		note,
		astirWeapon = false,
		carrierWeapon = false,
		carrierWeaponTier = TIER_MAX,
		ardentWeapon = false,
		excludedTagKeys = [],
		maxTagValue = null,
		lockTags = false,
		allowOverride = !carrierWeapon && !lockTags
	} = {}
) {
	// Drain only means anything on an Astir weapon (see DRAIN_GROUP's doc comment) — every other
	// flow, including ardentWeapon (an Ardent has no Power for Drain to reduce), hides its
	// checkboxes so it can't be picked somewhere it would stay permanently inert. WEAPON_RANGE_GROUP
	// is excluded unconditionally — it's never a checkbox anymore, see weaponRangeTags below.
	// excludedTagKeys (see the doc comment above) removes any further caller-specified keys, e.g.
	// starting-gear.js's custom-weapon flow excluding Valuable/Treasure.
	const pickableTags = tags.filter((tag) =>
		tag.exclusiveGroup !== WEAPON_RANGE_GROUP && (astirWeapon || tag.exclusiveGroup !== DRAIN_GROUP) &&
		!excludedTagKeys.includes(tag.key) &&
		(!tag.gearOnly || !(astirWeapon || carrierWeapon || ardentWeapon)));
	// Melee/Ranged/Sniper render as their own native radio group (see equipment-editor.hbs) rather
	// than as checkboxes in the tag list — a radio group can always have a default, which a
	// checkbox trio validated only at Save time couldn't. Editing an entry pre-selects whichever
	// range tag it already has; a brand-new entry, or one with no range tag at all (a Gear item
	// being reconfigured, or stale data), falls back to the first group member ("melee").
	const weaponRangeTags = tags.filter((tag) => tag.exclusiveGroup === WEAPON_RANGE_GROUP);
	const defaultWeaponRangeKey = weaponRangeTags.find((tag) => initial?.tags?.includes(tag.key))?.key
		?? weaponRangeTags[0]?.key;
	const isWeapon = astirWeapon || carrierWeapon || ardentWeapon || (initial?.kind ?? "weapon") === "weapon";
	// The live, actually-enforced cap (see "Override Max"'s own doc comment above) — starts at
	// `initial.maxTagValueOverride` when re-opening an entry already saved in the overridden state,
	// falling back to the base `maxTagValue` otherwise. Declared here (a `let`, mutated by the
	// render callback's click handlers via closure) rather than down by `invalidReason`, since both
	// that function and the render callback need to read/mutate the same live value.
	let effectiveMaxTagValue = initial?.maxTagValueOverride ?? maxTagValue;
	// Tracks a second, distinct override event: a previously permanently-locked catalog entry
	// (lockTags: true) whose Override Max was clicked, unlocking Kind/Tier/Range/Tags for the rest
	// of this dialog session and, on Save, permanently (see the Save callback's catalogSource: false
	// below). Only ever transitions false -> true, never back — this is a separate flag from
	// effectiveMaxTagValue because "the cap is raised" and "the fields are unlocked" are two
	// different things a locked catalog entry needs simultaneously, where an ordinary capped custom
	// weapon (lockTags: false) only ever needed the former.
	let catalogUnlocked = false;
	const content = await renderTemplate(EQUIPMENT_EDITOR_TEMPLATE, {
		note,
		astirWeapon,
		carrierWeapon,
		lockTags,
		// Kind is hidden for every caller that forces Scale/Tier — see the doc comment above.
		hideKind: astirWeapon || carrierWeapon || ardentWeapon,
		// Tier is hidden (rather than shown-disabled like carrierWeapon's) for every weapon that
		// inherits Tier from elsewhere instead of storing it — which today is every weapon except
		// carrierWeapon's — see the doc comment above.
		hideTier: !carrierWeapon,
		name: initial?.name ?? "",
		description: initial?.description ?? "",
		isWeapon,
		tier: carrierWeapon ? carrierWeaponTier : (initial?.tier ?? TIER_MIN),
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
		// Gates the "Override Max" button/reminder block's presence in the DOM at all — allowOverride
		// (see the doc comment above configureEquipment) excludes both mechanisms by default for
		// carrierWeapon and lockTags callers, opted back in per-call-site for their Edit paths only;
		// (maxTagValue !== null || lockTags) requires there to actually be a cap to raise or a lock to
		// break in the first place. Kept a separate boolean from isWeapon above because the block needs
		// to exist in the DOM even when the generic caller opens on Kind = Gear, so the Kind-change
		// listener (see the render callback) has something to show/hide live rather than nothing to find.
		showOverride: allowOverride && (maxTagValue !== null || lockTags) && isWeapon,
		// True when a persisted maxTagValueOverride is already active on open (effectiveMaxTagValue
		// initialized above from initial.maxTagValueOverride, differing from the base maxTagValue) —
		// drives the reminder's initial visibility. The button itself always starts reading "Override
		// Max" regardless (see the doc comment above), so this has no button-label counterpart.
		hasOverride: effectiveMaxTagValue !== maxTagValue,
		// Grouped (see groupEquipmentTags above) rather than one flat 40-entry list — the catalog
		// has grown too long to scan otherwise. Each group starts open only if it already holds one
		// of `initial`'s current tags, so editing a tagged item lands with the relevant group(s)
		// visibly expanded; a blank new item starts with every group collapsed.
		tagGroups: groupEquipmentTags(pickableTags.map((tag) => ({
			key: tag.key,
			label: tag.label,
			value: tag.value,
			description: tag.description,
			checked: Boolean(initial?.tags?.includes(tag.key)),
			...(tag.gearOnly && { gearOnly: true })
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

	// The single source of truth for "why can't this be saved right now," shared by the render
	// callback's live Save-button state (mouse-click case) and the Save button's own callback
	// (the authoritative gate — see its own comment on why it can't just trust the DOM's disabled
	// attribute). Returns a human-readable string to show as both a ui.notifications.warn message
	// and the Save button's title tooltip, or null when the current form state is valid. Takes
	// `html` as a parameter rather than closing over it, since render and the Save callback each
	// receive their own `html` argument from Foundry's Dialog.
	//
	// lockTags (see the doc comment above) short-circuits to just the blank-name check — nothing
	// else is editable on a locked entry, so nothing else can be invalid. Once catalogUnlocked flips
	// true (see its own doc comment above), that short-circuit stops applying — every check below
	// now has to actually run, the same as for any other weapon.
	const invalidReason = (html) => {
		const name = html.find("[name='name']").val().trim();
		if (!name) return "Equipment needs a name.";
		if (lockTags && !catalogUnlocked) return null;
		const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
		if (checkedKeys.length > MAX_TAGS) return `Equipment can have at most ${MAX_TAGS} tags, not counting Melee/Ranged/Sniper.`;
		// The outer null guard stays keyed off the base maxTagValue — a null base cap means no cap
		// exists to override in the first place — but it also fires once catalogUnlocked is true,
		// since a just-unlocked catalog entry's base maxTagValue is still null (there was never a
		// numeric cap to begin with, only a lock) and the raised effectiveMaxTagValue would otherwise
		// go unenforced. The comparison itself always checks the live, possibly-overridden
		// effectiveMaxTagValue (see its own doc comment above), so a player who clicked "Override Max"
		// can Save above the base cap while still under the raised one.
		if ((maxTagValue !== null || catalogUnlocked) && equipmentValue(checkedKeys, tags) > effectiveMaxTagValue) return `This equipment's tags can total at most ${effectiveMaxTagValue}.`;
		const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
		if (kind === "weapon" && !html.find("[name='weapon-range']:checked").val()) return "A weapon needs one of the Melee, Ranged or Sniper tags.";
		if (kind === "weapon") {
			const gearOnlyTag = checkedKeys.map((key) => findEquipmentTag(key, tags)).find((tag) => tag?.gearOnly);
			if (gearOnlyTag) return `${gearOnlyTag.label} can only be added to Gear, not Weapons.`;
		}
		return null;
	};

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
				// gearOnly tags (Ward) are already excluded from pickableTags entirely for the three
				// forced-weapon flows above. This flow's Kind is a live <select> instead, so a gearOnly
				// row has to be hidden/unchecked reactively as Kind changes rather than left checkable
				// and then rejected at Save.
				const gearOnlyRows = html.find(".equipment-editor-tag[data-gear-only='true']");
				const updateGearOnlyVisibility = () => {
					const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
					if (kind === "weapon") {
						gearOnlyRows.find("[name='tag']").prop("checked", false);
						gearOnlyRows.hide();
					} else {
						gearOnlyRows.show();
					}
				};
				// "Override Max" wiring (see the doc comment above configureEquipment). Only rendered at
				// all when showOverride is true (a numeric cap, and not carrierWeapon), so these finds
				// are empty jQuery sets — every method below already no-ops safely on an empty set — for
				// every out-of-scope caller (gear-only cap-less flows, Carrier weapons).
				const overrideBlock = html.find(".equipment-editor-max-override");
				const overrideButton = html.find(".equipment-editor-max-override-button");
				const overrideReminder = html.find(".equipment-editor-max-override-reminder");
				const maxValueDisplay = html.find(".equipment-editor-tag-max-value");
				// Syncs the "(max N)" readout and the reminder's visibility to the current
				// effectiveMaxTagValue — called after every change to it, and once more on initial
				// render below (the template's own initial paint already matches, from hasOverride/
				// maxTagValue, but this keeps JS the single source of truth going forward, same as
				// updateGearOnlyVisibility's own initial call does for its own DOM state).
				const updateOverrideDisplay = () => {
					maxValueDisplay.text(effectiveMaxTagValue);
					overrideReminder.toggle(effectiveMaxTagValue > maxTagValue);
				};
				// Whether the override block itself is shown at all, mirroring updateGearOnlyVisibility's
				// own forced-kind-or-live-select read immediately above -- called once unconditionally on
				// initial render below (so a dialog that opens already at Kind = Gear starts with the
				// block hidden, not just after the user first touches Kind) and wired into the Kind-change
				// listener further down for the one caller that renders a live Kind select at all.
				// Toggling away from Weapon resets the effective cap back to its resting baseline --
				// kept intentionally narrow rather than preserving override state across a Kind toggle,
				// the same "kept intentionally narrow" precedent Tier/Scale/Range already follow (see the
				// doc comment above configureEquipment). That resting baseline is 0, not the original
				// base maxTagValue, once catalogUnlocked is true -- a locked catalog entry's base
				// maxTagValue is null (there was never a numeric cap, only a lock), and 0 is what
				// _equipmentEditLockState will hand back as the new base on the *next* edit anyway, once
				// this Save persists catalogSource: false (see equipment-mixin.js).
				const updateOverrideBlockVisibility = () => {
					const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
					if (kind === "weapon") {
						overrideBlock.show();
					} else {
						overrideBlock.hide();
						effectiveMaxTagValue = catalogUnlocked ? 0 : maxTagValue;
						overrideButton.attr("data-mode", "override").text("Override Max");
						updateOverrideDisplay();
					}
				};
				overrideButton.on("click", () => {
					if (overrideButton.attr("data-mode") === "override") {
						effectiveMaxTagValue = OVERRIDE_MAX_TAG_VALUE;
						overrideButton.attr("data-mode", "lock").text("Lock Max");
						// The catalog-unlock mechanism (see the doc comment above configureEquipment) --
						// only relevant the first time Override Max is clicked on a still-locked entry.
						// Unlocking every field this caller actually rendered disabled: astirWeapon/
						// ardentWeapon callers never render name='kind' or name='tier' at all (hideKind/
						// hideTier above), so those two finds are safe no-ops for them, the same tolerance
						// this file already documents for weaponRangeTags.length === 0 elsewhere.
						if (lockTags) {
							catalogUnlocked = true;
							html.find("[name='kind'], [name='tier'], [name='weapon-range'], [name='tag']").prop("disabled", false);
						}
					} else {
						const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
						effectiveMaxTagValue = Math.max(equipmentValue(checkedKeys, tags), 0);
						overrideButton.attr("data-mode", "override").text("Override Max");
					}
					updateOverrideDisplay();
					updateSaveState();
				});
				// Calls the shared invalidReason (see above) with this render's own `html`, so Save can
				// be disabled live while the dialog is open -- Enter-to-submit invokes the Save button's
				// callback directly (Foundry's Dialog calls the default button's callback, not a
				// simulated click), which can bypass a disabled attribute, so that callback calls
				// invalidReason again itself as the real last-line defense. This live check only ever
				// improves the common (mouse-click) case. Also toggles a .disabled class and a
				// data-gate-tooltip attribute, mirroring the weapon-move-roll gated-button pattern
				// (sheet-tabs.css) -- native title tooltips do not fire on disabled form elements in
				// Chromium, so a genuinely disabled Save button needs this CSS-only tooltip instead.
				const updateSaveState = () => {
					const reason = invalidReason(html);
					const saveButton = html.find("[data-button='save']");
					saveButton.prop("disabled", Boolean(reason));
					saveButton.toggleClass("disabled", Boolean(reason));
					if (reason) saveButton.attr("data-gate-tooltip", reason);
					else saveButton.removeAttr("data-gate-tooltip");
				};
				// input, not change, so Save reacts while typing rather than only on blur.
				html.find("[name='name']").on("input", updateSaveState);
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
					updateSaveState();
				});
				// Kind is only rendered for the one caller that doesn't force it (see hideKind above) --
				// astirWeapon/carrierWeapon/ardentWeapon never render a Kind select to wire a listener to,
				// and so never need the override block's visibility to react to a Kind it never renders
				// in the first place — it just stays visible for the life of the dialog.
				if (!(astirWeapon || carrierWeapon || ardentWeapon)) {
					html.find("[name='kind']").on("change", () => {
						updateGearOnlyVisibility();
						updateTotal();
						updateOverrideBlockVisibility();
						updateSaveState();
					});
				}
				// weaponRangeTags (see above) is empty for an injected tags catalog with no range tags
				// (e.g. a fixture catalog in tests) -- nothing rendered to wire a listener to either.
				if (weaponRangeTags.length) {
					html.find("[name='weapon-range']").on("change", updateSaveState);
				}
				// Runs once on open so a dialog that already starts at Kind = Weapon (e.g. "Add Weapon",
				// or editing an existing weapon) hides/unchecks Ward immediately rather than only after
				// the user first touches the Kind select.
				updateGearOnlyVisibility();
				// Mirrors updateGearOnlyVisibility's own initial call, immediately above -- a dialog that
				// opens already at Kind = Gear (the generic caller only) starts with the override block
				// hidden, not just after the user first touches Kind; every forced-weapon caller (and
				// carrierWeapon, whose block was never rendered at all) is unaffected, matching
				// updateGearOnlyVisibility's own forced-kind read.
				updateOverrideBlockVisibility();
				// Confirms the "(max N)" readout and reminder visibility match effectiveMaxTagValue's
				// starting value (the template's own first paint already agrees, from hasOverride/
				// maxTagValue, but this keeps JS the single source of truth from here on rather than
				// relying on that agreement holding). A no-op re-confirmation whenever the call above
				// already ran this itself (Kind = Gear on open).
				updateOverrideDisplay();
				// Sets Save's initial disabled/enabled state on open -- a blank Add dialog opens
				// disabled, an Edit dialog pre-filled with a valid name opens enabled.
				updateSaveState();
			},
			buttons: {
				save: {
					label: "Save",
					callback: (html) => {
						// The authoritative gate — see invalidReason's own doc comment on why this can't
						// just trust the DOM's live disabled attribute (Enter-to-submit bypasses it).
						const reason = invalidReason(html);
						if (reason) {
							ui.notifications.warn(reason);
							resolve(null);
							return;
						}
						const name = html.find("[name='name']").val().trim();
						// None of the Astir/Carrier/Ardent weapon dialogs render the Kind select at all
						// (see the template) — all three are always weapons, so there's nothing to read
						// from the DOM here for any of them.
						const kind = (astirWeapon || carrierWeapon || ardentWeapon) ? "weapon" : html.find("[name='kind']").val();
						const checkedKeys = html.find("[name='tag']:checked").map((_, el) => el.value).get();
						const weaponRangeKey = html.find("[name='weapon-range']:checked").val();
						// The implicit "lock" every Save performs, whether or not "Lock Max" was ever
						// clicked (see the doc comment above configureEquipment) — the same
						// Math.max(currentTagTotal, 0) computation the button's own Lock-Max click
						// performs, just evaluated once more here as the authoritative value to persist.
						const lockedMaxTagValue = Math.max(equipmentValue(checkedKeys, tags), 0);
						// The baseline lockedMaxTagValue is compared against to decide whether an override
						// is still in effect (see the comment below) — the base maxTagValue normally, but 0
						// once catalogUnlocked is true, since a locked catalog entry's base maxTagValue is
						// null (there was never a numeric cap to begin with, only a lock) and comparing
						// against null would make maxTagValueOverride persist unconditionally.
						const overrideBaseline = catalogUnlocked ? 0 : maxTagValue;
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
								// Only carrierWeapon still stores its own, fixed at carrierWeaponTier; the DOM
								// field carrierWeapon renders is disabled, so nothing else can reach here.
								...(carrierWeapon && { tier: carrierWeaponTier })
							}),
							// Persists the override only when it's still actually in effect at Save time — a
							// player who clicked "Override Max" but ended up back at (or below) the baseline
							// (whether via "Lock Max" or just unchecking tags) resolves no field at all here,
							// same as a caller with no cap in the first place. See the doc comment above
							// configureEquipment for why no caller-side change is needed for this to persist.
							...(kind === "weapon" && overrideBaseline !== null && lockedMaxTagValue !== overrideBaseline && {
								maxTagValueOverride: lockedMaxTagValue
							}),
							// Permanently converts a just-unlocked catalog entry into an ordinary custom
							// weapon (see the doc comment above configureEquipment) — persisted whenever the
							// player actually unlocked it this session, independent of whether the resulting
							// tag total also needed a maxTagValueOverride above (they may have unlocked,
							// looked around, and settled back at exactly 0 — still permanently unlocked, just
							// with nothing to override going forward).
							...(kind === "weapon" && catalogUnlocked && { catalogSource: false })
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
		}, { classes: ["armor-astir", "equipment-editor"], width: 720, height: 650, resizable: true }).render(true);
	});
}
