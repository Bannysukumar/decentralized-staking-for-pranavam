/**
 * Centralized Network and Contract Configuration
 * Single source of truth for all network and contract addresses
 */

// Network definitions with chain IDs
export const NETWORKS = {
    BSC_MAINNET: {
        chainId: 56,
        hexChainId: '0x38',
        name: 'BNB Smart Chain Mainnet',
        shortName: 'BSC',
        currency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18
        },
        rpcUrls: [
            'https://bsc-dataseed1.binance.org/',
            'https://bsc-dataseed2.binance.org/',
            'https://bsc-dataseed3.binance.org/'
        ],
        blockExplorerUrls: ['https://bscscan.com'],
        isTestnet: false
    },
    BSC_TESTNET: {
        chainId: 97,
        hexChainId: '0x61',
        name: 'BNB Smart Chain Testnet',
        shortName: 'BSC Testnet',
        currency: {
            name: 'BNB',
            symbol: 'tBNB',
            decimals: 18
        },
        rpcUrls: [
            'https://data-seed-prebsc-1-s1.binance.org:8545/',
            'https://data-seed-prebsc-2-s1.binance.org:8545/',
            'https://data-seed-prebsc-1-s2.binance.org:8545/',
            'https://data-seed-prebsc-2-s2.binance.org:8545/',
            'https://data-seed-prebsc-1-s3.binance.org:8545/',
            'https://bsc-testnet.public.blastapi.io',
            'https://bsc-testnet.blockpi.network/v1/rpc/public',
            'https://endpoints.omniatech.io/v1/bsc/testnet/public'
        ],
        blockExplorerUrls: ['https://testnet.bscscan.com'],
        isTestnet: true
    }
};

// Contract addresses by network - SINGLE SOURCE OF TRUTH
export const CONTRACT_ADDRESSES = {
    // BSC Mainnet (Production)
    [NETWORKS.BSC_MAINNET.chainId]: {
        pranaToken: '0x1d603926ef339545537bacb1ee5c051ea05d70cb',
        usdtToken: '0x55d398326f99059fF775485246999027B3197955', // Real USDT
        pranaExchange: '0x8a0388ce345f5cd82c49ae646ac40d3180a28616',
        pranaStaking: '0x5dad2def2d09b03e53b54aa246894e6671261fae',
        owner: '0x5dfC41480463f2aD7E129cD5F2ac8457A0e0aeAA' // Admin/Owner address
    },
    // BSC Testnet (Development/Testing)
    [NETWORKS.BSC_TESTNET.chainId]: {
        pranaToken: '0xCD48C2c97FDF976fA1c33bFb134D449451606e72',
        usdtToken: '0x6196d187e4B68a3C5Cb8907EAd6FdD26e6C754D9', // Mock USDT
        pranaExchange: '0x5D9Ff05ee7DAdb85FbB9F858d8A81F1EAA94779a',
        pranaStaking: '0xD961aF894d6f6a1BF1510E9b67e29dbe163b3e13',
        owner: '0x5dfC41480463f2aD7E129cD5F2ac8457A0e0aeAA' // Admin/Owner address (same as mainnet for now)
    }
};

// Token configurations by network
export const TOKEN_CONFIG = {
    [NETWORKS.BSC_MAINNET.chainId]: {
        PRANA: {
            decimals: 18,
            symbol: 'PRANA',
            name: 'PRANA Token'
        },
        USDT: {
            decimals: 18, // BSC USDT uses 18 decimals
            symbol: 'USDT',
            name: 'Tether USD'
        }
    },
    [NETWORKS.BSC_TESTNET.chainId]: {
        PRANA: {
            decimals: 18,
            symbol: 'PRANA',
            name: 'PRANA Token'
        },
        USDT: {
            decimals: 6, // Mock USDT uses 6 decimals
            symbol: 'USDT',
            name: 'Mock Tether USD'
        }
    }
};

/**
 * Get network configuration by chain ID
 * @param {number} chainId - The chain ID
 * @returns {Object} Network configuration
 */
export function getNetworkConfig(chainId) {
    // Convert string to number if needed
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    
    const network = Object.values(NETWORKS).find(n => n.chainId === numericChainId);
    if (!network) {
        throw new Error(`Unsupported network with chain ID: ${chainId}`);
    }
    return network;
}

/**
 * Get contract addresses for a specific network
 * @param {number} chainId - The chain ID
 * @returns {Object} Contract addresses
 */
export function getContractAddresses(chainId) {
    // Convert string to number if needed
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    
    const addresses = CONTRACT_ADDRESSES[numericChainId];
    if (!addresses) {
        throw new Error(`No contract addresses defined for network ${chainId}. Available networks: ${Object.keys(CONTRACT_ADDRESSES).join(', ')}`);
    }
    return addresses;
}

/**
 * Get token configuration for a specific network
 * @param {number} chainId - The chain ID
 * @returns {Object} Token configuration
 */
export function getTokenConfig(chainId) {
    // Convert string to number if needed and handle null/undefined
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    
    if (!numericChainId || !TOKEN_CONFIG[numericChainId]) {
        console.warn(`No token configuration for network ${chainId}, defaulting to BSC Testnet`);
        return TOKEN_CONFIG[NETWORKS.BSC_TESTNET.chainId];
    }
    
    return TOKEN_CONFIG[numericChainId];
}

/**
 * Check if a network is supported
 * @param {number} chainId - The chain ID
 * @returns {boolean} Whether the network is supported
 */
export function isNetworkSupported(chainId) {
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId;
    return Object.values(NETWORKS).some(n => n.chainId === numericChainId);
}

/**
 * Get the default network (BSC Testnet for development)
 * @returns {Object} Default network configuration
 */
export function getDefaultNetwork() {
    return NETWORKS.BSC_TESTNET;
}

/**
 * Check if an address is valid (not zero address)
 * @param {string} address - Contract address
 * @returns {boolean} Whether address is valid
 */
export function isValidAddress(address) {
    return address && 
           address !== '0x0000000000000000000000000000000000000000' && 
           address.length === 42 && 
           address.startsWith('0x');
}

/**
 * Get deployed contracts for a network (only valid addresses)
 * @param {number} chainId - The chain ID
 * @returns {Object} Deployed contract addresses
 */
export function getDeployedContracts(chainId) {
    const addresses = getContractAddresses(chainId);
    const deployed = {};
    
    Object.keys(addresses).forEach(contractName => {
        if (isValidAddress(addresses[contractName])) {
            deployed[contractName] = addresses[contractName];
        }
    });
    
    return deployed;
}

/**
 * Get all supported networks
 * @returns {Array} Array of network configurations
 */
export function getSupportedNetworks() {
    return Object.values(NETWORKS);
}

/**
 * Get network by hex chain ID
 * @param {string} hexChainId - Hex chain ID (e.g., '0x38')
 * @returns {Object} Network configuration
 */
export function getNetworkByHexId(hexChainId) {
    const network = Object.values(NETWORKS).find(n => n.hexChainId === hexChainId);
    if (!network) {
        throw new Error(`Unsupported network with hex chain ID: ${hexChainId}`);
    }
    return network;
}

export default {
    NETWORKS,
    CONTRACT_ADDRESSES,
    TOKEN_CONFIG,
    getNetworkConfig,
    getContractAddresses,
    getTokenConfig,
    isNetworkSupported,
    getDefaultNetwork,
    isValidAddress,
    getDeployedContracts,
    getSupportedNetworks,
    getNetworkByHexId
};