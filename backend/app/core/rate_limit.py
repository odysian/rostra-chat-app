from slowapi import Limiter
from slowapi.util import get_remote_address

"""
Global rate limiter configuration for the API.

We keep this in a separate module so it can be reused across routers
and to make it easy to swap storage backends later (e.g. Redis).
"""

limiter = Limiter(key_func=get_remote_address)
