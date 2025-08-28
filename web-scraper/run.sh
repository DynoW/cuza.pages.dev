#!/bin/bash

# Romanian BAC Exam Scraper
# This script downloads new exam files from subiecte.edu.ro

# Parse command line arguments
YEAR=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -y|--year)
            YEAR="$2"
            shift 2
            ;;
        *)
            echo "Usage: $0 [-y|--year YEAR]"
            echo "  -y, --year YEAR    Year to scrape (default: current year)"
            exit 1
            ;;
    esac
done

# Set default year if not provided
if [ -z "$YEAR" ]; then
    YEAR=$(date +%Y)
fi

echo "🔍 Starting Romanian BAC exam scraper..."
echo "📅 Year: $YEAR"
echo

# Change to the web-scraper directory
cd "$(dirname "$0")"

# Install dependencies if needed
if [ ! -f "venv/bin/activate" ]; then
    echo "📦 Setting up Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Run the scraper with the specified year
echo "🚀 Running scraper..."
python main.py --year "$YEAR"

echo
echo "✅ Scraper finished!"
