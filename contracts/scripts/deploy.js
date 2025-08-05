const { ethers } = require("hardhat");
const { config } = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load environment variables
config();

// Deployment configuration
const DEPLOYMENT_CONFIG = {
  // Token configuration
  TOTAL_SUPPLY: ethers.utils.parseEther("21000000000"), // 21 billion
  
  // Exchange configuration
  PRANA_PRICE: 100000, // 0.10 USDT (6 decimals)
  MIN_BUY_AMOUNT: ethers.utils.parseUnits("50", 6), // 50 USDT
  MIN_SELL_AMOUNT: ethers.utils.parseEther("1000"), // 1000 PRANA
  
  // Staking configuration
  DAILY_ROI_RATE: 1200, // 1.2%
  ROI_CAP_MULTIPLIER: 200, // 200%
  MIN_STAKE_AMOUNT: ethers.utils.parseEther("10"), // 10 PRANA
  
  // Referral rates (basis points)
  REFERRAL_RATES: [400, 200, 100, 100, 100, 100, 100, 100],
  
  // Network-specific USDT addresses
  USDT_ADDRESSES: {
    bscTestnet: null, // Will deploy MockUSDT for testnet
    bscMainnet: "0x55d398326f99059fF775485246999027B3197955", // Real USDT on BSC Mainnet
    hardhat: null // Will deploy mock USDT for local testing
  }
};

class PranavaDeployer {
  constructor() {
    this.deployedContracts = {};
    this.network = "";
    this.signer = null;
  }

  async initialize() {
    this.network = hre.network.name;
    this.signer = (await ethers.getSigners())[0];
    
    console.log("🚀 Starting Pranavam Platform Deployment");
    console.log("📡 Network:", this.network);
    console.log("👤 Deployer:", this.signer.address);
    console.log("💰 Balance:", ethers.utils.formatEther(await this.signer.getBalance()), "ETH");
    console.log("=" .repeat(80));
  }

  async deployMockUSDT() {
    console.log("📦 Deploying Mock USDT Token for testing...");
    
    const MockUSDT = await ethers.getContractFactory("MockERC20");
    const mockUSDT = await MockUSDT.deploy(
      "Test USDT",
      "USDT", 
      6, // 6 decimals for USDT
      ethers.utils.parseUnits("1000000000", 6) // 1 billion USDT for testing
    );
    await mockUSDT.deployed();
    
    console.log("✅ Mock USDT deployed to:", mockUSDT.address);
    console.log("📊 Total Supply:", ethers.utils.formatUnits(ethers.utils.parseUnits("1000000000", 6), 6), "USDT");
    
    // Store the contract instance for later use
    this.deployedContracts.mockUSDT = mockUSDT;
    
    return mockUSDT.address;
  }

  async deployPRANAToken() {
    console.log("📦 Deploying PRANA Token...");
    
    const PRANAToken = await ethers.getContractFactory("PRANAToken");
    const pranaToken = await PRANAToken.deploy();
    await pranaToken.deployed();
    
    console.log("✅ PRANA Token deployed to:", pranaToken.address);
    console.log("📊 Total Supply:", ethers.utils.formatEther(DEPLOYMENT_CONFIG.TOTAL_SUPPLY));
    
    // Verify deployment
    const totalSupply = await pranaToken.totalSupply();
    const owner = await pranaToken.owner();
    
    console.log("📈 Actual Total Supply:", ethers.utils.formatEther(totalSupply));
    console.log("👑 Owner:", owner);
    
    this.deployedContracts.pranaToken = pranaToken;
    return pranaToken.address;
  }

  async deployPRANAExchange(pranaTokenAddress, usdtTokenAddress) {
    console.log("📦 Deploying PRANA Exchange...");
    
    const PRANAExchange = await ethers.getContractFactory("PRANAExchange");
    const pranaExchange = await PRANAExchange.deploy(
      pranaTokenAddress,
      usdtTokenAddress
    );
    await pranaExchange.deployed();
    
    console.log("✅ PRANA Exchange deployed to:", pranaExchange.address);
    console.log("💱 PRANA Price:", ethers.utils.formatUnits(DEPLOYMENT_CONFIG.PRANA_PRICE, 6), "USDT");
    console.log("📉 Min Buy:", ethers.utils.formatUnits(DEPLOYMENT_CONFIG.MIN_BUY_AMOUNT, 6), "USDT");
    console.log("📈 Min Sell:", ethers.utils.formatEther(DEPLOYMENT_CONFIG.MIN_SELL_AMOUNT), "PRANA");
    
    this.deployedContracts.pranaExchange = pranaExchange;
    return pranaExchange.address;
  }

  async deployPRANAStaking(pranaTokenAddress) {
    console.log("📦 Deploying PRANA Staking...");
    
    const PRANAStaking = await ethers.getContractFactory("PRANAStaking");
    const pranaStaking = await PRANAStaking.deploy(pranaTokenAddress);
    await pranaStaking.deployed();
    
    console.log("✅ PRANA Staking deployed to:", pranaStaking.address);
    console.log("📊 Daily ROI:", (DEPLOYMENT_CONFIG.DAILY_ROI_RATE / 100), "%");
    console.log("🎯 ROI Cap:", DEPLOYMENT_CONFIG.ROI_CAP_MULTIPLIER, "%");
    console.log("💸 Min Stake:", ethers.utils.formatEther(DEPLOYMENT_CONFIG.MIN_STAKE_AMOUNT), "PRANA");
    
    this.deployedContracts.pranaStaking = pranaStaking;
    return pranaStaking.address;
  }

  async setupInitialLiquidity(pranaTokenAddress, exchangeAddress) {
    console.log("💧 Setting up initial liquidity...");
    
    const pranaToken = this.deployedContracts.pranaToken;
    const exchange = this.deployedContracts.pranaExchange;
    
    // Calculate initial liquidity amounts
    const initialPRANA = process.env.INITIAL_PRANA_LIQUIDITY || "10000"; // 10K PRANA
    const initialUSDT = process.env.INITIAL_USDT_LIQUIDITY || "1000"; // 1K USDT
    
    const pranaAmount = ethers.utils.parseEther(initialPRANA);
    const usdtAmount = ethers.utils.parseUnits(initialUSDT, 6);
    
    // Transfer PRANA to exchange
    console.log("📤 Transferring PRANA to exchange...");
    const pranaTransferTx = await pranaToken.transfer(exchangeAddress, pranaAmount);
    await pranaTransferTx.wait();
    console.log("✅ PRANA transferred:", ethers.utils.formatEther(pranaAmount));
    
    // Transfer USDT to exchange (if we deployed MockUSDT)
    if (this.deployedContracts.mockUSDT) {
      console.log("📤 Transferring MockUSDT to exchange...");
      const usdtTransferTx = await this.deployedContracts.mockUSDT.transfer(exchangeAddress, usdtAmount);
      await usdtTransferTx.wait();
      console.log("✅ MockUSDT transferred:", ethers.utils.formatUnits(usdtAmount, 6));
    }
    
    console.log("✅ Initial liquidity setup complete");
    console.log("💰 PRANA:", ethers.utils.formatEther(pranaAmount));
    console.log("💰 USDT:", ethers.utils.formatUnits(usdtAmount, 6));
  }

  async setupStakingRewards(pranaTokenAddress, stakingAddress) {
    console.log("🎁 Setting up staking rewards...");
    
    const pranaToken = this.deployedContracts.pranaToken;
    
    // Allocate tokens for staking rewards (30% of total supply)
    const stakingAllocation = DEPLOYMENT_CONFIG.TOTAL_SUPPLY.mul(30).div(100);
    
    console.log("📤 Transferring PRANA to staking contract...");
    const transferTx = await pranaToken.transfer(stakingAddress, stakingAllocation);
    await transferTx.wait();
    
    console.log("✅ Staking rewards setup complete");
    console.log("💰 Allocation:", ethers.utils.formatEther(stakingAllocation), "PRANA");
  }

  async verifyContracts() {
    if (this.network === "hardhat") {
      console.log("⚠️ Contract verification skipped for local network");
      return;
    }

    console.log("🔍 Verifying contracts on explorer...");
    
    try {
      // Verify PRANA Token
      await hre.run("verify:verify", {
        address: this.deployedContracts.pranaToken.address,
        constructorArguments: []
      });
      console.log("✅ PRANA Token verified");

      // Add delay between verifications
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify PRANA Exchange
      await hre.run("verify:verify", {
        address: this.deployedContracts.pranaExchange.address,
        constructorArguments: [
          this.deployedContracts.pranaToken.address,
          this.usdtAddress
        ]
      });
      console.log("✅ PRANA Exchange verified");

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify PRANA Staking
      await hre.run("verify:verify", {
        address: this.deployedContracts.pranaStaking.address,
        constructorArguments: [this.deployedContracts.pranaToken.address]
      });
      console.log("✅ PRANA Staking verified");

    } catch (error) {
      console.log("⚠️ Contract verification failed:", error.message);
    }
  }

  async saveDeploymentInfo() {
    const deploymentInfo = {
      network: this.network,
      timestamp: new Date().toISOString(),
      deployer: this.signer.address,
      contracts: {
        pranaToken: {
          address: this.deployedContracts.pranaToken.address,
          totalSupply: DEPLOYMENT_CONFIG.TOTAL_SUPPLY.toString()
        },
        pranaExchange: {
          address: this.deployedContracts.pranaExchange.address,
          pranaPrice: DEPLOYMENT_CONFIG.PRANA_PRICE,
          minBuyAmount: DEPLOYMENT_CONFIG.MIN_BUY_AMOUNT.toString(),
          minSellAmount: DEPLOYMENT_CONFIG.MIN_SELL_AMOUNT.toString()
        },
        pranaStaking: {
          address: this.deployedContracts.pranaStaking.address,
          dailyROI: DEPLOYMENT_CONFIG.DAILY_ROI_RATE,
          roiCap: DEPLOYMENT_CONFIG.ROI_CAP_MULTIPLIER,
          minStakeAmount: DEPLOYMENT_CONFIG.MIN_STAKE_AMOUNT.toString()
        },
        usdtToken: {
          address: this.usdtAddress,
          isTestnet: this.network === "hardhat" || this.network === "bscTestnet"
        }
      },
      configuration: DEPLOYMENT_CONFIG
    };

    const deploymentPath = path.join(__dirname, `../deployments/${this.network}.json`);
    
    // Ensure deployments directory exists
    const deploymentsDir = path.dirname(deploymentPath);
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("💾 Deployment info saved to:", deploymentPath);

    // Also save to a general deployments file
    const allDeploymentsPath = path.join(__dirname, "../deployments/all.json");
    let allDeployments = {};
    
    if (fs.existsSync(allDeploymentsPath)) {
      allDeployments = JSON.parse(fs.readFileSync(allDeploymentsPath, "utf8"));
    }
    
    allDeployments[this.network] = deploymentInfo;
    fs.writeFileSync(allDeploymentsPath, JSON.stringify(allDeployments, null, 2));
  }

  async deploy() {
    try {
      await this.initialize();

      // Step 1: Get or deploy USDT token
      this.usdtAddress = DEPLOYMENT_CONFIG.USDT_ADDRESSES[this.network];
      if (!this.usdtAddress) {
        this.usdtAddress = await this.deployMockUSDT();
      } else {
        console.log("💳 Using existing USDT at:", this.usdtAddress);
      }

      // Step 2: Deploy PRANA Token
      const pranaTokenAddress = await this.deployPRANAToken();

      // Step 3: Deploy PRANA Exchange
      const pranaExchangeAddress = await this.deployPRANAExchange(
        pranaTokenAddress, 
        this.usdtAddress
      );

      // Step 4: Deploy PRANA Staking
      const pranaStakingAddress = await this.deployPRANAStaking(pranaTokenAddress);

      // Step 5: Setup initial liquidity and rewards
      await this.setupInitialLiquidity(pranaTokenAddress, pranaExchangeAddress);
      await this.setupStakingRewards(pranaTokenAddress, pranaStakingAddress);

      // Step 6: Verify contracts (if not local network)
      if (process.env.VERIFY_CONTRACTS === "true") {
        await this.verifyContracts();
      }

      // Step 7: Save deployment information
      await this.saveDeploymentInfo();

      console.log("=" .repeat(80));
      console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
      console.log("=" .repeat(80));
      console.log("📄 Contract Addresses:");
      console.log("🪙 PRANA Token:", pranaTokenAddress);
      console.log("💱 PRANA Exchange:", pranaExchangeAddress);
      console.log("🎁 PRANA Staking:", pranaStakingAddress);
      console.log("💳 USDT Token:", this.usdtAddress);
      console.log("=" .repeat(80));

      return {
        pranaToken: pranaTokenAddress,
        pranaExchange: pranaExchangeAddress,
        pranaStaking: pranaStakingAddress,
        usdtToken: this.usdtAddress
      };

    } catch (error) {
      console.error("❌ Deployment failed:", error);
      throw error;
    }
  }
}

// Main deployment function
async function main() {
  const deployer = new PranavaDeployer();
  return await deployer.deploy();
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main, PranavaDeployer, DEPLOYMENT_CONFIG };