@echo off
REM Build script for Pranavam Platform - Vite build and Amplify deployment setup
REM This script handles the complete build process including directory structure setup for Amplify

echo Starting Pranavam Platform build for Amplify deployment...

REM Clean previous build
echo Cleaning previous build...
if exist dist rmdir /s /q dist

REM Run Vite build
echo Running Vite build...
call npm run build

REM Check if build was successful
if not exist dist (
    echo Build failed - dist directory not created
    exit /b 1
)

echo Vite build completed successfully

REM Create directory structure for Amplify routing
echo Setting up Amplify directory structure...

REM Create directories for each route
mkdir dist\staking 2>nul
mkdir dist\exchange 2>nul
mkdir dist\whitepaper 2>nul
mkdir dist\admin 2>nul

REM Copy HTML files to their respective directories as index.html
echo Copying HTML files for directory-based routing...

REM Staking route
if exist dist\staking-fixed-clean.html (
    copy dist\staking-fixed-clean.html dist\staking\index.html >nul
    echo   - Staking page copied
) else (
    echo   - Warning: staking-fixed-clean.html not found
)

REM Exchange route
if exist dist\exchange-fixed.html (
    copy dist\exchange-fixed.html dist\exchange\index.html >nul
    echo   - Exchange page copied
) else (
    echo   - Warning: exchange-fixed.html not found
)

REM Whitepaper route
if exist dist\whitepaper.html (
    copy dist\whitepaper.html dist\whitepaper\index.html >nul
    echo   - Whitepaper page copied
) else (
    echo   - Warning: whitepaper.html not found
)

REM Admin route
if exist dist\admin.html (
    copy dist\admin.html dist\admin\index.html >nul
    echo   - Admin page copied
) else (
    echo   - Warning: admin.html not found
)

REM Create/update _redirects file for Amplify
echo Creating _redirects file...
(
echo # Amplify _redirects file - handle S3 forced trailing slashes
echo # Since S3 automatically redirects /path to /path/, we handle the trailing slash versions
echo.
echo # Primary routes with trailing slashes ^(what S3 actually serves^)
echo /staking/ /staking-fixed-clean.html 200
echo /exchange/ /exchange-fixed.html 200  
echo /whitepaper/ /whitepaper.html 200
echo /admin/ /admin.html 200
echo.
echo # Handle exact path matches ^(before S3 redirects^)
echo /staking /staking-fixed-clean.html 200
echo /exchange /exchange-fixed.html 200
echo /whitepaper /whitepaper.html 200
echo /admin /admin.html 200
echo.
echo # Hash routes for homepage sections
echo /#overview /index.html 200
echo /#architecture /index.html 200
echo /#economics /index.html 200
echo /#staking-tiers /index.html 200
echo /#governance /index.html 200
echo /#roadmap /index.html 200
echo.
echo # Root homepage
echo / /index.html 200
) > dist\_redirects
echo   - _redirects file created

REM Create amplify.yml if it doesn't exist
if not exist amplify.yml (
    echo Creating amplify.yml configuration...
    (
echo version: 1
echo frontend:
echo   phases:
echo     preBuild:
echo       commands:
echo         - npm ci
echo     build:
echo       commands:
echo         - npm run build
echo   artifacts:
echo     baseDirectory: dist
echo     files:
echo       - '**/*'
echo   cache:
echo     paths:
echo       - node_modules/**/*
echo   customHeaders:
echo     - pattern: '**/*'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=3600'
echo     - pattern: '*.js'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=31536000, immutable'
echo     - pattern: '*.css'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=31536000, immutable'
echo     - pattern: '*.jpg'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=31536000, immutable'
echo     - pattern: '*.jpeg'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=31536000, immutable'
echo     - pattern: '*.png'
echo       headers:
echo         - key: 'Cache-Control'
echo           value: 'public, max-age=31536000, immutable'
echo   redirects:
echo     - source: /staking
echo       target: /staking-fixed-clean.html
echo       status: '200'
echo     - source: /staking/
echo       target: /staking-fixed-clean.html
echo       status: '200'
echo     - source: /exchange
echo       target: /exchange-fixed.html
echo       status: '200'
echo     - source: /exchange/
echo       target: /exchange-fixed.html
echo       status: '200'
echo     - source: /whitepaper
echo       target: /whitepaper.html
echo       status: '200'
echo     - source: /whitepaper/
echo       target: /whitepaper.html
echo       status: '200'
echo     - source: /admin
echo       target: /admin.html
echo       status: '200'
echo     - source: /admin/
echo       target: /admin.html
echo       status: '200'
    ) > amplify.yml
    echo   - amplify.yml created
) else (
    echo   - amplify.yml already exists, skipping creation
)

REM Create .amplifyignore if it doesn't exist
if not exist .amplifyignore (
    echo Creating .amplifyignore...
    (
echo # Amplify ignore file
echo node_modules/
echo src/
echo public/
echo .git/
echo .gitignore
echo README.md
echo package-lock.json
echo vite.config.js
echo .env
echo .env.local
echo .vscode/
echo *.log
echo *.zip
echo build-amplify.sh
echo build-amplify.bat
    ) > .amplifyignore
    echo   - .amplifyignore created
) else (
    echo   - .amplifyignore already exists, skipping creation
)

REM Create deployment zip (requires PowerShell)
echo Creating deployment package...
cd dist
powershell -command "Compress-Archive -Path * -DestinationPath ../pranavam-amplify-deployment.zip -Force"
cd ..
echo   - Deployment package created: pranavam-amplify-deployment.zip

REM Summary
echo.
echo Build completed successfully!
echo.
echo Build Summary:
echo   - Vite build: Completed
echo   - Directory structure: Created
echo   - Route setup: Configured
echo   - _redirects file: Created
echo   - amplify.yml: Ready
echo   - Deployment zip: Created
echo.
echo Next steps:
echo   1. Deploy using: pranavam-amplify-deployment.zip
echo   2. Or push to git and let Amplify build automatically
echo.
echo Build for Amplify deployment complete!
pause