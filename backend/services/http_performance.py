"""HTTP caching (ETag / Cache-Control) and gzip compression helpers (Web Tricks #4 & #11)."""

import gzip
import hashlib
from flask import request

COMPRESSIBLE_PREFIXES = (
    "application/json",
    "text/html",
    "text/css",
    "text/plain",
    "application/javascript",
)

CACHEABLE_FINANCE_PREFIXES = (
    "/api/finance/",
    "/api/admin/finance/",
)

LONG_CACHE_PATHS = (
    "/api/finance/taxonomy",
)

NO_STORE_PREFIXES = (
    "/api/login",
    "/api/register",
    "/api/logout",
    "/api/me",
)


def apply_cache_and_compression(response):
    """Apply Cache-Control / ETag / 304 and gzip compression safely in after_request."""
    path = request.path or "/"
    method = request.method.upper()

    # Enforce strict no-store on mutations and authentication routes
    if method != "GET" or any(path.startswith(p) for p in NO_STORE_PREFIXES):
        response.headers.setdefault("Cache-Control", "no-store")
    elif response.status_code == 200 and any(path.startswith(p) for p in CACHEABLE_FINANCE_PREFIXES):
        max_age = 120 if any(path.startswith(p) for p in LONG_CACHE_PATHS) else 30
        response.headers.setdefault(
            "Cache-Control",
            f"private, max-age={max_age}, stale-while-revalidate=120",
        )
        if not response.direct_passthrough:
            body = response.get_data()
            if body is not None:
                etag = f'W/"{hashlib.sha256(body).hexdigest()[:24]}"'
                response.headers["ETag"] = etag
                if request.headers.get("If-None-Match") == etag:
                    response.set_data(b"")
                    response.status_code = 304
                    response.headers.pop("Content-Length", None)
                    return response

    # Apply gzip compression on larger non-streamed text/JSON GET responses (Trick #11 fallback over HTTP/1.1 & H2)
    if (
        response.status_code == 200
        and not response.direct_passthrough
        and "Content-Encoding" not in response.headers
        and "gzip" in (request.headers.get("Accept-Encoding") or "").lower()
    ):
        ctype = (response.content_type or "").split(";")[0].strip().lower()
        if any(ctype.startswith(p) for p in COMPRESSIBLE_PREFIXES):
            raw = response.get_data()
            if raw and len(raw) > 1024:
                compressed = gzip.compress(raw, compresslevel=5)
                if len(compressed) < len(raw):
                    response.set_data(compressed)
                    response.headers["Content-Encoding"] = "gzip"
                    response.headers["Content-Length"] = str(len(compressed))
                    vary = response.headers.get("Vary")
                    if vary:
                        if "Accept-Encoding" not in vary:
                            response.headers["Vary"] = f"{vary}, Accept-Encoding"
                    else:
                        response.headers["Vary"] = "Accept-Encoding"

    return response

