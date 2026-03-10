from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

METADATA_VALUE_RE = re.compile(r"`([^`]+)`")
CHECKBOX_LINE_RE = re.compile(r"^\s*- \[(?P<state>[ xX])]\s*(?P<text>.*)$")
INLINE_CODE_RE = re.compile(r"`[^`]*`")

IN_PROGRESS_LABEL_RE = re.compile(r"(?:^|\s)(?:⏳\s*)?IN PROGRESS(?:\s*\(|\s*$)")

PLAN_START_FIELDS = (
    "Branch",
    "Worktree",
    "Execution Mode",
    "Model Assignment",
)
PLACEHOLDER_VALUES = (
    "pending plan-start resolution",
    "pending user selection",
    "pending",
    "pendiente",
)
VALID_EXECUTION_MODES = {"Supervised", "Semi-supervised", "Autonomous"}
VALID_MODEL_ASSIGNMENTS = {"Default", "Uniform", "Custom"}


class PlanResolutionError(RuntimeError):
    """Raised when active plan resolution is ambiguous."""


def safe_print(message: str) -> None:
    """Print robustly on consoles that cannot encode some Unicode characters."""
    try:
        print(message)
    except UnicodeEncodeError:
        fallback = message.encode("ascii", errors="backslashreplace").decode("ascii")
        print(fallback)


def get_current_branch() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def extract_metadata_value(plan_content: str, field_name: str) -> str | None:
    pattern = re.compile(rf"^\*\*{re.escape(field_name)}:\*\*\s*(?P<value>.+?)\s*$", re.MULTILINE)
    match = pattern.search(plan_content)
    if not match:
        return None
    raw_value = match.group("value").strip()
    value_match = METADATA_VALUE_RE.search(raw_value)
    if value_match:
        return value_match.group(1).strip()
    return raw_value.strip()


def extract_branch(plan_content: str) -> str | None:
    return extract_metadata_value(plan_content, "Branch")


def is_unresolved_metadata(value: str | None) -> bool:
    if value is None:
        return True

    normalized = value.strip().casefold()
    if not normalized:
        return True

    return any(
        normalized == placeholder or placeholder in normalized for placeholder in PLACEHOLDER_VALUES
    )


def validate_plan_start_metadata(plan_content: str, plan_path: Path) -> list[str]:
    errors: list[str] = []
    values = {
        field_name: extract_metadata_value(plan_content, field_name)
        for field_name in PLAN_START_FIELDS
    }

    for field_name, value in values.items():
        if value is None:
            errors.append(
                f"Plan {plan_path.as_posix()} is missing '**{field_name}:**' metadata field."
            )
            continue

        if is_unresolved_metadata(value):
            errors.append(
                f"Plan {plan_path.as_posix()} has unresolved '**{field_name}:**' value: {value!r}."
            )

    execution_mode = values.get("Execution Mode")
    if execution_mode is not None and not is_unresolved_metadata(execution_mode):
        if execution_mode not in VALID_EXECUTION_MODES:
            valid_modes = ", ".join(sorted(VALID_EXECUTION_MODES))
            errors.append(
                f"Plan {plan_path.as_posix()} has invalid '**Execution Mode:**' value: "
                f"{execution_mode!r}. Expected one of: {valid_modes}."
            )

    model_assignment = values.get("Model Assignment")
    if model_assignment is not None and not is_unresolved_metadata(model_assignment):
        if model_assignment not in VALID_MODEL_ASSIGNMENTS:
            valid_assignments = ", ".join(sorted(VALID_MODEL_ASSIGNMENTS))
            errors.append(
                f"Plan {plan_path.as_posix()} has invalid '**Model Assignment:**' value: "
                f"{model_assignment!r}. Expected one of: {valid_assignments}."
            )

    return errors


def iter_plan_files(plan_root: Path) -> list[Path]:
    candidates = sorted(plan_root.rglob("PLAN_*.md"))
    return [path for path in candidates if "completed" not in path.parts]


def resolve_active_plan(branch: str, plan_root: Path) -> Path | None:
    matches: list[Path] = []

    for plan_path in iter_plan_files(plan_root):
        content = plan_path.read_text(encoding="utf-8")
        extracted_branch = extract_branch(content)
        if extracted_branch == branch:
            matches.append(plan_path)

    if len(matches) == 0:
        return None

    if len(matches) > 1:
        match_lines = "\n".join(f"- {path.as_posix()}" for path in matches)
        raise PlanResolutionError(
            "Ambiguous active plan resolution for branch "
            f"'{branch}'. Multiple plans match:\n"
            f"{match_lines}\n"
            "Keep exactly one active plan per branch outside completed/."
        )

    return matches[0]


def validate_execution_status(plan_content: str, plan_path: Path) -> list[str]:
    errors: list[str] = []

    if "## Execution Status" not in plan_content:
        errors.append(f"Plan {plan_path.as_posix()} is missing '## Execution Status' section.")

    errors.extend(validate_plan_start_metadata(plan_content, plan_path))
    return errors


def collect_active_labels(plan_content: str) -> tuple[list[str], list[str], list[str]]:
    in_progress_open: list[str] = []
    active_open: list[str] = []
    active_closed: list[str] = []

    for raw_line in plan_content.splitlines():
        match = CHECKBOX_LINE_RE.match(raw_line)
        if not match:
            continue

        state = match.group("state").lower()
        text = match.group("text")
        # Ignore mentions in inline code snippets and detect label-like tokens only.
        text_without_code = INLINE_CODE_RE.sub("", text)
        has_in_progress = bool(IN_PROGRESS_LABEL_RE.search(text_without_code))

        if state == " ":
            if has_in_progress:
                in_progress_open.append(raw_line.strip())
                active_open.append(raw_line.strip())
        elif state == "x" and has_in_progress:
            active_closed.append(raw_line.strip())

    return in_progress_open, active_open, active_closed


def validate_single_active_step(plan_content: str) -> list[str]:
    _, active_open, active_closed = collect_active_labels(plan_content)
    errors: list[str] = []

    if len(active_open) > 1:
        listed = "\n".join(active_open)
        errors.append(
            f"Multiple active steps found. At most one step may be IN PROGRESS.\n{listed}"
        )

    if active_closed:
        listed_closed = "\n".join(active_closed)
        errors.append(
            "Closed steps cannot keep active labels (IN PROGRESS). "
            "Remove active labels from closed checkboxes.\n"
            f"{listed_closed}"
        )

    return errors


def run_guard(branch: str, plan_root: Path) -> int:
    try:
        plan_path = resolve_active_plan(branch=branch, plan_root=plan_root)
    except PlanResolutionError as exc:
        safe_print(f"ERROR: {exc}")
        safe_print("plan-execution-guard: FAIL (1 invariant(s) violated)")
        return 1

    if plan_path is None:
        safe_print("plan-execution-guard: PASS")
        return 0

    plan_content = plan_path.read_text(encoding="utf-8")

    errors: list[str] = []
    errors.extend(validate_execution_status(plan_content, plan_path))
    errors.extend(validate_single_active_step(plan_content))

    if errors:
        for error in errors:
            safe_print(f"ERROR: {error}")
        safe_print(f"plan-execution-guard: FAIL ({len(errors)} invariant(s) violated)")
        return 1

    safe_print("plan-execution-guard: PASS")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate active plan execution invariants.")
    parser.add_argument(
        "--branch",
        default=None,
        help="Target branch. Defaults to current git branch.",
    )
    parser.add_argument(
        "--plan-root",
        default="docs/projects/veterinary-medical-records/04-delivery/plans",
        help="Root folder where PLAN_*.md files are searched.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    branch = args.branch or get_current_branch()
    plan_root = Path(args.plan_root)
    return run_guard(branch=branch, plan_root=plan_root)


if __name__ == "__main__":
    sys.exit(main())
