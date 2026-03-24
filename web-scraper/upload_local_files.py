#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Manual uploader for local files -> cuza worker /upload-scraper endpoint."""

import argparse
import base64
import os
from pathlib import Path
import sys

try:
    import requests
except ModuleNotFoundError:
    requests = None


def ensure_requests_installed() -> None:
    if requests is not None:
        return

    print("Error: missing Python dependency 'requests'.")
    print("Install dependencies with one of the following commands:")
    print("  python3 -m pip install -r requirements.txt")
    print("  source venv/bin/activate && python -m pip install -r requirements.txt")
    raise SystemExit(1)


def load_local_env(env_path: Path) -> None:
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


def auth_header(password: str) -> dict:
    token = base64.b64encode(f"scraper:{password}".encode()).decode()
    return {'Authorization': f'Bearer {token}'}


def upload_file(worker_url: str, password: str, file_path: Path, key: str) -> bool:
    try:
        with file_path.open('rb') as file_handle:
            response = requests.post(
                f"{worker_url.rstrip('/')}/upload-scraper",
                headers=auth_header(password),
                files={'file': (file_path.name, file_handle, 'application/pdf')},
                data={'key': key},
                timeout=120,
            )
    except requests.RequestException as error:
        print(f"Upload error for {file_path}: {error}")
        return False

    if response.ok:
        print(f"Uploaded: {file_path} -> {key}")
        return True

    print(f"Upload failed for {file_path} ({response.status_code}): {response.text}")
    return False


def trigger_deploy(worker_url: str, password: str) -> bool:
    try:
        response = requests.post(
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

    default_password = (
        os.environ.get('UPLOAD_PASSWORD')
        or os.environ.get('WORKER_UPLOAD_PASSWORD')
        or ''
    )

    parser = argparse.ArgumentParser(description='Manually upload selected local PDF files to R2 via worker')
    parser.add_argument('files', nargs='+', help='One or more local files or directories to upload')
    parser.add_argument('--worker-url', '-w', default=os.environ.get('PUBLIC_WORKER_URL', 'https://api.my-lab.ro'))
    parser.add_argument('--password', '-p', default=default_password, help='Upload password for the worker API')
    parser.add_argument('--base-dir', '-b', default=str(script_dir / 'files'), help='Base directory used to derive R2 keys (default: ./files)')
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
    for path in file_paths:
        try:
            key = derive_key(path, base_dir, args.key)
        except ValueError as error:
            print(f'Error: {error}')
            return 1

        if upload_file(args.worker_url, args.password, path, key):
            success_count += 1

    print(f'Completed uploads: {success_count}/{len(file_paths)}')

    if success_count > 0 and args.deploy:
        trigger_deploy(args.worker_url, args.password)

    return 0 if success_count == len(file_paths) else 1


if __name__ == '__main__':
    raise SystemExit(main())
