const { ethers } = require("hardhat");

async function main() {
    console.log("🪙 Deploying Mock USDT for testing...");
    
    // Get deployer
    const [deployer] = await ethers.getSigners();
    console.log("👤 Deployer:", deployer.address);
    
    // Deploy Mock USDT
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const initialSupply = ethers.utils.parseUnits("1000000", 6); // 1M USDT
    const mockUSDT = await MockERC20.deploy("Test USDT", "USDT", 6, initialSupply);
    await mockUSDT.deployed();
    
    console.log("✅ Mock USDT deployed to:", mockUSDT.address);
    
    console.log("💰 Minted 1,000,000 test USDT to deployer");
    
    // Update deployment file
    const fs = require("fs");
    const deploymentPath = "./deployments/bscTestnet.json";
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    
    deployment.contracts.usdtToken = {
        address: mockUSDT.address,
        name: "MockERC20",
        symbol: "USDT",
        decimals: 6,
        note: "Mock USDT for testing"
    };
    
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
    console.log("📝 Updated deployment file");
    
    return {
        mockUSDT: mockUSDT.address
    };
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