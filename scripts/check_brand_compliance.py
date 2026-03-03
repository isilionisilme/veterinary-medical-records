from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "quality" / "lint" / "check_brand_compliance.py"
_original_name = __name__
_original_file = __file__

globals()["__name__"] = "scripts.check_brand_compliance_proxy"
globals()["__file__"] = str(TARGET)
exec(compile(TARGET.read_text(encoding="utf-8"), str(TARGET), "exec"), globals())
globals()["__name__"] = _original_name
globals()["__file__"] = _original_file

if __name__ == "__main__":
	print("[DEPRECATED] Use scripts/quality/lint/check_brand_compliance.py", file=sys.stderr)
	raise SystemExit(main())
