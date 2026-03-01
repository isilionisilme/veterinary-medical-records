#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT_README = Path("README.md")
DOCS_README = Path("docs/README.md")
PROJECT_ROOT = Path("docs/projects/veterinary-medical-records")
SHARED_ROOT = Path("docs/shared")
ADR_ROOT = Path("docs/projects/veterinary-medical-records/tech/adr")


def _slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", value.strip())
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _collect_sources(repo_root: Path) -> list[Path]:
    sources: list[Path] = []
    if (repo_root / ROOT_README).exists():
        sources.append(ROOT_README)
    if (repo_root / DOCS_README).exists():
        sources.append(DOCS_README)

    for base in (PROJECT_ROOT, SHARED_ROOT):
        base_abs = repo_root / base
        if not base_abs.exists():
            continue
        for path in sorted(base_abs.rglob("*.md")):
            rel = path.relative_to(repo_root)
            if rel.parts[:2] == ("docs", "agent_router"):
                continue
            sources.append(rel)
    return sources


def _page_name(source_rel: Path) -> str:
    source_str = source_rel.as_posix()
    if source_rel == DOCS_README:
        return "Home"
    if source_rel == ROOT_README:
        return "Project-README"

    if source_str.startswith("docs/shared/"):
        stem = source_rel.stem
        return f"Shared-{_slug(stem)}"

    if source_str == "docs/projects/veterinary-medical-records/tech/adr/README.md":
        return "Project-ADR-Index"

    if source_str.startswith("docs/projects/veterinary-medical-records/tech/adr/"):
        stem = source_rel.stem
        return f"Project-ADR-{_slug(stem)}"

    if source_str.startswith("docs/projects/veterinary-medical-records/"):
        rel_no_ext = source_rel.with_suffix("").relative_to(PROJECT_ROOT)
        return f"Project-{_slug(rel_no_ext.as_posix())}"

    raise ValueError(f"Unsupported source path for wiki mapping: {source_rel}")


def _split_anchor(target: str) -> tuple[str, str]:
    if "#" not in target:
        return target, ""
    base, anchor = target.split("#", 1)
    return base, f"#{anchor}"


def _rewrite_links(
    content: str, source_rel: Path, mapping: dict[Path, str], repo: str, ref: str
) -> str:
    link_re = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
    source_parent = source_rel.parent

    def replace(match: re.Match[str]) -> str:
        text = match.group(1)
        target = match.group(2).strip()

        if not target:
            return match.group(0)
        if target.startswith(("http://", "https://", "mailto:", "#")):
            return match.group(0)

        base_target, anchor = _split_anchor(target)
        normalized = base_target.replace("\\", "/")

        try:
            resolved = (source_parent / normalized).resolve().relative_to(Path.cwd().resolve())
        except Exception:
            return match.group(0)

        resolved = Path(resolved.as_posix())
        if resolved in mapping:
            page = mapping[resolved]
            if anchor:
                return f"[{text}]({page}{anchor})"
            return f"[[{page}|{text}]]"

        blob_target = resolved.as_posix()
        blob_url = f"https://github.com/{repo}/blob/{ref}/{blob_target}{anchor}"
        return f"[{text}]({blob_url})"

    return link_re.sub(replace, content)


def _build_sidebar(project_pages: list[str], adr_pages: list[str], shared_pages: list[str]) -> str:
    lines = [
        "## Documentation",
        "",
        "- [[Home]]",
        "- [[Project]]",
    ]
    for page in project_pages:
        lines.append(f"  - [[{page}]]")
    if adr_pages:
        lines.append("  - ADR")
        for page in adr_pages:
            lines.append(f"    - [[{page}]]")

    lines.append("- [[Shared]]")
    for page in shared_pages:
        lines.append(f"  - [[{page}]]")

    lines.append("")
    return "\n".join(lines)


def _build_section_landing(title: str, intro: str, pages: list[str]) -> str:
    lines = [f"# {title}", "", intro, "", "## Pages", ""]
    for page in pages:
        lines.append(f"- [[{page}]]")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync canonical repo docs to a GitHub wiki checkout"
    )
    parser.add_argument("--wiki-dir", required=True, help="Path to cloned wiki repository")
    parser.add_argument("--repo", required=True, help="owner/repo for blob links")
    parser.add_argument("--ref", default="main", help="Git ref used for blob links")
    args = parser.parse_args()

    repo_root = Path.cwd()
    wiki_dir = Path(args.wiki_dir).resolve()
    wiki_dir.mkdir(parents=True, exist_ok=True)

    sources = _collect_sources(repo_root)
    mapping = {source: _page_name(source) for source in sources}

    for source, page in mapping.items():
        content = (repo_root / source).read_text(encoding="utf-8")
        rewritten = _rewrite_links(content, source, mapping, args.repo, args.ref)
        (wiki_dir / f"{page}.md").write_text(rewritten, encoding="utf-8")

    project_pages = sorted(
        [
            page
            for source, page in mapping.items()
            if source.as_posix().startswith("docs/projects/veterinary-medical-records/")
            and not source.as_posix().startswith(
                "docs/projects/veterinary-medical-records/tech/adr/"
            )
        ]
    )
    adr_pages = sorted(
        [
            page
            for source, page in mapping.items()
            if source.as_posix().startswith("docs/projects/veterinary-medical-records/tech/adr/")
        ]
    )
    shared_pages = sorted(
        [page for source, page in mapping.items() if source.as_posix().startswith("docs/shared/")]
    )

    (wiki_dir / "Project.md").write_text(
        _build_section_landing(
            "Project",
            (
                "Human-facing, project-specific documentation. "
                "This section also includes ADR pages for this project."
            ),
            project_pages + adr_pages,
        ),
        encoding="utf-8",
    )
    (wiki_dir / "Shared.md").write_text(
        _build_section_landing(
            "Shared",
            "Human-facing, cross-project standards and guidelines.",
            shared_pages,
        ),
        encoding="utf-8",
    )

    (wiki_dir / "_Sidebar.md").write_text(
        _build_sidebar(project_pages=project_pages, adr_pages=adr_pages, shared_pages=shared_pages),
        encoding="utf-8",
    )
    (wiki_dir / "_Footer.md").write_text(
        (
            "Synced automatically from canonical repository docs "
            "(`docs/projects/veterinary-medical-records`, `docs/shared`, and "
            "`README.md`).\n"
        ),
        encoding="utf-8",
    )

    keep = {f"{page}.md" for page in mapping.values()}
    keep.update({"Project.md", "Shared.md", "_Sidebar.md", "_Footer.md"})
    for md_file in wiki_dir.glob("*.md"):
        if md_file.name not in keep:
            md_file.unlink()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
