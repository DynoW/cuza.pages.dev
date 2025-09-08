#!/bin/bash

# Cuza Worker Deployment Script

echo "🚀 Deploying Cuza Worker..."

# Check if we're in the correct directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: wrangler.toml not found. Please run this script from the cuza-worker directory."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Login check
echo "🔐 Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "🔑 Please login to Wrangler:"
    wrangler login
fi

# Check if R2 bucket exists
echo "🗄️  Checking R2 bucket..."
if ! wrangler r2 bucket list | grep -q "cuza-bucket"; then
    echo "📦 Creating R2 bucket 'cuza-bucket'..."
    wrangler r2 bucket create cuza-bucket
    echo "✅ R2 bucket created successfully!"
else
    echo "✅ R2 bucket 'cuza-bucket' already exists."
fi

# Check environment variables
echo "🔧 Checking environment variables..."
ENV_VARS_SET=true

if ! wrangler secret list | grep -q "UPLOAD_PASSWORD"; then
    echo "⚠️  UPLOAD_PASSWORD not set."
    ENV_VARS_SET=false
fi

if ! wrangler secret list | grep -q "GITHUB_TOKEN"; then
    echo "⚠️  GITHUB_TOKEN not set."
    ENV_VARS_SET=false
fi

if [ "$ENV_VARS_SET" = false ]; then
    echo ""
    echo "🔐 Setting up environment variables..."
    echo "Please enter your upload password:"
    wrangler secret put UPLOAD_PASSWORD
    
    echo "Please enter your GitHub token (with repo permissions):"
    wrangler secret put GITHUB_TOKEN
    echo "✅ Environment variables configured!"
fi

# Deploy the worker
echo ""
echo "🚀 Deploying worker..."
if wrangler deploy; then
    echo ""
    echo "🎉 Deployment successful!"
    echo ""
    echo "📋 Worker endpoints:"
    echo "   📄 File listing: https://???-worker.???.workers.dev/files"
    echo "   📁 File serving: https://???-worker.???.workers.dev/files/{path}"
    echo "   📤 File upload:  https://???-worker.???.workers.dev/upload"
    echo ""
    echo "🔍 Test your deployment:"
    echo "   curl https://???-worker.???.workers.dev/files"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Upload your existing files to the R2 bucket"
    echo "   2. Update your frontend to point to the new worker URL"
    echo "   3. Test file uploads and downloads"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
