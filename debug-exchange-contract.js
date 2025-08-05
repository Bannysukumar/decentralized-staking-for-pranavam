/**
 * Debug script to test exchange contract initialization
 */

import Web3 from 'web3';
import { getContractAddresses, getContractABI } from './src/config/contracts.js';

async function debugExchangeContract() {
    console.log('🔍 Debugging Exchange Contract Initialization...');
    
    // BSC Testnet RPC
    const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545/');
    const chainId = 97;
    
    try {
        // Get contract address
        const addresses = getContractAddresses(chainId);
        const exchangeAddress = addresses.pranaExchange;
        console.log('📍 Exchange contract address:', exchangeAddress);
        
        // Check if contract has code
        console.log('🔍 Checking contract code...');
        const code = await web3.eth.getCode(exchangeAddress);
        console.log('📝 Contract code length:', code.length);
        console.log('📝 Has code:', code !== '0x' && code !== '0x0');
        
        if (code === '0x' || code === '0x0') {
            console.log('❌ Contract has no code at address');
            return;
        }
        
        // Get ABI
        console.log('🔍 Getting contract ABI...');
        const abi = getContractABI('PranaExchange', chainId);
        console.log('📝 ABI methods:', abi.length);
        
        // Create contract instance
        console.log('🔍 Creating contract instance...');
        const exchangeContract = new web3.eth.Contract(abi, exchangeAddress);
        console.log('✅ Contract instance created');
        
        // Test a simple view method
        console.log('🔍 Testing getExchangeRate method...');
        try {
            const rate = await exchangeContract.methods.getExchangeRate().call();
            console.log('📊 Exchange rate:', rate);
            console.log('✅ Contract is working!');
        } catch (error) {
            console.log('❌ Method call failed:', error.message);
            
            // Try to get more details
            if (error.message.includes('execution reverted')) {
                console.log('🔍 Contract exists but method reverted');
            } else if (error.message.includes('invalid address')) {
                console.log('🔍 Invalid contract address');
            } else {
                console.log('🔍 Unknown error:', error);
            }
        }
        
        // Test network connectivity
        console.log('🔍 Testing network connectivity...');
        const blockNumber = await web3.eth.getBlockNumber();
        console.log('📊 Current block number:', blockNumber);
        
    } catch (error) {
        console.log('❌ Debug failed:', error.message);
        console.log('📊 Full error:', error);
    }
}

// Run debug
debugExchangeContract().then(() => {
    console.log('🎉 Debug complete');
    process.exit(0);
}).catch(error => {
    console.error('💥 Debug crashed:', error);
    process.exit(1);
});