# 🧪 PRANA Manual Testing Guide
## Based on manualtesting.prd

### Your Current Status:
- ✅ You have 0.3 TBNB (sufficient for testing)
- ✅ Contracts ready for deployment
- 🎯 Goal: Test staking and swapping functionality

---

## 🚀 Step 1: Deploy Contracts (5 minutes)

```bash
cd /mnt/d/projects/pranavam-launch/unified-platform/contracts

# Create .env file with your private key
cp .env.example .env
# Edit .env and add: PRIVATE_KEY=your_test_wallet_private_key

# Deploy contracts
./deploy-and-test.sh
```

**Expected Result**: 4 contracts deployed + test tokens in your wallet

---

## 🦊 Step 2: MetaMask Setup (3 minutes)

### Add Contract Tokens to MetaMask:
1. Open MetaMask
2. Switch to BSC Testnet
3. Click "Import tokens"
4. Add these tokens (addresses from deployment):
   - **PRANA Token**: `0x...` (from deployment output)
   - **Test USDT**: `0x...` (from deployment output)

### Create Test Accounts:
1. Create "Account 2" for referral testing
2. Send some TBNB to Account 2 (0.05 TBNB is enough)

---

## 💱 Step 3: Exchange Testing (10 minutes)

### Test Case 3.1: Buy PRANA with USDT
**Prerequisites**: You should have test USDT from deployment

1. **Connect to Exchange Page**:
   - Navigate to your website's exchange page
   - Connect MetaMask

2. **Buy PRANA**:
   - Amount: 100 USDT (minimum is 50)
   - Click "Buy PRANA"
   - Approve USDT spending
   - Confirm transaction
   - ✅ **Expected**: Receive ~1000 PRANA (1 PRANA = 0.10 USDT)

3. **Verify Transaction**:
   - Check PRANA balance in MetaMask
   - Verify on BSC Testnet Explorer

### Test Case 3.2: Sell PRANA for USDT
1. **Sell PRANA**:
   - Amount: 1000 PRANA (minimum)
   - Click "Sell PRANA"
   - Approve PRANA spending
   - Confirm transaction
   - ✅ **Expected**: Receive ~100 USDT

### Test Case 3.3: Edge Cases
1. **Test Minimum Limits**:
   - Try buying with 30 USDT (should fail - below 50 min)
   - Try selling 500 PRANA (should fail - below 1000 min)
   - ✅ **Expected**: Proper error messages

2. **Test Insufficient Balance**:
   - Try buying more than your USDT balance
   - ✅ **Expected**: Transaction fails gracefully

---

## 🎁 Step 4: Staking Testing (15 minutes)

### Test Case 4.1: Basic Staking
1. **Create First Stake**:
   - Navigate to staking page
   - Amount: 1000 PRANA
   - Referrer: Leave empty (no referrer)
   - Click "Stake"
   - ✅ **Expected**: Stake created, shows in dashboard

2. **Verify Stake Info**:
   - Check stake amount: 1000 PRANA
   - Check status: Active
   - Check start time: Current timestamp

### Test Case 4.2: Referral System Testing
1. **Switch to Account 2**:
   - Send some PRANA to Account 2
   - Ensure Account 2 has TBNB for gas

2. **Create Referral Stake**:
   - Amount: 2000 PRANA
   - Referrer: Account 1 address
   - Click "Stake"
   - ✅ **Expected**: 
     - Account 2 stake created
     - Account 1 receives 4% commission (80 PRANA)

### Test Case 4.3: Rewards Testing
1. **Wait for Rewards** (or simulate time):
   - Wait ~1 hour for some rewards to accumulate
   - OR use hardhat console to advance time

2. **Claim Rewards**:
   - Check pending rewards
   - Click "Claim Rewards"
   - ✅ **Expected**: Receive ~1.2% daily rate (prorated)

### Test Case 4.4: Edge Cases
1. **Minimum Stake Test**:
   - Try staking 5 PRANA (below 10 minimum)
   - ✅ **Expected**: Error message

2. **Self-Referral Test**:
   - Try using your own address as referrer
   - ✅ **Expected**: Error message

---

## 🔍 Step 5: Advanced Testing (10 minutes)

### Test Case 5.1: Multi-Level Referrals
1. **Create Account 3**
2. **Referral Chain**: Account 1 → Account 2 → Account 3
3. **Test**: Account 3 stakes with Account 2 as referrer
4. **Verify**: Both Account 1 and Account 2 get commissions

### Test Case 5.2: ROI Cap Testing
1. **High Time Simulation** (hardhat console):
   ```javascript
   await network.provider.send("evm_increaseTime", [86400 * 200]); // 200 days
   await network.provider.send("evm_mine");
   ```
2. **Check**: Rewards capped at 200% of stake amount

### Test Case 5.3: Restaking
1. **Wait until ROI cap reached**
2. **Try to restake**: Should create new stake with same amount

---

## 📊 Step 6: Performance & Gas Testing

### Test Case 6.1: Gas Usage
Track gas usage for:
- ✅ Token swaps: Should be < 150k gas
- ✅ Stake creation: Should be < 200k gas  
- ✅ Reward claiming: Should be < 100k gas

### Test Case 6.2: Transaction Speed
- ✅ All transactions complete within 30 seconds
- ✅ No failed transactions due to gas issues

---

## 🐛 Bug Reporting Template

When you find issues, report them like this:

```
**Bug Report #001**
- Test Case: Exchange 3.1 - Buy PRANA
- Expected: Receive 1000 PRANA for 100 USDT
- Actual: Transaction failed with "insufficient allowance"
- Steps to Reproduce: 
  1. Connect MetaMask
  2. Enter 100 USDT
  3. Click Buy PRANA
- Browser: Chrome v120
- MetaMask: v11.5.0
- Transaction Hash: 0x...
```

---

## 📱 Mobile Testing Checklist

Test on mobile device:
- [ ] MetaMask mobile connects properly
- [ ] All buttons work on touch
- [ ] Forms submit correctly
- [ ] Transactions confirm in mobile MetaMask
- [ ] UI responsive on small screens

---

## ✅ Final Verification

After all tests:
1. **Check BSC Testnet Explorer**:
   - All transactions visible
   - Contract interactions logged
   - Token transfers recorded

2. **Verify Balances**:
   - PRANA balance matches expected
   - USDT balance reflects swaps
   - Staking rewards accumulated

3. **Test Cleanup**:
   - Document any bugs found
   - Save contract addresses
   - Backup test wallet

---

## 🆘 Troubleshooting

**"Transaction failed"**
- Check gas balance (need TBNB)
- Verify token approvals
- Try increasing gas limit

**"Insufficient allowance"**
- Click "Approve" before swapping
- Wait for approval transaction to confirm

**"Below minimum amount"**
- Buy: Minimum 50 USDT
- Sell: Minimum 1000 PRANA
- Stake: Minimum 10 PRANA

**MetaMask not connecting**
- Refresh page
- Switch to BSC Testnet
- Try disconnecting and reconnecting

---

**🎯 Success Criteria**: All test cases pass with 0.3 TBNB remaining for future testing!