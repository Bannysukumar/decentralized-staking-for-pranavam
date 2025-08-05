/**
 * TransactionManager - Centralized transaction handling with reactive updates
 * Following Single Responsibility and Command Pattern
 */

import { ITransactionManager, TransactionOptions, TransactionResult, TransactionRequest } from '../interfaces/ITransactionManager';
import { stateManager } from '../state/ReactiveStateManager';
import contractManager from './ContractManager';
import { logger, LOG_CONTEXTS } from '../../services/LoggingService.js';

export interface EnhancedTransactionResult extends TransactionResult {
    gasCost: string;
    gasCostUSD?: string;
    executionTime: number;
    confirmationTime: number;
}

export interface TransactionQueueItem {
    id: string;
    request: TransactionRequest;
    priority: 'low' | 'normal' | 'high';
    timestamp: number;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
    retryCount: number;
    maxRetries: number;
}

export class TransactionManager implements ITransactionManager {
    private queue: Map<string, TransactionQueueItem> = new Map();
    private executingTransactions: Set<string> = new Set();
    private isProcessingQueue = false;
    
    // Configuration
    private readonly config = {
        maxConcurrentTransactions: 3,
        maxRetries: 3,
        retryDelay: 2000,
        gasMultiplier: 1.2,
        maxGasLimit: 8000000,
        queueProcessInterval: 1000
    };

    // Gas price cache
    private gasPriceCache = {
        price: null as string | null,
        lastUpdate: 0,
        cacheTTL: 30000 // 30 seconds
    };

    constructor() {
        this.startQueueProcessor();
        this.setupStateListeners();
    }

    private setupStateListeners(): void {
        // Listen for wallet changes to clear pending transactions
        stateManager.subscribe('wallet', (update) => {
            const walletState = update.data;
            if (!walletState.connected) {
                this.clearQueue();
            }
        });

        // Listen for contract events to trigger immediate state updates
        stateManager.subscribe('contractEvent', (update) => {
            this.handleContractEvent(update);
        });
    }

    async executeTransaction(request: TransactionRequest): Promise<EnhancedTransactionResult> {
        const startTime = Date.now();
        
        try {
            // Validate request
            this.validateTransactionRequest(request);
            
            // Get contract instance
            const contract = contractManager.getContract(request.contractName);
            if (!contract) {
                throw new Error(`Contract ${request.contractName} not loaded`);
            }

            // Get current account
            const account = stateManager.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            // Prepare transaction options
            const txOptions = await this.prepareTransactionOptions(request, account);
            
            // Execute transaction
            const txHash = await this.sendTransaction(contract, request, txOptions);
            
            // Wait for confirmation and get receipt
            const receipt = await this.waitForConfirmation(txHash);
            
            // Calculate costs and timing
            const executionTime = Date.now() - startTime;
            const gasCost = this.calculateGasCost(receipt.gasUsed, txOptions.gasPrice);
            
            const result: EnhancedTransactionResult = {
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                status: receipt.status,
                events: receipt.events ? Object.values(receipt.events).flat() : undefined,
                gasCost,
                executionTime,
                confirmationTime: Date.now() - startTime
            };

            // Update transaction state
            this.updateTransactionState(txHash, 'completed', result);
            
            // Trigger immediate state sync
            await stateManager.syncState(receipt.blockNumber);
            
            logger.info(LOG_CONTEXTS.TRANSACTION, `Transaction completed: ${request.methodName}`, {
                contractName: request.contractName,
                transactionHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed,
                executionTime
            });

            return result;

        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            logger.logError(LOG_CONTEXTS.TRANSACTION, error, {
                contractName: request.contractName,
                methodName: request.methodName,
                executionTime,
                context: 'executeTransaction'
            });

            // Update transaction state
            this.updateTransactionState('', 'failed', { error: error.message });
            
            throw error;
        }
    }

    async executeTransactionQueued(
        request: TransactionRequest, 
        priority: 'low' | 'normal' | 'high' = 'normal'
    ): Promise<string> {
        const queueItem: TransactionQueueItem = {
            id: this.generateTransactionId(),
            request,
            priority,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0,
            maxRetries: this.config.maxRetries
        };

        this.queue.set(queueItem.id, queueItem);
        
        // Update transaction state
        stateManager.updateState('transactions', {
            pending: new Map([...stateManager.getState('transactions').pending, [queueItem.id, queueItem]])
        });

        logger.info(LOG_CONTEXTS.TRANSACTION, `Transaction queued: ${request.methodName}`, {
            id: queueItem.id,
            priority,
            queueSize: this.queue.size
        });

        return queueItem.id;
    }

    async estimateGas(request: TransactionRequest): Promise<number> {
        try {
            const contract = contractManager.getContract(request.contractName);
            if (!contract) {
                throw new Error(`Contract ${request.contractName} not loaded`);
            }

            const account = stateManager.getCurrentAccount();
            if (!account) {
                throw new Error('No wallet connected');
            }

            const gasEstimate = await contract.methods[request.methodName](...request.params)
                .estimateGas({ 
                    from: account,
                    ...request.options 
                });

            // Add buffer for safety
            const gasWithBuffer = Math.floor(gasEstimate * this.config.gasMultiplier);
            
            return Math.min(gasWithBuffer, this.config.maxGasLimit);

        } catch (error) {
            logger.logError(LOG_CONTEXTS.TRANSACTION, error, {
                contractName: request.contractName,
                methodName: request.methodName,
                context: 'estimateGas'
            });
            
            // Return fallback gas estimate
            return 200000;
        }
    }

    async getTransactionStatus(txHash: string): Promise<any> {
        const web3 = stateManager['web3'];
        if (!web3) {
            throw new Error('Web3 not initialized');
        }

        try {
            const receipt = await web3.eth.getTransactionReceipt(txHash);
            const transaction = await web3.eth.getTransaction(txHash);
            
            return {
                receipt,
                transaction,
                confirmed: receipt !== null,
                status: receipt?.status,
                blockNumber: receipt?.blockNumber
            };
        } catch (error) {
            logger.logError(LOG_CONTEXTS.TRANSACTION, error, {
                txHash,
                context: 'getTransactionStatus'
            });
            throw error;
        }
    }

    async cancelTransaction(txHash: string): Promise<boolean> {
        // Mark queued transaction as cancelled
        for (const [id, item] of this.queue.entries()) {
            if (item.status === 'pending') {
                this.queue.delete(id);
                this.updateTransactionState(id, 'cancelled');
                return true;
            }
        }

        // For executing transactions, attempt to cancel with higher gas price
        // This is complex and not always guaranteed to work
        logger.warn(LOG_CONTEXTS.TRANSACTION, `Cannot cancel executing transaction: ${txHash}`);
        return false;
    }

    private validateTransactionRequest(request: TransactionRequest): void {
        if (!request.contractName || !request.methodName) {
            throw new Error('Contract name and method name are required');
        }

        if (!Array.isArray(request.params)) {
            throw new Error('Parameters must be an array');
        }

        const contract = contractManager.getContract(request.contractName);
        if (!contract) {
            throw new Error(`Contract ${request.contractName} not loaded`);
        }

        if (!contract.methods[request.methodName]) {
            throw new Error(`Method ${request.methodName} not found in contract ${request.contractName}`);
        }
    }

    private async prepareTransactionOptions(request: TransactionRequest, account: string): Promise<TransactionOptions> {
        const gasEstimate = await this.estimateGas(request);
        const gasPrice = await this.getOptimalGasPrice();

        return {
            from: account,
            gas: gasEstimate,
            gasPrice,
            ...request.options
        };
    }

    private async sendTransaction(
        contract: any, 
        request: TransactionRequest, 
        options: TransactionOptions
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const transaction = contract.contract.methods[request.methodName](...request.params)
                .send(options);

            transaction.on('transactionHash', (hash: string) => {
                logger.debug(LOG_CONTEXTS.TRANSACTION, `Transaction hash received: ${hash}`);
                resolve(hash);
            });

            transaction.on('error', (error: any) => {
                logger.logError(LOG_CONTEXTS.TRANSACTION, error, {
                    contractName: request.contractName,
                    methodName: request.methodName,
                    context: 'sendTransaction'
                });
                reject(error);
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                reject(new Error('Transaction timeout'));
            }, 30000);
        });
    }

    private async waitForConfirmation(txHash: string): Promise<any> {
        const web3 = stateManager['web3'];
        if (!web3) {
            throw new Error('Web3 not initialized');
        }

        return new Promise((resolve, reject) => {
            const checkReceipt = async () => {
                try {
                    const receipt = await web3.eth.getTransactionReceipt(txHash);
                    if (receipt) {
                        resolve(receipt);
                    } else {
                        setTimeout(checkReceipt, 2000); // Check every 2 seconds
                    }
                } catch (error) {
                    reject(error);
                }
            };

            checkReceipt();

            // Timeout after 5 minutes
            setTimeout(() => {
                reject(new Error('Transaction confirmation timeout'));
            }, 300000);
        });
    }

    private async getOptimalGasPrice(): Promise<string> {
        const web3 = stateManager['web3'];
        if (!web3) {
            throw new Error('Web3 not initialized');
        }

        // Check cache first
        if (this.gasPriceCache.price && 
            Date.now() - this.gasPriceCache.lastUpdate < this.gasPriceCache.cacheTTL) {
            return this.gasPriceCache.price;
        }

        try {
            const gasPrice = await web3.eth.getGasPrice();
            // Add 10% buffer for faster confirmation
            const bufferedGasPrice = web3.utils.toBN(gasPrice).mul(web3.utils.toBN(110)).div(web3.utils.toBN(100));
            
            this.gasPriceCache.price = bufferedGasPrice.toString();
            this.gasPriceCache.lastUpdate = Date.now();
            
            return this.gasPriceCache.price;
        } catch (error) {
            logger.logError(LOG_CONTEXTS.TRANSACTION, error, { context: 'getOptimalGasPrice' });
            // Fallback gas price (20 gwei)
            return web3.utils.toWei('20', 'gwei');
        }
    }

    private calculateGasCost(gasUsed: number, gasPrice: string): string {
        const web3 = stateManager['web3'];
        if (!web3) return '0';

        const cost = web3.utils.toBN(gasUsed).mul(web3.utils.toBN(gasPrice));
        return web3.utils.fromWei(cost, 'ether');
    }

    private updateTransactionState(txHash: string, status: string, data?: any): void {
        const transactionState = stateManager.getState('transactions');
        const updatedHistory = [...transactionState.history];
        
        // Update or add transaction to history
        const existingIndex = updatedHistory.findIndex(tx => tx.hash === txHash);
        const transactionData = {
            hash: txHash,
            status,
            timestamp: Date.now(),
            ...data
        };

        if (existingIndex >= 0) {
            updatedHistory[existingIndex] = { ...updatedHistory[existingIndex], ...transactionData };
        } else {
            updatedHistory.push(transactionData);
        }

        stateManager.updateState('transactions', {
            history: updatedHistory
        });
    }

    private handleContractEvent(update: any): void {
        logger.debug(LOG_CONTEXTS.TRANSACTION, 'Contract event triggered state update', {
            type: update.type,
            blockNumber: update.blockNumber,
            transactionHash: update.transactionHash
        });
    }

    // Queue processing
    private startQueueProcessor(): void {
        setInterval(() => {
            if (!this.isProcessingQueue && this.queue.size > 0) {
                this.processQueue();
            }
        }, this.config.queueProcessInterval);
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessingQueue || this.executingTransactions.size >= this.config.maxConcurrentTransactions) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Get next transaction by priority
            const nextTransaction = this.getNextTransaction();
            if (!nextTransaction) {
                return;
            }

            nextTransaction.status = 'executing';
            this.executingTransactions.add(nextTransaction.id);

            try {
                const result = await this.executeTransaction(nextTransaction.request);
                nextTransaction.status = 'completed';
                
                logger.info(LOG_CONTEXTS.TRANSACTION, `Queued transaction completed: ${nextTransaction.id}`);
                
            } catch (error) {
                nextTransaction.retryCount++;
                
                if (nextTransaction.retryCount < nextTransaction.maxRetries) {
                    nextTransaction.status = 'pending';
                    logger.warn(LOG_CONTEXTS.TRANSACTION, `Transaction failed, retrying: ${nextTransaction.id}`, {
                        retryCount: nextTransaction.retryCount,
                        error: error.message
                    });
                } else {
                    nextTransaction.status = 'failed';
                    logger.error(LOG_CONTEXTS.TRANSACTION, `Transaction failed after max retries: ${nextTransaction.id}`, {
                        error: error.message
                    });
                }
            } finally {
                this.executingTransactions.delete(nextTransaction.id);
                
                if (nextTransaction.status === 'completed' || nextTransaction.status === 'failed') {
                    this.queue.delete(nextTransaction.id);
                }
            }

        } finally {
            this.isProcessingQueue = false;
        }
    }

    private getNextTransaction(): TransactionQueueItem | null {
        let highestPriority: TransactionQueueItem | null = null;
        
        for (const transaction of this.queue.values()) {
            if (transaction.status !== 'pending') continue;
            
            if (!highestPriority) {
                highestPriority = transaction;
                continue;
            }

            // Priority order: high > normal > low
            const priorityOrder = { high: 3, normal: 2, low: 1 };
            
            if (priorityOrder[transaction.priority] > priorityOrder[highestPriority.priority]) {
                highestPriority = transaction;
            } else if (priorityOrder[transaction.priority] === priorityOrder[highestPriority.priority]) {
                // Same priority, use timestamp (FIFO)
                if (transaction.timestamp < highestPriority.timestamp) {
                    highestPriority = transaction;
                }
            }
        }

        return highestPriority;
    }

    private clearQueue(): void {
        this.queue.clear();
        this.executingTransactions.clear();
        
        stateManager.updateState('transactions', {
            pending: new Map()
        });
        
        logger.info(LOG_CONTEXTS.TRANSACTION, 'Transaction queue cleared');
    }

    private generateTransactionId(): string {
        return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public getters
    get queueSize(): number {
        return this.queue.size;
    }

    get executingCount(): number {
        return this.executingTransactions.size;
    }

    getQueueStatus(): any {
        return {
            total: this.queue.size,
            executing: this.executingTransactions.size,
            pending: this.queue.size - this.executingTransactions.size,
            byPriority: {
                high: Array.from(this.queue.values()).filter(tx => tx.priority === 'high').length,
                normal: Array.from(this.queue.values()).filter(tx => tx.priority === 'normal').length,
                low: Array.from(this.queue.values()).filter(tx => tx.priority === 'low').length
            }
        };
    }

    // Cleanup
    destroy(): void {
        this.clearQueue();
        this.gasPriceCache.price = null;
        
        logger.info(LOG_CONTEXTS.TRANSACTION, 'TransactionManager destroyed');
    }
}

// Export singleton instance
export const transactionManager = new TransactionManager();