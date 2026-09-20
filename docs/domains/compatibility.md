<!-- Domain conventions for cross-version support (scripts/compat.js), split out of claude.md — see claude.md for cross-cutting conventions. -->

# Compatibility

This module runs on Foundry **v12, v13 and v14** from one codebase:

```json
"compatibility": { "minimum": "12", "verified": "14" }
```

Every Application in it is still legacy **AppV1** (`ActorSheet`, `FormApplication`, `Dialog`). That
is a deliberate, recorded decision — see "What was deliberately not migrated" below — with a planned
end date, since Foundry removes AppV1 in **v16**.

## The pbta pairing problem

The module's `relationships.systems` entry declares a pbta floor of `1.1.15`, but that is only a
floor. The real constraint is that **every pbta release pins a hard core `maximum`**, so no single
pbta version spans the v12–v14 range this module targets:

| pbta | core `minimum` | `verified` | `maximum` |
|---|---|---|---|
| 1.1.15.2 | 12 | 12 | 12 |
| 1.1.16 – 1.1.22 | 13 | 13 | 13 |
| 1.1.23 | 13 | 14 | 14 |
| 1.2.0 | 14 | 14 | 14 |

*(Verified from `src/yaml/system.yml` at each tag in the sibling pbta checkout. pbta's `system.json`
is generated at build time and isn't in the repo tree — read the YAML, not a tag's manifest.)*

The practical reading: a v12 world needs pbta 1.1.15.x, a v13 world needs 1.1.16–1.1.23, a v14 world
needs 1.1.23 or 1.2.0. **This is why the sibling `pbta` checkout is no longer pinned to a single
tag** — there is no one tag that represents "what this module targets". It's cloned on `main`, and
this table is what replaced a pin as the way to reason about which pbta corresponds to which core.

### Which source to trust

`main` on either sibling repo runs **ahead of what's installed** here. A base-class or namespace
reference copied from ahead-of-release source can throw at module-evaluation time — and because a
throwing ES module import aborts the *importing* module too, that takes down the entire `main.js`
chain, not just the feature being added. The symptom is every module feature silently doing nothing,
with no error pointing at the new code.

This has happened once already: a sheet was written as
`class X extends foundry.appv1.sheets.ActorSheet`, copied from pbta's `main`. The installed bundle
extends the **bare global** `ActorSheet` — `foundry.appv1` has zero occurrences in it.

So: verify every core/system base class against the **installed** bundle
(`Data/systems/pbta/module/pbta.js`) or Foundry's own unpacked client source
(`resources/app/client/…`), never the sibling dev repos. Grep both if unsure.

## `scripts/compat.js` — the shim

A leaf module with **zero imports** (like `module-id.js`), so every domain folder can import it
without creating an upward dependency.

Two rules make it work:

1. **Resolution is lazy, inside each function body.** An eager top-level
   `foundry.applications.handlebars.renderTemplate` reference would throw at import time on v12 —
   and per above, that aborts the whole esmodules chain.
2. **Namespaced-first, global-fallback.** `api(path, globalName)` returns
   `lookup(path) ?? globalThis[globalName]`, which silences v13+ deprecation warnings while still
   working on v12, where the namespaced path doesn't exist yet.

| Export | Wraps | Why |
|---|---|---|
| `renderTemplate` | `foundry.applications.handlebars.renderTemplate` | v13 namespaced it |
| `loadTemplates` | same namespace | v13 namespaced it |
| `readTextFromFile` | `foundry.utils.readTextFromFile` | v13 namespaced it |
| `saveDataToFile` | `foundry.utils.saveDataToFile` | v13 namespaced it |
| `getRoute` | `foundry.utils.getRoute` | v13 namespaced it |
| `createTextEditor` | `foundry.applications.ux.TextEditor` | see below |
| `serializeEditorContent` | `foundry.prosemirror` | see below |
| `generation()` | `game.release.generation` | defaults to `12` when absent |
| `chatRenderHook()` | — | `"renderChatMessageHTML"` on v13+, else `"renderChatMessage"` |
| `toJQuery()` | — | wraps the bare `HTMLElement` v13+ hands chat hooks |

`createTextEditor`/`serializeEditorContent` are shaped slightly differently from the rest, because
v13 moved the ProseMirror and text-editor APIs under `foundry.applications.ux` / `foundry.prosemirror`
while keeping the pre-v13 bare globals (`TextEditor`, `ProseMirror`) as **live, non-deprecated**
aliases — unlike `Dialog`/`Application`/`FormApplication`, which are deprecated. `TextEditor.implementation`
resolves to "the current editor engine" on v13+; on v12 the class has no such getter, so it falls
back to the class itself.

### ESLint enforces the import

`eslint.config.js`'s `scripts/**/*.js` block **deliberately omits** `renderTemplate`, `loadTemplates`,
`readTextFromFile` and `saveDataToFile` from its globals list. A missed call site therefore fails
`no-undef` at lint time rather than silently working on v12 and breaking once v15 drops the
bare-global fallback.

The `tests/**/*.js` block *does* declare all four (plus `TextEditor`/`ProseMirror`), because tests
legitimately reference the bare-global stubs `tests/setup.js` installs. **Don't "fix" that
asymmetry** — it's the whole mechanism.

## The other version branches

Only three places in `scripts/` branch on version at all beyond the shim:

**Chat hook registration** (`move-chat-listeners.js`). v13 renamed `renderChatMessage` to
`renderChatMessageHTML` and changed the second argument from jQuery to a bare `HTMLElement`.
`registerMoveChatListeners` registers **exactly one** hook name, never both — v13+ would double-bind
every button otherwise — and wraps the argument in `toJQuery()` so the rest of the module stays
jQuery-shaped. It's inside `Hooks.once("init")` because the function itself runs at import time,
before `game.release` is guaranteed to be populated.

**Create Actor interception** (`actor-creation.js`). v12's AppV1 sidebar binds `.create-entry`'s
click directly, so `.off("click")` can detach it. v13+'s AppV2 `ActorDirectory` dispatches through a
delegated `data-action` listener on the application root, which `.off()` can't reach. Three things
are needed together, and removing any one reintroduces a double dialog on v13+:

- `cloneNode(true)` + `replaceWith` — strips any v12-style direct listener,
- `addEventListener(…, { capture: true })` — beats the delegated ancestor dispatch,
- `stopImmediatePropagation()` in the handler — not `stopPropagation`, which can't defeat it.

The same file also normalizes the hook's second argument with
`html instanceof HTMLElement ? html : html?.[0]`.

**`static _warnedAppV1 = true`** on all four sheet classes (`PlaybookActorSheet`, `WorldActorSheet`,
`NpcActorSheet`, `ReflavorConfig`). Matches what pbta's own sheets do: it silences AppV1's v13+
deprecation warning with no behaviour change.

## What was deliberately not migrated

- **`Actors.registerSheet`** rather than `foundry.documents.collections.Actors.registerSheet` —
  still works across all three versions.
- **`Dialog`** rather than `DialogV2` — all 18 dialogs in the module are AppV1 `Dialog`s.
- **`ActorSheet`/`FormApplication`** rather than `ApplicationV2`.

All three are AppV1 surface that Foundry removes in **v16**. The migration is planned as one release
in [pending-plans/appv2-migration-v14-floor.md](../../pending-plans/appv2-migration-v14-floor.md),
which drops v12/v13 entirely (`minimum` and `verified` both `"14"`, one pbta version) and moves to
native `data-action` delegation. **That plan supersedes this section when it lands**, and rewriting
this file is an explicit item in its Phase 9.

## Packaging note

`docs` is in the release zip (`release.yml`'s `zip -r module.zip … packs docs`) because
`reflavor-help.js` fetches `modules/armor-astir/docs/custom-moves.md` at runtime through
`getRoute()`. A release built without it degrades to a message rather than throwing, but the help
panel is empty.

## See also

- claude.md, "Reference environment" — the sibling-checkout rules this file expands on
- [reflavor.md](reflavor.md) — the one consumer of `readTextFromFile`/`saveDataToFile`/`getRoute`
- [moves.md](moves.md) — move customization, whose rewrite-description dialog is the only consumer
  of `createTextEditor`/`serializeEditorContent` (the Cosmetic tab's editors go through Handlebars'
  `{{editor}}` helper instead, and don't touch the shim)
