#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

show_usage() {
        cat <<'EOF'
Unified runner for BAC scraper tools.

Interactive mode:
    ./run.sh

Subcommands:
    ./run.sh scrape [options]
    ./run.sh upload [options]
    ./run.sh cleanup-index [options]
    ./run.sh deploy [options]

Global options:
    --skip-install         Skip venv/dependency setup
    -h, --help             Show this help

Scrape options:
    -y, --year YEAR        Year to scrape (default: current year)
    -u, --upload           Upload to R2 (default: save locally in ./files)
    -w, --worker-url URL   Override worker URL
    -p, --password PASS    Override upload password

Upload options:
    --files PATH [PATH..]  Files or folders to upload (default: ./files in interactive mode)
    -b, --base-dir DIR     Base dir used to derive R2 keys (default: ./files)
    -k, --key KEY          Explicit R2 key (single-file only)
    --deploy               Trigger deploy after successful uploads
    --dry-run              Print planned uploads only (no API calls)
    -w, --worker-url URL   Override worker URL
    -p, --password PASS    Override upload password

Cleanup Index options:
    --dry-run              Only compute cleanup stats (do not write index.json)
    --timeout SECONDS      HTTP timeout in seconds (default: 300)
    -w, --worker-url URL   Override worker URL
    -p, --password PASS    Override upload password

Deploy options:
    --timeout SECONDS      HTTP timeout in seconds (default: 120)
    -w, --worker-url URL   Override worker URL
    -p, --password PASS    Override upload password
EOF
}

setup_python_env() {
    if [[ -f ".env" ]]; then
        echo "🔐 Loading environment from .env..."
        set -a
        source .env
        set +a
    fi

    if [[ ! -f "venv/bin/activate" && "$SKIP_INSTALL" -eq 0 ]]; then
        echo "📦 Setting up Python virtual environment..."
        python3 -m venv venv
    fi

    if [[ -f "venv/bin/activate" ]]; then
        # shellcheck source=/dev/null
        source venv/bin/activate
    fi

    if [[ "$SKIP_INSTALL" -eq 1 ]]; then
        echo "⏭️  Skipping dependency installation (--skip-install)."
        return
    fi

    echo "📦 Installing scraper dependencies..."
    if [[ -f "requirements.txt" ]]; then
        python -m pip install -r requirements.txt
    else
        echo "⚠️ requirements.txt not found, installing default dependency: requests"
        python -m pip install requests
    fi
}

run_scrape() {
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

    echo "🚀 Running scraper..."
    "${cmd[@]}"
}

run_upload() {
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

    echo "🚀 Running uploader..."
    "${cmd[@]}"
}

run_cleanup_index() {
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

    echo "🚀 Running cleanup-index..."
    "${cmd[@]}"
}

run_deploy() {
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

    echo "🚀 Running deploy..."
    "${cmd[@]}"
}

interactive_select_mode() {
    echo "Select action:"
    echo "  1) Scrape subiecte.edu.ro"
    echo "  2) Upload local PDFs"
    echo "  3) Cleanup worker index"
    echo "  4) Trigger deploy"
    read -r -p "Choice [1/2/3/4]: " choice

    case "${choice:-1}" in
        1) MODE="scrape" ;;
        2) MODE="upload" ;;
        3) MODE="cleanup-index" ;;
        4) MODE="deploy" ;;
        *)
            echo "Invalid choice: $choice"
            exit 1
            ;;
    esac
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

    read -r -p "Custom worker URL (optional): " input_worker
    SCRAPE_WORKER_URL="${input_worker:-}"

    read -r -p "Custom password (optional): " input_password
    SCRAPE_PASSWORD="${input_password:-}"
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

    read -r -p "Custom worker URL (optional): " input_worker
    UPLOAD_WORKER_URL="${input_worker:-}"

    read -r -p "Custom password (optional): " input_password
    UPLOAD_PASSWORD="${input_password:-}"
}

interactive_cleanup_index_options() {
    read -r -p "Dry run only? [Y/n]: " input_dry
    if [[ -z "$input_dry" || "${input_dry,,}" =~ ^(y|yes)$ ]]; then
        CLEANUP_DRY_RUN=1
    fi

    read -r -p "HTTP timeout in seconds [300]: " input_timeout
    CLEANUP_TIMEOUT="${input_timeout:-300}"

    read -r -p "Custom worker URL (optional): " input_worker
    CLEANUP_WORKER_URL="${input_worker:-}"

    read -r -p "Custom password (optional): " input_password
    CLEANUP_PASSWORD="${input_password:-}"
}

interactive_deploy_options() {
    read -r -p "HTTP timeout in seconds [120]: " input_timeout
    DEPLOY_TIMEOUT="${input_timeout:-120}"

    read -r -p "Custom worker URL (optional): " input_worker
    DEPLOY_WORKER_URL="${input_worker:-}"

    read -r -p "Custom password (optional): " input_password
    DEPLOY_PASSWORD="${input_password:-}"
}

# Defaults
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

# Mode detection
if [[ $# -eq 0 ]]; then
    MODE="interactive"
elif [[ "$1" == "scrape" || "$1" == "upload" || "$1" == "cleanup-index" || "$1" == "deploy" ]]; then
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

# Parse args
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-install)
            SKIP_INSTALL=1
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;

        # Scrape args
        -y|--year)
            SCRAPE_YEAR="${2:-}"
            shift 2
            ;;
        -u|--upload)
            SCRAPE_UPLOAD=1
            shift
            ;;

        # Shared args
        -w|--worker-url)
            if [[ "$MODE" == "upload" ]]; then
                UPLOAD_WORKER_URL="${2:-}"
            elif [[ "$MODE" == "cleanup-index" ]]; then
                CLEANUP_WORKER_URL="${2:-}"
            elif [[ "$MODE" == "deploy" ]]; then
                DEPLOY_WORKER_URL="${2:-}"
            else
                SCRAPE_WORKER_URL="${2:-}"
            fi
            shift 2
            ;;
        -p|--password)
            if [[ "$MODE" == "upload" ]]; then
                UPLOAD_PASSWORD="${2:-}"
            elif [[ "$MODE" == "cleanup-index" ]]; then
                CLEANUP_PASSWORD="${2:-}"
            elif [[ "$MODE" == "deploy" ]]; then
                DEPLOY_PASSWORD="${2:-}"
            else
                SCRAPE_PASSWORD="${2:-}"
            fi
            shift 2
            ;;

        # Upload args
        --files)
            shift
            while [[ $# -gt 0 && "$1" != -* ]]; do
                UPLOAD_FILES+=("$1")
                shift
            done
            ;;
        -b|--base-dir)
            UPLOAD_BASE_DIR="${2:-}"
            shift 2
            ;;
        -k|--key)
            UPLOAD_KEY="${2:-}"
            shift 2
            ;;
        --deploy)
            UPLOAD_DEPLOY=1
            shift
            ;;
        --dry-run)
            if [[ "$MODE" == "cleanup-index" ]]; then
                CLEANUP_DRY_RUN=1
            elif [[ "$MODE" == "upload" ]]; then
                UPLOAD_DRY_RUN=1
            else
                echo "--dry-run is only supported for upload and cleanup-index"
                exit 1
            fi
            shift
            ;;

        # Cleanup index args
        --timeout)
            if [[ "$MODE" == "cleanup-index" ]]; then
                CLEANUP_TIMEOUT="${2:-300}"
            elif [[ "$MODE" == "deploy" ]]; then
                DEPLOY_TIMEOUT="${2:-120}"
            else
                echo "--timeout is only supported for cleanup-index and deploy"
                exit 1
            fi
            shift 2
            ;;

        # Positional inputs for upload mode are treated as files
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

echo "🔍 BAC tools runner"

if [[ "$MODE" == "interactive" ]]; then
    interactive_select_mode
    if [[ "$MODE" == "scrape" ]]; then
        interactive_scrape_options
    elif [[ "$MODE" == "upload" ]]; then
        interactive_upload_options
    elif [[ "$MODE" == "cleanup-index" ]]; then
        interactive_cleanup_index_options
    else
        interactive_deploy_options
    fi
fi

setup_python_env

if [[ "$MODE" == "scrape" ]]; then
    echo "📅 Year: $SCRAPE_YEAR"
    run_scrape
elif [[ "$MODE" == "upload" ]]; then
    run_upload
elif [[ "$MODE" == "cleanup-index" ]]; then
    run_cleanup_index
elif [[ "$MODE" == "deploy" ]]; then
    run_deploy
else
    echo "Unknown mode: $MODE"
    exit 1
fi

echo
echo "✅ Done!"
