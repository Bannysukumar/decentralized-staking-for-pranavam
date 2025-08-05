# 🚀 Complete PRANA Deployment & Setup Guide
## Mainnet & Testnet Instructions

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Testnet Deployment](#testnet-deployment)
3. [Mainnet Deployment](#mainnet-deployment)
4. [MetaMask Token Import](#metamask-token-import)
5. [Contract Verification](#contract-verification)
6. [Testing & Validation](#testing--validation)
7. [Troubleshooting](#troubleshooting)

---

## 🛠️ Prerequisites

### Required Software:
- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher
- **Git**: Latest version
- **MetaMask**: Browser extension installed

### Required Accounts & Keys:
- **BSC Wallet**: With BNB for gas fees
- **API Keys** (for contract verification):
  - BSCScan API key (get from: https://bscscan.com/apis)
  - Optional: Infura, Alchemy for additional networks

### Gas Requirements:
- **Testnet**: 0.5 TBNB (minimum)
- **Mainnet**: 0.1 BNB (minimum)

---

## 🧪 Testnet Deployment

### Step 1: Environment Setup

1. **Clone and Setup Project:**
   ```bash
   git clone <repository-url>
   cd unified-platform/contracts
   npm install
   ```

2. **Configure Environment Variables:**
   ```bash
   # Create .env file
   cp .env.example .env
   ```

   **Edit `.env` file:**
   ```env
   # Your wallet private key (NEVER commit this!)
   PRIVATE_KEY=your_private_key_here
   
   # BSC Testnet RPC
   BSC_TESTNET_RPC=https://data-seed-prebsc-1-s1.binance.org:8545/
   
   # BSCScan API (for verification)
   BSCSCAN_API_KEY=your_bscscan_api_key
   
   # Deployment settings
   DEPLOY_NETWORK=bscTestnet
   VERIFY_CONTRACTS=true
   ```

### Step 2: Add BSC Testnet to MetaMask

1. **Open MetaMask** → Click network dropdown → "Add Network"
2. **Enter BSC Testnet details:**
   ```
   Network Name: BSC Testnet
   RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545/
   Chain ID: 97
   Currency Symbol: BNB
   Block Explorer URL: https://testnet.bscscan.com/
   ```
3. **Get Test BNB:** https://testnet.binance.org/faucet-smart

### Step 3: Deploy Contracts

1. **Compile Contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Deploy to BSC Testnet:**
   ```bash
   npx hardhat run scripts/deploy.js --network bscTestnet
   ```

3. **Deploy Test USDT (if needed):**
   ```bash
   npx hardhat run scripts/deploy-test-tokens.js --network bscTestnet
   ```

4. **Setup Test Tokens:**
   ```bash
   npx hardhat run scripts/test-interactions.js --network bscTestnet
   ```

### Step 4: Record Contract Addresses
After deployment, save these addresses from console output:
```
PRANA Token: 0x...
PRANA Exchange: 0x...
PRANA Staking: 0x...
Test USDT: 0x...
```

---

## 🌐 Mainnet Deployment

### Step 1: Mainnet Environment Setup

1. **Update `.env` for Mainnet:**
   ```env
   # BSC Mainnet RPC
   BSC_MAINNET_RPC=https://bsc-dataseed1.binance.org/
   
   # Real USDT on BSC Mainnet
   USDT_TOKEN_ADDRESS=0x55d398326f99059fF775485246999027B3197955
   
   # Deployment settings
   DEPLOY_NETWORK=bscMainnet
   VERIFY_CONTRACTS=true
   
   # Security settings (use multisig for production)
   MULTI_SIG_WALLET=your_multisig_address
   ADMIN_WALLET=your_admin_address
   TREASURY_WALLET=your_treasury_address
   ```

2. **Add BSC Mainnet to MetaMask:**
   ```
   Network Name: Smart Chain
   RPC URL: https://bsc-dataseed1.binance.org/
   Chain ID: 56
   Currency Symbol: BNB
   Block Explorer URL: https://bscscan.com/
   ```

### Step 2: Security Checks

1. **Verify all contract code** on testnet first
2. **Test all functions** thoroughly on testnet
3. **Audit smart contracts** (recommended for mainnet)
4. **Setup multisig wallet** for contract ownership

### Step 3: Mainnet Deployment

1. **Final Compilation:**
   ```bash
   npm run check  # Runs lint, compile, and test
   ```

2. **Deploy to BSC Mainnet:**
   ```bash
   # ⚠️ MAINNET DEPLOYMENT - DOUBLE CHECK EVERYTHING
   npx hardhat run scripts/deploy.js --network bscMainnet
   ```

3. **Verify Contracts:**
   ```bash
   npx hardhat run scripts/verify.js --network bscMainnet
   ```

### Step 4: Post-Deployment Security

1. **Transfer ownership** to multisig wallet
2. **Setup allocation limits** for token distribution
3. **Initialize exchange liquidity** carefully
4. **Test with small amounts** first

---

## 🦊 MetaMask Token Import

### For BSC Testnet:

#### Import PRANA Token:
1. **MetaMask** → **Import tokens** → **Custom token**
2. **Enter details:**
   ```
   Token Contract Address: [PRANA_TESTNET_ADDRESS]
   Token Symbol: PRANA
   Token Decimal: 18
   ```
3. **Click "Add Custom Token"** → **"Import Tokens"**

#### Import Test USDT:
1. **MetaMask** → **Import tokens** → **Custom token**
2. **Enter details:**
   ```
   Token Contract Address: [TEST_USDT_ADDRESS]
   Token Symbol: USDT
   Token Decimal: 6
   ```
3. **Click "Add Custom Token"** → **"Import Tokens"**

### For BSC Mainnet:

#### Import PRANA Token:
1. **MetaMask** → **Import tokens** → **Custom token**
2. **Enter details:**
   ```
   Token Contract Address: [PRANA_MAINNET_ADDRESS]
   Token Symbol: PRANA
   Token Decimal: 18
   ```

#### USDT (Already Available):
USDT is already listed on BSC Mainnet:
```
Token Contract Address: 0x55d398326f99059fF775485246999027B3197955
Token Symbol: USDT
Token Decimal: 18
```

---

## ✅ Contract Verification

### Automatic Verification (Preferred):

1. **During Deployment:**
   ```bash
   # Verification happens automatically if VERIFY_CONTRACTS=true
   npx hardhat run scripts/deploy.js --network bscTestnet
   ```

### Manual Verification:

1. **Individual Contract:**
   ```bash
   npx hardhat verify --network bscTestnet [CONTRACT_ADDRESS] [CONSTRUCTOR_ARGS]
   ```

2. **Example for PRANA Token:**
   ```bash
   npx hardhat verify --network bscTestnet 0xYourTokenAddress
   ```

3. **Batch Verification:**
   ```bash
   npx hardhat run scripts/verify-all.js --network bscTestnet
   ```

### Verification Status Check:

**BSC Testnet Explorer:** https://testnet.bscscan.com/  
**BSC Mainnet Explorer:** https://bscscan.com/

Look for ✅ green checkmark next to contract address.

---

## 🧪 Testing & Validation

### Testnet Testing Checklist:

1. **Token Operations:**
   - [ ] PRANA transfers work
   - [ ] Anti-whale limits enforced
   - [ ] Pause/unpause functionality
   - [ ] Allocation system works

2. **Exchange Testing:**
   - [ ] Buy PRANA with USDT
   - [ ] Sell PRANA for USDT
   - [ ] Minimum amounts enforced
   - [ ] Price calculations correct

3. **Staking Testing:**
   - [ ] Create stakes
   - [ ] Earn daily rewards (1.2%)
   - [ ] Referral system works
   - [ ] ROI cap enforced (200%)

### Automated Testing:

```bash
# Run comprehensive test suite
npm test

# Generate coverage report
npm run coverage

# Check gas usage
npm run gas-report
```

### Manual Testing Script:

```bash
# Interactive testing interface
npx hardhat run scripts/test-interactions.js --network bscTestnet
```

---

## 🔧 Troubleshooting

### Common Issues & Solutions:

#### 1. "Insufficient funds for gas"
**Solution:**
- Get more BNB from testnet faucet
- Check you're on correct network
- Verify wallet has BNB balance

#### 2. "Contract verification failed"
**Solution:**
```bash
# Flatten contract first
npx hardhat flatten contracts/core/PRANAToken.sol > flattened.sol
# Then verify manually on BSCScan
```

#### 3. "Tokens not showing in MetaMask"
**Solutions:**
- Refresh MetaMask (Settings → Advanced → Reset Account)
- Double-check contract address
- Verify you're on correct network
- Check balance on block explorer

#### 4. "Transaction failed"
**Solutions:**
- Increase gas limit: `--gas-limit 5000000`
- Check contract interactions work on testnet first
- Verify all prerequisites met

#### 5. "Deployment script fails"
**Solutions:**
```bash
# Clean and rebuild
npx hardhat clean
npx hardhat compile

# Check network connectivity
npx hardhat console --network bscTestnet
```

### Debug Commands:

```bash
# Check network status
npx hardhat console --network bscTestnet

# Verify contract deployment
npx hardhat run scripts/check-deployment.js --network bscTestnet

# Test contract interactions
npx hardhat run scripts/debug-contracts.js --network bscTestnet
```

---

## 📞 Support & Resources

### Documentation:
- **Hardhat Docs:** https://hardhat.org/docs
- **BSC Docs:** https://docs.binance.org/smart-chain/
- **MetaMask Guide:** https://docs.metamask.io/

### Block Explorers:
- **BSC Testnet:** https://testnet.bscscan.com/
- **BSC Mainnet:** https://bscscan.com/

### Faucets:
- **BSC Testnet BNB:** https://testnet.binance.org/faucet-smart

### API References:
- **BSCScan API:** https://docs.bscscan.com/
- **BSC RPC Endpoints:** https://docs.binance.org/smart-chain/developer/rpc.html

---

## ⚠️ Security Warnings

### For Mainnet Deployment:

1. **NEVER commit private keys** to version control
2. **Use hardware wallets** for mainnet deployments
3. **Test extensively** on testnet first
4. **Setup multisig wallets** for contract ownership
5. **Audit contracts** before mainnet launch
6. **Start with small amounts** for initial testing
7. **Monitor contracts** continuously after deployment

### For Production Use:

1. **Implement timelock contracts** for critical functions
2. **Setup monitoring and alerting** systems
3. **Have emergency procedures** ready
4. **Regular security audits** and updates
5. **Bug bounty programs** for community security

---

**📝 Note:** Always test on testnet first! This guide assumes you understand smart contract deployment risks.