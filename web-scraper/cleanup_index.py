#!/usr/bin/env python3
"""Clean stale entries from worker index.json by validating keys against R2."""

import argparse
import json
from pathlib import Path

import requests

from utils import build_auth_header, create_retry_session, get_upload_password, get_worker_url, load_local_env


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    load_local_env(script_dir / '.env')

    parser = argparse.ArgumentParser(
        description='Prune stale keys from worker index.json (keys that no longer exist in R2).',
    )
    parser.add_argument(
        '--worker-url',
        '-w',
        default=get_worker_url(),
        help='Worker base URL',
    )
    parser.add_argument(
        '--password',
        '-p',
        default=get_upload_password(),
        help='Upload password for authenticated worker routes',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Only compute cleanup stats; do not write cleaned index.json',
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=300,
        help='HTTP timeout in seconds (default: 300)',
    )

    args = parser.parse_args()

    if not args.password:
        print('Missing upload password. Provide --password or set UPLOAD_PASSWORD in env/.env.')
        return 1

    worker_url = args.worker_url.rstrip('/')
    endpoint = f"{worker_url}/cleanup-index"
    if args.dry_run:
        endpoint = f"{endpoint}?dryRun=true"

    headers = build_auth_header(args.password)

    print(f"Calling {endpoint} ...")

    try:
        session = create_retry_session()
        response = session.post(endpoint, headers=headers, timeout=args.timeout)
    except requests.RequestException as exc:
        print(f'Cleanup request failed: {exc}')
        return 1

    if response.status_code != 200:
        print(f'Cleanup failed with status {response.status_code}: {response.text}')
        return 1

    try:
        payload = response.json()
    except ValueError:
        print('Cleanup response is not valid JSON:')
        print(response.text)
        return 1

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
