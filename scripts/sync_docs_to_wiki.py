#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path

ROOT_README = Path("README.md")
DOCS_README = Path("docs/README.md")
PROJECT_ROOT = Path("docs/projects/veterinary-medical-records")
SHARED_ROOT = Path("docs/shared")
ADR_ROOT = Path("docs/projects/veterinary-medical-records/02-tech/adr")
PROJECT_OVERVIEW = Path("docs/projects/veterinary-medical-records/00-overview.md")
PROJECT_INDEX_PAGE = "veterinary-medical-records"
PROJECT_INDEX_TITLE = "2026-03-02 Veterinary Medical Records"

# Fixed page names for well-known READMEs (avoids stem collisions).
_FIXED_NAMES: dict[str, str] = {
    DOCS_README.as_posix(): "Home",
    ROOT_README.as_posix(): "README",
    PROJECT_OVERVIEW.as_posix(): PROJECT_INDEX_PAGE,
    f"{PROJECT_ROOT.as_posix()}/README.md": "Project-Overview",
    f"{ADR_ROOT.as_posix()}/README.md": "ADR-Index",
}


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


def _build_mapping(sources: list[Path]) -> dict[Path, str]:
    """Map each source doc to a short, unique wiki page name."""
    desired: dict[Path, str] = {}
    for source in sources:
        fixed = _FIXED_NAMES.get(source.as_posix())
        if fixed:
            desired[source] = fixed
        else:
            desired[source] = _slug(source.stem)

    # Disambiguate any remaining collisions by prefixing parent folder.
    counts = Counter(desired.values())
    collisions = {name for name, n in counts.items() if n > 1}
    if collisions:
        for source in list(desired.keys()):
            if desired[source] in collisions:
                parent = _slug(source.parent.name)
                desired[source] = f"{parent}-{_slug(source.stem)}"

    return desired


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


def _collect_tree(
    mapping: dict[Path, str],
    root: Path,
) -> dict[str, object]:
    tree: dict[str, object] = {}
    for source, page in mapping.items():
        source_posix = source.as_posix()
        root_posix = root.as_posix().rstrip("/") + "/"
        if not source_posix.startswith(root_posix):
            continue

        rel = source.relative_to(root)
        parts = list(rel.parts)
        if not parts:
            continue

        node: dict[str, object] = tree
        for folder in parts[:-1]:
            child = node.setdefault(folder, {})
            if not isinstance(child, dict):
                child = {}
                node[folder] = child
            node = child

        files = node.setdefault("__files__", [])
        if isinstance(files, list):
            files.append((rel.stem, page))

    return tree


def _render_tree_lines(
    tree: dict[str, object],
    indent: str = "",
    depth: int = 1,
    max_depth: int = 3,
    folder_pages: dict[str, str] | None = None,
) -> list[str]:
    """Render a nested tree as indented Markdown list lines.

    *depth* tracks the current nesting level (1-based).  When *depth*
    exceeds *max_depth*, children are suppressed — the user navigates
    to deeper content via the folder's own index page.

    *folder_pages* maps a folder slug (e.g. ``01-design``) to its
    wiki page name so the folder label becomes a clickable link.
    """
    if folder_pages is None:
        folder_pages = {}
    lines: list[str] = []

    files = tree.get("__files__", [])
    if isinstance(files, list):
        for label, page in sorted(files, key=lambda item: item[0].lower()):
            lines.append(f"{indent}- [[{page}|{label}]]")

    folders = [key for key in tree.keys() if key != "__files__"]
    for folder in sorted(folders, key=str.lower):
        page_name = folder_pages.get(folder)
        if page_name:
            lines.append(f"{indent}- [[{page_name}|{folder}]]")
        else:
            lines.append(f"{indent}- {folder}")
        child = tree.get(folder)
        if isinstance(child, dict) and depth < max_depth:
            lines.extend(
                _render_tree_lines(
                    child,
                    indent=indent + "  ",
                    depth=depth + 1,
                    max_depth=max_depth,
                    folder_pages=folder_pages,
                )
            )

    return lines


def _build_sidebar(
    mapping: dict[Path, str],
    folder_pages: dict[str, str] | None = None,
    max_depth: int = 3,
) -> str:
    project_tree = _collect_tree(mapping, PROJECT_ROOT)
    shared_tree = _collect_tree(mapping, SHARED_ROOT)
    project_tree_sidebar = {k: v for k, v in project_tree.items() if k != "__files__"}

    lines = [
        "## Documentation",
        "",
        "- [[Home]]",
        "- [Shared Documentation](Shared)",
    ]
    lines.extend(
        _render_tree_lines(
            shared_tree,
            indent="  ",
            depth=2,
            max_depth=max_depth,
            folder_pages=folder_pages or {},
        )
    )

    lines.append("- [[Projects]]")
    lines.append(f"  - [{PROJECT_INDEX_TITLE}]({PROJECT_INDEX_PAGE})")
    lines.extend(
        _render_tree_lines(
            project_tree_sidebar,
            indent="    ",
            depth=3,
            max_depth=max_depth,
            folder_pages=folder_pages or {},
        )
    )

    lines.append("")
    return "\n".join(lines)


def _build_section_landing(title: str, intro: str, pages: list[str]) -> str:
    lines = [f"# {title}", "", intro, "", "## Pages", ""]
    for page in pages:
        lines.append(f"- [[{page}]]")
    lines.append("")
    return "\n".join(lines)


def _build_folder_index(
    folder_name: str,
    child_pages: list[tuple[str, str]],
    child_folders: list[str],
    folder_pages: dict[str, str],
    display_title: str | None = None,
) -> str:
    """Auto-generate an index page for a category folder.

    *child_pages* is a list of ``(label, wiki_page_name)`` tuples.
    *child_folders* lists sub-folder names that also have index pages.
    """
    if display_title is not None:
        display = display_title
    elif "-" in folder_name:
        display = folder_name.split("-", 1)[-1].replace("-", " ").title()
    else:
        display = folder_name.replace("-", " ").title()
    lines = [f"# {display}", ""]
    if child_pages:
        lines.append("## Documents")
        lines.append("")
        for label, page in sorted(child_pages, key=lambda x: x[0].lower()):
            lines.append(f"- [[{page}|{label}]]")
        lines.append("")
    if child_folders:
        lines.append("## Sub-sections")
        lines.append("")
        for cf in sorted(child_folders, key=str.lower):
            page_name = folder_pages.get(cf, cf)
            lines.append(f"- [[{page_name}|{cf}]]")
        lines.append("")
    return "\n".join(lines)


def _auto_generate_folder_indices(
    mapping: dict[Path, str],
    root: Path,
    wiki_dir: Path,
) -> dict[str, str]:
    """Walk the tree under *root* and generate wiki index pages for folders.

    Returns a ``{folder_name: wiki_page_name}`` dict so the sidebar can
    render folders as clickable links.  Page names equal the folder name
    (e.g. ``01-design``, ``adr``), keeping the wiki URL clean.
    """
    tree = _collect_tree(mapping, root)
    folder_pages: dict[str, str] = {}
    _generate_indices_recursive(tree, wiki_dir, folder_pages)
    return folder_pages


def _generate_indices_recursive(
    tree: dict[str, object],
    wiki_dir: Path,
    folder_pages: dict[str, str],
) -> None:
    folders = [k for k in tree if k != "__files__"]
    for folder in folders:
        child = tree[folder]
        if not isinstance(child, dict):
            continue

        # Use the folder name itself as the wiki page name.
        page_name = folder
        folder_pages[folder] = page_name

        child_pages: list[tuple[str, str]] = []
        files = child.get("__files__", [])
        if isinstance(files, list):
            child_pages = list(files)

        child_folders = [k for k in child if k != "__files__"]

        _generate_indices_recursive(child, wiki_dir, folder_pages)

        content = _build_folder_index(folder, child_pages, child_folders, folder_pages)
        (wiki_dir / f"{page_name}.md").write_text(content, encoding="utf-8")


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
    mapping = _build_mapping(sources)

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
                "docs/projects/veterinary-medical-records/02-tech/adr/"
            )
        ]
    )
    adr_pages = sorted(
        [
            page
            for source, page in mapping.items()
            if source.as_posix().startswith("docs/projects/veterinary-medical-records/02-tech/adr/")
        ]
    )
    shared_pages = sorted(
        [page for source, page in mapping.items() if source.as_posix().startswith("docs/shared/")]
    )

    (wiki_dir / "Projects.md").write_text(
        _build_section_landing(
            "Projects",
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

    # Auto-generate index pages for category folders
    project_folder_pages = _auto_generate_folder_indices(
        mapping,
        PROJECT_ROOT,
        wiki_dir,
    )
    shared_folder_pages = _auto_generate_folder_indices(
        mapping,
        SHARED_ROOT,
        wiki_dir,
    )
    all_folder_pages = {**project_folder_pages, **shared_folder_pages}

    (wiki_dir / "_Sidebar.md").write_text(
        _build_sidebar(mapping, folder_pages=all_folder_pages, max_depth=3),
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
    keep.add(f"{PROJECT_INDEX_PAGE}.md")
    keep.update({"Projects.md", "Shared.md", "_Sidebar.md", "_Footer.md"})
    # Keep auto-generated index pages
    keep.update(f"{page}.md" for page in all_folder_pages.values())
    for md_file in wiki_dir.glob("*.md"):
        if md_file.name not in keep:
            md_file.unlink()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
