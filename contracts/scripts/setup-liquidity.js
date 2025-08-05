const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to setup initial liquidity for the exchange
 */

async function main() {
  const network = hre.network.name;
  console.log(`💧 Setting up liquidity on ${network}`);
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ No deployment found for network: ${network}`);
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deployment.contracts;
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("👤 Signer:", signer.address);
  
  // Get contract instances
  const pranaToken = await ethers.getContractAt("PRANAToken", contracts.pranaToken.address);
  const pranaExchange = await ethers.getContractAt("PRANAExchange", contracts.pranaExchange.address);
  
  // Configuration
  const PRANA_AMOUNT = ethers.utils.parseEther(process.env.INITIAL_PRANA_LIQUIDITY || "1000000"); // 1M PRANA
  const USDT_AMOUNT = ethers.utils.parseUnits(process.env.INITIAL_USDT_LIQUIDITY || "100000", 6); // 100K USDT
  
  console.log("💰 Adding liquidity:");
  console.log("🪙 PRANA:", ethers.utils.formatEther(PRANA_AMOUNT));
  console.log("💳 USDT:", ethers.utils.formatUnits(USDT_AMOUNT, 6));
  
  try {
    // Check current balances
    const pranaBalance = await pranaToken.balanceOf(signer.address);
    console.log("📊 Current PRANA balance:", ethers.utils.formatEther(pranaBalance));
    
    if (pranaBalance.lt(PRANA_AMOUNT)) {
      console.error("❌ Insufficient PRANA balance");
      process.exit(1);
    }
    
    // If we have a mock USDT (testnet), mint some tokens
    if (contracts.usdtToken.isTestnet) {
      const usdtToken = await ethers.getContractAt("MockERC20", contracts.usdtToken.address);
      console.log("🏭 Minting test USDT tokens...");
      const mintTx = await usdtToken.mint(signer.address, USDT_AMOUNT);
      await mintTx.wait();
    }
    
    // Approve PRANA for exchange
    console.log("🔓 Approving PRANA for exchange...");
    const approvePranaTx = await pranaToken.approve(pranaExchange.address, PRANA_AMOUNT);
    await approvePranaTx.wait();
    
    // Approve USDT for exchange (if we have it)
    if (contracts.usdtToken.isTestnet) {
      const usdtToken = await ethers.getContractAt("MockERC20", contracts.usdtToken.address);
      console.log("🔓 Approving USDT for exchange...");
      const approveUsdtTx = await usdtToken.approve(pranaExchange.address, USDT_AMOUNT);
      await approveUsdtTx.wait();
    }
    
    // Add liquidity
    console.log("💧 Adding liquidity to exchange...");
    const addLiquidityTx = await pranaExchange.addLiquidity(PRANA_AMOUNT, USDT_AMOUNT);
    await addLiquidityTx.wait();
    
    // Check reserves
    const [pranaReserve, usdtReserve] = await pranaExchange.getReserves();
    
    console.log("✅ Liquidity added successfully!");
    console.log("📊 Exchange reserves:");
    console.log("🪙 PRANA:", ethers.utils.formatEther(pranaReserve));
    console.log("💳 USDT:", ethers.utils.formatUnits(usdtReserve, 6));
    
  } catch (error) {
    console.error("❌ Failed to add liquidity:", error);
    process.exit(1);
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