from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "docs" / "check_no_canonical_router_refs.py"

_SPEC = importlib.util.spec_from_file_location("scripts.docs.check_no_canonical_router_refs", TARGET)
if _SPEC is None or _SPEC.loader is None:
	raise RuntimeError(f"Could not load target script: {TARGET}")
_MODULE = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(_MODULE)

for _name in dir(_MODULE):
	if _name.startswith("__") and _name not in {"__doc__", "__all__"}:
		continue
	globals()[_name] = getattr(_MODULE, _name)


if __name__ == "__main__":
	print("[DEPRECATED] Use scripts/docs/check_no_canonical_router_refs.py", file=sys.stderr)
	raise SystemExit(_MODULE.main())
