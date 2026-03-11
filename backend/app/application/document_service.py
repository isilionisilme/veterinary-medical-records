"""Legacy shim — re-exports from documents package for backward compatibility."""

from backend.app.application import documents as _documents

__all__ = list(_documents.__all__)
globals().update({name: getattr(_documents, name) for name in __all__})
