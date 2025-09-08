#!/bin/bash

# File Migration Script - Move files from local /files to R2 bucket

echo "📁 Cuza Files Migration Script"
echo "=============================="

# Check if we're in the correct directory
if [ ! -d "../files" ]; then
    echo "❌ Error: ../files directory not found. Please run this script from the cuza-worker directory."
    exit 1
fi

# Check if wrangler is installed
if ! command -v pnpm wrangler &> /dev/null; then
    echo "❌ Error: Wrangler CLI not found. Please install it first:"
    echo "   pnpm install -D wrangler"
    exit 1
fi

# Check if R2 bucket exists
echo "🗄️  Checking R2 bucket..."
if ! pnpm wrangler r2 bucket list | grep -q "cuza-bucket"; then
    echo "❌ Error: R2 bucket 'cuza-bucket' not found. Please create it first:"
    echo "   pnpm wrangler r2 bucket create cuza-bucket"
    exit 1
fi

# Count total files to migrate
echo "🔍 Scanning files to migrate..."
TOTAL_FILES=$(find ../files -name "*.pdf" | wc -l)
echo "📊 Found $TOTAL_FILES PDF files to migrate"

if [ "$TOTAL_FILES" -eq 0 ]; then
    echo "✅ No PDF files found to migrate."
    exit 0
fi

# Ask for confirmation
echo ""
echo "This will upload all PDF files from ../files/ to the R2 bucket."
echo "Do you want to continue? (y/N)"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled."
    exit 0
fi

# Migration function
migrate_files() {
    local uploaded=0
    local failed=0
    
    echo ""
    echo "🚀 Starting migration..."
    echo ""
    
    while IFS= read -r -d '' file; do
        # Get relative path from files directory
        relative_path=${file#../files/}
        
        # Create R2 path (add files/ prefix to maintain structure)
        r2_path="files/$relative_path"
        
        echo "📤 Uploading: $relative_path"

        if pnpm wrangler r2 object put "cuza-bucket/$r2_path" --file "$file" --content-type "application/pdf" 2>/dev/null; then
            echo "   ✅ Success"
            ((uploaded++))
        else
            echo "   ❌ Failed"
            ((failed++))
        fi
        
        # Progress indicator
        local current=$((uploaded + failed))
        local percent=$((current * 100 / TOTAL_FILES))
        echo "   📊 Progress: $current/$TOTAL_FILES ($percent%)"
        echo ""
        
    done < <(find ../files -name "*.pdf" -print0)
    
    echo "📋 Migration Summary:"
    echo "   ✅ Successfully uploaded: $uploaded files"
    echo "   ❌ Failed uploads: $failed files"
    echo "   📊 Total processed: $((uploaded + failed)) files"
    
    if [ "$failed" -eq 0 ]; then
        echo ""
        echo "🎉 Migration completed successfully!"
        echo ""
        echo "🔍 Verify your files:"
        echo "   pnpm wrangler r2 object list cuza-bucket --prefix files/"
        echo ""
        echo "🌐 Test the API:"
        echo "   curl https://???-worker.???.workers.dev/api/files"
    else
        echo ""
        echo "⚠️  Migration completed with errors. Please check the failed uploads manually."
    fi
}

# Run migration
migrate_files
