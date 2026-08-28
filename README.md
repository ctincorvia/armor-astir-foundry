# armor-astir-foundry

A [Foundry VTT](https://foundryvtt.com/) module implementing character sheets and mechanics for [**Armor Astir: Advent**](https://royalrabbit.itch.io/armour-astir), a PBTA TRPG. Built on top of the [pbta](https://github.com/asacolips-projects/pbta) system (v1.1.15+, Foundry v12).

> **Disclaimer:** This module has been published with explicit permission from Briar Soverign,  Armor Astir's system author, but it is an unofficial, fan-made module.
>
> This module's code was developed with AI assistance. Its written content — moves, playbook text, and other rules copy — was not AI-generated; it's transcribed from the official Armor Astir: Advent rulebook.

## What it does

- **Playbook actors** — dragging any of the sixteen basic playbooks (Adrift, Advocate, Arcanist, Artificer, Attendant, Commander, Diplomat, Icon, Impostor, Paradigm, Revenant, Scout, Summoner, The Captain, Witch, Wither) out of a compendium produces a ready-to-play character actor directly, complete with basic moves, playbook move picking, starting equipment, and Astir/Ardent pilotable frames.
- **200+ automated moves** — Basic Moves, Special Moves, every playbook's move pool (plus the universal Cantrips and Soldier Moves pools), and the Astir Moves catalog all run through one shared roll pipeline: tier-based 2d6 with Advantage/Disadvantage and Confidence/Desperation Effect sliders, automatic 10+/7-9/6-/12+ result branching, hold/spend economies, guided rerolls, and automatic-success/downgrade offers that can retroactively flip an already-posted roll — including cross-actor spends like the Icon's Bardic Inspiration.
- **Astirs & Ardents** — mecha-style pilotable frames. An Astir carries a Power pool, Overheating, a unique Astir Move, and up to two installed Parts drawn from dedicated Parts/weapon catalogs; Ardents are cheaper secondary frames a character can stockpile freely, with only one frame mountable at a time.
- **Equipment** — a snapshot-on-pick catalog with a tag system (Blitz, Defensive, Drain, Impact, Approach tags, and more) that can be spent from the roll dialog to shift Effect, plus a points budget for homebrew gear.
- **Clocks & Gravity Clocks** — freeform narrative clocks on every character sheet, plus a distinct Gravity Clock mechanic tied to each playbook's Gravity Trigger that can substitute for a move's normal trait.
- **Downtime Scene Reference** — the seven Downtime Scene Kinds available as an in-sheet lookup dialog or postable directly to the chat log for the whole table to see.
- **World actors** — custom Actor sub-types for the Carrier (the party's mobile base, with its own built-in weapon slots), the Authority (the empire, with Stability, Divisions, and Pillars), the Cause (the opposing factions, tracked by Grip), and a lightweight NPC actor, each with its own sheet.
- **Reflavor** — GMs can upload a JSON file that reskins move, equipment, tag, and Astir text across the whole module for a different genre or setting, without touching any underlying mechanics.
- **Custom actor creation flow** for these module-defined actor types.
- Backed by a 100%-branch-coverage test suite enforced on every commit.

## Development

```sh
npm install       # install dependencies
npm test          # run the test suite
npm run test:coverage   # run tests with coverage (100% required)
npm run lint      # lint
```

Compendium packs are authored as human-readable JSON under `src/packs/`, then compiled to LevelDB with:

```sh
npm run pullJSONtoLDB   # compile src/packs/*.json -> packs/ (gitignored build output)
npm run pushLDBtoJSON   # pull edits made in the Foundry UI back into src/packs/
```

A pre-commit hook (via Husky) runs `lint-staged` and the test suite.

## Installing

**From Foundry's Install Module dialog:** paste this manifest URL:

```
https://github.com/ctincorvia/armor-astir-foundry/releases/latest/download/module.json
```

**For local dev:** place (or link) this repository into your Foundry `Data/modules/armor-astir` directory — the folder name must match the module's `id`. See [claude.md](claude.md) for notes on setting up a live-reloading dev link on Windows.

## Releasing

Releases are built by [.github/workflows/release.yml](.github/workflows/release.yml), triggered by pushing a tag:

1. Bump `version` in `module.json` and commit.
2. Tag the commit `vX.Y.Z` (matching `module.json`'s version) and push the tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. CI lints, tests, compiles the compendium packs, zips the distributable files, and publishes a GitHub Release with `module.json` and `module.zip` attached — which is what the manifest/download URLs above always resolve to the latest of.
