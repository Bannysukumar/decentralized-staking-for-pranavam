/**
 * Unit Tests for UnifiedWalletManager
 * Tests wallet connection, disconnection, and state management
 */

import { UnifiedWalletManager } from '../UnifiedWalletManager';
import { stateManager } from '../../state/ReactiveStateManager';

// Mock dependencies
jest.mock('../../state/ReactiveStateManager');
jest.mock('../../../services/LoggingService.js');
jest.mock('../../../config/networks.js', () => ({
  getNetworkConfig: jest.fn((chainId) => ({
    name: chainId === 1 ? 'Ethereum' : 'BSC',
    chainId,
    addNetworkParams: { chainId: `0x${chainId.toString(16)}` }
  })),
  isNetworkSupported: jest.fn(() => true),
  DEFAULT_NETWORK: 1
}));

describe('UnifiedWalletManager', () => {
  let walletManager: UnifiedWalletManager;
  let mockStateManager: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup state manager mock
    mockStateManager = {
      setWeb3Instance: jest.fn(),
      updateState: jest.fn(),
      subscribe: jest.fn(),
      isWalletConnected: jest.fn(() => false),
      getCurrentAccount: jest.fn(() => null)
    };
    (stateManager as any) = mockStateManager;
    
    // Create fresh wallet manager instance
    walletManager = new UnifiedWalletManager();
  });

  afterEach(() => {
    walletManager.destroy();
  });

  describe('Initialization', () => {
    test('should initialize with default providers', () => {
      expect(walletManager).toBeDefined();
      expect(walletManager.isConnected).toBe(false);
      expect(walletManager.currentAccount).toBeNull();
    });

    test('should have available providers', () => {
      const providers = walletManager.availableProviders;
      expect(providers).toContain('metamask');
      // Note: Other providers might not be available in test environment
    });
  });

  describe('Wallet Connection', () => {
    beforeEach(() => {
      // Mock successful MetaMask response
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F']) // eth_requestAccounts
        .mockResolvedValueOnce('0x1'); // eth_chainId
    });

    test('should connect to MetaMask successfully', async () => {
      const result = await walletManager.connectWallet('metamask');

      expect(result).toEqual({
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: 1,
        provider: expect.any(Object),
        web3: expect.any(Object)
      });

      expect(mockStateManager.setWeb3Instance).toHaveBeenCalled();
      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        connected: true,
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: 1,
        networkName: 'Ethereum',
        provider: 'metamask'
      });
    });

    test('should handle connection to non-existent provider', async () => {
      await expect(walletManager.connectWallet('nonexistent'))
        .rejects.toThrow('Provider nonexistent not found');
    });

    test('should handle MetaMask not available', async () => {
      // Temporarily disable MetaMask
      const originalEthereum = window.ethereum;
      delete (window as any).ethereum;

      await expect(walletManager.connectWallet('metamask'))
        .rejects.toThrow('Provider metamask not found');

      // Restore
      window.ethereum = originalEthereum;
    });

    test('should prevent concurrent connections', async () => {
      const connection1 = walletManager.connectWallet('metamask');
      
      await expect(walletManager.connectWallet('metamask'))
        .rejects.toThrow('Connection already in progress');

      await connection1; // Wait for first connection to complete
    });

    test('should store last connected wallet in localStorage', async () => {
      await walletManager.connectWallet('metamask');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'pranavam_last_wallet',
        'metamask'
      );
    });
  });

  describe('Wallet Disconnection', () => {
    beforeEach(async () => {
      // Connect first
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x1');
      
      await walletManager.connectWallet('metamask');
    });

    test('should disconnect wallet successfully', async () => {
      await walletManager.disconnectWallet();

      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        connected: false,
        account: null,
        chainId: null,
        balance: '0',
        networkName: null,
        provider: null
      });

      expect(localStorage.removeItem).toHaveBeenCalledWith('pranavam_last_wallet');
    });

    test('should handle disconnection when not connected', async () => {
      const freshWalletManager = new UnifiedWalletManager();
      
      // Should not throw error
      await expect(freshWalletManager.disconnectWallet())
        .resolves.toBeUndefined();
        
      freshWalletManager.destroy();
    });
  });

  describe('Network Switching', () => {
    beforeEach(async () => {
      // Connect first
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x1');
      
      await walletManager.connectWallet('metamask');
    });

    test('should switch network successfully', async () => {
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(null); // wallet_switchEthereumChain

      await walletManager.switchNetwork(56); // BSC

      expect(window.ethereum.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x38' }]
      });

      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        chainId: 56,
        networkName: 'BSC'
      });
    });

    test('should handle network not added error', async () => {
      const error = new Error('Network not found');
      (error as any).code = 4902;
      
      window.ethereum.request = jest.fn()
        .mockRejectedValueOnce(error) // wallet_switchEthereumChain fails
        .mockResolvedValueOnce(null); // wallet_addEthereumChain succeeds

      await walletManager.switchNetwork(56);

      expect(window.ethereum.request).toHaveBeenCalledWith({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: '0x38' }]
      });
    });

    test('should handle switch network when not connected', async () => {
      const freshWalletManager = new UnifiedWalletManager();
      
      await expect(freshWalletManager.switchNetwork(56))
        .rejects.toThrow('No wallet connected');
        
      freshWalletManager.destroy();
    });
  });

  describe('Auto Reconnection', () => {
    test('should auto-reconnect with stored wallet', async () => {
      localStorage.getItem = jest.fn(() => 'metamask');
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x1');

      const result = await walletManager.tryAutoReconnect();

      expect(result).toBe(true);
      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', 
        expect.objectContaining({
          connected: true,
          account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'
        })
      );
    });

    test('should return false when no stored wallet', async () => {
      localStorage.getItem = jest.fn(() => null);

      const result = await walletManager.tryAutoReconnect();

      expect(result).toBe(false);
    });

    test('should return false when auto-reconnect fails', async () => {
      localStorage.getItem = jest.fn(() => 'metamask');
      window.ethereum.request = jest.fn()
        .mockRejectedValueOnce(new Error('User rejected'));

      const result = await walletManager.tryAutoReconnect();

      expect(result).toBe(false);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      // Connect wallet first
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x1');
      
      await walletManager.connectWallet('metamask');
    });

    test('should handle accounts changed event', async () => {
      const handleAccountsChanged = (walletManager as any).handleAccountsChanged;
      
      await handleAccountsChanged(['0x' + '2'.repeat(40)]);

      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        account: '0x' + '2'.repeat(40)
      });
    });

    test('should disconnect when accounts become empty', async () => {
      const handleAccountsChanged = (walletManager as any).handleAccountsChanged;
      
      await handleAccountsChanged([]);

      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        connected: false,
        account: null,
        chainId: null,
        balance: '0',
        networkName: null,
        provider: null
      });
    });

    test('should handle chain changed event', async () => {
      const handleChainChanged = (walletManager as any).handleChainChanged;
      
      await handleChainChanged('0x38'); // BSC

      expect(mockStateManager.updateState).toHaveBeenCalledWith('wallet', {
        chainId: 56,
        networkName: 'BSC'
      });
    });
  });

  describe('State Management Integration', () => {
    test('should set up state listeners on initialization', () => {
      expect(mockStateManager.subscribe).toHaveBeenCalled();
    });

    test('should provide correct getters', () => {
      mockStateManager.isWalletConnected.mockReturnValue(true);
      mockStateManager.getCurrentAccount.mockReturnValue('0x123');

      expect(walletManager.isConnected).toBe(true);
      expect(walletManager.currentAccount).toBe('0x123');
    });
  });

  describe('Error Handling', () => {
    test('should handle Web3 initialization failure', async () => {
      // Mock a scenario where Web3 constructor throws
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      window.ethereum.request = jest.fn()
        .mockRejectedValueOnce(new Error('Web3 initialization failed'));

      await expect(walletManager.connectWallet('metamask'))
        .rejects.toThrow();

      consoleSpy.mockRestore();
    });

    test('should handle network validation failure gracefully', async () => {
      const { isNetworkSupported } = require('../../../config/networks.js');
      isNetworkSupported.mockReturnValue(false);

      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x999') // Unsupported chain
        .mockResolvedValueOnce(null); // Switch network success

      await walletManager.connectWallet('metamask');

      // Should attempt to switch to default network
      expect(window.ethereum.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1' }]
      });
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on destroy', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      walletManager.destroy();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('UnifiedWalletManager destroyed')
      );

      consoleSpy.mockRestore();
    });
  });
});

// Additional test for provider implementations
describe('Wallet Provider Implementations', () => {
  describe('MetaMaskProvider', () => {
    test('should detect MetaMask availability correctly', () => {
      const { MetaMaskProvider } = require('../UnifiedWalletManager');
      const provider = new MetaMaskProvider();

      expect(provider.isAvailable).toBe(true);
      expect(provider.name).toBe('MetaMask');
    });

    test('should handle connection when MetaMask is available', async () => {
      window.ethereum.request = jest.fn()
        .mockResolvedValueOnce(['0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F'])
        .mockResolvedValueOnce('0x1');

      const { MetaMaskProvider } = require('../UnifiedWalletManager');
      const provider = new MetaMaskProvider();

      const result = await provider.connect();

      expect(result).toEqual({
        account: '0x742C4B7bc1e7b53Ad55F5C22C6F42A1c5a48F19F',
        chainId: 1,
        provider: window.ethereum,
        web3: expect.any(Object)
      });
    });
  });
});