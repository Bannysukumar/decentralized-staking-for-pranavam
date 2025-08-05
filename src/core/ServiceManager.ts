/**
 * ServiceManager - Unified initialization and lifecycle management
 * Following Facade Pattern and Dependency Injection
 */

import { walletManager } from './managers/UnifiedWalletManager';
import contractManager from './managers/ContractManager';
import { transactionManager } from './managers/TransactionManager';
import { stateManager } from './state/ReactiveStateManager';
import { blockchainSyncService } from './sync/BlockchainSyncService';
import { optimizedExchangeService } from '../services/OptimizedExchangeService';
import { optimizedStakingService } from '../services/OptimizedStakingService';
import { logger, LOG_CONTEXTS } from '../services/LoggingService.js';

export interface ServiceManagerConfig {
    autoReconnect: boolean;
    syncEnabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableDevMode: boolean;
}

export interface ServiceStatus {
    wallet: {
        connected: boolean;
        account: string | null;
        chainId: number | null;
    };
    contracts: {
        loaded: boolean;
        count: number;
    };
    sync: {
        running: boolean;
        currentBlock: number;
    };
    transactions: {
        pending: number;
        executing: number;
    };
}

export class ServiceManager {
    private isInitialized = false;
    private config: ServiceManagerConfig = {
        autoReconnect: true,
        syncEnabled: true,
        logLevel: 'info',
        enableDevMode: false
    };

    private initializationPromise: Promise<void> | null = null;

    constructor(config?: Partial<ServiceManagerConfig>) {
        if (config) {
            this.config = { ...this.config, ...config };
        }
    }

    /**
     * Initialize all services in correct order
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            logger.warn(LOG_CONTEXTS.SERVICE, 'ServiceManager already initialized');
            return;
        }

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.performInitialization();
        return this.initializationPromise;
    }

    private async performInitialization(): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.SERVICE, 'Initializing ServiceManager', this.config);

            // Step 1: Initialize core state manager
            logger.info(LOG_CONTEXTS.SERVICE, 'Step 1: Initializing state manager');
            // State manager is already initialized via singleton

            // Step 2: Initialize wallet manager
            logger.info(LOG_CONTEXTS.SERVICE, 'Step 2: Initializing wallet manager');
            // Wallet manager handles its own initialization

            // Step 3: Set up cross-service communication
            logger.info(LOG_CONTEXTS.SERVICE, 'Step 3: Setting up service communication');
            this.setupServiceCommunication();

            // Step 4: Auto-reconnect if enabled
            if (this.config.autoReconnect) {
                logger.info(LOG_CONTEXTS.SERVICE, 'Step 4: Attempting auto-reconnect');
                try {
                    await walletManager.tryAutoReconnect();
                } catch (error) {
                    logger.warn(LOG_CONTEXTS.SERVICE, 'Auto-reconnect failed', error.message);
                }
            }

            // Step 5: Initialize blockchain sync if enabled
            if (this.config.syncEnabled) {
                logger.info(LOG_CONTEXTS.SERVICE, 'Step 5: Blockchain sync will start on wallet connection');
                // Sync starts automatically when wallet connects
            }

            this.isInitialized = true;
            logger.info(LOG_CONTEXTS.SERVICE, 'ServiceManager initialization completed');

        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'initialization' });
            this.initializationPromise = null;
            throw error;
        }
    }

    private setupServiceCommunication(): void {
        // Listen for wallet connection to initialize other services
        stateManager.subscribe('wallet', async (update) => {
            const walletState = update.data;
            
            if (walletState.connected) {
                logger.info(LOG_CONTEXTS.SERVICE, 'Wallet connected, initializing dependent services');
                
                // Services are initialized automatically through their own listeners
                // Contract loading happens via UnifiedWalletManager
                // Sync starts automatically via BlockchainSyncService
                
            } else {
                logger.info(LOG_CONTEXTS.SERVICE, 'Wallet disconnected, cleaning up services');
                // Services clean up automatically through their own listeners
            }
        });

        // Monitor transaction queue
        stateManager.subscribe('transactions', (update) => {
            const txState = update.data;
            if (txState.pending && txState.pending.size > 10) {
                logger.warn(LOG_CONTEXTS.SERVICE, 'High transaction queue detected', {
                    pendingCount: txState.pending.size
                });
            }
        });

        // Monitor sync status
        stateManager.subscribe('*', (update) => {
            if (this.config.enableDevMode) {
                logger.debug(LOG_CONTEXTS.SERVICE, 'State update', {
                    type: update.type,
                    timestamp: update.timestamp
                });
            }
        });
    }

    /**
     * Connect wallet with specified provider
     */
    async connectWallet(providerName: string): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            logger.info(LOG_CONTEXTS.SERVICE, `Connecting wallet: ${providerName}`);
            await walletManager.connectWallet(providerName);
            logger.info(LOG_CONTEXTS.SERVICE, `Wallet connected successfully: ${providerName}`);
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { 
                providerName,
                context: 'connectWallet'
            });
            throw error;
        }
    }

    /**
     * Disconnect wallet and clean up
     */
    async disconnectWallet(): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.SERVICE, 'Disconnecting wallet');
            await walletManager.disconnectWallet();
            logger.info(LOG_CONTEXTS.SERVICE, 'Wallet disconnected successfully');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'disconnectWallet' });
            throw error;
        }
    }

    /**
     * Switch to different network
     */
    async switchNetwork(chainId: number): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.SERVICE, `Switching to network: ${chainId}`);
            await walletManager.switchNetwork(chainId);
            logger.info(LOG_CONTEXTS.SERVICE, `Network switched successfully: ${chainId}`);
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { 
                chainId,
                context: 'switchNetwork'
            });
            throw error;
        }
    }

    /**
     * Force sync all services state
     */
    async syncState(): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.SERVICE, 'Force syncing state');
            
            if (blockchainSyncService.getStatus().isRunning) {
                await blockchainSyncService.forceSyncState();
            } else {
                await stateManager.syncState();
            }
            
            logger.info(LOG_CONTEXTS.SERVICE, 'State sync completed');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'syncState' });
            throw error;
        }
    }

    /**
     * Get comprehensive service status
     */
    getStatus(): ServiceStatus {
        const walletState = stateManager.getState('wallet');
        const contractsState = stateManager.getState('contracts');
        const syncStatus = blockchainSyncService.getStatus();
        const txStatus = transactionManager.getQueueStatus();

        return {
            wallet: {
                connected: walletState.connected,
                account: walletState.account,
                chainId: walletState.chainId
            },
            contracts: {
                loaded: contractsState.loaded,
                count: contractsState.instances.size || 0
            },
            sync: {
                running: syncStatus.isRunning,
                currentBlock: syncStatus.currentBlock
            },
            transactions: {
                pending: txStatus.pending,
                executing: txStatus.executing
            }
        };
    }

    /**
     * Get available wallet providers
     */
    getAvailableWallets(): string[] {
        return walletManager.availableProviders;
    }

    /**
     * Check if specific service is ready
     */
    isServiceReady(serviceName: 'wallet' | 'contracts' | 'sync' | 'exchange' | 'staking'): boolean {
        const status = this.getStatus();
        
        switch (serviceName) {
            case 'wallet':
                return status.wallet.connected;
            case 'contracts':
                return status.contracts.loaded;
            case 'sync':
                return status.sync.running;
            case 'exchange':
                return status.wallet.connected && status.contracts.loaded;
            case 'staking':
                return status.wallet.connected && status.contracts.loaded;
            default:
                return false;
        }
    }

    /**
     * Update service configuration
     */
    updateConfig(newConfig: Partial<ServiceManagerConfig>): void {
        const oldConfig = { ...this.config };
        this.config = { ...this.config, ...newConfig };
        
        logger.info(LOG_CONTEXTS.SERVICE, 'Configuration updated', {
            old: oldConfig,
            new: this.config
        });

        // Apply configuration changes
        if (newConfig.syncEnabled !== undefined) {
            if (newConfig.syncEnabled && !blockchainSyncService.getStatus().isRunning) {
                if (stateManager.isWalletConnected()) {
                    blockchainSyncService.startSync();
                }
            } else if (!newConfig.syncEnabled && blockchainSyncService.getStatus().isRunning) {
                blockchainSyncService.stopSync();
            }
        }
    }

    /**
     * Get service instances for advanced usage
     */
    getServices() {
        return {
            wallet: walletManager,
            contract: contractManager,
            transaction: transactionManager,
            state: stateManager,
            sync: blockchainSyncService,
            exchange: optimizedExchangeService,
            staking: optimizedStakingService
        };
    }

    /**
     * Emergency reset - disconnect and clean up everything
     */
    async emergencyReset(): Promise<void> {
        try {
            logger.warn(LOG_CONTEXTS.SERVICE, 'Performing emergency reset');

            // Stop sync service
            await blockchainSyncService.stopSync();

            // Disconnect wallet
            await walletManager.disconnectWallet();

            // Clear transaction queue
            const txStatus = transactionManager.getQueueStatus();
            logger.info(LOG_CONTEXTS.SERVICE, `Clearing ${txStatus.total} pending transactions`);

            // Reset initialization flag
            this.isInitialized = false;
            this.initializationPromise = null;

            logger.info(LOG_CONTEXTS.SERVICE, 'Emergency reset completed');
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'emergencyReset' });
            throw error;
        }
    }

    /**
     * Cleanup and destroy all services
     */
    async destroy(): Promise<void> {
        try {
            logger.info(LOG_CONTEXTS.SERVICE, 'Destroying ServiceManager');

            // Stop all services
            await blockchainSyncService.stopSync();
            await walletManager.disconnectWallet();
            
            // Destroy service instances
            walletManager.destroy();
            contractManager.destroy();
            transactionManager.destroy();
            stateManager.destroy();
            blockchainSyncService.destroy();
            optimizedExchangeService.destroy();
            optimizedStakingService.destroy();

            this.isInitialized = false;
            this.initializationPromise = null;

            logger.info(LOG_CONTEXTS.SERVICE, 'ServiceManager destroyed');
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'destroy' });
            throw error;
        }
    }
}

// Export singleton instance with default configuration
export const serviceManager = new ServiceManager({
    autoReconnect: true,
    syncEnabled: true,
    logLevel: 'info',
    enableDevMode: process.env.NODE_ENV === 'development'
});

// Additional helper functions for common operations
export const connectWallet = (providerName: string) => serviceManager.connectWallet(providerName);
export const disconnectWallet = () => serviceManager.disconnectWallet();
export const getServiceStatus = () => serviceManager.getStatus();
export const isWalletConnected = () => serviceManager.isServiceReady('wallet');
export const areContractsLoaded = () => serviceManager.isServiceReady('contracts');

// Auto-initialize on import in browser environment
if (typeof window !== 'undefined') {
    serviceManager.initialize().catch(error => {
        logger.logError(LOG_CONTEXTS.SERVICE, error, { context: 'autoInitialization' });
    });
}