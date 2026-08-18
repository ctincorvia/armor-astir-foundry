# Carrier weapons: adopt the shared Equipment/Astir weapon card

## Context

The Equipment tab, Astir tab and Ardents section all render weapon cards from **byte-identical
markup** — 9 copies of the same ~50-line block. The Carrier's weapons section
([carrier-actor-sheet.hbs:21-68](../templates/carrier-actor-sheet.hbs#L21-L68)) is a hand-rolled
10th variant that borrows *some* of the same class names but omits the two wrappers the CSS is
actually scoped to:

- No `.equipment-meta` wrapper → the chip rule at [sheet-tabs.css:356-366](../styles/sheet-tabs.css#L356-L366)
  is `.equipment-meta .equipment-value, …` (deliberately descendant-scoped), so the Carrier's
  Value / Tier / Scale render as **unstyled plain inline text** instead of badges.
- No `.equipment-tags-block` wrapper → tags get no bordered/tinted panel
  ([sheet-tabs.css:410-416](../styles/sheet-tabs.css#L410-L416)).
- Uses `.entry-list`/`.entry-list-item` instead of `.equipment-list`/`.equipment-item`, and puts
  Tier in a second `.equipment-value` span rather than `.equipment-tier-value`.

Outcome: the Carrier's weapons look like the rest of the module, and the card stops being a
copy-paste liability — one partial replaces 10 sites. **No CSS changes are needed at all**; the
Carrier picks up the existing rules purely by adopting the class names.

Scope confirmed with the user: markup + styling parity only. The documented v1 scope cut stays —
no Disabled toggle, no tag Spent checkboxes, no spends/reroll/Guided on the Carrier.

## 1. New shared partial: `templates/shared/equipment-card.hbs`

Lives in `templates/shared/`, not `templates/playbook-sheet/` — the Carrier consumes it, so per
CLAUDE.md's dependency-direction rule it can't live inside the playbook's own folder.

Contents = the canonical card from [tab-equipment.hbs:16-63](../templates/playbook-sheet/tab-equipment.hbs#L16-L63),
with two hash-param gates and two `{{#if}}` gates for the fields gear lacks:

```hbs
<li class="equipment-item{{#if disabled}} equipment-item-disabled{{/if}}" data-equipment-id="{{id}}">
	<div class="equipment-header">
		<span class="equipment-name">{{name}}</span>
		<div class="equipment-meta">
			<span class="equipment-value">Value {{value}}</span>
			{{#if tier}}<span class="equipment-tier-value">Tier {{tier}}</span>{{/if}}
			{{#if scaleLabel}}<span class="equipment-scale">{{scaleLabel}}</span>{{/if}}
		</div>
		<div class="equipment-actions">
			{{#if disabledToggle}}
			<label class="equipment-disabled">…</label>
			{{/if}}
			{{#if controls}}
			<div class="equipment-item-controls">
				<button type="button" class="equipment-edit" data-equipment-id="{{id}}">Edit</button>
				<button type="button" class="equipment-remove" data-equipment-id="{{id}}" aria-label="Remove equipment">✕</button>
			</div>
			{{/if}}
		</div>
	</div>
	… description / tags-block / weapon-move-controls, verbatim from the existing card …
</li>
```

Design notes (all verified against the current code):

- **`{{#if tier}}` is a safe gate.** `_conflictTier().base` starts at `CHARACTER_TIER_DEFAULT = 1`
  ([progression-mixin.js:28,51](../scripts/playbook/playbook-sheet/progression-mixin.js#L49-L52)) and
  both contributors are non-negative, so a weapon's `tier` is always ≥ 1; gear never carries `tier`
  at all (weapon-only conditional spread in
  [`_equipmentEntry`](../scripts/playbook/playbook-sheet/equipment-mixin.js#L108)). Same for
  `scaleLabel`.
- **Cut-safety is satisfied.** The only `{{../id}}` references are inside `{{#each tags}}` and
  `{{#each weaponMoves}}` — both frames open *within* the partial, so they resolve against the
  weapon entry exactly as today. No card reaches outward into the enclosing `{{#each ardents}}`
  frame (verified across [ardents.hbs:96-147](../templates/playbook-sheet/ardents.hbs#L96-L147)).
- **Only truthy flags get passed;** an omitted hash key is `undefined`, so `{{#if controls}}` is
  false without needing `controls=false`.
- `aria-label` standardizes on `"Remove equipment"` (the existing wording at 9 of 10 sites) rather
  than adding a third parameter for the Carrier's `"Remove weapon"`.

## 2. Register the partial

[scripts/main.js:10-22](../scripts/main.js#L10-L22): add
`"modules/armor-astir/templates/shared/equipment-card.hbs"` to the preload list and **rename
`PLAYBOOK_SHEET_PARTIALS` → `SHEET_PARTIALS`** — the array is no longer playbook-only.
Update the three references in [tests/main.test.js:2,27,28](../tests/main.test.js#L27-L28) (length
`11` → `12`).

Foundry throws on first render if a partial isn't preloaded, and `loadTemplates` is stubbed to a
no-op in `tests/setup.js` — so a green suite proves nothing here. This path must be eyeballed in a
real client.

## 3. Replace the 9 existing call sites

Each becomes `{{#each …}}{{> "modules/armor-astir/templates/shared/equipment-card.hbs" …}}{{/each}}`:

| Site | Flags |
|---|---|
| [tab-equipment.hbs:15](../templates/playbook-sheet/tab-equipment.hbs#L15) `equipment.weapons` | `controls=true disabledToggle=true` |
| [tab-equipment.hbs:71](../templates/playbook-sheet/tab-equipment.hbs#L71) `equipment.astirWeapons` | `disabledToggle=true` (read-only) |
| [tab-equipment.hbs:124](../templates/playbook-sheet/tab-equipment.hbs#L124) `equipment.ardentWeapons` | `disabledToggle=true` (read-only) |
| [tab-equipment.hbs:182](../templates/playbook-sheet/tab-equipment.hbs#L182) `equipment.gear` | `controls=true` |
| [tab-astir.hbs:182](../templates/playbook-sheet/tab-astir.hbs#L182) / [:242](../templates/playbook-sheet/tab-astir.hbs#L242) | `controls=true disabledToggle=true` |
| [ardents.hbs:97](../templates/playbook-sheet/ardents.hbs#L97) / [:157](../templates/playbook-sheet/ardents.hbs#L157) / [:239](../templates/playbook-sheet/ardents.hbs#L239) | `controls=true disabledToggle=true` |

The gear card needs no special handling — it simply lacks `tier`, `scaleLabel` and `weaponMoves`,
so the partial's gates already produce today's markup.

## 4. Carrier template: `templates/carrier-actor-sheet.hbs`

Replace lines 21-68 with **one** `<section class="weapons">` containing a per-slot
`.section-header` + `.equipment-list` — the Astir tab's Weapons / Extra Weapons shape. The outer
"Weapons" `<h3>` and the `.weapon-slot-label` `<h4>` both go away; the slot label becomes the
`<h3>`, and the `+` button moves into a real `.section-header-actions` inside a real
`.section-header` (today it sits in a `.section-header-actions` with no `.section-header` parent).

```hbs
<section class="weapons">
	{{#each weaponSlots}}
	<div class="section-header">
		<h3>{{label}}</h3>
		{{#unless entry}}
		<div class="section-header-actions">
			<button type="button" class="weapon-add icon-add-button" data-slot="{{key}}" title="Add {{label}}" aria-label="Add {{label}}">+</button>
		</div>
		{{/unless}}
	</div>
	{{#if entry}}
	<ol class="equipment-list">
		{{#with entry}}{{> "modules/armor-astir/templates/shared/equipment-card.hbs" controls=true}}{{/with}}
	</ol>
	{{/if}}
	{{/each}}
</section>
```

`{{#with entry}}` opens in the *caller*, so the partial's own `{{../id}}` frames are unaffected.

## 5. Carrier sheet JS: `scripts/world-actors/carrier-actor-sheet.js`

**`_weaponEntry(slot, entry)`** — two shape changes so the entry matches what the partial reads:
- each tag gains `showValue: true` (the partial uses `{{#if showValue}} ({{value}}){{/if}}`)
- rename `moves:` → `weaponMoves:`

**Address in-card buttons by entry id, not slot.** The partial emits `data-equipment-id`, so add:

```js
_weaponSlotForId(id) {
	const weapons = this._weapons();
	return WEAPON_SLOTS.find((slot) => weapons[slot.key]?.id === id) ?? null;
}
```

`_onWeaponEdit` / `_onWeaponRemove` / `_onWeaponMoveRoll` read `dataset.equipmentId` and resolve
through it. `_onWeaponAdd` keeps `data-slot` — its button is in the section header, outside the card.

Two incidental correctness wins:
- `_onWeaponRemove` currently validates nothing and will happily write
  `system.attributes.weapons.<anything> = null`; resolving by id gives it the guard it lacks.
- The `✕` currently carries both `.weapon-remove` and `.entry-list-remove`, so `WorldActorSheet`'s
  generic `_onEntryRemove` **also** fires on the click and writes a junk
  `system.attributes.undefined` key. Switching to `.equipment-remove` (unbound on this sheet)
  removes the double-handler.

**Coverage caution:** once a slot is found by id match its entry is guaranteed non-null, so do
*not* add a follow-up `if (!entry) return` — it would be an unreachable branch and fail the 100%
branch gate.

**`activateListeners`** — rebind: `.weapon-edit` → `.equipment-edit`, `.weapon-remove` →
`.equipment-remove`. `.weapon-add` and `.weapon-move-roll` are unchanged.

**Opportunistic comment trim** (CLAUDE.md, "Code comments"): the `WEAPON_SLOTS`, `_weaponTagKeys`,
`_weaponEntry` and `_onWeaponAdd` comments are 8-10 line essays duplicating
`docs/domains/world-actors.md` and citing `claude.md` rather than the domain doc. Since these
methods are being edited anyway, cut them to one-line pointers.

## 6. Fix the adjacent Carrier-weapon crash

[move-roll-mixin.js:64-66](../scripts/playbook/playbook-sheet/move-roll-mixin.js#L64-L66) (The
Captain's Fire Support) does `(carriers[0].system.attributes?.weapons ?? []).map(…)`, but the
Carrier stores `{ primary, secondary }` — an **object**. `.map` is not a function, so this throws
on real data. Replace with:

```js
const carrierWeapons = Object.values(carriers[0].system.attributes?.weapons ?? {})
	.filter(Boolean)
	.map((w) => ({ ...w, fromCarrier: true }));
```

`.filter(Boolean)` handles the `null` empty slots. Then correct the fixture at
[tests/playbook-actor-sheet-the-captain.test.js:373](../tests/playbook-actor-sheet-the-captain.test.js#L373)
from `weapons: [carrierWeapon]` to `weapons: { primary: carrierWeapon, secondary: null }` — the
fake array shape is what has been hiding this bug.

## 7. Tests

`tests/carrier-actor-sheet.test.js` (the only Carrier test file, 538 lines):
- `getData` describes: tags gain `showValue: true`; `moves` → `weaponMoves`.
- `activateListeners`: assert `.equipment-edit` / `.equipment-remove` bindings.
- `_onWeaponEdit` / `_onWeaponRemove` / `_onWeaponMoveRoll`: datasets become
  `{ equipmentId }` (+ `move` for the roll). The existing "no-op for unknown slot" and "no-op when
  slot empty" cases collapse into one "no-op for unknown id" per handler — keep both branches of
  `_weaponSlotForId` (found / not found) covered.
- Add a `_onWeaponRemove` unknown-id case; there is only one test there today.

`tests/main.test.js`: renamed export + length 12.
`tests/playbook-actor-sheet-the-captain.test.js`: fixture shape.

For the repetitive fixture edits (`slot:` → `equipmentId:` across many `dataset` literals), use
`py .claude/scripts/regex_replace.py` rather than a raw `perl -pi`/`sed` one-liner — see
`.claude/scripts/README.md`.

## 8. Docs

- [docs/domains/world-actors.md:16](../docs/domains/world-actors.md#L16): note that the Carrier's
  weapon cards now render through the shared `templates/shared/equipment-card.hbs`, that each slot
  gets its own `.section-header`, and that in-card buttons address by `data-equipment-id` (slot
  resolved via `_weaponSlotForId`) while the add button stays `data-slot`.
- [docs/domains/equipment.md](../docs/domains/equipment.md): one bullet introducing the shared
  partial and its two hash flags, so the next person adding a weapon list finds it instead of
  copy-pasting a 10th card.

## Verification

1. `npx handlebars templates/shared/equipment-card.hbs -f /dev/null` plus the same for each edited
   template — catches unbalanced `{{#if}}`/`{{#each}}`, nothing more.
2. `git add -A && npx lint-staged && npm run test:coverage` — must be green at the 100%
   lines/branches/functions/statements gate. If coverage flags a line, read that line first; do not
   reach for a tooling-bug theory (CLAUDE.md).
3. **Manual Foundry client check is mandatory and is the only real verification of this change** —
   `renderTemplate` and `loadTemplates` are both stubbed in `tests/setup.js`, and `lint-staged`
   only lints `.js`, so every `.hbs` and CSS outcome here is invisible to CI. Foundry does not
   hot-reload `esmodules`, so do a full client reload. Confirm:
   - Carrier sheet: two slot headers; `+` on an empty slot; a populated slot shows Value / Tier /
     Scale as **tinted badges** and tags inside a bordered panel; Edit, `✕` and both
     Exchange Blows / Strike Decisively buttons work; `✕` clears only that slot (watch the console
     for the old `system.attributes.undefined` write disappearing).
   - Playbook sheet: Equipment tab (Weapons / Astir Weapons / Ardent Weapons / Gear), Astir tab
     (Weapons / Extra Weapons) and each Ardent (Weapons / Extra Weapons / Feature Weapons) all
     render **byte-identically to before** — Disabled toggles present only where they were, Edit/✕
     absent on the read-only Astir/Ardent sections in the Equipment tab, gear still showing Value
     only.
   - A Captain with Fire Support and one Carrier in the world can roll and see the Carrier's
     weapons offered, with no console error.
