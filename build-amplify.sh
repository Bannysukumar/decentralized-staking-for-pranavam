#!/bin/bash
# Build script for Pranavam Platform - Vite build and Amplify deployment setup
# This script handles the complete build process including directory structure setup for Amplify

echo "🚀 Starting Pranavam Platform build for Amplify deployment..."

# Exit on any error
set -e

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist

# Run Vite build
echo "🔨 Running Vite build..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not created"
    exit 1
fi

echo "✅ Vite build completed successfully"

# Create directory structure for Amplify routing
echo "📁 Setting up Amplify directory structure..."

# Create directories only for routes that need them
mkdir -p dist/staking
mkdir -p dist/exchange

# Copy HTML files for directory-based routing (staking and exchange only)
echo "📄 Setting up routing structure..."

# Staking route - use directory structure
if [ -f "dist/staking-fixed-clean.html" ]; then
    cp dist/staking-fixed-clean.html dist/staking/index.html
    echo "  ✓ Staking page copied to /staking/ directory"
else
    echo "  ⚠️  Warning: staking-fixed-clean.html not found"
fi

# Exchange route - use directory structure
if [ -f "dist/exchange-fixed.html" ]; then
    cp dist/exchange-fixed.html dist/exchange/index.html
    echo "  ✓ Exchange page copied to /exchange/ directory"
else
    echo "  ⚠️  Warning: exchange-fixed.html not found"
fi

# Whitepaper and Admin stay as root-level HTML files
echo "  ✓ Whitepaper and Admin remain as root-level HTML files"

# Remove only the HTML files that now have directory versions
echo "🧹 Cleaning up duplicate HTML files..."
rm -f dist/staking-fixed-clean.html
rm -f dist/exchange-fixed.html
echo "  ✓ Duplicate staking and exchange HTML files removed"

# Create/update _redirects file for Amplify
echo "📝 Creating _redirects file..."
cat > dist/_redirects << 'EOF'
# Amplify _redirects file - Mixed routing approach
# Directory structure for main routes, direct HTML for admin/whitepaper

# Main routes - use directory structure (most reliable for Amplify)
/staking /staking/ 200
/exchange /exchange/ 200

# Direct HTML file routes
/whitepaper /whitepaper.html 200
/admin /admin.html 200

# Hash routes for homepage sections
/#overview /index.html 200
/#architecture /index.html 200
/#economics /index.html 200
/#staking-tiers /index.html 200
/#governance /index.html 200
/#roadmap /index.html 200

# Root homepage
/ /index.html 200
EOF
echo "  ✓ _redirects file created"

# Create amplify.yml if it doesn't exist
if [ ! -f "amplify.yml" ]; then
    echo "📝 Creating amplify.yml configuration..."
    cat > amplify.yml << 'EOF'
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
  customHeaders:
    - pattern: '**/*'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=3600'
    - pattern: '*.js'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=31536000, immutable'
    - pattern: '*.css'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=31536000, immutable'
    - pattern: '*.jpg'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=31536000, immutable'
    - pattern: '*.jpeg'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=31536000, immutable'
    - pattern: '*.png'
      headers:
        - key: 'Cache-Control'
          value: 'public, max-age=31536000, immutable'
  redirects:
    - source: /staking
      target: /staking/
      status: '200'
    - source: /exchange
      target: /exchange/
      status: '200'
    - source: /whitepaper
      target: /whitepaper.html
      status: '200'
    - source: /admin
      target: /admin.html
      status: '200'
EOF
    echo "  ✓ amplify.yml created"
else
    echo "  ℹ️  amplify.yml already exists, skipping creation"
fi

# Create .amplifyignore if it doesn't exist
if [ ! -f ".amplifyignore" ]; then
    echo "📝 Creating .amplifyignore..."
    cat > .amplifyignore << 'EOF'
# Amplify ignore file
node_modules/
src/
public/
.git/
.gitignore
README.md
package-lock.json
vite.config.js
.env
.env.local
.vscode/
*.log
*.zip
build-amplify.sh
EOF
    echo "  ✓ .amplifyignore created"
else
    echo "  ℹ️  .amplifyignore already exists, skipping creation"
fi

# Create deployment zip
echo "📦 Creating deployment package..."
cd dist
zip -r ../pranavam-amplify-deployment.zip . > /dev/null 2>&1
cd ..

# Verify zip was created successfully
if [ -f "pranavam-amplify-deployment.zip" ]; then
    ZIP_SIZE=$(du -h pranavam-amplify-deployment.zip | cut -f1)
    echo "  ✅ Deployment package created: pranavam-amplify-deployment.zip ($ZIP_SIZE)"
else
    echo "  ❌ Failed to create deployment package"
    exit 1
fi

# Summary
echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📊 Build Summary:"
echo "  - Vite build: ✓"
echo "  - Directory structure: ✓"
echo "  - Route setup: ✓"
echo "  - _redirects file: ✓"
echo "  - amplify.yml: ✓"
echo "  - Deployment zip: ✓"
echo ""
echo "📌 Next steps:"
echo "  1. Deploy using: pranavam-amplify-deployment.zip"
echo "  2. Or push to git and let Amplify build automatically"
echo ""
echo "🎉 Build for Amplify deployment complete!"