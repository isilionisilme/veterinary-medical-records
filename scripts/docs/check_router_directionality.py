#!/usr/bin/env python3
"""Guard that enforces canonical -> router change directionality on PRs.

Fails when files under docs/agent_router/01_WORKFLOW or 03_SHARED are changed
without changing their corresponding canonical source document.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "docs" / "agent_router" / "MANIFEST.yaml"
PROTECTED_PREFIXES = (
    "docs/agent_router/01_WORKFLOW/",
    "docs/agent_router/03_SHARED/",
)
EXEMPT_PROTECTED_FILES = {
    "docs/agent_router/01_WORKFLOW/DOC_UPDATES/router_parity_map.json",
    "docs/agent_router/01_WORKFLOW/DOC_UPDATES/test_impact_map.json",
}


def _run_changed_files(base_ref: str) -> list[str]:
    branch_cmd = [
        "git",
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        f"{base_ref}...HEAD",
    ]
    branch_result = subprocess.run(branch_cmd, capture_output=True, text=True, check=False)
    if branch_result.returncode != 0:
        print("Router directionality guard could not compute PR diff.", file=sys.stderr)
        print(branch_result.stderr.strip(), file=sys.stderr)
        sys.exit(2)

    local_cmd = ["git", "diff", "--name-only", "--diff-filter=ACMR"]
    local_result = subprocess.run(local_cmd, capture_output=True, text=True, check=False)
    if local_result.returncode != 0:
        print(
            "Router directionality guard could not compute local unstaged diff.",
            file=sys.stderr,
        )
        print(local_result.stderr.strip(), file=sys.stderr)
        sys.exit(2)

    staged_cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    staged_result = subprocess.run(staged_cmd, capture_output=True, text=True, check=False)
    if staged_result.returncode != 0:
        print(
            "Router directionality guard could not compute local staged diff.",
            file=sys.stderr,
        )
        print(staged_result.stderr.strip(), file=sys.stderr)
        sys.exit(2)

    changed = set()
    for output in (branch_result.stdout, local_result.stdout, staged_result.stdout):
        for line in output.splitlines():
            path = line.strip().replace("\\", "/")
            if path:
                changed.add(path)
    return sorted(changed)


def _strip_yaml_value(raw: str) -> str:
    value = raw.strip()
    if (value.startswith("'") and value.endswith("'")) or (
        value.startswith('"') and value.endswith('"')
    ):
        return value[1:-1]
    return value


def _load_manifest_mapping(manifest_path: Path) -> dict[str, str]:
    if not manifest_path.exists():
        print(f"Router manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(2)

    mapping: dict[str, str] = {}
    current_source: str | None = None

    for raw_line in manifest_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if line.startswith("- source:"):
            current_source = _strip_yaml_value(line.split(":", 1)[1])
            continue
        if line.startswith("- target:"):
            target = _strip_yaml_value(line.split(":", 1)[1])
            if current_source and target.startswith(PROTECTED_PREFIXES):
                mapping[target] = current_source

    return mapping


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", required=True, help="Base commit/ref for PR diff.")
    args = parser.parse_args()

    changed_files = _run_changed_files(args.base_ref)
    changed_set = set(changed_files)
    manifest_mapping = _load_manifest_mapping(MANIFEST_PATH)

    changed_router_files = [
        path
        for path in changed_files
        if path.startswith(PROTECTED_PREFIXES) and path not in EXEMPT_PROTECTED_FILES
    ]
    if not changed_router_files:
        print("Router directionality guard: no protected router files changed.")
        return 0

    findings: list[str] = []
    for router_path in changed_router_files:
        canonical_source = manifest_mapping.get(router_path)
        if not canonical_source:
            findings.append(
                f"Router file `{router_path}` is protected but not mapped in MANIFEST.yaml."
            )
            continue
        if canonical_source not in changed_set:
            findings.append(
                f"Router file `{router_path}` changed without canonical source "
                f"`{canonical_source}` in the same diff."
            )

    if findings:
        print("Router directionality guard failed.")
        print("Protected router files changed:")
        for path in changed_router_files:
            print(f"  - {path}")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("Router directionality guard passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
