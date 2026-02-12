from __future__ import annotations

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT_PATH = REPO_ROOT / "scripts" / "check_doc_test_sync.py"


def _load_guard_module():
    spec = importlib.util.spec_from_file_location("check_doc_test_sync", SCRIPT_PATH)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_evaluate_sync_passes_when_no_docs_changed() -> None:
    module = _load_guard_module()
    findings = module.evaluate_sync(
        changed_files=["frontend/src/App.tsx"],
        rules=[
            {
                "doc_glob": "docs/agent_router/**/*.md",
                "required_any": ["backend/tests/unit/test_doc_updates_contract.py"],
            }
        ],
    )
    assert findings == []


def test_evaluate_sync_fails_when_mapped_doc_changes_without_related_file() -> None:
    module = _load_guard_module()
    findings = module.evaluate_sync(
        changed_files=["docs/shared/BRAND_GUIDELINES.md"],
        rules=[
            {
                "doc_glob": "docs/shared/BRAND_GUIDELINES.md",
                "required_any": ["scripts/check_brand_compliance.py"],
            }
        ],
    )
    assert len(findings) == 1
    assert "check_brand_compliance.py" in findings[0]


def test_evaluate_sync_passes_when_mapped_doc_and_related_file_change() -> None:
    module = _load_guard_module()
    findings = module.evaluate_sync(
        changed_files=[
            "docs/agent_router/01_WORKFLOW/DOC_UPDATES/00_entry.md",
            "backend/tests/unit/test_doc_updates_contract.py",
        ],
        rules=[
            {
                "doc_glob": "docs/agent_router/**/*.md",
                "required_any": ["backend/tests/unit/test_doc_updates_contract.py"],
            }
        ],
    )
    assert findings == []
