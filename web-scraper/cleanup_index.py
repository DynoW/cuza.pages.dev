#!/usr/bin/env python3
"""Clean stale entries from worker index.json by validating keys against R2."""

import argparse
import base64
import json
import os
from pathlib import Path

import requests


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


def build_auth_header(password: str) -> dict[str, str]:
    token = base64.b64encode(f"upload:{password}".encode('utf-8')).decode('utf-8')
    return {'Authorization': f'Basic {token}'}


def trigger_deploy(worker_url: str, password: str, timeout: int) -> int:
    """Deploy after cleanup. Returns 0 on success, 1 on failure."""
    worker_url = worker_url.rstrip('/')
    endpoint = f"{worker_url}/trigger-deploy"
    
    headers = {
        **build_auth_header(password),
        'Accept': 'application/json',
    }
    
    print(f"\nCalling {endpoint} ...")
    
    try:
        response = requests.post(endpoint, headers=headers, timeout=timeout)
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


def main() -> int:
    script_dir = Path(__file__).resolve().parent
    load_local_env(script_dir / '.env')

    parser = argparse.ArgumentParser(
        description='Prune stale keys from worker index.json (keys that no longer exist in R2).',
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
        default=os.environ.get('UPLOAD_PASSWORD', ''),
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

    headers = {
        **build_auth_header(args.password),
        'Accept': 'application/json',
    }

    print(f"Calling {endpoint} ...")

    try:
        response = requests.post(endpoint, headers=headers, timeout=args.timeout)
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
    
    # Deploy after cleanup if not a dry run
    if not args.dry_run:
        print("\n" + "="*60)
        print("Cleanup successful. Starting deployment...")
        print("="*60)
        return trigger_deploy(args.worker_url, args.password, args.timeout)
    
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
