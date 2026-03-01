from __future__ import annotations

import argparse
import json
import subprocess
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

CANDIDATE_DOCS = [
    "AGENTS.md",
    "docs/README.md",
    "docs/project/TECHNICAL_DESIGN.md",
    "docs/shared/ENGINEERING_PLAYBOOK.md",
]


@dataclass(frozen=True)
class DailyCommit:
    day: date
    sha: str


def _git(*args: str) -> str:
    out = subprocess.check_output(
        ["git", *args],
        text=True,
        encoding="utf-8",
        errors="replace",
        stderr=subprocess.DEVNULL,
    )
    return out.strip()


def _day_to_iso_end(day: date) -> str:
    dt = datetime.combine(day, time(23, 59, 59), tzinfo=UTC)
    return dt.isoformat().replace("+00:00", "Z")


def _list_daily_last_commits() -> list[DailyCommit]:
    out = _git("log", "--reverse", "--date=short", "--pretty=format:%ad %H")
    if not out:
        return []

    by_day: dict[date, str] = {}
    for line in out.splitlines():
        day_s, sha = line.split(" ", 1)
        by_day[date.fromisoformat(day_s)] = sha

    return [DailyCommit(day=d, sha=by_day[d]) for d in sorted(by_day.keys())]


def _expand_to_all_days(daily_commits: list[DailyCommit]) -> list[DailyCommit]:
    if not daily_commits:
        return []

    first_day = daily_commits[0].day
    last_day = datetime.now(UTC).date()

    sha_by_day = {item.day: item.sha for item in daily_commits}

    result: list[DailyCommit] = []
    current_sha: str | None = None
    current_day = first_day
    while current_day <= last_day:
        if current_day in sha_by_day:
            current_sha = sha_by_day[current_day]
        if current_sha is not None:
            result.append(DailyCommit(day=current_day, sha=current_sha))
        current_day += timedelta(days=1)

    return result


def _git_show_text(sha: str, path: str) -> str | None:
    try:
        return _git("show", f"{sha}:{path}")
    except subprocess.CalledProcessError:
        return None


def _docs_for_commit(sha: str) -> list[str]:
    docs: list[str] = []
    for path in CANDIDATE_DOCS:
        if _git_show_text(sha, path) is not None:
            docs.append(path)
    return docs


def _metrics_for_commit(sha: str, docs: list[str]) -> tuple[int, int, int]:
    chars_read = 0
    max_doc_chars = 0

    for path in docs:
        content = _git_show_text(sha, path)
        if content is None:
            continue
        n = len(content)
        chars_read += n
        max_doc_chars = max(max_doc_chars, n)

    tok_est = round(chars_read / 4)
    return chars_read, tok_est, max_doc_chars


def _load_existing_dates(runs_path: Path, scenario_id: str) -> set[str]:
    if not runs_path.exists():
        return set()

    existing: set[str] = set()
    for line in runs_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        if not isinstance(obj, dict):
            continue
        if obj.get("scenario_id") != scenario_id:
            continue
        date_utc = obj.get("date_utc")
        if isinstance(date_utc, str) and len(date_utc) >= 10:
            existing.add(date_utc[:10])
    return existing


def _build_run(day: date, sha: str, docs: list[str]) -> dict[str, object]:
    chars_read, tok_est, max_doc_chars = _metrics_for_commit(sha, docs)

    return {
        "date_utc": _day_to_iso_end(day),
        "commit_sha": sha,
        "scenario_id": "retro_daily_snapshot",
        "run_id": f"retro-{day.isoformat()}-{sha[:7]}",
        "agent": "retro_backfill",
        "model": "n/a",
        "reasoning_effort": "retro_daily",
        "metrics": {
            "docs": docs,
            "unique_docs_opened": len(docs),
            "chars_read": chars_read,
            "tok_est": tok_est,
            "max_doc_chars": max_doc_chars,
            "fallback_count": 0,
            "clarifying_questions": 0,
            "violations": ["retroactive_estimate"],
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill one retro benchmark run per UTC day.")
    parser.add_argument("--runs", default="metrics/llm_benchmarks/runs.jsonl")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[3]
    runs_path = (repo_root / args.runs).resolve()
    runs_path.parent.mkdir(parents=True, exist_ok=True)

    daily_commits = _expand_to_all_days(_list_daily_last_commits())
    existing_days = _load_existing_dates(runs_path, "retro_daily_snapshot")

    new_runs: list[dict[str, object]] = []
    for item in daily_commits:
        day_s = item.day.isoformat()
        if day_s in existing_days:
            continue

        docs = _docs_for_commit(item.sha)
        if not docs:
            continue

        new_runs.append(_build_run(item.day, item.sha, docs))

    if args.dry_run:
        print(f"Would append {len(new_runs)} retro daily runs to {runs_path}")
        return 0

    with runs_path.open("a", encoding="utf-8") as f:
        for run in new_runs:
            f.write(json.dumps(run, ensure_ascii=False) + "\n")

    print(f"Appended {len(new_runs)} retro daily runs to {runs_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
