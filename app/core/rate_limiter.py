"""Rate limiter — a single ``Limiter`` instance shared across all routes.

Rates are IP-based by default.  Specific routes override with
``@limiter.limit("3/minute")`` etc.

Import from here rather than ``app.main`` to avoid circular imports.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
