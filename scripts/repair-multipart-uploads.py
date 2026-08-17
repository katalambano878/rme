#!/usr/bin/env python3
"""Repair product-images saved as raw multipart form wrappers."""
from __future__ import annotations

import json
import os
import re
import sys

STORAGE_ROOT = os.environ.get(
    "STORAGE_ROOT", "/data/coolify/rme-staging/storage/product-images"
)

MIME = {
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "gif": "image/gif",
}


def is_multipart(data: bytes) -> bool:
    return len(data) > 4 and data[:2] == b"--"


def extract_upload_body(data: bytes) -> bytes | None:
    if not is_multipart(data):
        return None
    first = data.split(b"\r\n", 1)[0]
    if not first.startswith(b"--"):
        return None
    boundary = first[2:]
    delim = b"--" + boundary
    parts = data.split(delim)
    best: bytes | None = None
    for part in parts:
        p = part.strip(b"\r\n")
        if not p:
            continue
        hdr_end = p.find(b"\r\n\r\n")
        if hdr_end == -1:
            continue
        headers = p[:hdr_end].decode("utf8", "ignore").lower()
        body = p[hdr_end + 4 :].strip(b"\r\n-")
        has_file = "filename=" in headers
        is_image = (
            "content-type: image/" in headers
            or body.startswith(b"\x89PNG")
            or body.startswith(b"\xff\xd8")
            or body[:4] == b"RIFF"
            or body[:3] == b"GIF"
        )
        if (has_file or is_image) and (best is None or len(body) > len(best)):
            best = body
    return best if best and len(best) > 0 else None


def guess_mime(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower()
    return MIME.get(ext, "image/jpeg")


def main() -> int:
    if not os.path.isdir(STORAGE_ROOT):
        print("missing", STORAGE_ROOT, file=sys.stderr)
        return 1
    fixed = 0
    skipped = 0
    for name in os.listdir(STORAGE_ROOT):
        if name.endswith(".meta.json"):
            continue
        path = os.path.join(STORAGE_ROOT, name)
        if not os.path.isfile(path):
            continue
        with open(path, "rb") as f:
            raw = f.read()
        if not is_multipart(raw):
            skipped += 1
            continue
        extracted = extract_upload_body(raw)
        if not extracted or is_multipart(extracted):
            print("FAIL", name)
            continue
        with open(path, "wb") as f:
            f.write(extracted)
        meta = os.path.join(STORAGE_ROOT, name + ".meta.json")
        with open(meta, "w", encoding="utf-8") as f:
            json.dump({"contentType": guess_mime(name)}, f)
        fixed += 1
        print("FIXED", name, len(raw), "->", len(extracted))
    print("done fixed", fixed, "skipped", skipped)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
