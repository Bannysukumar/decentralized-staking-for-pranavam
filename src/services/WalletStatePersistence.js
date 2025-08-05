/**
 * Wallet State Persistence Service
 * Ensures wallet connection state is properly maintained across page navigation
 * Provides a unified API for wallet state management across all pages
 */

class WalletStatePersistence {
    constructor() {
        this.STORAGE_KEYS = {
            PREFERRED_WALLET: 'prana_preferred_wallet',
            CONNECTION_STATE: 'prana_wallet_state',
            LAST_ACCOUNT: 'prana_last_account',
            LAST_CHAIN_ID: 'prana_last_chain_id'
        };
        
        // Initialize event handling for cross-tab communication
        this.initCrossTabSync();
    }

    /**
     * Save wallet connection state
     * @param {Object} state - Wallet connection state
     */
    saveWalletState(state) {
        try {
            // Ensure chainId is properly handled - convert hex to decimal if needed
            let chainId = state.chainId;
            if (typeof chainId === 'string' && chainId.startsWith('0x')) {
                chainId = parseInt(chainId, 16); // Convert hex to decimal
            }
            
            const walletState = {
                isConnected: state.isConnected || false,
                account: state.account || null,
                chainId: chainId || null,
                provider: state.provider || null,
                timestamp: Date.now()
            };

            localStorage.setItem(this.STORAGE_KEYS.CONNECTION_STATE, JSON.stringify(walletState));
            console.log('💾 Wallet state saved:', walletState);
            
            if (state.provider) {
                localStorage.setItem(this.STORAGE_KEYS.PREFERRED_WALLET, state.provider);
            }
            
            if (state.account) {
                localStorage.setItem(this.STORAGE_KEYS.LAST_ACCOUNT, state.account);
            }
            
            if (chainId) {
                localStorage.setItem(this.STORAGE_KEYS.LAST_CHAIN_ID, chainId.toString());
            }

            // Trigger cross-tab update
            this.broadcastStateChange('walletConnected', walletState);
            
        } catch (error) {
            console.error('Failed to save wallet state:', error);
        }
    }

    /**
     * Get saved wallet connection state
     * @returns {Object} Wallet state or null
     */
    getWalletState() {
        try {
            const stateStr = localStorage.getItem(this.STORAGE_KEYS.CONNECTION_STATE);
            if (!stateStr) return null;

            const state = JSON.parse(stateStr);
            
            // Check if state is too old (older than 24 hours)
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            if (Date.now() - state.timestamp > maxAge) {
                this.clearWalletState();
                return null;
            }

            return state;
        } catch (error) {
            console.error('Failed to get wallet state:', error);
            return null;
        }
    }

    /**
     * Clear wallet connection state
     */
    clearWalletState() {
        try {
            localStorage.removeItem(this.STORAGE_KEYS.CONNECTION_STATE);
            localStorage.removeItem(this.STORAGE_KEYS.PREFERRED_WALLET);
            localStorage.removeItem(this.STORAGE_KEYS.LAST_ACCOUNT);
            localStorage.removeItem(this.STORAGE_KEYS.LAST_CHAIN_ID);

            // Trigger cross-tab update
            this.broadcastStateChange('walletDisconnected', null);
            
        } catch (error) {
            console.error('Failed to clear wallet state:', error);
        }
    }

    /**
     * Get preferred wallet provider
     * @returns {string|null} Provider name
     */
    getPreferredWallet() {
        try {
            return localStorage.getItem(this.STORAGE_KEYS.PREFERRED_WALLET);
        } catch (error) {
            console.error('Failed to get preferred wallet:', error);
            return null;
        }
    }

    /**
     * Check if wallet was recently connected
     * @returns {boolean} True if connected within session
     */
    wasRecentlyConnected() {
        const state = this.getWalletState();
        return state && state.isConnected && state.account;
    }

    /**
     * Update wallet account (for account change events)
     * @param {string} account - New account address
     */
    updateAccount(account) {
        const currentState = this.getWalletState();
        if (currentState) {
            currentState.account = account;
            currentState.timestamp = Date.now();
            this.saveWalletState(currentState);
        }
    }

    /**
     * Update wallet network (for chain change events)
     * @param {number} chainId - New chain ID
     */
    updateChainId(chainId) {
        const currentState = this.getWalletState();
        if (currentState) {
            currentState.chainId = chainId;
            currentState.timestamp = Date.now();
            this.saveWalletState(currentState);
        }
    }

    /**
     * Initialize cross-tab synchronization
     */
    initCrossTabSync() {
        if (typeof window !== 'undefined') {
            window.addEventListener('storage', (event) => {
                if (event.key === this.STORAGE_KEYS.CONNECTION_STATE) {
                    const newState = event.newValue ? JSON.parse(event.newValue) : null;
                    
                    // Emit custom event for local handling
                    if (newState && newState.isConnected) {
                        document.dispatchEvent(new CustomEvent('prana:walletStateSync', {
                            detail: { type: 'connected', state: newState }
                        }));
                    } else {
                        document.dispatchEvent(new CustomEvent('prana:walletStateSync', {
                            detail: { type: 'disconnected', state: null }
                        }));
                    }
                }
            });
        }
    }

    /**
     * Broadcast state change to other tabs
     * @param {string} type - Event type
     * @param {Object} data - Event data
     */
    broadcastStateChange(type, data) {
        if (typeof window !== 'undefined') {
            // Use localStorage as a communication channel
            const broadcastData = {
                type,
                data,
                timestamp: Date.now()
            };
            
            localStorage.setItem('prana_wallet_broadcast', JSON.stringify(broadcastData));
            
            // Clean up broadcast data
            setTimeout(() => {
                localStorage.removeItem('prana_wallet_broadcast');
            }, 1000);
        }
    }

    /**
     * Get connection summary for debugging
     * @returns {Object} Connection summary
     */
    getConnectionSummary() {
        const state = this.getWalletState();
        const preferredWallet = this.getPreferredWallet();
        
        return {
            hasState: !!state,
            isConnected: state?.isConnected || false,
            account: state?.account || null,
            chainId: state?.chainId || null,
            provider: state?.provider || null,
            preferredWallet,
            wasRecentlyConnected: this.wasRecentlyConnected(),
            stateAge: state ? Date.now() - state.timestamp : null
        };
    }
}

// Create singleton instance
const walletStatePersistence = new WalletStatePersistence();

// Export for ES6 modules
export { WalletStatePersistence, walletStatePersistence };

// Make available globally for legacy scripts
if (typeof window !== 'undefined') {
    window.walletStatePersistence = walletStatePersistence;
}

export default walletStatePersistence;