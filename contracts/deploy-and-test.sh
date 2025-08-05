#!/bin/bash

# PRANA Test Deployment Script for Manual Testing
# Deploys contracts and provides test instructions

echo "=================================================="
echo "🧪 PRANA Contracts - Test Deployment & Setup"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check .env
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please add your PRIVATE_KEY to .env file${NC}"
    exit 1
fi

echo "📋 Deployment Summary:"
echo "- Network: BSC Testnet"
echo "- Your Balance: 0.3 TBNB"
echo "- Contracts: Token, Exchange, Staking"
echo ""

read -p "Deploy contracts now? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    exit 0
fi

echo ""
echo "🚀 Deploying contracts..."
npx hardhat run scripts/deploy.js --network bscTestnet

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    
    # Extract addresses from deployment file
    DEPLOYMENT_FILE="deployments/bscTestnet.json"
    if [ -f "$DEPLOYMENT_FILE" ]; then
        echo ""
        echo -e "${CYAN}📄 Contract Addresses:${NC}"
        PRANA_TOKEN=$(grep -o '"pranaToken"[[:space:]]*:[[:space:]]*{[^}]*"address"[[:space:]]*:[[:space:]]*"[^"]*"' $DEPLOYMENT_FILE | grep -o '0x[a-fA-F0-9]\{40\}')
        PRANA_EXCHANGE=$(grep -o '"pranaExchange"[[:space:]]*:[[:space:]]*{[^}]*"address"[[:space:]]*:[[:space:]]*"[^"]*"' $DEPLOYMENT_FILE | grep -o '0x[a-fA-F0-9]\{40\}')
        PRANA_STAKING=$(grep -o '"pranaStaking"[[:space:]]*:[[:space:]]*{[^}]*"address"[[:space:]]*:[[:space:]]*"[^"]*"' $DEPLOYMENT_FILE | grep -o '0x[a-fA-F0-9]\{40\}')
        USDT_TOKEN=$(grep -o '"usdtToken"[[:space:]]*:[[:space:]]*{[^}]*"address"[[:space:]]*:[[:space:]]*"[^"]*"' $DEPLOYMENT_FILE | grep -o '0x[a-fA-F0-9]\{40\}')
        
        echo "PRANA Token: $PRANA_TOKEN"
        echo "PRANA Exchange: $PRANA_EXCHANGE"
        echo "PRANA Staking: $PRANA_STAKING"
        echo "Test USDT: $USDT_TOKEN"
        
        # Create test instructions
        echo ""
        echo -e "${YELLOW}📝 TESTING INSTRUCTIONS:${NC}"
        echo ""
        echo "1. ADD TOKENS TO METAMASK:"
        echo "   - Click 'Import tokens' in MetaMask"
        echo "   - Add PRANA Token: $PRANA_TOKEN"
        echo "   - Add Test USDT: $USDT_TOKEN"
        echo ""
        echo "2. GET TEST TOKENS:"
        echo "   The deployment already gave you:"
        echo "   - Some PRANA tokens for testing"
        echo "   - Some test USDT for swapping"
        echo ""
        echo "3. TEST SWAPPING:"
        echo "   a) Go to Exchange page"
        echo "   b) Buy PRANA with USDT (min 50 USDT)"
        echo "   c) Sell PRANA for USDT (min 1000 PRANA)"
        echo ""
        echo "4. TEST STAKING:"
        echo "   a) Go to Staking page"
        echo "   b) Stake PRANA (min 10 PRANA)"
        echo "   c) Wait and claim rewards (1.2% daily)"
        echo "   d) Test referral by using different address"
        echo ""
        echo "5. VERIFY ON BSCSCAN:"
        echo "   https://testnet.bscscan.com/address/$PRANA_TOKEN"
        echo "   https://testnet.bscscan.com/address/$PRANA_EXCHANGE"
        echo "   https://testnet.bscscan.com/address/$PRANA_STAKING"
        
        # Save test config
        cat > test-config.json << EOF
{
  "network": "bscTestnet",
  "chainId": 97,
  "contracts": {
    "pranaToken": "$PRANA_TOKEN",
    "pranaExchange": "$PRANA_EXCHANGE",
    "pranaStaking": "$PRANA_STAKING",
    "usdtToken": "$USDT_TOKEN"
  },
  "testAccounts": {
    "deployer": "Your wallet address",
    "tester1": "Create new account in MetaMask",
    "tester2": "Create another account for referral testing"
  },
  "testAmounts": {
    "minBuy": "50 USDT",
    "minSell": "1000 PRANA",
    "minStake": "10 PRANA"
  }
}
EOF
        
        echo ""
        echo -e "${GREEN}✅ Test configuration saved to: test-config.json${NC}"
    fi
else
    echo -e "${RED}❌ Deployment failed!${NC}"
    exit 1
fi