/**
 * Static API Configuration
 * Replaces the server-side /api/config endpoint with client-side configuration
 */

import { NETWORKS, getContractAddresses } from './network-config.js';

// Environment detection
export const ENVIRONMENT = {
    isDevelopment: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
    isStaging: window.location.hostname.includes('staging') || window.location.hostname.includes('amplifyapp.com'),
    isProduction: window.location.hostname === 'pranavam.ai' || window.location.hostname === 'www.pranavam.ai'
};

// Default networks by environment
export const DEFAULT_NETWORKS = {
    development: 97, // BSC Testnet for local development
    staging: 97,     // BSC Testnet for staging
    production: 56   // BSC Mainnet for production
};

// Get expected network for current environment
export function getExpectedNetwork() {
    if (ENVIRONMENT.isDevelopment) {
        return DEFAULT_NETWORKS.development;
    } else if (ENVIRONMENT.isStaging) {
        return DEFAULT_NETWORKS.staging;
    } else {
        return DEFAULT_NETWORKS.production;
    }
}

// Get environment name
export function getEnvironmentName() {
    if (ENVIRONMENT.isDevelopment) return 'development';
    if (ENVIRONMENT.isStaging) return 'staging';
    return 'production';
}

// Static configuration that was previously served by /api/config endpoint
export const API_CONFIG = {
    networks: {
        [NETWORKS.BSC_MAINNET.hexChainId]: {
            chainId: NETWORKS.BSC_MAINNET.hexChainId,
            chainName: NETWORKS.BSC_MAINNET.name,
            nativeCurrency: NETWORKS.BSC_MAINNET.currency,
            rpcUrls: NETWORKS.BSC_MAINNET.rpcUrls,
            blockExplorerUrls: NETWORKS.BSC_MAINNET.blockExplorerUrls
        },
        [NETWORKS.BSC_TESTNET.hexChainId]: {
            chainId: NETWORKS.BSC_TESTNET.hexChainId,
            chainName: NETWORKS.BSC_TESTNET.name,
            nativeCurrency: NETWORKS.BSC_TESTNET.currency,
            rpcUrls: NETWORKS.BSC_TESTNET.rpcUrls,
            blockExplorerUrls: NETWORKS.BSC_TESTNET.blockExplorerUrls
        }
    },
    contracts: {
        [NETWORKS.BSC_MAINNET.hexChainId]: (() => {
            const addresses = getContractAddresses(NETWORKS.BSC_MAINNET.chainId);
            return {
                PRANA_TOKEN: addresses.pranaToken,
                TOKEN_SWAP: addresses.pranaExchange,
                STAKING: addresses.pranaStaking,
                USDT: addresses.usdtToken
            };
        })(),
        [NETWORKS.BSC_TESTNET.hexChainId]: (() => {
            const addresses = getContractAddresses(NETWORKS.BSC_TESTNET.chainId);
            return {
                PRANA_TOKEN: addresses.pranaToken,
                TOKEN_SWAP: addresses.pranaExchange,
                STAKING: addresses.pranaStaking,
                USDT: addresses.usdtToken
            };
        })()
    }
};

/**
 * Get API configuration (replaces fetch('/api/config'))
 * @returns {Promise<Object>} Configuration object
 */
export async function getApiConfig() {
    // Simulate async API call for compatibility
    return Promise.resolve(API_CONFIG);
}

/**
 * Get contracts for specific network
 * @param {string} hexChainId - Hex chain ID (e.g., '0x38')
 * @returns {Object} Contract addresses
 */
export function getApiContracts(hexChainId) {
    return API_CONFIG.contracts[hexChainId] || {};
}

/**
 * Get network config for specific network
 * @param {string} hexChainId - Hex chain ID (e.g., '0x38')
 * @returns {Object} Network configuration
 */
export function getApiNetwork(hexChainId) {
    return API_CONFIG.networks[hexChainId] || null;
}

export default API_CONFIG;