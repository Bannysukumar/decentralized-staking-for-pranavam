/**
 * BlockchainSyncService - Real-time blockchain state synchronization
 * Following Observer Pattern and Event-Driven Architecture
 */

import { stateManager } from '../state/ReactiveStateManager';
import contractManager from '../managers/ContractManager';
import { logger, LOG_CONTEXTS } from '../../services/LoggingService.js';

export interface SyncConfiguration {
    blockPollingInterval: number;
    maxBlocksBehind: number;
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
}

export interface BlockData {
    number: number;
    hash: string;
    timestamp: number;
    transactions: string[];
    gasUsed: number;
    gasLimit: number;
}

export class BlockchainSyncService {
    private isRunning = false;
    private currentBlock = 0;
    private syncInterval: NodeJS.Timeout | null = null;
    private pendingTransactions: Set<string> = new Set();
    private eventSubscriptions: Map<string, any> = new Map();
    
    private readonly config: SyncConfiguration = {
        blockPollingInterval: 15000, // 15 seconds
        maxBlocksBehind: 100,
        batchSize: 10,
        retryAttempts: 3,
        retryDelay: 2000
    };

    constructor() {
        this.setupStateListeners();
    }

    private setupStateListeners(): void {
        // Start sync when wallet connects
        stateManager.subscribe('wallet', (update) => {
            const walletState = update.data;
            if (walletState.connected && !this.isRunning) {
                this.startSync();
            } else if (!walletState.connected && this.isRunning) {
                this.stopSync();
            }
        });

        // Listen for contract loading completion
        stateManager.subscribe('contracts', (update) => {
            const contractsState = update.data;
            if (contractsState.loaded && this.isRunning) {
                this.setupContractEventListeners();
            }
        });

        // Track pending transactions
        stateManager.subscribe('transactions', (update) => {
            const transactionState = update.data;
            if (transactionState.pending) {
                for (const [txId, tx] of transactionState.pending) {
                    if (tx.status === 'executing' && tx.hash) {
                        this.pendingTransactions.add(tx.hash);
                    }
                }
            }
        });
    }

    async startSync(): Promise<void> {
        if (this.isRunning) {
            logger.warn(LOG_CONTEXTS.SYNC, 'Sync already running');
            return;
        }

        try {
            const web3 = stateManager['web3'];
            if (!web3) {
                throw new Error('Web3 not initialized');
            }

            this.isRunning = true;
            this.currentBlock = await web3.eth.getBlockNumber();
            
            logger.info(LOG_CONTEXTS.SYNC, 'Blockchain sync started', {
                currentBlock: this.currentBlock
            });

            // Setup block polling
            this.syncInterval = setInterval(async () => {
                await this.syncLatestBlocks();
            }, this.config.blockPollingInterval);

            // Setup contract event listeners
            await this.setupContractEventListeners();

            // Initial state sync
            await stateManager.syncState(this.currentBlock);

        } catch (error) {
            logger.logError(LOG_CONTEXTS.SYNC, error, { context: 'startSync' });
            this.isRunning = false;
            throw error;
        }
    }

    async stopSync(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Clear intervals
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Unsubscribe from all contract events
        for (const [contractName, subscription] of this.eventSubscriptions) {
            try {
                if (subscription && subscription.unsubscribe) {
                    subscription.unsubscribe();
                }
                stateManager.unwatchContract(contractName);
            } catch (error) {
                logger.logError(LOG_CONTEXTS.SYNC, error, {
                    context: 'stopSync',
                    contractName
                });
            }
        }
        this.eventSubscriptions.clear();

        // Clear pending transactions
        this.pendingTransactions.clear();

        logger.info(LOG_CONTEXTS.SYNC, 'Blockchain sync stopped');
    }

    private async syncLatestBlocks(): Promise<void> {
        if (!this.isRunning) return;

        try {
            const web3 = stateManager['web3'];
            if (!web3) return;

            const latestBlock = await web3.eth.getBlockNumber();
            
            if (latestBlock > this.currentBlock) {
                const blocksBehind = latestBlock - this.currentBlock;
                
                logger.debug(LOG_CONTEXTS.SYNC, `Syncing ${blocksBehind} blocks`, {
                    from: this.currentBlock + 1,
                    to: latestBlock
                });

                // If too far behind, sync in batches
                if (blocksBehind > this.config.maxBlocksBehind) {
                    await this.batchSyncBlocks(this.currentBlock + 1, latestBlock);
                } else {
                    await this.syncBlockRange(this.currentBlock + 1, latestBlock);
                }

                this.currentBlock = latestBlock;
                
                // Update gas price in state
                await this.updateGasPrice();
            }

            // Check pending transactions
            await this.checkPendingTransactions();

        } catch (error) {
            logger.logError(LOG_CONTEXTS.SYNC, error, { context: 'syncLatestBlocks' });
        }
    }

    private async syncBlockRange(fromBlock: number, toBlock: number): Promise<void> {
        const web3 = stateManager['web3'];
        if (!web3) return;

        for (let blockNumber = fromBlock; blockNumber <= toBlock; blockNumber++) {
            if (!this.isRunning) break;

            try {
                const block = await web3.eth.getBlock(blockNumber, true);
                await this.processBlock(block);
                
                // Sync state for this block
                await stateManager.syncState(blockNumber);
                
            } catch (error) {
                logger.logError(LOG_CONTEXTS.SYNC, error, {
                    context: 'syncBlockRange',
                    blockNumber
                });
            }
        }
    }

    private async batchSyncBlocks(fromBlock: number, toBlock: number): Promise<void> {
        const totalBlocks = toBlock - fromBlock + 1;
        const batches = Math.ceil(totalBlocks / this.config.batchSize);

        logger.info(LOG_CONTEXTS.SYNC, `Batch syncing ${totalBlocks} blocks in ${batches} batches`);

        for (let i = 0; i < batches; i++) {
            if (!this.isRunning) break;

            const batchStart = fromBlock + (i * this.config.batchSize);
            const batchEnd = Math.min(batchStart + this.config.batchSize - 1, toBlock);

            await this.syncBlockRange(batchStart, batchEnd);
            
            // Small delay between batches to prevent overwhelming the RPC
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private async processBlock(block: any): Promise<void> {
        const blockData: BlockData = {
            number: block.number,
            hash: block.hash,
            timestamp: block.timestamp * 1000, // Convert to milliseconds
            transactions: block.transactions.map((tx: any) => tx.hash),
            gasUsed: block.gasUsed,
            gasLimit: block.gasLimit
        };

        // Check if any transactions in this block are ours
        const ourTransactions = block.transactions.filter((tx: any) => 
            this.pendingTransactions.has(tx.hash)
        );

        if (ourTransactions.length > 0) {
            logger.info(LOG_CONTEXTS.SYNC, `Found ${ourTransactions.length} our transactions in block ${block.number}`);
            
            for (const tx of ourTransactions) {
                await this.processOurTransaction(tx);
                this.pendingTransactions.delete(tx.hash);
            }
        }

        // Check for contract interactions
        await this.checkContractInteractions(block);
    }

    private async processOurTransaction(transaction: any): Promise<void> {
        try {
            const web3 = stateManager['web3'];
            if (!web3) return;

            const receipt = await web3.eth.getTransactionReceipt(transaction.hash);
            
            // Emit transaction completion event
            stateManager.updateState('transactions', {
                completed: {
                    hash: transaction.hash,
                    status: receipt.status,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed,
                    timestamp: Date.now()
                }
            });

            logger.info(LOG_CONTEXTS.SYNC, `Our transaction processed: ${transaction.hash}`, {
                status: receipt.status,
                gasUsed: receipt.gasUsed
            });

        } catch (error) {
            logger.logError(LOG_CONTEXTS.SYNC, error, {
                context: 'processOurTransaction',
                txHash: transaction.hash
            });
        }
    }

    private async checkContractInteractions(block: any): Promise<void> {
        const contractAddresses = new Set(
            Array.from(contractManager.getAllContracts().values())
                .map(contract => contract.address.toLowerCase())
        );

        const contractTransactions = block.transactions.filter((tx: any) =>
            tx.to && contractAddresses.has(tx.to.toLowerCase())
        );

        if (contractTransactions.length > 0) {
            logger.debug(LOG_CONTEXTS.SYNC, `Found ${contractTransactions.length} contract interactions in block ${block.number}`);
            
            // Trigger immediate state sync for contract updates
            await stateManager.syncState(block.number);
        }
    }

    private async setupContractEventListeners(): Promise<void> {
        const contracts = contractManager.getAllContracts();
        
        for (const [contractName, contractInstance] of contracts) {
            try {
                await this.setupContractEvents(contractName, contractInstance);
            } catch (error) {
                logger.logError(LOG_CONTEXTS.SYNC, error, {
                    context: 'setupContractEventListeners',
                    contractName
                });
            }
        }
    }

    private async setupContractEvents(contractName: string, contractInstance: any): Promise<void> {
        // Define events to watch for each contract type
        const eventsToWatch = this.getEventsForContract(contractName);
        
        if (eventsToWatch.length === 0) return;

        // Subscribe to all events for this contract
        const subscription = contractInstance.contract.events.allEvents({
            fromBlock: 'latest'
        })
        .on('data', (event: any) => {
            this.handleContractEvent(contractName, event);
        })
        .on('error', (error: any) => {
            logger.logError(LOG_CONTEXTS.SYNC, error, {
                context: 'contractEventListener',
                contractName
            });
        });

        this.eventSubscriptions.set(contractName, subscription);
        
        logger.debug(LOG_CONTEXTS.SYNC, `Event listeners setup for ${contractName}`, {
            events: eventsToWatch
        });
    }

    private getEventsForContract(contractName: string): string[] {
        const eventMap: { [key: string]: string[] } = {
            pranaToken: ['Transfer', 'Approval'],
            usdtToken: ['Transfer', 'Approval'],
            pranaExchange: ['PRANAPurchased', 'PRANASold', 'LiquidityAdded', 'LiquidityRemoved'],
            pranaStaking: ['Staked', 'Unstaked', 'RewardPaid', 'RewardAdded']
        };

        return eventMap[contractName] || [];
    }

    private handleContractEvent(contractName: string, event: any): void {
        logger.info(LOG_CONTEXTS.SYNC, `Contract event: ${contractName}.${event.event}`, {
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            returnValues: event.returnValues
        });

        // Immediate state sync for contract events
        stateManager.syncState(event.blockNumber).catch(error => {
            logger.logError(LOG_CONTEXTS.SYNC, error, {
                context: 'handleContractEvent',
                event: event.event,
                contractName
            });
        });

        // Emit specific event through state manager
        stateManager.updateState(`${contractName}.${event.event}`, {
            data: event.returnValues,
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: Date.now()
        });
    }

    private async checkPendingTransactions(): Promise<void> {
        if (this.pendingTransactions.size === 0) return;

        const web3 = stateManager['web3'];
        if (!web3) return;

        const completedTransactions: string[] = [];

        for (const txHash of this.pendingTransactions) {
            try {
                const receipt = await web3.eth.getTransactionReceipt(txHash);
                if (receipt) {
                    await this.processOurTransaction({ hash: txHash });
                    completedTransactions.push(txHash);
                }
            } catch (error) {
                logger.logError(LOG_CONTEXTS.SYNC, error, {
                    context: 'checkPendingTransactions',
                    txHash
                });
            }
        }

        // Remove completed transactions
        completedTransactions.forEach(txHash => {
            this.pendingTransactions.delete(txHash);
        });

        if (completedTransactions.length > 0) {
            logger.debug(LOG_CONTEXTS.SYNC, `Processed ${completedTransactions.length} pending transactions`);
        }
    }

    private async updateGasPrice(): Promise<void> {
        try {
            const web3 = stateManager['web3'];
            if (!web3) return;

            const gasPrice = await web3.eth.getGasPrice();
            const gasPriceGwei = web3.utils.fromWei(gasPrice, 'gwei');

            stateManager.updateState('transactions', {
                gasPrice: gasPriceGwei
            });

        } catch (error) {
            logger.logError(LOG_CONTEXTS.SYNC, error, { context: 'updateGasPrice' });
        }
    }

    // Public methods for external control
    async forceSyncState(): Promise<void> {
        if (!this.isRunning) {
            throw new Error('Sync service not running');
        }

        const web3 = stateManager['web3'];
        if (!web3) {
            throw new Error('Web3 not initialized');
        }

        const latestBlock = await web3.eth.getBlockNumber();
        await stateManager.syncState(latestBlock);
        
        logger.info(LOG_CONTEXTS.SYNC, 'Force sync completed', { block: latestBlock });
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            currentBlock: this.currentBlock,
            pendingTransactions: this.pendingTransactions.size,
            eventSubscriptions: this.eventSubscriptions.size,
            config: this.config
        };
    }

    updateConfig(newConfig: Partial<SyncConfiguration>): void {
        Object.assign(this.config, newConfig);
        
        // Restart sync with new config if running
        if (this.isRunning) {
            this.stopSync().then(() => this.startSync());
        }
        
        logger.info(LOG_CONTEXTS.SYNC, 'Sync configuration updated', this.config);
    }

    // Cleanup
    destroy(): void {
        this.stopSync();
        
        // Clear state listeners
        stateManager.unsubscribe('wallet', this.setupStateListeners);
        stateManager.unsubscribe('contracts', this.setupStateListeners);
        stateManager.unsubscribe('transactions', this.setupStateListeners);
        
        logger.info(LOG_CONTEXTS.SYNC, 'BlockchainSyncService destroyed');
    }
}

// Export singleton instance
export const blockchainSyncService = new BlockchainSyncService();