#!/usr/bin/env python3
"""Guard that enforces canonical -> router change directionality on PRs.

Fails when files under docs/agent_router/01_WORKFLOW or 03_SHARED are changed
without changing their corresponding canonical source document.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = REPO_ROOT / "docs" / "agent_router" / "MANIFEST.yaml"
CONFIG_PATH = REPO_ROOT / "scripts" / "docs" / "router_directionality_guard_config.json"
PROTECTED_PREFIXES = (
    "docs/agent_router/01_WORKFLOW/",
    "docs/agent_router/03_SHARED/",
)


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


def _load_manifest_mapping(manifest_path: Path) -> dict[str, list[str]]:
    if not manifest_path.exists():
        print(f"Router manifest not found: {manifest_path}", file=sys.stderr)
        sys.exit(2)

    mapping: dict[str, list[str]] = {}
    current_target: str | None = None
    current_sources: list[str] = []
    inside_sources_block = False

    def _flush_current() -> None:
        nonlocal current_target, current_sources, inside_sources_block
        if current_target and current_target.startswith(PROTECTED_PREFIXES) and current_sources:
            mapping[current_target] = sorted(set(current_sources))
        current_target = None
        current_sources = []
        inside_sources_block = False

    for raw_line in manifest_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("- target:"):
            _flush_current()
            current_target = _strip_yaml_value(line.split(":", 1)[1])
            continue

        if current_target is None:
            continue

        if line.startswith("source:"):
            current_sources.append(_strip_yaml_value(line.split(":", 1)[1]))
            inside_sources_block = False
            continue

        if line.startswith("sources:"):
            inside_sources_block = True
            continue

        if inside_sources_block:
            if line.startswith("- "):
                current_sources.append(_strip_yaml_value(line[2:]))
                continue
            inside_sources_block = False

    _flush_current()

    return mapping


def _load_exempt_protected_files(config_path: Path) -> set[str]:
    if not config_path.exists():
        print(f"Router directionality config not found: {config_path}", file=sys.stderr)
        sys.exit(2)
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON in {config_path}: {exc}", file=sys.stderr)
        sys.exit(2)

    raw_exempt_files = payload.get("exempt_protected_files", [])
    if not isinstance(raw_exempt_files, list):
        print(
            f"Invalid router directionality config in {config_path}: "
            "exempt_protected_files must be a list.",
            file=sys.stderr,
        )
        sys.exit(2)

    exempt_files = {
        str(path).strip().replace("\\", "/") for path in raw_exempt_files if str(path).strip()
    }
    return exempt_files


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", required=True, help="Base commit/ref for PR diff.")
    args = parser.parse_args()

    changed_files = _run_changed_files(args.base_ref)
    changed_set = set(changed_files)
    manifest_mapping = _load_manifest_mapping(MANIFEST_PATH)
    exempt_files = _load_exempt_protected_files(CONFIG_PATH)

    manifest_relpath = str(MANIFEST_PATH.relative_to(REPO_ROOT)).replace("\\", "/")
    manifest_changed = manifest_relpath in changed_set

    changed_router_files = [
        path
        for path in changed_files
        if path.startswith(PROTECTED_PREFIXES) and path not in exempt_files
    ]
    if not changed_router_files:
        print("Router directionality guard: no protected router files changed.")
        return 0

    if manifest_changed:
        print(
            "Router directionality guard: MANIFEST.yaml changed — "
            "router regeneration is expected. "
            "Relying on drift guard (--check) for content validation."
        )
        return 0

    findings: list[str] = []
    for router_path in changed_router_files:
        canonical_sources = manifest_mapping.get(router_path, [])
        if not canonical_sources:
            findings.append(
                f"Router file `{router_path}` is protected but not mapped in MANIFEST.yaml."
            )
            continue
        if not any(source in changed_set for source in canonical_sources):
            expected_sources = ", ".join(f"`{source}`" for source in canonical_sources)
            findings.append(
                f"Router file `{router_path}` changed without canonical source "
                f"{expected_sources} in the same diff."
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
