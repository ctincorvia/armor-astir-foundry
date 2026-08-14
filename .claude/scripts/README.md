# Claude's dev-scripts toolbox

Reusable scripts for Claude Code to reach for instead of hand-crafting a one-off script (or
fighting the Edit tool's exact-whitespace-match requirement) every time the same class of problem
comes up. Invoke everything here with `py` (not `python`/`python3` — see the project's Python
alias notes), since that's the interpreter that actually resolves on this machine.

## What's here

- **`replace_lines.py`** — replace (or insert into) a line range in a file by line number instead
  of by exact-text match. Reach for this instead of `Edit` when a multi-line change keeps failing
  because of tabs/spaces or other whitespace that's hard to reproduce exactly by hand. Run with
  `--help` or `-h`, or read its own docstring, for full usage.

## Convention

When a scripting need recurs (not a true one-off), add a script here rather than writing a fresh
throwaway each time — future sessions on this project should be able to check this directory first.
Keep each script self-documented (docstring/`--help`) rather than relying on this README to explain
usage in detail; update this file's listing when adding or removing one.
