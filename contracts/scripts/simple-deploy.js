const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  
  console.log("🚀 Simple Deployment with Correct Addresses");
  console.log("===========================================");
  console.log("📡 Network:", network);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "BNB");
  console.log("");

  // Step 1: Deploy MockUSDT
  console.log("📦 Step 1: Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy({ 
    gasLimit: 2000000, 
    gasPrice: 5000000000 
  });
  await mockUSDT.deployed();
  console.log("✅ MockUSDT:", mockUSDT.address);

  // Step 2: Deploy PRANA
  console.log("📦 Step 2: Deploying PRANA Token...");  
  const PRANAToken = await ethers.getContractFactory("PRANAToken");
  const pranaToken = await PRANAToken.deploy({ 
    gasLimit: 3000000, 
    gasPrice: 5000000000 
  });
  await pranaToken.deployed();
  console.log("✅ PRANA:", pranaToken.address);

  // Step 3: Deploy Exchange
  console.log("📦 Step 3: Deploying Exchange...");
  const PRANAExchange = await ethers.getContractFactory("PRANAExchange");
  const pranaExchange = await PRANAExchange.deploy(
    pranaToken.address,
    mockUSDT.address,
    deployer.address, // liquidity provider
    { gasLimit: 3000000, gasPrice: 5000000000 }
  );
  await pranaExchange.deployed();
  console.log("✅ Exchange:", pranaExchange.address);

  // Step 4: Deploy Staking
  console.log("📦 Step 4: Deploying Staking...");
  const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
  const pranaStaking = await PRANAStaking.deploy(
    pranaToken.address,
    { gasLimit: 3000000, gasPrice: 5000000000 }
  );
  await pranaStaking.deployed();
  console.log("✅ Staking:", pranaStaking.address);

  // Verify addresses are correct
  console.log("\n🔍 Verifying Contract Configuration...");
  const exchangePranaAddr = await pranaExchange.pranaToken();
  const exchangeUsdtAddr = await pranaExchange.usdtToken();
  
  console.log("Exchange PRANA address:", exchangePranaAddr);
  console.log("Expected PRANA address: ", pranaToken.address);
  console.log("PRANA addresses match:  ", exchangePranaAddr === pranaToken.address);
  
  console.log("Exchange USDT address: ", exchangeUsdtAddr);
  console.log("Expected USDT address:  ", mockUSDT.address);
  console.log("USDT addresses match:   ", exchangeUsdtAddr === mockUSDT.address);

  // Save deployment info
  const deploymentInfo = {
    network: network,
    chainId: 97,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      pranaToken: {
        address: pranaToken.address,
        name: "PRANAToken",
        totalSupply: "21000000000000000000000000000",
        deploymentHash: "..."
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
    notes: "Contracts deployed successfully with correct token addresses."
  };

  // Save deployment file
  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  const deploymentsDir = path.dirname(deploymentPath);
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment saved to:", deploymentPath);

  // Update frontend config
  const frontendConfig = `// Auto-generated contract configuration
const PRANA_CONFIG = {
    networks: {
        97: {
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
        56: {
            name: "BSC Mainnet",
            currency: { name: "BNB", symbol: "BNB" },
            rpcUrls: ["https://bsc-dataseed1.binance.org/"],
            contracts: {
                pranaToken: "0x0000000000000000000000000000000000000000",
                usdtToken: "0x55d398326f99059fF775485246999027B3197955",
                pranaExchange: "0x0000000000000000000000000000000000000000",
                pranaStaking: "0x0000000000000000000000000000000000000000"
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

window.PRANA_CONFIG = PRANA_CONFIG;
console.log("📡 Contract configuration loaded for", PRANA_CONFIG.getNetwork(97).name);
`;

  const frontendConfigPath = path.join(__dirname, "../../public/js/contract-config.js");
  fs.writeFileSync(frontendConfigPath, frontendConfig);
  console.log("✅ Frontend configuration updated");

  console.log("\n🎉 DEPLOYMENT COMPLETE!");
  console.log("======================");
  console.log("🪙 PRANA Token: ", pranaToken.address);
  console.log("💳 MockUSDT:    ", mockUSDT.address);
  console.log("💱 Exchange:    ", pranaExchange.address);
  console.log("🎁 Staking:     ", pranaStaking.address);
  console.log("");
  console.log("⚠️  Next Steps:");
  console.log("1. Fund exchange with fundExchangeQuick() in browser");
  console.log("2. Test swapping functionality");
  console.log("======================");

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
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { main };