# 🚀 Quick Deployment Steps

## 📱 BSC Testnet (5 minutes)

### 1️⃣ Setup Environment
```bash
cd /mnt/d/projects/pranavam-launch/unified-platform/contracts
cp .env.example .env
# Edit .env and add your PRIVATE_KEY
```

### 2️⃣ Get Test BNB
- Visit: https://testnet.bnbchain.org/faucet-smart
- Get 0.5 BNB to your deployment wallet

### 3️⃣ Deploy
```bash
./deploy-testnet.sh
```

### 4️⃣ Verify (Optional)
```bash
npm run verify:testnet
```

### 📍 Your Contracts
Check `contracts/deployments/bscTestnet.json` for addresses

---

## 💎 BSC Mainnet (30 minutes)

### ⚠️ Pre-Requirements
- [ ] Tested on testnet ✓
- [ ] 2-3 BNB in deployment wallet
- [ ] Team ready
- [ ] Legal clearance

### 1️⃣ Final Check
```bash
# Review configuration
cat .env
```

### 2️⃣ Deploy
```bash
./deploy-mainnet.sh --confirm-mainnet
```
Type `DEPLOY TO MAINNET` when prompted

### 3️⃣ Verify Immediately
```bash
npm run verify:mainnet
```

### 4️⃣ Critical Post-Deploy
1. **Save addresses** from `deployments/bscMainnet.json`
2. **Transfer ownership** to multi-sig wallet
3. **Update website** with contract addresses
4. **Announce** to community

---

## 🔧 Common Commands

```bash
# Check wallet balance
npx hardhat accounts --network bscTestnet

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Console (interact with deployed contracts)
npx hardhat console --network bscTestnet

# Clean and recompile
npx hardhat clean && npx hardhat compile
```

## 🆘 Troubleshooting

**"Insufficient funds"**
- Testnet: Get more from faucet
- Mainnet: Add more BNB

**"Nonce too low"**
- Reset MetaMask: Settings > Advanced > Reset Account

**"Cannot find module"**
```bash
npm install
```

**Verification fails**
- Wait 5 minutes after deployment
- Check constructor args match

## 📞 Emergency Contacts

- Technical Issues: Check deployment logs
- Failed TX: Check on BSCScan
- Critical Issues: Contact team lead IMMEDIATELY

---

## 🎯 Contract Addresses Format

After deployment, you'll get:

```json
{
  "pranaToken": "0x...",
  "pranaExchange": "0x...", 
  "pranaStaking": "0x...",
  "usdtToken": "0x..."
}
```

**Save these addresses immediately!**