#!/bin/bash

# PRANA Mainnet Deployment Script
# ⚠️ CAUTION: This deploys REAL contracts with REAL value!

echo "=================================================="
echo "🚀 PRANA Smart Contracts - BSC MAINNET Deployment"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Safety check - require explicit mainnet flag
if [ "$1" != "--confirm-mainnet" ]; then
    echo -e "${RED}❌ Safety check failed!${NC}"
    echo ""
    echo "This script deploys to MAINNET with REAL funds."
    echo "To proceed, run: ./deploy-mainnet.sh --confirm-mainnet"
    exit 1
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found!${NC}"
    exit 1
fi

# Check if PRIVATE_KEY is set
if ! grep -q "PRIVATE_KEY=0x" .env; then
    echo -e "${RED}❌ Error: PRIVATE_KEY not set in .env file!${NC}"
    exit 1
fi

# Check if testnet deployment exists
if [ ! -f "deployments/bscTestnet.json" ]; then
    echo -e "${YELLOW}⚠️  Warning: No testnet deployment found${NC}"
    echo "It's recommended to test on testnet first."
    echo ""
fi

echo ""
echo -e "${RED}🚨 MAINNET DEPLOYMENT CHECKLIST 🚨${NC}"
echo ""
echo "Please confirm ALL of the following:"
echo ""
echo "[ ] Contracts tested thoroughly on testnet"
echo "[ ] Security audit completed (if applicable)"
echo "[ ] Deployment wallet has 2-3 BNB for gas"
echo "[ ] Team wallets prepared for distribution"
echo "[ ] Multi-sig wallet deployed and tested"
echo "[ ] Legal compliance verified"
echo "[ ] Community announcement prepared"
echo "[ ] All contract parameters double-checked"
echo "[ ] Backup of all keys and contracts"
echo ""

read -p "Have you completed ALL items above? (yes/no): " checklist
if [ "$checklist" != "yes" ]; then
    echo "Please complete all checklist items before deployment."
    exit 1
fi

echo ""
echo "🔑 Deployment wallet check..."
WALLET_INFO=$(npx hardhat accounts --network bscMainnet 2>/dev/null | head -n 1)
echo "Wallet: $WALLET_INFO"
echo ""

# Show deployment preview
echo -e "${CYAN}📋 Deployment Preview:${NC}"
echo "Network: BSC Mainnet (Chain ID: 56)"
echo "Total Supply: 21,000,000,000 PRANA"
echo "Exchange Rate: 1 PRANA = 0.10 USDT"
echo "Staking ROI: 1.2% daily (200% cap)"
echo "Referral Levels: 8 (4%, 2%, 1%, 1%, 1%, 1%, 1%, 1%)"
echo ""

# Final confirmation with typed response
echo -e "${RED}⚠️  FINAL CONFIRMATION ⚠️${NC}"
echo "You are about to deploy contracts to BSC MAINNET."
echo "This action CANNOT be undone and involves REAL funds."
echo ""
echo "To proceed, type exactly: ${YELLOW}DEPLOY TO MAINNET${NC}"
read -p "> " final_confirm

if [ "$final_confirm" != "DEPLOY TO MAINNET" ]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting MAINNET deployment..."
echo "🕐 This may take several minutes..."
echo ""

# Create deployment backup
mkdir -p backups
cp -r contracts backups/contracts_$(date +%Y%m%d_%H%M%S)

# Run deployment
npx hardhat run scripts/deploy.js --network bscMainnet

# Check if deployment was successful
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ MAINNET DEPLOYMENT COMPLETED!${NC}"
    echo ""
    echo "📄 CRITICAL NEXT STEPS:"
    echo ""
    echo "1. ${YELLOW}SAVE CONTRACT ADDRESSES${NC}"
    echo "   Location: contracts/deployments/bscMainnet.json"
    echo ""
    echo "2. ${YELLOW}VERIFY CONTRACTS ON BSCSCAN${NC}"
    echo "   Run: npm run verify:mainnet"
    echo ""
    echo "3. ${YELLOW}TRANSFER OWNERSHIP TO MULTI-SIG${NC}"
    echo "   This should be done IMMEDIATELY"
    echo ""
    echo "4. ${YELLOW}UPDATE FRONTEND CONFIGURATION${NC}"
    echo "   Add mainnet addresses to website config"
    echo ""
    echo "5. ${YELLOW}ANNOUNCE TO COMMUNITY${NC}"
    echo "   Share contract addresses and BSCScan links"
    echo ""
    echo -e "${CYAN}🎉 Congratulations! PRANA is now live on BSC Mainnet!${NC}"
else
    echo ""
    echo -e "${RED}❌ DEPLOYMENT FAILED!${NC}"
    echo "DO NOT attempt to redeploy without investigating the issue."
    echo "Check gas balance and error messages above."
    exit 1
fi