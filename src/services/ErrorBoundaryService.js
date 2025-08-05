/**
 * Error Boundary Service
 * Comprehensive error handling and user-friendly error messages
 * Following open-source DApp architecture patterns
 */

import { logger } from './LoggingService.js';

export class ErrorBoundaryService {
    constructor() {
        this.errorHandlers = new Map();
        this.errorQueue = [];
        this.isProcessingErrors = false;
        this.maxErrorsToStore = 50;
        
        // Error types and their handlers
        this.errorTypes = {
            WALLET_ERROR: 'wallet',
            CONTRACT_ERROR: 'contract',
            NETWORK_ERROR: 'network',
            TRANSACTION_ERROR: 'transaction',
            VALIDATION_ERROR: 'validation',
            UNKNOWN_ERROR: 'unknown'
        };
        
        // User-friendly error messages
        this.errorMessages = {
            // Wallet errors
            'wallet_not_connected': 'Please connect your wallet to continue',
            'wallet_locked': 'Please unlock your wallet and try again',
            'wallet_unsupported': 'This wallet is not supported. Please use MetaMask or WalletConnect',
            'user_rejected_request': 'Transaction was cancelled by user',
            'insufficient_funds': 'Insufficient funds for this transaction',
            'network_mismatch': 'Please switch to the correct network',
            
            // Contract errors
            'contract_not_found': 'Smart contract not available. Please try again later',
            'contract_method_failed': 'Transaction failed. Please check your inputs and try again',
            'gas_estimation_failed': 'Unable to estimate transaction cost. Please try with more gas',
            'transaction_reverted': 'Transaction failed. Please check contract conditions',
            
            // Network errors
            'network_unavailable': 'Network is currently unavailable. Please try again',
            'rpc_error': 'Network connection issue. Switching to backup provider',
            'timeout_error': 'Request timed out. Please try again',
            
            // Validation errors
            'invalid_address': 'Please enter a valid wallet address',
            'invalid_amount': 'Please enter a valid amount',
            'amount_too_small': 'Amount is too small for this transaction',
            'amount_too_large': 'Amount exceeds available balance',
            
            // General errors
            'unknown_error': 'An unexpected error occurred. Please try again'
        };
        
        // Initialize global error handlers
        this.initializeGlobalHandlers();
    }
    
    /**
     * Initialize global error handlers
     */
    initializeGlobalHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError(event.error, {
                type: this.errorTypes.UNKNOWN_ERROR,
                context: 'global_error',
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, {
                type: this.errorTypes.UNKNOWN_ERROR,
                context: 'unhandled_promise_rejection'
            });
            event.preventDefault(); // Prevent console error
        });
        
        // Handle Web3 provider errors
        if (window.ethereum) {
            window.ethereum.on('disconnect', (error) => {
                this.handleError(error, {
                    type: this.errorTypes.WALLET_ERROR,
                    context: 'provider_disconnect'
                });
            });
        }
    }
    
    /**
     * Handle error with classification and user notification
     * @param {Error|string} error - Error object or message
     * @param {Object} context - Error context
     */
    handleError(error, context = {}) {
        const errorInfo = this.classifyError(error, context);
        
        // Log error for debugging
        logger.error('ErrorBoundary', errorInfo.originalError, {
            ...context,
            classification: errorInfo.type,
            userMessage: errorInfo.userMessage
        });
        
        // Add to error queue
        this.addToErrorQueue(errorInfo);
        
        // Show user notification
        this.showUserNotification(errorInfo);
        
        // Execute registered error handlers
        this.executeErrorHandlers(errorInfo);
        
        return errorInfo;
    }
    
    /**
     * Classify error and generate user-friendly message
     * @param {Error|string} error - Error to classify
     * @param {Object} context - Error context
     * @returns {Object} Classified error info
     */
    classifyError(error, context) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        const errorCode = error?.code;
        
        let errorType = context.type || this.errorTypes.UNKNOWN_ERROR;
        let userMessage = this.errorMessages.unknown_error;
        let severity = 'error';
        let retryable = true;
        
        // Classify based on error message and code
        if (errorCode === 4001 || errorMessage.includes('User denied') || errorMessage.includes('User rejected')) {
            errorType = this.errorTypes.WALLET_ERROR;
            userMessage = this.errorMessages.user_rejected_request;
            severity = 'info';
            retryable = true;
        } else if (errorCode === -32002 || errorMessage.includes('already processing')) {
            errorType = this.errorTypes.WALLET_ERROR;
            userMessage = 'Please check your wallet for pending requests';
            severity = 'warning';
            retryable = true;
        } else if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
            errorType = this.errorTypes.TRANSACTION_ERROR;
            userMessage = this.errorMessages.insufficient_funds;
            severity = 'error';
            retryable = false;
        } else if (errorMessage.includes('network') || errorMessage.includes('RPC')) {
            errorType = this.errorTypes.NETWORK_ERROR;
            userMessage = this.errorMessages.rpc_error;
            severity = 'warning';
            retryable = true;
        } else if (errorMessage.includes('gas') || errorMessage.includes('Gas')) {
            errorType = this.errorTypes.CONTRACT_ERROR;
            userMessage = this.errorMessages.gas_estimation_failed;
            severity = 'error';
            retryable = true;
        } else if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
            errorType = this.errorTypes.CONTRACT_ERROR;
            userMessage = this.errorMessages.transaction_reverted;
            severity = 'error';
            retryable = true;
        } else if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
            errorType = this.errorTypes.NETWORK_ERROR;
            userMessage = this.errorMessages.timeout_error;
            severity = 'warning';
            retryable = true;
        } else if (errorMessage.includes('MetaMask') || errorMessage.includes('wallet')) {
            errorType = this.errorTypes.WALLET_ERROR;
            if (errorMessage.includes('not found') || errorMessage.includes('not installed')) {
                userMessage = 'Please install MetaMask or connect a supported wallet';
            } else if (errorMessage.includes('locked')) {
                userMessage = this.errorMessages.wallet_locked;
            } else {
                userMessage = 'Wallet connection issue. Please try reconnecting';
            }
            severity = 'error';
            retryable = true;
        }
        
        return {
            type: errorType,
            originalError: error,
            message: errorMessage,
            userMessage,
            severity,
            retryable,
            timestamp: Date.now(),
            context,
            errorCode,
            id: this.generateErrorId()
        };
    }
    
    /**
     * Add error to queue for processing
     * @param {Object} errorInfo - Classified error info
     */
    addToErrorQueue(errorInfo) {
        this.errorQueue.push(errorInfo);
        
        // Limit queue size
        if (this.errorQueue.length > this.maxErrorsToStore) {
            this.errorQueue.shift();
        }
        
        // Process errors if not already processing
        if (!this.isProcessingErrors) {
            this.processErrorQueue();
        }
    }
    
    /**
     * Process error queue
     */
    async processErrorQueue() {
        this.isProcessingErrors = true;
        
        try {
            while (this.errorQueue.length > 0) {
                const errorInfo = this.errorQueue.shift();
                await this.processError(errorInfo);
            }
        } catch (error) {
            logger.error('ErrorBoundary', 'Error processing error queue:', error);
        } finally {
            this.isProcessingErrors = false;
        }
    }
    
    /**
     * Process individual error
     * @param {Object} errorInfo - Error information
     */
    async processError(errorInfo) {
        // Send error to analytics if configured
        this.sendToAnalytics(errorInfo);
        
        // Auto-retry for certain error types
        if (errorInfo.retryable && errorInfo.context.autoRetry) {
            await this.attemptAutoRetry(errorInfo);
        }
    }
    
    /**
     * Show user notification
     * @param {Object} errorInfo - Error information
     */
    showUserNotification(errorInfo) {
        const notification = {
            id: errorInfo.id,
            type: errorInfo.severity,
            message: errorInfo.userMessage,
            timestamp: errorInfo.timestamp,
            retryable: errorInfo.retryable,
            context: errorInfo.context
        };
        
        // Dispatch custom event for UI components to handle
        const event = new CustomEvent('error:notification', { 
            detail: notification 
        });
        window.dispatchEvent(event);
        
        // Also show browser notification for critical errors
        if (errorInfo.severity === 'error' && 'Notification' in window) {
            this.showBrowserNotification(errorInfo);
        }
    }
    
    /**
     * Show browser notification for critical errors
     * @param {Object} errorInfo - Error information
     */
    async showBrowserNotification(errorInfo) {
        try {
            if (Notification.permission === 'granted') {
                new Notification('Pranavam DeFi - Error', {
                    body: errorInfo.userMessage,
                    icon: '/assets/images/logo.jpeg',
                    tag: errorInfo.type
                });
            } else if (Notification.permission !== 'denied') {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    this.showBrowserNotification(errorInfo);
                }
            }
        } catch (error) {
            // Ignore notification errors
        }
    }
    
    /**
     * Execute registered error handlers
     * @param {Object} errorInfo - Error information
     */
    executeErrorHandlers(errorInfo) {
        const handlers = this.errorHandlers.get(errorInfo.type) || [];
        
        handlers.forEach(handler => {
            try {
                handler(errorInfo);
            } catch (handlerError) {
                logger.error('ErrorBoundary', 'Error in error handler:', handlerError);
            }
        });
        
        // Execute global handlers
        const globalHandlers = this.errorHandlers.get('*') || [];
        globalHandlers.forEach(handler => {
            try {
                handler(errorInfo);
            } catch (handlerError) {
                logger.error('ErrorBoundary', 'Error in global error handler:', handlerError);
            }
        });
    }
    
    /**
     * Register error handler
     * @param {string} errorType - Error type or '*' for all errors
     * @param {Function} handler - Error handler function
     */
    registerErrorHandler(errorType, handler) {
        if (!this.errorHandlers.has(errorType)) {
            this.errorHandlers.set(errorType, []);
        }
        this.errorHandlers.get(errorType).push(handler);
    }
    
    /**
     * Unregister error handler
     * @param {string} errorType - Error type
     * @param {Function} handler - Error handler function
     */
    unregisterErrorHandler(errorType, handler) {
        if (this.errorHandlers.has(errorType)) {
            const handlers = this.errorHandlers.get(errorType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    /**
     * Attempt auto-retry for retryable errors
     * @param {Object} errorInfo - Error information
     */
    async attemptAutoRetry(errorInfo) {
        const maxRetries = errorInfo.context.maxRetries || 3;
        const retryDelay = errorInfo.context.retryDelay || 2000;
        const retryFunction = errorInfo.context.retryFunction;
        
        if (!retryFunction || !maxRetries) {
            return;
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                await retryFunction();
                
                // Success - notify user
                const successEvent = new CustomEvent('error:retry:success', {
                    detail: { errorId: errorInfo.id, attempt }
                });
                window.dispatchEvent(successEvent);
                
                return;
            } catch (retryError) {
                if (attempt === maxRetries) {
                    // Final retry failed
                    const failEvent = new CustomEvent('error:retry:failed', {
                        detail: { errorId: errorInfo.id, finalError: retryError }
                    });
                    window.dispatchEvent(failEvent);
                }
            }
        }
    }
    
    /**
     * Send error to analytics
     * @param {Object} errorInfo - Error information
     */
    sendToAnalytics(errorInfo) {
        try {
            // Only send in production and if analytics is configured
            if (typeof window !== 'undefined' && window.gtag && window.location.hostname !== 'localhost') {
                window.gtag('event', 'exception', {
                    description: errorInfo.message,
                    fatal: errorInfo.severity === 'error',
                    error_type: errorInfo.type,
                    custom_map: {
                        error_context: JSON.stringify(errorInfo.context)
                    }
                });
            }
        } catch (analyticsError) {
            // Ignore analytics errors
        }
    }
    
    /**
     * Generate unique error ID
     * @returns {string} Error ID
     */
    generateErrorId() {
        return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Get error statistics
     * @returns {Object} Error statistics
     */
    getErrorStats() {
        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        const lastHour = now - (60 * 60 * 1000);
        
        const recent24h = this.errorQueue.filter(e => e.timestamp > last24h);
        const recentHour = this.errorQueue.filter(e => e.timestamp > lastHour);
        
        return {
            total: this.errorQueue.length,
            last24Hours: recent24h.length,
            lastHour: recentHour.length,
            byType: this.groupErrorsByType(recent24h),
            bySeverity: this.groupErrorsBySeverity(recent24h)
        };
    }
    
    /**
     * Group errors by type
     * @param {Array} errors - Error array
     * @returns {Object} Grouped errors
     */
    groupErrorsByType(errors) {
        return errors.reduce((acc, error) => {
            acc[error.type] = (acc[error.type] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * Group errors by severity
     * @param {Array} errors - Error array
     * @returns {Object} Grouped errors
     */
    groupErrorsBySeverity(errors) {
        return errors.reduce((acc, error) => {
            acc[error.severity] = (acc[error.severity] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * Clear error history
     */
    clearErrorHistory() {
        this.errorQueue = [];
        logger.info('ErrorBoundary', 'Error history cleared');
    }
    
    /**
     * Export error data for debugging
     * @returns {Object} Error data
     */
    exportErrorData() {
        return {
            errors: this.errorQueue.map(error => ({
                ...error,
                originalError: error.originalError?.toString()
            })),
            stats: this.getErrorStats(),
            exportTimestamp: Date.now()
        };
    }
}

// Export singleton instance
export const errorBoundaryService = new ErrorBoundaryService();
export default errorBoundaryService;