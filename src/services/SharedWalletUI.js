/**
 * Shared Wallet UI Component
 * Provides consistent wallet button behavior and state management across all pages
 */

import { walletStatePersistence } from './WalletStatePersistence.js';

class SharedWalletUI {
    constructor(uiServices) {
        this.uiServices = uiServices;
        this.walletButtonSelector = '#wallet-btn';
        this.initialized = false;
        
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
    init() {
        if (this.initialized) return;
        
        console.log('🔄 Initializing Shared Wallet UI...');
        
        // Setup wallet button
        this.setupWalletButton();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize wallet state from persistence
        this.initializeWalletState();
        
        this.initialized = true;
        console.log('✅ Shared Wallet UI initialized');
    }

    /**
     * Setup wallet button functionality
     */
    setupWalletButton() {
        const walletBtn = document.querySelector(this.walletButtonSelector);
        if (walletBtn) {
            walletBtn.addEventListener('click', this.handleWalletButtonClick);
        }
    }

    /**
     * Setup event listeners for wallet events
     */
    setupEventListeners() {
        // Listen for wallet events from UIServiceIntegration
        document.addEventListener('prana:walletConnected', this.handleWalletConnected.bind(this));
        document.addEventListener('prana:walletDisconnected', this.handleWalletDisconnected.bind(this));
        document.addEventListener('prana:accountChanged', this.handleAccountChanged.bind(this));
        document.addEventListener('prana:chainChanged', this.handleChainChanged.bind(this));
        
        // Listen for cross-tab sync events
        document.addEventListener('prana:walletStateSync', (event) => {
            const { type, state } = event.detail;
            if (type === 'connected') {
                this.updateWalletUI(state.account, true);
            } else if (type === 'disconnected') {
                this.updateWalletUI(null, false);
            }
        });
    }

    /**
     * Initialize wallet state from persistence
     */
    async initializeWalletState() {
        try {
            // Wait for UIServices to initialize
            await this.uiServices.init();
            
            // Check current connection state
            const isConnected = this.uiServices.isWalletConnected();
            const account = this.uiServices.getCurrentAccount();
            
            // Update UI based on current state
            this.updateWalletUI(account, isConnected);
            
        } catch (error) {
            console.error('Failed to initialize wallet state:', error);
            this.updateWalletUI(null, false);
        }
    }

    /**
     * Handle wallet button click
     */
    async handleWalletButtonClick() {
        try {
            const isConnected = this.uiServices.isWalletConnected();
            
            if (isConnected) {
                // Disconnect wallet
                await this.uiServices.disconnectWallet();
            } else {
                // Connect wallet
                const result = await this.uiServices.connectWallet('metamask');
                console.log('Wallet connected:', result);
            }
        } catch (error) {
            console.error('Wallet operation failed:', error);
            this.showError(`Wallet operation failed: ${error.message}`);
        }
    }

    /**
     * Handle wallet connected event
     */
    handleWalletConnected(event) {
        const { account } = event.detail;
        console.log('Wallet connected:', account);
        this.updateWalletUI(account, true);
        this.hideError();
    }

    /**
     * Handle wallet disconnected event
     */
    handleWalletDisconnected() {
        console.log('Wallet disconnected');
        this.updateWalletUI(null, false);
    }

    /**
     * Handle account changed event
     */
    handleAccountChanged(event) {
        const { account } = event.detail;
        console.log('Account changed:', account);
        this.updateWalletUI(account, true);
    }

    /**
     * Handle chain changed event
     */
    handleChainChanged(event) {
        const { chainId } = event.detail;
        console.log('Chain changed:', chainId);
        // UI update for chain change if needed
    }

    /**
     * Update wallet button UI
     * @param {string|null} account - Wallet account address
     * @param {boolean} isConnected - Connection status
     */
    updateWalletUI(account, isConnected) {
        const walletBtn = document.querySelector(this.walletButtonSelector);
        if (!walletBtn) return;

        if (isConnected && account) {
            // Connected state
            walletBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            walletBtn.title = `Disconnect (${account.slice(0, 6)}...${account.slice(-4)})`;
            walletBtn.classList.remove('btn-primary');
            walletBtn.classList.add('btn-secondary', 'connected');
        } else {
            // Disconnected state
            walletBtn.innerHTML = '<i class="fas fa-wallet"></i>';
            walletBtn.title = 'Connect Wallet';
            walletBtn.classList.remove('btn-secondary', 'connected');
            walletBtn.classList.add('btn-primary');
        }

        // Update other wallet-related UI elements if they exist
        this.updateWalletStatusElements(account, isConnected);
    }

    /**
     * Update wallet status elements across the page
     * @param {string|null} account - Wallet account address
     * @param {boolean} isConnected - Connection status
     */
    updateWalletStatusElements(account, isConnected) {
        // Update wallet account displays
        const accountElements = document.querySelectorAll('[data-wallet-account]');
        accountElements.forEach(element => {
            if (isConnected && account) {
                element.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
                element.style.color = '#22c55e'; // Green for connected
            } else {
                element.textContent = 'Not Connected';
                element.style.color = '#64748b'; // Gray for disconnected
            }
        });

        // Update wallet network displays
        const networkElements = document.querySelectorAll('[data-wallet-network]');
        networkElements.forEach(element => {
            if (isConnected) {
                element.textContent = 'BSC Testnet'; // Default network
                element.style.color = '#22c55e';
            } else {
                element.textContent = 'Not Connected';
                element.style.color = '#64748b';
            }
        });

        // Update wallet balance elements
        const balanceElements = document.querySelectorAll('[data-wallet-balance]');
        balanceElements.forEach(element => {
            if (isConnected) {
                element.removeAttribute('data-wallet-disconnected');
                element.textContent = 'Loading...';
            } else {
                element.setAttribute('data-wallet-disconnected', '');
                element.textContent = 'Connect your wallet to view balances';
            }
        });
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        const errorBanner = document.getElementById('error-banner');
        const errorMessage = document.getElementById('error-message');
        
        if (errorBanner && errorMessage) {
            errorMessage.textContent = message;
            errorBanner.classList.add('show');
        }
        
        console.error('Wallet UI Error:', message);
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorBanner = document.getElementById('error-banner');
        if (errorBanner) {
            errorBanner.classList.remove('show');
        }
    }

    /**
     * Get current wallet state summary
     */
    getWalletState() {
        return {
            connected: this.uiServices.isWalletConnected(),
            account: this.uiServices.getCurrentAccount(),
            persistence: walletStatePersistence.getConnectionSummary()
        };
    }

    /**
     * Force refresh wallet state
     */
    async refreshWalletState() {
        await this.initializeWalletState();
    }

    /**
     * Cleanup event listeners
     */
    destroy() {
        const walletBtn = document.querySelector(this.walletButtonSelector);
        if (walletBtn) {
            walletBtn.removeEventListener('click', this.handleWalletButtonClick);
        }

        document.removeEventListener('prana:walletConnected', this.handleWalletConnected);
        document.removeEventListener('prana:walletDisconnected', this.handleWalletDisconnected);
        document.removeEventListener('prana:accountChanged', this.handleAccountChanged);
        document.removeEventListener('prana:chainChanged', this.handleChainChanged);
        
        this.initialized = false;
        console.log('🧹 Shared Wallet UI destroyed');
    }
}

// Export for ES6 modules
export { SharedWalletUI };

// Make available globally
if (typeof window !== 'undefined') {
    window.SharedWalletUI = SharedWalletUI;
}

export default SharedWalletUI;