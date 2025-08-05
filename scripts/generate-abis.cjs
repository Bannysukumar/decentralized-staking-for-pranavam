const fs = require('fs');
const path = require('path');

/**
 * Generate ABI files from compiled contracts
 */
async function generateABIs() {
  console.log('📋 Generating ABI files...');

  const artifactsDir = path.join(__dirname, '..', 'contracts', 'artifacts');
  const abisDir = path.join(__dirname, '..', 'src', 'abis');

  // Ensure ABIs directory exists
  if (!fs.existsSync(abisDir)) {
    fs.mkdirSync(abisDir, { recursive: true });
  }

  const contracts = [
    'PRANAToken.sol/PRANAToken.json',
    'PRANAStaking.sol/PRANAStaking.json',
    'PRANAExchange.sol/PRANAExchange.json',
    'MockUSDT.sol/MockUSDT.json'
  ];

  for (const contractPath of contracts) {
    try {
      const artifactPath = path.join(artifactsDir, contractPath);
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      
      const contractName = path.basename(contractPath, '.json');
      const abiPath = path.join(abisDir, `${contractName}.json`);
      
      const abiData = {
        contractName: artifact.contractName,
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        deployedBytecode: artifact.deployedBytecode,
        linkReferences: artifact.linkReferences,
        deployedLinkReferences: artifact.deployedLinkReferences
      };

      fs.writeFileSync(abiPath, JSON.stringify(abiData, null, 2));
      console.log(`✅ Generated ABI for ${contractName}`);
    } catch (error) {
      console.error(`❌ Failed to generate ABI for ${contractPath}:`, error.message);
    }
  }

  console.log('🎉 ABI generation completed!');
}

if (require.main === module) {
  generateABIs()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('ABI generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateABIs };