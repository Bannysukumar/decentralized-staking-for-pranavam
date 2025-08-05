/**
 * Unified Exchange Service
 * Handles all exchange/trading operations with proper error handling and slippage protection
 */

import { logger, LOG_CONTEXTS } from './LoggingService.js';
import { contractService } from './ContractService.js';
import { walletService } from './WalletService.js';
import { getTokenConfig } from '../config/contracts.js';
import { getEnvironmentName, getExpectedNetwork } from '../config/api-config.js';

class ExchangeService {
    constructor() {
        this.exchangeContract = null;
        this.pranaTokenContract = null;
        this.usdtTokenContract = null;
        this.web3 = null;
        this.tokenConfig = null;
        
        // Trading parameters
        this.defaultSlippage = 0.5; // 0.5%
        this.maxSlippage = 5; // 5%
        
        // Cache for quotes and rates
        this.cache = {
            exchangeRate: null,
            quotes: new Map(),
            lastUpdate: 0
        };
        
        // Quote cache TTL (30 seconds)
        this.quoteCacheTTL = 30 * 1000;
        
        // Transaction tracking
        this.pendingSwaps = new Map();
        
        this.initialize();
    }

    /**
     * Initialize exchange service
     */
    async initialize() {
        try {
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Initializing exchange service');
            
            // Listen for wallet connection changes
            walletService.on('connect', (data) => this._handleWalletConnect(data));
            walletService.on('chainChanged', (data) => this._handleChainChanged(data));
            walletService.on('accountsChanged', (data) => this._handleAccountChanged(data));
            walletService.on('disconnect', () => this._handleWalletDisconnect());
            
            // Initialize if wallet is already connected
            if (walletService.isConnected) {
                await this._initializeContracts();
            }
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange service initialized');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { context: 'initialization' });
        }
    }

    /**
     * Initialize contracts
     * @private
     */
    async _initializeContracts() {
        try {
            this.web3 = walletService.web3;
            
            // Try to get contracts, but handle failures gracefully
            try {
                this.exchangeContract = contractService.getContract('pranaExchange');
            } catch (error) {
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'pranaExchange contract not available:', error.message);
                this.exchangeContract = null;
            }
            
            try {
                this.pranaTokenContract = contractService.getContract('pranaToken');
            } catch (error) {
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'pranaToken contract not available:', error.message);
                this.pranaTokenContract = null;
            }
            
            try {
                this.usdtTokenContract = contractService.getContract('usdtToken');
            } catch (error) {
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'usdtToken contract not available:', error.message);
                this.usdtTokenContract = null;
            }
            
            this.tokenConfig = getTokenConfig(walletService.chainId);
            
            // Only load exchange rate if we have the exchange contract
            if (this.exchangeContract) {
                await this._loadExchangeRate();
            } else {
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'Skipping exchange rate loading - exchange contract not available');
            }
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange contracts initialized', {
                hasExchangeContract: !!this.exchangeContract,
                hasPranaContract: !!this.pranaTokenContract,
                hasUsdtContract: !!this.usdtTokenContract
            });
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { context: 'contractInitialization' });
            throw error;
        }
    }

    /**
     * Load current exchange rate
     * @private
     */
    async _loadExchangeRate() {
        try {
            // Try to calculate rate from real contract reserves first
            const realRate = await this._calculateRateFromReserves();
            if (realRate) {
                this.cache.exchangeRate = Math.floor(realRate * 10000); // Convert to base units
                this.cache.ratePrecision = 10000;
                this.cache.lastUpdate = Date.now();
                this.cache.isRealData = true;
                
                logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange rate calculated from reserves', {
                    rate: `1 PRANA = ${realRate.toFixed(6)} USDT`,
                    isRealData: true
                });
                return;
            }

            // Ensure exchange contract is available
            this._ensureExchangeContract();
            
            // Check if the contract has required methods
            if (!this.exchangeContract.methods) {
                logger.error(LOG_CONTEXTS.EXCHANGE, 'Exchange contract methods not available. Cannot load exchange rate.');
                throw new Error('Exchange contract methods not available');
            }

            // Check if the getExchangeRate method exists
            if (typeof this.exchangeContract.methods.getExchangeRate !== 'function') {
                logger.error(LOG_CONTEXTS.EXCHANGE, 'Exchange contract getExchangeRate method not available. Cannot load exchange rate.');
                throw new Error('Exchange contract methods not available');
            }

            // Get exchange rate from contract (returns rate in wei, 1000 PRANA per 1 USDT)
            const exchangeRate = await this.exchangeContract.methods.getExchangeRate().call();
            
            // The rate is hardcoded as 1000 (1000 PRANA = 1 USDT, so 1 PRANA = 0.001 USDT)
            this.cache.exchangeRate = parseInt(exchangeRate);
            this.cache.ratePrecision = 1000; // 1 USDT = 1000 PRANA
            this.cache.lastUpdate = Date.now();
            this.cache.isRealData = true;
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange rate loaded from contract', {
                exchangeRateBase: this.cache.exchangeRate,
                ratePrecision: this.cache.ratePrecision,
                rate: `1 PRANA = ${1 / this.cache.ratePrecision} USDT (${this.cache.ratePrecision} PRANA = 1 USDT)`
            });
        } catch (error) {
            logger.error(LOG_CONTEXTS.EXCHANGE, 'Failed to load exchange rate from contract', error.message);
            
            // If it's an RPC error, use a fallback rate to keep the exchange functional
            if (error.message.includes('missing trie node') || 
                error.message.includes('Internal JSON-RPC error') ||
                error.code === -32000 || 
                error.code === -32603) {
                
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'Using fallback exchange rate due to RPC instability', {
                    fallbackRate: '1 PRANA = 0.001 USDT',
                    reason: 'RPC node issues'
                });
                
                // Set fallback rate (same as contract default: 1000 PRANA = 1 USDT)
                this.cache.exchangeRate = 1000;
                this.cache.ratePrecision = 1000;
                this.cache.lastUpdate = Date.now();
                this.cache.isRealData = false; // Mark as fallback data
                return;
            }
            
            throw error;
        }
    }

    /**
     * Calculate exchange rate from actual contract reserves
     * @private
     * @returns {Promise<number|null>} Exchange rate or null if cannot calculate
     */
    async _calculateRateFromReserves() {
        try {
            if (!this.pranaTokenContract || !this.usdtTokenContract) {
                return null;
            }

            // Get contract addresses
            const exchangeAddress = contractService.getContractAddress('pranaExchange');
            if (!exchangeAddress) {
                return null;
            }

            // Get actual token balances in the exchange contract using ContractService
            const pranaBalance = await contractService.executeCall('pranaToken', 'balanceOf', [exchangeAddress]);
            const usdtBalance = await contractService.executeCall('usdtToken', 'balanceOf', [exchangeAddress]);
            
            // Convert to readable format
            const pranaReserve = parseFloat(this.web3.utils.fromWei(pranaBalance, 'ether'));
            const usdtReserve = parseFloat(usdtBalance) / 1e6; // USDT has 6 decimals
            
            // Calculate rate: USDT per PRANA
            if (pranaReserve > 0 && usdtReserve > 0) {
                const rate = usdtReserve / pranaReserve;
                logger.info(LOG_CONTEXTS.EXCHANGE, 'Calculated rate from reserves', {
                    pranaReserve: pranaReserve.toFixed(2),
                    usdtReserve: usdtReserve.toFixed(2),
                    rate: rate.toFixed(6)
                });
                return rate;
            }
            
            return null;
        } catch (error) {
            // Handle specific RPC errors more gracefully
            if (error.message.includes('missing trie node') || 
                error.message.includes('Internal JSON-RPC error') ||
                error.code === -32000 || 
                error.code === -32603) {
                logger.info(LOG_CONTEXTS.EXCHANGE, 'RPC instability detected, using fallback rate calculation', {
                    error: error.message,
                    fallbackStrategy: 'contract method'
                });
                return null; // Will fall back to contract method
            }
            
            logger.warn(LOG_CONTEXTS.EXCHANGE, 'Failed to calculate rate from reserves:', error.message);
            return null;
        }
    }


    /**
     * Get quote for PRANA to USDT swap
     * @param {string} pranaAmount - Amount of PRANA to swap
     * @returns {Promise<Object>} Quote information
     */
    async getPranaToUsdtQuote(pranaAmount) {
        try {
            const cacheKey = `prana_to_usdt_${pranaAmount}`;
            
            // Check cache first
            if (this._isQuoteCacheValid() && this.cache.quotes.has(cacheKey)) {
                return this.cache.quotes.get(cacheKey);
            }
            
            logger.debug(LOG_CONTEXTS.EXCHANGE, 'Getting PRANA to USDT quote', { pranaAmount });
            
            const pranaAmountWei = this.web3.utils.toWei(pranaAmount, 'ether');
            
            // Call getSellQuote and handle potential destructuring issues
            const quoteResult = await this.exchangeContract.methods
                .getSellQuote(pranaAmountWei)
                .call();
            
            // Safely destructure the result
            let usdtAmountWei, fee;
            if (Array.isArray(quoteResult) && quoteResult.length >= 2) {
                [usdtAmountWei, fee] = quoteResult;
            } else if (typeof quoteResult === 'object' && quoteResult !== null) {
                // Handle object return format
                usdtAmountWei = quoteResult[0] || quoteResult.usdtAmount || '0';
                fee = quoteResult[1] || quoteResult.fee || '0';
            } else {
                throw new Error('Invalid quote result format from contract');
            }
            
            const usdtAmount = this._formatTokenAmount(usdtAmountWei, 'USDT');
            
            const quote = {
                type: 'prana_to_usdt',
                inputAmount: pranaAmount,
                outputAmount: usdtAmount,
                inputToken: 'PRANA',
                outputToken: 'USDT',
                exchangeRate: this._calculateRate(pranaAmount, usdtAmount),
                timestamp: Date.now(),
                minOutputWithSlippage: this._calculateMinOutput(usdtAmount, this.defaultSlippage)
            };
            
            // Cache the quote
            this.cache.quotes.set(cacheKey, quote);
            
            logger.debug(LOG_CONTEXTS.EXCHANGE, 'PRANA to USDT quote generated', quote);
            
            return quote;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { pranaAmount });
            throw new Error(`Failed to get quote: ${this._formatError(error)}`);
        }
    }

    /**
     * Get quote for USDT to PRANA swap
     * @param {string} usdtAmount - Amount of USDT to swap
     * @returns {Promise<Object>} Quote information
     */
    async getUsdtToPranaQuote(usdtAmount) {
        try {
            const cacheKey = `usdt_to_prana_${usdtAmount}`;
            
            // Check cache first
            if (this._isQuoteCacheValid() && this.cache.quotes.has(cacheKey)) {
                return this.cache.quotes.get(cacheKey);
            }
            
            logger.debug(LOG_CONTEXTS.EXCHANGE, 'Getting USDT to PRANA quote', { usdtAmount });
            
            const usdtAmountWei = this._parseTokenAmount(usdtAmount, 'USDT');
            
            // Call getBuyQuote and handle potential destructuring issues
            const quoteResult = await this.exchangeContract.methods
                .getBuyQuote(usdtAmountWei)
                .call();
            
            // Safely destructure the result
            let pranaAmountWei, fee;
            if (Array.isArray(quoteResult) && quoteResult.length >= 2) {
                [pranaAmountWei, fee] = quoteResult;
            } else if (typeof quoteResult === 'object' && quoteResult !== null) {
                // Handle object return format
                pranaAmountWei = quoteResult[0] || quoteResult.pranaAmount || '0';
                fee = quoteResult[1] || quoteResult.fee || '0';
            } else {
                throw new Error('Invalid quote result format from contract');
            }
            
            const pranaAmount = this.web3.utils.fromWei(pranaAmountWei, 'ether');
            
            const quote = {
                type: 'usdt_to_prana',
                inputAmount: usdtAmount,
                outputAmount: pranaAmount,
                inputToken: 'USDT',
                outputToken: 'PRANA',
                exchangeRate: this._calculateRate(usdtAmount, pranaAmount),
                timestamp: Date.now(),
                minOutputWithSlippage: this._calculateMinOutput(pranaAmount, this.defaultSlippage)
            };
            
            // Cache the quote
            this.cache.quotes.set(cacheKey, quote);
            
            logger.debug(LOG_CONTEXTS.EXCHANGE, 'USDT to PRANA quote generated', quote);
            
            return quote;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { usdtAmount });
            throw new Error(`Failed to get quote: ${this._formatError(error)}`);
        }
    }

    /**
     * Execute PRANA to USDT swap
     * @param {string} pranaAmount - Amount of PRANA to swap
     * @param {number} slippage - Slippage tolerance (optional)
     * @returns {Promise<Object>} Transaction result
     */
    async swapPranaToUsdt(pranaAmount, slippage = this.defaultSlippage) {
        try {
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Starting PRANA to USDT swap', { pranaAmount, slippage });
            
            // Validate inputs
            await this._validateSwapRequest(pranaAmount, 'PRANA', slippage);
            
            // Get fresh quote
            const quote = await this.getPranaToUsdtQuote(pranaAmount);
            const minUsdtAmount = this._calculateMinOutput(quote.outputAmount, slippage);
            
            const userAccount = walletService.account;
            const pranaAmountWei = this.web3.utils.toWei(pranaAmount, 'ether');
            const minUsdtAmountWei = this._parseTokenAmount(minUsdtAmount, 'USDT');
            
            // Ensure approval
            await this._ensureTokenApproval('PRANA', pranaAmountWei, userAccount);
            
            // Estimate gas
            const gasEstimate = await this.exchangeContract.methods
                .sellPRANA(pranaAmountWei)
                .estimateGas({ from: userAccount });
            
            const gasLimit = Math.floor(gasEstimate * 1.2);
            
            // Execute swap
            const swapId = this._generateSwapId();
            this.pendingSwaps.set(swapId, {
                type: 'prana_to_usdt',
                inputAmount: pranaAmount,
                expectedOutput: quote.outputAmount,
                minOutput: minUsdtAmount,
                slippage,
                timestamp: Date.now()
            });
            
            const transaction = this.exchangeContract.methods
                .sellPRANA(pranaAmountWei)
                .send({
                    from: userAccount,
                    gas: gasLimit
                });
            
            // Set up transaction handlers
            this._setupTransactionHandlers(transaction, swapId, 'swapPranaToUsdt');
            
            // Wait for transaction hash
            const txHash = await new Promise((resolve, reject) => {
                transaction.on('transactionHash', resolve);
                transaction.on('error', reject);
                setTimeout(() => reject(new Error('Transaction timeout')), 30000);
            });
            
            logger.logTransaction('swapPranaToUsdt', txHash, { pranaAmount, minUsdtAmount });
            
            // Wait for confirmation
            const receipt = await transaction;
            
            // Clear cache and pending swap
            this._clearCache();
            this.pendingSwaps.delete(swapId);
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'PRANA to USDT swap completed', {
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed
            });
            
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                inputAmount: pranaAmount,
                inputToken: 'PRANA',
                outputToken: 'USDT',
                expectedOutput: quote.outputAmount,
                minOutput: minUsdtAmount,
                slippage
            };
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { pranaAmount, slippage });
            
            // Clean up pending swap
            const failedSwap = Array.from(this.pendingSwaps.entries())
                .find(([_, swap]) => swap.inputAmount === pranaAmount);
            if (failedSwap) {
                this.pendingSwaps.delete(failedSwap[0]);
            }
            
            throw new Error(`Swap failed: ${this._formatError(error)}`);
        }
    }

    /**
     * Execute USDT to PRANA swap
     * @param {string} usdtAmount - Amount of USDT to swap
     * @param {number} slippage - Slippage tolerance (optional)
     * @returns {Promise<Object>} Transaction result
     */
    async swapUsdtToPrana(usdtAmount, slippage = this.defaultSlippage) {
        try {
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Starting USDT to PRANA swap', { usdtAmount, slippage });
            
            // Validate inputs
            await this._validateSwapRequest(usdtAmount, 'USDT', slippage);
            
            // Get fresh quote
            const quote = await this.getUsdtToPranaQuote(usdtAmount);
            const minPranaAmount = this._calculateMinOutput(quote.outputAmount, slippage);
            
            const userAccount = walletService.account;
            const usdtAmountWei = this._parseTokenAmount(usdtAmount, 'USDT');
            const minPranaAmountWei = this.web3.utils.toWei(minPranaAmount, 'ether');
            
            // Ensure approval
            await this._ensureTokenApproval('USDT', usdtAmountWei, userAccount);
            
            // Estimate gas
            const gasEstimate = await this.exchangeContract.methods
                .buyPRANA(usdtAmountWei)
                .estimateGas({ from: userAccount });
            
            const gasLimit = Math.floor(gasEstimate * 1.2);
            
            // Execute swap
            const swapId = this._generateSwapId();
            this.pendingSwaps.set(swapId, {
                type: 'usdt_to_prana',
                inputAmount: usdtAmount,
                expectedOutput: quote.outputAmount,
                minOutput: minPranaAmount,
                slippage,
                timestamp: Date.now()
            });
            
            const transaction = this.exchangeContract.methods
                .buyPRANA(usdtAmountWei)
                .send({
                    from: userAccount,
                    gas: gasLimit
                });
            
            // Set up transaction handlers
            this._setupTransactionHandlers(transaction, swapId, 'swapUsdtToPrana');
            
            // Wait for transaction hash
            const txHash = await new Promise((resolve, reject) => {
                transaction.on('transactionHash', resolve);
                transaction.on('error', reject);
                setTimeout(() => reject(new Error('Transaction timeout')), 30000);
            });
            
            logger.logTransaction('swapUsdtToPrana', txHash, { usdtAmount, minPranaAmount });
            
            // Wait for confirmation
            const receipt = await transaction;
            
            // Clear cache and pending swap
            this._clearCache();
            this.pendingSwaps.delete(swapId);
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'USDT to PRANA swap completed', {
                txHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed
            });
            
            return {
                success: true,
                transactionHash: receipt.transactionHash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed,
                inputAmount: usdtAmount,
                inputToken: 'USDT',
                outputToken: 'PRANA',
                expectedOutput: quote.outputAmount,
                minOutput: minPranaAmount,
                slippage
            };
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { usdtAmount, slippage });
            
            // Clean up pending swap
            const failedSwap = Array.from(this.pendingSwaps.entries())
                .find(([_, swap]) => swap.inputAmount === usdtAmount);
            if (failedSwap) {
                this.pendingSwaps.delete(failedSwap[0]);
            }
            
            throw new Error(`Swap failed: ${this._formatError(error)}`);
        }
    }

    /**
     * Ensure exchange contract is loaded
     * @private
     */
    _ensureExchangeContract() {
        if (!this.exchangeContract) {
            try {
                this.exchangeContract = contractService.getContract('pranaExchange');
                logger.debug(LOG_CONTEXTS.EXCHANGE, 'Exchange contract loaded lazily');
            } catch (error) {
                logger.error(LOG_CONTEXTS.EXCHANGE, 'Failed to load exchange contract', error.message);
                throw new Error('Exchange contract not available');
            }
        }
        return this.exchangeContract;
    }

    /**
     * Validate swap request
     * @param {string} amount - Amount to swap
     * @param {string} token - Token to swap from
     * @param {number} slippage - Slippage tolerance
     * @private
     */
    async _validateSwapRequest(amount, token, slippage) {
        if (!walletService.isConnected) {
            throw new Error('Wallet not connected');
        }
        
        // Ensure exchange contract is available
        this._ensureExchangeContract();
        
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            throw new Error('Invalid swap amount');
        }
        
        if (slippage < 0 || slippage > this.maxSlippage) {
            throw new Error(`Slippage must be between 0% and ${this.maxSlippage}%`);
        }
        
        // Check user balance using ContractService
        const contractName = token === 'PRANA' ? 'pranaToken' : 'usdtToken';
        const userBalance = await contractService.executeCall(contractName, 'balanceOf', [walletService.account]);
        const userBalanceFormatted = this._formatTokenAmount(userBalance, token);
        
        if (amountNum > parseFloat(userBalanceFormatted)) {
            throw new Error(`Insufficient ${token} balance. Available: ${userBalanceFormatted} ${token}`);
        }
    }

    /**
     * Ensure sufficient token approval
     * @param {string} token - Token to approve
     * @param {string} amountWei - Amount in wei
     * @param {string} userAccount - User account
     * @private
     */
    async _ensureTokenApproval(token, amountWei, userAccount) {
        try {
            const contract = token === 'PRANA' ? this.pranaTokenContract : this.usdtTokenContract;
            const exchangeAddress = contractService.getContractAddress('pranaExchange');
            
            const currentAllowance = await contract.methods
                .allowance(userAccount, exchangeAddress)
                .call();
            
            logger.debug(LOG_CONTEXTS.EXCHANGE, `Checking ${token} approval`, {
                required: amountWei,
                current: currentAllowance,
                exchangeAddress
            });
            
            if (this.web3.utils.toBN(currentAllowance).lt(this.web3.utils.toBN(amountWei))) {
                logger.info(LOG_CONTEXTS.EXCHANGE, `Insufficient ${token} approval, requesting approval`);
                
                // Request approval for double the amount for future swaps
                const approvalAmount = this.web3.utils.toBN(amountWei).mul(this.web3.utils.toBN('2'));
                
                const approvalTx = await contract.methods
                    .approve(exchangeAddress, approvalAmount)
                    .send({ from: userAccount });
                
                logger.logTransaction(`${token}_approval`, approvalTx.transactionHash, {
                    spender: exchangeAddress,
                    amount: this._formatTokenAmount(approvalAmount, token)
                });
            }
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { token, context: 'ensureTokenApproval' });
            throw new Error(`${token} approval failed: ${this._formatError(error)}`);
        }
    }

    /**
     * Format token amount based on decimals
     * @param {string} amountWei - Amount in wei
     * @param {string} token - Token symbol
     * @returns {string} Formatted amount
     * @private
     */
    _formatTokenAmount(amountWei, token) {
        const decimals = this.tokenConfig[token]?.decimals || 18;
        if (decimals === 18) {
            return this.web3.utils.fromWei(amountWei, 'ether');
        } else {
            const divisor = this.web3.utils.toBN(10).pow(this.web3.utils.toBN(decimals));
            return this.web3.utils.toBN(amountWei).div(divisor).toString();
        }
    }

    /**
     * Parse token amount to wei based on decimals
     * @param {string} amount - Amount to parse
     * @param {string} token - Token symbol
     * @returns {string} Amount in wei
     * @private
     */
    _parseTokenAmount(amount, token) {
        const decimals = this.tokenConfig[token]?.decimals || 18;
        if (decimals === 18) {
            return this.web3.utils.toWei(amount, 'ether');
        } else {
            // Handle decimal amounts by converting to integer first
            const amountStr = amount.toString();
            const multiplier = this.web3.utils.toBN(10).pow(this.web3.utils.toBN(decimals));
            
            // If amount has decimals, we need to handle it properly
            if (amountStr.includes('.')) {
                // Split into integer and decimal parts
                const [integerPart, decimalPart = ''] = amountStr.split('.');
                
                // Pad or truncate decimal part to match token decimals
                const paddedDecimalPart = decimalPart.padEnd(decimals, '0').slice(0, decimals);
                
                // Combine integer and decimal parts
                const combinedAmount = integerPart + paddedDecimalPart;
                
                return this.web3.utils.toBN(combinedAmount).toString();
            } else {
                // No decimals, simple multiplication
                return this.web3.utils.toBN(amountStr).mul(multiplier).toString();
            }
        }
    }

    /**
     * Calculate exchange rate
     * @param {string} inputAmount - Input amount
     * @param {string} outputAmount - Output amount
     * @returns {string} Exchange rate
     * @private
     */
    _calculateRate(inputAmount, outputAmount) {
        const input = parseFloat(inputAmount);
        const output = parseFloat(outputAmount);
        return (output / input).toFixed(6);
    }

    /**
     * Calculate minimum output considering slippage
     * @param {string} amount - Expected output amount
     * @param {number} slippage - Slippage percentage
     * @returns {string} Minimum output amount
     * @private
     */
    _calculateMinOutput(amount, slippage) {
        const output = parseFloat(amount);
        const minOutput = output * (1 - slippage / 100);
        return minOutput.toFixed(6);
    }

    /**
     * Check if quote cache is valid
     * @returns {boolean} Cache validity
     * @private
     */
    _isQuoteCacheValid() {
        return (Date.now() - this.cache.lastUpdate) < this.quoteCacheTTL;
    }

    /**
     * Clear cache
     * @private
     */
    _clearCache() {
        this.cache.quotes.clear();
        this.cache.exchangeRate = null;
        this.cache.lastUpdate = 0;
        logger.debug(LOG_CONTEXTS.EXCHANGE, 'Exchange cache cleared');
    }

    /**
     * Set up transaction event handlers
     * @param {Object} transaction - Web3 transaction object
     * @param {string} swapId - Swap ID
     * @param {string} type - Transaction type
     * @private
     */
    _setupTransactionHandlers(transaction, swapId, type) {
        transaction.on('transactionHash', (hash) => {
            logger.debug(LOG_CONTEXTS.EXCHANGE, `${type} transaction hash received`, { hash, swapId });
        });
        
        transaction.on('confirmation', (confirmationNumber, receipt) => {
            if (confirmationNumber === 1) {
                logger.info(LOG_CONTEXTS.EXCHANGE, `${type} transaction confirmed`, {
                    swapId,
                    hash: receipt.transactionHash,
                    blockNumber: receipt.blockNumber
                });
            }
        });
        
        transaction.on('error', (error) => {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { swapId, type });
        });
    }

    /**
     * Generate unique swap ID
     * @returns {string} Swap ID
     * @private
     */
    _generateSwapId() {
        return `swap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Format error message for user display
     * @param {Error} error - Error object
     * @returns {string} Formatted error message
     * @private
     */
    _formatError(error) {
        if (error.message.includes('User denied')) {
            return 'Transaction was cancelled by user';
        }
        if (error.message.includes('insufficient funds')) {
            return 'Insufficient funds for transaction';
        }
        if (error.message.includes('execution reverted')) {
            return 'Transaction was reverted by contract';
        }
        if (error.message.includes('slippage')) {
            return 'Price moved too much. Try increasing slippage tolerance';
        }
        
        return error.message;
    }

    // Event handlers
    async _handleWalletConnect(data) {
        logger.info(LOG_CONTEXTS.EXCHANGE, 'Wallet connected, initializing exchange contracts');
        await this._initializeContracts();
        this._clearCache();
    }

    async _handleChainChanged(data) {
        logger.info(LOG_CONTEXTS.EXCHANGE, 'Chain changed, refreshing exchange contracts');
        await this._initializeContracts();
        this._clearCache();
    }

    async _handleAccountChanged(data) {
        logger.info(LOG_CONTEXTS.EXCHANGE, 'Account changed, clearing exchange cache');
        this._clearCache();
    }

    _handleWalletDisconnect() {
        logger.info(LOG_CONTEXTS.EXCHANGE, 'Wallet disconnected, clearing exchange state');
        this.exchangeContract = null;
        this.pranaTokenContract = null;
        this.usdtTokenContract = null;
        this.web3 = null;
        this.tokenConfig = null;
        this._clearCache();
        this.pendingSwaps.clear();
    }

    /**
     * Get service status
     * @returns {Object} Service status
     */
    getStatus() {
        return {
            initialized: !!this.exchangeContract && !!this.pranaTokenContract && !!this.usdtTokenContract,
            walletConnected: walletService.isConnected,
            contractsAvailable: {
                exchange: !!this.exchangeContract,
                pranaToken: !!this.pranaTokenContract,
                usdtToken: !!this.usdtTokenContract
            },
            cacheValid: this._isQuoteCacheValid(),
            pendingSwaps: this.pendingSwaps.size,
            exchangeRate: this.cache.exchangeRate / (this.cache.ratePrecision || 10000),
            lastCacheUpdate: this.cache.lastUpdate
        };
    }

    /**
     * Get current exchange rate
     * @returns {Promise<string>} Current exchange rate
     */
    async getCurrentExchangeRate() {
        try {
            this._ensureExchangeContract();
        } catch (error) {
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange contract not available - returning zero exchange rate');
            return 0;
        }
        
        if (this._isQuoteCacheValid() && this.cache.exchangeRate) {
            return this.cache.exchangeRate / (this.cache.ratePrecision || 10000);
        }
        
        try {
            await this._loadExchangeRate();
            return this.cache.exchangeRate / (this.cache.ratePrecision || 10000);
        } catch (error) {
            logger.warn(LOG_CONTEXTS.EXCHANGE, 'Failed to load exchange rate - returning zero');
            return 0;
        }
    }

    /**
     * Get exchange reserves
     * @returns {Promise<Object>} Exchange reserves and balances
     */
    async getExchangeReserves() {
        try {
            try {
                this._ensureExchangeContract();
            } catch (error) {
                const currentEnv = getEnvironmentName();
                const expectedNetwork = getExpectedNetwork();
                const currentNetwork = walletService.chainId;
                
                logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange contract not available', {
                    environment: currentEnv,
                    expectedNetwork,
                    currentNetwork,
                    reason: 'Contract not initialized or network mismatch'
                });
                return {
                    pranaReserve: '0',
                    usdtReserve: '0',
                    exchangeAddress: '0x0000000000000000000000000000000000000000',
                    exchangeRate: 0,
                    totalValueLocked: {
                        usdt: '0',
                        pranaValueInUsdt: '0'
                    },
                    pranaTotalSupply: '0',
                    usdtTotalSupply: '0',
                    isExchangeAvailable: false,
                    lastUpdate: Date.now()
                };
            }

            // Get exchange contract address
            const exchangeAddress = contractService.getContractAddress('pranaExchange');
            if (!exchangeAddress) {
                throw new Error('Exchange contract address not found');
            }

            // Try to get reserves using the available getBalances() method first
            let pranaBalance, usdtBalance;
            try {
                const balances = await contractService.executeCall('pranaExchange', 'getBalances', []);
                pranaBalance = this.web3.utils.fromWei(balances[0], 'ether');
                usdtBalance = this._formatTokenAmount(balances[1], 'USDT');
            } catch (error) {
                // Fallback to individual reserve methods
                const pranaBalanceRaw = await contractService.executeCall('pranaExchange', 'pranaReserve', []);
                const usdtBalanceRaw = await contractService.executeCall('pranaExchange', 'usdtReserve', []);
                
                pranaBalance = this.web3.utils.fromWei(pranaBalanceRaw, 'ether');
                usdtBalance = this._formatTokenAmount(usdtBalanceRaw, 'USDT');
            }
            
            // Get total supply information if available
            let totalSupplyInfo = {};
            try {
                // Use ContractService.executeCall instead of direct contract method access
                const pranaSupply = await contractService.executeCall('pranaToken', 'totalSupply', []);
                const usdtSupply = await contractService.executeCall('usdtToken', 'totalSupply', []);
                
                totalSupplyInfo = {
                    pranaTotalSupply: this.web3.utils.fromWei(pranaSupply, 'ether'),
                    usdtTotalSupply: this._formatTokenAmount(usdtSupply, 'USDT')
                };
            } catch (e) {
                logger.warn(LOG_CONTEXTS.EXCHANGE, 'Could not fetch total supply info', e.message);
                // Ensure totalSupplyInfo remains a valid object
                totalSupplyInfo = {};
            }
            
            const reserves = {
                pranaReserve: pranaBalance,
                usdtReserve: usdtBalance,
                exchangeAddress,
                exchangeRate: await this.getCurrentExchangeRate(),
                totalValueLocked: {
                    usdt: usdtBalance,
                    pranaValueInUsdt: (parseFloat(pranaBalance) * (await this.getCurrentExchangeRate())).toFixed(6)
                },
                ...totalSupplyInfo,
                lastUpdate: Date.now()
            };
            
            logger.info(LOG_CONTEXTS.EXCHANGE, 'Exchange reserves fetched', reserves);
            
            return reserves;
            
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { context: 'getExchangeReserves' });
            throw new Error(`Failed to fetch exchange reserves: ${this._formatError(error)}`);
        }
    }

    /**
     * Check if exchange has sufficient liquidity for a trade
     * @param {string} amount - Amount to trade
     * @param {string} token - Token to receive (PRANA or USDT)
     * @returns {Promise<boolean>} Whether exchange has sufficient liquidity
     */
    async hasLiquidity(amount, token) {
        try {
            const reserves = await this.getExchangeReserves();
            const amountNum = parseFloat(amount);
            
            if (token === 'PRANA') {
                return parseFloat(reserves.pranaReserve) >= amountNum;
            } else if (token === 'USDT') {
                return parseFloat(reserves.usdtReserve) >= amountNum;
            }
            
            throw new Error('Invalid token specified');
        } catch (error) {
            logger.logError(LOG_CONTEXTS.EXCHANGE, error, { context: 'hasLiquidity', amount, token });
            return false;
        }
    }
}

// Export singleton instance
export const exchangeService = new ExchangeService();

// Export class for testing
export { ExchangeService };