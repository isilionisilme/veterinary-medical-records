from __future__ import annotations

import runpy
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "docs" / "sync_docs_to_wiki.py"
print("[DEPRECATED] Use scripts/docs/sync_docs_to_wiki.py", file=sys.stderr)
runpy.run_path(str(TARGET), run_name="__main__")
