const { ethers } = require("hardhat");
const fs = require("fs");

/**
 * Interactive testing script for deployed contracts
 * Run with: npx hardhat run scripts/test-interactions.js --network bscTestnet
 */

async function main() {
    console.log("🧪 PRANA Contract Testing Interface");
    console.log("=====================================");

    // Load deployment info
    const deploymentPath = "./deployments/bscTestnet.json";
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ No deployment found. Run deployment first!");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contracts = deployment.contracts;

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("👤 Test Account:", signer.address);

    // Get contract instances
    const pranaToken = await ethers.getContractAt("PRANAToken", contracts.pranaToken.address);
    const usdtToken = await ethers.getContractAt("MockERC20", contracts.usdtToken.address);
    const pranaExchange = await ethers.getContractAt("PRANAExchange", contracts.pranaExchange.address);
    const pranaStaking = await ethers.getContractAt("PRANAStaking", contracts.pranaStaking.address);

    console.log("📄 Contract Addresses:");
    console.log("PRANA Token:", contracts.pranaToken.address);
    console.log("USDT Token:", contracts.usdtToken.address);
    console.log("Exchange:", contracts.pranaExchange.address);
    console.log("Staking:", contracts.pranaStaking.address);
    console.log("");

    // Check balances
    console.log("💰 Current Balances:");
    const pranaBalance = await pranaToken.balanceOf(signer.address);
    const usdtBalance = await usdtToken.balanceOf(signer.address);
    const bnbBalance = await signer.getBalance();

    console.log("PRANA:", ethers.utils.formatEther(pranaBalance));
    console.log("USDT:", ethers.utils.formatUnits(usdtBalance, 6));
    console.log("BNB:", ethers.utils.formatEther(bnbBalance));
    console.log("");

    console.log("🎯 Available Test Functions:");
    console.log("1. Setup Test Tokens (get PRANA & USDT)");
    console.log("2. Test Exchange - Buy PRANA");
    console.log("3. Test Exchange - Sell PRANA");
    console.log("4. Test Staking");
    console.log("5. Check Contract Statistics");
    console.log("");

    // For manual testing, let's run setup automatically
    console.log("🔧 Running automatic setup...");
    await setupTestTokens();
    
    console.log("✅ Setup complete! Now you can:");
    console.log("1. Go to your website and test the UI");
    console.log("2. Use MetaMask to interact with contracts");
    console.log("3. Import tokens using the addresses above");
    console.log("");
    console.log("💡 To run specific tests, modify this script and add the function calls");

    async function setupTestTokens() {
        console.log("📦 Setting up test tokens...");
        
        try {
            // Give user some PRANA (from contract's allocation)
            const categoryId = ethers.utils.id("testing");
            const testAmount = ethers.utils.parseEther("50000"); // 50k PRANA

            // Check if category exists, if not create it
            const existingLimit = await pranaToken.allocationLimits(categoryId);
            if (existingLimit.eq(0)) {
                console.log("Creating test allocation category...");
                await pranaToken.setAllocationLimit(categoryId, ethers.utils.parseEther("100000"));
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log("Distributing PRANA tokens...");
            await pranaToken.distributeAllocation(categoryId, signer.address, testAmount);
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Give user some test USDT
            console.log("Minting test USDT...");
            const usdtAmount = ethers.utils.parseUnits("10000", 6); // 10k USDT
            await usdtToken.mint(signer.address, usdtAmount);
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log("✅ Test tokens distributed!");
            console.log("You now have:");
            console.log("- 50,000 PRANA tokens");
            console.log("- 10,000 USDT tokens");
            
        } catch (error) {
            console.error("❌ Setup failed:", error.message);
        }
    }

    async function testExchangeBuy() {
        console.log("🛒 Testing PRANA purchase...");
        
        const usdtAmount = ethers.utils.parseUnits("100", 6); // 100 USDT
        
        // Approve USDT
        await usdtToken.approve(pranaExchange.address, usdtAmount);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Buy PRANA
        const tx = await pranaExchange.buyPRANA(usdtAmount);
        await tx.wait();
        
        console.log("✅ PRANA purchase completed!");
    }

    async function testExchangeSell() {
        console.log("💸 Testing PRANA sale...");
        
        const pranaAmount = ethers.utils.parseEther("1000"); // 1000 PRANA
        
        // Approve PRANA
        await pranaToken.approve(pranaExchange.address, pranaAmount);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Sell PRANA
        const tx = await pranaExchange.sellPRANA(pranaAmount);
        await tx.wait();
        
        console.log("✅ PRANA sale completed!");
    }

    async function testStaking() {
        console.log("🎁 Testing staking...");
        
        const stakeAmount = ethers.utils.parseEther("1000"); // 1000 PRANA
        
        // Approve PRANA
        await pranaToken.approve(pranaStaking.address, stakeAmount);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Create stake
        const tx = await pranaStaking.createStake(stakeAmount, ethers.constants.AddressZero);
        await tx.wait();
        
        console.log("✅ Staking completed!");
    }

    async function checkContractStats() {
        console.log("📊 Contract Statistics:");
        
        // Exchange stats
        const [pranaReserve, usdtReserve] = await pranaExchange.getReserves();
        console.log("Exchange Reserves:");
        console.log("- PRANA:", ethers.utils.formatEther(pranaReserve));
        console.log("- USDT:", ethers.utils.formatUnits(usdtReserve, 6));
        
        // Staking stats
        const [totalStaked, totalRewardsPaid, totalReferralsPaid, contractBalance] = 
            await pranaStaking.getContractStats();
        console.log("Staking Stats:");
        console.log("- Total Staked:", ethers.utils.formatEther(totalStaked));
        console.log("- Rewards Paid:", ethers.utils.formatEther(totalRewardsPaid));
        console.log("- Referrals Paid:", ethers.utils.formatEther(totalReferralsPaid));
    }

    async function simulateTimeIncrease() {
        console.log("⏰ Simulating time increase (1 day)...");
        
        // Increase time by 1 day
        await network.provider.send("evm_increaseTime", [86400]);
        await network.provider.send("evm_mine");
        
        console.log("✅ Time increased by 1 day - rewards should be available!");
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { main };