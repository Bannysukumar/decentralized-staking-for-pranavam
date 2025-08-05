#!/bin/bash

# PRANA Testnet Deployment Script
# This script helps deploy contracts to BSC Testnet

echo "=================================================="
echo "🚀 PRANA Smart Contracts - BSC Testnet Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    echo "Creating .env from template..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file and add your PRIVATE_KEY${NC}"
    echo "Then run this script again."
    exit 1
fi

# Check if PRIVATE_KEY is set
if ! grep -q "PRIVATE_KEY=0x" .env; then
    echo -e "${RED}❌ Error: PRIVATE_KEY not set in .env file!${NC}"
    echo "Please add your deployment wallet private key to .env"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo ""
echo "🔍 Pre-deployment checklist:"
echo "✓ .env file exists"
echo "✓ Private key configured"
echo "✓ Dependencies installed"
echo ""

# Get wallet address
echo "🔑 Deployment wallet check..."
WALLET_INFO=$(npx hardhat accounts --network bscTestnet 2>/dev/null | head -n 1)
if [ -z "$WALLET_INFO" ]; then
    echo -e "${RED}❌ Error: Could not read wallet address${NC}"
    exit 1
fi

echo "Wallet: $WALLET_INFO"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  You are about to deploy to BSC TESTNET${NC}"
echo "Please ensure:"
echo "1. Your wallet has at least 0.5 BNB for gas"
echo "2. You are using a test wallet, not your main wallet"
echo ""
read -p "Continue with deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Run deployment
npx hardhat run scripts/deploy.js --network bscTestnet

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
    echo ""
    echo "📄 Next steps:"
    echo "1. Check contracts/deployments/bscTestnet.json for addresses"
    echo "2. Verify contracts: npm run verify:testnet"
    echo "3. Test the contracts using the frontend"
    echo "4. Add liquidity if needed"
    echo ""
    echo "📌 Contract addresses saved to: contracts/deployments/bscTestnet.json"
else
    echo ""
    echo -e "${RED}❌ Deployment failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi