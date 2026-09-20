<!-- Domain conventions for the Cosmetic tab (Look/Consider/Backstory/Notes), split out of claude.md — see claude.md for cross-cutting conventions. -->

# Cosmetic tab

Four rich-text fields on the Playbook sheet's last tab, and nothing else — no mechanics, nothing
derived, nothing any roll or catalog reads.

| Field | Stored at | Seeded from the playbook? |
|---|---|---|
| Look | `system.details.look.value` | yes |
| Consider | `system.details.consider.value` | yes |
| Backstory | `system.details.biography.value` | no |
| Notes | `system.details.notes.value` | no |

All four render through Foundry's `{{editor}}` helper with `engine="prosemirror"`,
`button=true`, `collaborate=false` — see
[tab-cosmetic.hbs](../../templates/playbook-sheet/tab-cosmetic.hbs). Backstory and Notes are plain
editors bound straight at the document; the interesting half of this domain is entirely about Look
and Consider.

## The flavor catalog

[`playbook-flavor.js`](../../scripts/playbook/playbook-flavor.js) holds `PLAYBOOK_FLAVOR`: the
chargen prompts from the book, keyed by **`system.playbook.slug`** — the same convention
`gravity-triggers.js` and `approaches.js` use, *not* `PLAYBOOKS[].name` (which is what `MOVE_POOLS`
keys on).

Each entry has up to three arrays:

```js
"the-commander": {
    look:    [{ label: "You look:", text: "scarred, formal, …" }, …],
    intro:   ["…framing paragraph…", "…"],   // optional
    consider: ["Does your custom Ardent have a name?", …]
}
```

All 16 playbooks have `look` and `consider`. `intro` — framing paragraphs rendered as `<p>`s ahead
of the question list — is present on 11 of them (absent for The Scout, Diplomat, Paradigm, Witch and
Wither), and a playbook without one produces unchanged output.

Three resolvers, each with a missing-entry fallback rather than a throw:

- `flavorForPlaybook(slug)` → the entry or `null`.
- `defaultLookText(slug)` → `<ul><li><strong>label</strong> text</li>…</ul>`, or `""`.
- `defaultConsiderText(slug)` → the `intro` paragraphs (if any) followed by `<ul>` of questions, or
  `""`.

They return **HTML strings**, because that is what gets written into a ProseMirror field.

All 16 playbooks have an entry, so the empty-string fallback isn't reached via the playbook picker —
but it still is for a `character` actor created some other way, whose `system.playbook.slug` is
`undefined`. `_seedCosmeticDefaults` then writes nothing at all (it only writes a non-empty default),
which is the correct outcome.

This is **unrelated to `scripts/reflavor/`**, despite the similar name. Reflavor is a GM-uploaded,
world-scoped override of catalog display text; `playbook-flavor.js` is fixed chargen prompt text
that gets copied onto an actor once. Reflavor does not touch it. See [reflavor.md](reflavor.md).

## Why the defaults are written to the actor, not just displayed

This is the one genuinely non-obvious thing in the domain, and it's a workaround for how Foundry's
`{{editor}}` helper actually behaves.

`getData` computes a display fallback:

```js
data.lookText = this.actor.system.details?.look?.value || defaultLookText(playbookSlug);
```

That alone is **not enough**. The `{{editor}}` helper uses `getData`'s value only for the read-only
preview shown before the player clicks to edit. The moment they do click, AppV1's
`FormApplication#_activateEditor` re-reads `system.details.look.value` straight off the real actor
document (`client/apps/form.js`), bypassing whatever `getData` computed. A player who clicked into
an unseeded Look field would find it empty.

So `_seedCosmeticDefaults()` runs from `activateListeners` and actually writes the prompt text onto
the actor the first time its sheet renders with nothing stored. After that the editor's own save
takes over and it never fires again for that field.

Three details in it are load-bearing:

- **Checked against `undefined`, not falsiness.** A player who deliberately clears a field to `""`
  must not have the prompt text resurrected on the next render.
- **Gated on `this.actor.isOwner`.** A GM or observer opening someone else's sheet must never
  attempt a write they may not have permission for.
- **One batched `actor.update`,** and only when there is something to write — an empty `updates`
  object is skipped entirely, so the common case (a character with both fields already stored) costs
  no write at all.

`getData`'s `lookText`/`considerText` remain as the display fallback for the brief window before
that write resolves. Both halves are needed; neither is redundant.

### This is scheduled to be deleted

`_seedCosmeticDefaults` exists **only** because `_activateEditor` bypassed `getData`. The AppV2
migration replaces the `{{editor}}` helper with a `<prose-mirror name="…" value="…" toggled>`
custom element, and if that element takes its `value` from the render context, the whole
write-on-render hack goes away — leaving just the `getData` fallback. See
[pending-plans/appv2-migration-v14-floor.md](../../pending-plans/appv2-migration-v14-floor.md),
Phase 6.

**Confirm before removing it**: dropping the write is a real behaviour change for a player who
deliberately cleared a field, because the `undefined`-vs-`""` distinction above only survives as long
as *something* writes the initial value.

## Styling

Two rules in `styles/sheet-tabs.css`: `.cosmetic` is a simple flex column, and
`.cosmetic-field .editor-content` reverts Foundry's core ProseMirror positioning.

That second one is worth not re-breaking. Core absolutely-positions the active editor's
`.editor-content` to fill `.editor-container` (`inset: 0`), which leaves the browser's native resize
handle nothing to act on. Setting `position: static` (plus `height: unset`, `min-height`, and
`resize: vertical`) lets all four fields be dragged taller like a textarea — whether the field is
being actively edited or just showing its read-only preview. It's a per-property override, so core's
own margin/padding/outline for that selector still apply.

## What's testable and what isn't

`playbook-flavor.js` is pure string-building and is fully covered by
[tests/playbook-flavor.test.js](../../tests/playbook-flavor.test.js); `_seedCosmeticDefaults`'s
branching is covered in [tests/playbook-actor-sheet.test.js](../../tests/playbook-actor-sheet.test.js).

The rendering is not. `renderTemplate` is stubbed globally in `tests/setup.js`, so nothing in the
suite exercises the `{{editor}}` helper, ProseMirror activation, or the CSS above — a green run says
nothing about whether the tab looks right. Anything touching `tab-cosmetic.hbs` or those CSS rules
has to be eyeballed in a real Foundry client after a full reload.

## See also

- [reflavor.md](reflavor.md) — the unrelated GM-facing text-override system
- [packs.md](packs.md) — why a playbook pack seeds `system.details.callsign` but not `look`/`consider`
