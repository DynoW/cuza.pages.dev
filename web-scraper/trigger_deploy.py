#!/usr/bin/env python3
"""Trigger Cloudflare Pages deploy via worker endpoint."""

import argparse
from pathlib import Path

from utils import create_retry_session, get_upload_password, get_worker_url, load_local_env, trigger_deploy


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    load_local_env(script_dir / '.env')

    parser = argparse.ArgumentParser(
        description='Trigger deploy through worker /trigger-deploy endpoint.',
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
        '--timeout',
        type=int,
        default=120,
        help='HTTP timeout in seconds (default: 120)',
    )

    args = parser.parse_args()

    if not args.password:
        print('Missing upload password. Provide --password or set UPLOAD_PASSWORD in env/.env.')
        return 1

    session = create_retry_session()
    if trigger_deploy(session, args.worker_url, args.password, timeout=args.timeout):
        return 0
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
