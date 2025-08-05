/**
 * ReactiveStateManager - Centralized state management with reactive updates
 * Following Observer Pattern and Single Responsibility Principle
 */

import { IStateManager, StateUpdate } from '../interfaces/IStateManager';
import { logger, LOG_CONTEXTS } from '../../services/LoggingService.js';

export class ReactiveStateManager implements IStateManager {
    private state: Map<string, any> = new Map();
    private subscribers: Map<string, Set<(update: StateUpdate) => void>> = new Map();
    private contractWatchers: Map<string, any[]> = new Map();
    private web3: any = null;
    
    constructor() {
        this.initializeDefaultState();
    }

    private initializeDefaultState(): void {
        this.state.set('wallet', {
            connected: false,
            account: null,
            chainId: null,
            balance: '0',
            networkName: null
        });
        
        this.state.set('contracts', {
            loaded: false,
            instances: new Map(),
            addresses: new Map()
        });
        
        this.state.set('exchange', {
            pranaReserve: '0',
            usdtReserve: '0',
            exchangeRate: 0,
            totalVolume: '0',
            userVolume: '0'
        });
        
        this.state.set('staking', {
            totalStaked: '0',
            userStaked: '0',
            pendingRewards: '0',
            apy: 0
        });
        
        this.state.set('transactions', {
            pending: new Map(),
            history: [],
            gasPrice: '0'
        });
    }

    setWeb3Instance(web3: any): void {
        this.web3 = web3;
    }

    subscribe(event: string, callback: (update: StateUpdate) => void): void {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, new Set());
        }
        this.subscribers.get(event)!.add(callback);
        
        logger.debug(LOG_CONTEXTS.STATE, `Subscribed to event: ${event}`);
    }

    unsubscribe(event: string, callback: (update: StateUpdate) => void): void {
        const eventSubscribers = this.subscribers.get(event);
        if (eventSubscribers) {
            eventSubscribers.delete(callback);
            if (eventSubscribers.size === 0) {
                this.subscribers.delete(event);
            }
        }
        
        logger.debug(LOG_CONTEXTS.STATE, `Unsubscribed from event: ${event}`);
    }

    getState(key: string): any {
        return this.state.get(key);
    }

    updateState(key: string, value: any, metadata?: any): void {
        const oldValue = this.state.get(key);
        this.state.set(key, { ...oldValue, ...value });
        
        const update: StateUpdate = {
            type: key,
            data: this.state.get(key),
            timestamp: Date.now(),
            ...metadata
        };
        
        this.notifySubscribers(key, update);
        this.notifySubscribers('*', update); // Global listeners
        
        logger.debug(LOG_CONTEXTS.STATE, `State updated: ${key}`, update);
    }

    private notifySubscribers(event: string, update: StateUpdate): void {
        const eventSubscribers = this.subscribers.get(event);
        if (eventSubscribers) {
            eventSubscribers.forEach(callback => {
                try {
                    callback(update);
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.STATE, error, { 
                        event, 
                        context: 'notifySubscribers' 
                    });
                }
            });
        }
    }

    async syncState(blockNumber?: number): Promise<void> {
        if (!this.web3) {
            logger.warn(LOG_CONTEXTS.STATE, 'Web3 not initialized, cannot sync state');
            return;
        }

        try {
            const currentBlock = blockNumber || await this.web3.eth.getBlockNumber();
            const walletState = this.getState('wallet');
            
            if (walletState.connected && walletState.account) {
                // Sync wallet balance
                const balance = await this.web3.eth.getBalance(walletState.account);
                const balanceEth = this.web3.utils.fromWei(balance, 'ether');
                
                if (balanceEth !== walletState.balance) {
                    this.updateState('wallet', { balance: balanceEth }, { 
                        blockNumber: currentBlock 
                    });
                }

                // Sync contract states
                await this.syncContractStates(currentBlock);
            }
            
            logger.debug(LOG_CONTEXTS.STATE, `State synced at block ${currentBlock}`);
        } catch (error) {
            logger.logError(LOG_CONTEXTS.STATE, error, { 
                context: 'syncState', 
                blockNumber 
            });
        }
    }

    private async syncContractStates(blockNumber: number): Promise<void> {
        const contractsState = this.getState('contracts');
        
        if (!contractsState.loaded) return;

        // Sync exchange state
        await this.syncExchangeState(blockNumber);
        
        // Sync staking state
        await this.syncStakingState(blockNumber);
    }

    private async syncExchangeState(blockNumber: number): Promise<void> {
        try {
            const contractsState = this.getState('contracts');
            const exchangeContract = contractsState.instances.get('pranaExchange');
            
            if (!exchangeContract) return;

            const [pranaBalance, usdtBalance] = await exchangeContract.methods.getBalances().call();
            const totalVolume = await exchangeContract.methods.totalVolume().call();
            const exchangeRate = await exchangeContract.methods.getExchangeRate().call();
            
            const currentExchangeState = this.getState('exchange');
            const newPranaReserve = this.web3.utils.fromWei(pranaBalance, 'ether');
            const newUsdtReserve = this.web3.utils.fromWei(usdtBalance, 'mwei'); // USDT has 6 decimals
            const newTotalVolume = this.web3.utils.fromWei(totalVolume, 'mwei');
            
            if (newPranaReserve !== currentExchangeState.pranaReserve ||
                newUsdtReserve !== currentExchangeState.usdtReserve ||
                newTotalVolume !== currentExchangeState.totalVolume) {
                
                this.updateState('exchange', {
                    pranaReserve: newPranaReserve,
                    usdtReserve: newUsdtReserve,
                    totalVolume: newTotalVolume,
                    exchangeRate: parseInt(exchangeRate) / 10000
                }, { blockNumber });
            }
        } catch (error) {
            logger.logError(LOG_CONTEXTS.STATE, error, { context: 'syncExchangeState' });
        }
    }

    private async syncStakingState(blockNumber: number): Promise<void> {
        try {
            const contractsState = this.getState('contracts');
            const stakingContract = contractsState.instances.get('pranaStaking');
            const walletState = this.getState('wallet');
            
            if (!stakingContract || !walletState.account) return;

            const totalStaked = await stakingContract.methods.totalSupply().call();
            const userStaked = await stakingContract.methods.balanceOf(walletState.account).call();
            const pendingRewards = await stakingContract.methods.earned(walletState.account).call();
            
            const currentStakingState = this.getState('staking');
            const newTotalStaked = this.web3.utils.fromWei(totalStaked, 'ether');
            const newUserStaked = this.web3.utils.fromWei(userStaked, 'ether');
            const newPendingRewards = this.web3.utils.fromWei(pendingRewards, 'ether');
            
            if (newTotalStaked !== currentStakingState.totalStaked ||
                newUserStaked !== currentStakingState.userStaked ||
                newPendingRewards !== currentStakingState.pendingRewards) {
                
                this.updateState('staking', {
                    totalStaked: newTotalStaked,
                    userStaked: newUserStaked,
                    pendingRewards: newPendingRewards
                }, { blockNumber });
            }
        } catch (error) {
            logger.logError(LOG_CONTEXTS.STATE, error, { context: 'syncStakingState' });
        }
    }

    watchContract(contractName: string, events: string[]): void {
        const contractsState = this.getState('contracts');
        const contract = contractsState.instances.get(contractName);
        
        if (!contract) {
            logger.warn(LOG_CONTEXTS.STATE, `Contract ${contractName} not found for watching`);
            return;
        }

        const watchers: any[] = [];
        
        events.forEach(eventName => {
            const watcher = contract.events[eventName]({
                fromBlock: 'latest'
            })
            .on('data', (event: any) => {
                this.handleContractEvent(contractName, eventName, event);
            })
            .on('error', (error: any) => {
                logger.logError(LOG_CONTEXTS.STATE, error, { 
                    context: 'contractEventWatcher',
                    contractName,
                    eventName
                });
            });
            
            watchers.push(watcher);
        });
        
        this.contractWatchers.set(contractName, watchers);
        
        logger.info(LOG_CONTEXTS.STATE, `Started watching contract ${contractName}`, { events });
    }

    unwatchContract(contractName: string): void {
        const watchers = this.contractWatchers.get(contractName);
        
        if (watchers) {
            watchers.forEach(watcher => {
                try {
                    watcher.unsubscribe();
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.STATE, error, { 
                        context: 'unwatchContract',
                        contractName
                    });
                }
            });
            
            this.contractWatchers.delete(contractName);
            logger.info(LOG_CONTEXTS.STATE, `Stopped watching contract ${contractName}`);
        }
    }

    private handleContractEvent(contractName: string, eventName: string, event: any): void {
        logger.info(LOG_CONTEXTS.STATE, `Contract event received: ${contractName}.${eventName}`, {
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber
        });

        // Immediate state sync after contract event
        this.syncState(event.blockNumber);
        
        // Notify specific event listeners
        const update: StateUpdate = {
            type: `${contractName}.${eventName}`,
            data: event.returnValues,
            timestamp: Date.now(),
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash
        };
        
        this.notifySubscribers(`${contractName}.${eventName}`, update);
        this.notifySubscribers('contractEvent', update);
    }

    // Utility methods for common state operations
    isWalletConnected(): boolean {
        return this.getState('wallet').connected;
    }

    getCurrentAccount(): string | null {
        return this.getState('wallet').account;
    }

    getContractInstance(name: string): any {
        return this.getState('contracts').instances.get(name);
    }

    // Clean up resources
    destroy(): void {
        // Unwatch all contracts
        for (const contractName of this.contractWatchers.keys()) {
            this.unwatchContract(contractName);
        }
        
        // Clear all subscribers
        this.subscribers.clear();
        
        // Clear state
        this.state.clear();
        
        logger.info(LOG_CONTEXTS.STATE, 'ReactiveStateManager destroyed');
    }
}

// Export singleton instance
export const stateManager = new ReactiveStateManager();