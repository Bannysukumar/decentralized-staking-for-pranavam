/**
 * UnifiedWalletManager - JavaScript implementation
 * Real implementation that defers to the main WalletService
 */

import { walletService } from '../../services/WalletService.js';

class UnifiedWalletManager {
    constructor() {
        this.walletService = walletService;
        this.isConnected = false;
        this.currentAccount = null;
        this.currentProvider = null;
    }

    async connectWallet(providerName = 'metamask') {
        console.log(`Connecting to real wallet: ${providerName}`);
        
        try {
            const result = await this.walletService.connect(providerName);
            
            if (result.success) {
                this.isConnected = true;
                this.currentAccount = result.account;
                this.currentProvider = providerName;
            }
            
            return result;
        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }

    async disconnectWallet() {
        console.log('Disconnecting real wallet');
        
        try {
            await this.walletService.disconnect();
            this.isConnected = false;
            this.currentAccount = null;
            this.currentProvider = null;
            
            return { success: true };
        } catch (error) {
            console.error('Wallet disconnection failed:', error);
            throw error;
        }
    }

    async attemptAutoReconnect() {
        console.log('Attempting real auto-reconnect');
        
        try {
            const result = await this.walletService.attemptAutoReconnect();
            
            if (result.success) {
                this.isConnected = true;
                this.currentAccount = result.account;
                this.currentProvider = result.provider;
            }
            
            return result;
        } catch (error) {
            console.error('Auto-reconnect failed:', error);
            return { success: false, error: error.message };
        }
    }

    getCurrentAccount() {
        return this.currentAccount || this.walletService.currentAccount;
    }

    getCurrentProvider() {
        return this.currentProvider || this.walletService.currentProvider;
    }

    isWalletConnected() {
        return this.isConnected || this.walletService.isConnected;
    }

    async switchNetwork(chainId) {
        console.log(`Switching to network: ${chainId}`);
        
        try {
            const result = await this.walletService.switchNetwork(chainId);
            return result;
        } catch (error) {
            console.error('Network switch failed:', error);
            throw error;
        }
    }
}

// Create default export instance
const walletManager = new UnifiedWalletManager();

// Export for ES6 modules and CommonJS compatibility
export { walletManager };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { walletManager };
} else {
    window.UnifiedWalletManager = UnifiedWalletManager;
    window.walletManager = walletManager;
}