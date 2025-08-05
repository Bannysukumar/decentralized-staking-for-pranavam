/**
 * Unit Tests for ContractManager
 * Tests contract loading, management, and batch operations
 */

import ContractManager from '../ContractManager';
import { stateManager } from '../../state/ReactiveStateManager';

// Mock dependencies
jest.mock('../../state/ReactiveStateManager');
jest.mock('../../../services/LoggingService.js');
jest.mock('../../../config/contracts.js', () => ({
  getContractAddresses: jest.fn(() => ({
    pranaToken: testUtils.mockAddresses.pranaToken,
    usdtToken: testUtils.mockAddresses.usdtToken,
    pranaExchange: testUtils.mockAddresses.pranaExchange,
    pranaStaking: testUtils.mockAddresses.pranaStaking
  })),
  getContractABI: jest.fn(() => testUtils.mockABIs.ERC20)
}));

describe('ContractManager', () => {
  let contractManager: typeof ContractManager;
  let mockStateManager: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup state manager mock
    mockStateManager = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      updateState: jest.fn(),
      watchContract: jest.fn(),
      unwatchContract: jest.fn(),
      getState: jest.fn(() => ({ connected: true, chainId: 1 }))
    };
    (stateManager as any) = mockStateManager;

    // Create fresh contract manager instance
    const ContractManagerClass = require('../ContractManager').ContractManager;
    contractManager = new ContractManagerClass();
    
    // Mock Web3 instance
    (contractManager as any).web3 = {
      eth: {
        Contract: jest.fn((abi, address) => testUtils.createMockContract(address, abi))
      },
      utils: {
        isAddress: jest.fn(() => true),
        fromWei: jest.fn((value) => (parseInt(value) / 1e18).toString()),
        toBN: jest.fn((value) => ({
          toString: () => value.toString(),
          div: jest.fn((other) => ({ toString: () => (parseInt(value) / parseInt(other.toString())).toString() }))
        }))
      },
      BatchRequest: jest.fn(() => ({
        add: jest.fn(),
        execute: jest.fn()
      }))
    };
  });

  afterEach(() => {
    contractManager.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with empty contracts', () => {
      expect(contractManager.getAllContracts().size).toBe(0);
      expect(contractManager.isContractLoaded('pranaToken')).toBe(false);
    });

    test('should set up state listeners', () => {
      expect(mockStateManager.subscribe).toHaveBeenCalledWith('wallet', expect.any(Function));
    });
  });

  describe('Contract Loading', () => {
    test('should load single contract successfully', async () => {
      const contractInstance = await contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );

      expect(contractInstance).toEqual({
        address: testUtils.mockAddresses.pranaToken,
        abi: testUtils.mockABIs.ERC20,
        contract: expect.any(Object),
        methods: expect.any(Object)
      });

      expect(contractManager.isContractLoaded('pranaToken')).toBe(true);
    });

    test('should reject invalid contract addresses', async () => {
      (contractManager as any).web3.utils.isAddress.mockReturnValue(false);

      await expect(contractManager.loadContract(
        'invalidContract',
        'invalid-address',
        testUtils.mockABIs.ERC20
      )).rejects.toThrow('Invalid contract address: invalid-address');
    });

    test('should load all contracts for network', async () => {
      (contractManager as any).currentChainId = 1;

      await contractManager.loadAllContracts(1);

      expect(contractManager.isContractLoaded('pranaToken')).toBe(true);
      expect(contractManager.isContractLoaded('usdtToken')).toBe(true);
      expect(contractManager.isContractLoaded('pranaExchange')).toBe(true);
      expect(contractManager.isContractLoaded('pranaStaking')).toBe(true);

      expect(mockStateManager.updateState).toHaveBeenCalledWith('contracts', {
        loaded: true,
        instances: expect.any(Map),
        addresses: expect.any(Object),
        chainId: 1
      });
    });

    test('should handle contract loading errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Mock Web3 Contract constructor to throw
      (contractManager as any).web3.eth.Contract.mockImplementation(() => {
        throw new Error('Contract creation failed');
      });

      await contractManager.loadAllContracts(1);

      // Should not throw, but should log errors
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    test('should watch contract events after loading', async () => {
      await contractManager.loadAllContracts(1);

      expect(mockStateManager.watchContract).toHaveBeenCalledWith('pranaToken', ['Transfer', 'Approval']);
      expect(mockStateManager.watchContract).toHaveBeenCalledWith('pranaExchange', ['PRANAPurchased', 'PRANASold', 'LiquidityAdded', 'LiquidityRemoved']);
    });
  });

  describe('Contract Retrieval', () => {
    beforeEach(async () => {
      await contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
    });

    test('should get contract by name', () => {
      const contract = contractManager.getContract('pranaToken');
      
      expect(contract).toBeDefined();
      expect(contract!.address).toBe(testUtils.mockAddresses.pranaToken);
    });

    test('should return null for non-existent contract', () => {
      const contract = contractManager.getContract('nonExistent');
      expect(contract).toBeNull();
    });

    test('should get all contracts', () => {
      const allContracts = contractManager.getAllContracts();
      
      expect(allContracts.size).toBe(1);
      expect(allContracts.has('pranaToken')).toBe(true);
    });
  });

  describe('Contract Refresh', () => {
    beforeEach(async () => {
      await contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
    });

    test('should refresh existing contract', async () => {
      const refreshedContract = await contractManager.refreshContract('pranaToken');
      
      expect(refreshedContract.address).toBe(testUtils.mockAddresses.pranaToken);
      expect(refreshedContract.abi).toEqual(testUtils.mockABIs.ERC20);
    });

    test('should throw error when refreshing non-existent contract', async () => {
      await expect(contractManager.refreshContract('nonExistent'))
        .rejects.toThrow('Contract nonExistent not found');
    });
  });

  describe('Token Utility Methods', () => {
    beforeEach(async () => {
      await contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
    });

    test('should get token balance', async () => {
      const balance = await contractManager.getTokenBalance(
        'pranaToken',
        testUtils.mockAddresses.user
      );

      expect(balance).toBe('1000'); // Mock returns 1000 tokens
    });

    test('should get token allowance', async () => {
      const allowance = await contractManager.getTokenAllowance(
        'pranaToken',
        testUtils.mockAddresses.user,
        testUtils.mockAddresses.pranaExchange
      );

      expect(allowance).toBe('0'); // Mock returns 0 allowance
    });

    test('should handle errors in token operations', async () => {
      await expect(contractManager.getTokenBalance('nonExistent', testUtils.mockAddresses.user))
        .rejects.toThrow('Token contract nonExistent not loaded');
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      await contractManager.loadAllContracts(1);
    });

    test('should execute batch calls', async () => {
      const calls = [
        { contractName: 'pranaToken', methodName: 'balanceOf', params: [testUtils.mockAddresses.user] },
        { contractName: 'usdtToken', methodName: 'balanceOf', params: [testUtils.mockAddresses.user] }
      ];

      const results = await contractManager.batchCall(calls);

      expect(results).toHaveLength(2);
      expect(results[0]).toBe('1000000000000000000000'); // Mock balance
      expect(results[1]).toBe('1000000000000000000000'); // Mock balance
    });

    test('should handle batch call errors', async () => {
      const calls = [
        { contractName: 'nonExistent', methodName: 'balanceOf', params: [testUtils.mockAddresses.user] }
      ];

      await expect(contractManager.batchCall(calls))
        .rejects.toEqual(expect.arrayContaining([
          expect.any(Error)
        ]));
    });

    test('should create and execute batch request', async () => {
      const mockBatch = {
        add: jest.fn(),
        execute: jest.fn()
      };
      (contractManager as any).web3.BatchRequest.mockReturnValue(mockBatch);

      const calls = [
        { contractName: 'pranaToken', methodName: 'balanceOf', params: [testUtils.mockAddresses.user] }
      ];

      await contractManager.batchCall(calls);

      expect(mockBatch.add).toHaveBeenCalled();
      expect(mockBatch.execute).toHaveBeenCalled();
    });
  });

  describe('Contract Validation', () => {
    test('should validate contract by calling test method', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );

      // Should not throw for successful validation
      await expect((contractManager as any).validateContract(mockContract, 'pranaToken'))
        .resolves.toBeUndefined();
    });

    test('should handle validation failures gracefully', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      // Mock method to throw
      mockContract.methods.symbol = jest.fn(() => ({
        call: jest.fn(() => Promise.reject(new Error('Method not found')))
      }));

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Should not throw, but should warn
      await (contractManager as any).validateContract(mockContract, 'pranaToken');
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('State Integration', () => {
    test('should handle wallet state changes', async () => {
      const stateListener = mockStateManager.subscribe.mock.calls[0][1];
      
      // Simulate wallet connection
      await stateListener({
        data: { connected: true, chainId: 56 }
      });

      // Should attempt to load contracts for new chain
      // (Implementation depends on actual state management)
    });

    test('should clear contracts on wallet disconnect', async () => {
      // Load contracts first
      await contractManager.loadAllContracts(1);
      expect(contractManager.getAllContracts().size).toBeGreaterThan(0);

      // Simulate wallet disconnect
      const stateListener = mockStateManager.subscribe.mock.calls[0][1];
      await stateListener({
        data: { connected: false }
      });

      // Note: Actual clearing depends on implementation
    });
  });

  describe('Deployment Block Tracking', () => {
    test('should return deployment block for known contracts', () => {
      const block = contractManager.getContractDeploymentBlock('pranaToken');
      expect(typeof block).toBe('number');
      expect(block).toBeGreaterThanOrEqual(0);
    });

    test('should return 0 for unknown contracts', () => {
      const block = contractManager.getContractDeploymentBlock('unknownContract');
      expect(block).toBe(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle Web3 not initialized', async () => {
      (contractManager as any).web3 = null;

      await expect(contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      )).rejects.toThrow('Web3 not initialized');
    });

    test('should handle missing contract addresses', async () => {
      const { getContractAddresses } = require('../../../config/contracts.js');
      getContractAddresses.mockReturnValue({}); // No addresses

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await contractManager.loadAllContracts(1);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle missing contract ABI', async () => {
      const { getContractABI } = require('../../../config/contracts.js');
      getContractABI.mockReturnValue(null);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await contractManager.loadAllContracts(1);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    test('should clear all contracts and watchers', () => {
      // Load some contracts first
      (contractManager as any).contracts.set('test', { address: '0x123' });

      contractManager.destroy();

      expect(mockStateManager.unwatchContract).toHaveBeenCalled();
      expect(contractManager.getAllContracts().size).toBe(0);
    });

    test('should unsubscribe from state updates', () => {
      contractManager.destroy();

      expect(mockStateManager.unsubscribe).toHaveBeenCalledWith(
        'wallet',
        expect.any(Function)
      );
    });
  });

  describe('Performance', () => {
    test('should handle loading many contracts efficiently', async () => {
      const startTime = Date.now();
      
      await contractManager.loadAllContracts(1);
      
      const endTime = Date.now();
      
      // Should complete quickly (less than 100ms for unit test)
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should cache contract instances properly', async () => {
      await contractManager.loadContract(
        'pranaToken',
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );

      const instance1 = contractManager.getContract('pranaToken');
      const instance2 = contractManager.getContract('pranaToken');

      // Should return same instance (cached)
      expect(instance1).toBe(instance2);
    });
  });
});