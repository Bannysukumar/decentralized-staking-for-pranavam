# PRANA Smart Contracts Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Node.js v16+ installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`npm install` in contracts directory)
- [ ] MetaMask or hardware wallet ready
- [ ] Sufficient BNB for gas fees (0.5 BNB testnet, 2-3 BNB mainnet)

### 2. Configuration Files
- [ ] `.env` file created from `.env.example`
- [ ] Private key added to `.env` (NEVER commit this!)
- [ ] RPC URLs configured
- [ ] API keys added (BSCScan for verification)

## 🔧 Environment Configuration

### Step 1: Create .env File

```bash
cd /mnt/d/projects/pranavam-launch/unified-platform/contracts
cp .env.example .env
```

### Step 2: Edit .env File

```bash
# CRITICAL: Use a dedicated deployment wallet, NOT your main wallet
PRIVATE_KEY=your_deployment_wallet_private_key_here

# RPC URLs (defaults work, but you can use your own)
BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
BSC_MAINNET_RPC=https://bsc-dataseed1.binance.org/

# BSCScan API Key (get from https://bscscan.com/myapikey)
BSCSCAN_API_KEY=your_bscscan_api_key_here

# Optional: Customize deployment parameters
INITIAL_PRANA_LIQUIDITY=1000000
INITIAL_USDT_LIQUIDITY=100000
```

## 🧪 BSC Testnet Deployment

### Step 1: Get Test BNB
1. Visit BSC Testnet Faucet: https://testnet.bnbchain.org/faucet-smart
2. Enter your deployment wallet address
3. Request 0.5 BNB (sufficient for deployment + testing)

### Step 2: Deploy to Testnet

```bash
# Make sure you're in the contracts directory
cd /mnt/d/projects/pranavam-launch/unified-platform/contracts

# Run deployment script
npx hardhat run scripts/deploy.js --network bscTestnet
```

### Expected Output:
```
🚀 Starting Pranavam Platform Deployment
📡 Network: bscTestnet
👤 Deployer: 0xYourAddress
💰 Balance: 0.5 ETH
================================================================================
📦 Deploying Mock USDT Token for testing...
✅ Mock USDT deployed to: 0x...
📦 Deploying PRANA Token...
✅ PRANA Token deployed to: 0x...
📦 Deploying PRANA Exchange...
✅ PRANA Exchange deployed to: 0x...
📦 Deploying PRANA Staking...
✅ PRANA Staking deployed to: 0x...
💧 Setting up initial liquidity...
✅ Initial liquidity setup complete
================================================================================
🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!
================================================================================
📄 Contract Addresses:
🪙 PRANA Token: 0x...
💱 PRANA Exchange: 0x...
🎁 PRANA Staking: 0x...
💳 USDT Token: 0x...
================================================================================
```

### Step 3: Verify Contracts on BSCScan

```bash
# Automatic verification (if BSCSCAN_API_KEY is set)
npx hardhat run scripts/verify.js --network bscTestnet

# Or manual verification for each contract
npx hardhat verify --network bscTestnet PRANA_TOKEN_ADDRESS
npx hardhat verify --network bscTestnet PRANA_EXCHANGE_ADDRESS PRANA_TOKEN_ADDRESS USDT_ADDRESS
npx hardhat verify --network bscTestnet PRANA_STAKING_ADDRESS PRANA_TOKEN_ADDRESS
```

### Step 4: Test the Deployment

```bash
# Run integration tests on testnet
npx hardhat test test/Integration.test.js --network bscTestnet
```

## 🚀 BSC Mainnet Deployment

### ⚠️ CRITICAL MAINNET CHECKLIST

Before deploying to mainnet, ensure:
- [ ] All contracts tested thoroughly on testnet
- [ ] Security audit completed (if applicable)
- [ ] Deployment wallet funded with 2-3 BNB
- [ ] Team wallets ready for token distribution
- [ ] Multi-sig wallet deployed for treasury
- [ ] Legal compliance verified
- [ ] Community announcement prepared

### Step 1: Final Configuration Review

```bash
# Review deployment configuration
cat .env

# Verify contract parameters
grep -E "TOTAL_SUPPLY|DAILY_ROI|REFERRAL_RATES" contracts/core/*.sol
```

### Step 2: Deploy to Mainnet

```bash
# FINAL CONFIRMATION: This will deploy real contracts with real value
# Make sure everything is correct before proceeding!

npx hardhat run scripts/deploy.js --network bscMainnet
```

### Step 3: Verify on BSCScan Mainnet

```bash
# Verify all contracts
npx hardhat run scripts/verify.js --network bscMainnet
```

### Step 4: Post-Deployment Setup

```bash
# 1. Add liquidity (if not done automatically)
npx hardhat run scripts/setup-liquidity.js --network bscMainnet

# 2. Transfer ownership to multi-sig (recommended)
# Create a separate script or use hardhat console
```

## 📊 Post-Deployment Tasks

### 1. Update Frontend Configuration

Create `/public/js/config.js`:
```javascript
const NETWORK_CONFIG = {
  bscTestnet: {
    chainId: 97,
    pranaToken: "0x...", // Your deployed PRANA token
    pranaExchange: "0x...", // Your deployed exchange
    pranaStaking: "0x...", // Your deployed staking
    usdtToken: "0x...", // USDT address
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/"
  },
  bscMainnet: {
    chainId: 56,
    pranaToken: "0x...", // Your deployed PRANA token
    pranaExchange: "0x...", // Your deployed exchange
    pranaStaking: "0x...", // Your deployed staking
    usdtToken: "0x55d398326f99059fF775485246999027B3197955", // BSC USDT
    rpcUrl: "https://bsc-dataseed1.binance.org/"
  }
};
```

### 2. Initialize Token Distribution

```javascript
// Script to distribute initial tokens
const distributions = [
  { category: "referral", address: "0x...", amount: "5040000000" }, // 5.04B
  { category: "ecosystem", address: "0x...", amount: "4200000000" }, // 4.20B
  { category: "staking", address: "0x...", amount: "3150000000" }, // 3.15B
  // ... etc
];
```

### 3. Setup Monitoring

- Configure BSCScan email alerts for contract activity
- Setup Dune Analytics dashboard for metrics
- Implement backend monitoring for key events

## 🛠️ Troubleshooting

### Common Issues:

1. **"Insufficient funds"**
   - Ensure wallet has enough BNB for gas
   - Testnet: 0.5 BNB minimum
   - Mainnet: 2-3 BNB recommended

2. **"Nonce too low"**
   - Reset MetaMask account in Settings > Advanced
   - Or wait for pending transactions to complete

3. **"Contract size exceeds limit"**
   - Already optimized in hardhat.config.js
   - If still occurs, reduce optimizer runs

4. **Verification fails**
   - Ensure correct constructor arguments
   - Wait 5 minutes after deployment
   - Use correct network in verify command

## 🔒 Security Best Practices

1. **Deployment Wallet**
   - Use a dedicated deployment wallet
   - Transfer ownership after deployment
   - Never reuse for other purposes

2. **Private Key Management**
   - Never commit .env file
   - Use hardware wallet for mainnet
   - Consider using AWS KMS or similar

3. **Multi-Signature Setup**
   ```solidity
   // Transfer ownership to multi-sig
   await pranaToken.transferOwnership(multiSigAddress);
   await pranaExchange.transferOwnership(multiSigAddress);
   await pranaStaking.transferOwnership(multiSigAddress);
   ```

4. **Timelock Implementation**
   - Consider adding timelock for admin functions
   - Provides time for users to react to changes

## 📝 Deployment Verification

### Testnet Verification URLs:
- Token: `https://testnet.bscscan.com/address/[TOKEN_ADDRESS]`
- Exchange: `https://testnet.bscscan.com/address/[EXCHANGE_ADDRESS]`
- Staking: `https://testnet.bscscan.com/address/[STAKING_ADDRESS]`

### Mainnet Verification URLs:
- Token: `https://bscscan.com/address/[TOKEN_ADDRESS]`
- Exchange: `https://bscscan.com/address/[EXCHANGE_ADDRESS]`
- Staking: `https://bscscan.com/address/[STAKING_ADDRESS]`

## 🎯 Quick Commands Reference

```bash
# Testnet deployment
npx hardhat run scripts/deploy.js --network bscTestnet

# Mainnet deployment
npx hardhat run scripts/deploy.js --network bscMainnet

# Verify contracts
npx hardhat run scripts/verify.js --network [network]

# Check deployment
npx hardhat console --network [network]

# Gas estimation
npx hardhat test --network [network]

# Contract sizes
npx hardhat size-contracts
```

## 📞 Support

If you encounter issues:
1. Check deployment logs in `contracts/deployments/[network].json`
2. Verify transaction on BSCScan
3. Review error messages carefully
4. Contact team lead before mainnet deployment

---

**⚡ FINAL REMINDER**: Mainnet deployment involves real funds. Double-check everything, have a second team member review, and ensure all security measures are in place before proceeding.