# Update the Authority structure

## Context

The Authority actor currently models the empire as a **flat** structure: a 1–10 Stability track, three
top-level Pillars (name + description only), and three Divisions (name, description, Strength 0–5,
Disfavor 0–10). That doesn't match the game: an Authority has **9 Stability**, **3 Divisions**, and
**each Division has 3 Pillars** — 9 Pillars total, nested under their Division.

The existing model also drops mechanics the rules already reference. `scripts/moves/special-moves.js`
(Plan & Prepare) says *"Reduce the GRIP on a Faction or Pillar by 1"* and *"Fell a Pillar with 0 GRIP"* —
so a Pillar carries GRIP (0–3) and a Felled state, exactly like Cause's Factions do today. Neither
exists on a Pillar right now.

A Division also needs a **kind**, and **passive / active outcomes**: one passive outcome (a single
description) and a list of active outcomes, both determined by the Division's kind. None of this
exists today. `astir-parts.js`'s `partType: "Active"/"Passive"` is the module's existing precedent for
this vocabulary, and it is display-only — the same is true here.

Separately, the Authority's presentation has drifted from house conventions: its CSS and JS comments
point at `styles/playbook-actor-sheet.css`, a file that no longer exists (the styles directory was
split into `tokens.css` / `sheet-chrome.css` / `sheet-layout.css` / `sheet-tabs.css` / `move-chat.css`
/ `dialogs.css` / `world-actor-sheet.css`), several comments cite `claude.md` where the convention is
now `docs/domains/*.md`, and the template is a single monolithic file while the playbook sheet has
been split into `templates/playbook-sheet/*.hbs` partials. `docs/domains/styling.md` is stale on the
same point.

**Outcome:** an Authority sheet with 9 Stability and 3 Divisions, each Division carrying a kind that
drives its passive/active outcomes plus its own 3 Pillars with GRIP and Felled — built almost entirely
on `WorldActorSheet`'s existing generic handlers, with the CSS, template, and docs brought back in
line with the rest of the module.

### Decisions already made

| Decision | Choice |
|---|---|
| Pillar state | `grip` (0–3 counter) + `felled` (checkbox), mirroring Cause's Factions |
| Stability | Manual click-to-set 9-step track, seeded 9, floor 1 — **not** derived from Pillars |
| Division outcomes | Catalog in code (`DIVISION_KINDS`), only `kind` stored on the actor |
| Active outcomes UI | Listed **read-only** — reference text, no per-outcome state |
| Kind content | **Placeholder kinds, clearly marked TODO** — real rules text supplied later |
| Pre-existing Authority actors | **No migration.** Change creation defaults only |
| Styling scope | Fix stale refs, restructure, split the template into partials, and split the CSS |

---

## Data model

Pillars stay in **one flat `system.attributes.pillars` list** keyed to their Division by a
`divisionId` foreign key — *not* nested arrays inside each Division entry. A Division stores only its
kind **key**; all outcome text is resolved from the catalog at render time.

```js
system.attributes = {
  stability: { value: 9 },                                            // 1-9
  divisions: [ { id, name, description, strength, disfavor, kind } × 3 ],
  pillars:   [ { id, divisionId, name, description, grip, felled } × 9 ],
  assets: [], notableActors: []                                       // unchanged, freeform
}
```

**Why flat + FK, not nested:** `WorldActorSheet`'s four handlers
([world-actor-sheet.js:28-72](../scripts/world-actors/world-actor-sheet.js#L28-L72)) address entries as
`system.attributes.<list>` + `data-entry-id` + `data-field`. A flat list keeps GRIP on
`_onEntryCounterStep`, Felled on `_onEntryFieldChange`'s checkbox branch, and the kind `<select>` on
`_onEntryFieldChange`'s value branch with **zero new JS** — the documented invariant in
[docs/domains/world-actors.md:11](../docs/domains/world-actors.md#L11) ("a new list — or a new stepped
counter on an existing list — needs new template markup but no new JS"). Nested arrays would require a
bespoke path-building handler. Grouping and outcome resolution are derived fresh in `getData`, per
CLAUDE.md's "derive fresh every render, never persist."

**Why only `kind` is stored:** CLAUDE.md's "catalog in code, keys on the actor" — edited outcome text
reaches existing Authorities, and a kind key that no longer resolves degrades to no outcomes rather
than stale text.

---

## Changes

### 1. New catalog: `scripts/world-actors/division-kinds.js`

A leaf module, no imports, no Foundry API — same shape as `entry-list.js`. Catalog plus its one tiny
resolver live together (there's no logic-file's-worth of code to separate, same call as
`starting-gear.js`).

```js
// A Division's kind determines its outcomes: exactly one passive outcome (a standing effect) and a
// list of active outcomes the Authority can take. Catalog in code, key on the actor (see CLAUDE.md,
// "Recurring conventions") so edited text reaches existing Authorities. Display-only reference text
// — nothing here is enforced, same as astir-parts.js's partType.
export const DIVISION_KINDS = [
	{
		key: "kind-a",
		label: "TODO Kind A",
		passive: "<p>TODO — replace with the real passive outcome text.</p>",
		active: [
			"<p>TODO — replace with the real active outcome text.</p>",
			"<p>TODO — replace with the real active outcome text.</p>"
		]
	},
	// …two more TODO placeholders, same shape
];

export function findDivisionKind(key) {
	return DIVISION_KINDS.find((kind) => kind.key === key) ?? null;
}
```

> **TODO marker:** the three entries are deliberate placeholders so the whole path is implementable
> and testable now. Keys/labels/text get replaced with the real Division kinds; **no code outside this
> file changes when they do** — that's the point of the catalog split. Keep the entry *shape*
> (`key`/`label`/`passive`/`active`) when filling it in, and use HTML strings for the prose, matching
> every other rules-text catalog in the module.

### 2. `scripts/world-actors/authority-actor-sheet.js`

- `STABILITY_MAX`: `10` → `9`. **Export** `STABILITY_MAX` and a new `PILLARS_PER_DIVISION = 3` so
  `actor-creation.js` seeds from the same source (matches the existing `TIER_MIN` import precedent in
  [actor-creation.js:2](../scripts/actor-creation.js#L2)). `STABILITY_MIN = 1` stays private.
- Import `DIVISION_KINDS, findDivisionKind` from `./division-kinds.js`.
- `getData`: drop `data.pillars`; replace `data.divisions = this._list("divisions")` with
  `data.divisions = this._divisionsData()`. Stability block unchanged apart from the new max.
- New `_divisionsData()` — the only new logic on the sheet:

```js
_divisionsData() {
	const pillars = this._list("pillars");
	return this._list("divisions").map((division) => {
		const kind = findDivisionKind(division.kind);
		return {
			...division,
			kindOptions: DIVISION_KINDS,
			passiveOutcome: kind?.passive ?? "",
			activeOutcomes: kind?.active ?? [],
			pillars: pillars
				.filter((pillar) => pillar.divisionId === division.id)
				.map((pillar) => ({ ...pillar, grip: pillar.grip ?? 0 }))
		};
	});
}
```

  `kindOptions` is attached **per division** rather than once at the top of `data` specifically so the
  template needs no `{{../…}}` to reach it — see the scoping note in §4. The `grip ?? 0` default
  mirrors [cause-actor-sheet.js:28](../scripts/world-actors/cause-actor-sheet.js#L28) so the counter
  never renders blank. No `felled` default — `{{#if felled}}` handles `undefined`.
- `activateListeners` and `_onStabilityStep` bodies are **unchanged**. GRIP, Felled, and the kind
  select all ride inherited handlers. No `_entryDefaults()` override — Pillars have no add control, so
  it would be unreachable code under the 100% coverage gate.
- Rewrite the class doc-block: three Divisions of three Pillars, the kind→outcomes catalog, why the FK
  layout, and point at `docs/domains/world-actors.md` instead of `claude.md`.

### 3. `scripts/actor-creation.js` — `WORLD_ACTOR_KINDS` authority entry ([:140-160](../scripts/actor-creation.js#L140-L160))

Divisions must be built first so their ids are available to the Pillars. `kind` seeds `""` (unset) —
the GM picks it; seeding a real kind would be a rules decision the sheet has no business making.

```js
buildSystem: () => {
	const divisions = [
		blankEntry({ strength: 5, disfavor: 0, kind: "" }),
		blankEntry({ strength: 4, disfavor: 0, kind: "" }),
		blankEntry({ strength: 4, disfavor: 0, kind: "" })
	];
	return {
		attributes: {
			stability: { value: STABILITY_MAX },
			divisions,
			pillars: divisions.flatMap((division) => Array.from(
				{ length: PILLARS_PER_DIVISION },
				() => blankEntry({ divisionId: division.id, grip: 0, felled: false })
			)),
			assets: [],
			notableActors: []
		}
	};
}
```

Reuses the existing `blankEntry()` helper at [actor-creation.js:120](../scripts/actor-creation.js#L120)
unchanged. Update the comment above the entry to describe the new shape.

### 4. Template — split into `templates/authority-sheet/*.hbs`

`templates/authority-actor-sheet.hbs` becomes a thin root: `<form>`, the existing inline
`<header class="sheet-header">`, then four `{{>}}` calls. Header stays inline (7 lines, not worth a
partial). **Five** partials total — `pillars.hbs` is peeled out of `divisions.hbs` because a Division
card now carries a kind select, two counters, a description, a passive outcome, an active-outcome list
*and* three Pillar cards.

| Partial | Content |
|---|---|
| `stability.hbs` | The `.stability-track` `<ol>` — unchanged markup, now renders 9 pips |
| `divisions.hbs` | `{{#each divisions}}` division card: name, **kind select**, Strength/Disfavor counters, description, **passive outcome**, **active outcome list**, then `{{> …/pillars.hbs}}` |
| `pillars.hbs` | `{{#each pillars}}` pillar card: name, GRIP counter, Felled checkbox, description |
| `assets.hbs` | Existing Assets section, verbatim |
| `notable-actors.hbs` | Existing Actors section, verbatim |

**Kind select** — reuses Foundry's core `{{selectOptions}}` helper exactly as
[npc-actor-sheet.hbs:16](../templates/npc-actor-sheet.hbs#L16) already does:

```hbs
<select class="entry-list-field division-kind" data-list="divisions"
        data-entry-id="{{id}}" data-field="kind">
  {{selectOptions kindOptions selected=kind valueAttr="key" labelAttr="label" blank="— Choose —"}}
</select>
```

Zero new JS: `_onEntryFieldChange` is bound on `change` for `.entry-list-field`, and a `<select>`'s
`.type` is `"select-one"` (not `"checkbox"`), so it falls through to the `.value` branch at
[world-actor-sheet.js:53](../scripts/world-actors/world-actor-sheet.js#L53). No custom Handlebars
helper is needed and none is registered anywhere in this module.

**Outcomes** — read-only reference prose, rendered with triple-stache because the catalog stores HTML
strings, matching every other rules-text render in the module (`move-chat.hbs`,
`playbook-move-picker.hbs`, etc.):

```hbs
{{#if passiveOutcome}}
<div class="division-passive-outcome">
  <h4>Passive Outcome</h4>
  {{{passiveOutcome}}}
</div>
{{/if}}
{{#if activeOutcomes.length}}
<div class="division-active-outcomes">
  <h4>Active Outcomes</h4>
  <ul>{{#each activeOutcomes}}<li>{{{this}}}</li>{{/each}}</ul>
</div>
{{/if}}
```

Each Pillar item in `pillars.hbs`:

```hbs
<li class="entry-list-item pillar-item{{#if felled}} pillar-felled{{/if}}" data-entry-id="{{id}}">
  <input type="text" class="entry-list-field pillar-name" data-list="pillars"
         data-entry-id="{{id}}" data-field="name" value="{{name}}" placeholder="Pillar name"/>
  <div class="entry-counter-row">
    <div class="entry-counter">
      <label>Grip</label>
      <button type="button" class="entry-list-counter-step" data-list="pillars" data-entry-id="{{id}}"
              data-field="grip" data-delta="-1" data-min="0" data-max="3" aria-label="Decrease Grip">-</button>
      <span class="trait-value">{{grip}}</span>
      <button type="button" class="entry-list-counter-step" data-list="pillars" data-entry-id="{{id}}"
              data-field="grip" data-delta="1" data-min="0" data-max="3" aria-label="Increase Grip">+</button>
    </div>
    <label class="pillar-flag-label">
      <input type="checkbox" class="entry-list-field" data-list="pillars" data-entry-id="{{id}}"
             data-field="felled" {{#if felled}}checked{{/if}}/>
      Felled
    </label>
  </div>
  <textarea class="entry-list-field pillar-description" data-list="pillars" data-entry-id="{{id}}"
            data-field="description" placeholder="What does the Authority hold here?">{{description}}</textarea>
</li>
```

**Scoping — this is the part CLAUDE.md's Handlebars rule is about.** No `{{../…}}` appears anywhere in
these partials, by construction:

- `{{#each divisions}}` opens and closes inside `divisions.hbs`.
- `{{> pillars.hbs}}` is called from *inside* `{{#each divisions}}`, so the partial's context is the
  division — and `{{#each pillars}}` then opens and closes inside `pillars.hbs`. No frame is split
  across the cut.
- `kindOptions` is attached to each division in `_divisionsData` rather than sitting at the top of
  `data` precisely so `{{selectOptions kindOptions …}}` needs no `../` hop out of the `{{#each}}`.

GRIP's `0–3` bound matches Faction Grip at
[cause-actor-sheet.hbs:31-36](../templates/cause-actor-sheet.hbs#L31-L36).

### 5. `scripts/main.js` + `tests/main.test.js`

Add `export const AUTHORITY_SHEET_PARTIALS = [ … 5 paths … ]` beside the existing
`PLAYBOOK_SHEET_PARTIALS` ([main.js:10-22](../scripts/main.js#L10-L22)) and change the single init call
to `loadTemplates([...PLAYBOOK_SHEET_PARTIALS, ...AUTHORITY_SHEET_PARTIALS])`. Update
[tests/main.test.js:27-28](../tests/main.test.js#L27-L28), which currently asserts
`toHaveBeenCalledWith(PLAYBOOK_SHEET_PARTIALS)` and `toHaveLength(11)`.

Partials **must** be preloaded or Foundry throws on first render — and `loadTemplates` is a stubbed
no-op in `tests/setup.js`, so a green suite proves only that it was *called*, never that the paths
resolve. Client verification is mandatory.

### 6. CSS split

`styles/world-actor-sheet.css` (219 lines) splits into **two** files, and `module.json`'s `styles[]`
is updated (`tokens.css` stays first — every later file references `var(--aa-*)`):

| New file | Contents |
|---|---|
| `styles/world-actor-shared.css` | `.world-actor` root + section margin, `.trait-control`/`.trait-value`, the grouped `.crew-step, .tier-step, .entry-list-counter-step` stepper, `.description textarea`, the whole `.entry-list*` family, `.entry-counter*`, the flag-label and dimming rules, `.entry-list-remove` |
| `styles/authority-sheet.css` | `.stability-track` / `.stability-step` / `.stability-value`, `.division-list`, `.division-kind`, `.division-passive-outcome`, `.division-active-outcomes`, `.pillar-list`, `.pillar-item` |

> **Deviation worth flagging:** the chosen option's preview showed four files (shared + one each for
> carrier/cause/authority). The actual content doesn't support that — **nothing** in this stylesheet
> is uniquely Carrier's (`.crew-step` lives in a grouped selector shared with the NPC Tier stepper and
> the generic entry counter; `.trait-control`/`.trait-value` are shared with Division counters), and
> Cause's only two rules are being generalized to serve Pillars too (below). Near-empty
> `carrier-sheet.css` / `cause-sheet.css` files would be worse than the honest 2-way split.

Rule changes inside the split:

- **Generalize the two Cause-only rules into grouped selectors**, the idiom already used for
  `.crew-step, .tier-step, .entry-list-counter-step` — `.faction-flag-label` gains
  `.pillar-flag-label`, and `.entry-list-item.faction-exhausted` gains `.entry-list-item.pillar-felled`
  (both are the same "label + checkbox pair" / "dim a deactivated entry" treatment). No rename, so
  `templates/cause-actor-sheet.hbs` is untouched.
- **Divisions stack; Pillars go 3-across inside each.** `.division-list` drops
  `grid-template-columns: repeat(3, 1fr)` for a single full-width column — a Division now carries a
  kind select, two outcome blocks and three Pillar cards, and cannot fit in a third of a 640px sheet.
  `.pillar-list` keeps `repeat(3, 1fr)` for the Pillars *inside* a Division card.
- **New outcome blocks** get a quiet resting surface — `--aa-secondary-tint` background, `--aa-border`,
  `--aa-radius`, tight prose margins so the catalog's `<p>`/`<ul>` don't blow the card open. `<h4>` is
  a new element for this stylesheet; check whether `sheet-chrome.css` already declares an `h4` before
  adding one. Style against `--aa-primary*`/`--aa-secondary*` only, never the gem names
  (`docs/domains/styling.md`).
- **Tighten the card selectors to direct children.** Today's
  `.pillar-list .entry-list-item, .division-list .entry-list-item` ([:104-112](../styles/world-actor-sheet.css#L104-L112))
  is a descendant selector — once Pillars nest inside Divisions it would apply the Division card
  treatment to Pillar items as well. Change both to `> .entry-list-item`.
- The striping exclusion at [:159](../styles/world-actor-sheet.css#L159) /
  [:163](../styles/world-actor-sheet.css#L163)
  (`.entry-list:not(.pillar-list):not(.division-list) > .entry-list-item`) stays correct as written —
  keep it verbatim, and keep its comment.
- **Repoint every stale comment**: `styles/playbook-actor-sheet.css` → the real files it became
  (`tokens.css` for the `--aa-*` tokens, `sheet-chrome.css` for the pip/remove-button treatments,
  `sheet-layout.css` for the track flex rules); `claude.md` → `docs/domains/world-actors.md`. Preserve
  the deliberate-duplication rationale (`world-actor-*.css` never reaches into the playbook
  stylesheets) — just point it at files that exist.

### 7. Docs

- **`docs/domains/world-actors.md:14`** — rewrite the Authority bullet: 3 Divisions × 3 Pillars,
  Stability 1–9 seeded 9 (still click-to-set with no decrement-on-reclick, floor 1), the flat
  `pillars` + `divisionId` layout and *why*, Pillar GRIP (0–3) / Felled riding the generic handlers,
  and the `DIVISION_KINDS` catalog: kind key on the actor, passive/active outcomes resolved fresh in
  `getData` and rendered read-only. Note the placeholder TODO state of the catalog. Also update `:10`,
  which lists "Authority's Assets/Actors/Pillars/Divisions".
- **`docs/domains/styling.md:6`** — destale the "all of this module's CSS lives in one file,
  `styles/playbook-actor-sheet.css`" claim: list the real files, record that `tokens.css` must stay
  first in `module.json`, and note the world-actor sheets' deliberate duplication policy.
- **`CLAUDE.md`** — the Handlebars-partials bullet names only `templates/playbook-sheet/`; add
  `templates/authority-sheet/` as the second instance of the pattern.

### 8. Tests

Follow the established scaffolding exactly: bare `new AuthorityActorSheet()`, `sheet.actor` assigned
as an object literal afterward, `update: vi.fn()` only where a write is asserted, hand-rolled
`{ currentTarget: { dataset: … } }` events, and `describe` order
`defaultOptions → getData → _divisionsData → activateListeners → _onStabilityStep → register…`.

- **New `tests/division-kinds.test.js`** — pure-module tests in the style of `tests/entry-list.test.js`:
  every catalog entry has `key`/`label`/`passive`/`active` with `active` a non-empty array, keys are
  unique, and `findDivisionKind` resolves a real key, returns `null` for an unknown key, and returns
  `null` for `""`.
- **`tests/authority-actor-sheet.test.js`** — retarget the track to 9 steps (`:16-27`) and
  clamp-above-max to 9 (`:110-117`); drop the `data.pillars` assertions (`:39-70`); add
  `_divisionsData` coverage:
  - pillars grouped onto the right Division by `divisionId`; a Division with no matching pillars gets
    `[]`; a pillar whose `divisionId` matches nothing appears nowhere
  - both branches of `grip ?? 0`
  - a valid `kind` resolves `passiveOutcome`/`activeOutcomes` from the catalog; an unknown or empty
    `kind` yields `""`/`[]` (covers both branches of `kind?.x ?? y`)
  - `kindOptions` is `DIVISION_KINDS` on every division
- **`tests/actor-creation.test.js:388-418`** — this asserts the *entire* `Actor.create` payload
  literally. Rewrite for 9 pillars, stability 9, and `kind: ""` per division. **Gotcha:** the file's
  `beforeEach` stubs `foundry.utils.randomID` to a constant `"test-id"`
  ([:27](../tests/actor-creation.test.js#L27)), which would make every Division id identical and render
  the `divisionId` pairing unverifiable. Override `randomID` with a counter-based
  `mockImplementation` **inside this one test** so the assertion actually proves each triple of Pillars
  points at its own Division.
- **`tests/main.test.js`** — the `loadTemplates` argument and the partials-length assertion.
- No new tests for GRIP / Felled / kind-select *behavior* — `tests/world-actor-sheet.test.js` already
  covers `_onEntryCounterStep` and both branches of `_onEntryFieldChange` generically, and the select
  uses the same `.value` path as a text input.

---

## Verification

1. `npx handlebars templates/authority-actor-sheet.hbs templates/authority-sheet/*.hbs -f /dev/null`
   — catches unbalanced `{{#each}}`/`{{#if}}` in the new partials. It does **not** evaluate against
   real data, so it cannot catch a bad context reference or a wrong `{{selectOptions}}` argument.
2. `git add -A && npx lint-staged` — ESLint on the changed `.js` (per `.husky/pre-commit`).
3. `npm run test:coverage` — must stay at the 100% lines/branches/functions/statements gate over
   `scripts/**/*.js`. If it reports uncovered lines, read those lines and fix them; do not blame the
   tooling.
4. **In a real Foundry v12 client** (mandatory — `renderTemplate`, `loadTemplates`, `.hbs` and `.css`
   are all invisible to the suite; a full reload is needed since `esmodules` don't hot-reload):
   - Create a new Authority from the sidebar's create-actor dialog. Confirm the sheet opens without a
     partial-not-found error, Stability shows **9** filled pips, and there are **3 Division cards each
     containing 3 Pillar cards**.
   - Click Stability pips: sets to the clicked value, floors at 1, no decrement-on-reclick.
   - On a Division: the kind `<select>` starts on the `— Choose —` blank. Pick a kind → the passive
     outcome and the active outcome list appear with the catalog's text; reopen the sheet and confirm
     the choice persisted and the outcomes still render. Switch back to blank → both blocks disappear
     (the `{{#if}}` guards).
   - Confirm the outcome prose renders as **HTML, not escaped tags** (the triple-stache), and that a
     long active list doesn't overflow the Division card.
   - On a Pillar: step GRIP up to 3 and down to 0 (clamped both ends), tick **Felled** and confirm the
     card dims, and edit name/description — then reopen the sheet to confirm all three persisted to
     the right Pillar.
   - Step a Division's Strength (0–5) and Disfavor (0–10) and confirm the Pillars and outcomes below
     it are unaffected.
   - Add/remove an Asset and an Actor — the freeform lists must still zebra-stripe and hover, while
     the Division and Pillar card grids must not.
   - Sanity-check the Carrier, Cause, and NPC sheets render unchanged after the CSS split.
