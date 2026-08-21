# Migrate to ApplicationV2 and drop v12/v13 support

## Context

The v12/v13/v14 compatibility pass shipped: the module runs on all three, but every Application in it
is still legacy **AppV1** (`ActorSheet`, `FormApplication`, `Dialog`), which Foundry removes in **v16**.
That deadline is the reason for this work. It also unblocks the things AppV1 can't do: root-delegated
`data-action` handlers instead of 113 imperative `html.find(...).on(...)` lines, `PARTS`-based
rendering with built-in scroll preservation, and dropping jQuery entirely.

This supersedes the "Deferred: AppV2" section of
[docs/domains/compatibility.md](../docs/domains/compatibility.md), and corrects its cost estimate — see
"CSS is 44 lines, not 3,719" below.

Three decisions are locked (chosen by the user, not re-litigated below):

1. **v14 only.** `compatibility.minimum` and `verified` both `"14"`. One core version, one pbta version.
2. **Native `data-action` delegation**, not a listener table.
3. **Sheets *and* all 18 dialogs in the same release.**

There are no existing users, so nothing here needs a migration path for live worlds.

---

## What's verified vs. what needs a live spike

`/Users/charles.incorvia/code/pbta` on `main` is pbta **1.2.0** (`compatibility: min 14 / verified 14 /
max 14`). It contains a real, shipping AppV2 application and real `DialogV2` calls, so the following
are **confirmed against running v14 source**, not recalled:

- `foundry.applications.api.{ApplicationV2, HandlebarsApplicationMixin, DialogV2}`
  (`pbta/src/module/forms/sheet-config.js:3`)
- `static DEFAULT_OPTIONS = { id, classes, window: {...}, position: {...}, actions: {...}, tag: "form",
  form: { closeOnSubmit, handler } }` and `static PARTS = { body: { template, root } }` (`:15-40`)
- `async _prepareContext(options)` calling `await super._prepareContext(options)`; `_onRender(context,
  options)` with `this.element.querySelector(...)` (`:50`, `:71`)
- `DialogV2` with `content`, `window: { title }`, `position: { width }`,
  **`render: (event, dialog) => …`** where `dialog.element` is a real `HTMLElement`, and
  `callback: (event, button) => …` where **`button.form`** is the form
  (`pbta/src/module/documents/item.js:602-620`)
- `foundry.applications.ux.FormDataExtended` for harvesting form values (`item.js:618`)
- `foundry.applications.apps.DocumentSheetConfig` and the `foundry.applications.sheets.*` namespace
  (`pbta/src/module/pbta.js:82`)
- **pbta's own actor/item sheets are still AppV1** (`PbtaActorSheet extends foundry.appv1.sheets.ActorSheet`).
  This module's sheets extend core `ActorSheet` directly and import nothing from pbta, so pbta staying
  on AppV1 creates **no** coupling — confirmed by grep: zero pbta imports anywhere in `scripts/`.

**Phase 0 spikes cover what pbta's source cannot answer**, because pbta has no AppV2 *document* sheet
and no AppV2 rich-text editor. Do not write code against these until the spike confirms them:

| Unknown | Expected shape | Why it matters |
|---|---|---|
| `foundry.applications.sheets.ActorSheetV2` exists under that exact name | — | Base class for 6 of 7 classes |
| `static TABS` shape + the keys on `context.tabs` (`id`/`label`/`cssClass`/`group`/`active`) | declarative | Playbook sheet's 7 tabs |
| `_onFirstRender(context, options)` exists | AppV2 lifecycle | Where the delegated `change` listener attaches exactly once |
| `PARTS[x].scrollable` preserves scroll across re-render | `scrollable: [""]` | Replaces the `scrollY: [".window-content"]` hack |
| `DialogV2.wait` multi-button form: `buttons: [{action, label, callback}]`, `rejectClose: false` | array, not object | All 18 dialogs |
| AppV2 window chrome class names (`.application`? still `.window-app`?) and DialogV2's emitted DOM | — | Every CSS decision in Phase 8 |
| ProseMirror in an AppV2 sheet — `{{editor}}` won't self-activate without `FormApplication#_activateEditor` | `<prose-mirror name="…" value="…" toggled>` | 4 editors in [tab-cosmetic.hbs](../templates/playbook-sheet/tab-cosmetic.hbs); **highest-risk item** |

Spike: open a v14 world with pbta 1.2.0, check each name's existence in the console alongside
`CONFIG.Actor.sheetClasses`, then open core's own Actor sheet and read its DOM in devtools.

---

## Scale (measured, not estimated)

| Surface | Count |
|---|---|
| Application classes | 7 ([playbook-actor-sheet.js:38](../scripts/playbook/playbook-actor-sheet.js#L38), [world-actor-sheet.js:9](../scripts/world-actors/world-actor-sheet.js#L9) + 3 subclasses, [npc-actor-sheet.js:14](../scripts/world-actors/npc-actor-sheet.js#L14), [reflavor-config.js:23](../scripts/reflavor/reflavor-config.js#L23)) |
| `html.find(...).on(...)` chains in sheets | 133 (113 of them in `PlaybookActorSheet` alone — **82 `click`, 31 `change`**, all class selectors, 1:1 with a `_onX` handler) |
| `new Dialog(...)` | 18, **all** `new Promise(resolve => new Dialog({...}).render(true))` |
| `event.currentTarget` reads | 134 in `scripts/`, 623 in `tests/` |
| `renderTemplate` call sites | 21 (11 dialog content, 10 chat card) |
| Tests | 91 files / 40,039 lines / 2,734 `it()` under a **100% four-way coverage gate** |
| Test coupling | 374 `Dialog.mock.calls`, 274 `getData(`, 183 `expect(renderTemplate)`, 39 `activateListeners(`, 20 hand-rolled fake-jQuery builders |
| CSS | 3,741 lines — but only **~44 selector lines** touch AppV1 chrome |

### CSS is 44 lines, not 3,719

The deferred plan claimed **"a full CSS rewrite (3,719 lines keyed to AppV1 chrome)"**. That is wrong by
two orders of magnitude. Counting selector lines only (excluding the long explanatory comments that
inflate a naive `grep -c`), AppV1-chrome coupling is:

[sheet-chrome.css](../styles/sheet-chrome.css) 15 · [sheet-layout.css](../styles/sheet-layout.css) 12 ·
[dialogs.css](../styles/dialogs.css) 12 · [tokens.css](../styles/tokens.css) 4 ·
[authority-sheet.css](../styles/authority-sheet.css) 1 — **44 lines.**

Everything else is scoped under `.armor-astir` (from `DEFAULT_OPTIONS.classes`, which survives) or is
`.armor-astir-*`-prefixed chat-card CSS ([move-chat.css](../styles/move-chat.css), 403 lines, **zero**
exposure — chat messages aren't application windows). [sheet-tabs.css](../styles/sheet-tabs.css) (658
lines) has **zero** chrome-coupled selectors. `.sheet-header` / `.sheet-body` / `.sheet-tabs` are this
module's *own* markup in its own templates, so they only break if we restructure the templates — which
Phase 5 deliberately doesn't.

**Migrating the dialogs deletes CSS rather than adding it.**
[dialogs.css:577-641](../styles/dialogs.css#L577-L641) and
[:726-734](../styles/dialogs.css#L726-L734) are an explicit specificity war against pbta's
`.vtt .window-app .dialog-button` rules (documented in the comment at `:600`). DialogV2 emits no
`.window-app` and no `.dialog-button`, so pbta's navy theming stops matching and the whole fight — plus
`tokens.css`'s `.window-app.armor-astir` navy-gap fix from the v13 QA pass — becomes dead code to
delete, pending Phase 0's DOM confirmation.

---

## Phase 1 — Drop v12/v13

No behaviour change; ships green on its own.

- [module.json](../module.json): `"compatibility": { "minimum": "14", "verified": "14" }`, no `maximum`
  (v15 should load with a warning, not hard-block). Bump
  `relationships.systems[0].compatibility.minimum` to `"1.1.23"` (first pbta release that runs on v14).
  `version` → `2.0.0`.
- [compat.js](../scripts/compat.js): delete `generation()`, `chatRenderHook()`, `toJQuery()` and the
  `lookup`/`api` fallback machinery. The four remaining exports become direct namespaced calls
  (`foundry.applications.handlebars.renderTemplate(...)`, `foundry.utils.readTextFromFile(...)`).
  **Keep the module as the seam** — it's what makes the 183 `expect(renderTemplate)` assertions cheap.
- [move-chat-listeners.js:392](../scripts/moves/move-chat-listeners.js#L392): collapse to a plain
  `Hooks.on("renderChatMessageHTML", onRenderMoveChat)`. Its 90-line body currently takes jQuery via
  `toJQuery`; rewrite to the `HTMLElement` the hook actually passes (9 `html.find` chains).
- [actor-creation.js:247](../scripts/actor-creation.js#L247): drop the
  `html instanceof HTMLElement ? … : html?.[0]` dual path and the `cloneNode`/`replaceWith` v12
  workaround comment — v14 is always delegated.
- **[tests/setup.js](../tests/setup.js) trick that saves ~200 assertions:** create one `vi.fn()` per
  template/file-IO function and assign it to *both* `globalThis.renderTemplate` and
  `foundry.applications.handlebars.renderTemplate`. Every existing `expect(renderTemplate)` keeps
  working while `compat.js` reads only the namespace. Replaces the current "deliberately has no
  `applications` key" comment, which describes the opposite arrangement.
- [eslint.config.js](../eslint.config.js): drop `Application`, `FormApplication`, `ActorSheet`, `Dialog`
  from the `scripts/**/*.js` globals block. `no-undef` then catches any AppV1 straggler for the rest of
  the migration — the same enforcement trick already used for `renderTemplate`.

---

## Phase 2 — Shared AppV2 infrastructure

Two new near-leaf modules at `scripts/` root, alongside `compat.js` and `module-id.js` (cross-domain
bootstrapping, not owned by a domain folder). Both need their own test files at 100%.

### `scripts/sheet-actions.js`

The piece that makes `data-action` affordable. AppV2 invokes action handlers as
`handler.call(app, event, target)` with `event.currentTarget` pointing at the *application root*, not
the clicked element — which would break all 134 `event.currentTarget` reads in `scripts/` and every one
of the 623 test setups that pass `{ currentTarget: … }`. Normalizing once at the registration boundary
avoids all 757 edits:

```js
export function withCurrentTarget(event, target) {
	return new Proxy(event, {
		get(source, key) {
			if (key === "currentTarget") return target;
			const value = Reflect.get(source, key);
			return typeof value === "function" ? value.bind(source) : value;
		}
	});
}

// { traitStep: "_onTraitStep", … } -> DEFAULT_OPTIONS.actions
export function buildActions(map) {
	return Object.fromEntries(Object.entries(map).map(([action, method]) =>
		[action, function (event, target) { return this[method](withCurrentTarget(event, target)); }]
	));
}
```

Every `_onX(event)` handler and every test that calls one directly stays **byte-identical**.

`DEFAULT_OPTIONS.actions` only dispatches `click`, so the 31 `change` handlers need a parallel path:
`data-change-action="…"`, dispatched by one delegated listener. It must attach in **`_onFirstRender`**,
not `_onRender` — `this.element` persists across re-renders, so attaching in `_onRender` stacks a new
listener every time:

```js
export function wireChangeActions(app, map) {
	app.element.addEventListener("change", (event) => {
		const el = event.target.closest("[data-change-action]");
		if (!el || !app.element.contains(el)) return;
		const method = map[el.dataset.changeAction];
		if (method) app[method](withCurrentTarget(event, el));
	});
}
```

### `scripts/dialog.js`

One wrapper over `DialogV2.wait`, so the DialogV2 API is touched in exactly one place and the 18 call
sites keep this module's existing ergonomics (object-keyed buttons, a promise resolving to the chosen
value, `null` on close). It absorbs the `new Promise(resolve => …)` boilerplate all 18 sites currently
repeat — those wrappers disappear entirely.

```js
export async function showDialog({ title, content, buttons, render, classes, position }) { … }
```

Internally maps object-keyed buttons to DialogV2's `buttons: [{ action, label, callback }]` array, sets
`rejectClose: false`, and hands callbacks the dialog's root `HTMLElement` in place of today's jQuery
`html`. Paired with a `lastDialog()` helper in `tests/helpers/` that reads
`DialogV2.wait.mock.calls.at(-1)[0]` and re-normalizes buttons back to an object — so most of the 374
`Dialog.mock.calls.at(-1)[0].buttons.<key>.callback()` assertions keep their shape and only the accessor
changes. `DialogV2` gets stubbed once globally in `tests/setup.js`; no per-file `vi.mock` needed.

---

## Phase 3 — The five small sheets

Cheapest surface, proves Phase 2 end-to-end before touching the big one. 810 lines of source, 13
listener chains total, ~1,650 lines of tests.

Order: [NpcActorSheet](../scripts/world-actors/npc-actor-sheet.js) (2 chains, no tabs, `height: "auto"`)
→ [WorldActorSheet](../scripts/world-actors/world-actor-sheet.js) base (4 generic dataset-driven chains)
→ [Carrier](../scripts/world-actors/carrier-actor-sheet.js) (6) /
[Authority](../scripts/world-actors/authority-actor-sheet.js) (1) /
[Cause](../scripts/world-actors/cause-actor-sheet.js) (0).

Per class: `extends foundry.applications.sheets.ActorSheetV2` with `HandlebarsApplicationMixin`;
`defaultOptions` → `static DEFAULT_OPTIONS` (`classes` and `position: {width, height}` carry over
verbatim — keep the same `classes` arrays, they're what all the `.armor-astir`-scoped CSS hangs off);
`template` → `static PARTS = { body: { template: … } }`; `getData` → `_prepareContext`;
`activateListeners` → `actions` + `data-*` markup. Drop `static _warnedAppV1`.

`getData` bodies are pure functions of `this.actor` and stay unchanged — `_prepareContext` may return a
plain object, so the 274 synchronous `sheet.getData()` test calls become synchronous
`sheet._prepareContext()` calls with a `sed`, not an async rewrite.

`Actors.registerSheet` → `foundry.documents.collections.Actors.registerSheet` at all 5 sites.

---

## Phase 4 — `ReflavorConfig`

[reflavor-config.js](../scripts/reflavor/reflavor-config.js): `FormApplication` →
`HandlebarsApplicationMixin(ApplicationV2)` — the only non-document form, so it exercises that path in
isolation. `_updateObject()` (which ignores `formData` and reads `this._pendingOverrides`) becomes a
`DEFAULT_OPTIONS.form.handler`. Confirm `game.settings.registerMenu({ type: ReflavorConfig })` accepts an
AppV2 class — core's own settings menus are AppV2 on v14, so this should be free, but
[reflavor-settings.js:16-18](../scripts/reflavor/reflavor-settings.js#L16-L18)'s comment about
"FormApplication's own registerMenu plumbing" needs rewriting either way. Its `summary.html(…)` raw
string injection becomes `innerHTML`.

---

## Phase 5 — `PlaybookActorSheet`

The large one: [playbook-actor-sheet.js](../scripts/playbook/playbook-actor-sheet.js) (388 lines) + 15
prototype mixins in [playbook-sheet/](../scripts/playbook/playbook-sheet/) (4,183 lines) + 11 partials in
[templates/playbook-sheet/](../templates/playbook-sheet/).

- **`static PARTS = { body: { template: "…/playbook-actor-sheet.hbs" } }` — a single part**, keeping the
  existing shell markup verbatim. Per-tab parts are an explicit **non-goal** (see below): the current
  DOM nests `.sheet-main` → `.dangers-column` + `.sheet-tabs-column` → `.sheet-body`, and AppV2
  concatenates parts as flat siblings inside `.window-content`, so splitting would mean rebuilding
  `sheet-layout.css`'s 571 lines of flex/sticky layout — the highest-risk, least-testable change
  available, for a perf nicety. `scrollable: [""]` handles scroll preservation regardless, which is the
  actual reason `scrollY` existed.
- **`static TABS = { primary: { tabs: [7 entries], initial: "moves" } }`.** The existing markup already
  carries `data-group="primary"` / `data-tab="…"` on both nav links and tab bodies; the nav gains
  `data-action="tab"` and the bodies read their active class off `context.tabs`.
- **113 `data-action` / `data-change-action` attributes** across the 11 partials, added *alongside* the
  existing classes (the classes stay — the CSS uses them).
  [activateListeners' 113 lines](../scripts/playbook/playbook-actor-sheet.js#L247-L363) become an
  82-entry `actions` map plus a 31-entry change map, both fed through `buildActions`/`wireChangeActions`.
  The map belongs in its own `scripts/playbook/playbook-sheet/sheet-actions-map.js`, matching the
  one-file-per-concern convention the `playbook-sheet/` mixins already follow.
- `tag: "form"` + `form: { submitOnChange: true }` for the 13 genuinely named inputs (actor `name`,
  `system.details.callsign.value`, the approach `<select>`, the 4 editors). **Verify the 31
  change-handled controls have no `name` attribute** — a named one would fire submit-on-change *and*
  its own handler, double-updating.
- Delete the `scrollY` block and the `height: "auto"` avoidance comment at
  [:49-62](../scripts/playbook/playbook-actor-sheet.js#L49-L62); both describe AppV1
  `Application#setPosition` behaviour that no longer applies.

---

## Phase 6 — Cosmetic tab / ProseMirror

Gated on the Phase 0 spike. [tab-cosmetic.hbs](../templates/playbook-sheet/tab-cosmetic.hbs) has 4
`{{editor … engine="prosemirror"}}` calls. The helper renders markup, but *activation* was
`FormApplication#_activateEditor`, which AppV2 has no equivalent of — expected replacement is the
`<prose-mirror name="…" value="…" toggled>` custom element.

[`_seedCosmeticDefaults`](../scripts/playbook/playbook-actor-sheet.js#L232-L245) exists **only** because
`_activateEditor` re-read the document and bypassed `getData`'s `lookText`/`considerText`. If
`<prose-mirror>` takes its `value` from the render context instead, the whole write-on-render hack and
its 14-line comment can be deleted. Confirm before removing — it's a real behaviour change for a player
who deliberately cleared a field. See [docs/domains/cosmetic.md](../docs/domains/cosmetic.md).

---

## Phase 7 — 18 dialogs → `DialogV2`

Through `scripts/dialog.js`, in ascending difficulty so each step lands green:

1. **7 trivial** — hardcoded `<p>` content, no `render`, callbacks ignore `html`:
   [actor-creation.js:109](../scripts/actor-creation.js#L109) and
   [:207](../scripts/actor-creation.js#L207),
   [approaches.js:49](../scripts/core/approaches.js#L49),
   [ardent.js:244](../scripts/frames/ardent.js#L244),
   [carrier-actor-sheet.js:344](../scripts/world-actors/carrier-actor-sheet.js#L344),
   [summoner-mixin.js:24](../scripts/playbook/playbook-sheet/summoner-mixin.js#L24),
   [move-dialogs.js:519](../scripts/moves/move-dialogs.js#L519) (keep its module-level singleton
   close-the-previous behaviour).
2. **3 single-radio reads** — [playbook-moves.js:188](../scripts/moves/playbook-moves.js#L188),
   [astir-pickers.js:159](../scripts/frames/astir-pickers.js#L159),
   [move-dialogs.js:484](../scripts/moves/move-dialogs.js#L484).
   `html.find("[name='x']:checked").val()` → `new FormDataExtended(button.form).object.x`.
3. **3 tab-wired pickers** — [equipment-dialogs.js:39](../scripts/equipment/equipment-dialogs.js#L39),
   [astir-pickers.js:31](../scripts/frames/astir-pickers.js#L31) and
   [:79](../scripts/frames/astir-pickers.js#L79). Rewrite the shared `wirePickerTabs`
   ([equipment-helpers.js:100-108](../scripts/equipment/equipment-helpers.js#L100-L108)) in vanilla DOM
   once; all three inherit it. Their load-bearing comments about `data.render` vs `options.render`
   become obsolete.
4. **3 gate-validated pickers** — [starting-moves.js:268](../scripts/moves/starting-moves.js#L268),
   [witch.js:112](../scripts/playbook/witch.js#L112),
   [starting-gear.js:65](../scripts/equipment/starting-gear.js#L65). Same
   `invalidReason`/`updateSaveState` idiom in each; `.prop("disabled", …)`/`.toggleClass` →
   `button.disabled` / `classList.toggle`. Keep the authoritative re-check inside the callback —
   Enter-to-submit still bypasses `disabled`.
5. **`configureMoveRoll`** ([move-dialogs.js:186](../scripts/moves/move-dialogs.js#L186), ~131-line
   `render`) — weapon-panel switcher, `paintAdvantage`/`paintEffect` notched sliders,
   `repaintAvailability`'s per-row enable/disable, and the weapon-panel-scoped selector prefixes in its
   100-line callback.
6. **`configureEquipment`** ([equipment-dialogs.js:368](../scripts/equipment/equipment-dialogs.js#L368),
   ~174-line `render`) — the largest: 7 interdependent updaters, exclusive-group radio emulation, an
   override button that mutates closure state and re-enables locked fields, and the repo's most complex
   form read.

Tests: the 20 hand-rolled fake-jQuery builders
([move-test-helpers.js](../tests/helpers/move-test-helpers.js)'s `fakeRollHtml`,
`fakeEquipmentRenderHtml`, `fakeReflavorHtml`, …) get replaced by real DOM fixtures built from the actual
template output. **happy-dom is already the vitest environment and is currently unused by these tests**
— this raises fidelity rather than lowering it, and retires builders that throw on any selector they
weren't hand-taught.

jQuery has no remaining consumer after this phase; note that as an outcome in the docs.

---

## Phase 8 — CSS

Last, and iterated live — CSS hot-reloads in a running client while `esmodules` do not. See
[docs/domains/styling.md](../docs/domains/styling.md) for which file owns which concern.

- [tokens.css](../styles/tokens.css) — `.window-app.armor-astir` → AppV2's chrome class (Phase 0). The
  `--color-select-option-bg: white` override **stays** (still v14 core CSS). The navy-gap `background`
  fix likely becomes dead once pbta's `.window-app` rule stops matching — confirm, then delete.
- [dialogs.css](../styles/dialogs.css) — delete the `.vtt .window-app … .dialog-button` specificity war
  (`:577-641`, `:726-734`) and retarget at DialogV2's footer buttons.
- [sheet-layout.css:556-572](../styles/sheet-layout.css#L556-L572) — the `--paddingY` zeroing that makes
  sticky `.sheet-tabs` work is keyed to AppV1's `.window-content` padding variable; re-derive against
  AppV2's.
- [sheet-chrome.css](../styles/sheet-chrome.css) (15) and
  [authority-sheet.css](../styles/authority-sheet.css) (1) — mostly this module's own `.sheet-header`
  markup, expected to survive; verify only.

Per project convention this is **not verifiable by any tooling in the repo**. Grep every class the
changed markup introduces against `styles/*.css`, and state plainly in the completion report that
styling was not visually confirmed unless it was checked in a live client.

---

## Phase 9 — Docs and manifest

- Rewrite [docs/domains/compatibility.md](../docs/domains/compatibility.md): it currently documents the
  v12-fallback shim, the pbta version-pairing table, and the "not migrated" decision record for
  `Actors.registerSheet` / `Dialog` — all obsolete. Replace with the AppV2 contract, the
  `sheet-actions.js` / `dialog.js` seams, and the `data-action` convention.
- [CLAUDE.md](../CLAUDE.md): the "Recurring conventions" bullet forbidding bare template globals needs
  extending to the AppV1 globals now removed from ESLint; the `masks-newgeneration-*` "AppV1 pattern
  reference" note in "Reference environment" should say those repos are no longer the pattern to copy.
- Document the action-map convention, so adding a control means adding a `data-action` plus one map
  entry rather than a `find().on()` line.

---

## Verification

Every phase gates on `git add` → `npx lint-staged` → `npm run test:coverage` at 100%. **The suite cannot
catch any of the actual migration risk** — `renderTemplate`/`loadTemplates` are stubbed, `.hbs` and
`.css` are invisible to vitest, and no tooling here can render a sheet. Live QA on **v14 + pbta 1.2.0**
is the real gate.

**After each sheet phase:** world loads with a clean console (a module-eval throw kills the whole
`esmodules` chain); the sheet opens; every control on it fires exactly once; scroll position survives an
in-sheet update (a hold stepper); the sheet is resizable and doesn't fight its own resize handle.

**After Phase 5 specifically:** all 7 tabs switch and remember state; the sticky Dangers column and tab
nav still stick; renaming the actor and changing the approach `<select>` persist (the `submitOnChange`
path); no control double-updates.

**After Phase 7:** open all 12 distinct dialogs. Verify the interactive ones specifically — picker tab
switching, the disabled-until-valid gate *and* its Enter-to-submit re-check, the equipment editor's
override button re-enabling locked fields, and the move-roll dialog's notched sliders and
weapon-panel-scoped modifier rows.

**End to end:** `npm run pullJSONtoLDB`, install fresh into a clean v14 world, import The Scout, confirm
the sheet opens with stats intact and a move roll posts a styled chat card with working buttons.

---

## Risks

- **R1 — ProseMirror (Phase 6).** The one place with no reference implementation available: pbta is
  still AppV1 so its `{{editor}}` usage doesn't transfer, and there's no local Foundry client source on
  this machine to read. If `<prose-mirror>` doesn't behave as expected, the Cosmetic tab needs a bespoke
  solution. Spike it first; it's the item most likely to change the plan.
- **R2 — sheet registration.** `PlaybookActorSheet` wins the `character` type over pbta's own
  `makeDefault: true` sheet purely by load order (system esmodules load before module esmodules).
  Registering an AppV2 class where pbta registered an AppV1 one shouldn't change that, but if it ever
  loses, add an explicit `unregisterSheet` in the same `init`.
- **R3 — double-firing.** The two genuinely new failure modes: a `change` listener attached in
  `_onRender` instead of `_onFirstRender` (stacks per render), and a named input that both submits on
  change and runs its own handler. Both are silent in tests and obvious in a live client.
- **R4 — coverage gate vs. delegated code.** `buildActions`/`wireChangeActions` wrap handlers in closures
  the existing tests never invoke, so the 100% gate will flag them. They need their own direct tests in
  Phase 2 — write those before wiring anything up, not after.
- **R5 — AppV2 API drift.** v14 is current and v15 is next; AppV2 is still evolving in a way AppV1
  wasn't. Setting no `maximum` means v15 loads with a warning rather than hard-blocking, which is the
  right default, but expect a compatibility pass per major version from here on.

## Explicit non-goals

- **Per-tab `PARTS`** for the playbook sheet — deferred, with the layout reason given in Phase 5. Once
  the AppV2 chrome is confirmed working, tabs can be split off one at a time; `data-action` delegation is
  chosen partly so that later split needs no handler changes.
- **v13 support.** Locked to v14 only; nothing in this plan should carry a version branch.
- Fixing the pre-existing latent bug where four mixins write literal `null` as an attribute value
  ([astir-mixin.js:208](../scripts/playbook/playbook-sheet/astir-mixin.js#L208),
  [summoner-mixin.js:186](../scripts/playbook/playbook-sheet/summoner-mixin.js#L186),
  [frames-mixin.js:242](../scripts/playbook/playbook-sheet/frames-mixin.js#L242) and
  [:338](../scripts/playbook/playbook-sheet/frames-mixin.js#L338)), which would throw in pbta's
  `prepareDerivedData`. It reproduces identically on v12 — not a migration regression. Expect it during
  QA; don't fix it here.
