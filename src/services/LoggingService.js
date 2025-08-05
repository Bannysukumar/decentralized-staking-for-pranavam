/**
 * Centralized Logging Service
 * Provides configurable logging with levels, contexts, and external integration
 */

export const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
    TRACE: 4
};

export const LOG_CONTEXTS = {
    WALLET: 'wallet',
    CONTRACT: 'contract',
    STAKING: 'staking',
    EXCHANGE: 'exchange',
    NETWORK: 'network',
    UI: 'ui',
    TRANSACTION: 'transaction',
    STATE: 'state',
    SYNC: 'sync',
    SERVICE: 'service'
};

class LoggingService {
    constructor() {
        this.level = LOG_LEVELS.INFO;
        this.enabledContexts = new Set(Object.values(LOG_CONTEXTS));
        this.externalLoggers = [];
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        
        // Load configuration from localStorage or environment
        this.loadConfiguration();
    }

    /**
     * Load logging configuration
     */
    loadConfiguration() {
        try {
            const config = localStorage.getItem('logging_config');
            if (config) {
                const parsed = JSON.parse(config);
                this.level = parsed.level ?? LOG_LEVELS.INFO;
                this.enabledContexts = new Set(parsed.contexts ?? Object.values(LOG_CONTEXTS));
            }
        } catch (error) {
            console.warn('Failed to load logging configuration:', error);
        }

        // Environment-based configuration
        if (typeof window !== 'undefined' && window.PRANA_DEBUG) {
            this.level = LOG_LEVELS.DEBUG;
        }
    }

    /**
     * Set logging level
     * @param {number} level - Log level
     */
    setLevel(level) {
        this.level = level;
        this.saveConfiguration();
    }

    /**
     * Enable/disable specific context
     * @param {string} context - Log context
     * @param {boolean} enabled - Whether to enable
     */
    setContextEnabled(context, enabled) {
        if (enabled) {
            this.enabledContexts.add(context);
        } else {
            this.enabledContexts.delete(context);
        }
        this.saveConfiguration();
    }

    /**
     * Add external logger (e.g., analytics service)
     * @param {Function} logger - External logging function
     */
    addExternalLogger(logger) {
        this.externalLoggers.push(logger);
    }

    /**
     * Save configuration to localStorage
     */
    saveConfiguration() {
        try {
            const config = {
                level: this.level,
                contexts: Array.from(this.enabledContexts)
            };
            localStorage.setItem('logging_config', JSON.stringify(config));
        } catch (error) {
            console.warn('Failed to save logging configuration:', error);
        }
    }

    /**
     * Internal logging method
     * @param {number} level - Log level
     * @param {string} context - Log context
     * @param {string} message - Log message
     * @param {any[]} args - Additional arguments
     */
    _log(level, context, message, ...args) {
        // Check if logging is enabled for this level and context
        if (level > this.level || !this.enabledContexts.has(context)) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = this._getLevelName(level);
        const formattedMessage = `[${timestamp}] [${levelName}] [${context.toUpperCase()}] ${message}`;

        // Log to console with appropriate method
        const consoleMethod = this._getConsoleMethod(level);
        consoleMethod(formattedMessage, ...args);

        // Add to buffer
        this._addToBuffer({
            timestamp,
            level,
            levelName,
            context,
            message,
            args,
            formattedMessage
        });

        // Send to external loggers
        this._sendToExternalLoggers(level, context, message, args);
    }

    /**
     * Get level name
     * @param {number} level - Log level
     * @returns {string} Level name
     */
    _getLevelName(level) {
        const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
        return levelNames[level] || 'UNKNOWN';
    }

    /**
     * Get appropriate console method
     * @param {number} level - Log level
     * @returns {Function} Console method
     */
    _getConsoleMethod(level) {
        switch (level) {
            case LOG_LEVELS.ERROR:
                return console.error;
            case LOG_LEVELS.WARN:
                return console.warn;
            case LOG_LEVELS.DEBUG:
            case LOG_LEVELS.TRACE:
                return console.debug;
            default:
                return console.log;
        }
    }

    /**
     * Add log entry to buffer
     * @param {Object} entry - Log entry
     */
    _addToBuffer(entry) {
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer.shift();
        }
    }

    /**
     * Send to external loggers
     * @param {number} level - Log level
     * @param {string} context - Log context
     * @param {string} message - Log message
     * @param {any[]} args - Additional arguments
     */
    _sendToExternalLoggers(level, context, message, args) {
        this.externalLoggers.forEach(logger => {
            try {
                logger({ level, context, message, args, timestamp: new Date() });
            } catch (error) {
                console.error('External logger failed:', error);
            }
        });
    }

    // Public logging methods
    error(context, message, ...args) {
        this._log(LOG_LEVELS.ERROR, context, message, ...args);
    }

    warn(context, message, ...args) {
        this._log(LOG_LEVELS.WARN, context, message, ...args);
    }

    info(context, message, ...args) {
        this._log(LOG_LEVELS.INFO, context, message, ...args);
    }

    debug(context, message, ...args) {
        this._log(LOG_LEVELS.DEBUG, context, message, ...args);
    }

    trace(context, message, ...args) {
        this._log(LOG_LEVELS.TRACE, context, message, ...args);
    }

    /**
     * Get recent logs
     * @param {number} count - Number of logs to return
     * @param {string} context - Filter by context (optional)
     * @returns {Array} Recent log entries
     */
    getRecentLogs(count = 100, context = null) {
        let logs = this.logBuffer;
        
        if (context) {
            logs = logs.filter(log => log.context === context);
        }
        
        return logs.slice(-count);
    }

    /**
     * Clear log buffer
     */
    clearBuffer() {
        this.logBuffer = [];
    }

    /**
     * Export logs as JSON
     * @returns {string} JSON string of logs
     */
    exportLogs() {
        return JSON.stringify(this.logBuffer, null, 2);
    }

    /**
     * Log transaction details
     * @param {string} type - Transaction type
     * @param {string} hash - Transaction hash
     * @param {Object} details - Transaction details
     */
    logTransaction(type, hash, details = {}) {
        this.info(LOG_CONTEXTS.TRANSACTION, `${type} transaction: ${hash}`, details);
    }

    /**
     * Log contract interaction
     * @param {string} contract - Contract name
     * @param {string} method - Method name
     * @param {Object} params - Method parameters
     */
    logContractCall(contract, method, params = {}) {
        this.debug(LOG_CONTEXTS.CONTRACT, `${contract}.${method}()`, params);
    }

    /**
     * Log error with stack trace
     * @param {string} context - Error context
     * @param {Error} error - Error object
     * @param {Object} additionalInfo - Additional error information
     */
    logError(context, error, additionalInfo = {}) {
        this.error(context, error.message, {
            stack: error.stack,
            ...additionalInfo
        });
    }

    /**
     * Log performance metrics
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} metadata - Additional metadata
     */
    logPerformance(operation, duration, metadata = {}) {
        this.debug(LOG_CONTEXTS.UI, `Performance: ${operation} took ${duration}ms`, metadata);
    }
}

// Create and export singleton instance
export const logger = new LoggingService();

// Export class for testing
export { LoggingService };