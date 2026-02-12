from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ROOT_AGENTS = REPO_ROOT / "AGENTS.md"
CI_WORKFLOW = REPO_ROOT / ".github" / "workflows" / "ci.yml"
RULES_INDEX = REPO_ROOT / "docs" / "agent_router" / "00_RULES_INDEX.md"
DOC_UPDATES_ENTRY = (
    REPO_ROOT / "docs" / "agent_router" / "01_WORKFLOW" / "DOC_UPDATES" / "00_entry.md"
)
DOC_UPDATES_NORMALIZE = (
    REPO_ROOT
    / "docs"
    / "agent_router"
    / "01_WORKFLOW"
    / "DOC_UPDATES"
    / "20_normalize_rules.md"
)
DOC_UPDATES_CHECKLIST = (
    REPO_ROOT / "docs" / "agent_router" / "01_WORKFLOW" / "DOC_UPDATES" / "30_checklist.md"
)
DOC_UPDATES_TEST_IMPACT_MAP = (
    REPO_ROOT
    / "docs"
    / "agent_router"
    / "01_WORKFLOW"
    / "DOC_UPDATES"
    / "test_impact_map.json"
)
DOC_TEST_SYNC_GUARD = REPO_ROOT / "scripts" / "check_doc_test_sync.py"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_doc_updates_core_files_exist() -> None:
    assert ROOT_AGENTS.exists(), "Missing AGENTS.md router entrypoint."
    assert DOC_UPDATES_ENTRY.exists(), "Missing DOC_UPDATES entry module."
    assert DOC_UPDATES_NORMALIZE.exists(), "Missing DOC_UPDATES normalization module."
    assert DOC_UPDATES_CHECKLIST.exists(), "Missing DOC_UPDATES checklist module."
    assert DOC_UPDATES_TEST_IMPACT_MAP.exists(), "Missing DOC_UPDATES test impact map."
    assert DOC_TEST_SYNC_GUARD.exists(), "Missing doc/test sync guard script."
    assert RULES_INDEX.exists(), "Missing rules index."


def test_agents_routes_docs_updated_intent_to_doc_updates() -> None:
    text = _read_text(ROOT_AGENTS)
    lower = text.lower()
    assert "docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md" in text
    assert "documentation was updated" in lower
    assert "run the doc_updates normalization pass once" in lower


def test_doc_updates_entry_covers_triggers_and_summary_schema() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    lower = text.lower()
    assert "A: user specifies document(s)" in text
    assert "B: user does not specify docs" in text
    assert "C: user asks to update a legacy/reference doc" in text
    assert "Use case D" in text
    assert "Use case E" in text
    assert "git status --porcelain" in text
    assert "git diff --name-status" in text
    assert "git diff -- <path>" in text
    assert "test_impact_map.json" in text
    assert "Related tests/guards updated" in text
    assert "DOC_UPDATES Summary" in text
    assert "Propagation gaps" in text
    assert "show me the unpropagated changes" in lower
    assert "muestrame los cambios no propagados" in lower


def test_doc_updates_entry_requires_snippet_minimum_inputs() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    assert "If snippet lacks file path or section context" in text


def test_normalization_rules_enforce_diff_first_and_owner_updates() -> None:
    text = _read_text(DOC_UPDATES_NORMALIZE)
    assert "Inspect change evidence first" in text
    assert "Rule change" in text
    assert "Clarification" in text
    assert "Navigation" in text
    assert "Mixed classification is allowed within one file" in text
    assert "update/create owner module before summary output" in text
    assert "new rule id is introduced" in text
    assert "owner module changes" in text
    assert "routing/intent changes" in text
    assert (
        "if Rule change exists with no propagation and no blocker reason, treat as failure"
        in text
    )
    assert "Known mappings" in text
    assert "do not auto-pick silently" in text


def test_checklist_enforces_discovery_and_anti_loop() -> None:
    text = _read_text(DOC_UPDATES_CHECKLIST)
    assert "git status --porcelain" in text
    assert "git diff --name-status" in text
    assert "Normaliz" in text and "no loop" in text.lower()
    assert "DOC_UPDATES Summary" in text
    assert "Propagation gaps" in text
    assert "related test/guard file was updated" in text


def test_doc_test_sync_map_has_minimum_rules() -> None:
    text = _read_text(DOC_UPDATES_TEST_IMPACT_MAP)
    assert "\"doc_glob\": \"docs/agent_router/**/*.md\"" in text
    assert "\"doc_glob\": \"docs/shared/BRAND_GUIDELINES.md\"" in text
    assert "test_doc_updates_contract.py" in text
    assert "check_brand_compliance.py" in text


def test_rules_index_contains_known_mapping_hints() -> None:
    text = _read_text(RULES_INDEX)
    assert "Known mapping hints" in text
    assert "50_3-typography-exact-fonts-mandatory.md" in text
    assert "40_2-color-system-exact-values-mandatory.md" in text
    assert "04_PROJECT/UX_DESIGN/00_entry.md" in text


def test_ci_does_not_ignore_markdown_only_changes() -> None:
    text = _read_text(CI_WORKFLOW)
    assert "paths-ignore" not in text
    assert "check_doc_test_sync.py" in text
