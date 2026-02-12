from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
ROOT_AGENTS = REPO_ROOT / "AGENTS.md"
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
RULES_INDEX = REPO_ROOT / "docs" / "agent_router" / "00_RULES_INDEX.md"
SCENARIOS = REPO_ROOT / "metrics" / "llm_benchmarks" / "SCENARIOS.md"


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _index_or_fail(text: str, needle: str) -> int:
    pos = text.find(needle)
    assert pos >= 0, f"Expected text not found: {needle}"
    return pos


def test_trigger_coverage_a_b_c_d_e_is_documented() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    assert "A: user specifies document(s)" in text
    assert "B: user does not specify docs" in text
    assert "C: user asks to update a legacy/reference doc" in text
    assert "Use case D" in text
    assert "Use case E" in text


def test_diff_first_flow_is_deterministic_and_ordered() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    idx_discover = _index_or_fail(text, "git status --porcelain")
    idx_name_status = _index_or_fail(text, "git diff --name-status")
    idx_single_diff = _index_or_fail(text, "git diff -- <path>")
    idx_normalize = _index_or_fail(text, "Run the Normalization Pass")
    assert idx_discover < idx_normalize
    assert idx_name_status < idx_normalize
    assert idx_single_diff < idx_normalize


def test_fallback_and_rule_id_paths_are_enforced() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    assert "ask the user for file paths and a snippet/diff" in text
    assert "If snippet lacks file path or section context" in text
    assert "Look up `<RULE_ID>` in `docs/agent_router/00_RULES_INDEX.md`." in text
    assert "If missing/invalid, STOP and ask for a valid rule id or owner path." in text


def test_required_summary_output_contract_is_complete() -> None:
    text = _read_text(DOC_UPDATES_ENTRY)
    assert "DOC_UPDATES Summary" in text
    assert "| Source doc (inspected) | Diff inspected | Classification |" in text
    assert "Related tests/guards updated" in text
    assert "Rule change / Clarification / Navigation" in text
    assert "Propagation gaps" in text
    assert "show me the unpropagated changes" in text.lower()
    assert "muestrame los cambios no propagados" in text.lower()


def test_normalize_rules_enforce_propagation_before_summary() -> None:
    text = _read_text(DOC_UPDATES_NORMALIZE)
    idx_owner_update = _index_or_fail(text, "update/create owner module before summary output")
    idx_emit_summary = _index_or_fail(text, "Emit required summary (`00_entry.md`):")
    idx_fail_condition = _index_or_fail(
        text,
        "if Rule change exists with no propagation and no blocker reason, treat as failure.",
    )
    assert idx_owner_update < idx_emit_summary
    assert idx_emit_summary < idx_fail_condition


def test_ambiguity_handling_and_known_mappings_are_present() -> None:
    normalize_text = _read_text(DOC_UPDATES_NORMALIZE)
    rules_text = _read_text(RULES_INDEX)
    assert "do not auto-pick silently" in normalize_text
    assert "Known mapping hints" in rules_text
    assert "50_3-typography-exact-fonts-mandatory.md" in rules_text
    assert "40_2-color-system-exact-values-mandatory.md" in rules_text
    assert "04_PROJECT/UX_DESIGN/00_entry.md" in rules_text


def test_agents_trigger_and_post_change_hook_remain_short_and_routed() -> None:
    text = _read_text(ROOT_AGENTS)
    lower = text.lower()
    assert "docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md" in text
    assert "any language or paraphrase" in lower
    assert "run the doc_updates normalization pass once" in lower
    assert len(text) < 4000


def test_checklist_requires_outputs_and_anti_loop() -> None:
    text = _read_text(DOC_UPDATES_CHECKLIST)
    assert "Normaliz" in text and "no loop" in text.lower()
    assert "DOC_UPDATES Summary" in text
    assert "Docs processed table" in text
    assert "Propagation gaps" in text
    assert "test_impact_map.json" in text


def test_doc_updates_test_impact_map_covers_router_and_brand_docs() -> None:
    text = _read_text(DOC_UPDATES_TEST_IMPACT_MAP)
    assert "docs/agent_router/**/*.md" in text
    assert "docs/shared/BRAND_GUIDELINES.md" in text


def test_benchmark_scenarios_cover_doc_updates_edge_cases() -> None:
    text = _read_text(SCENARIOS)
    for scenario_id in (
        "doc_updates_trigger_d_no_git",
        "doc_updates_trigger_e_rule_id",
        "doc_updates_mixed_classification",
        "doc_updates_rename_untracked",
        "doc_updates_ambiguous_owner",
    ):
        assert f"## {scenario_id}" in text
