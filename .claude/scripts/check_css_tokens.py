#!/usr/bin/env python3
"""Verify every var(--aa-*) referenced in styles/ is actually declared in styles/tokens.css.

Why this exists
---------------
Nothing in this repo's tooling looks at CSS. ESLint only runs on .js, lint-staged's glob is
`*.{js,cjs,mjs}`, and `renderTemplate`/`loadTemplates` are stubbed in tests/setup.js -- so a
mistyped custom property (`var(--aa-suface)`) is completely silent. CSS custom properties fail
*invalid at computed-value time*: the declaration doesn't error and doesn't even show struck
through in devtools, it just computes to the property's initial value. A misspelled background
token renders transparent, a misspelled color token renders black, and both look like a layout
bug rather than a typo.

This is the cheapest possible guard against that, and the only self-verification available for
`styles/` without a running Foundry client.

Usage
-----
    py .claude/scripts/check_css_tokens.py            # check styles/ (default)
    py .claude/scripts/check_css_tokens.py <dir|file>...
    py .claude/scripts/check_css_tokens.py --list     # also print the declared-token inventory

Exits 1 if any referenced token is never declared, or if a declared token is never referenced
(the latter is reported as a warning only, since a token can legitimately be declared ahead of
the rule that will use it).
"""

import argparse
import re
import sys
from pathlib import Path

DECL_RE = re.compile(r"^\s*(--aa-[a-z0-9-]+)\s*:", re.MULTILINE)
USE_RE = re.compile(r"var\(\s*(--aa-[a-z0-9-]+)")
COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def css_files(targets):
    for target in targets:
        path = Path(target)
        if path.is_dir():
            yield from sorted(path.glob("*.css"))
        elif path.is_file():
            yield path
        else:
            sys.exit(f"error: no such file or directory: {target}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("targets", nargs="*", default=["styles"], help="CSS files or directories (default: styles)")
    parser.add_argument("--list", action="store_true", help="print the declared-token inventory")
    args = parser.parse_args()

    files = list(css_files(args.targets or ["styles"]))
    if not files:
        sys.exit("error: no .css files found")

    declared = set()
    used = {}
    for path in files:
        source = COMMENT_RE.sub("", path.read_text(encoding="utf-8"))
        declared.update(DECL_RE.findall(source))
        for line_no, line in enumerate(source.splitlines(), 1):
            for token in USE_RE.findall(line):
                used.setdefault(token, []).append(f"{path}:{line_no}")

    undefined = {t: where for t, where in sorted(used.items()) if t not in declared}
    unused = sorted(declared - set(used))

    if args.list:
        print(f"{len(declared)} tokens declared, {len(used)} referenced\n")
        for token in sorted(declared):
            print(f"  {token}{'' if token in used else '   (never referenced)'}")
        print()

    for token, where in undefined.items():
        print(f"UNDEFINED {token} referenced at:")
        for location in where:
            print(f"    {location}")

    if unused and not args.list:
        print(f"note: {len(unused)} declared but never referenced: {', '.join(unused)}")

    if undefined:
        print(f"\nFAIL: {len(undefined)} undefined token(s)")
        return 1
    print(f"OK: all {len(used)} referenced --aa-* tokens are declared")
    return 0


if __name__ == "__main__":
    sys.exit(main())
