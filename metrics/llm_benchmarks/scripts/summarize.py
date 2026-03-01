from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def _median(values: list[int]) -> int:
    if not values:
        return 0
    return int(statistics.median(values))


def _load_runs(runs_path: Path) -> list[dict[str, object]]:
    runs: list[dict[str, object]] = []
    for line in runs_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        obj = json.loads(line)
        if isinstance(obj, dict):
            runs.append(obj)
    return runs


def _parse_date_utc(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _render_summary(runs: list[dict[str, object]]) -> str:
    if not runs:
        return (
            "# LLM Benchmarks — Summary\n\n"
            "No benchmark runs recorded yet.\n\n"
            "Update this file by running:\n\n"
            "`python metrics/llm_benchmarks/scripts/summarize.py "
            "--write metrics/llm_benchmarks/summary.md`\n"
        )

    by_scenario: dict[str, list[dict[str, object]]] = defaultdict(list)
    for run in runs:
        scenario_id = str(run.get("scenario_id", "unknown"))
        by_scenario[scenario_id].append(run)

    lines: list[str] = ["# LLM Benchmarks — Summary", ""]
    lines.append("| Scenario | Runs | Median docs | Median tok_est | Max max_doc_chars |")
    lines.append("|---|---:|---:|---:|---:|")

    for scenario_id in sorted(by_scenario.keys()):
        items = by_scenario[scenario_id]
        med_docs: list[int] = []
        med_tok: list[int] = []
        max_doc: list[int] = []
        for run in items:
            metrics = run.get("metrics") or {}
            if not isinstance(metrics, dict):
                continue
            med_docs.append(int(metrics.get("unique_docs_opened", 0)))
            med_tok.append(int(metrics.get("tok_est", 0)))
            max_doc.append(int(metrics.get("max_doc_chars", 0)))

        max_max_doc_chars = max(max_doc) if max_doc else 0
        lines.append(
            f"| {scenario_id} | {len(items)} | {_median(med_docs)} | {_median(med_tok)} | "
            f"{max_max_doc_chars} |"
        )

    retro_runs = by_scenario.get("retro_daily_snapshot", [])
    if retro_runs:
        lines.append("")
        lines.append("## Retro daily snapshot detail")
        lines.append("")
        lines.append("| Date (UTC) | tok_est | chars_read | docs | commit |")
        lines.append("|---|---:|---:|---:|---|")

        def _key(run: dict[str, object]) -> tuple[datetime, str]:
            parsed = _parse_date_utc(run.get("date_utc"))
            if parsed is None:
                parsed = datetime.min
            run_id = str(run.get("run_id", ""))
            return parsed, run_id

        for run in sorted(retro_runs, key=_key):
            metrics = run.get("metrics")
            if not isinstance(metrics, dict):
                continue

            date_utc = str(run.get("date_utc", ""))
            day = date_utc[:10] if len(date_utc) >= 10 else date_utc
            tok_est = int(metrics.get("tok_est", 0))
            chars_read = int(metrics.get("chars_read", 0))
            docs = int(metrics.get("unique_docs_opened", 0))
            commit = str(run.get("commit_sha", ""))
            commit_short = commit[:7] if len(commit) >= 7 else commit

            lines.append(f"| {day} | {tok_est} | {chars_read} | {docs} | {commit_short} |")

        operational_runs = by_scenario.get("retro_daily_operational_path", [])
        if operational_runs:
            lines.append("")
            lines.append("## Retro daily operational path detail")
            lines.append("")
            lines.append("| Date (UTC) | tok_est | chars_read | docs | commit |")
            lines.append("|---|---:|---:|---:|---|")

            def _key_operational(run: dict[str, object]) -> tuple[datetime, str]:
                parsed = _parse_date_utc(run.get("date_utc"))
                if parsed is None:
                    parsed = datetime.min
                run_id = str(run.get("run_id", ""))
                return parsed, run_id

            for run in sorted(operational_runs, key=_key_operational):
                metrics = run.get("metrics")
                if not isinstance(metrics, dict):
                    continue

                date_utc = str(run.get("date_utc", ""))
                day = date_utc[:10] if len(date_utc) >= 10 else date_utc
                tok_est = int(metrics.get("tok_est", 0))
                chars_read = int(metrics.get("chars_read", 0))
                docs = int(metrics.get("unique_docs_opened", 0))
                commit = str(run.get("commit_sha", ""))
                commit_short = commit[:7] if len(commit) >= 7 else commit

                lines.append(f"| {day} | {tok_est} | {chars_read} | {docs} | {commit_short} |")

    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize runs.jsonl into a Markdown table.")
    parser.add_argument("--runs", default="metrics/llm_benchmarks/runs.jsonl")
    parser.add_argument("--write", default=None, help="Write output to the given path.")
    parser.add_argument("--check", action="store_true", help="Fail if --write is out of date.")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[3]
    runs_path = (repo_root / args.runs).resolve()
    runs = _load_runs(runs_path)
    summary = _render_summary(runs)

    if args.write:
        out_path = (repo_root / args.write).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if args.check and out_path.exists():
            existing = out_path.read_text(encoding="utf-8")
            if existing != summary:
                raise SystemExit(f"Summary is out of date: {args.write}")
        out_path.write_text(summary, encoding="utf-8")
    else:
        print(summary, end="")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
