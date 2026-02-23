"""Legacy compatibility shim for processing subsystem."""

# Legacy shim — imports moved to backend.app.application.processing/
from backend.app.application.processing import interpretation as _interpretation
from backend.app.application.processing import orchestrator as _orchestrator
from backend.app.application.processing import pdf_extraction as _pdf_extraction
from backend.app.application.processing import scheduler as _scheduler


def _reexport_all(module: object) -> None:
    namespace = getattr(module, "__dict__", {})
    for name, value in namespace.items():
        if name.startswith("__"):
            continue
        globals().setdefault(name, value)


for _module in (_scheduler, _orchestrator, _interpretation, _pdf_extraction):
    _reexport_all(_module)

del _module
del _reexport_all
del _scheduler
del _orchestrator
del _interpretation
del _pdf_extraction
