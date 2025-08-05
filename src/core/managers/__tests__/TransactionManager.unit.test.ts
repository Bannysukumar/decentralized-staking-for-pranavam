/**
 * Unit Tests for TransactionManager
 * Tests transaction execution, queuing, and gas management
 */

import { TransactionManager } from '../TransactionManager';
import { stateManager } from '../../state/ReactiveStateManager';
import contractManager from '../ContractManager';

// Mock dependencies
jest.mock('../../state/ReactiveStateManager');
jest.mock('../ContractManager');
jest.mock('../../../services/LoggingService.js');

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;
  let mockStateManager: any;
  let mockContractManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup state manager mock
    mockStateManager = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      getCurrentAccount: jest.fn(() => testUtils.mockAddresses.user),
      updateState: jest.fn(),
      getState: jest.fn(() => ({ pending: new Map() }))
    };
    
    // Add Web3 instance to state manager
    mockStateManager['web3'] = {
      eth: {
        getAccounts: jest.fn(() => Promise.resolve([testUtils.mockAddresses.user])),
        getGasPrice: jest.fn(() => Promise.resolve('20000000000')),
        getTransaction: jest.fn(() => Promise.resolve({
          hash: testUtils.mockTxHash,
          blockNumber: 12345
        })),
        getTransactionReceipt: jest.fn(() => Promise.resolve({
          transactionHash: testUtils.mockTxHash,
          blockNumber: 12345,
          status: true,
          gasUsed: 21000
        }))
      },
      utils: {
        toBN: jest.fn((value) => ({
          toString: () => value.toString(),
          mul: jest.fn((other) => ({ toString: () => (parseInt(value) * parseInt(other.toString())).toString() })),
          div: jest.fn((other) => ({ toString: () => (parseInt(value) / parseInt(other.toString())).toString() }))
        })),
        fromWei: jest.fn(() => '0.001'),
        toWei: jest.fn(() => '20000000000')
      }
    };
    
    (stateManager as any) = mockStateManager;

    // Setup contract manager mock
    mockContractManager = {
      getContract: jest.fn(() => testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      ))
    };
    (contractManager as any) = mockContractManager;

    transactionManager = new TransactionManager();
  });

  afterEach(() => {
    transactionManager.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(transactionManager.queueSize).toBe(0);
      expect(transactionManager.executingCount).toBe(0);
      expect((transactionManager as any).config.maxRetries).toBe(3);
    });

    test('should set up state listeners', () => {
      expect(mockStateManager.subscribe).toHaveBeenCalledWith('wallet', expect.any(Function));
      expect(mockStateManager.subscribe).toHaveBeenCalledWith('contractEvent', expect.any(Function));
    });
  });

  describe('Transaction Execution', () => {
    const mockRequest = {
      contractName: 'pranaToken',
      methodName: 'transfer',
      params: [testUtils.mockAddresses.user, '1000000000000000000'],
      options: {}
    };

    test('should execute transaction successfully', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      // Mock successful transaction
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(21000)),
        send: jest.fn(() => Promise.resolve({
          transactionHash: testUtils.mockTxHash,
          blockNumber: 12345,
          gasUsed: 21000,
          status: true
        }))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      const result = await transactionManager.executeTransaction(mockRequest);

      expect(result).toEqual({
        transactionHash: testUtils.mockTxHash,
        blockNumber: 12345,
        gasUsed: 21000,
        status: true,
        gasCost: '0.001',
        executionTime: expect.any(Number),
        confirmationTime: expect.any(Number)
      });
    });

    test('should validate transaction request', async () => {
      await expect(transactionManager.executeTransaction({
        contractName: '',
        methodName: 'transfer',
        params: [],
        options: {}
      })).rejects.toThrow('Contract name and method name are required');

      await expect(transactionManager.executeTransaction({
        contractName: 'pranaToken',
        methodName: '',
        params: [],
        options: {}
      })).rejects.toThrow('Contract name and method name are required');
    });

    test('should handle contract not found', async () => {
      mockContractManager.getContract.mockReturnValue(null);

      await expect(transactionManager.executeTransaction(mockRequest))
        .rejects.toThrow('Contract pranaToken not loaded');
    });

    test('should handle method not found', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      delete mockContract.methods.transfer;
      mockContractManager.getContract.mockReturnValue(mockContract);

      await expect(transactionManager.executeTransaction(mockRequest))
        .rejects.toThrow('Method transfer not found in contract pranaToken');
    });

    test('should handle no wallet connected', async () => {
      mockStateManager.getCurrentAccount.mockReturnValue(null);

      await expect(transactionManager.executeTransaction(mockRequest))
        .rejects.toThrow('No wallet connected');
    });
  });

  describe('Gas Estimation', () => {
    const mockRequest = {
      contractName: 'pranaToken',
      methodName: 'transfer',
      params: [testUtils.mockAddresses.user, '1000000000000000000'],
      options: {}
    };

    test('should estimate gas with buffer', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(21000))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      const gasEstimate = await transactionManager.estimateGas(mockRequest);

      // Should add 20% buffer: 21000 * 1.2 = 25200
      expect(gasEstimate).toBe(25200);
    });

    test('should cap gas at maximum limit', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      // Mock very high gas estimate
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(10000000))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      const gasEstimate = await transactionManager.estimateGas(mockRequest);

      // Should be capped at maxGasLimit (8000000)
      expect(gasEstimate).toBe(8000000);
    });

    test('should return fallback gas on estimation failure', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.reject(new Error('Gas estimation failed')))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      const gasEstimate = await transactionManager.estimateGas(mockRequest);

      // Should return fallback value
      expect(gasEstimate).toBe(200000);
    });
  });

  describe('Transaction Queue', () => {
    const mockRequest = {
      contractName: 'pranaToken',
      methodName: 'transfer',
      params: [testUtils.mockAddresses.user, '1000000000000000000'],
      options: {}
    };

    test('should queue transaction with default priority', async () => {
      const txId = await transactionManager.executeTransactionQueued(mockRequest);

      expect(typeof txId).toBe('string');
      expect(txId).toMatch(/^tx_\d+_[a-z0-9]+$/);
      expect(transactionManager.queueSize).toBe(1);
    });

    test('should queue transaction with high priority', async () => {
      const txId = await transactionManager.executeTransactionQueued(mockRequest, 'high');

      expect(transactionManager.queueSize).toBe(1);
      
      const queueStatus = transactionManager.getQueueStatus();
      expect(queueStatus.byPriority.high).toBe(1);
    });

    test('should get queue status', () => {
      const status = transactionManager.getQueueStatus();

      expect(status).toEqual({
        total: 0,
        executing: 0,
        pending: 0,
        byPriority: {
          high: 0,
          normal: 0,
          low: 0
        }
      });
    });

    test('should process queue by priority', async () => {
      // Add transactions with different priorities
      await transactionManager.executeTransactionQueued(mockRequest, 'low');
      await transactionManager.executeTransactionQueued(mockRequest, 'high');
      await transactionManager.executeTransactionQueued(mockRequest, 'normal');

      expect(transactionManager.queueSize).toBe(3);

      // High priority transaction should be processed first
      const nextTx = (transactionManager as any).getNextTransaction();
      expect(nextTx.priority).toBe('high');
    });

    test('should process queue FIFO for same priority', async () => {
      const tx1Id = await transactionManager.executeTransactionQueued(mockRequest, 'normal');
      const tx2Id = await transactionManager.executeTransactionQueued(mockRequest, 'normal');

      const nextTx = (transactionManager as any).getNextTransaction();
      expect(nextTx.id).toBe(tx1Id);
    });
  });

  describe('Gas Price Management', () => {
    test('should get optimal gas price with buffer', async () => {
      const gasPrice = await (transactionManager as any).getOptimalGasPrice();

      expect(mockStateManager['web3'].eth.getGasPrice).toHaveBeenCalled();
      expect(gasPrice).toBe('22000000000'); // 20 gwei * 1.1 = 22 gwei
    });

    test('should cache gas price', async () => {
      // First call
      await (transactionManager as any).getOptimalGasPrice();
      
      // Second call (should use cache)
      await (transactionManager as any).getOptimalGasPrice();

      // Should only call Web3 once
      expect(mockStateManager['web3'].eth.getGasPrice).toHaveBeenCalledTimes(1);
    });

    test('should return fallback gas price on error', async () => {
      mockStateManager['web3'].eth.getGasPrice.mockRejectedValue(new Error('Network error'));

      const gasPrice = await (transactionManager as any).getOptimalGasPrice();

      // Should return fallback (20 gwei)
      expect(gasPrice).toBe('20000000000');
    });
  });

  describe('Transaction Status', () => {
    test('should get transaction status', async () => {
      const status = await transactionManager.getTransactionStatus(testUtils.mockTxHash);

      expect(status).toEqual({
        receipt: expect.any(Object),
        transaction: expect.any(Object),
        confirmed: true,
        status: true,
        blockNumber: 12345
      });
    });

    test('should handle transaction not found', async () => {
      mockStateManager['web3'].eth.getTransactionReceipt.mockResolvedValue(null);

      const status = await transactionManager.getTransactionStatus(testUtils.mockTxHash);

      expect(status.confirmed).toBe(false);
    });
  });

  describe('Transaction Cancellation', () => {
    test('should cancel queued transaction', async () => {
      const txId = await transactionManager.executeTransactionQueued({
        contractName: 'pranaToken',
        methodName: 'transfer',
        params: [],
        options: {}
      });

      const cancelled = await transactionManager.cancelTransaction(txId);

      expect(cancelled).toBe(true);
      expect(transactionManager.queueSize).toBe(0);
    });

    test('should not cancel executing transaction', async () => {
      const cancelled = await transactionManager.cancelTransaction('executing-tx-hash');

      expect(cancelled).toBe(false);
    });
  });

  describe('State Integration', () => {
    test('should handle wallet disconnection', () => {
      const walletListener = mockStateManager.subscribe.mock.calls
        .find(call => call[0] === 'wallet')[1];

      walletListener({ data: { connected: false } });

      // Should clear queue when wallet disconnects
      expect(transactionManager.queueSize).toBe(0);
    });

    test('should handle contract events', () => {
      const contractEventListener = mockStateManager.subscribe.mock.calls
        .find(call => call[0] === 'contractEvent')[1];

      const mockEvent = {
        type: 'pranaToken.Transfer',
        blockNumber: 12345,
        transactionHash: testUtils.mockTxHash
      };

      // Should not throw
      expect(() => contractEventListener(mockEvent)).not.toThrow();
    });

    test('should update transaction state', () => {
      (transactionManager as any).updateTransactionState(testUtils.mockTxHash, 'completed', {
        gasUsed: 21000
      });

      expect(mockStateManager.updateState).toHaveBeenCalledWith('transactions', {
        history: [{
          hash: testUtils.mockTxHash,
          status: 'completed',
          timestamp: expect.any(Number),
          gasUsed: 21000
        }]
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle transaction revert', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(21000)),
        send: jest.fn(() => Promise.reject(new Error('execution reverted')))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      await expect(transactionManager.executeTransaction({
        contractName: 'pranaToken',
        methodName: 'transfer',
        params: [],
        options: {}
      })).rejects.toThrow('execution reverted');
    });

    test('should handle insufficient funds', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(21000)),
        send: jest.fn(() => Promise.reject(new Error('insufficient funds')))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      await expect(transactionManager.executeTransaction({
        contractName: 'pranaToken',
        methodName: 'transfer',
        params: [],
        options: {}
      })).rejects.toThrow('insufficient funds');
    });

    test('should handle Web3 not initialized', async () => {
      mockStateManager['web3'] = null;

      await expect(transactionManager.getTransactionStatus(testUtils.mockTxHash))
        .rejects.toThrow('Web3 not initialized');
    });
  });

  describe('Performance', () => {
    test('should handle concurrent transaction requests', async () => {
      const mockContract = testUtils.createMockContract(
        testUtils.mockAddresses.pranaToken,
        testUtils.mockABIs.ERC20
      );
      
      mockContract.methods.transfer.mockReturnValue({
        estimateGas: jest.fn(() => Promise.resolve(21000)),
        send: jest.fn(() => Promise.resolve({
          transactionHash: testUtils.mockTxHash,
          blockNumber: 12345,
          gasUsed: 21000,
          status: true
        }))
      });
      
      mockContractManager.getContract.mockReturnValue(mockContract);

      const requests = Array.from({ length: 5 }, () => ({
        contractName: 'pranaToken',
        methodName: 'transfer',
        params: [testUtils.mockAddresses.user, '1000000000000000000'],
        options: {}
      }));

      const promises = requests.map(req => 
        transactionManager.executeTransactionQueued(req)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(txId => {
        expect(typeof txId).toBe('string');
      });
    });

    test('should limit concurrent executions', () => {
      const config = (transactionManager as any).config;
      expect(config.maxConcurrentTransactions).toBe(3);
    });
  });

  describe('Cleanup', () => {
    test('should destroy resources properly', () => {
      // Add some mock data
      (transactionManager as any).queue.set('test', { id: 'test' });
      (transactionManager as any).gasPriceCache.price = '20000000000';

      transactionManager.destroy();

      expect(transactionManager.queueSize).toBe(0);
      expect((transactionManager as any).gasPriceCache.price).toBeNull();
    });
  });
});