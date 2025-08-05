/**
 * UI Service Integration
 * Provides simplified interface for HTML pages to use optimized services
 */

import { ServiceManager } from '../core/ServiceManager.js';
import { walletStatePersistence } from './WalletStatePersistence.js';

class UIServiceIntegration {
    constructor() {
        this.serviceManager = new ServiceManager();
        this.isInitialized = false;
        this.initPromise = null;
        
        // Bind methods to preserve context
        this.connectWallet = this.connectWallet.bind(this);
        this.disconnectWallet = this.disconnectWallet.bind(this);
        this.buyPRANA = this.buyPRANA.bind(this);
        this.sellPRANA = this.sellPRANA.bind(this);
        this.stake = this.stake.bind(this);
        this.unstake = this.unstake.bind(this);
        this.claimRewards = this.claimRewards.bind(this);
        
        // Initialize services
        this.init();
    }

    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._initialize();
        return this.initPromise;
    }

    async _initialize() {
        try {
            console.log('🔄 Initializing UI Service Integration...');
            
            // Initialize service manager
            await this.serviceManager.initialize();
            
            // Check for persisted wallet state first
            const persistedState = walletStatePersistence.getWalletState();
            if (persistedState && persistedState.isConnected && persistedState.account) {
                console.log('🔄 Found persisted wallet state, attempting to restore connection...');
                try {
                    // Try to reconnect using the persisted provider
                    const reconnected = await this.serviceManager.tryAutoReconnect();
                    if (reconnected) {
                        console.log('✅ Auto-reconnected to wallet from persisted state');
                        
                        // Emit wallet connected event to update UI
                        this._emitEvent('walletConnected', {
                            account: persistedState.account,
                            chainId: persistedState.chainId,
                            provider: persistedState.provider
                        });
                    }
                } catch (error) {
                    console.warn('⚠️ Auto-reconnect from persisted state failed:', error.message);
                    // Clear invalid persisted state
                    walletStatePersistence.clearWalletState();
                }
            } else {
                // Fallback to regular auto-reconnect
                const reconnected = await this.serviceManager.tryAutoReconnect();
                if (reconnected) {
                    console.log('✅ Auto-reconnected to wallet');
                }
            }
            
            // Load contracts for current network
            try {
                await this.serviceManager.loadContracts();
                console.log('✅ Contracts loaded');
            } catch (error) {
                console.warn('⚠️ Contract loading failed:', error.message);
            }
            
            this.isInitialized = true;
            console.log('✅ UI Service Integration initialized');
            
            // Emit initialization event
            this._emitEvent('serviceInitialized', { success: true });
            
            // Setup cross-tab sync listener
            this.setupCrossTabSync();
            
        } catch (error) {
            console.error('❌ UI Service Integration failed:', error);
            this._emitEvent('serviceInitialized', { success: false, error: error.message });
            throw error;
        }
    }

    // Wallet Operations
    async connectWallet(providerName = 'metamask') {
        try {
            await this.init();
            
            const result = await this.serviceManager.connectWallet(providerName);
            
            // Save wallet state for persistence across pages
            walletStatePersistence.saveWalletState({
                isConnected: result.success,
                account: result.account,
                chainId: result.chainId,
                provider: providerName
            });
            
            this._emitEvent('walletConnected', {
                account: result.account,
                chainId: result.chainId,
                provider: providerName
            });
            
            return result;
        } catch (error) {
            this._emitEvent('walletError', { message: error.message });
            throw error;
        }
    }

    async disconnectWallet() {
        try {
            await this.serviceManager.disconnectWallet();
            
            // Clear wallet state persistence
            walletStatePersistence.clearWalletState();
            
            this._emitEvent('walletDisconnected', {});
        } catch (error) {
            this._emitEvent('walletError', { message: error.message });
            throw error;
        }
    }

    async switchNetwork(chainId) {
        try {
            await this.serviceManager.switchNetwork(chainId);
            this._emitEvent('networkChanged', { chainId });
        } catch (error) {
            this._emitEvent('walletError', { message: error.message });
            throw error;
        }
    }

    // Wallet State
    isWalletConnected() {
        return this.serviceManager.isWalletConnected();
    }

    getCurrentAccount() {
        return this.serviceManager.getCurrentAccount();
    }

    getWalletState() {
        return this.serviceManager.getState('wallet');
    }

    // Exchange Operations
    async getExchangeRate() {
        try {
            return await this.serviceManager.getExchangeRate();
        } catch (error) {
            console.error('Failed to get exchange rate:', error);
            return 0;
        }
    }

    async getBuyQuote(usdtAmount) {
        try {
            return await this.serviceManager.getBuyQuote(usdtAmount.toString());
        } catch (error) {
            this._emitEvent('exchangeError', { message: error.message });
            throw error;
        }
    }

    async getSellQuote(pranaAmount) {
        try {
            return await this.serviceManager.getSellQuote(pranaAmount.toString());
        } catch (error) {
            this._emitEvent('exchangeError', { message: error.message });
            throw error;
        }
    }

    async buyPRANA(usdtAmount, slippage = 0.5) {
        try {
            this._emitEvent('transactionStarted', { type: 'buy', amount: usdtAmount });
            
            const result = await this.serviceManager.buyPRANA(usdtAmount.toString());
            
            this._emitEvent('transactionCompleted', {
                type: 'buy',
                transactionHash: result.transactionHash,
                amount: usdtAmount
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'buy', message: error.message });
            throw error;
        }
    }

    async sellPRANA(pranaAmount, slippage = 0.5) {
        try {
            this._emitEvent('transactionStarted', { type: 'sell', amount: pranaAmount });
            
            const result = await this.serviceManager.sellPRANA(pranaAmount.toString());
            
            this._emitEvent('transactionCompleted', {
                type: 'sell',
                transactionHash: result.transactionHash,
                amount: pranaAmount
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'sell', message: error.message });
            throw error;
        }
    }

    async getExchangeReserves() {
        try {
            return await this.serviceManager.getExchangeReserves();
        } catch (error) {
            console.error('Failed to get reserves:', error);
            return {
                pranaReserve: '0',
                usdtReserve: '0',
                totalLiquidity: '0'
            };
        }
    }

    // Staking Operations
    async getStakingInfo() {
        try {
            return await this.serviceManager.getStakingInfo();
        } catch (error) {
            console.error('Failed to get staking info:', error);
            return {
                totalStaked: '0',
                apy: 0,
                rewardRate: '0'
            };
        }
    }

    async getUserStakingInfo(address = null) {
        try {
            const userAddress = address || this.getCurrentAccount();
            if (!userAddress) {
                // Return zeros instead of throwing for no wallet connection
                return {
                    stakedAmount: '0',
                    totalStaked: '0',
                    pendingRewards: '0',
                    totalRewards: '0',
                    stakingTime: 0,
                    stakes: [],
                    stakesCount: 0
                };
            }
            
            const result = await this.serviceManager.getUserStakingInfo(userAddress);
            
            // Ensure all numeric values are properly formatted
            return {
                stakedAmount: result.stakedAmount || '0',
                totalStaked: result.totalStaked || '0',
                pendingRewards: result.pendingRewards || '0',
                totalRewards: result.totalRewards || '0',
                stakingTime: result.stakingTime || 0,
                stakes: result.stakes || [],
                stakesCount: result.stakesCount || 0
            };
        } catch (error) {
            console.warn('Failed to get user staking info, returning zeros (this is normal for users with no stakes):', error.message);
            return {
                stakedAmount: '0',
                totalStaked: '0',
                pendingRewards: '0',
                totalRewards: '0',
                stakingTime: 0,
                stakes: [],
                stakesCount: 0
            };
        }
    }

    async stake(amount) {
        try {
            this._emitEvent('transactionStarted', { type: 'stake', amount });
            
            const result = await this.serviceManager.stake(amount.toString());
            
            this._emitEvent('transactionCompleted', {
                type: 'stake',
                transactionHash: result.transactionHash,
                amount
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'stake', message: error.message });
            throw error;
        }
    }

    async unstake(amount) {
        try {
            this._emitEvent('transactionStarted', { type: 'unstake', amount });
            
            const result = await this.serviceManager.unstake(amount.toString());
            
            this._emitEvent('transactionCompleted', {
                type: 'unstake',
                transactionHash: result.transactionHash,
                amount
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'unstake', message: error.message });
            throw error;
        }
    }

    async claimRewards() {
        try {
            this._emitEvent('transactionStarted', { type: 'claim' });
            
            const result = await this.serviceManager.claimRewards();
            
            this._emitEvent('transactionCompleted', {
                type: 'claim',
                transactionHash: result.transactionHash
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'claim', message: error.message });
            throw error;
        }
    }

    // Token Operations
    async getTokenBalance(tokenName, address = null) {
        const userAddress = address || this.getCurrentAccount();
        try {
            if (!userAddress) {
                return '0';
            }
            
            // Note: Mainnet contracts are now deployed and working
            // Previous aggressive fix to force zero balance on mainnet has been removed
            
            return await this.serviceManager.getTokenBalance(tokenName, userAddress);
        } catch (error) {
            console.error(`Failed to get ${tokenName} balance for ${userAddress}:`, error);
            // Return '0' only at the UI level after logging the specific error
            return '0';
        }
    }

    async approveToken(tokenName, spender, amount) {
        try {
            this._emitEvent('transactionStarted', { type: 'approve', token: tokenName });
            
            const result = await this.serviceManager.approveToken(tokenName, spender, amount);
            
            this._emitEvent('transactionCompleted', {
                type: 'approve',
                transactionHash: result.transactionHash,
                token: tokenName
            });
            
            return result;
        } catch (error) {
            this._emitEvent('transactionFailed', { type: 'approve', message: error.message });
            throw error;
        }
    }

    // Transaction Management
    getTransactionQueueStatus() {
        return this.serviceManager.getTransactionQueueStatus();
    }

    async getTransactionStatus(txHash) {
        try {
            return await this.serviceManager.getTransactionStatus(txHash);
        } catch (error) {
            console.error('Failed to get transaction status:', error);
            return { confirmed: false, status: false };
        }
    }

    // State Management
    subscribeToStateChanges(eventType, callback) {
        return this.serviceManager.subscribeToStateChanges(eventType, callback);
    }

    getState(stateKey) {
        return this.serviceManager.getState(stateKey);
    }

    // Utility Methods
    formatNumber(num, decimals = 2) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(decimals) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(decimals) + 'K';
        }
        return parseFloat(num).toFixed(decimals);
    }

    formatBalance(balance, decimals = 4) {
        const num = parseFloat(balance);
        if (isNaN(num)) return '0';
        
        if (num === 0) return '0';
        if (num < 0.0001) return '< 0.0001';
        if (num < 1) return num.toFixed(6);
        if (num < 1000) return num.toFixed(decimals);
        
        return this.formatNumber(num, decimals);
    }

    async estimateGas(operation, ...args) {
        try {
            switch (operation) {
                case 'buy':
                    return await this.serviceManager.estimateGas({
                        contractName: 'pranaExchange',
                        methodName: 'buyPRANA',
                        params: args,
                        options: {}
                    });
                case 'sell':
                    return await this.serviceManager.estimateGas({
                        contractName: 'pranaExchange',
                        methodName: 'sellPRANA',
                        params: args,
                        options: {}
                    });
                case 'stake':
                    return await this.serviceManager.estimateGas({
                        contractName: 'pranaStaking',
                        methodName: 'stake',
                        params: args,
                        options: {}
                    });
                default:
                    throw new Error(`Unknown operation: ${operation}`);
            }
        } catch (error) {
            console.error('Gas estimation failed:', error);
            return 200000; // Fallback gas estimate
        }
    }

    // Event System
    _emitEvent(eventName, data) {
        const event = new CustomEvent(`prana:${eventName}`, {
            detail: data,
            bubbles: true
        });
        
        document.dispatchEvent(event);
        
        // Also log for debugging
        console.log(`🔔 Event: prana:${eventName}`, data);
    }

    // Cross-tab synchronization
    setupCrossTabSync() {
        document.addEventListener('prana:walletStateSync', (event) => {
            const { type, state } = event.detail;
            
            if (type === 'connected' && state) {
                // Update local state and UI when wallet connects in another tab
                this._emitEvent('walletConnected', {
                    account: state.account,
                    chainId: state.chainId,
                    provider: state.provider
                });
            } else if (type === 'disconnected') {
                // Update local state and UI when wallet disconnects in another tab
                this._emitEvent('walletDisconnected', {});
            }
        });
    }

    // Enhanced wallet state methods
    isWalletConnected() {
        // Check both service manager and persisted state
        const serviceConnected = this.serviceManager.isWalletConnected();
        const persistedState = walletStatePersistence.getWalletState();
        
        return serviceConnected || (persistedState && persistedState.isConnected);
    }

    getCurrentAccount() {
        // Try service manager first, then fallback to persisted state
        const account = this.serviceManager.getCurrentAccount();
        if (account) return account;
        
        const persistedState = walletStatePersistence.getWalletState();
        return persistedState ? persistedState.account : null;
    }

    // Account/chain change handlers with state persistence
    async handleAccountChanged(account) {
        walletStatePersistence.updateAccount(account);
        this._emitEvent('accountChanged', { account });
    }

    async handleChainChanged(chainId) {
        walletStatePersistence.updateChainId(chainId);
        this._emitEvent('chainChanged', { chainId });
    }

    // Debug method to check wallet state
    getWalletStateSummary() {
        return {
            serviceManager: {
                connected: this.serviceManager.isWalletConnected(),
                account: this.serviceManager.getCurrentAccount()
            },
            persistence: walletStatePersistence.getConnectionSummary()
        };
    }

    // Cleanup
    destroy() {
        if (this.serviceManager) {
            this.serviceManager.destroy();
        }
        console.log('🧹 UI Service Integration destroyed');
    }
}

// Create global instance
const uiServices = new UIServiceIntegration();

// Export for ES6 modules
export { UIServiceIntegration, uiServices };

// Also make available globally for legacy scripts
if (typeof window !== 'undefined') {
    window.pranavaUIServices = uiServices;
    window.UIServiceIntegration = UIServiceIntegration;
}

// Backward compatibility aliases
if (typeof window !== 'undefined') {
    window.pranavaUnifiedWallet = {
        connectWallet: uiServices.connectWallet.bind(uiServices),
        disconnectWallet: uiServices.disconnectWallet.bind(uiServices),
        isConnected: uiServices.isWalletConnected.bind(uiServices),
        getCurrentAccount: uiServices.getCurrentAccount.bind(uiServices),
        switchNetwork: uiServices.switchNetwork.bind(uiServices)
    };
    
    window.pranavaExchange = {
        getBuyQuote: uiServices.getBuyQuote.bind(uiServices),
        getSellQuote: uiServices.getSellQuote.bind(uiServices),
        buyPRANA: uiServices.buyPRANA.bind(uiServices),
        sellPRANA: uiServices.sellPRANA.bind(uiServices),
        getExchangeRate: uiServices.getExchangeRate.bind(uiServices),
        getReserves: uiServices.getExchangeReserves.bind(uiServices)
    };
    
    window.pranavaStaking = {
        getStakingInfo: uiServices.getStakingInfo.bind(uiServices),
        getUserStakingInfo: uiServices.getUserStakingInfo.bind(uiServices),
        stake: uiServices.stake.bind(uiServices),
        unstake: uiServices.unstake.bind(uiServices),
        claimRewards: uiServices.claimRewards.bind(uiServices)
    };
}

export default uiServices;