# Linking a dev checkout into Foundry's Data/modules on Windows

To test a working checkout without repackaging on every change, you'd naturally symlink/junction the repo into `Data/modules/<module-id>`. **This does not work if the top-level module folder itself is the link.**

Windows/Node quirk: `fs.readdir(dir, { withFileTypes: true })` reports a junction or symlinked directory as `isSymbolicLink: true` / `isDirectory: false`, even though `fs.stat` (which follows it) correctly resolves it as a directory. Foundry's package scanner enumerates `Data/modules/*` and — like most scanners — filters on `isDirectory()` from that raw listing. A linked top-level module folder is silently skipped: no error, no warning, it just never appears in *Manage Modules*.

The fix is to invert which level gets linked:

1. Make `Data/modules/<module-id>` a **real** directory (not a reparse point).
2. Copy the small, rarely-changing manifest files into it directly: `module.json`, `LICENSE`, `README.md`. Re-copy after editing these in the repo.
3. Inside that real directory, create junctions for the frequently-changing subfolders only — e.g. `scripts/` and `packs/` — pointing at the repo's copies. Nested paths are reached via direct file access (`readFile`/`stat`), which follows reparse points fine; it's only the top-level scan that's affected.

This gives live-reloading dev iteration for code and compiled packs, while still satisfying Foundry's directory scan.

**Gotcha: a new compendium pack "missing" after adding a playbook.** Adding a playbook (see the `add-playbook` skill) edits the repo's `module.json` to register a new pack entry, then compiles it with `npm run pullJSONtoLDB`. The compiled pack lands under `packs/`, which is junctioned — so it's visible to Foundry immediately. But `module.json` itself is one of the plain-copied manifest files from step 2 above, so if it isn't re-copied into `Data/modules/armor-astir`, Foundry is still reading the *old* manifest and has no idea the new pack exists. There's no error at compile time or even at world load — the only symptom is Foundry reporting the new playbook missing from the compendium when a player tries to add it. Fix: re-copy `module.json` into `Data/modules/armor-astir`, then fully reload the Foundry client (manifest changes aren't hot-reloaded).

## Hot reload through junctions

Foundry does not hot-reload `esmodules` at all — a script change always needs a full client reload. It *does* hot-reload `css`, `hbs`/`html` and `json`, but that is driven by a server-side file watcher pushing a socket event, and whether that watcher fires through the `Data/modules/armor-astir` junctions is unverified. Treat a full reload as the reliable fallback whenever an edit doesn't appear.
