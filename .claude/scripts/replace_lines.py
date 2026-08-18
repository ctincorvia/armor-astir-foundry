#!/usr/bin/env python3
"""Replace a contiguous line range in a file, without needing the old text to match exactly.

This exists because Edit requires old_string to match a file byte-for-byte, including
whitespace -- easy to get wrong when copying indentation out of Read's "cat -n" output (tabs vs
spaces, a line-number prefix that looks like part of the content, trailing whitespace that isn't
visible). Working from line numbers instead of exact content sidesteps that whole failure class.

Usage:
    py replace_lines.py <file> <start> <end> [--dry-run] [--input <content-file>]

New content is read from stdin, exactly as it should appear in the file (no line-number prefixes)
-- or from --input <content-file> instead, which avoids needing a `<` shell redirect (redirection
can't be covered by a Bash permission allow-rule's prefix match, so it prompts every time even when
the command itself is pre-approved).

- <start>/<end> are 1-indexed and inclusive, matching Read's own line numbers.
- <end> may equal <start - 1> to insert before <start> without removing anything (e.g. start=10
  end=9 inserts new lines before the current line 10; start=<lines + 1> end=<lines> appends at
  end of file).
- --dry-run prints a unified diff instead of writing, to sanity-check before committing to it.

Preserves the file's existing newline style (\\n vs \\r\\n) and whether it ends in a trailing
newline. Reads/writes UTF-8.

Examples:
    # Replace lines 42-45 with three new lines (Bash heredoc)
    py .claude/scripts/replace_lines.py scripts/foo.js 42 45 <<'EOF'
    	const x = 1;
    	const y = 2;
    	const z = 3;
    EOF

    # Insert two lines before line 10, from a temp file, no shell redirect needed
    py .claude/scripts/replace_lines.py scripts/foo.js 10 9 --input new_lines.txt

    # Preview only
    py .claude/scripts/replace_lines.py scripts/foo.js 42 45 --dry-run <<'EOF'
    	const x = 1;
    EOF
"""
import argparse
import difflib
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file")
    parser.add_argument("start", type=int)
    parser.add_argument("end", type=int)
    parser.add_argument("--dry-run", action="store_true", help="print a unified diff instead of writing")
    parser.add_argument("--input", metavar="FILE",
                         help="read new content from FILE instead of stdin (avoids a `<` shell redirect)")
    args = parser.parse_args()

    if args.start < 1 or args.end < args.start - 1:
        sys.exit(f"error: start ({args.start}) must be >= 1 and end ({args.end}) must be >= start - 1")

    with open(args.file, "rb") as f:
        raw = f.read()
    newline = "\r\n" if b"\r\n" in raw else "\n"
    text = raw.decode("utf-8")
    had_trailing_newline = text.endswith(("\n", "\r\n")) if text else True
    lines = text.splitlines()

    if args.start > len(lines) + 1:
        sys.exit(f"error: start ({args.start}) is past end of file ({len(lines)} lines)")

    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            new_lines = f.read().splitlines()
    else:
        new_lines = sys.stdin.read().splitlines()

    before = lines[:args.start - 1]
    after = lines[args.end:]
    result_lines = before + new_lines + after

    result = newline.join(result_lines)
    if had_trailing_newline:
        result += newline

    if args.dry_run:
        old_display = newline.join(lines) + (newline if had_trailing_newline else "")
        diff = difflib.unified_diff(
            old_display.splitlines(keepends=True),
            result.splitlines(keepends=True),
            fromfile=args.file,
            tofile=f"{args.file} (proposed)"
        )
        sys.stdout.writelines(diff)
        return

    with open(args.file, "w", encoding="utf-8", newline="") as f:
        f.write(result)
    print(f"Replaced lines {args.start}-{args.end} of {args.file} ({len(lines)} -> {len(result_lines)} lines)")


if __name__ == "__main__":
    main()
