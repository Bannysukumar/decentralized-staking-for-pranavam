/**
 * TransactionManager - JavaScript implementation
 * Real implementation that defers to the main ContractService
 */

import { contractService } from '../../services/ContractService.js';

class TransactionManager {
    constructor() {
        this.contractService = contractService;
        this.pendingTransactions = new Map();
    }

    async executeTransaction(contractName, methodName, methodParams, transactionParams = {}) {
        console.log(`Executing real transaction: ${contractName}.${methodName}`, methodParams);
        
        try {
            // Use the real contract service for transaction execution
            const result = await this.contractService.executeTransaction(
                contractName, 
                methodName, 
                methodParams, 
                transactionParams
            );
            
            return {
                success: true,
                transactionHash: result.transactionHash,
                blockNumber: result.blockNumber,
                gasUsed: result.gasUsed
            };
        } catch (error) {
            console.error('Transaction execution failed:', error);
            throw error;
        }
    }

    async estimateGas(contractName, methodName, methodParams, params = {}) {
        console.log('Estimating gas for real transaction', params);
        
        try {
            const contract = this.contractService.getContract(contractName);
            if (!contract) {
                throw new Error(`Contract ${contractName} not found`);
            }

            const gasEstimate = await contract.methods[methodName](...methodParams).estimateGas(params);
            return gasEstimate;
        } catch (error) {
            console.error('Gas estimation failed:', error);
            throw error;
        }
    }

    async getTransactionStatus(txHash) {
        console.log(`Getting real transaction status for ${txHash}`);
        
        try {
            if (!window.web3) {
                throw new Error('Web3 not available');
            }

            const receipt = await window.web3.eth.getTransactionReceipt(txHash);
            if (!receipt) {
                return { status: 'pending', confirmed: false };
            }

            return {
                status: receipt.status ? 'success' : 'failed',
                confirmed: true,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed
            };
        } catch (error) {
            console.error('Failed to get transaction status:', error);
            throw error;
        }
    }

    clearTransactionQueue() {
        console.log('Clearing transaction queue');
        this.pendingTransactions.clear();
    }

    getPendingTransactions() {
        return Array.from(this.pendingTransactions.values());
    }
}

// Create default export instance
const transactionManager = new TransactionManager();

// Export for ES6 modules and CommonJS compatibility
export { transactionManager };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { transactionManager };
} else {
    window.TransactionManager = TransactionManager;
    window.transactionManager = transactionManager;
}