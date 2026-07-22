#!/usr/bin/env python3
"""Local preview API for the scraper snapshot.

This serves the same JSON shape as the production worker for the routes that
Astro uses during build and for the file links used in the rendered pages.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse


def is_pdf(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".pdf"


def build_subtree(root: Path, relative_path: str) -> dict[str, Any]:
    target = (root / relative_path).resolve()
    if not target.exists() or not target.is_dir():
        return {}

    subtree: dict[str, Any] = {}
    for entry in sorted(target.iterdir(), key=lambda item: item.name):
        if entry.is_dir():
            child = build_subtree(root, str(entry.relative_to(root)))
            if child:
                subtree[entry.name] = child
        elif is_pdf(entry):
            subtree[entry.name] = entry.relative_to(root).as_posix()
    return subtree


def resolve_content_path(subject: str, page: str) -> Path:
    subject_lower = subject.lower()
    page_lower = page.lower()

    if subject_lower == "admitere":
        if page_lower.endswith("/extra"):
            subsubject = page_lower.removesuffix("/extra")
            return files_root / "admitere" / subsubject / "extra"
        return files_root / "admitere" / page_lower / "admitere"

    if page_lower == "extra":
        return files_root / subject_lower / "extra"

    return files_root / subject_lower / "pages" / page_lower


def resolve_extra_path(subject: str, page: str) -> Path:
    subject_lower = subject.lower()
    page_lower = page.lower()

    if subject_lower == "admitere":
        return files_root / "admitere" / page_lower / "extra"

    return files_root / subject_lower / "extra"


def extract_years(structure: dict[str, Any]) -> list[int]:
    years: set[int] = set()

    def walk(node: dict[str, Any]) -> None:
        for key, value in node.items():
            if key.isdigit() and len(key) == 4 and key.startswith("20"):
                years.add(int(key))
            if isinstance(value, dict):
                walk(value)

    walk(structure)
    return sorted(years, reverse=True)


def build_structure() -> dict[str, list[str]]:
    structure: dict[str, list[str]] = {}
    if not files_root.exists():
        return structure

    for subject_dir in sorted(
        (entry for entry in files_root.iterdir() if entry.is_dir()),
        key=lambda item: item.name,
    ):
        subject = subject_dir.name
        if subject == "temp":
            continue

        if subject == "admitere":
            pages = [
                entry.name
                for entry in sorted(subject_dir.iterdir(), key=lambda item: item.name)
                if entry.is_dir()
            ]
            if pages:
                structure[subject] = pages
            continue

        pages_dir = subject_dir / "pages"
        if pages_dir.is_dir():
            pages = [
                entry.name
                for entry in sorted(pages_dir.iterdir(), key=lambda item: item.name)
                if entry.is_dir()
            ]
            if pages:
                structure[subject] = pages

    return structure


class PreviewRequestHandler(BaseHTTPRequestHandler):
    server_version = "CuzaPreviewAPI/1.0"

    def _send_json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_text(self, payload: str, status: int = 200, content_type: str = "text/plain; charset=utf-8") -> None:
        body = payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/ping":
            self._send_text("Pong!", 200)
            return

        if path == "/structure":
            self._send_json(build_structure())
            return

        if path == "/files":
            query = parse_qs(parsed.query)
            subject = query.get("subject", [""])[0]
            page = query.get("page", [""])[0]
            if not subject or not page:
                self._send_json({"error": "Missing subject or page"}, 400)
                return

            content_path = resolve_content_path(subject, page)
            extra_path = resolve_extra_path(subject, page)
            content = build_subtree(files_root, str(content_path.relative_to(files_root))) if content_path.exists() else {}
            extra = build_subtree(files_root, str(extra_path.relative_to(files_root))) if extra_path.exists() else {}
            self._send_json({"content": content, "extra": extra, "years": extract_years(content)})
            return

        if path.startswith("/file/"):
            key = unquote(path.removeprefix("/file/"))
            if not key or ".." in key or key.startswith("/"):
                self._send_text("Invalid key", 400)
                return

            file_path = (files_root / key).resolve()
            try:
                file_path.relative_to(files_root.resolve())
            except ValueError:
                self._send_text("Invalid key", 400)
                return

            if not file_path.exists() or not file_path.is_file():
                self._send_text("Not Found", 404)
                return

            with file_path.open("rb") as file_handle:
                data = file_handle.read()

            content_type = mimetypes.guess_type(file_path.name)[0] or "application/pdf"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(data)
            return

        self._send_text("Not Found", 404)


def main() -> int:
    parser = argparse.ArgumentParser(description="Local preview API for scraper files")
    parser.add_argument("--files-dir", required=True, help="Directory containing the local scraper snapshot")
    parser.add_argument("--port", type=int, default=8788, help="Port to bind (default: 8788)")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    args = parser.parse_args()

    global files_root
    files_root = Path(args.files_dir).expanduser().resolve()

    if not files_root.exists():
        raise SystemExit(f"Files directory not found: {files_root}")

    server = ThreadingHTTPServer((args.host, args.port), PreviewRequestHandler)
    print(f"Preview API listening on http://{args.host}:{args.port}")
    print(f"Using local files directory: {files_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
