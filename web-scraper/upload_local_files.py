#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Manual uploader for local files -> cuza worker /upload-batch endpoint."""

import argparse
import os
from pathlib import Path
import sys

try:
    import requests
except ModuleNotFoundError:
    requests = None

from utils import build_bearer_auth_header, create_retry_session, load_local_env


def ensure_requests_installed() -> None:
    if requests is not None:
        return

    print("Error: missing Python dependency 'requests'.")
    print("Install dependencies with one of the following commands:")
    print("  python3 -m pip install -r requirements.txt")
    print("  source venv/bin/activate && python -m pip install -r requirements.txt")
    raise SystemExit(1)


def auth_header(password: str) -> dict:
    return build_bearer_auth_header('scraper', password)


def trigger_deploy(session, worker_url: str, password: str) -> bool:
    try:
        response = session.post(
            f"{worker_url.rstrip('/')}/trigger-deploy",
            headers=auth_header(password),
            timeout=30,
        )
    except requests.RequestException as error:
        print(f"Deploy trigger error: {error}")
        return False

    if response.ok:
        print("Deploy triggered successfully.")
        return True

    print(f"Deploy trigger failed ({response.status_code}): {response.text}")
    return False


def derive_key(file_path: Path, base_dir: Path, explicit_key: str | None) -> str:
    if explicit_key:
        return explicit_key

    try:
        return file_path.resolve().relative_to(base_dir.resolve()).as_posix()
    except ValueError:
        raise ValueError(f"{file_path} is outside base directory {base_dir}; use --key for this file")


def collect_pdf_files(inputs: list[str]) -> list[Path]:
    files: list[Path] = []

    for item in inputs:
        path = Path(item).expanduser().resolve()
        if not path.exists():
            raise FileNotFoundError(f'Path not found: {path}')

        if path.is_file():
            if path.suffix.lower() != '.pdf':
                print(f'Skipping non-PDF file: {path}')
                continue
            files.append(path)
            continue

        if path.is_dir():
            discovered = sorted(
                p.resolve()
                for p in path.rglob('*')
                if p.is_file() and p.suffix.lower() == '.pdf'
            )
            files.extend(discovered)
            continue

        raise FileNotFoundError(f'Unsupported path type: {path}')

    deduplicated = sorted(set(files))
    return deduplicated


def main() -> int:
    script_dir = Path(__file__).parent
    load_local_env(script_dir / '.env')
    ensure_requests_installed()
    session = create_retry_session()

    default_password = (
        os.environ.get('UPLOAD_PASSWORD')
        or os.environ.get('WORKER_UPLOAD_PASSWORD')
        or ''
    )

    parser = argparse.ArgumentParser(description='Manually upload selected local PDF files to R2 via worker')
    parser.add_argument('files', nargs='+', help='One or more local files or directories to upload')
    parser.add_argument('--worker-url', '-w', default=os.environ.get('PUBLIC_WORKER_URL', 'https://api.my-lab.ro'))
    parser.add_argument('--password', '-p', default=default_password, help='Upload password for the worker API')
    parser.add_argument('--base-dir', '-b', default=str(script_dir / 'files'), help='Strip this prefix from file paths to derive R2 keys (default: ./files)')
    parser.add_argument('--key', '-k', default=None, help='Explicit R2 key (allowed only when uploading one file)')
    parser.add_argument('--deploy', action='store_true', help='Trigger deploy after successful uploads')
    parser.add_argument('--dry-run', action='store_true', help='Show planned uploads without sending files')
    args = parser.parse_args()

    if not args.dry_run and not args.password:
        print('Error: Upload password is required. Set UPLOAD_PASSWORD env var or use --password.')
        return 1

    try:
        file_paths = collect_pdf_files(args.files)
    except FileNotFoundError as error:
        print(f'Error: {error}')
        return 1

    if not file_paths:
        print('Error: no PDF files found in provided input paths.')
        return 1

    if args.key and len(file_paths) != 1:
        print('Error: --key can only be used with exactly one file.')
        return 1

    base_dir = Path(args.base_dir).expanduser().resolve()

    if args.dry_run:
        print(f'Dry run: {len(file_paths)} file(s) would be uploaded')
        for path in file_paths:
            try:
                key = derive_key(path, base_dir, args.key)
            except ValueError as error:
                print(f'Error: {error}')
                return 1
            print(f'  {path} -> {key}')
        if args.deploy:
            print('  Deploy trigger would run after successful uploads.')
        return 0

    success_count = 0
    total = len(file_paths)
    batch: list[tuple[Path, str]] = []

    for path in file_paths:
        try:
            key = derive_key(path, base_dir, args.key)
        except ValueError as error:
            print(f'Error: {error}')
            return 1
        batch.append((path, key))

    # Batch upload all files in one request
    file_handles = []
    try:
        files = []
        data = []
        for path, key in batch:
            fh = path.open('rb')
            file_handles.append(fh)
            files.append(('file', (path.name, fh, 'application/pdf')))
            data.append(('key', key))

        response = session.post(
            f"{args.worker_url.rstrip('/')}/upload-batch",
            headers=auth_header(args.password),
            files=files,
            data=data,
            timeout=300,
        )

        if response.ok:
            body = response.json()
            success_count = body.get('count', 0)
            print(f'Uploaded {success_count}/{total} files')
        else:
            print(f"Batch upload failed ({response.status_code}): {response.text}")
            return 1
    except requests.RequestException as error:
        print(f'Batch upload error: {error}')
        return 1
    finally:
        for fh in file_handles:
            fh.close()

    print(f'Completed uploads: {success_count}/{len(file_paths)}')

    if success_count > 0 and args.deploy:
        trigger_deploy(session, args.worker_url, args.password)

    return 0 if success_count == len(file_paths) else 1


if __name__ == '__main__':
    raise SystemExit(main())
