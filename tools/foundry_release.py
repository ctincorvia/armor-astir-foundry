#!/usr/bin/env python3
"""Publish the most recent GitHub release of this module to Foundry's package listing.

Looks up this repo's latest GitHub release, cross-checks it against the local module.json,
and POSTs it to Foundry's Package Release API:
https://foundryvtt.com/article/package-release-api/

The Foundry API token is never stored in this file -- pass it with --token. Always run with
--dry-run first (Foundry validates the submission without saving it); only drop --dry-run once
that succeeds.

Usage:
    py tools/foundry_release.py --token fvttp_xxx --dry-run
    py tools/foundry_release.py --token fvttp_xxx

Options:
    --token TOKEN        Foundry package API token (required). Never logged or echoed.
    --dry-run            Ask Foundry to validate the submission without saving it.
    --yes                Skip the confirmation prompt before a real (non-dry-run) submission.
    --module-json PATH   Path to module.json (default: module.json next to this repo's root).
"""
import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

GITHUB_API = "https://api.github.com"
FOUNDRY_RELEASE_API = "https://foundryvtt.com/_api/packages/release_version/"


def http_get_json(url):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def parse_owner_repo(github_url):
    path = urlparse(github_url).path.strip("/")
    parts = path.split("/")
    if len(parts) < 2:
        sys.exit(f"error: could not parse owner/repo from module.json's url field: {github_url!r}")
    return parts[0], parts[1]


def find_asset_url(release, filename):
    for asset in release.get("assets", []):
        if asset.get("name") == filename:
            return asset["browser_download_url"]
    return None


def build_payload(module_data, release, dry_run):
    tag = release["tag_name"]
    version = tag[1:] if tag.startswith("v") else tag
    local_version = module_data["version"]
    if version != local_version:
        sys.exit(
            f"error: latest GitHub release is tagged {tag!r} (version {version!r}), but local "
            f"module.json is at version {local_version!r}. Check out/pull the matching tag before "
            "releasing, so compatibility data is read from the right module.json."
        )

    manifest_url = find_asset_url(release, "module.json")
    if manifest_url is None:
        sys.exit(f"error: release {tag!r} has no module.json asset attached -- nothing to point Foundry at.")

    compatibility = module_data["compatibility"]
    release_compatibility = {
        "minimum": compatibility["minimum"],
        "verified": compatibility["verified"],
    }
    if compatibility.get("maximum"):
        release_compatibility["maximum"] = compatibility["maximum"]

    payload = {
        "id": module_data["id"],
        "release": {
            "version": version,
            "manifest": manifest_url,
            "notes": release["html_url"],
            "compatibility": release_compatibility,
        },
    }
    if dry_run:
        payload["dry-run"] = True
    return payload


def submit(payload, token):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        FOUNDRY_RELEASE_API,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": token,
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail)
        except json.JSONDecodeError:
            pass
        if error.code == 429:
            retry_after = error.headers.get("Retry-After")
            sys.exit(f"error: rate limited by Foundry (HTTP 429). Retry after {retry_after} seconds. Body: {detail}")
        return error.code, detail


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--token", required=True, help="Foundry package API token (never logged)")
    parser.add_argument("--dry-run", action="store_true", help="validate with Foundry without saving")
    parser.add_argument("--yes", action="store_true", help="skip confirmation before a real submission")
    parser.add_argument("--module-json", default=None, help="path to module.json (default: repo root)")
    args = parser.parse_args()

    module_json_path = Path(args.module_json) if args.module_json else Path(__file__).resolve().parent.parent / "module.json"
    module_data = json.loads(module_json_path.read_text(encoding="utf-8"))

    owner, repo = parse_owner_repo(module_data["url"])
    release = http_get_json(f"{GITHUB_API}/repos/{owner}/{repo}/releases/latest")
    payload = build_payload(module_data, release, args.dry_run)

    print(f"id:         {payload['id']}")
    print(f"version:    {payload['release']['version']}")
    print(f"manifest:   {payload['release']['manifest']}")
    print(f"notes:      {payload['release']['notes']}")
    print(f"compat:     {payload['release']['compatibility']}")
    print(f"dry-run:    {args.dry_run}")

    if not args.dry_run and not args.yes:
        answer = input("Submit this REAL release to Foundry? [y/N] ").strip().lower()
        if answer != "y":
            sys.exit("aborted.")

    status, response_body = submit(payload, args.token)
    print(f"HTTP {status}")
    print(json.dumps(response_body, indent=2))
    if status >= 400:
        sys.exit(1)


if __name__ == "__main__":
    main()
