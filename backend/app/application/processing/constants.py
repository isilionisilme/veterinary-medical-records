"""Shared constants for processing modules."""

from __future__ import annotations

import re

_NAME_TOKEN_PATTERN = re.compile(r"^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\.-]*$")
