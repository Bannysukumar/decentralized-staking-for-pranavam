/**
 * Unit Tests for ReactiveStateManager
 * Tests state management, subscriptions, and synchronization
 */

import { ReactiveStateManager } from '../ReactiveStateManager';

// Mock dependencies
jest.mock('../../../services/LoggingService.js');

describe('ReactiveStateManager', () => {
  let stateManager: ReactiveStateManager;

  beforeEach(() => {
    stateManager = new ReactiveStateManager();
  });

  afterEach(() => {
    stateManager.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      const walletState = stateManager.getState('wallet');
      const contractsState = stateManager.getState('contracts');
      const exchangeState = stateManager.getState('exchange');
      const stakingState = stateManager.getState('staking');
      const transactionsState = stateManager.getState('transactions');

      expect(walletState).toEqual({
        connected: false,
        account: null,
        chainId: null,
        balance: '0',
        networkName: null
      });

      expect(contractsState).toEqual({
        loaded: false,
        instances: expect.any(Map),
        addresses: expect.any(Map)
      });

      expect(exchangeState).toEqual({
        pranaReserve: '0',
        usdtReserve: '0',
        exchangeRate: 0,
        totalVolume: '0',
        userVolume: '0'
      });

      expect(stakingState).toEqual({
        totalStaked: '0',
        userStaked: '0',
        pendingRewards: '0',
        apy: 0
      });

      expect(transactionsState).toEqual({
        pending: expect.any(Map),
        history: [],
        gasPrice: '0'
      });
    });
  });

  describe('State Management', () => {
    test('should update state correctly', () => {
      const newWalletState = {
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: 1
      };

      stateManager.updateState('wallet', newWalletState);

      const updatedState = stateManager.getState('wallet');
      expect(updatedState).toEqual({
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: 1,
        balance: '0', // Preserved from original state
        networkName: null // Preserved from original state
      });
    });

    test('should merge state updates with existing state', () => {
      // Initial update
      stateManager.updateState('wallet', {
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'
      });

      // Second update
      stateManager.updateState('wallet', {
        balance: '1.5',
        networkName: 'Ethereum'
      });

      const finalState = stateManager.getState('wallet');
      expect(finalState).toEqual({
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: null,
        balance: '1.5',
        networkName: 'Ethereum'
      });
    });
  });

  describe('Subscription System', () => {
    test('should subscribe to state changes', () => {
      const callback = jest.fn();
      
      stateManager.subscribe('wallet', callback);
      stateManager.updateState('wallet', { connected: true });

      expect(callback).toHaveBeenCalledWith({
        type: 'wallet',
        data: expect.objectContaining({ connected: true }),
        timestamp: expect.any(Number)
      });
    });

    test('should support multiple subscribers', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      stateManager.subscribe('wallet', callback1);
      stateManager.subscribe('wallet', callback2);
      stateManager.updateState('wallet', { connected: true });

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    test('should support global listeners with * event', () => {
      const globalCallback = jest.fn();
      
      stateManager.subscribe('*', globalCallback);
      stateManager.updateState('wallet', { connected: true });
      stateManager.updateState('exchange', { pranaReserve: '1000' });

      expect(globalCallback).toHaveBeenCalledTimes(2);
      expect(globalCallback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'wallet' })
      );
      expect(globalCallback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'exchange' })
      );
    });

    test('should unsubscribe correctly', () => {
      const callback = jest.fn();
      
      stateManager.subscribe('wallet', callback);
      stateManager.updateState('wallet', { connected: true });
      expect(callback).toHaveBeenCalledTimes(1);

      stateManager.unsubscribe('wallet', callback);
      stateManager.updateState('wallet', { connected: false });
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should handle subscription errors gracefully', () => {
      const faultyCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const goodCallback = jest.fn();

      stateManager.subscribe('wallet', faultyCallback);
      stateManager.subscribe('wallet', goodCallback);

      // Should not throw and should still call good callback
      expect(() => {
        stateManager.updateState('wallet', { connected: true });
      }).not.toThrow();

      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Web3 Integration', () => {
    test('should set Web3 instance', () => {
      const mockWeb3 = { eth: { getBalance: jest.fn() } };
      
      stateManager.setWeb3Instance(mockWeb3);
      
      expect((stateManager as any).web3).toBe(mockWeb3);
    });

    test('should handle sync state without Web3', async () => {
      // Should not throw when Web3 is not set
      await expect(stateManager.syncState()).resolves.toBeUndefined();
    });

    test('should sync wallet balance when Web3 is available', async () => {
      const mockWeb3 = {
        eth: {
          getBlockNumber: jest.fn(() => Promise.resolve(12345)),
          getBalance: jest.fn(() => Promise.resolve('1500000000000000000')),
        },
        utils: {
          fromWei: jest.fn(() => '1.5')
        }
      };

      stateManager.setWeb3Instance(mockWeb3);
      stateManager.updateState('wallet', {
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        balance: '1.0'
      });

      await stateManager.syncState();

      expect(mockWeb3.eth.getBalance).toHaveBeenCalledWith(
        '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'
      );

      const updatedState = stateManager.getState('wallet');
      expect(updatedState.balance).toBe('1.5');
    });
  });

  describe('Contract Event Handling', () => {
    test('should handle contract events and sync state', () => {
      const callback = jest.fn();
      stateManager.subscribe('contractEvent', callback);

      const mockEvent = {
        transactionHash: '0x123',
        blockNumber: 12345,
        returnValues: { amount: '1000' }
      };

      (stateManager as any).handleContractEvent('pranaExchange', 'PRANAPurchased', mockEvent);

      expect(callback).toHaveBeenCalledWith({
        type: 'contractEvent',
        data: mockEvent.returnValues,
        timestamp: expect.any(Number),
        blockNumber: 12345,
        transactionHash: '0x123'
      });
    });

    test('should watch contract events', () => {
      const mockContract = {
        events: {
          Transfer: jest.fn(() => ({
            on: jest.fn(),
            unsubscribe: jest.fn()
          }))
        }
      };

      // Mock contract instances
      const contractsState = stateManager.getState('contracts');
      contractsState.instances.set('pranaToken', mockContract);

      stateManager.watchContract('pranaToken', ['Transfer']);

      expect(mockContract.events.Transfer).toHaveBeenCalledWith({
        fromBlock: 'latest'
      });
    });

    test('should unwatch contract events', () => {
      const mockUnsubscribe = jest.fn();
      const mockWatcher = { unsubscribe: mockUnsubscribe };

      // Set up watcher
      (stateManager as any).contractWatchers.set('pranaToken', [mockWatcher]);

      stateManager.unwatchContract('pranaToken');

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    test('should check wallet connection status', () => {
      expect(stateManager.isWalletConnected()).toBe(false);

      stateManager.updateState('wallet', { connected: true });
      expect(stateManager.isWalletConnected()).toBe(true);
    });

    test('should get current account', () => {
      expect(stateManager.getCurrentAccount()).toBeNull();

      const account = '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F';
      stateManager.updateState('wallet', { account });
      expect(stateManager.getCurrentAccount()).toBe(account);
    });

    test('should get contract instances', () => {
      const mockContract = { address: '0x123' };
      const contractsState = stateManager.getState('contracts');
      contractsState.instances.set('pranaToken', mockContract);

      expect(stateManager.getContractInstance('pranaToken')).toBe(mockContract);
      expect(stateManager.getContractInstance('nonexistent')).toBeUndefined();
    });
  });

  describe('State Synchronization', () => {
    beforeEach(() => {
      const mockWeb3 = {
        eth: {
          getBlockNumber: jest.fn(() => Promise.resolve(12345)),
          getBalance: jest.fn(() => Promise.resolve('1000000000000000000'))
        },
        utils: {
          fromWei: jest.fn(() => '1.0'),
          toBN: jest.fn()
        }
      };

      stateManager.setWeb3Instance(mockWeb3);
      stateManager.updateState('wallet', {
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'
      });
    });

    test('should sync state at specific block number', async () => {
      const mockWeb3 = (stateManager as any).web3;
      
      await stateManager.syncState(12346);

      expect(mockWeb3.eth.getBalance).toHaveBeenCalledWith(
        '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'
      );
    });

    test('should handle sync errors gracefully', async () => {
      const mockWeb3 = (stateManager as any).web3;
      mockWeb3.eth.getBalance.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(stateManager.syncState()).resolves.toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    test('should destroy resources properly', () => {
      const callback = jest.fn();
      stateManager.subscribe('wallet', callback);

      // Add mock contract watcher
      const mockWatcher = { unsubscribe: jest.fn() };
      (stateManager as any).contractWatchers.set('test', [mockWatcher]);

      stateManager.destroy();

      // Test that subscriptions are cleared
      stateManager.updateState('wallet', { connected: true });
      expect(callback).not.toHaveBeenCalled();

      // Test that watchers are unsubscribed
      expect(mockWatcher.unsubscribe).toHaveBeenCalled();

      // Test that state is cleared
      expect(stateManager.getState('wallet')).toBeUndefined();
    });
  });

  describe('Performance', () => {
    test('should handle many subscribers efficiently', () => {
      const callbacks = Array.from({ length: 100 }, () => jest.fn());
      
      // Subscribe all callbacks
      callbacks.forEach(callback => {
        stateManager.subscribe('wallet', callback);
      });

      const startTime = Date.now();
      stateManager.updateState('wallet', { connected: true });
      const endTime = Date.now();

      // Should complete quickly (less than 10ms)
      expect(endTime - startTime).toBeLessThan(10);

      // All callbacks should be called
      callbacks.forEach(callback => {
        expect(callback).toHaveBeenCalled();
      });
    });

    test('should handle rapid state updates', () => {
      const callback = jest.fn();
      stateManager.subscribe('wallet', callback);

      // Rapid updates
      for (let i = 0; i < 100; i++) {
        stateManager.updateState('wallet', { balance: i.toString() });
      }

      expect(callback).toHaveBeenCalledTimes(100);
      expect(stateManager.getState('wallet').balance).toBe('99');
    });
  });
});