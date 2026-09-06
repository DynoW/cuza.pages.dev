#!/usr/bin/env python3
"""Shared utilities for web-scraper scripts."""

from __future__ import annotations

import base64
import os
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


UPLOAD_CHUNK_SIZE = 20
DEFAULT_WORKER_URL = 'https://api.my-lab.ro'


def get_worker_url() -> str:
    return os.environ.get('PUBLIC_WORKER_URL', DEFAULT_WORKER_URL)


def get_upload_password() -> str:
    return os.environ.get('UPLOAD_PASSWORD') or os.environ.get('WORKER_UPLOAD_PASSWORD') or ''


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


def build_auth_header(password: str) -> dict[str, str]:
    token = base64.b64encode(f"scraper:{password}".encode('utf-8')).decode('utf-8')
    return {'Authorization': f'Bearer {token}'}


def create_retry_session(total_retries: int = 3, backoff_factor: float = 0.5) -> requests.Session:
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


def trigger_deploy(session: requests.Session, worker_url: str, password: str, timeout: int = 30) -> bool:
    try:
        response = session.post(
            f"{worker_url.rstrip('/')}/trigger-deploy",
            headers=build_auth_header(password),
            timeout=timeout,
        )
    except requests.RequestException as error:
        print(f"Deploy trigger error: {error}")
        return False

    if response.ok:
        print("Deploy triggered successfully.")
        return True

    print(f"Deploy trigger failed ({response.status_code}): {response.text}")
    return False


def upload_chunk(session: requests.Session, worker_url: str, password: str, uploads: list[tuple[Path, str]]) -> list[bool]:
    """Upload one chunk of (path, key) pairs to the worker in a single request."""
    file_handles = []
    try:
        files = []
        data = []
        for path, key in uploads:
            fh = path.open('rb')
            file_handles.append(fh)
            files.append(('file', (path.name, fh, 'application/pdf')))
            data.append(('key', key))

        response = session.post(
            f"{worker_url.rstrip('/')}/upload-batch",
            headers=build_auth_header(password),
            files=files,
            data=data,
            timeout=300,
        )

        if response.ok:
            try:
                body = response.json()
            except ValueError:
                print(f"  Batch upload failed: invalid JSON response: {response.text[:200]}")
                return [False] * len(uploads)
            count = body.get('count', len(uploads))
            print(f"  Batch uploaded {count} file(s)")
            return [True] * len(uploads)

        print(f"  Batch upload failed ({response.status_code}): {response.text}")
        return [False] * len(uploads)
    except (requests.RequestException, OSError) as error:
        print(f"  Batch upload error: {error}")
        return [False] * len(uploads)
    finally:
        for fh in file_handles:
            fh.close()


def batch_upload_to_r2(session: requests.Session, worker_url: str, password: str, uploads: list[tuple[Path, str]]) -> list[bool]:
    """Upload files to R2 in chunks to stay under request size limits."""
    results: list[bool] = []
    for i in range(0, len(uploads), UPLOAD_CHUNK_SIZE):
        chunk = uploads[i:i + UPLOAD_CHUNK_SIZE]
        results.extend(upload_chunk(session, worker_url, password, chunk))
    return results
