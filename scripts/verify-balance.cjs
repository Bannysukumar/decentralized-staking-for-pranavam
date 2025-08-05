const Web3 = require('web3');
const fs = require('fs');

async function verifyBalance() {
    console.log('🔍 Verifying On-Chain Balance...');
    
    // Connect to BSC Testnet
    const web3 = new Web3('https://data-seed-prebsc-1-s1.binance.org:8545/');
    
    // Load contract addresses from centralized config
    // Note: This is hardcoded for now but should load from network-config.js
    const BSC_MAINNET_ADDRESSES = {
        pranaToken: '0x1d603926ef339545537bacb1ee5c051ea05d70cb',
        usdtToken: '0x55d398326f99059fF775485246999027B3197955',
        pranaExchange: '0x8a0388ce345f5cd82c49ae646ac40d3180a28616',
        pranaStaking: '0x5dad2def2d09b03e53b54aa246894e6671261fae'
    };
    
    const PRANA_TOKEN = BSC_MAINNET_ADDRESSES.pranaToken;
    const ADMIN_ADDRESS = '0x5dfC41480463f2aD7E129cD5F2ac8457A0e0aeAA';  // Owner/admin address
    const TRANSFER_TO = '0x33C28346859F0Fb8BC73005d14545046B7a1451f';
    
    // Load PRANA Token ABI
    const pranaABI = JSON.parse(fs.readFileSync('./src/abis/PRANAToken.json', 'utf8')).abi;
    const pranaContract = new web3.eth.Contract(pranaABI, PRANA_TOKEN);
    
    try {
        console.log('📊 Contract Information:');
        console.log('Token Address:', PRANA_TOKEN);
        console.log('Admin Address:', ADMIN_ADDRESS);
        console.log('Transfer To Address:', TRANSFER_TO);
        console.log();
        
        // Check total supply
        const totalSupply = await pranaContract.methods.totalSupply().call();
        const totalSupplyFormatted = web3.utils.fromWei(totalSupply, 'ether');
        console.log('📈 Total Supply:', totalSupplyFormatted, 'PRANA');
        
        // Check admin balance
        const adminBalance = await pranaContract.methods.balanceOf(ADMIN_ADDRESS).call();
        const adminBalanceFormatted = web3.utils.fromWei(adminBalance, 'ether');
        console.log('👤 Admin Balance:', adminBalanceFormatted, 'PRANA');
        
        // Check recipient balance
        const recipientBalance = await pranaContract.methods.balanceOf(TRANSFER_TO).call();
        const recipientBalanceFormatted = web3.utils.fromWei(recipientBalance, 'ether');
        console.log('🎯 Recipient Balance (0x33C2...):', recipientBalanceFormatted, 'PRANA');
        
        // Check if 21B is showing as expected balance
        const expectedTotal = 21000000000;
        const actualTotal = parseFloat(totalSupplyFormatted);
        const expectedAdmin = expectedTotal - 1000000000; // If 1B was transferred
        const actualAdmin = parseFloat(adminBalanceFormatted);
        
        console.log();
        console.log('🧮 Balance Analysis:');
        console.log('Expected Total Supply:', expectedTotal.toLocaleString(), 'PRANA');
        console.log('Actual Total Supply:', actualTotal.toLocaleString(), 'PRANA');
        console.log('Expected Admin After Transfer:', expectedAdmin.toLocaleString(), 'PRANA');
        console.log('Actual Admin Balance:', actualAdmin.toLocaleString(), 'PRANA');
        
        if (actualAdmin === expectedTotal) {
            console.log('⚠️  ISSUE DETECTED: Admin balance shows full supply (transfer may not have occurred)');
        } else if (actualAdmin < expectedTotal) {
            console.log('✅ TRANSFER CONFIRMED: Admin balance is less than total supply');
        }
        
        // Check recent transfer events
        console.log();
        console.log('🔍 Checking Recent Transfer Events...');
        const currentBlock = await web3.eth.getBlockNumber();
        const fromBlock = currentBlock - 10000; // Check last ~10k blocks (about 8 hours)
        
        const transferEvents = await pranaContract.getPastEvents('Transfer', {
            fromBlock: fromBlock,
            toBlock: 'latest',
            filter: { from: ADMIN_ADDRESS }
        });
        
        console.log('Recent Outgoing Transfers from Admin:');
        transferEvents.forEach(event => {
            const amount = web3.utils.fromWei(event.returnValues.value, 'ether');
            console.log(`- To: ${event.returnValues.to}, Amount: ${amount} PRANA, Block: ${event.blockNumber}`);
        });
        
        if (transferEvents.length === 0) {
            console.log('⚠️  No recent transfer events found from admin address');
        }
        
    } catch (error) {
        console.error('❌ Error verifying balance:', error.message);
    }
}

verifyBalance();