/**
 * Enhanced Wallet Service
 * Multi-wallet support with MetaMask, WalletConnect, Coinbase Wallet
 * Following open-source DApp architecture patterns
 * Integrates with Web3Modal for standardized wallet connections
 */

import { getNetworkConfig, isNetworkSupported, getRpcUrls, DEFAULT_NETWORK } from '../config/networks.js';
import { logger, LOG_CONTEXTS } from './LoggingService.js';
import { contractService } from './ContractService.js';
import { web3ModalService } from './Web3ModalService.js';

class WalletService {
    constructor() {
        this.web3 = null;
        this.provider = null;
        this.account = null;
        this.chainId = null;
        this.networkConfig = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionType = null;
        
        // Supported wallet types
        this.walletTypes = {
            METAMASK: 'metamask',
            WALLETCONNECT: 'walletconnect',
            COINBASE: 'coinbase',
            TRUST: 'trust',
            BINANCE: 'binance',
            WEB3MODAL: 'web3modal' // Standardized multi-wallet connection
        };
        
        // Mobile wallet detection patterns
        this.mobileWalletPatterns = {
            'MetaMask Mobile': /MetaMaskMobile/i,
            'Trust Wallet': /TrustWallet/i,
            'SafePal': /SafePal/i,
            'Coinbase Wallet': /CoinbaseWallet/i,
            'Rainbow': /Rainbow/i,
            'TokenPocket': /TokenPocket/i,
            'imToken': /imToken/i,
            'Binance Chain Wallet': /BinanceChain/i
        };
        
        // Enhanced event listeners
        this.listeners = {
            accountsChanged: [],
            chainChanged: [],
            connect: [],
            disconnect: [],
            error: [],
            transactionStarted: [],
            transactionCompleted: [],
            transactionFailed: []
        };
        
        // Connection state management
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3;
        this.retryDelay = 1000;
        this.connectionState = {
            lastConnectedWallet: null,
            autoReconnectEnabled: true,
            connectionTimestamp: null
        };
        
        this.initialize();
    }

    /**
     * Initialize wallet service
     */
    async initialize() {
        try {
            logger.info(LOG_CONTEXTS.WALLET, 'Initializing wallet service');
            
            // Initialize Web3
            await this._initializeWeb3();
            
            // Set up event listeners
            this._setupEventListeners();
            
            // Try to reconnect if previously connected
            await this._tryAutoReconnect();
            
            logger.info(LOG_CONTEXTS.WALLET, 'Wallet service initialized');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'initialization' });
        }
    }

    /**
     * Initialize Web3 with fallback options
     * @private
     */
    async _initializeWeb3() {
        if (typeof window !== 'undefined' && window.Web3) {
            // Web3 is available globally
            const Web3 = window.Web3;
            
            // Start with default network
            const rpcUrls = getRpcUrls(DEFAULT_NETWORK.chainId);
            this.web3 = new Web3(rpcUrls[0]);
            
            logger.debug(LOG_CONTEXTS.WALLET, 'Web3 initialized with default provider', { 
                rpc: rpcUrls[0],
                chainId: DEFAULT_NETWORK.chainId 
            });
        } else {
            throw new Error('Web3 not available');
        }
    }

    /**
     * Set up wallet event listeners
     * @private
     */
    _setupEventListeners() {
        if (typeof window !== 'undefined' && window.ethereum) {
            // MetaMask events
            window.ethereum.on('accountsChanged', (accounts) => {
                logger.info(LOG_CONTEXTS.WALLET, 'Accounts changed', { accounts });
                this._handleAccountsChanged(accounts);
            });

            window.ethereum.on('chainChanged', (chainId) => {
                const numericChainId = parseInt(chainId, 16);
                logger.info(LOG_CONTEXTS.WALLET, 'Chain changed', { chainId: numericChainId });
                this._handleChainChanged(numericChainId);
            });

            window.ethereum.on('connect', (connectInfo) => {
                logger.info(LOG_CONTEXTS.WALLET, 'Wallet connected', connectInfo);
                this._emitEvent('connect', connectInfo);
            });

            window.ethereum.on('disconnect', (error) => {
                logger.warn(LOG_CONTEXTS.WALLET, 'Wallet disconnected', error);
                this._handleDisconnect(error);
            });
        }
    }

    /**
     * Try to reconnect if previously connected
     * @private
     */
    async _tryAutoReconnect() {
        try {
            const wasConnected = localStorage.getItem('wallet_connected');
            const lastConnectionType = localStorage.getItem('wallet_connection_type');
            
            if (wasConnected === 'true' && lastConnectionType) {
                logger.info(LOG_CONTEXTS.WALLET, 'Attempting auto-reconnect', { type: lastConnectionType });
                await this.connect(lastConnectionType);
            }
        } catch (error) {
            logger.warn(LOG_CONTEXTS.WALLET, 'Auto-reconnect failed', error.message);
        }
    }

    /**
     * Connect to wallet with enhanced multi-wallet support
     * @param {string} type - Connection type ('web3modal' for standardized connection)
     * @returns {Promise<Object>} Connection result
     */
    async connect(type = this.walletTypes.METAMASK) {
        if (this.isConnecting) {
            throw new Error('Connection already in progress');
        }
        
        this.isConnecting = true;
        
        try {
            this.connectionAttempts++;
            logger.info(LOG_CONTEXTS.WALLET, `Connecting to ${type}`, { 
                attempt: this.connectionAttempts,
                isMobile: this._isMobile(),
                detectedWallet: this._detectMobileWallet()
            });

            let provider = null;
            let connectionDetails = {};
            
            // Use Web3Modal for standardized connection (following open-source patterns)
            if (type === 'web3modal') {
                const result = await web3ModalService.connect();
                if (result.success) {
                    const connectionInfo = web3ModalService.getConnectionInfo();
                    this.provider = connectionInfo.provider;
                    this.web3 = connectionInfo.web3;
                    this.account = connectionInfo.account;
                    this.chainId = connectionInfo.chainId;
                    this.networkConfig = connectionInfo.networkConfig;
                    this.connectionType = 'web3modal';
                    this.isConnected = true;
                    
                    return {
                        success: true,
                        account: this.account,
                        chainId: this.chainId,
                        networkConfig: this.networkConfig,
                        connectionType: this.connectionType
                    };
                } else {
                    throw new Error(result.error);
                }
            }
            
            // Legacy connection methods (preserved for compatibility)
            switch (type) {
                case this.walletTypes.METAMASK:
                    provider = await this._connectMetaMask();
                    break;
                case this.walletTypes.WALLETCONNECT:
                    const wcResult = await this._connectWalletConnect();
                    provider = wcResult.provider;
                    connectionDetails = wcResult.details;
                    break;
                case this.walletTypes.COINBASE:
                    provider = await this._connectCoinbase();
                    break;
                case this.walletTypes.TRUST:
                    provider = await this._connectTrustWallet();
                    break;
                case this.walletTypes.BINANCE:
                    provider = await this._connectBinanceWallet();
                    break;
                default:
                    throw new Error(`Unsupported wallet type: ${type}`);
            }

            if (provider) {
                this.provider = provider;
                this.web3 = new window.Web3(provider);
                this.connectionType = type;
                
                // Get account and network info
                await this._updateAccountInfo();
                await this._updateNetworkInfo();
                
                // Initialize contracts
                if (contractService) {
                    await contractService.initialize(this.web3, this.chainId);
                }
                
                this.isConnected = true;
                this.connectionAttempts = 0;
                this.connectionState.lastConnectedWallet = type;
                this.connectionState.connectionTimestamp = Date.now();
                
                // Save connection state
                this._saveConnectionState();
                
                // Setup provider event listeners
                this._setupProviderListeners();
                
                logger.info(LOG_CONTEXTS.WALLET, 'Wallet connected successfully', {
                    account: this.account,
                    chainId: this.chainId,
                    type: this.connectionType,
                    isMobile: this._isMobile()
                });
                
                const result = {
                    success: true,
                    account: this.account,
                    chainId: this.chainId,
                    type: this.connectionType,
                    networkConfig: this.networkConfig,
                    requiresWalletApp: this._requiresWalletApp(type),
                    ...connectionDetails
                };
                
                this._emitEvent('connect', result);
                
                return result;
            }
            
            throw new Error('Failed to obtain provider');
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                type, 
                attempt: this.connectionAttempts,
                isMobile: this._isMobile()
            });
            
            this._emitEvent('error', { 
                type: 'connection_failed', 
                error: error.message,
                walletType: type
            });
            
            if (this.connectionAttempts >= this.maxConnectionAttempts) {
                throw new Error(`Failed to connect after ${this.maxConnectionAttempts} attempts: ${error.message}`);
            }
            
            // Retry with delay
            await this._delay(this.retryDelay * this.connectionAttempts);
            return await this.connect(type);
            
        } finally {
            this.isConnecting = false;
        }
    }
    
    /**
     * Detect available wallets
     * @returns {Array} Available wallet types
     */
    detectAvailableWallets() {
        const available = [];
        
        // Check MetaMask
        if (window.ethereum?.isMetaMask) {
            available.push({
                type: this.walletTypes.METAMASK,
                name: 'MetaMask',
                icon: '🦊',
                installed: true
            });
        }
        
        // Check Coinbase Wallet
        if (window.ethereum?.isCoinbaseWallet) {
            available.push({
                type: this.walletTypes.COINBASE,
                name: 'Coinbase Wallet',
                icon: '🔵',
                installed: true
            });
        }
        
        // Check Trust Wallet
        if (window.ethereum?.isTrust) {
            available.push({
                type: this.walletTypes.TRUST,
                name: 'Trust Wallet',
                icon: '🛡️',
                installed: true
            });
        }
        
        // Check Binance Chain Wallet
        if (window.BinanceChain) {
            available.push({
                type: this.walletTypes.BINANCE,
                name: 'Binance Chain Wallet',
                icon: '🟡',
                installed: true
            });
        }
        
        // WalletConnect is always available
        available.push({
            type: this.walletTypes.WALLETCONNECT,
            name: 'WalletConnect',
            icon: '🔗',
            installed: true,
            description: 'Connect with mobile wallet'
        });
        
        // Add suggestions for mobile users
        if (this._isMobile()) {
            const detectedWallet = this._detectMobileWallet();
            if (detectedWallet && !available.find(w => w.name === detectedWallet)) {
                available.unshift({
                    type: this.walletTypes.METAMASK, // Default to MetaMask connection
                    name: detectedWallet,
                    icon: '📱',
                    installed: true,
                    isMobile: true
                });
            }
        }
        
        return available;
    }

    /**
     * Connect to MetaMask
     * @private
     * @returns {Promise<Object>} Provider object
     */
    async _connectMetaMask() {
        if (typeof window === 'undefined') {
            throw new Error('Browser environment not detected');
        }
        
        if (!window.ethereum) {
            throw new Error('MetaMask not detected. Please install MetaMask extension from https://metamask.io');
        }

        // Check if MetaMask is locked
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length === 0) {
                logger.info(LOG_CONTEXTS.WALLET, 'MetaMask locked, requesting account access');
            }
        } catch (error) {
            logger.warn(LOG_CONTEXTS.WALLET, 'Could not check existing accounts', error.message);
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts available. Please unlock MetaMask and try again.');
            }
            
            logger.info(LOG_CONTEXTS.WALLET, 'MetaMask connected successfully', { 
                accountCount: accounts.length,
                primaryAccount: accounts[0] 
            });
            
            return window.ethereum;
        } catch (error) {
            if (error.code === 4001) {
                throw new Error('User rejected wallet connection');
            }
            if (error.code === -32002) {
                throw new Error('MetaMask is already processing a connection request. Please check MetaMask.');
            }
            if (error.message.includes('User rejected')) {
                throw new Error('Connection request was rejected');
            }
            
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'metamaskConnection' });
            throw new Error(`MetaMask connection failed: ${error.message}`);
        }
    }

    /**
     * Connect to WalletConnect
     * @private
     * @returns {Promise<Object>} Provider and connection details
     */
    async _connectWalletConnect() {
        try {
            // Dynamic import for WalletConnect
            const WalletConnectProvider = await import('@walletconnect/web3-provider').then(m => m.default);
            
            const provider = new WalletConnectProvider({
                infuraId: 'YOUR_INFURA_ID', // No environment variables in browser
                rpc: {
                    1: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
                    56: 'https://bsc-dataseed1.binance.org/',
                    97: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
                    137: 'https://polygon-rpc.com/'
                },
                chainId: 97, // Default to BSC Testnet
                qrcodeModalOptions: {
                    mobileLinks: [
                        'rainbow',
                        'metamask',
                        'argent',
                        'trust',
                        'imtoken',
                        'pillar'
                    ]
                }
            });
            
            await provider.enable();
            
            return {
                provider,
                details: {
                    isWalletConnect: true,
                    requiresQRCode: !this._isMobile()
                }
            };
        } catch (error) {
            if (error.message.includes('User closed modal')) {
                throw new Error('Connection cancelled by user');
            }
            throw new Error(`WalletConnect connection failed: ${error.message}`);
        }
    }
    
    /**
     * Connect to Coinbase Wallet
     * @private
     * @returns {Promise<Object>} Provider object
     */
    async _connectCoinbase() {
        try {
            // Dynamic import for Coinbase Wallet SDK
            const CoinbaseWalletSDK = await import('@coinbase/wallet-sdk').then(m => m.default);
            
            const coinbaseWallet = new CoinbaseWalletSDK({
                appName: 'Pranavam DeFi Platform',
                appLogoUrl: '/assets/images/logo.jpeg',
                darkMode: false
            });
            
            const provider = coinbaseWallet.makeWeb3Provider();
            await provider.request({ method: 'eth_requestAccounts' });
            
            return provider;
        } catch (error) {
            throw new Error(`Coinbase Wallet connection failed: ${error.message}`);
        }
    }
    
    /**
     * Connect to Trust Wallet
     * @private
     * @returns {Promise<Object>} Provider object
     */
    async _connectTrustWallet() {
        if (!window.ethereum?.isTrust) {
            throw new Error('Trust Wallet not detected. Please install Trust Wallet or use WalletConnect.');
        }
        
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            return window.ethereum;
        } catch (error) {
            throw new Error(`Trust Wallet connection failed: ${error.message}`);
        }
    }
    
    /**
     * Connect to Binance Chain Wallet
     * @private
     * @returns {Promise<Object>} Provider object
     */
    async _connectBinanceWallet() {
        if (!window.BinanceChain) {
            throw new Error('Binance Chain Wallet not detected. Please install Binance Chain Wallet.');
        }
        
        try {
            await window.BinanceChain.request({ method: 'eth_requestAccounts' });
            return window.BinanceChain;
        } catch (error) {
            throw new Error(`Binance Chain Wallet connection failed: ${error.message}`);
        }
    }
    
    /**
     * Check if mobile device
     * @private
     * @returns {boolean} Is mobile device
     */
    _isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    }
    
    /**
     * Detect mobile wallet from user agent
     * @private
     * @returns {string|null} Detected wallet name
     */
    _detectMobileWallet() {
        const userAgent = navigator.userAgent;
        
        for (const [walletName, pattern] of Object.entries(this.mobileWalletPatterns)) {
            if (pattern.test(userAgent)) {
                return walletName;
            }
        }
        
        return null;
    }
    
    /**
     * Check if wallet type requires mobile app
     * @private
     * @returns {boolean} Requires wallet app
     */
    _requiresWalletApp(walletType) {
        return this._isMobile() && walletType === this.walletTypes.WALLETCONNECT;
    }
    
    /**
     * Delay helper function
     * @private
     * @param {number} ms - Milliseconds to delay
     * @returns {Promise} Delay promise
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Save connection state to localStorage
     * @private
     */
    _saveConnectionState() {
        const state = {
            walletType: this.connectionType,
            account: this.account,
            chainId: this.chainId,
            timestamp: this.connectionState.connectionTimestamp,
            autoReconnectEnabled: this.connectionState.autoReconnectEnabled
        };
        localStorage.setItem('wallet_connection_state', JSON.stringify(state));
        localStorage.setItem('wallet_connected', 'true');
        localStorage.setItem('wallet_connection_type', this.connectionType);
    }
    
    /**
     * Setup enhanced provider event listeners
     * @private
     */
    _setupProviderListeners() {
        if (!this.provider) return;
        
        try {
            // Account changes
            this.provider.on('accountsChanged', (accounts) => {
                logger.info(LOG_CONTEXTS.WALLET, 'Provider accounts changed', { accounts });
                this._handleAccountsChanged(accounts);
            });
            
            // Chain changes
            this.provider.on('chainChanged', (chainId) => {
                const numericChainId = parseInt(chainId, 16);
                logger.info(LOG_CONTEXTS.WALLET, 'Provider chain changed', { chainId: numericChainId });
                this._handleChainChanged(numericChainId);
            });
            
            // Connection events
            this.provider.on('connect', (connectInfo) => {
                logger.info(LOG_CONTEXTS.WALLET, 'Provider connected', connectInfo);
                this._emitEvent('connect', connectInfo);
            });
            
            // Disconnection events
            this.provider.on('disconnect', (error) => {
                logger.warn(LOG_CONTEXTS.WALLET, 'Provider disconnected', error);
                this._handleDisconnect(error);
            });
            
            // WalletConnect specific events
            if (this.connectionType === this.walletTypes.WALLETCONNECT) {
                this.provider.on('session_update', (error, payload) => {
                    if (error) {
                        logger.error(LOG_CONTEXTS.WALLET, 'WalletConnect session update error', error);
                    } else {
                        logger.info(LOG_CONTEXTS.WALLET, 'WalletConnect session updated', payload);
                    }
                });
            }
        } catch (error) {
            logger.warn(LOG_CONTEXTS.WALLET, 'Failed to setup some provider listeners', error.message);
        }
    }

    /**
     * Disconnect wallet
     */
    async disconnect() {
        try {
            logger.info(LOG_CONTEXTS.WALLET, 'Disconnecting wallet');
            
            // If using Web3Modal, disconnect through it
            if (this.connectionType === 'web3modal') {
                await web3ModalService.disconnect();
            }
            
            this.account = null;
            this.chainId = null;
            this.networkConfig = null;
            this.isConnected = false;
            this.connectionType = null;
            
            // Clear saved state
            localStorage.removeItem('wallet_connected');
            localStorage.removeItem('wallet_connection_type');
            
            // Reset to default network
            const rpcUrls = getRpcUrls(DEFAULT_NETWORK.chainId);
            this.web3 = new window.Web3(rpcUrls[0]);
            
            this._emitEvent('disconnect');
            
            logger.info(LOG_CONTEXTS.WALLET, 'Wallet disconnected');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'disconnect' });
        }
    }

    /**
     * Connect using Web3Modal (following open-source patterns)
     * @returns {Promise<Object>} Connection result
     */
    async connectWithModal() {
        return await this.connect(this.walletTypes.WEB3MODAL);
    }

    /**
     * Auto-connect using Web3Modal if previously connected
     * @returns {Promise<Object>} Connection result
     */
    async autoConnectModal() {
        try {
            const result = await web3ModalService.autoConnect();
            if (result.success) {
                const connectionInfo = web3ModalService.getConnectionInfo();
                this.provider = connectionInfo.provider;
                this.web3 = connectionInfo.web3;
                this.account = connectionInfo.account;
                this.chainId = connectionInfo.chainId;
                this.networkConfig = connectionInfo.networkConfig;
                this.connectionType = 'web3modal';
                this.isConnected = true;
                
                return {
                    success: true,
                    account: this.account,
                    chainId: this.chainId,
                    networkConfig: this.networkConfig,
                    connectionType: this.connectionType
                };
            }
            return result;
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'auto_connect_modal' });
            return { success: false, error: error.message };
        }
    }

    /**
     * Switch to a different network
     * @param {number} chainId - Target chain ID
     * @returns {Promise<boolean>} Switch success
     */
    async switchNetwork(chainId) {
        try {
            if (!isNetworkSupported(chainId)) {
                throw new Error(`Unsupported network: ${chainId}`);
            }

            logger.info(LOG_CONTEXTS.WALLET, `Switching to network ${chainId}`);
            
            const networkConfig = getNetworkConfig(chainId);
            const hexChainId = '0x' + chainId.toString(16);

            if (window.ethereum) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: hexChainId }],
                    });
                    
                    return true;
                } catch (switchError) {
                    // Network doesn't exist, try to add it
                    if (switchError.code === 4902) {
                        return await this._addNetwork(networkConfig);
                    }
                    throw switchError;
                }
            }
            
            return false;
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { targetChainId: chainId });
            throw new Error(`Failed to switch network: ${error.message}`);
        }
    }

    /**
     * Add network to wallet
     * @param {Object} networkConfig - Network configuration
     * @private
     * @returns {Promise<boolean>} Add success
     */
    async _addNetwork(networkConfig) {
        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: '0x' + networkConfig.chainId.toString(16),
                    chainName: networkConfig.name,
                    nativeCurrency: networkConfig.currency,
                    rpcUrls: [networkConfig.rpcUrls.primary],
                    blockExplorerUrls: [networkConfig.explorer.url]
                }]
            });
            
            logger.info(LOG_CONTEXTS.WALLET, 'Network added successfully', { 
                chainId: networkConfig.chainId,
                name: networkConfig.name 
            });
            
            return true;
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                networkConfig,
                context: 'addNetwork' 
            });
            return false;
        }
    }

    /**
     * Update account information
     * @private
     */
    async _updateAccountInfo() {
        try {
            const accounts = await this.web3.eth.getAccounts();
            this.account = accounts[0] || null;
            
            logger.debug(LOG_CONTEXTS.WALLET, 'Account info updated', { account: this.account });
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'updateAccountInfo' });
        }
    }

    /**
     * Update network information
     * @private
     */
    async _updateNetworkInfo() {
        try {
            this.chainId = await this.web3.eth.getChainId();
            this.networkConfig = getNetworkConfig(this.chainId);
            
            logger.debug(LOG_CONTEXTS.WALLET, 'Network info updated', { 
                chainId: this.chainId,
                network: this.networkConfig.name 
            });
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { context: 'updateNetworkInfo' });
        }
    }

    /**
     * Handle accounts changed event
     * @param {string[]} accounts - New accounts
     * @private
     */
    async _handleAccountsChanged(accounts) {
        const newAccount = accounts[0] || null;
        const oldAccount = this.account;
        
        if (newAccount !== oldAccount) {
            this.account = newAccount;
            
            if (!newAccount) {
                // No accounts means disconnected
                await this.disconnect();
            } else {
                this._emitEvent('accountsChanged', { 
                    oldAccount, 
                    newAccount,
                    accounts 
                });
            }
        }
    }

    /**
     * Handle chain changed event
     * @param {number} chainId - New chain ID
     * @private
     */
    async _handleChainChanged(chainId) {
        const oldChainId = this.chainId;
        this.chainId = chainId;
        
        try {
            this.networkConfig = getNetworkConfig(chainId);
            
            // Refresh contracts for new network
            if (contractService && this.web3) {
                await contractService.refresh(this.web3, chainId);
            }
            
            this._emitEvent('chainChanged', { 
                oldChainId, 
                newChainId: chainId,
                networkConfig: this.networkConfig 
            });
        } catch (error) {
            logger.logError(LOG_CONTEXTS.WALLET, error, { 
                chainId,
                context: 'chainChanged' 
            });
        }
    }

    /**
     * Handle disconnect event
     * @param {Object} error - Disconnect error
     * @private
     */
    async _handleDisconnect(error) {
        await this.disconnect();
        this._emitEvent('disconnect', { error });
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.listeners[event]) {
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) {
                this.listeners[event].splice(index, 1);
            }
        }
    }

    /**
     * Emit event to listeners
     * @param {string} event - Event name
     * @param {any} data - Event data
     * @private
     */
    _emitEvent(event, data = null) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.WALLET, error, { 
                        event,
                        context: 'eventCallback' 
                    });
                }
            });
        }
    }

    /**
     * Get wallet status
     * @returns {Object} Wallet status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            account: this.account,
            chainId: this.chainId,
            networkConfig: this.networkConfig,
            connectionType: this.connectionType,
            web3Available: !!this.web3
        };
    }

    /**
     * Get formatted account address
     * @returns {string} Formatted address
     */
    getFormattedAccount() {
        if (!this.account) return 'Not connected';
        return `${this.account.slice(0, 6)}...${this.account.slice(-4)}`;
    }

    /**
     * Check if on correct network
     * @param {number} expectedChainId - Expected chain ID
     * @returns {boolean} Whether on correct network
     */
    isOnCorrectNetwork(expectedChainId) {
        return this.chainId === expectedChainId;
    }
}

// Export singleton instance
export const walletService = new WalletService();

// Export class for testing
export { WalletService };