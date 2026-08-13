<!-- Domain conventions for src/packs/ and compendium packs, split out of claude.md — see claude.md for cross-cutting conventions. -->

# Compendium Packs

## Compendium packs (compiled, not committed)
Foundry compendium packs are LevelDB directories at runtime, not loose JSON — you can't point `module.json`'s `packs[].path` at a folder of raw JSON files and expect it to load. The convention (matching the sibling Masks module) is:
- Keep human-readable source under `src/packs/<pack-name>/*.json` (one file per document), committed to git.
- Compile it with `@foundryvtt/foundryvtt-cli` into a real LevelDB pack under `packs/<pack-name>/` via `npm run pullJSONtoLDB` (uses `compilePack`). This output is gitignored — it's a build artifact, regenerate it, don't hand-edit it.
- `npm run pushLDBtoJSON` does the reverse (`extractPack`), for pulling edits made in the Foundry UI back into source JSON.
- Only after compiling does `module.json`'s `packs` array entry actually resolve to something Foundry can load.
