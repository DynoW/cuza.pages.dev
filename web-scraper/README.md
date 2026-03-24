# Web Scraper Runner

Use `run.sh` as the single entrypoint for both Python tools:
- `main.py` (scrape)
- `upload_local_files.py` (manual upload)

## Quick start

From `web-scraper/`:

```bash
./run.sh
```

This opens an interactive menu where you can choose:
1. Scrape subiecte.edu.ro
2. Upload local PDFs

## Non-interactive usage

### Scrape mode

```bash
./run.sh scrape --year 2026
```

Upload scraped files directly to R2:

```bash
./run.sh scrape --year 2026 --upload
```

With explicit worker settings:

```bash
./run.sh scrape --year 2026 --upload \
  --worker-url "https://api.my-lab.ro" \
  --password "$UPLOAD_PASSWORD"
```

### Upload mode

Dry-run local files (no API upload):

```bash
./run.sh upload --dry-run --files ./files
```

Upload specific folder/file list:

```bash
./run.sh upload --files ./files ./temp/some.pdf --base-dir ./files
```

Upload and trigger deploy:

```bash
./run.sh upload --files ./files --base-dir ./files --deploy
```

Use explicit key for one file:

```bash
./run.sh upload --files ./files/single.pdf --key "fizica/pages/bac/2026/Model/file.pdf"
```

### Cleanup stale index entries

Run a safe dry-run first (no writes):

```bash
python cleanup_index.py --dry-run
```

Apply cleanup (writes cleaned `index.json` to R2 via worker):

```bash
python cleanup_index.py
```

With explicit worker settings:

```bash
python cleanup_index.py \
  --worker-url "https://api.my-lab.ro" \
  --password "$UPLOAD_PASSWORD"
```

## CI / automation notes

Skip package installation when the environment is already prepared:

```bash
./run.sh scrape --skip-install --year 2026 --upload
```

`--skip-install`:
- still loads `.env` if present
- still activates existing `venv` if available
- only skips dependency installation

## Legacy compatibility

Old-style scrape call still works:

```bash
./run.sh -y 2026 -u
```

This is interpreted as scrape mode with upload enabled.

## Dependencies

`run.sh` uses `requirements.txt` (currently `requests`).

If needed manually:

```bash
python3 -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
```
