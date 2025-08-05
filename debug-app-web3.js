/**
 * Debug script to check what Web3 instance the app is using
 */

import { contractService } from './src/services/ContractService.js';
import { walletService } from './src/services/WalletService.js';

async function debugAppWeb3() {
    console.log('🔍 Debugging App Web3 Configuration...');
    
    try {
        // Check if wallet is connected
        console.log('📱 Wallet connected:', walletService.isConnected);
        console.log('📱 Current chain ID:', walletService.chainId);
        console.log('📱 Current account:', walletService.account);
        
        // Check contract service status
        console.log('📄 Contract service initialized:', contractService.web3 !== null);
        console.log('📄 Contract service chain ID:', contractService.chainId);
        console.log('📄 Contracts loaded:', contractService.contracts.size);
        
        // List all loaded contracts
        console.log('📋 Loaded contracts:');
        for (const [name, contract] of contractService.contracts) {
            console.log(`  - ${name}: ${contract.options.address}`);
        }
        
        // Check if exchange contract is loaded
        const exchangeContract = contractService.getContract('pranaExchange');
        if (exchangeContract) {
            console.log('✅ Exchange contract is loaded');
            console.log('📍 Exchange address:', exchangeContract.options.address);
            
            // Test a method call
            try {
                const rate = await exchangeContract.methods.getExchangeRate().call();
                console.log('📊 Exchange rate:', rate);
                console.log('✅ Exchange contract is working!');
            } catch (error) {
                console.log('❌ Exchange method failed:', error.message);
            }
        } else {
            console.log('❌ Exchange contract NOT loaded');
        }
        
        // Check Web3 provider details
        if (contractService.web3) {
            try {
                const blockNumber = await contractService.web3.eth.getBlockNumber();
                console.log('📊 Current block (via app Web3):', blockNumber);
                
                const networkId = await contractService.web3.eth.net.getId();
                console.log('🌐 Network ID (via app Web3):', networkId);
            } catch (error) {
                console.log('❌ Web3 calls failed:', error.message);
            }
        }
        
    } catch (error) {
        console.log('❌ Debug failed:', error.message);
        console.log('📊 Full error:', error);
    }
}

// Run debug
debugAppWeb3().then(() => {
    console.log('🎉 Debug complete');
}).catch(error => {
    console.error('💥 Debug crashed:', error);
});