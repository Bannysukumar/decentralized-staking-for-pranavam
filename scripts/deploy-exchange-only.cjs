const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying PRANA Exchange only...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Already deployed addresses
    const PRANA_TOKEN_ADDRESS = "0x822C13A86A358B74cB454cdBebD6E86B0f16d5aA";
    const USDT_TOKEN_ADDRESS = "0xA9FF03A6422eC7cE67C790E8bEE5DD959DB5C43a";

    console.log("--------------------------------------------------");

    // Deploy PRANA Exchange only
    console.log("🔄 Deploying PRANA Exchange...");
    const PRANAExchange = await hre.ethers.getContractFactory("PRANAExchange");
    const pranaExchange = await PRANAExchange.deploy(
        PRANA_TOKEN_ADDRESS,
        USDT_TOKEN_ADDRESS,
        deployer.address // liquidity provider
    );
    await pranaExchange.deployed();
    console.log("✅ PRANA Exchange deployed to:", pranaExchange.address);

    console.log("\n🎉 ALL CONTRACTS DEPLOYED!");
    console.log("--------------------------------------------------");
    console.log("📋 Final Contract Addresses:");
    console.log("PRANA Token:", PRANA_TOKEN_ADDRESS);
    console.log("PRANA Staking: 0xcfc5FC9B493Edca0177DB1d6cA67951d9E2A5d7C");
    console.log("Mock USDT:", USDT_TOKEN_ADDRESS);
    console.log("PRANA Exchange:", pranaExchange.address);
    console.log("--------------------------------------------------\n");

    // Save complete deployment info
    const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        contracts: {
            PRANA_TOKEN_ADDRESS,
            STAKING_CONTRACT_ADDRESS: "0xcfc5FC9B493Edca0177DB1d6cA67951d9E2A5d7C",
            USDT_TOKEN_ADDRESS,
            EXCHANGE_CONTRACT_ADDRESS: pranaExchange.address
        },
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    console.log("💾 Saving complete deployment info...");
    require('fs').writeFileSync(
        'deployment-addresses.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("✅ Complete deployment info saved!");
    console.log("\n🚀 Ready for launch! Your PRANA DeFi Platform is fully deployed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
    });