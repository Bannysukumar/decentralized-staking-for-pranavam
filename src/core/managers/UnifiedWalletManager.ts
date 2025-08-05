/**
 * UnifiedWalletManager - Centralized wallet connection and management
 * Following Single Responsibility and Dependency Inversion Principles
 */

import { IWalletProvider, WalletConnectionResult } from '../interfaces/IWalletProvider';
import { stateManager } from '../state/ReactiveStateManager';
import { getNetworkConfig, isNetworkSupported, DEFAULT_NETWORK } from '../../config/networks.js';
import { logger, LOG_CONTEXTS } from '../../services/LoggingService.js';
import Web3 from 'web3';

export class UnifiedWalletManager {
    private providers: Map<string, IWalletProvider> = new Map();
    private currentProvider: IWalletProvider | null = null;
    private web3: Web3 | null = null;
    private connectionState = {
        isConnecting: false,
        lastConnectedProvider: null as string | null,
        autoReconnectEnabled: true,
        connectionTimestamp: null as number | null
    };

    constructor() {
        this.initializeProviders();
        this.setupEventListeners();
    }

    private initializeProviders(): void {
        // Initialize supported wallet providers
        this.providers.set('metamask', new MetaMaskProvider());
        this.providers.set('walletconnect', new WalletConnectProvider());
        this.providers.set('coinbase', new CoinbaseProvider());
        
        logger.info(LOG_CONTEXTS.WALLET, 'Wallet providers initialized', {
            providers: Array.from(this.providers.keys())
        });
    }

    private setupEventListeners(): void {
        // Listen for account/network changes from any provider
        if (typeof window !== 'undefined' && window.ethereum) {
            window.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
            window.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
            window.ethereum.on('disconnect', this.handleDisconnect.bind(this));
        }
    }

    async connectWallet(providerName: string): Promise<WalletConnectionResult> {
        if (this.connectionState.isConnecting) {
            throw new Error('Connection already in progress');
        }

        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }

        if (!provider.isAvailable) {
            throw new Error(`Provider ${providerName} is not available`);
        }

        this.connectionState.isConnecting = true;

        try {
            logger.info(LOG_CONTEXTS.WALLET, `Connecting to ${providerName}...`);
            
            const result = await provider.connect();
            
            // Validate network
            if (!isNetworkSupported(result.chainId)) {
                const defaultNetwork = getNetworkConfig(DEFAULT_NETWORK);
                await provider.switchNetwork(defaultNetwork.chainId);
                result.chainId = defaultNetwork.chainId;
            }

            // Initialize Web3
            this.web3 = result.web3;
            this.currentProvider = provider;
            
            // Update state manager
            stateManager.setWeb3Instance(this.web3);
            stateManager.updateState('wallet', {
                connected: true,
                account: result.account,
                chainId: result.chainId,
                networkName: getNetworkConfig(result.chainId).name,
                provider: providerName
            });

            // Update connection state
            this.connectionState.lastConnectedProvider = providerName;
            this.connectionState.connectionTimestamp = Date.now();
            
            // Store in localStorage for auto-reconnect
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('pranavam_last_wallet', providerName);
            }

            logger.info(LOG_CONTEXTS.WALLET, `Connected to ${providerName}`, {
                account: result.account,
                chainId: result.chainId
            });

            // Trigger immediate state sync and contract loading
            await this.onWalletConnected(result);

            return result;

        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                provider: providerName,
                context: 'connectWallet'
            });
            throw error;
        } finally {
            this.connectionState.isConnecting = false;
        }
    }

    async disconnectWallet(): Promise<void> {
        if (this.currentProvider) {
            try {
                await this.currentProvider.disconnect();
                
                // Update state
                stateManager.updateState('wallet', {
                    connected: false,
                    account: null,
                    chainId: null,
                    balance: '0',
                    networkName: null,
                    provider: null
                });

                // Clear contract state
                stateManager.updateState('contracts', {
                    loaded: false,
                    instances: new Map(),
                    addresses: new Map()
                });

                // Clear localStorage
                if (typeof localStorage !== 'undefined') {
                    localStorage.removeItem('pranavam_last_wallet');
                }

                this.currentProvider = null;
                this.web3 = null;
                this.connectionState.connectionTimestamp = null;

                logger.info(LOG_CONTEXTS.WALLET, 'Wallet disconnected');

            } catch (error) {
                logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'disconnectWallet' });
            }
        }
    }

    async switchNetwork(chainId: number): Promise<void> {
        if (!this.currentProvider) {
            throw new Error('No wallet connected');
        }

        if (!isNetworkSupported(chainId)) {
            throw new Error(`Network ${chainId} is not supported`);
        }

        try {
            await this.currentProvider.switchNetwork(chainId);
            
            // Update state
            stateManager.updateState('wallet', {
                chainId,
                networkName: getNetworkConfig(chainId).name
            });

            // Reload contracts for new network
            await this.loadContractsForNetwork(chainId);

            logger.info(LOG_CONTEXTS.WALLET, `Switched to network ${chainId}`);

        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                chainId,
                context: 'switchNetwork'
            });
            throw error;
        }
    }

    async tryAutoReconnect(): Promise<boolean> {
        if (!this.connectionState.autoReconnectEnabled) {
            return false;
        }

        const lastProvider = typeof localStorage !== 'undefined' 
            ? localStorage.getItem('pranavam_last_wallet') 
            : null;

        if (!lastProvider) {
            return false;
        }

        try {
            await this.connectWallet(lastProvider);
            logger.info(LOG_CONTEXTS.WALLET, `Auto-reconnected to ${lastProvider}`);
            return true;
        } catch (error) {
            logger.warn(LOG_CONTEXTS.WALLET, `Auto-reconnect failed for ${lastProvider}`, error.message);
            return false;
        }
    }

    private async onWalletConnected(result: WalletConnectionResult): Promise<void> {
        try {
            // Load contracts for current network
            await this.loadContractsForNetwork(result.chainId);
            
            // Start initial state sync
            await stateManager.syncState();
            
            // Setup periodic state sync (every 30 seconds)
            this.setupPeriodicSync();
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'onWalletConnected' });
        }
    }

    private async loadContractsForNetwork(chainId: number): Promise<void> {
        try {
            const contractManager = await import('../managers/ContractManager');
            await contractManager.default.loadAllContracts(chainId);
            
            logger.info(LOG_CONTEXTS.WALLET, `Contracts loaded for network ${chainId}`);
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                chainId,
                context: 'loadContractsForNetwork'
            });
        }
    }

    private setupPeriodicSync(): void {
        // Clear any existing interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        // Setup new interval for state synchronization
        this.syncInterval = setInterval(async () => {
            if (stateManager.isWalletConnected()) {
                await stateManager.syncState();
            }
        }, 30000); // 30 seconds
    }

    private syncInterval: NodeJS.Timeout | null = null;

    // Event handlers
    private async handleAccountsChanged(accounts: string[]): Promise<void> {
        logger.info(LOG_CONTEXTS.WALLET, 'Accounts changed', { accounts });

        if (accounts.length === 0) {
            await this.disconnectWallet();
        } else {
            const newAccount = accounts[0];
            stateManager.updateState('wallet', { account: newAccount });
            await stateManager.syncState();
        }
    }

    private async handleChainChanged(chainId: string): Promise<void> {
        const numericChainId = parseInt(chainId, 16);
        logger.info(LOG_CONTEXTS.WALLET, 'Chain changed', { chainId: numericChainId });

        if (isNetworkSupported(numericChainId)) {
            stateManager.updateState('wallet', {
                chainId: numericChainId,
                networkName: getNetworkConfig(numericChainId).name
            });
            
            await this.loadContractsForNetwork(numericChainId);
            await stateManager.syncState();
        } else {
            logger.warn(LOG_CONTEXTS.WALLET, `Unsupported network: ${numericChainId}`);
            // Optionally switch to default network
            await this.switchNetwork(DEFAULT_NETWORK);
        }
    }

    private async handleDisconnect(): Promise<void> {
        logger.info(LOG_CONTEXTS.WALLET, 'Wallet disconnected by user');
        await this.disconnectWallet();
    }

    // Getters
    get isConnected(): boolean {
        return stateManager.isWalletConnected();
    }

    get currentAccount(): string | null {
        return stateManager.getCurrentAccount();
    }

    get web3Instance(): Web3 | null {
        return this.web3;
    }

    get availableProviders(): string[] {
        return Array.from(this.providers.keys()).filter(name => 
            this.providers.get(name)!.isAvailable
        );
    }

    // Cleanup
    destroy(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.providers.clear();
        this.currentProvider = null;
        this.web3 = null;
        
        logger.info(LOG_CONTEXTS.WALLET, 'UnifiedWalletManager destroyed');
    }
}

// Wallet Provider Implementations
class MetaMaskProvider implements IWalletProvider {
    readonly name = 'MetaMask';

    get isAvailable(): boolean {
        return typeof window !== 'undefined' && 
               window.ethereum && 
               window.ethereum.isMetaMask;
    }

    async connect(): Promise<WalletConnectionResult> {
        if (!this.isAvailable) {
            throw new Error('MetaMask not available');
        }

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        const chainId = parseInt(await window.ethereum.request({
            method: 'eth_chainId'
        }), 16);

        const web3 = new Web3(window.ethereum);

        return {
            account: accounts[0],
            chainId,
            provider: window.ethereum,
            web3
        };
    }

    async disconnect(): Promise<void> {
        // MetaMask doesn't have programmatic disconnect
        // User needs to disconnect from the extension
    }

    async switchNetwork(chainId: number): Promise<void> {
        const chainIdHex = `0x${chainId.toString(16)}`;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }]
            });
        } catch (error: any) {
            if (error.code === 4902) {
                // Network not added, add it
                const networkConfig = getNetworkConfig(chainId);
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [networkConfig.addNetworkParams]
                });
            } else {
                throw error;
            }
        }
    }

    async getAccounts(): Promise<string[]> {
        return await window.ethereum.request({ method: 'eth_accounts' });
    }

    isConnected(): boolean {
        return this.isAvailable && window.ethereum.selectedAddress !== null;
    }
}

class WalletConnectProvider implements IWalletProvider {
    readonly name = 'WalletConnect';
    private provider: any = null;

    get isAvailable(): boolean {
        return typeof window !== 'undefined';
    }

    async connect(): Promise<WalletConnectionResult> {
        // Implementation would use WalletConnect v2
        throw new Error('WalletConnect implementation pending');
    }

    async disconnect(): Promise<void> {
        if (this.provider) {
            await this.provider.disconnect();
        }
    }

    async switchNetwork(chainId: number): Promise<void> {
        throw new Error('WalletConnect network switching not implemented');
    }

    async getAccounts(): Promise<string[]> {
        return this.provider ? this.provider.accounts : [];
    }

    isConnected(): boolean {
        return this.provider && this.provider.connected;
    }
}

class CoinbaseProvider implements IWalletProvider {
    readonly name = 'Coinbase Wallet';

    get isAvailable(): boolean {
        return typeof window !== 'undefined' && 
               window.ethereum && 
               window.ethereum.isCoinbaseWallet;
    }

    async connect(): Promise<WalletConnectionResult> {
        // Similar to MetaMask implementation
        throw new Error('Coinbase Wallet implementation pending');
    }

    async disconnect(): Promise<void> {
        // Coinbase wallet disconnect logic
    }

    async switchNetwork(chainId: number): Promise<void> {
        // Coinbase wallet network switching logic
    }

    async getAccounts(): Promise<string[]> {
        return [];
    }

    isConnected(): boolean {
        return false;
    }
}

// Export singleton instance
export const walletManager = new UnifiedWalletManager();