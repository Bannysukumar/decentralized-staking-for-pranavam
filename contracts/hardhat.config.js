require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-etherscan");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      metadata: {
        bytecodeHash: "none"
      }
    }
  },
  
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000
    },
    
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545/",
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
      gasPrice: 5000000000, // 5 gwei
      timeout: 300000,
      confirmations: 3
    },
    
    bscMainnet: {
      url: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 12000000,
      gasPrice: 5000000000, // 5 gwei
      timeout: 300000,
      confirmations: 5
    },
    
    // Additional networks for testing
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      chainId: 137,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 12000000,
      gasPrice: 30000000000, // 30 gwei
      timeout: 300000,
      confirmations: 3
    },
    
    ethereum: {
      url: process.env.ETHEREUM_RPC || `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      chainId: 1,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 12000000,
      gasPrice: 25000000000, // 25 gwei
      timeout: 300000,
      confirmations: 3
    }
  },
  
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      mainnet: process.env.ETHERSCAN_API_KEY
    }
  },
  
  
  mocha: {
    timeout: 300000,
    retries: 3
  },
  
  paths: {
    sources: ".",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  // Task configurations
  defaultNetwork: "hardhat",
  
  // Custom tasks
  task: {
    compile: {
      force: false,
      quiet: false
    }
  }
};