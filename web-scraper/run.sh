#!/bin/bash
# ---------------------------------------------------------------------------
# cuza.pages.dev — BAC tools runner
#
# Architecture:
#   run.sh is the single user entry point. It handles environment setup,
#   dispatches to Python worker scripts, and presents an interactive menu
#   when invoked without arguments.  Python scripts are internal — do not
#   run them directly; their argparse flags are documented here only.
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_usage() {
  cat << 'EOF'
Cuza Pages tools runner — scrape, upload, clean, deploy & preview

Usage:
    ./run.sh                           Interactive menu
    ./run.sh scrape [opts]             Scrape exam PDFs from subiecte.edu.ro
    ./run.sh upload [opts]             Upload local PDFs to R2
    ./run.sh cleanup-index [opts]      Prune stale R2 entries from index
    ./run.sh deploy [opts]             Trigger Cloudflare Pages deploy
    ./run.sh download [opts]           Download files from the remote worker
    ./run.sh preview [opts]            Build site from local scraper files

Global options:
    --skip-install                     Skip venv / dependency setup
    -h, --help                         Show this help

Scrape options:
    -y, --year YEAR                    Year to scrape (default: current year)
    -u, --upload                       Upload to R2 (default: save in ./files)
    -w, --worker-url URL               Override worker URL
    -p, --password PASS                Override upload password

Upload options:
    --files PATH [PATH...]             Files or folders to upload (default: ./files)
    -b, --base-dir DIR                 Base dir for deriving R2 keys (default: ./files)
    -k, --key KEY                      Explicit R2 key (single file only)
    --deploy                           Trigger deploy after successful uploads
    --dry-run                          Print planned uploads, no API calls
    -w, --worker-url URL               Override worker URL
    -p, --password PASS                Override upload password

Cleanup-Index options:
    --dry-run                          Only compute stats, do not write index.json
    --timeout SECONDS                  HTTP timeout in seconds (default: 300)
    -w, --worker-url URL               Override worker URL
    -p, --password PASS                Override upload password

Deploy options:
    --timeout SECONDS                  HTTP timeout in seconds (default: 120)
    -w, --worker-url URL               Override worker URL
    -p, --password PASS                Override upload password

Preview options:
    --files-dir DIR                    Local scraper files directory
                                        (default: ~/web-scraper/files or ./files)
    --api-port PORT                    Local preview API port (default: 8788)

Download options:
    -s, --subject SUBJECT             Subject to download
    -g, --page PAGE                   Page to download (e.g. bac, teste)
    -y, --year YEAR                   Filter to a specific year
    --output-dir DIR                  Where to save files (default: ./files)
    --dry-run                         List files without downloading
    -w, --worker-url URL              Override worker URL
EOF
}

require_script() {
  local script="$1"
  if [[ ! -f "$SCRIPT_DIR/$script" ]]; then
    echo "Missing script: $SCRIPT_DIR/$script"
    exit 1
  fi
}

interactive_worker_and_password() {
  local -n worker_ref="$1"
  local -n password_ref="$2"

  local input_worker input_password
  read -r -p "Custom worker URL (optional): " input_worker
  worker_ref="${input_worker:-}"
  read -r -p "Custom password (optional): " input_password
  password_ref="${input_password:-}"
}

setup_python_env() {
  if [[ -f ".env" ]]; then
    echo "Loading environment from .env..."
    set -a
    source .env
    set +a
  fi

  if [[ ! -f "venv/bin/activate" && "$SKIP_INSTALL" -eq 0 ]]; then
    echo "Setting up Python virtual environment..."
    python3 -m venv venv
  fi

  if [[ -f "venv/bin/activate" ]]; then
    # shellcheck source=/dev/null
    source venv/bin/activate
  fi

  if [[ "$SKIP_INSTALL" -eq 1 ]]; then
    echo "Skipping dependency installation (--skip-install)."
    return
  fi

  echo "Installing scraper dependencies..."
  if [[ -f "requirements.txt" ]]; then
    python -m pip install -r requirements.txt
  else
    echo "WARNING: requirements.txt not found, installing default dependency: requests"
    python -m pip install requests
  fi
}

run_scrape() {
  require_script main.py

  local cmd=(python main.py --year "$SCRAPE_YEAR")
  if [[ "$SCRAPE_UPLOAD" -eq 1 ]]; then
    cmd+=(--upload)
  fi
  if [[ -n "$SCRAPE_WORKER_URL" ]]; then
    cmd+=(--worker-url "$SCRAPE_WORKER_URL")
  fi
  if [[ -n "$SCRAPE_PASSWORD" ]]; then
    cmd+=(--password "$SCRAPE_PASSWORD")
  fi

  echo "Running scraper..."
  "${cmd[@]}"
}

run_upload() {
  require_script upload_local_files.py

  local cmd=(python upload_local_files.py)
  local files=("${UPLOAD_FILES[@]}")

  if [[ ${#files[@]} -eq 0 ]]; then
    files=("./files")
  fi

  cmd+=("${files[@]}")

  if [[ -n "$UPLOAD_WORKER_URL" ]]; then
    cmd+=(--worker-url "$UPLOAD_WORKER_URL")
  fi
  if [[ -n "$UPLOAD_PASSWORD" ]]; then
    cmd+=(--password "$UPLOAD_PASSWORD")
  fi
  if [[ -n "$UPLOAD_BASE_DIR" ]]; then
    cmd+=(--base-dir "$UPLOAD_BASE_DIR")
  fi
  if [[ -n "$UPLOAD_KEY" ]]; then
    cmd+=(--key "$UPLOAD_KEY")
  fi
  if [[ "$UPLOAD_DEPLOY" -eq 1 ]]; then
    cmd+=(--deploy)
  fi
  if [[ "$UPLOAD_DRY_RUN" -eq 1 ]]; then
    cmd+=(--dry-run)
  fi

  echo "Running uploader..."
  "${cmd[@]}"
}

run_cleanup_index() {
  require_script cleanup_index.py

  local cmd=(python cleanup_index.py)

  if [[ -n "$CLEANUP_WORKER_URL" ]]; then
    cmd+=(--worker-url "$CLEANUP_WORKER_URL")
  fi
  if [[ -n "$CLEANUP_PASSWORD" ]]; then
    cmd+=(--password "$CLEANUP_PASSWORD")
  fi
  if [[ "$CLEANUP_DRY_RUN" -eq 1 ]]; then
    cmd+=(--dry-run)
  fi
  if [[ "$CLEANUP_TIMEOUT" -gt 0 ]]; then
    cmd+=(--timeout "$CLEANUP_TIMEOUT")
  fi

  echo "Running cleanup-index..."
  "${cmd[@]}"
}

run_deploy() {
  require_script trigger_deploy.py

  local cmd=(python trigger_deploy.py)

  if [[ -n "$DEPLOY_WORKER_URL" ]]; then
    cmd+=(--worker-url "$DEPLOY_WORKER_URL")
  fi
  if [[ -n "$DEPLOY_PASSWORD" ]]; then
    cmd+=(--password "$DEPLOY_PASSWORD")
  fi
  if [[ "$DEPLOY_TIMEOUT" -gt 0 ]]; then
    cmd+=(--timeout "$DEPLOY_TIMEOUT")
  fi

  echo "Running deploy..."
  "${cmd[@]}"
}

PREVIEW_API_PID=""
PREVIEW_API_LOG=""

cleanup_preview_api() {
  if [[ -n "$PREVIEW_API_PID" ]] && kill -0 "$PREVIEW_API_PID" 2> /dev/null; then
    kill "$PREVIEW_API_PID" 2> /dev/null || true
    wait "$PREVIEW_API_PID" 2> /dev/null || true
  fi

  if [[ -n "$PREVIEW_API_LOG" && -f "$PREVIEW_API_LOG" ]]; then
    rm -f "$PREVIEW_API_LOG"
  fi
}

wait_for_preview_api() {
  local api_port="$1"

  for ((attempt = 0; attempt < 50; attempt++)); do
    if python3 - "$api_port" << 'PY' > /dev/null 2>&1; then
import sys
from urllib.request import urlopen

port = sys.argv[1]
with urlopen(f"http://127.0.0.1:{port}/ping", timeout=1) as response:
    raise SystemExit(0 if response.status == 200 else 1)
PY
      return 0
    fi
    sleep 0.1
  done

  return 1
}

start_preview_api() {
  local files_dir="$1"
  local api_port="$2"
  local api_script="$SCRIPT_DIR/local_preview_api.py"

  if [[ ! -f "$api_script" ]]; then
    echo "Missing preview API helper: $api_script"
    exit 1
  fi

  PREVIEW_API_LOG="$(mktemp)"
  python3 "$api_script" --files-dir "$files_dir" --port "$api_port" > "$PREVIEW_API_LOG" 2>&1 &
  PREVIEW_API_PID=$!

  if ! wait_for_preview_api "$api_port"; then
    echo "Preview API failed to start. Logs: $PREVIEW_API_LOG"
    cat "$PREVIEW_API_LOG"
    cleanup_preview_api
    exit 1
  fi
}

run_preview() {
  local project_root="$SCRIPT_DIR/.."
  local default_files_dir="$HOME/web-scraper/files"
  local files_dir="${PREVIEW_FILES_DIR:-$default_files_dir}"
  local api_port="${PREVIEW_API_PORT:-8788}"

  if [[ ! -d "$files_dir" ]]; then
    if [[ -d "$SCRIPT_DIR/files" ]]; then
      files_dir="$SCRIPT_DIR/files"
    else
      echo "Preview files directory not found: $files_dir"
      exit 1
    fi
  fi

  if [[ "$SKIP_INSTALL" -eq 0 && ! -d "$project_root/node_modules" ]]; then
    echo "Installing site dependencies..."
    (cd "$project_root" && pnpm install)
  fi

  trap cleanup_preview_api EXIT INT TERM
  start_preview_api "$files_dir" "$api_port"

  export PUBLIC_WORKER_URL="http://127.0.0.1:$api_port"

  echo "Building site with local preview data..."
  (cd "$project_root" && pnpm build)

  echo "Starting site preview..."
  (cd "$project_root" && pnpm preview)
}

run_download() {
  require_script download_from_worker.py

  local cmd=(python download_from_worker.py)

  if [[ -n "$DOWNLOAD_SUBJECT" ]]; then
    cmd+=(--subject "$DOWNLOAD_SUBJECT")
  fi
  if [[ -n "$DOWNLOAD_PAGE" ]]; then
    cmd+=(--page "$DOWNLOAD_PAGE")
  fi

  if [[ -n "$DOWNLOAD_YEAR" ]]; then
    cmd+=(--year "$DOWNLOAD_YEAR")
  fi
  if [[ -n "$DOWNLOAD_WORKER_URL" ]]; then
    cmd+=(--worker-url "$DOWNLOAD_WORKER_URL")
  fi
  if [[ -n "$DOWNLOAD_OUTPUT_DIR" ]]; then
    cmd+=(--output-dir "$DOWNLOAD_OUTPUT_DIR")
  fi
  if [[ "$DOWNLOAD_DRY_RUN" -eq 1 ]]; then
    cmd+=(--dry-run)
  fi

  echo "Running download..."
  "${cmd[@]}"
}

interactive_select_mode() {
  while true; do
    echo "Select action:"
    echo "  1) Scrape subiecte.edu.ro"
    echo "  2) Upload local PDFs"
    echo "  3) Cleanup worker index"
    echo "  4) Trigger deploy"
    echo "  5) Preview site locally"
    echo "  6) Download files from remote"
    read -r -p "Choice [1/2/3/4/5/6]: " choice

    case "${choice:-1}" in
      1)
        MODE="scrape"
        return 0
        ;;
      2)
        MODE="upload"
        return 0
        ;;
      3)
        MODE="cleanup-index"
        return 0
        ;;
      4)
        MODE="deploy"
        return 0
        ;;
      5)
        MODE="preview"
        return 0
        ;;
      6)
        MODE="download"
        return 0
        ;;
      *)
        echo "Invalid choice: $choice"
        ;;
    esac
  done
}

interactive_scrape_options() {
  local current_year
  current_year="$(date +%Y)"

  read -r -p "Year [$current_year]: " input_year
  SCRAPE_YEAR="${input_year:-$current_year}"

  read -r -p "Upload to R2? [y/N]: " input_upload
  if [[ "${input_upload,,}" =~ ^(y|yes)$ ]]; then
    SCRAPE_UPLOAD=1
  fi

  interactive_worker_and_password SCRAPE_WORKER_URL SCRAPE_PASSWORD
}

interactive_upload_options() {
  read -r -p "Files/folders to upload [./files]: " input_files
  local files_text="${input_files:-./files}"
  IFS=' ' read -r -a UPLOAD_FILES <<< "$files_text"

  read -r -p "Base dir [./files]: " input_base_dir
  UPLOAD_BASE_DIR="${input_base_dir:-./files}"

  read -r -p "Explicit key (optional): " input_key
  UPLOAD_KEY="${input_key:-}"

  read -r -p "Dry run only? [Y/n]: " input_dry
  if [[ -z "$input_dry" || "${input_dry,,}" =~ ^(y|yes)$ ]]; then
    UPLOAD_DRY_RUN=1
  fi

  read -r -p "Trigger deploy after upload? [y/N]: " input_deploy
  if [[ "${input_deploy,,}" =~ ^(y|yes)$ ]]; then
    UPLOAD_DEPLOY=1
  fi

  interactive_worker_and_password UPLOAD_WORKER_URL UPLOAD_PASSWORD
}

interactive_cleanup_index_options() {
  read -r -p "Dry run only? [Y/n]: " input_dry
  if [[ -z "$input_dry" || "${input_dry,,}" =~ ^(y|yes)$ ]]; then
    CLEANUP_DRY_RUN=1
  fi

  read -r -p "HTTP timeout in seconds [300]: " input_timeout
  CLEANUP_TIMEOUT="${input_timeout:-300}"

  interactive_worker_and_password CLEANUP_WORKER_URL CLEANUP_PASSWORD
}

interactive_deploy_options() {
  read -r -p "HTTP timeout in seconds [120]: " input_timeout
  DEPLOY_TIMEOUT="${input_timeout:-120}"

  interactive_worker_and_password DEPLOY_WORKER_URL DEPLOY_PASSWORD
}

interactive_download_options() {
  read -r -p "Subject (optional): " input_subject
  DOWNLOAD_SUBJECT="$input_subject"

  read -r -p "Page (optional): " input_page
  DOWNLOAD_PAGE="$input_page"

  read -r -p "Year (optional): " input_year
  DOWNLOAD_YEAR="${input_year:-}"

  read -r -p "Output dir [./files]: " input_output_dir
  DOWNLOAD_OUTPUT_DIR="${input_output_dir:-./files}"

  read -r -p "Dry run only? [Y/n]: " input_dry
  if [[ -z "$input_dry" || "${input_dry,,}" =~ ^(y|yes)$ ]]; then
    DOWNLOAD_DRY_RUN=1
  fi

  interactive_worker_and_password DOWNLOAD_WORKER_URL DOWNLOAD_PASSWORD
}

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

MODE=""
SKIP_INSTALL=0

SCRAPE_YEAR="$(date +%Y)"
SCRAPE_UPLOAD=0
SCRAPE_WORKER_URL=""
SCRAPE_PASSWORD=""

UPLOAD_FILES=()
UPLOAD_BASE_DIR="./files"
UPLOAD_KEY=""
UPLOAD_DEPLOY=0
UPLOAD_DRY_RUN=0
UPLOAD_WORKER_URL=""
UPLOAD_PASSWORD=""

CLEANUP_WORKER_URL=""
CLEANUP_PASSWORD=""
CLEANUP_DRY_RUN=0
CLEANUP_TIMEOUT=300

DEPLOY_WORKER_URL=""
DEPLOY_PASSWORD=""
DEPLOY_TIMEOUT=120

PREVIEW_FILES_DIR=""
PREVIEW_API_PORT=8788

DOWNLOAD_SUBJECT=""
DOWNLOAD_PAGE=""
DOWNLOAD_YEAR=""
DOWNLOAD_OUTPUT_DIR="./files"
DOWNLOAD_DRY_RUN=0
DOWNLOAD_WORKER_URL=""
DOWNLOAD_PASSWORD=""

# ---------------------------------------------------------------------------
# Mode detection
# ---------------------------------------------------------------------------

if [[ $# -eq 0 ]]; then
  MODE="interactive"
elif [[ "$1" == "scrape" || "$1" == "upload" || "$1" == "cleanup-index" || "$1" == "deploy" || "$1" == "preview" || "$1" == "download" ]]; then
  MODE="$1"
  shift
elif [[ "$1" == "-h" || "$1" == "--help" ]]; then
  show_usage
  exit 0
else
  echo "Unknown command: $1"
  echo
  show_usage
  exit 1
fi

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    -h | --help)
      show_usage
      exit 0
      ;;

    # Scrape / download
    -y | --year)
      case "$MODE" in
        download) DOWNLOAD_YEAR="${2:-}" ;;
        *) SCRAPE_YEAR="${2:-}" ;;
      esac
      shift 2
      ;;
    -u | --upload)
      SCRAPE_UPLOAD=1
      shift
      ;;

    # Shared — dispatched by current mode
    -w | --worker-url)
      case "$MODE" in
        upload) UPLOAD_WORKER_URL="${2:-}" ;;
        cleanup-index) CLEANUP_WORKER_URL="${2:-}" ;;
        deploy) DEPLOY_WORKER_URL="${2:-}" ;;
        download) DOWNLOAD_WORKER_URL="${2:-}" ;;
        *) SCRAPE_WORKER_URL="${2:-}" ;;
      esac
      shift 2
      ;;
    -p | --password)
      case "$MODE" in
        upload) UPLOAD_PASSWORD="${2:-}" ;;
        cleanup-index) CLEANUP_PASSWORD="${2:-}" ;;
        deploy) DEPLOY_PASSWORD="${2:-}" ;;
        *) SCRAPE_PASSWORD="${2:-}" ;;
      esac
      shift 2
      ;;

    # Upload
    --files)
      shift
      while [[ $# -gt 0 && "$1" != -* ]]; do
        UPLOAD_FILES+=("$1")
        shift
      done
      ;;
    -b | --base-dir)
      UPLOAD_BASE_DIR="${2:-}"
      shift 2
      ;;
    -k | --key)
      UPLOAD_KEY="${2:-}"
      shift 2
      ;;
    --deploy)
      UPLOAD_DEPLOY=1
      shift
      ;;
    --dry-run)
      case "$MODE" in
        cleanup-index) CLEANUP_DRY_RUN=1 ;;
        upload) UPLOAD_DRY_RUN=1 ;;
        download) DOWNLOAD_DRY_RUN=1 ;;
        *)
          echo "--dry-run is only supported for upload, cleanup-index, and download"
          exit 1
          ;;
      esac
      shift
      ;;

    --timeout)
      case "$MODE" in
        cleanup-index) CLEANUP_TIMEOUT="${2:-300}" ;;
        deploy) DEPLOY_TIMEOUT="${2:-120}" ;;
        *)
          echo "--timeout is only supported for cleanup-index and deploy"
          exit 1
          ;;
      esac
      shift 2
      ;;

    # Download
    -s | --subject)
      DOWNLOAD_SUBJECT="${2:-}"
      shift 2
      ;;
    -g | --page)
      DOWNLOAD_PAGE="${2:-}"
      shift 2
      ;;
    --output-dir)
      DOWNLOAD_OUTPUT_DIR="${2:-}"
      shift 2
      ;;

    # Preview
    --files-dir)
      PREVIEW_FILES_DIR="${2:-}"
      shift 2
      ;;
    --api-port)
      PREVIEW_API_PORT="${2:-8788}"
      shift 2
      ;;

    # Positional args for upload mode are treated as files
    *)
      if [[ "$MODE" == "upload" ]]; then
        UPLOAD_FILES+=("$1")
        shift
      else
        echo "Unknown argument: $1"
        echo
        show_usage
        exit 1
      fi
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

echo "BAC tools runner"

if [[ "$MODE" == "interactive" ]]; then
  interactive_select_mode
  case "$MODE" in
    scrape) interactive_scrape_options ;;
    upload) interactive_upload_options ;;
    cleanup-index) interactive_cleanup_index_options ;;
    deploy) interactive_deploy_options ;;
    download) interactive_download_options ;;
    preview) ;;
  esac
fi

if [[ "$MODE" != "preview" ]]; then
  setup_python_env
fi

case "$MODE" in
  scrape)
    echo "Year: $SCRAPE_YEAR"
    run_scrape
    ;;
  upload) run_upload ;;
  cleanup-index) run_cleanup_index ;;
  deploy) run_deploy ;;
  preview) run_preview ;;
  download) run_download ;;
  *)
    echo "Unknown mode: $MODE"
    exit 1
    ;;
esac

echo
echo "Done."
