from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ROUTER_ROOT = REPO_ROOT / "docs" / "agent_router"
ROOT_AGENTS = REPO_ROOT / "AGENTS.md"
AUTHORITY_DOC = ROUTER_ROOT / "00_AUTHORITY.md"
FALLBACK_DOC = ROUTER_ROOT / "00_FALLBACK.md"
RULES_INDEX_DOC = ROUTER_ROOT / "00_RULES_INDEX.md"

DOC_REF_PATTERN = re.compile(r"(docs/[A-Za-z0-9_./-]+\.md)")

MAX_ROOT_AGENTS_CHARS = 4000
MAX_AUTHORITY_CHARS = 3000


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _extract_doc_refs(text: str) -> set[str]:
    return set(DOC_REF_PATTERN.findall(text))


def test_entrypoint_contract_paths_exist() -> None:
    assert ROOT_AGENTS.exists(), "Missing root AGENTS.md entrypoint."
    assert AUTHORITY_DOC.exists(), "Missing authority router document."
    assert FALLBACK_DOC.exists(), "Missing fallback router document."
    assert RULES_INDEX_DOC.exists(), "Missing rules index document."

    agents_text = _read_text(ROOT_AGENTS)
    assert "docs/agent_router/00_AUTHORITY.md" in agents_text
    assert "docs/agent_router/00_FALLBACK.md" in agents_text


def test_entrypoint_docs_stay_small() -> None:
    assert len(_read_text(ROOT_AGENTS)) <= MAX_ROOT_AGENTS_CHARS
    assert len(_read_text(AUTHORITY_DOC)) <= MAX_AUTHORITY_CHARS


def test_router_doc_references_resolve() -> None:
    missing_refs: list[str] = []

    for markdown_file in ROUTER_ROOT.rglob("*.md"):
        for ref in _extract_doc_refs(_read_text(markdown_file)):
            if not (REPO_ROOT / ref).exists():
                missing_refs.append(f"{markdown_file}: {ref}")

    assert not missing_refs, "Found unresolved docs references:\n" + "\n".join(missing_refs)


def test_rules_index_owner_modules_exist() -> None:
    missing_refs: list[str] = []

    for ref in _extract_doc_refs(_read_text(RULES_INDEX_DOC)):
        if not (REPO_ROOT / ref).exists():
            missing_refs.append(ref)

    assert not missing_refs, "Rules index references missing files:\n" + "\n".join(missing_refs)


def test_router_docs_do_not_use_legacy_top_level_paths() -> None:
    forbidden_paths = (
        "docs/00_AUTHORITY.md",
        "docs/00_FALLBACK.md",
        "docs/00_RULES_INDEX.md",
        "docs/01_WORKFLOW/",
        "docs/02_PRODUCT/",
        "docs/03_SHARED/",
        "docs/04_PROJECT/",
    )
    violations: list[str] = []

    for markdown_file in ROUTER_ROOT.rglob("*.md"):
        text = _read_text(markdown_file)
        for forbidden in forbidden_paths:
            if forbidden in text:
                violations.append(f"{markdown_file}: {forbidden}")

    assert not violations, "Found legacy paths in router docs:\n" + "\n".join(violations)


def test_operational_modules_do_not_directly_load_human_docs() -> None:
    forbidden_prefixes = ("docs/shared/", "docs/project/")
    violations: list[str] = []

    for subfolder in ("01_WORKFLOW", "02_PRODUCT"):
        folder = ROUTER_ROOT / subfolder
        for markdown_file in folder.rglob("*.md"):
            for ref in _extract_doc_refs(_read_text(markdown_file)):
                if ref.startswith(forbidden_prefixes):
                    violations.append(f"{markdown_file}: {ref}")

    assert not violations, (
        "Operational modules should route through docs/agent_router/*, "
        "not direct human docs:\n" + "\n".join(violations)
    )


def test_project_split_entries_include_new_product_and_ux_modules() -> None:
    product_entry = _read_text(
        ROUTER_ROOT / "04_PROJECT" / "PRODUCT_DESIGN" / "00_entry.md"
    )
    ux_entry = _read_text(ROUTER_ROOT / "04_PROJECT" / "UX_DESIGN" / "00_entry.md")

    assert (
        "docs/agent_router/04_PROJECT/PRODUCT_DESIGN/75_4-4-critical-non-reversible-changes-policy.md"
        in product_entry
    )
    assert (
        "docs/agent_router/04_PROJECT/PRODUCT_DESIGN/76_conceptual-model-local-schema-global-schema-and-mapping.md"
        in product_entry
    )
    assert (
        "docs/agent_router/04_PROJECT/PRODUCT_DESIGN/77_global-schema-v0-canonical-field-list.md"
        in product_entry
    )
    assert (
        "docs/agent_router/04_PROJECT/UX_DESIGN/55_review-ui-rendering-rules-global-schema-v0-template.md"
        in ux_entry
    )


def test_project_split_entry_includes_frontend_global_schema_rendering_module() -> None:
    frontend_entry = _read_text(
        ROUTER_ROOT / "04_PROJECT" / "FRONTEND_IMPLEMENTATION" / "00_entry.md"
    )
    assert (
        "docs/agent_router/04_PROJECT/FRONTEND_IMPLEMENTATION/65_review-rendering-backbone-global-schema-v0.md"
        in frontend_entry
    )


def test_project_split_entry_includes_implementation_plan_us32_module() -> None:
    plan_entry = _read_text(
        ROUTER_ROOT / "04_PROJECT" / "IMPLEMENTATION_PLAN" / "00_entry.md"
    )
    release6 = _read_text(
        ROUTER_ROOT
        / "04_PROJECT"
        / "IMPLEMENTATION_PLAN"
        / "120_release-6-explicit-overrides-workflow-closure.md"
    )

    assert (
        "docs/agent_router/04_PROJECT/IMPLEMENTATION_PLAN/275_us-32-align-review-rendering-to-global-schema-v0-template.md"
        in plan_entry
    )
    assert "US-32 — Align review rendering to Global Schema v0 template" in release6
