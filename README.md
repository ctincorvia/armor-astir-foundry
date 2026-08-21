# armor-astir-foundry

A [Foundry VTT](https://foundryvtt.com/) module implementing character sheets and mechanics for [**Armor Astir: Advent**](https://royalrabbit.itch.io/armour-astir), a PBTA TRPG. Built on top of the [pbta](https://github.com/asacolips-projects/pbta) system (v1.1.15+, Foundry v12).

> **Disclaimer:** This is an unofficial, fan-made module. It is not developed, endorsed, or supported by Briar Sovereign, Armor Astir's system author.
>
> This module's code was developed with AI assistance. Its written content — moves, playbook text, and other rules copy — was not AI-generated; it's transcribed from the official Armor Astir: Advent rulebook.

## What it does

- **Playbook actors** — dragging a playbook out of a compendium produces a ready-to-play character actor directly (rather than an Item applied to a blank actor, as in baseline PBTA), complete with basic moves, playbook move picking, equipment, and Astir/Ardent pilotable frames.
- **World actors** — custom Actor sub-types for the Carrier (the party's mobile base), the Authority (the empire), and the Cause (the opposing factions), each with their own sheet.
- **Astirs & Ardents** — mecha-style pilotable frames with parts, weapons, Power tracking, and move integration.
- **Custom actor creation flow** that bypasses pbta's own dialog to support these module-defined actor types.
- Starting compendium packs for all sixteen basic playbooks.

See [claude.md](claude.md) for detailed implementation notes and conventions used throughout the codebase.

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
