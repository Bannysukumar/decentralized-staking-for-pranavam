const express = require('express');
const path = require('path');
const fs = require('fs');

// Import network configuration using ES modules
async function loadNetworkConfig() {
    const { getContractAddresses, getSupportedNetworks } = await import('./src/config/network-config.js');
    return { getContractAddresses, getSupportedNetworks };
}

// Helper function to get contract configuration for API
function getContractConfig() {
    // For now, return the static config. This will be replaced with dynamic loading
    return {
        '0x38': { // BSC Mainnet
            PRANA_TOKEN: '0x1d603926ef339545537bacb1ee5c051ea05d70cb',
            TOKEN_SWAP: '0x8a0388ce345f5cd82c49ae646ac40d3180a28616', // Using exchange address
            STAKING: '0x5dad2def2d09b03e53b54aa246894e6671261fae',
            USDT: '0x55d398326f99059fF775485246999027B3197955'
        },
        '0x61': { // BSC Testnet
            PRANA_TOKEN: '0xCD48C2c97FDF976fA1c33bFb134D449451606e72',
            TOKEN_SWAP: '0x5D9Ff05ee7DAdb85FbB9F858d8A81F1EAA94779a', // Using exchange address
            STAKING: '0xD961aF894d6f6a1BF1510E9b67e29dbe163b3e13',
            USDT: '0x6196d187e4B68a3C5Cb8907EAd6FdD26e6C754D9'
        }
    };
}

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files with proper MIME types from src directory
app.use('/css', express.static('src/css'));
app.use('/styles', express.static('src/styles'));
app.use('/js', express.static('src/js'));
app.use('/services', express.static('src/services'));
app.use('/assets', express.static('src/assets', {
    setHeaders: (res, path) => {
        if (path.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));
app.use('/abis', express.static('src/abis'));

// Add logging middleware for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// API endpoint for config (to avoid exposing keys in frontend)
app.get('/api/config', (req, res) => {
    res.json({
        networks: {
            '0x38': { // BSC Mainnet
                chainId: '0x38',
                chainName: 'BNB Smart Chain Mainnet',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'BNB',
                    decimals: 18
                },
                rpcUrls: ['https://bsc-dataseed.binance.org/'],
                blockExplorerUrls: ['https://bscscan.com']
            },
            '0x61': { // BSC Testnet
                chainId: '0x61',
                chainName: 'BNB Smart Chain Testnet',
                nativeCurrency: {
                    name: 'BNB',
                    symbol: 'tBNB',
                    decimals: 18
                },
                rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
                blockExplorerUrls: ['https://testnet.bscscan.com']
            }
        },
        contracts: getContractConfig()
    });
});

// Routes - now serving from src/pages directory
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'index.html'));
});

app.get('/exchange', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'exchange.html'));
});

app.get('/staking', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'staking.html'));
});

app.get('/whitepaper', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'whitepaper.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'pages', 'admin.html'));
});

// Handle PDF requests specifically
app.get('/assets/pranavam_research_paper.pdf', (req, res) => {
    const filePath = path.join(__dirname, 'src', 'assets', 'pranavam_research_paper.pdf');
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Pranavam_Research_Paper.pdf"');
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Whitepaper PDF not found' });
    }
});

// Handle 404s for non-existing routes
app.use((req, res) => {
    res.status(404).json({ error: 'Page not found' });
});

// Start server - Listen on all interfaces to allow mobile access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pranavam Unified Platform running on:`);
    console.log(`  Local: http://localhost:${PORT}`);
    console.log(`  Network: http://0.0.0.0:${PORT}`);
    console.log(`  Mobile access: Use your laptop's IP address with port ${PORT}`);
    console.log(`  Example: http://192.168.1.100:${PORT}`);
    console.log(`\nAvailable routes:`);
    console.log(`  - http://localhost:${PORT}/`);
    console.log(`  - http://localhost:${PORT}/exchange`);
    console.log(`  - http://localhost:${PORT}/staking`);
    console.log(`  - http://localhost:${PORT}/whitepaper`);
    console.log(`  - http://localhost:${PORT}/admin`);
    console.log(`  - http://localhost:${PORT}/assets/pranavam_research_paper.pdf`);
});