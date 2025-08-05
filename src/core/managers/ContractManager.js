/**
 * ContractManager - JavaScript implementation
 * Real implementation that defers to the main ContractService
 */

import { contractService } from '../../services/ContractService.js';
import { walletService } from '../../services/WalletService.js';

class ContractManager {
    constructor() {
        this.contractService = contractService;
    }

    async loadAllContracts(chainId) {
        console.log(`Loading real contracts for chain ${chainId}`);
        
        // Defer to the real contract service
        try {
            // Get Web3 from wallet service - this is the proper source
            const web3Instance = walletService.web3;
            
            if (!web3Instance) {
                throw new Error('Web3 not available. Please connect wallet first.');
            }
            
            // Validate Web3 instance has required properties
            if (!web3Instance.eth || !web3Instance.eth.Contract) {
                throw new Error('Invalid Web3 instance - missing eth.Contract. Please ensure wallet is properly connected.');
            }
            
            await this.contractService.initialize(web3Instance, chainId);
            return { success: true, contractsLoaded: this.contractService.contracts.size };
        } catch (error) {
            console.error('Failed to load contracts:', error);
            throw error;
        }
    }

    isContractLoaded(contractName) {
        return this.contractService.contracts.has(contractName);
    }

    getContract(contractName) {
        return this.contractService.getContract(contractName);
    }

    getAllContracts() {
        const contracts = {};
        for (const [name, contract] of this.contractService.contracts) {
            contracts[name] = contract;
        }
        return contracts;
    }

    setWeb3(web3Instance) {
        // Web3 is handled by the contract service
        console.log('Web3 instance will be set via ContractService.initialize()');
    }

    /**
     * Get detailed contract loading status for debugging
     * @returns {Object} Detailed status of all contracts
     */
    getContractLoadingStatus() {
        return this.contractService.getContractLoadingStatus();
    }

    /**
     * Get summary of contract issues for troubleshooting
     * @returns {Object} Summary of contract loading issues
     */
    getDiagnosticInfo() {
        const status = this.getContractLoadingStatus();
        const issues = [];
        const working = [];

        Object.entries(status.contracts).forEach(([name, info]) => {
            if (info.isLoaded) {
                working.push(`✅ ${name}: ${info.address}`);
            } else {
                issues.push(`❌ ${name}: ${info.status} (${info.address})`);
            }
        });

        return {
            network: status.network,
            chainId: status.chainId,
            summary: `${working.length} working, ${issues.length} failed`,
            working,
            issues,
            webConnectionStatus: walletService.isConnected ? '✅ Connected' : '❌ Not Connected',
            web3Available: !!walletService.web3 ? '✅ Available' : '❌ Not Available'
        };
    }
}

// Create default export instance
const contractManager = new ContractManager();

// Export for ES6 modules and CommonJS compatibility
export default contractManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = contractManager;
} else {
    window.ContractManager = ContractManager;
    window.contractManager = contractManager;
}