<!-- Domain conventions for src/packs/ and compendium packs, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Compendium packs

Sixteen packs, one per playbook, each holding exactly one Actor document. That's the whole content
library — no Item packs, no macro packs, no journal packs.

## Two directories, and which one is the source

| | `src/packs/` | `packs/` |
|---|---|---|
| Format | one JSON file per document | Foundry's LevelDB |
| Tracked in git | **yes** | no (`.gitignore`: `packs/*`) |
| Edited by hand | yes | never |
| Loaded by Foundry | no | yes |
| Written by Foundry | no | **yes** (see below) |

`src/packs/` is the source of truth. `packs/` is build output that Foundry then also *mutates* —
which is the one genuinely surprising fact in this domain.

### The two build scripts, whose names read backwards

```
npm run pullJSONtoLDB    # compilePack:  src/packs/  ->  packs/     (source -> runtime)
npm run pushLDBtoJSON    # extractPack:  packs/      ->  src/packs/ (runtime -> source)
```

The names describe the direction from the LevelDB's point of view, which is the opposite of how you
usually think about a build. **`pullJSONtoLDB` is the one you want** after editing a source JSON —
it's what the release workflow runs, and what the add-playbook flow requires.

`pushLDBtoJSON` is the round-trip, used to pull Foundry's own migrations back into source.
**It deletes every file in each `src/packs/<pack>/` directory before re-extracting**, so it's a
wholesale rewrite, not a merge. When only one field needs updating, prefer a targeted `extractPack`
and hand-copy — see "Migration write-back" below.

Both scripts iterate the directory listing and skip a `.gitattributes` entry if one is present.

File names come from `pushLDBtoJSON`'s `transformName`: `<prefix>_<safeName>_<_id>.json`, where the
prefix is `doc.type` for actors and items (hence `character_The_Scout_hT3kQ9mZ2pRnW6vL.json`) and
the collection name otherwise, with every non-alphanumeric character in the name replaced by `_`.
Hand-authoring a new file means matching that convention yourself, or the next round-trip renames it.

**Foundry must be closed before either script runs.** A running server holds the compendium
LevelDBs open, and `compilePack` can't write a locked pack — it fails with a raw
`LEVEL_ITERATOR_NOT_OPEN` / `ModuleError` stack trace that never mentions locking, so it reads like
a Node/toolchain version problem rather than "close Foundry".

### Migration write-back — `packs/` is not purely build output

On world launch Foundry migrates every compendium pack it loads, **including a module's own**, and
persists the migrated records back into `packs/` (log lines: `Migrated Actor record …` then
`Persisting migrated Actor record …`).

Two consequences:

- An extracted pack can legitimately contain a far richer document than the `src/packs/` JSON it was
  compiled from. That is not a stale or failed compile.
- **It's the supported lever for fixing schema-validation warnings.** Launch the world once, stop the
  server, extract, copy the corrected field(s) into source, recompile, relaunch to confirm.

The worked example: on core v14 all 16 packs logged
`prototypeToken: SchemaField#_validateRecursive / depth: must be a number`. The named field was a
red herring — the real problem was that the whole `prototypeToken` was **sparse** (5 keys, authored
under v12), and v14 validates it against the full `PrototypeToken` schema and reports the first
field that fails. Replacing it with the 25-key object Foundry itself produced during migration
cleared all 16. Every source doc now carries that full `prototypeToken`; don't trim it back down.

When patching a source file by hand, **patch the raw text, not a re-serialized document.** Rewriting
with `JSON.stringify(doc, null, "\t")` reformats the hand-authored compact `system` block (e.g.
`"defy": { "value": 0 }` explodes to three lines), turning a three-line change into a whole-file
diff. Replace only the balanced `{…}` span for the key being fixed, re-indented to the file's tabs,
and leave every other byte alone. **These files are LF; keep them LF.**

## A playbook is an Actor, not an Item

This is the module's most significant divergence from the baseline PBTA system. In stock `pbta`, a
playbook is an Item of type `playbook` applied to a blank character actor. Here, dragging a playbook
out of a compendium produces a **ready-to-play `character` Actor** directly.

Each pack entry in [module.json](../../module.json) therefore declares `"type": "Actor"`:

```json
{
    "name": "basic-playbook-scout",
    "label": "Basic Playbook - The Scout",
    "path": "packs/basic-playbook-scout",
    "type": "Actor",
    "system": "pbta",
    "ownership": { "PLAYER": "OBSERVER", "ASSISTANT": "OWNER" }
}
```

`path` points at the compiled LevelDB directory, not at `src/`. Players get OBSERVER (they can see
and drag out a playbook but not edit the master copy); assistant GMs get OWNER.

### Document shape

```
name          "The Scout"                      # also how PLAYBOOKS looks the document up
type          "character"
img           icons/svg/mystery-man.svg
items         []                               # every playbook ships with zero embedded items
effects       []
system.playbook      { name, slug, uuid: "" }  # slug is the key everything else joins on
system.stats         six TRAITS, plus any playbook-specific extra
system.attributes    { approach }
system.details       { callsign: { label: "Callsign", value: "" } }
prototypeToken       full 25-key object, actorLink: true
_id / _key / sort / ownership / _stats         # LevelDB bookkeeping, round-tripped as-is
```

`system.details.callsign` is the module's own addition on top of pbta's `CharacterData` schema, so a
player can record a callsign alongside the actor's native name and image.

Notes on the seeded values, all verified against the 16 source files:

- **CHANNEL.** Non-channeling playbooks store `channel: { value: 0, disabled: true }`; channelers
  store a real starting value (Paradigm/Revenant/Wither 3, Advocate/Arcanist/Witch 2, Impostor 1).
  **The Summoner is deliberately `{ value: 0 }` with no `disabled` flag** — a channeler starting at
  +0, not a non-channeler. Don't "correct" it to `disabled: true`; that would strip the playbook's
  access to CHANNEL entirely, and with it the Astir.
- **Extra stats.** The Revenant is the only pack with a seventh stat, `familiarity` (seeded at 3),
  which its *I Know You* move reads via `fixedTraits` and `_familiarityValue()`.
- **Approach.** Every pack seeds `system.attributes.approach` to a value inside that playbook's
  `PLAYBOOK_APPROACHES` allowlist. It's a starting default, not a lock — the player can switch to
  any other allowed Approach from the sheet.

Everything else a character accumulates — moves, equipment, Astir, clocks, advancement — is created
on the actor at play time, not seeded here.

### Nothing is read out of a pack except by name

`actor-creation.js` holds the only pack reads in the module:

```js
export const PLAYBOOKS = [{ packId: "armor-astir.basic-playbook-scout", name: "The Scout" }, …];
```

`getPlaybookSourceData` resolves `game.packs.get(packId)`, calls `getIndex()`, finds the entry
**by `name`**, `getDocument`s it, and `toObject()`s it with `_id` deleted so `Actor.create` assigns a
fresh one. Two separate `ui.notifications.error` calls cover a missing pack and a missing document —
the document `name` in `PLAYBOOKS` must match the JSON's `name` exactly or creation fails with the
second one.

`swapActorPlaybook` re-targets an existing character at a different playbook, replacing
`system.playbook`/`stats`/`attributes` and every embedded Item, while preserving the actor's own
name, image and callsign. Two carve-outs out of the attributes wipe, both rules-driven:

- **Equipment always survives** — a character's gear is theirs, not the playbook's (unlike
  `playbookMoves`, which is meant to reset, since Bite the Dust's own text says a new playbook
  doesn't come with new equipment).
- **The Astir survives only if the new playbook still grants CHANNEL** — otherwise it's dropped along
  with any `astir: true` equipment entries it owns, so nothing orphaned lingers. The Adrift counts as
  Channel-enabled here despite `channel.disabled`, because Love, Love, Love substitutes +HOME for
  CHANNEL entirely (`playbookGrantsHomeInsteadOfChannel`).

## Releasing

[.github/workflows/release.yml](../../.github/workflows/release.yml) runs on a `v*` tag:
lint → `test:coverage` → verify `module.json`'s version matches the tag → `npm run pullJSONtoLDB` →
zip `module.json LICENSE README.md scripts styles templates packs docs` into `module.zip`.

So `packs/` is never in git but is always in the release artifact, compiled fresh from `src/packs/`
at release time. A source JSON edited without recompiling locally still ships correctly; a
*compiled* pack edited without updating source is silently discarded.

## Adding a playbook

There's a skill for the whole flow: [`.claude/skills/add-playbook/SKILL.md`](../../.claude/skills/add-playbook/SKILL.md).
The pack-specific parts of its checklist:

1. `src/packs/basic-playbook-<slug>/character_<Name>_<fresh-id>.json` — copy the most recent prior
   playbook's document structure exactly, with a **fresh** random 8-character alphanumeric id. Never
   reuse another playbook's `_id`, and remember `_key` embeds it too (`!actors!<id>`).
2. A `module.json` pack entry mirrored off the existing blocks.
3. A `PLAYBOOKS` entry in `actor-creation.js` whose `name` matches the document's.
4. `npm run pullJSONtoLDB` — **not skippable**; without it the pack doesn't exist at runtime.

On the local Windows dev setup there's a fifth step: **re-copy `module.json` into
`Data/modules/armor-astir`**. `packs/` there is a junction, so a recompile shows up immediately, but
`module.json` is a plain copy — a new pack entry never reaches Foundry until that copy is refreshed.
There is no error at compile or reload time; the symptom shows up later as the new playbook simply
being missing from the compendium list. (`py tools/run_foundry_headless.py` automates the whole sync
including this.)

## What isn't covered by tests

Nothing in `tests/` reads `src/packs/`. Pack JSON is validated only by Foundry at load time, so a
malformed document, a duplicate `_id`, or a `PLAYBOOKS` `name` that doesn't match its document all
sail past a fully green `npm run test:coverage`. `tests/actor-creation.test.js` covers the *logic*
around packs (the choose/create/swap flows, with `game.packs` stubbed), never their contents.

## See also

- [world-actors.md](world-actors.md) — the non-playbook actor kinds, which are built from a literal
  rather than a pack
- [cosmetic.md](cosmetic.md) — why `look`/`consider` are seeded on first render instead of in the pack
- [moves.md](moves.md) — `MOVE_POOLS`, keyed by `PLAYBOOKS[].name` rather than by slug
