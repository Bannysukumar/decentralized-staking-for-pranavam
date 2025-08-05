/**
 * Web3Modal Service
 * Modern wallet connection following open-source DApp patterns
 * Based on KryptoPunks and other reference projects
 * 
 * Note: External libraries (Web3Modal, ethers, Web3) are loaded via CDN in HTML
 */

// External libraries availability check
if (typeof window.Web3Modal === 'undefined') {
    console.warn('Web3Modal not loaded - include Web3Modal CDN script');
}
if (typeof window.Web3 === 'undefined') {
    console.warn('Web3 not loaded - include Web3 CDN script');
}
import { logger } from './LoggingService.js';
import { stateManager } from './StateManagerService.js';
import { errorBoundaryService } from './ErrorBoundaryService.js';

export class Web3ModalService {
    constructor() {
        this.web3Modal = null;
        this.provider = null;
        this.web3 = null;
        this.ethersProvider = null;
        this.signer = null;
        this.account = null;
        this.chainId = null;
        this.networkConfig = null;
        
        // Supported networks configuration
        this.networks = {
            1: { name: 'Ethereum Mainnet', currency: 'ETH', explorerUrl: 'https://etherscan.io' },
            56: { name: 'BSC Mainnet', currency: 'BNB', explorerUrl: 'https://bscscan.com' },
            97: { name: 'BSC Testnet', currency: 'BNB', explorerUrl: 'https://testnet.bscscan.com' },
            137: { name: 'Polygon Mainnet', currency: 'MATIC', explorerUrl: 'https://polygonscan.com' },
            80001: { name: 'Mumbai Testnet', currency: 'MATIC', explorerUrl: 'https://mumbai.polygonscan.com' }
        };
        
        // Initialize Web3Modal
        this.initializeWeb3Modal();
    }
    
    /**
     * Initialize Web3Modal with provider options
     */
    initializeWeb3Modal() {
        // Simple Web3Modal instantiation - exactly like KryptoPunks reference project
        // KryptoPunks uses: let web3Modal = new Web3Modal() (no provider options)
        
        let Web3ModalConstructor = window.Web3Modal;
        
        // Handle different ways Web3Modal might be exposed (object with .default)
        if (Web3ModalConstructor && typeof Web3ModalConstructor === 'object' && Web3ModalConstructor.default) {
            Web3ModalConstructor = Web3ModalConstructor.default;
        }
        
        if (Web3ModalConstructor && typeof Web3ModalConstructor === 'function') {
            // Exact KryptoPunks pattern: new Web3Modal() - no options needed
            this.web3Modal = new Web3ModalConstructor();
            console.log('✅ Web3Modal instantiated (KryptoPunks style - simple, no providers)');
        } else {
            console.warn('⚠️ Web3Modal constructor not available');
            this.web3Modal = null;
        }
    }
    
    /**
     * Connect wallet using Web3Modal
     * @returns {Promise<Object>} Connection result
     */
    async connect() {
        try {
            // Dispatch connection start
            stateManager.dispatch('WALLET_CONNECT_START');
            
            // Clear cached provider if needed
            if (this.web3Modal.cachedProvider) {
                await this.web3Modal.clearCachedProvider();
            }
            
            // Connect with Web3Modal
            this.provider = await this.web3Modal.connect();
            
            // Setup providers
            await this.setupProviders();
            
            // Get initial account and network
            await this.updateAccountAndNetwork();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Dispatch success
            stateManager.dispatch('WALLET_CONNECT_SUCCESS', {
                account: this.account,
                chainId: this.chainId,
                networkConfig: this.networkConfig,
                type: this.getWalletType()
            });
            
            logger.info('Web3Modal', 'Wallet connected successfully', {
                account: this.account,
                chainId: this.chainId,
                walletType: this.getWalletType()
            });
            
            return {
                success: true,
                account: this.account,
                chainId: this.chainId,
                networkConfig: this.networkConfig
            };
            
        } catch (error) {
            const errorInfo = errorBoundaryService.handleError(error, {
                type: 'wallet',
                context: 'web3modal_connect'
            });
            
            stateManager.dispatch('WALLET_CONNECT_FAILURE', errorInfo.originalError);
            
            return {
                success: false,
                error: errorInfo.userMessage
            };
        }
    }
    
    /**
     * Setup Web3 and Ethers providers
     */
    async setupProviders() {
        // Setup Web3
        this.web3 = new window.Web3(this.provider);
        
        // Setup Ethers
        this.ethersProvider = new window.ethers.providers.Web3Provider(this.provider);
        this.signer = this.ethersProvider.getSigner();
    }
    
    /**
     * Update account and network information
     */
    async updateAccountAndNetwork() {
        // Get accounts
        const accounts = await this.web3.eth.getAccounts();
        this.account = accounts[0] || null;
        
        // Get chain ID
        this.chainId = await this.web3.eth.getChainId();
        
        // Get network config
        this.networkConfig = this.networks[this.chainId] || {
            name: `Unknown Network (${this.chainId})`,
            currency: 'Unknown',
            explorerUrl: ''
        };
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (!this.provider) return;
        
        // Account change
        this.provider.on('accountsChanged', async (accounts) => {
            logger.info('Web3Modal', 'Accounts changed', accounts);
            
            if (accounts.length === 0) {
                // User disconnected wallet
                await this.disconnect();
            } else {
                this.account = accounts[0];
                stateManager.dispatch('WALLET_ACCOUNT_CHANGED', this.account);
            }
        });
        
        // Chain change
        this.provider.on('chainChanged', async (chainId) => {
            logger.info('Web3Modal', 'Chain changed', chainId);
            
            // Update chain info
            this.chainId = parseInt(chainId, 16);
            this.networkConfig = this.networks[this.chainId] || {
                name: `Unknown Network (${this.chainId})`,
                currency: 'Unknown',
                explorerUrl: ''
            };
            
            // Update providers
            await this.setupProviders();
            
            stateManager.dispatch('WALLET_CHAIN_CHANGED', this.chainId, this.networkConfig);
        });
        
        // Disconnect
        this.provider.on('disconnect', async (code, reason) => {
            logger.info('Web3Modal', 'Provider disconnected', { code, reason });
            await this.disconnect();
        });
    }
    
    /**
     * Disconnect wallet
     */
    async disconnect() {
        try {
            // Clear Web3Modal cache
            await this.web3Modal.clearCachedProvider();
            
            // Disconnect provider if it has disconnect method
            if (this.provider && typeof this.provider.disconnect === 'function') {
                await this.provider.disconnect();
            }
            
            // Clear local state
            this.provider = null;
            this.web3 = null;
            this.ethersProvider = null;
            this.signer = null;
            this.account = null;
            this.chainId = null;
            this.networkConfig = null;
            
            // Update state
            stateManager.dispatch('WALLET_DISCONNECT');
            
            logger.info('Web3Modal', 'Wallet disconnected');
            
            return { success: true };
            
        } catch (error) {
            logger.error('Web3Modal', 'Error disconnecting wallet:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Switch to a different network
     * @param {number} chainId - Chain ID to switch to
     */
    async switchNetwork(chainId) {
        try {
            const chainIdHex = `0x${chainId.toString(16)}`;
            
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }]
            });
            
            return { success: true };
            
        } catch (error) {
            // This error code indicates that the chain has not been added to MetaMask
            if (error.code === 4902) {
                try {
                    // Try to add the network
                    await this.addNetwork(chainId);
                    return { success: true };
                } catch (addError) {
                    const errorInfo = errorBoundaryService.handleError(addError, {
                        type: 'wallet',
                        context: 'add_network'
                    });
                    return { success: false, error: errorInfo.userMessage };
                }
            }
            
            const errorInfo = errorBoundaryService.handleError(error, {
                type: 'wallet',
                context: 'switch_network'
            });
            
            return { success: false, error: errorInfo.userMessage };
        }
    }
    
    /**
     * Add a new network to the wallet
     * @param {number} chainId - Chain ID to add
     */
    async addNetwork(chainId) {
        const networkParams = this.getNetworkParams(chainId);
        
        if (!networkParams) {
            throw new Error(`Network configuration not found for chain ${chainId}`);
        }
        
        await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [networkParams]
        });
    }
    
    /**
     * Get network parameters for adding to wallet
     * @param {number} chainId - Chain ID
     * @returns {Object} Network parameters
     */
    getNetworkParams(chainId) {
        const networkConfigs = {
            56: {
                chainId: '0x38',
                chainName: 'Binance Smart Chain Mainnet',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com/']
            },
            97: {
                chainId: '0x61',
                chainName: 'Binance Smart Chain Testnet',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                blockExplorerUrls: ['https://testnet.bscscan.com/']
            },
            137: {
                chainId: '0x89',
                chainName: 'Polygon Mainnet',
                nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18
                },
                rpcUrls: ['https://polygon-rpc.com/'],
                blockExplorerUrls: ['https://polygonscan.com/']
            },
            80001: {
                chainId: '0x13881',
                chainName: 'Mumbai Testnet',
                nativeCurrency: {
                    name: 'MATIC',
                    symbol: 'MATIC',
                    decimals: 18
                },
                rpcUrls: ['https://rpc-mumbai.maticvigil.com/'],
                blockExplorerUrls: ['https://mumbai.polygonscan.com/']
            }
        };
        
        return networkConfigs[chainId];
    }
    
    /**
     * Get wallet type from provider
     * @returns {string} Wallet type
     */
    getWalletType() {
        if (!this.provider) return 'unknown';
        
        if (this.provider.isMetaMask) return 'metamask';
        if (this.provider.isWalletConnect) return 'walletconnect';
        if (this.provider.isCoinbaseWallet) return 'coinbase';
        if (this.provider.isTrust) return 'trust';
        
        return 'unknown';
    }
    
    /**
     * Check if wallet is connected
     * @returns {boolean} Connection status
     */
    isConnected() {
        return !!(this.provider && this.account);
    }
    
    /**
     * Get current connection info
     * @returns {Object} Connection information
     */
    getConnectionInfo() {
        return {
            isConnected: this.isConnected(),
            account: this.account,
            chainId: this.chainId,
            networkConfig: this.networkConfig,
            walletType: this.getWalletType(),
            provider: this.provider,
            web3: this.web3,
            ethersProvider: this.ethersProvider,
            signer: this.signer
        };
    }
    
    /**
     * Auto-connect if provider was cached
     */
    async autoConnect() {
        try {
            if (this.web3Modal.cachedProvider) {
                logger.info('Web3Modal', 'Auto-connecting with cached provider');
                return await this.connect();
            }
            
            return { success: false, error: 'No cached provider found' };
            
        } catch (error) {
            logger.error('Web3Modal', 'Auto-connect failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Sign message with connected wallet
     * @param {string} message - Message to sign
     * @returns {Promise<string>} Signature
     */
    async signMessage(message) {
        try {
            if (!this.signer) {
                throw new Error('No wallet connected');
            }
            
            const signature = await this.signer.signMessage(message);
            return { success: true, signature };
            
        } catch (error) {
            const errorInfo = errorBoundaryService.handleError(error, {
                type: 'wallet',
                context: 'sign_message'
            });
            
            return { success: false, error: errorInfo.userMessage };
        }
    }
    
    /**
     * Get native balance
     * @param {string} address - Address to check (defaults to connected account)
     * @returns {Promise<string>} Balance in wei
     */
    async getBalance(address = null) {
        try {
            const targetAddress = address || this.account;
            
            if (!targetAddress) {
                throw new Error('No address provided');
            }
            
            const balance = await this.web3.eth.getBalance(targetAddress);
            return { success: true, balance };
            
        } catch (error) {
            const errorInfo = errorBoundaryService.handleError(error, {
                type: 'wallet',
                context: 'get_balance'
            });
            
            return { success: false, error: errorInfo.userMessage };
        }
    }
}

// Export singleton instance
export const web3ModalService = new Web3ModalService();
export default web3ModalService;