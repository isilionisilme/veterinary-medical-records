from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ROOT_AGENTS = REPO_ROOT / "AGENTS.md"
DOC_UPDATES_ENTRY = REPO_ROOT / "docs" / "01_WORKFLOW" / "DOC_UPDATES" / "00_entry.md"
DOC_UPDATES_NORMALIZE = (
    REPO_ROOT / "docs" / "01_WORKFLOW" / "DOC_UPDATES" / "20_normalize_rules.md"
)
DOC_UPDATES_CHECKLIST = REPO_ROOT / "docs" / "01_WORKFLOW" / "DOC_UPDATES" / "30_checklist.md"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_doc_updates_core_files_exist() -> None:
    assert ROOT_AGENTS.exists(), "Missing AGENTS.md router entrypoint."
    assert DOC_UPDATES_ENTRY.exists(), "Missing DOC_UPDATES entry module."
    assert DOC_UPDATES_NORMALIZE.exists(), "Missing DOC_UPDATES normalization module."
    assert DOC_UPDATES_CHECKLIST.exists(), "Missing DOC_UPDATES checklist module."


def test_agents_routes_docs_updated_intent_to_doc_updates() -> None:
    text = _read_text(ROOT_AGENTS)
    lower = text.lower()
    assert "docs/01_WORKFLOW/DOC_UPDATES/00_entry.md" in text
    assert "documentation was updated" in lower
    assert "run the doc_updates normalization pass once" in lower


def test_doc_updates_entry_defines_three_triggers_and_git_discovery() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    assert "A: user specifies document(s)" in text
    assert "B: user does not specify docs" in text
    assert "C: user asks to update a legacy/reference doc" in text
    assert "git status" in text
    assert "git diff --name-only" in text
    assert "files cannot be discovered" in text


def test_normalization_rules_define_rcn_classification_and_owner_registry() -> None:
    text = _read_text(DOC_UPDATES_NORMALIZE)
    assert "R = rule change" in text
    assert "C = clarification" in text
    assert "N = navigation, structure, or links" in text
    assert "docs/agent_router/00_RULES_INDEX.md" in text
    assert "docs/agent_router/00_AUTHORITY.md" in text
    assert "Apply this pass to each changed documentation file" in text


def test_checklist_enforces_links_and_anti_loop() -> None:
    text = _read_text(DOC_UPDATES_CHECKLIST)
    assert "links" in text.lower()
    assert "Markdown fences" in text
    assert "Normalized docs list" in text
