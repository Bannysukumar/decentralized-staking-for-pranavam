/**
 * Shared Wallet UI Component - Container-based version
 * Provides consistent wallet button behavior and state management across all pages
 * This version creates and manages its own wallet button in a specified container
 */

import { walletStatePersistence } from '../services/WalletStatePersistence.js';

class SharedWalletUI {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.walletButton = null;
        this.initialized = false;
        
        // Wallet state
        this.isConnected = false;
        this.currentAccount = null;
        this.currentNetwork = null;
        
        // Bind methods
        this.handleWalletButtonClick = this.handleWalletButtonClick.bind(this);
        this.handleWalletConnected = this.handleWalletConnected.bind(this);
        this.handleWalletDisconnected = this.handleWalletDisconnected.bind(this);
        this.handleAccountChanged = this.handleAccountChanged.bind(this);
        this.handleChainChanged = this.handleChainChanged.bind(this);
    }

    /**
     * Initialize shared wallet UI
     */
    async initialize() {
        if (this.initialized) return;
        
        console.log('🔄 Initializing SharedWalletUI...');
        
        // Get container element
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Container element with id '${this.containerId}' not found`);
        }
        
        // Create wallet button
        this.createWalletButton();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load persisted wallet state
        await this.loadPersistedState();
        
        this.initialized = true;
        console.log('✅ SharedWalletUI initialized');
    }

    /**
     * Create wallet button element
     */
    createWalletButton() {\n        this.walletButton = document.createElement('button');
        this.walletButton.className = 'btn btn-primary wallet-toggle-btn';
        this.walletButton.id = 'shared-wallet-btn';
        this.walletButton.title = 'Connect Wallet';
        this.walletButton.innerHTML = '<i class="fas fa-wallet"></i>';
        
        // Add click listener
        this.walletButton.addEventListener('click', this.handleWalletButtonClick);
        
        // Append to container
        this.container.appendChild(this.walletButton);
    }

    /**
     * Setup event listeners for wallet events
     */
    setupEventListeners() {
        // Listen for wallet events
        document.addEventListener('prana:walletConnected', this.handleWalletConnected);
        document.addEventListener('prana:walletDisconnected', this.handleWalletDisconnected);
        document.addEventListener('prana:accountChanged', this.handleAccountChanged);
        document.addEventListener('prana:chainChanged', this.handleChainChanged);
        
        // Listen for cross-tab sync events from WalletStatePersistence
        window.addEventListener('storage', (event) => {
            if (event.key === 'wallet_connection_state') {
                this.handleStorageChange(event);
            }
        });
    }

    /**
     * Load persisted wallet state
     */
    async loadPersistedState() {
        try {
            const persistedState = walletStatePersistence.loadState();
            if (persistedState && persistedState.isConnected) {
                console.log('🔄 Loading persisted wallet state...', persistedState);
                
                // Try to restore connection
                if (window.ethereum) {
                    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                    if (accounts.length > 0 && accounts[0] === persistedState.account) {
                        // State is still valid
                        this.updateWalletState({
                            isConnected: true,
                            account: persistedState.account,
                            chainId: persistedState.chainId,
                            networkName: persistedState.networkName
                        });
                        
                        // Emit wallet connected event
                        this.emitWalletEvent('walletConnected', {
                            account: persistedState.account,
                            chainId: persistedState.chainId,
                            networkName: persistedState.networkName
                        });
                    } else {
                        // State is stale, clear it
                        walletStatePersistence.clearState();
                        this.updateWalletState({ isConnected: false });
                    }
                } else {
                    // No wallet available, clear state
                    walletStatePersistence.clearState();
                    this.updateWalletState({ isConnected: false });
                }
            } else {
                this.updateWalletState({ isConnected: false });
            }
        } catch (error) {
            console.error('Failed to load persisted wallet state:', error);
            this.updateWalletState({ isConnected: false });
        }
    }

    /**
     * Handle wallet button click
     */
    async handleWalletButtonClick() {
        try {
            if (this.isConnected) {
                // Disconnect wallet
                await this.disconnectWallet();
            } else {
                // Connect wallet
                await this.connectWallet();
            }
        } catch (error) {
            console.error('Wallet button click error:', error);
            this.showError('Wallet operation failed: ' + error.message);
        }
    }

    /**
     * Connect wallet
     */
    async connectWallet() {
        if (!window.ethereum) {
            this.showError('MetaMask or compatible wallet not found. Please install MetaMask.');
            return;
        }

        try {
            console.log('🔄 Connecting wallet...');
            
            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Get chain ID
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const networkName = this.getNetworkName(chainId);

            // Update state
            const walletState = {
                isConnected: true,
                account: accounts[0],
                chainId: chainId,
                networkName: networkName
            };

            this.updateWalletState(walletState);

            // Persist state
            walletStatePersistence.saveState(walletState);

            // Emit event
            this.emitWalletEvent('walletConnected', walletState);

            console.log('✅ Wallet connected:', accounts[0]);

        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    }

    /**
     * Disconnect wallet
     */
    async disconnectWallet() {
        console.log('🔄 Disconnecting wallet...');
        
        // Update state
        this.updateWalletState({ isConnected: false });
        
        // Clear persisted state
        walletStatePersistence.clearState();
        
        // Emit event
        this.emitWalletEvent('walletDisconnected', {});
        
        console.log('✅ Wallet disconnected');
    }

    /**
     * Update wallet state
     */
    updateWalletState(state) {
        this.isConnected = state.isConnected || false;
        this.currentAccount = state.account || null;
        this.currentNetwork = state.networkName || null;
        
        // Update button UI
        this.updateButtonUI();
    }

    /**
     * Update button UI based on wallet state
     */
    updateButtonUI() {
        if (!this.walletButton) return;

        if (this.isConnected && this.currentAccount) {
            // Connected state
            const shortAccount = `${this.currentAccount.slice(0, 6)}...${this.currentAccount.slice(-4)}`;
            this.walletButton.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span class="account-text">${shortAccount}</span>
            `;
            this.walletButton.title = `Connected: ${this.currentAccount}\\nNetwork: ${this.currentNetwork || 'Unknown'}\\nClick to disconnect`;
            this.walletButton.classList.add('connected');
        } else {
            // Disconnected state
            this.walletButton.innerHTML = '<i class="fas fa-wallet"></i>';
            this.walletButton.title = 'Connect Wallet';
            this.walletButton.classList.remove('connected');
        }
    }

    /**
     * Handle wallet connected event
     */
    handleWalletConnected(event) {
        const { account, chainId, networkName } = event.detail;
        this.updateWalletState({
            isConnected: true,
            account,
            chainId,
            networkName
        });
    }

    /**
     * Handle wallet disconnected event
     */
    handleWalletDisconnected(event) {
        this.updateWalletState({ isConnected: false });
    }

    /**
     * Handle account changed event
     */
    handleAccountChanged(event) {
        const { account } = event.detail;
        if (this.isConnected) {
            this.updateWalletState({
                isConnected: true,
                account,
                chainId: this.currentChainId,
                networkName: this.currentNetwork
            });
            
            // Update persisted state
            walletStatePersistence.saveState({
                isConnected: true,
                account,
                chainId: this.currentChainId,
                networkName: this.currentNetwork
            });
        }
    }

    /**
     * Handle chain changed event
     */
    handleChainChanged(event) {
        const { chainId } = event.detail;
        const networkName = this.getNetworkName(chainId);
        
        if (this.isConnected) {
            this.updateWalletState({
                isConnected: true,
                account: this.currentAccount,
                chainId,
                networkName
            });
            
            // Update persisted state
            walletStatePersistence.saveState({
                isConnected: true,
                account: this.currentAccount,
                chainId,
                networkName
            });
        }
    }

    /**
     * Handle storage change for cross-tab sync
     */
    handleStorageChange(event) {
        if (event.key === 'wallet_connection_state') {
            const newState = JSON.parse(event.newValue || '{}');
            if (newState.isConnected) {
                this.updateWalletState({
                    isConnected: true,
                    account: newState.account,
                    chainId: newState.chainId,
                    networkName: newState.networkName
                });
            } else {
                this.updateWalletState({ isConnected: false });
            }
        }
    }

    /**
     * Get network name from chain ID
     */
    getNetworkName(chainId) {
        const networks = {
            '0x1': 'Ethereum Mainnet',
            '0x38': 'BSC Mainnet',
            '0x61': 'BSC Testnet',
            '0x89': 'Polygon Mainnet',
            '0x13881': 'Polygon Mumbai'
        };
        return networks[chainId] || `Chain ${parseInt(chainId, 16)}`;
    }

    /**
     * Emit wallet event
     */
    emitWalletEvent(eventName, data) {
        const event = new CustomEvent(`prana:${eventName}`, {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    /**
     * Show error message
     */
    showError(message) {
        console.error('SharedWalletUI Error:', message);
        
        // Create temporary error notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    /**
     * Get current wallet state
     */
    getState() {
        return {
            isConnected: this.isConnected,
            account: this.currentAccount,
            network: this.currentNetwork
        };
    }
}

export { SharedWalletUI };