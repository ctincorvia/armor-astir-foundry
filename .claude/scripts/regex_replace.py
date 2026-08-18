#!/usr/bin/env python3
"""Apply one or more regex substitutions across one or more files, safely.

This exists because a raw `perl -pi`/`sed -i` substitution is easy to get wrong in two specific,
silent ways once a file's replacement text spans a line break:

1. Mixed line endings: hand-written replacement text that hardcodes a bare "\\n" gets inserted
   into a file whose real line endings are "\\r\\n" (or vice versa) -- everything captured via a
   backreference faithfully preserves the original EOL, but literal newlines in the replacement
   string don't, so the file ends up with a silent mix of both. `git add`/`file` will warn about
   this, but only after the fact.
2. A pattern that itself hardcodes the wrong EOL (e.g. "\\n" against a "\\r\\n" file) simply never
   matches -- no error, no corruption, just a silent no-op that's easy to mistake for "already
   applied" or "nothing to do here".

This script sidesteps both classes by normalizing the file's content to "\\n" before matching or
substituting anything -- so every pattern and replacement you write only ever needs to use plain
"\\n", regardless of the file's actual convention -- and re-expanding to the file's *real*, detected
EOL exactly once, at the very end, right before writing.

It also fails loudly (by default) if a pattern matches zero times, instead of silently no-op'ing --
the second failure mode above.

Usage:
    py regex_replace.py <file>... [--dry-run] [--allow-no-match]

Substitution spec(s) are read from stdin as a JSON array:
    [{"pattern": "...", "replacement": "...", "flags": "s", "count": 0}, ...]

- "pattern"/"replacement" are plain Python `re` syntax (see `re.sub`) -- write literal newlines in
  either as "\\n"; never "\\r\\n", regardless of the target file's real line endings.
- "flags" (optional) is a string of single-letter re flags to OR in: "s" = DOTALL (. matches
  newlines too), "i" = IGNORECASE, "x" = VERBOSE. re.MULTILINE is always on. Omit for none.
- "count" (optional) caps replacements per file for that spec; 0 (default) = replace all.
- Specs apply in order, each against the previous spec's output, across every file given.
- Every (file, spec) pair must match at least once, or the run aborts with nothing written
  (all-or-nothing across all given files) -- pass --allow-no-match to permit a spec to miss a
  particular file (e.g. when batching several files that don't all contain the same anchor).

Preserves each file's own existing newline style and trailing-newline presence independently.
Reads/writes UTF-8.

Examples:
    # Insert two new default-valued keys after an existing pair, across several call sites in one
    # file, regardless of whether each call site wraps that pair onto one line or several
    # (PowerShell-friendly heredoc)
    py .claude/scripts/regex_replace.py tests/some.test.js <<'EOF'
    [
      {
        "pattern": "astirPartSpends: \\[\\], equipmentSpends: (\\[[^\\n]*?\\])",
        "replacement": "astirPartSpends: [], equipmentSpends: \\1, rollModifiers: [], rollStack: null"
      }
    ]
    EOF

    # Same substitution across several files in one call
    py .claude/scripts/regex_replace.py tests/a.test.js tests/b.test.js < subs.json

    # Preview only
    py .claude/scripts/regex_replace.py tests/some.test.js --dry-run < subs.json
"""
import argparse
import difflib
import json
import re
import sys

FLAG_MAP = {"s": re.DOTALL, "i": re.IGNORECASE, "x": re.VERBOSE}


def compile_pattern(spec):
    flags = re.MULTILINE
    for ch in spec.get("flags", ""):
        if ch not in FLAG_MAP:
            sys.exit(f"error: unknown flag '{ch}' in spec {spec!r} (valid: {', '.join(FLAG_MAP)})")
        flags |= FLAG_MAP[ch]
    return re.compile(spec["pattern"], flags)


def apply_specs(text, specs, filename, allow_no_match):
    for i, spec in enumerate(specs, start=1):
        pattern = compile_pattern(spec)
        count = spec.get("count", 0)
        text, n = pattern.subn(spec["replacement"], text, count=count)
        if n == 0 and not allow_no_match:
            sys.exit(f"error: spec {i} ({spec['pattern']!r}) matched nothing in {filename} "
                      "-- aborting with nothing written. Pass --allow-no-match if a miss is expected.")
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+")
    parser.add_argument("--dry-run", action="store_true", help="print a unified diff instead of writing")
    parser.add_argument("--allow-no-match", action="store_true",
                         help="don't abort when a spec matches zero times in a given file")
    args = parser.parse_args()

    try:
        specs = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        sys.exit(f"error: stdin is not valid JSON: {e}")
    if not isinstance(specs, list) or not specs:
        sys.exit("error: stdin must be a non-empty JSON array of substitution specs")
    for spec in specs:
        if "pattern" not in spec or "replacement" not in spec:
            sys.exit(f"error: spec missing 'pattern' or 'replacement': {spec!r}")

    results = []
    for filename in args.files:
        with open(filename, "rb") as f:
            raw = f.read()
        newline = "\r\n" if b"\r\n" in raw else "\n"
        original_text = raw.decode("utf-8")
        had_trailing_newline = original_text.endswith(("\n", "\r\n")) if original_text else True

        normalized = original_text.replace("\r\n", "\n")
        substituted = apply_specs(normalized, specs, filename, args.allow_no_match)
        substituted = substituted.rstrip("\n")
        if had_trailing_newline:
            substituted += "\n"

        result = substituted.replace("\n", newline)
        results.append((filename, original_text, result))

    if args.dry_run:
        for filename, original_text, result in results:
            diff = difflib.unified_diff(
                original_text.splitlines(keepends=True),
                result.splitlines(keepends=True),
                fromfile=filename,
                tofile=f"{filename} (proposed)"
            )
            sys.stdout.writelines(diff)
        return

    for filename, original_text, result in results:
        if result == original_text:
            print(f"{filename}: no change")
            continue
        with open(filename, "w", encoding="utf-8", newline="") as f:
            f.write(result)
        print(f"{filename}: updated")


if __name__ == "__main__":
    main()
