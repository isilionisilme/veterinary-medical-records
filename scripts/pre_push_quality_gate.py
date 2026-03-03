from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "ci" / "preflight" / "pre_push_quality_gate.py"
print("[DEPRECATED] Use scripts/ci/preflight/pre_push_quality_gate.py", file=sys.stderr)
runpy.run_path(str(TARGET), run_name="__main__")
