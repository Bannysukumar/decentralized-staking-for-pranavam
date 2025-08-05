/**
 * Centralized Network Configuration
 * Single source of truth for all network-related settings
 */

export const NETWORKS = {
    BSC_TESTNET: {
        chainId: 97,
        name: 'BSC Testnet',
        shortName: 'bsctest',
        currency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: {
            primary: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
            fallbacks: [
                'https://bsc-testnet.bnbchain.org',
                'https://data-seed-prebsc-2-s1.binance.org:8545/',
                'https://data-seed-prebsc-1-s2.binance.org:8545/',
                'https://bsc-testnet-rpc.publicnode.com'
            ]
        },
        explorer: {
            name: 'BSCScan Testnet',
            url: 'https://testnet.bscscan.com',
            apiUrl: 'https://api-testnet.bscscan.com/api'
        },
        faucet: 'https://testnet.binance.org/faucet-smart',
        isTestnet: true
    },
    
    BSC_MAINNET: {
        chainId: 56,
        name: 'BSC Mainnet',
        shortName: 'bsc',
        currency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: {
            primary: 'https://bsc-dataseed1.binance.org/',
            fallbacks: [
                'https://bsc-dataseed2.binance.org/',
                'https://rpc.ankr.com/bsc',
                'https://bsc-dataseed.binance.org/'
            ]
        },
        explorer: {
            name: 'BSCScan',
            url: 'https://bscscan.com',
            apiUrl: 'https://api.bscscan.com/api'
        },
        isTestnet: false
    }
};

export const DEFAULT_NETWORK = NETWORKS.BSC_TESTNET;

export const SUPPORTED_NETWORKS = [
    NETWORKS.BSC_TESTNET.chainId,
    NETWORKS.BSC_MAINNET.chainId
];

/**
 * Get network configuration by chain ID
 * @param {number} chainId - The chain ID
 * @returns {Object} Network configuration
 */
export function getNetworkConfig(chainId) {
    // Handle null/undefined chainId - default to BSC Testnet
    if (!chainId || chainId === null || chainId === undefined) {
        console.warn(`getNetworkConfig: chainId is ${chainId}, defaulting to BSC Testnet (97)`);
        chainId = 97; // BSC Testnet
    }
    
    const network = Object.values(NETWORKS).find(n => n.chainId === chainId);
    if (!network) {
        console.error(`Unsupported network: ${chainId}. Available networks:`, Object.values(NETWORKS).map(n => n.chainId));
        // Return BSC Testnet as fallback
        return NETWORKS.BSC_TESTNET;
    }
    return network;
}

/**
 * Check if network is supported
 * @param {number} chainId - The chain ID
 * @returns {boolean} Whether network is supported
 */
export function isNetworkSupported(chainId) {
    return SUPPORTED_NETWORKS.includes(Number(chainId));
}

/**
 * Get all RPC URLs for a network (primary + fallbacks)
 * @param {number} chainId - The chain ID
 * @returns {string[]} Array of RPC URLs
 */
export function getRpcUrls(chainId) {
    const network = getNetworkConfig(chainId);
    return [network.rpcUrls.primary, ...network.rpcUrls.fallbacks];
}

/**
 * Get network by short name
 * @param {string} shortName - Network short name
 * @returns {Object} Network configuration
 */
export function getNetworkByShortName(shortName) {
    const network = Object.values(NETWORKS).find(n => n.shortName === shortName);
    if (!network) {
        throw new Error(`Unknown network: ${shortName}`);
    }
    return network;
}