/**
 * Network Helper Utilities
 * Helps users switch to the correct network and handles network-related errors
 */

export class NetworkHelper {
    static BSC_TESTNET_CONFIG = {
        chainId: '0x61', // 97 in hex
        chainName: 'BSC Testnet',
        nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: ['https://bsc-testnet.bnbchain.org'],
        blockExplorerUrls: ['https://testnet.bscscan.com']
    };

    /**
     * Check if user is on the correct network
     * @param {number} currentChainId - Current chain ID from wallet
     * @returns {{ isCorrect: boolean, message: string, needsSwitch: boolean }}
     */
    static validateNetwork(currentChainId) {
        const chainId = Number(currentChainId);
        
        if (chainId === 97) {
            return {
                isCorrect: true,
                message: 'Connected to BSC Testnet ✅',
                needsSwitch: false
            };
        }
        
        const networkNames = {
            1: 'Ethereum Mainnet',
            5: 'Goerli Testnet',
            56: 'BSC Mainnet',
            137: 'Polygon Mainnet',
            80001: 'Polygon Mumbai'
        };
        
        const currentNetwork = networkNames[chainId] || `Unknown Network (${chainId})`;
        
        return {
            isCorrect: false,
            message: `You are connected to ${currentNetwork}. Please switch to BSC Testnet for PRANA contracts.`,
            needsSwitch: true,
            currentNetwork,
            currentChainId: chainId
        };
    }

    /**
     * Attempt to switch to BSC Testnet
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    static async switchToBSCTestnet() {
        if (typeof window.ethereum === 'undefined') {
            return {
                success: false,
                error: 'No wallet detected. Please install MetaMask or another Web3 wallet.'
            };
        }

        try {
            // First try to switch to BSC Testnet
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.BSC_TESTNET_CONFIG.chainId }]
            });

            return { success: true };

        } catch (switchError) {
            // If the chain doesn't exist in the wallet, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [this.BSC_TESTNET_CONFIG]
                    });

                    return { success: true };

                } catch (addError) {
                    return {
                        success: false,
                        error: `Failed to add BSC Testnet: ${addError.message}`
                    };
                }
            }

            // User rejected the request
            if (switchError.code === 4001) {
                return {
                    success: false,
                    error: 'User rejected network switch request'
                };
            }

            return {
                success: false,
                error: `Failed to switch network: ${switchError.message}`
            };
        }
    }

    /**
     * Show network switch UI/modal
     * @param {Object} validationResult - Result from validateNetwork
     * @returns {Promise<boolean>} Whether network was switched successfully
     */
    static async showNetworkSwitchUI(validationResult) {
        if (validationResult.isCorrect) {
            return true;
        }

        // Create modal for network switching
        const modal = this.createNetworkModal(validationResult);
        document.body.appendChild(modal);

        return new Promise((resolve) => {
            // Handle switch button click
            const switchBtn = modal.querySelector('#network-switch-btn');
            const cancelBtn = modal.querySelector('#network-cancel-btn');

            switchBtn.addEventListener('click', async () => {
                switchBtn.textContent = 'Switching...';
                switchBtn.disabled = true;

                const result = await this.switchToBSCTestnet();

                if (result.success) {
                    modal.remove();
                    resolve(true);
                } else {
                    switchBtn.textContent = 'Try Again';
                    switchBtn.disabled = false;
                    
                    const errorDiv = modal.querySelector('#network-error');
                    errorDiv.textContent = result.error;
                    errorDiv.style.display = 'block';
                }
            });

            cancelBtn.addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            // Close on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });
        });
    }

    /**
     * Create network switch modal
     * @param {Object} validationResult - Validation result
     * @returns {HTMLElement} Modal element
     */
    static createNetworkModal(validationResult) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 10px;
                max-width: 450px;
                width: 90%;
                text-align: center;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            ">
                <h2 style="color: #FF6B35; margin-bottom: 20px;">⚠️ Wrong Network</h2>
                
                <p style="margin-bottom: 20px; color: #333; line-height: 1.5;">
                    ${validationResult.message}
                </p>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                    <strong>Current Network:</strong> ${validationResult.currentNetwork}<br>
                    <strong>Required Network:</strong> BSC Testnet (Chain ID: 97)
                </div>
                
                <div id="network-error" style="
                    display: none;
                    background: #ffebee;
                    color: #c62828;
                    padding: 10px;
                    border-radius: 5px;
                    margin-bottom: 15px;
                "></div>
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="network-switch-btn" style="
                        background: #FF6B35;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 600;
                    ">Switch to BSC Testnet</button>
                    
                    <button id="network-cancel-btn" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 16px;
                    ">Cancel</button>
                </div>
                
                <p style="margin-top: 15px; font-size: 12px; color: #666;">
                    This will add BSC Testnet to your wallet if it's not already added.
                </p>
            </div>
        `;

        return modal;
    }

    /**
     * Get user-friendly error message for network issues
     * @param {Error} error - Network error
     * @param {number} chainId - Current chain ID
     * @returns {string} User-friendly error message
     */
    static getNetworkErrorMessage(error, chainId) {
        if (error.message.includes('missing trie node')) {
            return `BSC Testnet RPC issue detected. The network is experiencing temporary connectivity problems. Please try again in a moment, or check your connection.`;
        }

        if (error.message.includes('not deployed on this network')) {
            const validation = this.validateNetwork(chainId);
            return validation.message;
        }

        if (error.message.includes('Internal JSON-RPC error')) {
            return `Network connection issue. BSC Testnet may be experiencing high traffic. Please try again.`;
        }

        return `Network error: ${error.message}. Please check your connection and ensure you're on BSC Testnet.`;
    }

    /**
     * Check if error is network-related
     * @param {Error} error - Error to check
     * @returns {boolean} Whether error is network-related
     */
    static isNetworkError(error) {
        if (!error || !error.message) return false;

        const networkErrorPatterns = [
            'missing trie node',
            'not deployed on this network',
            'Internal JSON-RPC error',
            'switch to BSC Testnet',
            'wrong network',
            'unsupported network'
        ];

        return networkErrorPatterns.some(pattern => 
            error.message.toLowerCase().includes(pattern.toLowerCase())
        );
    }
}

// Make it globally available
if (typeof window !== 'undefined') {
    window.NetworkHelper = NetworkHelper;
}