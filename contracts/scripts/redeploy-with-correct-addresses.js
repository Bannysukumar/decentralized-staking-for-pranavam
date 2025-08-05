const { ethers } = require("hardhat");
const { config } = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
config();

console.log("🔧 PRANAVAM REDEPLOYMENT WITH CORRECT ADDRESSES");
console.log("=============================================");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log("📡 Network:", network);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");
  console.log("");

  const deployedContracts = {};
  
  // Step 1: Deploy MockUSDT for testnet
  console.log("📦 Step 1: Deploying MockUSDT Token...");
  const MockUSDT = await ethers.getContractFactory("MockERC20");
  const mockUSDT = await MockUSDT.deploy(
    "Test USDT",
    "USDT",
    6, // 6 decimals for USDT
    ethers.utils.parseUnits("1000000000", 6) // 1 billion USDT
  );
  await mockUSDT.deployed();
  deployedContracts.mockUSDT = mockUSDT;
  
  console.log("✅ MockUSDT deployed to:", mockUSDT.address);
  console.log("📊 Total Supply:", ethers.utils.formatUnits(await mockUSDT.totalSupply(), 6), "USDT");
  console.log("");

  // Step 2: Deploy PRANA Token
  console.log("📦 Step 2: Deploying PRANA Token...");
  const PRANAToken = await ethers.getContractFactory("PRANAToken");
  const pranaToken = await PRANAToken.deploy();
  await pranaToken.deployed();
  deployedContracts.pranaToken = pranaToken;
  
  console.log("✅ PRANA Token deployed to:", pranaToken.address);
  console.log("📊 Total Supply:", ethers.utils.formatEther(await pranaToken.totalSupply()), "PRANA");
  console.log("");

  // Step 3: Deploy PRANA Exchange with CORRECT addresses
  console.log("📦 Step 3: Deploying PRANA Exchange...");
  const PRANAExchange = await ethers.getContractFactory("PRANAExchange");
  const pranaExchange = await PRANAExchange.deploy(
    pranaToken.address,  // Correct PRANA address
    mockUSDT.address     // Correct MockUSDT address
  );
  await pranaExchange.deployed();
  deployedContracts.pranaExchange = pranaExchange;
  
  console.log("✅ PRANA Exchange deployed to:", pranaExchange.address);
  console.log("🔗 PRANA Token:", await pranaExchange.pranaToken());
  console.log("🔗 USDT Token:", await pranaExchange.usdtToken());
  console.log("");

  // Step 4: Deploy PRANA Staking
  console.log("📦 Step 4: Deploying PRANA Staking...");
  const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
  const pranaStaking = await PRANAStaking.deploy(pranaToken.address);
  await pranaStaking.deployed();
  deployedContracts.pranaStaking = pranaStaking;
  
  console.log("✅ PRANA Staking deployed to:", pranaStaking.address);
  console.log("");

  // Step 5: Fund exchange with initial liquidity
  console.log("📦 Step 5: Funding Exchange with Liquidity...");
  
  // Transfer PRANA to exchange (10,000 PRANA)
  const pranaLiquidity = ethers.utils.parseEther("10000");
  const pranaTransfer = await pranaToken.transfer(pranaExchange.address, pranaLiquidity);
  await pranaTransfer.wait();
  console.log("✅ PRANA transferred:", ethers.utils.formatEther(pranaLiquidity));

  // Transfer USDT to exchange (1,000 USDT)
  const usdtLiquidity = ethers.utils.parseUnits("1000", 6);
  const usdtTransfer = await mockUSDT.transfer(pranaExchange.address, usdtLiquidity);
  await usdtTransfer.wait();
  console.log("✅ MockUSDT transferred:", ethers.utils.formatUnits(usdtLiquidity, 6));
  
  // Transfer remaining tokens to deployer for testing
  const userPRANA = ethers.utils.parseEther("50000");
  const userUSDT = ethers.utils.parseUnits("1000000", 6);
  
  console.log("📤 Transferring tokens to deployer for testing...");
  // PRANA is already owned by deployer, just transfer USDT
  const userUsdtTransfer = await mockUSDT.transfer(deployer.address, userUSDT);
  await userUsdtTransfer.wait();
  console.log("✅ Test tokens transferred to deployer");
  console.log("");

  // Step 6: Verify exchange liquidity
  console.log("📦 Step 6: Verifying Exchange Liquidity...");
  try {
    const exchangePranaBalance = await pranaToken.balanceOf(pranaExchange.address);
    const exchangeUsdtBalance = await mockUSDT.balanceOf(pranaExchange.address);
    
    console.log("🏦 Exchange PRANA Balance:", ethers.utils.formatEther(exchangePranaBalance));
    console.log("🏦 Exchange USDT Balance:", ethers.utils.formatUnits(exchangeUsdtBalance, 6));
    
    // Also check contract methods
    const contractPranaBalance = await pranaExchange.getPRANABalance();
    const contractUsdtBalance = await pranaExchange.getUsdtBalance();
    
    console.log("📊 Contract PRANA Balance:", ethers.utils.formatEther(contractPranaBalance));
    console.log("📊 Contract USDT Balance:", ethers.utils.formatUnits(contractUsdtBalance, 6));
    
    if (contractPranaBalance.toString() !== exchangePranaBalance.toString()) {
      console.log("⚠️ Warning: Contract balance method shows different value");
    }
    
  } catch (error) {
    console.log("⚠️ Could not verify exchange liquidity:", error.message);
  }
  console.log("");

  // Step 7: Save deployment information
  console.log("📦 Step 7: Saving Deployment Information...");
  
  const deploymentInfo = {
    network: network,
    chainId: network === "bscTestnet" ? 97 : 56,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      pranaToken: {
        address: pranaToken.address,
        name: "PRANAToken",
        totalSupply: (await pranaToken.totalSupply()).toString(),
        deploymentHash: pranaTransfer.hash
      },
      usdtToken: {
        address: mockUSDT.address,
        name: "MockERC20",
        symbol: "USDT",
        decimals: 6,
        note: "Mock USDT for testing"
      },
      pranaExchange: {
        address: pranaExchange.address,
        name: "PRANAExchange", 
        pranaPrice: "100000",
        minBuyAmount: "50000000",
        minSellAmount: "1000000000000000000000"
      },
      pranaStaking: {
        address: pranaStaking.address,
        name: "PRANAStaking",
        dailyRoiRate: "1200",
        roiCapMultiplier: "200", 
        minStakeAmount: "10000000000000000000"
      }
    },
    status: "complete",
    notes: "Contracts deployed successfully with correct token addresses and initial liquidity."
  };

  // Save to deployments directory
  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  const deploymentsDir = path.dirname(deploymentPath);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("💾 Deployment info saved to:", deploymentPath);
  
  // Step 8: Update frontend configuration
  console.log("📦 Step 8: Updating Frontend Configuration...");
  
  const frontendConfigPath = path.join(__dirname, "../../public/js/contract-config.js");
  const frontendConfig = `// Automatically generated contract configuration
// Generated on: ${new Date().toISOString()}
// Network: ${network} (Chain ID: ${deploymentInfo.chainId})

const PRANA_CONFIG = {
    networks: {
        97: { // BSC Testnet
            name: "BSC Testnet",
            currency: { name: "BNB", symbol: "BNB" },
            rpcUrls: [
                "https://data-seed-prebsc-1-s1.binance.org:8545/",
                "https://data-seed-prebsc-2-s1.binance.org:8545/"
            ],
            contracts: {
                pranaToken: "${pranaToken.address}",
                usdtToken: "${mockUSDT.address}",
                pranaExchange: "${pranaExchange.address}",
                pranaStaking: "${pranaStaking.address}"
            },
            usdtDecimals: 6
        },
        56: { // BSC Mainnet  
            name: "BSC Mainnet",
            currency: { name: "BNB", symbol: "BNB" },
            rpcUrls: [
                "https://bsc-dataseed1.binance.org/",
                "https://bsc-dataseed2.binance.org/"
            ],
            contracts: {
                pranaToken: "0x0000000000000000000000000000000000000000", // Deploy for mainnet
                usdtToken: "0x55d398326f99059fF775485246999027B3197955", // Real USDT
                pranaExchange: "0x0000000000000000000000000000000000000000", // Deploy for mainnet
                pranaStaking: "0x0000000000000000000000000000000000000000"   // Deploy for mainnet
            },
            usdtDecimals: 18
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

// Make available globally
window.PRANA_CONFIG = PRANA_CONFIG;

console.log("📡 Contract configuration loaded for", PRANA_CONFIG.getNetwork(${deploymentInfo.chainId}).name);
console.log("🏠 Contracts:", PRANA_CONFIG.getContracts(${deploymentInfo.chainId}));
`;

  fs.writeFileSync(frontendConfigPath, frontendConfig);
  console.log("✅ Frontend configuration updated");
  console.log("");

  // Final summary
  console.log("🎉 REDEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("=====================================");
  console.log("📋 NEW CONTRACT ADDRESSES:");
  console.log("🪙 PRANA Token:    ", pranaToken.address);
  console.log("💳 MockUSDT Token: ", mockUSDT.address);
  console.log("💱 PRANA Exchange: ", pranaExchange.address);
  console.log("🎁 PRANA Staking:  ", pranaStaking.address);
  console.log("");
  console.log("💧 INITIAL LIQUIDITY:");
  console.log("🏦 Exchange PRANA:  10,000");
  console.log("🏦 Exchange USDT:   1,000"); 
  console.log("");
  console.log("👤 YOUR TEST BALANCES:");
  console.log("🪙 Your PRANA:     ", ethers.utils.formatEther(await pranaToken.balanceOf(deployer.address)));
  console.log("💳 Your USDT:      ", ethers.utils.formatUnits(await mockUSDT.balanceOf(deployer.address), 6));
  console.log("");
  console.log("✅ Frontend configuration automatically updated");
  console.log("✅ Ready for testing - refresh your browser and try swapping!");
  console.log("=====================================");

  return {
    pranaToken: pranaToken.address,
    mockUSDT: mockUSDT.address,
    pranaExchange: pranaExchange.address,
    pranaStaking: pranaStaking.address
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Redeployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };