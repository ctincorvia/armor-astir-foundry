<!-- Domain conventions for Foundry version compatibility, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Compatibility

This module targets Foundry VTT **v12, v13, and v14** from a single codebase, staying on the legacy
AppV1 application API on purpose. `module.json` currently declares
`"compatibility": {"minimum": "12", "verified": "12"}` — `verified` stays at `12` until a human runs
live QA against real v13/v14 clients; bumping it is not part of this doc's own change (see "Not
migrated" below for what else stayed out of scope).

## Strategy: stay on AppV1, fix only genuine breakage

AppV1 is frozen and identical across v12/v13/v14 — Foundry's own removal target is **v16**. pbta
itself, the system this module depends on, is still AppV1 on its own v14-verified release
(`PbtaActorSheet extends foundry.appv1.sheets.ActorSheet`) — the strongest possible confirmation that
staying on AppV1 for a three-major-version target is not a workaround, it's the system's own
approach too. ApplicationV2 changed materially between v12 and v13 (declarative `static TABS`
arrived in v13; v12 only has partial tab support), which would make an AppV2 migration *less*
portable across this exact version range, not more. A full AppV2 rewrite is deferred to a future
release that drops v12 — see "Deferred: AppV2" below.

Given that, the only things that actually needed to change to keep working on v13/v14 are the small
set of Foundry APIs that were renamed or moved out from under bare globals:

| Breakage | Where |
|---|---|
| `renderTemplate`/`loadTemplates`/`readTextFromFile`/`saveDataToFile` moved to `foundry.applications.handlebars.*`/`foundry.utils.*` | ~23 call sites across `scripts/` |
| `renderChatMessage` hook renamed to `renderChatMessageHTML`, and its `html` argument changed from jQuery to a bare `HTMLElement` | `scripts/moves/move-chat-listeners.js` |
| `renderActorDirectory`'s `.create-entry` button dispatch became delegated (pbta's v14 sidebar is a genuine AppV2 class), so `.off("click")` can no longer detach the old listener | `scripts/actor-creation.js` |
| AppV1 itself logs a deprecation warning on v13+ unless a sheet opts out | 4 base sheet classes |

Everything else — the ~550 jQuery call sites inside every sheet's own `activateListeners(html)`,
`Actors.registerSheet`, `new Dialog(...)` — is unaffected, because AppV1 itself still passes jQuery
to `activateListeners` on every version, and both of those bare globals still resolve and function
on v13/v14 (they only log a deprecation warning; see "Not migrated" below).

### The v15 deadline

The namespaced-global fallback this module now relies on (`foundry.applications.handlebars.*`/
`foundry.utils.*` with a bare-global fallback for v12) is **not** on the same removal timeline as
AppV1 itself. Foundry's own deprecation warnings for the bare `renderTemplate`/`loadTemplates`/
`readTextFromFile`/`saveDataToFile` globals say the backwards-compatible fallback is removed in
**v15** — three major versions sooner than AppV1's own v16 target. That makes `scripts/compat.js`
(below) the urgent half of this work; a future AppV2 migration has more runway.

## `scripts/compat.js`

A zero-import leaf module (like `scripts/module-id.js`) at `scripts/` root, so every domain folder
can import it without creating an upward dependency. It resolves seven names:

- `renderTemplate`, `loadTemplates` — namespaced under `foundry.applications.handlebars.*` on v13+,
  bare globals on v12.
- `readTextFromFile`, `saveDataToFile` — namespaced under `foundry.utils.*` on v13+, bare globals on
  v12.
- `generation()` — reads `game.release.generation`, defaulting to `12` if it isn't populated yet.
- `chatRenderHook()` — `"renderChatMessageHTML"` at generation 13+, `"renderChatMessage"` at 12.
- `toJQuery(target)` — wraps a bare `HTMLElement` with `globalThis.jQuery` if present, otherwise
  passes it through unchanged; a no-op for anything that's already jQuery-shaped (v12's own AppV1
  hooks, or a test's plain-object fake).

Every export is a **named function**, not a namespace object, and every existing call expression
stays byte-identical — the only change at each call site is an added import line. That import
locally shadows whatever global of the same name `eslint.config.js` used to declare, which is what
makes a missed call site fail `no-undef` once that global is removed from the `scripts/**/*.js`
block (see "ESLint enforcement" below) rather than silently working on v12 and breaking on v15.

**Resolution has to be lazy — inside each function body, never at module scope.** An eager top-level
`foundry.applications.handlebars.renderTemplate` reference would throw at import time on v12, where
`foundry.applications` doesn't exist yet, aborting this module's entire `esmodules` import chain —
not just the one feature being added. This has happened once before in this codebase (see
claude.md's "Reference environment" section) from a base-class reference copied out of an
ahead-of-release checkout; the shim's whole design exists to make that class of mistake structurally
impossible for every future call site that goes through it.

## pbta version pairing

Every pbta release sets a hard core `maximum`, so no single pbta version spans v12 through v14 —
the running core version determines which pbta release is even installable:

| pbta release | core `minimum` | core `verified` | core `maximum` |
|---|---|---|---|
| 1.1.15.2 | 12 | 12 | **12** |
| 1.1.16 – 1.1.22 | 13 | 13 | **13** |
| 1.1.23 | 13 | 14 | **14** |
| 1.2.0 | 14 | 14 | **14** |

The practical QA matrix this implies is **v12 + pbta 1.1.15.2**, **v13 + pbta 1.1.23** (the only
release that covers both v13 and v14, so it's the one to install for a v13 pass), and **v14 + pbta
1.1.23 or 1.2.0**.

A real, unrelated Foundry behavior worth knowing before any live QA session: v13+ deactivates any
module whose own `verified` doesn't match the running core version. Since this module's `verified`
stays at `12` until QA passes, **the module must be enabled by hand in Module Management** on a
v13/v14 world before testing anything else — a tester who skips this gets a clean-looking pbta world
and will misread it as this module being broken.

## Not migrated in this pass

Two Foundry APIs this module uses as bare globals were deliberately left alone, because pbta's own
source — running live on v13/v14 — proves they still function there without a shim:

- **`Actors.registerSheet(...)`** (5 call sites) — pbta's own commit that switched its equivalent
  call to the namespaced `foundry.documents.collections.Actors.registerSheet(...)` is titled "Remove
  deprecation warnings," not "fix a break." It's cosmetic console noise, not a functional problem.
- **`new Dialog(...)`** (18 call sites) — pbta 1.2.0 itself still constructs bare `Dialog`/
  `Dialog.wait` on v14 (`sheet-config.js`, `dice/rolls.js`, `documents/item.js`). Migrating this
  module's own Dialog call sites to a namespaced or `DialogV2` equivalent would be the largest test
  blast radius in the codebase (`Dialog.mock.calls` is asserted throughout `tests/`) for a warning
  the system this module depends on hasn't bothered to fix either.

Both are candidates for a future cosmetic pass, but neither blocks v13/v14 support, so both stayed
out of scope here.

## Deferred: AppV2

Not started, and not implied by anything above — recorded so the decision isn't relitigated. Since
pbta itself has not migrated (it's still AppV1 on its v14-verified release), there's no pressure
from the system side to move first. When Foundry's v16 AppV1 removal approaches, a future major
version of this module that **drops v12 support** should move to
`HandlebarsApplicationMixin(ActorSheetV2)` plus `DialogV2`. The real wins would be part-scoped
re-rendering (removing the `scrollY` save/restore workaround in `playbook-actor-sheet.js`) and
collapsing the long `html.find(...).on(...)` chains in every sheet's `activateListeners` into
declarative `data-action` handlers. The real costs: a full CSS rewrite (thousands of lines keyed to
AppV1 chrome), a comparable amount of test churn (`getData` → `_prepareContext`,
`activateListeners` → `_onRender`), and at least three picker families (`astir-pickers.js`,
`equipment/starting-gear.js`, `equipment/equipment-dialogs.js`) that depend on `Dialog`'s
`render(html)` callback, which `DialogV2` has no equivalent for — those would need redesigning as
real AppV2 applications, not a mechanical rename.

## Testing

`tests/compat.test.js` covers every branch of `scripts/compat.js` directly through its public
exports (`lookup`/`api` are internal and not exported, so there's nothing to test but the observable
behavior). Each test stubs its own shape for `foundry`/`game`/`jQuery` via `vi.stubGlobal` and
restores the shared stubs afterward with `vi.unstubAllGlobals()` in `afterEach`, rather than relying
on `tests/setup.js`'s shared stubs — this file's whole job is exercising shapes `tests/setup.js`
deliberately doesn't provide (a `foundry.applications` namespace) alongside the ones it does.

`tests/setup.js`'s own `foundry` stub deliberately has no `applications` key, which pins every other
test file's use of the bare-global `renderTemplate`/`loadTemplates`/`readTextFromFile`/
`saveDataToFile` stubs to the fallback branch of the shim — see the comment at that stub's
definition. Adding a `foundry.applications` key there later would silently flip which branch the
rest of the suite's ~236 `renderTemplate` assertions exercise.

## ESLint enforcement

`eslint.config.js` splits what used to be one repo-wide Foundry-globals block into two:
`files: ["scripts/**/*.js"]` no longer declares `renderTemplate`/`loadTemplates`/
`readTextFromFile`/`saveDataToFile` as globals at all, so a call site that bypasses the shim and
references one of these as a bare global fails `no-undef` at lint time. `files: ["tests/**/*.js"]`
keeps the full v12 global list, including those four, since tests legitimately assert against the
bare-global stubs `tests/setup.js` installs. See claude.md's "Recurring conventions" for the
one-line summary of this rule.
