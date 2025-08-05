# Pranavam Smart Contracts

## Overview

This directory contains the complete smart contract implementation for the Pranavam platform, featuring:

- **Zero Token Loss Architecture**: Comprehensive state management and validation
- **PRANA Token (ERC-20)**: 21 billion total supply with anti-whale protection
- **Fixed-Rate Exchange**: 1 PRANA = 0.10 USDT with configurable fees
- **Staking System**: 1.2% daily ROI with 200% cap and 8-level referral system

## Contract Architecture

### Core Contracts

1. **PRANAToken.sol** - Main ERC-20 token with advanced features
2. **PRANAExchange.sol** - Fixed-rate DEX for PRANA/USDT trading
3. **PRANAStaking.sol** - Staking contract with referral rewards
4. **MockERC20.sol** - Mock token for testing

### Interfaces

- **IPriceOracle.sol** - Interface for future price oracle integration

## Key Features

### Zero Token Loss System
- Comprehensive transaction validation
- State checkpointing and rollback mechanisms
- Atomic operation execution
- Audit trail for all transactions

### Token Security
- Anti-whale protection (1% max transfer, 3% max wallet)
- Pausable transfers
- Controlled token distribution
- Emergency withdrawal functions

### Exchange Features
- Fixed 0.10 USDT price per PRANA
- Minimum buy: 50 USDT
- Minimum sell: 1000 PRANA
- Configurable trading fees
- Liquidity management

### Staking Features
- 1.2% daily ROI with 200% lifetime cap
- 8-level referral commission system
- Compound growth mechanics
- Emergency withdrawal protections

## Deployment

### Prerequisites

```bash
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `PRIVATE_KEY` - Deployment wallet private key
- `BSC_TESTNET_RPC` - BSC testnet RPC URL
- `BSCSCAN_API_KEY` - For contract verification

### Deploy to BSC Testnet

```bash
npx hardhat run scripts/deploy.js --network bscTestnet
```

### Deploy to BSC Mainnet

```bash
npx hardhat run scripts/deploy.js --network bscMainnet
```

### Verify Contracts

```bash
npx hardhat run scripts/verify.js --network bscTestnet
```

## Testing

### Run All Tests

```bash
npx hardhat test
```

### Run Specific Test Files

```bash
npx hardhat test test/PRANAToken.test.js
npx hardhat test test/PRANAExchange.test.js
npx hardhat test test/PRANAStaking.test.js
npx hardhat test test/Integration.test.js
```

### Coverage Report

```bash
npx hardhat coverage
```

### Gas Report

```bash
REPORT_GAS=true npx hardhat test
```

## Contract Addresses

### BSC Testnet
- PRANA Token: `TBD`
- PRANA Exchange: `TBD`
- PRANA Staking: `TBD`

### BSC Mainnet
- PRANA Token: `TBD`
- PRANA Exchange: `TBD`
- PRANA Staking: `TBD`

## Security Considerations

### Access Control
- All administrative functions are protected by Ownable
- Emergency functions include additional safety checks
- Multi-signature wallet recommended for production

### Token Economics
- Fixed supply of 21 billion PRANA
- No inflation or additional minting
- Controlled distribution through allocation system

### Staking Security
- ROI cap prevents infinite token generation
- Referral eligibility requires active stake
- Emergency withdrawal protects against contract failures

## Integration Guide

### Frontend Integration

See the Zero Token Loss JavaScript implementation at:
`../public/js/zero-token-loss.js`

### Web3 Integration

```javascript
// Example: Buy PRANA
const amount = ethers.utils.parseUnits("100", 6); // 100 USDT
await usdtContract.approve(exchangeAddress, amount);
await exchangeContract.buyPRANA(amount);
```

### Staking Integration

```javascript
// Example: Create stake
const stakeAmount = ethers.utils.parseEther("1000");
await pranaContract.approve(stakingAddress, stakeAmount);
await stakingContract.createStake(stakeAmount, referrerAddress);
```

## Monitoring

### Events to Monitor

**Token Events:**
- `AllocationDistributed`
- `BurnExecuted`
- `MaxLimitsUpdated`

**Exchange Events:**
- `PRANAPurchased`
- `PRANASold`
- `LiquidityAdded`
- `LiquidityRemoved`

**Staking Events:**
- `StakeCreated`
- `RewardsClaimed`
- `ReferralCommissionPaid`
- `StakeDeactivated`

### Health Checks

1. Monitor contract balances
2. Verify referral commission payments
3. Track staking reward distribution
4. Monitor exchange liquidity levels

## Troubleshooting

### Common Issues

1. **Transaction Reverted**: Check token allowances and balances
2. **Gas Estimation Failed**: Increase gas limit or check contract state
3. **Verification Failed**: Ensure constructor parameters match deployment

### Debug Commands

```bash
# Check contract sizes
npx hardhat size-contracts

# Verify deployment
npx hardhat console --network bscTestnet

# Debug transaction
npx hardhat run scripts/debug.js --network bscTestnet
```

## License

MIT License - See LICENSE file for details.

## Support

For technical support and questions:
- GitHub Issues: [Create Issue](https://github.com/pranavam/issues)
- Documentation: [docs.pranavam.com](https://docs.pranavam.com)
- Community: [Telegram](https://t.me/pranavam)