const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying remaining contracts...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);
    console.log("Account balance:", (await deployer.getBalance()).toString());

    // Already deployed addresses
    const PRANA_TOKEN_ADDRESS = "0x822C13A86A358B74cB454cdBebD6E86B0f16d5aA";
    const STAKING_CONTRACT_ADDRESS = "0xcfc5FC9B493Edca0177DB1d6cA67951d9E2A5d7C";

    console.log("--------------------------------------------------");

    // Deploy Mock USDT
    console.log("💰 Deploying Mock USDT for testnet...");
    const MockUSDT = await hre.ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.deployed();
    console.log("✅ Mock USDT deployed to:", mockUSDT.address);

    // Deploy PRANA Exchange
    console.log("🔄 Deploying PRANA Exchange...");
    const PRANAExchange = await hre.ethers.getContractFactory("PRANAExchange");
    const pranaExchange = await PRANAExchange.deploy(
        PRANA_TOKEN_ADDRESS,
        mockUSDT.address,
        deployer.address // liquidity provider
    );
    await pranaExchange.deployed();
    console.log("✅ PRANA Exchange deployed to:", pranaExchange.address);

    console.log("\n🎉 Deployment completed successfully!");
    console.log("--------------------------------------------------");
    console.log("📋 Contract Addresses:");
    console.log("PRANA Token:", PRANA_TOKEN_ADDRESS);
    console.log("PRANA Staking:", STAKING_CONTRACT_ADDRESS);
    console.log("Mock USDT:", mockUSDT.address);
    console.log("PRANA Exchange:", pranaExchange.address);
    console.log("--------------------------------------------------\n");

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        chainId: hre.network.config.chainId,
        contracts: {
            PRANA_TOKEN_ADDRESS,
            STAKING_CONTRACT_ADDRESS,
            USDT_TOKEN_ADDRESS: mockUSDT.address,
            EXCHANGE_CONTRACT_ADDRESS: pranaExchange.address
        },
        deployer: deployer.address,
        timestamp: new Date().toISOString()
    };

    console.log("💾 Saving deployment info...");
    require('fs').writeFileSync(
        'deployment-addresses.json',
        JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("✅ Deployment info saved to deployment-addresses.json");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error.message);
        process.exit(1);
    });