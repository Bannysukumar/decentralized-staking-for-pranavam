const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Script to verify contracts on block explorer
 */

async function verifyContract(address, constructorArgs = [], contractName = "") {
  try {
    console.log(`🔍 Verifying ${contractName} at ${address}...`);
    
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    });
    
    console.log(`✅ ${contractName} verified successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to verify ${contractName}:`, error.message);
    return false;
  }
}

async function main() {
  const network = hre.network.name;
  console.log(`🔍 Starting contract verification on ${network}`);
  
  // Load deployment info
  const deploymentPath = path.join(__dirname, `../deployments/${network}.json`);
  
  if (!fs.existsSync(deploymentPath)) {
    console.error(`❌ No deployment found for network: ${network}`);
    console.log(`Expected file: ${deploymentPath}`);
    process.exit(1);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const contracts = deployment.contracts;
  
  console.log("📄 Found deployment:", deployment.timestamp);
  console.log("📄 Deployer:", deployment.deployer);
  
  // Verify PRANA Token
  await verifyContract(
    contracts.pranaToken.address,
    [], // No constructor arguments
    "PRANA Token"
  );
  
  // Wait between verifications
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Verify PRANA Exchange
  await verifyContract(
    contracts.pranaExchange.address,
    [
      contracts.pranaToken.address,
      contracts.usdtToken.address
    ],
    "PRANA Exchange"
  );
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Verify PRANA Staking
  await verifyContract(
    contracts.pranaStaking.address,
    [contracts.pranaToken.address],
    "PRANA Staking"
  );
  
  console.log("🎉 Verification process completed!");
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