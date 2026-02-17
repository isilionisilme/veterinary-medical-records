#!/usr/bin/env python3
"""Guardrail that enforces source-doc to router-module parity for mapped docs."""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from pathlib import Path

DEFAULT_MAP_PATH = Path(
    "docs/agent_router/01_WORKFLOW/DOC_UPDATES/router_parity_map.json"
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
        print("Doc/router parity guard could not compute PR diff.", file=sys.stderr)
        print(result.stderr.strip(), file=sys.stderr)
        sys.exit(2)
    return [
        line.strip().replace("\\", "/")
        for line in result.stdout.splitlines()
        if line.strip()
    ]


def _load_rules(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        print(f"Doc/router parity map not found: {path}", file=sys.stderr)
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


def evaluate_parity(
    changed_files: list[str], rules: list[dict[str, object]], repo_root: Path
) -> list[str]:
    findings: list[str] = []

    for raw_rule in rules:
        source_doc = str(raw_rule.get("source_doc", "")).strip()
        description = str(raw_rule.get("description", "")).strip()
        router_modules = raw_rule.get("router_modules", [])

        if not source_doc or not isinstance(router_modules, list) or not router_modules:
            findings.append(f"Invalid parity rule: {raw_rule}")
            continue

        if not any(fnmatch.fnmatch(path, source_doc) for path in changed_files):
            continue

        for module_rule in router_modules:
            module_path = str(module_rule.get("path", "")).strip()
            required_terms = module_rule.get("required_terms", [])

            if not module_path or not isinstance(required_terms, list) or not required_terms:
                findings.append(
                    f"Invalid module parity mapping for source `{source_doc}`: {module_rule}"
                )
                continue

            module_file = repo_root / module_path
            if not module_file.exists():
                findings.append(
                    f"Parity target missing for source `{source_doc}`: `{module_path}`"
                )
                continue

            module_text = module_file.read_text(encoding="utf-8")
            missing_terms = [
                str(term)
                for term in required_terms
                if str(term).strip() and str(term) not in module_text
            ]
            if not missing_terms:
                continue

            description_suffix = f" ({description})" if description else ""
            missing_terms_text = ", ".join(missing_terms)
            findings.append(
                "Source "
                f"`{source_doc}` changed{description_suffix}, "
                "but router module "
                f"`{module_path}` is missing required terms: {missing_terms_text}"
            )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-ref", required=True, help="Base commit/ref for PR diff."
    )
    parser.add_argument(
        "--map-file",
        default=str(DEFAULT_MAP_PATH),
        help="Path to the source->router parity mapping JSON.",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[1]
    changed_files = _run_changed_files(args.base_ref)
    rules = _load_rules(Path(args.map_file))
    findings = evaluate_parity(changed_files, rules, repo_root)

    if findings:
        print("Doc/router parity guard failed.")
        for finding in findings:
            print(f"- {finding}")
        return 1

    if any(
        path.startswith("docs/project/") and path.endswith(".md")
        for path in changed_files
    ):
        print("Doc/router parity guard passed.")
    else:
        print("Doc/router parity guard: no project docs changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
