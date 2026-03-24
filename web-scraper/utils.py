#!/usr/bin/env python3
"""Shared utilities for web-scraper scripts."""

from __future__ import annotations

import base64
import os
from pathlib import Path


def load_local_env(env_path: Path) -> None:
    """Load KEY=VALUE pairs from a local .env file if variables are missing."""
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding='utf-8').splitlines():
        entry = line.strip()
        if not entry or entry.startswith('#') or '=' not in entry:
            continue

        key, value = entry.split('=', 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def build_bearer_auth_header(username: str, password: str) -> dict[str, str]:
    token = base64.b64encode(f"{username}:{password}".encode('utf-8')).decode('utf-8')
    return {'Authorization': f'Bearer {token}'}


def create_retry_session(total_retries: int = 3, backoff_factor: float = 0.5) -> "requests.Session":
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    retry = Retry(
        total=total_retries,
        read=total_retries,
        connect=total_retries,
        backoff_factor=backoff_factor,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=frozenset(['GET', 'POST']),
        raise_on_status=False,
    )

    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount('http://', adapter)
    session.mount('https://', adapter)
    return session
