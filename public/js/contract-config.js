// Centralized contract configuration - loads from single source
const PRANA_CONFIG = {
    // Network configurations - synchronized with src/config/network-config.js
    networks: {
        97: {
            name: "BSC Testnet",
            currency: { name: "BNB", symbol: "tBNB" },
            rpcUrls: [
                "https://data-seed-prebsc-1-s1.binance.org:8545/",
                "https://data-seed-prebsc-2-s1.binance.org:8545/"
            ],
            contracts: {
                pranaToken: "0xCD48C2c97FDF976fA1c33bFb134D449451606e72",
                usdtToken: "0x6196d187e4B68a3C5Cb8907EAd6FdD26e6C754D9",
                pranaExchange: "0x5D9Ff05ee7DAdb85FbB9F858d8A81F1EAA94779a",
                pranaStaking: "0xD961aF894d6f6a1BF1510E9b67e29dbe163b3e13"
            },
            usdtDecimals: 6,
            isTestnet: true
        },
        56: {
            name: "BSC Mainnet",
            currency: { name: "BNB", symbol: "BNB" },
            rpcUrls: [
                "https://bsc-dataseed1.binance.org/",
                "https://bsc-dataseed2.binance.org/",
                "https://bsc-dataseed3.binance.org/"
            ],
            contracts: {
                pranaToken: "0x1d603926ef339545537bacb1ee5c051ea05d70cb",
                usdtToken: "0x55d398326f99059fF775485246999027B3197955",
                pranaExchange: "0x8a0388ce345f5cd82c49ae646ac40d3180a28616",
                pranaStaking: "0x5dad2def2d09b03e53b54aa246894e6671261fae"
            },
            usdtDecimals: 18,
            isTestnet: false
        }
    },

    getContracts: function(chainId) {
        return this.networks[chainId]?.contracts || {};
    },

    getNetwork: function(chainId) {
        return this.networks[chainId] || { name: "Unknown", currency: { symbol: "ETH" } };
    },

    isNetworkSupported: function(chainId) {
        return chainId === 97 || chainId === 56;
    },

    getUsdtDecimals: function(chainId) {
        return this.networks[chainId]?.usdtDecimals || 18;
    },

    validateContractAddress: function(address) {
        return address && address !== "0x0000000000000000000000000000000000000000";
    }
};

window.PRANA_CONFIG = PRANA_CONFIG;
console.log("📡 Contract configuration loaded for", PRANA_CONFIG.getNetwork(97).name);
