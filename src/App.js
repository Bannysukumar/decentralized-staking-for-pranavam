/**
 * Main Application Entry Point
 * Orchestrates all services and provides unified API for UI components
 */

import { logger, LOG_CONTEXTS, LOG_LEVELS } from './services/LoggingService.js';
import { contractService } from './services/ContractService.js';
import { walletService } from './services/WalletService.js';
import { stakingService } from './services/StakingService.js';
import { exchangeService } from './services/ExchangeService.js';
import { navigationService } from './services/NavigationService.js';
import { walletUIManager } from './services/WalletUIManager.js';
import { DEFAULT_NETWORK, isNetworkSupported } from './config/networks.js';

class PranaApp {
    constructor() {
        this.initialized = false;
        this.services = {
            logger,
            contract: contractService,
            wallet: walletService,
            staking: stakingService,
            exchange: exchangeService,
            navigation: navigationService,
            walletUI: walletUIManager
        };
        
        // Application state
        this.state = {
            isLoading: false,
            hasError: false,
            errorMessage: null,
            currentPage: null,
            userBalances: {}
        };
        
        // Event callbacks for UI components
        this.callbacks = {
            onStateChange: [],
            onWalletConnect: [],
            onWalletDisconnect: [],
            onBalanceUpdate: [],
            onTransactionStart: [],
            onTransactionComplete: [],
            onError: []
        };
        
        this.initialize();
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            logger.info(LOG_CONTEXTS.UI, 'Initializing PRANA application');
            
            this._setState({ isLoading: true });
            
            // Set up global error handling
            this._setupGlobalErrorHandling();
            
            // Configure logging based on environment
            this._configureLogging();
            
            // Set up service event listeners
            this._setupServiceListeners();
            
            // Initialize services (they auto-initialize themselves)
            await this._waitForServicesReady();
            
            // Initialize navigation service
            await navigationService.initialize();
            
            // Initialize wallet UI manager
            await walletUIManager.initialize(walletService);
            
            // Set up UI event handlers
            this._setupUIEventHandlers();
            
            // Try to detect current page and initialize page-specific features
            this._detectAndInitializePage();
            
            this.initialized = true;
            this._setState({ isLoading: false });
            
            logger.info(LOG_CONTEXTS.UI, 'PRANA application initialized successfully');
            
            // Emit initialization complete event
            this._emitEvent('onStateChange', { initialized: true });
            
        } catch (error) {
            this._setState({ 
                isLoading: false, 
                hasError: true, 
                errorMessage: error.message 
            });
            
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'appInitialization' });
            this._emitEvent('onError', { error, context: 'initialization' });
        }
    }

    /**
     * Configure logging based on environment
     * @private
     */
    _configureLogging() {
        // Check if debug mode is enabled
        const isDebug = localStorage.getItem('prana_debug') === 'true' || 
                       window.location.hostname === 'localhost' ||
                       window.location.search.includes('debug=true');
        
        if (isDebug) {
            logger.setLevel(LOG_LEVELS.DEBUG);
            logger.info(LOG_CONTEXTS.UI, 'Debug mode enabled');
        } else {
            logger.setLevel(LOG_LEVELS.INFO);
        }
        
        // Add external logger for production analytics (placeholder)
        if (window.location.hostname !== 'localhost') {
            logger.addExternalLogger((logData) => {
                // TODO: Send to analytics service
                if (logData.level <= LOG_LEVELS.ERROR) {
                    console.warn('Production error:', logData);
                }
            });
        }
    }

    /**
     * Set up global error handling
     * @private
     */
    _setupGlobalErrorHandling() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            logger.logError(LOG_CONTEXTS.UI, new Error(event.reason), { 
                context: 'unhandledPromiseRejection' 
            });
            this._emitEvent('onError', { 
                error: new Error(event.reason), 
                context: 'unhandledPromiseRejection' 
            });
        });
        
        // Catch JavaScript errors
        window.addEventListener('error', (event) => {
            logger.logError(LOG_CONTEXTS.UI, new Error(event.message), {
                context: 'javascriptError',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
    }

    /**
     * Set up service event listeners
     * @private
     */
    _setupServiceListeners() {
        // Wallet events
        walletService.on('connect', (data) => {
            logger.info(LOG_CONTEXTS.UI, 'Wallet connected', data);
            this._updateUserBalances();
            this._emitEvent('onWalletConnect', data);
        });
        
        walletService.on('disconnect', () => {
            logger.info(LOG_CONTEXTS.UI, 'Wallet disconnected');
            this.state.userBalances = {};
            this._emitEvent('onWalletDisconnect');
        });
        
        walletService.on('accountsChanged', (data) => {
            logger.info(LOG_CONTEXTS.UI, 'Account changed', data);
            this._updateUserBalances();
        });
        
        walletService.on('chainChanged', (data) => {
            logger.info(LOG_CONTEXTS.UI, 'Network changed', data);
            
            if (!isNetworkSupported(data.newChainId)) {
                this._setState({
                    hasError: true,
                    errorMessage: `Unsupported network. Please switch to ${DEFAULT_NETWORK.name}`
                });
            } else {
                this._setState({ hasError: false, errorMessage: null });
                this._updateUserBalances();
            }
        });
    }

    /**
     * Set up UI event handlers
     * @private
     */
    _setupUIEventHandlers() {
        // Note: Wallet connect/disconnect buttons are now handled by WalletUIManager
        // This provides systematic wallet connection across all pages
        
        // Form submission handlers
        document.addEventListener('submit', (event) => {
            if (event.target.matches('.staking-form')) {
                event.preventDefault();
                this._handleStakingSubmit(event);
            }
            
            if (event.target.matches('.exchange-form')) {
                event.preventDefault();
                this._handleExchangeSubmit(event);
            }
        });
        
        // Legacy compatibility - redirect old wallet connect calls to new system
        document.addEventListener('click', (event) => {
            if (event.target.matches('[onclick*="handleWalletConnect"]')) {
                event.preventDefault();
                walletUIManager.connectWallet();
            }
        });
    }

    /**
     * Detect current page and initialize page-specific features
     * @private
     */
    _detectAndInitializePage() {
        const path = window.location.pathname;
        
        if (path.includes('staking')) {
            this.state.currentPage = 'staking';
            this._initializeStakingPage();
        } else if (path.includes('exchange')) {
            this.state.currentPage = 'exchange';
            this._initializeExchangePage();
        } else {
            this.state.currentPage = 'home';
            this._initializeHomePage();
        }
        
        logger.debug(LOG_CONTEXTS.UI, 'Page initialized', { page: this.state.currentPage });
    }

    /**
     * Initialize staking page
     * @private
     */
    _initializeStakingPage() {
        // Update staking dashboard if user is connected
        if (walletService.isConnected) {
            setTimeout(() => this.updateStakingDashboard(), 1000);
        }
        
        // Set up real-time updates
        setInterval(() => {
            if (walletService.isConnected) {
                this.updateStakingDashboard();
            }
        }, 30000); // Update every 30 seconds
    }

    /**
     * Initialize exchange page
     * @private
     */
    _initializeExchangePage() {
        // Set up real-time quote updates
        this._setupExchangeQuoteUpdates();
    }

    /**
     * Initialize home page
     * @private
     */
    _initializeHomePage() {
        // Update general platform statistics
        if (walletService.isConnected) {
            this._updatePlatformStats();
        }
    }

    /**
     * Connect wallet - now delegates to WalletUIManager for systematic handling
     * @param {string} type - Wallet type ('metamask', 'walletconnect')
     * @returns {Promise<boolean>} Connection success
     */
    async connectWallet(type = 'metamask') {
        try {
            this._setState({ isLoading: true });
            
            // Delegate to WalletUIManager for systematic handling
            const success = await walletUIManager.connectWallet(type);
            
            if (success) {
                await this._updateUserBalances();
                
                // Update page-specific data
                if (this.state.currentPage === 'staking') {
                    await this.updateStakingDashboard();
                }
            }
            
            this._setState({ isLoading: false });
            return success;
            
        } catch (error) {
            this._setState({ 
                isLoading: false,
                hasError: true,
                errorMessage: error.message 
            });
            
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'connectWallet', type });
            this._emitEvent('onError', { error, context: 'connectWallet' });
            return false;
        }
    }

    /**
     * Disconnect wallet - now delegates to WalletUIManager for systematic handling
     */
    async disconnectWallet() {
        try {
            // Delegate to WalletUIManager for systematic handling
            await walletUIManager.disconnectWallet();
            this.state.userBalances = {};
            this._emitEvent('onWalletDisconnect');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'disconnectWallet' });
        }
    }

    /**
     * Create stake
     * @param {string} amount - Amount to stake
     * @param {string} referrer - Referrer address (optional)
     * @returns {Promise<Object>} Transaction result
     */
    async createStake(amount, referrer) {
        try {
            this._emitEvent('onTransactionStart', { type: 'createStake', amount, referrer });
            
            const result = await stakingService.createStake(amount, referrer);
            
            // Update balances and dashboard
            await this._updateUserBalances();
            await this.updateStakingDashboard();
            
            this._emitEvent('onTransactionComplete', { type: 'createStake', result });
            
            return result;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'createStake', amount, referrer });
            this._emitEvent('onError', { error, context: 'createStake' });
            throw error;
        }
    }

    /**
     * Execute token swap
     * @param {string} fromToken - Source token
     * @param {string} toToken - Destination token
     * @param {string} amount - Amount to swap
     * @param {number} slippage - Slippage tolerance
     * @returns {Promise<Object>} Transaction result
     */
    async executeSwap(fromToken, toToken, amount, slippage) {
        try {
            this._emitEvent('onTransactionStart', { 
                type: 'swap', 
                fromToken, 
                toToken, 
                amount, 
                slippage 
            });
            
            let result;
            
            if (fromToken === 'PRANA' && toToken === 'USDT') {
                result = await exchangeService.swapPranaToUsdt(amount, slippage);
            } else if (fromToken === 'USDT' && toToken === 'PRANA') {
                result = await exchangeService.swapUsdtToPrana(amount, slippage);
            } else {
                throw new Error(`Unsupported swap pair: ${fromToken} to ${toToken}`);
            }
            
            // Update balances
            await this._updateUserBalances();
            
            this._emitEvent('onTransactionComplete', { type: 'swap', result });
            
            return result;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { 
                context: 'executeSwap', 
                fromToken, 
                toToken, 
                amount, 
                slippage 
            });
            this._emitEvent('onError', { error, context: 'executeSwap' });
            throw error;
        }
    }

    /**
     * Get quote for token swap
     * @param {string} fromToken - Source token
     * @param {string} toToken - Destination token
     * @param {string} amount - Amount to swap
     * @returns {Promise<Object>} Quote information
     */
    async getSwapQuote(fromToken, toToken, amount) {
        try {
            if (fromToken === 'PRANA' && toToken === 'USDT') {
                return await exchangeService.getPranaToUsdtQuote(amount);
            } else if (fromToken === 'USDT' && toToken === 'PRANA') {
                return await exchangeService.getUsdtToPranaQuote(amount);
            } else {
                throw new Error(`Unsupported swap pair: ${fromToken} to ${toToken}`);
            }
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { 
                context: 'getSwapQuote', 
                fromToken, 
                toToken, 
                amount 
            });
            throw error;
        }
    }

    /**
     * Update user balances
     * @private
     */
    async _updateUserBalances() {
        if (!walletService.isConnected) return;
        
        try {
            const account = walletService.account;
            const pranaContract = contractService.getContract('pranaToken');
            const usdtContract = contractService.getContract('usdtToken');
            
            // Check if contracts are available and have valid addresses
            let pranaBalance = '0';
            let usdtBalance = '0';
            
            if (pranaContract && pranaContract.options?.address && pranaContract.options.address !== '0x0000000000000000000000000000000000000000') {
                pranaBalance = await pranaContract.methods.balanceOf(account).call();
            } else {
                console.log('🚫 PRANA contract not available or has zero address - returning 0 balance');
            }
            
            if (usdtContract && usdtContract.options?.address && usdtContract.options.address !== '0x0000000000000000000000000000000000000000') {
                usdtBalance = await usdtContract.methods.balanceOf(account).call();
            } else {
                console.log('🚫 USDT contract not available or has zero address - returning 0 balance');
            }
            
            const nativeBalance = await walletService.web3.eth.getBalance(account);
            
            this.state.userBalances = {
                PRANA: walletService.web3.utils.fromWei(pranaBalance, 'ether'),
                USDT: this._formatUsdtBalance(usdtBalance),
                BNB: walletService.web3.utils.fromWei(nativeBalance, 'ether')
            };
            
            logger.debug(LOG_CONTEXTS.UI, 'User balances updated', this.state.userBalances);
            this._emitEvent('onBalanceUpdate', this.state.userBalances);
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'updateUserBalances' });
            // Set default values on error
            this.state.userBalances = {
                PRANA: '0',
                USDT: '0',
                BNB: '0'
            };
        }
    }

    /**
     * Update staking dashboard
     */
    async updateStakingDashboard() {
        if (!walletService.isConnected) return;
        
        try {
            const summary = await stakingService.getUserStakingSummary();
            
            // Update UI elements
            this._updateStakingUI(summary);
            
            logger.debug(LOG_CONTEXTS.UI, 'Staking dashboard updated', summary);
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.UI, error, { context: 'updateStakingDashboard' });
        }
    }

    /**
     * Update staking UI elements
     * @param {Object} summary - Staking summary
     * @private
     */
    _updateStakingUI(summary) {
        // Update user staked amount
        const userStakedEl = document.getElementById('user-staked');
        if (userStakedEl) {
            userStakedEl.textContent = `${parseFloat(summary.totalStaked).toLocaleString()} PRANA`;
        }
        
        // Update platform total
        const platformStakedEl = document.getElementById('total-staked-platform');
        if (platformStakedEl) {
            platformStakedEl.textContent = `${parseFloat(summary.platformTotalStaked).toLocaleString()} PRANA`;
        }
        
        // Update individual stakes display if available
        if (summary.discrepancy) {
            logger.warn(LOG_CONTEXTS.UI, 'Staking discrepancy detected', {
                contractTotal: summary.totalStaked,
                individualTotal: summary.individualStakesTotal,
                stakeCount: summary.stakeCount
            });
        }
    }

    /**
     * Set up exchange quote updates
     * @private
     */
    _setupExchangeQuoteUpdates() {
        // Auto-update quotes when input amounts change
        const pranaInput = document.getElementById('prana-amount');
        const usdtInput = document.getElementById('usdt-amount');
        
        if (pranaInput) {
            let pranaTimeout;
            pranaInput.addEventListener('input', () => {
                clearTimeout(pranaTimeout);
                pranaTimeout = setTimeout(async () => {
                    if (pranaInput.value && parseFloat(pranaInput.value) > 0) {
                        try {
                            const quote = await this.getSwapQuote('PRANA', 'USDT', pranaInput.value);
                            this._displayQuote(quote);
                        } catch (error) {
                            logger.debug(LOG_CONTEXTS.UI, 'Quote update failed', error.message);
                        }
                    }
                }, 500);
            });
        }
        
        if (usdtInput) {
            let usdtTimeout;
            usdtInput.addEventListener('input', () => {
                clearTimeout(usdtTimeout);
                usdtTimeout = setTimeout(async () => {
                    if (usdtInput.value && parseFloat(usdtInput.value) > 0) {
                        try {
                            const quote = await this.getSwapQuote('USDT', 'PRANA', usdtInput.value);
                            this._displayQuote(quote);
                        } catch (error) {
                            logger.debug(LOG_CONTEXTS.UI, 'Quote update failed', error.message);
                        }
                    }
                }, 500);
            });
        }
    }

    /**
     * Display swap quote in UI
     * @param {Object} quote - Quote information
     * @private
     */
    _displayQuote(quote) {
        const quoteEl = document.getElementById('swap-quote');
        if (quoteEl) {
            quoteEl.innerHTML = `
                <div class="quote-info">
                    <div>Rate: 1 ${quote.inputToken} = ${quote.exchangeRate} ${quote.outputToken}</div>
                    <div>Minimum received: ${quote.minOutputWithSlippage} ${quote.outputToken}</div>
                </div>
            `;
        }
    }

    /**
     * Format USDT balance considering decimals
     * @param {string} balance - USDT balance in wei
     * @returns {string} Formatted balance
     * @private
     */
    _formatUsdtBalance(balance) {
        const decimals = walletService.chainId === 97 ? 6 : 18; // BSC Testnet uses 6 decimals
        if (decimals === 18) {
            return walletService.web3.utils.fromWei(balance, 'ether');
        } else {
            const divisor = walletService.web3.utils.toBN(10).pow(walletService.web3.utils.toBN(decimals));
            return walletService.web3.utils.toBN(balance).div(divisor).toString();
        }
    }

    /**
     * Wait for services to be ready
     * @private
     */
    async _waitForServicesReady() {
        const maxWait = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            // Check if core services are ready
            if (walletService && contractService && stakingService && exchangeService) {
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        logger.debug(LOG_CONTEXTS.UI, 'Services ready check completed');
    }

    /**
     * Handle staking form submission
     * @param {Event} event - Form submit event
     * @private
     */
    async _handleStakingSubmit(event) {
        const form = event.target;
        const formData = new FormData(form);
        const amount = formData.get('amount');
        const referrer = formData.get('referrer') || '';
        
        try {
            await this.createStake(amount, referrer);
            form.reset();
        } catch (error) {
            // Error already logged and emitted in createStake
        }
    }

    /**
     * Handle exchange form submission
     * @param {Event} event - Form submit event
     * @private
     */
    async _handleExchangeSubmit(event) {
        const form = event.target;
        const formData = new FormData(form);
        const fromToken = formData.get('fromToken');
        const toToken = formData.get('toToken');
        const amount = formData.get('amount');
        const slippage = parseFloat(formData.get('slippage')) || 0.5;
        
        try {
            await this.executeSwap(fromToken, toToken, amount, slippage);
            form.reset();
        } catch (error) {
            // Error already logged and emitted in executeSwap
        }
    }

    /**
     * Update platform statistics
     * @private
     */
    async _updatePlatformStats() {
        // Implementation for updating platform-wide statistics
        // This would be called on the home page
    }

    /**
     * Set application state
     * @param {Object} newState - New state properties
     * @private
     */
    _setState(newState) {
        Object.assign(this.state, newState);
        this._emitEvent('onStateChange', this.state);
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
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
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    logger.logError(LOG_CONTEXTS.UI, error, { 
                        event,
                        context: 'eventCallback' 
                    });
                }
            });
        }
    }

    /**
     * Get application status
     * @returns {Object} Application status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            state: this.state,
            services: {
                wallet: walletService.getStatus(),
                walletUI: walletUIManager.getState(),
                staking: stakingService.getStatus(),
                exchange: exchangeService.getStatus(),
                contract: contractService.getContractInfo(),
                navigation: navigationService.getStatus()
            }
        };
    }

    /**
     * Get user data
     * @returns {Object} User data
     */
    getUserData() {
        return {
            wallet: walletService.getStatus(),
            balances: this.state.userBalances,
            isConnected: walletService.isConnected,
            account: walletService.account,
            formattedAccount: walletService.getFormattedAccount(),
            network: walletService.networkConfig
        };
    }
}

// Create and export singleton instance
export const pranaApp = new PranaApp();

// Make it globally available for legacy code compatibility
if (typeof window !== 'undefined') {
    window.pranaApp = pranaApp;
    
    // Legacy compatibility functions
    window.handleWalletConnect = () => pranaApp.connectWallet();
    window.handleStake = (event) => pranaApp._handleStakingSubmit(event);
    window.updateStakingDashboard = () => pranaApp.updateStakingDashboard();
}

// Export class for testing
export { PranaApp };