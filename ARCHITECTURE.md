# PRANA Platform Architecture

## Overview
The PRANA platform follows a modular, service-oriented architecture with clear separation of concerns for wallet management, contract interactions, and UI services.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Admin Panel  │  Exchange UI  │  Staking UI  │  Main UI     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Service Integration Layer                  │
├─────────────────────────────────────────────────────────────┤
│                  UIServiceIntegration                       │
│  - Simplified interface for HTML pages                      │
│  - Event handling and state management                      │
│  - Cross-tab synchronization                                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Service Manager                         │
├─────────────────────────────────────────────────────────────┤
│                    ServiceManager                           │
│  - Central orchestrator for all services                    │
│  - Service initialization and health monitoring             │
│  - Unified API for UI components                            │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Core Services                          │
├─────────────────────────────────────────────────────────────┤
│ WalletService │ ContractService │ ExchangeService │ StakingService
│  - Connect    │  - Initialize   │  - Swap tokens  │  - Stake PRANA
│  - Disconnect │  - Execute calls│  - Get quotes   │  - Claim rewards
│  - Network    │  - Send txns    │  - Get reserves │  - Get staking info
│  - Accounts   │  - Event subs   │  - Get rates    │  - Get user stakes
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                       Managers                              │
├─────────────────────────────────────────────────────────────┤
│ ContractManager │ TransactionManager │ UnifiedWalletManager  │
│  - Load contracts│  - Queue txns      │  - Wallet abstraction│
│  - Diagnostics  │  - Gas estimation  │  - Provider handling │
│  - ABI handling │  - Retry logic     │  - State persistence │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Configuration Layer                      │
├─────────────────────────────────────────────────────────────┤
│  contracts.js  │  networks.js  │  Web3ModalService.js       │
│  - Addresses   │  - Chain IDs  │  - Multi-wallet support    │
│  - ABIs        │  - RPC URLs   │  - Provider initialization │
│  - Token info  │  - Network    │  - Connection management   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Blockchain Layer                       │
├─────────────────────────────────────────────────────────────┤
│    BSC Testnet (97)     │        BSC Mainnet (56)          │
│  - PRANA Token          │  - PRANA Token (TBD)             │
│  - mUSDT Token          │  - USDT Token                    │
│  - Exchange Contract    │  - Exchange Contract (TBD)       │
│  - Staking Contract     │  - Staking Contract (TBD)        │
└─────────────────────────────────────────────────────────────┘
```

## Service Interaction Flow

### 1. Wallet Connection Flow
```
User Action → UIServiceIntegration → ServiceManager → WalletService
                                                    ↓
                                              Web3ModalService
                                                    ↓
                                              MetaMask/Provider
                                                    ↓
                                              ContractManager
                                                    ↓
                                              ContractService
```

### 2. Transaction Flow
```
User Transaction → UIServiceIntegration → ServiceManager → ContractService
                                                          ↓
                                                   TransactionManager
                                                          ↓
                                                      Web3.send()
                                                          ↓
                                                   MetaMask Provider
                                                          ↓
                                                      Blockchain
```

### 3. Contract Reading Flow
```
Data Request → UIServiceIntegration → ServiceManager → ContractService
                                                     ↓
                                               contract.methods.call()
                                                     ↓
                                                RPC Provider
                                                     ↓
                                                 Blockchain
```

## Core Services Details

### WalletService
**Responsibility**: Wallet connection and provider management
- **Initialize**: Set up Web3 with default RPC
- **Connect**: Connect to MetaMask/WalletConnect/etc.
- **Provider Management**: Update Web3 instance with wallet provider
- **Network Switching**: Handle chain changes
- **Account Management**: Track connected accounts

**Key Methods**:
```javascript
async connect(providerType) // Connect to wallet
async disconnect() // Disconnect wallet
async switchNetwork(chainId) // Switch to different network
getStatus() // Get wallet connection status
```

### ContractService
**Responsibility**: Smart contract interactions
- **Contract Loading**: Initialize contract instances
- **Method Execution**: Handle contract calls and transactions
- **Event Subscription**: Listen to contract events
- **Error Handling**: Retry logic and fallback RPCs

**Key Methods**:
```javascript
async initialize(web3, chainId) // Load all contracts
async executeCall(contractName, method, params) // Read operations
async executeTransaction(contractName, method, params) // Write operations
subscribeToEvent(contractName, eventName, callback) // Event listening
```

### ExchangeService
**Responsibility**: PRANA/USDT exchange operations
- **Quote Calculation**: Get swap quotes
- **Reserve Management**: Track liquidity pools
- **Rate Management**: Current exchange rates
- **Swap Execution**: Execute token swaps

### StakingService
**Responsibility**: PRANA staking operations
- **Stake Management**: Create/manage stakes
- **Reward Calculation**: Calculate pending rewards
- **User Information**: Get user staking data
- **Contract Information**: Total staked, APY, etc.

## Current Web3 Transaction Issue

### Problem Analysis
The error `eth_sendTransaction does not exist/is not available` occurs because:

1. **Web3.js Version Compatibility**: Using Web3.js v1.8.0 with newer MetaMask
2. **Provider Interface Mismatch**: Modern MetaMask uses different transaction methods
3. **Missing EIP-1193 Compliance**: Need to use provider.request() method

### Root Cause
In `WalletService._connectMetaMask()`, Web3 is correctly updated:
```javascript
this.web3 = new window.Web3(provider); // ✅ Correct
```

But Web3.js v1.8.0's `.send()` method is incompatible with modern MetaMask's provider interface.

### Solution Architecture

#### 1. Provider Compatibility Layer
Create a compatibility layer that bridges Web3.js and modern providers:

```javascript
// In ContractService
async executeTransaction(contractName, methodName, params) {
    // Use modern provider.request() instead of deprecated methods
    const provider = this.web3.currentProvider;
    if (provider.request) {
        // Use EIP-1193 compliant method
        return await this._sendTransactionEIP1193(contract, method, params, options);
    } else {
        // Fallback to legacy method
        return await contract.methods[methodName](...params).send(options);
    }
}
```

#### 2. Transaction Execution Strategy
```
1. Prepare Transaction Data
   ↓
2. Check Provider Type (MetaMask/WalletConnect/etc.)
   ↓
3. Use Appropriate Method:
   - EIP-1193: provider.request({method: 'eth_sendTransaction'})
   - Legacy: contract.methods.send()
   ↓
4. Handle Response and Wait for Receipt
```

#### 3. Service Dependencies
```
UIServiceIntegration
    ↓
ServiceManager (orchestrates)
    ↓
ContractService (executes) ← WalletService (provides Web3)
    ↓
TransactionManager (handles queue/retry)
```

## User Flows

### Normal User Flow
1. **Connect Wallet** → WalletService → MetaMask
2. **View Balances** → ContractService.executeCall()
3. **Exchange Tokens** → ExchangeService → ContractService.executeTransaction()
4. **Stake PRANA** → StakingService → ContractService.executeTransaction()

### Admin User Flow
1. **Connect Admin Wallet** → Same as normal user
2. **View Platform Stats** → Multiple ContractService.executeCall()
3. **Transfer Tokens** → ContractService.executeTransaction() with admin permissions
4. **Mint Tokens** (testnet) → ContractService.executeTransaction() with mint role
5. **Manage Contracts** → Direct contract admin functions

## Configuration Management

### Network Configuration
- **Testnet**: ChainId 97, mUSDT (6 decimals), test contracts
- **Mainnet**: ChainId 56, USDT (6 decimals), production contracts

### Contract Configuration
- **Addresses**: Defined per network in contracts.js
- **ABIs**: Centralized ABI management
- **Decimals**: Proper token decimal handling

### Provider Configuration
- **Web3Modal**: Multi-wallet support
- **RPC Fallbacks**: Multiple RPC endpoints
- **Error Handling**: Graceful degradation

## Error Handling Strategy

### Transaction Errors
1. **User Rejection**: Don't retry, show user message
2. **Network Errors**: Retry with backoff
3. **Provider Errors**: Switch to fallback RPC
4. **Gas Errors**: Increase gas and retry

### Service Errors
1. **Initialization Failures**: Graceful degradation
2. **Contract Loading**: Show specific error messages
3. **Balance Fetching**: Return zero with warning
4. **Connection Issues**: Auto-reconnect logic

## Performance Optimizations

### Contract Calls
- **Batching**: Group multiple calls
- **Caching**: Cache frequent reads
- **Fallback RPCs**: Use multiple endpoints

### UI Updates
- **Debouncing**: Prevent excessive updates
- **Loading States**: Show progress indicators
- **Error Boundaries**: Isolate failures

This architecture ensures modularity, maintainability, and proper separation of concerns while providing robust error handling and performance optimization.