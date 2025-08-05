const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting PRANA DeFi Platform Deployment...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
  console.log("-".repeat(50));

  // Deploy PRANA Token
  console.log("📄 Deploying PRANA Token...");
  const PRANAToken = await ethers.getContractFactory("PRANAToken");
  const pranaToken = await PRANAToken.deploy();
  await pranaToken.deployed();
  console.log("✅ PRANA Token deployed to:", pranaToken.address);

  // Deploy PRANA Staking
  console.log("\n🔒 Deploying PRANA Staking...");
  const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
  const pranaStaking = await PRANAStaking.deploy(pranaToken.address);
  await pranaStaking.deployed();
  console.log("✅ PRANA Staking deployed to:", pranaStaking.address);

  // For testnet, we'll use a mock USDT contract
  let usdtAddress;
  if (network.chainId === 97) { // BSC Testnet
    console.log("\n💰 Deploying Mock USDT for testnet...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUsdt = await MockUSDT.deploy();
    await mockUsdt.deployed();
    usdtAddress = mockUsdt.address;
    console.log("✅ Mock USDT deployed to:", usdtAddress);
  } else if (network.chainId === 56) { // BSC Mainnet
    usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; // Real USDT on BSC
    console.log("💰 Using real USDT on mainnet:", usdtAddress);
  } else {
    // Deploy mock USDT for local testing
    console.log("\n💰 Deploying Mock USDT for local testing...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUsdt = await MockUSDT.deploy();
    await mockUsdt.deployed();
    usdtAddress = mockUsdt.address;
    console.log("✅ Mock USDT deployed to:", usdtAddress);
  }

  // Deploy PRANA Exchange
  console.log("\n🔄 Deploying PRANA Exchange...");
  const PRANAExchange = await ethers.getContractFactory("PRANAExchange");
  const pranaExchange = await PRANAExchange.deploy(
    pranaToken.address,
    usdtAddress,
    deployer.address // Initial liquidity provider
  );
  await pranaExchange.deployed();
  console.log("✅ PRANA Exchange deployed to:", pranaExchange.address);

  console.log("\n" + "=".repeat(50));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("PRANA Token:", pranaToken.address);
  console.log("PRANA Staking:", pranaStaking.address);
  console.log("USDT Token:", usdtAddress);
  console.log("PRANA Exchange:", pranaExchange.address);
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name, "(Chain ID:", network.chainId + ")");

  // Initial setup
  console.log("\n⚙️  Performing initial setup...");

  // Add staking contract as distributor
  console.log("- Adding staking contract as token distributor...");
  await pranaToken.addDistributor(pranaStaking.address);

  // Add exchange contract as distributor
  console.log("- Adding exchange contract as token distributor...");
  await pranaToken.addDistributor(pranaExchange.address);

  // Transfer initial liquidity to exchange (100M PRANA)
  const liquidityAmount = ethers.utils.parseEther("100000000"); // 100M PRANA
  console.log("- Transferring initial liquidity to exchange...");
  await pranaToken.transfer(pranaExchange.address, liquidityAmount);

  // Transfer staking rewards pool (500M PRANA)
  const stakingPool = ethers.utils.parseEther("500000000"); // 500M PRANA
  console.log("- Transferring staking rewards to staking contract...");
  await pranaToken.transfer(pranaStaking.address, stakingPool);

  console.log("✅ Initial setup completed!");

  // Save contract addresses to file
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      pranaToken: pranaToken.address,
      pranaStaking: pranaStaking.address,
      usdtToken: usdtAddress,
      pranaExchange: pranaExchange.address
    },
    initialSetup: {
      exchangeLiquidity: liquidityAmount.toString(),
      stakingPool: stakingPool.toString()
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `deployment-${network.name}-${Date.now()}.json`;
  const filepath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));

  console.log("\n💾 Deployment info saved to:", filepath);

  // Generate .env update
  console.log("\n📝 Add these to your .env file:");
  console.log(`PRANA_TOKEN_ADDRESS=${pranaToken.address}`);
  console.log(`STAKING_CONTRACT_ADDRESS=${pranaStaking.address}`);
  console.log(`EXCHANGE_CONTRACT_ADDRESS=${pranaExchange.address}`);
  console.log(`USDT_TOKEN_ADDRESS=${usdtAddress}`);

  console.log("\n🎉 Deployment completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });