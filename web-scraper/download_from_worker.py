from __future__ import annotations

import argparse
import os
import time
from pathlib import Path

import utils

SCRIPT_DIR = Path(__file__).resolve().parent
worker_url = os.environ.get("PUBLIC_WORKER_URL", "https://api.my-lab.ro")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", default="")
    parser.add_argument("--page", default="")
    parser.add_argument("--year")
    parser.add_argument("--worker-url", default=worker_url)
    parser.add_argument("--output-dir", default="./files")
    parser.add_argument(
        "--dry-run", action="store_true", help="List files without downloading"
    )
    return parser.parse_args()


def fetch_files(session, base_url: str, subject: str, page: str) -> list[tuple[str, str]]:
    resp = session.get(
        f"{base_url}/files",
        params={"subject": subject, "page": page},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    leaves: list[tuple[str, str]] = []
    for key in ("content", "extra"):
        leaves.extend(walk_leaves(data.get(key, {})))
    return leaves


def fetch_index(session, base_url: str) -> dict:
    resp = session.get(f"{base_url}/index", timeout=30)
    resp.raise_for_status()
    return resp.json()


def walk_leaves(tree: dict, prefix: tuple[str, ...] = ()) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    for key, value in tree.items():
        path = (*prefix, key)
        if isinstance(value, dict):
            entries.extend(walk_leaves(value, path))
        elif isinstance(value, str):
            entries.append(("/".join(path), value))
    return entries


def download_file(
    session, base_url: str, r2_key: str, dest: Path, dry_run: bool
) -> None:
    if dry_run:
        print(f"  [dry-run] {r2_key}")
        return

    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = session.get(f"{base_url}/file/{r2_key}", timeout=120, stream=True)
    resp.raise_for_status()
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            f.write(chunk)
    print(f"  {r2_key}  -> {dest}")


def main() -> None:
    args = parse_args()

    session = utils.create_retry_session()

    if args.subject and args.page:
        print(
            f"Fetching index from {args.worker_url}/files?"
            f"subject={args.subject}&page={args.page}"
        )
        leaves = fetch_files(session, args.worker_url, args.subject, args.page)
    else:
        print(f"Fetching full index from {args.worker_url}/index")
        data = fetch_index(session, args.worker_url)
        if args.subject:
            data = {args.subject: data.get(args.subject, {})}
        leaves = walk_leaves(data)

    if not leaves:
        print("No files found.")
        return

    if args.year:
        leaves = [e for e in leaves if e[0].startswith(args.year)]

    print(f"Found {len(leaves)} file(s):")
    for display_key, r2_key in leaves:
        print(f"  {r2_key}")

    if args.dry_run:
        return

    output_dir = Path(args.output_dir)
    for _display_key, r2_key in leaves:
        dest = output_dir / r2_key
        download_file(session, args.worker_url, r2_key, dest, dry_run=False)
        time.sleep(0.1)

    print(f"\nDownloaded {len(leaves)} file(s) to {output_dir.resolve()}")


if __name__ == "__main__":
    main()
