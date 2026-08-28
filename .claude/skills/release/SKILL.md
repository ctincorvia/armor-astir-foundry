---
name: release
description: Release a new version of the armor-astir-foundry module (e.g. "bump the patch version and release", "cut a new release", "release to Foundry") — bumps module.json's version, commits, tags and pushes it to trigger the GitHub Actions release build, waits for the release assets to publish, then submits that release to Foundry's package listing via tools/foundry_release.py.
---

# Release a new version

This module ships through a fixed chain: `module.json`'s `version` field is the single source of
truth → a `vX.Y.Z` git tag pushed on the commit that set it triggers `.github/workflows/release.yml`
→ that workflow builds `module.zip` and publishes a GitHub release with `module.json`/`module.zip` as
assets → `tools/foundry_release.py` reads that GitHub release and submits it to Foundry's package
listing. Each link only works once the previous one has actually finished — the workflow hard-fails if
the tag's version doesn't match `module.json`, and `foundry_release.py` hard-fails if the release it
finds doesn't have a `module.json` asset attached yet. Skipping ahead produces a failure, not a
silent no-op, but there's no reason to hit it: follow the order below.

## 0. Determine the version bump

Default to a patch bump unless the user says otherwise. Read the current version from `module.json`'s
`"version"` field (root of the repo) — `package.json`'s version is intentionally unsynced (nothing in
the release workflow or `foundry_release.py` reads it) and should not be touched.

## 1. Bump `module.json`

Edit only the `"version"` line. No other file hardcodes the version (confirmed by grepping the repo
for the current version string) — there is no changelog file to update either; `module.json`'s
`"changelog"` field points at the GitHub Releases page itself, and `release.yml` sets
`generate_release_notes: true` so release notes are auto-generated from commits.

## 2. Commit, tag, push

- `git add module.json`, commit (e.g. "Bump version to X.Y.Z"). This will run the project's normal
  pre-commit hooks (lint-staged, `npm run test:coverage`) — let them run and fix anything they flag
  before proceeding, same as any other commit.
- `git tag vX.Y.Z` on that commit — the `v` prefix is required, `release.yml` triggers on `push: tags:
  v*` and strips it to compare against `module.json`.
- **Confirm with the user before pushing** — pushing the tag is what triggers the release build and is
  a shared-remote, hard-to-fully-reverse action. Then `git push origin main` (or whatever branch) and
  `git push origin vX.Y.Z`.

## 3. Wait for `release.yml` and verify assets

Find the run the tag push triggered (`gh run list --workflow=release.yml -L 3` — it'll show the new
tag as the run's branch/ref) and watch it: `gh run watch <run-id> --exit-status`. Once it succeeds,
confirm the release actually has both assets before moving on:
`gh release view vX.Y.Z --json tagName,assets,isDraft,isPrerelease` — look for `module.json` and
`module.zip` both present with `"state":"uploaded"`. Do not proceed to step 4 without this — running
`foundry_release.py` before the workflow finishes will hard-fail (no `module.json` asset yet, or a
version mismatch if it's still reading the previous release).

## 4. Publish to Foundry via `tools/foundry_release.py`

Ask the user for their Foundry package API token at this point — never invent, store, echo, or log it
beyond the single command it's passed to. Per `CLAUDE.md`'s scripts-toolbox convention:

1. Run `py tools/foundry_release.py --token <token> --dry-run` first and show the full output
   (it prints the payload it would submit: id/version/manifest/notes/compat, then Foundry's HTTP
   response). Confirm `HTTP 200` and `"status": "success"`.
2. Only after the dry run succeeds and the user explicitly confirms, run
   `py tools/foundry_release.py --token <token> --yes` for the real submission — `--yes` skips the
   script's own interactive confirm prompt, which is redundant once confirmation was already given in
   chat (and awkward to answer through a non-interactive tool call anyway).

`foundry_release.py` finds "the latest GitHub release" via an unauthenticated call to
`GET /repos/{owner}/{repo}/releases/latest`, so it depends on step 3's release already being public —
it does not use `gh` or need any GitHub auth itself.

## Notes

- Don't commit, tag, or push without the user's explicit go-ahead at each of those steps — this
  mirrors every other mutating-action rule in `CLAUDE.md`, not something special to releases.
- If `gh run watch` reports a failure, read the failing step's log before assuming anything about the
  release chain — the same "assume the code is wrong before assuming the tool is wrong" rule from
  `CLAUDE.md` applies to a broken release build as much as to a local test failure.
