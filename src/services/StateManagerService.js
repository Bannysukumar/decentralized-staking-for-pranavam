/**
 * State Manager Service
 * Centralized state management following modern patterns
 * Inspired by Redux/Zustand architecture for DApp state
 */

import { logger } from './LoggingService.js';

export class StateManagerService {
    constructor() {
        this.state = {
            // Wallet state
            wallet: {
                isConnected: false,
                account: null,
                chainId: null,
                networkConfig: null,
                connectionType: null,
                isConnecting: false,
                error: null
            },
            
            // Contract state
            contracts: {
                isInitialized: false,
                instances: {},
                addresses: {},
                balances: {},
                allowances: {},
                error: null
            },
            
            // Transaction state
            transactions: {
                pending: new Map(),
                completed: new Map(),
                failed: new Map(),
                queue: []
            },
            
            // UI state
            ui: {
                theme: 'light',
                language: 'en',
                notifications: [],
                modals: {},
                loading: {},
                errors: {}
            },
            
            // Application state
            app: {
                isInitialized: false,
                version: '1.0.0',
                networkStatus: 'online',
                lastUpdated: null
            }
        };
        
        this.subscribers = new Map();
        this.middleware = [];
        this.actions = new Map();
        this.reducers = new Map();
        
        // Initialize default actions and reducers
        this.initializeDefaultActions();
        this.initializeDefaultReducers();
        
        // Load persisted state
        this.loadPersistedState();
    }
    
    /**
     * Initialize default actions
     */
    initializeDefaultActions() {
        // Wallet actions
        this.addAction('WALLET_CONNECT_START', () => ({
            type: 'WALLET_CONNECT_START'
        }));
        
        this.addAction('WALLET_CONNECT_SUCCESS', (payload) => ({
            type: 'WALLET_CONNECT_SUCCESS',
            payload
        }));
        
        this.addAction('WALLET_CONNECT_FAILURE', (error) => ({
            type: 'WALLET_CONNECT_FAILURE',
            payload: { error }
        }));
        
        this.addAction('WALLET_DISCONNECT', () => ({
            type: 'WALLET_DISCONNECT'
        }));
        
        this.addAction('WALLET_ACCOUNT_CHANGED', (account) => ({
            type: 'WALLET_ACCOUNT_CHANGED',
            payload: { account }
        }));
        
        this.addAction('WALLET_CHAIN_CHANGED', (chainId, networkConfig) => ({
            type: 'WALLET_CHAIN_CHANGED',
            payload: { chainId, networkConfig }
        }));
        
        // Contract actions
        this.addAction('CONTRACTS_INIT_START', () => ({
            type: 'CONTRACTS_INIT_START'
        }));
        
        this.addAction('CONTRACTS_INIT_SUCCESS', (contracts, addresses) => ({
            type: 'CONTRACTS_INIT_SUCCESS',
            payload: { contracts, addresses }
        }));
        
        this.addAction('CONTRACTS_INIT_FAILURE', (error) => ({
            type: 'CONTRACTS_INIT_FAILURE',
            payload: { error }
        }));
        
        this.addAction('BALANCE_UPDATE', (token, address, balance) => ({
            type: 'BALANCE_UPDATE',
            payload: { token, address, balance }
        }));
        
        this.addAction('ALLOWANCE_UPDATE', (token, owner, spender, allowance) => ({
            type: 'ALLOWANCE_UPDATE',
            payload: { token, owner, spender, allowance }
        }));
        
        // Transaction actions
        this.addAction('TRANSACTION_START', (id, details) => ({
            type: 'TRANSACTION_START',
            payload: { id, details }
        }));
        
        this.addAction('TRANSACTION_SUCCESS', (id, receipt) => ({
            type: 'TRANSACTION_SUCCESS',
            payload: { id, receipt }
        }));
        
        this.addAction('TRANSACTION_FAILURE', (id, error) => ({
            type: 'TRANSACTION_FAILURE',
            payload: { id, error }
        }));
        
        // UI actions
        this.addAction('UI_SET_THEME', (theme) => ({
            type: 'UI_SET_THEME',
            payload: { theme }
        }));
        
        this.addAction('UI_ADD_NOTIFICATION', (notification) => ({
            type: 'UI_ADD_NOTIFICATION',
            payload: { notification: { ...notification, id: this.generateId(), timestamp: Date.now() } }
        }));
        
        this.addAction('UI_REMOVE_NOTIFICATION', (id) => ({
            type: 'UI_REMOVE_NOTIFICATION',
            payload: { id }
        }));
        
        this.addAction('UI_SET_LOADING', (key, isLoading) => ({
            type: 'UI_SET_LOADING',
            payload: { key, isLoading }
        }));
        
        this.addAction('UI_SET_ERROR', (key, error) => ({
            type: 'UI_SET_ERROR',
            payload: { key, error }
        }));
        
        this.addAction('UI_CLEAR_ERROR', (key) => ({
            type: 'UI_CLEAR_ERROR',
            payload: { key }
        }));
    }
    
    /**
     * Initialize default reducers
     */
    initializeDefaultReducers() {
        // Wallet reducer
        this.addReducer('wallet', (state, action) => {
            switch (action.type) {
                case 'WALLET_CONNECT_START':
                    return {
                        ...state,
                        isConnecting: true,
                        error: null
                    };
                    
                case 'WALLET_CONNECT_SUCCESS':
                    return {
                        ...state,
                        isConnected: true,
                        isConnecting: false,
                        account: action.payload.account,
                        chainId: action.payload.chainId,
                        networkConfig: action.payload.networkConfig,
                        connectionType: action.payload.type,
                        error: null
                    };
                    
                case 'WALLET_CONNECT_FAILURE':
                    return {
                        ...state,
                        isConnected: false,
                        isConnecting: false,
                        error: action.payload.error
                    };
                    
                case 'WALLET_DISCONNECT':
                    return {
                        isConnected: false,
                        account: null,
                        chainId: null,
                        networkConfig: null,
                        connectionType: null,
                        isConnecting: false,
                        error: null
                    };
                    
                case 'WALLET_ACCOUNT_CHANGED':
                    return {
                        ...state,
                        account: action.payload.account
                    };
                    
                case 'WALLET_CHAIN_CHANGED':
                    return {
                        ...state,
                        chainId: action.payload.chainId,
                        networkConfig: action.payload.networkConfig
                    };
                    
                default:
                    return state;
            }
        });
        
        // Contracts reducer
        this.addReducer('contracts', (state, action) => {
            switch (action.type) {
                case 'CONTRACTS_INIT_START':
                    return {
                        ...state,
                        isInitialized: false,
                        error: null
                    };
                    
                case 'CONTRACTS_INIT_SUCCESS':
                    return {
                        ...state,
                        isInitialized: true,
                        instances: action.payload.contracts,
                        addresses: action.payload.addresses,
                        error: null
                    };
                    
                case 'CONTRACTS_INIT_FAILURE':
                    return {
                        ...state,
                        isInitialized: false,
                        error: action.payload.error
                    };
                    
                case 'BALANCE_UPDATE':
                    return {
                        ...state,
                        balances: {
                            ...state.balances,
                            [`${action.payload.token}_${action.payload.address}`]: action.payload.balance
                        }
                    };
                    
                case 'ALLOWANCE_UPDATE':
                    return {
                        ...state,
                        allowances: {
                            ...state.allowances,
                            [`${action.payload.token}_${action.payload.owner}_${action.payload.spender}`]: action.payload.allowance
                        }
                    };
                    
                default:
                    return state;
            }
        });
        
        // Transactions reducer
        this.addReducer('transactions', (state, action) => {
            switch (action.type) {
                case 'TRANSACTION_START':
                    const newPending = new Map(state.pending);
                    newPending.set(action.payload.id, {
                        ...action.payload.details,
                        startTime: Date.now(),
                        status: 'pending'
                    });
                    return {
                        ...state,
                        pending: newPending
                    };
                    
                case 'TRANSACTION_SUCCESS':
                    const successPending = new Map(state.pending);
                    const successCompleted = new Map(state.completed);
                    const txData = successPending.get(action.payload.id);
                    
                    if (txData) {
                        successPending.delete(action.payload.id);
                        successCompleted.set(action.payload.id, {
                            ...txData,
                            receipt: action.payload.receipt,
                            completedTime: Date.now(),
                            status: 'completed'
                        });
                    }
                    
                    return {
                        ...state,
                        pending: successPending,
                        completed: successCompleted
                    };
                    
                case 'TRANSACTION_FAILURE':
                    const failPending = new Map(state.pending);
                    const failFailed = new Map(state.failed);
                    const failedTxData = failPending.get(action.payload.id);
                    
                    if (failedTxData) {
                        failPending.delete(action.payload.id);
                        failFailed.set(action.payload.id, {
                            ...failedTxData,
                            error: action.payload.error,
                            failedTime: Date.now(),
                            status: 'failed'
                        });
                    }
                    
                    return {
                        ...state,
                        pending: failPending,
                        failed: failFailed
                    };
                    
                default:
                    return state;
            }
        });
        
        // UI reducer
        this.addReducer('ui', (state, action) => {
            switch (action.type) {
                case 'UI_SET_THEME':
                    return {
                        ...state,
                        theme: action.payload.theme
                    };
                    
                case 'UI_ADD_NOTIFICATION':
                    return {
                        ...state,
                        notifications: [...state.notifications, action.payload.notification]
                    };
                    
                case 'UI_REMOVE_NOTIFICATION':
                    return {
                        ...state,
                        notifications: state.notifications.filter(n => n.id !== action.payload.id)
                    };
                    
                case 'UI_SET_LOADING':
                    return {
                        ...state,
                        loading: {
                            ...state.loading,
                            [action.payload.key]: action.payload.isLoading
                        }
                    };
                    
                case 'UI_SET_ERROR':
                    return {
                        ...state,
                        errors: {
                            ...state.errors,
                            [action.payload.key]: action.payload.error
                        }
                    };
                    
                case 'UI_CLEAR_ERROR':
                    const newErrors = { ...state.errors };
                    delete newErrors[action.payload.key];
                    return {
                        ...state,
                        errors: newErrors
                    };
                    
                default:
                    return state;
            }
        });
    }
    
    /**
     * Add action creator
     * @param {string} name - Action name
     * @param {Function} creator - Action creator function
     */
    addAction(name, creator) {
        this.actions.set(name, creator);
    }
    
    /**
     * Add reducer
     * @param {string} slice - State slice name
     * @param {Function} reducer - Reducer function
     */
    addReducer(slice, reducer) {
        this.reducers.set(slice, reducer);
    }
    
    /**
     * Dispatch action
     * @param {string|Object} actionOrType - Action object or action type
     * @param {...any} args - Action arguments if using action type
     */
    dispatch(actionOrType, ...args) {
        let action;
        
        if (typeof actionOrType === 'string') {
            const actionCreator = this.actions.get(actionOrType);
            if (!actionCreator) {
                logger.warn('StateManager', `Unknown action: ${actionOrType}`);
                return;
            }
            action = actionCreator(...args);
        } else {
            action = actionOrType;
        }
        
        // Apply middleware
        const finalAction = this.applyMiddleware(action);
        
        // Update state using reducers
        const newState = { ...this.state };
        let stateChanged = false;
        
        for (const [slice, reducer] of this.reducers.entries()) {
            const currentSliceState = this.state[slice];
            const newSliceState = reducer(currentSliceState, finalAction);
            
            if (newSliceState !== currentSliceState) {
                newState[slice] = newSliceState;
                stateChanged = true;
            }
        }
        
        if (stateChanged) {
            const previousState = this.state;
            this.state = newState;
            this.state.app.lastUpdated = Date.now();
            
            // Notify subscribers
            this.notifySubscribers(previousState, finalAction);
            
            // Persist state if needed
            this.persistState();
            
            logger.debug('StateManager', 'State updated', {
                action: finalAction.type,
                stateKeys: Object.keys(newState).filter(key => 
                    newState[key] !== previousState[key]
                )
            });
        }
    }
    
    /**
     * Get current state
     * @param {string} slice - Optional state slice
     * @returns {any} Current state or state slice
     */
    getState(slice) {
        return slice ? this.state[slice] : this.state;
    }
    
    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function
     * @param {string} slice - Optional state slice to watch
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback, slice = null) {
        const id = this.generateId();
        
        this.subscribers.set(id, {
            callback,
            slice
        });
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(id);
        };
    }
    
    /**
     * Add middleware
     * @param {Function} middleware - Middleware function
     */
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }
    
    /**
     * Apply middleware to action
     * @param {Object} action - Action object
     * @returns {Object} Processed action
     */
    applyMiddleware(action) {
        return this.middleware.reduce((acc, middleware) => {
            return middleware(acc, this.getState.bind(this), this.dispatch.bind(this));
        }, action);
    }
    
    /**
     * Notify subscribers of state changes
     * @param {Object} previousState - Previous state
     * @param {Object} action - Dispatched action
     */
    notifySubscribers(previousState, action) {
        for (const [id, subscriber] of this.subscribers.entries()) {
            try {
                if (subscriber.slice) {
                    // Only notify if the specific slice changed
                    if (this.state[subscriber.slice] !== previousState[subscriber.slice]) {
                        subscriber.callback(
                            this.state[subscriber.slice],
                            previousState[subscriber.slice],
                            action
                        );
                    }
                } else {
                    // Notify of all state changes
                    subscriber.callback(this.state, previousState, action);
                }
            } catch (error) {
                logger.error('StateManager', `Error in subscriber ${id}:`, error);
                // Remove problematic subscriber
                this.subscribers.delete(id);
            }
        }
    }
    
    /**
     * Create selector for derived state
     * @param {Function} selector - Selector function
     * @returns {Function} Selector with memoization
     */
    createSelector(selector) {
        let lastResult;
        let lastArgs;
        
        return (...args) => {
            // Simple memoization based on shallow comparison
            if (!lastArgs || !this.shallowEqual(args, lastArgs)) {
                lastResult = selector(this.state, ...args);
                lastArgs = args;
            }
            
            return lastResult;
        };
    }
    
    /**
     * Shallow equality check
     * @param {Array} a - First array
     * @param {Array} b - Second array
     * @returns {boolean} Are arrays shallowly equal
     */
    shallowEqual(a, b) {
        if (a.length !== b.length) return false;
        
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        
        return true;
    }
    
    /**
     * Load persisted state from localStorage
     */
    loadPersistedState() {
        try {
            const persistedState = localStorage.getItem('pranavam_state');
            if (persistedState) {
                const parsed = JSON.parse(persistedState);
                
                // Only restore certain parts of state
                if (parsed.ui?.theme) {
                    this.state.ui.theme = parsed.ui.theme;
                }
                
                if (parsed.ui?.language) {
                    this.state.ui.language = parsed.ui.language;
                }
                
                logger.debug('StateManager', 'Persisted state loaded');
            }
        } catch (error) {
            logger.warn('StateManager', 'Failed to load persisted state:', error);
        }
    }
    
    /**
     * Persist state to localStorage
     */
    persistState() {
        try {
            const stateToPersist = {
                ui: {
                    theme: this.state.ui.theme,
                    language: this.state.ui.language
                },
                app: {
                    version: this.state.app.version,
                    lastUpdated: this.state.app.lastUpdated
                }
            };
            
            localStorage.setItem('pranavam_state', JSON.stringify(stateToPersist));
        } catch (error) {
            logger.warn('StateManager', 'Failed to persist state:', error);
        }
    }
    
    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Reset state to initial values
     * @param {Array} slices - Optional array of slices to reset
     */
    resetState(slices = null) {
        if (slices) {
            slices.forEach(slice => {
                if (this.state[slice]) {
                    // Reset specific slices (implementation depends on slice)
                    this.dispatch('RESET_SLICE', slice);
                }
            });
        } else {
            // Reset entire state
            this.state = {
                wallet: {
                    isConnected: false,
                    account: null,
                    chainId: null,
                    networkConfig: null,
                    connectionType: null,
                    isConnecting: false,
                    error: null
                },
                contracts: {
                    isInitialized: false,
                    instances: {},
                    addresses: {},
                    balances: {},
                    allowances: {},
                    error: null
                },
                transactions: {
                    pending: new Map(),
                    completed: new Map(),
                    failed: new Map(),
                    queue: []
                },
                ui: {
                    theme: 'light',
                    language: 'en',
                    notifications: [],
                    modals: {},
                    loading: {},
                    errors: {}
                },
                app: {
                    isInitialized: false,
                    version: '1.0.0',
                    networkStatus: 'online',
                    lastUpdated: Date.now()
                }
            };
            
            this.notifySubscribers({}, { type: 'RESET_STATE' });
        }
    }
    
    /**
     * Get state statistics
     * @returns {Object} State statistics
     */
    getStateStats() {
        return {
            subscribersCount: this.subscribers.size,
            middlewareCount: this.middleware.length,
            actionsCount: this.actions.size,
            reducersCount: this.reducers.size,
            lastUpdated: this.state.app.lastUpdated,
            memorySize: JSON.stringify(this.state).length
        };
    }
}

// Create middleware for logging actions in development
export const loggingMiddleware = (action, getState, dispatch) => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        logger.debug('StateManager', 'Action dispatched:', action);
    }
    return action;
};

// Create middleware for analytics
export const analyticsMiddleware = (action, getState, dispatch) => {
    if (typeof window !== 'undefined' && window.gtag && window.location.hostname !== 'localhost') {
        // Track important actions
        const trackableActions = [
            'WALLET_CONNECT_SUCCESS',
            'TRANSACTION_SUCCESS',
            'TRANSACTION_FAILURE'
        ];
        
        if (trackableActions.includes(action.type)) {
            window.gtag('event', 'state_action', {
                event_category: 'StateManager',
                event_label: action.type
            });
        }
    }
    return action;
};

// Export singleton instance
export const stateManager = new StateManagerService();

// Add default middleware
stateManager.addMiddleware(loggingMiddleware);
stateManager.addMiddleware(analyticsMiddleware);

export default stateManager;