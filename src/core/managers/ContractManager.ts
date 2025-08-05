/**
 * ContractManager - Automatic contract loading and management
 * Following Single Responsibility and Open/Closed Principles
 */

import { IContractManager, ContractInstance } from '../interfaces/IContractManager';
import { getContractAddresses, getContractABI } from '../../config/contracts.js';
import { stateManager } from '../state/ReactiveStateManager';
import { logger, LOG_CONTEXTS } from '../../services/LoggingService.js';
import Web3 from 'web3';

export class ContractManager implements IContractManager {
    private contracts: Map<string, ContractInstance> = new Map();
    private web3: Web3 | null = null;
    private currentChainId: number | null = null;
    
    // Contract names to load automatically
    private readonly AUTO_LOAD_CONTRACTS = [
        'pranaToken',
        'usdtToken', 
        'pranaExchange',
        'pranaStaking'
    ];

    // Events to watch for each contract
    private readonly CONTRACT_EVENTS = {
        pranaToken: ['Transfer', 'Approval'],
        usdtToken: ['Transfer', 'Approval'],
        pranaExchange: ['PRANAPurchased', 'PRANASold', 'LiquidityAdded', 'LiquidityRemoved'],
        pranaStaking: ['Staked', 'Unstaked', 'RewardPaid']
    };

    constructor() {
        this.setupStateListeners();
    }

    private setupStateListeners(): void {
        // Listen for wallet connection changes
        stateManager.subscribe('wallet', (update) => {
            const walletState = update.data;
            if (walletState.connected && walletState.chainId !== this.currentChainId) {
                this.loadAllContracts(walletState.chainId);
            } else if (!walletState.connected) {
                this.clearContracts();
            }
        });
    }

    async loadAllContracts(chainId: number): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.CONTRACT, `Loading contracts for network ${chainId}`);
            
            this.currentChainId = chainId;
            this.web3 = stateManager['web3']; // Access web3 from state manager
            
            if (!this.web3) {
                throw new Error('Web3 not initialized');
            }

            const contractAddresses = getContractAddresses(chainId);
            const loadPromises = this.AUTO_LOAD_CONTRACTS.map(async (contractName) => {
                try {
                    const address = contractAddresses[contractName];
                    if (!address) {
                        logger.warn(LOG_CONTEXTS.CONTRACT, `Address not found for ${contractName} on chain ${chainId}`);
                        return;
                    }

                    const abi = getContractABI(contractName);
                    if (!abi) {
                        logger.warn(LOG_CONTEXTS.CONTRACT, `ABI not found for ${contractName}`);
                        return;
                    }

                    await this.loadContract(contractName, address, abi);
                    
                    // Setup event watching
                    const events = this.CONTRACT_EVENTS[contractName as keyof typeof this.CONTRACT_EVENTS];
                    if (events) {
                        stateManager.watchContract(contractName, events);
                    }
                    
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.CONTRACT, error, { 
                        contractName,
                        context: 'loadAllContracts'
                    });
                }
            });

            await Promise.allSettled(loadPromises);

            // Update state with loaded contracts
            stateManager.updateState('contracts', {
                loaded: true,
                instances: this.contracts,
                addresses: contractAddresses,
                chainId
            });

            logger.info(LOG_CONTEXTS.CONTRACT, `Successfully loaded ${this.contracts.size} contracts`);

        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, { 
                chainId,
                context: 'loadAllContracts'
            });
            throw error;
        }
    }

    async loadContract(name: string, address: string, abi: any[]): Promise<ContractInstance> {
        try {
            if (!this.web3) {
                throw new Error('Web3 not initialized');
            }

            // Validate address
            if (!this.web3.utils.isAddress(address)) {
                throw new Error(`Invalid contract address: ${address}`);
            }

            // Create contract instance
            const contract = new this.web3.eth.Contract(abi, address);
            
            // Test contract by calling a simple method if available
            await this.validateContract(contract, name);

            const contractInstance: ContractInstance = {
                address,
                abi,
                contract,
                methods: contract.methods
            };

            this.contracts.set(name, contractInstance);

            logger.info(LOG_CONTEXTS.CONTRACT, `Contract loaded: ${name}`, {
                address,
                methodsCount: Object.keys(contract.methods).length
            });

            return contractInstance;

        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, { 
                name,
                address,
                context: 'loadContract'
            });
            throw error;
        }
    }

    private async validateContract(contract: any, name: string): Promise<void> {
        try {
            // Try to call a common read-only method to validate the contract
            const validationMethods = {
                pranaToken: 'symbol',
                usdtToken: 'symbol', 
                pranaExchange: 'getExchangeRate',
                pranaStaking: 'totalSupply'
            };

            const method = validationMethods[name as keyof typeof validationMethods];
            
            if (method && contract.methods[method]) {
                await contract.methods[method]().call();
                logger.debug(LOG_CONTEXTS.CONTRACT, `Contract validation successful: ${name}`);
            }
        } catch (error) {
            logger.warn(LOG_CONTEXTS.CONTRACT, `Contract validation failed for ${name}`, error.message);
            // Don't throw - contract might still be functional
        }
    }

    getContract(name: string): ContractInstance | null {
        return this.contracts.get(name) || null;
    }

    getAllContracts(): Map<string, ContractInstance> {
        return new Map(this.contracts);
    }

    async refreshContract(name: string): Promise<ContractInstance> {
        const existingContract = this.contracts.get(name);
        if (!existingContract) {
            throw new Error(`Contract ${name} not found`);
        }

        // Reload the contract with same parameters
        return await this.loadContract(name, existingContract.address, existingContract.abi);
    }

    isContractLoaded(name: string): boolean {
        return this.contracts.has(name);
    }

    private clearContracts(): void {
        // Stop watching all contracts
        for (const contractName of this.contracts.keys()) {
            stateManager.unwatchContract(contractName);
        }

        this.contracts.clear();
        this.currentChainId = null;
        
        // Update state
        stateManager.updateState('contracts', {
            loaded: false,
            instances: new Map(),
            addresses: new Map(),
            chainId: null
        });

        logger.info(LOG_CONTEXTS.CONTRACT, 'All contracts cleared');
    }

    // Utility methods for common operations
    async getTokenBalance(tokenName: string, address: string): Promise<string> {
        const contract = this.getContract(tokenName);
        if (!contract) {
            throw new Error(`Token contract ${tokenName} not loaded`);
        }

        const balance = await contract.methods.balanceOf(address).call();
        return this.web3!.utils.fromWei(balance, 'ether');
    }

    async getTokenAllowance(tokenName: string, owner: string, spender: string): Promise<string> {
        const contract = this.getContract(tokenName);
        if (!contract) {
            throw new Error(`Token contract ${tokenName} not loaded`);
        }

        const allowance = await contract.methods.allowance(owner, spender).call();
        return this.web3!.utils.fromWei(allowance, 'ether');
    }

    // Method to batch multiple contract calls efficiently
    async batchCall(calls: Array<{
        contractName: string;
        methodName: string;
        params: any[];
    }>): Promise<any[]> {
        if (!this.web3) {
            throw new Error('Web3 not initialized');
        }

        const batch = new this.web3.BatchRequest();
        const promises: Promise<any>[] = [];

        calls.forEach(call => {
            const contract = this.getContract(call.contractName);
            if (!contract) {
                promises.push(Promise.reject(new Error(`Contract ${call.contractName} not loaded`)));
                return;
            }

            const promise = new Promise((resolve, reject) => {
                const request = contract.methods[call.methodName](...call.params).call.request({}, (error: any, result: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(result);
                    }
                });
                batch.add(request);
            });

            promises.push(promise);
        });

        batch.execute();
        return Promise.all(promises);
    }

    // Get contract deployment block for efficient event filtering
    getContractDeploymentBlock(contractName: string): number {
        const deploymentBlocks: { [key: string]: number } = {
            pranaToken: 0, // Set actual deployment blocks
            usdtToken: 0,
            pranaExchange: 0,
            pranaStaking: 0
        };

        return deploymentBlocks[contractName] || 0;
    }

    // Cleanup resources
    destroy(): void {
        this.clearContracts();
        
        // Unsubscribe from state updates
        stateManager.unsubscribe('wallet', this.setupStateListeners);
        
        logger.info(LOG_CONTEXTS.CONTRACT, 'ContractManager destroyed');
    }
}

// Export singleton instance
const contractManager = new ContractManager();
export default contractManager;