#!/usr/bin/env python3
"""Guardrail that enforces doc/test synchronization for mapped docs."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_MAP_PATH = Path(
    "docs/agent_router/01_WORKFLOW/DOC_UPDATES/test_impact_map.json"
)


def _run_changed_files(base_ref: str) -> list[str]:
    cmd = [
        "git",
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        f"{base_ref}...HEAD",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print("Doc/test sync guard could not compute PR diff.", file=sys.stderr)
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(2)
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def _load_rules(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        print(f"Doc/test sync guard config not found: {path}", file=sys.stderr)
        sys.exit(2)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON in {path}: {exc}", file=sys.stderr)
        sys.exit(2)

    rules = payload.get("rules", [])
    if not isinstance(rules, list):
        print(f"Invalid rules list in {path}", file=sys.stderr)
        sys.exit(2)
    return rules


def _matches_any(path: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


def evaluate_sync(changed_files: list[str], rules: list[dict[str, object]]) -> list[str]:
    changed_docs = [
        path
        for path in changed_files
        if path.startswith("docs/") and path.endswith(".md")
    ]
    findings: list[str] = []

    if not changed_docs:
        return findings

    for raw_rule in rules:
        doc_glob = str(raw_rule.get("doc_glob", "")).strip()
        required_any = raw_rule.get("required_any", [])
        description = str(raw_rule.get("description", "")).strip()

        if not doc_glob or not isinstance(required_any, list) or not required_any:
            findings.append(f"Invalid mapping rule: {raw_rule}")
            continue

        required_patterns = [str(item).strip() for item in required_any if str(item).strip()]
        if not required_patterns:
            findings.append(f"Invalid required_any patterns for doc_glob `{doc_glob}`")
            continue

        matched_docs = [doc for doc in changed_docs if fnmatch.fnmatch(doc, doc_glob)]
        if not matched_docs:
            continue

        if _matches_any_from_files(changed_files, required_patterns):
            continue

        description_suffix = f" ({description})" if description else ""
        findings.append(
            f"Docs changed matching `{doc_glob}`{description_suffix}, "
            f"but none of the related tests/guards changed: {', '.join(required_patterns)}. "
            f"Matched docs: {', '.join(matched_docs)}"
        )

    return findings


def _matches_any_from_files(changed_files: list[str], patterns: list[str]) -> bool:
    return any(_matches_any(path, patterns) for path in changed_files)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", required=True, help="Base commit/ref for PR diff.")
    parser.add_argument(
        "--map-file",
        default=str(DEFAULT_MAP_PATH),
        help="Path to the doc->test impact mapping JSON.",
    )
    args = parser.parse_args()

    changed_files = _run_changed_files(args.base_ref)
    rules = _load_rules(Path(args.map_file))
    findings = evaluate_sync(changed_files, rules)

    if findings:
        print("Doc/test sync guard failed.")
        print("Documentation changed without related test/guard updates:")
        for finding in findings:
            print(f"- {finding}")
        return 1

    if any(path.startswith("docs/") and path.endswith(".md") for path in changed_files):
        print("Doc/test sync guard passed.")
    else:
        print("Doc/test sync guard: no markdown docs changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
