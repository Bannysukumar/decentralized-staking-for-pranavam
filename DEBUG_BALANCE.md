# Debug Balance Issue

## 🔍 **Browser Console Debug Script**

**Paste this into your browser console on the admin page:**

```javascript
// Debug script to check balance issue
(async function debugBalance() {
    console.log('🔍 DEBUGGING BALANCE DISPLAY ISSUE');
    console.log('=====================================');
    
    try {
        // Check current account
        const currentAccount = uiServices.getCurrentAccount();
        console.log('📍 Current connected account:', currentAccount);
        
        // Check expected admin account (deployer)
        const expectedAdmin = '0x5dF3366e7b93bEA4e7d5ED8Ff6dE648Cb9Cd676F';
        console.log('👤 Expected admin (deployer):', expectedAdmin);
        console.log('✅ Account matches:', currentAccount?.toLowerCase() === expectedAdmin.toLowerCase());
        
        // Check contract address
        const pranaAddress = uiServices.serviceManager.contractService.getContractAddress('pranaToken');
        console.log('🏦 PRANA contract address:', pranaAddress);
        console.log('✅ Expected address:', '0xCD48C2c97FDF976fA1c33bFb134D449451606e72');
        console.log('✅ Address matches:', pranaAddress?.toLowerCase() === '0xCD48C2c97FDF976fA1c33bFb134D449451606e72'.toLowerCase());
        
        // Check balances for both accounts
        console.log('\n💰 BALANCE CHECKS:');
        
        // Current account balance
        const currentBalance = await uiServices.serviceManager.contractService.executeCall('pranaToken', 'balanceOf', [currentAccount]);
        const currentFormatted = uiServices.serviceManager.walletService.web3.utils.fromWei(currentBalance, 'ether');
        console.log('💳 Current account balance:', currentFormatted, 'PRANA');
        
        // Expected admin balance (if different account)
        if (currentAccount?.toLowerCase() !== expectedAdmin.toLowerCase()) {
            const adminBalance = await uiServices.serviceManager.contractService.executeCall('pranaToken', 'balanceOf', [expectedAdmin]);
            const adminFormatted = uiServices.serviceManager.walletService.web3.utils.fromWei(adminBalance, 'ether');
            console.log('👤 Expected admin balance:', adminFormatted, 'PRANA');
        }
        
        // Check recipient balance
        const recipientAddress = '0x33C28346859F0Fb8BC73005d14545046B7a1451f';
        const recipientBalance = await uiServices.serviceManager.contractService.executeCall('pranaToken', 'balanceOf', [recipientAddress]);
        const recipientFormatted = uiServices.serviceManager.walletService.web3.utils.fromWei(recipientBalance, 'ether');
        console.log('🎯 Recipient balance (0x33C2...):', recipientFormatted, 'PRANA');
        
        // Check network
        const chainId = uiServices.serviceManager.walletService.chainId;
        console.log('\n🌐 NETWORK INFO:');
        console.log('📡 Chain ID:', chainId);
        console.log('✅ Expected (BSC Testnet):', 97);
        console.log('✅ Network correct:', chainId === 97);
        
        console.log('\n🔧 DIAGNOSIS:');
        if (currentAccount?.toLowerCase() !== expectedAdmin.toLowerCase()) {
            console.log('❌ ISSUE FOUND: Wrong account connected!');
            console.log('💡 SOLUTION: Connect to the admin account:', expectedAdmin);
        } else if (pranaAddress?.toLowerCase() !== '0xCD48C2c97FDF976fA1c33bFb134D449451606e72'.toLowerCase()) {
            console.log('❌ ISSUE FOUND: Wrong contract address!');
            console.log('💡 SOLUTION: Update contract configuration');
        } else if (chainId !== 97) {
            console.log('❌ ISSUE FOUND: Wrong network!');
            console.log('💡 SOLUTION: Switch to BSC Testnet (Chain ID 97)');
        } else {
            console.log('✅ All checks passed - balance should be correct');
        }
        
    } catch (error) {
        console.error('❌ Debug error:', error);
    }
    
    console.log('=====================================');
})();
```

## 🎯 **Most Likely Issues:**

### 1. **Wrong Account Connected**
- The admin page shows balance for the **currently connected wallet**
- If you connected a different wallet than the deployer account (`0x5dF3366e7b93bEA4e7d5ED8Ff6dE648Cb9Cd676F`), it will show that wallet's balance
- **Solution:** Connect to the correct admin wallet

### 2. **Wrong Network**
- Make sure you're on **BSC Testnet (Chain ID 97)**
- **Solution:** Switch network in MetaMask

### 3. **Contract Address Issue**
- The frontend might be using the wrong contract address
- **Solution:** Check if contract configuration is correct

## 🔧 **Quick Fixes to Try:**

1. **Check Connected Account:**
   - Open MetaMask
   - Ensure you're connected to: `0x5dF3366e7b93bEA4e7d5ED8Ff6dE648Cb9Cd676F`
   - If not, switch to the correct account

2. **Check Network:**
   - Ensure MetaMask is on **BSC Testnet**
   - Network should show Chain ID 97

3. **Hard Refresh:**
   - Press `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - This clears all cache and reloads everything

4. **Disconnect/Reconnect Wallet:**
   - Disconnect wallet from the site
   - Reconnect with the correct admin account

---

**Run the debug script above to get detailed information about what's causing the issue!**