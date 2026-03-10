from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PLAN_DIR = "docs/projects/veterinary-medical-records/04-delivery/plans"
PLAN_START_FIELDS = (
    "Branch",
    "Worktree",
    "Execution Mode",
    "Model Assignment",
)
VALID_EXECUTION_MODES = {"Supervised", "Semi-supervised", "Autonomous"}
VALID_MODEL_ASSIGNMENTS = {"Default", "Uniform", "Custom"}
INLINE_CODE_RE = re.compile(r"`([^`]+)`")


@dataclass(frozen=True)
class FieldStatus:
    name: str
    resolved: bool
    value: str | None


@dataclass(frozen=True)
class PlanReport:
    relative_path: str
    fields: tuple[FieldStatus, ...]
    unresolved_fields: tuple[str, ...]


def safe_print(message: str) -> None:
    try:
        print(message)
    except UnicodeEncodeError:
        fallback = message.encode("ascii", errors="backslashreplace").decode("ascii")
        print(fallback)


def extract_metadata_value(plan_content: str, field_name: str) -> str | None:
    pattern = re.compile(rf"^\*\*{re.escape(field_name)}:\*\*\s*(?P<value>.+?)\s*$", re.MULTILINE)
    match = pattern.search(plan_content)
    if not match:
        return None

    raw_value = match.group("value").strip()
    inline_match = INLINE_CODE_RE.search(raw_value)
    if inline_match:
        return inline_match.group(1).strip()
    return raw_value


def is_field_resolved(field_name: str, value: str | None) -> bool:
    if value is None:
        return False

    normalized = value.strip()
    if not normalized:
        return False

    if "PENDING" in normalized.upper():
        return False

    if field_name == "Execution Mode":
        return normalized in VALID_EXECUTION_MODES

    if field_name == "Model Assignment":
        return normalized in VALID_MODEL_ASSIGNMENTS

    return True


def iter_plan_files(plan_dir: Path) -> list[Path]:
    candidates = sorted(plan_dir.rglob("PLAN_*.md"))
    return [path for path in candidates if "completed" not in path.parts]


def inspect_plan(plan_path: Path, repo_root: Path) -> PlanReport:
    content = plan_path.read_text(encoding="utf-8")
    field_statuses: list[FieldStatus] = []
    unresolved_fields: list[str] = []

    for field_name in PLAN_START_FIELDS:
        value = extract_metadata_value(content, field_name)
        resolved = is_field_resolved(field_name, value)
        field_statuses.append(FieldStatus(name=field_name, resolved=resolved, value=value))
        if not resolved:
            unresolved_fields.append(field_name)

    try:
        relative_path = plan_path.relative_to(repo_root).as_posix()
    except ValueError:
        relative_path = plan_path.as_posix()

    return PlanReport(
        relative_path=relative_path,
        fields=tuple(field_statuses),
        unresolved_fields=tuple(unresolved_fields),
    )


def collect_reports(plan_dir: Path, repo_root: Path = REPO_ROOT) -> list[PlanReport]:
    return [inspect_plan(plan_path, repo_root=repo_root) for plan_path in iter_plan_files(plan_dir)]


def render_report(reports: list[PlanReport]) -> str:
    if not reports:
        return (
            "No active plans found.\n"
            "Next action:\n"
            "- Create or select an active plan before running execution steps."
        )

    lines: list[str] = []
    for report in reports:
        lines.append(report.relative_path)
        for field in report.fields:
            if field.resolved:
                lines.append(f"- {field.name}: ✅ resolved ({field.value})")
            else:
                lines.append(f"- {field.name}: ❌ unresolved")

        if report.unresolved_fields:
            missing = ", ".join(report.unresolved_fields)
            lines.append(f"- Summary: UNRESOLVED: {missing}")
        else:
            lines.append("- Summary: ALL RESOLVED")
        lines.append("")

    lines.append("Next action:")
    unresolved_reports = [report for report in reports if report.unresolved_fields]
    if unresolved_reports:
        for report in unresolved_reports:
            missing = ", ".join(report.unresolved_fields)
            lines.append(f"- Update {report.relative_path}: resolve {missing}.")
        lines.append("- Re-run this check before executing plan steps.")
    else:
        lines.append("- All active plans have resolved plan-start metadata.")
        lines.append("- Continue with the next eligible execution step.")

    return "\n".join(lines)


def run(plan_dir: Path, repo_root: Path = REPO_ROOT) -> int:
    reports = collect_reports(plan_dir=plan_dir, repo_root=repo_root)
    safe_print(render_report(reports))

    if any(report.unresolved_fields for report in reports):
        return 1
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check whether active plans have resolved plan-start metadata."
    )
    parser.add_argument(
        "--plan-dir",
        default=DEFAULT_PLAN_DIR,
        help="Directory where active PLAN_*.md files are searched.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    plan_dir = Path(args.plan_dir)
    if not plan_dir.is_absolute():
        plan_dir = REPO_ROOT / plan_dir
    return run(plan_dir=plan_dir, repo_root=REPO_ROOT)


if __name__ == "__main__":
    sys.exit(main())
