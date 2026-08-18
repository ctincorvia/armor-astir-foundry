# Style the "Quarters" section on the playbook sheet and the Carrier sheet

## Context

Support-playbook characters get a "Quarters" box on the Equipment tab — a name, a free-text
description, up to `QUARTERS_BENEFIT_MAX` (2) checkbox-picked benefits, and (when more than one
Carrier exists) an Assigned Carrier select
([tab-equipment.hbs:220-244](../templates/playbook-sheet/tab-equipment.hbs#L220-L244)). The Carrier
sheet shows a read-only roster of every assigned Support actor's Quarters
([carrier-actor-sheet.hbs:69-86](../templates/carrier-actor-sheet.hbs#L69-L86)).

Both templates already carry a full set of dedicated classes (`.quarters`, `.quarters-name-input`,
`.quarters-benefit-list`, `.quarters-owner`, …), but **none of them has ever had a matching CSS
rule** — `grep -rn "quarters" styles/*.css` matches only a prose comment
([sheet-chrome.css:12](../styles/sheet-chrome.css#L12)), never a selector. Every element in both
sections renders in raw browser-default styling: an unsized name `<input>`, a default-bordered
`<textarea>`, a numbered `<ol>` of checkboxes with default markers, an unaligned label/select pair,
and (on the Carrier) a plain `<p>` and bulleted `<ul>` with no typographic treatment. This is the
one section on either sheet that never received the dedicated-class + `var(--aa-*)`-token CSS
treatment every other section already has (`.cosmetic`, `.dangers-column`, `.equipment-tag-list`,
`.entry-list`, …).

**No `.hbs` edits are needed** — every class this plan styles already exists verbatim in both
templates. This is a CSS-only change, invisible to the test suite (`renderTemplate`/`loadTemplates`
are stubbed in `tests/setup.js`, and `lint-staged` only runs ESLint on `.js` — see CLAUDE.md's
"Recurring conventions") and must be eyeballed in a real Foundry client.

## Key constraint: both stylesheets load globally, for every sheet

[module.json:17-25](../module.json#L17-L25) loads every CSS file for every sheet unconditionally —
there is no per-sheet-type loading. `.quarters` and `.quarters-benefit-list` appear in **both**
templates but with different markup shapes:

- Playbook: `<div class="quarters">` → `<ol class="quarters-benefit-list">` of checkbox
  `<li class="quarters-benefit-item">`.
- Carrier: `<section class="quarters">` → `<ul class="quarters-benefit-list">` of plain,
  classless `<li>{{this}}</li>` strings.

A rule keyed on the bare `.quarters` class would leak across both sheets and collide with the
other one's layout. This plan avoids that by:

- **Never writing a bare `.quarters` container rule.** Spacing between the playbook box's children
  is handled with `margin-top` on each child instead of a flex container with `gap`, sidestepping
  the collision entirely. The Carrier's `<section class="quarters">` needs no rule of its own — it
  already inherits [world-actor-sheet.css:9-11](../styles/world-actor-sheet.css#L9-L11)'s generic
  `section { margin-bottom: var(--aa-space-4) }`, same as `.weapons`/`.crew-members`.
- **Writing the `.quarters-benefit-list` list-reset once**, in `styles/sheet-tabs.css` (Quarters is
  a playbook-tab feature; the Carrier's read-only rollup reuses it without redeclaring it). This
  mirrors the existing precedent where `.section-header` is defined once in `sheet-chrome.css` and
  reused by the Carrier/Authority/Cause templates without redeclaration — see
  [world-actor-sheet.css:1-4](../styles/world-actor-sheet.css#L1-L4)'s own file-header comment
  ("Reuses the --aa-* tokens, h3, and .section-header/.icon-add-button rules already declared in
  playbook-actor-sheet.css … rather than redeclaring them").
- Everything else uses class names genuinely unique to one sheet's markup (`.quarters-name-input`,
  `.quarters-benefit-item`, `.quarters-carrier-control` → playbook only; `.quarters-owner`,
  `.quarters-description` → Carrier only), so no scoping tricks are needed there.

## 1. `styles/sheet-tabs.css` — playbook sheet's editable Quarters box

Insert after [line 474](../styles/sheet-tabs.css#L474) (the end of the existing
`.equipment-tag-description` rule, immediately before the `.cosmetic` block's comment at line 476)
— keeps it grouped with the rest of the Equipment tab's rules in this file:

```css
/* Quarters (Equipment tab, isSupport-gated — see quarters.js/quarters-mixin.js): a name, a
   description and up to QUARTERS_BENEFIT_MAX benefit picks. The .quarters-benefit-list reset below
   is intentionally the only rule for that class in the whole module — the Carrier's read-only
   Quarters rollup (carrier-actor-sheet.hbs) reuses the identical class on a plain <ul>, so this one
   rule is shared by both sheets, the same way .section-header is shared without redeclaration (see
   world-actor-sheet.css's file-header comment). Do not duplicate it in world-actor-sheet.css. */
.armor-astir.sheet .quarters-name-input {
	width: 100%;
}

.armor-astir.sheet .quarters-description-input {
	width: 100%;
	min-height: 3em;
	margin-top: var(--aa-space-2);
	resize: vertical;
}

.armor-astir.sheet .quarters-benefit-list {
	margin: var(--aa-space-2) 0 0;
	padding: 0;
	list-style: none;
}

.armor-astir.sheet .quarters-benefit-list li {
	padding: 2px 0;
	font-size: 12px;
}

.armor-astir.sheet .quarters-benefit-item label {
	display: flex;
	align-items: center;
	gap: var(--aa-space-1);
}

/* Same opacity-0.6 idiom as .equipment-item-disabled/.move-disabled/.entry-list-item.faction-
   exhausted — surfaces the QUARTERS_BENEFIT_MAX-reached state the template already computes into
   `disabled` but never visibly showed. :has() already has one precedent in this module
   (dialogs.css:287). */
.armor-astir.sheet .quarters-benefit-item:has(.quarters-benefit-checkbox:disabled) {
	opacity: 0.6;
}

/* Label-beside-select row, same shape as world-actor-sheet.css's .entry-counter — kept as its own
   copy rather than a cross-file selector, matching that file's own "own copy, no cross-file
   dependency" convention. */
.armor-astir.sheet .quarters-carrier-control {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: var(--aa-space-2);
	margin-top: var(--aa-space-2);
}

.armor-astir.sheet .quarters-carrier-control label {
	font-size: 11px;
	font-weight: bold;
	white-space: nowrap;
}

.armor-astir.sheet .quarters-carrier-select {
	flex: 1 1 auto;
	min-width: 0;
}
```

Values/tokens used here all already exist in [tokens.css](../styles/tokens.css) (`--aa-space-1`
through `--aa-space-4`) and match sibling rules already in this file: `width: 100%` +
`resize: vertical` mirror `world-actor-sheet.css`'s existing `.entry-list textarea` rule; the
`opacity: 0.6` value matches [sheet-tabs.css:174-177](../styles/sheet-tabs.css#L174-L177); the
`.quarters-carrier-control label` values match `world-actor-sheet.css`'s `.entry-counter label`.

## 2. `styles/world-actor-sheet.css` — Carrier sheet's read-only Quarters rollup

Insert after [line 165](../styles/world-actor-sheet.css#L165) (right after the existing
`.entry-list:not(...) > .entry-list-item:hover` rule) — these two classes only ever appear nested
inside that same `.entry-list-item`:

```css
/* Quarters' read-only rollup. .quarters-benefit-list's own reset lives once in sheet-tabs.css (see
   that file's comment) — these two are the only pieces unique to this sheet's markup. */
.armor-astir.sheet .quarters-owner {
	font-size: 11px;
	font-weight: normal;
	color: var(--aa-secondary-dark);
}

.armor-astir.sheet .quarters-description {
	margin: var(--aa-space-1) 0 0;
	font-size: 12px;
}
```

`.quarters-description`'s values are an intentional duplicate of
[sheet-tabs.css:403-406](../styles/sheet-tabs.css#L403-L406)'s `.equipment-description` rule (own
copy, not shared — this file's established convention per its `.trait-control`/`.crew-step`
comments) rather than a cross-file reference.

**Nothing else on the Carrier side needs a rule.** `<section class="quarters">` already inherits
the generic `section { margin-bottom }` treatment every other Carrier section gets; the
`<ol class="entry-list quarters-list">`/`<li class="entry-list-item">` already get list-reset,
zebra-stripe, hover and border-bottom from the existing rules at
[world-actor-sheet.css:139-165](../styles/world-actor-sheet.css#L139-L165). The `<h4>` name heading
is deliberately left at its browser default — the sibling `.weapon-slot-label` `<h4>` two sections
up ([carrier-actor-sheet.hbs:28](../templates/carrier-actor-sheet.hbs#L28)) has the identical
un-addressed default margin, so fixing one without the other would make Quarters visually
inconsistent with its own neighboring section rather than more consistent.

## 3. `docs/domains/styling.md` — one bullet

Add a bullet under "Sheet styling" documenting the cross-sheet `.quarters-benefit-list` reuse
decision — why it's defined once in `sheet-tabs.css` rather than duplicated — in the same voice as
the file's other non-obvious-decision bullets, so a future CSS split doesn't duplicate it into
`world-actor-sheet.css` and create a specificity fight.

## Verification

1. `git add -A && npx lint-staged && npm run test:coverage` — expected green and unchanged, since
   this is CSS-only and CSS/`.hbs` are invisible to the suite (CLAUDE.md).
2. **Manual Foundry client check is mandatory — the only real verification of this change.**
   `renderTemplate`/`loadTemplates` are stubbed in `tests/setup.js` and `lint-staged` only lints
   `.js`, so nothing here is checked by CI. Foundry hot-reloads CSS but not `esmodules`; since this
   change is CSS-only, a hot reload should suffice, but do a full reload if anything looks stale.
   Confirm:
   - **Support playbook, Equipment tab:** Quarters name input is full-width; description textarea
     is sized/resizable; the benefit checkbox list has no numbered-list markers and each
     checkbox/label pair is aligned; after picking 2 benefits, the remaining unpicked option(s)
     render visibly dimmed; if more than one Carrier actor exists in the world, the "Assigned
     Carrier" label/select row is aligned on one line.
   - **Carrier sheet:** each assigned Support's entry shows a muted "(owner name)" annotation next
     to the Quarters name, a properly-spaced description paragraph, and a clean unbulleted
     benefit-label list, with the existing zebra-stripe/hover from `.entry-list-item` still intact.
