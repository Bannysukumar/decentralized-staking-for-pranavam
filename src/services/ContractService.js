/**
 * Enhanced Contract Service
 * Dynamic contract loading, gas estimation, and transaction management
 * Following open-source DApp architecture patterns
 */

import { getContractAddresses, getContractABI, isValidContractAddress } from '../config/contracts.js';
import { getRpcUrls } from '../config/networks.js';
import { logger, LOG_CONTEXTS } from './LoggingService.js';

class ContractService {
    constructor() {
        this.web3 = null;
        this.chainId = null;
        this.contracts = new Map();
        this.contractAddresses = {};
        this.eventSubscriptions = new Map();
        this.transactionQueue = [];
        this.isProcessingQueue = false;
        
        // Enhanced retry and gas options
        this.options = {
            maxRetries: 5, // Increased for RPC instability
            retryDelay: 2000, // Longer delay for RPC recovery
            backoffMultiplier: 1.5, // More gradual backoff
            gasMultiplier: 1.2, // 20% buffer for gas estimates
            maxGasLimit: 8000000,
            defaultGasLimit: 200000,
            gasPriceBuffer: 1.1, // 10% buffer for gas price
            rpcErrorCodes: [-32000, -32603], // Known RPC error codes to retry
            rpcErrorMessages: ['missing trie node', 'Internal JSON-RPC error']
        };
        
        // Transaction status tracking
        this.transactionStatuses = new Map();
        this.eventListeners = new Map();
        
        // Contract factory cache
        this.contractCache = new Map();
    }

    /**
     * Initialize contract service with web3 and network
     * @param {Object} web3 - Web3 instance
     * @param {number} chainId - Network chain ID
     */
    async initialize(web3, chainId) {
        try {
            if (!web3) {
                throw new Error('Web3 instance is required for contract initialization');
            }
            
            if (!web3.eth || !web3.eth.Contract) {
                throw new Error('Invalid Web3 instance - missing eth.Contract');
            }
            
            // Update Web3 instance even if already initialized for same chain
            // This ensures we use the wallet provider instead of RPC provider
            if (this.web3 && this.chainId === chainId && this.contracts.size > 0) {
                logger.info(LOG_CONTEXTS.CONTRACT, `Updating Web3 instance for network ${chainId}`);
                this.web3 = web3;
                
                // Update existing contract instances with new Web3 provider
                for (const [name, oldContract] of this.contracts) {
                    const abi = oldContract.options.jsonInterface;
                    const address = oldContract.options.address;
                    const newContract = new web3.eth.Contract(abi, address);
                    this.contracts.set(name, newContract);
                }
                
                logger.info(LOG_CONTEXTS.CONTRACT, `Updated ${this.contracts.size} contracts with new Web3 provider`);
                return;
            }
            
            this.web3 = web3;
            this.chainId = chainId;
            this.contractAddresses = getContractAddresses(chainId);
            
            logger.info(LOG_CONTEXTS.CONTRACT, `Initializing contracts for network ${chainId}`);
            
            // Initialize all contracts
            await this._initializeContracts();
            
            logger.info(LOG_CONTEXTS.CONTRACT, `Contract service initialized successfully`);
        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, { chainId });
            throw new Error(`Failed to initialize contract service: ${error.message}`);
        }
    }
    
    /**
     * Enhanced transaction execution with gas estimation and retry logic
     * @param {string} contractName - Name of the contract
     * @param {string} methodName - Method to call
     * @param {Array} params - Method parameters
     * @param {Object} options - Transaction options
     * @returns {Promise<Object>} Transaction result
     */
    async executeTransaction(contractName, methodName, params = [], options = {}) {
        const contract = this.getContract(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }
        
        const transactionId = this._generateTransactionId();
        
        try {
            // Emit transaction started event
            this._emitTransactionEvent('started', { transactionId, contractName, methodName, params });
            
            // Get current account
            const accounts = await this.web3.eth.getAccounts();
            if (!accounts || accounts.length === 0) {
                throw new Error('No wallet connected');
            }
            const from = accounts[0];
            
            // Estimate gas
            const gasEstimate = await this._estimateGas(contract, methodName, params, from);
            
            // Get gas price
            const gasPrice = await this._getOptimalGasPrice();
            
            // Prepare transaction options
            const txOptions = {
                from,
                gas: gasEstimate,
                gasPrice,
                ...options
            };
            
            // Debug Web3 provider setup
            logger.info(LOG_CONTEXTS.CONTRACT, 'Transaction setup debug', {
                hasWeb3: !!this.web3,
                hasProvider: !!this.web3.currentProvider,
                isMetaMask: this.web3.currentProvider?.isMetaMask,
                providerType: typeof this.web3.currentProvider,
                supportsEIP1193: typeof this.web3.currentProvider?.request === 'function',
                methodName,
                contractAddress: contract.options.address,
                from: txOptions.from,
                gas: txOptions.gas,
                gasPrice: txOptions.gasPrice
            });

            // Execute transaction with EIP-1193 compliance
            const result = await this._sendTransactionModern(contract, methodName, params, txOptions);
            
            // Store transaction status
            this.transactionStatuses.set(transactionId, {
                status: 'completed',
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed,
                timestamp: Date.now()
            });
            
            // Emit transaction completed event
            this._emitTransactionEvent('completed', {
                transactionId,
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed
            });
            
            logger.info(LOG_CONTEXTS.CONTRACT, `Transaction completed: ${methodName}`, {
                contractName,
                transactionHash: result.transactionHash,
                gasUsed: result.gasUsed
            });
            
            return result;
            
        } catch (error) {
            // Store failed transaction status
            this.transactionStatuses.set(transactionId, {
                status: 'failed',
                error: error.message,
                timestamp: Date.now()
            });
            
            // Emit transaction failed event
            this._emitTransactionEvent('failed', {
                transactionId,
                error: error.message
            });
            
            logger.logError(LOG_CONTEXTS.CONTRACT, error, {
                contractName,
                methodName,
                params,
                transactionId
            });
            
            throw error;
        }
    }
    
    /**
     * Execute contract call (read-only)
     * @param {string} contractName - Name of the contract
     * @param {string} methodName - Method to call
     * @param {Array} params - Method parameters
     * @returns {Promise<any>} Call result
     */
    async executeCall(contractName, methodName, params = []) {
        const contract = this.getContract(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }
        
        // Add debugging info
        logger.debug(LOG_CONTEXTS.CONTRACT, `Executing ${contractName}.${methodName}`, {
            hasContract: !!contract,
            hasMethods: !!contract.methods,
            methodExists: !!(contract.methods && contract.methods[methodName]),
            contractAddress: contract.options?.address,
            params
        });
        
        // Check if method exists
        if (!contract.methods || !contract.methods[methodName]) {
            throw new Error(`Method ${methodName} not found on contract ${contractName}. Available methods: ${Object.keys(contract.methods || {}).join(', ')}`);
        }
        
        try {
            // Real contract - use retry mechanism
            const result = await this._executeWithRetry(
                () => contract.methods[methodName](...params).call(),
                this.options.maxRetries
            );
            return result;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, {
                contractName,
                methodName,
                params,
                context: 'contractCall'
            });
            throw error;
        }
    }
    
    /**
     * Estimate gas for transaction
     * @private
     */
    async _estimateGas(contract, methodName, params, from) {
        try {
            const gasEstimate = await contract.methods[methodName](...params).estimateGas({ from });
            const bufferedGas = Math.floor(gasEstimate * this.options.gasMultiplier);
            
            // Ensure gas doesn't exceed maximum
            const finalGas = Math.min(bufferedGas, this.options.maxGasLimit);
            
            logger.debug(LOG_CONTEXTS.CONTRACT, 'Gas estimation', {
                methodName,
                estimated: gasEstimate,
                buffered: bufferedGas,
                final: finalGas
            });
            
            return finalGas;
            
        } catch (error) {
            logger.warn(LOG_CONTEXTS.CONTRACT, `Gas estimation failed for ${methodName}, using default`, error.message);
            return this.options.defaultGasLimit;
        }
    }
    
    /**
     * Get optimal gas price
     * @private
     */
    async _getOptimalGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            return Math.floor(gasPrice * this.options.gasPriceBuffer);
        } catch (error) {
            logger.warn(LOG_CONTEXTS.CONTRACT, 'Failed to get gas price, using default', error.message);
            return this.web3.utils.toWei('10', 'gwei'); // Fallback gas price
        }
    }
    
    /**
     * Send transaction using ethers.js signer (compatible with all wallets)
     * @private
     */
    async _sendTransactionModern(contract, methodName, params, txOptions) {
        logger.info(LOG_CONTEXTS.CONTRACT, 'Using ethers.js signer transaction method', { methodName });
        
        try {
            // Get ethers provider and signer from the current provider
            const ethersProvider = new window.ethers.providers.Web3Provider(this.web3.currentProvider);
            const signer = ethersProvider.getSigner();
            
            // Create ethers contract instance
            const ethersContract = new window.ethers.Contract(
                contract.options.address,
                contract.options.jsonInterface,
                signer
            );
            
            // Convert Web3.js BN values to ethers-compatible format
            const convertedParams = params.map(param => {
                // Check if it's a Web3.js BN object
                if (this.web3.utils.isBN(param)) {
                    return param.toString();
                }
                // Check if it's an object with BN-like properties
                else if (typeof param === 'object' && param !== null) {
                    if (param._hex || param.toString) {
                        return param.toString();
                    }
                }
                // Keep addresses and other strings as is
                return param;
            });
            
            // Prepare transaction options for ethers
            const ethersOptions = {};
            if (txOptions.gas) {
                ethersOptions.gasLimit = txOptions.gas;
            }
            if (txOptions.gasPrice) {
                ethersOptions.gasPrice = txOptions.gasPrice;
            }
            
            // Execute transaction using ethers
            const tx = await ethersContract[methodName](...convertedParams, ethersOptions);
            
            // Wait for transaction to be mined
            const receipt = await tx.wait();
            
            return {
                transactionHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                status: receipt.status
            };
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, { 
                context: 'ethers transaction',
                methodName 
            });
            throw error;
        }
    }
    
    /**
     * Wait for transaction receipt with polling
     * @private
     */
    async _waitForTransactionReceipt(txHash, maxAttempts = 60) {
        logger.info(LOG_CONTEXTS.CONTRACT, 'Waiting for transaction receipt', { txHash });
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const receipt = await this.web3.eth.getTransactionReceipt(txHash);
                if (receipt) {
                    logger.info(LOG_CONTEXTS.CONTRACT, 'Transaction confirmed', { 
                        txHash, 
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed 
                    });
                    return receipt;
                }
            } catch (error) {
                logger.warn(LOG_CONTEXTS.CONTRACT, 'Error getting receipt', { attempt, error: error.message });
            }
            
            // Wait 2 seconds before next attempt
            await this._delay(2000);
        }
        
        throw new Error(`Transaction receipt not found after ${maxAttempts} attempts: ${txHash}`);
    }

    /**
     * Execute with retry logic
     * @private
     */
    async _executeWithRetry(operation, maxRetries) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't retry user rejections
                if (error.code === 4001 || 
                    error.message.includes('User denied')) {
                    logger.warn(LOG_CONTEXTS.CONTRACT, 'Non-retryable error detected', { 
                        code: error.code, 
                        message: error.message 
                    });
                    throw error;
                }
                
                if (attempt < maxRetries) {
                    const delay = this.options.retryDelay * Math.pow(this.options.backoffMultiplier, attempt - 1);
                    logger.warn(LOG_CONTEXTS.CONTRACT, `Attempt ${attempt} failed, retrying in ${delay}ms`, error.message);
                    await this._delay(delay);
                } else {
                    logger.error(LOG_CONTEXTS.CONTRACT, `All ${maxRetries} attempts failed`, error);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Subscribe to contract events
     * @param {string} contractName - Name of the contract
     * @param {string} eventName - Event name
     * @param {Function} callback - Event callback
     * @param {Object} options - Subscription options
     * @returns {string} Subscription ID
     */
    subscribeToEvent(contractName, eventName, callback, options = {}) {
        const contract = this.getContract(contractName);
        if (!contract) {
            throw new Error(`Contract ${contractName} not found`);
        }
        
        const subscriptionId = this._generateSubscriptionId();
        
        try {
            const subscription = contract.events[eventName](options)
                .on('data', (event) => {
                    logger.debug(LOG_CONTEXTS.CONTRACT, `Event received: ${eventName}`, {
                        contractName,
                        event: event.returnValues
                    });
                    callback(event);
                })
                .on('error', (error) => {
                    logger.logError(LOG_CONTEXTS.CONTRACT, error, {
                        contractName,
                        eventName,
                        subscriptionId
                    });
                });
            
            this.eventSubscriptions.set(subscriptionId, {
                subscription,
                contractName,
                eventName,
                callback
            });
            
            logger.info(LOG_CONTEXTS.CONTRACT, `Subscribed to ${eventName} on ${contractName}`, { subscriptionId });
            
            return subscriptionId;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, {
                contractName,
                eventName,
                context: 'eventSubscription'
            });
            throw error;
        }
    }
    
    /**
     * Unsubscribe from contract event
     * @param {string} subscriptionId - Subscription ID
     */
    unsubscribeFromEvent(subscriptionId) {
        const subscription = this.eventSubscriptions.get(subscriptionId);
        if (!subscription) {
            logger.warn(LOG_CONTEXTS.CONTRACT, `Subscription ${subscriptionId} not found`);
            return;
        }
        
        try {
            subscription.subscription.unsubscribe();
            this.eventSubscriptions.delete(subscriptionId);
            
            logger.info(LOG_CONTEXTS.CONTRACT, `Unsubscribed from event`, {
                subscriptionId,
                contractName: subscription.contractName,
                eventName: subscription.eventName
            });
        } catch (error) {
            logger.logError(LOG_CONTEXTS.CONTRACT, error, { subscriptionId });
        }
    }
    
    /**
     * Get contract address
     * @param {string} contractName - Name of the contract
     * @returns {string} Contract address
     */
    getContractAddress(contractName) {
        return this.contractAddresses[contractName];
    }
    
    /**
     * Generate transaction ID
     * @private
     */
    _generateTransactionId() {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Generate subscription ID
     * @private
     */
    _generateSubscriptionId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Emit transaction event
     * @private
     */
    _emitTransactionEvent(eventType, data) {
        const event = new CustomEvent(`contract:transaction:${eventType}`, { detail: data });
        window.dispatchEvent(event);
        
        // Also notify registered listeners
        const listeners = this.eventListeners.get(`transaction:${eventType}`);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    logger.error(LOG_CONTEXTS.CONTRACT, 'Error in transaction event listener:', error);
                }
            });
        }
    }
    
    /**
     * Add event listener
     * @param {string} eventType - Event type
     * @param {Function} listener - Event listener
     */
    addEventListener(eventType, listener) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, new Set());
        }
        this.eventListeners.get(eventType).add(listener);
    }
    
    /**
     * Remove event listener
     * @param {string} eventType - Event type
     * @param {Function} listener - Event listener
     */
    removeEventListener(eventType, listener) {
        if (this.eventListeners.has(eventType)) {
            this.eventListeners.get(eventType).delete(listener);
        }
    }
    
    /**
     * Delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Initialize all contracts with enhanced error handling
     * @private
     */
    async _initializeContracts() {
        const contractTypes = [
            { name: 'pranaToken', type: 'PranaToken', critical: true },
            { name: 'usdtToken', type: 'UsdtToken', critical: true },
            { name: 'pranaExchange', type: 'PranaExchange', critical: false },
            { name: 'pranaStaking', type: 'PranaStaking', critical: true }
        ];

        let criticalContractsFailed = 0;
        let totalContracts = 0;

        for (const { name, type, critical } of contractTypes) {
            const address = this.contractAddresses[name];
            totalContracts++;
            
            if (isValidContractAddress(address)) {
                try {
                    const abi = getContractABI(type, this.chainId);
                    const contract = new this.web3.eth.Contract(abi, address);
                    
                    // Test contract by calling a basic method if available
                    await this._testContract(contract, name, type);
                    
                    // Add retry wrapper to all contract methods
                    this._wrapContractMethods(contract, name);
                    
                    this.contracts.set(name, contract);
                    logger.info(LOG_CONTEXTS.CONTRACT, `✅ Initialized ${name} contract`, { address, type });
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.CONTRACT, error, { contractName: name, address, type });
                    if (critical) {
                        criticalContractsFailed++;
                    }
                    // Contract failed to load - no fallback, application should handle gracefully
                    logger.error(LOG_CONTEXTS.CONTRACT, `❌ Failed to load critical contract ${name}. No fallback available.`);
                }
            } else {
                logger.warn(LOG_CONTEXTS.CONTRACT, `⚠️ Skipping ${name} - invalid address: ${address}`);
                if (critical) {
                    criticalContractsFailed++;
                }
                // Contract has invalid address - no fallback, application should handle gracefully
                logger.error(LOG_CONTEXTS.CONTRACT, `❌ Contract ${name} has invalid address. No fallback available.`);
            }
        }

        // Log overall status
        const successRate = ((totalContracts - criticalContractsFailed) / totalContracts * 100).toFixed(1);
        const contractStatus = this.getContractLoadingStatus();
        
        if (criticalContractsFailed > 0) {
            logger.warn(LOG_CONTEXTS.CONTRACT, `⚠️ ${criticalContractsFailed} critical contracts failed. Success rate: ${successRate}%`);
            console.warn('Contract loading details:', contractStatus);
        } else {
            logger.info(LOG_CONTEXTS.CONTRACT, `✅ All contracts initialized successfully (${successRate}%)`);
        }
        
        // Always log the status for debugging
        console.log('📋 Contract Loading Summary:', contractStatus);
    }

    /**
     * Test contract connectivity
     * @param {Object} contract - Web3 contract instance
     * @param {string} name - Contract name
     * @param {string} type - Contract type
     * @private
     */
    async _testContract(contract, name, type) {
        try {
            logger.info(LOG_CONTEXTS.CONTRACT, `Testing contract ${name} at ${contract.options.address}`);
            
            // Check current network
            try {
                const networkId = await this.web3.eth.net.getId();
                const blockNumber = await this.web3.eth.getBlockNumber();
                logger.info(LOG_CONTEXTS.CONTRACT, `Network info for ${name}: ID=${networkId}, Block=${blockNumber}`);
            } catch (netError) {
                logger.warn(LOG_CONTEXTS.CONTRACT, `Failed to get network info for ${name}: ${netError.message}`);
            }
            
            // Skip testing if RPC is having issues
            // Just verify contract has code at address
            const code = await this.web3.eth.getCode(contract.options.address);
            logger.info(LOG_CONTEXTS.CONTRACT, `Contract ${name} code length: ${code.length}`);
            
            if (code === '0x' || code === '0x0') {
                throw new Error(`No contract code at address`);
            }
            
            logger.info(LOG_CONTEXTS.CONTRACT, `✅ Contract ${name} has code and passed validation`);
            
            // Note: We skip method testing due to RPC "missing trie node" errors
            // The contracts will be tested when actually used
            
        } catch (error) {
            logger.error(LOG_CONTEXTS.CONTRACT, `❌ Contract test failed for ${name}: ${error.message}`);
            
            // Handle known RPC issues gracefully
            if (error.message.includes('missing trie node') || 
                error.message.includes('Internal JSON-RPC error') ||
                error.code === -32000 || 
                error.code === -32603) {
                logger.warn(LOG_CONTEXTS.CONTRACT, `RPC instability detected for ${name}, skipping validation: ${error.message}`);
                // Don't throw - assume contract is valid if RPC is having issues
                // Contract will be tested when actually used
                return;
            }
            throw new Error(`Contract verification failed for ${name}: ${error.message}`);
        }
    }


    /**
     * Wrap contract methods with retry logic and logging
     * @param {Object} contract - Web3 contract instance
     * @param {string} contractName - Contract name
     * @private
     */
    _wrapContractMethods(contract, contractName) {
        const originalMethods = contract.methods;
        
        // Create proxy to intercept method calls for real contracts
        contract.methods = new Proxy(originalMethods, {
            get: (target, methodName) => {
                if (typeof target[methodName] === 'function') {
                    return (...args) => {
                        const method = target[methodName](...args);
                        
                        // Wrap call method with retry logic
                        const originalCall = method.call;
                        method.call = async (options = {}) => {
                            return this._retryContractCall(
                                () => originalCall.call(method, options),
                                contractName,
                                methodName,
                                args
                            );
                        };
                        
                        return method;
                    };
                }
                return target[methodName];
            }
        });
    }

    /**
     * Retry contract call with fallback RPC endpoints
     * @param {Function} callFn - Contract call function
     * @param {string} contractName - Contract name
     * @param {string} methodName - Method name
     * @param {Array} args - Method arguments
     * @returns {Promise} Contract call result
     * @private
     */
    async _retryContractCall(callFn, contractName, methodName, args) {
        const startTime = Date.now();
        let lastError;

        // Try primary RPC first
        try {
            logger.logContractCall(contractName, methodName, args);
            const result = await callFn();
            const duration = Date.now() - startTime;
            logger.logPerformance(`${contractName}.${methodName}`, duration);
            return result;
        } catch (error) {
            lastError = error;
            
            // Check for RPC-specific errors that indicate node issues
            const isRpcError = error.message.includes('missing trie node') ||
                              error.message.includes('state not found') ||
                              error.message.includes('header not found') ||
                              error.message.includes('block not found');
                              
            if (isRpcError) {
                logger.warn(LOG_CONTEXTS.CONTRACT, `RPC node error for ${contractName}.${methodName}, trying fallbacks: ${error.message}`);
            } else {
                logger.warn(LOG_CONTEXTS.CONTRACT, `Primary RPC failed for ${contractName}.${methodName}`, error.message);
            }
        }

        // Try fallback RPCs
        const rpcUrls = getRpcUrls(this.chainId);
        
        for (let i = 1; i < rpcUrls.length; i++) {
            try {
                logger.debug(LOG_CONTEXTS.CONTRACT, `Trying fallback RPC ${i}: ${rpcUrls[i]}`);
                
                // Create temporary web3 instance with fallback RPC
                const Web3 = window.Web3;
                const fallbackWeb3 = new Web3(rpcUrls[i]);
                const fallbackContract = new fallbackWeb3.eth.Contract(
                    this.contracts.get(contractName).options.jsonInterface,
                    this.contractAddresses[contractName]
                );

                const result = await fallbackContract.methods[methodName](...args).call();
                const duration = Date.now() - startTime;
                
                logger.info(LOG_CONTEXTS.CONTRACT, `Fallback RPC success for ${contractName}.${methodName}`, { rpcIndex: i, duration });
                return result;
            } catch (error) {
                lastError = error;
                logger.warn(LOG_CONTEXTS.CONTRACT, `Fallback RPC ${i} failed`, error.message);
            }
        }

        // All RPCs failed - check if it's a widespread RPC issue
        const isWidespreadRpcError = lastError.message.includes('missing trie node') ||
                                   lastError.message.includes('state not found');
                                   
        if (isWidespreadRpcError) {
            logger.error(LOG_CONTEXTS.CONTRACT, `Widespread RPC issues detected for ${contractName}.${methodName}. This may be temporary.`);
            throw new Error(`BSC testnet RPC nodes are experiencing issues. Please try again in a few minutes. (${lastError.message})`);
        }

        // All RPCs failed
        const duration = Date.now() - startTime;
        logger.logError(LOG_CONTEXTS.CONTRACT, lastError, {
            contractName,
            methodName,
            args,
            duration,
            message: 'All RPC endpoints failed'
        });
        
        throw new Error(`All RPC endpoints failed for ${contractName}.${methodName}. Last error: ${lastError.message}`);
    }

    /**
     * Get contract instance by name
     * @param {string} contractName - Contract name
     * @returns {Object} Web3 contract instance
     */
    getContract(contractName) {
        const contract = this.contracts.get(contractName);
        if (!contract) {
            // For debugging: log available contracts
            const available = Array.from(this.contracts.keys());
            logger.warn(LOG_CONTEXTS.CONTRACT, `Contract ${contractName} not found. Available: [${available.join(', ')}]`);
            throw new Error(`Contract not found: ${contractName}. Available contracts: [${available.join(', ')}]`);
        }
        return contract;
    }

    /**
     * Get all available contracts
     * @returns {Map} Map of contract name to contract instance
     */
    getAllContracts() {
        return new Map(this.contracts);
    }

    /**
     * Get contract address by name
     * @param {string} contractName - Contract name
     * @returns {string} Contract address
     */
    getContractAddress(contractName) {
        const address = this.contractAddresses[contractName];
        if (!isValidContractAddress(address)) {
            throw new Error(`Invalid contract address for ${contractName}: ${address}`);
        }
        return address;
    }

    /**
     * Check if contract is available
     * @param {string} contractName - Contract name
     * @returns {boolean} Whether contract is available
     */
    isContractAvailable(contractName) {
        return this.contracts.has(contractName);
    }

    /**
     * Get contract info for debugging
     * @returns {Object} Contract information
     */
    getContractInfo() {
        const info = {
            chainId: this.chainId,
            addresses: this.contractAddresses,
            available: [],
            unavailable: []
        };

        Object.keys(this.contractAddresses).forEach(name => {
            if (this.contracts.has(name)) {
                info.available.push(name);
            } else {
                info.unavailable.push(name);
            }
        });

        return info;
    }

    /**
     * Get detailed contract loading status
     * @returns {Object} Contract loading status with detailed information
     */
    getContractLoadingStatus() {
        const status = {
            chainId: this.chainId,
            network: this.chainId === 97 ? 'BSC Testnet' : this.chainId === 56 ? 'BSC Mainnet' : 'Unknown',
            contracts: {}
        };

        const contractTypes = [
            { name: 'pranaToken', type: 'PranaToken', critical: true },
            { name: 'usdtToken', type: 'UsdtToken', critical: true },
            { name: 'pranaExchange', type: 'PranaExchange', critical: false },
            { name: 'pranaStaking', type: 'PranaStaking', critical: true }
        ];

        contractTypes.forEach(({ name, type, critical }) => {
            const address = this.contractAddresses[name];
            const isLoaded = this.contracts.has(name);
            const isValidAddress = address && address !== '0x0000000000000000000000000000000000000000';
            
            status.contracts[name] = {
                address: address || 'Not configured',
                type,
                critical,
                isValidAddress,
                isLoaded,
                status: isLoaded ? '✅ Loaded' : 
                       !isValidAddress ? '❌ Invalid/Missing Address' : 
                       '❌ Failed to Load'
            };
        });

        return status;
    }

    /**
     * Refresh contract instances (useful after network change)
     * @param {Object} web3 - New web3 instance
     * @param {number} chainId - New chain ID
     */
    async refresh(web3, chainId) {
        logger.info(LOG_CONTEXTS.CONTRACT, `Refreshing contracts for network change`, { oldChainId: this.chainId, newChainId: chainId });
        
        // Clear existing contracts
        this.contracts.clear();
        
        // Re-initialize with new network
        await this.initialize(web3, chainId);
    }

    /**
     * Health check for all contracts
     * @returns {Object} Health check results
     */
    async healthCheck() {
        const results = {
            overall: 'healthy',
            contracts: {}
        };

        let hasErrors = false;

        for (const [name, contract] of this.contracts) {
            try {
                // Try a basic call to test connectivity
                const address = contract.options.address;
                const code = await this.web3.eth.getCode(address);
                
                if (code === '0x') {
                    results.contracts[name] = { status: 'error', error: 'No contract code at address' };
                    hasErrors = true;
                } else {
                    results.contracts[name] = { status: 'healthy', address };
                }
            } catch (error) {
                results.contracts[name] = { status: 'error', error: error.message };
                hasErrors = true;
            }
        }

        if (hasErrors) {
            results.overall = 'degraded';
        }

        return results;
    }
}

// Export singleton instance
export const contractService = new ContractService();

// Export class for testing
export { ContractService };