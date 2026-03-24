#!/usr/bin/env python3
"""Trigger Cloudflare Pages deploy via worker endpoint."""

import argparse
import json
import os
from pathlib import Path

import requests

from utils import build_bearer_auth_header, create_retry_session, load_local_env


def build_auth_header(password: str) -> dict[str, str]:
    return build_bearer_auth_header('scraper', password)


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    load_local_env(script_dir / '.env')

    default_password = (
        os.environ.get('UPLOAD_PASSWORD')
        or os.environ.get('WORKER_UPLOAD_PASSWORD')
        or ''
    )

    parser = argparse.ArgumentParser(
        description='Trigger deploy through worker /trigger-deploy endpoint.',
    )
    parser.add_argument(
        '--worker-url',
        '-w',
        default=os.environ.get('PUBLIC_WORKER_URL', 'https://api.my-lab.ro'),
        help='Worker base URL',
    )
    parser.add_argument(
        '--password',
        '-p',
        default=default_password,
        help='Upload password for authenticated worker routes',
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=120,
        help='HTTP timeout in seconds (default: 120)',
    )

    args = parser.parse_args()

    if not args.password:
        print('Missing upload password. Provide --password or set UPLOAD_PASSWORD in env/.env.')
        return 1

    worker_url = args.worker_url.rstrip('/')
    endpoint = f"{worker_url}/trigger-deploy"

    headers = {
        **build_auth_header(args.password),
        'Accept': 'application/json',
    }

    print(f"Calling {endpoint} ...")

    try:
        session = create_retry_session()
        response = session.post(endpoint, headers=headers, timeout=args.timeout)
    except requests.RequestException as exc:
        print(f'Deploy request failed: {exc}')
        return 1

    if response.status_code != 200:
        print(f'Deploy failed with status {response.status_code}: {response.text}')
        return 1

    try:
        payload = response.json()
    except ValueError:
        print('Deploy response is not valid JSON:')
        print(response.text)
        return 1

    print(json.dumps(payload, indent=2, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
